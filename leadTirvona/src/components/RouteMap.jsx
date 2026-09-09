import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * The same Leaflet + OpenStreetMap combination the main Tirvona app uses, so
 * the two surfaces render identical tiles from one provider. Kept small on
 * purpose: this app only ever draws one agent's route for one day.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_CENTRE = [27.4924, 77.6737]; // Mathura

const pin = (colour, label) =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${colour};color:#fff;font-size:10px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

export default function RouteMap({ route = [], stops = [], height = '360px' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTRE,
      zoom: 12,
      attributionControl: false
    });
    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const points = route
      .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
      .map((p) => [p.lat, p.lng]);

    if (points.length > 1)
      L.polyline(points, {
        color: '#0A4DA6',
        weight: 4,
        opacity: 0.75,
        lineJoin: 'round'
      }).addTo(layer);

    // Only the endpoints and the stops get a marker; a pin per fix would
    // bury the route under hundreds of overlapping icons.
    if (points.length)
      L.marker(points[0], { icon: pin('#059669', 'S') })
        .bindPopup('Day start')
        .addTo(layer);

    stops.forEach((stop, index) => {
      if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lng)) return;
      L.marker([stop.lat, stop.lng], { icon: pin('#E58C28', String(index + 1)) })
        .bindPopup(`Stopped ${Math.round(stop.minutes)} min`)
        .addTo(layer);
    });

    if (points.length > 1)
      L.marker(points[points.length - 1], { icon: pin('#0A4DA6', 'E') })
        .bindPopup('Latest position')
        .addTo(layer);

    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [30, 30],
        maxZoom: points.length === 1 ? 15 : 16
      });
  }, [route, stops]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-2xl overflow-hidden border border-slate-200"
      role="img"
      aria-label="Route travelled by the field agent"
    />
  );
}
