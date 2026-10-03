import React, { useEffect, useState } from "react";
import { Landmark, Smartphone } from "lucide-react";
import { EnterpriseModal } from "../../admin/shared/components/EnterpriseModal";
import { getErrorMessage } from "../../lib/api";
import { formatCurrency } from "../../utils/format";
import {
  notifyWalletChanged,
  walletService,
  type WithdrawalInput,
} from "../../services/wallet.service";

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT = /^\d{9,18}$/;
const UPI = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  available: number;
  onSubmitted?: () => void;
}

const field =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-[#0B192C] dark:text-white outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/20";
const label = "block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1";

/**
 * The transfer request popup: amount plus bank account or UPI ID. Wallet
 * money is never paid out automatically; this asks the Tirvona team to send
 * it, and the amount is set aside until they do (or decline).
 */
export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  available,
  onSubmitted,
}) => {
  const [method, setMethod] = useState<"bank" | "upi">("bank");
  const [amount, setAmount] = useState("");
  const [holder, setHolder] = useState("");
  const [account, setAccount] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setAmount(available > 0 ? String(available) : "");
  }, [isOpen, available]);

  const validate = (): WithdrawalInput | string => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) return "Enter an amount of at least ₹1.";
    if (value > available) return `You can transfer up to ${formatCurrency(available, "INR")}.`;
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return "Use at most two decimal places.";
    if (method === "upi") {
      if (!UPI.test(upiId.trim())) return "Enter a valid UPI ID, like name@okbank.";
      return {
        amount: value,
        method,
        upiId: upiId.trim(),
        accountHolderName: holder.trim() || undefined,
        note: note.trim() || undefined,
      };
    }
    const acc = account.replace(/\s+/g, "");
    if (holder.trim().length < 2) return "Enter the account holder's name.";
    if (!ACCOUNT.test(acc)) return "Enter a valid account number (9–18 digits).";
    if (acc !== confirmAccount.replace(/\s+/g, "")) return "The account numbers do not match.";
    if (!IFSC.test(ifsc.trim().toUpperCase())) return "Enter a valid IFSC code, like SBIN0001234.";
    return {
      amount: value,
      method,
      accountHolderName: holder.trim(),
      accountNumber: acc,
      ifsc: ifsc.trim().toUpperCase(),
      bankName: bankName.trim() || undefined,
      note: note.trim() || undefined,
    };
  };

  const submit = async () => {
    const result = validate();
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await walletService.requestWithdrawal(result);
      notifyWalletChanged();
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not send the request. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer to bank"
      subtitle={`Available: ${formatCurrency(available, "INR")}`}
      icon={
        <span className="w-9 h-9 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center">
          <Landmark size={18} />
        </span>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 dark:border-slate-700 px-5 py-2.5 text-xs font-extrabold text-gray-600 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || available <= 0}
            className="rounded-full bg-[#F28C28] hover:bg-[#D97706] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {saving ? "Sending request…" : "Send transfer request"}
          </button>
        </div>
      }
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        Wallet money is meant for Tirvona bookings. If you'd rather have it in
        your account, our team will review this request and transfer it
        manually, usually within 3–5 working days. The amount is set aside from
        your wallet until then.
      </p>

      <div>
        <span className={label}>Amount</span>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={available}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={field}
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => setAmount(String(available))}
            className="shrink-0 rounded-xl border border-[#F28C28] text-[#F28C28] px-3 text-xs font-extrabold"
          >
            Max
          </button>
        </div>
      </div>

      <div>
        <span className={label}>Send to</span>
        <div className="grid grid-cols-2 gap-2">
          {(["bank", "upi"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-extrabold transition-colors ${
                method === m
                  ? "border-[#F28C28] bg-[#FFF4E5] text-[#F28C28] dark:bg-amber-950/30"
                  : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {m === "bank" ? <Landmark size={15} /> : <Smartphone size={15} />}
              {m === "bank" ? "Bank account" : "UPI ID"}
            </button>
          ))}
        </div>
      </div>

      {method === "bank" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <span className={label}>Account holder name</span>
            <input className={field} value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <span className={label}>Account number</span>
            <input className={field} value={account} onChange={(e) => setAccount(e.target.value)} inputMode="numeric" autoComplete="off" />
          </div>
          <div>
            <span className={label}>Confirm account number</span>
            <input className={field} value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value)} inputMode="numeric" autoComplete="off" />
          </div>
          <div>
            <span className={label}>IFSC code</span>
            <input className={`${field} uppercase`} value={ifsc} onChange={(e) => setIfsc(e.target.value)} maxLength={11} autoComplete="off" />
          </div>
          <div>
            <span className={label}>Bank name (optional)</span>
            <input className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <span className={label}>UPI ID</span>
            <input className={field} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@okbank" autoComplete="off" />
          </div>
          <div>
            <span className={label}>Name on UPI (optional)</span>
            <input className={field} value={holder} onChange={(e) => setHolder(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <span className={label}>Note for our team (optional)</span>
        <textarea className={field} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </EnterpriseModal>
  );
};

export default WithdrawalModal;
