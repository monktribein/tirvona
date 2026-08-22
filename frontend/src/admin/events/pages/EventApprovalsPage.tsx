import React, { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  FileCheck,
  Loader2,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { eventAdminService } from "../../../modules/events/services/event.service";
import type { EventFestival } from "../../../modules/events/types/event.types";
import {
  formatClock,
  formatDateRange,
} from "../../../modules/events/utils/eventFormat";

const CARD =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";

export const EventApprovalsPage: React.FC = () => {
  const [events, setEvents] = useState<EventFestival[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await eventAdminService.approvals(50);
      setEvents(response.data?.data?.events ?? []);
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
    item: EventFestival,
    decision: "approve" | "reject",
  ) => {
    const reason =
      decision === "reject"
        ? window.prompt(`Why is "${item.name}" being rejected?`)
        : undefined;
    if (decision === "reject" && reason === null) return;
    setBusyId(item._id);
    await eventAdminService
      .reviewEvent(item._id, decision, reason ?? undefined)
      .catch(() => undefined);
    setBusyId("");
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Event Approvals"
        subtitle={`${events.length} event${events.length === 1 ? "" : "s"} waiting for review. Nothing reaches the public calendar until it is approved here.`}
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
      ) : events.length === 0 ? (
        <div className={`${CARD} p-12 text-center space-y-3`}>
          <Check size={36} className="text-emerald-400 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            The queue is clear
          </h3>
          <p className="text-xs text-gray-400 font-semibold leading-relaxed">
            New event submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((item) => {
            const ashram =
              typeof item.ashramId === "object" ? item.ashramId : null;
            return (
              <div key={item._id} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.name}
                        className="h-20 w-32 shrink-0 rounded-2xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-[#0B192C] dark:text-white">
                        {item.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                        {ashram?.name ?? "—"} · {item.eventType}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={13} />
                          {formatDateRange(item.startDate, item.endDate)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} />
                          {formatClock(item.startTime)}
                        </span>
                        {item.venue?.city ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={13} />
                            {[item.venue.name, item.venue.city]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1.5">
                          <Users size={13} />
                          {item.requiresRegistration === false
                            ? "No registration"
                            : item.dailyCapacity
                              ? `${item.dailyCapacity} places/day`
                              : "Unlimited places"}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-2 line-clamp-2 text-[11px] font-medium text-gray-400 leading-relaxed">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === item._id}
                      onClick={() => decide(item, "approve")}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item._id}
                      onClick={() => decide(item, "reject")}
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

export default EventApprovalsPage;
