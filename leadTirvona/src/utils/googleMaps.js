/**
 * Google Maps for the supervisor console, matching the main Tirvona admin.
 *
 * The key is a browser key: it ships in the bundle by design, so restrict it
 * in Google Cloud Console to this app's domain (HTTP referrers) and to the
 * Maps JavaScript API + Routes API.
 */
export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

export const isGoogleMapsConfigured = () => GOOGLE_MAPS_API_KEY !== '';

const CALLBACK = '__tirvonaLeadGoogleMapsReady';
let loading = null;

/** Loads the Maps API once per page; later calls share the same promise. */
export const loadGoogleMaps = () => {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const fail = (message) => {
      loading = null;
      reject(new Error(message));
    };
    window[CALLBACK] = () => {
      delete window[CALLBACK];
      window.google.maps
        .importLibrary('maps')
        .then(() => resolve())
        .catch(() => fail('Google Maps libraries failed to load'));
    };
    window.gm_authFailure = () =>
      console.error('Google Maps rejected the API key (check VITE_GOOGLE_MAPS_API_KEY and its referrer restrictions).');

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&v=weekly&loading=async&region=IN&callback=${CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      script.remove();
      fail('Google Maps script failed to load');
    };
    document.head.appendChild(script);
  });

  return loading;
};

/** Decodes a Google encoded polyline into {lat, lng} points. */
const decodePolyline = (encoded) => {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
};

const waypoint = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

/** Routes API allows at most 25 intermediate points per request. */
export const MAX_ROAD_ROUTE_POINTS = 27;

/**
 * The road route through `points` in order, via the Routes API. Used when a
 * shift has only a few points, so the line follows streets instead of cutting
 * across the map. Rejects when routing is unavailable.
 */
export const computeRoadRoute = async (points, signal) => {
  if (points.length < 2 || points.length > MAX_ROAD_ROUTE_POINTS)
    throw new Error('Road routing needs 2 to 27 points');

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline'
    },
    body: JSON.stringify({
      origin: waypoint(points[0]),
      destination: waypoint(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(waypoint),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      regionCode: 'IN'
    })
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.polyline?.encodedPolyline) throw new Error('Routes API found no road route');
  return {
    path: decodePolyline(route.polyline.encodedPolyline),
    km: Number(route.distanceMeters ?? 0) / 1000
  };
};
