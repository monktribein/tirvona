import React, { Suspense, lazy } from "react";
import type { TirvonaMapProps } from "./TirvonaMapView";

const TirvonaMapView = lazy(() => import("./TirvonaMapView"));

const MapSkeleton: React.FC<{ height: string; className: string }> = ({
  height,
  className,
}) => (
  <div
    aria-hidden="true"
    className={`w-full rounded-[24px] border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-900 animate-pulse ${className}`}
    style={{ height }}
  />
);

export const TirvonaMap: React.FC<TirvonaMapProps> = (props) => (
  <Suspense
    fallback={
      <MapSkeleton
        height={props.height ?? "320px"}
        className={props.className ?? ""}
      />
    }
  >
    <TirvonaMapView {...props} />
  </Suspense>
);

export type { TirvonaMapProps, MapMarker } from "./TirvonaMapView";
export default TirvonaMap;
