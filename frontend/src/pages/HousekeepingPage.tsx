import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  CheckCircle,
  Wrench,
  RefreshCw,
  BedDouble,
} from "lucide-react";
import { housekeepingService } from "../services";
import { getErrorMessage } from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";

interface RoomUnit {
  _id: string;
  unitNumber: string;
  status: "clean" | "dirty" | "cleaning" | "maintenance";
  roomId?: { name: string; type: string; acType: string };
  assignedTo?: { name: string };
}

export const HousekeepingPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [units, setUnits] = useState<RoomUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBoard();
  }, []);

  const fetchBoard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await housekeepingService.board();
      if (res.data.success) setUnits(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the housekeeping board."));
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await housekeepingService.updateStatus(id, newStatus);
      if (res.data.success) {
        setUnits((prev) => prev.map((u) => (u._id === id ? res.data.data : u)));
      }
    } catch (err) {
      addNotification(
        "Update Failed",
        getErrorMessage(err, "Could not update room status."),
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = units.reduce(
    (acc, u) => ({ ...acc, [u.status]: (acc[u.status] || 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Housekeeping &amp; Maintenance Console
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Monitor room cleaning statuses, log maintenance blocks, and view
            staff duties.
          </p>
        </div>
        <button
          onClick={fetchBoard}
          className="shrink-0 p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-500 cursor-pointer transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            key: "clean",
            label: "Clean",
            color: "text-success",
            bg: "bg-success/10",
          },
          {
            key: "dirty",
            label: "Dirty",
            color: "text-danger",
            bg: "bg-danger/10",
          },
          {
            key: "cleaning",
            label: "Cleaning",
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            key: "maintenance",
            label: "Maintenance",
            color: "text-yellow-600",
            bg: "bg-yellow-50",
          },
        ].map((s) => (
          <div
            key={s.key}
            className={`p-4 rounded-[20px] border border-gray-100 dark:border-slate-800 ${s.bg}`}
          >
            <span className={`text-2xl font-extrabold ${s.color}`}>
              {counts[s.key] || 0}
            </span>
            <p className="text-[10px] font-bold text-gray-500 tracking-wider mt-1">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger border border-danger/20 text-xs rounded-2xl font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-32 bg-gray-50 border border-gray-100 rounded-[20px] animate-pulse"
            />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
          <BedDouble className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No rooms to service
          </h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            No room units are provisioned yet. Add room categories with
            inventory to populate the housekeeping board.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {units.map((unit) => {
            const isClean = unit.status === "clean";
            const isCleaning = unit.status === "cleaning";
            const isDirty = unit.status === "dirty";
            const isMaintenance = unit.status === "maintenance";
            const busy = updatingId === unit._id;

            return (
              <div
                key={unit._id}
                className={`bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[20px] p-5 shadow-sm space-y-4 relative overflow-hidden ${busy ? "opacity-60" : ""}`}
              >
                <div
                  className={`absolute left-0 inset-y-0 w-1 ${
                    isClean
                      ? "bg-success"
                      : isCleaning
                        ? "bg-primary"
                        : isDirty
                          ? "bg-danger"
                          : "bg-yellow-500"
                  }`}
                />

                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-[#0B192C] dark:text-white truncate pr-2">
                    {unit.unitNumber}
                  </h4>
                  <p className="text-[9px] text-gray-400 font-bold truncate">
                    {unit.roomId?.name || "Room"}
                  </p>
                  {unit.assignedTo?.name && (
                    <p className="text-[9px] text-gray-400 font-bold">
                      Staff: {unit.assignedTo.name}
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider ${
                      isClean
                        ? "bg-success/10 text-success"
                        : isCleaning
                          ? "bg-primary/10 text-primary animate-pulse"
                          : isDirty
                            ? "bg-danger/10 text-danger"
                            : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {unit.status}
                  </span>

                  <div className="flex gap-1.5">
                    {!isClean && (
                      <button
                        onClick={() => updateStatus(unit._id, "clean")}
                        disabled={busy}
                        className="p-1 hover:bg-success/10 text-gray-400 hover:text-success rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Mark Clean"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {!isCleaning && !isClean && (
                      <button
                        onClick={() => updateStatus(unit._id, "cleaning")}
                        disabled={busy}
                        className="p-1 hover:bg-[#0A4DA6]/10 text-gray-400 hover:text-[#0A4DA6] rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Start Cleaning"
                      >
                        <ClipboardList size={14} />
                      </button>
                    )}
                    {!isDirty && !isMaintenance && (
                      <button
                        onClick={() => updateStatus(unit._id, "dirty")}
                        disabled={busy}
                        className="p-1 hover:bg-danger/10 text-gray-400 hover:text-danger rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Mark Dirty"
                      >
                        <BedDouble size={14} />
                      </button>
                    )}
                    {!isMaintenance && (
                      <button
                        onClick={() => updateStatus(unit._id, "maintenance")}
                        disabled={busy}
                        className="p-1 hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Log Maintenance"
                      >
                        <Wrench size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default HousekeepingPage;
