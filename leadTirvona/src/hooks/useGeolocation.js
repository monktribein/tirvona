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
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        onSuccess({ lat, lng });
        setIsCapturing(false);
      },
      (err) => {
        console.warn('[useGeolocation] GPS error:', err.code, err.message);
        setIsCapturing(false);
        // 1 = denied, 2 = the device has no position, 3 = no fix in time.
        setGpsError(
          err.code === 1
            ? 'Location is blocked for this site. Allow it in your browser settings and try again.'
            : err.code === 2
            ? 'Your device could not find its location. Turn on Location services in your device settings and try again.'
            : err.code === 3
            ? 'Finding your location took too long. Try again, near a window or outdoors.'
            : 'Unable to capture location. Please try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return { isCapturing, gpsError, captureCurrentLocation };
}
