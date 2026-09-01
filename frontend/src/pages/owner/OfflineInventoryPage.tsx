import React, { useCallback, useEffect, useState } from "react";
import {
  BedDouble,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { ashramService, offlineInventoryService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";

type Tab = "rooms" | "history";

const getList = (response: any): any[] => {
  const value = response?.data?.data ?? response?.data ?? [];
  return Array.isArray(value) ? value : [];
};

const getId = (value: any) => String(value?._id || value?.id || value || "");

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const emptyRoom = {
  ashramId: "",
  roomId: "",
  label: "",
  totalUnits: "",
  blockedUnits: "0",
  status: "active",
  notes: "",
};

export const OfflineInventoryPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<Tab>("rooms");
  const [canManage, setCanManage] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyRoom);
  const [transferRoomCategories, setTransferRoomCategories] = useState<any[]>([]);
  const [transferTarget, setTransferTarget] = useState<any | null>(null);
  const [transferForm, setTransferForm] = useState({
    roomId: "",
    units: "1",
    fromDate: today(),
    toDate: inDays(7),
    reason: "",
  });

  const openTransferModal = async (row: any) => {
    setTransferTarget(row);
    const initialRoomId = getId(row.roomId);
    setTransferForm({
      roomId: initialRoomId,
      units: "1",
      fromDate: today(),
      toDate: inDays(7),
      reason: "",
    });

    const ashramId = getId(row.ashramId);
    if (ashramId) {
      try {
        const res = await ashramService.getManagedById(ashramId);
        const categories = res.data?.data?.rooms || [];
        setTransferRoomCategories(categories);
        if (categories.length > 0 && !initialRoomId) {
          setTransferForm((c) => ({ ...c, roomId: getId(categories[0]) }));
        }
      } catch {
        setTransferRoomCategories([]);
      }
    } else {
      setTransferRoomCategories([]);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, transfersRes, summaryRes, ashramsRes] =
        await Promise.all([
          offlineInventoryService.rooms(),
          offlineInventoryService.transfers(),
          offlineInventoryService.summary(),
          ashramService.myListings(),
        ]);
      setRooms(getList(roomsRes));
      setCanManage(Boolean(roomsRes.data?.canManage));
      setTransfers(getList(transfersRes));
      setSummary(summaryRes.data?.data ?? null);
      setAshrams(getList(ashramsRes));
    } catch (error) {
      addNotification(
        "Offline Inventory Unavailable",
        getErrorMessage(error, "Could not load offline inventory."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.ashramId) {
      setRoomTypes([]);
      return;
    }
    void (async () => {
      try {
        const res = await ashramService.getManagedById(form.ashramId);
        setRoomTypes(res.data?.data?.rooms ?? []);
      } catch {
        setRoomTypes([]);
      }
    })();
  }, [form.ashramId]);

  const openForm = (row?: any) => {
    if (row) {
      setEditing(row);
      setForm({
        ashramId: getId(row.ashramId),
        roomId: getId(row.roomId),
        label: row.label || "",
        totalUnits: String(row.totalUnits ?? ""),
        blockedUnits: String(row.blockedUnits ?? 0),
        status: row.status || "active",
        notes: row.notes || "",
      });
    } else {
      setEditing(null);
      setForm({
        ...emptyRoom,
        ashramId: ashrams.length === 1 ? getId(ashrams[0]) : "",
      });
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyRoom);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await offlineInventoryService.update(getId(editing), {
          label: form.label,
          totalUnits: Number(form.totalUnits),
          blockedUnits: Number(form.blockedUnits || 0),
          status: form.status,
          notes: form.notes,
        });
      } else {
        await offlineInventoryService.create({
          ashramId: form.ashramId,
          roomId: form.roomId,
          label: form.label,
          totalUnits: Number(form.totalUnits),
          blockedUnits: Number(form.blockedUnits || 0),
          status: form.status,
          notes: form.notes,
        });
      }
      addNotification(
        editing ? "Offline Room Updated" : "Offline Room Created",
        `${form.label} saved.`,
        "success",
      );
      closeForm();
      await load();
    } catch (error) {
      addNotification(
        "Not Saved",
        getErrorMessage(error, "Could not save this offline room."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (!window.confirm(`Remove offline room "${row.label}"?`)) return;
    try {
      await offlineInventoryService.remove(getId(row));
      addNotification("Offline Room Removed", `${row.label} removed.`, "success");
      await load();
    } catch (error) {
      addNotification(
        "Not Removed",
        getErrorMessage(error, "Could not remove this offline room."),
        "error",
      );
    }
  };

  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!transferTarget) return;
    setSaving(true);
    try {
      await offlineInventoryService.transfer(getId(transferTarget), {
        roomId: transferForm.roomId || undefined,
        units: Number(transferForm.units),
        fromDate: transferForm.fromDate,
        toDate: transferForm.toDate,
        reason: transferForm.reason || undefined,
      });
      addNotification(
        "Moved to Tirvona",
        `${transferForm.units} unit(s) added to Tirvona inventory.`,
        "success",
      );
      setTransferTarget(null);
      await load();
    } catch (error) {
      addNotification(
        "Transfer Failed",
        getErrorMessage(error, "Could not transfer these units."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#0A4DA6]";
  const card =
    "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px]";

  return (
    <div className="space-y-6 w-full text-left">
      <EnterprisePageHeader
        title="Offline Rooms & Inventory"
        subtitle="Rooms and beds held back from Tirvona. Move them online whenever you need extra capacity."
        icon={<BedDouble size={22} />}
        actions={
          <>
          {!canManage && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] font-extrabold">
              <Eye size={13} /> Read-only
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
          {canManage && (
            <button
              onClick={() => openForm()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold"
            >
              <Plus size={14} /> Add offline room
            </button>
          )}
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Offline rooms", summary.offlineRooms],
            ["Offline total units", summary.totalUnits],
            ["Available offline", summary.availableUnits],
            ["Moved to Tirvona online", summary.transferredUnits],
          ].map(([label, value]) => (
            <div key={String(label)} className={`${card} p-4`}>
              <p className="text-[10px] uppercase font-black text-gray-400">
                {label}
              </p>
              <p className="text-2xl font-black text-[#0B192C] dark:text-white mt-1">
                {Number(value ?? 0)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {(
          [
            ["rooms", `Offline rooms (${rooms.length})`],
            ["history", `Transfer history (${transfers.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-full text-xs font-extrabold ${
              tab === key
                ? "bg-[#0A4DA6] text-white"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={`${card} p-12 flex justify-center`}>
          <Loader2 size={22} className="animate-spin text-[#0A4DA6]" />
        </div>
      ) : tab === "rooms" ? (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-900/60">
                <tr className="text-[10px] uppercase font-black text-gray-400">
                  <th className="py-3 px-4 whitespace-nowrap">Offline room</th>
                  <th className="py-3 px-4 whitespace-nowrap">Room type</th>
                  <th className="py-3 px-4 whitespace-nowrap">Ashram</th>
                  <th className="py-3 px-4 whitespace-nowrap">Offline total</th>
                  <th className="py-3 px-4 whitespace-nowrap">Available offline</th>
                  <th className="py-3 px-4 whitespace-nowrap">Moved to Tirvona online</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rooms.map((row) => (
                  <tr key={getId(row)} className="text-xs">
                    <td className="py-3.5 px-4 font-extrabold text-[#0B192C] dark:text-white">
                      {row.label}
                      {row.notes && (
                        <span className="block text-[10px] font-normal text-gray-400">
                          {row.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{row.roomId?.name || "—"}</td>
                    <td className="py-3.5 px-4">{row.ashramId?.name || "—"}</td>
                    <td className="py-3.5 px-4 font-bold">{row.totalUnits}</td>
                    <td className="py-3.5 px-4 font-black text-emerald-600">
                      {row.availableUnits}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0A4DA6]">
                      {row.transferredUnits || 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          row.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {canManage ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => openTransferModal(row)}
                            disabled={row.availableUnits <= 0}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0A4DA6] text-white text-[10px] font-extrabold disabled:opacity-40"
                          >
                            Transfer to Tirvona
                          </button>
                          <button
                            onClick={() => openForm(row)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => remove(row)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-400">
                          View only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!rooms.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-xs font-bold text-gray-400"
                    >
                      No offline rooms yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/60">
                <tr className="text-[10px] uppercase font-black text-gray-400">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Offline room</th>
                  <th className="py-3 px-4">Units</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Offline left</th>
                  <th className="py-3 px-4">By</th>
                  <th className="py-3 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {transfers.map((row) => (
                  <tr key={getId(row)} className="text-xs">
                    <td className="py-3.5 px-4 font-extrabold text-[#0B192C] dark:text-white">
                      {row.reference}
                    </td>
                    <td className="py-3.5 px-4">
                      {row.offlineRoomId?.label || "—"}
                      <span className="block text-[10px] text-gray-400">
                        {row.roomId?.name || ""}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-[#0A4DA6]">
                      +{row.units}
                    </td>
                    <td className="py-3.5 px-4">
                      {new Date(row.fromDate).toLocaleDateString()} –{" "}
                      {new Date(row.toDate).toLocaleDateString()}
                      <span className="block text-[10px] text-gray-400">
                        {row.datesCovered} night(s)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {row.offlineAvailableBefore} → {row.offlineAvailableAfter}
                    </td>
                    <td className="py-3.5 px-4">
                      {row.performedBy?.name || "—"}
                      <span className="block text-[10px] text-gray-400">
                        {row.performedByRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {row.reason || "—"}
                    </td>
                  </tr>
                ))}
                {!transfers.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-xs font-bold text-gray-400"
                    >
                      No transfers recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && canManage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <form
            onSubmit={save}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-4"
          >
            <div className="flex justify-between items-start">
              <h2 className="font-black text-lg text-[#0B192C] dark:text-white">
                {editing ? "Edit offline room" : "Add offline room"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <select
                required
                disabled={Boolean(editing)}
                value={form.ashramId}
                onChange={(e) =>
                  setForm((c) => ({ ...c, ashramId: e.target.value, roomId: "" }))
                }
                className={`${field} disabled:opacity-60`}
              >
                <option value="">Select ashram</option>
                {ashrams.map((a) => (
                  <option key={getId(a)} value={getId(a)}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                required
                disabled={Boolean(editing)}
                value={form.roomId}
                onChange={(e) => setForm((c) => ({ ...c, roomId: e.target.value }))}
                className={`${field} disabled:opacity-60`}
              >
                <option value="">Select room type</option>
                {roomTypes.map((r) => (
                  <option key={getId(r)} value={getId(r)}>
                    {r.name} ({r.type})
                  </option>
                ))}
              </select>
              <input
                required
                value={form.label}
                onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
                placeholder="Label (e.g. Reserved dorm beds)"
                className={field}
              />
              <input
                required
                type="number"
                min={0}
                value={form.totalUnits}
                onChange={(e) =>
                  setForm((c) => ({ ...c, totalUnits: e.target.value }))
                }
                placeholder="Total offline units"
                className={field}
              />
              <input
                type="number"
                min={0}
                value={form.blockedUnits}
                onChange={(e) =>
                  setForm((c) => ({ ...c, blockedUnits: e.target.value }))
                }
                placeholder="Blocked units"
                className={field}
              />
              <select
                value={form.status}
                onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
                className={field}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className={field}
            />
            <button
              disabled={saving}
              className="w-full py-3 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin mx-auto" />
              ) : editing ? (
                "Save changes"
              ) : (
                "Create offline room"
              )}
            </button>
          </form>
        </div>
      )}

      {transferTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <form
            onSubmit={submitTransfer}
            className="w-full max-w-lg bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-black text-lg text-[#0B192C] dark:text-white">
                  Transfer to Tirvona
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {transferTarget.label} · {transferTarget.availableUnits}{" "}
                  available offline
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferTarget(null)}
                className="p-2 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Target Room Category
              </label>
              <select
                required
                value={transferForm.roomId}
                onChange={(e) =>
                  setTransferForm((c) => ({ ...c, roomId: e.target.value }))
                }
                className={field}
              >
                {transferRoomCategories.length === 0 ? (
                  <option value={getId(transferTarget.roomId)}>
                    {transferTarget.roomId?.name || transferTarget.label || "Default Category"}
                  </option>
                ) : (
                  transferRoomCategories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name} ({cat.totalInventory ?? cat.totalRooms ?? 0} total rooms)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required
                type="number"
                min={1}
                max={transferTarget.availableUnits}
                value={transferForm.units}
                onChange={(e) =>
                  setTransferForm((c) => ({ ...c, units: e.target.value }))
                }
                placeholder="Units to move"
                className={field}
              />
              <input
                required
                type="date"
                value={transferForm.fromDate}
                onChange={(e) =>
                  setTransferForm((c) => ({ ...c, fromDate: e.target.value }))
                }
                className={field}
              />
              <input
                required
                type="date"
                value={transferForm.toDate}
                onChange={(e) =>
                  setTransferForm((c) => ({ ...c, toDate: e.target.value }))
                }
                className={field}
              />
              <input
                value={transferForm.reason}
                onChange={(e) =>
                  setTransferForm((c) => ({ ...c, reason: e.target.value }))
                }
                placeholder="Reason (optional)"
                className={field}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              These units are added to Tirvona availability for every night in the
              range and removed from your offline pool. The move is recorded in
              transfer history.
            </p>
            <button
              disabled={saving}
              className="w-full py-3 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin mx-auto" />
              ) : (
                "Move into Tirvona inventory"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default OfflineInventoryPage;
