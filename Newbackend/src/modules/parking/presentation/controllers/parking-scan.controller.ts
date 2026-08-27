import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { ParkingScanService } from "../../application/parking-scan.service";
import {
  PARKING_CAPABILITIES,
  PARKING_MODEL,
} from "../../domain/parking.constants";
import { ParkingCapabilities } from "../decorators/parking-capabilities.decorator";
import {
  ParkingCapabilityGuard,
  ParkingRequest,
} from "../guards/parking-capability.guard";
import {
  ParkingCheckoutScanDto,
  ParkingScanDto,
  ParkingVehicleLookupDto,
} from "../dtos/parking.dto";

@ApiTags("Parking Gate")
@ApiBearerAuth()
@UseGuards(ParkingCapabilityGuard)
@Controller("parking/scan")
export class ParkingScanController {
  constructor(
    private readonly service: ParkingScanService,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.ScanLog) private readonly logs: Model<any>,
  ) {}

  @Get("my-locations")
  @ParkingCapabilities(PARKING_CAPABILITIES.SCAN_QR)
  async myLocations(@Req() req: ParkingRequest) {
    const filter = req.parking.isPlatformAdmin
      ? { status: "active" }
      : { _id: { $in: req.parking.locationIds }, status: "active" };
    return {
      success: true,
      data: await this.locations
        .find(filter)
        .select(
          "name slug description address openingHours totalCapacity amenities supportedVehicleTypes contactPhone hasCctv hasSecurity hasWashroom hasEvCharging hasWheelchairAccess",
        )
        .sort({ name: 1 })
        .limit(200),
      roles: req.parking.roles,
      capabilities: req.parking.capabilities,
    };
  }

  @Post("verify")
  @ParkingCapabilities(
    PARKING_CAPABILITIES.SCAN_QR,
    PARKING_CAPABILITIES.VIEW_BOOKING,
  )
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() dto: ParkingScanDto,
  ) {
    const b = await this.service.verify(
      user,
      req.parking,
      dto.token,
      dto.locationId,
    );
    return {
      success: true,
      data: {
        bookingReference: b.bookingReference,
        status: b.status,
        paymentStatus: b.paymentStatus,
        vehicleNumber: b.vehicleNumber,
        vehicleType: b.vehicleType,
        vehicleModel: b.vehicleModel,
        driverName: b.driverName,
        driverPhone: b.driverPhone,
        entryAt: b.entryAt,
        exitAt: b.exitAt,
        checkedInAt: b.checkedInAt,
        checkedOutAt: b.checkedOutAt,
        assignedSlotNumber: b.assignedSlotNumber,
      },
    };
  }

  @Post("check-in")
  @ParkingCapabilities(PARKING_CAPABILITIES.CHECK_IN)
  async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() dto: ParkingScanDto,
  ) {
    const result = await this.service.checkIn(
      user,
      req.parking,
      dto.token,
      dto.locationId,
    );
    return {
      success: true,
      message: result.message,
      data: {
        bookingReference: result.booking.bookingReference,
        vehicleNumber: result.booking.vehicleNumber,
        status: result.booking.status,
        checkedInAt: result.booking.checkedInAt,
        assignedSlotNumber: result.booking.assignedSlotNumber,
        exitAt: result.booking.exitAt,
      },
    };
  }

  @Post("check-out")
  @ParkingCapabilities(PARKING_CAPABILITIES.CHECK_OUT)
  async checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() dto: ParkingCheckoutScanDto,
  ) {
    const result = await this.service.checkOut(
      user,
      req.parking,
      dto.token,
      dto.locationId,
      dto.overstayPaymentMethod,
    );
    return {
      success: true,
      message: result.message,
      data: {
        bookingReference: result.booking.bookingReference,
        vehicleNumber: result.booking.vehicleNumber,
        status: result.booking.status,
        checkedInAt: result.booking.checkedInAt,
        checkedOutAt: result.booking.checkedOutAt,
        actualDurationMinutes: result.booking.actualDurationMinutes,
        overstay: {
          minutes: result.overstay.overstayMinutes,
          chargeableHours: result.overstay.chargeableHours,
          amount: result.overstay.totalAmount,
        },
        releasedSlot: result.booking.assignedSlotNumber,
      },
    };
  }

  @Post("lookup")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_BOOKING)
  async lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ParkingRequest,
    @Body() dto: ParkingVehicleLookupDto,
  ) {
    const b = await this.service.lookup(
      user,
      req.parking,
      dto.locationId,
      dto.vehicleNumber,
    );
    return { success: true, data: b };
  }

  @Get("logs")
  @ParkingCapabilities(PARKING_CAPABILITIES.VIEW_REPORTS)
  async scanLogs(
    @Req() req: ParkingRequest,
    @Query() query: Record<string, string>,
  ) {
    const filter: Record<string, any> = req.parking.isPlatformAdmin
      ? {}
      : { locationId: { $in: req.parking.locationIds } };
    if (query.locationId) filter.locationId = query.locationId;
    if (query.result) filter.result = query.result;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const [data, total] = await Promise.all([
      this.logs
        .find(filter)
        .populate("scannedByUserId", "name email")
        .populate("locationId", "name slug")
        .sort({ scannedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.logs.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }
}
