import { useCallback, useEffect, useRef, useState } from 'react';
import { leadApi } from '../services/leadApi';

/**
 * Records the agent's route while they work, but only ever with their consent.
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

const QUEUE_KEY = 'tirvona_lead_track_queue';
const SAMPLE_MS = 60_000; // one fix a minute
const FLUSH_EVERY = 10; // or sooner, once ten are queued
const FLUSH_MS = 5 * 60_000;
const MAX_QUEUE = 100; // matches the server's batch cap

const readQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (fixes) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(fixes.slice(-MAX_QUEUE)));
  } catch {
    // A full or blocked storage must not take tracking down with it.
  }
};

export function useMovementTracker() {
  const [consent, setConsent] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(() => readQueue().length);
  const [lastFixAt, setLastFixAt] = useState(null);

  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const queueRef = useRef(readQueue());
  const flushingRef = useRef(false);

  const persist = useCallback((fixes) => {
    queueRef.current = fixes;
    writeQueue(fixes);
    setPending(fixes.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const batch = queueRef.current;
    if (!batch.length) return;

    flushingRef.current = true;
    try {
      await leadApi.sendTrackingFixes(batch);
      persist([]);
      setError('');
    } catch (err) {
      // Keep the queue: the points are still valid, the network was not.
      setError(err.message || 'Could not upload your route yet.');
    } finally {
      flushingRef.current = false;
    }
  }, [persist]);

  const loadConsent = useCallback(async () => {
    try {
      const data = await leadApi.getTrackingConsent();
      setConsent(data?.consent ?? null);
      return data?.consent ?? null;
    } catch (err) {
      setError(err.message || 'Could not read your tracking setting.');
      return null;
    }
  }, []);

  useEffect(() => {
    void loadConsent();
  }, [loadConsent]);

  const stop = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTracking(false);
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('This device cannot report its location.');
      return;
    }
    if (watchRef.current != null) return;

    let lastSampleAt = 0;

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
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
  }, [flush, persist, stop]);

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

  // Resume automatically for an agent who already consented, and push any
  // fixes left over from a previous session.
  useEffect(() => {
    if (consent?.granted) {
      start();
      void flush();
    }
    return stop;
  }, [consent?.granted, start, stop, flush]);

  // A backgrounded tab may be frozen without warning; send what we have.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  return {
    consent,
    tracking,
    error,
    pending,
    lastFixAt,
    updateConsent,
    flush,
    reload: loadConsent
  };
}
