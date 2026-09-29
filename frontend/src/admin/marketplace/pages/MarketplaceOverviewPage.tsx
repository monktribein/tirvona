import React from "react";
import { Link } from "react-router-dom";
import { Banknote, ClipboardCheck, IndianRupee, Package, ShoppingBag, Store } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Empty, Panel, PanelState, Pill, Stat, dateTime, inr, shortDate, useRemote } from "../../../modules/marketplace/ui";
import { humanizeLabel } from "../../../utils/labels";

interface Overview {
  vendors: { total: number; active: number; pending: number; draft?: number; approved: number; suspended: number; rejected: number };
  products: { total: number; pending: number; approved: number; rejected: number };
  orders: { paid: number; awaitingPayment: number; awaitingFulfilment: number };
  sales: { gross: number; refunded: number };
  commission: { grossCommission: number; reversedCommission: number; netCommission: number };
  payouts: { pendingCount: number; pendingAmount: number };
  recentOrders: Array<{ _id: string; orderNumber: string; pricing: { totalAmount: number }; status: string; paymentStatus: string; vendorOrderIds: string[]; createdAt: string }>;
  recentActivity: Array<{ _id: string; action: string; details?: { entity?: string; actorRole?: string; reason?: string }; timestamp: string }>;
}

/** Marketplace home for Super Admin and marketplace / finance managers. Every number is from the backend. */
export const MarketplaceOverviewPage: React.FC = () => {
  const { data: o, state, error, reload } = useRemote<Overview>(() => marketplaceAdminApi.overview(), []);
  const q = (to: string, label: string) => (
    <Link to={to} className="text-[11px] font-extrabold text-[#F28C28] hover:underline">
      {label} →
    </Link>
  );

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Marketplace overview" subtitle="Vendors, approvals, orders and money across the multi-vendor marketplace." icon={<Store size={20} />} />
      {state !== "ready" || !o ? (
        <PanelState state={state} error={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat to="/admin/manage/marketplace/vendors?status=" label="Total vendors" value={o.vendors.total} icon={<Store size={16} />} hint={`${o.vendors.active} active · ${o.vendors.suspended} suspended`} />
            <Stat to="/admin/manage/marketplace/vendors?status=awaiting" label="Pending sellers" value={o.vendors.pending + (o.vendors.draft ?? 0)} tone={o.vendors.pending ? "warn" : undefined} icon={<ClipboardCheck size={16} />} hint={`${o.vendors.pending} submitted · ${o.vendors.draft ?? 0} draft · ${o.vendors.approved} approved, not live`} />
            <Stat to="/admin/manage/marketplace/approvals?status=" label="Products" value={o.products.total} icon={<Package size={16} />} hint={`${o.products.approved} approved · ${o.products.rejected} rejected`} />
            <Stat to="/admin/manage/marketplace/approvals?status=pending" label="Pending products" value={o.products.pending} tone={o.products.pending ? "warn" : undefined} icon={<ClipboardCheck size={16} />} />
            <Stat to="/admin/manage/marketplace/orders" label="Paid orders" value={o.orders.paid} icon={<ShoppingBag size={16} />} hint={`${o.orders.awaitingFulfilment} store orders to fulfil`} />
            <Stat to="/admin/manage/marketplace/orders" label="Sales" value={inr(o.sales.gross)} icon={<IndianRupee size={16} />} hint={`${inr(o.sales.refunded)} refunded`} />
            <Stat to="/admin/manage/marketplace/payouts?status=" label="Commission (net)" value={inr(o.commission.netCommission)} tone="ok" icon={<IndianRupee size={16} />} hint={`${inr(o.commission.reversedCommission)} reversed`} />
            <Stat to="/admin/manage/marketplace/payouts?status=requested" label="Pending payouts" value={inr(o.payouts.pendingAmount)} icon={<Banknote size={16} />} hint={`${o.payouts.pendingCount} requests`} />
          </div>

          <div className="flex flex-wrap gap-4">
            {q("/admin/manage/marketplace/vendors?status=awaiting", "Review vendor applications")}
            {q("/admin/manage/marketplace/approvals", "Review products")}
            {q("/admin/manage/marketplace/payouts?status=requested", "Process payouts")}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Panel title="Recent orders" actions={q("/admin/manage/marketplace/orders", "All orders")}>
              {!o.recentOrders.length ? (
                <Empty title="No paid orders yet" />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-slate-800 -my-2">
                  {o.recentOrders.map((r) => (
                    <li key={r._id}>
                      <Link to={`/admin/manage/marketplace/orders?open=${r._id}`} className="flex flex-wrap items-center gap-2 py-2.5 text-xs">
                        <span className="font-mono font-black">{r.orderNumber}</span>
                        <span className="text-gray-400">{r.vendorOrderIds.length} store(s)</span>
                        <Pill status={r.status} />
                        <span className="ml-auto font-black tabular-nums">{inr(r.pricing.totalAmount)}</span>
                        <span className="text-gray-400 w-24 text-right">{shortDate(r.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Recent activity">
              {!o.recentActivity.length ? (
                <Empty title="No activity yet" />
              ) : (
                <ul className="space-y-2.5">
                  {o.recentActivity.map((a) => (
                    <li key={a._id} className="flex items-start gap-3 text-xs">
                      <span className="w-2 h-2 mt-1.5 rounded-full bg-[#F28C28] shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="font-bold">{humanizeLabel(a.action.replace(/^marketplace\./, "").replace(/\./g, " "))}</span>
                        <span className="text-gray-400"> · {humanizeLabel(a.details?.actorRole ?? "system")}</span>
                        {a.details?.reason && <span className="block text-gray-500 truncate">{a.details.reason}</span>}
                      </span>
                      <span className="text-gray-400 shrink-0">{dateTime(a.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketplaceOverviewPage;
