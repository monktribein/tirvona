import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { marketplaceService } from "../../services/marketplace.service";
import { useNotifications } from "../../contexts/NotificationContext";
import { formatCurrency, formatDateIN } from "../../utils/format";
import { humanizeLabel } from "../../utils/labels";
import { getErrorMessage } from "../../lib/api";
import { Loader2, PackageSearch, RefreshCw, ShoppingBag } from "lucide-react";

interface OrderItem {
  productId: string;
  name: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  shippingAddress?: Record<string, string>;
  pricing: { totalAmount: number; amountPaid: number };
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-[#0A4DA6] border-blue-200",
  packed: "bg-blue-50 text-[#0A4DA6] border-blue-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-gray-100 text-gray-600 border-gray-200",
};

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";

export const ProfileOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.myOrders({ limit: 50 });
      setOrders(res.data?.data ?? []);
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

  const cancel = async (order: Order) => {
    setCancelling(order._id);
    try {
      await marketplaceService.cancelOrder(order._id, "Cancelled by customer");
      addNotification(
        "Order cancelled",
        `${order.orderNumber} has been cancelled.`,
        "success",
      );
      await load();
    } catch (err) {
      addNotification(
        "Could not cancel",
        getErrorMessage(err, "Please try again."),
        "error",
      );
    } finally {
      setCancelling("");
    }
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
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
          Prasad and puja essentials you order will appear here.
        </p>
        <button
          onClick={() => navigate("/marketplace")}
          className="px-5 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-blue-900 text-white text-xs font-extrabold cursor-pointer"
        >
          Browse marketplace
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div
          key={order._id}
          className="bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-black text-[#0B192C] dark:text-white">
                {order.orderNumber}
              </span>
              <span className="block text-[11px] text-gray-500">
                Placed {formatDateIN(order.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full border text-[10px] font-black ${
                  STATUS_TONE[order.orderStatus] ??
                  "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {humanizeLabel(order.orderStatus)}
              </span>
              {order.paymentStatus !== "paid" && (
                <span className="text-[10px] font-black text-amber-600">
                  {humanizeLabel(order.paymentStatus)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
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
                </span>
                <span className="text-xs font-bold tabular-nums shrink-0">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 pt-3">
            <span className="text-xs">
              <span className="text-gray-500">Total </span>
              <strong className="text-[#0A4DA6] dark:text-blue-400 font-black">
                {formatCurrency(order.pricing.totalAmount)}
              </strong>
            </span>
            {!["shipped", "delivered", "cancelled", "refunded"].includes(
              order.orderStatus,
            ) && (
              <button
                onClick={() => cancel(order)}
                disabled={cancelling === order._id}
                className="text-[11px] font-bold text-rose-600 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {cancelling === order._id && (
                  <Loader2 size={11} className="animate-spin" />
                )}
                Cancel order
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProfileOrdersPage;
