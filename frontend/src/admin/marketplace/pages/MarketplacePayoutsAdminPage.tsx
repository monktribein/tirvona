import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Banknote } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Chips, Empty, Panel, PanelState, Pager, Pill, ResponsiveTable, Stat, askReason, dateTime, inr, useAction, useRemote } from "../../../modules/marketplace/ui";
import { useMarketplaceRoles } from "./MarketplaceVendorsPage";

const FILTERS = [
  { value: "requested", label: "Requested" },
  { value: "under_review", label: "Approved (manual transfer)" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "", label: "All" },
];

interface Payout {
  _id: string;
  payoutNumber: string;
  amount: number;
  status: string;
  mode?: string;
  utr?: string;
  providerPayoutId?: string;
  failureReason?: string;
  bankSnapshot?: { accountHolderName?: string; bankName?: string; ifsc?: string; accountNumberLast4?: string };
  vendorId?: { storeName?: string; slug?: string } | null;
  createdAt: string;
}

/** Vendor payout requests and platform commission. Money actions need super_admin or finance_manager. */
export const MarketplacePayoutsAdminPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "requested";
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<Payout[]>(() => marketplaceAdminApi.payouts({ status, page, limit: 20 }), [status, page]);
  const commission = useRemote<{ grossCommission: number; reversedCommission: number; netCommission: number }>(() => marketplaceAdminApi.commission(), []);
  const { busy, run } = useAction();
  const { canFinance } = useMarketplaceRoles();

  const markPaid = (p: Payout) => {
    const utr = askReason(`Bank transfer reference (UTR) for ${inr(p.amount)} to ${p.vendorId?.storeName ?? "the vendor"}:`, 6);
    if (utr) run(`${p._id}paid`, () => marketplaceAdminApi.markPayoutPaid(p._id, utr), reload, "Payout marked paid");
  };
  const markFailed = (p: Payout) => {
    const reason = askReason("Why did this payout fail? The amount is returned to the vendor's balance.");
    if (reason) run(`${p._id}fail`, () => marketplaceAdminApi.markPayoutFailed(p._id, reason), reload, "Payout marked failed");
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Payouts & commission" subtitle="Approve vendor payout requests and track Tirvona's marketplace commission." icon={<Banknote size={20} />} />
      {commission.state === "ready" && commission.data && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Gross commission" value={inr(commission.data.grossCommission)} />
          <Stat label="Reversed (refunds)" value={inr(commission.data.reversedCommission)} />
          <Stat label="Net commission" value={inr(commission.data.netCommission)} tone="ok" />
        </div>
      )}
      <Panel>
        <div className="space-y-3">
          <Chips
            value={status}
            options={FILTERS}
            onChange={(v) => {
              setPage(1);
              setParams({ status: v });
            }}
          />
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty title="No payouts" />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(p) => p._id}
                columns={[
                  { header: "Requested", cell: (p) => dateTime(p.createdAt) },
                  { header: "Store", cell: (p) => <span className="font-extrabold">{p.vendorId?.storeName ?? "—"}</span> },
                  { header: "Amount", cell: (p) => <span className="font-black tabular-nums">{inr(p.amount)}</span> },
                  {
                    header: "Bank",
                    cell: (p) => (
                      <span className="text-gray-500">
                        {p.bankSnapshot?.bankName ?? ""} XXXXXX{p.bankSnapshot?.accountNumberLast4} · {p.mode}
                      </span>
                    ),
                    hideOnMobile: true,
                  },
                  { header: "Status", cell: (p) => <Pill status={p.status} /> },
                  { header: "Reference", cell: (p) => <span className="text-gray-500">{p.utr ?? p.failureReason ?? "—"}</span>, hideOnMobile: true },
                  {
                    header: "",
                    cell: (p) =>
                      canFinance ? (
                        <span className="flex flex-wrap gap-1 justify-end">
                          {["requested", "under_review"].includes(p.status) && (
                            <EnterpriseButton size="sm" variant="success" loading={busy === `${p._id}ok`} onClick={() => run(`${p._id}ok`, () => marketplaceAdminApi.approvePayout(p._id), reload, "Payout approved")}>
                              Approve
                            </EnterpriseButton>
                          )}
                          {p.status === "under_review" && !p.providerPayoutId && (
                            <EnterpriseButton size="sm" variant="outline" loading={busy === `${p._id}paid`} onClick={() => markPaid(p)}>
                              Mark paid
                            </EnterpriseButton>
                          )}
                          {p.status === "processing" && p.providerPayoutId && (
                            <EnterpriseButton size="sm" variant="outline" loading={busy === `${p._id}sync`} onClick={() => run(`${p._id}sync`, () => marketplaceAdminApi.syncPayout(p._id), reload, "Synced with bank")}>
                              Sync status
                            </EnterpriseButton>
                          )}
                          {["requested", "under_review", "processing"].includes(p.status) && (
                            <EnterpriseButton size="sm" variant="ghost" loading={busy === `${p._id}fail`} onClick={() => markFailed(p)}>
                              Mark failed
                            </EnterpriseButton>
                          )}
                        </span>
                      ) : null,
                  },
                ]}
              />
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default MarketplacePayoutsAdminPage;
