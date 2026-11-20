import type {
  ShiftRoute,
  ShiftRouteAgent,
  TrackingLeg,
  TrackingPoint,
  TrackingVisit,
} from "../../services/leadCollection.service";

/**
 * Demo field executive. Their past shifts and routes are generated here, in
 * the browser only, so the attendance screens can be shown with a month of
 * work. Nothing is stored: today's real check-in (if any) still shows as it is.
 */
const DEMO_AGENT_IDS = new Set(["6afecb8153e1409c2d855715"]);

/** Demo shift ids look like `demo-2026-11-18`, one per working day. */
const DEMO_SHIFT_PREFIX = "demo-";

/** Working days (Monday to Saturday) of demo shifts, ending yesterday. */
const DEMO_DAYS = 26;

export const isDemoAgent = (agentId?: string | null): boolean =>
  Boolean(agentId && DEMO_AGENT_IDS.has(String(agentId)));

export const isDemoShift = (agentId: string, attendanceId: string): boolean =>
  isDemoAgent(agentId) && attendanceId.startsWith(DEMO_SHIFT_PREFIX);

interface Place {
  name: string;
  lat: number;
  lng: number;
}

const OFFICE: Place = { name: "Sector 62, Noida, Uttar Pradesh", lat: 28.62712, lng: 77.37237 };

/**
 * Places in Noida the demo executive visits: each sector's metro station, so
 * the point and its name agree on any map. Sectors on the Delhi border are left
 * out so no point reads as Delhi.
 */
const PLACES: Place[] = [
  { name: "Sector 18, Noida, Uttar Pradesh", lat: 28.57076, lng: 77.32608 },
  { name: "Botanical Garden, Sector 38, Noida, Uttar Pradesh", lat: 28.56394, lng: 77.3344 },
  { name: "Noida City Centre, Sector 32, Noida, Uttar Pradesh", lat: 28.57473, lng: 77.35616 },
  { name: "Sector 34, Noida, Uttar Pradesh", lat: 28.58025, lng: 77.36349 },
  { name: "Sector 44, Noida, Uttar Pradesh", lat: 28.55128, lng: 77.33525 },
  { name: "Sector 51, Noida, Uttar Pradesh", lat: 28.58572, lng: 77.37526 },
  { name: "Sector 59, Noida, Uttar Pradesh", lat: 28.60653, lng: 77.37268 },
  { name: "Sector 61, Noida, Uttar Pradesh", lat: 28.59759, lng: 77.37227 },
  { name: "Sector 70, Noida, Uttar Pradesh", lat: 28.60073, lng: 77.38324 },
  { name: "Sector 76, Noida, Uttar Pradesh", lat: 28.56533, lng: 77.37966 },
  { name: "Sector 101, Noida, Uttar Pradesh", lat: 28.55605, lng: 77.38495 },
  { name: "Sector 137, Noida, Uttar Pradesh", lat: 28.51077, lng: 77.40361 },
];

const istDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** The same numbers every time for the same day, so the demo never shifts on reload. */
const seededRandom = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The last `DEMO_DAYS` working days before today (IST), newest first. */
const demoDates = (): string[] => {
  const dates: string[] = [];
  const today = istDay(new Date());
  // Noon IST on each day, so stepping back never crosses a date boundary.
  let cursor = Date.parse(`${today}T12:00:00+05:30`);
  while (dates.length < DEMO_DAYS) {
    cursor -= 86_400_000;
    const day = istDay(new Date(cursor));
    const weekday = new Date(`${day}T12:00:00+05:30`).getUTCDay();
    if (weekday !== 0) dates.push(day);
  }
  return dates;
};

interface DemoShift {
  route: ShiftRoute;
  /** The row the attendance drawer shows for this shift. */
  record: Record<string, unknown>;
}

const at = (date: string, minutesAfterMidnight: number) => {
  const h = String(Math.floor(minutesAfterMidnight / 60)).padStart(2, "0");
  const m = String(Math.floor(minutesAfterMidnight % 60)).padStart(2, "0");
  return new Date(`${date}T${h}:${m}:00+05:30`).toISOString();
};

/** One working day: check in at the office, visit 3–4 places, check out. */
const buildShift = (date: string): DemoShift => {
  const rand = seededRandom(`tirvona-demo-${date}`);
  const pick = (min: number, max: number) => min + rand() * (max - min);

  // Pick the day's places, then visit them nearest-first from the office.
  const pool = [...PLACES];
  const count = 3 + Math.floor(rand() * 2);
  const chosen: Place[] = [];
  for (let i = 0; i < count; i += 1) chosen.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const visits: Place[] = [];
  let here: Place = OFFICE;
  while (chosen.length) {
    chosen.sort((a, b) => kmBetween(here, a) - kmBetween(here, b));
    here = chosen.shift() as Place;
    visits.push(here);
  }
  const endsAtOffice = rand() < 0.5;
  const stops = [OFFICE, ...visits];
  const checkOutPlace = endsAtOffice ? OFFICE : visits[visits.length - 1];

  const checkInMin = 9 * 60 + 30 + Math.floor(pick(0, 35));
  const shiftMinutes = Math.round(pick(510, 555));
  const checkOutMin = checkInMin + shiftMinutes;

  // Travel time at city speed; whatever is left of the shift is spent at the stops.
  const moves: number[] = [];
  for (let i = 1; i < stops.length; i += 1) moves.push(kmBetween(stops[i - 1], stops[i]));
  if (endsAtOffice) moves.push(kmBetween(visits[visits.length - 1], OFFICE));
  const moveMinutes = moves.map((km) => Math.max(6, Math.round((km / pick(16, 22)) * 60)));
  const stayTotal = shiftMinutes - moveMinutes.reduce((s, m) => s + m, 0);
  const weights = stops.map((_, i) => (i === 0 ? pick(0.3, 0.5) : pick(0.8, 1.4)));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const stayMinutes = weights.map((w) => Math.round((w / weightSum) * stayTotal));

  const accuracy = () => Math.round(pick(6, 22));
  const near = (p: Place) => ({ lat: p.lat + pick(-0.00015, 0.00015), lng: p.lng + pick(-0.00015, 0.00015) });

  const route: TrackingPoint[] = [];
  const timeline: TrackingLeg[] = [];
  const visited: TrackingVisit[] = [];
  let clock = checkInMin;

  stops.forEach((place, i) => {
    const arrive = clock;
    const leave = i === stops.length - 1 && !endsAtOffice ? checkOutMin : arrive + stayMinutes[i];
    const arrivedAt = at(date, arrive);
    const leftAt = at(date, leave);
    const fixAccuracy = accuracy();
    route.push({ ...near(place), recordedAt: arrivedAt, accuracy: fixAccuracy });
    route.push({ ...near(place), recordedAt: leftAt, accuracy: accuracy() });
    timeline.push({
      kind: "stop",
      startedAt: arrivedAt,
      endedAt: leftAt,
      minutes: leave - arrive,
      km: 0,
      from: { lat: place.lat, lng: place.lng },
      to: { lat: place.lat, lng: place.lng },
    });
    visited.push({
      lat: place.lat,
      lng: place.lng,
      arrivedAt,
      leftAt,
      minutes: leave - arrive,
      fixes: Math.max(3, Math.round((leave - arrive) / 2)),
      accuracy: fixAccuracy,
    });
    clock = leave;
    const next = i + 1 < stops.length ? stops[i + 1] : endsAtOffice ? OFFICE : null;
    if (next) {
      const minutes = moveMinutes[i];
      timeline.push({
        kind: "move",
        startedAt: leftAt,
        endedAt: at(date, clock + minutes),
        minutes,
        km: round2(moves[i]),
        from: { lat: place.lat, lng: place.lng },
        to: { lat: next.lat, lng: next.lng },
      });
      clock += minutes;
    }
  });
  if (endsAtOffice) route.push({ ...near(OFFICE), recordedAt: at(date, checkOutMin), accuracy: accuracy() });

  const totalKm = round2(moves.reduce((s, km) => s + km, 0));
  const movingMinutes = moveMinutes.reduce((s, m) => s + m, 0);
  const fixes = route.length + visited.reduce((s, v) => s + v.fixes, 0) + Math.round(movingMinutes * 2);
  const checkIn = { at: at(date, checkInMin), lat: OFFICE.lat, lng: OFFICE.lng, accuracy: route[0].accuracy ?? null, address: OFFICE.name };
  const last = route[route.length - 1];
  const checkOut = { at: at(date, checkOutMin), lat: checkOutPlace.lat, lng: checkOutPlace.lng, accuracy: last.accuracy ?? null, address: checkOutPlace.name };
  const id = `${DEMO_SHIFT_PREFIX}${date}`;

  const location = (p: { lat: number; lng: number; accuracy: number | null; address: string }) => ({
    latitude: p.lat,
    longitude: p.lng,
    accuracy: p.accuracy,
    address: p.address,
    mapsUrl: `https://www.google.com/maps?q=${p.lat},${p.lng}`,
  });

  return {
    route: {
      attendanceId: id,
      date,
      status: "present",
      onDuty: false,
      checkIn,
      checkOut,
      shiftMinutes,
      summary: {
        date,
        fixes,
        totalKm,
        movingMinutes,
        idleMinutes: shiftMinutes - movingMinutes,
        trackedMinutes: shiftMinutes,
        startedAt: checkIn.at,
        endedAt: checkOut.at,
        startLocation: { lat: OFFICE.lat, lng: OFFICE.lng },
        endLocation: { lat: checkOutPlace.lat, lng: checkOutPlace.lng },
        latest: last,
        route,
        timeline,
        visited,
      },
    },
    record: {
      _id: id,
      date,
      checkedIn: true,
      checkInTime: checkIn.at,
      checkInLocation: location(checkIn),
      checkedOut: true,
      checkOutTime: checkOut.at,
      checkOutLocation: location(checkOut),
      totalWorkingMinutes: shiftMinutes,
      status: "present",
      distanceKm: totalKm,
      trackedPoints: fixes,
    },
  };
};

/**
 * The attendance drawer's data for the demo agent: generated past shifts in the
 * chosen dates, plus today's real record from the server, with totals to match.
 */
export const withDemoAttendance = (
  real: any,
  range: { startDate: string; endDate: string },
): any => {
  const today = istDay(new Date());
  const inRange = (date: string) =>
    (!range.startDate || date >= range.startDate) && (!range.endDate || date <= range.endDate);
  const todays = (real?.records ?? []).filter((r: any) => r?.date === today);
  const demo = demoDates().filter(inRange).map((date) => buildShift(date).record);
  const records: any[] = [...todays, ...demo];

  const worked = records.filter((r) => r.checkedIn || r.checkInTime);
  const minutes = worked.reduce((s, r) => s + Number(r.totalWorkingMinutes || 0), 0);
  const totalDistanceKm = round2(worked.reduce((s, r) => s + Number(r.distanceKm || 0), 0));
  const longest = worked.reduce<any>((best, r) => (!best || Number(r.distanceKm || 0) > Number(best.distanceKm || 0) ? r : best), null);
  const totalHours = Number((minutes / 60).toFixed(1));
  const summary = {
    ...(real?.summary ?? {}),
    totalDaysPresent: worked.length,
    totalWorkingHours: totalHours,
    totalHoursWorked: `${totalHours} hrs`,
    totalMinutesWorked: minutes,
    totalRecords: records.length,
    totalDistanceKm,
    averageKmPerDay: worked.length ? round2(totalDistanceKm / worked.length) : 0,
    longestDayKm: longest ? Number(longest.distanceKm || 0) : 0,
    longestDayDate: longest ? String(longest.date) : null,
    daysWithRoute: worked.filter((r) => Number(r.trackedPoints || 0) > 0).length,
    presentDays: worked.filter((r) => r.status === "present").length,
    halfDays: worked.filter((r) => r.status === "half_day").length,
  };
  return { ...real, records, items: records, total: records.length, summary, stats: summary };
};

/**
 * Days present for the demo agent across all time, as the attendance logs show
 * it: every demo shift, plus today when they really checked in.
 */
export const demoDaysPresent = (checkedInToday: boolean): number =>
  DEMO_DAYS + (checkedInToday ? 1 : 0);

/** The monitoring page's data for one demo shift, or null for any other id. */
export const demoShiftRoute = (attendanceId: string): ShiftRoute | null => {
  const date = attendanceId.slice(DEMO_SHIFT_PREFIX.length);
  return demoDates().includes(date) ? buildShift(date).route : null;
};

/** The agent fields the monitoring page shows, taken from the server's agent record. */
export const demoRouteAgent = (agentId: string, agent: any): ShiftRouteAgent => ({
  id: agentId,
  name: String(agent?.name ?? ""),
  phone: agent?.phone,
  role: agent?.role,
  state: agent?.state,
  district: agent?.district,
});
