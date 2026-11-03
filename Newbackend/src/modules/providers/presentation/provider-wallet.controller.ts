import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ProviderWalletService } from "../application/provider-wallet.service";
import { ProviderLocationService } from "../application/provider-location.service";
import { WALLET_FINANCE_ROLES } from "../domain/provider-wallet.constants";
import { Idempotent } from "../infrastructure/idempotency.interceptor";
import {
  AdminWithdrawalQueryDto,
  MarkWithdrawalPaidDto,
  RejectWithdrawalDto,
  RequestWithdrawalDto,
  SavePayoutAccountDto,
  WalletEntryQueryDto,
  WithdrawalQueryDto,
} from "./dto/wallet.dto";
import { ObjectIdPipe } from "./object-id.pipe";
import { ProviderApi } from "./provider-api.decorator";

/**
 * The provider's own earnings wallet. The wallet is resolved from the
 * signed-in user's provider profile; no wallet or provider id is accepted.
 */
@ProviderApi()
@Controller({ path: "provider/wallet", version: "2" })
export class ProviderWalletController {
  constructor(private readonly wallet: ProviderWalletService) {}

  @Get()
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.summary(user);
  }

  @Get("transactions")
  transactions(@CurrentUser() user: AuthenticatedUser, @Query() query: WalletEntryQueryDto) {
    return this.wallet.listEntries(user, query);
  }

  @Get("payout-account")
  payoutAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.getPayoutAccount(user);
  }

  @Put("payout-account")
  @Idempotent("provider.wallet.payout_account", { sensitive: true })
  savePayoutAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: SavePayoutAccountDto) {
    return this.wallet.savePayoutAccount(user, dto);
  }

  @Get("withdrawals")
  withdrawals(@CurrentUser() user: AuthenticatedUser, @Query() query: WithdrawalQueryDto) {
    return this.wallet.listWithdrawals(user, query);
  }

  @Post("withdrawals")
  @Idempotent("provider.wallet.withdraw")
  withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestWithdrawalDto) {
    return this.wallet.requestWithdrawal(user, dto);
  }

  @Post("withdrawals/:id\\:cancel")
  @Idempotent("provider.wallet.withdraw.cancel")
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", ObjectIdPipe) id: string) {
    return this.wallet.cancelWithdrawal(user, id);
  }
}

/** Finance queue for pandit withdrawals. */
@ProviderApi()
@Roles(...WALLET_FINANCE_ROLES, "hr", "executive")
@Controller({ path: "admin/provider-wallets", version: "2" })
export class AdminProviderWalletController {
  constructor(
    private readonly wallet: ProviderWalletService,
    private readonly location: ProviderLocationService,
  ) {}

  @Get("overview")
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.adminOverview(await this.location.providerIdsFor(user));
  }

  @Get("withdrawals")
  async withdrawals(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminWithdrawalQueryDto) {
    return this.wallet.adminListWithdrawals(query, await this.location.providerIdsFor(user));
  }

  @Post("withdrawals/:id/destination")
  @Idempotent("provider.wallet.admin.destination", { sensitive: true })
  async destination(@CurrentUser() user: AuthenticatedUser, @Param("id", ObjectIdPipe) id: string) {
    await this.location.assertWithdrawal(user, id);
    return this.wallet.adminRevealDestination(user, id);
  }

  @Post("withdrawals/:id\\:processing")
  @Idempotent("provider.wallet.admin.processing")
  async processing(@CurrentUser() user: AuthenticatedUser, @Param("id", ObjectIdPipe) id: string) {
    await this.location.assertWithdrawal(user, id);
    return this.wallet.adminMarkProcessing(user, id);
  }

  @Post("withdrawals/:id\\:mark-paid")
  @Idempotent("provider.wallet.admin.paid")
  async markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ObjectIdPipe) id: string,
    @Body() dto: MarkWithdrawalPaidDto,
  ) {
    await this.location.assertWithdrawal(user, id);
    return this.wallet.adminMarkPaid(user, id, dto);
  }

  @Post("withdrawals/:id\\:reject")
  @Idempotent("provider.wallet.admin.reject")
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ObjectIdPipe) id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    await this.location.assertWithdrawal(user, id);
    return this.wallet.adminReject(user, id, dto);
  }
}
