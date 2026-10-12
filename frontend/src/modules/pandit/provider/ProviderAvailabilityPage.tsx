/**
 * Provider Availability Page: weekly schedule and blocked dates.
 * Route: /provider/availability
 *
 * Backend:
 *   GET /api/v2/provider/availability-rules      current schedule
 *   PUT /api/v2/provider/availability-rules      save schedule
 *   GET /api/v2/provider/calendar-blocks         blocked periods
 *   POST /api/v2/provider/calendar-blocks        create block
 *   DELETE /api/v2/provider/calendar-blocks/:id  remove block
 */

import React, { useCallback, useEffect, useState } from "react";
import { Calendar, Plus, Save, Trash2 } from "lucide-react";
import { providerSelfService } from "../services/provider.service";
import type { AvailabilityRules, WeeklyRule, CalendarBlock, CreateCalendarBlockInput } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  Notice,
  PageContainer,
  PageHeader,
  SectionCard,
  cx,
  inputClass,
} from "../ui";

const DAYS_OF_WEEK = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
];

const DEFAULT_RULES: WeeklyRule[] = DAYS_OF_WEEK.map((d) => ({
  dayOfWeek: d.key,
  isAvailable: d.key !== "SUNDAY",
  slots: [{ startTime: "08:00", endTime: "18:00" }],
}));

/** A readable message for the first problem in the schedule, or null when it is valid. */
const scheduleProblem = (rules: WeeklyRule[]): string | null => {
  for (const rule of rules) {
    if (!rule.isAvailable) continue;
    const label = DAYS_OF_WEEK.find((d) => d.key === rule.dayOfWeek)?.label ?? rule.dayOfWeek;
    const slots = [...(rule.slots || [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (slots.length === 0) return `${label}: add a time window or switch the day off.`;
    for (let i = 0; i < slots.length; i += 1) {
      if (!slots[i].startTime || !slots[i].endTime) return `${label}: fill in both times.`;
      if (slots[i].endTime <= slots[i].startTime) return `${label}: the end time must be after the start time.`;
      if (i > 0 && slots[i].startTime < slots[i - 1].endTime) return `${label}: time windows overlap.`;
    }
  }
  return null;
};

// ─── Day row ──────────────────────────────────────────────────────────────────

const DayRow: React.FC<{ rule: WeeklyRule; label: string; onChange: (r: WeeklyRule) => void }> = ({ rule, label, onChange }) => {
  const slots = rule.slots || [];
  const setSlot = (idx: number, patch: Partial<{ startTime: string; endTime: string }>) =>
    onChange({ ...rule, slots: slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  return (
    <li className={cx("rounded-xl border p-4", rule.isAvailable ? "border-gray-200 bg-white dark:border-slate-800 dark:bg-[#0B192C]" : "border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/60")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={rule.isAvailable}
            aria-label={`${label}: ${rule.isAvailable ? "available" : "off"}`}
            onClick={() => onChange({ ...rule, isAvailable: !rule.isAvailable, slots: rule.slots?.length ? rule.slots : [{ startTime: "08:00", endTime: "18:00" }] })}
            className={cx(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2 motion-reduce:transition-none",
              rule.isAvailable ? "bg-[#F28C28]" : "bg-gray-300 dark:bg-slate-600",
            )}
          >
            <span className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all motion-reduce:transition-none", rule.isAvailable ? "left-[22px]" : "left-0.5")} />
          </button>
          <div>
            <p className="text-sm font-bold text-[#0B192C] dark:text-white">{label}</p>
            <p className="text-xs text-gray-500">{rule.isAvailable ? "Available" : "Off"}</p>
          </div>
        </div>
        {rule.isAvailable && (
          <Button variant="ghost" className="!min-h-[40px] !px-3" disabled={slots.length >= 6} onClick={() => onChange({ ...rule, slots: [...slots, { startTime: "16:00", endTime: "18:00" }] })}>
            <Plus size={14} aria-hidden="true" />
            Add window
          </Button>
        )}
      </div>

      {rule.isAvailable && (
        <ul className="mt-3 space-y-2">
          {slots.map((slot, idx) => (
            <li key={idx} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400" htmlFor={`${rule.dayOfWeek}-s-${idx}`}>
                  From
                </label>
                <input id={`${rule.dayOfWeek}-s-${idx}`} type="time" value={slot.startTime} onChange={(e) => setSlot(idx, { startTime: e.target.value })} className={cx(inputClass, "!w-32")} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400" htmlFor={`${rule.dayOfWeek}-e-${idx}`}>
                  To
                </label>
                <input id={`${rule.dayOfWeek}-e-${idx}`} type="time" value={slot.endTime} onChange={(e) => setSlot(idx, { endTime: e.target.value })} className={cx(inputClass, "!w-32")} />
              </div>
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...rule, slots: slots.filter((_, i) => i !== idx) })}
                  aria-label={`Remove window ${idx + 1} on ${label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] dark:hover:bg-rose-950/30"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ProviderAvailabilityPage: React.FC = () => {
  const [rules, setRules] = useState<WeeklyRule[]>(DEFAULT_RULES);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newBlock, setNewBlock] = useState<CreateCalendarBlockInput>({ startDate: "", endDate: "", reason: "" });
  const [blockError, setBlockError] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [rulesRes, blocksRes] = await Promise.allSettled([providerSelfService.getAvailabilityRules(), providerSelfService.listCalendarBlocks()]);

    if (rulesRes.status === "fulfilled" && rulesRes.value.data?.success) {
      const data = rulesRes.value.data.data as AvailabilityRules;
      if (data.rules?.length) {
        setRules(data.rules);
        setHasSavedSchedule(true);
      }
      if (data.timezone) setTimezone(data.timezone);
    } else if (rulesRes.status === "rejected" && (rulesRes.reason as any)?.response?.status !== 404) {
      setError(getErrorMessage(rulesRes.reason, "Failed to load your schedule."));
    }
    if (blocksRes.status === "fulfilled" && blocksRes.value.data?.success) setBlocks(blocksRes.value.data.data || []);
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Warn before leaving with edits that were never saved.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleSaveRules = async () => {
    const problem = scheduleProblem(rules);
    setScheduleError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await providerSelfService.putAvailabilityRules({ timezone, rules });
      setHasSavedSchedule(true);
      setDirty(false);
      toast.success("Schedule saved.");
    } catch (err) {
      setScheduleError(getErrorMessage(err, "Failed to save your schedule."));
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError(null);
    if (!newBlock.startDate || !newBlock.endDate) return setBlockError("Choose both a start and an end date.");
    if (newBlock.startDate > newBlock.endDate) return setBlockError("The start date must be on or before the end date.");
    setAddingBlock(true);
    try {
      const res = await providerSelfService.createCalendarBlock(newBlock);
      if (res.data?.success) {
        setBlocks((prev) => [...prev, res.data.data]);
        setNewBlock({ startDate: "", endDate: "", reason: "" });
        toast.success("Dates blocked.");
      }
    } catch (err) {
      setBlockError(getErrorMessage(err, "Failed to block these dates."));
    } finally {
      setAddingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    setDeletingId(blockId);
    try {
      await providerSelfService.deleteCalendarBlock(blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      toast.success("Block removed.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove the block."));
    } finally {
      setDeletingId(null);
    }
  };

  const updateRule = (dayKey: string, updated: WeeklyRule) => {
    setRules((prev) => (prev.some((r) => r.dayOfWeek === dayKey) ? prev.map((r) => (r.dayOfWeek === dayKey ? updated : r)) : [...prev, updated]));
    setDirty(true);
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingBlock label="Loading your schedule" />
      </PageContainer>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="Provider workspace"
        title="Availability"
        description="Set when devotees can book you. Bookings are only accepted inside these windows."
        actions={
          <Button onClick={handleSaveRules} loading={saving}>
            <Save size={16} aria-hidden="true" />
            {saving ? "Saving…" : "Save schedule"}
          </Button>
        }
      />

      {error && <ErrorNotice message={error} onRetry={load} />}
      {!hasSavedSchedule && !error && (
        <Notice tone="warning">
          <strong>You have not saved a schedule yet.</strong> The times below are suggestions. Adjust them and press <em>Save schedule</em>; until then, devotees cannot book you.
        </Notice>
      )}
      {dirty && <Notice tone="info">You have unsaved changes.</Notice>}
      {scheduleError && <ErrorNotice message={scheduleError} />}

      <SectionCard
        title="Weekly schedule"
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="tz" className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Time zone
            </label>
            <select
              id="tz"
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setDirty(true);
              }}
              className={cx(inputClass, "!w-auto")}
            >
              <option value="Asia/Kolkata">India (IST)</option>
              <option value="America/New_York">US Eastern</option>
              <option value="Europe/London">London</option>
            </select>
          </div>
        }
      >
        <ul className="space-y-3">
          {DAYS_OF_WEEK.map(({ key, label }) => (
            <DayRow key={key} rule={rules.find((r) => r.dayOfWeek === key) || { dayOfWeek: key, isAvailable: false, slots: [] }} label={label} onChange={(updated) => updateRule(key, updated)} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Blocked dates" description="Take days off for festivals, pilgrimages or personal events. Existing bookings are not affected.">
        <form onSubmit={handleAddBlock} className="mb-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/50" noValidate>
          {blockError && <ErrorNotice message={blockError} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="From" required>
              <input type="date" min={today} className={inputClass} value={newBlock.startDate || ""} onChange={(e) => setNewBlock((b) => ({ ...b, startDate: e.target.value }))} />
            </Field>
            <Field label="To (inclusive)" required>
              <input type="date" min={newBlock.startDate || today} className={inputClass} value={newBlock.endDate || ""} onChange={(e) => setNewBlock((b) => ({ ...b, endDate: e.target.value }))} />
            </Field>
          </div>
          <Field label="Reason" hint="Optional, for your own reference.">
            <input type="text" maxLength={200} className={inputClass} value={newBlock.reason || ""} onChange={(e) => setNewBlock((b) => ({ ...b, reason: e.target.value }))} placeholder="e.g. Kumbh Mela pilgrimage" />
          </Field>
          <Button type="submit" loading={addingBlock}>
            <Plus size={16} aria-hidden="true" />
            {addingBlock ? "Blocking…" : "Block these dates"}
          </Button>
        </form>

        {blocks.length === 0 ? (
          <EmptyState icon={<Calendar size={24} />} title="No blocked dates" description="You are available on every scheduled day." />
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B192C]">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                    {b.startDate || b.startAt?.slice(0, 10)} to {b.endDate || b.endAt?.slice(0, 10)}
                  </p>
                  {b.reason && <p className="break-words text-xs text-gray-500">{b.reason}</p>}
                </div>
                <Button variant="outline" className="!min-h-[40px] shrink-0 !px-3" loading={deletingId === b.id} onClick={() => handleDeleteBlock(b.id)} aria-label={`Remove block ${b.startDate || ""}`}>
                  <Trash2 size={14} aria-hidden="true" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default ProviderAvailabilityPage;
