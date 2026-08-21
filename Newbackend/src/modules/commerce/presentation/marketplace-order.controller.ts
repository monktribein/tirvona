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

@Controller("marketplace")
export class MarketplaceOrderController {
  constructor(private readonly service: MarketplaceOrderService) {}

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

  @Post("cart/quote")
  @HttpCode(200)
  async quote(@Body() dto: CreateMarketplaceOrderDto) {
    return { success: true, data: await this.service.quote(dto.items) };
  }

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
    const order = await this.service.confirmPayment(user, id, dto);
    return {
      success: true,
      message: "Payment verified successfully and marketplace order confirmed.",
      data: order,
    };
  }
}
