import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { EnterpriseButton } from "./EnterpriseButton";
import { EnterpriseModal } from "./EnterpriseModal";
import type {
  AvailabilityRule,
  CalendarBlock,
  DayOfWeek,
  UpdateAvailabilityRulesInput,
  CreateCalendarBlockInput,
} from "../types/pandit.types";
import {
  ORDERED_DAYS,
  DAY_LABELS,
} from "../types/pandit.types";
import { panditService } from "../services/pandit.service";
import { getErrorMessage } from "@/lib/api";

interface Props {
  providerId: string | null;
  initialRules: AvailabilityRule[];
  calendarBlocks: CalendarBlock[];
  onRefresh: () => void;
}

const inputCls =
  "rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-[#0B192C] dark:text-white px-3 py-2 outline-none focus:border-[#0A4DA6] focus:ring-2 focus:ring-[#0A4DA6]/10 transition";

const defaultRules = (): AvailabilityRule[] =>
  ORDERED_DAYS.map((day) => ({
    dayOfWeek: day,
    isAvailable: !["SATURDAY", "SUNDAY"].includes(day) ? true : false,
    slots: [{ startTime: "09:00", endTime: "17:00" }],
  }));

interface BlockFormValues {
  startDate: string;
  endDate: string;
  reason: string;
}

export const AvailabilityPanel: React.FC<Props> = ({
  providerId,
  initialRules,
  calendarBlocks,
  onRefresh,
}) => {
  const [rules, setRules] = useState<AvailabilityRule[]>(
    initialRules.length > 0 ? initialRules : defaultRules(),
  );
  const [savingRules, setSavingRules] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);

  const {
    register: registerBlock,
    handleSubmit: handleBlockSubmit,
    reset: resetBlock,
    formState: { errors: blockErrors },
  } = useForm<BlockFormValues>({
    defaultValues: { startDate: "", endDate: "", reason: "" },
  });

  // ── Availability rules ────────────────────────────────────────────────────

  const toggleDay = (day: DayOfWeek) => {
    setRules((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day ? { ...r, isAvailable: !r.isAvailable } : r,
      ),
    );
  };

  const updateSlot = (
    day: DayOfWeek,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    setRules((prev) =>
      prev.map((r) =>
        r.dayOfWeek === day
          ? {
              ...r,
              slots: r.slots.map((s, i) =>
                i === 0 ? { ...s, [field]: value } : s,
              ),
            }
          : r,
      ),
    );
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    setRulesError(null);
    try {
      const payload: UpdateAvailabilityRulesInput = { rules };
      await panditService.updateAvailabilityRules(payload);
    } catch (err) {
      setRulesError(getErrorMessage(err, "Failed to save availability rules."));
    } finally {
      setSavingRules(false);
    }
  };

  // ── Calendar blocks ───────────────────────────────────────────────────────

  const handleDeleteBlock = async (blockId: string) => {
    setDeletingBlockId(blockId);
    try {
      await panditService.deleteCalendarBlock(blockId);
      onRefresh();
    } catch (_err) {
      // error is shown via API toast interceptor
    } finally {
      setDeletingBlockId(null);
    }
  };

  const onAddBlock = async (values: BlockFormValues) => {
    setAddingBlock(true);
    try {
      const payload: CreateCalendarBlockInput = {
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason.trim() || undefined,
      };
      await panditService.createCalendarBlock(payload);
      resetBlock();
      setBlockModalOpen(false);
      onRefresh();
    } catch (_err) {
      // API toast interceptor shows error
    } finally {
      setAddingBlock(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Weekly availability ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0B192C] dark:text-white flex items-center gap-2">
              <Clock size={15} className="text-[#0A4DA6]" />
              Weekly Availability
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Set which days and hours you are available for bookings.
            </p>
          </div>
          <EnterpriseButton
            variant="primary"
            size="sm"
            loading={savingRules}
            onClick={handleSaveRules}
            disabled={!providerId || savingRules}
          >
            {savingRules ? "Saving..." : "Save Rules"}
          </EnterpriseButton>
        </div>

        {rulesError && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400">
            {rulesError}
          </div>
        )}

        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.dayOfWeek}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border transition-colors ${
                rule.isAvailable
                  ? "border-[#0A4DA6]/20 bg-blue-50/40 dark:bg-blue-950/10"
                  : "border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/40"
              }`}
            >
              {/* Day toggle */}
              <button
                type="button"
                onClick={() => toggleDay(rule.dayOfWeek)}
                className="flex items-center gap-2 min-w-[90px] cursor-pointer"
              >
                {rule.isAvailable ? (
                  <CheckSquare
                    size={16}
                    className="text-[#0A4DA6] shrink-0"
                  />
                ) : (
                  <Square size={16} className="text-gray-300 dark:text-slate-600 shrink-0" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    rule.isAvailable
                      ? "text-[#0B192C] dark:text-white"
                      : "text-gray-400 dark:text-slate-500"
                  }`}
                >
                  {DAY_LABELS[rule.dayOfWeek]}
                </span>
              </button>

              {/* Time slots */}
              {rule.isAvailable && rule.slots[0] && (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={rule.slots[0].startTime}
                    onChange={(e) =>
                      updateSlot(rule.dayOfWeek, "startTime", e.target.value)
                    }
                    className={`${inputCls} w-32`}
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={rule.slots[0].endTime}
                    onChange={(e) =>
                      updateSlot(rule.dayOfWeek, "endTime", e.target.value)
                    }
                    className={`${inputCls} w-32`}
                  />
                </div>
              )}

              {!rule.isAvailable && (
                <span className="text-xs text-gray-400 dark:text-slate-500 italic">
                  Not available
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Calendar blocks ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0B192C] dark:text-white flex items-center gap-2">
              <Calendar size={15} className="text-[#0A4DA6]" />
              Blocked Dates
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Block specific dates when you are unavailable.
            </p>
          </div>
          <EnterpriseButton
            variant="outline"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setBlockModalOpen(true)}
          >
            Add Block
          </EnterpriseButton>
        </div>

        {calendarBlocks.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">
            No dates blocked. Add a block when you're unavailable for a
            specific period.
          </div>
        ) : (
          <div className="space-y-2">
            {calendarBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/40"
              >
                <div>
                  <p className="text-xs font-semibold text-[#0B192C] dark:text-white">
                    {new Date(block.startDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    —{" "}
                    {new Date(block.endDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {block.reason && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {block.reason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBlock(block.id)}
                  disabled={deletingBlockId === block.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer disabled:opacity-50"
                  title="Remove block"
                >
                  {deletingBlockId === block.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add block modal ─────────────────────────────────────────────── */}
      <EnterpriseModal
        isOpen={blockModalOpen}
        onClose={() => {
          resetBlock();
          setBlockModalOpen(false);
        }}
        title="Block Dates"
        subtitle="Mark a date range as unavailable"
        icon={<Calendar size={18} className="text-[#0A4DA6]" />}
        maxWidth="sm"
        footer={
          <div className="flex flex-col sm:flex-row gap-2">
            <EnterpriseButton
              type="submit"
              form="block-form"
              variant="primary"
              loading={addingBlock}
              disabled={addingBlock}
              className="flex-1"
            >
              {addingBlock ? "Adding..." : "Block Dates"}
            </EnterpriseButton>
            <EnterpriseButton
              type="button"
              variant="outline"
              onClick={() => {
                resetBlock();
                setBlockModalOpen(false);
              }}
              disabled={addingBlock}
              className="flex-1"
            >
              Cancel
            </EnterpriseButton>
          </div>
        }
      >
        <form
          id="block-form"
          onSubmit={handleBlockSubmit(onAddBlock)}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
              Start Date <span className="text-rose-500">*</span>
            </label>
            <input
              {...registerBlock("startDate", {
                required: "Start date is required",
              })}
              type="date"
              className={`${inputCls} w-full ${blockErrors.startDate ? "border-rose-500" : ""}`}
            />
            {blockErrors.startDate && (
              <p className="text-[11px] text-rose-500 mt-1">
                {blockErrors.startDate.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
              End Date <span className="text-rose-500">*</span>
            </label>
            <input
              {...registerBlock("endDate", {
                required: "End date is required",
              })}
              type="date"
              className={`${inputCls} w-full ${blockErrors.endDate ? "border-rose-500" : ""}`}
            />
            {blockErrors.endDate && (
              <p className="text-[11px] text-rose-500 mt-1">
                {blockErrors.endDate.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
              Reason (optional)
            </label>
            <input
              {...registerBlock("reason", {
                maxLength: { value: 200, message: "Max 200 characters" },
              })}
              placeholder="e.g. Personal pilgrimage, Health leave"
              className={`${inputCls} w-full`}
            />
          </div>
        </form>
      </EnterpriseModal>
    </div>
  );
};

export default AvailabilityPanel;

