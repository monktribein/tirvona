import React, { useEffect, useRef, useState } from 'react';
import { MAX_ROAD_ROUTE_POINTS, computeRoadRoute, loadGoogleMaps } from '../utils/googleMaps';

const DEFAULT_CENTRE = { lat: 27.4924, lng: 77.6737 }; // Mathura

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A round, labelled pin: S for start, a number for each stop, E for the end. */
const pin = (map, position, colour, label, title, info) => {
  const marker = new window.google.maps.Marker({
    map,
    position,
    title,
    label: { text: label, color: '#ffffff', fontSize: '10px', fontWeight: '800' },
    icon: {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 11,
      fillColor: colour,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2
    }
  });
  marker.addListener('click', () => {
    info.setContent(`<div style="font:600 12px Inter,system-ui,sans-serif;color:#0F172A">${esc(title)}</div>`);
    info.open({ map, anchor: marker });
  });
  return marker;
};

/** Google Maps version of the supervisor's route map. Same props as the Leaflet one. */
export default function GoogleRouteMap({ route = [], stops = [], height = '360px', onLoadError }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const infoRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const g = window.google.maps;
        mapRef.current = new g.Map(containerRef.current, {
          center: DEFAULT_CENTRE,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
          // Map / Satellite, so a reported position can be checked from above.
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: g.MapTypeControlStyle.HORIZONTAL_BAR,
            position: g.ControlPosition.TOP_LEFT,
            mapTypeIds: ['roadmap', 'hybrid']
          }
        });
        infoRef.current = new g.InfoWindow();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onLoadError?.();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const info = infoRef.current;
    if (!ready || !map || !info) return undefined;
    const g = window.google.maps;

    const points = route
      .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
      .map((p) => ({ lat: p.lat, lng: p.lng }));

    const overlays = [];
    let cancelled = false;
    const controller = new AbortController();

    const drawLine = (path) =>
      overlays.push(
        new g.Polyline({ map, path, strokeColor: '#0A4DA6', strokeWeight: 5, strokeOpacity: 0.8, zIndex: 1 })
      );

    if (points.length > 1) {
      // Few points (e.g. tracking had a gap) would cut straight across the
      // map, so those follow the roads; a dense track already does.
      if (points.length <= MAX_ROAD_ROUTE_POINTS) {
        computeRoadRoute(points, controller.signal)
          .then(({ path }) => !cancelled && drawLine(path))
          .catch(() => !cancelled && drawLine(points));
      } else {
        drawLine(points);
      }
    }

    // Only the endpoints and the stops get a marker; a pin per fix would
    // bury the route under hundreds of overlapping icons.
    if (points.length) overlays.push(pin(map, points[0], '#059669', 'S', 'Start', info));
    stops.forEach((stop, index) => {
      if (!Number.isFinite(stop?.lat) || !Number.isFinite(stop?.lng)) return;
      overlays.push(
        pin(map, { lat: stop.lat, lng: stop.lng }, '#E58C28', String(index + 1), `Stopped ${Math.round(stop.minutes)} min`, info)
      );
    });
    if (points.length > 1)
      overlays.push(pin(map, points[points.length - 1], '#0A4DA6', 'E', 'Latest position', info));

    if (points.length) {
      const bounds = new g.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 30);
      const maxZoom = points.length === 1 ? 15 : 16;
      g.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom);
      });
    }

    return () => {
      cancelled = true;
      controller.abort();
      info.close();
      overlays.forEach((o) => o.setMap(null));
    };
  }, [ready, route, stops]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100"
      role="img"
      aria-label="Route travelled by the field agent"
    />
  );
}
