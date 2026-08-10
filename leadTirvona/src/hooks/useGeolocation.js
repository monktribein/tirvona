/**
 * useGeolocation.js
 *
 * Responsibility: Encapsulates browser Geolocation API interactions.
 * Returns a `captureCurrentLocation()` function that field agents trigger
 * to capture live GPS coordinates during an ashram site visit.
 *
 * Exposes:
 *  - isCapturing  → boolean loading state while GPS resolves
 *  - gpsError     → human-readable error message if capture fails
 *  - captureCurrentLocation(onSuccess) → triggers browser geolocation
 */
import { useState } from 'react';

export function useGeolocation() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const captureCurrentLocation = (onSuccess) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation API is not supported by your browser.');
      return;
    }

    setIsCapturing(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        onSuccess({ lat, lng });
        setIsCapturing(false);
      },
      (err) => {
        console.warn('[useGeolocation] GPS error:', err.message);
        setIsCapturing(false);
        setGpsError(
          'Unable to capture location. Check browser permissions and try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return { isCapturing, gpsError, captureCurrentLocation };
}
