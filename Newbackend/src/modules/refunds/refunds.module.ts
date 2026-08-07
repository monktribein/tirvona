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

/**
 * Refund management.
 *
 * Owns the `refund_*` collections outright and only READS from the domains it
 * refunds — it never writes another module's financial records except the one
 * status field that has to agree with the customer-visible outcome. That keeps
 * the existing booking and parking ledgers authoritative for their own money.
 */
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
