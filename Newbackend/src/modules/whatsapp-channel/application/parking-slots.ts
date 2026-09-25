/**
 * The structured state behind one WhatsApp parking-booking conversation.
 *
 * Same slot-filling model as `stay-slots.ts`: every message is parsed for
 * whatever it contains (`extractParkingEntities` in nlu.ts), everything found
 * is merged onto these named slots regardless of which question was last
 * asked, and the next question is always "whichever required slot is still
 * empty".
 *
 * Unlike a stay, parking is priced and held by exact clock time, not by
 * calendar day, so `entryDate`/`entryTime` and `exitDate`/`exitTime` are kept
 * as separate slots and only combined into one ISO instant
 * (`parkingDateTimeToIso`) once both halves are known.
 */
export interface ParkingSlots {
  /** Free-text place the guest gave, used as the search query. */
  location?: string;
  /** A parking location the guest has committed to (picked from a list). */
  locationId?: string;
  entryDate?: string;
  entryTime?: string;
  exitDate?: string;
  exitTime?: string;
  /** One of Tirvona's own vehicle-type codes (`car`, `bike`, ...). */
  vehicleType?: string;
  /** A bay category chosen at this location. */
  slotTypeId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
}

export const REQUIRED_PARKING_SLOTS = [
  "location",
  "entryDate",
  "entryTime",
  "exitDate",
  "exitTime",
  "vehicleType",
] as const;
export type RequiredParkingSlot = (typeof REQUIRED_PARKING_SLOTS)[number];

/**
 * Merges newly extracted facts onto existing slots. A field the new message
 * did not touch is left as it was; a field it did supply always overwrites,
 * which is what makes "actually car, not bike" work with no separate
 * correction path.
 *
 * A new location invalidates the location/bay already chosen for the old
 * one — everything else (times, vehicle) is the guest's own fact and stays.
 */
export const mergeParkingSlots = (
  current: ParkingSlots,
  extracted: Partial<ParkingSlots>,
): ParkingSlots => {
  const next: ParkingSlots = { ...current };
  for (const [key, value] of Object.entries(extracted)) {
    if (value === undefined || value === null) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  if (extracted.location !== undefined && extracted.location !== current.location) {
    delete next.locationId;
    delete next.slotTypeId;
  }
  return next;
};

/** Which required slot to ask about next, or null once the search can run. */
export const nextMissingParkingSlot = (
  slots: ParkingSlots,
): RequiredParkingSlot | null => {
  if (!slots.location) return "location";
  if (!slots.entryDate) return "entryDate";
  if (!slots.entryTime) return "entryTime";
  if (!slots.exitDate) return "exitDate";
  if (!slots.exitTime) return "exitTime";
  if (!slots.vehicleType) return "vehicleType";
  return null;
};

/**
 * One IST wall-clock instant, as the parking window's own dates and Razorpay
 * expect it. The guest's date/time is India Standard Time — the same
 * assumption the website's `<input type="datetime-local">` makes in a
 * guest's own browser — so the offset is applied explicitly here rather than
 * left to whichever timezone the server process happens to run in.
 */
export const parkingDateTimeToIso = (isoDate: string, hhmm: string): string =>
  `${isoDate}T${hhmm}:00+05:30`;
