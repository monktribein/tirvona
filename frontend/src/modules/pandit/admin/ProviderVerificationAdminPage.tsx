/**
 * Provider verification review queue (verification reviewers and Super Admin).
 * Route: /admin/verifications/providers
 *
 * Lifecycle: provider submits (status stays OPEN, `submitted` true) -> reviewer claims (IN_REVIEW) -> decision (APPROVED / REJECTED).
 */
import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { verificationCaseService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  Notice,
  PageContainer,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  cx,
  inputClass,
  type Column,
} from "../ui";

const PAGE_SIZE = 20;

// The server only accepts these codes (APPROVAL_REASON_CODES / REJECTION_REASON_CODES in the backend).
const APPROVAL_REASONS = [{ code: "VERIFIED", label: "Documents verified" }];
const REJECTION_REASONS = [
  { code: "ILLEGIBLE_EVIDENCE", label: "Document illegible or low resolution (can resubmit)" },
  { code: "INSUFFICIENT_EVIDENCE", label: "Insufficient evidence (can resubmit)" },
  { code: "NAME_MISMATCH", label: "Name mismatch with the account (can resubmit)" },
  { code: "EXPIRED_DOCUMENT", label: "Document expired (can resubmit)" },
  { code: "UNVERIFIABLE_CREDENTIAL", label: "Credential cannot be verified (can resubmit)" },
  { code: "INVALID_REFERENCE", label: "Invalid reference (can resubmit)" },
  { code: "FRAUD_SUSPECTED", label: "Fraud suspected (final)" },
  { code: "POLICY_VIOLATION", label: "Policy violation (final)" },
  { code: "DUPLICATE_ACCOUNT", label: "Duplicate account (final)" },
];

const EVIDENCE_LABEL: Record<string, string> = {
  KYC_ID: "Government ID",
  PROFESSIONAL_CERT: "Professional certificate",
  REFERENCE: "Reference letter",
  INSTITUTION_LETTER: "Institution letter",
  OTHER: "Other document",
};

const FILTERS: Array<[string, string]> = [
  ["QUEUE", "Awaiting review"],
  ["IN_REVIEW", "In review"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
];

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const typeLabel = (t?: string) => `${String(t || "IDENTITY").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} verification`;

export const ProviderVerificationAdminPage: React.FC = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("QUEUE");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Review dialog
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionType, setDecisionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reasonCode, setReasonCode] = useState(APPROVAL_REASONS[0].code);
  const [providerMessage, setProviderMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [validityDays, setValidityDays] = useState("365");
  const [validityError, setValidityError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No status asks the server for its default queue: submitted cases waiting plus those being reviewed.
      const res = await verificationCaseService.list({ status: statusFilter === "QUEUE" ? undefined : statusFilter, page, limit: PAGE_SIZE });
      if (res.data?.success) {
        setCases(res.data.data || []);
        setTotal((res.data as any).meta?.total ?? res.data.data?.length ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load the review queue."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const claim = async (c: any) => {
    setBusyId(c.id);
    try {
      await verificationCaseService.claim(c.id);
      toast.success("Case claimed. You can now review it.");
      await fetchCases();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not claim this case."));
    } finally {
      setBusyId(null);
    }
  };

  const openReview = async (c: any) => {
    setReviewing(c);
    setDetail(null);
    setDecisionType("APPROVE");
    setReasonCode(APPROVAL_REASONS[0].code);
    setProviderMessage("");
    setInternalNote("");
    setValidityDays("365");
    setValidityError(undefined);
    setDetailLoading(true);
    try {
      const res = await verificationCaseService.getById(c.id);
      if (res.data?.success) setDetail(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load the case."));
      setReviewing(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const chooseDecision = (type: "APPROVE" | "REJECT") => {
    setDecisionType(type);
    setReasonCode(type === "APPROVE" ? APPROVAL_REASONS[0].code : REJECTION_REASONS[0].code);
    setValidityError(undefined);
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing) return;
    const days = Number(validityDays);
    if (decisionType === "APPROVE" && (!Number.isInteger(days) || days < 30 || days > 730)) {
      setValidityError("Enter whole days between 30 and 730.");
      return;
    }
    setSubmitting(true);
    try {
      await verificationCaseService.decide(reviewing.id, {
        decision: decisionType,
        reasonCode,
        providerMessage: providerMessage.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        validityDays: decisionType === "APPROVE" ? days : undefined,
      });
      toast.success(decisionType === "APPROVE" ? "Provider verified." : "Request rejected.");
      setReviewing(null);
      fetchCases();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not record the decision."));
    } finally {
      setSubmitting(false);
    }
  };

  const stageOf = (c: any) => (c.status === "OPEN" ? { status: "OPEN", label: c.submitted ? "Awaiting review" : "Draft" } : { status: c.status, label: undefined });

  const columns: Column<any>[] = [
    {
      key: "case",
      header: "Case",
      primary: true,
      cell: (c) => (
        <span>
          <span className="block font-bold">{c.providerName || `Provider ${String(c.providerId).slice(-6)}`}</span>
          <span className="block text-xs font-normal text-gray-500">
            {typeLabel(c.verificationType)}
            {c.attempt > 1 ? ` · attempt ${c.attempt}` : ""}
          </span>
        </span>
      ),
    },
    { key: "submitted", header: "Submitted", cell: (c) => date(c.submittedAt) },
    { key: "docs", header: "Documents", cell: (c) => c.evidenceCount ?? 0 },
    { key: "status", header: "Status", cell: (c) => <StatusBadge status={stageOf(c).status} label={stageOf(c).label} /> },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reasons = decisionType === "APPROVE" ? APPROVAL_REASONS : REJECTION_REASONS;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Trust and verification"
        icon={<ShieldCheck size={14} />}
        title="Provider verification"
        description="Review identity documents. You cannot review your own provider account."
        actions={
          <Button variant="outline" onClick={fetchCases} aria-label="Refresh the queue">
            <RefreshCw size={16} className={cx(loading && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div role="tablist" aria-label="Case status" className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-slate-800">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={statusFilter === key}
            onClick={() => {
              setStatusFilter(key);
              setPage(1);
            }}
            className={cx(
              "min-h-[44px] rounded-full px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
              statusFilter === key ? "bg-[#0B192C] text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorNotice message={error} onRetry={fetchCases} />}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : cases.length === 0 ? (
          <EmptyState icon={<FileCheck size={26} />} title="Nothing to review" description="Cases appear here after a provider submits their documents." />
        ) : (
          <DataTable
            caption="Verification cases"
            columns={columns}
            rows={cases}
            rowKey={(c) => c.id}
            actions={(c) => (
              <>
                {c.status === "OPEN" && c.submitted && (
                  <Button className="!min-h-[40px] !px-3" loading={busyId === c.id} onClick={() => claim(c)}>
                    Claim
                  </Button>
                )}
                <Button variant={c.status === "IN_REVIEW" ? "primary" : "outline"} className="!min-h-[40px] !px-3" onClick={() => openReview(c)}>
                  {c.status === "IN_REVIEW" ? "Review" : "View"}
                </Button>
              </>
            )}
          />
        )}
      </Card>
      {!loading && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing ? `${reviewing.providerName || "Provider"} · ${typeLabel(reviewing.verificationType)}` : "Case"}
        description={reviewing ? `Submitted ${date(reviewing.submittedAt)}` : undefined}
        size="lg"
        footer={
          reviewing?.status === "IN_REVIEW" ? (
            <>
              <Button variant="outline" onClick={() => setReviewing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="decision-form" variant={decisionType === "APPROVE" ? "primary" : "danger"} loading={submitting}>
                {decisionType === "APPROVE" ? "Approve and verify" : "Reject request"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Close
            </Button>
          )
        }
      >
        {detailLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <Notice tone="warning">KYC documents are confidential. Open them only to review this case. Access is logged.</Notice>

            <section aria-labelledby="evidence-h">
              <h3 id="evidence-h" className="mb-2 text-sm font-extrabold text-[#0B192C] dark:text-white">
                Documents ({detail.evidence?.length ?? 0})
              </h3>
              {detail.requiredEvidence?.length > 0 && <p className="mb-2 text-xs text-gray-500">Required: {detail.requiredEvidence.map((t: string) => EVIDENCE_LABEL[t] || t).join(" or ")}</p>}
              {detail.evidence?.length ? (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
                  {detail.evidence.map((ev: any) => (
                    <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#0B192C] dark:text-white">{ev.label || EVIDENCE_LABEL[ev.evidenceType] || ev.evidenceType}</span>
                        <span className="text-xs text-gray-500">
                          {EVIDENCE_LABEL[ev.evidenceType] || ev.evidenceType}
                          {ev.mimeType ? ` · ${ev.mimeType}` : ""}
                          {ev.sizeBytes ? ` · ${(ev.sizeBytes / 1024).toFixed(0)} KB` : ""}
                          {ev.malwareScanStatus ? ` · scan ${String(ev.malwareScanStatus).toLowerCase()}` : ""}
                        </span>
                      </span>
                      {typeof ev.objectStorageKey === "string" && /^https:\/\//.test(ev.objectStorageKey) && (
                        <a
                          href={ev.objectStorageKey}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-gray-300 px-4 text-sm font-bold text-[#B45309] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:border-slate-600 dark:text-[#FFA44D] dark:hover:bg-slate-800"
                        >
                          Open
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No documents were attached.</p>
              )}
            </section>

            {reviewing?.status === "IN_REVIEW" ? (
              <form id="decision-form" onSubmit={submitDecision} className="space-y-4" noValidate>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">Decision</legend>
                  <div className="flex gap-2">
                    {(["APPROVE", "REJECT"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={decisionType === type}
                        onClick={() => chooseDecision(type)}
                        className={cx(
                          "min-h-[44px] flex-1 rounded-xl border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                          decisionType === type
                            ? type === "APPROVE"
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-rose-700 bg-rose-700 text-white"
                            : "border-gray-300 bg-white text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-300",
                        )}
                      >
                        {type === "APPROVE" ? "Approve" : "Reject"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <Field label="Reason" required>
                  <select className={inputClass} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                    {reasons.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {decisionType === "APPROVE" && (
                  <Field label="Valid for (days)" required error={validityError} hint="Between 30 and 730. The provider must be re-verified after this.">
                    <input type="number" inputMode="numeric" min={30} max={730} className={inputClass} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
                  </Field>
                )}
                <Field label="Message to the provider" hint="Shown to the provider. Up to 500 characters.">
                  <textarea rows={2} maxLength={500} className={inputClass} value={providerMessage} onChange={(e) => setProviderMessage(e.target.value)} />
                </Field>
                <Field label="Internal note" hint="Visible to reviewers only.">
                  <textarea rows={2} maxLength={2000} className={inputClass} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
                </Field>
              </form>
            ) : (
              <Notice tone="info">
                {reviewing?.status === "OPEN" ? "Claim this case from the list before you can decide on it." : `This case is ${String(reviewing?.status || "").replace(/_/g, " ").toLowerCase()}.`}
              </Notice>
            )}
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
};

export default ProviderVerificationAdminPage;
