import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import { Interval } from "@nestjs/schedule";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { TransactionService } from "../../../common/database/transaction.service";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  PARKING_AMENITIES,
  PARKING_ASHRAM_OWNER_ROLE,
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

const assertParkingPhotos = (images: unknown, coverImage: unknown): void => {
  const unique = new Set(
    [
      typeof coverImage === "string" ? coverImage.trim() : "",
      ...(Array.isArray(images)
        ? images.map((image) =>
            typeof image === "string" ? image.trim() : "",
          )
        : []),
    ].filter(Boolean),
  );
  if (unique.size < 3)
    throw new BadRequestException(
      "At least 3 unique parking photos are required. Map data does not count as a photo.",
    );
};

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
    @InjectModel("Ashram") readonly ashrams: Model<any>,
    @InjectModel("User") readonly users: Model<any>,
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
    const ashramId = this.deriveAshramId(access, body);
    const partnerId = body.partnerId || access.partnerIds[0] || null;
    if (!partnerId && !ashramId)
      throw new ForbiddenException(
        "No parking partner account is linked to you.",
      );
    if (
      partnerId &&
      !access.isPlatformAdmin &&
      !access.partnerIds.includes(String(partnerId))
    )
      throw new ForbiddenException(
        "You cannot create a location for another partner.",
      );
    if (!String(body.name ?? "").trim())
      throw new ForbiddenException("A parking name is required.");
    assertParkingPhotos(body.images, body.coverImage);
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
      ashramId,
      slug: parkingLocationSlug(payload.name, payload.address?.city),
      status: "pending",
      createdBy: user.id,
    });
  }

  private deriveAshramId(
    access: ParkingAccess,
    body: Record<string, any>,
  ): string | null {
    if (access.isPlatformAdmin)
      return body.ashramId ? String(body.ashramId) : null;
    if (!access.ashramIds.length) return null;
    const requested = body.ashramId ? String(body.ashramId) : null;
    if (requested && !access.ashramIds.includes(requested))
      throw new ForbiddenException(
        "You cannot create a parking location for another ashram.",
      );
    return requested ?? access.ashramIds[0];
  }

  async updateLocation(
    access: ParkingAccess,
    id: string,
    body: Record<string, any>,
  ): Promise<any> {
    this.assert(access, id);
    const location = await this.locations.findById(id);
    if (!location) throw new NotFoundException("Parking not found.");
    assertParkingPhotos(
      body.images !== undefined ? body.images : location.images,
      body.coverImage !== undefined ? body.coverImage : location.coverImage,
    );
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

  async createStaffAccount(
    user: AuthenticatedUser,
    access: ParkingAccess,
    body: Record<string, any>,
  ): Promise<any> {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").replace(/[^0-9+]/g, "");
    const password = String(body.password ?? "");
    const ashramId = String(body.ashramId ?? "");
    const parkingRole = String(body.parkingRole ?? "");
    const locationIds = [
      ...new Set(
        (Array.isArray(body.locationIds) ? body.locationIds : [])
          .map((value: unknown) => String(value))
          .filter((value: string) => Types.ObjectId.isValid(value)),
      ),
    ];

    if (name.length < 2)
      throw new BadRequestException("Enter the parking staff member's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException("Enter a valid staff email address.");
    if (!/^\+?[1-9]\d{9,14}$/.test(phone))
      throw new BadRequestException("Enter a valid staff phone number.");
    if (password.length < 8)
      throw new BadRequestException(
        "Create a password containing at least 8 characters.",
      );
    if (!Types.ObjectId.isValid(ashramId))
      throw new BadRequestException("Select the ashram for this parking role.");
    if (!["parking_manager", "security_guard"].includes(parkingRole))
      throw new BadRequestException("Select a valid parking staff role.");
    if (!locationIds.length)
      throw new BadRequestException("Select at least one parking facility.");

    const managerOnly =
      !access.isPlatformAdmin &&
      access.roles.includes("parking_manager") &&
      !access.roles.includes("parking_partner") &&
      !access.roles.includes("ashram_parking_owner");
    if (managerOnly && parkingRole !== "security_guard")
      throw new ForbiddenException(
        "A parking manager can only create security guard accounts.",
      );

    const locations = await this.locations
      .find({ _id: { $in: locationIds }, ashramId })
      .select("_id partnerId ashramId name status")
      .lean();
    if (locations.length !== locationIds.length)
      throw new BadRequestException(
        "Every selected parking facility must belong to the selected ashram.",
      );
    for (const location of locations)
      this.assert(access, String(location._id));

    const partnerIds = [
      ...new Set(locations.map((location: any) => String(location.partnerId))),
    ].filter((value) => Types.ObjectId.isValid(value));
    if (partnerIds.length !== 1)
      throw new BadRequestException(
        "Selected parking facilities must belong to one parking partner.",
      );
    const partnerId = partnerIds[0];
    if (!(await this.partners.exists({ _id: partnerId })))
      throw new NotFoundException("The parking partner no longer exists.");
    if (!(await this.ashrams.exists({ _id: ashramId })))
      throw new NotFoundException("The selected ashram no longer exists.");

    const duplicate = await this.users.exists({
      $or: [{ email }, { phone }],
      isDeleted: { $ne: true },
    });
    if (duplicate)
      throw new ConflictException(
        "An account with this email or phone number already exists.",
      );

    const employeeCode = `PKG-${new Date().getFullYear()}-${randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;
    const passwordHash = await bcrypt.hash(password, 12);
    const requiresApproval = managerOnly && parkingRole === "security_guard";

    try {
      return await this.transactionsService.run(async (session) => {
        const [account] = await this.users.create(
          [
            {
              name,
              email,
              phone,
              passwordHash,
              role: "staff",
              status: requiresApproval ? "pending_approval" : "active",
              isVerified: true,
              authProvider: "local",
              employerAshramId: ashramId,
              scopedAshramIds: [ashramId],
              designation:
                parkingRole === "parking_manager"
                  ? "Parking Manager"
                  : "Parking Security Guard",
              department: "Parking",
              employeeId: employeeCode,
              username: `parking_${randomBytes(4).toString("hex")}`,
            },
          ],
          { session },
        );
        const grant = await this.staff.findOneAndUpdate(
          { userId: account._id, partnerId, parkingRole },
          {
            $set: {
              locationIds,
              employeeCode,
              shift: String(body.shift ?? "general"),
              phone,
              assignedBy: user.id,
              status: requiresApproval ? "pending_approval" : "active",
            },
            $setOnInsert: { userId: account._id, partnerId, parkingRole },
          },
          { upsert: true, new: true, session },
        );
        return {
          account: {
            id: String(account._id),
            name: account.name,
            email: account.email,
            phone: account.phone,
            employeeCode,
          },
          grant,
          approvalRequired: requiresApproval,
        };
      });
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "That email, phone number, employee code or username is already in use.",
        );
      throw error;
    }
  }

  async approveStaffAccount(
    access: ParkingAccess,
    id: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid parking staff record.");
    const grant = await this.staff.findById(id);
    if (!grant) throw new NotFoundException("Parking staff record not found.");
    if (
      !access.isPlatformAdmin &&
      !access.roles.includes(PARKING_ASHRAM_OWNER_ROLE)
    )
      throw new ForbiddenException(
        "Only an Ashram Owner/Admin or Super Admin can approve parking staff.",
      );
    if (grant.locationIds?.length) {
      for (const locationId of grant.locationIds)
        this.assert(access, String(locationId));
    } else if (!access.isPlatformAdmin) {
      const scopedPartnerLocation = await this.locations.exists({
        _id: { $in: access.locationIds },
        partnerId: grant.partnerId,
      });
      if (!scopedPartnerLocation)
        throw new ForbiddenException("Not authorised for this parking partner.");
    }
    if (grant.status !== "pending_approval")
      throw new BadRequestException(
        "This parking staff account is not pending approval.",
      );

    return this.transactionsService.run(async (session) => {
      grant.status = "active";
      await grant.save({ session });
      await this.users.updateOne(
        { _id: grant.userId },
        {
          $set: { status: "active", isSuspended: false },
          $inc: { tokenVersion: 1 },
        },
        { session },
      );
      return grant;
    });
  }

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
    const data = rows.map((row: any) => {
      const base = PARKING_ROLE_CAPABILITIES[String(row.parkingRole)] ?? [];
      return {
        ...row,
        capabilities: row.capabilityOverrides?.length
          ? base.filter((capability: string) =>
              row.capabilityOverrides.includes(capability),
            )
          : base,
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
