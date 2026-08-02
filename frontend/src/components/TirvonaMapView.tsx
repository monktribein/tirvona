import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./TirvonaMapView.css";
import { hasValidCoordinates } from "../utils/geo";

// ─────────────────────────────────────────────────────────────────────────────
// Shared OpenStreetMap / Leaflet map.
//
// Vanilla Leaflet with a thin React wrapper rather than react-leaflet — the same
// approach lib/razorpay.ts takes with its SDK, and it keeps the dependency count
// at one while giving full control over markers and lifecycle.
//
// Two deliberate choices worth knowing:
//
//   • Markers are `divIcon`s styled with Tailwind, not Leaflet's default PNG
//     pins. Leaflet's bundled icons resolve their own image paths at runtime and
//     break under Vite (the well-known "missing marker icon" bug). Rendering our
//     own HTML sidesteps that entirely and keeps pins on-brand.
//
//   • The OpenStreetMap attribution control is always on. OSM's licence
//     requires visible credit, so it is not made optional.
// ─────────────────────────────────────────────────────────────────────────────

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  /** Small pill on the pin, e.g. "12 free" or "₹90". */
  badge?: string;
  /** Renders a "View details" link inside the popup. */
  href?: string;
  active?: boolean;
}

export interface TirvonaMapProps {
  markers?: MapMarker[];
  /** [latitude, longitude]. Ignored when `fitToMarkers` has something to fit. */
  center?: [number, number];
  zoom?: number;
  /** Any CSS height. Leaflet needs an explicit height or the container collapses. */
  height?: string;
  className?: string;
  /** false → a static preview: no drag, no zoom, no scroll-hijack. */
  interactive?: boolean;
  /** Zoom to contain every marker. */
  fitToMarkers?: boolean;
  onMarkerClick?: (id: string) => void;
  /** Click anywhere to drop/move the pin — used by the ashram wizard. */
  onMapClick?: (latitude: number, longitude: number) => void;
  /** Lets the single pin be dragged to fine-tune a position. */
  draggableMarker?: boolean;
  onMarkerDrag?: (latitude: number, longitude: number) => void;
  ariaLabel?: string;
}

const DEFAULT_CENTER: [number, number] = [25.3176, 82.9739]; // Varanasi

// OSM's current official endpoint. The old a/b/c subdomain form is deprecated —
// HTTP/2 makes it pointless and OSM asks clients not to use it.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// The OpenStreetMap credit is not passed to the tile layer — it is rendered as
// a caption under the map instead, so the tiles stay uncluttered. See the
// credit line at the bottom of this component.

/** Escape values before they go into marker/popup HTML strings. */
const esc = (value: string) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

/** On-brand pin, built as HTML so no image asset has to resolve. */
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
  const link = marker.href
    ? `<a href="${esc(marker.href)}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#0A4DA6;text-decoration:none;">View details →</a>`
    : "";

  return `<div style="min-width:150px;font-family:Inter,system-ui,sans-serif;">
      <p style="margin:0;font-size:12px;font-weight:800;color:#0B192C;">${esc(marker.title)}</p>
      ${subtitle}${link}
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

  // Create the map once. The cleanup is what makes this safe under React 19
  // StrictMode, which mounts effects twice — without remove() the second mount
  // throws "Map container is already initialized".
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: center || DEFAULT_CENTER,
      zoom,
      // A static preview should not swallow the page scroll under the cursor.
      scrollWheelZoom: interactive,
      dragging: interactive,
      zoomControl: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      // No on-map attribution badge — it is rendered as a caption beneath the
      // map instead (see the credit line in the JSX below). OSM's licence
      // requires the credit to be visible near the map, not necessarily
      // overlaid on it, so moving it out keeps the map surface clean without
      // dropping the attribution.
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      // No `attribution` here for the same reason: the credit lives in the
      // caption, so there is no control for Leaflet to feed it into.
      // OSM's tile policy asks that clients identify themselves via Referer,
      // which the browser sends automatically; no key is required.
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
    // Built once; subsequent prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map click → report coordinates (wizard "drop a pin here").
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

  // Redraw markers whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    validMarkers.forEach((m) => {
      const pin = L.marker([m.latitude, m.longitude], {
        icon: buildIcon(m),
        draggable: draggableMarker,
        keyboard: true,
        title: m.title,
        alt: m.title,
      });

      if (m.title || m.subtitle) pin.bindPopup(buildPopup(m));
      if (onMarkerClick) pin.on("click", () => onMarkerClick(m.id));
      if (draggableMarker && onMarkerDrag) {
        pin.on("dragend", () => {
          const { lat, lng } = pin.getLatLng();
          onMarkerDrag(lat, lng);
        });
      }

      pin.addTo(layer);
    });

    if (fitToMarkers && validMarkers.length > 0) {
      const bounds = L.latLngBounds(
        validMarkers.map((m) => [m.latitude, m.longitude] as [number, number]),
      );
      // A single marker has zero-area bounds, which fitBounds would zoom to the
      // maximum on — pad it so one pin still shows useful surrounding context.
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
    onMarkerClick,
    onMarkerDrag,
  ]);

  // Recentre when the caller moves the view (e.g. wizard coordinates typed in).
  // Split into primitives so the effect re-runs on a coordinate change rather
  // than on every new array identity the parent happens to render.
  const centerLat = center?.[0];
  const centerLng = center?.[1];

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      centerLat === undefined ||
      centerLng === undefined ||
      fitToMarkers
    )
      return;
    map.setView([centerLat, centerLng], zoom);
  }, [ready, centerLat, centerLng, zoom, fitToMarkers]);

  // Leaflet measures its container on creation. If the map is inside a panel
  // that was hidden or has just resized, tiles render into stale dimensions
  // until it is told to re-measure.
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
    <div className="w-full">
      <div
        ref={containerRef}
        role="application"
        aria-label={ariaLabel}
        className={`tirvona-map w-full rounded-[24px] overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 ${className}`}
        style={{ height }}
      />
    </div>
  );
};

export default TirvonaMapView;
