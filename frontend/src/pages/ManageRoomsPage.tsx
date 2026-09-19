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
  ImagePlus,
  Clock,
  Save,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService, roomService, uploadService } from "../services";
import { formatCurrency } from "../utils/format";
import { getErrorMessage } from "../lib/api";
import { useAshramSelection, ALL_ASHRAMS } from "../hooks/useAshramSelection";

const DEFAULT_CHECK_IN = "12:00";
const DEFAULT_CHECK_OUT = "11:00";
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Check-in / check-out times are ashram-level policies. The whole policies
  // object is kept per ashram because the ashram update replaces it wholesale,
  // so saving the times must carry cancellation and stay rules along.
  const [policiesByAshram, setPoliciesByAshram] = useState<Record<string, any>>({});
  const [timesAshramId, setTimesAshramId] = useState("");
  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN);
  const [checkOutTime, setCheckOutTime] = useState(DEFAULT_CHECK_OUT);
  const [savingTimes, setSavingTimes] = useState(false);
  const [rulesByAshram, setRulesByAshram] = useState<Record<string, string[]>>({});
  const [rulesText, setRulesText] = useState("");

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
      const policies: Record<string, any> = {};
      const rules: Record<string, string[]> = {};
      let failures = 0;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.data?.success) {
          failures += 1;
          return;
        }
        const owner = targets[index];
        policies[String(owner._id)] =
          result.value.data.data.ashram?.policies ?? {};
        rules[String(owner._id)] = Array.isArray(
          result.value.data.data.ashram?.rules,
        )
          ? result.value.data.data.ashram.rules
          : [];
        (result.value.data.data.rooms || []).forEach((room: any) =>
          merged.push({
            ...room,
            ashramName: room.ashramName || owner.name,
            ashramId: room.ashramId || owner._id,
          }),
        );
      });
      setRooms(merged);
      setPoliciesByAshram((prev) => ({ ...prev, ...policies }));
      setRulesByAshram((prev) => ({ ...prev, ...rules }));
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

  const timesTargetId =
    selectedAshramId && selectedAshramId !== ALL_ASHRAMS
      ? selectedAshramId
      : timesAshramId || myAshrams[0]?._id || "";
  const timesTargetPolicies = policiesByAshram[timesTargetId];
  const timesTargetRules = rulesByAshram[timesTargetId];
  // Saving before the current policies load would overwrite them with blanks.
  const timesReady = Boolean(timesTargetId) && timesTargetPolicies !== undefined;

  useEffect(() => {
    if (!timesTargetId) return;
    setCheckInTime(timesTargetPolicies?.checkInTime || DEFAULT_CHECK_IN);
    setCheckOutTime(timesTargetPolicies?.checkOutTime || DEFAULT_CHECK_OUT);
    setRulesText((timesTargetRules ?? []).join("\n"));
  }, [timesTargetId, timesTargetPolicies, timesTargetRules]);

  const handleSaveTimes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timesReady) return;
    if (!CLOCK_PATTERN.test(checkInTime) || !CLOCK_PATTERN.test(checkOutTime)) {
      addNotification(
        "Validation Error",
        "Enter both a check-in and a check-out time.",
        "error",
      );
      return;
    }
    setSavingTimes(true);
    try {
      const policies = {
        ...(policiesByAshram[timesTargetId] || {}),
        checkInTime,
        checkOutTime,
      };
      // One guideline per line; list markers typed by habit are dropped.
      const ruleList = rulesText
        .split("\n")
        .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
        .filter(Boolean);
      const res = await ashramService.update(timesTargetId, {
        policies,
        rules: ruleList,
      });
      setPoliciesByAshram((prev) => ({
        ...prev,
        [timesTargetId]: res.data?.data?.policies ?? policies,
      }));
      setRulesByAshram((prev) => ({
        ...prev,
        [timesTargetId]: Array.isArray(res.data?.data?.rules)
          ? res.data.data.rules
          : ruleList,
      }));
      addNotification(
        "Rules & Policies Updated",
        "Pilgrims now see the updated guidelines and timings on your listing.",
        "success",
      );
    } catch (err) {
      addNotification(
        "Save Failed",
        getErrorMessage(err, "Could not update rules and policies."),
        "error",
      );
    } finally {
      setSavingTimes(false);
    }
  };

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
    setDescription("");
    setImages([]);
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
    setDescription(room.description || "");
    setImages(
      Array.isArray(room.images)
        ? room.images.filter((src: unknown) => typeof src === "string" && src)
        : [],
    );
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addNotification("Validation Error", "Give the room category a name.", "error");
      return;
    }
    if (uploadingImages) {
      addNotification(
        "Upload In Progress",
        "Wait for the room photos to finish uploading.",
        "error",
      );
      return;
    }
    if (images.length === 0) {
      addNotification(
        "Room Photos Required",
        "Add at least one photo so pilgrims can see the room before booking.",
        "error",
      );
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
          description: description.trim(),
          images,
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
          description: description.trim(),
          images,
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

  const handleAddImages = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const nonImage = files.find((file) => !file.type.startsWith("image/"));
    if (nonImage) {
      addNotification(
        "Upload Failed",
        `${nonImage.name} is not an image. Use JPG, PNG or WEBP photos.`,
        "error",
      );
      return;
    }
    setUploadingImages(true);
    let uploaded = 0;
    try {
      for (const file of files) {
        const url = await uploadService.file(file, "rooms");
        uploaded += 1;
        setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
      }
    } catch (err: any) {
      // uploadService raises plain Errors for size limits; show those as-is.
      addNotification(
        "Upload Failed",
        err?.isAxiosError || !err?.message
          ? getErrorMessage(err, "Could not upload this photo.")
          : err.message,
        "error",
      );
    } finally {
      setUploadingImages(false);
    }
    if (uploaded > 0)
      addNotification(
        "Photos Added",
        `${uploaded} room photo${uploaded === 1 ? "" : "s"} uploaded.`,
        "success",
      );
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
                aria-label="Select stay"
                className="px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value={ALL_ASHRAMS}>
                  All Stays ({myAshrams.length})
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

      {myAshrams.length > 0 && (
        <form
          onSubmit={handleSaveTimes}
          className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Clock size={16} className="text-[#0A4DA6]" /> Rules &amp;
                Policies
              </h2>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Guest guidelines and check-in / check-out timings shown to
                pilgrims on your ashram page.
              </p>
            </div>
            {selectedAshramId === ALL_ASHRAMS && myAshrams.length > 1 && (
              <select
                id="timings-ashram"
                aria-label="Ashram for rules and policies"
                value={timesTargetId}
                onChange={(e) => setTimesAshramId(e.target.value)}
                className="px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none cursor-pointer"
              >
                {myAshrams.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_14rem] gap-4 items-start">
            <div className="space-y-1">
              <label
                htmlFor="guest-guidelines"
                className="text-[10px] font-bold text-gray-400 block"
              >
                Guidelines for Guests (one per line)
              </label>
              <textarea
                id="guest-guidelines"
                rows={5}
                placeholder={"Strictly satvik vegetarian meals served.\nNo entry inside campus after 9:30 PM.\nModest clothing is mandatory."}
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none resize-y"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="check-in-time"
                  className="text-[10px] font-bold text-gray-400 block"
                >
                  Check-in Time
                </label>
                <input
                  id="check-in-time"
                  type="time"
                  required
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="check-out-time"
                  className="text-[10px] font-bold text-gray-400 block"
                >
                  Check-out Time
                </label>
                <input
                  id="check-out-time"
                  type="time"
                  required
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full text-xs font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!timesReady || savingTimes}
              className="shrink-0 px-5 py-2.5 bg-[#0A4DA6] text-white text-xs font-bold rounded-full hover:bg-opacity-95 shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingTimes ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {savingTimes ? "Saving..." : "Save Rules & Policies"}
            </button>
          </div>
        </form>
      )}

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
                  {room.description && (
                    <p className="text-[10px] text-gray-500 font-semibold mt-1 line-clamp-2 max-w-sm">
                      {room.description}
                    </p>
                  )}
                  <span
                    className={`mt-1 flex items-center gap-1 text-[9px] font-bold ${
                      room.images?.length ? "text-gray-400" : "text-amber-600"
                    }`}
                  >
                    <ImagePlus size={10} />
                    {room.images?.length
                      ? `${room.images.length} photo${room.images.length === 1 ? "" : "s"}`
                      : "No photos yet"}
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

              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="room-description"
                    className="text-xs font-bold text-gray-400"
                  >
                    Room Description
                  </label>
                  <span className="text-[10px] font-bold text-gray-400">
                    {description.length}/2000
                  </span>
                </div>
                <textarea
                  id="room-description"
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. Spacious room facing the Ganga with two single beds, attached Indian-style bathroom and hot water from 5 AM."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none resize-y"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-400">
                    Room Photos <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-bold ${images.length > 0 ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {images.length > 0
                      ? `${images.length} photo${images.length === 1 ? "" : "s"} added`
                      : "At least 1 photo required"}
                  </span>
                </div>
                <label
                  className={`w-full py-4 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all ${
                    uploadingImages
                      ? "border-gray-200 dark:border-slate-700 cursor-wait"
                      : "border-[#0A4DA6]/40 hover:border-[#0A4DA6] bg-blue-50/40 dark:bg-slate-800/40 cursor-pointer"
                  }`}
                >
                  {uploadingImages ? (
                    <span className="flex items-center gap-2 text-[#0A4DA6] font-bold text-xs">
                      <Loader2 size={16} className="animate-spin" /> Uploading
                      photos...
                    </span>
                  ) : (
                    <>
                      <ImagePlus size={20} className="text-[#0A4DA6]" />
                      <span className="text-xs font-extrabold text-[#0B192C] dark:text-white">
                        Upload room photos
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold text-center">
                        Show the bed, bathroom and facilities pilgrims will get.
                        JPG, PNG or WEBP under 10 MB each.
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingImages}
                    onChange={(e) => {
                      void handleAddImages(e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {images.map((src, idx) => (
                      <div
                        key={`${src}_${idx}`}
                        className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-900"
                      >
                        <img
                          src={src}
                          alt={`Room photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setImages((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`Remove room photo ${idx + 1}`}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
              disabled={submitting || uploadingImages}
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
