import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { RATING_TAGS, YATRA_MODEL } from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import type { YatraActor } from "./yatra-support.service";

export interface RatingSummary {
  average: number;
  count: number;
  /** How many ratings gave 5, 4, 3, 2 and 1 stars (index 0 is five stars). */
  breakdown: number[];
  /** The most-ticked tags ("Loved by travellers"), most first. */
  tags: Array<{ tag: string; count: number }>;
}

const emptySummary = (): RatingSummary => ({ average: 0, count: 0, breakdown: [0, 0, 0, 0, 0], tags: [] });

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Trip ratings. A pilgrim rates a journey once, after the departure has finished, for the partner
 * that ran it. Only people who actually travelled can rate (a paid booking they own), so the numbers
 * cannot be inflated by the partner or by strangers.
 */
@Injectable()
export class YatraRatingService {
  constructor(
    @InjectModel(YATRA_MODEL.Rating) private readonly ratings: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
  ) {}

  /** The pilgrim's own rating for a booking, and whether they can still give one. */
  async mine(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.ownedBooking(user, bookingId);
    const rating = await this.ratings.findOne({ bookingId: booking._id }).lean();
    const eligibility = await this.eligibility(booking);
    return { rating: rating ? this.ownView(rating) : null, canRate: !rating && eligibility.ok, reason: rating ? "You have already rated this trip." : eligibility.reason };
  }

  async rate(user: YatraActor, bookingId: string, dto: { stars: number; comment?: string; tags?: string[] }): Promise<any> {
    const booking = await this.ownedBooking(user, bookingId);
    const eligibility = await this.eligibility(booking);
    if (!eligibility.ok) throw new YatraException(eligibility.reason, 409, "CANNOT_RATE_YET");
    const departure = await this.departures.findById(booking.departureId).select("vehicleId").lean();
    try {
      const created = await this.ratings.create({
        bookingId: booking._id,
        departureId: booking.departureId,
        tourId: booking.tourId,
        operatorId: booking.operatorId,
        vehicleId: departure?.vehicleId ?? null,
        customerId: user.id,
        customerName: String(booking.contact?.name ?? "").trim().split(/\s+/)[0] || "Pilgrim",
        stars: Math.round(dto.stars),
        comment: String(dto.comment ?? "").trim(),
        tags: [...new Set((dto.tags ?? []).filter((t) => (RATING_TAGS as readonly string[]).includes(t)))],
        status: "visible",
      });
      return this.ownView(created.toObject ? created.toObject() : created);
    } catch (error: any) {
      if (error?.code === 11000) throw new YatraException("You have already rated this trip.", 409, "ALREADY_RATED");
      throw error;
    }
  }

  /** Average and count of the visible ratings of one partner. */
  async summary(operatorId: unknown): Promise<RatingSummary> {
    return (await this.summaries([operatorId])).get(String(operatorId)) ?? emptySummary();
  }

  async summaries(operatorIds: unknown[]): Promise<Map<string, RatingSummary>> {
    const ids = [...new Set(operatorIds.map(String))];
    const out = new Map<string, RatingSummary>();
    if (!ids.length) return out;
    const rows = await this.ratings.find({ operatorId: { $in: ids }, status: "visible" }).select("operatorId stars tags").limit(20000).lean();
    const sums = new Map<string, { total: number; summary: RatingSummary; tags: Map<string, number> }>();
    for (const r of rows) {
      const k = String(r.operatorId);
      const s = sums.get(k) ?? { total: 0, summary: emptySummary(), tags: new Map<string, number>() };
      const stars = Math.min(5, Math.max(1, Math.round(Number(r.stars))));
      s.total += stars;
      s.summary.count += 1;
      s.summary.breakdown[5 - stars] += 1;
      for (const tag of r.tags ?? []) s.tags.set(String(tag), (s.tags.get(String(tag)) ?? 0) + 1);
      sums.set(k, s);
    }
    for (const [k, s] of sums) {
      s.summary.average = round1(s.total / s.summary.count);
      s.summary.tags = [...s.tags].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag, count]) => ({ tag, count }));
      out.set(k, s.summary);
    }
    return out;
  }

  /** The latest written reviews of a partner, for the public departure page. First names only. */
  async recent(operatorId: unknown, limit = 5): Promise<Array<{ stars: number; comment: string; name: string; at: Date }>> {
    const rows = await this.ratings.find({ operatorId, status: "visible" }).sort({ createdAt: -1 }).limit(Math.max(limit * 3, limit)).lean();
    return rows
      .filter((r: any) => String(r.comment ?? "").trim())
      .slice(0, limit)
      .map((r: any) => ({ stars: r.stars, comment: r.comment, name: r.customerName || "Pilgrim", at: r.createdAt }));
  }

  // ------------------------------------------------------------------ internals
  private async ownedBooking(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.bookings.findOne({ _id: bookingId, customerId: user.id }).lean();
    if (!booking) throw new YatraException("Booking not found.", 404);
    return booking;
  }

  private async eligibility(booking: any): Promise<{ ok: boolean; reason: string }> {
    if (!["confirmed", "completed"].includes(booking.status) || booking.paymentStatus !== "paid") return { ok: false, reason: "Only a confirmed, paid booking can be rated." };
    const departure = await this.departures.findById(booking.departureId).select("returnAt departAt").lean();
    const end = new Date(departure?.returnAt ?? departure?.departAt ?? 0).getTime();
    if (!end || end > Date.now()) return { ok: false, reason: "You can rate the trip after it has finished." };
    return { ok: true, reason: "" };
  }

  private ownView(r: any) {
    return { id: String(r._id), stars: r.stars, comment: r.comment ?? "", tags: r.tags ?? [], createdAt: r.createdAt };
  }
}
