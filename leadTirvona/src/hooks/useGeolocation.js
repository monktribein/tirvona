import { useCallback, useRef, useState } from 'react';

/** A fix this recent is still where the agent is standing. */
const FRESH_MS = 60_000;
/** Once any fix is in hand, the agent is not kept waiting longer than this. */
const TARGET_MS = 2_000;
/** Accurate enough to stop waiting at once (the server keeps route points up to 100 m). */
const GOOD_METRES = 100;

const toFix = (position) => ({
  lat: Number(position.coords.latitude.toFixed(6)),
  lng: Number(position.coords.longitude.toFixed(6)),
  // Metres the phone says its fix may be off by; supervisors see it beside the point.
  accuracy: Number.isFinite(position.coords.accuracy)
    ? Math.round(position.coords.accuracy)
    : null,
  at: position.timestamp || Date.now(),
});

// 1 = denied, 2 = the device has no position, 3 = no fix in time.
const errorText = (err) =>
  err?.code === 1
    ? 'Location is blocked for this site. Allow it in your browser settings and try again.'
    : err?.code === 2
    ? 'Your device could not find its location. Turn on Location services in your device settings and try again.'
    : err?.code === 3
    ? 'Finding your location took too long. Try again, near a window or outdoors.'
    : 'Unable to capture location. Please try again.';

export function useGeolocation() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const lastFix = useRef(null);

  /**
   * Finds a fix in the background while the agent reads the screen, so Check In
   * answers at once. Runs only when location is already allowed: it never asks
   * for permission, and the fix stays on the phone until the agent checks in.
   */
  const prefetchLocation = useCallback(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    let query;
    try {
      query = navigator.permissions.query({ name: 'geolocation' });
    } catch {
      return;
    }
    query
      .then((status) => {
        if (status.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (position) => {
            lastFix.current = toFix(position);
          },
          () => {
            /* Check In asks again */
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
      })
      .catch(() => {});
  }, []);

  const captureCurrentLocation = (onSuccess) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation API is not supported by your browser.');
      return;
    }
    setGpsError('');

    const deliver = (fix) => onSuccess({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });

    // A good fix from the last minute (the warm-up, or the previous capture) is
    // used straight away. A rough one is kept as the fallback while a fresh
    // lookup tries to beat it within the two seconds.
    const recent =
      lastFix.current && Date.now() - lastFix.current.at < FRESH_MS ? lastFix.current : null;
    if (recent && (recent.accuracy ?? Infinity) <= GOOD_METRES) {
      deliver(recent);
      return;
    }

    setIsCapturing(true);
    let settled = false;
    let deadlinePassed = false;
    let best = recent;
    let failures = 0;
    let deadline = null;

    const finish = (fix) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      lastFix.current = fix;
      setIsCapturing(false);
      deliver(fix);
    };

    const giveUp = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      console.warn('[useGeolocation] GPS error:', err.code, err.message);
      setIsCapturing(false);
      setGpsError(errorText(err));
    };

    const onPosition = (position) => {
      if (settled) return;
      const fix = toFix(position);
      if (!best || (fix.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = fix;
      // A good fix ends the wait at once; a rough one waits for the two-second mark.
      if ((fix.accuracy ?? Infinity) <= GOOD_METRES || deadlinePassed) finish(best);
    };

    const onError = (err) => {
      // A block is the agent's choice: stop at once.
      if (err.code === 1) {
        giveUp(err);
        return;
      }
      failures += 1;
      if (failures < 2) return; // the other request may still answer
      if (best) finish(best);
      else giveUp(err);
    };

    // At two seconds, take the best fix so far instead of waiting for a better one.
    // With none yet (e.g. the permission prompt is still open), the first fix to
    // arrive is taken.
    deadline = setTimeout(() => {
      deadlinePassed = true;
      if (best) finish(best);
    }, TARGET_MS);

    // Two requests at once: precise GPS, and a quick one (Wi-Fi and mobile
    // network, or a fix the phone already has) that usually answers well inside
    // two seconds.
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000
    });
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: FRESH_MS
    });
  };

  return { isCapturing, gpsError, captureCurrentLocation, prefetchLocation };
}
