import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Sparkles, Edit2, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService, roomService } from "../services";
import { getErrorMessage } from "../lib/api";

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

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      fetchCalendar();
    }
  }, [selectedRoomId]);

  const fetchRooms = async () => {
    try {
      const ashramsRes = await ashramService.myListings();
      if (ashramsRes.data.success && ashramsRes.data.data.length > 0) {
        const roomsRes = await ashramService.getManagedById(
          ashramsRes.data.data[0]._id,
        );
        if (roomsRes.data.success && roomsRes.data.data.rooms.length > 0) {
          setMyRooms(roomsRes.data.data.rooms);
          setSelectedRoomId(roomsRes.data.data.rooms[0]._id);
        } else {
          setMyRooms([]);
        }
      } else {
        setMyRooms([]);
      }
    } catch (err) {
      console.error("Fetch rooms error:", err);
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load your rooms."),
        "error",
      );
      setMyRooms([]);
    }
  };

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
    <div className="space-y-6 text-left">
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

        {myRooms.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
              Active Category
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none"
            >
              {myRooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
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
                <span className="text-[9px] text-gray-400 block uppercase font-bold">
                  Night Price
                </span>
                <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                  ₹{item.price}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-dashed border-gray-100 dark:border-slate-800 text-center text-[9px] font-bold uppercase tracking-wider">
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
