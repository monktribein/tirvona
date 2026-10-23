/* oxlint-disable react/only-export-components -- small presentational kit for the stay detail page */
/**
 * Presentational pieces for the stay detail page: a consistent section card, the facilities
 * grid, the Property Rules & Policies section, and the quantity stepper / price rows used by
 * the room list and booking summary. They only display data the page already has; pricing,
 * availability and booking behaviour stay in AshramDetailPage.
 */
import React, { useState } from "react";
import {
  Ban,
  CheckCircle,
  Clock,
  FileText,
  Info,
  Landmark,
  Minus,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import {
  formatPolicyTime,
  groupPropertyRules,
  nearbyPlaces,
  textLines,
} from "./propertyRules";

// ---------------------------------------------------------------- section frame

export const SectionCard: React.FC<{
  id?: string;
  title: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, icon, aside, children }) => (
  <section
    id={id}
    aria-labelledby={id ? `${id}-title` : undefined}
    className="scroll-mt-24 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 sm:p-6 shadow-sm space-y-4"
  >
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="w-9 h-9 rounded-xl bg-[#FFF4E5] dark:bg-[#F28C28]/15 text-[#F28C28] flex items-center justify-center shrink-0">
            {icon}
          </span>
        )}
        <h3 id={id ? `${id}-title` : undefined} className="text-lg font-extrabold text-[#0B192C] dark:text-white leading-tight">
          {title}
        </h3>
      </div>
      {aside}
    </header>
    {children}
  </section>
);

// ---------------------------------------------------------------- about

const LONG_TEXT = 420;

/** The property description; long text is clamped with a "Read more" so the page stays scannable. */
export const ExpandableText: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG_TEXT;
  return (
    <div>
      <p className={`text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line ${long && !open ? "line-clamp-5" : ""}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1.5 text-xs font-extrabold text-[#F28C28] hover:text-[#B45309] cursor-pointer"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
};

/** A label/value tile for key facts (only rendered with a real value). */
export const FactTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/40 px-3.5 py-3">
    <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 text-[#F28C28] flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-700">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-extrabold text-[#0B192C] dark:text-white">{value}</p>
    </div>
  </div>
);

// ---------------------------------------------------------------- facilities

/** The property's own facility names, exactly as entered. */
export const FacilitiesGrid: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2.5">
    {items.map((item, index) => (
      <li key={`${item}_${index}`} className="flex items-start gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
        <span className="min-w-0 break-words">{item}</span>
      </li>
    ))}
  </ul>
);

// ---------------------------------------------------------------- rules and policies

const RuleGroup: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-gray-100 dark:border-slate-800 p-4 space-y-3">
    <h4 className="flex items-center gap-2 text-sm font-extrabold text-[#0B192C] dark:text-white">
      <span className="text-[#F28C28]">{icon}</span>
      {title}
    </h4>
    {children}
  </div>
);

const RuleList: React.FC<{ rules: string[] }> = ({ rules }) => (
  <ul className="space-y-2">
    {rules.map((rule, index) => (
      <li key={`${index}_${rule.slice(0, 20)}`} className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#F28C28] shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{rule}</span>
      </li>
    ))}
  </ul>
);

const TimeTile: React.FC<{ icon: React.ReactNode; label: string; time: string | null }> = ({ icon, label, time }) => (
  <div className="rounded-2xl bg-[#FFF4E5]/70 dark:bg-[#F28C28]/10 border border-[#F28C28]/20 px-4 py-3">
    <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#B45309] dark:text-amber-300 uppercase tracking-wider">
      {icon} {label}
    </p>
    {time ? (
      <p className="text-xl font-black text-[#0B192C] dark:text-white mt-0.5">{time}</p>
    ) : (
      <p className="text-sm font-semibold text-gray-500 mt-1">Not specified by the property</p>
    )}
  </div>
);

/**
 * Check-in & check-out, guest rules, general rules and the cancellation policy, all taken from
 * the property's own record. A group with nothing to show is omitted; nothing is made up.
 */
export const PropertyRulesSection: React.FC<{ ashram: any }> = ({ ashram }) => {
  const { guest, general } = groupPropertyRules(ashram?.rules);
  const checkIn = formatPolicyTime(ashram?.policies?.checkInTime);
  const checkOut = formatPolicyTime(ashram?.policies?.checkOutTime);
  const minStay = Number(ashram?.policies?.minStay);
  const cancellation = textLines(ashram?.policies?.cancellationPolicy);

  return (
    <SectionCard id="property-rules" title="Property Rules & Policies" icon={<FileText size={18} />}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RuleGroup title="Check-in & Check-out" icon={<Clock size={16} />}>
          <div className="grid grid-cols-2 gap-3">
            <TimeTile icon={<Sun size={12} />} label="Check-in" time={checkIn} />
            <TimeTile icon={<Moon size={12} />} label="Check-out" time={checkOut} />
          </div>
          {Number.isFinite(minStay) && minStay > 1 && (
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Minimum stay: <span className="font-black text-[#0B192C] dark:text-white">{minStay} nights</span>
            </p>
          )}
        </RuleGroup>

        <RuleGroup title="Cancellation Policy" icon={<ShieldCheck size={16} />}>
          {cancellation.length > 1 ? (
            <RuleList rules={cancellation} />
          ) : cancellation.length === 1 ? (
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 break-words">{cancellation[0]}</p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-gray-500">
              <Info size={15} className="shrink-0 mt-0.5" />
              This property has not published a cancellation policy. Contact the property if you need details before booking.
            </p>
          )}
        </RuleGroup>

        {guest.length > 0 && (
          <RuleGroup title="Couple, Bachelor & Guest Rules" icon={<Users size={16} />}>
            <RuleList rules={guest} />
          </RuleGroup>
        )}

        {general.length > 0 && (
          <RuleGroup title="General Rules" icon={<Ban size={16} />}>
            <RuleList rules={general} />
          </RuleGroup>
        )}
      </div>
      {guest.length === 0 && general.length === 0 && (
        <p className="text-sm text-gray-500">This property has not listed any house rules.</p>
      )}
    </SectionCard>
  );
};

/** Nearby places exactly as the property listed them. Renders nothing when there are none. */
export const NearbyPlaces: React.FC<{ value: unknown }> = ({ value }) => {
  const places = nearbyPlaces(value);
  if (!places.length) return null;
  return (
    <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-slate-800">
      <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-[#0B192C] dark:text-white">
        <Landmark size={15} className="text-[#F28C28]" /> Nearby places
      </h4>
      <ul className="space-y-1.5">
        {places.map((place, index) => (
          <li key={`${place.name}_${index}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 break-words font-semibold text-gray-700 dark:text-gray-200">
              {place.name}
              {place.type && <span className="text-xs font-medium text-gray-400"> · {place.type}</span>}
            </span>
            {place.distance && <span className="shrink-0 text-xs font-bold text-gray-500">{place.distance}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------- room and summary controls

/** − / count / + control. Disabled states and limits are decided by the caller. */
export const QuantityStepper: React.FC<{
  value: number;
  label: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}> = ({ value, label, canDecrease, canIncrease, onDecrease, onIncrease }) => (
  <div
    role="group"
    aria-label={label}
    className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-sm"
  >
    <button
      type="button"
      onClick={onDecrease}
      disabled={!canDecrease}
      aria-label={`Remove one ${label}`}
      className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
    >
      <Minus size={16} />
    </button>
    <span className="w-7 text-center text-sm font-black tabular-nums text-[#0B192C] dark:text-white" aria-live="polite">
      {value}
    </span>
    <button
      type="button"
      onClick={onIncrease}
      disabled={!canIncrease}
      aria-label={`Add one ${label}`}
      className="w-9 h-9 flex items-center justify-center rounded-full text-[#F28C28] hover:bg-[#F28C28]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
    >
      <Plus size={16} />
    </button>
  </div>
);

/** One label/amount line of the price breakdown. */
export const PriceRow: React.FC<{
  label: React.ReactNode;
  amount: React.ReactNode;
  tone?: "default" | "saving" | "fee" | "muted";
}> = ({ label, amount, tone = "default" }) => {
  const color =
    tone === "saving"
      ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
      : tone === "fee"
        ? "text-[#B45309] dark:text-amber-300 font-bold"
        : tone === "muted"
          ? "text-gray-500 dark:text-gray-400 text-xs"
          : "text-gray-700 dark:text-gray-200 font-semibold";
  return (
    <div className={`flex items-start justify-between gap-3 text-sm ${color}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{amount}</span>
    </div>
  );
};

/** Small uppercase heading that groups the steps of the booking panel. */
export const PanelStep: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
  <section aria-label={title} className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-800 first:pt-0 first:border-t-0">
    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
      <span className="w-5 h-5 rounded-full bg-[#F28C28] text-white flex items-center justify-center text-[10px] leading-none">{number}</span>
      {title}
    </h4>
    {children}
  </section>
);
