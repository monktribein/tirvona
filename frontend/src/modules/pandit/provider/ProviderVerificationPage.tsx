/**
 * Provider Verification Page.
 * Route: /provider/verification
 *
 * Backend:
 *   GET  /api/v2/verification-cases                 list own cases
 *   GET  /api/v2/verification-cases/:id             one case with its evidence
 *   POST /api/v2/verification-cases                 open a case
 *   POST /api/v2/verification-cases/:id/evidence    add evidence metadata
 *   POST /api/v2/verification-cases/:id:submit      submit for review
 *
 * Evidence workflow: upload the file (/uploads), register its metadata on the case, then submit the case.
 */

import React, { useCallback, useEffect, useState } from "react";
import { FileText, Plus, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { verificationCaseService } from "../services/provider.service";
import type { VerificationCase } from "../types/provider.types";
import { toast } from "../../../lib/toast";
import api, { getErrorMessage } from "../../../lib/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  Notice,
  PageContainer,
  PageHeader,
  StatusBadge,
  cx,
  inputClass,
} from "../ui";

const EVIDENCE_TYPES: Array<[string, string]> = [
  ["KYC_ID", "Government ID (Aadhaar, passport, voter ID, licence)"],
  ["PROFESSIONAL_CERT", "Professional or Vedic training certificate"],
  ["REFERENCE", "Reference letter"],
  ["INSTITUTION_LETTER", "Institution or temple letter"],
  ["OTHER", "Other supporting document"],
];
const EVIDENCE_LABEL = Object.fromEntries(EVIDENCE_TYPES.map(([k, v]) => [k, v.split(" (")[0]]));

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

const REJECTION_TEXT: Record<string, string> = {
  ILLEGIBLE_EVIDENCE: "The document could not be read clearly.",
  INSUFFICIENT_EVIDENCE: "More evidence is needed.",
  NAME_MISMATCH: "The name on the document does not match your profile.",
  EXPIRED_DOCUMENT: "The document has expired.",
  UNVERIFIABLE_CREDENTIAL: "The credential could not be verified.",
  INVALID_REFERENCE: "The reference could not be accepted.",
  FRAUD_SUSPECTED: "The review found a serious problem with this submission.",
  POLICY_VIOLATION: "The submission broke Tirvona's policy.",
  DUPLICATE_ACCOUNT: "A duplicate account was found.",
};

const sha256Hex = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null);

// ─── Evidence uploader ────────────────────────────────────────────────────────

const EvidenceUploader: React.FC<{ caseId: string; onUploaded: () => void }> = ({ caseId, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [evidenceType, setEvidenceType] = useState("KYC_ID");
  const [fileError, setFileError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    if (!ACCEPTED.includes(file.type)) return setFileError("Use a PDF, JPEG, PNG, WebP or HEIC file.");
    if (file.size > MAX_BYTES) return setFileError("That file is larger than 10 MB.");

    setUploading(true);
    try {
      const sha256 = await sha256Hex(file);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "verification");
      const uploadRes = await api.post<any>("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" }, skipToast: true } as any);
      const d = uploadRes.data?.data;
      const storageKey = d?.url || d?.publicId || d?.storageKey || d?.key;
      if (!storageKey) throw new Error("The upload did not return a file reference.");

      await verificationCaseService.addEvidence(caseId, {
        evidenceType,
        storageKey,
        sha256,
        mimeType: file.type || undefined,
        sizeBytes: file.size || undefined,
        label: file.name.slice(0, 100),
      });
      toast.success("Document added.");
      onUploaded();
    } catch (err) {
      setFileError(getErrorMessage(err, "The document could not be uploaded."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[#FFE4C4] bg-[#FFF4E5]/60 p-4 dark:border-[#F28C28]/40 dark:bg-[#F28C28]/10">
      <h3 className="text-sm font-bold text-[#0B192C] dark:text-white">Add a document</h3>
      <Field label="Document type" required>
        <select className={inputClass} value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
          {EVIDENCE_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <label
          className={cx(
            "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[#0B192C] bg-white px-5 text-sm font-bold text-[#0B192C] focus-within:ring-2 focus-within:ring-[#F28C28] hover:bg-gray-50 dark:bg-transparent dark:text-white",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          <Upload size={16} aria-hidden="true" />
          {uploading ? "Uploading…" : "Choose file"}
          <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" />
        </label>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">PDF, JPEG, PNG, WebP or HEIC, up to 10 MB. Only Tirvona's verification reviewers can open your documents.</p>
        {fileError && (
          <p role="alert" className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {fileError}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Case card ────────────────────────────────────────────────────────────────

type CaseView = VerificationCase & { evidenceCount?: number; requiredEvidence?: string[]; decisionReasonCode?: string; validUntil?: string; attempt?: number; submitted?: boolean };

const CaseCard: React.FC<{ c: CaseView; onRefresh: () => void }> = ({ c, onRefresh }) => {
  const [submitting, setSubmitting] = useState(false);
  const submitted = Boolean(c.submitted || c.submittedAt);
  const isDraft = c.status === "OPEN" && !submitted;
  const evidenceCount = c.evidenceCount ?? c.evidence?.length ?? 0;
  const stage = isDraft ? { status: "DRAFT", label: "Draft" } : c.status === "OPEN" ? { status: "OPEN", label: "Awaiting review" } : { status: c.status, label: undefined };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await verificationCaseService.submit(c.id);
      toast.success("Submitted for review.");
      onRefresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not submit for review."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card as="article" className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">{(c.verificationType || "IDENTITY").replace(/_/g, " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase())} verification</h2>
          <p className="text-xs text-gray-500">
            {submitted ? `Submitted ${date(c.submittedAt) ?? ""}` : "Not submitted yet"}
            {c.attempt && c.attempt > 1 ? ` · attempt ${c.attempt}` : ""}
          </p>
        </div>
        <StatusBadge status={stage.status} label={stage.label} />
      </div>

      {c.status === "APPROVED" && <Notice tone="success">Approved{c.validUntil ? `. Valid until ${date(c.validUntil)}.` : "."}</Notice>}
      {c.status === "REJECTED" && (
        <Notice tone="warning">
          <p className="font-bold">This request was not approved.</p>
          <p>{(c.decisionReasonCode && REJECTION_TEXT[c.decisionReasonCode]) || "Please review the message below."}</p>
          {c.providerMessage && <p className="mt-1">Reviewer's note: {c.providerMessage}</p>}
        </Notice>
      )}
      {c.status === "EXPIRED" && <Notice tone="warning">This verification has expired. Start a new request to stay listed.</Notice>}
      {c.status === "IN_REVIEW" && <Notice tone="info">A reviewer is looking at your documents now.</Notice>}

      {c.evidence && c.evidence.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
          {c.evidence.map((ev) => (
            <li key={ev.id} className="flex items-center gap-3 p-3 text-sm">
              <FileText size={16} className="shrink-0 text-[#B45309]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[#0B192C] dark:text-white">{ev.label || EVIDENCE_LABEL[ev.evidenceType] || ev.evidenceType}</span>
                <span className="text-xs text-gray-500">
                  {EVIDENCE_LABEL[ev.evidenceType] || ev.evidenceType}
                  {ev.uploadedAt ? ` · added ${date(ev.uploadedAt)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {evidenceCount > 0 && !c.evidence?.length && <p className="text-sm text-gray-600 dark:text-gray-400">{evidenceCount} document{evidenceCount === 1 ? "" : "s"} uploaded.</p>}

      {isDraft && (
        <div className="space-y-3">
          {c.requiredEvidence && c.requiredEvidence.length > 0 && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Required: <strong>{c.requiredEvidence.map((t) => EVIDENCE_LABEL[t] || t).join(" or ")}</strong>
            </p>
          )}
          <EvidenceUploader caseId={c.id} onUploaded={onRefresh} />
          <Button className="w-full" onClick={handleSubmit} loading={submitting} disabled={evidenceCount === 0}>
            Submit for review
          </Button>
          {evidenceCount === 0 && <p className="text-center text-xs font-semibold text-amber-800 dark:text-amber-300">Add at least one document before submitting.</p>}
        </div>
      )}
    </Card>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ProviderVerificationPage: React.FC = () => {
  const [cases, setCases] = useState<CaseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await verificationCaseService.list();
      if (res.data?.success) {
        const rows: CaseView[] = res.data.data || [];
        // The list only counts documents; open cases are fetched for their document list.
        const detailed = await Promise.all(
          rows.map(async (row) => {
            if (!(row.evidenceCount ?? 0)) return row;
            try {
              const d = await verificationCaseService.getById(row.id);
              return d.data?.success ? ({ ...row, ...(d.data.data as CaseView) } as CaseView) : row;
            } catch {
              return row;
            }
          }),
        );
        setCases(detailed);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) setCases([]);
      else setError(getErrorMessage(err, "Failed to load your verification requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenCase = async () => {
    setOpening(true);
    try {
      await verificationCaseService.open({ verificationType: "IDENTITY" });
      toast.success("Verification started. Upload your ID to continue.");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not start verification."));
    } finally {
      setOpening(false);
    }
  };

  const latest = [...cases].sort((a, b) => new Date(b.createdAt || b.submittedAt || 0).getTime() - new Date(a.createdAt || a.submittedAt || 0).getTime())[0];
  const canOpenNew = !latest || ["REJECTED", "EXPIRED"].includes(latest.status);

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        eyebrow="Provider workspace"
        title="Verification"
        description="Verified providers appear in the public directory and can receive bookings."
        actions={
          canOpenNew && cases.length > 0 ? (
            <Button onClick={handleOpenCase} loading={opening}>
              <Plus size={16} aria-hidden="true" />
              Start a new request
            </Button>
          ) : undefined
        }
      />

      <Notice tone="info">
        <p className="font-bold">How it works</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>Start a request and upload a government ID.</li>
          <li>Submit it for review.</li>
          <li>A Tirvona reviewer checks it and you are notified of the result.</li>
        </ol>
      </Notice>

      {loading ? (
        <LoadingBlock label="Loading your requests" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : cases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldAlert size={26} />}
            title="You are not verified yet"
            description="Start a verification request to upload your ID and get listed."
            action={
              <Button onClick={handleOpenCase} loading={opening}>
                <ShieldCheck size={16} aria-hidden="true" />
                Start verification
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {cases.map((c) => (
            <li key={c.id}>
              <CaseCard c={c} onRefresh={load} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
};

export default ProviderVerificationPage;
