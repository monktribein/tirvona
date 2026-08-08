import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Building2,
  IndianRupee,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Wallet,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseStatsCard } from "../../shared/components/EnterpriseStatsCard";
import { EnterpriseStatusBadge } from "../../shared/components/EnterpriseStatusBadge";
import { useNotifications } from "../../../contexts/NotificationContext";
import { getErrorMessage } from "../../../lib/api";
import { parkingAdminService } from "../../../modules/parking/services/parking.service";

/**
 * Parking Control Center.
 *
 * The generic admin console at /admin/manage/parking_* lists and searches every
 * parking table, but it can only $set fields. The actions here are workflow
 * transitions with side effects the console deliberately cannot express:
 * approving a partner verifies it and un-suspends its locations, suspending one
 * cascades to every location it owns, settling writes a payout batch across many
 * commission rows, and a refund cancels the booking and releases its slot.
 */

type Tab = "overview" | "partners" | "locations" | "commissions";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "partners", label: "Partners" },
  { key: "locations", label: "Locations" },
  { key: "commissions", label: "Commissions & Payouts" },
];

const money = (value: unknown): string =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const PARTNER_ACTIONS: {
  status: string;
  label: string;
  icon: React.ReactNode;
  tone: string;
  confirm: string;
}[] = [
  {
    status: "active",
    label: "Approve",
    icon: <CheckCircle2 size={13} />,
    tone: "bg-emerald-600 hover:bg-emerald-700 text-white",
    confirm:
      "Approve this partner? It is marked verified and can publish parking locations.",
  },
  {
    status: "suspended",
    label: "Suspend",
    icon: <PauseCircle size={13} />,
    tone: "bg-amber-500 hover:bg-amber-600 text-white",
    confirm:
      "Suspend this partner? Every ACTIVE location it owns is suspended too and stops accepting bookings.",
  },
  {
    status: "rejected",
    label: "Reject",
    icon: <XCircle size={13} />,
    tone: "bg-rose-600 hover:bg-rose-700 text-white",
    confirm: "Reject this partner application?",
  },
];

export const ParkingControlCenterPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [analytics, setAnalytics] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Each panel is independent, so one failing endpoint should not blank the
      // whole page — settle for what resolved and report the rest.
      const [analyticsRes, partnersRes, locationsRes, commissionsRes] =
        await Promise.allSettled([
          parkingAdminService.analytics(),
          parkingAdminService.listPartners({ limit: 100 }),
          parkingAdminService.listLocations({ limit: 100 }),
          parkingAdminService.listCommissions({
            settlementStatus: "pending",
            limit: 100,
          }),
        ]);

      // Clear a section that failed instead of leaving its previous response on
      // screen beside an error — stale rows next to a red banner read as live
      // data, and name every call that broke rather than only the first.
      setAnalytics(
        analyticsRes.status === "fulfilled"
          ? (analyticsRes.value.data?.data ?? null)
          : null,
      );
      setPartners(
        partnersRes.status === "fulfilled"
          ? (partnersRes.value.data?.data ?? [])
          : [],
      );
      setLocations(
        locationsRes.status === "fulfilled"
          ? (locationsRes.value.data?.data ?? [])
          : [],
      );
      setCommissions(
        commissionsRes.status === "fulfilled"
          ? (commissionsRes.value.data?.data ?? [])
          : [],
      );

      const failures = [
        ["Analytics", analyticsRes],
        ["Partners", partnersRes],
        ["Locations", locationsRes],
        ["Commissions", commissionsRes],
      ]
        .filter(
          ([, r]) => (r as PromiseSettledResult<unknown>).status === "rejected",
        )
        .map(
          ([name, r]) =>
            `${name}: ${getErrorMessage((r as PromiseRejectedResult).reason)}`,
        );
      if (failures.length) setError(failures.join(" · "));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (
    id: string,
    action: () => Promise<any>,
    successTitle: string,
  ) => {
    setBusyId(id);
    try {
      const res = await action();
      addNotification(
        successTitle,
        res?.data?.message || "Done.",
        res?.data?.success === false ? "error" : "success",
      );
      await load();
    } catch (err) {
      addNotification("Action Failed", getErrorMessage(err), "error");
    } finally {
      setBusyId("");
    }
  };

  const setPartnerStatus = (partner: any, status: string, confirm: string) => {
    if (!window.confirm(confirm)) return;
    const rejectionReason =
      status === "rejected"
        ? window.prompt("Reason for rejection (shown to the partner):") || ""
        : undefined;
    return run(
      partner._id,
      () =>
        parkingAdminService.updatePartnerStatus(partner._id, {
          status,
          ...(rejectionReason !== undefined ? { rejectionReason } : {}),
        }),
      "Partner Updated",
    );
  };

  const setLocationStatus = (location: any, status: string) =>
    run(
      location._id,
      () => parkingAdminService.updateLocationStatus(location._id, { status }),
      "Parking Updated",
    );

  const toggleLocationFlag = (location: any, key: string) =>
    run(
      location._id,
      () =>
        parkingAdminService.updateLocationStatus(location._id, {
          [key]: !location[key],
        }),
      "Parking Updated",
    );

  // Commission rows are settled per partner, so group the pending ones and show
  // what a payout would actually release before it is triggered.
  const payoutsByPartner = useMemo(() => {
    const groups = new Map<
      string,
      { partnerId: string; name: string; count: number; earning: number }
    >();
    for (const row of commissions) {
      const partner = row.partnerId;
      const id = String(partner?._id ?? partner ?? "");
      if (!id) continue;
      const entry = groups.get(id) ?? {
        partnerId: id,
        name: partner?.businessName || "Unknown partner",
        count: 0,
        earning: 0,
      };
      entry.count += 1;
      entry.earning += Number(row.partnerEarning ?? 0);
      groups.set(id, entry);
    }
    return [...groups.values()].sort((a, b) => b.earning - a.earning);
  }, [commissions]);

  const pendingPartners = partners.filter((p) => p.status === "pending").length;
  const totals = analytics?.totals ?? {};

  const settle = (group: { partnerId: string; name: string; earning: number }) => {
    if (
      !window.confirm(
        `Settle ${money(group.earning)} to ${group.name}? This marks every pending commission as settled under one payout batch and cannot be undone from this screen.`,
      )
    )
      return;
    return run(
      group.partnerId,
      () => parkingAdminService.settleCommissions(group.partnerId),
      "Payout Settled",
    );
  };

  const card = "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";
  const th =
    "text-left px-4 py-3 text-[11px] font-black tracking-wider text-gray-400";
  const td = "px-4 py-3 text-sm text-[#0B192C] dark:text-slate-200";

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title="Parking Control Center"
        subtitle="Partner approvals, location status, payouts and platform analytics. Listings and search live under Parking Management."
        icon={<Car size={22} />}
        badgeText="Super Admin"
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-full text-gray-500 cursor-pointer transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-[#0A4DA6]" : ""} />
          </button>
        }
      />

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      <div className={`${card} p-2 flex flex-wrap gap-1`}>
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === item.key
                ? "bg-[#0A4DA6] text-white"
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-900"
            }`}
          >
            {item.label}
            {item.key === "partners" && pendingPartners > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                {pendingPartners}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && !analytics ? (
        <div className={`${card} p-12 flex items-center justify-center gap-3`}>
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">
            Loading parking data…
          </span>
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <EnterpriseStatsCard
                  title="Parking Locations"
                  value={totals.locations ?? 0}
                  description={`${totals.activeLocations ?? 0} active`}
                  icon={<Car size={19} />}
                />
                <EnterpriseStatsCard
                  title="Partners"
                  value={totals.partners ?? 0}
                  description={`${pendingPartners} awaiting approval`}
                  icon={<Building2 size={19} />}
                  badgeText={pendingPartners > 0 ? "Action needed" : undefined}
                  badgeColor="bg-amber-100 text-amber-800 border-amber-200"
                />
                <EnterpriseStatsCard
                  title="Pending Payouts"
                  value={money(
                    payoutsByPartner.reduce((sum, g) => sum + g.earning, 0),
                  )}
                  description={`${commissions.length} unsettled booking(s)`}
                  icon={<Wallet size={19} />}
                />
                <EnterpriseStatsCard
                  title="Bookings"
                  value={analytics?.totalBookings ?? analytics?.bookings ?? 0}
                  description="Across all locations"
                  icon={<ShieldCheck size={19} />}
                />
              </div>

              {analytics?.ledger && (
                <div className={`${card} p-6 space-y-4`}>
                  <h3 className="text-sm font-black tracking-wider text-gray-400">
                    Ledger by Transaction Type
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {Object.entries(analytics.ledger).map(
                      ([type, value]: [string, any]) => (
                        <div
                          key={type}
                          className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800"
                        >
                          <span className="text-[11px] font-black tracking-wider text-gray-400 block">
                            {type}
                          </span>
                          <span className="text-lg font-black text-[#0B192C] dark:text-white">
                            {money(value?.total)}
                          </span>
                          <span className="text-xs text-gray-400 font-semibold block">
                            {value?.count ?? 0} entries
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "partners" && (
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-gray-50 dark:bg-slate-900/60">
                    <tr>
                      <th className={th}>Business</th>
                      <th className={th}>Code</th>
                      <th className={th}>Contact</th>
                      <th className={th}>Commission</th>
                      <th className={th}>Status</th>
                      <th className={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {partners.map((partner) => (
                      <tr key={partner._id}>
                        <td className={`${td} font-bold`}>
                          {partner.businessName}
                          <span className="block text-xs text-gray-400 font-semibold">
                            {partner.address?.city || "—"}
                          </span>
                        </td>
                        <td className={td}>{partner.partnerCode}</td>
                        <td className={td}>
                          {partner.contactPhone || "—"}
                          <span className="block text-xs text-gray-400">
                            {partner.contactEmail || ""}
                          </span>
                        </td>
                        <td className={td}>
                          {partner.commissionPercent == null
                            ? "Platform default"
                            : `${partner.commissionPercent}%`}
                        </td>
                        <td className={td}>
                          <EnterpriseStatusBadge status={partner.status} />
                        </td>
                        <td className={td}>
                          <div className="flex flex-wrap gap-1.5">
                            {PARTNER_ACTIONS.filter(
                              (action) => action.status !== partner.status,
                            ).map((action) => (
                              <button
                                key={action.status}
                                disabled={busyId === partner._id}
                                onClick={() =>
                                  setPartnerStatus(
                                    partner,
                                    action.status,
                                    action.confirm,
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${action.tone}`}
                              >
                                {action.icon}
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!partners.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-sm font-bold text-gray-400"
                        >
                          No parking partners registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "locations" && (
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-gray-50 dark:bg-slate-900/60">
                    <tr>
                      <th className={th}>Parking</th>
                      <th className={th}>Partner</th>
                      <th className={th}>Capacity</th>
                      <th className={th}>Status</th>
                      <th className={th}>Flags</th>
                      <th className={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {locations.map((location) => (
                      <tr key={location._id}>
                        <td className={`${td} font-bold`}>
                          {location.name}
                          <span className="block text-xs text-gray-400 font-semibold">
                            {location.address?.city || "—"}
                          </span>
                        </td>
                        <td className={td}>
                          {location.partnerId?.businessName || "—"}
                        </td>
                        <td className={td}>{location.totalCapacity ?? 0}</td>
                        <td className={td}>
                          <EnterpriseStatusBadge status={location.status} />
                        </td>
                        <td className={td}>
                          <div className="flex gap-1.5">
                            {(["isVerified", "isFeatured"] as const).map(
                              (flag) => (
                                <button
                                  key={flag}
                                  disabled={busyId === location._id}
                                  onClick={() =>
                                    toggleLocationFlag(location, flag)
                                  }
                                  className={`px-2 py-1 rounded-lg text-[11px] font-black border disabled:opacity-50 ${
                                    location[flag]
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-gray-50 text-gray-400 border-gray-200"
                                  }`}
                                >
                                  {flag === "isVerified"
                                    ? "Verified"
                                    : "Featured"}
                                </button>
                              ),
                            )}
                          </div>
                        </td>
                        <td className={td}>
                          <select
                            disabled={busyId === location._id}
                            value={location.status}
                            onChange={(event) =>
                              setLocationStatus(location, event.target.value)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold disabled:opacity-50"
                          >
                            {[
                              "draft",
                              "pending",
                              "active",
                              "inactive",
                              "suspended",
                            ].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!locations.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-sm font-bold text-gray-400"
                        >
                          No parking locations yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "commissions" && (
            <div className={`${card} overflow-hidden`}>
              <div className="p-5 border-b border-gray-100 dark:border-slate-800">
                <h3 className="text-sm font-black tracking-wider text-gray-400">
                  Pending Payouts by Partner
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-1">
                  Settling marks every pending commission for that partner as
                  settled under one payout batch reference.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50 dark:bg-slate-900/60">
                    <tr>
                      <th className={th}>Partner</th>
                      <th className={th}>Unsettled Bookings</th>
                      <th className={th}>Amount Due</th>
                      <th className={th}>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {payoutsByPartner.map((group) => (
                      <tr key={group.partnerId}>
                        <td className={`${td} font-bold`}>{group.name}</td>
                        <td className={td}>{group.count}</td>
                        <td className={`${td} font-black`}>
                          {money(group.earning)}
                        </td>
                        <td className={td}>
                          <button
                            disabled={busyId === group.partnerId}
                            onClick={() => settle(group)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A4DA6] text-white text-xs font-bold hover:bg-[#083d85] disabled:opacity-50"
                          >
                            <IndianRupee size={13} />
                            Settle Payout
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!payoutsByPartner.length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-12 text-center text-sm font-bold text-gray-400"
                        >
                          Nothing pending settlement.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ParkingControlCenterPage;
