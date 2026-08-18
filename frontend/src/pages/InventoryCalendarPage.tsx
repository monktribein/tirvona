import React, { useState, useEffect, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, Sparkles, Edit2, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService, roomService } from "../services";
import { getErrorMessage } from "../lib/api";
import { formatCurrency } from "../utils/format";
import { useAshramSelection, ALL_ASHRAMS } from "../hooks/useAshramSelection";

/** Remembers the category too, so a reload returns to the same calendar. */
const ROOM_STORAGE_KEY = "tirvona:inventory-room";

export const InventoryCalendarPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Override Form State
  const [showOverride, setShowOverride] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [maintenanceCount, setMaintenanceCount] = useState("0");

  const notifyRef = useRef(addNotification);
  notifyRef.current = addNotification;

  // Same selection rules as Manage Rooms and Add-On Services. "All Ashrams"
  // matters most here: a calendar is always one room's, and landing on a
  // property with no categories left the page with nothing to show.
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

  const targetsRef = useRef<any[]>([]);
  targetsRef.current = targetAshrams;

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setCalendar([]);
    try {
      // Under "All Ashrams" the category picker spans every property, so an
      // empty ashram no longer dead-ends the page.
      const targets = targetsRef.current;
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

      // Keep the category the admin is on. Only fall back when it is gone —
      // switching ashrams, or a category that was removed.
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
  }, []);

  useEffect(() => {
    if (!selectedAshramId) {
      setMyRooms([]);
      setSelectedRoomId("");
      setCalendar([]);
      setLoading(false);
      return;
    }
    fetchRooms();
  }, [selectedAshramId, fetchRooms]);

  useEffect(() => {
    if (selectedRoomId) {
      fetchCalendar();
      try {
        localStorage.setItem(ROOM_STORAGE_KEY, selectedRoomId);
      } catch {
        // Storage unavailable — the category just resets on the next reload.
      }
    } else {
      setCalendar([]);
      setLoading(false);
    }
  }, [selectedRoomId]);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const res = await roomService.calendar(selectedRoomId, today, end);
      if (res.data.success) {
        setCalendar(res.data.data);
      }
    } catch (err) {
      console.error("Calendar load error:", err);
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load the calendar."),
        "error",
      );
      setCalendar([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await roomService.setAvailability(selectedRoomId, {
        date: targetDate,
        customPrice: parseFloat(customPrice) || undefined,
        maintenanceCount: parseInt(maintenanceCount) || 0,
      });
      if (res.data.success) {
        setShowOverride(false);
        setCustomPrice("");
        setMaintenanceCount("0");
        addNotification(
          "Rate / Inventory Override Applied",
          `Daily rules updated for ${targetDate}`,
          "success",
        );
        fetchCalendar();
        localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
        window.dispatchEvent(new Event("tirvona:rooms-updated"));
      }
    } catch (err) {
      console.error("Override save error:", err);
      addNotification(
        "Save Failed",
        getErrorMessage(err, "Could not apply override."),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[24px] shadow-sm gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Daily Inventory & Pricing Calendar
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Monitor booking occupancy and apply manual rate overrides on holiday
            peaks.
          </p>
        </div>

        {myAshrams.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-extrabold text-gray-400 tracking-wider">
                Active Ashram
              </label>
              <select
                value={selectedAshramId}
                onChange={(e) => setSelectedAshramId(e.target.value)}
                aria-label="Active ashram"
                className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
              >
                {/* Pools every property's categories into the picker beside
                  it, so an ashram with none does not strand the page. */}
                {myAshrams.length > 1 && (
                  <option value={ALL_ASHRAMS}>
                    All Ashrams ({myAshrams.length})
                  </option>
                )}
                {myAshrams.map((ashram) => (
                  <option key={ashram._id} value={ashram._id}>
                    {ashram.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-extrabold text-gray-400 tracking-wider">
                Active Category
              </label>
              <select
                value={selectedRoomId}
                disabled={myRooms.length === 0}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-50"
              >
                {myRooms.length === 0 && <option value="">No room categories</option>}
                {myRooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {/* Qualified by property when the list spans several, since
                      category names repeat across ashrams. */}
                    {isAllSelected && room.ashramName
                      ? `${room.name} — ${room.ashramName}`
                      : room.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {loadingAshrams || loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : (
        /* Calendar Grid */
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {calendar.map((item, index) => (
            <div
              key={index}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] p-4.5 shadow-sm space-y-3 relative hover:border-[#0A4DA6]/50 transition-colors"
            >
              <div className="flex justify-between items-center border-b border-gray-50 dark:border-slate-850 pb-2">
                <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                  <CalendarIcon size={12} className="text-[#0A4DA6]" />{" "}
                  {new Date(item.date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <button
                  onClick={() => {
                    setTargetDate(item.date);
                    setCustomPrice(item.price.toString());
                    setShowOverride(true);
                  }}
                  className="p-1 hover:bg-gray-50 dark:hover:bg-slate-900 rounded text-gray-400 hover:text-[#0A4DA6] transition-colors cursor-pointer"
                  title="Override daily pricing"
                >
                  <Edit2 size={10} />
                </button>
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] text-gray-400 block font-bold">
                  Night Price
                </span>
                <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                  {formatCurrency(item.price)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-dashed border-gray-100 dark:border-slate-800 text-center text-[9px] font-bold tracking-wider">
                <div className="p-1 bg-[#0A4DA6]/5 text-[#0A4DA6] rounded-md">
                  <span>{item.booked} Booked</span>
                </div>
                <div className="p-1 bg-success/5 text-success rounded-md">
                  <span>{item.available} Left</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Override Modal */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleOverrideSubmit}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Sparkles size={16} className="text-[#0A4DA6]" /> Override Stay
                Details
              </h3>
              <button
                type="button"
                onClick={() => setShowOverride(false)}
                className="text-gray-400 hover:text-gray-650"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Selected Target Date
                </label>
                <input
                  type="text"
                  disabled
                  value={targetDate}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Custom Price Override (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold text-center focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Maintenance Blocks (Units)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={maintenanceCount}
                    onChange={(e) => setMaintenanceCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold text-center focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              Apply Daily Adjustments
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default InventoryCalendarPage;
