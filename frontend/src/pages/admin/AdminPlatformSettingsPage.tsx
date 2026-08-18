import React, { useState, useEffect } from "react";
import { platformSettingsService } from "../../services";
import { formatCurrency, roundMoney } from "../../utils/format";
import { useNotifications } from "../../contexts/NotificationContext";
import {
  DollarSign,
  Percent,
  Save,
  Calculator,
  ToggleLeft,
  ToggleRight,
  Info,
  Check,
  AlertTriangle,
} from "lucide-react";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";
import {
  DEFAULT_PLATFORM_FEE_SCOPES,
  PLATFORM_FEE_SCOPE_OPTIONS,
  platformFeeScopesOf,
  type PlatformFeeScope,
} from "../../constants/platformFee";

interface PlatformFeeConfig {
  enabled: boolean;
  type: "flat" | "percentage";
  value: number;
  label: string;
  appliesTo: PlatformFeeScope[];
}

export const AdminPlatformSettingsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [platformFee, setPlatformFee] = useState<PlatformFeeConfig>({
    enabled: true,
    type: "flat",
    value: 49,
    label: "Tirvona Platform Fee",
    appliesTo: DEFAULT_PLATFORM_FEE_SCOPES,
  });
  // GST charged on the platform fee. The stay is never taxed, so this is the
  // only rate that reaches a booking total.
  const [platformFeeGstRate, setPlatformFeeGstRate] = useState<number>(18);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await platformSettingsService.getSettings();
      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        if (data.platformFee)
          // A row saved before `appliesTo` existed carries none, and spreading
          // it raw would leave the control unchecked — reading back as "levy
          // nowhere" for a platform that is in fact charging on stays.
          setPlatformFee({
            ...data.platformFee,
            appliesTo: platformFeeScopesOf(data.platformFee),
          });
        if (data.platformFeeGstRate !== undefined)
          setPlatformFeeGstRate(data.platformFeeGstRate);
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
      addNotification("Failed to load platform settings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Sent field by field rather than spreading `platformFee`. The state is
      // seeded from the server response, so spreading it would echo back any
      // extra key the API includes (_id, timestamps) — and the endpoint rejects
      // unknown properties outright, which fails the whole save.
      const res = await platformSettingsService.updateSettings({
        platformFee: {
          enabled: platformFee.enabled,
          type: platformFee.type,
          value: platformFee.value,
          label: platformFee.label,
          appliesTo: platformFee.appliesTo,
        },
        platformFeeGstRate,
      });
      if (res.data?.success) {
        // Re-seed from what the server actually stored, so the toggle can never
        // sit showing a state the database does not hold.
        if (res.data.data?.platformFee)
          setPlatformFee({
            ...res.data.data.platformFee,
            appliesTo: platformFeeScopesOf(res.data.data.platformFee),
          });
        if (res.data.data?.platformFeeGstRate !== undefined)
          setPlatformFeeGstRate(Number(res.data.data.platformFeeGstRate));
        addNotification(
          "Platform Fee Settings updated successfully!",
          "success",
        );
      }
    } catch (err: any) {
      console.error("Save settings error:", err);
      addNotification(
        err.response?.data?.message || "Failed to save settings.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleScope = (scope: PlatformFeeScope) =>
    setPlatformFee((p) => ({
      ...p,
      appliesTo: p.appliesTo.includes(scope)
        ? p.appliesTo.filter((s) => s !== scope)
        : [...p.appliesTo, scope],
    }));

  // The preview models an ashram stay, so it is gated on that scope for the
  // same reason the checkout is: a fee shown here that the booking page will
  // not charge is exactly the drift this screen exists to rule out.
  const chargesAshramStays =
    platformFee.enabled && platformFee.appliesTo.includes("ashram_booking");

  // Sample Live Preview calculations based on a ₹1,000 stay
  const sampleStayCost = 1000;
  const samplePlatformFee = !chargesAshramStays
    ? 0
    : platformFee.type === "percentage"
      ? Math.round((sampleStayCost * platformFee.value) / 100)
      : Math.round(platformFee.value);
  // Mirrors BookingPricingService.quote: GST applies to the fee, not the stay.
  const sampleGst = roundMoney((samplePlatformFee * platformFeeGstRate) / 100);
  const sampleTotal = roundMoney(
    sampleStayCost + samplePlatformFee + sampleGst,
  );

  return (
    <div className="space-y-6 text-left w-full">
      {/* Header */}
      <EnterprisePageHeader
        title="Platform Pricing & Fee Settings"
        subtitle="Configure the Tirvona Platform Fee (Flat ₹ or Percentage %) and tax rates applied across all booking checkouts."
        icon={<DollarSign size={22} />}
        badgeText="Fee Engine"
      />

      {loading ? (
        <div className="h-64 bg-gray-50 dark:bg-slate-900 rounded-3xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <form
            onSubmit={handleSave}
            className="lg:col-span-2 bg-white dark:bg-[#0B192C] p-6 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm space-y-6"
          >
            <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-850 pb-4">
              <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                Fee Engine Configuration
              </h3>

              <button
                type="button"
                onClick={() =>
                  setPlatformFee((p) => ({ ...p, enabled: !p.enabled }))
                }
                className="flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <span className="text-gray-400">Status:</span>
                {platformFee.enabled ? (
                  <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                    <ToggleRight size={26} /> Enabled
                  </span>
                ) : (
                  <span className="text-gray-400 font-bold flex items-center gap-1">
                    <ToggleLeft size={26} /> Disabled
                  </span>
                )}
              </button>
            </div>

            {/* Pricing Model Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold tracking-wider text-gray-400">
                Pricing Model
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPlatformFee((p) => ({ ...p, type: "flat" }))
                  }
                  className={`p-4 rounded-2xl border text-xs font-extrabold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${platformFee.type === "flat"
                    ? "bg-[#0A4DA6] text-white border-[#0A4DA6] shadow-md"
                    : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-[#0B192C] dark:text-gray-300"
                    }`}
                >
                  <DollarSign size={18} />
                  <span>Flat Fee (₹)</span>
                  <span className="text-[10px] font-medium opacity-80">
                    Fixed amount per booking (e.g. ₹29, ₹49, ₹99)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPlatformFee((p) => ({ ...p, type: "percentage" }))
                  }
                  className={`p-4 rounded-2xl border text-xs font-extrabold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${platformFee.type === "percentage"
                    ? "bg-[#0A4DA6] text-white border-[#0A4DA6] shadow-md"
                    : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-[#0B192C] dark:text-gray-300"
                    }`}
                >
                  <Percent size={18} />
                  <span>Percentage (%)</span>
                  <span className="text-[10px] font-medium opacity-80">
                    Percentage of stay cost (e.g. 2%)
                  </span>
                </button>
              </div>
            </div>

            {/* Value & Label Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-400">
                  {platformFee.type === "flat"
                    ? "Flat Fee Amount (₹) *"
                    : "Percentage Rate (%) *"}
                </label>
                <input
                  type="number"
                  min={0}
                  step={platformFee.type === "percentage" ? "0.1" : "1"}
                  required
                  value={platformFee.value}
                  onChange={(e) =>
                    setPlatformFee((p) => ({
                      ...p,
                      value: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-400">
                  Display Label *
                </label>
                <input
                  type="text"
                  required
                  value={platformFee.label}
                  onChange={(e) =>
                    setPlatformFee((p) => ({ ...p, label: e.target.value }))
                  }
                  className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>
            </div>

            {/* GST Rate */}
            <div className="space-y-1.5 text-xs font-semibold">
              <label className="text-[10px] font-extrabold text-gray-400">
                GST on platform fee (%)
              </label>
              <input
                type="number"
                min={0}
                max={28}
                value={platformFeeGstRate}
                onChange={(e) =>
                  setPlatformFeeGstRate(parseFloat(e.target.value) || 0)
                }
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
              />
            </div>

            {/* Which booking systems the fee is levied on */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400">
                  Applies To — Booking Systems
                </label>
                <span className="text-[10px] font-bold text-gray-400">
                  {platformFee.appliesTo.length} selected
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">
                Select every system this fee should be charged on. Multiple
                selections are allowed.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PLATFORM_FEE_SCOPE_OPTIONS.map((option) => {
                  const checked = platformFee.appliesTo.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleScope(option.value)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        checked
                          ? "bg-[#0A4DA6]/5 border-[#0A4DA6] shadow-sm dark:bg-[#0A4DA6]/20"
                          : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 w-4 h-4 shrink-0 rounded-[6px] border flex items-center justify-center ${
                            checked
                              ? "bg-[#0A4DA6] border-[#0A4DA6] text-white"
                              : "border-gray-300 dark:border-slate-700"
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3.5} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-extrabold text-[#0B192C] dark:text-white">
                            {option.label}
                          </span>
                          <span className="block text-[10px] font-medium text-gray-400 mt-0.5 leading-snug">
                            {option.description}
                          </span>
                          {!option.levied && (
                            <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[9px] font-extrabold tracking-wide">
                              NO FEE LEVIED YET
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {platformFee.enabled && platformFee.appliesTo.length === 0 && (
                <p className="flex items-start gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 pt-1">
                  <AlertTriangle size={12} className="mt-px shrink-0" />
                  No system selected — the fee engine is on, but nothing will be
                  charged anywhere.
                </p>
              )}
              {platformFee.appliesTo.some(
                (scope) =>
                  !PLATFORM_FEE_SCOPE_OPTIONS.find((o) => o.value === scope)
                    ?.levied,
              ) && (
                <p className="flex items-start gap-1.5 text-[10px] font-semibold text-gray-500 pt-1">
                  <Info size={12} className="mt-px shrink-0" />
                  Systems marked “no fee levied yet” do not charge a platform fee
                  today. Your selection is saved and will apply automatically
                  once a fee is introduced there.
                </p>
              )}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Save size={15} />
                {saving ? "Saving Settings…" : "Save Platform Settings"}
              </button>
            </div>
          </form>

          {/* Live Checkout Preview */}
          <div className="bg-white dark:bg-[#0B192C] p-6 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Calculator size={16} className="text-[#0A4DA6]" /> Live Checkout
              Breakdown
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 space-y-2.5 text-xs font-semibold">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Original Stay Cost:</span>
                <span>{formatCurrency(sampleStayCost)}</span>
              </div>

              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>GST ({platformFeeGstRate}% on platform fee):</span>
                <span>{formatCurrency(sampleGst)}</span>
              </div>

              <div className="flex justify-between text-[#0A4DA6] font-extrabold">
                <span>{platformFee.label || "Tirvona Platform Fee"}:</span>
                <span>
                  {formatCurrency(samplePlatformFee)}
                  {chargesAshramStays && platformFee.type === "percentage" && (
                    <span className="text-[10px] text-gray-400 font-normal ml-1">
                      ({platformFee.value}%)
                    </span>
                  )}
                </span>
              </div>

              {!chargesAshramStays && (
                <p className="text-[10px] font-semibold text-gray-400 pt-1">
                  {!platformFee.enabled
                    ? "Fee engine is disabled — no fee is charged on any booking."
                    : "Ashram Bookings is not selected — no fee is charged on stays."}
                </p>
              )}

              <div className="pt-2 border-t border-gray-200 dark:border-slate-800 flex justify-between text-sm font-black text-[#0B192C] dark:text-white">
                <span>Final Payable Amount:</span>
                <span className="text-[#0A4DA6] dark:text-blue-400">
                  {formatCurrency(sampleTotal)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-[10px] text-gray-500 font-semibold space-y-1">
              <p className="flex items-center gap-1 font-bold text-[#0A4DA6]">
                <Info size={12} /> Database Persistence
              </p>
              <p>
                Changes saved here take effect globally across all booking
                checkouts, invoices, and revenue reports instantly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlatformSettingsPage;
