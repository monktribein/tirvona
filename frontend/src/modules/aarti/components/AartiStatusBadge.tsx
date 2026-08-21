import React from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Flame,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { AartiBookingStatus } from "../types/aarti.types";
import { STATUS_STYLES, statusLabel } from "../utils/aartiFormat";

const ICONS: Record<AartiBookingStatus, React.ReactNode> = {
  pending: <Clock size={12} className="shrink-0 animate-pulse" />,
  upcoming: <ShieldCheck size={12} className="shrink-0" />,
  checked_in: <Flame size={12} className="shrink-0" />,
  attended: <CheckCircle size={12} className="shrink-0" />,
  cancelled: <XCircle size={12} className="shrink-0" />,
  expired: <RefreshCw size={12} className="shrink-0" />,
  no_show: <AlertCircle size={12} className="shrink-0" />,
};

interface AartiStatusBadgeProps {
  status: AartiBookingStatus;
  size?: "sm" | "md" | "lg";
}

export const AartiStatusBadge: React.FC<AartiStatusBadgeProps> = ({
  status,
  size = "md",
}) => {
  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[9px]"
      : size === "lg"
        ? "px-3.5 py-1 text-xs"
        : "px-2.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black tracking-wider rounded-full border shadow-2xs ${
        STATUS_STYLES[status] || STATUS_STYLES.pending
      } ${sizeClasses}`}
    >
      {ICONS[status] || ICONS.pending}
      <span>{statusLabel(status)}</span>
    </span>
  );
};

export default AartiStatusBadge;
