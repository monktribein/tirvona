import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../../common/decorators/public.decorator";
import { PartnerApiKeyGuard } from "../guards/partner-api-key.guard";
import { PartnerPermissionsGuard } from "../guards/partner-permissions.guard";
import { RequirePartnerPermissions } from "../decorators/partner-permissions.decorator";
import {
  CurrentPartner,
  type AuthenticatedPartnerContext,
} from "../decorators/current-partner.decorator";
import { PartnerApiService } from "../application/partner-api.service";

@ApiTags("Partner API v1")
@ApiSecurity("ApiKeyAuth")
@ApiHeader({
  name: "X-API-Key",
  description: "Cryptographically secure partner API key (tv_test_... or tv_live_...)",
  required: true,
})
@Public() // Bypasses standard user JWT guard; uses PartnerApiKeyGuard instead
@UseGuards(PartnerApiKeyGuard, PartnerPermissionsGuard)
// Version-neutral "v1" prefix like the other public APIs: /api/v1/bookings, ...
@Controller("v1")
export class PartnerV1Controller {
  constructor(private readonly partnerApi: PartnerApiService) {}

  // -------------------------------------------------------------
  // Bookings
  // -------------------------------------------------------------
  @Get("bookings")
  @RequirePartnerPermissions("bookings.read")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "List authorized bookings" })
  @ApiQuery({ name: "ashramId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "startDate", required: false })
  @ApiQuery({ name: "endDate", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listBookings(
    @CurrentPartner() partner: AuthenticatedPartnerContext,
    @Query("ashramId") ashramId?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const data = await this.partnerApi.listBookings(partner, {
      ashramId,
      status,
      startDate,
      endDate,
      page,
      limit,
    });
    return { success: true, ...data };
  }

  @Get("bookings/:id")
  @RequirePartnerPermissions("bookings.read")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Get single booking by ID or Reference" })
  async getBooking(
    @CurrentPartner() partner: AuthenticatedPartnerContext,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      data: await this.partnerApi.getBooking(partner, id),
    };
  }

  // -------------------------------------------------------------
  // Inventory Availability
  // -------------------------------------------------------------
  @Get("inventory/availability")
  @RequirePartnerPermissions("inventory.read")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Query room inventory availability for date range" })
  @ApiQuery({ name: "ashramId", required: true })
  @ApiQuery({ name: "roomId", required: false })
  @ApiQuery({ name: "startDate", required: true })
  @ApiQuery({ name: "endDate", required: true })
  async getAvailability(
    @CurrentPartner() partner: AuthenticatedPartnerContext,
    @Query("ashramId") ashramId: string,
    @Query("roomId") roomId: string | undefined,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    return {
      success: true,
      data: await this.partnerApi.getAvailability(partner, {
        ashramId,
        roomId,
        startDate,
        endDate,
      }),
    };
  }

  // -------------------------------------------------------------
  // Payments Status
  // -------------------------------------------------------------
  @Get("payments/:id/status")
  @RequirePartnerPermissions("payments.read")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: "Get payment status for a booking or transaction ID" })
  async getPaymentStatus(
    @CurrentPartner() partner: AuthenticatedPartnerContext,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      data: await this.partnerApi.getPaymentStatus(partner, id),
    };
  }
}
