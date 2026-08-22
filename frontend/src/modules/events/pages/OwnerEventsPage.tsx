import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/api";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { eventOwnerService } from "../services/event.service";
import { useNotifications } from "../../../contexts/NotificationContext";
import FileUploader from "../../../components/FileUploader";
import {
  EVENT_FACILITIES,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  type EventFestival,
} from "../types/event.types";
import {
  facilityLabel,
  formatClock,
  formatDateRange,
  listingStatusLabel,
  listingStatusStyle,
  toDateInputValue,
} from "../utils/eventFormat";

interface Ashram {
  _id: string;
  name: string;
  address?: { city?: string; state?: string };
}

interface DayRow {
  date: string;
  totalCapacity: number;
  bookedCount: number;
  blockedCount: number;
  isClosed: boolean;
  note?: string;
}

const CARD =
  "bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] shadow-sm";
const INPUT =
  "w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/30 transition-all";
const LABEL =
  "mb-1.5 block px-1 text-[10px] tracking-wider font-bold text-gray-400";

const emptyEvent = {
  ashramId: "",
  name: "",
  eventType: "festival",
  deity: "",
  tagline: "",
  description: "",
  dressCode: "",
  instructions: "",
  startDate: toDateInputValue(new Date()),
  endDate: toDateInputValue(new Date()),
  startTime: "09:00",
  durationMinutes: 180,
  facilities: [] as string[],
  contactPhone: "",
  coverImage: "",
  requiresRegistration: true,
  dailyCapacity: 0,
  maxSeatsPerRegistration: 10,
  venue: { name: "", line1: "", city: "", state: "", pincode: "" },
};

export const OwnerEventsPage: React.FC = () => {
  const { confirmAction } = useNotifications();
  const [ashrams, setAshrams] = useState<Ashram[]>([]);
  const [events, setEvents] = useState<EventFestival[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EventFestival | null>(null);
  const [form, setForm] = useState({ ...emptyEvent });
  const [saving, setSaving] = useState(false);

  const [daysFor, setDaysFor] = useState<EventFestival | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await eventOwnerService.listEvents({
        status: statusFilter || undefined,
        limit: 100,
      });
      setEvents(response.data?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "We could not load your events."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    eventOwnerService
      .ashrams()
      .then((response) => setAshrams(response.data?.data ?? []))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyEvent, ashramId: ashrams[0]?._id ?? "" });
    setShowForm(true);
  };

  const openEdit = (item: EventFestival) => {
    setEditing(item);
    setForm({
      ashramId:
        typeof item.ashramId === "object"
          ? item.ashramId._id
          : (item.ashramId ?? ""),
      name: item.name,
      eventType: item.eventType,
      deity: item.deity ?? "",
      tagline: item.tagline ?? "",
      description: item.description ?? "",
      dressCode: item.dressCode ?? "",
      instructions: item.instructions ?? "",
      startDate: item.startDate?.slice(0, 10) ?? "",
      endDate: item.endDate?.slice(0, 10) ?? "",
      startTime: item.startTime ?? "09:00",
      durationMinutes: item.durationMinutes ?? 180,
      facilities: item.facilities ?? [],
      contactPhone: item.contactPhone ?? "",
      coverImage: item.coverImage ?? "",
      requiresRegistration: item.requiresRegistration !== false,
      dailyCapacity: item.dailyCapacity ?? 0,
      maxSeatsPerRegistration: item.maxSeatsPerRegistration ?? 10,
      venue: {
        name: item.venue?.name ?? "",
        line1: item.venue?.line1 ?? "",
        city: item.venue?.city ?? "",
        state: item.venue?.state ?? "",
        pincode: item.venue?.pincode ?? "",
      },
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        const { ashramId: _ignored, ...payload } = form;
        await eventOwnerService.updateEvent(editing._id, payload);
      } else {
        await eventOwnerService.createEvent(form);
      }
      setShowForm(false);
      await load();
    } catch {
      // Reported by the toast interceptor.
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (item: EventFestival) => {
    await eventOwnerService.submitEvent(item._id).catch(() => undefined);
    await load();
  };

  const remove = async (item: EventFestival) => {
    const confirmed = await confirmAction({
      title: "Delete Event",
      message: `Delete "${item.name}"? Events with registration history are protected.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    await eventOwnerService.deleteEvent(item._id).catch(() => undefined);
    await load();
  };

  const openDays = async (item: EventFestival) => {
    setDaysFor(item);
    const response = await eventOwnerService.days(item._id);
    setDays(response.data?.data ?? []);
  };

  const saveDay = async (day: DayRow) => {
    if (!daysFor) return;
    await eventOwnerService
      .blockDay({
        eventId: daysFor._id,
        date: day.date,
        totalCapacity: day.totalCapacity,
        blockedCount: day.blockedCount,
        isClosed: day.isClosed,
        note: day.note,
      })
      .catch(() => undefined);
    await openDays(daysFor);
  };

  const toggleFacility = (facility: string) =>
    setForm((current) => ({
      ...current,
      facilities: current.facilities.includes(facility)
        ? current.facilities.filter((value) => value !== facility)
        : [...current.facilities, facility],
    }));

  const canSave = useMemo(
    () =>
      Boolean(
        form.name.trim() &&
          form.startDate &&
          form.endDate &&
          (editing || form.ashramId),
      ),
    [form, editing],
  );

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Events & Festivals"
        subtitle="Publish your festival calendar, set daily capacity, then send each event for review."
        icon={<CalendarDays size={22} />}
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
            </select>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-xs font-extrabold px-4 py-2.5 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} /> New event
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
      ) : events.length === 0 ? (
        <div className={`${CARD} p-12 text-center space-y-3`}>
          <CalendarDays
            size={36}
            className="text-gray-300 dark:text-slate-700 mx-auto"
          />
          <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No events yet
          </h3>
          <p className="text-xs text-gray-400 font-semibold leading-relaxed">
            Create your first festival and submit it for review.
          </p>
        </div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-left text-[10px] tracking-wider font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Registrations</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {events.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#0B192C] dark:text-white">
                      {item.name}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {EVENT_TYPE_LABELS[item.eventType]}
                      {item.venue?.city ? ` · ${item.venue.city}` : ""}
                    </p>
                    {item.status === "rejected" && item.rejectionReason ? (
                      <p className="mt-1 text-[10px] font-bold text-rose-600">
                        {item.rejectionReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {formatDateRange(item.startDate, item.endDate)}
                    <span className="block text-[10px] font-bold text-gray-400">
                      {formatClock(item.startTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {item.registrationCount ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${listingStatusStyle(item.status)}`}
                    >
                      {listingStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        title="Day capacity"
                        onClick={() => openDays(item)}
                        className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Sliders size={14} />
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-[#0A4DA6] hover:border-[#0A4DA6] transition-all active:scale-90 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {["draft", "rejected"].includes(item.status) ? (
                        <button
                          type="button"
                          title="Submit for review"
                          onClick={() => submitForReview(item)}
                          className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 transition-all active:scale-90 cursor-pointer"
                        >
                          <Send size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => remove(item)}
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
                {editing ? "Edit event" : "New event"}
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
                  <label htmlFor="event-ashram" className={LABEL}>
                    Ashram
                  </label>
                  <select
                    id="event-ashram"
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
                <label htmlFor="event-name" className={LABEL}>
                  Event name
                </label>
                <input
                  id="event-name"
                  value={form.name}
                  onChange={(changeEvent) =>
                    setForm({ ...form, name: changeEvent.target.value })
                  }
                  placeholder="e.g. Janmashtami Mahotsav"
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-type" className={LABEL}>
                  Type
                </label>
                <select
                  id="event-type"
                  value={form.eventType}
                  onChange={(changeEvent) =>
                    setForm({ ...form, eventType: changeEvent.target.value })
                  }
                  className={INPUT}
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="event-deity" className={LABEL}>
                  Deity
                </label>
                <input
                  id="event-deity"
                  value={form.deity}
                  onChange={(changeEvent) =>
                    setForm({ ...form, deity: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-start" className={LABEL}>
                  Starts
                </label>
                <input
                  id="event-start"
                  type="date"
                  value={form.startDate}
                  onChange={(changeEvent) =>
                    setForm({ ...form, startDate: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-end" className={LABEL}>
                  Ends
                </label>
                <input
                  id="event-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(changeEvent) =>
                    setForm({ ...form, endDate: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-time" className={LABEL}>
                  Daily start time
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={form.startTime}
                  onChange={(changeEvent) =>
                    setForm({ ...form, startTime: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-duration" className={LABEL}>
                  Duration (minutes)
                </label>
                <input
                  id="event-duration"
                  type="number"
                  min={5}
                  max={1440}
                  value={form.durationMinutes}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(changeEvent.target.value) || 180,
                    })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-venue" className={LABEL}>
                  Venue name
                </label>
                <input
                  id="event-venue"
                  value={form.venue.name}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      venue: { ...form.venue, name: changeEvent.target.value },
                    })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-city" className={LABEL}>
                  City
                </label>
                <input
                  id="event-city"
                  value={form.venue.city}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      venue: { ...form.venue, city: changeEvent.target.value },
                    })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-capacity" className={LABEL}>
                  Places per day (0 = unlimited)
                </label>
                <input
                  id="event-capacity"
                  type="number"
                  min={0}
                  value={form.dailyCapacity}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      dailyCapacity: Number(changeEvent.target.value) || 0,
                    })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="event-max-seats" className={LABEL}>
                  Max places per registration
                </label>
                <input
                  id="event-max-seats"
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxSeatsPerRegistration}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      maxSeatsPerRegistration:
                        Number(changeEvent.target.value) || 1,
                    })
                  }
                  className={INPUT}
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                {import.meta.env.DEV ? (
                  <>
                    <label htmlFor="event-cover" className={LABEL}>
                      Cover image URL (development only)
                    </label>
                    <input
                      id="event-cover"
                      value={form.coverImage}
                      onChange={(changeEvent) =>
                        setForm({ ...form, coverImage: changeEvent.target.value })
                      }
                      placeholder="https://…"
                      className={INPUT}
                    />
                  </>
                ) : null}
                <FileUploader
                  folder="events"
                  label={form.coverImage ? "Replace cover image" : "Upload cover image"}
                  currentUrl={form.coverImage}
                  onUploaded={(coverImage) => setForm({ ...form, coverImage })}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="event-description" className={LABEL}>
                  Description
                </label>
                <textarea
                  id="event-description"
                  rows={3}
                  value={form.description}
                  onChange={(changeEvent) =>
                    setForm({ ...form, description: changeEvent.target.value })
                  }
                  className={INPUT}
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.requiresRegistration}
                  onChange={(changeEvent) =>
                    setForm({
                      ...form,
                      requiresRegistration: changeEvent.target.checked,
                    })
                  }
                  className="w-3.5 h-3.5 accent-[#0A4DA6] cursor-pointer"
                />
                Devotees must register for a free entry pass
              </label>

              <div className="sm:col-span-2">
                <span className={LABEL}>What is arranged</span>
                <div className="flex flex-wrap gap-2">
                  {EVENT_FACILITIES.map((facility) => (
                    <button
                      key={facility}
                      type="button"
                      onClick={() => toggleFacility(facility)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                        form.facilities.includes(facility)
                          ? "border-[#0A4DA6] bg-[#0A4DA6] text-white shadow-sm"
                          : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 hover:border-[#0A4DA6] hover:text-[#0A4DA6]"
                      }`}
                    >
                      {facilityLabel(facility)}
                    </button>
                  ))}
                </div>
              </div>
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
                Save event
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {daysFor ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-[#0B192C] dark:text-white">
                Day capacity — {daysFor.name}
              </h2>
              <button
                type="button"
                onClick={() => setDaysFor(null)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-1 text-[11px] font-medium text-gray-400">
              Blocking holds places back without lowering the venue&apos;s real
              capacity.
            </p>

            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
              {days.map((day, index) => (
                <div
                  key={day.date}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0B192C] dark:text-white">
                      {day.date}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {day.bookedCount} registered
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={day.totalCapacity}
                    aria-label={`Capacity for ${day.date}`}
                    onChange={(changeEvent) =>
                      setDays((current) =>
                        current.map((row, position) =>
                          position === index
                            ? {
                                ...row,
                                totalCapacity:
                                  Number(changeEvent.target.value) || 0,
                              }
                            : row,
                        ),
                      )
                    }
                    className={`${INPUT} w-24`}
                  />
                  <input
                    type="number"
                    min={0}
                    value={day.blockedCount}
                    aria-label={`Blocked places for ${day.date}`}
                    onChange={(changeEvent) =>
                      setDays((current) =>
                        current.map((row, position) =>
                          position === index
                            ? {
                                ...row,
                                blockedCount:
                                  Number(changeEvent.target.value) || 0,
                              }
                            : row,
                        ),
                      )
                    }
                    className={`${INPUT} w-24`}
                  />
                  <button
                    type="button"
                    onClick={() => saveDay(day)}
                    className="inline-flex items-center gap-1 bg-[#0A4DA6] hover:bg-[#083D85] text-white text-[10px] font-extrabold px-3 py-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OwnerEventsPage;
