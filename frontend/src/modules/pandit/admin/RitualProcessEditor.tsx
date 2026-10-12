/**
 * Super admin editor for a puja's step-by-step guide: what happens before the
 * pandit arrives, during the puja, and after. Saved guides are shown at once to
 * devotees (pandit pages, their bookings) and to pandits (their bookings).
 */
import React, { useEffect, useState } from "react";
import { ArrowUp, ChevronDown, ClipboardList, Copy, Plus, Trash2 } from "lucide-react";
import { ritualAdminService } from "../services/provider.service";
import type { PujaProcess, PujaProcessStep } from "../types/provider.types";
import { getErrorMessage } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { Button, ErrorNotice, Modal, Notice, cx, inputClass } from "../ui";

type Phase = keyof PujaProcess;
const PHASES: Array<{ key: Phase; title: string; hint: string }> = [
  { key: "before", title: "Before the pandit arrives", hint: "Preparation by the family, samagri, travel and arrival." },
  { key: "during", title: "During the puja", hint: "The ceremony itself, in order." },
  { key: "after", title: "After the puja", hint: "Aarti, prasad, dakshina, visarjan, follow-up." },
];
const OWNERS = [
  { value: "DEVOTEE", label: "Devotee / family" },
  { value: "PANDIT", label: "Pandit ji" },
  { value: "BOTH", label: "Together" },
  { value: "TIRVONA", label: "Tirvona" },
];
const MAX_STEPS = 25;

/** A sensible starting point for most home pujas; the admin edits it per ritual. */
const STANDARD_TEMPLATE: PujaProcess = {
  before: [
    { title: "Booking confirmed and pandit ji accepts", detail: "You get a confirmation with the date, time and pandit's details.", owner: "TIRVONA" },
    { title: "Samagri list shared", detail: "Pandit ji shares the list of puja items, or brings them if samagri is included.", owner: "PANDIT" },
    { title: "Prepare the puja space", detail: "Clean the area, keep a chowki/aasan, water, flowers and a lamp ready.", owner: "DEVOTEE" },
    { title: "Pandit ji travels and arrives", detail: "Pandit ji reaches a little before the muhurat to set up.", owner: "PANDIT" },
  ],
  during: [
    { title: "Sankalp", detail: "The family's names and gotra are taken for the sankalp.", owner: "BOTH" },
    { title: "Ganesh pujan and kalash sthapana", owner: "PANDIT" },
    { title: "Main puja / katha", detail: "The main ritual is performed with mantras; the family takes part where asked.", owner: "BOTH" },
    { title: "Havan (if part of the puja)", owner: "BOTH" },
  ],
  after: [
    { title: "Aarti and prasad", owner: "BOTH" },
    { title: "Dakshina and blessings", detail: "Any voluntary dakshina is offered directly.", owner: "DEVOTEE" },
    { title: "Visarjan / clean-up guidance", detail: "Pandit ji explains what to do with the puja items afterwards.", owner: "PANDIT" },
    { title: "Mark complete and share feedback", detail: "Pandit ji marks the puja complete; you can rate the experience.", owner: "TIRVONA" },
  ],
};

const emptyProcess = (): PujaProcess => ({ before: [], during: [], after: [] });
const cloneProcess = (p?: Partial<PujaProcess> | null): PujaProcess => ({
  before: (p?.before ?? []).map((s) => ({ ...s })),
  during: (p?.during ?? []).map((s) => ({ ...s })),
  after: (p?.after ?? []).map((s) => ({ ...s })),
});

export const RitualProcessEditor: React.FC<{
  ritual: { id: string; name: string; process?: PujaProcess | null } | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ ritual, onClose, onSaved }) => {
  const [draft, setDraft] = useState<PujaProcess>(emptyProcess());
  const [openPhase, setOpenPhase] = useState<Phase>("before");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ritual) return;
    setDraft(cloneProcess(ritual.process));
    setOpenPhase("before");
    setError(null);
  }, [ritual]);

  const total = draft.before.length + draft.during.length + draft.after.length;

  const update = (phase: Phase, index: number, patch: Partial<PujaProcessStep>) =>
    setDraft((d) => ({ ...d, [phase]: d[phase].map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  const add = (phase: Phase) =>
    setDraft((d) => (d[phase].length >= MAX_STEPS ? d : { ...d, [phase]: [...d[phase], { title: "", detail: "", owner: "BOTH" }] }));
  const remove = (phase: Phase, index: number) => setDraft((d) => ({ ...d, [phase]: d[phase].filter((_, i) => i !== index) }));
  const moveUp = (phase: Phase, index: number) =>
    setDraft((d) => {
      if (index === 0) return d;
      const steps = [...d[phase]];
      [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
      return { ...d, [phase]: steps };
    });

  const save = async () => {
    if (!ritual) return;
    const clean = (steps: PujaProcessStep[]) =>
      steps
        .map((s) => ({ title: s.title.trim(), detail: s.detail?.trim() || undefined, owner: s.owner || "BOTH" }))
        .filter((s) => s.title.length > 0);
    const payload = { before: clean(draft.before), during: clean(draft.during), after: clean(draft.after) };
    const tooShort = [...payload.before, ...payload.during, ...payload.after].find((s) => s.title.length < 2);
    if (tooShort) {
      setError("Each step needs a title of at least 2 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ritualAdminService.setProcess(ritual.id, payload);
      toast.success("Puja steps saved. Devotees and pandits see them now.");
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the puja steps."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!ritual}
      onClose={onClose}
      size="lg"
      title="Puja steps"
      description={ritual ? `${ritual.name}: the step-by-step guide devotees and pandits see.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save steps
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNotice message={error} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {total} step{total === 1 ? "" : "s"} · saved steps are shown immediately, no review needed.
          </p>
          <Button
            variant="outline"
            className="!min-h-[36px] !px-3 !text-xs"
            onClick={() => {
              setDraft(cloneProcess(STANDARD_TEMPLATE));
              toast.info("Standard template added. Edit it for this puja, then save.");
            }}
          >
            <Copy size={14} aria-hidden="true" />
            {total ? "Replace with standard template" : "Start from standard template"}
          </Button>
        </div>
        {total === 0 && (
          <Notice tone="info">
            No steps yet. Start from the standard template or add steps for each stage. Leaving every stage empty removes the guide.
          </Notice>
        )}

        {PHASES.map((phase) => {
          const steps = draft[phase.key];
          const open = openPhase === phase.key;
          return (
            <section key={phase.key} className="rounded-2xl border border-gray-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOpenPhase(open ? ("" as Phase) : phase.key)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] rounded-2xl"
              >
                <span>
                  <span className="block text-sm font-black text-[#0B192C] dark:text-white">
                    {phase.title} <span className="font-semibold text-gray-400">({steps.length})</span>
                  </span>
                  <span className="block text-xs text-gray-500">{phase.hint}</span>
                </span>
                <ChevronDown size={18} className={cx("shrink-0 text-gray-400 transition-transform", open && "rotate-180")} aria-hidden="true" />
              </button>
              {open && (
                <div className="space-y-3 border-t border-gray-100 p-4 dark:border-slate-800">
                  {steps.map((step, i) => (
                    <div key={i} className="space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-slate-900/60">
                      <div className="flex items-start gap-2">
                        <span className="mt-2.5 w-5 shrink-0 text-xs font-black text-gray-400">{i + 1}.</span>
                        <input
                          className={inputClass}
                          value={step.title}
                          maxLength={120}
                          placeholder="Step title, e.g. Sankalp"
                          aria-label={`${phase.title} step ${i + 1} title`}
                          onChange={(e) => update(phase.key, i, { title: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => moveUp(phase.key, i)}
                          disabled={i === 0}
                          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white disabled:opacity-30 dark:hover:bg-slate-800"
                          aria-label="Move step up"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(phase.key, i)}
                          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 hover:bg-white dark:hover:bg-slate-800"
                          aria-label="Remove step"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pl-7 sm:grid-cols-[1fr,12rem]">
                        <textarea
                          className={inputClass}
                          rows={2}
                          maxLength={600}
                          value={step.detail ?? ""}
                          placeholder="Details (optional)"
                          aria-label={`${phase.title} step ${i + 1} details`}
                          onChange={(e) => update(phase.key, i, { detail: e.target.value })}
                        />
                        <select
                          className={inputClass}
                          value={step.owner ?? "BOTH"}
                          aria-label={`Who does step ${i + 1}`}
                          onChange={(e) => update(phase.key, i, { owner: e.target.value })}
                        >
                          {OWNERS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="!min-h-[36px] !px-3 !text-xs" disabled={steps.length >= MAX_STEPS} onClick={() => add(phase.key)}>
                    <Plus size={14} aria-hidden="true" />
                    Add step
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Modal>
  );
};

/** Small summary for the ritual list: how many steps the guide has. */
export const processStepCount = (process?: PujaProcess | null) =>
  (process?.before?.length ?? 0) + (process?.during?.length ?? 0) + (process?.after?.length ?? 0);

export const ProcessBadgeIcon = ClipboardList;
