import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import {
  LOCATION_SHARE_AFTER_HOURS,
  LOCATION_SHARE_BEFORE_HOURS,
  LOCATION_STALE_SECONDS,
  MANIFEST_BOOKING_STATUSES,
  YATRA_MODEL,
} from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { YatraAccessService, type YatraActor, YatraAuditService, YatraNotifier } from "./yatra-support.service";

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  speedKmph?: number;
  heading?: number;
}

const HOUR = 3_600_000;

/**
 * Live bus location. The driver (a partner member who may check passengers in) opens a page on
 * their phone and shares the position from before departure until the trip ends. Only the latest
 * position is kept, one row per departure, and only pilgrims with a paid booking on that departure
 * (plus the partner and Tirvona) can see it. When sharing stops the position is no longer shown.
 */
@Injectable()
export class YatraTripService {
  constructor(
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    @InjectModel(YATRA_MODEL.TripLocation) private readonly locations: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
  ) {}

  /** When sharing is allowed for a departure. */
  private window(departure: any): { opensAt: Date; closesAt: Date } {
    const start = new Date(departure.departAt).getTime();
    const end = new Date(departure.returnAt ?? departure.departAt).getTime();
    return { opensAt: new Date(start - LOCATION_SHARE_BEFORE_HOURS * HOUR), closesAt: new Date(end + LOCATION_SHARE_AFTER_HOURS * HOUR) };
  }

  private async ownDeparture(user: YatraActor, departureId: string, writable: boolean): Promise<{ departure: any; operator: any }> {
    const { operator } = await this.access.require(user, "shareLocation", { approved: writable, writable });
    const departure = await this.departures.findOne({ _id: departureId, operatorId: operator._id }).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    return { departure, operator };
  }

  // --------------------------------------------------------------- organiser
  /** What the driver's page needs: whether sharing is on, and whether it may be turned on now. */
  async organiserStatus(user: YatraActor, departureId: string): Promise<any> {
    const { departure } = await this.ownDeparture(user, departureId, false);
    const row = await this.locations.findOne({ departureId: departure._id }).lean();
    return { ...this.sharingState(departure), sharing: row?.status === "sharing", position: row?.status === "sharing" ? this.position(row) : null, startedAt: row?.startedAt ?? null, sharedByName: row?.sharedByName ?? "" };
  }

  private sharingState(departure: any): { canShare: boolean; reason: string; opensAt: Date; closesAt: Date } {
    const { opensAt, closesAt } = this.window(departure);
    const now = Date.now();
    let reason = "";
    if (["draft", "cancelled"].includes(departure.status)) reason = departure.status === "draft" ? "Open this departure for booking first." : "This departure was cancelled.";
    else if (now < opensAt.getTime()) reason = `You can start sharing ${LOCATION_SHARE_BEFORE_HOURS} hours before departure.`;
    else if (now > closesAt.getTime()) reason = "This trip has ended.";
    return { canShare: !reason, reason, opensAt, closesAt };
  }

  /** Records the latest position. Called every few seconds by the driver's page; the first call starts sharing. */
  async share(user: YatraActor, departureId: string, fix: LocationFix): Promise<any> {
    const { departure, operator } = await this.ownDeparture(user, departureId, true);
    const state = this.sharingState(departure);
    if (!state.canShare) throw new YatraException(state.reason, 409, "LOCATION_NOT_ALLOWED");
    const now = new Date();
    const values = {
      status: "sharing",
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyM: fix.accuracyM ?? null,
      speedKmph: fix.speedKmph ?? null,
      heading: fix.heading ?? null,
      recordedAt: now,
      sharedBy: user.id,
      sharedByName: String((user as any).name ?? "").split(/\s+/)[0] ?? "",
    };
    let row = await this.locations.findOne({ departureId: departure._id });
    let started = false;
    if (!row) {
      try {
        row = await this.locations.create({ departureId: departure._id, operatorId: operator._id, startedAt: now, ...values });
        started = true;
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        row = await this.locations.findOne({ departureId: departure._id });
      }
    }
    if (row && !started) {
      started = row.status !== "sharing";
      Object.assign(row, values);
      if (started) {
        row.startedAt = now;
        row.stoppedAt = null;
      }
      await row.save();
    }
    if (started) {
      await this.audit.record(user, "trip.location_started", { operatorId: String(operator._id), departureId });
      await this.tellTravellers(departure, "Your bus is on its way", `${departure.departureCode}: the driver is sharing the live location. Open your journey to follow the bus.`);
    }
    return { sharing: true, startedNow: started, recordedAt: now };
  }

  async stop(user: YatraActor, departureId: string): Promise<any> {
    const { departure, operator } = await this.ownDeparture(user, departureId, true);
    const row = await this.locations.findOne({ departureId: departure._id });
    if (row && row.status === "sharing") {
      row.status = "stopped";
      row.stoppedAt = new Date();
      await row.save();
      await this.audit.record(user, "trip.location_stopped", { operatorId: String(operator._id), departureId });
    }
    return { sharing: false };
  }

  // ---------------------------------------------------------------- pilgrim
  /** What a pilgrim sees for a booking: not started, live, last seen, or ended. */
  async forBooking(user: YatraActor, bookingId: string): Promise<any> {
    const booking = await this.bookings.findOne({ _id: bookingId, customerId: user.id }).lean();
    if (!booking) throw new YatraException("Booking not found.", 404);
    if (!MANIFEST_BOOKING_STATUSES.includes(booking.status) || booking.paymentStatus !== "paid")
      throw new YatraException("Live tracking is available for confirmed bookings.", 409);
    const departure = await this.departures.findById(booking.departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    return this.viewFor(departure);
  }

  /** Staff and admins use the same view; access is checked by the caller. */
  async viewFor(departure: any): Promise<any> {
    const { closesAt, opensAt } = this.window(departure);
    const row = await this.locations.findOne({ departureId: departure._id }).lean();
    const now = Date.now();
    if (now > closesAt.getTime()) return { state: "ended", position: null, opensAt, closesAt };
    if (!row || row.status !== "sharing") return { state: row ? "paused" : "not_started", position: null, lastSeenAt: row?.recordedAt ?? null, opensAt, closesAt };
    const age = (now - new Date(row.recordedAt).getTime()) / 1000;
    return { state: age > LOCATION_STALE_SECONDS ? "stale" : "live", position: this.position(row), ageSeconds: Math.round(age), opensAt, closesAt };
  }

  /** Admins can look at any departure. */
  async forDeparture(departureId: string): Promise<any> {
    const departure = await this.departures.findById(departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    return this.viewFor(departure);
  }

  // ---------------------------------------------------------------- helpers
  private position(row: any) {
    return {
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyM: row.accuracyM ?? null,
      speedKmph: row.speedKmph ?? null,
      heading: row.heading ?? null,
      recordedAt: row.recordedAt,
    };
  }

  private async tellTravellers(departure: any, title: string, body: string): Promise<void> {
    const rows = await this.bookings.find({ departureId: departure._id, status: { $in: MANIFEST_BOOKING_STATUSES }, paymentStatus: "paid" }).select("customerId journeyId").limit(500).lean();
    const ids = [...new Set(rows.map((b: any) => (b.customerId ? String(b.customerId) : "")).filter(Boolean))];
    if (ids.length) await this.notifier.users(ids, title, body, "/profile/journeys", "yatra.trip");
  }
}
