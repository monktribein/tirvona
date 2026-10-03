import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Landmark,
  Wallet,
} from "lucide-react";
import { useWallet } from "../../contexts/WalletContext";
import { formatCurrency, formatDateTimeIN } from "../../utils/format";
import {
  WALLET_CATEGORY_LABEL,
  WITHDRAWAL_STATUS_LABEL,
} from "../../services/wallet.service";

/** Short form for the navbar pill: ₹1.2K, ₹45K, ₹1.5L. */
const compactInr = (value: number): string => {
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(value >= 10_00_000 ? 0 : 1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return `₹${Math.floor(value)}`;
};

/**
 * Navbar wallet: the balance at a glance, and a panel with the full split
 * (spendable, held for a checkout, waiting for bank transfer), the latest
 * movements, and the way to the full history and to a transfer request.
 */
export const WalletButton: React.FC = () => {
  const { summary, balance, refresh } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const wallet = summary?.wallet;
  const recent = summary?.recent ?? [];
  const pending = summary?.openWithdrawal;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Tirvona wallet, balance ${formatCurrency(balance, "INR")}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="My wallet"
        className="h-9 pl-2 pr-2.5 rounded-full text-[#0B192C] dark:text-gray-200 bg-[#FFF4E5] dark:bg-slate-800 hover:bg-[#FFE8CC] dark:hover:bg-slate-700 border border-[#F28C28]/25 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
      >
        <Wallet size={16} className="text-[#F28C28]" />
        <span className="text-xs font-black tabular-nums">{compactInr(balance)}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Wallet summary"
          className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-3 sm:w-96 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden text-left"
        >
          <div className="p-5 bg-gradient-to-br from-[#F28C28] to-[#D97706] text-white">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
              Tirvona wallet
            </p>
            <p className="text-3xl font-black mt-1 tabular-nums">
              {formatCurrency(balance, "INR")}
            </p>
            <p className="text-[11px] text-white/80 mt-0.5">
              Available for bookings, parking, aarti and marketplace
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-2xl bg-white/15 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-white/75">On hold</p>
                <p className="text-sm font-extrabold tabular-nums">
                  {formatCurrency(wallet?.heldAmount ?? 0, "INR")}
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-white/75">To bank (pending)</p>
                <p className="text-sm font-extrabold tabular-nums">
                  {formatCurrency(wallet?.pendingWithdrawal ?? 0, "INR")}
                </p>
              </div>
            </div>
          </div>

          {pending && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              Transfer {pending.requestNumber} of{" "}
              <b>{formatCurrency(pending.amount, "INR")}</b>:{" "}
              {WITHDRAWAL_STATUS_LABEL[pending.status]}
            </div>
          )}

          <div className="px-4 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
              Recent activity
            </p>
            {recent.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 pb-2">
                No wallet activity yet. Refunds from cancelled bookings will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {recent.map((t) => (
                  <li key={t._id} className="py-2.5 flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        t.type === "credit"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
                          : "bg-rose-50 text-rose-600 dark:bg-rose-950/40"
                      }`}
                    >
                      {t.type === "credit" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-[#0B192C] dark:text-white truncate">
                        {WALLET_CATEGORY_LABEL[t.category] ?? t.category}
                      </span>
                      <span className="block text-[10px] text-gray-400 truncate">
                        {formatDateTimeIN(t.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-black tabular-nums ${
                        t.type === "credit" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {t.type === "credit" ? "+" : "−"}
                      {formatCurrency(t.amount, "INR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 gap-2">
            <Link
              to="/profile/wallet"
              onClick={() => setOpen(false)}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded-full bg-[#0B192C] dark:bg-white text-white dark:text-[#0B192C] text-xs font-extrabold py-2.5 hover:opacity-90"
            >
              View full history <ChevronRight size={14} />
            </Link>
            <Link
              to="/profile/wallet?transfer=1"
              onClick={() => setOpen(false)}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded-full border border-[#F28C28] text-[#F28C28] text-xs font-extrabold py-2.5 hover:bg-[#FFF4E5] dark:hover:bg-slate-800"
            >
              <Landmark size={14} /> Transfer to bank
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletButton;
