import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { ParkingBookingService } from "../../application/parking-booking.service";
import { ParkingManagementService } from "../../application/parking-management.service";
import {
  PARKING_CAPABILITIES,
  PARKING_LOCATION_STATUSES,
  PARKING_ROLE_CAPABILITIES,
  PARKING_ROLES,
} from "../../domain/parking.constants";
import { ParkingCapabilities } from "../decorators/parking-capabilities.decorator";
import {
  ParkingCapabilityGuard,
  type ParkingRequest,
} from "../guards/parking-capability.guard";

@ApiTags("Parking Administration")
@ApiBearerAuth()
@Roles("super_admin")
@UseGuards(ParkingCapabilityGuard)
@Controller("parking/admin")
export class ParkingAdminController {
  constructor(
    private readonly service: ParkingManagementService,
    private readonly bookingService: ParkingBookingService,
  ) {}

  @Get("partners")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PARTNERS)
  async partners(@Query() query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.status && query.status !== "all") filter.status = query.status;
    if (query.search)
      filter.$or = [
        { businessName: { $regex: query.search, $options: "i" } },
        { partnerCode: { $regex: query.search, $options: "i" } },
      ];
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const [data, total] = await Promise.all([
      this.service.partners
        .find(filter)
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.service.partners.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Post("partners")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PARTNERS)
  async createPartner(@Body() body: Record<string, any>) {
    return {
      success: true,
      message: "Parking partner created.",
      data: await this.service.createPartner(body),
    };
  }

  @Patch("partners/:id/status")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PARTNERS)
  async partnerStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    const partner = await this.service.partners.findById(id);
    if (!partner) return { success: false, message: "Partner not found." };
    if (!["pending", "active", "suspended", "rejected"].includes(body.status))
      return { success: false, message: "Invalid partner status." };
    partner.status = body.status;
    if (body.status === "active") {
      partner.isVerified = true;
      partner.verifiedAt = new Date();
      partner.verifiedBy = user.id;
    }
    if (body.status === "rejected")
      partner.rejectionReason = body.rejectionReason ?? "";
    if (body.commissionPercent !== undefined)
      partner.commissionPercent = body.commissionPercent;
    await partner.save();
    if (body.status === "suspended")
      await this.service.locations.updateMany(
        { partnerId: id, status: "active" },
        { $set: { status: "suspended" } },
      );
    return { success: true, message: `Partner ${body.status}.`, data: partner };
  }

  @Get("locations")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PARTNERS)
  async locations(@Query() query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.status && query.status !== "all") filter.status = query.status;
    if (query.partnerId) filter.partnerId = query.partnerId;
    if (query.search)
      filter.$or = [
        { name: { $regex: query.search, $options: "i" } },
        { "address.city": { $regex: query.search, $options: "i" } },
      ];
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const [data, total] = await Promise.all([
      this.service.locations
        .find(filter)
        .populate("partnerId", "businessName partnerCode status")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.service.locations.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Patch("locations/:id/status")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PARTNERS)
  async locationStatus(
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    const location = await this.service.locations.findById(id);
    if (!location) return { success: false, message: "Parking not found." };
    if (
      body.status !== undefined &&
      !PARKING_LOCATION_STATUSES.includes(body.status)
    )
      return { success: false, message: "Invalid parking status." };
    if (body.status !== undefined) location.status = body.status;
    ["isVerified", "isFeatured"].forEach((key) => {
      if (body[key] !== undefined) location[key] = Boolean(body[key]);
    });
    await location.save();
    return { success: true, message: "Parking updated.", data: location };
  }

  @Get("bookings")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_BOOKINGS)
  async bookings(@Query() query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.locationId) filter.locationId = query.locationId;
    if (query.status) filter.status = query.status;
    if (query.vehicleNumber)
      filter.vehicleNumber = query.vehicleNumber
        .toUpperCase()
        .replace(/[\s.-]/g, "");
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const [data, total] = await Promise.all([
      this.service.bookings
        .find(filter)
        .populate("locationId slotTypeId customerId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.service.bookings.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Post("bookings/:id/refund")
  @ParkingCapabilities(PARKING_CAPABILITIES.ISSUE_REFUND)
  async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    const data = await this.bookingService.cancel(
      id,
      user,
      { reason: body.reason || "Refunded by administrator" },
      true,
    );
    return {
      success: true,
      message: `Booking cancelled and ₹${data.refund.refundAmount} refunded.`,
      data,
    };
  }

  @Get("staff")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  async staff(@Query() query: Record<string, string>) {
    return this.service.staffRoster(query);
  }

  @Get("staff/roles")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  roles() {
    return {
      success: true,
      data: PARKING_ROLES.map((role) => ({
        role,
        capabilities: PARKING_ROLE_CAPABILITIES[role] ?? [],
      })),
    };
  }

  @Post("staff")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  async assignStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Parking role assigned.",
      data: await this.service.assignStaff(user, req.parking, body),
    };
  }

  @Delete("staff/:id")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  async revokeStaff(@Param("id") id: string) {
    await this.service.revokeStaff(id);
    return { success: true, message: "Parking role revoked." };
  }

  @Get("commissions")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_COMMISSION)
  async commissions(@Query() query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.partnerId) filter.partnerId = query.partnerId;
    if (query.settlementStatus)
      filter.settlementStatus = query.settlementStatus;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const [data, total] = await Promise.all([
      this.service.commissions
        .find(filter)
        .populate("partnerId", "businessName partnerCode")
        .populate("bookingId", "bookingReference entryAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.service.commissions.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Post("commissions/settle")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_COMMISSION)
  async settle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, any>,
  ) {
    const data = await this.service.settle(
      user,
      body.partnerId,
      body.reference,
    );
    return {
      success: true,
      message: `Settled ${data.count} booking(s) totalling ₹${data.totalEarning}.`,
      data,
    };
  }

  @Get("analytics")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_ANALYTICS)
  async analytics(@Query() query: Record<string, string>) {
    const ids = (await this.service.locations.distinct("_id")).map(String);
    const data = await this.service.reports(ids, query.from, query.to);
    const ledger = await this.service.ledger.aggregate([
      { $match: {} },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    return {
      success: true,
      data: {
        ...data,
        ledger: Object.fromEntries(
          ledger.map((row) => [
            row._id,
            { total: row.total, count: row.count },
          ]),
        ),
        totals: {
          locations: ids.length,
          partners: await this.service.partners.countDocuments(),
          activeLocations: await this.service.locations.countDocuments({
            status: "active",
          }),
        },
      },
    };
  }

  @Get("transactions")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_ANALYTICS)
  async transactions(@Query() query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.partnerId) filter.partnerId = query.partnerId;
    if (query.type) filter.type = query.type;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const [data, total] = await Promise.all([
      this.service.ledger
        .find(filter)
        .sort({ occurredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.service.ledger.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Get("settings")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async settings() {
    return { success: true, data: await this.service.effectiveSettings() };
  }

  @Put("settings")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Parking settings updated.",
      data: await this.service.saveSettings(user, "platform", null, body),
    };
  }

  @Get("holidays")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async holidays() {
    const data = await this.service.holidays
      .find()
      .sort({ startDate: -1 })
      .limit(200);
    return { success: true, count: data.length, data };
  }

  @Post("holidays")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async createHoliday(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, any>,
  ) {
    if (
      !body.name ||
      !body.startDate ||
      !body.endDate ||
      new Date(body.endDate) < new Date(body.startDate)
    )
      return {
        success: false,
        message: "Name and a valid date window are required.",
      };
    const data = await this.service.holidays.create({
      ...body,
      partnerId: body.partnerId || null,
      locationId: body.locationId || null,
      createdBy: user.id,
    });
    return { success: true, message: "Peak window created.", data };
  }

  @Delete("holidays/:id")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async deleteHoliday(@Param("id") id: string) {
    await this.service.holidays.deleteOne({ _id: id });
    return { success: true, message: "Peak window removed." };
  }

  @Post("vehicle-types/seed")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async seed() {
    const count = await this.service.seedVehicleTypes();
    return { success: true, message: `${count} vehicle type(s) available.` };
  }

  @Post("maintenance/sweep")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SETTINGS)
  async sweep() {
    const data = await this.service.maintenanceSweep();
    return {
      success: true,
      message: `Released ${data.released} expired hold(s), marked ${data.marked} no-show(s).`,
      data,
    };
  }
}
