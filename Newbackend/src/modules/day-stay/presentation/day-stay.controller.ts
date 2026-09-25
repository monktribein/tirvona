import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { DayStayProductsService } from "../application/day-stay-products.service";
import { DayStayInventoryService } from "../application/day-stay-inventory.service";
import { DayStayBookingService } from "../application/day-stay-booking.service";
import { DayStayVendorService } from "../application/day-stay-vendor.service";
import {
  DayStayAvailabilityQueryDto,
  DayStayHoldDto,
  DayStayConfirmPaymentDto,
  DayStayVendorBlockDto,
  DayStayConfigUpdateDto,
} from "./dtos/day-stay.dto";

@Controller("day-stay")
export class DayStayController {
  constructor(
    private readonly productsService: DayStayProductsService,
    private readonly inventoryService: DayStayInventoryService,
    private readonly bookingService: DayStayBookingService,
    private readonly vendorService: DayStayVendorService,
  ) {}

  @Public()
  @Get("products")
  async getProducts() {
    return this.productsService.getActiveProducts();
  }

  @Public()
  @Get("availability")
  async getAvailability(@Query() query: DayStayAvailabilityQueryDto) {
    if (!query.roomId) {
      return { slots: [] };
    }
    const slots = await this.inventoryService.getRoomSlots(
      query.ashramId,
      query.roomId,
      query.date,
      query.productCode,
    );
    return { slots };
  }

  @Post("hold")
  async holdSlot(
    @Body() dto: DayStayHoldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingService.holdSlot(dto, user.id);
  }

  @Post("confirm")
  async confirmPayment(
    @Body() dto: DayStayConfirmPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingService.confirmPayment(dto, user.id);
  }

  @Roles("owner", "stay_admin", "ashram_staff", "admin", "super_admin")
  @Post("vendor/block")
  async blockDayStay(
    @Body() dto: DayStayVendorBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorService.blockDayStay(dto, user);
  }

  @Roles("owner", "stay_admin", "ashram_staff", "admin", "super_admin")
  @Get("vendor/radar")
  async getLiveRadar(
    @Query("ashramId") ashramId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorService.getLiveRadar(ashramId, user);
  }

  @Roles("owner", "stay_admin", "ashram_staff", "admin", "super_admin")
  @Get("vendor/config/:ashramId")
  async getConfig(
    @Param("ashramId") ashramId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorService.getConfig(ashramId, user);
  }

  @Roles("owner", "stay_admin", "admin", "super_admin")
  @Put("vendor/config/:ashramId")
  async updateConfig(
    @Param("ashramId") ashramId: string,
    @Body() dto: DayStayConfigUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorService.updateConfig(ashramId, dto, user);
  }
}
