import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { PaymentIssuesService } from "../application/payment-issues.service";

export class MarkRefundedDto {
  /** The refund id from the Razorpay dashboard, kept for reconciliation. */
  @IsOptional() @IsString() @MaxLength(100) gatewayRefundId?: string;
}

/** Admin view of money that came in but did not become a booking. */
@Controller("payments/issues")
export class PaymentIssuesController {
  constructor(private readonly service: PaymentIssuesService) {}

  @Get()
  @Roles("super_admin", "national_admin", "finance_manager", "support")
  async list(@Query("limit") limit?: string) {
    return { success: true, data: await this.service.list(Number(limit)) };
  }

  @Post("parking/:paymentId/mark-refunded")
  @Roles("super_admin", "finance_manager")
  async markParkingRefunded(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: MarkRefundedDto,
  ) {
    return {
      success: true,
      data: await this.service.markParkingRefunded(
        user,
        paymentId,
        dto.gatewayRefundId,
      ),
    };
  }
}
