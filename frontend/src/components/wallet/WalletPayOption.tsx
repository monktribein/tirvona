import React from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "../../contexts/WalletContext";
import { formatCurrency } from "../../utils/format";

interface WalletPayOptionProps {
  /** What this checkout costs in total. */
  total: number;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** The wallet share the server will apply: never more than total or balance. */
export const walletShareOf = (total: number, balance: number): number =>
  Math.max(0, Math.min(Math.round(total * 100), Math.round(balance * 100))) / 100;

/**
 * "Use my Tirvona wallet" at checkout. Shows how the total splits between the
 * wallet and Razorpay. The split shown here is a preview; the server works
 * out the real one when the payment is opened. Renders nothing when the
 * pilgrim has no balance.
 */
export const WalletPayOption: React.FC<WalletPayOptionProps> = ({
  total,
  checked,
  onChange,
  disabled,
  className = "",
}) => {
  const { balance } = useWallet();
  if (!(balance > 0) || !(total > 0)) return null;
  const share = walletShareOf(total, balance);
  const rest = Math.max(0, Math.round((total - share) * 100) / 100);

  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-colors ${
        checked
          ? "border-[#F28C28] bg-[#FFF4E5] dark:bg-amber-950/30 dark:border-amber-700"
          : "border-gray-200 bg-white hover:border-[#F28C28]/60 dark:bg-slate-900 dark:border-slate-700"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[#F28C28] shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="w-9 h-9 rounded-xl bg-[#F28C28]/10 text-[#F28C28] flex items-center justify-center shrink-0">
        <Wallet size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-[#0B192C] dark:text-white">
          Use Tirvona wallet
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          Balance {formatCurrency(balance, "INR")}
        </span>
        {checked && (
          <span className="mt-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-200">
            {rest > 0
              ? `${formatCurrency(share, "INR")} from wallet + ${formatCurrency(rest, "INR")} online`
              : `Full ${formatCurrency(share, "INR")} paid from wallet. No online payment needed.`}
          </span>
        )}
      </span>
    </label>
  );
};

export default WalletPayOption;
