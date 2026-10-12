/**
 * Pandit wallet: what devotees have paid for this provider's bookings.
 * Route: /provider/wallet
 *
 * Devotees pay Tirvona (Razorpay checkout / UPI QR, or their Tirvona wallet). The pandit's share is
 * credited here "on hold" and becomes withdrawable after the hold period (72 hours by default, the
 * server sends the real value in `rules.holdHours`). Withdrawals go to a saved bank account or UPI id.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Clock,
  Hourglass,
  Landmark,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { providerWalletService } from "../services/provider.service";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorNotice,
  Field,
  LinkButton,
  LoadingBlock,
  Modal,
  Notice,
  PageContainer,
  PageHeader,
  Pagination,
  SectionCard,
  Skeleton,
  StatTile,
  StatusBadge,
  cx,
  formatMinor,
  inputClass,
  type Column,
} from "../ui";

const PAGE_SIZE = 15;
const inr = (minor?: number | null) => formatMinor(minor ?? 0) ?? "₹0";
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "";

/** "2d 5h", "3h 20m", "a few minutes" until a date. */
const timeUntil = (iso?: string) => {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 60_000) return "a few minutes";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const ENTRY_LABEL: Record<string, string> = {
  EARNING: "Booking payment",
  EARNING_REVERSAL: "Refund to devotee",
  WITHDRAWAL: "Withdrawal",
  WITHDRAWAL_REVERSAL: "Withdrawal returned",
};
const PAID_VIA: Record<string, string> = {
  RAZORPAY: "Razorpay / UPI QR",
  TIRVONA_WALLET: "Tirvona wallet",
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "EARNING", label: "Earnings" },
  { key: "WITHDRAWAL", label: "Withdrawals" },
];

type Summary = {
  availableMinor: number;
  pendingMinor: number;
  withdrawingMinor: number;
  recoveryDueMinor: number;
  lifetimeEarnedMinor: number;
  lifetimeWithdrawnMinor: number;
  lifetimePlatformFeeMinor: number;
  nextRelease: { amountMinor: number; availableAt: string } | null;
  payoutAccount: any | null;
  openWithdrawals: any[];
  rules: { holdHours: number; platformFeePercent: number; minWithdrawalMinor: number };
};

export const ProviderWalletPage: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notOnboarded, setNotOnboarded] = useState(false);

  const [entries, setEntries] = useState<any[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const [accountOpen, setAccountOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadSummary = useCallback(async () => {
    setError(null);
    try {
      const res = await providerWalletService.summary();
      setSummary(res.data.data);
    } catch (err: any) {
      if (err?.response?.status === 404) setNotOnboarded(true);
      else setError(getErrorMessage(err, "Could not load your wallet."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await providerWalletService.transactions({ type: filter || undefined, page, limit: PAGE_SIZE });
      setEntries(res.data.data || []);
      setEntriesTotal(res.data.meta?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load transactions."));
    } finally {
      setEntriesLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    if (summary) loadEntries();
  }, [summary, loadEntries]);

  const refresh = () => {
    loadSummary();
  };

  const cancelWithdrawal = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await providerWalletService.cancelWithdrawal(cancelTarget.id);
      toast.success("Withdrawal cancelled. The amount is back in your balance.");
      setCancelTarget(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not cancel the withdrawal."));
    } finally {
      setCancelling(false);
    }
  };

  const columns: Column<any>[] = useMemo(
    () => [
      {
        key: "what",
        header: "Transaction",
        primary: true,
        cell: (e) => (
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cx(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                e.direction === "CREDIT"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
              )}
              aria-hidden="true"
            >
              {e.direction === "CREDIT" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[#0B192C] dark:text-white">{ENTRY_LABEL[e.type] ?? e.type}</p>
              <p className="truncate text-xs text-gray-500">{e.description}</p>
              {e.paymentMethod && PAID_VIA[e.paymentMethod] && (
                <p className="text-xs text-gray-500">Paid via {PAID_VIA[e.paymentMethod]}</p>
              )}
            </div>
          </div>
        ),
      },
      { key: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap text-gray-600 dark:text-gray-400">{when(e.createdAt)}</span> },
      {
        key: "status",
        header: "Status",
        cell: (e) => (
          <div>
            <StatusBadge status={e.status} />
            {e.status === "PENDING" && e.availableAt && (
              <p className="mt-1 text-xs text-gray-500">Withdrawable {when(e.availableAt)}</p>
            )}
            {e.recoveryMinor ? <p className="mt-1 text-xs text-rose-700">{inr(e.recoveryMinor)} carried as recovery</p> : null}
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        className: "text-right",
        cell: (e) => (
          <div className="text-right">
            <p
              className={cx(
                "font-black tabular-nums",
                e.status === "REVERSED"
                  ? "text-gray-400 line-through"
                  : e.direction === "CREDIT"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400",
              )}
            >
              {e.direction === "CREDIT" ? "+" : "−"}
              {inr(e.amountMinor)}
            </p>
            {e.platformFeeMinor ? (
              <p className="text-xs text-gray-500">
                {inr(e.grossMinor)} paid · {inr(e.platformFeeMinor)} fee
              </p>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading your wallet" />
      </PageContainer>
    );
  }

  if (notOnboarded) {
    return (
      <PageContainer className="max-w-xl">
        <EmptyState
          icon={<Wallet size={24} />}
          title="Set up your provider profile first"
          description="Your wallet opens once you have a provider profile. Payments for your bookings will appear here."
          action={<LinkButton to="/provider/profile">Create profile</LinkButton>}
        />
      </PageContainer>
    );
  }

  if (error || !summary) {
    return (
      <PageContainer className="max-w-xl">
        <ErrorNotice message={error ?? "Could not load your wallet."} onRetry={loadSummary} />
      </PageContainer>
    );
  }

  const s = summary;
  const holdLabel = `${s.rules.holdHours} hours`;
  const canWithdraw = s.availableMinor >= s.rules.minWithdrawalMinor && !!s.payoutAccount;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Provider workspace"
        icon={<Wallet size={20} />}
        title="My Wallet"
        description={`Devotee payments for your bookings. Each payment is held for ${holdLabel}, then you can withdraw it to your bank.`}
        actions={
          <Button variant="outline" onClick={refresh} aria-label="Refresh wallet">
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {s.recoveryDueMinor > 0 && (
        <Notice tone="warning">
          {inr(s.recoveryDueMinor)} was refunded to devotees for cancelled bookings after it had already been released to you. It will be deducted
          from your next earnings.
        </Notice>
      )}

      {/* ── Balances ──────────────────────────────────────────────── */}
      <section aria-label="Balances" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="flex flex-col p-4 sm:p-6 lg:col-span-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold tracking-wide text-gray-500 dark:text-gray-400">Available to withdraw</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
              <Banknote size={16} />
            </span>
          </div>
          <p className="mt-1 text-3xl font-black tabular-nums text-[#0B192C] sm:text-4xl dark:text-white">{inr(s.availableMinor)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {s.payoutAccount ? `Withdrawals go to ${s.payoutAccount.label}` : "Add a bank account or UPI id to withdraw"}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              onClick={() => (s.payoutAccount ? setWithdrawOpen(true) : setAccountOpen(true))}
              disabled={!!s.payoutAccount && !canWithdraw}
            >
              <ArrowUpRight size={16} aria-hidden="true" />
              {s.payoutAccount ? "Withdraw" : "Add payout account"}
            </Button>
            {s.payoutAccount && (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAccountOpen(true)}>
                Change account
              </Button>
            )}
          </div>
          {s.payoutAccount && s.availableMinor < s.rules.minWithdrawalMinor && (
            <p className="mt-2 text-[11px] text-gray-400">Minimum withdrawal is {inr(s.rules.minWithdrawalMinor)}.</p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-7">
          <StatTile
            icon={<Hourglass size={16} />}
            label={`On hold (${holdLabel})`}
            value={inr(s.pendingMinor)}
            hint={s.nextRelease ? `${inr(s.nextRelease.amountMinor)} unlocks in ${timeUntil(s.nextRelease.availableAt)}` : "Nothing waiting"}
          />
          <StatTile
            icon={<Clock size={16} />}
            label="Withdrawal in progress"
            value={inr(s.withdrawingMinor)}
            hint={s.openWithdrawals.length ? `${s.openWithdrawals.length} request${s.openWithdrawals.length === 1 ? "" : "s"} open` : "Nothing in progress"}
          />
          <StatTile icon={<ArrowDownLeft size={16} />} label="Total earned" value={inr(s.lifetimeEarnedMinor)} hint="After refunds" />
          <StatTile icon={<Landmark size={16} />} label="Total withdrawn" value={inr(s.lifetimeWithdrawnMinor)} hint="Paid to your bank" />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: <QrCode size={18} />, title: "Devotee pays Tirvona", sub: "Through the Tirvona QR / UPI, Razorpay checkout or their Tirvona wallet." },
            { icon: <ShieldCheck size={18} />, title: `Held for ${holdLabel}`, sub: "Shows here as On hold. If the booking is cancelled and refunded, it is reversed." },
            { icon: <Landmark size={18} />, title: "Withdraw to your bank", sub: "After the hold it becomes Available. Request a withdrawal to your bank or UPI." },
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
        {s.rules.platformFeePercent > 0 && (
          <p className="mt-4 text-xs text-gray-500">Tirvona platform fee: {s.rules.platformFeePercent}% of each booking, deducted before it reaches your wallet.</p>
        )}
      </Card>

      {/* ── Open withdrawals ─────────────────────────────────────── */}
      {s.openWithdrawals.length > 0 && (
        <SectionCard title="Withdrawals in progress" description="Tirvona finance transfers these to your account, usually within 1–2 working days.">
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {s.openWithdrawals.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                    {inr(w.amountMinor)} <span className="font-normal text-gray-500">· {w.withdrawalNumber}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    To {w.destination?.label} · requested {when(w.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={w.status} />
                  {w.status === "REQUESTED" && (
                    <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => setCancelTarget(w)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Statement ────────────────────────────────────────────── */}
      <SectionCard
        title="Transactions"
        description="Every payment, refund and withdrawal on your wallet."
        actions={
          <div role="tablist" aria-label="Filter transactions" className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-slate-800">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                className={cx(
                  "min-h-[36px] rounded-full px-3.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                  filter === f.key ? "bg-white text-[#0B192C] shadow-sm dark:bg-slate-950 dark:text-white" : "text-gray-600 hover:text-[#0B192C] dark:text-gray-400",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {entriesLoading && entries.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Wallet size={24} />}
            title="No transactions yet"
            description="When a devotee pays for one of your bookings, the payment shows up here."
          />
        ) : (
          <>
            <DataTable columns={columns} rows={entries} rowKey={(e) => e.id} caption="Wallet transactions" />
            <Pagination page={page} pageCount={Math.max(1, Math.ceil(entriesTotal / PAGE_SIZE))} onChange={setPage} />
          </>
        )}
      </SectionCard>

      <PayoutAccountModal
        open={accountOpen}
        current={s.payoutAccount}
        onClose={() => setAccountOpen(false)}
        onSaved={() => {
          setAccountOpen(false);
          refresh();
        }}
      />
      <WithdrawModal
        open={withdrawOpen}
        summary={s}
        onClose={() => setWithdrawOpen(false)}
        onDone={() => {
          setWithdrawOpen(false);
          refresh();
        }}
      />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this withdrawal?"
        description={cancelTarget ? `${inr(cancelTarget.amountMinor)} will go back to your available balance.` : ""}
        confirmLabel="Cancel withdrawal"
        tone="danger"
        loading={cancelling}
        onConfirm={cancelWithdrawal}
        onCancel={() => setCancelTarget(null)}
      />
    </PageContainer>
  );
};

// ─────────────────────────────────────────────────────────────── pieces

const PayoutAccountModal: React.FC<{ open: boolean; current: any | null; onClose: () => void; onSaved: () => void }> = ({
  open,
  current,
  onClose,
  onSaved,
}) => {
  const [method, setMethod] = useState<"BANK" | "UPI">("BANK");
  const [holder, setHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmNumber, setConfirmNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setMethod(current?.method === "UPI" ? "UPI" : "BANK");
    setHolder(current?.accountHolderName ?? "");
    setAccountNumber("");
    setConfirmNumber("");
    setIfsc(current?.ifsc ?? "");
    setBankName(current?.bankName ?? "");
    setUpiId("");
    setErrors({});
  }, [open, current]);

  const save = async () => {
    const next: Record<string, string> = {};
    if (holder.trim().length < 2) next.holder = "Enter the name on the account.";
    if (method === "BANK") {
      if (!/^\d{9,18}$/.test(accountNumber)) next.accountNumber = "Account number must be 9 to 18 digits.";
      else if (accountNumber !== confirmNumber) next.confirmNumber = "Account numbers do not match.";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) next.ifsc = "Enter a valid 11-character IFSC, e.g. SBIN0001234.";
    } else if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(upiId.trim())) {
      next.upiId = "Enter a valid UPI id, e.g. name@okhdfcbank.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await providerWalletService.savePayoutAccount(
        method === "BANK"
          ? { method, accountHolderName: holder.trim(), accountNumber, ifsc, bankName: bankName.trim() || undefined }
          : { method, accountHolderName: holder.trim(), upiId: upiId.trim() },
      );
      toast.success("Payout account saved.");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the payout account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current ? "Change payout account" : "Add payout account"}
      description="Withdrawals are sent here. Your account number is stored encrypted and never shown in full."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Payout method" className="grid grid-cols-2 gap-2">
          {[
            { key: "BANK" as const, label: "Bank account", icon: <Landmark size={16} /> },
            { key: "UPI" as const, label: "UPI id", icon: <Smartphone size={16} /> },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={method === m.key}
              onClick={() => setMethod(m.key)}
              className={cx(
                "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28]",
                method === m.key
                  ? "border-[#F28C28] bg-[#FFF4E5] text-[#0B192C] dark:bg-[#F28C28]/15 dark:text-white"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800",
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        <Field label="Account holder name" required error={errors.holder} hint="As printed on your passbook or UPI app.">
          <input className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" />
        </Field>

        {method === "BANK" ? (
          <>
            <Field label="Account number" required error={errors.accountNumber} hint={current?.accountNumberLast4 ? `Currently ending ${current.accountNumberLast4}. Enter it again to change.` : undefined}>
              <input
                className={inputClass}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
            <Field label="Confirm account number" required error={errors.confirmNumber}>
              <input
                className={inputClass}
                value={confirmNumber}
                onChange={(e) => setConfirmNumber(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                onPaste={(e) => e.preventDefault()}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="IFSC" required error={errors.ifsc}>
                <input className={inputClass} value={ifsc} maxLength={11} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/\s/g, ""))} autoComplete="off" />
              </Field>
              <Field label="Bank name">
                <input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="UPI id" required error={errors.upiId} hint={current?.upiId ? `Currently ${current.upiId}.` : undefined}>
            <input className={inputClass} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@okhdfcbank" autoComplete="off" />
          </Field>
        )}
      </div>
    </Modal>
  );
};

const WithdrawModal: React.FC<{ open: boolean; summary: Summary; onClose: () => void; onDone: () => void }> = ({ open, summary, onClose, onDone }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(String(Math.floor(summary.availableMinor / 100)));
      setNote("");
      setError(null);
    }
  }, [open, summary.availableMinor]);

  const submit = async () => {
    const minor = Math.round(Number(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) return setError("Enter an amount.");
    if (minor < summary.rules.minWithdrawalMinor) return setError(`The minimum withdrawal is ${inr(summary.rules.minWithdrawalMinor)}.`);
    if (minor > summary.availableMinor) return setError(`You can withdraw up to ${inr(summary.availableMinor)}.`);
    setError(null);
    setSaving(true);
    try {
      await providerWalletService.withdraw(minor, note.trim() || undefined);
      toast.success(`Withdrawal of ${inr(minor)} requested.`);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Could not request the withdrawal."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Withdraw to your account"
      description={summary.payoutAccount ? `To ${summary.payoutAccount.label}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Request withdrawal
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Available: <strong className="text-[#0B192C] dark:text-white">{inr(summary.availableMinor)}</strong>
        </p>
        <Field label="Amount (₹)" required error={error} hint={`Minimum ${inr(summary.rules.minWithdrawalMinor)}.`}>
          <input
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            data-autofocus
          />
        </Field>
        <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => setAmount(String(summary.availableMinor / 100))}>
          Withdraw full balance
        </Button>
        <Field label="Note for Tirvona finance (optional)">
          <input className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
};

export default ProviderWalletPage;
