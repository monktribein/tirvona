import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { TransactionService } from "../../../common/database/transaction.service";
import { canonicalPhone } from "../../../common/phone/phone.util";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import { WalletService } from "../../wallet/application/wallet.service";
import {
  DOCUMENT_MAX_BYTES,
  OPEN_RIDE_STATUSES,
  RIDE_PARTNER_DOCUMENT_TYPES,
  YATRA_MODEL,
} from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { cityKey, detectDocumentType, randomCode, roundMoney, toPaise } from "../domain/yatra.utils";
import { YatraFinanceService } from "./yatra-finance.service";
import {
  type YatraActor,
  YatraAuditService,
  YatraDocumentStorage,
  YatraGatewayService,
  YatraNotifier,
  YatraSettingsService,
} from "./yatra-support.service";

class UnusableRidePayment extends Error {}
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const partnerView = (p: any) =>
  p && {
    id: String(p._id),
    businessName: p.businessName,
    contactName: p.contactName ?? "",
    contactPhone: p.contactPhone ?? "",
    contactEmail: p.contactEmail ?? "",
    city: p.city ?? "",
    serviceAreas: p.serviceAreas ?? [],
    vehicles: Array.isArray(p.vehicles) ? p.vehicles : [],
    availability: {
      weekdays: p.availability?.weekdays ?? [],
      startTime: p.availability?.startTime ?? "06:00",
      endTime: p.availability?.endTime ?? "22:00",
      accepting: p.availability?.accepting !== false,
    },
    kyc: { panNumber: p.kyc?.panNumber ?? "", drivingLicenceNumber: p.kyc?.drivingLicenceNumber ?? "" },
    payout: {
      accountHolderName: p.payout?.accountHolderName ?? "",
      accountNumberLast4: p.payout?.accountNumberLast4 ?? "",
      ifsc: p.payout?.ifsc ?? "",
      bankName: p.payout?.bankName ?? "",
      upiId: p.payout?.upiId ?? "",
    },
    status: p.status,
    submittedAt: p.submittedAt ?? null,
    reviewNote: p.reviewNote ?? "",
    approvedAt: p.approvedAt ?? null,
    createdAt: p.createdAt,
  };

/** What a pilgrim sees about a ride. */
export const rideView = (r: any) =>
  r && {
    id: String(r._id),
    requestNumber: r.requestNumber,
    journeyId: String(r.journeyId),
    partnerId: r.partnerId ? String(r.partnerId) : null,
    partnerName: r.partnerName ?? "",
    city: r.city,
    rideType: r.rideType,
    pickup: { address: r.pickup?.address ?? "", landmark: r.pickup?.landmark ?? "" },
    drop: { address: r.drop?.address ?? "", landmark: r.drop?.landmark ?? "" },
    pickupAt: r.pickupAt,
    passengers: r.passengers,
    notes: r.notes ?? "",
    status: r.status,
    quotedAmount: r.quotedAmount ?? 0,
    partnerNote: r.partnerNote ?? "",
    // Vehicle and driver are shared once the ride is confirmed (paid).
    assignment: ["confirmed", "in_progress", "completed"].includes(r.status) ? r.assignment ?? null : null,
    paymentStatus: r.paymentStatus,
    confirmedAt: r.confirmedAt ?? null,
    startedAt: r.startedAt ?? null,
    completedAt: r.completedAt ?? null,
    cancelledAt: r.cancelledAt ?? null,
    cancelReason: r.cancelReason ?? "",
    refundAmount: r.refundAmount ?? 0,
    history: (r.history ?? []).map((h: any) => ({ status: h.status, note: h.note, at: h.at })),
    createdAt: r.createdAt,
  };

const documentView = (d: any) => ({
  id: String(d._id),
  documentType: d.documentType,
  documentNumber: d.documentNumber ?? "",
  expiresAt: d.expiresAt ?? null,
  mimeType: d.storage?.mimeType ?? "",
  status: d.status,
  reviewNote: d.reviewNote ?? "",
  createdAt: d.createdAt,
});

@Injectable()
export class YatraRideService {
  private readonly logger = new Logger(YatraRideService.name);

  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: YatraAuditService,
    private readonly notifier: YatraNotifier,
    private readonly storage: YatraDocumentStorage,
    private readonly crypto: BankAccountCrypto,
    private readonly gateway: YatraGatewayService,
    private readonly settings: YatraSettingsService,
    private readonly wallet: WalletService,
    private readonly finance: YatraFinanceService,
    @InjectModel(YATRA_MODEL.RidePartner) private readonly partners: Model<any>,
    @InjectModel(YATRA_MODEL.RideRequest) private readonly rides: Model<any>,
    @InjectModel(YATRA_MODEL.Document) private readonly documents: Model<any>,
    @InjectModel(YATRA_MODEL.Journey) private readonly journeys: Model<any>,
    @InjectModel(YATRA_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(YATRA_MODEL.Payment) private readonly payments: Model<any>,
    @InjectModel(YATRA_MODEL.Ledger) private readonly ledger: Model<any>,
    @InjectModel(YATRA_MODEL.Issue) private readonly issues: Model<any>,
    @InjectModel(YATRA_MODEL.UserRef) private readonly users: Model<any>,
  ) {}

  // ================================================================= partners
  private async myPartner(user: YatraActor): Promise<any> {
    const partner = await this.partners.findOne({ ownerUserId: user.id });
    if (!partner) throw new YatraException("You have not registered as a ride partner yet.", 404, "NOT_A_RIDE_PARTNER");
    return partner;
  }

  async partnerIdOf(user: YatraActor): Promise<string> {
    return String((await this.myPartner(user))._id);
  }

  async me(user: YatraActor): Promise<any> {
    const partner = await this.partners.findOne({ ownerUserId: user.id }).lean();
    if (!partner) return { registered: false };
    const [docs, open, active] = await Promise.all([
      this.documents.find({ ridePartnerId: partner._id }).select("documentType status").lean(),
      this.rides.countDocuments({ partnerId: partner._id, status: "partner_pending" }),
      this.rides.countDocuments({ partnerId: partner._id, status: { $in: ["confirmed", "in_progress"] } }),
    ]);
    return {
      registered: true,
      partner: partnerView(partner),
      checklist: {
        profileComplete: Boolean(partner.contactPhone && (partner.serviceAreas ?? []).length),
        vehicles: (partner.vehicles ?? []).length,
        panUploaded: docs.some((d: any) => d.documentType === "pan_card" && d.status !== "rejected"),
        licenceUploaded: docs.some((d: any) => d.documentType === "driving_licence" && d.status !== "rejected"),
        payoutDetails: Boolean(partner.payout?.accountNumberLast4 || partner.payout?.upiId),
        newRequests: open,
        activeRides: active,
      },
    };
  }

  async register(user: YatraActor, dto: any): Promise<any> {
    if (await this.partners.exists({ ownerUserId: user.id })) throw new YatraException("This account is already a ride partner.", 409);
    const account = await this.users.findById(user.id).lean();
    const areas = (dto.serviceAreas ?? [dto.city]).filter(Boolean);
    const partner = await this.partners.create({
      ownerUserId: user.id,
      businessName: dto.businessName,
      contactName: dto.contactName ?? account?.name ?? "",
      contactPhone: dto.contactPhone ? canonicalPhone(dto.contactPhone) : account?.phone ?? "",
      contactEmail: dto.contactEmail ?? account?.email ?? "",
      city: dto.city ?? "",
      serviceAreas: areas,
      serviceAreaKeys: areas.map(cityKey),
      status: "draft",
    });
    await this.audit.record(user, "ride_partner.registered", { partnerId: String(partner._id) });
    return this.me(user);
  }

  async updateProfile(user: YatraActor, dto: any): Promise<any> {
    const partner = await this.myPartner(user);
    if (partner.status === "suspended") throw new YatraException("Your partner account is suspended. Contact Tirvona support.", 403);
    const locked = ["submitted", "approved"].includes(partner.status);
    for (const key of ["contactName", "contactEmail", "city"]) if (dto[key] !== undefined) partner[key] = dto[key];
    if (dto.contactPhone !== undefined) partner.contactPhone = canonicalPhone(dto.contactPhone);
    if (dto.businessName !== undefined && dto.businessName !== partner.businessName) {
      if (locked) throw new YatraException("The business name cannot change after submission.", 400);
      partner.businessName = dto.businessName;
    }
    if (dto.serviceAreas !== undefined) {
      const areas = [...new Set((dto.serviceAreas as string[]).map((a) => a.trim()).filter(Boolean))].slice(0, 20);
      partner.serviceAreas = areas;
      partner.serviceAreaKeys = areas.map(cityKey);
    }
    if (dto.availability !== undefined) {
      const a = dto.availability;
      if (a.startTime && a.endTime && a.startTime >= a.endTime) throw new YatraException("The day must start before it ends.", 400);
      partner.availability = {
        weekdays: [...new Set<number>(((a.weekdays ?? partner.availability?.weekdays ?? []) as unknown[]).map(Number))].filter((d) => d >= 0 && d <= 6),
        startTime: a.startTime ?? partner.availability?.startTime ?? "06:00",
        endTime: a.endTime ?? partner.availability?.endTime ?? "22:00",
        accepting: a.accepting ?? partner.availability?.accepting ?? true,
      };
    }
    for (const key of ["panNumber", "drivingLicenceNumber"]) {
      if (dto[key] === undefined || dto[key] === (partner.kyc?.[key] ?? "")) continue;
      if (locked) throw new YatraException("KYC numbers cannot change after submission.", 400);
      partner.set(`kyc.${key}`, dto[key]);
    }
    await partner.save();
    await this.audit.record(user, "ride_partner.profile_updated", { partnerId: String(partner._id), fields: Object.keys(dto) });
    return this.me(user);
  }

  async setVehicles(user: YatraActor, vehicles: any[]): Promise<any> {
    const partner = await this.myPartner(user);
    const seen = new Set<string>();
    const clean = vehicles.map((v, i) => {
      const reg = String(v.registrationNumber ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (reg.length < 6) throw new YatraException(`Vehicle ${i + 1}: enter the full registration number.`, 400);
      if (seen.has(reg)) throw new YatraException(`Vehicle ${reg} is listed twice.`, 400);
      seen.add(reg);
      return { id: v.id || `rv${randomCode(6).toLowerCase()}`, registrationNumber: reg, vehicleType: v.vehicleType, seats: Number(v.seats), isAc: Boolean(v.isAc) };
    });
    partner.vehicles = clean;
    partner.markModified?.("vehicles");
    await partner.save();
    await this.audit.record(user, "ride_partner.vehicles_updated", { partnerId: String(partner._id), count: clean.length });
    return this.me(user);
  }

  async setPayout(user: YatraActor, dto: any): Promise<any> {
    const partner = await this.myPartner(user);
    if (!dto.accountNumber && !partner.payout?.accountNumberLast4 && !dto.upiId) throw new YatraException("Add a bank account number or a UPI id.", 400);
    partner.set("payout.accountHolderName", dto.accountHolderName ?? "");
    partner.set("payout.ifsc", dto.ifsc ?? "");
    partner.set("payout.bankName", dto.bankName ?? "");
    partner.set("payout.upiId", dto.upiId ?? "");
    partner.set("payout.updatedAt", new Date());
    if (dto.accountNumber) {
      partner.set("payout.accountNumberEncrypted", this.crypto.encrypt(String(dto.accountNumber)));
      partner.set("payout.accountNumberLast4", String(dto.accountNumber).slice(-4));
    }
    await partner.save();
    await this.audit.record(user, "ride_partner.payout_details_updated", { partnerId: String(partner._id) });
    return this.me(user);
  }

  async submit(user: YatraActor, acceptTerms: boolean): Promise<any> {
    const partner = await this.myPartner(user);
    if (!["draft", "rejected"].includes(partner.status)) throw new YatraException("Already submitted.", 409);
    if (!acceptTerms) throw new YatraException("Please accept the Tirvona ride partner terms.", 400);
    const docs = await this.documents.find({ ridePartnerId: partner._id, status: { $ne: "rejected" } }).select("documentType").lean();
    const types = new Set(docs.map((d: any) => d.documentType));
    const missing: string[] = [];
    if (!partner.contactPhone) missing.push("contact phone");
    if (!(partner.serviceAreas ?? []).length) missing.push("service areas");
    if (!(partner.vehicles ?? []).length) missing.push("at least one vehicle");
    if (!types.has("pan_card")) missing.push("PAN card");
    if (!types.has("driving_licence")) missing.push("driving licence");
    if (!types.has("registration_certificate")) missing.push("vehicle RC");
    if (!types.has("insurance")) missing.push("vehicle insurance");
    if (missing.length) throw new YatraException(`Before submitting, add: ${missing.join(", ")}.`, 400, "INCOMPLETE_PROFILE");
    partner.status = "submitted";
    partner.submittedAt = new Date();
    partner.termsAcceptedAt = new Date();
    partner.reviewNote = "";
    await partner.save();
    await this.audit.record(user, "ride_partner.submitted", { partnerId: String(partner._id) });
    return this.me(user);
  }

  async uploadDocument(user: YatraActor, file: Express.Multer.File | undefined, dto: any): Promise<any> {
    const partner = await this.myPartner(user);
    if (!(RIDE_PARTNER_DOCUMENT_TYPES as readonly string[]).includes(dto.documentType)) throw new YatraException("That document type does not apply to a ride partner.", 400);
    if (!file?.buffer?.length) throw new YatraException('Attach the document as the "file" field.', 400);
    if (file.buffer.length > DOCUMENT_MAX_BYTES) throw new YatraException("Documents can be at most 10 MB.", 400);
    const detected = detectDocumentType(file.buffer);
    if (!detected) throw new YatraException("Upload a JPG, PNG, WEBP or PDF file.", 400, "UNSUPPORTED_FILE");
    const stored = await this.storage.put(file.buffer, `yatra-ride-kyc/${String(partner._id)}`, detected.resourceType);
    const doc = await this.documents.create({
      ridePartnerId: partner._id,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber ?? "",
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      storage: { ...stored, format: stored.format || detected.ext, mimeType: detected.mime },
      originalName: String(file.originalname ?? "").slice(0, 120),
      status: "pending",
      uploadedBy: user.id,
    });
    await this.audit.record(user, "ride_partner.document_uploaded", { partnerId: String(partner._id), documentId: String(doc._id), documentType: dto.documentType });
    return documentView(doc);
  }

  async listDocuments(user: YatraActor): Promise<any[]> {
    const partner = await this.myPartner(user);
    const rows = await this.documents.find({ ridePartnerId: partner._id }).sort({ createdAt: -1 }).lean();
    return rows.map(documentView);
  }

  async documentLink(user: YatraActor, documentId: string): Promise<any> {
    const partner = await this.myPartner(user);
    const doc = await this.documents.findOne({ _id: documentId, ridePartnerId: partner._id }).lean();
    if (!doc) throw new YatraException("Document not found.", 404);
    await this.audit.record(user, "document.viewed", { documentId, ridePartnerId: String(partner._id) });
    return this.storage.signedUrl(doc.storage);
  }

  async deleteDocument(user: YatraActor, documentId: string): Promise<any> {
    const partner = await this.myPartner(user);
    const doc = await this.documents.findOne({ _id: documentId, ridePartnerId: partner._id }).lean();
    if (!doc) throw new YatraException("Document not found.", 404);
    if (doc.status === "approved") throw new YatraException("An approved document cannot be deleted.", 400);
    await this.documents.deleteOne({ _id: doc._id });
    await this.storage.remove(doc.storage);
    return { deleted: true };
  }

  // ---------------------------------------------------------- admin: partners
  async adminPartners(query: { status?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.partners.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.partners.countDocuments(filter),
    ]);
    return { items: rows.map(partnerView), total };
  }

  async adminPartner(partnerId: string): Promise<any> {
    const partner = await this.partners.findById(partnerId).lean();
    if (!partner) throw new YatraException("Ride partner not found.", 404);
    const [docs, rides] = await Promise.all([
      this.documents.find({ ridePartnerId: partner._id }).sort({ createdAt: -1 }).lean(),
      this.rides.find({ partnerId: partner._id }).sort({ pickupAt: -1 }).limit(30).lean(),
    ]);
    return { partner: partnerView(partner), documents: docs.map(documentView), rides: rides.map(rideView), balance: await this.finance.summary("ride_partner", partnerId) };
  }

  async adminPartnerDocumentLink(actor: YatraActor, documentId: string): Promise<any> {
    const doc = await this.documents.findOne({ _id: documentId, ridePartnerId: { $ne: null } }).lean();
    if (!doc) throw new YatraException("Document not found.", 404);
    await this.audit.record(actor, "document.viewed", { documentId, asAdmin: true });
    return this.storage.signedUrl(doc.storage);
  }

  async adminReviewPartner(actor: YatraActor, partnerId: string, action: string, note = ""): Promise<any> {
    const rules: Record<string, { from: string[]; to: string; needsNote?: boolean }> = {
      approve: { from: ["submitted"], to: "approved" },
      reject: { from: ["submitted"], to: "rejected", needsNote: true },
      suspend: { from: ["approved"], to: "suspended", needsNote: true },
      reinstate: { from: ["suspended"], to: "approved" },
    };
    const rule = rules[action];
    if (!rule) throw new YatraException("Unknown review action.", 400);
    if (rule.needsNote && note.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    const partner = await this.partners.findById(partnerId).lean();
    if (!partner) throw new YatraException("Ride partner not found.", 404);
    if (!rule.from.includes(partner.status)) throw new YatraException(`A ${partner.status} partner cannot be moved to ${rule.to}.`, 409);
    const set: Record<string, unknown> = { status: rule.to, reviewedAt: new Date(), reviewedBy: actor.id, reviewNote: note.trim() };
    if (rule.to === "approved" && !partner.approvedAt) set.approvedAt = new Date();
    const after = await this.partners.findOneAndUpdate({ _id: partnerId, status: partner.status }, { $set: set }, { new: true }).lean();
    if (!after) throw new YatraException("This partner changed while you were reviewing. Reload and try again.", 409);
    await this.audit.record(actor, `ride_partner.${action}`, { partnerId, note }, { before: { status: partner.status }, after: { status: rule.to } });
    await this.notifier.users([String(partner.ownerUserId)], "Ride partner update", `Your ride partner account is now ${rule.to}${note ? `: ${note}` : "."}`, "/ride-partner/dashboard", "yatra.partner");
    return partnerView(after);
  }

  /** Approved, accepting partners that serve a city (for pilgrims and Ops to choose from). */
  async availablePartners(city: string): Promise<any[]> {
    const key = cityKey(city);
    const rows = await this.partners.find({ status: "approved" }).limit(500).lean();
    return rows
      .filter((p: any) => p.availability?.accepting !== false && (p.serviceAreaKeys ?? []).includes(key))
      .map((p: any) => ({ id: String(p._id), name: p.businessName, vehicleTypes: [...new Set((p.vehicles ?? []).map((v: any) => v.vehicleType))], maxSeats: Math.max(0, ...(p.vehicles ?? []).map((v: any) => Number(v.seats) || 0)) }));
  }

  private async assignablePartner(partnerId: string, city: string): Promise<any> {
    const partner = await this.partners.findById(partnerId).lean();
    if (!partner || partner.status !== "approved") throw new YatraException("Only a Tirvona-approved ride partner can receive ride requests.", 409, "PARTNER_NOT_APPROVED");
    if (partner.availability?.accepting === false) throw new YatraException("This partner is not taking requests right now.", 409);
    if (!(partner.serviceAreaKeys ?? []).includes(cityKey(city))) throw new YatraException(`This partner does not serve ${city}.`, 409);
    return partner;
  }

  private async notifyAdmins(title: string, body: string): Promise<void> {
    const admins = await this.users.find({ role: "super_admin", status: "active" }).select("_id").limit(20).lean();
    await this.notifier.users(admins.map((a: any) => String(a._id)), title, body, "/admin/yatra/rides", "yatra.admin");
  }

  // ============================================================= pilgrim side
  private async ownJourney(user: YatraActor, journeyId: string): Promise<{ journey: any; booking: any }> {
    const journey = await this.journeys.findOne({ _id: journeyId, customerId: user.id }).lean();
    if (!journey) throw new YatraException("Journey not found.", 404);
    return { journey, booking: await this.bookings.findById(journey.bookingId).lean() };
  }

  async requestRide(user: YatraActor, journeyId: string, dto: any): Promise<any> {
    const { journey, booking } = await this.ownJourney(user, journeyId);
    if (!booking || !["confirmed", "cancellation_requested"].includes(booking.status)) throw new YatraException("Rides can be requested only for a confirmed journey.", 409);
    const pickupAt = new Date(dto.pickupAt);
    if (Number.isNaN(pickupAt.getTime()) || pickupAt.getTime() < Date.now() + 30 * 60_000) throw new YatraException("Choose a pickup time at least 30 minutes from now.", 400);
    if (pickupAt.getTime() < new Date(journey.startDate).getTime() - DAY || pickupAt.getTime() > new Date(journey.endDate).getTime() + DAY)
      throw new YatraException("Choose a pickup time within your journey.", 400, "DATE_OUTSIDE_JOURNEY");
    const city = journey.destinationCity;
    let partner: any = null;
    if (dto.partnerId) partner = await this.assignablePartner(dto.partnerId, city);
    const snapshot = await this.finance.snapshotFor("ride", { ridePartnerId: partner?._id });
    const ride = await this.rides.create({
      requestNumber: `YRD-${randomCode(8)}`,
      journeyId: journey._id,
      bookingId: booking._id,
      customerId: user.id,
      operatorId: journey.operatorId,
      partnerId: partner?._id ?? null,
      partnerName: partner?.businessName ?? "",
      partnerAssignedAt: partner ? new Date() : null,
      city,
      cityKey: cityKey(city),
      rideType: dto.rideType ?? "any",
      pickup: { address: dto.pickupAddress, landmark: dto.pickupLandmark ?? "" },
      drop: { address: dto.dropAddress, landmark: dto.dropLandmark ?? "" },
      pickupAt,
      passengers: dto.passengers,
      notes: dto.notes ?? "",
      status: partner ? "partner_pending" : "requested",
      commissionSnapshot: snapshot,
      history: [{ status: partner ? "partner_pending" : "requested", note: "Requested by pilgrim", by: user.id }],
    });
    await this.audit.record(user, "ride.requested", { rideId: String(ride._id), journeyId, partnerId: partner ? String(partner._id) : null });
    if (partner) await this.notifier.users([String(partner.ownerUserId)], "New ride request", `${ride.requestNumber}: ${dto.pickupAddress} → ${dto.dropAddress}.`, "/ride-partner/requests", "yatra.partner");
    else await this.notifyAdmins("Ride request needs a partner", `${ride.requestNumber} in ${city}.`);
    return rideView(ride.toObject());
  }

  async journeyRides(user: YatraActor, journeyId: string): Promise<any[]> {
    await this.ownJourney(user, journeyId);
    const rows = await this.rides.find({ journeyId, customerId: user.id }).sort({ pickupAt: 1 }).lean();
    return rows.map(rideView);
  }

  private refundRide = async (session: any, ride: any, amount: number, actor: YatraActor, reason: string) => {
    if (amount <= 0) return;
    await this.wallet.credit(
      {
        userId: String(ride.customerId),
        amount,
        module: "yatra",
        category: "refund",
        sourceId: ride._id,
        reference: ride.requestNumber,
        description: `Refund for Yatra ride ${ride.requestNumber}: ${reason}`,
        idempotencyKey: `refund:yatra:ride:${String(ride._id)}`,
        actorId: actor.id,
        actorRole: actor.role,
      },
      session,
    );
    await this.ledger.create(
      [
        {
          type: "ride_refund",
          direction: "debit",
          amount,
          rideRequestId: ride._id,
          ridePartnerId: ride.partnerId,
          customerId: ride.customerId,
          reference: ride.requestNumber,
          description: reason,
          idempotencyKey: `yatra:ride-refund:${String(ride._id)}`,
          recordedBy: actor.id,
        },
      ],
      { session },
    );
  };

  /**
   * The pilgrim cancels. Before payment nothing moves; a paid ride cancelled
   * early enough (setting rideFullRefundHours) is refunded in full to the wallet.
   */
  async customerCancel(user: YatraActor, rideId: string, reason: string): Promise<any> {
    const settings = await this.settings.get();
    const result = await this.transactions.run(async (session) => {
      const ride = await this.rides.findOne({ _id: rideId, customerId: user.id }).session(session);
      if (!ride) throw new YatraException("Ride not found.", 404);
      if (!["requested", "partner_pending", "accepted", "confirmed"].includes(ride.status)) throw new YatraException("This ride can no longer be cancelled. Report an issue instead.", 409);
      let refund = 0;
      if (ride.status === "confirmed") refund = new Date(ride.pickupAt).getTime() - Date.now() >= settings.rideFullRefundHours * HOUR ? ride.quotedAmount : 0;
      ride.status = "cancelled";
      ride.cancelledAt = new Date();
      ride.cancelledBy = user.id;
      ride.cancelledByRole = "customer";
      ride.cancelReason = reason.trim();
      ride.refundAmount = refund;
      if (refund) ride.paymentStatus = "refunded";
      ride.history.push({ status: "cancelled", note: `Cancelled by pilgrim${refund ? `; ₹${refund} to wallet` : ""}`, by: user.id });
      await ride.save({ session });
      await this.refundRide(session, ride, refund, user, "cancelled by pilgrim");
      await this.payments.updateMany({ rideRequestId: ride._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Ride cancelled" } }, { session });
      return ride;
    });
    if (result.partnerId) await this.notifyPartner(result, `${result.requestNumber} was cancelled by the pilgrim.`);
    return rideView(result.toObject());
  }

  async rideOrder(user: YatraActor, rideId: string): Promise<any> {
    const ride = await this.rides.findOne({ _id: rideId, customerId: user.id }).lean();
    if (!ride) throw new YatraException("Ride not found.", 404);
    if (ride.status !== "accepted") throw new YatraException("You can pay once the partner has accepted the ride.", 409, "NOT_PAYABLE");
    const amount = roundMoney(ride.quotedAmount);
    const order = await this.gateway.createOrder(amount, ride.requestNumber, { module: "yatra", rideRequestId: String(ride._id) });
    await this.transactions.run(async (session) => {
      await this.payments.updateMany({ rideRequestId: ride._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Superseded by a newer payment attempt" } }, { session });
      await this.payments.create(
        [{ purpose: "ride_request", rideRequestId: ride._id, bookingId: ride.bookingId, operatorId: ride.operatorId, userId: user.id, amount, method: order.demo ? "demo" : "razorpay", channel: "checkout", status: "pending", gateway: { orderId: order.orderId, provider: order.demo ? "demo" : "razorpay" } }],
        { session },
      );
    });
    return { demo: order.demo, orderId: order.orderId, amount: order.amount, currency: order.currency, keyId: order.keyId, name: "Tirvona Yatra", description: `Ride ${ride.requestNumber}` };
  }

  async rideConfirm(user: YatraActor, rideId: string, dto: any): Promise<any> {
    const ride = await this.rides.findOne({ _id: rideId, customerId: user.id }).lean();
    if (!ride) throw new YatraException("Ride not found.", 404);
    if (!this.gateway.verifySignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature ?? "")) throw new YatraException("Payment verification failed.", 400, "SIGNATURE_INVALID");
    const payment = await this.payments.findOne({ rideRequestId: ride._id, "gateway.orderId": dto.razorpay_order_id }).lean();
    if (!payment) throw new YatraException("This payment does not belong to this ride.", 400, "ORDER_MISMATCH");
    const outcome = await this.settle(payment._id, { paymentId: dto.razorpay_payment_id, signature: dto.razorpay_signature ?? "", via: "checkout" });
    if (outcome === "refunded") throw new YatraException("Your payment was received but this ride could no longer be confirmed. The amount was added to your Tirvona wallet.", 409, "PAYMENT_REFUNDED_TO_WALLET");
    return rideView(await this.rides.findById(ride._id).lean());
  }

  async confirmFromWebhook(orderId: string, paymentId: string, captured?: { amountPaise?: number }): Promise<boolean> {
    const payment = await this.payments.findOne({ "gateway.orderId": orderId, purpose: "ride_request" }).lean();
    if (!payment) return false;
    await this.settle(payment._id, { paymentId, via: "webhook", capturedPaise: captured?.amountPaise });
    return true;
  }

  private async settle(paymentRowId: unknown, proof: { paymentId: string; signature?: string; via: string; capturedPaise?: number }): Promise<"confirmed" | "already" | "refunded"> {
    try {
      const outcome = await this.transactions.run(async (session) => {
        const payment = await this.payments.findById(paymentRowId).session(session);
        if (payment.status === "paid") {
          if (payment.gateway?.paymentId === proof.paymentId) return "already" as const;
          throw new UnusableRidePayment("A second payment arrived for a paid ride.");
        }
        if (await this.payments.exists({ "gateway.paymentId": proof.paymentId, _id: { $ne: payment._id } }).session(session)) return "already" as const;
        const ride = await this.rides.findById(payment.rideRequestId).session(session);
        if (!ride || ride.status !== "accepted") throw new UnusableRidePayment("The ride is no longer waiting for payment.");
        if (proof.capturedPaise !== undefined && proof.capturedPaise !== toPaise(payment.amount)) throw new UnusableRidePayment("The captured amount does not match.");
        if (roundMoney(payment.amount) !== roundMoney(ride.quotedAmount)) throw new UnusableRidePayment("The amount does not match the fare.");
        const now = new Date();
        payment.status = "paid";
        payment.paidAt = now;
        payment.confirmedBy = proof.via;
        payment.set("gateway.paymentId", proof.paymentId);
        payment.set("gateway.signature", proof.signature ?? "");
        await payment.save({ session });
        ride.status = "confirmed";
        ride.paymentStatus = "paid";
        ride.paidAt = now;
        ride.confirmedAt = now;
        ride.history.push({ status: "confirmed", note: `Payment verified (${proof.via})`, by: payment.userId });
        await ride.save({ session });
        await this.ledger.create(
          [{ type: "ride_payment", direction: "credit", amount: payment.amount, rideRequestId: ride._id, ridePartnerId: ride.partnerId, paymentId: payment._id, customerId: payment.userId, reference: ride.requestNumber, description: `Yatra ride ${ride.requestNumber}`, idempotencyKey: `yatra:payment:${proof.paymentId}` }],
          { session },
        );
        return "confirmed" as const;
      });
      if (outcome === "confirmed") {
        const paid = await this.payments.findById(paymentRowId).lean();
        const ride = await this.rides.findById(paid.rideRequestId).lean();
        await this.notifyPartner(ride, `${ride.requestNumber} is paid and confirmed. Pickup ${new Date(ride.pickupAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`);
        await this.notifier.users([String(ride.customerId)], "Ride confirmed", `${ride.requestNumber} with ${ride.partnerName} is confirmed.`, `/profile/journeys/${String(ride.journeyId)}`, "yatra.booking");
      }
      return outcome;
    } catch (error) {
      if (!(error instanceof UnusableRidePayment)) throw error;
      return this.refundUnusable(paymentRowId, proof, error.message);
    }
  }

  private async refundUnusable(paymentRowId: unknown, proof: { paymentId: string; signature?: string; via: string }, reason: string): Promise<"refunded" | "already"> {
    try {
      return await this.transactions.run(async (session) => {
        const payment = await this.payments.findById(paymentRowId).session(session);
        if (await this.ledger.exists({ idempotencyKey: `yatra:unapplied:${proof.paymentId}` }).session(session)) return "already" as const;
        if (payment.status !== "paid") {
          payment.status = "paid";
          payment.unapplied = true;
          payment.paidAt = new Date();
          payment.confirmedBy = proof.via;
          payment.failureReason = `UNAPPLIED_PAYMENT: ${reason}`;
          payment.set("gateway.paymentId", proof.paymentId);
          payment.set("gateway.signature", proof.signature ?? "");
          await payment.save({ session });
        }
        await this.wallet.credit(
          { userId: String(payment.userId), amount: payment.amount, module: "yatra", category: "refund", sourceId: payment.rideRequestId, description: `Yatra ride payment returned: ${reason}`, idempotencyKey: `refund:yatra:unapplied:${proof.paymentId}`, actorRole: "system" },
          session,
        );
        const common = { rideRequestId: payment.rideRequestId, paymentId: payment._id, customerId: payment.userId };
        await this.ledger.create(
          [
            { ...common, type: "unapplied_payment", direction: "credit", amount: payment.amount, description: reason, idempotencyKey: `yatra:unapplied:${proof.paymentId}` },
            { ...common, type: "unapplied_refund", direction: "debit", amount: payment.amount, description: "Returned to wallet", idempotencyKey: `yatra:unapplied-refund:${proof.paymentId}` },
          ],
          { session, ordered: true },
        );
        return "refunded" as const;
      });
    } catch (error: any) {
      if (error?.code === 11000) return "already";
      throw error;
    }
  }

  async reportIssue(user: YatraActor, rideId: string, dto: any, role = "customer"): Promise<any> {
    const ride = role === "partner"
      ? await this.rides.findOne({ _id: rideId, partnerId: (await this.myPartner(user))._id }).lean()
      : await this.rides.findOne({ _id: rideId, customerId: user.id }).lean();
    if (!ride) throw new YatraException("Ride not found.", 404);
    const issue = await this.issues.create({
      issueNumber: `YIS-${randomCode(8)}`,
      city: ride.city,
      cityKey: ride.cityKey,
      category: dto.category ?? "ride",
      severity: dto.severity ?? "medium",
      subjectType: "ride",
      subjectId: ride._id,
      journeyId: ride.journeyId,
      title: dto.title ?? `Ride ${ride.requestNumber}`,
      description: dto.description,
      reportedBy: user.id,
      reportedByRole: role,
      history: [{ status: "open", note: "Reported", by: user.id }],
    });
    await this.audit.record(user, "issue.reported", { issueId: String(issue._id), rideId, role });
    await this.notifyAdmins("Ride issue reported", `${issue.issueNumber} on ${ride.requestNumber}.`);
    return { id: String(issue._id), issueNumber: issue.issueNumber, status: issue.status };
  }

  /** A pilgrim reports a problem with the journey (not tied to one ride). */
  async reportJourneyIssue(user: YatraActor, journeyId: string, dto: any): Promise<any> {
    const { journey, booking } = await this.ownJourney(user, journeyId);
    const issue = await this.issues.create({
      issueNumber: `YIS-${randomCode(8)}`,
      city: journey.destinationCity,
      cityKey: cityKey(journey.destinationCity),
      category: dto.category ?? "booking",
      severity: dto.severity ?? "medium",
      subjectType: "booking",
      subjectId: booking?._id ?? null,
      journeyId: journey._id,
      title: dto.title ?? `Journey ${journey.journeyNumber}`,
      description: dto.description,
      reportedBy: user.id,
      reportedByRole: "customer",
      history: [{ status: "open", note: "Reported by pilgrim", by: user.id }],
    });
    await this.audit.record(user, "issue.reported", { issueId: String(issue._id), journeyId });
    await this.notifyAdmins("Journey issue reported", `${issue.issueNumber}: ${issue.title}`);
    return { id: String(issue._id), issueNumber: issue.issueNumber, status: issue.status };
  }

  async rideCity(rideId: string): Promise<string> {
    const ride = await this.rides.findById(rideId).select("city").lean();
    if (!ride) throw new YatraException("Ride not found.", 404);
    return ride.city;
  }

  // ============================================================= partner side
  /** Ride partners see the pilgrim's name and phone only once the ride is paid. */
  private partnerRideView(r: any, people: Map<string, any>) {
    const base = rideView(r);
    const confirmed = ["confirmed", "in_progress", "completed"].includes(r.status);
    const c = people.get(String(r.customerId));
    return { ...base, assignment: r.assignment ?? null, customer: confirmed && c ? { name: c.name ?? "", phone: c.phone ?? "" } : null };
  }

  async partnerRequests(user: YatraActor, tab?: string): Promise<any[]> {
    const partner = await this.myPartner(user);
    const groups: Record<string, string[]> = {
      new: ["partner_pending"],
      accepted: ["accepted"],
      active: ["confirmed", "in_progress"],
      completed: ["completed"],
      rejected: ["rejected"],
      cancelled: ["cancelled"],
    };
    const filter: Record<string, unknown> = { partnerId: partner._id };
    if (tab && groups[tab]) filter.status = { $in: groups[tab] };
    const rows = await this.rides.find(filter).sort({ pickupAt: tab === "completed" ? -1 : 1 }).limit(200).lean();
    const ids = [...new Set(rows.filter((r: any) => ["confirmed", "in_progress", "completed"].includes(r.status)).map((r: any) => String(r.customerId)))];
    const people = new Map((ids.length ? await this.users.find({ _id: { $in: ids } }).select("name phone").lean() : []).map((p: any) => [String(p._id), p]));
    return rows.map((r: any) => this.partnerRideView(r, people));
  }

  private async partnerRide(user: YatraActor, rideId: string): Promise<any> {
    const partner = await this.myPartner(user);
    const ride = await this.rides.findOne({ _id: rideId, partnerId: partner._id });
    if (!ride) throw new YatraException("Ride not found.", 404);
    return { partner, ride };
  }

  async partnerAccept(user: YatraActor, rideId: string, dto: any): Promise<any> {
    const { partner, ride } = await this.partnerRide(user, rideId);
    if (partner.status !== "approved") throw new YatraException("Your partner account is not approved.", 403);
    if (ride.status !== "partner_pending") throw new YatraException("This request is not waiting for your answer.", 409);
    const fare = roundMoney(dto.fare);
    if (!(fare >= 1 && fare <= 200_000)) throw new YatraException("Enter the fare (₹1 to ₹2,00,000).", 400);
    const vehicle = (partner.vehicles ?? []).find((v: any) => v.id === dto.vehicleId) ?? null;
    if (!vehicle) throw new YatraException("Choose one of your registered vehicles.", 400);
    if (Number(vehicle.seats) < Number(ride.passengers)) throw new YatraException(`That vehicle seats ${vehicle.seats}; this ride needs ${ride.passengers}.`, 400);
    ride.status = "accepted";
    ride.quotedAmount = fare;
    ride.quotedAt = new Date();
    ride.quotedBy = user.id;
    ride.partnerNote = dto.note ?? "";
    ride.assignment = { vehicleRegistration: vehicle.registrationNumber, vehicleType: vehicle.vehicleType, driverName: dto.driverName ?? "", driverPhone: dto.driverPhone ? canonicalPhone(dto.driverPhone) : "" };
    ride.history.push({ status: "accepted", note: `Accepted at ₹${fare}`, by: user.id });
    await ride.save();
    await this.audit.record(user, "ride.accepted", { rideId, fare });
    await this.notifier.users([String(ride.customerId)], "Ride accepted", `${ride.requestNumber}: pay ₹${fare} to confirm it.`, `/profile/journeys/${String(ride.journeyId)}`, "yatra.booking");
    return rideView(ride.toObject());
  }

  async partnerReject(user: YatraActor, rideId: string, note: string): Promise<any> {
    const { ride } = await this.partnerRide(user, rideId);
    if (ride.status !== "partner_pending") throw new YatraException("This request is not waiting for your answer.", 409);
    ride.status = "rejected";
    ride.partnerNote = note.trim();
    ride.history.push({ status: "rejected", note: `Partner declined: ${note.trim()}`, by: user.id });
    await ride.save();
    await this.audit.record(user, "ride.rejected", { rideId, note });
    await this.notifier.users([String(ride.customerId)], "Ride declined", `${ride.requestNumber}: the partner could not take it. Tirvona will help you find another.`, `/profile/journeys/${String(ride.journeyId)}`, "yatra.booking");
    await this.notifyAdmins("Ride declined by partner", `${ride.requestNumber} needs another partner.`);
    return rideView(ride.toObject());
  }

  async partnerStart(user: YatraActor, rideId: string): Promise<any> {
    const { ride } = await this.partnerRide(user, rideId);
    if (ride.status !== "confirmed") throw new YatraException("Only a confirmed (paid) ride can start.", 409);
    if (new Date(ride.pickupAt).getTime() - Date.now() > 2 * HOUR) throw new YatraException("A ride can start at most 2 hours before pickup.", 409);
    ride.status = "in_progress";
    ride.startedAt = new Date();
    ride.history.push({ status: "in_progress", note: "Ride started", by: user.id });
    await ride.save();
    await this.notifier.users([String(ride.customerId)], "Ride started", `${ride.requestNumber} has started.`, `/profile/journeys/${String(ride.journeyId)}`, "yatra.booking");
    return rideView(ride.toObject());
  }

  /** Completing a ride posts the partner's earning to the payee ledger. */
  async partnerComplete(user: YatraActor, rideId: string): Promise<any> {
    const { ride } = await this.partnerRide(user, rideId);
    if (ride.status !== "in_progress") throw new YatraException("Only a ride in progress can be completed.", 409);
    const done = await this.transactions.run(async (session) => {
      const row = await this.rides.findOne({ _id: ride._id, status: "in_progress" }).session(session);
      if (!row) throw new YatraException("Only a ride in progress can be completed.", 409);
      row.status = "completed";
      row.completedAt = new Date();
      row.history.push({ status: "completed", note: "Ride completed", by: user.id });
      await row.save({ session });
      await this.finance.postRideEarning(session, row);
      return row;
    });
    await this.audit.record(user, "ride.completed", { rideId });
    await this.notifier.users([String(done.customerId)], "Ride completed", `${done.requestNumber} is complete. Have a blessed yatra.`, `/profile/journeys/${String(done.journeyId)}`, "yatra.booking");
    return rideView(done.toObject());
  }

  /** A partner who cannot do a paid ride: the pilgrim gets a full refund and Ops gets an issue. */
  async partnerCancel(user: YatraActor, rideId: string, reason: string): Promise<any> {
    const { ride } = await this.partnerRide(user, rideId);
    if (!["accepted", "confirmed"].includes(ride.status)) throw new YatraException("Only an accepted or confirmed ride can be cancelled by the partner.", 409);
    const done = await this.cancelWithRefund(user, String(ride._id), reason, "partner", 100);
    await this.issues.create({ issueNumber: `YIS-${randomCode(8)}`, city: ride.city, cityKey: ride.cityKey, category: "ride", severity: "high", subjectType: "ride", subjectId: ride._id, journeyId: ride.journeyId, title: `Partner cancelled ${ride.requestNumber}`, description: reason, reportedBy: user.id, reportedByRole: "partner", history: [{ status: "open", note: "Partner cancelled a ride", by: user.id }] });
    await this.notifyAdmins("Partner cancelled a ride", `${ride.requestNumber}: ${reason}`);
    return done;
  }

  private async cancelWithRefund(actor: YatraActor, rideId: string, reason: string, role: string, refundPercent: number): Promise<any> {
    const result = await this.transactions.run(async (session) => {
      const ride = await this.rides.findById(rideId).session(session);
      if (!ride) throw new YatraException("Ride not found.", 404);
      if (["completed", "cancelled", "in_progress"].includes(ride.status)) throw new YatraException(`A ${ride.status.replace("_", " ")} ride cannot be cancelled here.`, 409);
      const refund = ride.paymentStatus === "paid" ? roundMoney((ride.quotedAmount * Math.min(100, Math.max(0, refundPercent))) / 100) : 0;
      ride.status = "cancelled";
      ride.cancelledAt = new Date();
      ride.cancelledBy = actor.id;
      ride.cancelledByRole = role;
      ride.cancelReason = reason.trim();
      ride.refundAmount = refund;
      if (refund) ride.paymentStatus = refund >= ride.quotedAmount ? "refunded" : "partially_refunded";
      ride.history.push({ status: "cancelled", note: `Cancelled by ${role}: ${reason.trim()}${refund ? `; ₹${refund} to wallet` : ""}`, by: actor.id });
      await ride.save({ session });
      await this.refundRide(session, ride, refund, actor, `cancelled by ${role}`);
      await this.payments.updateMany({ rideRequestId: ride._id, status: "pending" }, { $set: { status: "superseded", failureReason: "Ride cancelled" } }, { session });
      await this.audit.record(actor, "ride.cancelled", { rideId, role, refund, reason }, {}, session);
      return ride;
    });
    await this.notifier.users([String(result.customerId)], "Ride cancelled", `${result.requestNumber} was cancelled.${result.refundAmount ? ` ₹${result.refundAmount} was added to your Tirvona wallet.` : ""}`, `/profile/journeys/${String(result.journeyId)}`, "yatra.booking");
    return rideView(result.toObject());
  }

  private async notifyPartner(ride: any, message: string): Promise<void> {
    if (!ride?.partnerId) return;
    const partner = await this.partners.findById(ride.partnerId).select("ownerUserId").lean();
    await this.notifier.users([partner?.ownerUserId ? String(partner.ownerUserId) : null], "Ride update", message, "/ride-partner/requests", "yatra.partner");
  }

  // ============================================================== admin side
  async adminRides(query: { status?: string; city?: string; page: number; limit: number }): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.city) filter.cityKey = cityKey(query.city);
    const [rows, total] = await Promise.all([
      this.rides.find(filter).sort({ pickupAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      this.rides.countDocuments(filter),
    ]);
    return { items: rows.map((r: any) => ({ ...rideView(r), assignment: r.assignment ?? null })), total };
  }

  /** Tirvona (or Destination Ops) gives a request to an approved partner. */
  async assignPartner(actor: YatraActor, rideId: string, partnerId: string): Promise<any> {
    const ride = await this.rides.findById(rideId);
    if (!ride) throw new YatraException("Ride not found.", 404);
    if (!["requested", "rejected", "partner_pending"].includes(ride.status)) throw new YatraException("A partner can be assigned only before the ride is accepted.", 409);
    const partner = await this.assignablePartner(partnerId, ride.city);
    ride.partnerId = partner._id;
    ride.partnerName = partner.businessName;
    ride.partnerAssignedAt = new Date();
    ride.status = "partner_pending";
    if (!ride.commissionSnapshot || ride.commissionSnapshot.missing) {
      ride.commissionSnapshot = await this.finance.snapshotFor("ride", { ridePartnerId: partner._id });
      ride.markModified?.("commissionSnapshot");
    }
    ride.history.push({ status: "partner_pending", note: `Assigned to ${partner.businessName}`, by: actor.id });
    await ride.save();
    await this.audit.record(actor, "ride.assigned", { rideId, partnerId });
    await this.notifier.users([String(partner.ownerUserId)], "New ride request", `${ride.requestNumber} was assigned to you.`, "/ride-partner/requests", "yatra.partner");
    return rideView(ride.toObject());
  }

  async adminCancel(actor: YatraActor, rideId: string, reason: string, refundPercent = 100): Promise<any> {
    if (reason.trim().length < 3) throw new YatraException("Please give a reason (at least 3 characters).", 400);
    return this.cancelWithRefund(actor, rideId, reason, "tirvona", refundPercent);
  }

  // ============================================================ housekeeping
  /** Requests a partner did not answer in time go back to Tirvona Ops for reassignment. */
  async releaseUnanswered(): Promise<number> {
    const { ridePartnerResponseHours } = await this.settings.get();
    const cutoff = new Date(Date.now() - ridePartnerResponseHours * HOUR);
    const due = await this.rides.find({ status: "partner_pending", partnerAssignedAt: { $lt: cutoff } }).select("_id").limit(100).lean();
    let released = 0;
    for (const row of due) {
      const ride = await this.rides.findOneAndUpdate({ _id: row._id, status: "partner_pending", partnerAssignedAt: { $lt: cutoff } }, { $set: { status: "requested", partnerId: null, partnerName: "", partnerAssignedAt: null } }, { new: true });
      if (!ride) continue;
      ride.history.push({ status: "requested", note: "Partner did not answer in time", by: null });
      await ride.save();
      released += 1;
    }
    if (released) await this.notifyAdmins("Ride requests need a partner", `${released} request(s) were not answered in time.`);
    return released;
  }

  isOpen(status: string): boolean {
    return OPEN_RIDE_STATUSES.includes(status as any);
  }
}
