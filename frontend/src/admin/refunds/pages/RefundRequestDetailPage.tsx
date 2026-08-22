import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { refundService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { formatCurrency, formatDateTimeIN } from "../../../utils/format";
import { humanizeLabel } from "../../../utils/labels";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
} from "../../shared";
import {
  REFUND_STATUS_TONE,
  calcOf,
  canApproveRefunds,
  canReviewRefunds,
  refEmail,
  refName,
  type RefundRequest,
} from "../refund.types";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Undo2,
  XCircle,
} from "lucide-react";

const Row: React.FC<{ label: string; value: React.ReactNode; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <dt className="text-[11px] text-gray-500 shrink-0">{label}</dt>
    <dd
      className={`text-xs text-right tabular-nums ${
        strong
          ? "font-black text-[#0B192C] dark:text-white"
          : "font-bold text-[#0B192C] dark:text-gray-200"
      }`}
    >
      {value}
    </dd>
  </div>
);

const Card: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, icon, children, action }) => (
  <section className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm space-y-3">
    <div className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-slate-800 pb-2.5">
      <h3 className="text-sm font-black text-[#0B192C] dark:text-white flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {action}
    </div>
    {children}
  </section>
);

export const RefundRequestDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [request, setRequest] = useState<RefundRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const mayReview = canReviewRefunds(user?.role);
  const mayApprove = canApproveRefunds(user?.role);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await refundService.get(id);
      setRequest(res.data?.data ?? null);
      setError("");
    } catch (err) {
      setRequest(null);
      setError(getErrorMessage(err, "This refund could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (run: () => Promise<any>, label: string) => {
    setBusy(true);
    try {
      const res = await run();
      if (res?.data?.data) setRequest(res.data.data);
      else await load();
      addNotification(label, `${request?.refundNumber} updated.`, "success");
    } catch (err) {
      addNotification(
        "Action failed",
        getErrorMessage(err, "The refund was not updated."),
        "error",
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!request) return;
    const blob = new Blob([JSON.stringify(request, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${request.refundNumber}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-[28px] bg-gray-100 dark:bg-slate-900 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-96 rounded-[28px] bg-gray-100 dark:bg-slate-900 animate-pulse" />
          <div className="h-96 rounded-[28px] bg-gray-100 dark:bg-slate-900 animate-pulse" />
        </div>
      </div>
    );

  if (error || !request)
    return (
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] py-16 text-center space-y-3">
        <AlertTriangle size={30} className="mx-auto text-gray-300" />
        <p className="text-sm font-bold text-[#0B192C] dark:text-white">
          {error || "Refund not found"}
        </p>
        <EnterpriseButton
          variant="primary"
          size="sm"
          onClick={() => navigate("/admin/refunds")}
        >
          Back to the queue
        </EnterpriseButton>
      </div>
    );

  const calc = calcOf(request);
  const policy: any = calc?.policySnapshot ?? {};
  const components = calc?.refundableComponents ?? {};
  const breakdown = calc?.breakdown ?? {};

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title={request.refundNumber}
        subtitle={`${humanizeLabel(request.module)} · raised ${formatDateTimeIN(request.createdAt)}`}
        icon={<Undo2 size={20} />}
        badgeText={humanizeLabel(request.status)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EnterpriseButton
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate("/admin/refunds")}
            >
              Queue
            </EnterpriseButton>
            <EnterpriseButton
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={load}
            >
              Refresh
            </EnterpriseButton>
            <EnterpriseButton
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              onClick={download}
            >
              Export
            </EnterpriseButton>
          </div>
        }
      />

      {(mayReview || mayApprove) && (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 flex flex-wrap items-center gap-2.5 shadow-sm">
          <span
            className={`px-3 py-1 rounded-full border text-[11px] font-black ${REFUND_STATUS_TONE[request.status]}`}
          >
            {humanizeLabel(request.status)}
          </span>
          {busy && <Loader2 size={15} className="animate-spin text-[#0A4DA6]" />}
          <div className="flex-1" />
          {mayReview && request.status === "pending" && (
            <EnterpriseButton
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => act(() => refundService.review(request._id), "Moved to review")}
            >
              Move to review
            </EnterpriseButton>
          )}
          {mayApprove && ["pending", "under_review"].includes(request.status) && (
            <EnterpriseButton
              size="sm"
              variant="success"
              disabled={busy}
              icon={<CheckCircle2 size={14} />}
              onClick={() => act(() => refundService.approve(request._id), "Refund approved")}
            >
              Approve
            </EnterpriseButton>
          )}
          {mayApprove && ["approved", "failed"].includes(request.status) && (
            <EnterpriseButton
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => act(() => refundService.process(request._id), "Sent to the gateway")}
            >
              {request.status === "failed" ? "Retry payout" : "Process payout"}
            </EnterpriseButton>
          )}
          {mayReview &&
            ["pending", "under_review", "failed"].includes(request.status) && (
              <EnterpriseButton
                size="sm"
                variant="danger"
                disabled={busy}
                icon={<XCircle size={14} />}
                onClick={() => {
                  setRejectReason("");
                  setRejectOpen(true);
                }}
              >
                Reject
              </EnterpriseButton>
            )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Refund calculation" icon={<FileText size={15} />}>
            {!calc ? (
              <p className="text-xs text-gray-500 py-4">
                No calculation is attached to this request.
              </p>
            ) : (
              <div className="space-y-4">
                <dl className="divide-y divide-gray-50 dark:divide-slate-800">
                  <Row label="Original booking value" value={formatCurrency(calc.originalAmount ?? 0)} />
                  <Row label="Amount collected" value={formatCurrency(calc.amountPaid ?? 0)} />
                  <Row
                    label="Window applied"
                    value={
                      calc.appliedWindow?.label
                        ? `${calc.appliedWindow.label} — ${calc.refundPercent}%`
                        : `No window matched — ${calc.refundPercent ?? 0}%`
                    }
                  />
                  <Row
                    label="Requested before service"
                    value={`${Math.floor(calc.hoursBeforeService ?? 0)} hours`}
                  />
                </dl>

                <div className="rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-900 text-[10px] font-black text-gray-500">
                      <tr>
                        <th className="text-left py-2 px-3">Component</th>
                        <th className="text-right py-2 px-3">Charged</th>
                        <th className="text-right py-2 px-3">Refundable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800 tabular-nums">
                      {[
                        ["Room / base", breakdown.baseAmount, components.base],
                        ["Add-on services", breakdown.addOnsAmount, components.addOns],
                        ["Donation", breakdown.donationAmount, components.donation],
                        ["Platform fee", breakdown.platformFee, components.platformFee],
                        ["GST on platform fee", breakdown.gstAmount, components.gst],
                      ].map(([label, charged, refundable]) => (
                        <tr key={String(label)}>
                          <td className="py-2 px-3 font-semibold text-[#0B192C] dark:text-gray-200">
                            {label as string}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-500">
                            {formatCurrency(Number(charged ?? 0))}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              Number(refundable ?? 0) > 0
                                ? "text-emerald-600"
                                : "text-gray-400"
                            }`}
                          >
                            {formatCurrency(Number(refundable ?? 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <dl className="divide-y divide-gray-50 dark:divide-slate-800">
                  <Row label="Gross refundable" value={formatCurrency(calc.grossRefundable ?? 0)} />
                  <Row
                    label="Processing fee"
                    value={`− ${formatCurrency(calc.processingFee ?? 0)}`}
                  />
                  <Row
                    label="Net payable to customer"
                    value={
                      <span className="text-[#0A4DA6] dark:text-blue-400 text-sm">
                        {formatCurrency(calc.netRefundable ?? 0)}
                      </span>
                    }
                    strong
                  />
                  <Row
                    label="Retained by the platform"
                    value={formatCurrency(calc.nonRefundableAmount ?? 0)}
                  />
                </dl>

                {(calc.notes ?? []).length > 0 && (
                  <ul className="space-y-1 bg-gray-50 dark:bg-slate-900 rounded-2xl p-3">
                    {(calc.notes ?? []).map((note, i) => (
                      <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300 flex gap-2">
                        <span className="text-[#0A4DA6] shrink-0">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          <Card title="Gateway transactions" icon={<FileText size={15} />}>
            {!request.transactions?.length ? (
              <p className="text-xs text-gray-500 py-3">
                No payout has been attempted yet.
              </p>
            ) : (
              <div className="space-y-2">
                {request.transactions.map((t) => (
                  <div
                    key={t._id}
                    className="rounded-2xl border border-gray-100 dark:border-slate-800 p-3 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#0B192C] dark:text-white">
                        Attempt {t.attempt} · {humanizeLabel(t.status ?? "")}
                      </span>
                      <span className="text-xs font-black tabular-nums text-[#0A4DA6] dark:text-blue-400">
                        {formatCurrency(t.amount ?? 0)}
                      </span>
                    </div>
                    <dl className="text-[11px] text-gray-500 space-y-0.5">
                      {t.gatewayRefundId && (
                        <div className="flex justify-between gap-3">
                          <dt>Gateway refund id</dt>
                          <dd className="font-mono text-[#0B192C] dark:text-gray-200">
                            {t.gatewayRefundId}
                          </dd>
                        </div>
                      )}
                      {t.gatewayPaymentId && (
                        <div className="flex justify-between gap-3">
                          <dt>Original payment id</dt>
                          <dd className="font-mono text-[#0B192C] dark:text-gray-200">
                            {t.gatewayPaymentId}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt>Method</dt>
                        <dd>{humanizeLabel(t.method ?? t.provider ?? "")}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Attempted</dt>
                        <dd>{formatDateTimeIN(t.createdAt)}</dd>
                      </div>
                    </dl>
                    {t.failureReason && (
                      <p className="text-[11px] text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-2 py-1.5">
                        {t.failureReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Request">
            <dl className="divide-y divide-gray-50 dark:divide-slate-800">
              <Row label="Pilgrim" value={refName(request.customerId)} />
              {refEmail(request.customerId) && (
                <Row label="Email" value={refEmail(request.customerId)} />
              )}
              <Row label="Ashram" value={refName(request.ashramId)} />
              <Row label="Module" value={humanizeLabel(request.module)} />
              <Row label="Source" value={request.sourceReference || "—"} />
              <Row label="Reason" value={request.reason} />
              {request.customerNote && (
                <Row label="Customer note" value={request.customerNote} />
              )}
              {request.rejectionReason && (
                <Row
                  label="Rejection reason"
                  value={
                    <span className="text-rose-600">{request.rejectionReason}</span>
                  }
                />
              )}
            </dl>
          </Card>

          <Card title="Policy applied">
            {!policy?.name ? (
              <p className="text-xs text-gray-500 py-3">
                No policy snapshot was recorded.
              </p>
            ) : (
              <dl className="divide-y divide-gray-50 dark:divide-slate-800">
                <Row label="Policy" value={policy.name} />
                <Row
                  label="Add-ons refundable"
                  value={policy.refundAddOns === false ? "No" : "Yes"}
                />
                <Row
                  label="Donation refundable"
                  value={policy.refundDonation === true ? "Yes" : "No"}
                />
                <Row
                  label="Platform fee refundable"
                  value={policy.refundPlatformFee === true ? "Yes" : "No"}
                />
                <Row
                  label="GST refundable"
                  value={policy.refundGst === true ? "Yes" : "No"}
                />
                {policy.processingFee?.type &&
                  policy.processingFee.type !== "none" && (
                    <Row
                      label="Processing fee"
                      value={
                        policy.processingFee.type === "percent"
                          ? `${policy.processingFee.value}%${policy.processingFee.maxAmount ? ` (max ${formatCurrency(policy.processingFee.maxAmount)})` : ""}`
                          : formatCurrency(policy.processingFee.value ?? 0)
                      }
                    />
                  )}
                {(policy.cancellationWindows ?? []).length > 0 && (
                  <div className="py-2 space-y-1">
                    <dt className="text-[11px] text-gray-500">Windows</dt>
                    {(policy.cancellationWindows ?? []).map((w: any, i: number) => (
                      <dd
                        key={i}
                        className="text-[11px] font-bold text-[#0B192C] dark:text-gray-200 flex justify-between"
                      >
                        <span>{w.label || `${w.hoursBefore}h before`}</span>
                        <span className="tabular-nums">{w.refundPercent}%</span>
                      </dd>
                    ))}
                  </div>
                )}
              </dl>
            )}
          </Card>

          <Card title="Audit timeline">
            {!request.history?.length ? (
              <p className="text-xs text-gray-500 py-3">No events recorded.</p>
            ) : (
              <ol className="space-y-3">
                {request.history.map((entry) => (
                  <li key={entry._id} className="flex gap-3">
                    <span className="mt-1 w-2 h-2 rounded-full bg-[#0A4DA6] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                        {entry.fromStatus
                          ? `${humanizeLabel(entry.fromStatus)} → ${humanizeLabel(entry.toStatus)}`
                          : humanizeLabel(entry.toStatus)}
                      </p>
                      {entry.note && (
                        <p className="text-[11px] text-gray-500">{entry.note}</p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {humanizeLabel(entry.actorRole ?? "system")} ·{" "}
                        {formatDateTimeIN(entry.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <EnterpriseModal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject refund"
        subtitle={request.refundNumber}
        icon={<XCircle size={18} />}
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton
              variant="danger"
              disabled={rejectReason.trim().length < 3}
              onClick={() => {
                const reason = rejectReason.trim();
                setRejectOpen(false);
                act(() => refundService.reject(request._id, reason), "Refund rejected");
              }}
            >
              Reject refund
            </EnterpriseButton>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-[11px] font-black text-gray-500 block">
            Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Explain why this claim is refused. The customer sees this."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] resize-none"
          />
        </div>
      </EnterpriseModal>
    </div>
  );
};

export default RefundRequestDetailPage;
