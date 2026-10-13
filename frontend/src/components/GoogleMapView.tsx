import React, { useEffect, useMemo, useRef, useState } from "react";
import "./TirvonaMapView.css";
import { hasValidCoordinates } from "../utils/geo";
import { MAX_ROAD_ROUTE_POINTS, computeRoadRoute, loadGoogleMaps } from "../lib/googleMaps";
import type { MapMarker, TirvonaMapProps } from "./TirvonaMapView";

const DEFAULT_CENTER: [number, number] = [25.3176, 82.9739]; // Varanasi

const esc = (value: string) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

const pinSvg = (colour: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg width="30" height="40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20c0-6.6-5.4-12-12-12z" fill="${colour}"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
  )}`;

const buildIcon = (marker: MapMarker): google.maps.Icon => ({
  url: pinSvg(marker.active ? "#E58C28" : "#F28C28"),
  scaledSize: new google.maps.Size(30, 40),
  anchor: new google.maps.Point(15, 40),
  // The badge (if any) floats just above the pin.
  labelOrigin: new google.maps.Point(15, -9),
});

const buildPopup = (marker: MapMarker) => {
  const subtitle = marker.subtitle
    ? `<p style="margin:2px 0 0;font-size:11px;color:#64748b;font-weight:500;">${esc(marker.subtitle)}</p>`
    : "";
  const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${marker.latitude},${marker.longitude}`;
  const link = marker.href
    ? `<a href="${esc(marker.href)}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#F28C28;text-decoration:none;">View details →</a>`
    : `<a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#F28C28;text-decoration:none;">Open in Google Maps ↗</a>`;

  return `<div style="min-width:160px;font-family:Inter,system-ui,sans-serif;">
      <p style="margin:0;font-size:12px;font-weight:800;color:#0B192C;">${esc(marker.title)}</p>
      ${subtitle}
      <div>${link}</div>
    </div>`;
};

/** Google Maps implementation of the Tirvona map. Same props as the Leaflet one. */
export const GoogleMapView: React.FC<TirvonaMapProps & { onLoadError?: () => void }> = ({
  markers = [],
  path,
  pathColour = "#F28C28",
  center,
  zoom = 14,
  height = "320px",
  className = "",
  interactive = true,
  fitToMarkers = false,
  activeMarkerId,
  onMarkerClick,
  onMapClick,
  draggableMarker = false,
  onMarkerDrag,
  ariaLabel = "Map",
  followRoads = false,
  onRoadDistance,
  onLoadError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([]);
  const [ready, setReady] = useState(false);

  const validMarkers = useMemo(
    () => markers.filter((m) => hasValidCoordinates(m.latitude, m.longitude)),
    [markers],
  );

  const validPath = useMemo(
    () => (path ?? []).filter((p) => hasValidCoordinates(p.lat, p.lng)),
    [path],
  );

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const [lat, lng] = center || DEFAULT_CENTER;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom,
          gestureHandling: interactive ? "cooperative" : "none",
          disableDefaultUI: true,
          zoomControl: interactive,
          fullscreenControl: interactive,
          // Map / Satellite switch, so a reported position can be checked from above.
          mapTypeControl: interactive,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT,
            mapTypeIds: ["roadmap", "hybrid"],
          },
          keyboardShortcuts: interactive,
          disableDoubleClickZoom: !interactive,
          clickableIcons: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onLoadError?.();
      });

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      infoRef.current?.close();
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      mapRef.current = null;
      infoRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;

    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [ready, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    const info = infoRef.current;
    if (!map || !info) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    let targetPin: google.maps.Marker | null = null;
    let targetData: MapMarker | null = null;

    validMarkers.forEach((m) => {
      const isActive = Boolean(m.active || (activeMarkerId && m.id === activeMarkerId));
      const markerData = isActive ? { ...m, active: true } : m;
      const pin = new google.maps.Marker({
        map,
        position: { lat: m.latitude, lng: m.longitude },
        icon: buildIcon(markerData),
        label: m.badge
          ? { text: m.badge, className: "tirvona-gmap-badge", color: "#ffffff", fontSize: "9px", fontWeight: "800" }
          : undefined,
        draggable: draggableMarker,
        title: m.title,
        zIndex: isActive ? 3 : 2,
      });

      pin.addListener("click", () => {
        if (m.title || m.subtitle) {
          info.setContent(buildPopup(markerData));
          info.open({ map, anchor: pin });
        }
        onMarkerClick?.(m.id);
      });
      if (draggableMarker && onMarkerDrag) {
        pin.addListener("dragend", () => {
          const pos = pin.getPosition();
          if (pos) onMarkerDrag(pos.lat(), pos.lng());
        });
      }

      overlaysRef.current.push(pin);
      if (isActive) {
        targetPin = pin;
        targetData = markerData;
      }
    });

    if (targetPin && targetData) {
      info.setContent(buildPopup(targetData));
      info.open({ map, anchor: targetPin });
    } else if (fitToMarkers && (validMarkers.length > 0 || validPath.length > 0)) {
      // The whole route has to fit, not just its endpoints.
      const bounds = new google.maps.LatLngBounds();
      validMarkers.forEach((m) => bounds.extend({ lat: m.latitude, lng: m.longitude }));
      validPath.forEach((p) => bounds.extend(p));
      const maxZoom = validMarkers.length + validPath.length === 1 ? 15 : 16;
      map.fitBounds(bounds, 40);
      google.maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom);
      });
    }
  }, [
    ready,
    validMarkers,
    validPath,
    pathColour,
    fitToMarkers,
    draggableMarker,
    activeMarkerId,
    onMarkerClick,
    onMarkerDrag,
  ]);

  // The route line. Its own effect, because following roads is asynchronous.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || validPath.length < 2) {
      onRoadDistance?.(null);
      return;
    }

    const lines: google.maps.Polyline[] = [];
    let cancelled = false;
    const draw = (points: google.maps.LatLngLiteral[] | google.maps.LatLng[]) =>
      lines.push(
        new google.maps.Polyline({
          map,
          path: points,
          strokeColor: pathColour,
          strokeWeight: 5,
          strokeOpacity: 0.8,
          zIndex: 1,
        }),
      );

    // Dense GPS already traces the streets. Sparse points (a gap between fixes)
    // would cut straight across the map, so those are routed along the roads,
    // passing through every recorded point.
    const controller = new AbortController();
    if (!followRoads || validPath.length > MAX_ROAD_ROUTE_POINTS) {
      draw(validPath);
      onRoadDistance?.(null);
    } else {
      computeRoadRoute(validPath, controller.signal)
        .then(({ path: roadPath, km }) => {
          if (cancelled) return;
          draw(roadPath);
          onRoadDistance?.(km);
        })
        .catch((err) => {
          if (cancelled) return;
          // Routes API not enabled for this key, or no road found: plain line.
          console.warn("Road routing unavailable, drawing straight segments.", err?.message ?? err);
          draw(validPath);
          onRoadDistance?.(null);
        });
    }

    return () => {
      cancelled = true;
      controller.abort();
      lines.forEach((line) => line.setMap(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, validPath, pathColour, followRoads]);

  const centerLat = center?.[0];
  const centerLng = center?.[1];

  useEffect(() => {
    const map = mapRef.current;
    if (!map || centerLat === undefined || centerLng === undefined) return;
    map.setZoom(zoom);
    map.panTo({ lat: centerLat, lng: centerLng });
  }, [ready, centerLat, centerLng, zoom]);

  return (
    <div className="relative z-0 isolate w-full overflow-hidden rounded-[24px]">
      <div
        ref={containerRef}
        role="application"
        aria-label={ariaLabel}
        className={`tirvona-map relative z-0 isolate w-full rounded-[24px] overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 ${className}`}
        style={{ height }}
      />
    </div>
  );
};

export default GoogleMapView;
