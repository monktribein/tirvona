import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Landmark,
  Loader2,
  CirclePlus,
  RefreshCw,
  Search,
  Undo2,
  Wallet,
} from "lucide-react";
import {
  EnterpriseButton,
  EnterpriseModal,
  EnterprisePageHeader,
  EnterpriseStatsCard,
} from "../../shared";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { formatCurrency, formatDateTimeIN } from "../../../utils/format";
import {
  WALLET_CATEGORY_LABEL,
  WALLET_MODULE_LABEL,
  WITHDRAWAL_STATUS_LABEL,
  WITHDRAWAL_STATUS_TONE,
  walletAdminService,
  type WalletBalances,
  type WalletTransaction,
  type WalletWithdrawal,
} from "../../../services/wallet.service";

const PAGE_SIZE = 20;
const inr = (v: number) => formatCurrency(v ?? 0, "INR");

interface Overview {
  wallets: number;
  balance: number;
  heldAmount: number;
  pendingWithdrawal: number;
  totalCredited: number;
  totalSpent: number;
  totalWithdrawn: number;
  refundCredits: { amount: number; count: number };
  adminCredits: { amount: number; count: number };
  withdrawalsPending: { amount: number; count: number };
  withdrawalsApproved: { amount: number; count: number };
}

interface PilgrimRef {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  balance?: number;
}

interface WalletRow extends WalletBalances {
  _id: string;
  userId: PilgrimRef | null;
}

const field =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-[#0B192C] dark:text-white outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20";

const who = (u?: PilgrimRef | null) =>
  u ? u.name || u.email || u.phone || "Pilgrim" : "Deleted account";

/** Credit a pilgrim's wallet by hand: find the account, then amount + note. */
const CreditModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  preset?: PilgrimRef | null;
  onDone: () => void;
}> = ({ isOpen, onClose, preset, onDone }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PilgrimRef[]>([]);
  const [picked, setPicked] = useState<PilgrimRef | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const keyRef = useRef("");

  useEffect(() => {
    if (!isOpen) return;
    setPicked(preset ?? null);
    setQuery("");
    setResults([]);
    setAmount("");
    setNote("");
    setError("");
    keyRef.current = crypto.randomUUID();
  }, [isOpen, preset]);

  useEffect(() => {
    if (!isOpen || picked || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await walletAdminService.customers(query.trim());
        setResults(res.data.data ?? []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, picked, isOpen]);

  const submit = async () => {
    const value = Number(amount);
    if (!picked) return setError("Choose the pilgrim to credit.");
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || value < 1)
      return setError("Enter an amount of at least ₹1 (up to two decimals).");
    setSaving(true);
    setError("");
    try {
      await walletAdminService.credit({
        userId: picked._id,
        amount: value,
        note: note.trim() || undefined,
        idempotencyKey: keyRef.current,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not credit the wallet."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add wallet credit"
      subtitle="Usable for bookings only; not withdrawable without a transfer request"
      icon={
        <span className="w-9 h-9 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center">
          <Gift size={18} />
        </span>
      }
      footer={
        <div className="flex justify-end gap-2">
          <EnterpriseButton variant="outline" onClick={onClose}>
            Cancel
          </EnterpriseButton>
          <EnterpriseButton onClick={submit} loading={saving} disabled={saving}>
            Credit wallet
          </EnterpriseButton>
        </div>
      }
    >
      <div>
        <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">Pilgrim</p>
        {picked ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#F28C28]/40 bg-[#FFF4E5] dark:bg-amber-950/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#0B192C] dark:text-white truncate">{who(picked)}</p>
              <p className="text-[11px] text-gray-500 truncate">
                {[picked.email, picked.phone].filter(Boolean).join(" · ")}
                {picked.balance !== undefined ? ` · Balance ${inr(picked.balance)}` : ""}
              </p>
            </div>
            {!preset && (
              <button
                type="button"
                className="text-xs font-bold text-[#F28C28]"
                onClick={() => setPicked(null)}
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              className={field}
              placeholder="Search by name, email or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
                {results.map((u) => (
                  <li key={u._id}>
                    <button
                      type="button"
                      onClick={() => setPicked(u)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <p className="text-sm font-bold text-[#0B192C] dark:text-white">{who(u)}</p>
                      <p className="text-[11px] text-gray-500">
                        {[u.email, u.phone].filter(Boolean).join(" · ")} · Balance {inr(u.balance ?? 0)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">Amount (₹)</p>
        <input
          className={field}
          type="number"
          inputMode="decimal"
          min={1}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">Note shown to the pilgrim</p>
        <textarea
          className={field}
          rows={2}
          maxLength={300}
          placeholder="e.g. Goodwill credit for the delayed check-in"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </EnterpriseModal>
  );
};

/** One pilgrim's wallet: balances, full statement and transfer requests. */
const WalletDetailModal: React.FC<{
  userId: string | null;
  onClose: () => void;
  onCredit: (u: PilgrimRef) => void;
  version: number;
}> = ({ userId, onClose, onCredit, version }) => {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => setPage(1), [userId]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoading(true);
    walletAdminService
      .wallet(userId, { page, limit: 15 })
      .then((res) => live && setData(res.data.data))
      .catch((err) => toast.error(getErrorMessage(err, "Could not load this wallet.")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [userId, page, version]);

  if (!userId) return null;
  const wallet: WalletBalances | undefined = data?.wallet;
  const txns: WalletTransaction[] = data?.statement?.data ?? [];
  const pages = Math.max(1, Math.ceil((data?.statement?.total ?? 0) / 15));
  const withdrawals: WalletWithdrawal[] = data?.withdrawals ?? [];

  return (
    <EnterpriseModal
      isOpen
      onClose={onClose}
      maxWidth="3xl"
      title={data ? who(data.user) : "Wallet"}
      subtitle={data ? [data.user?.email, data.user?.phone].filter(Boolean).join(" · ") : undefined}
      icon={
        <span className="w-9 h-9 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center">
          <Wallet size={18} />
        </span>
      }
      footer={
        data && (
          <div className="flex justify-end">
            <EnterpriseButton icon={<CirclePlus size={14} />} onClick={() => onCredit({ ...data.user, balance: wallet?.balance })}>
              Add credit
            </EnterpriseButton>
          </div>
        )
      }
    >
      {loading && !data ? (
        <div className="py-10 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(
              [
                ["Available", wallet?.balance],
                ["On hold", wallet?.heldAmount],
                ["Transfer pending", wallet?.pendingWithdrawal],
                ["Total received", wallet?.totalCredited],
                ["Spent", wallet?.totalSpent],
                ["Transferred out", wallet?.totalWithdrawn],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-gray-50 dark:bg-slate-900 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase text-gray-400">{k}</p>
                <p className="text-sm font-black text-[#0B192C] dark:text-white tabular-nums">{inr(v ?? 0)}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500 mb-2">Statement</p>
            {txns.length === 0 ? (
              <p className="text-xs text-gray-500">No movements yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-800">
                <table className="w-full text-xs min-w-[560px]">
                  <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold">When</th>
                      <th className="text-left px-3 py-2 font-bold">What</th>
                      <th className="text-right px-3 py-2 font-bold">Amount</th>
                      <th className="text-right px-3 py-2 font-bold">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {txns.map((t) => (
                      <tr key={t._id}>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDateTimeIN(t.createdAt)}</td>
                        <td className="px-3 py-2">
                          <p className="font-bold text-[#0B192C] dark:text-white">
                            {WALLET_CATEGORY_LABEL[t.category] ?? t.category} ·{" "}
                            <span className="text-gray-400">{WALLET_MODULE_LABEL[t.module] ?? t.module}</span>
                          </p>
                          <p className="text-gray-500">{t.description}{t.reference ? ` · ${t.reference}` : ""}</p>
                        </td>
                        <td className={`px-3 py-2 text-right font-black tabular-nums ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                          {t.type === "credit" ? "+" : "−"}
                          {inr(t.amount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{inr(t.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pages > 1 && (
              <div className="flex justify-end items-center gap-2 mt-2">
                <span className="text-gray-500">Page {page} / {pages}</span>
                <EnterpriseButton size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} />
                </EnterpriseButton>
                <EnterpriseButton size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight size={14} />
                </EnterpriseButton>
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500 mb-2">Transfer requests</p>
            {withdrawals.length === 0 ? (
              <p className="text-xs text-gray-500">None.</p>
            ) : (
              <ul className="space-y-2">
                {withdrawals.map((w) => (
                  <li key={w._id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 dark:border-slate-800 px-3 py-2">
                    <span className="font-bold text-[#0B192C] dark:text-white">
                      {inr(w.amount)} <span className="text-gray-400 font-medium">· {w.requestNumber} · {formatDateTimeIN(w.createdAt)}</span>
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${WITHDRAWAL_STATUS_TONE[w.status]}`}>
                      {WITHDRAWAL_STATUS_LABEL[w.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </EnterpriseModal>
  );
};

/**
 * Admin console for pilgrim wallets: platform totals, every wallet with its
 * balances, one wallet's full statement, and manual credits.
 */
export const AdminWalletsPage: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState("balance");
  const [hasBalance, setHasBalance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creditFor, setCreditFor] = useState<PilgrimRef | null | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        walletAdminService.overview(),
        walletAdminService.wallets({ page, limit: PAGE_SIZE, search: term || undefined, sort, hasBalance: hasBalance || undefined }),
      ]);
      setOverview(ov.data.data);
      setRows(list.data.data ?? []);
      setTotal(list.data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load wallets."));
    } finally {
      setLoading(false);
    }
  }, [page, term, sort, hasBalance]);

  useEffect(() => {
    load();
  }, [load, version]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Pilgrim Wallets"
        subtitle="Refunds, credits and spending across every pilgrim wallet"
        icon={<Wallet size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <EnterpriseButton variant="outline" icon={<RefreshCw size={14} />} onClick={() => setVersion((v) => v + 1)}>
              Refresh
            </EnterpriseButton>
            <EnterpriseButton variant="secondary" icon={<Landmark size={14} />} onClick={() => navigate("/admin/wallets/withdrawals")}>
              Transfer requests
              {overview?.withdrawalsPending.count ? ` (${overview.withdrawalsPending.count})` : ""}
            </EnterpriseButton>
            <EnterpriseButton icon={<CirclePlus size={14} />} onClick={() => setCreditFor(null)}>
              Add credit
            </EnterpriseButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <EnterpriseStatsCard
          title="Total wallet balance"
          value={inr(overview?.balance ?? 0)}
          description={`${overview?.wallets ?? 0} wallets · ${inr(overview?.heldAmount ?? 0)} on hold`}
          icon={<BadgeIndianRupee size={18} />}
        />
        <EnterpriseStatsCard
          title="Refunded to wallets"
          value={inr(overview?.refundCredits.amount ?? 0)}
          description={`${overview?.refundCredits.count ?? 0} cancellation refunds`}
          icon={<Undo2 size={18} />}
        />
        <EnterpriseStatsCard
          title="Admin credits"
          value={inr(overview?.adminCredits.amount ?? 0)}
          description={`${overview?.adminCredits.count ?? 0} manual credits`}
          icon={<Gift size={18} />}
        />
        <EnterpriseStatsCard
          title="Transfers waiting"
          value={inr((overview?.withdrawalsPending.amount ?? 0) + (overview?.withdrawalsApproved.amount ?? 0))}
          description={`${overview?.withdrawalsPending.count ?? 0} pending · ${overview?.withdrawalsApproved.count ?? 0} approved · ${inr(overview?.totalWithdrawn ?? 0)} paid out`}
          icon={<Clock size={18} />}
        />
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={`${field} pl-9`}
              placeholder="Search pilgrim by name, email or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${field} lg:w-48`}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="balance">Highest balance</option>
            <option value="recent">Recently active</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">
            <input
              type="checkbox"
              className="accent-[#F28C28]"
              checked={hasBalance}
              onChange={(e) => {
                setHasBalance(e.target.checked);
                setPage(1);
              }}
            />
            Only with balance
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-800">
          <table className="w-full text-xs min-w-[820px]">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Pilgrim</th>
                <th className="text-right px-4 py-3 font-bold">Available</th>
                <th className="text-right px-4 py-3 font-bold">On hold</th>
                <th className="text-right px-4 py-3 font-bold">Transfer pending</th>
                <th className="text-right px-4 py-3 font-bold">Received</th>
                <th className="text-right px-4 py-3 font-bold">Spent</th>
                <th className="text-left px-4 py-3 font-bold">Last activity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No wallets match.
                  </td>
                </tr>
              ) : (
                rows.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50/60 dark:hover:bg-slate-900/60">
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-[#0B192C] dark:text-white">{who(w.userId)}</p>
                      <p className="text-gray-500">{[w.userId?.email, w.userId?.phone].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-black tabular-nums text-[#0B192C] dark:text-white">{inr(w.balance)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(w.heldAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(w.pendingWithdrawal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                      <ArrowDownLeft size={12} className="inline mr-0.5" />
                      {inr(w.totalCredited)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                      <ArrowUpRight size={12} className="inline mr-0.5" />
                      {inr(w.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTimeIN(w.updatedAt)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <EnterpriseButton size="sm" variant="outline" disabled={!w.userId} onClick={() => w.userId && setDetailId(w.userId._id)}>
                          View
                        </EnterpriseButton>
                        <EnterpriseButton size="sm" disabled={!w.userId} onClick={() => w.userId && setCreditFor({ ...w.userId, balance: w.balance })}>
                          Credit
                        </EnterpriseButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {page} of {pages} · {total} wallets
            </span>
            <div className="flex gap-2">
              <EnterpriseButton size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </EnterpriseButton>
              <EnterpriseButton size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </EnterpriseButton>
            </div>
          </div>
        )}
      </div>

      <CreditModal
        isOpen={creditFor !== undefined}
        preset={creditFor ?? null}
        onClose={() => setCreditFor(undefined)}
        onDone={() => setVersion((v) => v + 1)}
      />
      <WalletDetailModal
        userId={creditFor === undefined ? detailId : null}
        version={version}
        onClose={() => setDetailId(null)}
        onCredit={(u) => setCreditFor(u)}
      />
    </div>
  );
};

export default AdminWalletsPage;
