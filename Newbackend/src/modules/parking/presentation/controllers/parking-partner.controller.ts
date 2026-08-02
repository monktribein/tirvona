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
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { ParkingManagementService } from "../../application/parking-management.service";
import { PARKING_CAPABILITIES } from "../../domain/parking.constants";
import { ParkingCapabilities } from "../decorators/parking-capabilities.decorator";
import {
  ParkingCapabilityGuard,
  ParkingRequest,
} from "../guards/parking-capability.guard";

@ApiTags("Parking Partner")
@ApiBearerAuth()
@UseGuards(ParkingCapabilityGuard)
@Controller("parking/partner")
export class ParkingPartnerController {
  constructor(private readonly service: ParkingManagementService) {}

  @Get("dashboard")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_OCCUPANCY)
  async dashboard(@Req() req: ParkingRequest) {
    return {
      success: true,
      data: await this.service.dashboard(
        await this.service.scopedIds(req.parking),
      ),
    };
  }

  @Get("reports")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_REPORTS)
  async reports(
    @Req() req: ParkingRequest,
    @Query() query: Record<string, string>,
  ) {
    return {
      success: true,
      data: await this.service.reports(
        await this.service.scopedIds(req.parking),
        query.from,
        query.to,
      ),
    };
  }

  @Get("locations")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_OCCUPANCY)
  async locations(@Req() req: ParkingRequest) {
    const filter = req.parking.isPlatformAdmin
      ? {}
      : { _id: { $in: req.parking.locationIds } };
    const data = await this.service.locations
      .find(filter)
      .sort({ createdAt: -1 });
    return { success: true, count: data.length, data };
  }

  @Post("locations")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_LOCATION)
  async createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Parking submitted for review.",
      data: await this.service.createLocation(user, req.parking, body),
    };
  }

  @Put("locations/:id")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_LOCATION)
  async updateLocation(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Parking updated.",
      data: await this.service.updateLocation(req.parking, id, body),
    };
  }

  @Get("locations/:id/slot-types")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_OCCUPANCY)
  async slotTypes(@Req() req: ParkingRequest, @Param("id") id: string) {
    this.service.assert(req.parking, id);
    const data = await this.service.slotTypes
      .find({ locationId: id })
      .sort({ displayOrder: 1 });
    return { success: true, count: data.length, data };
  }

  @Post("locations/:id/slot-types")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SLOTS)
  async createSlotType(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    this.service.assert(req.parking, id);
    if (
      !body.name ||
      !Number.isInteger(Number(body.totalCapacity)) ||
      Number(body.totalCapacity) < 0
    )
      return {
        success: false,
        message: "A name and valid capacity are required.",
      };
    const data = await this.service.slotTypes.create({
      ...body,
      locationId: id,
      totalCapacity: Number(body.totalCapacity),
      vehicleTypes: (body.vehicleTypes ?? []).filter((value: string) =>
        [
          "bike",
          "scooter",
          "car",
          "suv",
          "luxury_car",
          "tempo",
          "mini_bus",
          "bus",
          "ev",
        ].includes(value),
      ),
    });
    return { success: true, message: "Parking area created.", data };
  }

  @Put("slot-types/:id")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SLOTS)
  async updateSlotType(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    const row = await this.service.slotTypes.findById(id);
    if (!row) return { success: false, message: "Parking area not found." };
    this.service.assert(req.parking, String(row.locationId));
    Object.assign(row, body);
    await row.save();
    return { success: true, message: "Parking area updated.", data: row };
  }

  @Get("locations/:id/slots")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_OCCUPANCY)
  async slots(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Query() query: Record<string, string>,
  ) {
    this.service.assert(req.parking, id);
    const filter = {
      locationId: id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.slotTypeId ? { slotTypeId: query.slotTypeId } : {}),
    };
    const data = await this.service.slots
      .find(filter)
      .populate("slotTypeId", "name code")
      .sort({ slotNumber: 1 })
      .limit(500);
    return { success: true, count: data.length, data };
  }

  @Post("locations/:id/slots/bulk")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SLOTS)
  async bulkSlots(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    this.service.assert(req.parking, id);
    const from = Number(body.from ?? 1);
    const to = Number(body.to ?? 10);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      to < from ||
      to - from + 1 > 500
    )
      return {
        success: false,
        message: "Provide a valid range of at most 500 bays.",
      };
    const docs = Array.from({ length: to - from + 1 }, (_, index) => ({
      locationId: id,
      slotTypeId: body.slotTypeId,
      slotNumber:
        `${body.prefix ?? "P"}${String(from + index).padStart(3, "0")}`.toUpperCase(),
      floorLabel: body.floorLabel ?? "",
      zone: body.zone ?? "",
    }));
    let created = 0;
    try {
      created = (await this.service.slots.insertMany(docs, { ordered: false }))
        .length;
    } catch (error: any) {
      created = error?.insertedDocs?.length ?? 0;
    }
    return {
      success: true,
      message: `${created} bay(s) created.`,
      data: { created, requested: docs.length },
    };
  }

  @Patch("slots/:id")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_SLOTS)
  async updateSlot(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    const slot = await this.service.slots.findById(id);
    if (!slot) return { success: false, message: "Bay not found." };
    this.service.assert(req.parking, String(slot.locationId));
    if (slot.status === "occupied" && body.status && body.status !== "occupied")
      return {
        success: false,
        message:
          "This bay is occupied. Check the vehicle out before changing its status.",
      };
    ["status", "maintenanceNote", "isActive"].forEach((key) => {
      if (body[key] !== undefined) slot[key] = body[key];
    });
    await slot.save();
    return { success: true, message: "Bay updated.", data: slot };
  }

  @Get("locations/:id/pricing")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PRICING)
  async pricing(@Req() req: ParkingRequest, @Param("id") id: string) {
    this.service.assert(req.parking, id);
    const data = await this.service.pricing
      .find({ locationId: id })
      .sort({ vehicleType: 1 });
    return { success: true, count: data.length, data };
  }

  @Post("locations/:id/pricing")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_PRICING)
  async savePricing(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    this.service.assert(req.parking, id);
    const data = await this.service.pricing.findOneAndUpdate(
      {
        locationId: id,
        slotTypeId: body.slotTypeId || null,
        vehicleType: body.vehicleType,
      },
      {
        $set: {
          ...body,
          locationId: id,
          slotTypeId: body.slotTypeId || null,
          isActive: true,
          updatedBy: user.id,
        },
      },
      { upsert: true, new: true },
    );
    return { success: true, message: "Pricing saved.", data };
  }

  @Get("locations/:id/calendar")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_OCCUPANCY)
  async calendar(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Query() query: Record<string, string>,
  ) {
    this.service.assert(req.parking, id);
    const data = await this.service.availability
      .find({
        locationId: id,
        date: {
          $gte: new Date(query.startDate ?? Date.now()),
          $lte: new Date(query.endDate ?? Date.now() + 30 * 86_400_000),
        },
      })
      .sort({ date: 1 });
    return { success: true, count: data.length, data };
  }

  @Post("locations/:id/availability")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_AVAILABILITY)
  async availability(
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Availability updated.",
      data: await this.service.saveAvailability(req.parking, id, body),
    };
  }

  @Get("bookings")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_BOOKINGS)
  async bookings(
    @Req() req: ParkingRequest,
    @Query() query: Record<string, string>,
  ) {
    const filter: Record<string, any> = req.parking.isPlatformAdmin
      ? {}
      : { locationId: { $in: req.parking.locationIds } };
    if (query.locationId) filter.locationId = query.locationId;
    if (query.status) filter.status = query.status;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 25));
    const [data, total] = await Promise.all([
      this.service.bookings
        .find(filter)
        .populate("locationId slotTypeId customerId")
        .sort({ entryAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.service.bookings.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Get("staff")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  async staff(
    @Req() req: ParkingRequest,
    @Query("partnerId") requested?: string,
  ) {
    const partnerId = requested || req.parking.partnerIds[0];
    if (!partnerId) return { success: true, count: 0, data: [] };
    if (
      !req.parking.isPlatformAdmin &&
      !req.parking.partnerIds.includes(partnerId)
    )
      return { success: false, message: "Not authorised for this partner." };
    const data = await this.service.staff
      .find({ partnerId })
      .populate("userId", "name email phone role status")
      .populate("locationIds", "name slug")
      .sort({ createdAt: -1 });
    return { success: true, count: data.length, data };
  }

  @Post("staff")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Staff assigned.",
      data: await this.service.assignStaff(user, req.parking, body),
    };
  }

  @Delete("staff/:id")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_STAFF)
  async revoke(@Req() req: ParkingRequest, @Param("id") id: string) {
    const grant = await this.service.staff.findById(id);
    if (!grant) return { success: false, message: "Staff record not found." };
    if (
      !req.parking.isPlatformAdmin &&
      !req.parking.partnerIds.includes(String(grant.partnerId))
    )
      return { success: false, message: "Not authorised for this partner." };
    await this.service.staff.updateOne(
      { _id: id },
      { $set: { status: "inactive" } },
    );
    return { success: true, message: "Staff access revoked." };
  }

  @Get("locations/:id/settings")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_LOCATION)
  async settings(@Req() req: ParkingRequest, @Param("id") id: string) {
    this.service.assert(req.parking, id);
    const location = await this.service.locations.findById(id);
    return {
      success: true,
      data: await this.service.effectiveSettings(
        id,
        String(location?.partnerId),
      ),
    };
  }

  @Put("locations/:id/settings")
  @ParkingCapabilities(PARKING_CAPABILITIES.MANAGE_LOCATION)
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    this.service.assert(req.parking, id);
    return {
      success: true,
      message: "Settings updated.",
      data: await this.service.saveSettings(user, "location", id, body),
    };
  }
}
