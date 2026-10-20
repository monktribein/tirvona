import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  DollarSign,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { foodService } from "../../services/food.service";
import type { FoodOrder } from "../../services/food.service";

export const FoodAdminOperationsPage: React.FC = () => {
  const [exceptions, setExceptions] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"exceptions" | "settlements">("exceptions");

  // Commission override modal
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [newCommissionBps, setNewCommissionBps] = useState(1250);
  const [overrideReason, setOverrideReason] = useState("");
  const [payoutRef, setPayoutRef] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exc, stl] = await Promise.all([
        foodService.getAdminExceptions().catch(() => null),
        foodService.getFinanceSettlements().catch(() => []),
      ]);
      setExceptions(exc);
      setSettlements(stl);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSettlement = async (id: string) => {
    setActionLoading(true);
    try {
      await foodService.approveFinanceSettlement(id);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Approve failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaySettlement = async (id: string) => {
    if (!payoutRef.trim()) {
      alert("Please provide bank transaction reference");
      return;
    }
    setActionLoading(true);
    try {
      await foodService.payFinanceSettlement(id, payoutRef.trim());
      setPayoutRef("");
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Payout mark failed");
    } finally {
      setActionLoading(false);
    }
  };

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setActionLoading(true);
    try {
      await action();
      if (success) alert(success);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerate = () =>
    run(async () => {
      // Whole days, in local time, so the last day is included.
      const res = await foodService.generateFinanceSettlements(
        new Date(`${from}T00:00:00`).toISOString(),
        new Date(`${to}T23:59:59.999`).toISOString(),
      );
      alert(
        res.created
          ? `${res.created} new settlement(s) created for review.`
          : "Nothing new to settle in this period.",
      );
    });

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId || !overrideReason.trim()) return;
    setActionLoading(true);
    try {
      await foodService.updateOutletCommission(
        selectedOutletId,
        newCommissionBps,
        overrideReason.trim(),
      );
      alert("Commission terms updated and audited successfully");
      setOverrideReason("");
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Update failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-[#070F1B] text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
            Tirvona Food Module
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            Food Admin &amp; Finance Operations
          </h1>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("exceptions")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "exceptions"
                ? "bg-slate-900 dark:bg-amber-500 text-white shadow-sm"
                : "text-slate-500"
            }`}
          >
            Exceptions &amp; Timeouts
          </button>
          <button
            onClick={() => setActiveTab("settlements")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "settlements"
                ? "bg-slate-900 dark:bg-amber-500 text-white shadow-sm"
                : "text-slate-500"
            }`}
          >
            Finance &amp; Settlements
          </button>
        </div>

        {/* Tab 1: Exceptions */}
        {activeTab === "exceptions" && (
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Vendor SLA Timeouts &amp; Rejections Queue
            </h3>
            {exceptions?.vendorExceptions?.length === 0 ? (
              <p className="text-xs text-slate-400 p-8 text-center bg-white dark:bg-[#0B192C] rounded-3xl border border-slate-200 dark:border-slate-800">
                ✓ No active vendor SLA timeouts or operational exceptions.
              </p>
            ) : (
              exceptions?.vendorExceptions?.map((ord: any) => (
                <div
                  key={ord._id}
                  className="bg-white dark:bg-[#0B192C] p-4 rounded-2xl border border-red-200 dark:border-red-900/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-red-600">{ord.orderNumber}</span>
                    <span className="text-slate-500 ml-2">
                      {ord.outletId?.brandName} • Status: {ord.orderStatus}
                    </span>
                    {ord.rejectionReason && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Reason: {ord.rejectionReason}
                      </p>
                    )}
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    ₹{ord.totalRupees}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Finance & Settlements */}
        {activeTab === "settlements" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B192C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Partner Kitchen Settlements &amp; Audited Payouts
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Customers pay Tirvona on Razorpay. Each restaurant is paid its food value minus commission and GST on commission, directly to the bank account it added.
              </p>
              <p className="text-[11px] leading-relaxed p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                <strong>Paying a kitchen by hand (bank transfer, UPI or cash)?</strong> Record it in{" "}
                <Link to="/admin/food/wallets" className="font-extrabold underline">
                  Kitchen Wallets &amp; Payments
                </Link>{" "}
                with its receipt. A settlement marked paid here also counts there as money received, so do not pay the same orders both ways.
              </p>
              <div className="flex flex-wrap items-end gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                <label className="space-y-1">
                  <span className="block font-bold text-slate-500">From</span>
                  <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="px-2.5 py-1.5 rounded-lg border" />
                </label>
                <label className="space-y-1">
                  <span className="block font-bold text-slate-500">To</span>
                  <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="px-2.5 py-1.5 rounded-lg border" />
                </label>
                <button disabled={actionLoading} onClick={handleGenerate} className="px-4 py-2 rounded-full bg-slate-900 dark:bg-amber-500 text-white font-bold disabled:opacity-60">
                  Create settlements
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => run(async () => { const r = await foodService.syncFinancePayouts(); alert(`${r.synced} transfer(s) refreshed.`); })}
                  className="px-4 py-2 rounded-full border border-slate-300 font-bold disabled:opacity-60"
                >
                  Refresh bank transfer status
                </button>
              </div>
              {settlements.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No settlements yet. Pick the days to settle above; only completed, paid orders that were not settled before are included.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {settlements.map((s) => (
                    <div
                      key={s._id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {s.outletId?.brandName || "Outlet"}
                        </p>
                        <p className="text-slate-500">
                          Period: {new Date(s.periodStart).toLocaleDateString()} —{" "}
                          {new Date(s.periodEnd).toLocaleDateString()} • {s.orderCount} Orders
                        </p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Gross: ₹{s.grossFoodValuePaise / 100} • Comm ({s.commissionRateBps / 100}%): ₹{s.commissionAmountPaise / 100} • GST on comm: ₹{(s.taxOnCommissionPaise ?? 0) / 100}
                        </p>
                        <p className="text-[11px] mt-0.5">
                          {s.vendorId?.businessName}
                          {" • "}
                          {s.vendorId?.hasBankDetails ? (
                            <span className="text-emerald-600 font-bold">Bank details added</span>
                          ) : (
                            <span className="text-red-600 font-bold">No bank details yet</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            Net Payable
                          </span>
                          <span className="text-base font-black text-emerald-600">
                            ₹{s.netPayablePaise / 100}
                          </span>
                        </div>

                        {s.status === "pending_approval" && (
                          <button
                            onClick={() => handleApproveSettlement(s._id)}
                            className="px-4 py-2 rounded-full bg-blue-600 text-white font-bold"
                          >
                            Approve
                          </button>
                        )}

                        {s.status === "approved" &&
                          (String(s.payoutReference ?? "").startsWith("pout_") ? (
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                              Transfer in progress ({s.payoutReference})
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {String(s.payoutReference ?? "").startsWith("failed:") && (
                                <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-bold">
                                  Last transfer failed
                                </span>
                              )}
                              <button
                                disabled={actionLoading || !s.vendorId?.hasBankDetails}
                                title={s.vendorId?.hasBankDetails ? "" : "The restaurant has not added bank details"}
                                onClick={() =>
                                  window.confirm(`Send ₹${s.netPayablePaise / 100} to ${s.vendorId?.businessName}'s bank account now?`) &&
                                  run(() => foodService.payFinanceSettlementViaProvider(s._id), "Transfer started. Refresh the status in a moment.")
                                }
                                className="px-4 py-1.5 rounded-full bg-emerald-600 text-white font-bold disabled:opacity-50"
                              >
                                Pay via RazorpayX
                              </button>
                              <input
                                type="text"
                                value={payoutRef}
                                onChange={(e) => setPayoutRef(e.target.value)}
                                placeholder="or UTR of a manual transfer"
                                className="px-2.5 py-1.5 rounded-lg border text-xs"
                              />
                              <button
                                onClick={() => handlePaySettlement(s._id)}
                                className="px-3 py-1.5 rounded-full border border-slate-300 font-bold"
                              >
                                Mark Paid
                              </button>
                            </div>
                          ))}

                        {s.status === "paid" && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            Paid: {s.payoutReference}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
