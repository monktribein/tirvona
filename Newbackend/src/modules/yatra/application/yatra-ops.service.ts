import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { placeTermsForCity, type LocationScope } from "../../../common/auth/location-scope";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { HrLocationService } from "../../hr/application/hr-location.service";
import { MANIFEST_BOOKING_STATUSES, YATRA_MODEL } from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { cityKey, randomCode } from "../domain/yatra.utils";
import { bookingStaffView } from "./yatra-booking.service";
import { YatraAuditService } from "./yatra-support.service";

const DAY = 86_400_000;
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`);
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

const issueView = (i: any) => ({
  id: String(i._id),
  issueNumber: i.issueNumber,
  city: i.city,
  category: i.category,
  severity: i.severity,
  subjectType: i.subjectType,
  subjectId: i.subjectId ? String(i.subjectId) : null,
  title: i.title,
  description: i.description ?? "",
  reportedByRole: i.reportedByRole ?? "",
  status: i.status,
  resolution: i.resolution ?? "",
  resolvedAt: i.resolvedAt ?? null,
  history: (i.history ?? []).map((h: any) => ({ status: h.status, note: h.note, at: h.at })),
  createdAt: i.createdAt,
});

/**
 * Destination Operations. Super Admin sees every city (or picks one); an HR
 * or Executive login sees only the city of its HR office, using the same
 * office scope as the Leads, Food, Temples and Pandits consoles.
 */
@Injectable()
export class YatraOpsService {
  constructor(
    private readonly location: HrLocationService,
    private readonly audit: YatraAuditService,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Journey) private readonly journeys: Model<any>,
    @InjectModel(YATRA_MODEL.ServiceRequest) private readonly requests: Model<any>,
    @InjectModel(YATRA_MODEL.RideRequest) private readonly rides: Model<any>,
    @InjectModel(YATRA_MODEL.Issue) private readonly issues: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
  ) {}

  /** Place names the caller may see; null = every city (Super Admin with no city chosen). */
  private async terms(user: AuthenticatedUser, city?: string): Promise<{ terms: string[] | null; label: string }> {
    const scope: LocationScope = await this.location.scopeFor(user);
    if (scope === null) {
      if (user.role !== "super_admin") throw new YatraException("Destination Ops is for Super Admin, HR and Executive logins.", 403);
      return city ? { terms: placeTermsForCity(city), label: city } : { terms: null, label: "All cities" };
    }
    return { terms: scope.terms, label: scope.area || scope.city || "No office assigned" };
  }

  private matches(terms: string[] | null, value: string): boolean {
    if (terms === null) return true;
    const v = String(value ?? "").toLowerCase();
    return terms.some((t) => v.includes(t));
  }

  private regexFilter(terms: string[] | null, fields: string[]): Record<string, unknown> {
    if (terms === null) return {};
    if (!terms.length) return { _id: { $in: [] } };
    return { $or: fields.flatMap((f) => terms.map((t) => ({ [f]: { $regex: escapeRegex(t), $options: "i" } }))) };
  }

  /** Tours touching the caller's area, split by whether the area is the destination or the origin. */
  private async toursInScope(terms: string[] | null) {
    const rows = await this.tours.find(this.regexFilter(terms, ["destinationCity", "originCity"])).select("title originCity destinationCity operatorId durationDays").limit(2000).lean();
    return {
      all: rows,
      arriving: rows.filter((t: any) => this.matches(terms, t.destinationCity)),
      leaving: rows.filter((t: any) => this.matches(terms, t.originCity)),
    };
  }

  async dashboard(user: AuthenticatedUser, query: { city?: string; date?: string }): Promise<any> {
    const { terms, label } = await this.terms(user, query.city);
    const day = query.date ?? today();
    const start = dayStart(day);
    const end = new Date(start.getTime() + DAY);
    const scoped = await this.toursInScope(terms);
    const byId = new Map(scoped.all.map((t: any) => [String(t._id), t]));
    const depRows = scoped.all.length
      ? await this.departures.find({ tourId: { $in: scoped.all.map((t: any) => t._id) }, status: { $in: ["scheduled", "sales_closed", "completed"] }, departAt: { $lt: end }, $or: [{ returnAt: { $gte: start } }, { departAt: { $gte: start } }] }).sort({ departAt: 1 }).limit(300).lean()
      : [];
    const ops = await this.operators.find({ _id: { $in: [...new Set(depRows.map((d: any) => String(d.operatorId)))] } }).select("organisationName contactPhone").lean();
    const opById = new Map(ops.map((o: any) => [String(o._id), o]));
    const row = (d: any) => {
      const t = byId.get(String(d.tourId));
      const o = opById.get(String(d.operatorId));
      return { departureId: String(d._id), departureCode: d.departureCode, tourTitle: t?.title ?? "", originCity: t?.originCity ?? "", destinationCity: t?.destinationCity ?? "", departAt: d.departAt, returnAt: d.returnAt, passengers: d.bookedSeats, capacity: d.capacity, status: d.status, organiser: o?.organisationName ?? "", organiserPhone: o?.contactPhone ?? "" };
    };
    const arriving = depRows.filter((d: any) => this.matches(terms, byId.get(String(d.tourId))?.destinationCity)).map(row);
    const leaving = depRows.filter((d: any) => this.matches(terms, byId.get(String(d.tourId))?.originCity) && new Date(d.departAt) >= start && new Date(d.departAt) < end).map(row);

    const journeyIds = (await this.journeys.find(this.regexFilter(terms, ["destinationCity"])).select("_id").limit(5000).lean()).map((j: any) => j._id);
    const [supplier, rides, openIssues] = await Promise.all([
      journeyIds.length ? this.requests.find({ journeyId: { $in: journeyIds }, serviceDate: { $gte: new Date(start.getTime() - DAY), $lt: new Date(end.getTime() + 2 * DAY) } }).sort({ serviceDate: 1 }).limit(200).lean() : [],
      this.rides.find({ ...this.regexFilter(terms, ["city"]), pickupAt: { $gte: start, $lt: new Date(end.getTime() + DAY) } }).sort({ pickupAt: 1 }).limit(200).lean(),
      this.issues.find({ ...this.regexFilter(terms, ["city"]), status: { $in: ["open", "in_progress"] } }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    return {
      scope: label,
      date: day,
      kpis: {
        arrivingGroups: arriving.length,
        arrivingPassengers: arriving.reduce((t: number, d: any) => t + d.passengers, 0),
        leavingGroups: leaving.length,
        leavingPassengers: leaving.reduce((t: number, d: any) => t + d.passengers, 0),
        supplierPending: supplier.filter((r: any) => ["requested", "supplier_pending"].includes(r.status)).length,
        ridesNeedingPartner: rides.filter((r: any) => ["requested", "rejected"].includes(r.status)).length,
        openIssues: openIssues.length,
      },
      arrivals: arriving,
      departures: leaving,
      supplierConfirmations: supplier.map((r: any) => ({ id: String(r._id), requestNumber: r.requestNumber, serviceType: r.serviceType, serviceDate: r.serviceDate, supplierName: r.supplierName ?? "", status: r.status, details: r.details ?? {} })),
      rides: rides.map((r: any) => ({ id: String(r._id), requestNumber: r.requestNumber, city: r.city, pickupAt: r.pickupAt, pickup: r.pickup?.address ?? "", drop: r.drop?.address ?? "", passengers: r.passengers, partnerName: r.partnerName ?? "", status: r.status })),
      issues: openIssues.map(issueView),
    };
  }

  /** Booking assistance: find a booking by reference, only within the caller's area. */
  async lookupBooking(user: AuthenticatedUser, reference: string, city?: string): Promise<any> {
    const { terms } = await this.terms(user, city);
    const booking = await this.bookings.findOne({ bookingReference: reference.trim().toUpperCase() }).lean();
    if (!booking) throw new YatraException("No booking with that reference.", 404);
    const tour = await this.tours.findById(booking.tourId).select("originCity destinationCity title").lean();
    if (!tour || (!this.matches(terms, tour.destinationCity) && !this.matches(terms, tour.originCity))) throw new YatraException("No booking with that reference in your area.", 404);
    const departure = await this.departures.findById(booking.departureId).select("departureCode departAt returnAt boardingPoints status").lean();
    await this.audit.record(user, "ops.booking_lookup", { bookingId: String(booking._id) });
    return { booking: bookingStaffView(booking), tour: { title: tour.title, originCity: tour.originCity, destinationCity: tour.destinationCity }, departure };
  }

  async listIssues(user: AuthenticatedUser, query: { city?: string; status?: string; page: number; limit: number }): Promise<any> {
    const { terms } = await this.terms(user, query.city);
    const filter: Record<string, unknown> = { ...this.regexFilter(terms, ["city"]) };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.issues.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.issues.countDocuments(filter),
    ]);
    return { items: rows.map(issueView), total };
  }

  /** Destination Ops reports an incident. HR / Executive can only report for their own area. */
  async createIssue(user: AuthenticatedUser, dto: any): Promise<any> {
    const { terms } = await this.terms(user, dto.city);
    if (terms !== null && !this.matches(terms, dto.city)) throw new YatraException("You can report incidents only for your own area.", 403);
    if (dto.bookingReference) {
      await this.lookupBooking(user, dto.bookingReference, dto.city);
    }
    const booking = dto.bookingReference ? await this.bookings.findOne({ bookingReference: dto.bookingReference.trim().toUpperCase() }).select("_id journeyId").lean() : null;
    const issue = await this.issues.create({
      issueNumber: `YIS-${randomCode(8)}`,
      city: dto.city,
      cityKey: cityKey(dto.city),
      category: dto.category ?? "incident",
      severity: dto.severity ?? "medium",
      subjectType: booking ? "booking" : "none",
      subjectId: booking?._id ?? null,
      journeyId: booking?.journeyId ?? null,
      title: dto.title,
      description: dto.description ?? "",
      reportedBy: user.id,
      reportedByRole: user.role === "super_admin" ? "admin" : "ops",
      history: [{ status: "open", note: "Reported by Destination Ops", by: user.id }],
    });
    await this.audit.record(user, "issue.created", { issueId: String(issue._id), city: dto.city, severity: issue.severity });
    return issueView(issue.toObject());
  }

  async updateIssue(user: AuthenticatedUser, issueId: string, dto: { status: string; resolution?: string; note?: string }): Promise<any> {
    const issue = await this.issues.findById(issueId);
    if (!issue) throw new YatraException("Issue not found.", 404);
    const { terms } = await this.terms(user);
    if (terms !== null && !this.matches(terms, issue.city)) throw new YatraException("Issue not found.", 404);
    if (["resolved", "closed"].includes(dto.status) && (dto.resolution ?? "").trim().length < 3) throw new YatraException("Describe how it was resolved.", 400);
    const before = issue.status;
    issue.status = dto.status;
    if (dto.resolution) issue.resolution = dto.resolution.trim();
    if (["resolved", "closed"].includes(dto.status)) {
      issue.resolvedAt = new Date();
      issue.resolvedBy = user.id;
    }
    issue.history.push({ status: dto.status, note: dto.note ?? dto.resolution ?? "", by: user.id });
    await issue.save();
    await this.audit.record(user, "issue.updated", { issueId }, { before: { status: before }, after: { status: dto.status } });
    return issueView(issue.toObject());
  }

  /** Day-by-day counts for the caller's area. */
  async cityReport(user: AuthenticatedUser, query: { city?: string; from: string; to: string }): Promise<any> {
    const { terms, label } = await this.terms(user, query.city);
    const start = dayStart(query.from);
    const end = new Date(dayStart(query.to).getTime() + DAY);
    if (end.getTime() - start.getTime() > 92 * DAY) throw new YatraException("Choose at most three months.", 400);
    const scoped = await this.toursInScope(terms);
    const arrivingIds = new Set(scoped.arriving.map((t: any) => String(t._id)));
    const deps = scoped.all.length ? await this.departures.find({ tourId: { $in: scoped.all.map((t: any) => t._id) }, departAt: { $gte: start, $lt: end } }).select("tourId departAt bookedSeats status").lean() : [];
    const [rides, issues] = await Promise.all([
      this.rides.find({ ...this.regexFilter(terms, ["city"]), pickupAt: { $gte: start, $lt: end } }).select("pickupAt status").lean(),
      this.issues.find({ ...this.regexFilter(terms, ["city"]), createdAt: { $gte: start, $lt: end } }).select("createdAt").lean(),
    ]);
    const days = new Map<string, any>();
    const key = (d: Date | string) => new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10);
    const row = (d: string) => days.get(d) ?? days.set(d, { date: d, arrivingGroups: 0, arrivingPassengers: 0, rides: 0, completedRides: 0, issues: 0 }).get(d);
    for (const d of deps) {
      if (!arrivingIds.has(String(d.tourId)) || d.status === "cancelled") continue;
      const r = row(key(d.departAt));
      r.arrivingGroups += 1;
      r.arrivingPassengers += Number(d.bookedSeats ?? 0);
    }
    for (const ride of rides) {
      const r = row(key(ride.pickupAt));
      r.rides += 1;
      if (ride.status === "completed") r.completedRides += 1;
    }
    for (const i of issues) row(key(i.createdAt)).issues += 1;
    return { scope: label, rows: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }

  /** Confirmed travellers of a departure for on-ground coordination (area-checked). */
  async departurePassengers(user: AuthenticatedUser, departureId: string): Promise<any> {
    const { terms } = await this.terms(user);
    const departure = await this.departures.findById(departureId).lean();
    if (!departure) throw new YatraException("Departure not found.", 404);
    const tour = await this.tours.findById(departure.tourId).select("originCity destinationCity title").lean();
    if (!tour || (!this.matches(terms, tour.destinationCity) && !this.matches(terms, tour.originCity))) throw new YatraException("Departure not found.", 404);
    const rows = await this.bookings.find({ departureId, status: { $in: MANIFEST_BOOKING_STATUSES } }).lean();
    return {
      departureCode: departure.departureCode,
      tourTitle: tour.title,
      passengers: rows.flatMap((b: any) => (b.passengers ?? []).map((p: any) => ({ name: p.name, seatNo: p.seatNo, bookingReference: b.bookingReference, contactPhone: b.contact?.phone ?? "", boardingPointName: b.boardingPointName, checkedInAt: p.checkedInAt ?? null }))),
    };
  }

  /** Throws unless the city is inside the caller's area (Super Admin: always allowed). */
  async assertCity(user: AuthenticatedUser, city: string): Promise<void> {
    const { terms } = await this.terms(user);
    if (terms !== null && !this.matches(terms, city)) throw new YatraException("That is outside your area.", 403);
  }

  async areaLabel(user: AuthenticatedUser): Promise<string> {
    return (await this.terms(user)).label;
  }
}
