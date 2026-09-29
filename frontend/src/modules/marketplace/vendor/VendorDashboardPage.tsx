import React from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  IndianRupee,
  LayoutDashboard,
  Package,
  PackageX,
  Plus,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { Empty, Panel, PanelState, Pill, Stat, inr, shortDate, useRemote } from "../ui";
import { VendorStatusBanner, type VendorProfile } from "./VendorShared";

interface Dashboard {
  store: { _id: string; storeName: string; slug: string; status: string; rejectionReason?: string; suspensionReason?: string };
  orders: { today: number; pending: number; total: number };
  products: { total: number; live: number; pendingApproval: number; rejected: number; lowStock: number; outOfStock: number };
  sales: { gross: number; refunded: number };
  wallet: { pending: number; available: number; lifetimeEarnings: number; paidOut: number; inFlight: number };
  recentOrders: Array<{ _id: string; vendorOrderNumber: string; items: Array<{ name: string; quantity: number }>; total: number; fulfillmentStatus: string; createdAt: string }>;
  topProducts: Array<{ _id: string; name: string; images?: string[]; stock?: number; sold: number }>;
  lowStockItems: Array<{ _id: string; name: string; sku?: string; stock: number; inventory?: { lowStockThreshold?: number } }>;
}

export const VendorDashboardPage: React.FC = () => {
  const { data, state, error, reload } = useRemote<Dashboard>(() => vendorApi.dashboard(), []);

  if (state === "missing") return <Navigate to="/vendor/onboarding" replace />;
  if (state !== "ready" || !data) return <PanelState state={state} error={error} onRetry={reload} />;

  const { store, orders, products, sales, wallet } = data;
  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title={store.storeName}
        subtitle="Your store at a glance. Every number here comes from your live orders and ledger."
        icon={<LayoutDashboard size={20} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {store.status === "active" && (
              <Link
                to={`/marketplace/store/${store.slug}`}
                target="_blank"
                className="px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 hover:border-[#F28C28]"
              >
                View public store <ExternalLink size={12} />
              </Link>
            )}
            <Link
              to="/vendor/products/new"
              className="px-4 py-2 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Plus size={13} /> Add product
            </Link>
          </div>
        }
      />

      <VendorStatusBanner vendor={store as VendorProfile} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Today's orders" value={orders.today} icon={<ShoppingBag size={16} />} />
        <Stat label="Pending orders" value={orders.pending} icon={<Clock size={16} />} tone={orders.pending ? "warn" : undefined} hint="Confirmed or processing" />
        <Stat label="Products" value={products.total} icon={<Package size={16} />} hint={`${products.live} live · ${products.pendingApproval} awaiting approval`} />
        <Stat label="Low stock" value={products.lowStock} icon={<AlertTriangle size={16} />} tone={products.lowStock ? "warn" : undefined} hint={`${products.outOfStock} out of stock`} />
        <Stat label="Total sales" value={inr(sales.gross)} icon={<TrendingUp size={16} />} hint={sales.refunded ? `${inr(sales.refunded)} refunded` : `${orders.total} paid orders`} />
        <Stat label="Available earnings" value={inr(wallet.available)} icon={<Wallet size={16} />} tone="ok" hint="Ready for payout" />
        <Stat label="Pending earnings" value={inr(wallet.pending)} icon={<IndianRupee size={16} />} hint="Released after delivery and the settlement hold" />
        <Stat label="Paid out" value={inr(wallet.paidOut)} icon={<IndianRupee size={16} />} hint={wallet.inFlight ? `${inr(wallet.inFlight)} in progress` : undefined} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          title="Recent orders"
          className="xl:col-span-2"
          actions={
            <Link to="/vendor/orders" className="text-xs font-bold text-[#F28C28] hover:underline">
              All orders
            </Link>
          }
        >
          {data.recentOrders.length === 0 ? (
            <Empty title="No orders yet" text="Orders for your products will appear here as soon as customers pay." />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {data.recentOrders.map((o) => (
                <li key={o._id}>
                  <Link to={`/vendor/orders?open=${o._id}`} className="py-2.5 flex items-center gap-3 text-xs hover:bg-orange-50/40 dark:hover:bg-slate-900/60 rounded-lg px-1">
                    <span className="flex-1 min-w-0">
                      <span className="font-mono font-black text-[#0B192C] dark:text-white">{o.vendorOrderNumber}</span>
                      <span className="block text-gray-500 truncate">
                        {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-black tabular-nums">{inr(o.total)}</span>
                      <span className="text-[10px] text-gray-400">{shortDate(o.createdAt)}</span>
                    </span>
                    <Pill status={o.fulfillmentStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Top products">
            {data.topProducts.length === 0 ? (
              <p className="text-xs text-gray-400">No sales yet.</p>
            ) : (
              <ol className="space-y-2">
                {data.topProducts.map((p, i) => (
                  <li key={p._id} className="flex items-center gap-2.5 text-xs">
                    <span className="w-5 text-gray-400 font-black">{i + 1}</span>
                    <Link to={`/vendor/products/${p._id}`} className="flex-1 min-w-0 truncate font-bold hover:text-[#F28C28]">
                      {p.name}
                    </Link>
                    <span className="font-black tabular-nums">{p.sold} sold</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            title="Inventory alerts"
            actions={
              <Link to="/vendor/inventory?filter=low" className="text-xs font-bold text-[#F28C28] hover:underline">
                Manage stock
              </Link>
            }
          >
            {data.lowStockItems.length === 0 ? (
              <p className="text-xs text-gray-400">All tracked products are above their low-stock level.</p>
            ) : (
              <ul className="space-y-2">
                {data.lowStockItems.map((p) => (
                  <li key={p._id} className="flex items-center gap-2 text-xs">
                    {p.stock <= 0 ? <PackageX size={14} className="text-rose-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
                    <span className="flex-1 min-w-0 truncate font-bold">{p.name}</span>
                    <Pill status={p.stock <= 0 ? "out_of_stock" : "low_stock"} label={`${p.stock} left`} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboardPage;
