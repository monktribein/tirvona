import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BookingsModule } from "../bookings/bookings.module";
import { ParkingModule } from "../parking/parking.module";
import { CommerceModule } from "../commerce/commerce.module";
import { AartiModule } from "../aarti/aarti.module";
import { PaymentWebhookEventSchema } from "./infrastructure/persistence/payment-webhook-event.schema";
import { PaymentsWebhookService } from "./application/payments-webhook.service";
import { PaymentsWebhookController } from "./presentation/payments-webhook.controller";

/// Cross-cutting Razorpay webhook receiver. Imports the four payment-taking
/// modules (rather than owning their booking/order logic itself) so the
/// webhook can delegate to each module's own `confirmPaymentFromWebhook`,
/// keeping payment-confirmation business rules defined in exactly one place
/// per module — this layer only resolves "which module owns this order" and
/// verifies the webhook is genuinely from Razorpay.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "PaymentWebhookEvent", schema: PaymentWebhookEventSchema },
    ]),
    BookingsModule,
    ParkingModule,
    CommerceModule,
    AartiModule,
  ],
  controllers: [PaymentsWebhookController],
  providers: [PaymentsWebhookService],
})
export class PaymentsModule {}
