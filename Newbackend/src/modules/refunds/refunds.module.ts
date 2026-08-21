import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AshramsModule } from "../ashrams/ashrams.module";
import { BookingsModule } from "../bookings/bookings.module";
import { RefundPolicyService } from "./application/refund-policy.service";
import { RefundsService } from "./application/refunds.service";
import { REFUND_MODELS } from "./infrastructure/persistence/refund.schemas";
import {
  RefundPoliciesController,
  RefundsController,
} from "./presentation/refunds.controller";

@Module({
  imports: [
    MongooseModule.forFeature(REFUND_MODELS),
    BookingsModule,
    AshramsModule,
  ],
  controllers: [RefundsController, RefundPoliciesController],
  providers: [RefundsService, RefundPolicyService],
  exports: [MongooseModule, RefundsService],
})
export class RefundsModule {}
