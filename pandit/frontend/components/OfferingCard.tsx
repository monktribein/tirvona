import React from "react";
import { Clock, Edit3, Tag, CheckCircle2, XCircle, FileText } from "lucide-react";
import { EnterpriseButton } from "./EnterpriseButton";
import type { Offering, OfferingStatus } from "../types/pandit.types";

interface Props {
  offering: Offering;
  onEdit: (offering: Offering) => void;
}

const STATUS_CONFIG: Record<
  OfferingStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  ACTIVE: {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
    icon: <CheckCircle2 size={10} />,
  },
  INACTIVE: {
    label: "Inactive",
    className:
      "bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400",
    icon: <XCircle size={10} />,
  },
  DRAFT: {
    label: "Draft",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
    icon: <FileText size={10} />,
  },
};

export const OfferingCard: React.FC<Props> = ({ offering, onEdit }) => {
  const status = STATUS_CONFIG[offering.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-4 flex flex-col gap-3 hover:border-[#0A4DA6]/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#0B192C] dark:text-white truncate">
            {offering.name}
          </h3>
          {offering.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {offering.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.className}`}
        >
          {status.icon}
          {status.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {offering.durationMinutes && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <Clock size={11} />
            {offering.durationMinutes} min
          </span>
        )}
        {offering.tags?.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0A4DA6]/8 dark:bg-[#0A4DA6]/15 text-[10px] font-medium text-[#0A4DA6] dark:text-blue-300"
          >
            <Tag size={9} />
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-2 border-t border-gray-50 dark:border-slate-800/60">
        <EnterpriseButton
          variant="outline"
          size="sm"
          icon={<Edit3 size={12} />}
          onClick={() => onEdit(offering)}
          className="w-full"
        >
          Edit Offering
        </EnterpriseButton>
      </div>
    </div>
  );
};

export default OfferingCard;

