import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { Chips, Panel, PanelState, ResponsiveTable, Stat } from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { formatMinor } from "../../modules/pandit/ui";
import { RecordPaymentModal } from "../../modules/food/RecordPaymentModal";
import { VendorStatusPill } from "../../modules/food/foodUi";
import { foodWalletService } from "../../services/foodWallet.service";
import type { FoodWalletOverview, FoodWalletOverviewRow } from "../../services/foodWallet.service";

const inr = (minor?: number | null) => formatMinor(minor ?? 0) ?? "₹0";

/** Who Tirvona has to pay, and how much: every kitchen's balance, with a shortcut to record a payment. */
export const AdminFoodWalletsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<FoodWalletOverview | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [filter, setFilter] = useState("owed");
  const [paying, setPaying] = useState<FoodWalletOverviewRow | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await foodWalletService.overview());
      setState("ready");
    } catch (err: any) {
      setState(err?.response?.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => filter === "all" || r.remainingPaise > 0),
    [data, filter],
  );
  const owedCount = (data?.rows ?? []).filter((r) => r.remainingPaise > 0).length;

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="Kitchen wallets & payments"
        subtitle="What Tirvona owes each kitchen for delivered orders. Customers pay Tirvona, so pay the kitchen yourself, then record it here with the receipt (or as cash)."
        icon={<Wallet size={20} />}
      />

      {state === "ready" && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat
            label="Tirvona owes kitchens"
            value={inr(data.totals.owedPaise)}
            hint={owedCount ? `${owedCount} kitchen${owedCount === 1 ? "" : "s"} waiting to be paid` : "Nobody is waiting"}
            tone={owedCount ? "warn" : "ok"}
          />
          <Stat label="Paid so far" value={inr(data.totals.receivedPaise)} hint="Recorded payments, all kitchens" tone="ok" />
          <Stat label="Paid in advance" value={inr(data.totals.advancePaise)} hint="Taken off those kitchens' next orders" />
          <Stat label="Kitchens with orders" value={data.totals.restaurants} hint="Delivered at least one order" />
        </div>
      )}

      <Panel>
        <div className="space-y-3">
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "owed", label: `To pay (${owedCount})` },
              { value: "all", label: `All kitchens (${data?.rows.length ?? 0})` },
            ]}
          />

          {state !== "ready" ? (
            <PanelState state={state} onRetry={load} />
          ) : rows.length === 0 ? (
            <PanelState
              state="missing"
              missingText={filter === "owed" ? "Nobody is waiting to be paid." : "No kitchen has delivered an order yet."}
            />
          ) : (
            <ResponsiveTable
              rows={rows}
              rowKey={(r) => r.vendorId}
              onRowClick={(r) => navigate(`/admin/food/vendors/${r.vendorId}?tab=wallet`)}
              columns={[
                {
                  header: "Restaurant",
                  cell: (r) => (
                    <div className="min-w-0">
                      <p className="font-black truncate">{r.businessName}</p>
                      <div className="mt-0.5">
                        <VendorStatusPill status={r.status as any} />
                      </div>
                    </div>
                  ),
                },
                { header: "Delivered", cell: (r) => <span className="tabular-nums">{r.deliveredOrders}</span> },
                { header: "Earned", cell: (r) => <span className="tabular-nums">{inr(r.earnedPaise)}</span> },
                { header: "Received", cell: (r) => <span className="tabular-nums">{inr(r.receivedPaise)}</span> },
                {
                  header: "Owed now",
                  cell: (r) =>
                    r.remainingPaise > 0 ? (
                      <span className="font-black tabular-nums text-amber-600">{inr(r.remainingPaise)}</span>
                    ) : r.remainingPaise < 0 ? (
                      <span className="font-bold tabular-nums text-gray-500">Advance {inr(-r.remainingPaise)}</span>
                    ) : (
                      <span className="font-bold text-emerald-600">Settled</span>
                    ),
                },
                {
                  header: "Actions",
                  cell: (r) => (
                    <div className="flex flex-wrap gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      <EnterpriseButton size="sm" onClick={() => setPaying(r)}>
                        Record payment
                      </EnterpriseButton>
                      <EnterpriseButton size="sm" variant="ghost" onClick={() => navigate(`/admin/food/vendors/${r.vendorId}?tab=wallet`)}>
                        Open
                      </EnterpriseButton>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Panel>

      {paying && (
        <RecordPaymentModal
          open
          vendor={{ id: paying.vendorId, name: paying.businessName }}
          remainingPaise={paying.remainingPaise}
          onClose={() => setPaying(null)}
          onRecorded={() => {
            setPaying(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default AdminFoodWalletsPage;
