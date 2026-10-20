import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  XCircle,
  Bed,
} from "lucide-react";
import { foodService } from "../../services/food.service";
import { payForFoodOrder } from "../../services/foodPayment";
import type { FoodOrder } from "../../services/food.service";

export const FoodOrderTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrder(id);
      const interval = setInterval(() => {
        loadOrder(id, true);
      }, 10000); // 10s auto-refresh
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadOrder = async (orderId: string, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await foodService.getOrder(orderId);
      setOrder(data);
      setError(null);
    } catch (err: any) {
      if (!silent) {
        setError(err?.response?.data?.message || err?.message || "Failed to load order");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      await foodService.cancelOrder(order._id, cancelReason);
      setCancelModalOpen(false);
      loadOrder(order._id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070F1B] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="animate-spin text-amber-500 mx-auto" size={32} />
          <p className="text-xs font-bold text-slate-500">
            Loading order details &amp; tracking status...
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070F1B] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0B192C] p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <AlertCircle className="text-red-500 mx-auto" size={36} />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Order Not Found
          </h2>
          <p className="text-xs text-slate-500">{error || "Unable to find the requested food order."}</p>
          <Link
            to="/food"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-amber-500 text-white text-xs font-bold"
          >
            <span>Back to Tirvona Bhojan</span>
          </Link>
        </div>
      </div>
    );
  }

  // Lifecycle steps calculation
  const steps = [
    { key: "PLACED", label: "Order Placed", done: true },
    {
      key: "ACCEPTED",
      label: "Kitchen Accepted",
      done: [
        "ACCEPTED",
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
        "PICKED_UP",
        "DELIVERED",
        "COMPLETED",
      ].includes(order.orderStatus),
    },
    {
      key: "PREPARING",
      label: "Cooking in Kitchen",
      done: [
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
        "PICKED_UP",
        "DELIVERED",
        "COMPLETED",
      ].includes(order.orderStatus),
    },
    {
      key: "DISPATCH",
      label: order.fulfilmentType === "pickup" ? "Ready for Pickup" : "Out for Delivery",
      done: ["READY", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "COMPLETED"].includes(
        order.orderStatus,
      ),
    },
    {
      key: "COMPLETED",
      label: "Delivered",
      done: ["DELIVERED", "COMPLETED"].includes(order.orderStatus),
    },
  ];

  const isFailedOrCancelled = [
    "CANCELLED",
    "VENDOR_REJECTED",
    "VENDOR_TIMEOUT",
    "REFUNDED",
    "REFUND_PENDING",
    "REFUND_PROCESSING",
    "REFUND_FAILED",
    "PAYMENT_FAILED",
  ].includes(order.orderStatus);

  const canCancel =
    order.orderStatus === "PAYMENT_PENDING" ||
    order.orderStatus === "PAID_AWAITING_VENDOR";

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-[#070F1B] text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/food"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-amber-500 transition-colors"
          >
            <ChevronLeft size={16} />
            <span>Tirvona Food Menu</span>
          </Link>

          <button
            onClick={() => loadOrder(order._id, true)}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh Status</span>
          </button>
        </div>

        {order.orderStatus === "PAYMENT_PENDING" && (
          <div className="rounded-3xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-black text-amber-800 dark:text-amber-300">Payment pending</p>
              <p className="text-amber-700/80 dark:text-amber-200/70">
                Your order is placed once the payment goes through. Payments are collected securely by Tirvona on Razorpay.
              </p>
            </div>
            <button
              type="button"
              disabled={paying}
              onClick={async () => {
                setPaying(true);
                try {
                  await payForFoodOrder(order._id, {
                    name: order.customerName,
                    email: order.customerEmail,
                    contact: order.customerPhone,
                  });
                } catch {
                  // The checkout already showed why.
                } finally {
                  setPaying(false);
                  loadOrder(order._id, true);
                }
              }}
              className="shrink-0 px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-md"
            >
              {paying ? "Opening payment…" : `Pay ₹${order.totalRupees} now`}
            </button>
          </div>
        )}

        {/* Order Header Card */}
        <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {order.orderNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    order.orderStatus === "COMPLETED" || order.orderStatus === "DELIVERED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : isFailedOrCancelled
                      ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {order.orderStatus.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {order.outletId?.brandName || "Tirvona Kitchen"}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin size={12} />
                <span>{order.outletId?.address}</span>
              </p>
            </div>

            {order.outletId?.contactPhone && (
              <a
                href={`tel:${order.outletId.contactPhone}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200"
              >
                <Phone size={14} className="text-amber-500" />
                <span>Call Kitchen</span>
              </a>
            )}
          </div>

          {/* SLA Acceptance Warning if awaiting vendor */}
          {order.orderStatus === "PAID_AWAITING_VENDOR" && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <span>
                <strong>Awaiting Kitchen Acceptance:</strong> Kitchen has 10 minutes to review and accept your order. If they do not respond in time, your payment will be refunded immediately.
              </span>
            </div>
          )}

          {/* Cancellation / Rejection Note */}
          {isFailedOrCancelled && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 text-xs flex items-center gap-2.5">
              <XCircle size={16} className="text-red-500 shrink-0" />
              <div>
                <p className="font-bold">Order was {order.orderStatus.replace(/_/g, " ")}</p>
                {order.rejectionReason && (
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                    Reason: {order.rejectionReason}
                  </p>
                )}
                {order.paymentStatus === "REFUNDED" && (
                  <p className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ Full refund processed back to your original payment method.
                  </p>
                )}
                {["REFUND_PENDING", "REFUND_PROCESSING"].includes(order.orderStatus) && (
                  <p className="mt-0.5 font-bold text-amber-600 dark:text-amber-400">
                    Your refund has been started. It can take 5 to 7 working days to reach your original payment method.
                  </p>
                )}
                {order.orderStatus === "REFUND_FAILED" && (
                  <p className="mt-0.5 font-bold text-red-600 dark:text-red-400">
                    We could not complete your refund yet. Our team has been alerted and will retry it or contact you.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress Tracker Stepper (Only if active) */}
          {!isFailedOrCancelled && (
            <div className="py-4">
              <div className="grid grid-cols-5 gap-2 text-center">
                {steps.map((st, i) => (
                  <div key={st.key} className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        st.done
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      {st.done ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-[10px] mt-2 font-bold leading-tight ${
                        st.done
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400"
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancel button if permitted */}
          {canCancel && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="px-4 py-2 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
              >
                Cancel Order
              </button>
            </div>
          )}
        </div>

        {/* Order Items & Summary Card */}
        <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Ordered Bhojan Items
          </h2>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {order.items?.map((item) => (
              <div key={item._id} className="py-3 flex justify-between items-start">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Qty: {item.quantity} • {item.portion}
                  </p>
                  {item.contents && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {item.contents}
                    </p>
                  )}
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  ₹{item.totalPriceRupees}
                </span>
              </div>
            ))}
          </div>

          {/* Destination & Fulfilment */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              {order.fulfilmentType === "stay_delivery" ? (
                <>
                  <Bed className="text-emerald-500" size={16} />
                  <span>Stay Room Delivery: {order.stayRoomNumber || "Ashram Reception"}</span>
                </>
              ) : order.fulfilmentType === "pickup" ? (
                <>
                  <Utensils className="text-amber-500" size={16} />
                  <span>Self Pickup at Restaurant Kitchen</span>
                </>
              ) : (
                <>
                  <MapPin className="text-blue-500" size={16} />
                  <span>Doorstep Delivery: {order.deliveryAddress}</span>
                </>
              )}
            </div>

            {order.deliveryInstructions && (
              <p className="text-slate-500 text-[11px]">
                Note: {order.deliveryInstructions}
              </p>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Item Subtotal</span>
              <span className="font-bold">₹{order.subtotalRupees}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Satvik Packaging</span>
              <span className="font-bold">₹{order.packagingFeeRupees}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Delivery Charges</span>
              <span className="font-bold">₹{order.deliveryFeeRupees}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>GST (5%)</span>
              <span className="font-bold">₹{order.taxRupees}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>Paid Amount</span>
              <span className="text-amber-600 dark:text-amber-400">
                ₹{order.totalRupees}
              </span>
            </div>
          </div>
        </div>

        {/* Audit Timeline */}
        {order.events && order.events.length > 0 && (
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Audited Order Events
            </h2>
            <div className="space-y-2">
              {order.events.map((ev) => (
                <div
                  key={ev._id}
                  className="text-xs flex items-start gap-2 text-slate-500"
                >
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {new Date(ev.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    <strong>{ev.toStatus.replace(/_/g, " ")}:</strong>{" "}
                    {ev.reason || "Status updated"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Order Dialog Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Cancel Order #{order.orderNumber}?
            </h3>
            <p className="text-xs text-slate-500">
              Since the kitchen has not started cooking yet, you can cancel this order. A 100% refund will be credited back to your account.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)"
              className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              rows={3}
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-500"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-md"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
