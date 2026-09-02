import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./TirvonaMapView.css";
import { hasValidCoordinates } from "../utils/geo";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  badge?: string;
  href?: string;
  active?: boolean;
}

export interface TirvonaMapProps {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  className?: string;
  interactive?: boolean;
  fitToMarkers?: boolean;
  activeMarkerId?: string;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (latitude: number, longitude: number) => void;
  draggableMarker?: boolean;
  onMarkerDrag?: (latitude: number, longitude: number) => void;
  ariaLabel?: string;
}

const DEFAULT_CENTER: [number, number] = [25.3176, 82.9739]; // Varanasi

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const esc = (value: string) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

const buildIcon = (marker: MapMarker) => {
  const colour = marker.active ? "#E58C28" : "#0A4DA6";
  const badge = marker.badge
    ? `<span style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0B192C;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:9999px;">${esc(marker.badge)}</span>`
    : "";

  return L.divIcon({
    className: "tirvona-map-pin",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        ${badge}
        <svg width="30" height="40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20c0-6.6-5.4-12-12-12z" fill="${colour}"/>
          <circle cx="12" cy="12" r="4.5" fill="#fff"/>
        </svg>
      </div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38],
  });
};

const buildPopup = (marker: MapMarker) => {
  const subtitle = marker.subtitle
    ? `<p style="margin:2px 0 0;font-size:11px;color:#64748b;font-weight:500;">${esc(marker.subtitle)}</p>`
    : "";
  const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(marker.title + " " + (marker.subtitle || ""))}`;
  const link = marker.href
    ? `<a href="${esc(marker.href)}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#0A4DA6;text-decoration:none;">View details →</a>`
    : `<a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#0A4DA6;text-decoration:none;">Open in Google Maps ↗</a>`;

  return `<div style="min-width:160px;font-family:Inter,system-ui,sans-serif;">
      <p style="margin:0;font-size:12px;font-weight:800;color:#0B192C;">${esc(marker.title)}</p>
      ${subtitle}
      <div>${link}</div>
    </div>`;
};

export const TirvonaMapView: React.FC<TirvonaMapProps> = ({
  markers = [],
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  const validMarkers = useMemo(
    () => markers.filter((m) => hasValidCoordinates(m.latitude, m.longitude)),
    [markers],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: center || DEFAULT_CENTER,
      zoom,
      scrollWheelZoom: interactive,
      dragging: interactive,
      zoomControl: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;

    const handler = (e: L.LeafletMouseEvent) =>
      onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [ready, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    let targetPin: L.Marker | null = null;

    validMarkers.forEach((m) => {
      const isActive = Boolean(m.active || (activeMarkerId && m.id === activeMarkerId));
      const markerData = isActive ? { ...m, active: true } : m;
      const pin = L.marker([m.latitude, m.longitude], {
        icon: buildIcon(markerData),
        draggable: draggableMarker,
        keyboard: true,
        title: m.title,
        alt: m.title,
      });

      if (m.title || m.subtitle) pin.bindPopup(buildPopup(markerData));
      if (onMarkerClick) pin.on("click", () => onMarkerClick(m.id));
      if (draggableMarker && onMarkerDrag) {
        pin.on("dragend", () => {
          const { lat, lng } = pin.getLatLng();
          onMarkerDrag(lat, lng);
        });
      }

      pin.addTo(layer);

      if (isActive) {
        targetPin = pin;
      }
    });

    if (targetPin) {
      (targetPin as L.Marker).openPopup();
    } else if (fitToMarkers && validMarkers.length > 0) {
      const bounds = L.latLngBounds(
        validMarkers.map((m) => [m.latitude, m.longitude] as [number, number]),
      );
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: validMarkers.length === 1 ? 15 : 16,
      });
    }
  }, [
    ready,
    validMarkers,
    fitToMarkers,
    draggableMarker,
    activeMarkerId,
    onMarkerClick,
    onMarkerDrag,
  ]);

  const centerLat = center?.[0];
  const centerLng = center?.[1];

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      centerLat === undefined ||
      centerLng === undefined
    )
      return;
    map.setView([centerLat, centerLng], zoom, { animate: true });
  }, [ready, centerLat, centerLng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const invalidate = () => map.invalidateSize();
    const timer = window.setTimeout(invalidate, 120);
    window.addEventListener("resize", invalidate);

    const observer =
      typeof ResizeObserver !== "undefined" && containerRef.current
        ? new ResizeObserver(invalidate)
        : null;
    if (observer && containerRef.current)
      observer.observe(containerRef.current);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", invalidate);
      observer?.disconnect();
    };
  }, [ready]);

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

export default TirvonaMapView;
