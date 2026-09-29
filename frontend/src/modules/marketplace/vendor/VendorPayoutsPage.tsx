import React, { useState } from "react";
import { Banknote } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Empty, Field, Panel, PanelState, Pager, Pill, ResponsiveTable, Stat, dateTime, inputClass, inr, useAction, useRemote } from "../ui";
import { BankAccountList, type BankAccount } from "./VendorBank";
import { RequireStore } from "./VendorShared";
import type { Wallet } from "./VendorEarningsPage";

interface Payout {
  _id: string;
  payoutNumber: string;
  amount: number;
  status: string;
  mode?: string;
  utr?: string;
  failureReason?: string;
  bankSnapshot?: { bankName?: string; accountNumberLast4?: string };
  createdAt: string;
  paidAt?: string;
}

/** Payout requests go to Tirvona finance; the status shown is always the backend's. */
export const VendorPayoutsPage: React.FC = () => {
  const wallet = useRemote<Wallet>(() => vendorApi.wallet(), []);
  const banks = useRemote<BankAccount[]>(() => vendorApi.bankAccounts(), []);
  const [page, setPage] = useState(1);
  const payouts = useRemote<Payout[]>(() => vendorApi.payouts({ page, limit: 20 }), [page]);
  const [amount, setAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const { busy, run } = useAction();
  const available = wallet.data?.available ?? 0;
  const value = Number(amount);
  const valid = value >= 1 && value <= available && /^\d+(\.\d{1,2})?$/.test(amount);

  const refresh = async () => {
    await Promise.all([wallet.reload(), payouts.reload()]);
  };

  return (
    <RequireStore>
      {(vendor) => (
        <div className="space-y-5">
          <EnterprisePageHeader title="Payouts" subtitle="Withdraw your available balance to your bank account." icon={<Banknote size={20} />} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Panel title="Request a payout" className="lg:col-span-1">
              {wallet.state !== "ready" ? (
                <PanelState state={wallet.state} error={wallet.error} onRetry={wallet.reload} />
              ) : (
                <div className="space-y-4">
                  <Stat label="Available balance" value={inr(available)} tone="ok" hint={wallet.data?.inFlight ? `${inr(wallet.data.inFlight)} already requested` : undefined} />
                  {vendor.status !== "active" ? (
                    <p className="text-xs text-gray-500">Payouts can be requested only while your store is active.</p>
                  ) : (
                    <>
                      <Field label="Amount (₹)" required hint="Tirvona's minimum payout amount applies.">
                        <input className={inputClass} type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      </Field>
                      <Field label="Bank account" hint="Defaults to your default payout account.">
                        <select className={inputClass} value={bankId} onChange={(e) => setBankId(e.target.value)}>
                          <option value="">Default account</option>
                          {(banks.data ?? []).map((b) => (
                            <option key={b._id} value={b._id}>
                              {b.bankName ?? "Bank"} · {b.accountNumberMasked}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <EnterpriseButton
                        className="w-full"
                        loading={busy === "request"}
                        disabled={!valid || Boolean(busy)}
                        onClick={() =>
                          run(
                            "request",
                            () => vendorApi.requestPayout({ amount: value, bankAccountId: bankId || undefined }),
                            async () => {
                              setAmount("");
                              await refresh();
                            },
                            "Payout requested",
                          )
                        }
                      >
                        Request payout
                      </EnterpriseButton>
                      {amount && value > available && <p className="text-[11px] text-rose-600">Amount is above your available balance.</p>}
                    </>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="Payout history" className="lg:col-span-2">
              {payouts.state !== "ready" ? (
                <PanelState state={payouts.state} error={payouts.error} onRetry={payouts.reload} />
              ) : !payouts.data?.length ? (
                <Empty title="No payouts yet" text="Payouts you request appear here with their bank reference." />
              ) : (
                <>
                  <ResponsiveTable
                    rows={payouts.data}
                    rowKey={(p) => p._id}
                    columns={[
                      { header: "Date", cell: (p) => dateTime(p.createdAt) },
                      { header: "Payout", cell: (p) => <span className="font-mono font-black">{p.payoutNumber}</span>, hideOnMobile: true },
                      { header: "Amount", cell: (p) => <span className="font-black tabular-nums">{inr(p.amount)}</span> },
                      { header: "Status", cell: (p) => <Pill status={p.status} /> },
                      {
                        header: "Reference",
                        cell: (p) => (
                          <span className="text-gray-500">
                            {p.utr ? `UTR ${p.utr}` : p.failureReason ?? (p.bankSnapshot?.accountNumberLast4 ? `to XXXXXX${p.bankSnapshot.accountNumberLast4}` : "—")}
                          </span>
                        ),
                      },
                      {
                        header: "",
                        cell: (p) =>
                          p.status === "requested" ? (
                            <EnterpriseButton
                              size="sm"
                              variant="ghost"
                              loading={busy === p._id}
                              onClick={() => run(p._id, () => vendorApi.cancelPayout(p._id), refresh, "Payout request cancelled")}
                            >
                              Cancel
                            </EnterpriseButton>
                          ) : null,
                      },
                    ]}
                  />
                  <Pager page={payouts.meta.page} limit={payouts.meta.limit} total={payouts.meta.total} onPage={setPage} />
                </>
              )}
            </Panel>
          </div>

          <Panel title="Payout bank accounts">
            <BankAccountList onChange={banks.reload} />
          </Panel>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorPayoutsPage;
