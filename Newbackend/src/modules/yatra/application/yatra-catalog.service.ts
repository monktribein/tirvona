import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { TOUR_EDITABLE_STATUSES, YATRA_MODEL } from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import {
  DEFAULT_CANCELLATION_POLICY,
  cityKey,
  generateSeatLayout,
  normaliseCustomLayout,
  validateCancellationPolicy,
  validateCustomLayout,
  vehicleNumberKey,
} from "../domain/yatra.utils";
import { YatraAccessService, type YatraActor, YatraAuditService, YatraNotifier } from "./yatra-support.service";

export const vehicleView = (v: any) =>
  v && {
    id: String(v._id),
    operatorId: String(v.operatorId),
    registrationNumber: v.registrationNumber,
    vehicleType: v.vehicleType,
    make: v.make ?? "",
    model: v.model ?? "",
    seatCapacity: v.seatCapacity,
    isAc: Boolean(v.isAc),
    amenities: v.amenities ?? [],
    permitType: v.permitType,
    seatLayout: v.seatLayout ?? null,
    images: v.images ?? [],
    status: v.status,
    reviewNote: v.reviewNote ?? "",
    reviewedAt: v.reviewedAt ?? null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };

export const tourView = (t: any) =>
  t && {
    id: String(t._id),
    operatorId: String(t.operatorId),
    title: t.title,
    slug: t.slug,
    summary: t.summary ?? "",
    description: t.description ?? "",
    productType: t.productType,
    originCity: t.originCity,
    originState: t.originState ?? "",
    destinationCity: t.destinationCity,
    destinationState: t.destinationState ?? "",
    durationDays: t.durationDays,
    durationNights: t.durationNights ?? 0,
    stops: Array.isArray(t.stops) ? t.stops : [],
    itinerary: Array.isArray(t.itinerary) ? t.itinerary : [],
    highlights: t.highlights ?? [],
    inclusions: t.inclusions ?? [],
    exclusions: t.exclusions ?? [],
    images: t.images ?? [],
    coverImage: t.coverImage || t.images?.[0] || "",
    baseFare: t.baseFare,
    cancellationPolicy: t.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
    circuitTemplateId: t.circuitTemplateId ? String(t.circuitTemplateId) : null,
    circuitTemplateName: t.circuitTemplateName ?? "",
    status: t.status,
    submittedAt: t.submittedAt ?? null,
    reviewedAt: t.reviewedAt ?? null,
    reviewNote: t.reviewNote ?? "",
    publishedAt: t.publishedAt ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };

/** Fields of a tour the public may see. */
export const tourPublicView = (t: any) => {
  const v = tourView(t);
  if (!v) return v;
  const hidden = new Set(["reviewNote", "reviewedAt", "submittedAt", "circuitTemplateId"]);
  return Object.fromEntries(Object.entries(v).filter(([key]) => !hidden.has(key)));
};

const VEHICLE_LAYOUT_FIELDS = ["registrationNumber", "seatCapacity", "seatLayout", "layoutTemplate", "customSeats", "permitType", "vehicleType"];

@Injectable()
export class YatraCatalogService {
  constructor(
    private readonly access: YatraAccessService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
    @InjectModel(YATRA_MODEL.Vehicle) private readonly vehicles: Model<any>,
    @InjectModel(YATRA_MODEL.Document) private readonly documents: Model<any>,
    @InjectModel(YATRA_MODEL.Tour) private readonly tours: Model<any>,
    @InjectModel(YATRA_MODEL.Departure) private readonly departures: Model<any>,
    @InjectModel(YATRA_MODEL.CircuitRef) private readonly circuits: Model<any>,
    @InjectModel(YATRA_MODEL.CircuitStopRef) private readonly circuitStops: Model<any>,
  ) {}

  // ------------------------------------------------------------------ vehicles
  private buildLayout(dto: any, capacity: number) {
    if (dto.layoutTemplate === "custom") {
      const error = validateCustomLayout(dto.customSeats ?? []);
      if (error) throw new YatraException(error, 400, "INVALID_LAYOUT");
      return normaliseCustomLayout(dto.customSeats);
    }
    return generateSeatLayout(dto.layoutTemplate ?? "2x2", capacity);
  }

  async listVehicles(user: YatraActor): Promise<any[]> {
    const { operator } = await this.access.require(user, "viewBookings");
    const rows = await this.vehicles.find({ operatorId: operator._id }).sort({ createdAt: -1 }).lean();
    return rows.map(vehicleView);
  }

  async createVehicle(user: YatraActor, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageVehicles", { writable: true });
    const registrationKey = vehicleNumberKey(dto.registrationNumber);
    if (registrationKey.length < 6) throw new YatraException("Enter the full vehicle registration number.", 400);
    if (await this.vehicles.exists({ registrationKey }))
      throw new YatraException("A vehicle with this registration number is already registered on Tirvona.", 409, "DUPLICATE_VEHICLE");
    const layout = this.buildLayout(dto, dto.seatCapacity);
    const vehicle = await this.vehicles.create({
      operatorId: operator._id,
      registrationNumber: dto.registrationNumber.trim().toUpperCase(),
      registrationKey,
      vehicleType: dto.vehicleType ?? "bus",
      make: dto.make ?? "",
      model: dto.model ?? "",
      seatCapacity: layout.seats.length,
      isAc: Boolean(dto.isAc),
      amenities: dto.amenities ?? [],
      permitType: dto.permitType ?? "tourist_permit",
      seatLayout: layout,
      images: dto.images ?? [],
      status: "draft",
    });
    await this.audit.record(user, "vehicle.created", { operatorId: String(operator._id), vehicleId: String(vehicle._id), registrationKey });
    return vehicleView(vehicle);
  }

  async updateVehicle(user: YatraActor, vehicleId: string, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageVehicles", { writable: true });
    const vehicle = await this.vehicles.findOne({ _id: vehicleId, operatorId: operator._id });
    if (!vehicle) throw new YatraException("Vehicle not found.", 404);
    if (vehicle.status === "suspended") throw new YatraException("This vehicle is suspended by Tirvona.", 403);
    const before = vehicleView(vehicle.toObject());
    const touchesLayout = VEHICLE_LAYOUT_FIELDS.some((key) => dto[key] !== undefined);
    if (dto.registrationNumber !== undefined) {
      const key = vehicleNumberKey(dto.registrationNumber);
      if (key !== vehicle.registrationKey && (await this.vehicles.exists({ registrationKey: key, _id: { $ne: vehicle._id } })))
        throw new YatraException("A vehicle with this registration number is already registered on Tirvona.", 409);
      vehicle.registrationNumber = dto.registrationNumber.trim().toUpperCase();
      vehicle.registrationKey = key;
    }
    for (const key of ["vehicleType", "make", "model", "isAc", "amenities", "permitType", "images"])
      if (dto[key] !== undefined) vehicle[key] = dto[key];
    if (dto.layoutTemplate !== undefined || dto.seatCapacity !== undefined || dto.customSeats !== undefined) {
      const layout = this.buildLayout(
        { layoutTemplate: dto.layoutTemplate ?? vehicle.seatLayout?.template ?? "2x2", customSeats: dto.customSeats },
        dto.seatCapacity ?? vehicle.seatCapacity,
      );
      vehicle.seatLayout = layout;
      vehicle.seatCapacity = layout.seats.length;
    }
    // A verified vehicle whose identity or seats changed must be verified again.
    if (touchesLayout && vehicle.status === "approved") vehicle.status = "pending_verification";
    await vehicle.save();
    await this.audit.record(user, "vehicle.updated", { operatorId: String(operator._id), vehicleId }, { before, after: vehicleView(vehicle.toObject()) });
    return vehicleView(vehicle);
  }

  async submitVehicle(user: YatraActor, vehicleId: string): Promise<any> {
    const { operator } = await this.access.require(user, "manageVehicles", { writable: true });
    const vehicle = await this.vehicles.findOne({ _id: vehicleId, operatorId: operator._id }).lean();
    if (!vehicle) throw new YatraException("Vehicle not found.", 404);
    if (!["draft", "rejected"].includes(vehicle.status)) throw new YatraException("This vehicle is already submitted.", 409);
    const docs = await this.documents.find({ vehicleId: vehicle._id, status: { $ne: "rejected" } }).select("documentType").lean();
    const types = new Set(docs.map((d: any) => d.documentType));
    const missing: string[] = [];
    if (!types.has("registration_certificate")) missing.push("registration certificate (RC)");
    if (!types.has("insurance")) missing.push("insurance");
    if (!["tourist_permit", "contract_carriage_permit", "stage_carriage_permit", "all_india_tourist_permit"].some((t) => types.has(t)))
      missing.push("a permit");
    if (missing.length) throw new YatraException(`Upload these vehicle documents first: ${missing.join(", ")}.`, 400, "VEHICLE_DOCUMENTS_MISSING");
    const after = await this.vehicles.findOneAndUpdate(
      { _id: vehicle._id, status: { $in: ["draft", "rejected"] } },
      { $set: { status: "pending_verification", reviewNote: "" } },
      { new: true },
    ).lean();
    await this.audit.record(user, "vehicle.submitted", { operatorId: String(operator._id), vehicleId }, { before: { status: vehicle.status }, after: { status: "pending_verification" } });
    return vehicleView(after);
  }

  async adminVehicles(query: { status?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.vehicles.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.vehicles.countDocuments(filter),
    ]);
    const ops = await this.operators.find({ _id: { $in: [...new Set(rows.map((r: any) => String(r.operatorId)))] } }).select("organisationName").lean();
    const names = new Map(ops.map((o: any) => [String(o._id), o.organisationName]));
    return { items: rows.map((r: any) => ({ ...vehicleView(r), operatorName: names.get(String(r.operatorId)) ?? "" })), total };
  }

  async adminReviewVehicle(admin: YatraActor, vehicleId: string, action: "approve" | "reject" | "suspend", note = ""): Promise<any> {
    const vehicle = await this.vehicles.findById(vehicleId).lean();
    if (!vehicle) throw new YatraException("Vehicle not found.", 404);
    const rules: Record<string, { from: string[]; to: string }> = {
      approve: { from: ["pending_verification", "rejected", "suspended"], to: "approved" },
      reject: { from: ["pending_verification"], to: "rejected" },
      suspend: { from: ["approved"], to: "suspended" },
    };
    const rule = rules[action];
    if (!rule.from.includes(vehicle.status)) throw new YatraException(`A ${vehicle.status.replace(/_/g, " ")} vehicle cannot be ${action}d.`, 409);
    if (action !== "approve" && note.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const after = await this.vehicles.findOneAndUpdate(
      { _id: vehicleId, status: vehicle.status },
      { $set: { status: rule.to, reviewNote: note.trim(), reviewedBy: admin.id, reviewedAt: new Date() } },
      { new: true },
    ).lean();
    if (!after) throw new YatraException("This vehicle changed while you were reviewing. Reload and try again.", 409);
    await this.audit.record(admin, `vehicle.${action}`, { vehicleId, operatorId: String(vehicle.operatorId), note }, { before: { status: vehicle.status }, after: { status: rule.to } });
    await this.notifier.operatorTeam(String(vehicle.operatorId), "Vehicle verification", `${vehicle.registrationNumber} is now ${rule.to.replace(/_/g, " ")}${note ? `: ${note}` : "."}`, "/operator/vehicles");
    return vehicleView(after);
  }

  // --------------------------------------------------------- circuit templates
  async circuitTemplates(q?: string): Promise<any[]> {
    const filter: Record<string, unknown> = { status: "approved", usableAsPlannerTemplate: { $ne: false } };
    if (q) filter.name = { $regex: escapeRegex(q), $options: "i" };
    const rows = await this.circuits.find(filter).sort({ name: 1 }).limit(100).lean();
    return rows.map((c: any) => ({
      id: String(c._id),
      name: c.name,
      summary: c.summary ?? "",
      startCity: c.startCity ?? "",
      endCity: c.endCity ?? "",
      state: c.state ?? "",
      durationDays: c.durationDays ?? 1,
      coverImage: c.coverImage ?? "",
    }));
  }

  /** A circuit as a tour draft: its stops and days are copied, the circuit is never changed. */
  async circuitTemplate(circuitId: string): Promise<any> {
    const circuit = await this.circuits.findOne({ _id: circuitId, status: "approved" }).lean();
    if (!circuit) throw new YatraException("Circuit template not found.", 404);
    const stops = await this.circuitStops.find({ circuitId: circuit._id }).sort({ dayNumber: 1, order: 1 }).limit(60).lean();
    const days = new Map<number, string[]>();
    for (const s of stops) days.set(s.dayNumber, [...(days.get(s.dayNumber) ?? []), s.name]);
    return {
      circuitTemplateId: String(circuit._id),
      circuitTemplateName: circuit.name,
      title: circuit.name,
      summary: circuit.summary ?? "",
      description: circuit.description ?? "",
      originCity: circuit.startCity ?? "",
      destinationCity: circuit.endCity ?? "",
      destinationState: circuit.state ?? "",
      durationDays: Math.max(1, Math.min(30, Number(circuit.durationDays ?? 1))),
      highlights: Array.isArray(circuit.highlights) ? circuit.highlights.slice(0, 20) : [],
      images: Array.isArray(circuit.images) ? circuit.images.slice(0, 10) : [],
      coverImage: circuit.coverImage ?? "",
      stops: stops.map((s: any, index: number) => ({
        order: index + 1,
        dayNumber: s.dayNumber,
        name: s.name,
        city: s.city ?? "",
        stopType: s.stopType ?? "temple",
        notes: s.notes ?? "",
        arrivalTime: s.arrivalTime ?? "",
        durationMinutes: s.suggestedDurationMinutes ?? 60,
      })),
      itinerary: [...days.entries()].map(([dayNumber, names]) => ({
        dayNumber,
        title: `Day ${dayNumber}`,
        description: names.join(" → "),
      })),
    };
  }

  // --------------------------------------------------------------------- tours
  private validateTour(dto: any): void {
    if (dto.cancellationPolicy) {
      const error = validateCancellationPolicy(dto.cancellationPolicy);
      if (error) throw new YatraException(error, 400, "INVALID_POLICY");
    }
    if (Array.isArray(dto.itinerary)) {
      const days = dto.itinerary.map((d: any) => Number(d.dayNumber));
      if (new Set(days).size !== days.length) throw new YatraException("Each itinerary day can appear only once.", 400);
    }
  }

  private tourFields(dto: any): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = ["title", "summary", "description", "productType", "originCity", "originState", "destinationCity", "destinationState", "durationDays", "durationNights", "stops", "itinerary", "highlights", "inclusions", "exclusions", "images", "coverImage", "baseFare", "cancellationPolicy", "circuitTemplateId", "circuitTemplateName"];
    for (const key of keys) if (dto[key] !== undefined) out[key] = dto[key];
    if (dto.originCity !== undefined) out.originCityKey = cityKey(dto.originCity);
    if (dto.destinationCity !== undefined) out.destinationCityKey = cityKey(dto.destinationCity);
    if (Array.isArray(dto.stops)) out.stops = dto.stops.map((s: any, i: number) => ({ ...s, order: i + 1 }));
    return out;
  }

  async listTours(user: YatraActor, status?: string): Promise<any[]> {
    const { operator } = await this.access.require(user, "viewBookings");
    const filter: Record<string, unknown> = { operatorId: operator._id };
    if (status) filter.status = status;
    const rows = await this.tours.find(filter).sort({ updatedAt: -1 }).lean();
    return rows.map(tourView);
  }

  async getTour(user: YatraActor, tourId: string): Promise<any> {
    const { operator } = await this.access.require(user, "viewBookings");
    const tour = await this.tours.findOne({ _id: tourId, operatorId: operator._id }).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    return tourView(tour);
  }

  async createTour(user: YatraActor, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageTours", { writable: true });
    this.validateTour(dto);
    if (dto.circuitTemplateId) {
      const circuit = await this.circuits.findOne({ _id: dto.circuitTemplateId, status: "approved" }).select("name").lean();
      if (!circuit) throw new YatraException("Circuit template not found.", 404);
      dto.circuitTemplateName = circuit.name;
    }
    const slug = await uniqueSlug(`${dto.title} ${dto.originCity}`, {
      exists: async (candidate) => Boolean(await this.tours.exists({ slug: candidate })),
      fallback: "yatra",
    });
    const tour = await this.tours.create({
      ...this.tourFields(dto),
      cancellationPolicy: dto.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
      operatorId: operator._id,
      slug,
      status: "draft",
      createdBy: user.id,
    });
    await this.audit.record(user, "tour.created", { operatorId: String(operator._id), tourId: String(tour._id) });
    return tourView(tour);
  }

  async updateTour(user: YatraActor, tourId: string, dto: any): Promise<any> {
    const { operator } = await this.access.require(user, "manageTours", { writable: true });
    const tour = await this.tours.findOne({ _id: tourId, operatorId: operator._id }).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    if (!TOUR_EDITABLE_STATUSES.includes(tour.status))
      throw new YatraException(
        tour.status === "pending_review"
          ? "This tour is waiting for Tirvona's review and cannot be edited now."
          : "A published or approved tour cannot be edited. Ask Tirvona to unpublish it first.",
        409,
        "TOUR_LOCKED",
      );
    this.validateTour(dto);
    if (dto.circuitTemplateId) {
      const circuit = await this.circuits.findOne({ _id: dto.circuitTemplateId, status: "approved" }).select("name").lean();
      if (!circuit) throw new YatraException("Circuit template not found.", 404);
      dto.circuitTemplateName = circuit.name;
    }
    const after = await this.tours.findOneAndUpdate(
      { _id: tour._id, status: { $in: TOUR_EDITABLE_STATUSES } },
      { $set: { ...this.tourFields(dto), status: "draft" } },
      { new: true },
    ).lean();
    if (!after) throw new YatraException("This tour changed while you were editing. Reload and try again.", 409);
    await this.audit.record(user, "tour.updated", { operatorId: String(operator._id), tourId, fields: Object.keys(this.tourFields(dto)) }, { before: { status: tour.status }, after: { status: "draft" } });
    return tourView(after);
  }

  async submitTour(user: YatraActor, tourId: string): Promise<any> {
    const { operator } = await this.access.require(user, "manageTours", { writable: true });
    const tour = await this.tours.findOne({ _id: tourId, operatorId: operator._id }).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    if (!["draft", "rejected", "unpublished"].includes(tour.status)) throw new YatraException("This tour is already submitted.", 409);
    const missing: string[] = [];
    if (!tour.summary && !tour.description) missing.push("a description");
    if (!Array.isArray(tour.itinerary) || tour.itinerary.length === 0) missing.push("at least one itinerary day");
    if (!tour.inclusions?.length) missing.push("what is included");
    if (missing.length) throw new YatraException(`Before submitting, add ${missing.join(", ")}.`, 400, "INCOMPLETE_TOUR");
    const after = await this.tours.findOneAndUpdate(
      { _id: tour._id, status: tour.status },
      { $set: { status: "pending_review", submittedAt: new Date(), reviewNote: "" } },
      { new: true },
    ).lean();
    await this.audit.record(user, "tour.submitted", { operatorId: String(operator._id), tourId }, { before: { status: tour.status }, after: { status: "pending_review" } });
    return tourView(after);
  }

  async adminTours(query: { status?: string; operatorId?: string; q?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.operatorId) filter.operatorId = query.operatorId;
    if (query.q) filter.title = { $regex: escapeRegex(query.q), $options: "i" };
    const [rows, total] = await Promise.all([
      this.tours.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.tours.countDocuments(filter),
    ]);
    const ops = await this.operators.find({ _id: { $in: [...new Set(rows.map((r: any) => String(r.operatorId)))] } }).select("organisationName status").lean();
    const byId = new Map(ops.map((o: any) => [String(o._id), o]));
    return {
      items: rows.map((r: any) => ({
        ...tourView(r),
        operatorName: byId.get(String(r.operatorId))?.organisationName ?? "",
        operatorStatus: byId.get(String(r.operatorId))?.status ?? "",
      })),
      total,
    };
  }

  async adminTour(tourId: string): Promise<any> {
    const tour = await this.tours.findById(tourId).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    const [operator, departures] = await Promise.all([
      this.operators.findById(tour.operatorId).select("organisationName status").lean(),
      this.departures.find({ tourId }).sort({ departAt: 1 }).limit(50).lean(),
    ]);
    return {
      tour: tourView(tour),
      operator: operator && { id: String(operator._id), organisationName: operator.organisationName, status: operator.status },
      departures: departures.map((d: any) => ({ id: String(d._id), departureCode: d.departureCode, departAt: d.departAt, status: d.status, capacity: d.capacity, bookedSeats: d.bookedSeats, fare: d.fare })),
    };
  }

  /**
   * Only Super Admin moves a tour through review and onto the public site.
   * Publishing also needs the organiser to be approved.
   */
  async adminReviewTour(admin: YatraActor, tourId: string, action: "approve" | "reject" | "publish" | "unpublish", note = ""): Promise<any> {
    const tour = await this.tours.findById(tourId).lean();
    if (!tour) throw new YatraException("Tour not found.", 404);
    const rules: Record<string, { from: string[]; to: string; needsNote?: boolean }> = {
      approve: { from: ["pending_review"], to: "approved" },
      reject: { from: ["pending_review", "approved"], to: "rejected", needsNote: true },
      publish: { from: ["approved", "unpublished", "pending_review"], to: "published" },
      unpublish: { from: ["published"], to: "unpublished", needsNote: true },
    };
    const rule = rules[action];
    if (!rule.from.includes(tour.status)) throw new YatraException(`A ${tour.status.replace(/_/g, " ")} tour cannot be ${action === "publish" ? "published" : `${action}ed`}.`, 409);
    if (rule.needsNote && note.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    if (action === "publish") {
      const operator = await this.operators.findById(tour.operatorId).select("status").lean();
      if (operator?.status !== "approved") throw new YatraException("Approve the organiser before publishing its tours.", 409, "OPERATOR_NOT_APPROVED");
    }
    const set: Record<string, unknown> = { status: rule.to, reviewNote: note.trim(), reviewedAt: new Date(), reviewedBy: admin.id };
    if (action === "publish") Object.assign(set, { publishedAt: new Date(), publishedBy: admin.id });
    const after = await this.tours.findOneAndUpdate({ _id: tourId, status: tour.status }, { $set: set }, { new: true }).lean();
    if (!after) throw new YatraException("This tour changed while you were reviewing. Reload and try again.", 409);
    await this.audit.record(admin, `tour.${action}`, { tourId, operatorId: String(tour.operatorId), note }, { before: { status: tour.status }, after: { status: rule.to } });
    await this.notifier.operatorTeam(String(tour.operatorId), "Tour review update", `"${tour.title}" is now ${rule.to.replace(/_/g, " ")}${note ? `: ${note}` : "."}`, "/operator/tours");
    return tourView(after);
  }
}
