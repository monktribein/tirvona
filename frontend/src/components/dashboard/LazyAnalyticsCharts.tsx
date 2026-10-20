import React, { Suspense, lazy } from "react";

// recharts is heavy; load it only when a dashboard actually renders a chart.
const load = () => import("./AnalyticsCharts");
const Area = lazy(() => load().then((m) => ({ default: m.AnalyticsAreaChart })));
const Bar = lazy(() => load().then((m) => ({ default: m.AnalyticsBarChart })));
const Donut = lazy(() =>
  load().then((m) => ({ default: m.AnalyticsDonutChart })),
);

const ChartFallback: React.FC<{ height?: number }> = ({ height = 260 }) => (
  <div
    className="w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
    style={{ height }}
    aria-hidden="true"
  />
);

export const AnalyticsAreaChart = (
  props: React.ComponentProps<typeof Area>,
) => (
  <Suspense fallback={<ChartFallback height={(props as { height?: number }).height} />}>
    <Area {...props} />
  </Suspense>
);

export const AnalyticsBarChart = (props: React.ComponentProps<typeof Bar>) => (
  <Suspense fallback={<ChartFallback height={props.height} />}>
    <Bar {...props} />
  </Suspense>
);

export const AnalyticsDonutChart = (
  props: React.ComponentProps<typeof Donut>,
) => (
  <Suspense fallback={<ChartFallback />}>
    <Donut {...props} />
  </Suspense>
);
