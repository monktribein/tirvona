/**
 * The structured state behind one WhatsApp stay-booking conversation.
 *
 * This replaces the old approach of re-deciding, on every message, "which
 * date does this belong to" from `session.step` alone. That approach could
 * only ever hold one date at a time and had no notion of time-of-day, so a
 * reply like "tomorrow at 11 AM" while the bot was asking for checkout had
 * nowhere reliable to go — the incoming date got attributed to whichever
 * slot the step-machine guessed, and a slot that guessed wrong looked to the
 * guest exactly like the bot ignoring them and asking again.
 *
 * The fix is a genuine slot-filling model: every message is parsed for
 * whatever it contains (via `extractStayEntities` in nlu.ts), everything
 * found is merged into these named slots — never gated by which question was
 * asked — and the next question is always "whichever required slot is still
 * empty", never "whatever the previous step happened to be".
 *
 * Dates are ISO calendar dates (`YYYY-MM-DD`) rather than `Date` objects, so
 * they round-trip through the JSON-serialized Redis session without
 * ambiguity, and can be merged/compared as plain strings.
 */
export interface StaySlots {
  /** Free-text place or property name the guest gave, used as the search query. */
  location?: string;
  /** An ashram the guest has committed to (picked from a list, or from `propertyId`). */
  ashramId?: string;
  /** A specific room category within that ashram. */
  roomId?: string;
  /** `YYYY-MM-DD`, IST calendar date. */
  checkInDate?: string;
  /** `HH:MM`, 24-hour. */
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  guests?: number;
  /** Set instead of a time when one was given with no AM/PM or period-of-day cue. */
  checkInTimeAmbiguousHour?: number;
  checkOutTimeAmbiguousHour?: number;
}

/**
 * The slots that must all be filled before an availability search is run.
 *
 * Deliberately does not include the clock times. `BookingSchema` has no
 * check-in/check-out TIME field at all — the website never asks a guest for
 * one — so making it a blocking question here would invent a requirement the
 * existing booking architecture does not have, and would stop a message that
 * already gives place, dates and guests (everything a website booking
 * actually needs) from reaching a search just because it didn't also state a
 * clock hour. A time the guest does volunteer is still read, merged, shown
 * back in the summary and never asked about twice — see `mergeStaySlots` —
 * it simply never blocks progress when absent.
 */
export const REQUIRED_STAY_SLOTS = [
  "location",
  "checkInDate",
  "checkOutDate",
  "guests",
] as const;
export type RequiredStaySlot = (typeof REQUIRED_STAY_SLOTS)[number];

/**
 * Merges newly extracted facts onto existing slots.
 *
 * Every field is a plain overwrite when the new message actually supplied a
 * value — this is deliberate and is what makes a correction ("actually
 * Mathura, not Vrindavan") work with no separate "correction" code path: the
 * latest explicit value always wins. A field the new message said nothing
 * about is left exactly as it was, which is what stops the bot re-asking for
 * something it was already told.
 *
 * Resolving an ambiguous hour into a real time clears the corresponding
 * ambiguous-hour marker, and supplying a real time on either slot clears any
 * ambiguous marker for that same slot (a guest who says "shaam 4 baje" after
 * being asked to disambiguate a bare "4" has answered, not added a new fact).
 */
export const mergeStaySlots = (
  current: StaySlots,
  extracted: Partial<StaySlots>,
): StaySlots => {
  const next: StaySlots = { ...current };
  for (const [key, value] of Object.entries(extracted)) {
    if (value === undefined || value === null) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  if (extracted.checkInTime !== undefined)
    delete next.checkInTimeAmbiguousHour;
  if (extracted.checkOutTime !== undefined)
    delete next.checkOutTimeAmbiguousHour;
  // A new location invalidates a specific property/room chosen for the old
  // one, but dates and guests are the guest's own facts about their trip and
  // stay valid across a location change — only cleared if the caller finds
  // them genuinely incompatible with the new place, which this function does
  // not decide.
  if (
    extracted.location !== undefined &&
    extracted.location !== current.location
  ) {
    delete next.ashramId;
    delete next.roomId;
  }
  return next;
};

/**
 * Which required slot to ask about next, or null when every slot the search
 * needs is filled (an ambiguous hour counts as "not filled" — it still needs
 * a clarifying answer before the search can run).
 */
export const nextMissingStaySlot = (
  slots: StaySlots,
): RequiredStaySlot | null => {
  if (!slots.location) return "location";
  if (!slots.checkInDate) return "checkInDate";
  if (!slots.checkOutDate) return "checkOutDate";
  if (!slots.guests) return "guests";
  return null;
};

/** True once every slot the search needs is filled and unambiguous. */
export const staySlotsComplete = (slots: StaySlots): boolean =>
  nextMissingStaySlot(slots) === null;

/**
 * A slot's calendar date as the UTC-midnight instant the domain services
 * expect (the same shape `nlu.ts`'s date parsing already produces).
 *
 * Deliberately date-only: `BookingSchema.checkInDate`/`checkOutDate` are
 * calendar dates and inventory is held per calendar day
 * (`booking_daily_availability`), with no arrival-time field anywhere in the
 * schema. The guest's stated arrival/departure clock time is real
 * information the conversation should understand and reflect back — which is
 * why it is still a tracked slot — but it is conversational context, not
 * something the existing booking architecture has anywhere to store, so it
 * is never sent to `BookingsService`. Changing that would mean adding a
 * field to the shared booking schema, which is out of scope for a WhatsApp
 * channel that must not alter the existing domain model.
 */
export const isoDateToUtcMidnight = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** `"22 Sep, 4:00 PM"` — for summarizing a slot pair back to the guest. */
export const formatDateTime = (isoDate: string, hhmm: string): string => {
  const date = isoDateToUtcMidnight(isoDate);
  const [hour24, minute] = hhmm.split(":").map(Number);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const datePart = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const timePart =
    minute === 0
      ? `${hour12} ${period}`
      : `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  return `${datePart}, ${timePart}`;
};
