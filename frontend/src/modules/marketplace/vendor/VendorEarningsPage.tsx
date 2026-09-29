import React, { useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Chips, Empty, Panel, PanelState, Pager, Pill, ResponsiveTable, Stat, dateTime, inr, useRemote } from "../ui";
import { RequireStore } from "./VendorShared";

export interface Wallet {
  pending: number;
  available: number;
  lifetimeEarnings: number;
  totalPayoutDebits: number;
  paidOut: number;
  inFlight: number;
}

interface LedgerEntry {
  _id: string;
  type: string;
  amount: number;
  availableAt?: string | null;
  description?: string;
  createdAt: string;
}

const CREDITS = ["sale_credit", "commission_reversal_credit", "adjustment_credit", "payout_reversal_credit"];
const TYPES = [
  { value: "", label: "All" },
  { value: "sale_credit", label: "Sales" },
  { value: "commission_debit", label: "Commission" },
  { value: "refund_debit", label: "Refunds" },
  { value: "payout_debit", label: "Payouts" },
  { value: "adjustment_credit", label: "Adjustments" },
];

/** Balances come from the backend ledger; nothing is summed here. */
export const VendorEarningsPage: React.FC = () => {
  const wallet = useRemote<Wallet>(() => vendorApi.wallet(), []);
  const commission = useRemote<{ commission?: { netCommission: number }; sales?: { gross: number; refunded: number } }>(
    () => vendorApi.dashboard(),
    [],
  );
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const ledger = useRemote<LedgerEntry[]>(() => vendorApi.ledger({ type, page, limit: 20 }), [type, page]);
  const w = wallet.data;

  return (
    <RequireStore>
      {() => (
        <div className="space-y-5">
          <EnterprisePageHeader
            title="Earnings"
            subtitle="Sales are credited when an order is paid and become available after delivery and the settlement hold."
            icon={<IndianRupee size={20} />}
            actions={
              <Link to="/vendor/payouts" className="px-4 py-2 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold">
                Request payout
              </Link>
            }
          />
          {wallet.state !== "ready" || !w ? (
            <PanelState state={wallet.state} error={wallet.error} onRetry={wallet.reload} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Total sales" value={inr(commission.data?.sales?.gross)} hint="Paid orders, including GST and shipping" />
              <Stat label="Tirvona commission" value={inr(commission.data?.commission?.netCommission)} hint="Net of reversals" />
              <Stat label="Refunds" value={inr(commission.data?.sales?.refunded)} />
              <Stat label="Pending earnings" value={inr(w.pending)} tone="warn" hint="Not yet delivered or still in hold" />
              <Stat label="Available balance" value={inr(w.available)} tone="ok" hint="Ready to withdraw" />
              <Stat label="Paid out" value={inr(w.paidOut)} hint={w.inFlight ? `${inr(w.inFlight)} in progress` : undefined} />
            </div>
          )}

          <Panel title="Transactions">
            <div className="space-y-3">
              <Chips value={type} options={TYPES} onChange={(v) => { setType(v); setPage(1); }} />
              {ledger.state !== "ready" ? (
                <PanelState state={ledger.state} error={ledger.error} onRetry={ledger.reload} />
              ) : !ledger.data?.length ? (
                <Empty title="No transactions yet" text="Ledger entries appear once customers pay for your products." />
              ) : (
                <>
                  <ResponsiveTable
                    rows={ledger.data}
                    rowKey={(e) => e._id}
                    columns={[
                      { header: "Date", cell: (e) => dateTime(e.createdAt) },
                      { header: "Type", cell: (e) => <Pill status={e.type} tone={CREDITS.includes(e.type) ? "green" : "red"} /> },
                      { header: "Details", cell: (e) => <span className="text-gray-500">{e.description ?? "—"}</span>, hideOnMobile: true },
                      {
                        header: "Amount",
                        cell: (e) => (
                          <span className={`font-black tabular-nums ${CREDITS.includes(e.type) ? "text-emerald-600" : "text-rose-600"}`}>
                            {CREDITS.includes(e.type) ? "+" : "−"}
                            {inr(e.amount)}
                          </span>
                        ),
                      },
                      {
                        header: "Status",
                        cell: (e) =>
                          e.availableAt && new Date(e.availableAt) <= new Date() ? <Pill status="available" /> : <Pill status="pending" />,
                      },
                    ]}
                  />
                  <Pager page={ledger.meta.page} limit={ledger.meta.limit} total={ledger.meta.total} onPage={setPage} />
                </>
              )}
            </div>
          </Panel>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorEarningsPage;
