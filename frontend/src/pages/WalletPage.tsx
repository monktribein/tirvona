import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Landmark,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useWallet } from "../contexts/WalletContext";
import { getErrorMessage } from "../lib/api";
import { toast } from "../lib/toast";
import { formatCurrency, formatDateTimeIN } from "../utils/format";
import WithdrawalModal from "../components/wallet/WithdrawalModal";
import {
  WALLET_CATEGORY_LABEL,
  WALLET_MODULE_LABEL,
  WITHDRAWAL_STATUS_LABEL,
  WITHDRAWAL_STATUS_TONE,
  notifyWalletChanged,
  walletService,
  type WalletTransaction,
  type WalletWithdrawal,
} from "../services/wallet.service";

const PAGE_SIZE = 20;

const FILTERS = [
  { key: "", label: "All" },
  { key: "credit", label: "Money in" },
  { key: "debit", label: "Money out" },
] as const;

const Stat: React.FC<{ label: string; value: number; hint?: string; tone: string }> = ({
  label,
  value,
  hint,
  tone,
}) => (
  <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-md">
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black mb-2 tabular-nums ${tone}`}>
      {formatCurrency(value, "INR")}
    </span>
    <p className="text-xs font-extrabold text-[#0B192C] dark:text-white">{label}</p>
    {hint && <p className="text-[10px] text-gray-400 font-medium mt-0.5">{hint}</p>}
  </div>
);

/**
 * The pilgrim's wallet: balance, every movement, and transfer requests.
 * Refunds from cancelled bookings land here and can pay for the next booking;
 * moving money to a bank account goes through a request the Tirvona team
 * approves and pays out. Rendered as the "Tirvona Wallet" section of the
 * profile, so it sits inside the profile's header and sidebar.
 */
export const WalletPage: React.FC = () => {
  const { summary, balance, refresh } = useWallet();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"history" | "transfers">(
    params.get("tab") === "transfers" ? "transfers" : "history",
  );
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawal[]>([]);
  const [transferOpen, setTransferOpen] = useState(params.get("transfer") === "1");
  const [cancelling, setCancelling] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await walletService.transactions({ page, limit: PAGE_SIZE, type: filter || undefined });
      setRows(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load your wallet history."));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  const loadWithdrawals = useCallback(async () => {
    try {
      const res = await walletService.withdrawals();
      setWithdrawals(res.data.data ?? []);
    } catch {
      // Shown as an empty list; the history tab still works.
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  useEffect(() => {
    const onChange = () => {
      loadHistory();
      loadWithdrawals();
    };
    window.addEventListener("tirvona:wallet-changed", onChange);
    return () => window.removeEventListener("tirvona:wallet-changed", onChange);
  }, [loadHistory, loadWithdrawals]);

  const closeTransfer = () => {
    setTransferOpen(false);
    if (params.get("transfer")) {
      params.delete("transfer");
      setParams(params, { replace: true });
    }
  };

  const cancelRequest = async (id: string) => {
    setCancelling(id);
    try {
      await walletService.cancelWithdrawal(id);
      notifyWalletChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not cancel the request."));
    } finally {
      setCancelling("");
    }
  };

  const wallet = summary?.wallet;
  const openRequest = withdrawals.find((w) => ["pending", "approved"].includes(w.status));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-[#0B192C] dark:text-white">Tirvona Wallet</h2>
          <p className="text-xs text-gray-400 font-medium">
            Refunds and credits you can spend on your next booking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            refresh();
            notifyWalletChanged();
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-xs font-extrabold text-gray-700 dark:text-gray-200 hover:bg-gray-50 cursor-pointer transition-all shadow-xs shrink-0"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[#FFF4E5] dark:bg-amber-950/40 text-[#F28C28] shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 tracking-wider">Available to spend</p>
            <p className="text-3xl font-black text-[#0B192C] dark:text-white tabular-nums leading-tight">
              {formatCurrency(balance, "INR")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          disabled={balance <= 0 || Boolean(openRequest)}
          title={openRequest ? "You already have a transfer in progress" : undefined}
          className="px-4 py-2 bg-[#F28C28] hover:bg-[#D97706] text-white rounded-full text-xs font-extrabold flex items-center gap-2 transition-all shadow-md cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Landmark size={14} className="shrink-0" />
          <span>Transfer to bank</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="On hold"
          value={wallet?.heldAmount ?? 0}
          hint="For a checkout in progress"
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <Stat
          label="Transfer pending"
          value={wallet?.pendingWithdrawal ?? 0}
          hint="Waiting to reach your bank"
          tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <Stat
          label="Total received"
          value={wallet?.totalCredited ?? 0}
          hint="Refunds and credits"
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          label="Spent on bookings"
          value={wallet?.totalSpent ?? 0}
          hint="Paid from your wallet"
          tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        />
      </div>

      <div className="flex gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-md text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        <Info size={16} className="text-[#F28C28] shrink-0 mt-0.5" />
        <p>
          When you cancel a paid booking, parking, aarti pass or marketplace
          order, the refund is added here instantly. Use it at checkout for any
          Tirvona booking. Wallet money is not withdrawn automatically — if you
          need it in your bank account, send a transfer request and our team
          will send it to your bank or UPI.
        </p>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl p-2 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs font-extrabold">
        <div className="flex items-center gap-1">
          {(
            [
              ["history", "Wallet history"],
              ["transfers", `Transfer requests${withdrawals.length ? ` (${withdrawals.length})` : ""}`],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                tab === key
                  ? "bg-[#F28C28] text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        {tab === "history" && (
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-gray-400 font-semibold px-1">Show:</span>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                  filter === f.key
                    ? "bg-gray-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "history" ? (
        <section className="space-y-4">
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
            {loading ? (
              <div className="py-14 flex justify-center text-gray-400">
                <Loader2 className="animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 px-6 space-y-2">
                <Wallet size={28} className="text-gray-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs font-bold text-gray-400">No wallet activity yet</p>
                <p className="text-[10px] text-gray-400 font-medium">
                  Refunds from cancelled bookings and credits from Tirvona will show here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map((t) => (
                  <li key={t._id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        t.type === "credit"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
                          : "bg-rose-50 text-rose-600 dark:bg-rose-950/40"
                      }`}
                    >
                      {t.type === "credit" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[#0B192C] dark:text-white truncate">
                        {WALLET_CATEGORY_LABEL[t.category] ?? t.category}
                        <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          {WALLET_MODULE_LABEL[t.module] ?? t.module}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {formatDateTimeIN(t.createdAt)}
                        {t.reference ? ` · ${t.reference}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-black tabular-nums ${
                          t.type === "credit" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {t.type === "credit" ? "+" : "−"}
                        {formatCurrency(t.amount, "INR")}
                      </p>
                      <p className="text-[10px] text-gray-400 tabular-nums">
                        Bal {formatCurrency(t.balanceAfter, "INR")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {page} of {pages} · {total} entries
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-9 h-9 rounded-full border border-gray-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-9 h-9 rounded-full border border-gray-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {withdrawals.length === 0 ? (
            <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md text-center py-10 px-6 space-y-2">
              <Landmark size={28} className="text-gray-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs font-bold text-gray-400">No transfer requests</p>
              <p className="text-[10px] text-gray-400 font-medium">
                Use "Transfer to bank" to ask for wallet money in your account.
              </p>
            </div>
          ) : (
            withdrawals.map((w) => (
              <article
                key={w._id}
                className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-[#0B192C] dark:text-white tabular-nums">
                      {formatCurrency(w.amount, "INR")}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {w.requestNumber} · {formatDateTimeIN(w.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold ${WITHDRAWAL_STATUS_TONE[w.status]}`}
                  >
                    {WITHDRAWAL_STATUS_LABEL[w.status]}
                  </span>
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                  {w.method === "upi" ? (
                    <>To UPI <b>{w.upiId}</b></>
                  ) : (
                    <>
                      To {w.bankName || "bank"} account <b>{w.accountNumber}</b> · {w.ifsc} ·{" "}
                      {w.accountHolderName}
                    </>
                  )}
                </p>
                {w.status === "paid" && w.payoutReference && (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    Sent on {formatDateTimeIN(w.paidAt)} · Ref {w.payoutReference}
                  </p>
                )}
                {w.status === "rejected" && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                    {w.rejectionReason} — the amount is back in your wallet.
                  </p>
                )}
                {w.status === "pending" && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Clock size={13} /> Waiting for review
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelRequest(w._id)}
                      disabled={cancelling === w._id}
                      className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 text-xs font-bold text-gray-700 dark:text-gray-200 rounded-full transition-all cursor-pointer disabled:opacity-50"
                    >
                      {cancelling === w._id ? "Cancelling…" : "Cancel request"}
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      )}

      <WithdrawalModal
        isOpen={transferOpen}
        onClose={closeTransfer}
        available={balance}
        onSubmitted={() => {
          setTab("transfers");
          refresh();
        }}
      />
    </div>
  );
};

export default WalletPage;
