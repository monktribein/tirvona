"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  Upload,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { usePanditProfile, usePanditVerification } from "../../../hooks/usePanditProvider";
import { VerificationStatusCard } from "../../../components/VerificationStatusCard";
import { panditService } from "../../../services/pandit.service";
import { getErrorMessage } from "@/lib/api";
import type {
  SubmitEvidenceInput,
  DecideVerificationInput,
} from "../../../types/pandit.types";

interface EvidenceFormValues {
  documentType: string;
  documentUrl: string;
}

const DOCUMENT_TYPE_OPTIONS = [
  "Aadhar Card",
  "PAN Card",
  "Priest Certificate",
  "Temple Letter / Recommendation",
  "University Degree (Sanskrit / Vedic Studies)",
  "Training Certificate",
  "Other",
];

const inputCls =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-[#0B192C] dark:text-white px-3 py-2.5 outline-none focus:border-[#0A4DA6] focus:ring-2 focus:ring-[#0A4DA6]/10 transition placeholder:text-gray-400";

export default function VerificationPage() {
  const isReviewer = false;

  const {
    profile,
    loading: profileLoading,
  } = usePanditProfile(true);

  const {
    latestCase,
    loading: verificationLoading,
    error: verificationError,
    refresh,
  } = usePanditVerification(true);

  const [startingVerification, setStartingVerification] = useState(false);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [decidingAction, setDecidingAction] = useState<"approve" | "reject" | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EvidenceFormValues>({
    defaultValues: { documentType: "", documentUrl: "" },
  });

  const handleStartVerification = async () => {
    if (!profile) return;
    setStartingVerification(true);
    try {
      await panditService.startVerification({ providerId: profile.id });
      refresh();
    } catch (_err) {
      // API toast interceptor handles error
    } finally {
      setStartingVerification(false);
    }
  };

  const handleSubmitEvidence = async (values: EvidenceFormValues) => {
    if (!latestCase) return;
    setSubmittingEvidence(true);
    setEvidenceError(null);
    try {
      const payload: SubmitEvidenceInput = {
        documentType: values.documentType,
        documentUrl: values.documentUrl.trim(),
      };
      await panditService.submitEvidence(latestCase.id, payload);
      reset();
      refresh();
    } catch (err) {
      setEvidenceError(
        getErrorMessage(err, "Failed to submit evidence. Please try again."),
      );
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const handleDecide = async (
    caseId: string,
    decision: "APPROVE" | "REJECT",
  ) => {
    setDecidingAction(decision === "APPROVE" ? "approve" : "reject");
    try {
      const payload: DecideVerificationInput = { decision };
      await panditService.decideVerification(caseId, payload);
      refresh();
    } catch (_err) {
      // API toast interceptor
    } finally {
      setDecidingAction(null);
    }
  };

  const isLoading = profileLoading || verificationLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading verification status...
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-[18px] p-8 text-center">
        <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1">
          Failed to Load Verification
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {verificationError}
        </p>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  const canSubmitEvidence =
    latestCase &&
    ["PENDING", "REVIEW_REQUIRED"].includes(latestCase.status);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <h1 className="text-base font-semibold text-[#0B192C] dark:text-white flex items-center gap-2">
          <Shield size={16} className="text-[#0A4DA6]" />
          Provider Verification
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Verified pandits receive higher visibility and customer trust on Tirvona.
        </p>
      </div>

      {/* No profile warning */}
      {!profile && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-[18px] p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Profile Required
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Please create your provider profile before requesting verification.
            </p>
          </div>
        </div>
      )}

      {/* Verification status card */}
      <VerificationStatusCard
        verificationCase={latestCase}
        onStartVerification={
          !latestCase && profile
            ? startingVerification
              ? undefined
              : handleStartVerification
            : undefined
        }
        isReviewer={isReviewer}
        onApprove={
          isReviewer
            ? (caseId: string) => handleDecide(caseId, "APPROVE")
            : undefined
        }
        onReject={
          isReviewer
            ? (caseId: string) => handleDecide(caseId, "REJECT")
            : undefined
        }
      />

      {/* Reviewer decision in progress feedback */}
      {decidingAction && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-[14px] bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-600 dark:text-blue-400">
          <Loader2 size={13} className="animate-spin" />
          {decidingAction === "approve"
            ? "Approving verification..."
            : "Rejecting verification..."}
        </div>
      )}

      {/* Submit evidence form */}
      {canSubmitEvidence && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
          <h2 className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1 flex items-center gap-2">
            <Upload size={14} className="text-[#0A4DA6]" />
            Submit Verification Document
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Upload ID proof, temple certificate, or degree document for review.
          </p>

          {evidenceError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-[12px] bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle size={13} />
              {evidenceError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(handleSubmitEvidence)}
            className="space-y-3"
          >
            {/* Document Type */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                <FileText size={11} />
                Document Type <span className="text-rose-500">*</span>
              </label>
              <select
                {...register("documentType", {
                  required: "Please select a document type",
                })}
                className={inputCls}
              >
                <option value="">Select document type...</option>
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {errors.documentType && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {errors.documentType.message}
                </p>
              )}
            </div>

            {/* Document URL */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                <Upload size={11} />
                Document URL / Cloud Link <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                {...register("documentUrl", {
                  required: "Document URL is required",
                  pattern: {
                    value: /^https?:\/\/.+/i,
                    message: "Enter a valid URL (https://...)",
                  },
                })}
                placeholder="https://..."
                className={inputCls}
              />
              {errors.documentUrl && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {errors.documentUrl.message}
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submittingEvidence}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083b80] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {submittingEvidence ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    Submit for Review
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Verified banner */}
      {latestCase?.status === "APPROVED" && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-[18px] p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Verified Provider
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              Your profile carries the verified provider badge across the Tirvona network.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
