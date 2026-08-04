import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import { Interval } from "@nestjs/schedule";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  PARKING_AMENITIES,
  PARKING_MODEL,
  PARKING_ROLE_CAPABILITIES,
  PARKING_ROLES,
  PARKING_VEHICLE_META,
  PARKING_VEHICLE_TYPES,
} from "../domain/parking.constants";
import {
  parkingLocationSlug,
  parkingPartnerCode,
  parkingPayoutBatchId,
  parkingTransactionReference,
  toDateKey,
} from "../domain/parking.utils";
import type { ParkingAccess } from "./parking-access.service";
import { ParkingAccessService } from "./parking-access.service";
import { ParkingPricingService } from "./parking-pricing.service";
import { ParkingReportService } from "./parking-report.service";

@Injectable()
export class ParkingManagementService {
  constructor(
    private readonly accessService: ParkingAccessService,
    private readonly pricingService: ParkingPricingService,
    private readonly reportsService: ParkingReportService,
    private readonly transactionsService: TransactionService,
    @InjectModel(PARKING_MODEL.Partner) readonly partners: Model<any>,
    @InjectModel(PARKING_MODEL.Location) readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.SlotType) readonly slotTypes: Model<any>,
    @InjectModel(PARKING_MODEL.Slot) readonly slots: Model<any>,
    @InjectModel(PARKING_MODEL.Pricing) readonly pricing: Model<any>,
    @InjectModel(PARKING_MODEL.Availability) readonly availability: Model<any>,
    @InjectModel(PARKING_MODEL.Booking) readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Staff) readonly staff: Model<any>,
    @InjectModel(PARKING_MODEL.Setting) readonly settings: Model<any>,
    @InjectModel(PARKING_MODEL.Commission) readonly commissions: Model<any>,
    @InjectModel(PARKING_MODEL.Transaction) readonly ledger: Model<any>,
    @InjectModel(PARKING_MODEL.Holiday) readonly holidays: Model<any>,
    @InjectModel(PARKING_MODEL.VehicleType) readonly vehicleTypes: Model<any>,
    @InjectModel(PARKING_MODEL.QrCode) readonly qrCodes: Model<any>,
    @InjectModel(PARKING_MODEL.Notification) readonly notifications: Model<any>,
  ) {}

  scopedIds(access: ParkingAccess): Promise<string[]> {
    return access.isPlatformAdmin
      ? this.locations.distinct("_id").then((ids) => ids.map(String))
      : Promise.resolve(access.locationIds);
  }
  assert(access: ParkingAccess, locationId: string): void {
    this.accessService.assertLocation(access, locationId);
  }

  async createLocation(
    user: AuthenticatedUser,
    access: ParkingAccess,
    body: Record<string, any>,
  ): Promise<any> {
    const partnerId = body.partnerId || access.partnerIds[0];
    if (!partnerId)
      throw new ForbiddenException(
        "No parking partner account is linked to you.",
      );
    if (
      !access.isPlatformAdmin &&
      !access.partnerIds.includes(String(partnerId))
    )
      throw new ForbiddenException(
        "You cannot create a location for another partner.",
      );
    if (!String(body.name ?? "").trim())
      throw new ForbiddenException("A parking name is required.");
    const writable = [
      "name",
      "description",
      "images",
      "coverImage",
      "address",
      "latitude",
      "longitude",
      "googleMapsUrl",
      "nearbyDestinations",
      "supportedVehicleTypes",
      "amenities",
      "isCovered",
      "hasCctv",
      "hasSecurity",
      "hasWashroom",
      "hasEvCharging",
      "hasWheelchairAccess",
      "openingHours",
      "totalCapacity",
      "contactPhone",
      "termsAndConditions",
      "instructions",
    ];
    const payload = Object.fromEntries(
      writable
        .filter((key) => body[key] !== undefined)
        .map((key) => [key, body[key]]),
    );
    payload.amenities = (payload.amenities ?? []).filter((item: string) =>
      PARKING_AMENITIES.includes(item as any),
    );
    payload.supportedVehicleTypes = (
      payload.supportedVehicleTypes ?? []
    ).filter((item: string) => PARKING_VEHICLE_TYPES.includes(item as any));
    return this.locations.create({
      ...payload,
      partnerId,
      slug: parkingLocationSlug(payload.name, payload.address?.city),
      status: "pending",
      createdBy: user.id,
    });
  }

  async updateLocation(
    access: ParkingAccess,
    id: string,
    body: Record<string, any>,
  ): Promise<any> {
    this.assert(access, id);
    const location = await this.locations.findById(id);
    if (!location) throw new NotFoundException("Parking not found.");
    const writable = [
      "name",
      "description",
      "images",
      "coverImage",
      "address",
      "latitude",
      "longitude",
      "googleMapsUrl",
      "nearbyDestinations",
      "supportedVehicleTypes",
      "amenities",
      "isCovered",
      "hasCctv",
      "hasSecurity",
      "hasWashroom",
      "hasEvCharging",
      "hasWheelchairAccess",
      "openingHours",
      "totalCapacity",
      "contactPhone",
      "termsAndConditions",
      "instructions",
    ];
    writable.forEach((key) => {
      if (body[key] !== undefined) location[key] = body[key];
    });
    await location.save();
    return location;
  }

  async saveAvailability(
    access: ParkingAccess,
    locationId: string,
    body: Record<string, any>,
  ): Promise<any> {
    this.assert(access, locationId);
    const slotType = await this.slotTypes.findOne({
      _id: body.slotTypeId,
      locationId,
    });
    if (!slotType) throw new NotFoundException("Parking area not found here.");
    const update: Record<string, unknown> = {};
    if (body.blockedCount !== undefined)
      update.blockedCount = Math.max(0, Number(body.blockedCount));
    if (body.isClosed !== undefined) update.isClosed = Boolean(body.isClosed);
    if (body.note !== undefined) update.note = body.note;
    return this.availability.findOneAndUpdate(
      { slotTypeId: body.slotTypeId, date: toDateKey(body.date) },
      {
        $set: update,
        $setOnInsert: {
          locationId,
          slotTypeId: body.slotTypeId,
          date: toDateKey(body.date),
          totalCapacity: slotType.totalCapacity,
          bookedCount: 0,
        },
      },
      { upsert: true, new: true },
    );
  }

  async assignStaff(
    user: AuthenticatedUser,
    access: ParkingAccess,
    body: Record<string, any>,
  ): Promise<any> {
    const partnerId = body.partnerId || access.partnerIds[0];
    // A platform admin holds no partner grants of their own, so `partnerId`
    // falls back to nothing and the authorisation check below waves it through.
    // Without this the upsert writes a grant that belongs to no partner —
    // still loaded by ParkingAccessService, but scoped to nobody.
    if (!partnerId || !Types.ObjectId.isValid(String(partnerId)))
      throw new BadRequestException("Select the partner this role belongs to.");
    if (!body.userId || !Types.ObjectId.isValid(String(body.userId)))
      throw new BadRequestException("Select the user to grant this role to.");
    if (
      !access.isPlatformAdmin &&
      !access.partnerIds.includes(String(partnerId))
    )
      throw new ForbiddenException("Not authorised for this partner.");
    if (!(await this.partners.exists({ _id: partnerId })))
      throw new NotFoundException("That parking partner does not exist.");
    const managerOnly =
      !access.isPlatformAdmin &&
      access.roles.includes("parking_manager") &&
      !access.roles.includes("parking_partner");
    if (managerOnly && body.parkingRole !== "security_guard")
      throw new ForbiddenException(
        "A parking manager can only assign security guards.",
      );
    if (!PARKING_ROLES.includes(body.parkingRole))
      throw new ForbiddenException("Select a valid parking role.");
    for (const locationId of body.locationIds ?? [])
      this.assert(access, String(locationId));
    return this.staff.findOneAndUpdate(
      { userId: body.userId, partnerId, parkingRole: body.parkingRole },
      {
        $set: {
          locationIds: body.locationIds ?? [],
          employeeCode: body.employeeCode ?? "",
          shift: body.shift ?? "general",
          phone: body.phone ?? "",
          assignedBy: user.id,
          status: "active",
        },
        $setOnInsert: {
          userId: body.userId,
          partnerId,
          parkingRole: body.parkingRole,
        },
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Every parking grant on the platform, optionally narrowed.
   *
   * The partner-facing roster answers for a single `partnerId` and returns
   * nothing when the caller holds no grants of their own, which is exactly the
   * case for a Super Admin — so the console needs its own unscoped view to
   * manage roles across partners.
   */
  async staffRoster(query: Record<string, string>): Promise<any> {
    const filter: Record<string, any> = {};
    if (query.partnerId && Types.ObjectId.isValid(query.partnerId))
      filter.partnerId = query.partnerId;
    if (query.locationId && Types.ObjectId.isValid(query.locationId))
      filter.locationIds = query.locationId;
    if (query.parkingRole && PARKING_ROLES.includes(query.parkingRole as never))
      filter.parkingRole = query.parkingRole;
    if (query.status && query.status !== "all") filter.status = query.status;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const [rows, total] = await Promise.all([
      this.staff
        .find(filter)
        .populate("userId", "name email phone role status")
        .populate("partnerId", "businessName partnerCode status")
        .populate("locationIds", "name slug")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.staff.countDocuments(filter),
    ]);
    // A grant carries the role's capability set, and the console has to show
    // what a role actually permits before an admin hands it out.
    const data = rows.map((row: any) => {
      const base = PARKING_ROLE_CAPABILITIES[String(row.parkingRole)] ?? [];
      return {
        ...row,
        capabilities: row.capabilityOverrides?.length
          ? base.filter((capability: string) =>
              row.capabilityOverrides.includes(capability),
            )
          : base,
        // An empty `locationIds` means partner-wide, which reads as "no
        // locations" in a table unless it is stated.
        scope: row.locationIds?.length ? "locations" : "all_partner_locations",
      };
    });
    return { success: true, count: data.length, total, page, data };
  }

  async revokeStaff(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid staff record id");
    const grant = await this.staff.findByIdAndUpdate(
      id,
      { $set: { status: "inactive" } },
      { new: true },
    );
    if (!grant) throw new NotFoundException("Staff record not found.");
    return grant;
  }

  async saveSettings(
    user: AuthenticatedUser,
    scope: "platform" | "location",
    locationId: string | null,
    body: Record<string, any>,
  ): Promise<any> {
    const allowed = [
      "reservationHoldMinutes",
      "overstayGraceMinutes",
      "noShowAfterMinutes",
      "overstayMultiplier",
      "commissionPercent",
      "taxPercent",
      "minimumBillableHours",
      "freeCancellationHours",
      "refundPercentInsideWindow",
      "refundPercentOutsideWindow",
      "qrValidityBufferMinutes",
      "allowOnlineBooking",
      "allowCancellation",
      "requireVehicleNumber",
    ];
    const values = Object.fromEntries(
      allowed
        .filter(
          (key) =>
            body[key] !== undefined &&
            !(scope === "location" && key === "commissionPercent"),
        )
        .map((key) => [key, body[key]]),
    );
    return this.settings.findOneAndUpdate(
      { scope, partnerId: null, locationId },
      {
        $set: { ...values, updatedBy: user.id },
        $setOnInsert: { scope, partnerId: null, locationId },
      },
      { upsert: true, new: true },
    );
  }

  async createPartner(body: Record<string, any>): Promise<any> {
    if (!body.userId || !body.businessName)
      throw new ForbiddenException("User and business name are required.");
    return this.partners.create({
      ...body,
      partnerCode: parkingPartnerCode(),
      status: "pending",
    });
  }

  async settle(
    user: AuthenticatedUser,
    partnerId: string,
    reference?: string,
  ): Promise<any> {
    return this.transactionsService.run(async (session) => {
      const pending = await this.commissions
        .find({ partnerId, settlementStatus: "pending" })
        .session(session);
      const totalEarning = pending.reduce(
        (sum, row) => sum + Number(row.partnerEarning),
        0,
      );
      const batchId = parkingPayoutBatchId();
      await this.commissions.updateMany(
        { partnerId, settlementStatus: "pending" },
        {
          $set: {
            settlementStatus: "settled",
            settledAt: new Date(),
            settlementReference: reference || batchId,
            payoutBatchId: batchId,
          },
        },
        { session },
      );
      if (totalEarning > 0)
        await this.ledger.create(
          [
            {
              partnerId,
              type: "payout",
              direction: "debit",
              amount: -Math.abs(totalEarning),
              description: `Partner payout batch ${batchId}`,
              reference: parkingTransactionReference(),
              meta: { bookings: pending.length, batchId },
              recordedBy: user.id,
            },
          ],
          { session },
        );
      return { batchId, count: pending.length, totalEarning };
    });
  }

  async seedVehicleTypes(): Promise<number> {
    for (const [displayOrder, code] of PARKING_VEHICLE_TYPES.entries())
      await this.vehicleTypes.updateOne(
        { code },
        {
          $setOnInsert: {
            code,
            ...PARKING_VEHICLE_META[code],
            displayOrder,
            isActive: true,
          },
        },
        { upsert: true },
      );
    return PARKING_VEHICLE_TYPES.length;
  }

  @Interval(60_000)
  async maintenanceSweep(): Promise<{ released: number; marked: number }> {
    const stale = await this.bookings
      .find({ status: "pending", reservationExpiresAt: { $lt: new Date() } })
      .select("_id")
      .limit(200)
      .lean();
    let released = 0;
    for (const item of stale)
      await this.transactionsService.run(async (session) => {
        const booking = await this.bookings.findOneAndUpdate(
          {
            _id: item._id,
            status: "pending",
            reservationExpiresAt: { $lt: new Date() },
          },
          {
            $set: { status: "expired", reservationExpiresAt: null },
            $push: {
              history: {
                status: "expired",
                note: "Reservation hold expired before payment",
              },
            },
          },
          { new: true, session },
        );
        if (!booking) return;
        const units = Math.max(
          1,
          Math.ceil(
            PARKING_VEHICLE_META[
              booking.vehicleType as keyof typeof PARKING_VEHICLE_META
            ]?.footprint ?? 1,
          ),
        );
        for (const date of booking.occupiedDates)
          await this.availability.updateOne(
            {
              slotTypeId: booking.slotTypeId,
              date: toDateKey(date),
              bookedCount: { $gte: units },
            },
            { $inc: { bookedCount: -units } },
            { session },
          );
        released += 1;
      });
    const candidates = await this.bookings
      .find({ status: "upcoming", entryAt: { $lt: new Date() } })
      .select("_id locationId")
      .limit(200)
      .lean();
    let marked = 0;
    for (const item of candidates) {
      const settings = await this.pricingService.resolveSettings(
        String(item.locationId),
      );
      const cutoff = new Date(
        Date.now() - Number(settings.noShowAfterMinutes) * 60_000,
      );
      await this.transactionsService.run(async (session) => {
        const booking = await this.bookings.findOneAndUpdate(
          { _id: item._id, status: "upcoming", entryAt: { $lt: cutoff } },
          {
            $set: { status: "no_show" },
            $push: {
              history: { status: "no_show", note: "Arrival window elapsed" },
            },
          },
          { new: true, session },
        );
        if (!booking) return;
        const units = Math.max(
          1,
          Math.ceil(
            PARKING_VEHICLE_META[
              booking.vehicleType as keyof typeof PARKING_VEHICLE_META
            ]?.footprint ?? 1,
          ),
        );
        for (const date of booking.occupiedDates)
          await this.availability.updateOne(
            {
              slotTypeId: booking.slotTypeId,
              date: toDateKey(date),
              bookedCount: { $gte: units },
            },
            { $inc: { bookedCount: -units } },
            { session },
          );
        await this.qrCodes.updateMany(
          { bookingId: booking._id, status: "active" },
          {
            $set: {
              status: "revoked",
              revokedReason: "Booking marked no-show",
            },
          },
          { session },
        );
        marked += 1;
      });
    }
    return { released, marked };
  }

  reports(locationIds: string[], from?: string, to?: string) {
    return this.reportsService.reports(locationIds, from, to);
  }
  dashboard(locationIds: string[]) {
    return this.reportsService.dashboard(locationIds);
  }
  effectiveSettings(locationId?: string, partnerId?: string) {
    return this.pricingService.resolveSettings(locationId, partnerId);
  }
}
