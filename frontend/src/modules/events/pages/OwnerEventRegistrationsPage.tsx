import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Search, Users, XCircle } from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { eventOwnerService } from "../services/event.service";
import type { EventFestival, EventRegistration } from "../types/event.types";
import { formatDate, formatDateTime } from "../utils/eventFormat";
import EventStatusBadge from "../components/EventStatusBadge";

const CARD =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";
const INPUT =
  "bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all";

export const OwnerEventRegistrationsPage: React.FC = () => {
  const [events, setEvents] = useState<EventFestival[]>([]);
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<EventRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    eventOwnerService
      .listEvents({ limit: 100 })
      .then((response) => setEvents(response.data?.data ?? []))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await eventOwnerService.listRegistrations({
        eventId: eventId || undefined,
        status: status || undefined,
        date: date || undefined,
        q: q || undefined,
        limit: 100,
      });
      setRows(response.data?.data ?? []);
      setTotal(response.data?.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load registrations."));
    } finally {
      setLoading(false);
    }
  }, [eventId, status, date, q]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const cancel = async (registration: EventRegistration) => {
    const reason = window.prompt(
      `Cancel ${registration.registrationReference}? Give the attendee a reason:`,
    );
    if (reason === null) return;
    await eventOwnerService
      .cancelRegistration(registration._id, reason || undefined)
      .catch(() => undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Event Registrations"
        subtitle="Every free pass issued for your events, with gate status."
        icon={<Users size={22} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={eventId}
          onChange={(changeEvent) => setEventId(changeEvent.target.value)}
          className={INPUT}
        >
          <option value="">All events</option>
          {events.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(changeEvent) => setStatus(changeEvent.target.value)}
          className={INPUT}
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Admitted</option>
          <option value="attended">Attended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(changeEvent) => setDate(changeEvent.target.value)}
          className={INPUT}
        />
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2">
          <Search size={14} className="shrink-0 text-[#0A4DA6] stroke-[2.5]" />
          <input
            value={q}
            onChange={(changeEvent) => setQ(changeEvent.target.value)}
            placeholder="Reference"
            className="w-full bg-transparent text-xs font-semibold outline-none text-[#0B192C] dark:text-white placeholder:text-gray-400"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm font-semibold">
          <AlertCircle size={16} /> {error}
        </div>
      ) : loading ? (
        <div className={`${CARD} p-12 flex items-center justify-center gap-3`}>
          <Loader2 size={20} className="animate-spin text-[#0A4DA6]" />
          <span className="text-sm font-bold text-gray-400">Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className={`${CARD} p-12 text-center space-y-3`}>
          <Users size={36} className="text-gray-300 dark:text-slate-700 mx-auto" />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No registrations match these filters
          </h3>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 font-semibold">
            {total} registration(s)
          </p>
          <div className={`${CARD} overflow-x-auto`}>
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Attendee</th>
                  <th className="px-4 py-3">Attending</th>
                  <th className="px-4 py-3">Places</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map((registration) => {
                  const festival =
                    typeof registration.eventId === "object"
                      ? (registration.eventId as EventFestival)
                      : null;
                  const customer = registration.customerId as
                    | { name?: string; phone?: string }
                    | undefined;
                  return (
                    <tr key={registration._id}>
                      <td className="px-4 py-3 font-mono text-[11px] font-bold text-gray-400 tracking-wider">
                        {registration.registrationReference}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {festival?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {typeof customer === "object"
                          ? (customer?.name ?? "—")
                          : "—"}
                        <span className="block text-[10px] font-bold text-gray-400">
                          {registration.contactPhone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {formatDate(registration.attendDate)}
                        <span className="block text-[10px] font-bold text-gray-400">
                          {formatDateTime(registration.startsAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {registration.seats}
                        {registration.checkedInCount
                          ? ` (${registration.checkedInCount} in)`
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        <EventStatusBadge
                          status={registration.status}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {registration.status === "confirmed" ? (
                          <button
                            type="button"
                            onClick={() => cancel(registration)}
                            className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                          >
                            <XCircle size={12} /> Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default OwnerEventRegistrationsPage;
