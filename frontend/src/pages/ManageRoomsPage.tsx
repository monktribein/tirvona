import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bed,
  Plus,
  ClipboardCheck,
  X,
  Pencil,
  Trash2,
  Loader2,
  Building2,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService, roomService } from "../services";
import { formatCurrency } from "../utils/format";
import { getErrorMessage } from "../lib/api";
import { useAshramSelection, ALL_ASHRAMS } from "../hooks/useAshramSelection";

export const ManageRoomsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formAshramId, setFormAshramId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("private_room");
  const [acType, setAcType] = useState("AC");
  const [capacity, setCapacity] = useState("2");
  const [totalInventory, setTotalInventory] = useState("10");
  const [basePrice, setBasePrice] = useState("800");
  const [amenities, setAmenities] = useState("Attached Bath, WiFi, Cooler");
  const [status, setStatus] = useState("active");

  const notifyRef = useRef(addNotification);
  notifyRef.current = addNotification;

  const {
    ashrams: myAshrams,
    selectedAshramId,
    setSelectedAshramId,
    loadingAshrams,
    targetAshrams,
  } = useAshramSelection({
    storageKey: "tirvona:rooms-ashram-filter",
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
    try {
      const targets = targetsRef.current;
      const results = await Promise.allSettled(
        targets.map((a: any) => ashramService.getManagedById(a._id)),
      );
      const merged: any[] = [];
      let failures = 0;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.data?.success) {
          failures += 1;
          return;
        }
        const owner = targets[index];
        (result.value.data.data.rooms || []).forEach((room: any) =>
          merged.push({
            ...room,
            ashramName: room.ashramName || owner.name,
            ashramId: room.ashramId || owner._id,
          }),
        );
      });
      setRooms(merged);
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
        getErrorMessage(err, "Unable to load your rooms."),
        "error",
      );
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedAshramId) {
      setRooms([]);
      setLoading(false);
      return;
    }
    fetchRooms();
  }, [selectedAshramId, fetchRooms]);

  const openCreate = () => {
    setEditRoomId(null);
    setFormAshramId(
      selectedAshramId && selectedAshramId !== ALL_ASHRAMS
        ? selectedAshramId
        : myAshrams[0]?._id || "",
    );
    setName("");
    setType("private_room");
    setAcType("AC");
    setCapacity("2");
    setTotalInventory("10");
    setBasePrice("800");
    setAmenities("Attached Bath, WiFi, Cooler");
    setStatus("active");
    setShowCreate(true);
  };

  const openEdit = (room: any) => {
    setEditRoomId(room._id);
    setFormAshramId(String(room.ashramId || selectedAshramId || ""));
    setName(room.name || "");
    setType(room.type || "private_room");
    setAcType(room.acType || "AC");
    setCapacity(String(room.capacity ?? 2));
    setTotalInventory(String(room.totalInventory ?? 0));
    setBasePrice(String(room.basePrice ?? 0));
    setAmenities((room.amenities || []).join(", "));
    setStatus(room.status === "under_maintenance" ? "under_maintenance" : "active");
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addNotification("Validation Error", "Give the room category a name.", "error");
      return;
    }
    const amenityList = amenities
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (editRoomId) {
        await roomService.update(editRoomId, {
          name: name.trim(),
          type,
          acType,
          capacity: parseInt(capacity),
          totalInventory: parseInt(totalInventory),
          basePrice: parseFloat(basePrice),
          amenities: amenityList,
          status,
        });
        addNotification(
          "Room Category Updated",
          "Changes saved successfully.",
          "success",
        );
      } else {
        await roomService.create({
          ashramId: formAshramId,
          name: name.trim(),
          type,
          acType,
          capacity: parseInt(capacity),
          totalInventory: parseInt(totalInventory),
          basePrice: parseFloat(basePrice),
          amenities: amenityList,
        });
        addNotification(
          "Room Category Added",
          "New room configuration saved successfully.",
          "success",
        );
      }
      const nextAshramId =
        !editRoomId &&
        selectedAshramId !== ALL_ASHRAMS &&
        formAshramId &&
        formAshramId !== selectedAshramId
          ? formAshramId
          : selectedAshramId;

      setShowCreate(false);
      setEditRoomId(null);
      localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
      window.dispatchEvent(new Event("tirvona:rooms-updated"));
      if (nextAshramId !== selectedAshramId) setSelectedAshramId(nextAshramId);
      else fetchRooms();
    } catch (err) {
      console.error("Room save error:", err);
      addNotification(
        "Save Failed",
        getErrorMessage(err, "Could not save room category."),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (room: any) => {
    setDeletingId(room._id);
    try {
      const res = await roomService.remove(room._id);
      addNotification(
        "Room Category Removed",
        res.data?.message || "Room category removed successfully.",
        "success",
      );
      setConfirmDelete(null);
      localStorage.setItem("tirvona:rooms-updated", Date.now().toString());
      window.dispatchEvent(new Event("tirvona:rooms-updated"));
      fetchRooms();
    } catch (err) {
      addNotification(
        "Remove Failed",
        getErrorMessage(err, "Could not remove this room category."),
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 text-left w-full">
      <div className="flex flex-wrap justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Configure Room Categories
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Add dormitories, private suites, and apply base and peak seasonal
            rates.
          </p>
        </div>
        {myAshrams.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {myAshrams.length > 1 && (
              <select
                value={selectedAshramId}
                onChange={(e) => setSelectedAshramId(e.target.value)}
                aria-label="Select ashram"
                className="px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value={ALL_ASHRAMS}>
                  All Ashrams ({myAshrams.length})
                </option>
                {myAshrams.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={openCreate}
              className="shrink-0 px-5 py-2.5 bg-[#0A4DA6] text-white text-xs font-bold rounded-full hover:bg-opacity-95 shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Add Room Category
            </button>
          </div>
        )}
      </div>

      {loadingAshrams || loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
          <Bed className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No room categories listed
          </h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Configure your first stay options to receive guest reservations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div
              key={room._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-start border-b border-gray-50 dark:border-slate-850 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">
                    {room.name}
                  </h3>
                  <span className="text-[9px] font-bold text-gray-400">
                    {room.type.replace("_", " ")} • {room.acType}
                  </span>
                  {selectedAshramId === ALL_ASHRAMS && room.ashramName && (
                    <span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-[#0A4DA6]">
                      <Building2 size={10} /> {room.ashramName}
                    </span>
                  )}
                </div>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                  {formatCurrency(room.basePrice)}{" "}
                  <span className="text-[10px] text-gray-400 font-normal">
                    / night
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-[12px]">
                  <span className="text-[9px] text-gray-400 block font-bold">
                    Max Capacity
                  </span>
                  <span className="font-semibold text-secondary dark:text-white">
                    {room.capacity} Persons
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-[12px]">
                  <span className="text-[9px] text-gray-400 block font-bold">
                    Total Rooms
                  </span>
                  <span className="font-semibold text-secondary dark:text-white">
                    {room.totalInventory} Units
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-[12px]">
                  <span className="text-[9px] text-gray-400 block font-bold">
                    Status
                  </span>
                  <span
                    className={`font-semibold flex items-center justify-center gap-0.5 ${
                      room.status === "under_maintenance"
                        ? "text-amber-600"
                        : "text-success"
                    }`}
                  >
                    <ClipboardCheck size={12} />{" "}
                    {room.status === "under_maintenance"
                      ? "Maintenance"
                      : "Active"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-50 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => openEdit(room)}
                  disabled={deletingId === room._id}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-[11px] font-extrabold text-[#0A4DA6] hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(room)}
                  disabled={deletingId === room._id}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-rose-200 dark:border-rose-900 text-[11px] font-extrabold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === room._id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-4xl w-full rounded-[28px] p-6 sm:p-8 space-y-5 max-h-[85vh] overflow-y-auto text-left"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Bed size={18} className="text-[#0A4DA6]" />{" "}
                {editRoomId ? "Edit Room Category" : "Add Room Category"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Select Ashram
                </label>
                <select
                  value={formAshramId}
                  onChange={(e) => setFormAshramId(e.target.value)}
                  disabled={!!editRoomId}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {myAshrams.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {editRoomId && (
                  <p className="text-[10px] text-gray-400 font-semibold pt-0.5">
                    A room category stays with the ashram it was created under.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Room Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Triple AC Suite"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Stay Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="private_room">Private Room</option>
                    <option value="dormitory">Dormitory Bed</option>
                    <option value="family_room">Family Suite</option>
                    <option value="hall">Satsang Hall Bed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    AC / Ventilation
                  </label>
                  <select
                    value={acType}
                    onChange={(e) => setAcType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="AC">AC (Air Conditioned)</option>
                    <option value="Non-AC">Non-AC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Total Units
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalInventory}
                    onChange={(e) => setTotalInventory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Base Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Amenities (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Attached Bath, WiFi, Cooler, Geyser"
                  value={amenities}
                  onChange={(e) => setAmenities(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
              </div>

              {editRoomId && (
                <div className="space-y-1">
                  <label
                    htmlFor="room-status"
                    className="text-xs font-bold text-gray-400"
                  >
                    Status
                  </label>
                  <select
                    id="room-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="under_maintenance">Maintenance</option>
                  </select>
                  <p className="text-[10px] text-gray-400 font-semibold pt-0.5">
                    Maintenance hides this category from new reservations.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#0A4DA6] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-full font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting
                ? "Saving..."
                : editRoomId
                  ? "Save Changes"
                  : "Configure Category"}
            </button>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm remove room category"
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl my-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 shrink-0">
                <Trash2 size={20} className="text-rose-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-[#0B192C] dark:text-white">
                  Remove this room category?
                </h3>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 leading-relaxed break-words">
                  <span className="font-black text-[#0B192C] dark:text-white">
                    {confirmDelete.name}
                  </span>{" "}
                  will stop accepting new reservations and disappear from the
                  listing. Past bookings keep their records.
                </p>
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-2.5 leading-relaxed">
                  If any guest is still booked into this category the removal
                  will be refused — cancel or complete those stays first.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete._id}
                className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId === confirmDelete._id}
                className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingId === confirmDelete._id && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                {deletingId === confirmDelete._id
                  ? "Removing..."
                  : "Remove Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ManageRoomsPage;
