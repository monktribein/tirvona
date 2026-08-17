import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AshramsModule } from "../ashrams/ashrams.module";
import { PlatformSettingsModule } from "../platform-settings/platform-settings.module";
import { BookingPricingService } from "./application/booking-pricing.service";
import { BookingsService } from "./application/bookings.service";
import { OffersService } from "./application/offers.service";
import { ReviewsService } from "./application/reviews.service";
import { BookingMaintenanceService } from "./application/booking-maintenance.service";
import { BookingFinanceService } from "./application/booking-finance.service";
import { BookingIdentityService } from "./application/booking-identity.service";
import { BookingFinanceController } from "./presentation/booking-finance.controller";
import { BookingIdentityController } from "./presentation/booking-identity.controller";
import {
  BookingIdentityCounterSchema,
  BookingIdentityPropertySchema,
} from "./infrastructure/persistence/booking-identity.schemas";
import { BOOKING_REPOSITORY } from "./domain/booking.repository";
import {
  BookingCommissionSchema,
  BookingInvoiceSchema,
  BookingLedgerSchema,
  BookingPaymentEventSchema,
  BookingPaymentSchema,
  BookingReceiptSchema,
  BookingRefundSchema,
  BookingSettlementSchema,
  BookingTaxRecordSchema,
  BookingTransactionSchema,
} from "./infrastructure/persistence/booking-finance.schemas";
import {
  BookingCheckinSchema,
  BookingCheckoutSchema,
  BookingGuestDetailSchema,
  BookingInventoryHoldSchema,
  BookingRoomAssignmentSchema,
  BookingSchema,
  BookingStatusHistorySchema,
} from "./infrastructure/persistence/booking.schemas";
import {
  BookingAuditLogSchema,
  BookingCouponSchema,
  BookingHolidaySchema,
  BookingNotificationSchema,
  BookingOfferRedemptionSchema,
  BookingPolicySchema,
  BookingReportSchema,
  BookingReviewSchema,
} from "./infrastructure/persistence/booking-support.schemas";
import { MongooseBookingRepository } from "./infrastructure/persistence/mongoose-booking.repository";
import { BookingsController } from "./presentation/bookings.controller";
import { OffersController } from "./presentation/offers.controller";
import { ReviewsController } from "./presentation/reviews.controller";

const models = [
  ["Booking", BookingSchema],
  ["BookingStatusHistory", BookingStatusHistorySchema],
  ["BookingGuestDetail", BookingGuestDetailSchema],
  ["BookingRoomAssignment", BookingRoomAssignmentSchema],
  ["BookingCheckin", BookingCheckinSchema],
  ["BookingCheckout", BookingCheckoutSchema],
  ["BookingInventoryHold", BookingInventoryHoldSchema],
  ["BookingPayment", BookingPaymentSchema],
  ["BookingPaymentEvent", BookingPaymentEventSchema],
  ["BookingTransaction", BookingTransactionSchema],
  ["BookingLedger", BookingLedgerSchema],
  ["BookingCommission", BookingCommissionSchema],
  ["BookingSettlement", BookingSettlementSchema],
  ["BookingRefund", BookingRefundSchema],
  ["BookingInvoice", BookingInvoiceSchema],
  ["BookingReceipt", BookingReceiptSchema],
  ["BookingTaxRecord", BookingTaxRecordSchema],
  ["BookingCoupon", BookingCouponSchema],
  ["BookingOfferRedemption", BookingOfferRedemptionSchema],
  ["BookingNotification", BookingNotificationSchema],
  ["BookingReview", BookingReviewSchema],
  ["BookingPolicy", BookingPolicySchema],
  ["BookingHoliday", BookingHolidaySchema],
  ["BookingAuditLog", BookingAuditLogSchema],
  ["BookingReport", BookingReportSchema],
  ["BookingIdentityProperty", BookingIdentityPropertySchema],
  ["BookingIdentityCounter", BookingIdentityCounterSchema],
].map(([name, schema]) => ({ name: name as string, schema: schema as any }));

@Module({
  imports: [
    AshramsModule,
    PlatformSettingsModule,
    MongooseModule.forFeature(models),
  ],
  controllers: [
    BookingsController,
    OffersController,
    ReviewsController,
    BookingFinanceController,
    BookingIdentityController,
  ],
  providers: [
    BookingPricingService,
    BookingIdentityService,
    BookingsService,
    OffersService,
    ReviewsService,
    BookingMaintenanceService,
    BookingFinanceService,
    MongooseBookingRepository,
    { provide: BOOKING_REPOSITORY, useExisting: MongooseBookingRepository },
  ],
  exports: [BookingsService, BookingPricingService, MongooseModule],
})
export class BookingsModule {}
