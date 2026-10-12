/**
 * The puja's step-by-step guide (before the pandit arrives, during, after), as
 * set by Tirvona for each ritual. Shown to devotees and pandits alike.
 */
import React, { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Flame, Sparkles } from "lucide-react";
import { ritualCatalogService } from "../services/provider.service";
import type { PujaProcess, PujaProcessStep } from "../types/provider.types";
import { Button, Modal, Skeleton, cx } from "../ui";

const PHASES: Array<{ key: keyof PujaProcess; title: string; hint: string; icon: React.ReactNode }> = [
  { key: "before", title: "Before the pandit arrives", hint: "Preparation", icon: <ClipboardList size={16} /> },
  { key: "during", title: "During the puja", hint: "The ceremony", icon: <Flame size={16} /> },
  { key: "after", title: "After the puja", hint: "Completion", icon: <Sparkles size={16} /> },
];

const OWNER_LABEL: Record<string, string> = {
  DEVOTEE: "You / family",
  PANDIT: "Pandit ji",
  BOTH: "Together",
  TIRVONA: "Tirvona",
};

/** Loads a ritual's guide once per id and caches it for the session. */
const cache = new Map<string, PujaProcess | null>();
export const usePujaProcess = (ritualId?: string | null) => {
  const [process, setProcess] = useState<PujaProcess | null>(ritualId ? cache.get(ritualId) ?? null : null);
  const [loading, setLoading] = useState(Boolean(ritualId && !cache.has(ritualId)));
  useEffect(() => {
    if (!ritualId) return;
    if (cache.has(ritualId)) {
      setProcess(cache.get(ritualId) ?? null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    ritualCatalogService
      .getById(ritualId)
      .then((res: any) => {
        const value: PujaProcess | null = res.data?.data?.process ?? null;
        cache.set(ritualId, value);
        if (active) setProcess(value);
      })
      .catch(() => active && setProcess(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ritualId]);
  return { process, loading };
};

const hasSteps = (process?: PujaProcess | null) =>
  Boolean(process && (process.before?.length || process.during?.length || process.after?.length));

export const PujaProcessSteps: React.FC<{ process: PujaProcess; viewer?: "DEVOTEE" | "PANDIT" }> = ({ process, viewer = "DEVOTEE" }) => {
  let n = 0;
  return (
    <ol className="space-y-5">
      {PHASES.map((phase) => {
        const steps: PujaProcessStep[] = process[phase.key] ?? [];
        if (!steps.length) return null;
        return (
          <li key={phase.key}>
            <p className="mb-2 flex items-center gap-2 text-sm font-black text-[#0B192C] dark:text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F28C28]/10 text-[#F28C28]" aria-hidden="true">
                {phase.icon}
              </span>
              {phase.title}
              <span className="text-[11px] font-semibold text-gray-400">· {phase.hint}</span>
            </p>
            <ul className="space-y-2 border-l-2 border-[#F28C28]/20 pl-4">
              {steps.map((step, i) => {
                n += 1;
                const mine = (viewer === "DEVOTEE" && step.owner === "DEVOTEE") || (viewer === "PANDIT" && step.owner === "PANDIT");
                return (
                  <li key={`${phase.key}-${i}`} className="relative">
                    <span className="absolute -left-[23px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#F28C28] dark:bg-[#0B192C]" aria-hidden="true">
                      <CheckCircle2 size={14} />
                    </span>
                    <p className="text-sm font-bold text-[#0B192C] dark:text-white">
                      {n}. {step.title}
                      {step.owner && (
                        <span
                          className={cx(
                            "ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            mine ? "bg-[#F28C28] text-white" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
                          )}
                        >
                          {mine ? "Your step" : OWNER_LABEL[step.owner] ?? step.owner}
                        </span>
                      )}
                    </p>
                    {step.detail && <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{step.detail}</p>}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
};

/** Inline guide; renders nothing when the ritual has no guide yet. */
export const PujaProcessGuide: React.FC<{ ritualId?: string | null; viewer?: "DEVOTEE" | "PANDIT"; className?: string }> = ({
  ritualId,
  viewer,
  className,
}) => {
  const { process, loading } = usePujaProcess(ritualId);
  if (loading) return <Skeleton className={cx("h-24", className)} />;
  if (!hasSteps(process)) return null;
  return (
    <div className={className}>
      <PujaProcessSteps process={process!} viewer={viewer} />
    </div>
  );
};

/** "Puja steps" button that opens the guide in a dialog; hidden when the ritual has no guide. */
export const PujaProcessButton: React.FC<{
  ritualId?: string | null;
  title?: string;
  viewer?: "DEVOTEE" | "PANDIT";
  className?: string;
}> = ({ ritualId, title, viewer, className }) => {
  const [open, setOpen] = useState(false);
  const { process, loading } = usePujaProcess(ritualId);
  if (loading || !hasSteps(process)) return null;
  return (
    <>
      <Button variant="outline" className={cx("!min-h-[40px] !px-4 !text-xs", className)} onClick={() => setOpen(true)}>
        <ClipboardList size={14} aria-hidden="true" />
        Puja steps
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title ? `${title}: step by step` : "Puja step by step"}
        description="What happens before the pandit arrives, during the puja, and after."
        footer={
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <PujaProcessSteps process={process!} viewer={viewer} />
      </Modal>
    </>
  );
};
