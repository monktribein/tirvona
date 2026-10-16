import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { BookingsModule } from "../bookings/bookings.module";
import { ParkingModule } from "../parking/parking.module";
import { AartiModule } from "../aarti/aarti.module";
import { DayStayModule } from "../day-stay/day-stay.module";
import { FoodModule } from "../food/food.module";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { ProvidersModule } from "../providers/providers.module";
import { PaymentWebhookEventSchema } from "./infrastructure/persistence/payment-webhook-event.schema";
import { PaymentsWebhookService } from "./application/payments-webhook.service";
import { PaymentsWebhookController } from "./presentation/payments-webhook.controller";

/// Cross-cutting Razorpay webhook receiver. Imports the payment-taking
/// modules (rather than owning their booking/order logic itself) so the
/// webhook can delegate to each module's own `confirmPaymentFromWebhook`,
/// keeping payment-confirmation business rules defined in exactly one place
/// per module — this layer only resolves "which module owns this order" and
/// verifies the webhook is genuinely from Razorpay.
@Module({
  imports: [
    OrmModule.forFeature([
      { name: "PaymentWebhookEvent", schema: PaymentWebhookEventSchema },
    ]),
    BookingsModule,
    ParkingModule,
    AartiModule,
    DayStayModule,
    MarketplaceModule,
    ProvidersModule,
    FoodModule,
  ],
  controllers: [PaymentsWebhookController],
  providers: [PaymentsWebhookService],
})
export class PaymentsModule {}
