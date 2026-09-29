import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { OrderService } from "../application/order.service";
import { ReviewService } from "../application/review.service";
import {
  CheckoutDto,
  ConfirmPaymentDto,
  CreateReviewDto,
  OrderQueryDto,
  ReasonDto,
  ReturnRequestDto,
} from "./marketplace.dto";

/** Any signed-in Tirvona user buying from the marketplace. Scoped to the caller's own orders. */
@ApiTags("Marketplace Checkout")
@ApiBearerAuth()
@Controller("marketplace/checkout")
export class MarketplaceCustomerController {
  constructor(
    private readonly orders: OrderService,
    private readonly reviews: ReviewService,
  ) {}

  /** Reserves stock, creates the master order + per-store vendor orders and the Razorpay order. */
  @Post("orders")
  async checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return { success: true, data: await this.orders.checkout(user, dto) };
  }

  @Post("orders/:id/payment")
  @HttpCode(200)
  async confirm(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ConfirmPaymentDto) {
    return { success: true, data: await this.orders.confirmPayment(user, id, dto) };
  }

  @Get("orders")
  async mine(@CurrentUser() user: AuthenticatedUser, @Query() query: OrderQueryDto) {
    return { success: true, ...(await this.orders.listMine(user, query)) };
  }

  @Get("orders/:id")
  async one(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.orders.getMine(user, id) };
  }

  @Post("orders/:id/cancel")
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReasonDto) {
    return { success: true, data: await this.orders.cancelMine(user, id, dto.reason) };
  }

  @Post("vendor-orders/:id/return")
  @HttpCode(200)
  async requestReturn(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReturnRequestDto) {
    return { success: true, data: await this.orders.requestReturn(user, id, dto.reason) };
  }

  @Post("reviews")
  async review(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return { success: true, data: await this.reviews.create(user, dto) };
  }
}
