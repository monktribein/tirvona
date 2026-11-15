import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { paymentIssuesService } from "../../../services";
import { getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotifications } from "../../../contexts/NotificationContext";
import { formatCurrency, formatDateTimeIN } from "../../../utils/format";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
  EnterpriseStatsCard,
} from "../../shared";
import {
  AlertTriangle,
  BadgeIndianRupee,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Undo2,
  Wallet,
} from "lucide-react";

type RefundState = "refunded_to_wallet" | "gateway_refund_owed" | "gateway_refunded";

interface UnappliedPayment {
  id: string;
  module: "stay" | "aarti" | "parking";
  bookingId: string | null;
  bookingReference: string | null;
  amount: number;
  reason: string;
  refundState: RefundState;
  customer: "website" | "whatsapp";
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  updatedAt: string | null;
}

interface WebhookIssue {
  id: string;
  eventId: string;
  eventType: string;
  orderId: string | null;
  paymentId: string | null;
  status: string;
  kind: "processing_failed" | "unmatched";
  matchedModule: string | null;
  processingError: string | null;
  receivedAt: string | null;
}

interface IssuesSummary {
  refundOwedCount: number;
  refundOwedAmount: number;
  refundedToWalletCount: number;
  webhookFailureCount: number;
  unmatchedPaymentCount: number;
}

const MODULE_LABEL: Record<UnappliedPayment["module"], string> = {
  stay: "Stay",
  aarti: "Aarti",
  parking: "Parking",
};

const STATE_LABEL: Record<RefundState, string> = {
  refunded_to_wallet: "Refunded to wallet",
  gateway_refund_owed: "Refund owed",
  gateway_refunded: "Refunded to card / UPI",
};

const STATE_TONE: Record<RefundState, string> = {
  refunded_to_wallet:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  gateway_refund_owed:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
  gateway_refunded:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
};

const card =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-4 sm:p-5 shadow-sm";

const canMarkRefunded = (role?: string) =>
  role === "super_admin" || role === "finance_manager";

/**
 * Money that reached Tirvona but did not become a booking: payments that
 * arrived after a hold ran out (or for a cancelled / already-paid booking)
 * and were refunded, and Razorpay deliveries that failed or that no booking
 * claimed.
 */
export const PaymentIssuesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [unapplied, setUnapplied] = useState<UnappliedPayment[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookIssue[]>([]);
  const [summary, setSummary] = useState<IssuesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<UnappliedPayment | null>(null);
  const [refundId, setRefundId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await paymentIssuesService.list();
      const data = res.data?.data ?? {};
      setUnapplied(data.unapplied ?? []);
      setWebhooks(data.webhooks ?? []);
      setSummary(data.summary ?? null);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Payment issues could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const submitMarkRefunded = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await paymentIssuesService.markParkingRefunded(target.id, refundId.trim() || undefined);
      addNotification(
        "Refund recorded",
        `${target.bookingReference ?? "Parking payment"} is marked as refunded.`,
        "success",
      );
      setTarget(null);
      setRefundId("");
      await load(false);
    } catch (err) {
      addNotification(
        "Could not record refund",
        getErrorMessage(err, "The payment was not updated."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const stat = (value: number | string) => (loading ? "..." : value);

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title="Payment issues"
        subtitle="Money that came in but did not become a booking"
        icon={<AlertTriangle size={20} />}
        badgeText={
          summary && summary.refundOwedCount
            ? `${summary.refundOwedCount} refund${summary.refundOwedCount === 1 ? "" : "s"} owed`
            : undefined
        }
        actions={
          <EnterpriseButton
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
            onClick={() => load(false)}
          >
            Refresh
          </EnterpriseButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <EnterpriseStatsCard
          title="Refunds owed"
          value={stat(summary?.refundOwedCount ?? 0)}
          description={`${formatCurrency(summary?.refundOwedAmount ?? 0)} still to send back`}
          icon={<BadgeIndianRupee size={18} />}
        />
        <EnterpriseStatsCard
          title="Refunded to wallet"
          value={stat(summary?.refundedToWalletCount ?? 0)}
          description="Handled automatically"
          icon={<Wallet size={18} />}
        />
        <EnterpriseStatsCard
          title="Failed deliveries"
          value={stat(summary?.webhookFailureCount ?? 0)}
          description="Razorpay events that hit an error"
          icon={<AlertTriangle size={18} />}
        />
        <EnterpriseStatsCard
          title="Unclaimed payments"
          value={stat(summary?.unmatchedPaymentCount ?? 0)}
          description="Captured, but no booking owns the order"
          icon={<Clock size={18} />}
        />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-rose-900 dark:text-rose-300">
                Could not load payment issues
              </p>
              <p className="text-rose-800/80 dark:text-rose-400/80">{error}</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 cursor-pointer transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-black text-[#0B192C] dark:text-white">
            Payments that could not be used
          </h2>
          <p className="text-[11px] text-gray-500">
            Paid after the hold ran out, for a cancelled booking, or twice for the same
            booking. Website customers are refunded to their Tirvona wallet automatically;
            WhatsApp guests need a refund on the Razorpay dashboard.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse" />
            ))}
          </div>
        ) : unapplied.length === 0 ? (
          <div className={`${card} py-12 text-center space-y-2`}>
            <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">
              Nothing to sort out
            </p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Every payment so far became a booking.
            </p>
          </div>
        ) : (
          <div className={`space-y-3 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
            {unapplied.map((row) => (
              <div key={row.id} className={card}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#0B192C] dark:text-white">
                        {row.bookingReference ?? row.bookingId ?? "—"}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${STATE_TONE[row.refundState]}`}
                      >
                        {STATE_LABEL[row.refundState]}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {MODULE_LABEL[row.module]} ·{" "}
                        {row.customer === "whatsapp" ? "WhatsApp guest" : "Website customer"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{row.reason}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 break-all">
                      Razorpay payment {row.razorpayPaymentId ?? "—"} · order{" "}
                      {row.razorpayOrderId ?? "—"}
                      {row.updatedAt ? ` · ${formatDateTimeIN(row.updatedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
                    <span className="text-sm font-black text-[#F28C28] dark:text-amber-400 tabular-nums">
                      {formatCurrency(row.amount)}
                    </span>
                    {row.refundState === "gateway_refund_owed" &&
                      (row.module === "stay" ? (
                        <EnterpriseButton
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/admin/manage/bookings/refunds")}
                        >
                          Open stay refund queue
                        </EnterpriseButton>
                      ) : (
                        canMarkRefunded(user?.role) && (
                          <EnterpriseButton
                            size="sm"
                            variant="success"
                            icon={<Undo2 size={14} />}
                            onClick={() => {
                              setRefundId("");
                              setTarget(row);
                            }}
                          >
                            Mark refunded
                          </EnterpriseButton>
                        )
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-black text-[#0B192C] dark:text-white">
            Razorpay deliveries to check
          </h2>
          <p className="text-[11px] text-gray-500">
            A failed delivery is retried by Razorpay for up to a day. An unclaimed payment was
            captured for an order no booking owns: look it up on the Razorpay dashboard.
          </p>
        </div>

        {loading ? (
          <div className="h-20 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse" />
        ) : webhooks.length === 0 ? (
          <div className={`${card} py-10 text-center space-y-2`}>
            <Inbox size={26} className="mx-auto text-gray-300" />
            <p className="text-xs font-bold text-[#0B192C] dark:text-white">
              No failed or unclaimed deliveries
            </p>
          </div>
        ) : (
          <div className={`space-y-3 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
            {webhooks.map((row) => (
              <div key={row.id} className={card}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                      row.kind === "processing_failed"
                        ? STATE_TONE.gateway_refund_owed
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                    }`}
                  >
                    {row.kind === "processing_failed" ? "Failed" : "Unclaimed"}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">{row.eventType}</span>
                  {row.receivedAt && (
                    <span className="text-[10px] text-gray-400">
                      {formatDateTimeIN(row.receivedAt)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1 break-all">
                  Payment {row.paymentId ?? "—"} · order {row.orderId ?? "—"}
                </p>
                {row.processingError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    {row.processingError}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <EnterpriseModal
        isOpen={Boolean(target)}
        onClose={() => (saving ? undefined : setTarget(null))}
        title="Mark refunded"
        subtitle={target ? `${target.bookingReference ?? "Parking"} · ${formatCurrency(target.amount)}` : undefined}
        icon={<Undo2 size={18} />}
        footer={
          <div className="flex justify-end gap-2">
            <EnterpriseButton variant="ghost" disabled={saving} onClick={() => setTarget(null)}>
              Cancel
            </EnterpriseButton>
            <EnterpriseButton variant="success" disabled={saving} onClick={submitMarkRefunded}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Mark refunded
            </EnterpriseButton>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            First refund payment{" "}
            <span className="font-mono font-bold">{target?.razorpayPaymentId ?? "—"}</span> on the
            Razorpay dashboard, then record it here.
          </p>
          <label className="text-[11px] font-black text-gray-500 block">
            Razorpay refund id (optional)
          </label>
          <input
            value={refundId}
            onChange={(e) => setRefundId(e.target.value.slice(0, 100))}
            placeholder="rfnd_…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28]"
          />
        </div>
      </EnterpriseModal>
    </div>
  );
};

export default PaymentIssuesPage;
