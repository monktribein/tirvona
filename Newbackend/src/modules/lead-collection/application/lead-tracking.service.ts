import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import { Model, Types } from "../../../database/orm";
import {
  LEAD_ATTENDANCE_MODEL,
  LEAD_CONNECTION,
  LEAD_LOCATION_PING_MODEL,
  LEAD_TRACKING,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import {
  filterFixes,
  summariseDay,
  type DaySummary,
  type RawFix,
} from "../domain/lead-tracking";

/**
 * Slack around a shift's check-in and check-out. Fixes are stamped by the
 * phone's clock and the shift by the server's, and the last fixes of a shift
 * are uploaded just before the check-out request lands.
 */
const SHIFT_GRACE_MS = 5 * 60_000;

/** A check-in/out fix only counts when the device actually sent one. */
const hasFix = (coords: any): coords is { lat: number; lng: number; accuracy?: number | null } =>
  coords != null &&
  Number.isFinite(coords.lat) &&
  Number.isFinite(coords.lng) &&
  !(coords.lat === 0 && coords.lng === 0);

/**
 * Last moment of a shift's attendance day. Attendance days are IST dates, so
 * the day ends at 23:59:59.999 IST; without a date, 24h after check-in.
 */
const endOfShiftDay = (record: any): number => {
  const day = String(record?.date ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return Date.parse(`${day}T23:59:59.999+05:30`);
  return new Date(record.checkInTime).getTime() + 24 * 60 * 60_000;
};

interface ShiftWindow {
  start: number;
  end: number;
}

export interface ShiftPoint {
  at: Date;
  lat: number | null;
  lng: number | null;
  address: string;
}

export interface ShiftRoute {
  attendanceId: string;
  date: string;
  status: string;
  onDuty: boolean;
  checkIn: ShiftPoint;
  checkOut: ShiftPoint | null;
  shiftMinutes: number;
  summary: DaySummary;
}
import type { AuthenticatedLeadUser } from "../domain/lead-collection.types";
import type {
  RecordFixesDto,
  TrackingConsentDto,
  TrackingHistoryQueryDto,
} from "../presentation/dtos/lead-tracking.dto";

const dayString = (value?: string | null): string =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);

/** The day a fix belongs to, taken from the device clock. */
const dayOf = (recordedAt: Date): string =>
  recordedAt.toISOString().slice(0, 10);

export interface ConsentState {
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  deviceLabel: string;
}

@Injectable()
export class LeadTrackingService {
  private readonly logger = new Logger(LeadTrackingService.name);

  constructor(
    @InjectModel(LEAD_LOCATION_PING_MODEL, LEAD_CONNECTION)
    private readonly pings: Model<any>,
    @InjectModel(LEAD_USER_MODEL, LEAD_CONNECTION)
    private readonly users: Model<any>,
    @InjectModel(LEAD_ATTENDANCE_MODEL, LEAD_CONNECTION)
    private readonly attendance: Model<any>,
  ) {}

  /** Attendance rows store the agent id as a string or an ObjectId. */
  private agentFilter(agentId: string) {
    return { $or: [{ agentId }, { agentId: this.objectId(agentId) }] };
  }

  /**
   * Check-in to check-out, padded by the grace. A shift never checked out runs
   * until now, but never past the end of its own day: an agent who forgot to
   * check out must not have the following days counted into that shift.
   */
  private shiftWindow(record: any, now = Date.now()): ShiftWindow {
    const start = new Date(record.checkInTime).getTime();
    const end =
      record.checkedOut && record.checkOutTime
        ? new Date(record.checkOutTime).getTime()
        : Math.min(now, endOfShiftDay(record));
    return { start: start - SHIFT_GRACE_MS, end: end + SHIFT_GRACE_MS };
  }

  /** Open, and still on its own day: the agent is really on duty right now. */
  private isOpenToday(record: any, now = Date.now()): boolean {
    return Boolean(record?.checkInTime) && !record.checkedOut && now <= endOfShiftDay(record);
  }

  /** Over: checked out, or left open past the end of its day. Its route can no longer grow. */
  private isFinished(record: any, now = Date.now()): boolean {
    return Boolean(record?.checkInTime) && !this.isOpenToday(record, now);
  }

  /** A finished shift's saved total, when one has been measured. */
  private savedDistance(record: any): { km: number; points: number } | null {
    return typeof record?.distanceKm === "number" && Number.isFinite(record.distanceKm)
      ? { km: record.distanceKm, points: Number(record.trackedPoints ?? 0) }
      : null;
  }

  /** Stores a finished shift's distance so it outlives the raw points' retention. */
  private async storeDistance(record: any, km: number, points: number): Promise<void> {
    if (!record?._id) return;
    await this.attendance
      .updateOne(
        { _id: record._id },
        { $set: { distanceKm: km, trackedPoints: points, distanceMeasuredAt: new Date() } },
      )
      .catch((error: unknown) =>
        this.logger.warn(`Could not save shift distance for ${record._id}: ${(error as Error)?.message}`),
      );
  }

  /**
   * Measures one shift and saves the total. Called at check-out, after the
   * phone has uploaded its last points. Callers authorise `agentId`.
   */
  async saveShiftDistance(agentId: string, attendanceId: string): Promise<number | null> {
    if (!Types.ObjectId.isValid(String(attendanceId))) return null;
    const record: any = await this.attendance
      .findOne({ _id: new Types.ObjectId(String(attendanceId)), ...this.agentFilter(agentId) })
      .lean();
    if (!record?.checkInTime) return null;
    const window = this.shiftWindow(record);
    const pings = await this.pingsBetween(agentId, window.start, window.end);
    const summary = this.buildShift(record, pings);
    await this.storeDistance(record, summary.totalKm, pings.length);
    return summary.totalKm;
  }

  /** Shifts that overlap [from, to], plus whether one is open right now. */
  private async shiftsBetween(
    agentId: string,
    from: Date,
    to: Date,
  ): Promise<{ windows: ShiftWindow[]; onDuty: boolean }> {
    const rows = await this.attendance
      .find({
        ...this.agentFilter(agentId),
        checkInTime: { $ne: null, $lte: new Date(to.getTime() + SHIFT_GRACE_MS) },
      })
      .sort({ checkInTime: -1 })
      .limit(5)
      .select("date checkInTime checkOutTime checkedOut")
      .lean();

    const now = Date.now();
    const windows = (rows as any[])
      .map((row) => this.shiftWindow(row, now))
      .filter((w) => w.end >= from.getTime());
    const onDuty = (rows as any[]).some((row) => this.isOpenToday(row, now));
    return { windows, onDuty };
  }

  /**
   * One shift's route. The check-in and check-out fixes bracket the tracked
   * points, so the distance runs from where the agent clocked in to where they
   * clocked out, and every point is re-filtered as one sequence.
   */
  private buildShift(record: any, pings: any[]): DaySummary {
    const raw: RawFix[] = [];
    const checkIn = record.checkInCoords;
    if (hasFix(checkIn))
      raw.push({
        lat: checkIn.lat,
        lng: checkIn.lng,
        accuracy: checkIn.accuracy ?? null,
        recordedAt: new Date(record.checkInTime),
        source: "check_in",
      });
    for (const ping of pings)
      raw.push({
        lat: ping.lat,
        lng: ping.lng,
        accuracy: ping.accuracy ?? null,
        recordedAt: new Date(ping.recordedAt),
      });
    const checkOut = record.checkOutCoords;
    if (record.checkedOut && record.checkOutTime && hasFix(checkOut))
      raw.push({
        lat: checkOut.lat,
        lng: checkOut.lng,
        accuracy: checkOut.accuracy ?? null,
        recordedAt: new Date(record.checkOutTime),
        source: "check_out",
      });

    const { accepted } = filterFixes(raw, null);
    return summariseDay(String(record.date ?? ""), accepted);
  }

  private pingsBetween(agentId: string, from: number, to: number) {
    return this.pings
      .find({
        agentId: this.objectId(agentId),
        recordedAt: { $gte: new Date(from), $lte: new Date(to) },
      })
      .sort({ recordedAt: 1 })
      .select("lat lng accuracy recordedAt")
      .lean() as Promise<any[]>;
  }

  /**
   * An attendance history (as `LeadAttendanceService` returns it) with each
   * shift's distance, and the total across the shifts shown.
   */
  async withAttendanceDistances(
    agentId: string,
    history: any,
    range: { date?: string; startDate?: string; endDate?: string } = {},
  ): Promise<any> {
    // Totals cover every shift in the chosen dates, not just the page shown.
    const isDay = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
    const filter: Record<string, any> = { ...this.agentFilter(agentId) };
    if (isDay(range.date)) filter.date = range.date;
    if (isDay(range.startDate) || isDay(range.endDate)) {
      filter.date = {
        ...(isDay(range.startDate) ? { $gte: range.startDate } : {}),
        ...(isDay(range.endDate) ? { $lte: range.endDate } : {}),
      };
    }
    const shifts = await this.attendance
      .find(filter)
      .select("date checkInTime checkOutTime checkedIn checkedOut checkInCoords checkOutCoords status distanceKm trackedPoints")
      .lean();
    const measured = await this.withShiftDistances(agentId, shifts as any[]);
    const byId = new Map(measured.map((row: any) => [String(row._id), row]));

    const records = (history?.records ?? []).map((r: any) => {
      const m = byId.get(String(r._id));
      return { ...r, distanceKm: m?.distanceKm ?? 0, trackedPoints: m?.trackedPoints ?? 0 };
    });

    const round = (n: number) => Math.round(n * 100) / 100;
    const worked = measured.filter((r: any) => r.checkInTime);
    const totalDistanceKm = round(worked.reduce((sum: number, r: any) => sum + r.distanceKm, 0));
    const longest = worked.reduce(
      (best: any, r: any) => (!best || r.distanceKm > best.distanceKm ? r : best),
      null,
    );
    const summary = {
      ...(history?.summary ?? {}),
      totalDistanceKm,
      averageKmPerDay: worked.length ? round(totalDistanceKm / worked.length) : 0,
      longestDayKm: longest ? longest.distanceKm : 0,
      longestDayDate: longest ? String(longest.date ?? "") : null,
      daysWithRoute: worked.filter((r: any) => r.trackedPoints > 0).length,
      presentDays: worked.filter((r: any) => r.status === "present").length,
      halfDays: worked.filter((r: any) => r.status === "half_day").length,
      range: {
        startDate: isDay(range.startDate) ? range.startDate : isDay(range.date) ? range.date : null,
        endDate: isDay(range.endDate) ? range.endDate : isDay(range.date) ? range.date : null,
      },
    };
    return { ...history, records, items: records, summary, stats: summary };
  }

  /** Whether the agent is checked in right now, i.e. their device should be tracking. */
  async isOnDuty(agentId: string): Promise<boolean> {
    // Newest open shift only; one left open on an earlier day does not count.
    const open = await this.attendance
      .findOne({ ...this.agentFilter(agentId), checkedIn: true, checkedOut: { $ne: true } })
      .sort({ checkInTime: -1 })
      .select("date checkInTime checkedOut")
      .lean();
    return this.isOpenToday(open);
  }

  /** The full route of one check-in → check-out shift. Callers authorise `agentId`. */
  async shiftRoute(agentId: string, attendanceId: string): Promise<ShiftRoute> {
    if (!Types.ObjectId.isValid(attendanceId))
      throw new NotFoundException("Attendance record not found");
    const record: any = await this.attendance
      .findOne({ _id: new Types.ObjectId(attendanceId), ...this.agentFilter(agentId) })
      .lean();
    if (!record || !record.checkInTime)
      throw new NotFoundException("Attendance record not found");

    const window = this.shiftWindow(record);
    const pings = await this.pingsBetween(agentId, window.start, window.end);
    const summary = this.buildShift(record, pings);

    // A finished shift keeps its saved total even after its points expire;
    // one never measured is measured now.
    if (this.isFinished(record)) {
      const saved = this.savedDistance(record);
      if (saved) summary.totalKm = saved.km;
      else await this.storeDistance(record, summary.totalKm, pings.length);
    }

    const checkInAt = new Date(record.checkInTime);
    const checkOutAt =
      record.checkedOut && record.checkOutTime ? new Date(record.checkOutTime) : null;

    return {
      attendanceId: String(record._id),
      date: String(record.date ?? ""),
      status: String(record.status ?? (checkOutAt ? "present" : "checked_in")),
      // A shift left open on an earlier day is over, not live.
      onDuty: !checkOutAt && this.isOpenToday(record),
      checkIn: {
        at: checkInAt,
        lat: hasFix(record.checkInCoords) ? record.checkInCoords.lat : null,
        lng: hasFix(record.checkInCoords) ? record.checkInCoords.lng : null,
        address: String(record.checkInAddress ?? ""),
      },
      checkOut: checkOutAt
        ? {
            at: checkOutAt,
            lat: hasFix(record.checkOutCoords) ? record.checkOutCoords.lat : null,
            lng: hasFix(record.checkOutCoords) ? record.checkOutCoords.lng : null,
            address: String(record.checkOutAddress ?? ""),
          }
        : null,
      shiftMinutes: Math.round(
        ((checkOutAt?.getTime() ?? Math.min(Date.now(), endOfShiftDay(record))) - checkInAt.getTime()) /
          60_000,
      ),
      summary,
    };
  }

  /**
   * Adds `distanceKm` and `trackedPoints` to attendance rows. One query covers
   * every shift on the page; each shift then takes its own slice.
   */
  async withShiftDistances<T extends Record<string, any>>(
    agentId: string,
    records: T[],
  ): Promise<Array<T & { distanceKm: number; trackedPoints: number }>> {
    const now = Date.now();
    // Finished shifts with a saved total need no points at all.
    const toMeasure = records.filter(
      (r) => r.checkInTime && !(this.isFinished(r, now) && this.savedDistance(r)),
    );

    const windows = new Map(toMeasure.map((r) => [r, this.shiftWindow(r, now)]));
    const pings = windows.size
      ? await this.pingsBetween(
          agentId,
          Math.min(...[...windows.values()].map((w) => w.start)),
          Math.max(...[...windows.values()].map((w) => w.end)),
        )
      : [];

    const backfill: Promise<void>[] = [];
    const rows = records.map((record) => {
      if (!record.checkInTime) return { ...record, distanceKm: 0, trackedPoints: 0 };
      const saved = this.isFinished(record, now) ? this.savedDistance(record) : null;
      if (saved) return { ...record, distanceKm: saved.km, trackedPoints: saved.points };

      const window = windows.get(record)!;
      const slice = pings.filter((p) => {
        const t = new Date(p.recordedAt).getTime();
        return t >= window.start && t <= window.end;
      });
      const summary = this.buildShift(record, slice);
      // A finished shift measured for the first time is saved for good.
      if (this.isFinished(record, now))
        backfill.push(this.storeDistance(record, summary.totalKm, slice.length));
      return { ...record, distanceKm: summary.totalKm, trackedPoints: slice.length };
    });
    await Promise.all(backfill);
    return rows;
  }

  private objectId(id: string): Types.ObjectId | string {
    return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;
  }

  // ── Consent ───────────────────────────────────────────────────────────────

  async getConsent(agentId: string): Promise<ConsentState> {
    const user = await this.users
      .findById(this.objectId(agentId))
      .select("trackingConsent")
      .lean();
    if (!user) throw new NotFoundException("Field agent not found");
    return this.readConsent(user);
  }

  private readConsent(user: any): ConsentState {
    const consent = user?.trackingConsent ?? {};
    return {
      granted: Boolean(consent.granted),
      grantedAt: consent.grantedAt ?? null,
      revokedAt: consent.revokedAt ?? null,
      deviceLabel: String(consent.deviceLabel ?? ""),
    };
  }

  /**
   * Consent is the agent's own to give and to take back. Revoking stops future
   * collection; it deliberately leaves history in place, which the retention
   * index expires on its own schedule.
   */
  async setConsent(
    agent: AuthenticatedLeadUser,
    dto: TrackingConsentDto,
  ): Promise<ConsentState> {
    const now = new Date();
    const patch = dto.granted
      ? {
          "trackingConsent.granted": true,
          "trackingConsent.grantedAt": now,
          "trackingConsent.revokedAt": null,
          "trackingConsent.deviceLabel": dto.deviceLabel ?? "",
        }
      : {
          "trackingConsent.granted": false,
          "trackingConsent.revokedAt": now,
        };

    const updated = await this.users
      .findByIdAndUpdate(this.objectId(agent.id), { $set: patch }, { new: true })
      .select("trackingConsent")
      .lean();
    if (!updated) throw new NotFoundException("Field agent not found");

    this.logger.log(
      JSON.stringify({
        event: dto.granted
          ? "lead.tracking_consent_granted"
          : "lead.tracking_consent_revoked",
        agentId: agent.id,
        district: agent.district,
      }),
    );

    return this.readConsent(updated);
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  /**
   * Accepts a batch of fixes from the agent's own device. Consent is checked
   * on every write rather than trusted from the client, so revoking it stops
   * collection immediately even if the phone keeps uploading.
   */
  async recordFixes(
    agent: AuthenticatedLeadUser,
    dto: RecordFixesDto,
  ): Promise<{
    accepted: number;
    rejected: number;
    reasons: Record<string, number>;
    /** False once the agent has checked out: the device should stop tracking. */
    onDuty: boolean;
    summary: DaySummary;
  }> {
    const consent = await this.getConsent(agent.id);
    if (!consent.granted)
      throw new ForbiddenException(
        "Location tracking is off. Turn it on to record your route.",
      );

    const submitted: RawFix[] = dto.fixes.map((fix) => ({
      lat: Number(fix.lat),
      lng: Number(fix.lng),
      accuracy: fix.accuracy ?? null,
      speed: fix.speed ?? null,
      heading: fix.heading ?? null,
      altitude: fix.altitude ?? null,
      recordedAt: new Date(fix.recordedAt),
      source: fix.source ?? "foreground",
    }));

    // Tracking runs from check-in to check-out. Points recorded outside a
    // shift are dropped, so time off duty is never mapped or counted.
    const stamps = submitted
      .map((fix) => fix.recordedAt.getTime())
      .filter((t) => Number.isFinite(t));
    const { windows, onDuty } = stamps.length
      ? await this.shiftsBetween(
          agent.id,
          new Date(Math.min(...stamps)),
          new Date(Math.max(...stamps)),
        )
      : { windows: [], onDuty: false };
    const incoming = submitted.filter((fix) => {
      const t = fix.recordedAt.getTime();
      return windows.some((w) => t >= w.start && t <= w.end);
    });
    const offDuty = submitted.length - incoming.length;

    if (!incoming.length) {
      return {
        accepted: 0,
        rejected: offDuty,
        reasons: offDuty ? { off_duty: offDuty } : {},
        onDuty,
        summary: await this.day(agent.id),
      };
    }

    // A batch usually continues the same day, so the last stored fix becomes
    // the baseline and the first point of a batch is not counted as a jump.
    const today = dayOf(incoming[0].recordedAt);
    const previous = await this.pings
      .findOne({ agentId: this.objectId(agent.id), date: today })
      .sort({ recordedAt: -1 })
      .select("lat lng recordedAt")
      .lean();

    const { accepted, rejected } = filterFixes(
      incoming,
      previous
        ? {
            lat: (previous as any).lat,
            lng: (previous as any).lng,
            recordedAt: (previous as any).recordedAt,
          }
        : null,
    );

    if (accepted.length) {
      const docs = accepted.map((fix) => ({
        agentId: this.objectId(agent.id),
        agentName: agent.name,
        state: agent.state,
        district: agent.district,
        date: dayOf(fix.recordedAt),
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy ?? null,
        speed: fix.speed ?? null,
        heading: fix.heading ?? null,
        altitude: fix.altitude ?? null,
        recordedAt: fix.recordedAt,
        metresFromPrevious: fix.metresFromPrevious,
        source: fix.source ?? "foreground",
      }));

      // A retried upload replays fixes already stored; the unique index makes
      // those duplicates harmless instead of double-counting the distance.
      await this.pings.insertMany(docs, { ordered: false }).catch((error) => {
        const code = (error as any)?.code;
        if (code !== 11000) throw error;
      });

      // Points uploaded late (phone was offline) for a shift that already has
      // a saved total: clear it so the next read measures it again.
      const first = accepted[0].recordedAt.getTime();
      const last = accepted[accepted.length - 1].recordedAt.getTime();
      await this.attendance
        .updateMany(
          {
            $and: [
              this.agentFilter(agent.id),
              { distanceKm: { $ne: null } },
              { checkInTime: { $lte: new Date(last + SHIFT_GRACE_MS) } },
              {
                $or: [
                  // Never checked out: only a shift that began within a day of these points.
                  { checkOutTime: null, checkInTime: { $gte: new Date(first - 24 * 60 * 60_000) } },
                  { checkOutTime: { $gte: new Date(first - SHIFT_GRACE_MS) } },
                ],
              },
            ],
          },
          { $set: { distanceKm: null, trackedPoints: null, distanceMeasuredAt: null } },
        )
        .catch((error: unknown) =>
          this.logger.warn(`Could not refresh saved shift distance: ${(error as Error)?.message}`),
        );
    }

    const reasons: Record<string, number> = {};
    for (const row of rejected)
      reasons[row.reason] = (reasons[row.reason] ?? 0) + 1;
    if (offDuty) reasons.off_duty = offDuty;

    return {
      accepted: accepted.length,
      rejected: rejected.length + offDuty,
      reasons,
      onDuty,
      summary: await this.day(agent.id, today),
    };
  }

  // ── Reading ───────────────────────────────────────────────────────────────

  /** One agent's day. Callers are responsible for authorising `agentId`. */
  async day(agentId: string, date?: string): Promise<DaySummary> {
    const day = dayString(date);
    const fixes = await this.pings
      .find({ agentId: this.objectId(agentId), date: day })
      .sort({ recordedAt: 1 })
      .select("lat lng accuracy recordedAt metresFromPrevious")
      .lean();

    return summariseDay(day, fixes as any[]);
  }

  /**
   * Per-day totals across a range, for the history picker. Summing in the database
   * keeps the whole range off the wire; only the chosen day loads its route.
   */
  async history(
    agentId: string,
    query: TrackingHistoryQueryDto,
  ): Promise<
    { date: string; fixes: number; totalKm: number; firstAt: Date; lastAt: Date }[]
  > {
    const match: Record<string, unknown> = {
      agentId: this.objectId(agentId),
    };
    if (query.startDate || query.endDate) {
      const range: Record<string, string> = {};
      if (query.startDate) range.$gte = query.startDate;
      if (query.endDate) range.$lte = query.endDate;
      match.date = range;
    }

    const rows = await this.pings.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$date",
          fixes: { $sum: 1 },
          metres: { $sum: { $ifNull: ["$metresFromPrevious", 0] } },
          firstAt: { $min: "$recordedAt" },
          lastAt: { $max: "$recordedAt" },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 90 },
    ]);

    return (rows as any[]).map((row) => ({
      date: String(row._id),
      fixes: Number(row.fixes ?? 0),
      totalKm: Math.round(Number(row.metres ?? 0) / 10) / 100,
      firstAt: row.firstAt,
      lastAt: row.lastAt,
    }));
  }

  /**
   * The newest fix for every agent in a district, for the supervisor's live
   * board. One aggregation rather than a query per agent.
   */
  async liveBoard(
    scope: { state?: string; district?: string },
    sinceMinutes = 12 * 60,
  ): Promise<
    {
      agentId: string;
      agentName: string;
      lat: number;
      lng: number;
      recordedAt: Date;
      minutesAgo: number;
    }[]
  > {
    const match: Record<string, unknown> = {
      recordedAt: { $gte: new Date(Date.now() - sinceMinutes * 60_000) },
    };
    if (scope.district) match.district = scope.district;
    if (scope.state) match.state = scope.state;

    const rows = await this.pings.aggregate([
      { $match: match },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: "$agentId",
          agentName: { $first: "$agentName" },
          lat: { $first: "$lat" },
          lng: { $first: "$lng" },
          recordedAt: { $first: "$recordedAt" },
        },
      },
      { $sort: { recordedAt: -1 } },
      { $limit: 500 },
    ]);

    const now = Date.now();
    return (rows as any[]).map((row) => ({
      agentId: String(row._id),
      agentName: String(row.agentName ?? ""),
      lat: Number(row.lat),
      lng: Number(row.lng),
      recordedAt: row.recordedAt,
      minutesAgo: Math.round((now - new Date(row.recordedAt).getTime()) / 60_000),
    }));
  }

  /** The rules the client should mirror, so the two never drift apart. */
  settings(): typeof LEAD_TRACKING {
    return LEAD_TRACKING;
  }
}
