import React from "react";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  CheckCircle,
  Clock,
  XCircle,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export type StatusType =
  | "active"
  | "pending"
  | "approved"
  | "rejected"
  | "confirmed"
  | "cancelled"
  | "verified"
  | "checked_in"
  | "checked_out"
  | "scheduled"
  | "draft"
  | string;

interface EnterpriseStatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export const EnterpriseStatusBadge: React.FC<EnterpriseStatusBadgeProps> = ({
  status,
  label,
  size = "md",
}) => {
  const { t } = useLanguage();
  const normStatus = String(status || "").toLowerCase();
  const displayLabel = label || normStatus.replace(/_/g, " ");

  const getStyles = () => {
    switch (normStatus) {
      case "active":
      case "approved":
      case "confirmed":
      case "verified":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
          icon: <CheckCircle size={12} className="shrink-0" />,
        };

      case "pending":
      case "draft":
      case "scheduled":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
          icon: <Clock size={12} className="shrink-0 animate-pulse" />,
        };

      case "rejected":
      case "cancelled":
      case "failed":
      case "suspended":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
          icon: <XCircle size={12} className="shrink-0" />,
        };

      case "checked_in":
        return {
          bg: "bg-blue-50 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
          icon: <ShieldCheck size={12} className="shrink-0" />,
        };

      case "checked_out":
        return {
          bg: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700",
          icon: <RefreshCw size={12} className="shrink-0" />,
        };

      default:
        return {
          bg: "bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-800",
          icon: <AlertCircle size={12} className="shrink-0" />,
        };
    }
  };

  const style = getStyles();

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[9px]"
      : size === "lg"
        ? "px-3.5 py-1 text-xs"
        : "px-2.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black tracking-wider rounded-full border shadow-2xs ${style.bg} ${sizeClasses}`}
    >
      {style.icon}
      <span className="capitalize">{t(displayLabel)}</span>
    </span>
  );
};

export default EnterpriseStatusBadge;
