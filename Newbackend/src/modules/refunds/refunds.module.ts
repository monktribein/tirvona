import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
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
    OrmModule.forFeature(REFUND_MODELS),
    BookingsModule,
    AshramsModule,
  ],
  controllers: [RefundsController, RefundPoliciesController],
  providers: [RefundsService, RefundPolicyService],
  exports: [OrmModule, RefundsService],
})
export class RefundsModule {}
