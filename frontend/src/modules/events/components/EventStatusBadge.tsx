import React from "react";
import {
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { RegistrationStatus } from "../types/event.types";
import { STATUS_STYLES, statusLabel } from "../utils/eventFormat";

const ICONS: Record<RegistrationStatus, React.ReactNode> = {
  confirmed: <ShieldCheck size={12} className="shrink-0" />,
  checked_in: <Sparkles size={12} className="shrink-0" />,
  attended: <CheckCircle size={12} className="shrink-0" />,
  cancelled: <XCircle size={12} className="shrink-0" />,
  no_show: <AlertCircle size={12} className="shrink-0" />,
};

export const EventStatusBadge: React.FC<{
  status: RegistrationStatus;
  size?: "sm" | "md" | "lg";
}> = ({ status, size = "md" }) => {
  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[9px]"
      : size === "lg"
        ? "px-3.5 py-1 text-xs"
        : "px-2.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black tracking-wider rounded-full border shadow-2xs ${
        STATUS_STYLES[status] || STATUS_STYLES.confirmed
      } ${sizeClasses}`}
    >
      {ICONS[status] || ICONS.confirmed}
      <span>{statusLabel(status)}</span>
    </span>
  );
};

export default EventStatusBadge;
