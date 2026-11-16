import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { ClientSession, Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { CANCELLATION_PROTECTION, YATRA_MODEL } from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { YatraRatingService } from "./yatra-rating.service";
import { cityKey, cleanSeatFares, departureCode, generateSeatLayout, lowestSeatFare, seatFareOf, unsellableReason } from "../domain/yatra.utils";
import { operatorPublicView } from "./yatra-operator.service";
import { tourPublicView } from "./yatra-catalog.service";
import { YatraAccessService, type YatraActor, YatraAuditService, YatraSettingsService } from "./yatra-support.service";

export const departureView = (d: any) =>
  d && {
    id: String(d._id),
    departureCode: d.departureCode,
    tourId: String(d.tourId),
    operatorId: String(d.operatorId),
    vehicleId: String(d.vehicleId),
    departAt: d.departAt,
    returnAt: d.returnAt ?? null,
    timezone: d.timezone ?? "Asia/Kolkata",
    boardingPoints: Array.isArray(d.boardingPoints) ? d.boardingPoints : [],
    droppingPoints: Array.isArray(d.droppingPoints) ? d.droppingPoints : [],
    restStops: Array.isArray(d.restStops) ? d.restStops : [],
    charterEnabled: Boolean(d.charterEnabled),
    seatFares: d.seatFares && typeof d.seatFares === "object" ? d.seatFares : {},
    fare: d.fare,
    seatMode: d.seatMode,
    seatLayout: d.seatLayout ?? null,
    blockedSeats: d.blockedSeats ?? [],
    capacity: d.capacity ?? 0,
    bookedSeats: d.bookedSeats ?? 0,
    seatsLeft: Math.max(0, Number(d.capacity ?? 0) - Number(d.bookedSeats ?? 0)),
    status: d.status,
    salesOpenedAt: d.salesOpenedAt ?? null,
    cancelledAt: d.cancelledAt ?? null,
    cancellationReason: d.cancellationReason ?? "",
    notes: d.notes ?? "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };

const vehiclePublicView = (v: any) =>
  v && {
    vehicleType: v.vehicleType,
    make: v.make ?? "",
    model: v.model ?? "",
    isAc: Boolean(v.isAc),
    amenities: v.amenities ?? [],
    images: v.images ?? [],
    seatCapacity: v.seatCapacity,
  };

/** Start of a calendar day in India, as a UTC instant. */
const istDayStart = (day: string): Date => new Date(`${day}T00:00:00+05:30`);

@Injectable()
export class YatraInventoryService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly settings: YatraSettingsService,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.Vehicle) private readonly vehicles: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Seat) private readonly seats: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Document) private readonly documents: Model<any>,
    private readonly ratings: YatraRatingService,
  ) {}

  // ------------------------------------------------------------- sellability
  /** Loads everything that decides whether a departure can be sold now. */
  async context(departure: any): Promise<{ tour: any; operator: any; vehicle: any; reason: string | null }> {
    const [tour, operator, vehicle, settings] = await Promise.all([
      this.tours.findById(departure.tourId).lean(),
      this.operators.findById(departure.operatorId).lean(),
      this.vehicles.findById(departure.vehicleId).lean(),
      this.settings.get(),
    ]);
    const reason = unsellableReason({ departure, tour, operator, vehicle, salesCloseMinutes: settings.salesCloseMinutes });
    return { tour, operator, vehicle, reason };
  }

  // ---------------------------------------------------- organiser departures
  /** Boarding and dropping points: the partner's names and times. `prefix` keeps their ids apart. */
  private boardingPoints(input: any[] | undefined, previous: any[] = [], prefix = "bp", label = "boarding"): any[] {
    const points = (input ?? []).map((p: any, index: number) => ({
      id: p.id && previous.some((x) => x.id === p.id) ? p.id : `${prefix}${Date.now().toString(36)}${index}`,
      name: String(p.name ?? "").trim(),
      address: String(p.address ?? "").trim(),
      landmark: String(p.landmark ?? "").trim(),
      time: p.time ? new Date(p.time) : null,
      mapUrl: String(p.mapUrl ?? "").trim(),
    }));
    if (points.some((p) => !p.name)) throw new YatraException(`Every ${label} point needs a name.`, 400);
    return points;
  }

  private restStops(input: any[] | undefined, previous: any[] = []): any[] {
    const stops = (input ?? []).map((p: any, index: number) => ({
      id: p.id && previous.some((x) => x.id === p.id) ? p.id : `rs${Date.now().toString(36)}${index}`,
      name: String(p.name ?? "").trim(),
      address: String(p.address ?? "").trim(),
      time: p.time ? new Date(p.time) : null,
      durationMinutes: Math.max(0, Math.min(240, Number(p.durationMinutes ?? 0) || 0)),
    }));
    if (stops.some((p) => !p.name)) throw new YatraException("Every rest stop needs a name.", 400);
    return stops;
  }

  /** Drops and rest stops must fall between the departure and return times. */
  private checkTimeline(departAt: Date, returnAt: Date | null | undefined, lists: Array<{ label: string; items: any[] }>): void {
    const end = returnAt ? new Date(returnAt).getTime() : null;
    for (const { label, items } of lists)
      for (const item of items) {
        if (!item.time) continue;
        const at = new Date(item.time).getTime();
        if (Number.isNaN(at)) throw new YatraException(`The time of ${label} "${item.name}" is not valid.`, 400);
        if (end !== null && label !== "boarding point" && at > end + 6 * 3_600_000)
          throw new YatraException(`The time of ${label} "${item.name}" is after the trip has ended.`, 400);
      }
    void departAt;
  }

  async listDepartures(user: YatraActor, query: { tourId?: string; status?: string; upcoming?: boolean }): Promise<any[]> {
    const { operator } = await this.access.require(user, "viewBookings");
    const filter: Record<string, unknown> = { operatorId: operator._id };
    if (query.tourId) filter.tourId = query.tourId;
    if (query.status) filter.status = query.status;
    if (query.upcoming) filter.departAt = { $gt: new Date() };
    const rows = await this.departures.find(filter).sort({ departAt: query.upcoming ? 1 : -1 }).limit(300).lean();
    const tours = await this.tours.find({ _id: { $in: [...new Set(rows.map((r: any) => String(r.tourId)))] } }).select("title status").lean();
    const titles = new Map(tours.map((t: any) => [String(t._id), t]));
    return rows.map((r: any) => ({ ...departureView(r), tourTitle: titles.get(String(r.tourId))?.title ?? "", tourStatus: titles.get(String(r.tourId))?.status ?? "" }));
  }

  async getDeparture(user: YatraActor, departureId: string): Promise<any> {
    const { operator } = await this.access.require(user, "viewBookings");
    const departure = await this.departures.findOne({ _id: departureId, operatorId: operator._id }).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const { tour, vehicle, reason } = await this.context(departure);
    return {
      departure: departureView(departure),
      tour: tour && { id: String(tour._id), title: tour.title, status: tour.status, durationDays: tour.durationDays },
      vehicle: vehicle && { id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, status: vehicle.status },
      sellable: !reason,
      unsellableReason: reason,
    };
  }

  async createDeparture(user: YatraActor, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageDepartures", { writable: true });
    const tour = await this.tours.findOne({ _id: dto.tourId, operatorId: operator._id }).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    if (tour.status === "rejected") throw new YatraException("Fix and resubmit this tour before adding departures.", 409);
    const vehicle = await this.vehicles.findOne({ _id: dto.vehicleId, operatorId: operator._id }).lean();
    if (!vehicle) throw new YatraException("Vehicle not found.", 404);
    if (["suspended", "rejected"].includes(vehicle.status)) throw new YatraException("This vehicle cannot be used for departures.", 409);
    const departAt = new Date(dto.departAt);
    if (!(departAt.getTime() > Date.now() + 60 * 60_000)) throw new YatraException("Departure must be at least one hour from now.", 400);
    const returnAt = dto.returnAt ? new Date(dto.returnAt) : new Date(departAt.getTime() + Number(tour.durationDays) * 86_400_000);
    if (returnAt.getTime() < departAt.getTime()) throw new YatraException("Return cannot be before departure.", 400);
    const layout = vehicle.seatLayout?.seats?.length ? vehicle.seatLayout : generateSeatLayout("2x2", vehicle.seatCapacity);
    const seatNos = new Set(layout.seats.map((s: any) => String(s.seatNo)));
    const blocked = [...new Set((dto.blockedSeats ?? []).map((s: string) => String(s).toUpperCase()))] as string[];
    const unknown = blocked.filter((s) => !seatNos.has(s));
    if (unknown.length) throw new YatraException(`These seats are not in the vehicle layout: ${unknown.join(", ")}.`, 400);
    if (blocked.length >= seatNos.size) throw new YatraException("At least one seat must be sellable.", 400);
    const boardingPoints = this.boardingPoints(dto.boardingPoints);
    if (!boardingPoints.length) throw new YatraException("Add at least one boarding point.", 400);
    const rates = cleanSeatFares(dto.seatFares, new Set<string>([...seatNos].map((n) => String(n).toUpperCase())), dto.fare ?? tour.baseFare);
    if (rates.error) throw new YatraException(rates.error, 400, "INVALID_SEAT_FARES");
    const droppingPoints = this.boardingPoints(dto.droppingPoints, [], "dp", "dropping");
    const restStops = this.restStops(dto.restStops);
    this.checkTimeline(departAt, returnAt, [{ label: "boarding point", items: boardingPoints }, { label: "dropping point", items: droppingPoints }, { label: "rest stop", items: restStops }]);

    let created: any = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      try {
        created = await this.departures.create({
          tourId: tour._id,
          operatorId: operator._id,
          vehicleId: vehicle._id,
          departureCode: departureCode(),
          departAt,
          returnAt,
          boardingPoints,
          droppingPoints,
          restStops,
          charterEnabled: Boolean(dto.charterEnabled),
          seatFares: rates.fares,
          fare: dto.fare ?? tour.baseFare,
          seatMode: dto.seatMode ?? "choose",
          seatLayout: layout,
          blockedSeats: blocked,
          capacity: seatNos.size - blocked.length,
          bookedSeats: 0,
          status: "draft",
          notes: dto.notes ?? "",
          createdBy: user.id,
        });
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
      }
    }
    if (!created) throw new YatraException("Could not create the departure. Please try again.", 503);
    await this.audit.record(user, "departure.created", { operatorId: String(operator._id), departureId: String(created._id), tourId: String(tour._id) });
    return departureView(created);
  }

  async updateDeparture(user: YatraActor, departureId: string, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageDepartures", { writable: true });
    const departure = await this.departures.findOne({ _id: departureId, operatorId: operator._id });
    if (!departure) throw new YatraException("Departure not found.", 404);
    if (["cancelled", "completed"].includes(departure.status)) throw new YatraException("This departure is closed.", 409);
    const before = departureView(departure.toObject());
    if (departure.status === "draft") {
      if (dto.departAt !== undefined) {
        const departAt = new Date(dto.departAt);
        if (!(departAt.getTime() > Date.now() + 60 * 60_000)) throw new YatraException("Departure must be at least one hour from now.", 400);
        departure.departAt = departAt;
      }
      if (dto.returnAt !== undefined) departure.returnAt = new Date(dto.returnAt);
      if (dto.fare !== undefined) departure.fare = dto.fare;
      if (dto.seatMode !== undefined) departure.seatMode = dto.seatMode;
      if (dto.blockedSeats !== undefined) {
        const seatNos = new Set((departure.seatLayout?.seats ?? []).map((s: any) => String(s.seatNo)));
        const blocked = [...new Set(dto.blockedSeats.map((s: string) => String(s).toUpperCase()))] as string[];
        if (blocked.some((s) => !seatNos.has(s))) throw new YatraException("Some blocked seats are not in the layout.", 400);
        if (blocked.length >= seatNos.size) throw new YatraException("At least one seat must be sellable.", 400);
        departure.blockedSeats = blocked;
        departure.capacity = seatNos.size - blocked.length;
      }
      if (dto.returnAt !== undefined || dto.departAt !== undefined)
        if (departure.returnAt && departure.returnAt.getTime() < departure.departAt.getTime())
          throw new YatraException("Return cannot be before departure.", 400);
    } else if (["departAt", "returnAt", "fare", "seatMode", "blockedSeats"].some((key) => dto[key] !== undefined)) {
      throw new YatraException("Time, fare and seats are locked once a departure is open for booking. Ask Tirvona to help with changes.", 409, "DEPARTURE_LOCKED");
    }
    if (dto.boardingPoints !== undefined) {
      const previous = Array.isArray(departure.boardingPoints) ? departure.boardingPoints : [];
      const points = this.boardingPoints(dto.boardingPoints, previous);
      if (!points.length) throw new YatraException("Add at least one boarding point.", 400);
      if (departure.status !== "draft") {
        const used = await this.bookings.distinct("boardingPointId", { departureId: departure._id, status: { $in: ["held", "payment_pending", "confirmed", "cancellation_requested"] } });
        const kept = new Set(points.map((p) => p.id));
        if (used.some((id: unknown) => id && !kept.has(String(id))))
          throw new YatraException("A boarding point that travellers already chose cannot be removed.", 409);
      }
      departure.boardingPoints = points;
      departure.markModified?.("boardingPoints");
    }
    if (dto.droppingPoints !== undefined) {
      const previous = Array.isArray(departure.droppingPoints) ? departure.droppingPoints : [];
      const points = this.boardingPoints(dto.droppingPoints, previous, "dp", "dropping");
      if (departure.status !== "draft") {
        const used = await this.bookings.distinct("droppingPointId", { departureId: departure._id, status: { $in: ["held", "payment_pending", "confirmed", "cancellation_requested"] } });
        const kept = new Set(points.map((p) => p.id));
        if (used.some((id: unknown) => id && !kept.has(String(id))))
          throw new YatraException("A dropping point that travellers already chose cannot be removed.", 409);
      }
      departure.droppingPoints = points;
      departure.markModified?.("droppingPoints");
    }
    if (dto.restStops !== undefined) {
      departure.restStops = this.restStops(dto.restStops, Array.isArray(departure.restStops) ? departure.restStops : []);
      departure.markModified?.("restStops");
    }
    if (dto.charterEnabled !== undefined) departure.charterEnabled = Boolean(dto.charterEnabled);
    if (dto.seatFares !== undefined) {
      const layoutSeats = new Set<string>((departure.seatLayout?.seats ?? []).map((s: any) => String(s.seatNo).toUpperCase()));
      const rates = cleanSeatFares(dto.seatFares, layoutSeats, departure.fare);
      if (rates.error) throw new YatraException(rates.error, 400, "INVALID_SEAT_FARES");
      if (departure.status !== "draft") {
        const before = (departure.seatFares && typeof departure.seatFares === "object" ? departure.seatFares : {}) as Record<string, number>;
        const changed = [...new Set([...Object.keys(before), ...Object.keys(rates.fares)])].filter((seat) => seatFareOf({ fare: departure.fare, seatFares: before }, seat) !== seatFareOf({ fare: departure.fare, seatFares: rates.fares }, seat));
        if (changed.length) {
          const taken = await this.seats.find({ departureId: departure._id, seatNo: { $in: changed }, status: { $in: ["held", "booked"] } }).select("seatNo").lean();
          if (taken.length) throw new YatraException(`The rate of seat ${taken.map((t: any) => t.seatNo).join(", ")} cannot change while it is held or booked.`, 409, "SEAT_FARE_LOCKED");
        }
      }
      departure.seatFares = rates.fares;
      departure.markModified?.("seatFares");
    }
    this.checkTimeline(departure.departAt, departure.returnAt, [
      { label: "boarding point", items: departure.boardingPoints ?? [] },
      { label: "dropping point", items: departure.droppingPoints ?? [] },
      { label: "rest stop", items: departure.restStops ?? [] },
    ]);
    if (dto.notes !== undefined) departure.notes = dto.notes;
    await departure.save();
    await this.audit.record(user, "departure.updated", { operatorId: String(operator._id), departureId }, { before, after: departureView(departure.toObject()) });
    return departureView(departure);
  }

  /** Opens a draft departure for booking: its seat rows are created once, here. */
  async openDeparture(user: YatraActor, departureId: string): Promise<any> {
    const { operator } = await this.access.require(user, "manageDepartures", { approved: true });
    const departure = await this.departures.findOne({ _id: departureId, operatorId: operator._id }).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    if (departure.status !== "draft") throw new YatraException("Only a draft departure can be opened.", 409);
    const { reason } = await this.context({ ...departure, status: "scheduled" });
    if (reason) throw new YatraException(reason, 409, "NOT_SELLABLE");
    const after = await this.transactions.run(async (session) => {
      const existing = await this.seats.countDocuments({ departureId: departure._id }).session(session);
      if (!existing) {
        const blocked = new Set(departure.blockedSeats ?? []);
        await this.seats.insertMany(
          departure.seatLayout.seats.map((s: any) => ({
            departureId: departure._id,
            seatNo: String(s.seatNo),
            row: s.row,
            col: s.col,
            deck: s.deck ?? "lower",
            kind: s.kind ?? "seater",
            status: blocked.has(String(s.seatNo)) ? "blocked" : "available",
          })),
          { session },
        );
      }
      const updated = await this.departures.findOneAndUpdate(
        { _id: departure._id, status: "draft" },
        { $set: { status: "scheduled", salesOpenedAt: new Date() } },
        { new: true, session },
      );
      if (!updated) throw new YatraException("This departure changed. Reload and try again.", 409);
      await this.audit.record(user, "departure.opened", { operatorId: String(operator._id), departureId }, { before: { status: "draft" }, after: { status: "scheduled" } }, session);
      return updated;
    });
    return departureView(after);
  }

  async setSales(actor: YatraActor, departureId: string, open: boolean, asAdmin = false): Promise<any> {
    const filter: Record<string, unknown> = { _id: departureId };
    if (!asAdmin) filter.operatorId = (await this.access.require(actor, "manageDepartures", { writable: true })).operator._id;
    const departure = await this.departures.findOne(filter).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const from = open ? "sales_closed" : "scheduled";
    if (departure.status !== from) throw new YatraException(open ? "Only a departure with closed sales can be reopened." : "Only an open departure can stop sales.", 409);
    if (open) {
      const { reason } = await this.context({ ...departure, status: "scheduled" });
      if (reason) throw new YatraException(reason, 409, "NOT_SELLABLE");
    }
    const to = open ? "scheduled" : "sales_closed";
    const after = await this.departures.findOneAndUpdate({ _id: departureId, status: from }, { $set: { status: to } }, { new: true }).lean();
    if (!after) throw new YatraException("This departure changed. Reload and try again.", 409);
    await this.audit.record(actor, open ? "departure.sales_reopened" : "departure.sales_closed", { departureId, asAdmin }, { before: { status: from }, after: { status: to } });
    return departureView(after);
  }

  async adminDepartures(query: { status?: string; operatorId?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.operatorId) filter.operatorId = query.operatorId;
    const [rows, total] = await Promise.all([
      this.departures.find(filter).sort({ departAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.departures.countDocuments(filter),
    ]);
    const [tours, ops] = await Promise.all([
      this.tours.find({ _id: { $in: [...new Set(rows.map((r: any) => String(r.tourId)))] } }).select("title").lean(),
      this.operators.find({ _id: { $in: [...new Set(rows.map((r: any) => String(r.operatorId)))] } }).select("organisationName").lean(),
    ]);
    const titles = new Map(tours.map((t: any) => [String(t._id), t.title]));
    const names = new Map(ops.map((o: any) => [String(o._id), o.organisationName]));
    return {
      items: rows.map((r: any) => ({ ...departureView(r), tourTitle: titles.get(String(r.tourId)) ?? "", operatorName: names.get(String(r.operatorId)) ?? "" })),
      total,
    };
  }

  async adminDeparture(departureId: string): Promise<any> {
    const departure = await this.departures.findById(departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const { tour, operator, vehicle, reason } = await this.context(departure);
    return {
      departure: departureView(departure),
      tour: tour && { id: String(tour._id), title: tour.title, status: tour.status },
      operator: operator && { id: String(operator._id), organisationName: operator.organisationName, status: operator.status },
      vehicle: vehicle && { id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, status: vehicle.status },
      sellable: !reason,
      unsellableReason: reason,
      seatMap: await this.seatMap(departureId, "admin"),
    };
  }

  // ------------------------------------------------------------- seat claims
  private claimable(departureId: unknown, now: Date, extra: Record<string, unknown> = {}) {
    return {
      departureId,
      ...extra,
      $or: [{ status: "available" }, { status: "held", holdExpiresAt: { $lte: now } }],
    };
  }

  /**
   * Holds seats for a booking inside the caller's transaction. Each seat is
   * claimed with a conditional update, so two checkouts can never hold the
   * same seat: the loser's transaction retries and then sees it taken. An
   * expired hold is reclaimed in place, so expiry does not depend on a job.
   */
  async holdSeats(
    session: ClientSession,
    departure: any,
    bookingId: unknown,
    request: { seats?: string[]; count: number },
    holdUntil: Date,
  ): Promise<string[]> {
    const now = new Date();
    const set = { status: "held", bookingId, holdExpiresAt: holdUntil, heldAt: now };
    if (request.seats?.length) {
      const wanted = [...new Set(request.seats.map((s) => String(s).toUpperCase()))];
      if (wanted.length !== request.count) throw new YatraException("Choose one seat per traveller.", 400);
      for (const seatNo of wanted) {
        const row = await this.seats.findOneAndUpdate(this.claimable(departure._id, now, { seatNo }), { $set: set }, { new: true, session });
        if (!row) {
          const exists = await this.seats.exists({ departureId: departure._id, seatNo }).session(session);
          throw new YatraException(
            exists ? `Seat ${seatNo} was just taken. Please choose another seat.` : `Seat ${seatNo} does not exist on this departure.`,
            exists ? 409 : 400,
            exists ? "SEAT_TAKEN" : "SEAT_UNKNOWN",
          );
        }
      }
      return wanted;
    }
    const candidates = await this.seats
      .find(this.claimable(departure._id, now))
      .sort({ row: 1, col: 1 })
      .limit(request.count + 20)
      .session(session)
      .lean();
    const taken: string[] = [];
    for (const candidate of candidates) {
      if (taken.length === request.count) break;
      const row = await this.seats.findOneAndUpdate(this.claimable(departure._id, now, { _id: candidate._id }), { $set: set }, { new: true, session });
      if (row) taken.push(row.seatNo);
    }
    if (taken.length < request.count)
      throw new YatraException(
        taken.length ? `Only ${taken.length} seat(s) are left on this departure.` : "This departure is fully booked.",
        409,
        "NOT_ENOUGH_SEATS",
      );
    return taken;
  }

  /** Re-holds a lapsed booking's own seats (used when a payment link is reissued). */
  async reholdSeats(session: ClientSession, departureId: unknown, bookingId: unknown, seats: string[], holdUntil: Date): Promise<boolean> {
    const now = new Date();
    for (const seatNo of seats) {
      const row = await this.seats.findOneAndUpdate(
        { departureId, seatNo, $or: [{ status: "held", bookingId }, { status: "available" }, { status: "held", holdExpiresAt: { $lte: now } }] },
        { $set: { status: "held", bookingId, holdExpiresAt: holdUntil, heldAt: now } },
        { new: true, session },
      );
      if (!row) return false;
    }
    return true;
  }

  /**
   * Turns a booking's holds into sold seats after a verified payment. A seat
   * whose hold lapsed is still taken if nobody else claimed it meanwhile.
   * Returns false when any seat is gone; the caller must roll back.
   */
  async confirmSeats(session: ClientSession, departureId: unknown, bookingId: unknown, seats: string[]): Promise<boolean> {
    const now = new Date();
    for (const seatNo of seats) {
      const row = await this.seats.findOneAndUpdate(
        {
          departureId,
          seatNo,
          $or: [
            { status: "held", bookingId },
            { status: "booked", bookingId },
            { status: "available" },
            { status: "held", holdExpiresAt: { $lte: now } },
          ],
        },
        { $set: { status: "booked", bookingId, bookedAt: now, holdExpiresAt: null } },
        { new: true, session },
      );
      if (!row) return false;
    }
    return true;
  }

  /** Frees whatever seats a booking holds or owns. */
  async releaseSeats(session: ClientSession, departureId: unknown, bookingId: unknown): Promise<void> {
    await this.seats.updateMany(
      { departureId, bookingId, status: { $in: ["held", "booked"] } },
      { $set: { status: "available", bookingId: null, holdExpiresAt: null, heldAt: null, bookedAt: null } },
      { session },
    );
  }

  /** Adjusts the departure's sold-seat counter inside the caller's transaction. */
  async adjustBooked(session: ClientSession, departureId: unknown, delta: number): Promise<void> {
    if (!delta) return;
    const filter: Record<string, unknown> = { _id: departureId };
    if (delta < 0) filter.bookedSeats = { $gte: -delta };
    await this.departures.updateOne(filter, { $inc: { bookedSeats: delta } }, { session });
  }

  // ---------------------------------------------------------------- seat maps
  /** True when no seat of the departure is sold or held right now, so the whole bus can still be given to one group. */
  async wholeBusFree(departure: any): Promise<boolean> {
    const map = await this.seatMap(String(departure._id), "public");
    return map.available >= Number(departure.capacity ?? 0) && Number(departure.capacity ?? 0) > 0;
  }

  async seatMap(departureId: string, view: "public" | "operator" | "admin"): Promise<any> {
    const departure = await this.departures.findById(departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const rows = await this.seats.find({ departureId }).sort({ row: 1, col: 1 }).lean();
    const now = Date.now();
    let refs = new Map<string, string>();
    if (view !== "public") {
      const ids = [...new Set(rows.filter((r: any) => r.bookingId).map((r: any) => String(r.bookingId)))];
      const bookings = ids.length ? await this.bookings.find({ _id: { $in: ids } }).select("bookingReference").lean() : [];
      refs = new Map(bookings.map((b: any) => [String(b._id), b.bookingReference]));
    }
    const seats = (rows.length ? rows : departure.seatLayout?.seats ?? []).map((s: any) => {
      const heldLive = s.status === "held" && s.holdExpiresAt && new Date(s.holdExpiresAt).getTime() > now;
      const state = !rows.length
        ? (departure.blockedSeats ?? []).includes(String(s.seatNo)) ? "blocked" : "available"
        : s.status === "blocked"
          ? "blocked"
          : s.status === "booked"
            ? "booked"
            : heldLive
              ? "held"
              : "available";
      const base = { seatNo: String(s.seatNo), row: s.row, col: s.col, deck: s.deck ?? "lower", kind: s.kind ?? "seater", price: seatFareOf(departure, String(s.seatNo)) };
      if (view === "public") return { ...base, status: state === "booked" || state === "held" ? "unavailable" : state };
      return { ...base, status: state, bookingReference: s.bookingId ? refs.get(String(s.bookingId)) ?? "" : "" };
    });
    const available = seats.filter((s: any) => s.status === "available").length;
    return {
      departureId: String(departure._id),
      columns: departure.seatLayout?.columns ?? 5,
      rows: departure.seatLayout?.rows ?? Math.ceil(seats.length / 4),
      template: departure.seatLayout?.template ?? "2x2",
      seatMode: departure.seatMode,
      available,
      seats,
    };
  }

  async adminBlockSeats(admin: YatraActor, departureId: string, seatNos: string[], blocked: boolean): Promise<any> {
    const departure = await this.departures.findById(departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const wanted = [...new Set(seatNos.map((s) => String(s).toUpperCase()))];
    const changed = await this.transactions.run(async (session) => {
      let count = 0;
      for (const seatNo of wanted) {
        const now = new Date();
        const filter = blocked ? this.claimable(departure._id, now, { seatNo }) : { departureId: departure._id, seatNo, status: "blocked" };
        const row = await this.seats.findOneAndUpdate(
          filter,
          { $set: blocked ? { status: "blocked", bookingId: null, holdExpiresAt: null } : { status: "available" } },
          { new: true, session },
        );
        if (row) count += 1;
      }
      if (count) {
        const current = await this.departures.findById(departure._id).session(session);
        const set = new Set<string>(current.blockedSeats ?? []);
        for (const seatNo of wanted) {
          if (blocked) set.add(seatNo);
          else set.delete(seatNo);
        }
        current.blockedSeats = [...set];
        current.capacity = Math.max(0, Number(current.capacity) + (blocked ? -count : count));
        await current.save({ session });
      }
      await this.audit.record(admin, blocked ? "seats.blocked" : "seats.unblocked", { departureId, seats: wanted, changed: count }, {}, session);
      return count;
    });
    if (changed !== wanted.length && blocked)
      return { changed, message: `${changed} of ${wanted.length} seat(s) blocked. Seats already held or sold were left as they are.`, seatMap: await this.seatMap(departureId, "admin") };
    return { changed, seatMap: await this.seatMap(departureId, "admin") };
  }

  // -------------------------------------------------------------- public site
  async search(query: {
    origin?: string;
    destination?: string;
    date?: string;
    dateTo?: string;
    minPrice?: number;
    maxPrice?: number;
    seats?: number;
    page: number;
    limit: number;
  }): Promise<any> {
    const settings = await this.settings.get();
    const tourFilter: Record<string, unknown> = { status: "published" };
    if (query.origin) tourFilter.originCityKey = cityKey(query.origin);
    if (query.destination) tourFilter.destinationCityKey = cityKey(query.destination);
    const tours = await this.tours.find(tourFilter).limit(500).lean();
    if (!tours.length) return { items: [], total: 0 };
    const operators = await this.operators
      .find({ _id: { $in: [...new Set(tours.map((t: any) => String(t.operatorId)))] }, status: "approved" })
      .lean();
    const opById = new Map(operators.map((o: any) => [String(o._id), o]));
    const eligible = tours.filter((t: any) => opById.has(String(t.operatorId)));
    if (!eligible.length) return { items: [], total: 0 };
    const tourById = new Map(eligible.map((t: any) => [String(t._id), t]));

    const earliest = new Date(Date.now() + settings.salesCloseMinutes * 60_000);
    const departAt: Record<string, Date> = { $gt: earliest };
    if (query.date) {
      const start = istDayStart(query.date);
      if (start > earliest) departAt.$gt = new Date(start.getTime() - 1);
      departAt.$lt = new Date((query.dateTo ? istDayStart(query.dateTo) : start).getTime() + 86_400_000);
    }
    const depFilter: Record<string, unknown> = { tourId: { $in: [...tourById.keys()] }, status: "scheduled", departAt };
    if (query.minPrice || query.maxPrice) {
      const fare: Record<string, number> = {};
      if (query.minPrice) fare.$gte = query.minPrice;
      if (query.maxPrice) fare.$lte = query.maxPrice;
      depFilter.fare = fare;
    }
    const deps = await this.departures.find(depFilter).sort({ departAt: 1 }).limit(300).lean();
    const vehicles = await this.vehicles.find({ _id: { $in: [...new Set(deps.map((d: any) => String(d.vehicleId)))] }, status: "approved" }).lean();
    const vehicleById = new Map(vehicles.map((v: any) => [String(v._id), v]));
    const ratingByOperator = await this.ratings.summaries(deps.map((d: any) => d.operatorId));
    const wantSeats = Math.max(1, Number(query.seats ?? 1));
    const results = deps
      .filter((d: any) => vehicleById.has(String(d.vehicleId)))
      .map((d: any) => ({ d, left: Math.max(0, Number(d.capacity) - Number(d.bookedSeats)) }))
      .filter(({ left }) => left >= wantSeats)
      .map(({ d, left }) => {
        const tour = tourById.get(String(d.tourId));
        const vehicle = vehicleById.get(String(d.vehicleId));
        return {
          departureCode: d.departureCode,
          departAt: d.departAt,
          returnAt: d.returnAt,
          fare: d.fare,
          fromFare: lowestSeatFare(d),
          seatsLeft: left,
          capacity: d.capacity,
          seatMode: d.seatMode,
          boardingPoints: (d.boardingPoints ?? []).map((p: any) => ({ name: p.name, time: p.time })),
          droppingPoints: (d.droppingPoints ?? []).map((p: any) => ({ name: p.name, time: p.time })),
          restStopCount: (d.restStops ?? []).length,
          charterEnabled: Boolean(d.charterEnabled),
          tour: {
            title: tour.title,
            slug: tour.slug,
            summary: tour.summary ?? "",
            productType: tour.productType,
            originCity: tour.originCity,
            destinationCity: tour.destinationCity,
            durationDays: tour.durationDays,
            durationNights: tour.durationNights ?? 0,
            coverImage: tour.coverImage || tour.images?.[0] || "",
            highlights: (tour.highlights ?? []).slice(0, 3),
          },
          operator: { ...operatorPublicView(opById.get(String(d.operatorId))), rating: ratingByOperator.get(String(d.operatorId)) ?? { average: 0, count: 0 } },
          vehicle: {
            vehicleType: vehicle.vehicleType,
            isAc: Boolean(vehicle.isAc),
            image: vehicle.images?.[0] ?? "",
            make: vehicle.make ?? "",
            model: vehicle.model ?? "",
            amenities: (vehicle.amenities ?? []).slice(0, 12),
            // What a pilgrim filters by: seater or sleeper berths, one deck or two.
            seatKinds: [...new Set((d.seatLayout?.seats ?? []).map((x: any) => x.kind ?? "seater"))],
            decks: new Set((d.seatLayout?.seats ?? []).map((x: any) => x.deck ?? "lower")).size > 1 ? 2 : 1,
          },
        };
      });
    const start = (query.page - 1) * query.limit;
    return { items: results.slice(start, start + query.limit), total: results.length };
  }

  async filters(): Promise<{ origins: string[]; destinations: string[] }> {
    const tours = await this.tours.find({ status: "published" }).select("originCity destinationCity operatorId").limit(1000).lean();
    const approved = new Set(
      (await this.operators.find({ _id: { $in: [...new Set(tours.map((t: any) => String(t.operatorId)))] }, status: "approved" }).select("_id").lean()).map((o: any) => String(o._id)),
    );
    const live = tours.filter((t: any) => approved.has(String(t.operatorId)));
    const uniq = (values: string[]) => [...new Map(values.filter(Boolean).map((v) => [cityKey(v), v.trim()])).values()].sort();
    return { origins: uniq(live.map((t: any) => t.originCity)), destinations: uniq(live.map((t: any) => t.destinationCity)) };
  }

  async findByCode(code: string): Promise<any> {
    const departure = await this.departures.findOne({ departureCode: String(code).toUpperCase() }).lean();
    if (!departure) throw new YatraException("This departure was not found.", 404, "DEPARTURE_NOT_FOUND");
    return departure;
  }

  /** The public departure page. Hidden entirely unless the tour is published by an approved partner. */
  async publicDeparture(code: string): Promise<any> {
    const departure = await this.findByCode(code);
    const { tour, operator, vehicle, reason } = await this.context(departure);
    if (!tour || tour.status !== "published" || operator?.status !== "approved")
      throw new YatraException("This departure was not found.", 404, "DEPARTURE_NOT_FOUND");
    const map = await this.seatMap(String(departure._id), "public");
    const view = departureView(departure);
    const pub = {
      id: view.id,
      departureCode: view.departureCode,
      tourId: view.tourId,
      departAt: view.departAt,
      returnAt: view.returnAt,
      timezone: view.timezone,
      boardingPoints: view.boardingPoints,
      droppingPoints: view.droppingPoints,
      restStops: view.restStops,
      charterEnabled: view.charterEnabled,
      fare: view.fare,
      seatMode: view.seatMode,
      seatLayout: view.seatLayout,
      capacity: view.capacity,
      status: view.status,
      cancellationReason: view.cancellationReason,
    };
    // What a pilgrim can trust about the bus. The documents themselves stay private; only whether Tirvona
    // verified them (and the pollution certificate's validity) is shown.
    const docs = vehicle ? await this.documents.find({ vehicleId: vehicle._id, status: "approved" }).select("documentType expiresAt").lean() : [];
    const now = Date.now();
    const rc = docs.some((x: any) => x.documentType === "registration_certificate");
    const pollution = docs
      .filter((x: any) => x.documentType === "pollution_certificate" && x.expiresAt && new Date(x.expiresAt).getTime() > now)
      .sort((a: any, b: any) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime())[0];
    return {
      departure: { ...pub, seatsLeft: map.available },
      tour: tourPublicView(tour),
      operator: { ...operatorPublicView(operator), rating: await this.ratings.summary(operator._id), reviews: await this.ratings.recent(operator._id, 5) },
      vehicle: { ...vehiclePublicView(vehicle), rcVerified: rc, pollutionValidTill: pollution?.expiresAt ?? null },
      protection: { ...CANCELLATION_PROTECTION },
      bookable: !reason && map.available > 0,
      unavailableReason: reason ?? (map.available > 0 ? null : "This departure is fully booked."),
      maxSeatsPerBooking: (await this.settings.get()).maxSeatsPerBooking,
    };
  }
}
