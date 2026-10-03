import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { WalletAccountService } from "../application/wallet-account.service";
import { WALLET_ADMIN_ROLES } from "../domain/wallet.constants";
import {
  AdminCreditDto,
  CreateWithdrawalDto,
  MarkWithdrawalPaidDto,
  RejectWithdrawalDto,
  WalletAdminQueryDto,
  WalletTransactionQueryDto,
  WithdrawalDecisionDto,
  WithdrawalQueryDto,
} from "./wallet.dto";

/** The signed-in pilgrim's own wallet. */
@ApiTags("Wallet")
@ApiBearerAuth()
@Controller("wallet")
export class WalletController {
  constructor(private readonly service: WalletAccountService) {}

  @Get()
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.summary(user.id) };
  }

  @Get("transactions")
  async transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletTransactionQueryDto,
  ) {
    return { success: true, ...(await this.service.transactionsFor(user.id, query)) };
  }

  @Get("withdrawals")
  async withdrawals(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.withdrawalsFor(user.id) };
  }

  @Post("withdrawals")
  async requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return {
      success: true,
      message: "Transfer request sent. Our team will process it shortly.",
      data: await this.service.requestWithdrawal(user, dto),
    };
  }

  @Post("withdrawals/:id/cancel")
  @HttpCode(200)
  async cancelWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Transfer request cancelled. The amount is back in your wallet.",
      data: await this.service.cancelWithdrawal(user, id),
    };
  }
}

/** Admin console: every wallet, manual credits, and the transfer queue. */
@ApiTags("Wallet Admin")
@ApiBearerAuth()
@Controller("wallet/admin")
@Roles(...WALLET_ADMIN_ROLES)
export class WalletAdminController {
  constructor(private readonly service: WalletAccountService) {}

  @Get("overview")
  async overview() {
    return { success: true, data: await this.service.overview() };
  }

  @Get("wallets")
  async wallets(@Query() query: WalletAdminQueryDto) {
    return { success: true, ...(await this.service.listWallets(query)) };
  }

  @Get("customers")
  async customers(@Query("search") search: string) {
    return { success: true, data: await this.service.searchCustomers(search) };
  }

  @Get("wallets/:userId")
  async wallet(
    @Param("userId") userId: string,
    @Query() query: WalletTransactionQueryDto,
  ) {
    return { success: true, data: await this.service.walletDetail(userId, query) };
  }

  @Post("credit")
  async credit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreditDto,
  ) {
    return {
      success: true,
      message: "Wallet credited",
      data: await this.service.adminCredit(user, dto),
    };
  }

  @Get("withdrawals")
  async withdrawals(@Query() query: WithdrawalQueryDto) {
    return { success: true, ...(await this.service.listWithdrawals(query)) };
  }

  @Post("withdrawals/:id/approve")
  @HttpCode(200)
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: WithdrawalDecisionDto,
  ) {
    return {
      success: true,
      message: "Request approved",
      data: await this.service.approveWithdrawal(user, id, dto.note),
    };
  }

  @Post("withdrawals/:id/reject")
  @HttpCode(200)
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return {
      success: true,
      message: "Request rejected and amount returned to the wallet",
      data: await this.service.rejectWithdrawal(user, id, dto.reason),
    };
  }

  @Post("withdrawals/:id/paid")
  @HttpCode(200)
  async paid(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: MarkWithdrawalPaidDto,
  ) {
    return {
      success: true,
      message: "Marked as transferred",
      data: await this.service.markWithdrawalPaid(user, id, dto.payoutReference, dto.note),
    };
  }
}
