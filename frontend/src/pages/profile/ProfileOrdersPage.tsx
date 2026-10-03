import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { checkoutApi } from "../../services/marketplace.service";
import { useNotifications } from "../../contexts/NotificationContext";
import { formatCurrency, formatDateIN } from "../../utils/format";
import { humanizeLabel } from "../../utils/labels";
import { getErrorMessage } from "../../lib/api";
import {
  Loader2,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  Star,
  Store,
  Truck,
} from "lucide-react";
import { notifyWalletChanged } from "../../services/wallet.service";

interface OrderItem {
  _id?: string;
  productId: string;
  name: string;
  slug?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface VendorOrder {
  _id: string;
  vendorOrderNumber: string;
  vendorSnapshot?: { storeName?: string; slug?: string };
  items: OrderItem[];
  total: number;
  fulfillmentStatus: string;
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string };
  cancelReason?: string;
  refundAmount?: number;
}

interface MasterOrder {
  _id: string;
  orderNumber: string;
  pricing: { totalAmount: number; amountPaid?: number; amountRefunded?: number };
  status: string;
  paymentStatus: string;
  createdAt: string;
  vendorOrders: VendorOrder[];
}

const STATUS_TONE: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-orange-50 text-[#D97706] border-orange-200",
  processing: "bg-orange-50 text-[#D97706] border-orange-200",
  partially_fulfilled: "bg-orange-50 text-[#D97706] border-orange-200",
  packed: "bg-orange-50 text-[#D97706] border-orange-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  return_requested: "bg-amber-50 text-amber-700 border-amber-200",
  returned: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  expired: "bg-gray-100 text-gray-600 border-gray-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-gray-100 text-gray-600 border-gray-200",
};

const CANCELLABLE = ["confirmed", "processing"];

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2.5 py-1 rounded-full border text-[10px] font-black whitespace-nowrap ${
      STATUS_TONE[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
    }`}
  >
    {humanizeLabel(status)}
  </span>
);

const ItemRow: React.FC<{ item: OrderItem; action?: React.ReactNode }> = ({
  item,
  action,
}) => (
  <div className="flex items-center gap-3">
    <img
      src={item.image || FALLBACK_IMAGE}
      alt={item.name}
      className="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-slate-900 shrink-0"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
      }}
    />
    <span className="flex-1 min-w-0 text-xs">
      <span className="block font-bold text-[#0B192C] dark:text-white truncate">
        {item.name}
      </span>
      <span className="text-gray-400">
        {formatCurrency(item.unitPrice)} × {item.quantity}
      </span>
      {action}
    </span>
    <span className="text-xs font-bold tabular-nums shrink-0">
      {formatCurrency(item.lineTotal)}
    </span>
  </div>
);

/** Inline 1-5 star review form for a delivered item (verified purchase). */
const ReviewForm: React.FC<{
  vendorOrderId: string;
  productId: string;
  onDone: () => void;
}> = ({ vendorOrderId, productId, onDone }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await checkoutApi.review({
        vendorOrderId,
        productId,
        rating,
        comment: comment.trim() || undefined,
      });
      onDone();
    } catch {
      // The API client already shows the reason (e.g. already reviewed).
    } finally {
      setSaving(false);
    }
  };
  return (
    <span className="mt-2 flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-slate-700 p-2.5">
      <span className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className="cursor-pointer"
          >
            <Star
              size={16}
              fill={n <= rating ? "currentColor" : "none"}
              className={n <= rating ? "text-[#F28C28]" : "text-gray-300"}
            />
          </button>
        ))}
      </span>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Share your experience (optional)"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="self-start px-3.5 py-1.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] disabled:opacity-60 text-white text-[11px] font-extrabold cursor-pointer"
      >
        {saving ? "Submitting..." : "Submit review"}
      </button>
    </span>
  );
};

export const ProfileOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [orders, setOrders] = useState<MasterOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [reviewing, setReviewing] = useState("");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await checkoutApi.orders({ limit: 50 });
      setOrders(current.data?.data ?? []);
      setFailed(false);
    } catch {
      setOrders([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      addNotification("Done", done, "success");
      await load();
    } catch (err) {
      addNotification("Could not complete", getErrorMessage(err, "Please try again."), "error");
    } finally {
      setBusy("");
    }
  };

  const cancelOrder = (order: MasterOrder) => {
    if (!window.confirm(`Cancel the items in ${order.orderNumber} that have not shipped yet?`)) return;
    run(
      order._id,
      async () => {
        await checkoutApi.cancel(order._id, "Cancelled by customer");
        notifyWalletChanged();
      },
      `${order.orderNumber} has been cancelled. Paid amounts are refunded to your Tirvona wallet.`,
    );
  };

  const requestReturn = (vo: VendorOrder) => {
    const reason = window.prompt("Why do you want to return these items?");
    if (!reason || reason.trim().length < 5) return;
    run(vo._id, () => checkoutApi.requestReturn(vo._id, reason.trim()), "Your return request has been sent for review.");
  };

  if (loading)
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-gray-100 dark:bg-slate-900 animate-pulse"
          />
        ))}
      </div>
    );

  if (failed)
    return (
      <div className="text-center py-14 space-y-3">
        <PackageSearch size={32} className="mx-auto text-gray-300" />
        <p className="text-sm font-bold text-[#0B192C] dark:text-white">
          Your orders could not be loaded
        </p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold cursor-pointer"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );

  if (!orders.length)
    return (
      <div className="text-center py-14 space-y-3">
        <ShoppingBag size={32} className="mx-auto text-gray-300" />
        <p className="text-sm font-bold text-[#0B192C] dark:text-white">
          No orders yet
        </p>
        <p className="text-xs text-gray-500">
          Products you order from Tirvona sellers will appear here.
        </p>
        <button
          onClick={() => navigate("/marketplace")}
          className="px-5 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#D97706] text-white text-xs font-extrabold cursor-pointer"
        >
          Browse marketplace
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const canCancel =
          order.paymentStatus === "pending"
            ? order.status === "pending_payment"
            : order.vendorOrders.some((vo) => CANCELLABLE.includes(vo.fulfillmentStatus));
        return (
          <div
            key={order._id}
            className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-black text-[#0B192C] dark:text-white">
                  {order.orderNumber}
                </span>
                <span className="block text-[11px] text-gray-500">
                  Placed {formatDateIN(order.createdAt)}
                  {order.vendorOrders.length > 1 &&
                    ` · ${order.vendorOrders.length} stores`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={order.status} />
                {order.paymentStatus !== "paid" && (
                  <span className="text-[10px] font-black text-amber-600">
                    Payment {humanizeLabel(order.paymentStatus).toLowerCase()}
                  </span>
                )}
              </div>
            </div>

            {order.status === "pending_payment" && (
              <p className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-2.5">
                Payment was not completed. The items are held for a few minutes and
                then released automatically. Nothing has been charged.
              </p>
            )}

            {order.vendorOrders.map((vo) => (
              <section
                key={vo._id}
                className="rounded-xl border border-gray-100 dark:border-slate-800 p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-black text-gray-600 dark:text-gray-300">
                    <Store size={12} className="text-[#F28C28]" />
                    {vo.vendorSnapshot?.slug ? (
                      <Link
                        to={`/marketplace/store/${vo.vendorSnapshot.slug}`}
                        className="hover:text-[#F28C28]"
                      >
                        {vo.vendorSnapshot?.storeName}
                      </Link>
                    ) : (
                      vo.vendorSnapshot?.storeName
                    )}
                    <span className="font-mono font-semibold text-gray-400">
                      {vo.vendorOrderNumber}
                    </span>
                  </span>
                  <StatusPill status={vo.fulfillmentStatus} />
                </div>
                {vo.items.map((item) => {
                  const key = `${vo._id}:${item.productId}`;
                  const canReview =
                    vo.fulfillmentStatus === "delivered" && !reviewed.has(key);
                  return (
                    <ItemRow
                      key={item._id ?? item.productId}
                      item={item}
                      action={
                        canReview &&
                        (reviewing === key ? (
                          <ReviewForm
                            vendorOrderId={vo._id}
                            productId={String(item.productId)}
                            onDone={() => {
                              setReviewing("");
                              setReviewed((prev) => new Set(prev).add(key));
                              addNotification("Thank you", "Your review has been published.", "success");
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReviewing(key)}
                            className="block mt-1 text-[11px] font-bold text-[#F28C28] hover:underline cursor-pointer"
                          >
                            Write a review
                          </button>
                        ))
                      }
                    />
                  );
                })}
                {vo.tracking?.trackingNumber && (
                  <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <Truck size={12} />
                    {vo.tracking.carrier} {vo.tracking.trackingNumber}
                    {vo.tracking.trackingUrl && (
                      <a
                        href={vo.tracking.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#F28C28] hover:underline"
                      >
                        Track
                      </a>
                    )}
                  </p>
                )}
                {vo.fulfillmentStatus === "delivered" && (
                  <button
                    onClick={() => requestReturn(vo)}
                    disabled={busy === vo._id}
                    className="text-[11px] font-bold text-gray-500 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                  >
                    Request a return
                  </button>
                )}
              </section>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 pt-3">
              <span className="text-xs">
                <span className="text-gray-500">Total </span>
                <strong className="text-[#F28C28] dark:text-amber-400 font-black">
                  {formatCurrency(order.pricing.totalAmount)}
                </strong>
                {Number(order.pricing.amountRefunded) > 0 && (
                  <span className="text-gray-500">
                    {" "}· Refunded {formatCurrency(Number(order.pricing.amountRefunded))}
                  </span>
                )}
              </span>
              {canCancel && (
                <button
                  onClick={() => cancelOrder(order)}
                  disabled={busy === order._id}
                  className="text-[11px] font-bold text-rose-600 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {busy === order._id && <Loader2 size={11} className="animate-spin" />}
                  Cancel order
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProfileOrdersPage;
