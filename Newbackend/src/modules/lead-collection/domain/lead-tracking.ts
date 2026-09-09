import { LEAD_TRACKING } from "./lead-collection.constants";

/**
 * The route maths, kept free of Mongoose so the filtering rules that decide
 * what counts as real movement can be tested directly.
 *
 * A phone's GPS is noisy in exactly the ways that inflate a distance total:
 * it drifts by a few metres while stationary, and it occasionally reports a
 * wild fix from a cell tower. Both are rejected here rather than plotted.
 */

export interface RawFix {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  recordedAt: Date;
  source?: string;
}

export interface AcceptedFix extends RawFix {
  metresFromPrevious: number;
}

export interface RejectedFix {
  recordedAt: Date;
  reason:
    | "out_of_range"
    | "null_island"
    | "inaccurate"
    | "impossible_speed"
    | "not_moved"
    | "out_of_order";
}

export interface TimelineLeg {
  kind: "move" | "stop";
  startedAt: Date;
  endedAt: Date;
  minutes: number;
  km: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

export interface VisitedPlace {
  lat: number;
  lng: number;
  arrivedAt: Date;
  leftAt: Date;
  minutes: number;
  fixes: number;
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Metres between two fixes. Unrounded on purpose: the platform's shared
 * `haversineDistance` rounds to 0.1 km, and summing hundreds of legs at that
 * resolution would bury every short walk inside the rounding error.
 */
export const metresBetween = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isPlottable = (fix: RawFix): boolean =>
  Number.isFinite(fix.lat) &&
  Number.isFinite(fix.lng) &&
  Math.abs(fix.lat) <= 90 &&
  Math.abs(fix.lng) <= 180;

const minutesBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / 60_000;

const round = (value: number, places = 2): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Applies the quality gates in order, carrying the last *accepted* fix forward
 * so a rejected point never becomes the baseline for the next comparison.
 * `previous` lets a batch continue from what is already stored for the day.
 */
export const filterFixes = (
  fixes: RawFix[],
  previous?: { lat: number; lng: number; recordedAt: Date } | null,
): { accepted: AcceptedFix[]; rejected: RejectedFix[] } => {
  const accepted: AcceptedFix[] = [];
  const rejected: RejectedFix[] = [];

  const ordered = [...fixes].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );

  let last = previous ?? null;

  for (const fix of ordered) {
    if (!isPlottable(fix)) {
      rejected.push({ recordedAt: fix.recordedAt, reason: "out_of_range" });
      continue;
    }
    // 0,0 is the Atlantic; a device reports it when it has no fix at all.
    if (fix.lat === 0 && fix.lng === 0) {
      rejected.push({ recordedAt: fix.recordedAt, reason: "null_island" });
      continue;
    }
    if (
      fix.accuracy != null &&
      Number.isFinite(fix.accuracy) &&
      fix.accuracy > LEAD_TRACKING.maxAccuracyMetres
    ) {
      rejected.push({ recordedAt: fix.recordedAt, reason: "inaccurate" });
      continue;
    }

    if (!last) {
      accepted.push({ ...fix, metresFromPrevious: 0 });
      last = { lat: fix.lat, lng: fix.lng, recordedAt: fix.recordedAt };
      continue;
    }

    const elapsedMinutes = minutesBetween(last.recordedAt, fix.recordedAt);
    if (elapsedMinutes <= 0) {
      rejected.push({ recordedAt: fix.recordedAt, reason: "out_of_order" });
      continue;
    }

    const metres = metresBetween(last.lat, last.lng, fix.lat, fix.lng);

    const kmph = metres / 1000 / (elapsedMinutes / 60);
    if (kmph > LEAD_TRACKING.maxSpeedKmph) {
      rejected.push({ recordedAt: fix.recordedAt, reason: "impossible_speed" });
      continue;
    }

    // Standing still still produces fixes. They are kept out of the route so
    // the day's total is distance travelled rather than accumulated jitter.
    if (metres < LEAD_TRACKING.minMovementMetres) {
      rejected.push({ recordedAt: fix.recordedAt, reason: "not_moved" });
      continue;
    }

    accepted.push({ ...fix, metresFromPrevious: metres });
    last = { lat: fix.lat, lng: fix.lng, recordedAt: fix.recordedAt };
  }

  return { accepted, rejected };
};

export interface StoredFix {
  lat: number;
  lng: number;
  recordedAt: Date;
  accuracy?: number | null;
  metresFromPrevious?: number | null;
}

export interface DaySummary {
  date: string;
  fixes: number;
  totalKm: number;
  movingMinutes: number;
  idleMinutes: number;
  trackedMinutes: number;
  startedAt: Date | null;
  endedAt: Date | null;
  startLocation: { lat: number; lng: number } | null;
  endLocation: { lat: number; lng: number } | null;
  latest: { lat: number; lng: number; recordedAt: Date } | null;
  route: { lat: number; lng: number; recordedAt: Date }[];
  timeline: TimelineLeg[];
  visited: VisitedPlace[];
}

/**
 * Turns a day's stored fixes into the numbers the dashboards show.
 *
 * A stop is a run of consecutive fixes that never leaves `stopRadiusMetres`
 * of where the run began and lasts at least `stopMinutes`; anything else is
 * movement. A gap longer than `maxGapMinutes` is treated as tracking having
 * been off rather than as a very slow journey, so it counts toward neither
 * moving nor idle time.
 */
export const summariseDay = (
  date: string,
  fixes: StoredFix[],
): DaySummary => {
  const ordered = [...fixes].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );

  const empty: DaySummary = {
    date,
    fixes: 0,
    totalKm: 0,
    movingMinutes: 0,
    idleMinutes: 0,
    trackedMinutes: 0,
    startedAt: null,
    endedAt: null,
    startLocation: null,
    endLocation: null,
    latest: null,
    route: [],
    timeline: [],
    visited: [],
  };
  if (!ordered.length) return empty;

  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const totalMetres = ordered.reduce(
    (sum, fix) => sum + Math.max(0, Number(fix.metresFromPrevious ?? 0)),
    0,
  );

  const timeline: TimelineLeg[] = [];
  const visited: VisitedPlace[] = [];
  let movingMinutes = 0;
  let idleMinutes = 0;

  let index = 0;
  while (index < ordered.length - 1) {
    const anchor = ordered[index];
    let end = index;

    // Extend while the agent stays within the stop radius of the anchor.
    while (
      end + 1 < ordered.length &&
      metresBetween(
        anchor.lat,
        anchor.lng,
        ordered[end + 1].lat,
        ordered[end + 1].lng,
      ) <= LEAD_TRACKING.stopRadiusMetres &&
      minutesBetween(ordered[end].recordedAt, ordered[end + 1].recordedAt) <=
        LEAD_TRACKING.maxGapMinutes
    )
      end += 1;

    const dwell = minutesBetween(
      anchor.recordedAt,
      ordered[end].recordedAt,
    );

    if (end > index && dwell >= LEAD_TRACKING.stopMinutes) {
      idleMinutes += dwell;
      timeline.push({
        kind: "stop",
        startedAt: anchor.recordedAt,
        endedAt: ordered[end].recordedAt,
        minutes: round(dwell, 1),
        km: 0,
        from: { lat: anchor.lat, lng: anchor.lng },
        to: { lat: ordered[end].lat, lng: ordered[end].lng },
      });
      visited.push({
        lat: round(anchor.lat, 6),
        lng: round(anchor.lng, 6),
        arrivedAt: anchor.recordedAt,
        leftAt: ordered[end].recordedAt,
        minutes: round(dwell, 1),
        fixes: end - index + 1,
      });
      index = end;
      continue;
    }

    // Otherwise this fix and the next form a leg of travel.
    const next = ordered[index + 1];
    const gap = minutesBetween(anchor.recordedAt, next.recordedAt);
    const legMetres = Math.max(0, Number(next.metresFromPrevious ?? 0));

    if (gap <= LEAD_TRACKING.maxGapMinutes) {
      movingMinutes += gap;
      timeline.push({
        kind: "move",
        startedAt: anchor.recordedAt,
        endedAt: next.recordedAt,
        minutes: round(gap, 1),
        km: round(legMetres / 1000, 3),
        from: { lat: anchor.lat, lng: anchor.lng },
        to: { lat: next.lat, lng: next.lng },
      });
    }
    index += 1;
  }

  return {
    date,
    fixes: ordered.length,
    totalKm: round(totalMetres / 1000, 2),
    movingMinutes: round(movingMinutes, 1),
    idleMinutes: round(idleMinutes, 1),
    trackedMinutes: round(
      minutesBetween(first.recordedAt, last.recordedAt),
      1,
    ),
    startedAt: first.recordedAt,
    endedAt: last.recordedAt,
    startLocation: { lat: first.lat, lng: first.lng },
    endLocation: { lat: last.lat, lng: last.lng },
    latest: { lat: last.lat, lng: last.lng, recordedAt: last.recordedAt },
    route: ordered.map((fix) => ({
      lat: fix.lat,
      lng: fix.lng,
      recordedAt: fix.recordedAt,
    })),
    timeline,
    visited,
  };
};
