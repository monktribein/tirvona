import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { BookingFinanceService } from "../application/booking-finance.service";
import {
  CompleteSettlementDto,
  CreateSettlementDto,
  ProcessRefundDto,
} from "./dtos/booking-finance.dto";
@Controller("booking-finance")
export class BookingFinanceController {
  constructor(private readonly service: BookingFinanceService) {}
  @Get("summary")
  @Roles("owner", "finance_manager", "super_admin")
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ownerId") ownerId?: string,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.service.summary(user, ownerId, ashramId),
    };
  }
  @Get("payments")
  @Roles("owner", "finance_manager", "super_admin")
  async payments(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.service.paymentList(user, ashramId),
    };
  }
  @Get("settlements")
  @Roles("owner", "finance_manager", "super_admin")
  async settlements(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ownerId") ownerId?: string,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.service.list(user, ownerId, ashramId),
    };
  }
  @Post("settlements")
  @Roles("owner", "finance_manager", "super_admin")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSettlementDto,
  ) {
    return { success: true, data: await this.service.create(user, dto) };
  }
  @Post("settlements/:id/complete")
  @Roles("super_admin")
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CompleteSettlementDto,
  ) {
    return { success: true, data: await this.service.complete(user, id, dto) };
  }
  @Get("refunds")
  @Roles("owner", "finance_manager", "support", "super_admin")
  async refunds(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.service.refundQueue(user, ashramId),
    };
  }
  @Post("refunds/:id/process")
  @Roles("finance_manager", "super_admin")
  async process(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ProcessRefundDto,
  ) {
    return {
      success: true,
      data: await this.service.processRefund(user, id, dto),
    };
  }
}
