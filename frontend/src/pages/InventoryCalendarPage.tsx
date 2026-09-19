import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Calendar as CalendarIcon,
  CalendarCheck,
  Sparkles,
  Edit2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService, roomService } from "../services";
import { getErrorMessage } from "../lib/api";
import { formatCurrency } from "../utils/format";
import { useAshramSelection, ALL_ASHRAMS } from "../hooks/useAshramSelection";

const ROOM_STORAGE_KEY = "tirvona:inventory-room";

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const InventoryCalendarPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const getTodayDateStr = () => formatLocalDate(new Date());
  const todayStr = useMemo(() => getTodayDateStr(), []);

  // 7-day rolling window centered around centerDate
  const [centerDate, setCenterDate] = useState<string>(getTodayDateStr());
  const [searchDateInput, setSearchDateInput] = useState<string>("");

  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Daily Rate & Maintenance Override State
  const [showOverride, setShowOverride] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [maintenanceCount, setMaintenanceCount] = useState("0");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const notifyRef = useRef(addNotification);
  notifyRef.current = addNotification;

  const {
    ashrams: myAshrams,
    selectedAshramId,
    setSelectedAshramId,
    loadingAshrams,
    targetAshrams,
    isAllSelected,
  } = useAshramSelection({
    storageKey: "tirvona:inventory-ashram-filter",
    allowAll: true,
    onError: (err) =>
      notifyRef.current(
        "Load Failed",
        getErrorMessage(err, "Unable to load your ashrams."),
        "error",
      ),
  });

  // Max 90-day booking window boundary calculation
  const maxSearchDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return formatLocalDate(d);
  }, []);

  const minSearchDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatLocalDate(d);
  }, []);

  // 7-Day Rolling Window
  const sevenDays = useMemo(() => {
    const base = new Date(`${centerDate}T00:00:00`);
    const list = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = formatLocalDate(d);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNumber = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      const fullDateStr = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const item = calendar.find((c) => c.date === dateStr);

      list.push({
        date: dateStr,
        dayName,
        dayNumber,
        monthName,
        fullDateStr,
        offset: i,
        isToday: dateStr === todayStr,
        isCenter: i === 0,
        booked: Number(item?.booked ?? 0),
        available: Number(item?.available ?? 0),
        price: Number(item?.price ?? 0),
        transferredFromOffline: Number(item?.transferredFromOffline ?? 0),
        maintenance: Number(item?.maintenance ?? 0),
      });
    }
    return list;
  }, [centerDate, todayStr, calendar]);

  const windowBookedCount = useMemo(
    () => sevenDays.reduce((sum, item) => sum + item.booked, 0),
    [sevenDays],
  );

  const windowFreeRooms = useMemo(
    () => sevenDays.reduce((sum, item) => sum + item.available, 0),
    [sevenDays],
  );

  const avgNightPrice = useMemo(() => {
    const valid = sevenDays.filter((i) => i.price > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((sum, i) => sum + i.price, 0) / valid.length);
  }, [sevenDays]);

  // Load Room Categories whenever targetAshrams updates
  const fetchRooms = useCallback(async (targets = targetAshrams) => {
    if (!targets || targets.length === 0) {
      setMyRooms([]);
      setSelectedRoomId("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setCalendar([]);
    try {
      const results = await Promise.allSettled(
        targets.map((a: any) => ashramService.getManagedById(a._id)),
      );
      const rooms: any[] = [];
      let failures = 0;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.data?.success) {
          failures += 1;
          return;
        }
        const owner = targets[index];
        (result.value.data.data.rooms || []).forEach((room: any) =>
          rooms.push({ ...room, ashramName: owner.name }),
        );
      });
      setMyRooms(rooms);

      setSelectedRoomId((current) => {
        if (current && rooms.some((r) => r._id === current)) return current;
        let stored = "";
        try {
          stored = localStorage.getItem(ROOM_STORAGE_KEY) || "";
        } catch {
          stored = "";
        }
        if (stored && rooms.some((r) => r._id === stored)) return stored;
        return rooms[0]?._id || "";
      });

      if (rooms.length === 0) setLoading(false);
      if (failures > 0)
        notifyRef.current(
          "Load Failed",
          `Could not load room categories for ${failures} ashram(s).`,
          "error",
        );
    } catch (err) {
      console.error("Fetch rooms error:", err);
      notifyRef.current(
        "Load Failed",
        getErrorMessage(err, "Unable to load rooms for this ashram."),
        "error",
      );
      setMyRooms([]);
      setSelectedRoomId("");
      setLoading(false);
    }
  }, [targetAshrams]);

  useEffect(() => {
    if (loadingAshrams) return;
    if (!selectedAshramId || !targetAshrams.length) {
      setMyRooms([]);
      setSelectedRoomId("");
      setCalendar([]);
      setLoading(false);
      return;
    }
    fetchRooms(targetAshrams);
  }, [selectedAshramId, targetAshrams, loadingAshrams, fetchRooms]);

  // Load 7-Day calendar for selectedRoomId
  const fetchCalendar = useCallback(async () => {
    const roomIdToUse = selectedRoomId || myRooms[0]?._id;
    if (!roomIdToUse) {
      setCalendar([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const base = new Date(`${centerDate}T00:00:00`);
      const startObj = new Date(base);
      startObj.setDate(base.getDate() - 7);
      const endObj = new Date(base);
      endObj.setDate(base.getDate() + 7);

      const start = formatLocalDate(startObj);
      const end = formatLocalDate(endObj);
      const res = await roomService.calendar(roomIdToUse, start, end);
      if (res.data?.success) {
        setCalendar(res.data.data || []);
      }
    } catch (err) {
      console.error("Calendar load error:", err);
      notifyRef.current(
        "Load Failed",
        getErrorMessage(err, "Unable to load the calendar."),
        "error",
      );
      setCalendar([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoomId, myRooms, centerDate]);

  useEffect(() => {
    if (selectedRoomId) {
      void fetchCalendar();
      try {
        localStorage.setItem(ROOM_STORAGE_KEY, selectedRoomId);
      } catch {}
    } else if (myRooms.length > 0) {
      setSelectedRoomId(myRooms[0]._id);
    } else {
      setCalendar([]);
      setLoading(false);
    }
  }, [selectedRoomId, myRooms, fetchCalendar]);

  // Handle Date Navigation (Prev 7 Days, Today, Next 7 Days)
  const handlePrev7Days = () => {
    const curr = new Date(`${centerDate}T00:00:00`);
    curr.setDate(curr.getDate() - 7);
    setCenterDate(formatLocalDate(curr));
  };

  const handleNext7Days = () => {
    const curr = new Date(`${centerDate}T00:00:00`);
    curr.setDate(curr.getDate() + 7);
    setCenterDate(formatLocalDate(curr));
  };

  const handleResetToday = () => {
    const t = getTodayDateStr();
    setCenterDate(t);
    setSearchDateInput("");
  };

  const handleSearchDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchDateInput) return;
    setCenterDate(searchDateInput);
  };

  const selectedRoom = myRooms.find((r) => r._id === selectedRoomId) || myRooms[0];

  // Open Room Rate Update Modal for a given day
  const handleOpenRateModal = (day: any) => {
    const defaultBase = selectedRoom?.basePrice || 0;
    setTargetDate(day.date);
    setCustomPrice(
      day.price && day.price > 0
        ? day.price.toString()
        : defaultBase > 0
          ? defaultBase.toString()
          : "",
    );
    setMaintenanceCount(day.maintenance ? day.maintenance.toString() : "0");
    if (!selectedRoomId && myRooms.length > 0) {
      setSelectedRoomId(myRooms[0]._id);
    }
    setShowOverride(true);
  };

  // Handle Daily Override Submission
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roomIdToUse = selectedRoomId || myRooms[0]?._id;
    if (!roomIdToUse) {
      notifyRef.current(
        "Selection Error",
        "Please select a room category first.",
        "error",
      );
      return;
    }

    setOverrideSubmitting(true);
    try {
      const res = await roomService.setAvailability(roomIdToUse, {
        date: targetDate,
        customPrice: customPrice ? parseFloat(customPrice) : undefined,
        maintenanceCount: parseInt(maintenanceCount, 10) || 0,
      });

      if (res.data?.success) {
        setShowOverride(false);
        notifyRef.current(
          "Rate Updated",
          `Room rate updated successfully for ${targetDate}`,
          "success",
        );
        void fetchCalendar();
        try {
          localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
          window.dispatchEvent(new Event("tirvona:rooms-updated"));
        } catch {}
      }
    } catch (err) {
      console.error("Override save error:", err);
      notifyRef.current(
        "Save Failed",
        getErrorMessage(err, "Could not update room rate."),
        "error",
      );
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const activeModalRoom =
    myRooms.find((r) => r._id === selectedRoomId) || myRooms[0] || selectedRoom;
  const modalBasePrice = activeModalRoom?.basePrice || 0;

  const targetDateFormatted = targetDate
    ? new Date(`${targetDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="space-y-6 text-left w-full">
      {/* HEADER CONTROLS SECTION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-2">
              <CalendarIcon size={18} className="text-[#0A4DA6]" />
              Daily Inventory & Pricing Calendar
            </h2>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-[#0A4DA6] dark:bg-blue-950 dark:text-blue-300">
              7-Day Live View
            </span>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
              <ShieldCheck size={12} /> Instant Rate Updates
            </span>
          </div>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Click any date card below to quickly adjust and update daily room rates and maintenance hold units.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
          {/* Ashram Selector */}
          {myAshrams.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Ashram
              </label>
              <select
                value={selectedAshramId}
                onChange={(e) => setSelectedAshramId(e.target.value)}
                aria-label="Active stay"
                className="p-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-extrabold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]"
              >
                {myAshrams.length > 1 && (
                  <option value={ALL_ASHRAMS}>
                    All Stays ({myAshrams.length})
                  </option>
                )}
                {myAshrams.map((ashram) => (
                  <option key={ashram._id} value={ashram._id}>
                    {ashram.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Room Category Selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Category
            </label>
            <select
              value={selectedRoomId}
              disabled={myRooms.length === 0}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="p-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-extrabold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6] disabled:opacity-50"
            >
              {myRooms.length === 0 && (
                <option value="">No room categories</option>
              )}
              {myRooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {isAllSelected && room.ashramName
                    ? `${room.name} — ${room.ashramName}`
                    : room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Date Search (Max 90 Days Window) */}
          <form onSubmit={handleSearchDateSubmit} className="flex items-center gap-1.5">
            <input
              type="date"
              min={minSearchDate}
              max={maxSearchDate}
              value={searchDateInput}
              onChange={(e) => setSearchDateInput(e.target.value)}
              className="p-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0A4DA6]"
              title="Search any booking date up to 90 days ahead"
            />
            <button
              type="submit"
              disabled={!searchDateInput}
              className="p-2 bg-[#0A4DA6] text-white rounded-xl hover:bg-[#083b80] transition disabled:opacity-40 cursor-pointer shadow-xs"
              title="Jump to date and view rates"
            >
              <Search size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* SELECTED ROOM INFO CARD */}
      {selectedRoom && (
        <div className="p-4.5 rounded-[22px] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center font-black text-xs">
              7D
            </div>
            <div>
              <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
                7-Day Pricing Window: {selectedRoom.name}
              </h3>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">
                {selectedRoom.ashramName ? `${selectedRoom.ashramName} · ` : ""}
                Base Price: ₹{selectedRoom.basePrice || 0} /night · Total Capacity:{" "}
                {selectedRoom.totalInventory ?? selectedRoom.totalRooms ?? 1}{" "}
                Room(s)
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            Click any day below to update rate
          </span>
        </div>
      )}

      {/* DATE RANGE NAVIGATION & SUMMARY BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 rounded-[22px] shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev7Days}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer shadow-2xs"
          >
            <ChevronLeft size={14} /> 7 Days Back
          </button>
          <button
            type="button"
            onClick={handleResetToday}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-2xs ${
              centerDate === todayStr
                ? "bg-[#0A4DA6] text-white"
                : "bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6]"
            }`}
          >
            <CalendarCheck size={13} /> Reset to Today
          </button>
          <button
            type="button"
            onClick={handleNext7Days}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#0A4DA6] hover:text-[#0A4DA6] transition cursor-pointer shadow-2xs"
          >
            Next 7 Days <ChevronRight size={14} />
          </button>
        </div>

        {/* SUMMARY STATS */}
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-slate-500 dark:text-slate-400">
            Window Total:{" "}
            <strong className="text-[#0B192C] dark:text-white tabular-nums">
              {windowBookedCount} Booked
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-emerald-700 dark:text-emerald-400">
            <strong className="tabular-nums">{windowFreeRooms} Free Left</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-[#0A4DA6] dark:text-blue-400">
            Avg: <strong className="tabular-nums">{formatCurrency(avgNightPrice)}/nt</strong>
          </span>
        </div>
      </div>

      {/* 7-DAY INVENTORY CARDS GRID */}
      {loadingAshrams || loading ? (
        <div className="h-44 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[24px] animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {sevenDays.map((day) => {
            const isToday = day.isToday;
            const isSelected = targetDate === day.date && showOverride;
            const hasCustomRate = day.price > 0;
            const displayPrice = hasCustomRate
              ? formatCurrency(day.price)
              : selectedRoom?.basePrice
                ? formatCurrency(selectedRoom.basePrice)
                : "Standard";

            return (
              <div
                key={day.date}
                onClick={() => handleOpenRateModal(day)}
                className={`bg-white dark:bg-[#0B192C] rounded-[22px] p-4 shadow-sm space-y-3 relative cursor-pointer transition-all duration-200 select-none flex flex-col justify-between group hover:shadow-md hover:border-[#0A4DA6] hover:-translate-y-1 ${
                  isSelected
                    ? "ring-2 ring-[#0A4DA6] bg-blue-50/70 dark:bg-blue-950/50 shadow-md transform -translate-y-0.5"
                    : isToday
                      ? "border-2 border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 shadow-xs ring-2 ring-orange-400/20"
                      : "border border-gray-100 dark:border-slate-800"
                }`}
              >
                {/* Header: Day Name + Edit Button */}
                <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#0B192C] dark:text-white flex items-center gap-1">
                      <CalendarIcon size={13} className="text-[#0A4DA6] shrink-0" />{" "}
                      {day.dayName}
                    </span>
                    {isToday && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full bg-orange-500 text-white">
                        Today
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRateModal(day);
                    }}
                    className="p-1.5 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md text-gray-400 hover:text-[#0A4DA6] transition-colors cursor-pointer"
                    title="Update room rate for this date"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>

                {/* Day Number & Month */}
                <div className="text-center my-0.5">
                  <span
                    className={`text-2xl font-black leading-tight tabular-nums ${
                      isToday
                        ? "text-orange-600 dark:text-orange-400 font-extrabold"
                        : "text-[#0B192C] dark:text-white"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    {day.monthName}
                  </span>
                </div>

                {/* Night Price */}
                <div className="space-y-0.5 text-center">
                  <span className="text-[9px] text-gray-400 block font-bold">
                    Night Price
                  </span>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-sm font-black text-[#0B192C] dark:text-white">
                      {displayPrice}
                    </span>
                    {hasCustomRate && (
                      <span className="text-[7px] font-extrabold px-1 py-0.2 bg-blue-100 dark:bg-blue-950 text-[#0A4DA6] dark:text-blue-300 rounded uppercase">
                        Custom
                      </span>
                    )}
                  </div>
                </div>

                {/* Booked / Available Badges */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-dashed border-gray-100 dark:border-slate-800 text-center text-[9px] font-bold tracking-wider">
                  <div
                    className={`p-1 rounded-md ${
                      day.booked > 0
                        ? "bg-[#0A4DA6]/10 text-[#0A4DA6] dark:text-blue-300 font-extrabold"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                    }`}
                  >
                    <span>{day.booked} Bkd</span>
                  </div>
                  <div className="p-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-md font-extrabold">
                    <span>{day.available} Free</span>
                  </div>
                </div>

                {Number(day.transferredFromOffline || 0) > 0 && (
                  <div className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-center text-[8px] font-black tracking-wider">
                    +{day.transferredFromOffline} OFFLINE
                  </div>
                )}

                {/* Click to Edit Rate Action */}
                <div className="pt-2 border-t border-gray-50 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRateModal(day);
                    }}
                    className="w-full py-1 px-2 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-[#0A4DA6] dark:text-blue-300 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit2 size={10} />
                    Update Rate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OVERRIDE DAILY RATE & MAINTENANCE MODAL */}
      {showOverride && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowOverride(false);
          }}
        >
          <div className="relative z-[101] bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-200 my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0A4DA6] dark:text-blue-400 flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Update Room Rate
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-semibold">
                  Adjust custom nightly price or hold maintenance units for this date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOverride(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              {/* Target Date Display */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target Date
                </label>
                <div className="px-3.5 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl text-xs font-black text-[#0A4DA6] dark:text-blue-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CalendarIcon size={14} className="text-[#0A4DA6] dark:text-blue-400" />
                    {targetDateFormatted || targetDate}
                  </span>
                  {targetDate === todayStr && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500 text-white">
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* Room Category Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Room Category
                </label>
                {myRooms.length > 1 ? (
                  <select
                    value={selectedRoomId || (myRooms[0]?._id ?? "")}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedRoomId(newId);
                      const r = myRooms.find((rm) => rm._id === newId);
                      if (r?.basePrice) {
                        setCustomPrice(String(r.basePrice));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  >
                    {myRooms.map((room) => (
                      <option key={room._id} value={room._id}>
                        {room.name} {room.ashramName ? `(${room.ashramName})` : ""} — Base: ₹{room.basePrice || 0}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{activeModalRoom?.name || "Standard Room"}</span>
                    <span className="text-xs font-black text-[#0A4DA6] dark:text-blue-400">
                      Base: ₹{modalBasePrice}/nt
                    </span>
                  </div>
                )}
              </div>

              {/* Custom Night Rate Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Night Rate for this Date (₹)
                  </label>
                  {modalBasePrice > 0 && (
                    <span className="text-[11px] font-bold text-slate-400">
                      Standard: ₹{modalBasePrice}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={modalBasePrice ? String(modalBasePrice) : "e.g. 1500"}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                  />
                </div>

                {/* Quick Price Buttons */}
                {modalBasePrice > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setCustomPrice(String(modalBasePrice))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-gray-200 cursor-pointer"
                    >
                      Default (₹{modalBasePrice})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPrice(String(Math.round(modalBasePrice * 1.1)))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-[#0A4DA6] dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                    >
                      +10%
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPrice(String(Math.round(modalBasePrice * 1.25)))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-[#0A4DA6] dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                    >
                      +25%
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPrice(String(modalBasePrice + 500))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                    >
                      +₹500
                    </button>
                  </div>
                )}
              </div>

              {/* Maintenance / Hold Units */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Hold / Maintenance Units
                </label>
                <input
                  type="number"
                  min={0}
                  value={maintenanceCount}
                  onChange={(e) => setMaintenanceCount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Block rooms from online booking for walk-ins or maintenance on this date.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOverride(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="flex-1 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-xl font-black text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {overrideSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Apply Room Rate"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryCalendarPage;
