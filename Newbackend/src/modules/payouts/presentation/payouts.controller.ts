import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { PayoutsService } from "../application/payouts.service";
import {
  CreatePayoutRequestDto,
  PayoutListQueryDto,
  RecordManualPayoutDto,
  RevealManualPayoutBankDetailsDto,
  SavePayoutBankAccountDto,
} from "./payout.dto";

@Controller("payouts")
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get("ashrams")
  @Roles("owner", "stay_admin", "finance_manager", "super_admin")
  async ashrams(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.payouts.availableAshrams(user) };
  }

  @Get("summary")
  @Roles("owner", "stay_admin", "finance_manager", "super_admin")
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    return { success: true, data: await this.payouts.summary(user, ashramId) };
  }

  @Get("bank-account/:ashramId")
  @Roles("owner", "stay_admin", "super_admin")
  async bank(@CurrentUser() user: AuthenticatedUser, @Param("ashramId") ashramId: string) {
    return { success: true, data: await this.payouts.getBankAccount(user, ashramId) };
  }

  @Get("bank-accounts")
  @Roles("owner", "stay_admin", "super_admin")
  async banks(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.payouts.bankAccountCoverage(user) };
  }

  @Put("bank-account/:ashramId")
  @Roles("owner", "stay_admin")
  async saveBank(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ashramId") ashramId: string,
    @Body() dto: SavePayoutBankAccountDto,
  ) {
    return { success: true, data: await this.payouts.saveBankAccount(user, ashramId, dto) };
  }

  @Post("requests")
  @Roles("owner", "stay_admin")
  async request(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePayoutRequestDto) {
    return { success: true, data: await this.payouts.createRequest(user, dto) };
  }

  @Get("provider-status")
  @Roles("super_admin")
  providerStatus(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: this.payouts.providerStatus(user) };
  }

  @Get()
  @Roles("owner", "stay_admin", "finance_manager", "super_admin")
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: PayoutListQueryDto) {
    return { success: true, data: await this.payouts.list(user, query) };
  }

  @Get(":id")
  @Roles("owner", "stay_admin", "finance_manager", "super_admin")
  async get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.payouts.get(user, id) };
  }

  @Post(":id/process")
  @Roles("super_admin")
  async process(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.payouts.process(user, id) };
  }

  @Post(":id/manual-bank-details")
  @Roles("super_admin")
  @Header("Cache-Control", "no-store, private")
  @Header("Pragma", "no-cache")
  async revealManualBankDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RevealManualPayoutBankDetailsDto,
  ) {
    return {
      success: true,
      data: await this.payouts.revealManualBankDetails(user, id, dto.reason),
    };
  }

  @Post(":id/manual-payment")
  @Roles("super_admin")
  async recordManualPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RecordManualPayoutDto,
  ) {
    return { success: true, data: await this.payouts.recordManualPayment(user, id, dto) };
  }

  @Post(":id/reconcile")
  @Roles("super_admin")
  async reconcile(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.payouts.reconcile(user, id) };
  }

  @Public()
  @Post("webhooks/razorpayx")
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature = "",
    @Headers("x-razorpay-event-id") eventId = "",
    @Body() body: any,
  ) {
    const rawBody = request.rawBody;
    if (!rawBody) throw new UnauthorizedException("Raw webhook body is unavailable");
    this.payouts.verifyWebhook(rawBody, signature);
    await this.payouts.handleWebhook(eventId, String(body?.event ?? "unknown"), body);
    return { success: true };
  }
}
