import React, { Suspense, lazy, useState } from "react";
import { isGoogleMapsConfigured } from "../lib/googleMaps";

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
  /**
   * An ordered run of points drawn as a line, for a travelled route. Optional
   * and additive: callers that pass only markers behave exactly as before.
   */
  path?: { lat: number; lng: number }[];
  pathColour?: string;
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
  /**
   * Draw `path` along the roads between its points instead of straight
   * segments (Google Maps only; needs the Routes API enabled for the key).
   */
  followRoads?: boolean;
  /** The by-road length of `path` in km once routed, or null when it was not. */
  onRoadDistance?: (km: number | null) => void;
}

const GoogleMapView = lazy(() => import("./GoogleMapView"));
const LeafletMapView = lazy(() => import("./LeafletMapView"));

/**
 * The Tirvona map. Renders Google Maps when VITE_GOOGLE_MAPS_API_KEY is set,
 * and falls back to OpenStreetMap (Leaflet) when it is not or Google fails to load.
 */
export const TirvonaMapView: React.FC<TirvonaMapProps> = (props) => {
  const [useGoogle, setUseGoogle] = useState(isGoogleMapsConfigured);
  const height = props.height ?? "320px";

  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className={`w-full rounded-[24px] border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 animate-pulse ${props.className ?? ""}`}
          style={{ height }}
        />
      }
    >
      {useGoogle ? <GoogleMapView {...props} onLoadError={() => setUseGoogle(false)} /> : <LeafletMapView {...props} />}
    </Suspense>
  );
};

export default TirvonaMapView;
