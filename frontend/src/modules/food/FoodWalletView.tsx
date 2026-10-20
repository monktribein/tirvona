/**
 * A kitchen's wallet: what Tirvona owes it for delivered orders, what Tirvona has paid, and what is left.
 *
 * Customers pay Tirvona (Razorpay), never the kitchen. Tirvona pays the kitchen by hand (bank transfer, UPI
 * or cash) and records each payment with its receipt image. The kitchen sees the same view as Super Admin,
 * minus the buttons that record or void a payment.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, Banknote, FileText, Landmark, Plus, Smartphone, Utensils, Wallet } from "lucide-react";
import { getErrorMessage } from "../../lib/api";
import { toast } from "../../lib/toast";
import { foodWalletService } from "../../services/foodWallet.service";
import type {
  FoodPaymentMethod,
  FoodWallet,
  FoodWalletEarning,
  FoodWalletEarningsPage,
  FoodWalletPayment,
} from "../../services/foodWallet.service";
import type { FoodScope } from "../../services/foodPartner.service";
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  Notice,
  Pagination,
  SectionCard,
  StatTile,
  StatusBadge,
  cx,
  formatMinor,
  inputClass,
} from "../pandit/ui";
import type { Column } from "../pandit/ui";
import { RecordPaymentModal } from "./RecordPaymentModal";

const PAGE_SIZE = 10;
const inr = (minor?: number | null) => formatMinor(minor ?? 0) ?? "₹0";
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "";
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) : "");

const METHOD_LABEL: Record<FoodPaymentMethod, string> = { bank_transfer: "Bank transfer", upi: "UPI", cash: "Cash" };
const METHOD_ICON: Record<FoodPaymentMethod, React.ReactNode> = {
  bank_transfer: <Landmark size={16} />,
  upi: <Smartphone size={16} />,
  cash: <Banknote size={16} />,
};

/** The receipt as a small picture that opens full size; a plain link if the picture cannot load. */
const ReceiptThumb: React.FC<{ url: string }> = ({ url }) => {
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]"
    >
      {failed ? (
        <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-[#B45309] dark:border-slate-700">
          <FileText size={14} aria-hidden="true" /> View receipt
        </span>
      ) : (
        <>
          <img
            src={url}
            alt="Payment receipt"
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-14 w-14 rounded-lg border border-gray-200 object-cover dark:border-slate-700"
          />
          <span className="text-xs font-bold text-[#B45309] dark:text-[#FFA44D]">View receipt</span>
        </>
      )}
    </a>
  );
};

export const FoodWalletView: React.FC<{
  scope: FoodScope;
  /** Super Admin: which restaurant. */
  vendorId?: string;
  /** Bump to reload. */
  refreshKey?: number;
}> = ({ scope, vendorId, refreshKey = 0 }) => {
  const isOwner = scope === "owner";
  const [wallet, setWallet] = useState<FoodWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [earnings, setEarnings] = useState<FoodWalletEarningsPage | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [recordOpen, setRecordOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<FoodWalletPayment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const loadWallet = useCallback(async () => {
    setError("");
    try {
      setWallet(await foodWalletService.wallet(scope, vendorId));
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the wallet."));
    } finally {
      setLoading(false);
    }
  }, [scope, vendorId]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet, refreshKey]);

  useEffect(() => {
    if (!wallet) return;
    let current = true;
    setEarningsLoading(true);
    foodWalletService
      .earnings(scope, vendorId, page, PAGE_SIZE)
      .then((res) => current && setEarnings(res))
      .catch((err) => current && toast.error(getErrorMessage(err, "Could not load the delivered orders.")))
      .finally(() => current && setEarningsLoading(false));
    return () => {
      current = false;
    };
    // The list follows the wallet's totals: a recorded payment does not change it, a refresh does.
  }, [scope, vendorId, page, refreshKey, wallet?.summary.deliveredOrders, wallet?.summary.earnedPaise]); // eslint-disable-line react-hooks/exhaustive-deps

  const voidPayment = async () => {
    if (!voidTarget) return;
    if (voidReason.trim().length < 3) {
      toast.warning("Say why this payment is being voided (at least 3 characters).");
      return;
    }
    setVoiding(true);
    try {
      setWallet(await foodWalletService.voidPayment(voidTarget.id, voidReason.trim()));
      toast.success("Payment voided. It no longer counts as money received.");
      setVoidTarget(null);
      setVoidReason("");
    } catch {
      // The API layer already showed why it failed.
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading the wallet" />;
  if (error || !wallet) return <ErrorNotice message={error || "Could not load the wallet."} onRetry={loadWallet} />;

  const s = wallet.summary;
  const owed = s.remainingPaise;
  const deducted = s.commissionPaise + s.gstOnCommissionPaise;
  const orders = `${s.deliveredOrders} delivered order${s.deliveredOrders === 1 ? "" : "s"}`;

  const balanceLabel = owed < 0 ? "Paid in advance" : isOwner ? "Tirvona owes you" : "Tirvona owes this kitchen";
  const balanceHint =
    owed > 0
      ? `For ${orders}, after Tirvona's commission and the GST on it.`
      : owed < 0
        ? isOwner
          ? "Tirvona has paid you more than your delivered orders so far. The extra is taken off your next orders."
          : "Paid more than the delivered orders so far. The extra is taken off this kitchen's next orders."
        : s.earnedPaise > 0
          ? "All paid. Everything delivered so far has been settled."
          : "Nothing earned yet. Delivered orders will appear here.";

  const columns: Column<FoodWalletEarning>[] = [
    {
      key: "order",
      header: "Order",
      primary: true,
      cell: (e) => (
        <div className="min-w-0">
          <p className="font-bold text-[#0B192C] dark:text-white">{e.orderNumber}</p>
          <p className="truncate text-xs text-gray-500">{e.outletName}</p>
        </div>
      ),
    },
    { key: "date", header: "Delivered", cell: (e) => <span className="whitespace-nowrap text-gray-600 dark:text-gray-400">{day(e.earnedAt)}</span> },
    { key: "food", header: "Food value", className: "text-right", cell: (e) => <span className="tabular-nums">{inr(e.foodValuePaise)}</span> },
    {
      key: "deducted",
      header: "Tirvona deducts",
      className: "text-right",
      cell: (e) => (
        <span className="tabular-nums text-gray-500" title={`Commission ${inr(e.commissionPaise)} + GST ${inr(e.gstOnCommissionPaise)}`}>
          −{inr(e.commissionPaise + e.gstOnCommissionPaise)}
        </span>
      ),
    },
    {
      key: "net",
      header: isOwner ? "You earn" : "Kitchen earns",
      className: "text-right",
      cell: (e) => <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-400">{inr(e.netPaise)}</span>,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {isOwner && !s.hasBankDetails && (
        <Notice tone="warning">
          <span className="font-bold">Add your bank account or UPI details so Tirvona can pay you.</span>{" "}
          <Link to="/restaurant/profile" className="font-extrabold underline">
            Add them in your profile
          </Link>
        </Notice>
      )}

      {/* ── Balance ───────────────────────────────────────────────── */}
      <section aria-label="Balance" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="flex flex-col p-4 sm:p-6 lg:col-span-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold tracking-wide text-gray-500 dark:text-gray-400">{balanceLabel}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
              <Banknote size={16} />
            </span>
          </div>
          <p
            className={cx(
              "mt-1 text-3xl font-black tabular-nums sm:text-4xl",
              owed > 0 ? "text-[#0B192C] dark:text-white" : owed < 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {inr(Math.abs(owed))}
          </p>
          <p className="mt-1 text-xs text-gray-500">{balanceHint}</p>
          {isOwner && (
            <p className="mt-auto pt-4 text-[11px] leading-relaxed text-gray-400">
              Tirvona pays you by bank transfer, UPI or cash. Each payment is added below with its receipt.
            </p>
          )}
          {!isOwner && (
            <div className="mt-4">
              <Button className="w-full sm:w-auto" onClick={() => setRecordOpen(true)}>
                <Plus size={16} aria-hidden="true" />
                Record a payment
              </Button>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-7">
          <StatTile icon={<ArrowDownLeft size={16} />} label="Earned so far" value={inr(s.earnedPaise)} hint="After commission and GST" />
          <StatTile
            icon={<Landmark size={16} />}
            label="Received from Tirvona"
            value={inr(s.receivedPaise)}
            hint={
              s.lastPayment
                ? `Last: ${inr(s.lastPayment.amountPaise)} on ${day(s.lastPayment.paidAt)}`
                : "Nothing paid yet"
            }
          />
          <StatTile icon={<Utensils size={16} />} label="Delivered orders" value={s.deliveredOrders} hint={`Food value ${inr(s.foodValuePaise)}`} />
          <StatTile
            icon={<FileText size={16} />}
            label="Tirvona's share"
            value={inr(deducted)}
            hint={`Commission ${inr(s.commissionPaise)} + GST ${inr(s.gstOnCommissionPaise)}`}
          />
        </div>
      </section>

      {/* ── How it works (the kitchen's own view) ─────────────────── */}
      {isOwner && (
        <Card className="p-4 sm:p-5">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: <Wallet size={18} />, title: "Customer pays Tirvona", sub: "Customers pay on Tirvona with Razorpay. The money reaches Tirvona first, not you." },
              { icon: <Utensils size={18} />, title: "You deliver the order", sub: "Each delivered order adds its food value, minus Tirvona's commission and the GST on it, to what Tirvona owes you." },
              { icon: <Landmark size={18} />, title: "Tirvona pays you", sub: "By bank transfer, UPI or cash. Every payment is recorded here, with its receipt." },
            ].map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
                  {step.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-xs leading-relaxed text-gray-500">{step.sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* ── Payments ──────────────────────────────────────────────── */}
      <SectionCard
        title="Payments from Tirvona"
        description={isOwner ? "Every payment Tirvona has made to you, with its receipt." : "Every payment recorded for this kitchen, with its receipt."}
      >
        {wallet.payments.length === 0 ? (
          <EmptyState
            icon={<Landmark size={24} />}
            title="No payments yet"
            description={isOwner ? "When Tirvona pays you, the payment shows up here with its receipt." : "Use “Record a payment” once Tirvona has paid this kitchen."}
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {wallet.payments.map((p) => {
              const voided = p.status === "voided";
              return (
                <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cx(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        voided ? "bg-gray-100 text-gray-400 dark:bg-slate-800" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                      )}
                      aria-hidden="true"
                    >
                      {METHOD_ICON[p.method]}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cx("text-base font-black tabular-nums", voided ? "text-gray-400 line-through" : "text-[#0B192C] dark:text-white")}>
                          {inr(p.amountPaise)}
                        </span>
                        <span className="text-sm font-semibold text-gray-500">{METHOD_LABEL[p.method]}</span>
                        {voided && <StatusBadge label="Voided" tone="danger" />}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.source === "settlement" ? "Settlement payout" : p.paymentNumber} · {when(p.paidAt)}
                      </p>
                      {p.reference && (
                        <p className="break-all text-xs text-gray-500">
                          Reference: <span className="font-mono">{p.reference}</span>
                        </p>
                      )}
                      {p.note && <p className="text-xs text-gray-500">{p.note}</p>}
                      {voided && p.voidReason && <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Cancelled: {p.voidReason}</p>}
                      {!isOwner && p.recordedByName && <p className="text-[11px] text-gray-400">Recorded by {p.recordedByName}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
                    {p.receiptUrl ? (
                      <ReceiptThumb url={p.receiptUrl} />
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">{p.method === "cash" ? "Cash · no receipt" : p.source === "settlement" ? "Bank reference only" : "No receipt"}</span>
                    )}
                    {!isOwner && p.source === "wallet" && !voided && (
                      <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => setVoidTarget(p)}>
                        Void
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ── Delivered orders ──────────────────────────────────────── */}
      <SectionCard
        title="Delivered orders"
        description={isOwner ? "What each delivered order adds to your wallet, newest first." : "What each delivered order adds to this kitchen's wallet, newest first."}
      >
        {!earnings || (earningsLoading && earnings.data.length === 0) ? (
          <LoadingBlock label="Loading orders" />
        ) : earnings.total === 0 ? (
          <EmptyState
            icon={<Utensils size={24} />}
            title="No delivered orders yet"
            description="An order is added once the kitchen marks it delivered or picked up."
          />
        ) : (
          <>
            <DataTable columns={columns} rows={earnings.data} rowKey={(e) => e.orderId} caption="Delivered orders" />
            <Pagination page={page} pageCount={Math.max(1, Math.ceil(earnings.total / PAGE_SIZE))} onChange={setPage} />
          </>
        )}
      </SectionCard>

      {!isOwner && vendorId && (
        <RecordPaymentModal
          open={recordOpen}
          vendor={{ id: vendorId, name: s.businessName }}
          remainingPaise={owed}
          onClose={() => setRecordOpen(false)}
          onRecorded={(next) => {
            setWallet(next);
            setRecordOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!voidTarget}
        title="Void this payment?"
        description={
          voidTarget
            ? `${inr(voidTarget.amountPaise)} (${METHOD_LABEL[voidTarget.method]}) will stop counting as money received, and the kitchen will be shown as owed that amount again. It stays in the history, marked void.`
            : ""
        }
        confirmLabel="Void payment"
        tone="danger"
        loading={voiding}
        onConfirm={voidPayment}
        onCancel={() => {
          setVoidTarget(null);
          setVoidReason("");
        }}
      >
        <Field label="Why is it being voided?" required>
          <input className={inputClass} value={voidReason} maxLength={300} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. entered twice by mistake" />
        </Field>
      </ConfirmDialog>
    </div>
  );
};

export default FoodWalletView;
