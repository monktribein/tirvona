import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
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
  ) {}

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
    summary: DaySummary;
  }> {
    const consent = await this.getConsent(agent.id);
    if (!consent.granted)
      throw new ForbiddenException(
        "Location tracking is off. Turn it on to record your route.",
      );

    const incoming: RawFix[] = dto.fixes.map((fix) => ({
      lat: Number(fix.lat),
      lng: Number(fix.lng),
      accuracy: fix.accuracy ?? null,
      speed: fix.speed ?? null,
      heading: fix.heading ?? null,
      altitude: fix.altitude ?? null,
      recordedAt: new Date(fix.recordedAt),
      source: fix.source ?? "foreground",
    }));

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
    }

    const reasons: Record<string, number> = {};
    for (const row of rejected)
      reasons[row.reason] = (reasons[row.reason] ?? 0) + 1;

    return {
      accepted: accepted.length,
      rejected: rejected.length,
      reasons,
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
   * Per-day totals across a range, for the history picker. Summing in Mongo
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
