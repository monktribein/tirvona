import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../shared/components/EnterpriseModal";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Chips, Empty, Panel, PanelState, Pager, Pill, ResponsiveTable, askReason, dateTime, inr, shortDate, useAction, useRemote } from "../../../modules/marketplace/ui";
import { humanizeLabel } from "../../../utils/labels";
import { useMarketplaceRoles } from "./MarketplaceVendorsPage";

const FILTERS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "partially_fulfilled", label: "Partially fulfilled" },
  { value: "completed", label: "Completed" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

/** Next fulfilment states staff may set (mirrors backend FULFILLMENT_TRANSITIONS; returns go through "resolve return"). */
const NEXT: Record<string, string[]> = {
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

interface MasterOrder {
  _id: string;
  orderNumber: string;
  customerId?: { name?: string; email?: string; phone?: string };
  pricing: { totalAmount: number; amountPaid?: number; amountRefunded?: number };
  status: string;
  paymentStatus: string;
  vendorOrderIds: string[];
  createdAt: string;
}

export const MarketplaceOrdersAdminPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const openId = params.get("open") ?? "";
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<MasterOrder[]>(() => marketplaceAdminApi.orders({ status, page, limit: 20 }), [status, page]);
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Marketplace orders" subtitle="Each customer order and the per-store orders it was split into." icon={<ShoppingBag size={20} />} />
      <Panel>
        <div className="space-y-3">
          <Chips value={status} options={FILTERS} onChange={(v) => { setPage(1); setParam("status", v); }} />
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !data?.length ? (
            <Empty title="No orders found" />
          ) : (
            <>
              <ResponsiveTable
                rows={data}
                rowKey={(o) => o._id}
                onRowClick={(o) => setParam("open", o._id)}
                columns={[
                  { header: "Order", cell: (o) => <span className="font-mono font-black">{o.orderNumber}</span> },
                  { header: "Customer", cell: (o) => o.customerId?.name ?? o.customerId?.email ?? "—", hideOnMobile: true },
                  { header: "Stores", cell: (o) => o.vendorOrderIds.length, hideOnMobile: true },
                  { header: "Total", cell: (o) => <span className="font-black tabular-nums">{inr(o.pricing.totalAmount)}</span> },
                  { header: "Payment", cell: (o) => <Pill status={o.paymentStatus} /> },
                  { header: "Status", cell: (o) => <Pill status={o.status} /> },
                  { header: "Date", cell: (o) => shortDate(o.createdAt), hideOnMobile: true },
                ]}
              />
              <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
            </>
          )}
        </div>
      </Panel>
      <EnterpriseModal isOpen={Boolean(openId)} onClose={() => setParam("open", "")} title="Order details" maxWidth="4xl">
        {openId && <OrderDetail id={openId} onChanged={reload} />}
      </EnterpriseModal>
    </div>
  );
};

const OrderDetail: React.FC<{ id: string; onChanged: () => void }> = ({ id, onChanged }) => {
  const { data: o, state, error, reload } = useRemote<any>(() => marketplaceAdminApi.order(id), [id]);
  const { busy, run } = useAction();
  const { canOperate, canFinance } = useMarketplaceRoles();
  if (state !== "ready" || !o) return <PanelState state={state} error={error} onRetry={reload} />;
  const refresh = async () => {
    await reload();
    onChanged();
  };
  const a = o.shippingAddress ?? {};

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-black">{o.orderNumber}</span>
        <Pill status={o.status} />
        <Pill status={o.paymentStatus} />
        <span className="text-gray-400">{dateTime(o.createdAt)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 font-bold">Customer</p>
          <p>{o.customerId?.name ?? "—"}</p>
          <p className="text-gray-500">
            {o.customerId?.email} {o.customerId?.phone}
          </p>
        </div>
        <div>
          <p className="text-gray-400 font-bold">Ship to</p>
          <p>
            {a.fullName} · {a.phone}
          </p>
          <p className="text-gray-500">{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          ["Items", o.pricing?.itemsSubtotal],
          ["GST", o.pricing?.gstAmount],
          ["Shipping", o.pricing?.shippingFee],
          ["Commission", o.pricing?.commissionAmount],
          ["Total", o.pricing?.totalAmount],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-gray-50 dark:bg-slate-900 p-2.5">
            <p className="text-[10px] text-gray-400 font-bold">{k}</p>
            <p className="font-black tabular-nums">{inr(v)}</p>
          </div>
        ))}
      </div>

      {(o.vendorOrders ?? []).map((vo: any) => (
        <div key={vo._id} className="rounded-2xl border border-gray-100 dark:border-slate-800 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black">{vo.vendorId?.storeName ?? vo.vendorSnapshot?.storeName}</span>
            <span className="font-mono text-gray-400">{vo.vendorOrderNumber}</span>
            <Pill status={vo.fulfillmentStatus} />
            <Pill status={vo.settlementStatus} />
            <span className="ml-auto font-black tabular-nums">{inr(vo.total)}</span>
          </div>
          <ul className="space-y-1">
            {vo.items.map((i: any) => (
              <li key={i._id ?? i.productId} className="flex justify-between gap-3">
                <span>
                  {i.name} × {i.quantity}
                </span>
                <span className="tabular-nums">{inr(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <p className="text-gray-500">
            Commission {inr(vo.commissionAmount)} · Vendor earning {inr(vo.vendorEarning)}
            {vo.tracking?.trackingNumber && ` · ${vo.tracking.carrier ?? "Tracking"} ${vo.tracking.trackingNumber}`}
          </p>
          {vo.returnReason && <p className="text-amber-700">Return reason: {vo.returnReason}</p>}
          {vo.refundError && <p className="text-rose-600">Refund failed: {vo.refundError}</p>}
          <div className="flex flex-wrap gap-1.5">
            {canOperate &&
              (NEXT[vo.fulfillmentStatus] ?? []).map((to) => (
                <EnterpriseButton
                  key={to}
                  size="sm"
                  variant={to === "cancelled" ? "danger" : "outline"}
                  loading={busy === `${vo._id}${to}`}
                  onClick={() => {
                    const note = to === "cancelled" ? askReason("Reason for cancelling this store order (the customer is refunded):") : undefined;
                    if (to === "cancelled" && !note) return;
                    run(`${vo._id}${to}`, () => marketplaceAdminApi.updateFulfillment(vo._id, { status: to, note: note ?? undefined }), refresh, `Marked ${humanizeLabel(to).toLowerCase()}`);
                  }}
                >
                  Mark {humanizeLabel(to).toLowerCase()}
                </EnterpriseButton>
              ))}
            {canOperate && vo.fulfillmentStatus === "return_requested" && (
              <>
                <EnterpriseButton size="sm" variant="success" loading={busy === `${vo._id}ra`} onClick={() => run(`${vo._id}ra`, () => marketplaceAdminApi.resolveReturn(vo._id, true), refresh, "Return approved")}>
                  Approve return
                </EnterpriseButton>
                <EnterpriseButton
                  size="sm"
                  variant="danger"
                  loading={busy === `${vo._id}rr`}
                  onClick={() => {
                    const note = askReason("Why is the return rejected?");
                    if (note) run(`${vo._id}rr`, () => marketplaceAdminApi.resolveReturn(vo._id, false, note), refresh, "Return rejected");
                  }}
                >
                  Reject return
                </EnterpriseButton>
              </>
            )}
            {canFinance && vo.refundError && (
              <EnterpriseButton size="sm" variant="warning" loading={busy === `${vo._id}rf`} onClick={() => run(`${vo._id}rf`, () => marketplaceAdminApi.retryRefund(vo._id), refresh, "Refund retried")}>
                Retry refund
              </EnterpriseButton>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MarketplaceOrdersAdminPage;
