import React from "react";
import {
  ShieldCheck,
  ShieldX,
  Clock,
  AlertCircle,
  Shield,
  CheckCircle2,
} from "lucide-react";
import type {
  VerificationCase,
  VerificationCaseStatus,
} from "../types/pandit.types";
import { VERIFICATION_STATUS_LABELS } from "../types/pandit.types";

interface Props {
  verificationCase: VerificationCase | null;
  onStartVerification?: () => void;
  /** Whether the current user is a reviewer who can take action */
  isReviewer?: boolean;
  onApprove?: (caseId: string) => void;
  onReject?: (caseId: string) => void;
}

const STATUS_UI: Record<
  VerificationCaseStatus,
  {
    icon: React.ReactNode;
    bg: string;
    badge: string;
    title: string;
    description: string;
  }
> = {
  PENDING: {
    icon: <Clock size={20} className="text-amber-500" />,
    bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    title: "Verification Pending",
    description:
      "Your verification request has been submitted and is awaiting review.",
  },
  UNDER_REVIEW: {
    icon: <AlertCircle size={20} className="text-blue-500" />,
    bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    title: "Under Review",
    description:
      "Our team is reviewing your submitted documents. This usually takes 2-3 business days.",
  },
  APPROVED: {
    icon: <ShieldCheck size={20} className="text-emerald-500" />,
    bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    title: "Verification Approved",
    description:
      "Your profile has been verified. The verification badge is now visible on your public profile.",
  },
  REJECTED: {
    icon: <ShieldX size={20} className="text-rose-500" />,
    bg: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    title: "Verification Rejected",
    description:
      "Your verification was not approved. Review the note below and submit again.",
  },
  REVIEW_REQUIRED: {
    icon: <AlertCircle size={20} className="text-orange-500" />,
    bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40",
    badge:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    title: "Additional Review Required",
    description:
      "Your reviewer has requested additional information. Please submit the required documents.",
  },
};

export const VerificationStatusCard: React.FC<Props> = ({
  verificationCase,
  onStartVerification,
  isReviewer = false,
  onApprove,
  onReject,
}) => {
  // No verification case yet
  if (!verificationCase) {
    return (
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <Shield size={20} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#0B192C] dark:text-white">
            Not Verified
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Verify your credentials to gain a Tirvona Verified badge and build
            trust with customers.
          </p>
        </div>
        {onStartVerification && (
          <button
            type="button"
            onClick={onStartVerification}
            className="shrink-0 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
          >
            Start Verification
          </button>
        )}
      </div>
    );
  }

  const ui =
    STATUS_UI[verificationCase.status] ?? STATUS_UI.PENDING;

  return (
    <div
      className={`border rounded-[18px] p-5 ${ui.bg}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{ui.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[#0B192C] dark:text-white">
              {ui.title}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ui.badge}`}
            >
              {VERIFICATION_STATUS_LABELS[verificationCase.status]}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {ui.description}
          </p>

          {verificationCase.reviewNote && (
            <div className="mt-3 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-white/40 dark:border-slate-700/40">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                Reviewer Note
              </p>
              <p className="text-xs text-[#0B192C] dark:text-white">
                {verificationCase.reviewNote}
              </p>
            </div>
          )}

          {verificationCase.submittedAt && (
            <p className="text-[11px] text-gray-400 mt-2">
              Submitted:{" "}
              {new Date(verificationCase.submittedAt).toLocaleDateString(
                "en-IN",
                { day: "2-digit", month: "short", year: "numeric" },
              )}
            </p>
          )}

          {/* Reviewer actions — only shown to verification_reviewer role */}
          {isReviewer &&
            (verificationCase.status === "PENDING" ||
              verificationCase.status === "UNDER_REVIEW") && (
              <div className="flex flex-wrap gap-2 mt-4">
                {onApprove && (
                  <button
                    type="button"
                    onClick={() => onApprove(verificationCase.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    Approve
                  </button>
                )}
                {onReject && (
                  <button
                    type="button"
                    onClick={() => onReject(verificationCase.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition cursor-pointer"
                  >
                    <ShieldX size={13} />
                    Reject
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default VerificationStatusCard;

