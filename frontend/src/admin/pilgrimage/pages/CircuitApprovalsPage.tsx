import React, { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  Compass,
  FileCheck,
  Loader2,
  MapPin,
  Route,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { pilgrimageAdminService } from "../../../modules/pilgrimage/services/pilgrimage.service";
import type { PilgrimageCircuit } from "../../../modules/pilgrimage/types/pilgrimage.types";
import {
  difficultyLabel,
  formatDistance,
  formatDuration,
} from "../../../modules/pilgrimage/utils/pilgrimageFormat";

const CARD =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";

export const CircuitApprovalsPage: React.FC = () => {
  const [circuits, setCircuits] = useState<PilgrimageCircuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await pilgrimageAdminService.approvals(50);
      setCircuits(response.data?.data?.circuits ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load the approval queue."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    circuit: PilgrimageCircuit,
    decision: "approve" | "reject",
  ) => {
    const reason =
      decision === "reject"
        ? window.prompt(`Why is "${circuit.name}" being rejected?`)
        : undefined;
    if (decision === "reject" && reason === null) return;
    setBusyId(circuit._id);
    await pilgrimageAdminService
      .reviewCircuit(circuit._id, decision, reason ?? undefined)
      .catch(() => undefined);
    setBusyId("");
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Circuit Approvals"
        subtitle={`${circuits.length} circuit${circuits.length === 1 ? "" : "s"} waiting for review. Approved circuits also feed the public itinerary planner.`}
        icon={<FileCheck size={22} />}
        badgeText="Super Admin"
      />

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          {error}
        </div>
      ) : loading ? (
        <div className={`${CARD} p-12 flex items-center justify-center gap-3`}>
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : circuits.length === 0 ? (
        <div className={`${CARD} p-12 text-center space-y-3`}>
          <Check size={36} className="text-emerald-400 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            The queue is clear
          </h3>
          <p className="text-xs text-gray-400 font-semibold leading-relaxed">
            New circuit submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {circuits.map((circuit) => {
            const ashram =
              typeof circuit.ashramId === "object" ? circuit.ashramId : null;
            return (
              <div key={circuit._id} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {circuit.coverImage ? (
                      <img
                        src={circuit.coverImage}
                        alt={circuit.name}
                        className="h-20 w-32 shrink-0 rounded-2xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
                        {circuit.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                        {ashram?.name ?? "—"} · {circuit.circuitType}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={13} />
                          {formatDuration(circuit.durationDays)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Route size={13} />
                          {circuit.stopCount ?? 0} stops ·{" "}
                          {formatDistance(circuit.totalDistanceKm)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Compass size={13} />
                          {difficultyLabel(circuit.difficulty)}
                        </span>
                        {circuit.startCity ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={13} />
                            {circuit.startCity}
                            {circuit.endCity &&
                            circuit.endCity !== circuit.startCity
                              ? ` → ${circuit.endCity}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                      {circuit.summary ? (
                        <p className="mt-2 line-clamp-2 text-[11px] font-medium text-gray-400 leading-relaxed">
                          {circuit.summary}
                        </p>
                      ) : null}
                      {circuit.usableAsPlannerTemplate ? (
                        <p className="mt-1.5 text-[10px] font-bold text-[#0A4DA6]">
                          Will be offered in the itinerary planner
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === circuit._id}
                      onClick={() => decide(circuit, "approve")}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === circuit._id}
                      onClick={() => decide(circuit, "reject")}
                      className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0B192C] border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-extrabold px-4 py-2 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
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

export default CircuitApprovalsPage;
