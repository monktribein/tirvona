import { useCallback, useEffect, useRef, useState } from "react";

export type LocationDiscoveryStatus =
  | "idle"
  | "checking"
  | "requesting"
  | "active"
  | "denied"
  | "unsupported"
  | "error";

export type DiscoveryCoordinates = {
  latitude: number;
  longitude: number;
};

const locationErrorMessage = (error: GeolocationPositionError): string => {
  if (error.code === error.PERMISSION_DENIED)
    return "Location access was denied. Search by city or area instead.";
  if (error.code === error.TIMEOUT)
    return "Location detection timed out. Try again or search manually.";
  return "Your location could not be detected. Search by city or area instead.";
};

export const useNearbyAshramDiscovery = () => {
  const [status, setStatus] = useState<LocationDiscoveryStatus>("checking");
  const [coordinates, setCoordinates] =
    useState<DiscoveryCoordinates | null>(null);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("This browser does not support location detection.");
      return;
    }
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setStatus("requesting");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        requestInFlight.current = false;
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus("active");
      },
      (locationError) => {
        requestInFlight.current = false;
        setCoordinates(null);
        setStatus(
          locationError.code === locationError.PERMISSION_DENIED
            ? "denied"
            : "error",
        );
        setError(locationErrorMessage(locationError));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 10_000,
      },
    );
  }, []);

  const clearLocation = useCallback(() => {
    setCoordinates(null);
    setStatus("idle");
    setError("");
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("This browser does not support location detection.");
      return;
    }

    if (!("permissions" in navigator)) {
      setStatus("idle");
      return;
    }

    let active = true;
    let permission: PermissionStatus | null = null;
    const handlePermissionChange = () => {
      if (!active || !permission) return;
      if (permission.state === "granted") requestLocation();
      else if (permission.state === "denied") {
        setCoordinates(null);
        setStatus("denied");
        setError("Location access was denied. Search by city or area instead.");
      } else {
        setCoordinates(null);
        setStatus("idle");
      }
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (!active) return;
        permission = result;
        permission.addEventListener("change", handlePermissionChange);
        handlePermissionChange();
      })
      .catch(() => {
        if (active) setStatus("idle");
      });

    return () => {
      active = false;
      permission?.removeEventListener("change", handlePermissionChange);
    };
  }, [requestLocation]);

  return { status, coordinates, error, requestLocation, clearLocation };
};
