import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "node:crypto";
import { Model, Types } from "mongoose";
import type { Request } from "express";
import {
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";
import {
  SMART_CONTACT_CONNECTION,
  SMART_CONTACT_EVENT_MODEL,
  SMART_CONTACT_EVENT_TYPES,
  type SmartContactDeviceType,
  type SmartContactEventType,
} from "../domain/smart-contact.constants";
import type {
  AnalyticsBreakdownRow,
  AnalyticsSeriesPoint,
  AnalyticsTotals,
  EventContext,
  SmartContactAnalyticsView,
} from "../domain/smart-contact.types";

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "custom";

interface RangeInput {
  preset?: AnalyticsPreset;
  from?: string;
  to?: string;
}

/**
 * Event capture and reporting for Smart Contact (spec §23–§27, §51).
 *
 * Two responsibilities that belong together because they share one privacy
 * contract: what is written here is exactly what can be reported, and neither
 * side ever handles an identity. The request IP is used to derive a hashed
 * session key and (where a geo header is available) an approximate location,
 * then dropped — spec §26 explicitly settles for approximate geography rather
 * than asking a visitor for GPS permission.
 */
@Injectable()
export class SmartContactAnalyticsService {
  private readonly logger = new Logger(SmartContactAnalyticsService.name);
  private readonly config: SmartContactConfig = smartContactConfig();

  constructor(
    @InjectModel(SMART_CONTACT_EVENT_MODEL, SMART_CONTACT_CONNECTION)
    private readonly events: Model<Record<string, unknown>>,
  ) {}

  // ── Capture ──────────────────────────────────────────────────────────────

  private clientIp(request: Request): string {
    // `trust proxy` is set from config in main.ts, so `request.ip` is already
    // the real client address behind Render's load balancer. The header
    // fallbacks cover a deployment where it is not.
    const forwarded = request.headers["x-forwarded-for"];
    const header = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return (header?.split(",")[0] ?? request.ip ?? "").trim();
  }

  private deviceType(userAgent: string): SmartContactDeviceType {
    const ua = userAgent.toLowerCase();
    // iPadOS 13+ reports a desktop Safari UA, so the iOS test has to come
    // first and include the Macintosh-plus-touch signature.
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    if (/windows|macintosh|linux|cros/.test(ua) && !/mobile/.test(ua))
      return "desktop";
    if (/mobile/.test(ua)) return "other";
    return ua ? "other" : "other";
  }

  private browser(userAgent: string): string {
    const ua = userAgent;
    // Order matters: Edge and Opera both carry "Chrome" in their UA, and
    // Chrome carries "Safari".
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\/|Opera/.test(ua)) return "Opera";
    if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua)) return "Safari";
    return "Other";
  }

  private os(userAgent: string): string {
    const ua = userAgent;
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Mac OS X/.test(ua)) return "macOS";
    if (/Linux/.test(ua)) return "Linux";
    return "Other";
  }

  /**
   * A stable, non-reversible key for one visitor.
   *
   * Salted with a server secret and truncated: enough to count unique
   * visitors, useless for looking anyone up. The date is folded in so the key
   * rotates daily, which caps how long a visitor can be followed across the
   * log to a single day.
   */
  private sessionHash(ip: string, userAgent: string): string {
    const day = new Date().toISOString().slice(0, 10);
    return createHash("sha256")
      .update(`${this.config.sessionHashSalt}|${day}|${ip}|${userAgent}`)
      .digest("hex")
      .slice(0, 32);
  }

  /**
   * Builds the analytics context from a request.
   *
   * Geography comes from whatever the CDN or proxy already resolved
   * (Cloudflare and Render both set these). No IP database is consulted and no
   * third-party lookup is made — if the headers are absent the fields stay
   * empty and the geography panel simply shows nothing, which is the correct
   * outcome rather than a guess.
   */
  contextFrom(request: Request, source?: string): EventContext {
    const userAgent = String(request.headers["user-agent"] ?? "").slice(0, 400);
    const ip = this.clientIp(request);
    const header = (name: string): string =>
      String(request.headers[name] ?? "").slice(0, 80);

    return {
      sessionHash: this.sessionHash(ip, userAgent),
      deviceType: this.deviceType(userAgent),
      browser: this.browser(userAgent),
      os: this.os(userAgent),
      country: header("cf-ipcountry") || header("x-vercel-ip-country"),
      state: header("x-vercel-ip-country-region") || header("cf-region"),
      city: header("x-vercel-ip-city") || header("cf-ipcity"),
      referrer: String(request.headers.referer ?? "").slice(0, 300),
      source: (source ?? "").slice(0, 60),
      ip,
    };
  }

  /**
   * Appends one event.
   *
   * Never throws. A failed analytics insert must not turn a working contact
   * page into a 500 — the visitor is trying to save a phone number, and the
   * count is the least important thing in the request.
   */
  async record(
    profileId: Types.ObjectId | string,
    eventType: SmartContactEventType,
    context: EventContext,
    qrId?: string | null,
  ): Promise<void> {
    try {
      await this.events.create({
        profileId: new Types.ObjectId(String(profileId)),
        qrId: qrId && Types.ObjectId.isValid(qrId) ? new Types.ObjectId(qrId) : null,
        eventType,
        sessionHash: context.sessionHash,
        deviceType: context.deviceType,
        browser: context.browser,
        os: context.os,
        country: context.country,
        state: context.state,
        city: context.city,
        referrer: context.referrer,
        source: context.source,
      });
    } catch (error) {
      this.logger.warn(
        `Dropped ${eventType} for profile ${String(profileId)}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // ── Reporting ────────────────────────────────────────────────────────────

  /** Resolves a preset or explicit range into concrete bounds (spec §25). */
  resolveRange(input: RangeInput): { from: Date; to: Date; preset: string } {
    const now = new Date();
    const startOfDay = (d: Date): Date =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date): Date =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const preset = input.preset ?? (input.from || input.to ? "custom" : "last30");
    switch (preset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now), preset };
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { from: startOfDay(y), to: endOfDay(y), preset };
      }
      case "last7": {
        const from = new Date(now);
        from.setDate(from.getDate() - 6);
        return { from: startOfDay(from), to: endOfDay(now), preset };
      }
      case "thisMonth":
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: endOfDay(now),
          preset,
        };
      case "custom": {
        const from = input.from ? new Date(input.from) : new Date(now);
        const to = input.to ? new Date(input.to) : now;
        // Guard against an unparseable date silently becoming Invalid Date,
        // which Mongo would reject mid-aggregation.
        const safeFrom = Number.isNaN(from.getTime()) ? startOfDay(now) : startOfDay(from);
        const safeTo = Number.isNaN(to.getTime()) ? endOfDay(now) : endOfDay(to);
        return { from: safeFrom, to: safeTo, preset };
      }
      default: {
        const from = new Date(now);
        from.setDate(from.getDate() - 29);
        return { from: startOfDay(from), to: endOfDay(now), preset: "last30" };
      }
    }
  }

  private emptyDistribution(): Record<SmartContactEventType, number> {
    return Object.fromEntries(
      SMART_CONTACT_EVENT_TYPES.map((type) => [type, 0]),
    ) as Record<SmartContactEventType, number>;
  }

  private rate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  /**
   * The per-profile analytics payload behind `GET .../{id}/analytics`.
   *
   * One `$facet` rather than six round trips: the range filter is identical
   * for every panel, so scanning the events once and fanning out server-side
   * is both faster and guaranteed self-consistent — separate queries could
   * straddle an incoming event and report a funnel that does not add up.
   */
  async forProfile(
    profileId: string,
    range: RangeInput,
  ): Promise<SmartContactAnalyticsView> {
    const { from, to, preset } = this.resolveRange(range);
    const match = {
      profileId: new Types.ObjectId(profileId),
      createdAt: { $gte: from, $lte: to },
    };

    const topN = (field: string) => [
      { $match: { [field]: { $nin: ["", null] } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 as const } },
      { $limit: 10 },
    ];

    const [facets] = await this.events.aggregate<{
      byType: { _id: SmartContactEventType; count: number }[];
      unique: { _id: null; count: number }[];
      series: { _id: string; type: SmartContactEventType; count: number }[];
      devices: { _id: string; count: number }[];
      geography: { _id: string; count: number }[];
      sources: { _id: string; count: number }[];
      referrers: { _id: string; count: number }[];
    }>([
      { $match: match },
      {
        $facet: {
          byType: [{ $group: { _id: "$eventType", count: { $sum: 1 } } }],
          unique: [
            { $group: { _id: "$sessionHash" } },
            { $count: "count" },
            { $set: { _id: null } },
          ],
          series: [
            {
              $group: {
                _id: {
                  date: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                  },
                  type: "$eventType",
                },
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: "$_id.date",
                type: "$_id.type",
                count: 1,
              },
            },
            { $sort: { _id: 1 } },
          ],
          devices: [
            { $group: { _id: "$deviceType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          geography: topN("city"),
          sources: topN("source"),
          referrers: topN("referrer"),
        },
      },
    ]);

    const counts = this.emptyDistribution();
    for (const row of facets?.byType ?? []) {
      if (row._id in counts) counts[row._id] = row.count;
    }

    const totals: AnalyticsTotals = {
      profileViews: counts.PROFILE_VIEW,
      qrScans: counts.QR_SCAN,
      uniqueVisitors: facets?.unique?.[0]?.count ?? 0,
      saveContactClicks: counts.SAVE_CONTACT,
      vcardDownloads: counts.VCARD_DOWNLOAD,
      callClicks: counts.CALL_CLICK,
      whatsappClicks: counts.WHATSAPP_CLICK,
      emailClicks: counts.EMAIL_CLICK,
      websiteClicks: counts.WEBSITE_CLICK,
      directionsClicks: counts.DIRECTIONS_CLICK,
      // Spec §24: Save Contact / Profile Views × 100.
      conversionRate: this.rate(counts.SAVE_CONTACT, counts.PROFILE_VIEW),
    };

    // Every day in the window appears, including the ones with no activity —
    // a chart that silently skips empty days misreads as a continuous trend.
    const seriesIndex = new Map<string, AnalyticsSeriesPoint>();
    for (
      let cursor = new Date(from);
      cursor <= to;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      seriesIndex.set(key, {
        date: key,
        qrScans: 0,
        profileViews: 0,
        saveContacts: 0,
      });
    }
    for (const row of facets?.series ?? []) {
      const point = seriesIndex.get(row._id);
      if (!point) continue;
      if (row.type === "QR_SCAN") point.qrScans += row.count;
      if (row.type === "PROFILE_VIEW") point.profileViews += row.count;
      if (row.type === "SAVE_CONTACT") point.saveContacts += row.count;
    }

    const engagement =
      counts.CALL_CLICK +
      counts.WHATSAPP_CLICK +
      counts.EMAIL_CLICK +
      counts.WEBSITE_CLICK +
      counts.DIRECTIONS_CLICK;

    const toRows = (
      rows: { _id: string; count: number }[] | undefined,
    ): AnalyticsBreakdownRow[] =>
      (rows ?? []).map((row) => ({ key: row._id || "Unknown", count: row.count }));

    return {
      range: { from: from.toISOString(), to: to.toISOString(), preset },
      totals,
      series: [...seriesIndex.values()],
      actionDistribution: counts,
      devices: toRows(facets?.devices),
      geography: toRows(facets?.geography),
      sources: toRows(facets?.sources),
      referrers: toRows(facets?.referrers),
      // Spec §51 — conversion between each stage, not just the headline rate.
      funnel: [
        { stage: "QR Scan", count: counts.QR_SCAN, conversionFromPrevious: 100 },
        {
          stage: "Profile View",
          count: counts.PROFILE_VIEW,
          conversionFromPrevious: this.rate(counts.PROFILE_VIEW, counts.QR_SCAN),
        },
        {
          stage: "Save / Contact Action",
          count: counts.SAVE_CONTACT,
          conversionFromPrevious: this.rate(
            counts.SAVE_CONTACT,
            counts.PROFILE_VIEW,
          ),
        },
        {
          stage: "Engagement",
          count: engagement,
          conversionFromPrevious: this.rate(engagement, counts.PROFILE_VIEW),
        },
      ],
    };
  }

  /**
   * Headline counters for many profiles at once, for the console list.
   *
   * A single grouped aggregation keeps the list page at two queries total no
   * matter how many rows it shows.
   */
  async summaryFor(
    profileIds: string[],
  ): Promise<Map<string, { profileViews: number; qrScans: number; saveContacts: number; conversionRate: number }>> {
    const ids = profileIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (!ids.length) return new Map();
    const rows = await this.events.aggregate<{
      _id: Types.ObjectId;
      profileViews: number;
      qrScans: number;
      saveContacts: number;
    }>([
      { $match: { profileId: { $in: ids } } },
      {
        $group: {
          _id: "$profileId",
          profileViews: {
            $sum: { $cond: [{ $eq: ["$eventType", "PROFILE_VIEW"] }, 1, 0] },
          },
          qrScans: {
            $sum: { $cond: [{ $eq: ["$eventType", "QR_SCAN"] }, 1, 0] },
          },
          saveContacts: {
            $sum: { $cond: [{ $eq: ["$eventType", "SAVE_CONTACT"] }, 1, 0] },
          },
        },
      },
    ]);

    return new Map(
      rows.map((row) => [
        String(row._id),
        {
          profileViews: row.profileViews,
          qrScans: row.qrScans,
          saveContacts: row.saveContacts,
          conversionRate: this.rate(row.saveContacts, row.profileViews),
        },
      ]),
    );
  }

  /** Platform-wide counters for the console's dashboard header. */
  async platformTotals(): Promise<Record<string, number>> {
    const rows = await this.events.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
    ]);
    const counts = this.emptyDistribution();
    for (const row of rows) {
      if (row._id in counts) counts[row._id as SmartContactEventType] = row.count;
    }
    return {
      totalScans: counts.QR_SCAN,
      totalViews: counts.PROFILE_VIEW,
      totalSaves: counts.SAVE_CONTACT,
      totalCalls: counts.CALL_CLICK,
      totalWhatsapp: counts.WHATSAPP_CLICK,
      totalEmails: counts.EMAIL_CLICK,
      conversionRate: this.rate(counts.SAVE_CONTACT, counts.PROFILE_VIEW),
    };
  }
}
