import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Utensils,
  Clock,
  CheckCircle2,
  Power,
  RefreshCw,
  ShieldAlert,
  FileText,
  ExternalLink,
} from "lucide-react";
import { foodService } from "../../services/food.service";
import type { FoodOrder } from "../../services/food.service";
import { useMyRestaurant } from "../../modules/food/useMyRestaurant";
import { VendorStatusBanner } from "../../modules/food/foodUi";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";
import { Chips, Stat } from "../../modules/marketplace/ui";

export const FoodVendorDashboardPage: React.FC = () => {
  const { profile, state: profileState } = useMyRestaurant();
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "pending" | "kitchen" | "completed" | "menu" | "settlement"
  >("pending");

  // Rejection modal state
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => {
      loadDashboard(true);
    }, 15000); // 15s refresh for kitchen orders
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statsData, ordersData, outletsData, settlementsData] = await Promise.all([
        foodService.getVendorStats().catch(() => null),
        foodService.getVendorOrders().catch(() => []),
        foodService.getVendorOutlets().catch(() => []),
        foodService.getVendorSettlements().catch(() => []),
      ]);
      setStats(statsData);
      setOrders(ordersData);
      setOutlets(outletsData);
      setSettlements(settlementsData);
    } catch {
      // Ignore or log
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      await foodService.vendorAcceptOrder(orderId);
      loadDashboard(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Accept failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectOrderId || !rejectionReason.trim()) {
      alert("Please specify a reason for rejection");
      return;
    }
    setActionLoading(true);
    try {
      await foodService.vendorRejectOrder(rejectOrderId, rejectionReason.trim());
      setRejectOrderId(null);
      setRejectionReason("");
      loadDashboard(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Reject failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setActionLoading(true);
    try {
      await foodService.vendorUpdateStatus(orderId, status);
      loadDashboard(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleOutlet = async (outletId: string, isPaused: boolean) => {
    try {
      await foodService.toggleOutletPause(outletId, !isPaused);
      loadDashboard(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Toggle failed");
    }
  };

  // Filter orders by tab
  const pendingOrders = orders.filter((o) => o.orderStatus === "PAID_AWAITING_VENDOR");
  const kitchenOrders = orders.filter((o) =>
    ["ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "PICKED_UP"].includes(
      o.orderStatus,
    ),
  );
  const completedOrders = orders.filter((o) =>
    ["DELIVERED", "COMPLETED", "VENDOR_REJECTED", "VENDOR_TIMEOUT", "CANCELLED"].includes(
      o.orderStatus,
    ),
  );

  // No restaurant yet: send the owner to sign-up instead of an empty console.
  if (profileState === "ready" && !profile)
    return <Navigate to="/restaurant/profile" replace />;

  return (
    <div className="text-slate-900 dark:text-slate-100">
      <div className="space-y-5">
        <EnterprisePageHeader
          title={profile?.vendor.businessName ?? "Restaurant dashboard"}
          subtitle="Live kitchen orders, today's sales and your payouts."
          icon={<Utensils size={20} />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/food"
                className="px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 hover:border-[#F28C28] hover:text-[#F28C28] transition-colors"
              >
                View public Food page <ExternalLink size={12} />
              </Link>
              <button
                type="button"
                onClick={() => loadDashboard(true)}
                className="px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 hover:border-[#F28C28] transition-colors"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin text-[#F28C28]" : ""} />
                Refresh
              </button>
              {outlets.map((out) => (
                <button
                  type="button"
                  key={out._id ?? out.id}
                  onClick={() => handleToggleOutlet(out._id ?? out.id, out.isPaused)}
                  title={out.brandName}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold text-white inline-flex items-center gap-1.5 shadow-sm transition-colors ${
                    out.isPaused ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Power size={13} />
                  {outlets.length > 1 ? `${out.brandName}: ` : ""}
                  {out.isPaused ? "Kitchen CLOSED" : "Kitchen OPEN"}
                </button>
              ))}
            </div>
          }
        />

        {profile && <VendorStatusBanner status={profile.vendor.status} />}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat
            label="Awaiting your acceptance"
            value={stats?.pendingAcceptanceCount ?? pendingOrders.length}
            hint="Respond within 10 minutes"
            icon={<Clock size={16} />}
            tone={(stats?.pendingAcceptanceCount ?? pendingOrders.length) > 0 ? "warn" : undefined}
          />
          <Stat
            label="In kitchen"
            value={stats?.preparingCount ?? kitchenOrders.length}
            hint="Accepted and being prepared"
            icon={<Utensils size={16} />}
          />
          <Stat
            label="Food value completed"
            value={`₹${stats?.totalSalesRupees ?? 0}`}
            hint="Before commission"
            icon={<CheckCircle2 size={16} />}
            tone="ok"
          />
          <Stat
            label="Estimated payout"
            value={`₹${stats?.estimatedSettlementRupees ?? 0}`}
            hint="After commission"
            icon={<FileText size={16} />}
          />
        </div>

        <Chips
          value={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
          options={[
            { value: "pending", label: `Incoming (${pendingOrders.length})` },
            { value: "kitchen", label: `In kitchen (${kitchenOrders.length})` },
            { value: "completed", label: `History (${completedOrders.length})` },
            { value: "settlement", label: "Payouts" },
          ]}
        />

        {/* Tab 1: Incoming Orders Queue (Pending acceptance) */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No pending incoming orders
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  New orders from pilgrims will appear here immediately with an audio chime and 10-minute acceptance timer.
                </p>
              </div>
            ) : (
              pendingOrders.map((ord) => (
                <div
                  key={ord._id}
                  className="bg-white dark:bg-[#0B192C] p-6 rounded-3xl border-2 border-amber-400 dark:border-amber-600/60 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-white">
                        {ord.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock size={13} /> Respond within 10 mins
                      </span>
                    </div>

                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      Customer: {ord.customerName} • {ord.customerPhone}
                    </p>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                      {ord.items?.map((it) => (
                        <div key={it._id} className="flex justify-between font-semibold">
                          <span>
                            {it.quantity}x {it.name}
                          </span>
                          <span className="font-bold">₹{it.totalPriceRupees}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500 font-semibold">
                      Fulfilment: <strong>{ord.fulfilmentType}</strong> • Dest: {ord.deliveryAddress || ord.stayRoomNumber || "Counter pickup"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setRejectOrderId(ord._id)}
                      className="px-5 py-2.5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold"
                    >
                      Reject Order
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleAcceptOrder(ord._id)}
                      className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md"
                    >
                      Accept &amp; Cook
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: In-Kitchen Queue */}
        {activeTab === "kitchen" && (
          <div className="space-y-4">
            {kitchenOrders.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#0B192C] rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
                <Utensils className="mx-auto text-slate-400 mb-2" size={32} />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No active orders cooking right now
                </h3>
              </div>
            ) : (
              kitchenOrders.map((ord) => (
                <div
                  key={ord._id}
                  className="bg-white dark:bg-[#0B192C] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white">
                        {ord.orderNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {ord.orderStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {ord.customerName} • {ord.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {ord.orderStatus === "ACCEPTED" && (
                      <button
                        onClick={() => handleUpdateStatus(ord._id, "PREPARING")}
                        className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        Start Cooking
                      </button>
                    )}
                    {ord.orderStatus === "PREPARING" && (
                      <button
                        onClick={() => handleUpdateStatus(ord._id, "READY")}
                        className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
                      >
                        Mark Ready for Dispatch
                      </button>
                    )}
                    {ord.orderStatus === "READY" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(
                            ord._id,
                            ord.fulfilmentType === "pickup" ? "COMPLETED" : "OUT_FOR_DELIVERY",
                          )
                        }
                        className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        {ord.fulfilmentType === "pickup" ? "Customer Picked Up" : "Out for Delivery"}
                      </button>
                    )}
                    {ord.orderStatus === "OUT_FOR_DELIVERY" && (
                      <button
                        onClick={() => handleUpdateStatus(ord._id, "DELIVERED")}
                        className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Completed / History */}
        {activeTab === "completed" && (
          <div className="space-y-3">
            {completedOrders.map((ord) => (
              <div
                key={ord._id}
                className="bg-white dark:bg-[#0B192C] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {ord.orderNumber}
                  </span>
                  <span className="text-slate-500 ml-2">
                    {new Date(ord.createdAt).toLocaleDateString()} • {ord.customerName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900 dark:text-white">
                    ₹{ord.totalRupees}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ord.orderStatus === "COMPLETED" || ord.orderStatus === "DELIVERED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {ord.orderStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Settlements & Payouts */}
        {activeTab === "settlement" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0B192C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                How you get paid
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Customers pay Tirvona on Razorpay. After each settlement, Tirvona sends your food value, minus commission and GST on commission, straight to your bank account.
              </p>
              {profile && !profile.vendor.hasBankDetails && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-3">
                  <span className="font-bold">Add your bank account to receive payouts.</span>
                  <Link to="/restaurant/profile" className="shrink-0 px-4 py-2 rounded-full bg-amber-500 text-white font-extrabold">
                    Add bank details
                  </Link>
                </div>
              )}
              {profile?.vendor.hasBankDetails && (
                <p className="text-xs font-bold text-emerald-600">
                  Payouts go to the account ending {profile.vendor.bankAccountLast4}.
                </p>
              )}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex justify-between">
                  <span>Platform commission</span>
                  <span className="font-bold">
                    {outlets[0]?.commissionRateBps ? outlets[0].commissionRateBps / 100 : 12.5}% of food value
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total food value completed</span>
                  <span className="font-bold text-emerald-600">₹{stats?.totalSalesRupees ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated net payable</span>
                  <span className="font-bold text-amber-600">₹{stats?.estimatedSettlementRupees ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B192C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3">
                Settlements &amp; payouts
              </h3>
              {settlements.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No settlements yet. Tirvona creates one for each period after your orders are completed.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {settlements.map((st) => (
                    <div key={st._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {new Date(st.periodStart).toLocaleDateString()} – {new Date(st.periodEnd).toLocaleDateString()}
                          <span className="text-slate-400 font-medium"> • {st.orderCount} orders • {st.outletId?.brandName}</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Food ₹{st.grossFoodValuePaise / 100} − commission ₹{st.commissionAmountPaise / 100} − GST ₹{(st.taxOnCommissionPaise ?? 0) / 100}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black text-emerald-600">₹{st.netPayablePaise / 100}</span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            st.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : st.status === "approved"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {st.status === "paid"
                            ? "Paid"
                            : st.status === "approved"
                              ? "Approved, transfer pending"
                              : "Under review"}
                        </span>
                      </div>
                      {st.status === "paid" && st.payoutReference && (
                        <p className="text-[10px] text-slate-400 sm:basis-full">Bank reference: {st.payoutReference}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectOrderId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B192C] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <ShieldAlert size={22} />
              <h3 className="text-base font-extrabold">Reject Order</h3>
            </div>
            <p className="text-xs text-slate-500">
              Please provide a valid kitchen reason. This initiates an immediate full refund to the customer.
            </p>
            <textarea
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Kitchen item ran out, closing early for temple arti, outside capacity"
              className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectOrderId(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRejectOrder}
                className="px-5 py-2 rounded-full bg-red-600 text-white text-xs font-bold"
              >
                Confirm Rejection &amp; Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
