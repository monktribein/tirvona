import { ConfirmFoodPaymentDto } from "./food-partner.dto";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Public } from "../../../common/decorators/public.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { FoodCatalogService } from "../application/food-catalog.service";
import { FoodQuoteService } from "../application/food-quote.service";
import { FoodOrderService } from "../application/food-order.service";
import { FoodPaymentService } from "../application/food-payment.service";

@Controller("v1/food")
export class FoodPublicController {
  constructor(
    private readonly catalogService: FoodCatalogService,
    private readonly quoteService: FoodQuoteService,
    private readonly orderService: FoodOrderService,
    private readonly paymentService: FoodPaymentService,
  ) {}

  @Public()
  @Get("discovery")
  async getDiscovery(
    @Query("zoneCode") zoneCode?: string,
    @Query("family") family?: string,
    @Query("dietaryTag") dietaryTag?: string,
    @Query("search") search?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.catalogService.getDiscovery({
      zoneCode,
      family,
      dietaryTag,
      search,
      outletId,
    });
  }

  @Public()
  @Get("zones")
  async getZones() {
    return this.catalogService.getServiceZones();
  }

  @Public()
  @Get("outlets/:id/menu")
  async getOutletMenu(@Param("id") id: string) {
    return this.catalogService.getOutletMenu(id);
  }

  @Public()
  @Post("quotes")
  async createQuote(
    @Body()
    body: {
      outletId: string;
      items: Array<{
        variantId: string;
        quantity: number;
        customerNotes?: string;
      }>;
      fulfilmentType: "pickup" | "vendor_delivery" | "stay_delivery";
      destinationAddress?: string;
      stayBookingId?: string;
      stayRoomNumber?: string;
      zoneCode?: string;
      sessionId?: string;
    },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.quoteService.generateQuote({
      ...body,
      customerId: user?.id,
    });
  }

  @Public()
  @Post("orders")
  async createOrder(
    @Body()
    body: {
      quoteId: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      deliveryAddress?: string;
      deliveryInstructions?: string;
      stayBookingId?: string;
      stayRoomNumber?: string;
      sessionId?: string;
    },
    @Headers("x-idempotency-key") idempotencyHeader?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const idempotencyKey =
      idempotencyHeader || (body as any).idempotencyKey || `IDEM-${Date.now()}`;

    return this.orderService.createOrder({
      ...body,
      idempotencyKey,
      customerId: user?.id,
    });
  }

  @Public()
  @Get("orders/:id")
  async getOrder(
    @Param("id") id: string,
    @Query("sessionId") sessionId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.orderService.getAuthorizedOrder(id, {
      userId: user?.id,
      role: user?.role,
      sessionId,
    });
  }

  @Public()
  @Post("orders/:id/cancel")
  async cancelOrder(
    @Param("id") id: string,
    @Body() body: { reason?: string; sessionId?: string },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const actorId = user?.id || body.sessionId || "guest";
    return this.orderService.cancelOrder(id, actorId, body.reason || "");
  }

  /** Browser callback after Razorpay checkout; trusted only because of its signature. */
  @Public()
  @Post("payments/:orderId/confirm")
  async confirmPayment(
    @Param("orderId") orderId: string,
    @Body() dto: ConfirmFoodPaymentDto,
  ) {
    return this.paymentService.confirmPayment(orderId, dto);
  }

  @Public()
  @Post("payments/:orderId/checkout")
  async createPaymentSession(@Param("orderId") orderId: string) {
    return this.paymentService.createPaymentSession(orderId);
  }

  @Get("customer/orders")
  async getCustomerOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.orderService.getCustomerOrders(user.id);
  }

  @Public()
  @Get("openapi.json")
  getOpenApiSpec() {
    return {
      openapi: "3.1.0",
      info: {
        title: "Tirvona Food & Dining Marketplace API",
        version: "3.0.0",
        description:
          "Mission FTC / Tirvona Bhojan Pilot Marketplace API for Vrindavan and Mathura. Adheres to Tirvona_Food_Product_and_Technical_Blueprint_V3.docx",
      },
      servers: [{ url: "/api/v1/food" }],
      paths: {
        "/discovery": {
          get: {
            summary: "Launch catalogue by zone, meal family, time and outlet",
            responses: { "200": { description: "Outlets and meals" } },
          },
        },
        "/outlets/{id}/menu": {
          get: {
            summary: "Approved outlet menu and availability",
            responses: { "200": { description: "Outlet menu categories" } },
          },
        },
        "/quotes": {
          post: {
            summary: "Authoritative checkout quote",
            responses: { "201": { description: "Calculated quote in paise" } },
          },
        },
        "/orders": {
          post: {
            summary: "Create order with idempotency key",
            responses: { "201": { description: "Created order" } },
          },
        },
        "/orders/{id}": {
          get: {
            summary: "Authorized order tracking and details",
            responses: { "200": { description: "Order details and timeline" } },
          },
        },
        "/orders/{id}/cancel": {
          post: {
            summary: "Authorized cancellation request",
            responses: { "200": { description: "Cancelled order" } },
          },
        },
        "/vendor/orders/{id}/accept": {
          post: {
            summary: "Vendor acceptance within SLA timer",
            responses: { "200": { description: "Accepted order" } },
          },
        },
        "/vendor/orders/{id}/reject": {
          post: {
            summary: "Vendor rejection with reason",
            responses: { "200": { description: "Rejected order and refund initiated" } },
          },
        },
        "/vendor/orders/{id}/status": {
          patch: {
            summary: "Preparation and ready lifecycle update",
            responses: { "200": { description: "Updated order" } },
          },
        },
        "/admin/products/approve": {
          post: {
            summary: "Approve controlled catalogue product/variant",
            responses: { "200": { description: "Approved product" } },
          },
        },
        "/admin/orders": {
          get: {
            summary: "Operations exception queue",
            responses: { "200": { description: "Exception orders" } },
          },
        },
        "/webhooks/payments/{provider}": {
          post: {
            summary: "Verified payment gateway webhook",
            responses: { "200": { description: "Webhook processed" } },
          },
        },
        "/finance/settlements": {
          get: {
            summary: "Finance settlement review",
            responses: { "200": { description: "Settlements list" } },
          },
        },
      },
    };
  }
}
