import React from "react";
import { useLanguage } from "../../../contexts/LanguageContext";
import { formatIndianNumber } from "../../../utils/format";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface EnterpriseStatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
  icon: React.ReactNode;
  badgeText?: string;
  badgeColor?: string;
}

export const EnterpriseStatsCard: React.FC<EnterpriseStatsCardProps> = ({
  title,
  value,
  change,
  trend = "up",
  description,
  icon,
  badgeText,
  badgeColor = "bg-[#F28C28]/10 text-[#B45309] dark:text-[#FFA44D]",
}) => {
  const { t } = useLanguage();
  return (
    <div className="tv-stat">
      <div className="tv-stat-head">
        <span className="tv-stat-label">{t(title)}</span>
        <span className="tv-stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="tv-stat-value">
          {typeof value === "number" ? formatIndianNumber(value) : value}
        </span>

        {change && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold ${
              trend === "up"
                ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50"
                : trend === "down"
                  ? "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/50"
                  : "text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-slate-800"
            }`}
          >
            {trend === "up" && <ArrowUpRight size={13} />}
            {trend === "down" && <ArrowDownRight size={13} />}
            {change}
          </span>
        )}

        {badgeText && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${badgeColor}`}
          >
            {t(badgeText)}
          </span>
        )}
      </div>

      {description && <p className="tv-stat-hint">{t(description)}</p>}
    </div>
  );
};

export default EnterpriseStatsCard;
