import { useCallback, useEffect, useRef, useState } from 'react';
import { leadApi } from '../services/leadApi';

/**
 * Records the agent's route during a shift: location goes on at check-in and
 * off at check-out, and only ever with their consent.
 *
 * Two things shape the design. Field agents work in villages with patchy
 * signal, so fixes are queued locally and uploaded in batches rather than one
 * request per point - a dropped connection costs nothing but a delay. And the
 * browser only reports position while the tab is alive, so the queue is
 * persisted to localStorage and flushed on the next visit.
 *
 * The server re-checks consent and re-filters every point, so nothing here is
 * a security control; it is battery and bandwidth economy.
 */

// Each agent has their own queue, so points recorded on a shared phone are
// never uploaded under whoever signs in next.
const QUEUE_KEY = 'tirvona_lead_track_queue';
const LEGACY_QUEUE_KEY = QUEUE_KEY; // the old, unscoped queue (owner unknown)
const SAMPLE_MS = 30_000; // one fix every 30 seconds, enough to draw the road taken
const FLUSH_EVERY = 4; // upload every ~2 minutes so supervisors see a near-live path
const FLUSH_MS = 2 * 60_000;
const BATCH_SIZE = 100; // the server's cap per upload
const MAX_QUEUE = 2000; // ~16 hours offline at one fix every 30 seconds

const queueKey = (agentId) => (agentId ? `${QUEUE_KEY}:${agentId}` : null);

const readQueue = (key) => {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (key, fixes) => {
  if (!key) return;
  try {
    if (fixes.length) localStorage.setItem(key, JSON.stringify(fixes.slice(-MAX_QUEUE)));
    else localStorage.removeItem(key);
  } catch {
    // A full or blocked storage must not take tracking down with it.
  }
};

try {
  // Points in the old shared queue cannot be attributed to an agent safely.
  localStorage.removeItem(LEGACY_QUEUE_KEY);
} catch {
  /* storage unavailable */
}

/** `agentId` is the signed-in agent; with none, nothing is recorded. */
export function useMovementTracker(agentId) {
  const [consent, setConsent] = useState(null);
  const [onDuty, setOnDuty] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(() => readQueue(queueKey(agentId)).length);
  const [lastFixAt, setLastFixAt] = useState(null);
  const [screenKeptOn, setScreenKeptOn] = useState(false);

  const watchRef = useRef(null);
  const wakeLockRef = useRef(null);
  const timerRef = useRef(null);
  const keyRef = useRef(queueKey(agentId));
  const queueRef = useRef(readQueue(keyRef.current));
  const flushingRef = useRef(false);

  const persist = useCallback((fixes) => {
    queueRef.current = fixes;
    writeQueue(keyRef.current, fixes);
    setPending(fixes.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current || !keyRef.current) return;
    const owner = keyRef.current;

    flushingRef.current = true;
    try {
      // Drain in server-sized batches (a long stretch offline leaves many).
      for (let round = 0; round < MAX_QUEUE / BATCH_SIZE; round += 1) {
        const batch = queueRef.current.slice(0, BATCH_SIZE);
        if (!batch.length || keyRef.current !== owner) break;
        const result = await leadApi.sendTrackingFixes(batch);
        if (keyRef.current !== owner) break; // signed out mid-upload
        // Points recorded while the batch was uploading stay queued.
        persist(queueRef.current.slice(batch.length));
        // The server knows the shift ended (e.g. checked out on another device).
        if (result && result.onDuty === false) setOnDuty(false);
      }
      setError('');
    } catch (err) {
      // Keep the queue: the points are still valid, the network was not.
      setError(err.message || 'Could not upload your route yet.');
    } finally {
      flushingRef.current = false;
    }
  }, [persist]);

  const loadConsent = useCallback(async () => {
    if (!keyRef.current) return null;
    try {
      const data = await leadApi.getTrackingConsent();
      setConsent(data?.consent ?? null);
      setOnDuty(Boolean(data?.onDuty));
      return data?.consent ?? null;
    } catch (err) {
      setError(err.message || 'Could not read your tracking setting.');
      return null;
    }
  }, []);

  // Sign-in, sign-out and switching agents: swap to that agent's own queue
  // and status. Signed out, nothing is recorded.
  useEffect(() => {
    keyRef.current = queueKey(agentId);
    queueRef.current = readQueue(keyRef.current);
    setPending(queueRef.current.length);
    setConsent(null);
    setOnDuty(false);
    setError('');
    if (agentId) void loadConsent();
  }, [agentId, loadConsent]);

  /**
   * A browser stops reporting location once the phone locks. Holding a screen
   * wake lock during the shift keeps the screen (and so the route) alive while
   * the app is open. The browser drops it whenever the app is hidden, so it is
   * taken again each time the agent comes back.
   */
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || document.hidden || wakeLockRef.current) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      setScreenKeptOn(true);
      lock.addEventListener('release', () => {
        if (wakeLockRef.current === lock) wakeLockRef.current = null;
        setScreenKeptOn(false);
      });
    } catch {
      // Battery saver or an unsupported browser: tracking still runs while open.
      setScreenKeptOn(false);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    setScreenKeptOn(false);
    lock?.release().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    releaseWakeLock();
    setTracking(false);
  }, [releaseWakeLock]);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('This device cannot report its location.');
      return;
    }
    if (watchRef.current != null) return;

    let lastSampleAt = 0;

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!keyRef.current) return; // signed out: record nothing
        const now = Date.now();
        // watchPosition fires far more often than we need to store.
        if (now - lastSampleAt < SAMPLE_MS) return;
        lastSampleAt = now;

        const { latitude, longitude, accuracy, speed, heading, altitude } =
          position.coords;

        const next = [
          ...queueRef.current,
          {
            lat: latitude,
            lng: longitude,
            accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
            speed: Number.isFinite(speed) ? speed : undefined,
            heading: Number.isFinite(heading) ? heading : undefined,
            altitude: Number.isFinite(altitude) ? altitude : undefined,
            recordedAt: new Date(position.timestamp || now).toISOString(),
            source: document.hidden ? 'background' : 'foreground'
          }
        ];
        persist(next);
        setLastFixAt(new Date());
        setError('');

        if (next.length >= FLUSH_EVERY) void flush();
      },
      (err) => {
        // A denial is the agent's decision, not a fault to retry.
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            'Location permission is blocked. Allow it in your browser settings to record your route.'
          );
          stop();
          return;
        }
        setError(
          err.code === err.TIMEOUT
            ? 'Still looking for a GPS signal.'
            : 'Location is unavailable right now.'
        );
      },
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 15_000 }
    );

    timerRef.current = setInterval(() => void flush(), FLUSH_MS);
    setTracking(true);
    void acquireWakeLock();
  }, [flush, persist, stop, acquireWakeLock]);

  /** Turning consent on starts the watch; turning it off stops it at once. */
  const updateConsent = useCallback(
    async (granted) => {
      try {
        const label =
          typeof navigator !== 'undefined' ? navigator.platform || '' : '';
        const next = await leadApi.setTrackingConsent(granted, label);
        setConsent(next);
        if (granted) start();
        else {
          stop();
          persist([]);
        }
        setError('');
        return next;
      } catch (err) {
        setError(err.message || 'Could not save your tracking setting.');
        throw err;
      }
    },
    [persist, start, stop]
  );

  /** Check-in: location on. Consent is recorded the first time. */
  const startShift = useCallback(async () => {
    if (!consent?.granted) await updateConsent(true);
    setOnDuty(true);
    start();
  }, [consent?.granted, start, updateConsent]);

  /**
   * Check-out: upload everything recorded during the shift first, then turn
   * location off. Call this before the check-out request so the last stretch
   * of the route is not lost.
   */
  const endShift = useCallback(async () => {
    await flush();
    stop();
    setOnDuty(false);
  }, [flush, stop]);

  // Push fixes left over from an earlier visit, then resume the watch only
  // while the agent is checked in: no location is collected off duty.
  useEffect(() => {
    if (!consent?.granted) return undefined;
    void flush();
    if (onDuty) start();
    else stop();
    return stop;
  }, [consent?.granted, onDuty, start, stop, flush]);

  // A backgrounded tab may be frozen without warning; send what we have.
  // Coming back during a shift keeps the screen on again and uploads anything
  // queued while away.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) void flush();
      else if (watchRef.current != null) {
        void acquireWakeLock();
        void flush();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush, acquireWakeLock]);

  return {
    consent,
    onDuty,
    tracking,
    error,
    pending,
    lastFixAt,
    screenKeptOn,
    updateConsent,
    startShift,
    endShift,
    flush,
    reload: loadConsent
  };
}
