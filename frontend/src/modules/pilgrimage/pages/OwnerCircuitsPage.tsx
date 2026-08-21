import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Compass,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Route,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { pilgrimageOwnerService } from "../services/pilgrimage.service";
import {
  CIRCUIT_DIFFICULTIES,
  CIRCUIT_SEASONS,
  CIRCUIT_TYPES,
  CIRCUIT_TYPE_LABELS,
  STOP_TYPES,
  type CircuitStop,
  type PilgrimageCircuit,
} from "../types/pilgrimage.types";
import {
  circuitStatusLabel,
  circuitStatusStyle,
  difficultyLabel,
  formatDistance,
  formatDuration,
  seasonLabel,
  stopTypeLabel,
} from "../utils/pilgrimageFormat";

interface Ashram {
  _id: string;
  name: string;
  address?: { city?: string; state?: string };
}

const CARD =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";
const INPUT =
  "w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all";
const LABEL =
  "mb-1.5 block px-1 text-[10px] tracking-wider font-bold text-gray-400";

const emptyCircuit = {
  ashramId: "",
  name: "",
  circuitType: "temple_trail",
  summary: "",
  description: "",
  startCity: "",
  endCity: "",
  state: "",
  durationDays: 3,
  difficulty: "moderate",
  bestSeasons: [] as string[],
  travelTips: "",
  coverImage: "",
  usableAsPlannerTemplate: true,
};

const emptyStop = {
  name: "",
  stopType: "temple",
  dayNumber: 1,
  city: "",
  state: "",
  distanceFromPreviousKm: 0,
  travelMinutes: 0,
  suggestedDurationMinutes: 60,
  notes: "",
  isOvernightStop: false,
};

export const OwnerCircuitsPage: React.FC = () => {
  const [ashrams, setAshrams] = useState<Ashram[]>([]);
  const [circuits, setCircuits] = useState<PilgrimageCircuit[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PilgrimageCircuit | null>(null);
  const [form, setForm] = useState({ ...emptyCircuit });
  const [saving, setSaving] = useState(false);

  const [stopsFor, setStopsFor] = useState<PilgrimageCircuit | null>(null);
  const [stops, setStops] = useState<CircuitStop[]>([]);
  const [stopForm, setStopForm] = useState({ ...emptyStop });
  const [editingStop, setEditingStop] = useState<CircuitStop | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await pilgrimageOwnerService.listCircuits({
        status: statusFilter || undefined,
        limit: 100,
      });
      setCircuits(response.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load your circuits."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    pilgrimageOwnerService
      .ashrams()
      .then((response) => setAshrams(response.data?.data ?? []))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyCircuit, ashramId: ashrams[0]?._id ?? "" });
    setShowForm(true);
  };

  const openEdit = (circuit: PilgrimageCircuit) => {
    setEditing(circuit);
    setForm({
      ashramId:
        typeof circuit.ashramId === "object"
          ? circuit.ashramId._id
          : (circuit.ashramId ?? ""),
      name: circuit.name,
      circuitType: circuit.circuitType,
      summary: circuit.summary ?? "",
      description: circuit.description ?? "",
      startCity: circuit.startCity ?? "",
      endCity: circuit.endCity ?? "",
      state: circuit.state ?? "",
      durationDays: circuit.durationDays,
      difficulty: circuit.difficulty ?? "moderate",
      bestSeasons: circuit.bestSeasons ?? [],
      travelTips: circuit.travelTips ?? "",
      coverImage: circuit.coverImage ?? "",
      usableAsPlannerTemplate: circuit.usableAsPlannerTemplate !== false,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        const { ashramId: _ignored, ...payload } = form;
        await pilgrimageOwnerService.updateCircuit(editing._id, payload);
      } else {
        await pilgrimageOwnerService.createCircuit(form);
      }
      setShowForm(false);
      await load();
    } catch {
      // Reported by the toast interceptor.
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (circuit: PilgrimageCircuit) => {
    await pilgrimageOwnerService
      .submitCircuit(circuit._id)
      .catch(() => undefined);
    await load();
  };

  const archive = async (circuit: PilgrimageCircuit) => {
    if (!window.confirm(`Archive "${circuit.name}"?`)) return;
    await pilgrimageOwnerService
      .archiveCircuit(circuit._id)
      .catch(() => undefined);
    await load();
  };

  const openStops = async (circuit: PilgrimageCircuit) => {
    setStopsFor(circuit);
    setEditingStop(null);
    setStopForm({ ...emptyStop });
    const response = await pilgrimageOwnerService.getCircuit(circuit._id);
    setStops(response.data?.data?.stops ?? []);
  };

  const saveStop = async () => {
    if (!stopsFor) return;
    try {
      if (editingStop) {
        await pilgrimageOwnerService.updateStop(editingStop._id, stopForm);
      } else {
        await pilgrimageOwnerService.addStop({
          ...stopForm,
          circuitId: stopsFor._id,
        });
      }
      setEditingStop(null);
      setStopForm({ ...emptyStop });
      await openStops(stopsFor);
      await load();
    } catch {
      // Reported by the toast interceptor.
    }
  };

  const deleteStop = async (stop: CircuitStop) => {
    if (!stopsFor) return;
    if (!window.confirm(`Remove the "${stop.name}" stop?`)) return;
    await pilgrimageOwnerService.deleteStop(stop._id).catch(() => undefined);
    await openStops(stopsFor);
    await load();
  };

  const toggleSeason = (season: string) =>
    setForm((current) => ({
      ...current,
      bestSeasons: current.bestSeasons.includes(season)
        ? current.bestSeasons.filter((value) => value !== season)
        : [...current.bestSeasons, season],
    }));

  const canSave = useMemo(
    () =>
      Boolean(
        form.name.trim() && form.durationDays > 0 && (editing || form.ashramId),
      ),
    [form, editing],
  );

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Pilgrimage Circuits"
        subtitle="Map your sacred routes day by day. Approved circuits also feed the public itinerary planner."
        icon={<Compass size={22} />}
        actions={
          <>
            <select
              value={statusFilter}
              onChange={(changeEvent) => setStatusFilter(changeEvent.target.value)}
              className={INPUT}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">In review</option>
              <option value="approved">Live</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} /> New circuit
            </button>
          </>
        }
      />

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      ) : loading ? (
        <div className={`${CARD} p-12 flex items-center justify-center gap-3`}>
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : circuits.length === 0 ? (
        <div className={`${CARD} p-12 text-center space-y-3`}>
          <Compass size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No circuits yet
          </h3>
          <p className="text-xs text-gray-400 font-semibold leading-relaxed">
            Create a route, add its stops, then submit it for review.
          </p>
        </div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Circuit</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Length</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {circuits.map((circuit) => (
                <tr key={circuit._id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#0B192C] dark:text-white">
                      {circuit.name}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {CIRCUIT_TYPE_LABELS[circuit.circuitType]} ·{" "}
                      {difficultyLabel(circuit.difficulty)}
                    </p>
                    {circuit.status === "rejected" && circuit.rejectionReason ? (
                      <p className="mt-1 text-[10px] font-bold text-rose-600">
                        {circuit.rejectionReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {circuit.startCity || "—"}
                    {circuit.endCity && circuit.endCity !== circuit.startCity
                      ? ` → ${circuit.endCity}`
                      : ""}
                    <span className="block text-[10px] font-bold text-gray-400">
                      {formatDistance(circuit.totalDistanceKm)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {formatDuration(circuit.durationDays)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {circuit.stopCount ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${circuitStatusStyle(circuit.status)}`}
                    >
                      {circuitStatusLabel(circuit.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        title="Manage stops"
                        onClick={() => openStops(circuit)}
                        className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Route size={14} />
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEdit(circuit)}
                        className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {["draft", "rejected"].includes(circuit.status) ? (
                        <button
                          type="button"
                          title="Submit for review"
                          onClick={() => submitForReview(circuit)}
                          className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 transition-all active:scale-90 cursor-pointer"
                        >
                          <Send size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Archive"
                        onClick={() => archive(circuit)}
                        className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 transition-all active:scale-90 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-3xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#0B192C] dark:text-white">
                {editing ? "Edit circuit" : "New circuit"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {!editing ? (
                <div className="sm:col-span-2">
                  <label htmlFor="circuit-ashram" className={LABEL}>
                    Ashram
                  </label>
                  <select
                    id="circuit-ashram"
                    value={form.ashramId}
                    onChange={(changeEvent) =>
                      setForm({ ...form, ashramId: changeEvent.target.value })
                    }
                    className={INPUT}
                  >
                    <option value="">Select an ashram</option>
                    {ashrams.map((ashram) => (
                      <option key={ashram._id} value={ashram._id}>
                        {ashram.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <label htmlFor="circuit-name" className={LABEL}>
                  Circuit name
                </label>
                <input
                  id="circuit-name"
                  value={form.name}
                  onChange={(changeEvent) =>
                    setForm({ ...form, name: changeEvent.target.value })
                  }
                  placeholder="e.g. Char Dham Yatra"
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="circuit-type-field" className={LABEL}>
                  Type
                </label>
                <select
                  id="circuit-type-field"
                  value={form.circuitType}
                  onChange={(changeEvent) =>
                    setForm({ ...form, circuitType: changeEvent.target.value })
                  }
                  className={INPUT}
                >
                  {CIRCUIT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CIRCUIT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="circuit-difficulty" className={LABEL}>
                  Difficulty
                </label>
                <select
                  id="circuit-difficulty"
                  value={form.difficulty}
                  onChange={(changeEvent) =>
                    setForm({ ...form, difficulty: changeEvent.target.value })
                  }
                  className={INPUT}
                >
                  {CIRCUIT_DIFFICULTIES.map((value) => (
                    <option key={value} value={value}>
                      {difficultyLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="circuit-days" className={LABEL}>
                  Duration (days)
                </label>
                <input
                  id="circuit-days"
                  type="number"
                  min={1}
                  max={60}
                  value={form.durationDays}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      durationDays: Number(changeEvent.target.value) || 1,
                    })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="circuit-state" className={LABEL}>
                  State
                </label>
                <input
                  id="circuit-state"
                  value={form.state}
                  onChange={(changeEvent) =>
                    setForm({ ...form, state: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="circuit-start" className={LABEL}>
                  Start city
                </label>
                <input
                  id="circuit-start"
                  value={form.startCity}
                  onChange={(changeEvent) =>
                    setForm({ ...form, startCity: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="circuit-end" className={LABEL}>
                  End city
                </label>
                <input
                  id="circuit-end"
                  value={form.endCity}
                  onChange={(changeEvent) =>
                    setForm({ ...form, endCity: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="circuit-cover" className={LABEL}>
                  Cover image URL
                </label>
                <input
                  id="circuit-cover"
                  value={form.coverImage}
                  onChange={(changeEvent) =>
                    setForm({ ...form, coverImage: changeEvent.target.value })
                  }
                  placeholder="https://…"
                  className={INPUT}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="circuit-summary" className={LABEL}>
                  Short summary
                </label>
                <input
                  id="circuit-summary"
                  value={form.summary}
                  onChange={(changeEvent) =>
                    setForm({ ...form, summary: changeEvent.target.value })
                  }
                  placeholder="One line shown on the circuit card"
                  className={INPUT}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="circuit-description" className={LABEL}>
                  Description
                </label>
                <textarea
                  id="circuit-description"
                  rows={3}
                  value={form.description}
                  onChange={(changeEvent) =>
                    setForm({ ...form, description: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div className="sm:col-span-2">
                <span className={LABEL}>Best seasons</span>
                <div className="flex flex-wrap gap-2">
                  {CIRCUIT_SEASONS.map((season) => (
                    <button
                      key={season}
                      type="button"
                      onClick={() => toggleSeason(season)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                        form.bestSeasons.includes(season)
                          ? "border-[#0A4DA6] bg-[#0A4DA6] text-white shadow-sm"
                          : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                      }`}
                    >
                      {seasonLabel(season)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.usableAsPlannerTemplate}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      usableAsPlannerTemplate: changeEvent.target.checked,
                    })
                  }
                  className="w-3.5 h-3.5 accent-[#0A4DA6] cursor-pointer"
                />
                Offer this circuit in the public itinerary planner
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 hover:border-[#0A4DA6] text-gray-500 dark:text-gray-400 hover:text-[#0A4DA6] text-xs font-extrabold px-4 py-2.5 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save circuit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stopsFor ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-3xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#0B192C] dark:text-white">
                Stops — {stopsFor.name}
              </h2>
              <button
                type="button"
                onClick={() => setStopsFor(null)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-1 text-[11px] font-medium text-gray-400">
              This circuit runs for {formatDuration(stopsFor.durationDays)}, so
              stops can be assigned to days 1 – {stopsFor.durationDays}.
            </p>

            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
              {stops.length === 0 ? (
                <p className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs font-medium text-gray-400">
                  No stops yet. A circuit needs at least one before it can be
                  submitted.
                </p>
              ) : (
                stops.map((stop) => (
                  <div
                    key={stop._id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                        <span className="text-[#0A4DA6]">
                          Day {stop.dayNumber}
                        </span>{" "}
                        · {stop.name}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {stopTypeLabel(stop.stopType)}
                        {stop.city ? ` · ${stop.city}` : ""}
                        {stop.distanceFromPreviousKm
                          ? ` · ${formatDistance(stop.distanceFromPreviousKm)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStop(stop);
                          setStopForm({
                            name: stop.name,
                            stopType: stop.stopType,
                            dayNumber: stop.dayNumber,
                            city: stop.city ?? "",
                            state: stop.state ?? "",
                            distanceFromPreviousKm:
                              stop.distanceFromPreviousKm ?? 0,
                            travelMinutes: stop.travelMinutes ?? 0,
                            suggestedDurationMinutes:
                              stop.suggestedDurationMinutes ?? 60,
                            notes: stop.notes ?? "",
                            isOvernightStop: Boolean(stop.isOvernightStop),
                          });
                        }}
                        className="p-2 rounded-full bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStop(stop)}
                        className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 transition-all active:scale-90 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-[#0B192C] dark:text-white">
                {editingStop ? `Edit "${editingStop.name}"` : "Add a stop"}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  value={stopForm.name}
                  onChange={(changeEvent) =>
                    setStopForm({ ...stopForm, name: changeEvent.target.value })
                  }
                  placeholder="Stop name, e.g. Kedarnath Temple"
                  aria-label="Stop name"
                  className={INPUT}
                />
                <select
                  value={stopForm.stopType}
                  onChange={(changeEvent) =>
                    setStopForm({
                      ...stopForm,
                      stopType: changeEvent.target.value,
                    })
                  }
                  aria-label="Stop type"
                  className={INPUT}
                >
                  {STOP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {stopTypeLabel(type)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={stopsFor.durationDays}
                  value={stopForm.dayNumber}
                  onChange={(changeEvent) =>
                    setStopForm({
                      ...stopForm,
                      dayNumber: Number(changeEvent.target.value) || 1,
                    })
                  }
                  placeholder="Day"
                  aria-label="Day number"
                  className={INPUT}
                />
                <input
                  value={stopForm.city}
                  onChange={(changeEvent) =>
                    setStopForm({ ...stopForm, city: changeEvent.target.value })
                  }
                  placeholder="City"
                  aria-label="City"
                  className={INPUT}
                />
                <input
                  type="number"
                  min={0}
                  value={stopForm.distanceFromPreviousKm}
                  onChange={(changeEvent) =>
                    setStopForm({
                      ...stopForm,
                      distanceFromPreviousKm:
                        Number(changeEvent.target.value) || 0,
                    })
                  }
                  placeholder="Km from previous stop"
                  aria-label="Distance from previous stop"
                  className={INPUT}
                />
                <input
                  type="number"
                  min={0}
                  value={stopForm.suggestedDurationMinutes}
                  onChange={(changeEvent) =>
                    setStopForm({
                      ...stopForm,
                      suggestedDurationMinutes:
                        Number(changeEvent.target.value) || 0,
                    })
                  }
                  placeholder="Minutes to spend here"
                  aria-label="Suggested duration"
                  className={INPUT}
                />
                <textarea
                  rows={2}
                  value={stopForm.notes}
                  onChange={(changeEvent) =>
                    setStopForm({ ...stopForm, notes: changeEvent.target.value })
                  }
                  placeholder="Notes for pilgrims at this stop"
                  aria-label="Stop notes"
                  className={`${INPUT} sm:col-span-2`}
                />
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={stopForm.isOvernightStop}
                    onChange={(changeEvent) =>
                      setStopForm({
                        ...stopForm,
                        isOvernightStop: changeEvent.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 accent-[#0A4DA6] cursor-pointer"
                  />
                  <MapPin size={12} /> Pilgrims stay overnight here
                </label>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                {editingStop ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStop(null);
                      setStopForm({ ...emptyStop });
                    }}
                    className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 text-xs font-extrabold px-3 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    Cancel edit
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={saveStop}
                  disabled={!stopForm.name.trim()}
                  className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {editingStop ? "Update stop" : "Add stop"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OwnerCircuitsPage;
