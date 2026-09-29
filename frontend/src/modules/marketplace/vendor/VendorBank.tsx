import React, { useState } from "react";
import { Landmark, Trash2 } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Field, PanelState, Pill, inputClass, useAction, useRemote } from "../ui";

export interface BankAccount {
  _id: string;
  accountHolderName: string;
  bankName?: string;
  ifsc: string;
  accountNumberMasked: string;
  isDefault?: boolean;
  verificationStatus?: string;
}

/** The store's payout accounts; only the last 4 digits ever reach the browser. */
export const BankAccountList: React.FC<{ onChange?: () => void; refreshKey?: number }> = ({ onChange, refreshKey = 0 }) => {
  const { data, state, error, reload } = useRemote<BankAccount[]>(() => vendorApi.bankAccounts(), [refreshKey]);
  const { busy, run } = useAction();
  const after = async () => {
    await reload();
    onChange?.();
  };
  if (state !== "ready") return <PanelState state={state} error={error} onRetry={reload} />;
  if (!data?.length) return <p className="text-xs text-gray-400">No bank account added yet.</p>;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
      {data.map((a) => (
        <li key={a._id} className="py-2.5 flex flex-wrap items-center gap-3 text-xs">
          <Landmark size={16} className="text-[#F28C28] shrink-0" />
          <span className="flex-1 min-w-[160px]">
            <span className="font-bold text-[#0B192C] dark:text-white block">
              {a.bankName || "Bank account"} · {a.accountNumberMasked}
            </span>
            <span className="text-gray-400">
              {a.accountHolderName} · {a.ifsc}
            </span>
          </span>
          <Pill status={a.verificationStatus ?? "pending"} />
          {a.isDefault ? (
            <Pill tone="saffron" label="Default" />
          ) : (
            <EnterpriseButton
              variant="ghost"
              size="sm"
              loading={busy === `d${a._id}`}
              onClick={() => run(`d${a._id}`, () => vendorApi.setDefaultBankAccount(a._id), after, "Default payout account updated")}
            >
              Make default
            </EnterpriseButton>
          )}
          <button
            type="button"
            aria-label="Remove bank account"
            disabled={busy === a._id}
            onClick={() => {
              if (window.confirm("Remove this bank account?"))
                run(a._id, () => vendorApi.removeBankAccount(a._id), after, "Bank account removed");
            }}
            className="p-1.5 text-gray-400 hover:text-rose-500 cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
};

const EMPTY = { accountHolderName: "", bankName: "", accountNumber: "", confirm: "", ifsc: "" };

export const BankAccountForm: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const { busy, run } = useAction();
  const mismatch = form.confirm.length > 0 && form.confirm !== form.accountNumber;
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    run(
      "bank",
      () =>
        vendorApi.addBankAccount({
          accountHolderName: form.accountHolderName.trim(),
          bankName: form.bankName.trim() || undefined,
          accountNumber: form.accountNumber.replace(/\s+/g, ""),
          ifsc: form.ifsc.trim().toUpperCase(),
        }),
      () => {
        setForm(EMPTY);
        onSaved();
      },
      "Bank account added",
    );
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 dark:border-slate-800 pt-4">
      <Field label="Account holder name" required>
        <input className={inputClass} value={form.accountHolderName} onChange={set("accountHolderName")} minLength={2} maxLength={100} required />
      </Field>
      <Field label="Bank name">
        <input className={inputClass} value={form.bankName} onChange={set("bankName")} maxLength={100} />
      </Field>
      <Field label="Account number" required>
        <input className={inputClass} value={form.accountNumber} onChange={set("accountNumber")} inputMode="numeric" pattern="[0-9 ]{9,22}" autoComplete="off" required />
      </Field>
      <Field label="Confirm account number" required hint={mismatch ? "Account numbers do not match." : undefined}>
        <input className={inputClass} value={form.confirm} onChange={set("confirm")} inputMode="numeric" autoComplete="off" required />
      </Field>
      <Field label="IFSC" required>
        <input className={`${inputClass} uppercase`} value={form.ifsc} onChange={set("ifsc")} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} required />
      </Field>
      <div className="flex items-end justify-end">
        <EnterpriseButton type="submit" loading={busy === "bank"} disabled={mismatch}>
          Add bank account
        </EnterpriseButton>
      </div>
    </form>
  );
};
