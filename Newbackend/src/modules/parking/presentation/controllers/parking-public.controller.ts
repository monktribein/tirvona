import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Public } from "../../../../common/decorators/public.decorator";
import { PARKING_MODEL } from "../../domain/parking.constants";
import { ParkingDiscoveryService } from "../../application/parking-discovery.service";
import { ParkingPricingService } from "../../application/parking-pricing.service";
import {
  ParkingQuoteDto,
  ParkingSearchDto,
  ParkingWindowDto,
  OptionalParkingWindowDto,
} from "../dtos/parking.dto";

@ApiTags("Parking Discovery")
@Public()
@Controller("parking")
export class ParkingPublicController {
  constructor(
    private readonly discovery: ParkingDiscoveryService,
    private readonly pricing: ParkingPricingService,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.SlotType) private readonly slotTypes: Model<any>,
    @InjectModel(PARKING_MODEL.Review) private readonly reviews: Model<any>,
  ) {}

  @Get("vehicle-types") async vehicleTypes() {
    return { success: true, data: await this.discovery.vehicleTypeList() };
  }
  @Get("filters") filters() {
    return { success: true, data: this.discovery.filters() };
  }
  @Get("locations") search(@Query() query: ParkingSearchDto) {
    return this.discovery.search(query);
  }

  @Get("locations/:id/availability")
  async availability(
    @Param("id") id: string,
    @Query() query: ParkingWindowDto,
  ) {
    const location = await this.locations.findOne({
      _id: id,
      status: "active",
    });
    if (!location) throw new NotFoundException("Parking not found.");
    return {
      success: true,
      data: {
        locationId: location._id,
        slotTypes: await this.discovery.availabilityFor(
          location,
          query.vehicleType,
          query.entryAt,
          query.exitAt,
        ),
      },
    };
  }

  @Get("locations/:id/reviews")
  async locationReviews(
    @Param("id") id: string,
    @Query() query: ParkingSearchDto,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const filter = { locationId: id, status: "approved" };
    const [data, total] = await Promise.all([
      this.reviews
        .find(filter)
        .populate("customerId", "name avatarUrl")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.reviews.countDocuments(filter),
    ]);
    return { success: true, count: data.length, total, data };
  }

  @Get("locations/:idOrSlug")
  async detail(
    @Param("idOrSlug") idOrSlug: string,
    @Query() query: OptionalParkingWindowDto,
  ) {
    const data = await this.discovery.detail(idOrSlug, query);
    if (!data) throw new NotFoundException("Parking not found.");
    return { success: true, data };
  }

  @Post("quote")
  async quote(@Body() dto: ParkingQuoteDto) {
    const [location, slotType] = await Promise.all([
      this.locations.findOne({ _id: dto.locationId, status: "active" }),
      this.slotTypes.findOne({
        _id: dto.slotTypeId,
        locationId: dto.locationId,
        isActive: true,
      }),
    ]);
    if (!location) throw new NotFoundException("Parking not found.");
    if (!slotType) throw new NotFoundException("Parking area not found.");
    const result = await this.pricing.quote(location, slotType, dto);
    if (!result.ok)
      return { success: false, code: result.code, message: result.message };
    return { success: true, data: result.quote };
  }
}
