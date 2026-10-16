import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { payoutConfig } from "../payouts/config/payout.config";
import { BankAccountCrypto } from "../payouts/infrastructure/bank-account.crypto";
import { RazorpayXPayoutProvider } from "../payouts/providers/razorpayx-payout.provider";
import { OrmModule } from "../../database/orm-nest";
import {
  FoodCartItemSchema,
  FoodCartSchema,
  FoodDeliveryTaskSchema,
  FoodLedgerEntrySchema,
  FoodOrderEventSchema,
  FoodOrderItemSchema,
  FoodOrderSchema,
  FoodOutletSchema,
  FoodPaymentAttemptSchema,
  FoodProductSchema,
  FoodProductVariantSchema,
  FoodQuoteSchema,
  FoodRefundSchema,
  FoodReviewAndComplaintSchema,
  FoodServiceZoneSchema,
  FoodSettlementSchema,
  FoodVendorDocumentSchema,
  FoodVendorSchema,
} from "./infrastructure/food.schemas";
import { BookingSchema } from "../bookings/infrastructure/persistence/booking.schemas";
import { FoodCatalogService } from "./application/food-catalog.service";
import { FoodQuoteService } from "./application/food-quote.service";
import { FoodOrderService } from "./application/food-order.service";
import { FoodPaymentService } from "./application/food-payment.service";
import { FoodFinanceService } from "./application/food-finance.service";
import { FoodVendorService } from "./application/food-vendor.service";
import { FoodAdminService } from "./application/food-admin.service";
import { FoodPartnerService } from "./application/food-partner.service";
import { UserSchema } from "../users/infrastructure/persistence/user.schema";
import { FoodPublicController } from "./presentation/food-public.controller";
import { FoodVendorController } from "./presentation/food-vendor.controller";
import { FoodAdminController } from "./presentation/food-admin.controller";
import { FoodWebhookController } from "./presentation/food-webhook.controller";

@Module({
  imports: [
    ConfigModule.forFeature(payoutConfig),
    OrmModule.forFeature([
      { name: "FoodVendor", schema: FoodVendorSchema },
      { name: "FoodOutlet", schema: FoodOutletSchema },
      { name: "FoodProduct", schema: FoodProductSchema },
      { name: "FoodProductVariant", schema: FoodProductVariantSchema },
      { name: "FoodCart", schema: FoodCartSchema },
      { name: "FoodCartItem", schema: FoodCartItemSchema },
      { name: "FoodQuote", schema: FoodQuoteSchema },
      { name: "FoodOrder", schema: FoodOrderSchema },
      { name: "FoodOrderItem", schema: FoodOrderItemSchema },
      { name: "FoodOrderEvent", schema: FoodOrderEventSchema },
      { name: "FoodPaymentAttempt", schema: FoodPaymentAttemptSchema },
      { name: "FoodDeliveryTask", schema: FoodDeliveryTaskSchema },
      { name: "FoodRefund", schema: FoodRefundSchema },
      { name: "FoodLedgerEntry", schema: FoodLedgerEntrySchema },
      { name: "FoodSettlement", schema: FoodSettlementSchema },
      { name: "FoodServiceZone", schema: FoodServiceZoneSchema },
      { name: "FoodVendorDocument", schema: FoodVendorDocumentSchema },
      {
        name: "FoodReviewAndComplaint",
        schema: FoodReviewAndComplaintSchema,
      },
      { name: "Booking", schema: BookingSchema },
      { name: "User", schema: UserSchema },
    ]),
  ],
  controllers: [
    FoodPublicController,
    FoodVendorController,
    FoodAdminController,
    FoodWebhookController,
  ],
  providers: [
    BankAccountCrypto,
    RazorpayXPayoutProvider,
    FoodCatalogService,
    FoodQuoteService,
    FoodOrderService,
    FoodPaymentService,
    FoodFinanceService,
    FoodVendorService,
    FoodAdminService,
    FoodPartnerService,
  ],
  exports: [
    FoodCatalogService,
    FoodQuoteService,
    FoodOrderService,
    FoodPaymentService,
    FoodFinanceService,
    FoodVendorService,
    FoodAdminService,
  ],
})
export class FoodModule {}
