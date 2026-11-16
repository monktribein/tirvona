import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { canonicalPhone } from "../../../common/phone/phone.util";
import { YATRA_MODEL } from "../domain/yatra.constants";
import { wholeBusPrice } from "../domain/yatra.utils";
import { YatraException } from "../domain/yatra.errors";
import { YatraBookingService } from "./yatra-booking.service";
import { YatraInventoryService } from "./yatra-inventory.service";
import { YatraAccessService, type YatraActor, YatraAuditService, YatraNotifier } from "./yatra-support.service";

const requestNumber = () => `YC${randomBytes(4).toString("hex").toUpperCase()}`;

/**
 * "Book the whole bus". A pilgrim asks a partner for every seat of one departure. The organiser
 * accepts (the seats are held for the pilgrim, who then pays through the normal Tirvona checkout) or
 * declines. Nothing is confirmed until Tirvona's own payment is verified, like any other booking.
 */
@Injectable()
export class YatraCharterService {
  constructor(
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    private readonly inventory: YatraInventoryService,
    private readonly bookings: YatraBookingService,
    @InjectModel(YATRA_MODEL.CharterRequest) private readonly requests: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
  ) {}

  // ---------------------------------------------------------------- pilgrim
  async create(user: YatraActor, dto: { departureCode: string; groupSize: number; contact: { name: string; phone: string; email?: string }; message?: string }): Promise<any> {
    const departure = await this.inventory.findByCode(dto.departureCode);
    const { tour, reason } = await this.inventory.context(departure);
    if (reason) throw new YatraException(reason, 409, "NOT_SELLABLE");
    if (!departure.charterEnabled) throw new YatraException("This partner does not take full-bus requests for this departure.", 409, "CHARTER_NOT_OFFERED");
    if (!(await this.inventory.wholeBusFree(departure))) throw new YatraException("Some seats are already booked on this departure, so the whole bus is no longer available.", 409, "SEATS_TAKEN");
    try {
      const created = await this.requests.create({
        requestNumber: requestNumber(),
        departureId: departure._id,
        tourId: departure.tourId,
        operatorId: departure.operatorId,
        customerId: user.id,
        contactName: String(dto.contact.name).trim(),
        contactPhone: canonicalPhone(String(dto.contact.phone)),
        groupSize: dto.groupSize,
        message: String(dto.message ?? "").trim(),
        status: "requested",
        history: [{ status: "requested", note: "Requested by the pilgrim", by: user.id }],
      });
      await this.notifier.operatorTeam(String(departure.operatorId), "Full-bus request", `${created.contactName} asked to book the whole bus for ${tour?.title ?? "a departure"} (${created.groupSize} travellers).`, "/operator/charter-requests");
      return this.view(created.toObject ? created.toObject() : created, { tour, departure });
    } catch (error: any) {
      if (error?.code === 11000) throw new YatraException("You already have an open request for this departure.", 409, "ALREADY_REQUESTED");
      throw error;
    }
  }

  async listMine(user: YatraActor): Promise<any[]> {
    const rows = await this.requests.find({ customerId: user.id }).sort({ createdAt: -1 }).limit(50).lean();
    return this.decorate(rows);
  }

  async cancelMine(user: YatraActor, id: string): Promise<any> {
    const request = await this.requests.findOne({ _id: id, customerId: user.id });
    if (!request) throw new YatraException("Request not found.", 404);
    if (request.status !== "requested") throw new YatraException("Only a request that is waiting for the partner can be withdrawn.", 409);
    request.status = "cancelled";
    request.history.push({ status: "cancelled", note: "Withdrawn by the pilgrim", by: user.id });
    await request.save();
    return (await this.decorate([request.toObject ? request.toObject() : request]))[0];
  }

  // -------------------------------------------------------------- organiser
  async listForOperator(user: YatraActor, status?: string): Promise<any[]> {
    const { operator } = await this.access.require(user, "viewBookings");
    const filter: Record<string, unknown> = { operatorId: operator._id };
    if (status) filter.status = status;
    return this.decorate(await this.requests.find(filter).sort({ createdAt: -1 }).limit(100).lean());
  }

  async respond(user: YatraActor, id: string, dto: { action: string; note?: string }): Promise<any> {
    const { operator } = await this.access.require(user, "createBookings", { approved: true, writable: true });
    const request = await this.requests.findOne({ _id: id, operatorId: operator._id });
    if (!request) throw new YatraException("Request not found.", 404);
    if (request.status !== "requested") throw new YatraException("This request has already been answered.", 409);
    const note = String(dto.note ?? "").trim();
    const departure = await this.departures.findById(request.departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    if (dto.action === "decline") {
      request.status = "declined";
    } else {
      // Holds every seat for the pilgrim; throws if any seat was sold meanwhile.
      const booking = await this.bookings.createCharterBooking({
        departure,
        customerId: String(request.customerId),
        organiserUserId: user.id,
        contact: { name: request.contactName, phone: request.contactPhone },
      });
      request.status = "accepted";
      request.bookingId = booking._id;
    }
    request.organiserNote = note;
    request.respondedBy = user.id;
    request.respondedAt = new Date();
    request.history.push({ status: request.status, note: note || (dto.action === "decline" ? "Declined" : "Accepted; seats held for payment"), by: user.id });
    await request.save();
    await this.audit.record(user, `charter.${request.status}`, { operatorId: String(operator._id), requestId: id, departureId: String(departure._id) });
    const tour = await this.tours.findById(departure.tourId).select("title").lean();
    if (request.status === "accepted")
      await this.notifier.users([String(request.customerId)], "Your full-bus request was accepted", `${tour?.title ?? "Your trip"}: the whole bus is held for you. Pay to confirm.`, `/yatra/checkout/${String(request.bookingId)}`, "yatra.charter");
    else await this.notifier.users([String(request.customerId)], "Your full-bus request was declined", `${tour?.title ?? "Your trip"}: the partner could not give you the whole bus.${note ? ` ${note}` : ""}`, "/profile/journeys", "yatra.charter");
    return (await this.decorate([request.toObject ? request.toObject() : request]))[0];
  }

  // ---------------------------------------------------------------- helpers
  private async decorate(rows: any[]): Promise<any[]> {
    const departures = await this.departures.find({ _id: { $in: [...new Set(rows.map((r) => String(r.departureId)))] } }).select("departureCode departAt returnAt fare capacity seatFares seatLayout blockedSeats").lean();
    const tours = await this.tours.find({ _id: { $in: [...new Set(rows.map((r) => String(r.tourId)))] } }).select("title").lean();
    const operators = await this.operators.find({ _id: { $in: [...new Set(rows.map((r) => String(r.operatorId)))] } }).select("organisationName displayName").lean();
    const dep = new Map(departures.map((d: any) => [String(d._id), d]));
    const tour = new Map(tours.map((t: any) => [String(t._id), t]));
    const op = new Map(operators.map((o: any) => [String(o._id), o]));
    return rows.map((r) => this.view(r, { departure: dep.get(String(r.departureId)), tour: tour.get(String(r.tourId)), operator: op.get(String(r.operatorId)) }));
  }

  private view(r: any, ctx: { departure?: any; tour?: any; operator?: any }) {
    const seats = Number(ctx.departure?.capacity ?? 0);
    return {
      id: String(r._id),
      requestNumber: r.requestNumber,
      status: r.status,
      departureId: String(r.departureId),
      departureCode: ctx.departure?.departureCode ?? "",
      departAt: ctx.departure?.departAt ?? null,
      returnAt: ctx.departure?.returnAt ?? null,
      tourTitle: ctx.tour?.title ?? "",
      operatorName: ctx.operator?.displayName || ctx.operator?.organisationName || "",
      contactName: r.contactName,
      contactPhone: r.contactPhone,
      groupSize: r.groupSize,
      message: r.message ?? "",
      organiserNote: r.organiserNote ?? "",
      respondedAt: r.respondedAt ?? null,
      bookingId: r.bookingId ? String(r.bookingId) : null,
      // The price of the whole bus: every sellable seat at the departure fare.
      wholeBusSeats: seats,
      wholeBusPrice: ctx.departure ? wholeBusPrice(ctx.departure) : 0,
      createdAt: r.createdAt,
    };
  }
}
