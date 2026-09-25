// Day Stay slots are wall-clock times at the property (India, UTC+05:30).
// All slot instants are stored as real UTC instants of that IST wall time.
export const IST_OFFSET = "+05:30";
const IST_OFFSET_MS = 330 * 60000;

/** Real instant for an IST calendar date + "HH:mm" (minutes may exceed 24h). */
export function istInstant(dateStr: string, minutesFromMidnight: number): Date {
  const midnight = new Date(`${dateStr}T00:00:00.000${IST_OFFSET}`);
  return new Date(midnight.getTime() + minutesFromMidnight * 60000);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDateString(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** IST wall time (HH:mm) of an instant. */
export function istTimeString(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

export function istDayBounds(dateStr: string): { start: Date; end: Date } {
  const start = istInstant(dateStr, 0);
  return { start, end: new Date(start.getTime() + 24 * 3600000 - 1) };
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
