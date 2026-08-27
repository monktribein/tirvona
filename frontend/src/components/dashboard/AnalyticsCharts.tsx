import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const DASHBOARD_COLORS = [
  "#0A4DA6",
  "#14B8A6",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#06B6D4",
];

const tooltipStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: 14,
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
  fontSize: 12,
};

export interface AnalyticsSeries {
  label: string;
  [key: string]: string | number;
}

interface SeriesDefinition {
  key: string;
  label: string;
  color?: string;
}

export const AnalyticsAreaChart: React.FC<{
  data: AnalyticsSeries[];
  series: SeriesDefinition[];
  valueFormatter?: (value: number) => string;
  height?: number;
}> = ({ data, series, valueFormatter = String, height = 290 }) => {
  if (!data.length) {
    return (
      <div className="h-[290px] grid place-items-center text-xs text-slate-400">
        Analytics will appear when activity is recorded.
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            {series.map((item, index) => {
              const color = item.color || DASHBOARD_COLORS[index % DASHBOARD_COLORS.length];
              return (
                <linearGradient key={item.key} id={`dashboard-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.34} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={58} tickFormatter={(value) => valueFormatter(Number(value))} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [valueFormatter(Number(value)), String(name)]} />
          {series.map((item, index) => {
            const color = item.color || DASHBOARD_COLORS[index % DASHBOARD_COLORS.length];
            return (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#dashboard-${item.key})`}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AnalyticsBarChart: React.FC<{
  data: AnalyticsSeries[];
  dataKey: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}> = ({ data, dataKey, valueFormatter = String, height = 260 }) => (
  <div style={{ height }} className="w-full min-w-0">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={45} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => valueFormatter(Number(value))} />
        <Bar dataKey={dataKey} radius={[8, 8, 2, 2]}>
          {data.map((_, index) => (
            <Cell key={index} fill={DASHBOARD_COLORS[index % DASHBOARD_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const AnalyticsDonutChart: React.FC<{
  data: { label: string; value: number }[];
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
}> = ({ data, centerLabel = "Total", centerValue, height = 260 }) => {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const safeData = data.filter((item) => item.value > 0);

  return (
    <div style={{ height }} className="relative w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={safeData.length ? safeData : [{ label: "No data", value: 1 }]} dataKey="value" nameKey="label" cx="50%" cy="48%" innerRadius="57%" outerRadius="78%" paddingAngle={safeData.length > 1 ? 3 : 0}>
            {(safeData.length ? safeData : [{ label: "No data", value: 1 }]).map((_, index) => (
              <Cell key={index} fill={safeData.length ? DASHBOARD_COLORS[index % DASHBOARD_COLORS.length] : "#e5e7eb"} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => Number(value).toLocaleString("en-IN")} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-3">
        <strong className="text-xl text-slate-900 dark:text-white tabular-nums">{centerValue ?? total.toLocaleString("en-IN")}</strong>
        <span className="text-[10px] text-slate-400">{centerLabel}</span>
      </div>
      <div className="absolute bottom-0 inset-x-0 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.slice(0, 5).map((item, index) => (
          <span key={item.label} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <i className="w-2 h-2 rounded-full" style={{ backgroundColor: DASHBOARD_COLORS[index % DASHBOARD_COLORS.length] }} />
            {item.label} ({item.value})
          </span>
        ))}
      </div>
    </div>
  );
};
