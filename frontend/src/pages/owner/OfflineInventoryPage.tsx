import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  BedDouble,
  Check,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { ashramService, offlineInventoryService } from "../../services";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";
import { EnterprisePageHeader } from "../../admin/shared/components/EnterprisePageHeader";

type Tab = "rooms" | "history" | "returns";

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

const STATUS_BADGE: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  cancelled:
    "bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-gray-400",
};

export const OfflineInventoryPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    const qTab = params.get("tab");
    return qTab === "returns" || qTab === "history" ? qTab : "rooms";
  });
  const [canManage, setCanManage] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [returnReqs, setReturnReqs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [ashrams, setAshrams] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyRoom);
  const [transferRoomCategories, setTransferRoomCategories] = useState<any[]>(
    [],
  );
  const [transferTarget, setTransferTarget] = useState<any | null>(null);
  const [transferForm, setTransferForm] = useState({
    roomId: "",
    units: "1",
    fromDate: today(),
    toDate: inDays(7),
    reason: "",
  });

  // ── Return request state ────────────────────────────────────────────────
  const [returnTarget, setReturnTarget] = useState<any | null>(null);
  const [returnForm, setReturnForm] = useState({
    units: "1",
    fromDate: today(),
    toDate: inDays(7),
    reason: "",
  });
  const [decideTarget, setDecideTarget] = useState<any | null>(null);
  const [decideAction, setDecideAction] = useState<"approve" | "reject">(
    "approve",
  );
  const [decideReason, setDecideReason] = useState("");

  // ── Direct return from online inventory state ───────────────────────────
  const [directReturnOpen, setDirectReturnOpen] = useState(false);
  const [directReturnForm, setDirectReturnForm] = useState({
    ashramId: "",
    roomId: "",
    units: "1",
    fromDate: today(),
    toDate: inDays(3),
    reason: "",
  });
  const [directRoomCategories, setDirectRoomCategories] = useState<any[]>([]);

  const openDirectReturnModal = async (initialAshramId?: string, initialRoomId?: string) => {
    const aid = initialAshramId || (ashrams.length > 0 ? getId(ashrams[0]) : "");
    setDirectReturnForm({
      ashramId: aid,
      roomId: initialRoomId || "",
      units: "1",
      fromDate: today(),
      toDate: inDays(3),
      reason: "",
    });
    setDirectReturnOpen(true);
    if (aid) {
      try {
        const res = await ashramService.getManagedById(aid);
        const categories = res.data?.data?.rooms || [];
        setDirectRoomCategories(categories);
        if (categories.length > 0 && !initialRoomId) {
          setDirectReturnForm((c) => ({ ...c, roomId: getId(categories[0]) }));
        }
      } catch {
        setDirectRoomCategories([]);
      }
    }
  };

  const handleDirectAshramChange = async (aid: string) => {
    setDirectReturnForm((c) => ({ ...c, ashramId: aid, roomId: "" }));
    if (aid) {
      try {
        const res = await ashramService.getManagedById(aid);
        const categories = res.data?.data?.rooms || [];
        setDirectRoomCategories(categories);
        if (categories.length > 0) {
          setDirectReturnForm((c) => ({ ...c, roomId: getId(categories[0]) }));
        }
      } catch {
        setDirectRoomCategories([]);
      }
    } else {
      setDirectRoomCategories([]);
    }
  };

  const submitDirectReturnRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!directReturnForm.ashramId || !directReturnForm.roomId) return;
    setSaving(true);
    try {
      await offlineInventoryService.requestDirectReturn({
        ashramId: directReturnForm.ashramId,
        roomId: directReturnForm.roomId,
        units: Number(directReturnForm.units),
        fromDate: directReturnForm.fromDate,
        toDate: directReturnForm.toDate,
        reason: directReturnForm.reason || undefined,
      });
      addNotification(
        "Return Request Submitted",
        `Requested ${directReturnForm.units} unit(s) from Tirvona online inventory. Awaiting admin approval.`,
        "success",
      );
      setDirectReturnOpen(false);
      await load();
      setTab("returns");
    } catch (error) {
      addNotification(
        "Return Request Failed",
        getErrorMessage(error, "Could not submit return request."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

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

  const openReturnModal = (row: any) => {
    setReturnTarget(row);
    setReturnForm({
      units: "1",
      fromDate: today(),
      toDate: inDays(7),
      reason: "",
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, transfersRes, summaryRes, ashramsRes, returnsRes] =
        await Promise.all([
          offlineInventoryService.rooms(),
          offlineInventoryService.transfers(),
          offlineInventoryService.summary(),
          ashramService.myListings(),
          offlineInventoryService.returnRequests(),
        ]);
      setRooms(getList(roomsRes));
      setCanManage(Boolean(roomsRes.data?.canManage));
      setTransfers(getList(transfersRes));
      setSummary(summaryRes.data?.data ?? null);
      setAshrams(getList(ashramsRes));
      setReturnReqs(getList(returnsRes));
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

  // ── Return request handlers ─────────────────────────────────────────────

  const submitReturnRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!returnTarget) return;
    setSaving(true);
    try {
      await offlineInventoryService.requestReturn(getId(returnTarget), {
        units: Number(returnForm.units),
        fromDate: returnForm.fromDate,
        toDate: returnForm.toDate,
        reason: returnForm.reason || undefined,
      });
      addNotification(
        "Return Request Submitted",
        `Requested ${returnForm.units} unit(s) back from Tirvona. Awaiting admin approval.`,
        "success",
      );
      setReturnTarget(null);
      await load();
    } catch (error) {
      addNotification(
        "Request Failed",
        getErrorMessage(error, "Could not submit return request."),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelReturn = async (row: any) => {
    if (!window.confirm(`Cancel return request ${row.reference}?`)) return;
    try {
      await offlineInventoryService.cancelReturnRequest(getId(row));
      addNotification(
        "Request Cancelled",
        `${row.reference} has been cancelled.`,
        "success",
      );
      await load();
    } catch (error) {
      addNotification(
        "Not Cancelled",
        getErrorMessage(error, "Could not cancel this request."),
        "error",
      );
    }
  };

  const submitDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!decideTarget) return;
    setSaving(true);
    try {
      await offlineInventoryService.decideReturnRequest(getId(decideTarget), {
        action: decideAction,
        rejectionReason: decideAction === "reject" ? decideReason : undefined,
      });
      addNotification(
        decideAction === "approve"
          ? "Request Approved"
          : "Request Rejected",
        `${decideTarget.reference} has been ${decideAction === "approve" ? "approved" : "rejected"}.`,
        "success",
      );
      setDecideTarget(null);
      setDecideReason("");
      await load();
    } catch (error) {
      addNotification(
        "Decision Failed",
        getErrorMessage(error, "Could not process this decision."),
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

  const pendingReturns = returnReqs.filter((r) => r.status === "pending").length;

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
            <>
              <button
                onClick={() => openDirectReturnModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-400 bg-white dark:bg-[#0B192C] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-extrabold shadow-sm transition"
              >
                <ArrowDownLeft size={14} /> Request rooms from Tirvona
              </button>
              <button
                onClick={() => openForm()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0A4DA6] hover:bg-[#083D84] text-white text-xs font-extrabold shadow-sm transition"
              >
                <Plus size={14} /> Add offline room
              </button>
            </>
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
            [
              "returns",
              `Return requests (${returnReqs.length})${pendingReturns > 0 ? ` · ${pendingReturns} pending` : ""}`,
            ],
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
        /* ─── Rooms tab ──────────────────────────────────────────────────── */
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
                            onClick={() => openReturnModal(row)}
                            disabled={
                              !row.transferredUnits || row.transferredUnits <= 0
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[10px] font-extrabold disabled:opacity-40 transition"
                          >
                            Request rooms back
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
                      <p className="mb-2">No offline rooms yet.</p>
                      {canManage && (
                        <div className="flex justify-center items-center gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => openDirectReturnModal()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[#0A4DA6] text-[#0A4DA6] dark:text-blue-400 bg-white dark:bg-[#0B192C] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-extrabold shadow-sm transition"
                          >
                            <ArrowDownLeft size={14} /> Request rooms from Tirvona
                          </button>
                          <button
                            type="button"
                            onClick={() => openForm()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4DA6] hover:bg-[#083D84] text-white text-xs font-extrabold transition"
                          >
                            <Plus size={14} /> Add offline room
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "history" ? (
        /* ─── Transfer history tab ───────────────────────────────────────── */
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
      ) : (
        /* ─── Return requests tab ────────────────────────────────────────── */
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/60">
                <tr className="text-[10px] uppercase font-black text-gray-400">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Offline room</th>
                  <th className="py-3 px-4">Units</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Requested by</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {returnReqs.map((row) => (
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
                    <td className="py-3.5 px-4 font-black text-amber-600">
                      −{row.units}
                    </td>
                    <td className="py-3.5 px-4">
                      {new Date(row.fromDate).toLocaleDateString()} –{" "}
                      {new Date(row.toDate).toLocaleDateString()}
                      <span className="block text-[10px] text-gray-400">
                        {row.datesCovered} night(s)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          STATUS_BADGE[row.status] ?? STATUS_BADGE.cancelled
                        }`}
                      >
                        {row.status}
                      </span>
                      {row.status === "rejected" && row.rejectionReason && (
                        <span className="block text-[10px] text-rose-500 mt-0.5">
                          {row.rejectionReason}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {row.requestedBy?.name || "—"}
                      <span className="block text-[10px] text-gray-400">
                        {row.requestedByRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 max-w-[180px] truncate">
                      {row.reason || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.status === "pending" && !canManage && (
                          <>
                            <button
                              onClick={() => {
                                setDecideTarget(row);
                                setDecideAction("approve");
                                setDecideReason("");
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-extrabold"
                            >
                              <Check size={10} className="inline -mt-0.5 mr-0.5" /> Approve
                            </button>
                            <button
                              onClick={() => {
                                setDecideTarget(row);
                                setDecideAction("reject");
                                setDecideReason("");
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-extrabold"
                            >
                              <XCircle size={10} className="inline -mt-0.5 mr-0.5" /> Reject
                            </button>
                          </>
                        )}
                        {row.status === "pending" && canManage && (
                          <button
                            onClick={() => cancelReturn(row)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-[10px] font-extrabold text-gray-600 dark:text-gray-300"
                          >
                            Cancel
                          </button>
                        )}
                        {row.status !== "pending" && (
                          <span className="text-[10px] font-bold text-gray-400">
                            {row.decidedBy?.name
                              ? `by ${row.decidedBy.name}`
                              : "—"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!returnReqs.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-xs font-bold text-gray-400"
                    >
                      No return requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Add / Edit offline room modal ──────────────────────────────── */}
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

      {/* ─── Transfer to Tirvona modal ──────────────────────────────────── */}
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

      {/* ─── Request rooms back modal ───────────────────────────────────── */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <form
            onSubmit={submitReturnRequest}
            className="w-full max-w-lg bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-black text-lg text-[#0B192C] dark:text-white">
                  <ArrowDownLeft
                    size={18}
                    className="inline -mt-0.5 mr-1 text-amber-600"
                  />
                  Request Rooms Back
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {returnTarget.label} · {returnTarget.transferredUnits || 0}{" "}
                  unit(s) currently with Tirvona
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="p-2 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required
                type="number"
                min={1}
                max={returnTarget.transferredUnits || 1}
                value={returnForm.units}
                onChange={(e) =>
                  setReturnForm((c) => ({ ...c, units: e.target.value }))
                }
                placeholder="Units to request back"
                className={field}
              />
              <input
                required
                type="date"
                value={returnForm.fromDate}
                onChange={(e) =>
                  setReturnForm((c) => ({ ...c, fromDate: e.target.value }))
                }
                className={field}
              />
              <input
                required
                type="date"
                value={returnForm.toDate}
                onChange={(e) =>
                  setReturnForm((c) => ({ ...c, toDate: e.target.value }))
                }
                className={field}
              />
              <input
                value={returnForm.reason}
                onChange={(e) =>
                  setReturnForm((c) => ({ ...c, reason: e.target.value }))
                }
                placeholder="Reason (optional)"
                className={field}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              This sends a request to the Super Admin. Once approved, the selected
              units are removed from Tirvona online inventory for the specified
              date range and returned to your offline pool.
            </p>
            <button
              disabled={saving}
              className="w-full py-3 rounded-full bg-[#0A4DA6] hover:bg-[#083D84] text-white text-xs font-extrabold disabled:opacity-60 transition shadow-sm"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin mx-auto" />
              ) : (
                "Submit return request"
              )}
            </button>
          </form>
        </div>
      )}

      {/* ─── Admin approve / reject modal ───────────────────────────────── */}
      {decideTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <form
            onSubmit={submitDecision}
            className="w-full max-w-md bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-black text-lg text-[#0B192C] dark:text-white">
                  {decideAction === "approve"
                    ? "Approve Return Request"
                    : "Reject Return Request"}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {decideTarget.reference} · {decideTarget.units} unit(s) ·{" "}
                  {decideTarget.offlineRoomId?.label || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDecideTarget(null)}
                className="p-2 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            {decideAction === "approve" ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-bold mb-1">Confirm approval</p>
                <p>
                  This will remove {decideTarget.units} unit(s) from Tirvona
                  online inventory for{" "}
                  {new Date(decideTarget.fromDate).toLocaleDateString()} –{" "}
                  {new Date(decideTarget.toDate).toLocaleDateString()} (
                  {decideTarget.datesCovered} night(s)) and return them to the
                  owner's offline pool.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-4 text-xs text-rose-800 dark:text-rose-300">
                  <p className="font-bold">This request will be rejected.</p>
                </div>
                <textarea
                  rows={3}
                  required
                  value={decideReason}
                  onChange={(e) => setDecideReason(e.target.value)}
                  placeholder="Reason for rejection (required)"
                  className={field}
                />
              </div>
            )}

            <button
              disabled={saving}
              className={`w-full py-3 rounded-full text-white text-xs font-extrabold disabled:opacity-60 ${
                decideAction === "approve" ? "bg-emerald-600" : "bg-rose-600"
              }`}
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin mx-auto" />
              ) : decideAction === "approve" ? (
                "Confirm approval"
              ) : (
                "Reject request"
              )}
            </button>
          </form>
        </div>
      )}

      {/* ─── Direct Request rooms from Tirvona modal ───────────────────── */}
      {directReturnOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <form
            onSubmit={submitDirectReturnRequest}
            className="w-full max-w-lg bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-black text-lg text-[#0B192C] dark:text-white flex items-center gap-1.5">
                  <ArrowDownLeft size={18} className="text-amber-600" />
                  Request Rooms From Tirvona
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Reclaim rooms directly from Tirvona online inventory for a temporary date range.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectReturnOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Stay / Property
                </label>
                <select
                  required
                  value={directReturnForm.ashramId}
                  onChange={(e) => handleDirectAshramChange(e.target.value)}
                  className={field}
                >
                  <option value="">Select Stay / Property</option>
                  {ashrams.map((a) => (
                    <option key={getId(a)} value={getId(a)}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Room Category (Online on Tirvona)
                </label>
                <select
                  required
                  value={directReturnForm.roomId}
                  onChange={(e) =>
                    setDirectReturnForm((c) => ({ ...c, roomId: e.target.value }))
                  }
                  className={field}
                >
                  <option value="">Select Room Category</option>
                  {directRoomCategories.map((cat) => (
                    <option key={getId(cat)} value={getId(cat)}>
                      {cat.name} ({cat.totalInventory ?? cat.totalRooms ?? 0} total rooms)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                    Rooms to request back
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={
                      directRoomCategories.find(
                        (c) => getId(c) === directReturnForm.roomId,
                      )?.totalInventory ?? 100
                    }
                    value={directReturnForm.units}
                    onChange={(e) =>
                      setDirectReturnForm((c) => ({
                        ...c,
                        units: e.target.value,
                      }))
                    }
                    placeholder="e.g. 10"
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    value={directReturnForm.reason}
                    onChange={(e) =>
                      setDirectReturnForm((c) => ({
                        ...c,
                        reason: e.target.value,
                      }))
                    }
                    placeholder="e.g. Wedding walk-ins"
                    className={field}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                    From Date
                  </label>
                  <input
                    required
                    type="date"
                    value={directReturnForm.fromDate}
                    onChange={(e) =>
                      setDirectReturnForm((c) => ({
                        ...c,
                        fromDate: e.target.value,
                      }))
                    }
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                    To Date
                  </label>
                  <input
                    required
                    type="date"
                    value={directReturnForm.toDate}
                    onChange={(e) =>
                      setDirectReturnForm((c) => ({
                        ...c,
                        toDate: e.target.value,
                      }))
                    }
                    className={field}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-3 text-[11px] text-blue-900 dark:text-blue-300">
              This request will be sent to the Super Admin for approval. Once approved, the selected rooms will be deducted from Tirvona's online availability for the chosen dates and allocated to your offline inventory.
            </div>

            <button
              disabled={saving || !directReturnForm.ashramId || !directReturnForm.roomId}
              className="w-full py-3 rounded-full bg-[#0A4DA6] hover:bg-[#083D84] text-white text-xs font-extrabold disabled:opacity-60 transition shadow-sm"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin mx-auto" />
              ) : (
                "Submit Request to Tirvona"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default OfflineInventoryPage;
