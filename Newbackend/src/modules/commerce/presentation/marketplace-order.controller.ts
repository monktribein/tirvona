import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { MarketplaceOrderService } from "../application/marketplace-order.service";
import {
  AddressDto,
  ConfirmMarketplacePaymentDto,
  CreateMarketplaceOrderDto,
  MarketplaceOrderQueryDto,
  UpdateAddressDto,
} from "./dtos/marketplace-order.dto";

/**
 * Every route here requires a session — the global JwtAuthGuard sees no
 * `@Public()` — and the service scopes each query to the caller. A pilgrim
 * reaching `GET /marketplace/orders/:id` for someone else's order gets a 404,
 * because the ownership filter is part of the query rather than a check run
 * after the document is already loaded.
 */
@Controller("marketplace")
export class MarketplaceOrderController {
  constructor(private readonly service: MarketplaceOrderService) {}

  // ── Address book ─────────────────────────────────────────────────────────
  @Get("addresses")
  addresses(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listAddresses(user).then((data) => ({
      success: true,
      count: data.length,
      data,
    }));
  }

  @Post("addresses")
  async addAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddressDto,
  ) {
    return { success: true, data: await this.service.createAddress(user, dto) };
  }

  @Put("addresses/:id")
  async editAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return {
      success: true,
      data: await this.service.updateAddress(user, id, dto),
    };
  }

  @Delete("addresses/:id")
  removeAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.deleteAddress(user, id);
  }

  // ── Cart pricing ─────────────────────────────────────────────────────────
  /**
   * Price a basket without committing to it, so the cart shows the same totals
   * the order will use. Prices come from the catalogue, never from the client.
   */
  @Post("cart/quote")
  @HttpCode(200)
  async quote(@Body() dto: CreateMarketplaceOrderDto) {
    return { success: true, data: await this.service.quote(dto.items) };
  }

  // ── Orders ───────────────────────────────────────────────────────────────
  @Post("orders")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMarketplaceOrderDto,
  ) {
    return { success: true, data: await this.service.create(user, dto) };
  }

  @Get("orders")
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MarketplaceOrderQueryDto,
  ) {
    const result = await this.service.list(user, query);
    return { success: true, ...result };
  }

  @Get("orders/:id")
  async one(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.get(user, id) };
  }

  @Post("orders/:id/cancel")
  @HttpCode(200)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("reason") reason: string,
  ) {
    return { success: true, data: await this.service.cancel(user, id, reason) };
  }

  @Put("orders/:id/status")
  @Roles("super_admin", "national_admin", "marketplace_manager")
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return {
      success: true,
      data: await this.service.updateStatus(user, id, status),
    };
  }

  // ── Payment ──────────────────────────────────────────────────────────────
  @Post("orders/:id/payment/order")
  @HttpCode(200)
  async paymentOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, ...(await this.service.paymentOrder(user, id)) };
  }

  @Post("orders/:id/payment")
  @HttpCode(200)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ConfirmMarketplacePaymentDto,
  ) {
    return {
      success: true,
      data: await this.service.confirmPayment(user, id, dto),
    };
  }
}
