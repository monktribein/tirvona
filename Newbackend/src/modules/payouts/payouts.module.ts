import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { PayoutReconciliationService } from "./application/payout-reconciliation.service";
import { PayoutsService } from "./application/payouts.service";
import { payoutConfig } from "./config/payout.config";
import { PAYOUT_PROVIDER } from "./domain/payout.constants";
import { BankAccountCrypto } from "./infrastructure/bank-account.crypto";
import { PAYOUT_MODELS } from "./infrastructure/payout.schemas";
import { RazorpayXPayoutProvider } from "./providers/razorpayx-payout.provider";
import { PayoutsController } from "./presentation/payouts.controller";

@Module({
  imports: [
    ConfigModule.forFeature(payoutConfig),
    MongooseModule.forFeature(PAYOUT_MODELS),
    AshramsModule,
    BookingsModule,
  ],
  controllers: [PayoutsController],
  providers: [
    BankAccountCrypto,
    RazorpayXPayoutProvider,
    { provide: PAYOUT_PROVIDER, useExisting: RazorpayXPayoutProvider },
    PayoutsService,
    PayoutReconciliationService,
  ],
  exports: [PayoutsService],
})
export class PayoutsModule {}
