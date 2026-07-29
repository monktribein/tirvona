import React, { Suspense, lazy } from 'react';
import type { TirvonaMapProps } from './TirvonaMapView';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy boundary for the map.
//
// Leaflet plus its stylesheet is ~150 kB (~46 kB gzipped). Two of the pages that
// use a map — the ashram detail page and the add-ashram wizard — are imported
// eagerly by App.tsx, so importing Leaflet directly pulled the whole library
// into the main bundle and made every visitor pay for it, including the large
// majority who never open a page with a map on it.
//
// Splitting it here means the library is fetched only when a map actually
// renders. Call sites are unchanged: they still `import TirvonaMap from
// '../components/TirvonaMap'`.
// ─────────────────────────────────────────────────────────────────────────────

const TirvonaMapView = lazy(() => import('./TirvonaMapView'));

/** Matches the map's own container so the layout does not shift when it loads. */
const MapSkeleton: React.FC<{ height: string; className: string }> = ({ height, className }) => (
  <div
    aria-hidden="true"
    className={`w-full rounded-[24px] border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 animate-pulse ${className}`}
    style={{ height }}
  />
);

export const TirvonaMap: React.FC<TirvonaMapProps> = (props) => (
  <Suspense fallback={<MapSkeleton height={props.height ?? '320px'} className={props.className ?? ''} />}>
    <TirvonaMapView {...props} />
  </Suspense>
);

export type { TirvonaMapProps, MapMarker } from './TirvonaMapView';
export default TirvonaMap;
