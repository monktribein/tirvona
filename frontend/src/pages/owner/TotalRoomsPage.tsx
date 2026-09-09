import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import { roomService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";

/**
 * A room record is a *category* carrying a unit count, and the platform runs
 * two pools against it: the online pool Tirvona sells, and the offline pool the
 * desk keeps back for walk-ins. Everything here is served pre-computed by
 * GET /rooms/summary so the two pools are never conflated, and every occupancy
 * figure belongs to the single night selected above the table.
 */

type SummaryRow = {
  roomId: string;
  name: string;
  ashramId: string;
  ashramName: string;
  type: string;
  acType: string;
  guestCapacity: number;
  status: string;
  registeredUnits: number;
  capacity: number;
  booked: number;
  held: number;
  maintenance: number;
  occupied: number;
  blocked: number;
  available: number;
  isClosed: boolean;
  transferredFromOffline: number;
  offlineTotal: number;
  offlineBlocked: number;
  offlineTransferred: number;
  offlineAvailable: number;
  hasInventoryRow: boolean;
};

type Summary = {
  date: string;
  filters: { ashrams: { id: string; name: string }[]; unrestricted: boolean };
  totals: {
    roomCategories: number;
    registeredRooms: number;
    offlineRooms: number;
    totalRooms: number;
    onlineRooms: number;
    bookedRooms: number;
    heldRooms: number;
    occupiedRooms: number;
    blockedRooms: number;
    availableRooms: number;
    occupancyRate: number;
  };
  rooms: SummaryRow[];
};

const today = () => new Date().toISOString().slice(0, 10);

const ROOM_TYPES: [string, string][] = [
  ["all", "All types"],
  ["dormitory", "Dormitory"],
  ["private_room", "Private room"],
  ["family_room", "Family room"],
  ["hall", "Hall"],
];

const typeLabel = (value: string) =>
  ROOM_TYPES.find(([key]) => key === value)?.[1] ?? value;

export const TotalRoomsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    ashramId: "",
    date: today(),
    type: "all",
    acType: "all",
    status: "all",
    search: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { date: filters.date };
      if (filters.ashramId) params.ashramId = filters.ashramId;
      if (filters.type !== "all") params.type = filters.type;
      if (filters.acType !== "all") params.acType = filters.acType;
      if (filters.status !== "all") params.status = filters.status;
      if (filters.search.trim()) params.search = filters.search.trim();

      const response = await roomService.summary(params);
      setSummary(response?.data?.data ?? null);
    } catch (error) {
      addNotification(
        "Room Summary Unavailable",
        getErrorMessage(error, "Could not load the room summary."),
        "error",
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters, addNotification]);

  // The search box would otherwise fire a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  const set = (patch: Partial<typeof filters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const card =
    "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]";
  const field =
    "w-full px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#0A4DA6]";

  const totals = summary?.totals;
  const rooms = summary?.rooms ?? [];
  const showAshramColumn = !filters.ashramId;

  const tiles = useMemo(
    () =>
      totals
        ? ([
            ["Total rooms", totals.totalRooms, "Online plus offline units"],
            [
              "Registered rooms",
              totals.registeredRooms,
              "Units on room categories",
            ],
            ["Room categories", totals.roomCategories, "Distinct categories"],
            ["Online rooms", totals.onlineRooms, "Sellable on this night"],
            ["Offline rooms", totals.offlineRooms, "Held back for the desk"],
            ["Available rooms", totals.availableRooms, "Free to sell tonight"],
            ["Booked rooms", totals.bookedRooms, "Reserved for this night"],
            ["Occupied rooms", totals.occupiedRooms, "Guests in-house now"],
            ["Blocked rooms", totals.blockedRooms, "Maintenance or closed"],
            ["Held rooms", totals.heldRooms, "In checkout, not yet paid"],
          ] as [string, number, string][])
        : [],
    [totals],
  );

  return (
    <div className="space-y-6 w-full text-left">
      <EnterprisePageHeader
        title="Total Rooms"
        subtitle="Every room across your properties, with live availability for the night you pick."
        icon={<LayoutGrid size={22} />}
        badgeText={totals ? `${totals.occupancyRate}% booked` : undefined}
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        }
      />

      <div className={`${card} p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6`}>
        {summary && summary.filters.ashrams.length > 1 && (
          <select
            value={filters.ashramId}
            onChange={(event) => set({ ashramId: event.target.value })}
            className={field}
            aria-label="Ashram"
          >
            <option value="">All my ashrams</option>
            {summary.filters.ashrams.map((ashram) => (
              <option key={ashram.id} value={ashram.id}>
                {ashram.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={filters.date}
          onChange={(event) => set({ date: event.target.value || today() })}
          className={field}
          aria-label="Night"
        />
        <select
          value={filters.type}
          onChange={(event) => set({ type: event.target.value })}
          className={field}
          aria-label="Room type"
        >
          {ROOM_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filters.acType}
          onChange={(event) => set({ acType: event.target.value })}
          className={field}
          aria-label="AC type"
        >
          <option value="all">AC & Non-AC</option>
          <option value="AC">AC only</option>
          <option value="Non-AC">Non-AC only</option>
        </select>
        <select
          value={filters.status}
          onChange={(event) => set({ status: event.target.value })}
          className={field}
          aria-label="Status"
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="under_maintenance">Under maintenance</option>
        </select>
        <input
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
          placeholder="Search room category"
          className={field}
          aria-label="Search room category"
        />
      </div>

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tiles.map(([label, value, hint]) => (
            <div key={label} className={`${card} p-4`}>
              <p className="text-[10px] uppercase font-black text-gray-400">
                {label}
              </p>
              <p className="text-2xl font-black text-[#0B192C] dark:text-white mt-1">
                {value}
              </p>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                {hint}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
            Room-wise inventory
          </h3>
          <p className="text-[11px] text-gray-400 font-semibold">
            {summary
              ? `Availability for the night of ${summary.date}`
              : "Availability for the selected night"}
          </p>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <p className="p-10 text-center text-xs font-bold text-gray-400">
            No room categories match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/60 text-[10px] uppercase font-black text-gray-400">
                <tr>
                  <th className="px-4 py-3">Room category</th>
                  {showAshramColumn && <th className="px-4 py-3">Ashram</th>}
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Registered</th>
                  <th className="px-4 py-3 text-right">Online</th>
                  <th className="px-4 py-3 text-right">Booked</th>
                  <th className="px-4 py-3 text-right">Held</th>
                  <th className="px-4 py-3 text-right">Occupied</th>
                  <th className="px-4 py-3 text-right">Blocked</th>
                  <th className="px-4 py-3 text-right">Offline</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rooms.map((room) => (
                  <tr key={room.roomId}>
                    <td className="px-4 py-3 font-extrabold text-[#0B192C] dark:text-white">
                      {room.name}
                      <span className="block text-[10px] font-semibold text-gray-400">
                        Sleeps {room.guestCapacity} · {room.acType}
                      </span>
                    </td>
                    {showAshramColumn && (
                      <td className="px-4 py-3 text-gray-500 font-semibold">
                        {room.ashramName || "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500 font-semibold">
                      {typeLabel(room.type)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {room.registeredUnits}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {room.capacity}
                      {room.transferredFromOffline > 0 && (
                        <span
                          className="block text-[10px] font-semibold text-gray-400"
                          title="Units moved across from the offline pool for this night"
                        >
                          +{room.transferredFromOffline} moved
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {room.booked}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-500">
                      {room.held}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {room.occupied}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600">
                      {room.blocked}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-500">
                      {room.offlineTotal}
                      {room.offlineTotal > 0 && (
                        <span className="block text-[10px] font-semibold text-gray-400">
                          {room.offlineAvailable} free
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-600">
                      {room.available}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          room.isClosed || room.status === "under_maintenance"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {room.isClosed
                          ? "Closed"
                          : room.status === "under_maintenance"
                            ? "Maintenance"
                            : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TotalRoomsPage;
