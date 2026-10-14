import React, { useEffect, useState } from "react";
import {
  RotateCcw,
  ExternalLink,
  Sliders,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { roomService } from "../../services";
import {
  totalRoomsSettingsService,
  getLocalOverride,
  type TotalRoomsOverrideConfig,
} from "../../services/totalRoomsSettings.service";
import { useNotifications } from "../../contexts/NotificationContext";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";

interface CardFieldDef {
  key: keyof Omit<TotalRoomsOverrideConfig, "enabled" | "updatedAt">;
  label: string;
  hint: string;
  description: string;
}

const CARD_FIELDS: CardFieldDef[] = [
  {
    key: "totalRooms",
    label: "Total rooms",
    hint: "Tirvona plus offline units",
    description: "Combined aggregate of all online and offline room inventory.",
  },
  {
    key: "registeredRooms",
    label: "Registered rooms",
    hint: "Units on room categories",
    description: "Physical room inventory registered across all stays.",
  },
  {
    key: "onlineRooms",
    label: "Tirvona rooms",
    hint: "Sellable on this night",
    description: "Active units allocated for Tirvona online booking pool.",
  },
  {
    key: "offlineRooms",
    label: "Offline rooms",
    hint: "Held back for the desk",
    description: "Units reserved at reception for walk-ins and desk check-ins.",
  },
  {
    key: "availableRooms",
    label: "Available rooms",
    hint: "Free to sell tonight",
    description: "Rooms unbooked and ready for immediate guest reservations.",
  },
  {
    key: "bookedRooms",
    label: "Booked rooms",
    hint: "Reserved for this night",
    description: "Rooms confirmed and reserved for the chosen date.",
  },
  {
    key: "occupiedRooms",
    label: "Occupied rooms",
    hint: "Guests in-house now",
    description: "Rooms currently occupied by checked-in pilgrims and guests.",
  },
  {
    key: "blockedRooms",
    label: "Blocked rooms",
    hint: "Maintenance or closed",
    description: "Units temporarily out of service or under maintenance.",
  },
  {
    key: "heldRooms",
    label: "Held rooms",
    hint: "In checkout, not yet paid",
    description: "Units locked temporarily during an active checkout session.",
  },
];

export const TotalRoomsSettingsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  // Actual database figures (for reference & placeholder)
  const [actualTotals, setActualTotals] = useState<Record<string, number>>({});

  // Input states for the 9 cards
  const [cardValues, setCardValues] = useState<Record<string, string>>({
    totalRooms: "",
    registeredRooms: "",
    onlineRooms: "",
    offlineRooms: "",
    availableRooms: "",
    bookedRooms: "",
    occupiedRooms: "",
    blockedRooms: "",
    heldRooms: "",
  });

  // Helper to convert inputs into override payload
  const buildPayload = (cards: Record<string, string>): TotalRoomsOverrideConfig => {
    const parseNum = (v: string | undefined): number | null => {
      if (v === undefined || v === null) return null;
      const trimmed = String(v).trim();
      if (trimmed === "") return null;
      const num = Number(trimmed);
      return Number.isFinite(num) ? Math.max(0, num) : null;
    };

    const hasAnyCustom = Object.entries(cards).some(
      ([_, v]) => (v ?? "").trim() !== "",
    );

    return {
      enabled: hasAnyCustom,
      totalRooms: parseNum(cards.totalRooms),
      registeredRooms: parseNum(cards.registeredRooms),
      onlineRooms: parseNum(cards.onlineRooms),
      offlineRooms: parseNum(cards.offlineRooms),
      availableRooms: parseNum(cards.availableRooms),
      bookedRooms: parseNum(cards.bookedRooms),
      occupiedRooms: parseNum(cards.occupiedRooms),
      blockedRooms: parseNum(cards.blockedRooms),
      heldRooms: parseNum(cards.heldRooms),
    };
  };

  // Load saved local override on mount
  useEffect(() => {
    const cfg = getLocalOverride();
    if (cfg) {
      setCardValues({
        totalRooms: cfg.totalRooms != null ? String(cfg.totalRooms) : "",
        registeredRooms: cfg.registeredRooms != null ? String(cfg.registeredRooms) : "",
        onlineRooms: cfg.onlineRooms != null ? String(cfg.onlineRooms) : "",
        offlineRooms: cfg.offlineRooms != null ? String(cfg.offlineRooms) : "",
        availableRooms: cfg.availableRooms != null ? String(cfg.availableRooms) : "",
        bookedRooms: cfg.bookedRooms != null ? String(cfg.bookedRooms) : "",
        occupiedRooms: cfg.occupiedRooms != null ? String(cfg.occupiedRooms) : "",
        blockedRooms: cfg.blockedRooms != null ? String(cfg.blockedRooms) : "",
        heldRooms: cfg.heldRooms != null ? String(cfg.heldRooms) : "",
      });
    }

    // Quietly load actual counts for placeholders (without throwing any errors)
    const todayStr = new Date().toISOString().slice(0, 10);
    roomService
      .summary({ date: todayStr })
      .then((res) => {
        const t = res?.data?.data?.totals;
        if (t) {
          setActualTotals({
            totalRooms: t.totalRooms ?? 0,
            registeredRooms: t.registeredRooms ?? 0,
            onlineRooms: t.onlineRooms ?? 0,
            offlineRooms: t.offlineRooms ?? 0,
            availableRooms: t.availableRooms ?? 0,
            bookedRooms: t.bookedRooms ?? 0,
            occupiedRooms: t.occupiedRooms ?? 0,
            blockedRooms: t.blockedRooms ?? 0,
            heldRooms: t.heldRooms ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Feature 1: Edit - Handler for card input changes (with instant auto-save)
  const handleCardChange = (key: string, val: string) => {
    const next = { ...cardValues, [key]: val };
    setCardValues(next);
    const payload = buildPayload(next);
    totalRoomsSettingsService.saveOverride(payload);
  };

  // Feature 1: Live - Save and go directly to main Total Rooms page
  const handleGoLive = () => {
    const payload = buildPayload(cardValues);
    totalRoomsSettingsService.saveOverride(payload);
    navigate("/admin/manage/rooms/total");
  };

  // Feature 2: Reset - Clear all custom values and restore actual database figures
  const handleReset = () => {
    totalRoomsSettingsService.resetOverride();
    setCardValues({
      totalRooms: "",
      registeredRooms: "",
      onlineRooms: "",
      offlineRooms: "",
      availableRooms: "",
      bookedRooms: "",
      occupiedRooms: "",
      blockedRooms: "",
      heldRooms: "",
    });
    addNotification(
      "Reset to Actual Data",
      "All card overrides have been removed. Total Rooms page will now show actual database counts.",
      "success",
    );
  };

  const hasAnyCustomValue = Object.values(cardValues).some(
    (v) => (v ?? "").trim() !== "",
  );

  const cardStyle =
    "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]";

  return (
    <div className="space-y-6 w-full text-left">
      <EnterprisePageHeader
        title="Total Rooms Settings"
        subtitle="Edit room numbers for any card, or click Reset to display actual database counts on the Total Rooms page."
        icon={<Sliders size={22} />}
        badgeText={hasAnyCustomValue ? "Custom Values Active" : "Showing Actual Data"}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-black transition"
            >
              <RotateCcw size={14} />
              Reset to Actual Data
            </button>
            <button
              type="button"
              onClick={handleGoLive}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#F28C28] hover:bg-[#e07d1a] text-white text-xs font-black shadow-md shadow-[#F28C28]/20 transition"
            >
              <ExternalLink size={14} />
              View Live Page
            </button>
          </div>
        }
      />

      {/* 9 Editable Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARD_FIELDS.map((field) => {
          const actualVal = actualTotals[field.key] ?? 0;
          const rawInput = cardValues[field.key] ?? "";
          const isCustom = rawInput.trim() !== "";

          return (
            <div
              key={field.key}
              className={`${cardStyle} p-5 flex flex-col justify-between transition-all hover:border-[#F28C28]/40 ${
                isCustom
                  ? "ring-1 ring-[#F28C28]/40 bg-amber-500/[0.02]"
                  : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase font-black text-gray-500 tracking-wider">
                    {field.label}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      isCustom
                        ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700"
                    }`}
                  >
                    {isCustom ? "Custom" : `Actual: ${actualVal}`}
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  {field.hint}
                </p>

                <div className="mt-4">
                  <label className="text-[10px] uppercase font-black text-gray-400 mb-1 block">
                    Custom Number
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={rawInput}
                      onChange={(e) => handleCardChange(field.key, e.target.value)}
                      placeholder={`Actual: ${actualVal}`}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-base font-black text-[#0B192C] dark:text-white focus:outline-none focus:border-[#F28C28] transition"
                    />
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleCardChange(field.key, "")}
                        title="Clear custom value and use actual"
                        className="px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-400 hover:text-red-500 hover:border-red-300 transition text-xs font-bold shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-gray-400 font-semibold truncate max-w-[200px]">
                  {field.description}
                </span>
                {isCustom ? (
                  <span className="text-[#F28C28] font-black">
                    Live: {rawInput}
                  </span>
                ) : (
                  <span className="text-gray-400 font-medium italic">
                    Actual: {actualVal}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar with Edit & Reset features */}
      <div className={`${cardStyle} p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg sticky bottom-4 z-20`}>
        <div className="text-xs text-gray-500 font-medium">
          {hasAnyCustomValue ? (
            <span className="text-[#F28C28] font-bold flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Custom card numbers are active. Click "View Live Page" to see them on Total Rooms.
            </span>
          ) : (
            <span className="text-gray-400">
              Showing actual database data. Enter numbers in any card to display custom figures.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-black transition"
          >
            <RotateCcw size={14} />
            Reset to Actual Data
          </button>
          <button
            type="button"
            onClick={handleGoLive}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#F28C28] hover:bg-[#e07d1a] text-white text-xs font-black shadow-lg shadow-[#F28C28]/25 transition"
          >
            <ExternalLink size={15} />
            View Live Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default TotalRoomsSettingsPage;
