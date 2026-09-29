import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin, PackageCheck, ShoppingBag, Truck, XCircle } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { EnterpriseModal } from "../../../admin/shared/components/EnterpriseModal";
import { Chips, Empty, Field, Panel, PanelState, Pager, Pill, ResponsiveTable, askReason, dateTime, inputClass, inr, shortDate, useAction, useRemote } from "../ui";
import { RequireStore } from "./VendorShared";

export interface VendorOrder {
  _id: string;
  vendorOrderNumber: string;
  masterOrderId?: { _id: string; orderNumber: string; shippingAddress?: Record<string, string>; createdAt?: string; paymentStatus?: string } | string;
  items: Array<{ _id?: string; productId: string; name: string; sku?: string; image?: string; unitPrice: number; quantity: number; lineTotal: number; gstAmount?: number }>;
  subtotal: number;
  gstAmount: number;
  shippingFee: number;
  total: number;
  commissionAmount: number;
  vendorEarning: number;
  fulfillmentStatus: string;
  settlementStatus?: string;
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string };
  statusHistory?: Array<{ from?: string; to: string; at: string; actorRole?: string; note?: string }>;
  cancelReason?: string;
  returnReason?: string;
  refundAmount?: number;
  refundError?: string;
  createdAt: string;
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "New" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "return_requested", label: "Returns" },
  { value: "refunded", label: "Refunded" },
];

/** Next steps a store may take, mirroring the backend's fulfilment state machine. */
const NEXT: Record<string, Array<"processing" | "shipped" | "delivered" | "cancelled">> = {
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

const OrderDetail: React.FC<{ id: string; onChanged: () => void }> = ({ id, onChanged }) => {
  const { data: o, state, error, reload } = useRemote<VendorOrder>(() => vendorApi.order(id), [id]);
  const [tracking, setTracking] = useState({ carrier: "", trackingNumber: "", trackingUrl: "" });
  const { busy, run } = useAction();
  if (state !== "ready" || !o) return <PanelState state={state} error={error} onRetry={reload} missingText="This order is not in your store." />;

  const master = typeof o.masterOrderId === "object" ? o.masterOrderId : undefined;
  const address = master?.shippingAddress;
  const after = async () => {
    await reload();
    onChanged();
  };
  const move = (status: string) => {
    if (status === "cancelled") {
      const reason = askReason("Why are you cancelling this order? The customer is refunded in full.", 5);
      if (!reason) return;
      run(status, () => vendorApi.updateFulfillment(o._id, { status, note: reason }), after, "Order cancelled and refund started");
      return;
    }
    const withTracking = status === "shipped" && tracking.trackingNumber.trim();
    run(
      status,
      () =>
        vendorApi.updateFulfillment(o._id, {
          status,
          ...(withTracking
            ? {
                tracking: {
                  carrier: tracking.carrier.trim() || undefined,
                  trackingNumber: tracking.trackingNumber.trim(),
                  trackingUrl: tracking.trackingUrl.trim() || undefined,
                },
              }
            : {}),
        }),
      after,
      `Order marked ${status}`,
    );
  };

  const next = NEXT[o.fulfillmentStatus] ?? [];
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Pill status={o.fulfillmentStatus} />
        {master?.orderNumber && <span className="text-gray-500">Customer order {master.orderNumber}</span>}
        <span className="text-gray-400">· {dateTime(o.createdAt)}</span>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl">
        {o.items.map((i) => (
          <li key={i._id ?? i.productId} className="p-3 flex items-center gap-3">
            {i.image && <img src={i.image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
            <span className="flex-1 min-w-0">
              <span className="font-bold block truncate">{i.name}</span>
              <span className="text-gray-400">
                {i.sku ? `${i.sku} · ` : ""}
                {inr(i.unitPrice)} × {i.quantity}
              </span>
            </span>
            <span className="font-black tabular-nums">{inr(i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <dt className="text-gray-500">Items</dt>
        <dd className="text-right tabular-nums">{inr(o.subtotal)}</dd>
        <dt className="text-gray-500">GST</dt>
        <dd className="text-right tabular-nums">{inr(o.gstAmount)}</dd>
        <dt className="text-gray-500">Shipping</dt>
        <dd className="text-right tabular-nums">{inr(o.shippingFee)}</dd>
        <dt className="font-black">Order total</dt>
        <dd className="text-right font-black tabular-nums">{inr(o.total)}</dd>
        <dt className="text-gray-500">Tirvona commission</dt>
        <dd className="text-right tabular-nums text-rose-600">− {inr(o.commissionAmount)}</dd>
        <dt className="font-black text-emerald-700">Your earning</dt>
        <dd className="text-right font-black tabular-nums text-emerald-700">{inr(o.vendorEarning)}</dd>
      </dl>

      {address && (
        <div className="rounded-2xl bg-gray-50 dark:bg-slate-900 p-3 space-y-0.5">
          <p className="font-black flex items-center gap-1.5">
            <MapPin size={13} className="text-[#F28C28]" /> Ship to
          </p>
          <p>{address.fullName} · {address.phone}</p>
          <p className="text-gray-500">
            {[address.line1, address.line2, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      {o.tracking?.trackingNumber && (
        <p className="flex items-center gap-1.5">
          <Truck size={13} /> {o.tracking.carrier} {o.tracking.trackingNumber}
        </p>
      )}
      {o.cancelReason && <p className="text-rose-600">Cancelled: {o.cancelReason}</p>}
      {o.returnReason && <p className="text-amber-700">Return reason: {o.returnReason}</p>}
      {o.refundError && <p className="text-rose-600">Refund pending: Tirvona is retrying it.</p>}

      {next.length > 0 && (
        <div className="space-y-3 border-t border-gray-100 dark:border-slate-800 pt-3">
          {next.includes("shipped") && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Courier">
                <input className={inputClass} value={tracking.carrier} maxLength={60} onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))} />
              </Field>
              <Field label="Tracking number">
                <input className={inputClass} value={tracking.trackingNumber} maxLength={80} onChange={(e) => setTracking((t) => ({ ...t, trackingNumber: e.target.value }))} />
              </Field>
              <Field label="Tracking link">
                <input className={inputClass} type="url" value={tracking.trackingUrl} onChange={(e) => setTracking((t) => ({ ...t, trackingUrl: e.target.value }))} />
              </Field>
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            {next.map((status) => (
              <EnterpriseButton
                key={status}
                size="sm"
                variant={status === "cancelled" ? "danger" : status === "delivered" ? "success" : "primary"}
                icon={status === "cancelled" ? <XCircle size={12} /> : status === "shipped" ? <Truck size={12} /> : <PackageCheck size={12} />}
                loading={busy === status}
                disabled={busy !== ""}
                onClick={() => move(status)}
              >
                {status === "processing" ? "Start processing" : status === "shipped" ? "Mark shipped" : status === "delivered" ? "Mark delivered" : "Cancel order"}
              </EnterpriseButton>
            ))}
          </div>
        </div>
      )}

      {o.statusHistory && o.statusHistory.length > 0 && (
        <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
          <p className="font-black mb-2">History</p>
          <ol className="space-y-1.5">
            {o.statusHistory.map((h, idx) => (
              <li key={idx} className="flex flex-wrap gap-2 text-gray-500">
                <span className="tabular-nums">{dateTime(h.at)}</span>
                <Pill status={h.to} />
                {h.actorRole && <span>by {h.actorRole.replace(/_/g, " ")}</span>}
                {h.note && <span className="text-gray-600 dark:text-gray-300">“{h.note}”</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export const VendorOrdersPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const openId = params.get("open") ?? "";
  const [page, setPage] = useState(1);
  const { data, meta, state, error, reload } = useRemote<VendorOrder[]>(() => vendorApi.orders({ status, page, limit: 20 }), [status, page]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <RequireStore>
      {() => (
        <div className="space-y-5">
          <EnterprisePageHeader
            title="Orders"
            subtitle="Only your store's part of each customer order. Pack, ship and deliver them here."
            icon={<ShoppingBag size={20} />}
          />
          <Panel>
            <div className="space-y-3">
              <Chips
                value={status}
                options={FILTERS}
                onChange={(v) => {
                  setPage(1);
                  setParam("status", v);
                }}
              />
              {state !== "ready" ? (
                <PanelState state={state} error={error} onRetry={reload} />
              ) : !data?.length ? (
                <Empty title="No orders yet" text={status ? "No orders with this status." : "Paid orders for your products appear here."} />
              ) : (
                <>
                  <ResponsiveTable
                    rows={data}
                    rowKey={(o) => o._id}
                    onRowClick={(o) => setParam("open", o._id)}
                    columns={[
                      { header: "Order", cell: (o) => <span className="font-mono font-black">{o.vendorOrderNumber}</span> },
                      { header: "Date", cell: (o) => shortDate(o.createdAt) },
                      {
                        header: "Items",
                        cell: (o) => <span className="block truncate max-w-[240px]">{o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</span>,
                        hideOnMobile: true,
                      },
                      { header: "Amount", cell: (o) => <span className="font-black tabular-nums">{inr(o.total)}</span> },
                      { header: "Status", cell: (o) => <Pill status={o.fulfillmentStatus} /> },
                    ]}
                  />
                  <Pager page={meta.page} limit={meta.limit} total={meta.total} onPage={setPage} />
                </>
              )}
            </div>
          </Panel>
          <EnterpriseModal isOpen={Boolean(openId)} onClose={() => setParam("open", "")} title="Order details" maxWidth="2xl">
            {openId && <OrderDetail id={openId} onChanged={reload} />}
          </EnterpriseModal>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorOrdersPage;
