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
  badgeColor = "bg-[#0A4DA6]/10 text-[#0A4DA6] border-[#0A4DA6]/20",
}) => {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-lg shadow-gray-200/40 dark:shadow-none hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 space-y-3">
      <div className="flex justify-between items-start">
        <div className="w-11 h-11 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-[#0A4DA6] dark:text-amber-400 shrink-0">
          {icon}
        </div>

        {badgeText && (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border ${badgeColor}`}
          >
            {t(badgeText)}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <span className="text-xs text-gray-400 font-bold tracking-wider block">
          {t(title)}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-[#0B192C] dark:text-white tracking-tight">
            {typeof value === "number" ? formatIndianNumber(value) : value}
          </span>

          {change && (
            <span
              className={`inline-flex items-center text-xs font-black px-1.5 py-0.5 rounded-md ${
                trend === "up"
                  ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
                  : trend === "down"
                    ? "text-rose-600 bg-rose-50 dark:bg-rose-950/50"
                    : "text-gray-500 bg-gray-100 dark:bg-slate-800"
              }`}
            >
              {trend === "up" && <ArrowUpRight size={14} />}
              {trend === "down" && <ArrowDownRight size={14} />}
              {change}
            </span>
          )}
        </div>
      </div>

      {description && (
        <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
          {t(description)}
        </p>
      )}
    </div>
  );
};

export default EnterpriseStatsCard;
