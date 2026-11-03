import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { FoodOrderService } from "../application/food-order.service";
import { FoodAdminService } from "../application/food-admin.service";
import { FoodFinanceService } from "../application/food-finance.service";
import { FoodPartnerService } from "../application/food-partner.service";
import { FoodWalletService } from "../application/food-wallet.service";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  AdminCreateFoodVendorDto,
  AdminOwnerLoginDto,
  AdminSetPasswordDto,
  FoodMenuItemDto,
  GenerateFoodSettlementsDto,
  FoodMenuItemUpdateDto,
  FoodOutletInputDto,
  FoodOutletUpdateDto,
  FoodVendorListQueryDto,
  FoodVendorStatusDto,
  UpdateFoodVendorDto,
} from "./food-partner.dto";
import {
  FoodWalletOrdersQueryDto,
  RecordFoodPaymentDto,
  VoidFoodPaymentDto,
} from "./food-wallet.dto";
import { FoodLocationService } from "../application/food-location.service";
import { assertWritableInLocation } from "../../../common/auth/location-scope";

const FINANCE = ["super_admin", "finance_manager", "hr", "executive"];
const inIds = (ids: string[] | null, id: unknown) =>
  !ids || ids.includes(String((id as any)?._id ?? id ?? ""));

/**
 * Super Admin food console. Every route here is closed to everyone else by default.
 * An `hr` login gets the same console for the restaurants of its office's area only
 * (see FoodLocationService).
 */
@Roles("super_admin", "hr", "executive")
@Controller("v1/food")
export class FoodAdminController {
  constructor(
    private readonly orderService: FoodOrderService,
    private readonly adminService: FoodAdminService,
    private readonly financeService: FoodFinanceService,
    private readonly partner: FoodPartnerService,
    private readonly wallet: FoodWalletService,
    private readonly location: FoodLocationService,
  ) {}

  // ---- Restaurants: create, approve, edit, and manage their outlets and menu

  @Get("admin/vendors")
  async listVendors(@CurrentUser() user: AuthenticatedUser, @Query() query: FoodVendorListQueryDto) {
    const scope = await this.location.scopeFor(user);
    return this.partner.listVendors(query, await this.location.vendorIds(scope));
  }

  @Post("admin/vendors")
  async createVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreateFoodVendorDto,
  ) {
    const scope = await this.location.scopeFor(user);
    // An HR login can only add a restaurant whose first outlet is in its area.
    if (scope) assertWritableInLocation(scope, dto.outlet?.address);
    return this.partner.createVendorAccount({ id: user.id, isAdmin: true }, dto);
  }

  @Get("admin/vendors/:id")
  async getVendor(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.partner.getVendorForAdmin(id);
  }

  @Patch("admin/vendors/:id")
  async updateVendor(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFoodVendorDto) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.partner.updateVendor({ id: user.id, isAdmin: true }, dto, id);
  }

  /** Creates the owner login for a restaurant that has none. */
  @Post("admin/vendors/:id/owner-login")
  async createOwnerLogin(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminOwnerLoginDto,
  ) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.partner.createOwnerLogin({ id: user.id, isAdmin: true }, id, dto);
  }

  /** Sets a new password for the restaurant owner. */
  @Post("admin/vendors/:id/owner-password")
  async setOwnerPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminSetPasswordDto,
  ) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.partner.setOwnerPassword({ id: user.id, isAdmin: true }, id, dto.password);
  }

  @Post("admin/vendors/:id/status")
  async setVendorStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FoodVendorStatusDto,
  ) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.partner.setVendorStatus({ id: user.id, isAdmin: true }, id, dto);
  }

  @Post("admin/vendors/:id/outlets")
  async addOutlet(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodOutletInputDto) {
    const scope = await this.location.scopeFor(user);
    await this.location.assertVendor(scope, id);
    if (scope) assertWritableInLocation(scope, dto.address);
    return this.partner.addOutlet({ id: user.id, isAdmin: true }, dto, id);
  }

  @Patch("admin/outlets/:id")
  async updateOutlet(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodOutletUpdateDto) {
    const scope = await this.location.scopeFor(user);
    await this.location.assertOutlet(scope, id);
    if (scope && dto.address !== undefined) assertWritableInLocation(scope, dto.address);
    return this.partner.updateOutlet({ id: user.id, isAdmin: true }, id, dto);
  }

  @Patch("admin/outlets/:id/pause")
  async pauseOutlet(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: { isPaused: boolean }) {
    await this.location.assertOutlet(await this.location.scopeFor(user), id);
    return this.partner.setOutletPaused({ id: user.id, isAdmin: true }, id, body.isPaused);
  }

  @Get("admin/outlets/:id/menu")
  async listMenu(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.location.assertOutlet(await this.location.scopeFor(user), id);
    return this.partner.listMenu({ id: user.id, isAdmin: true }, id);
  }

  @Post("admin/outlets/:id/menu")
  async createMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodMenuItemDto) {
    await this.location.assertOutlet(await this.location.scopeFor(user), id);
    return this.partner.createMenuItem({ id: user.id, isAdmin: true }, id, dto);
  }

  @Patch("admin/menu/:id")
  async updateMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodMenuItemUpdateDto) {
    await this.location.assertMenuItem(await this.location.scopeFor(user), id);
    return this.partner.updateMenuItem({ id: user.id, isAdmin: true }, id, dto);
  }

  @Delete("admin/menu/:id")
  async deleteMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.location.assertMenuItem(await this.location.scopeFor(user), id);
    return this.partner.deleteMenuItem({ id: user.id, isAdmin: true }, id);
  }

  @Post("admin/products/approve")
  async approveProduct(
    @Body() body: { productId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.location.assertProduct(await this.location.scopeFor(user), body.productId);
    return this.adminService.approveProduct(body.productId, user.id);
  }

  @Get("admin/orders")
  async getAdminOrders(@CurrentUser() user: AuthenticatedUser, @Query("status") status?: string) {
    const filter: any = {};
    if (status && status !== "ALL") {
      filter.orderStatus = status;
    }
    const outletIds = await this.location.outletIds(await this.location.scopeFor(user));
    if (outletIds) filter.outletId = { $in: outletIds };
    return this.orderService.getAdminOrders(filter);
  }

  @Patch("admin/outlets/:id/commission")
  async updateCommission(
    @Param("id") id: string,
    @Body() body: { commissionRateBps: number; reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.location.assertOutlet(await this.location.scopeFor(user), id);
    return this.adminService.updateOutletCommission(
      id,
      user.id,
      body.commissionRateBps,
      body.reason,
    );
  }

  @Get("admin/exceptions")
  async getExceptions(@CurrentUser() user: AuthenticatedUser) {
    const queue = await this.adminService.getExceptionQueue();
    const outletIds = await this.location.outletIds(await this.location.scopeFor(user));
    if (!outletIds) return queue;
    return {
      vendorExceptions: queue.vendorExceptions.filter((o: any) => inIds(outletIds, o.outletId)),
      pendingRefunds: queue.pendingRefunds.filter((r: any) => inIds(outletIds, r.orderId?.outletId)),
      openComplaints: queue.openComplaints.filter((c: any) => inIds(outletIds, c.outletId)),
    };
  }

  // ---- Kitchen wallets: what Tirvona owes each kitchen, and the payments it has made

  /** Every restaurant's balance, biggest amount owed first. */
  @Roles(...FINANCE)
  @Get("admin/wallets")
  async walletsOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.overview(await this.location.vendorIds(await this.location.scopeFor(user)));
  }

  @Roles(...FINANCE)
  @Get("admin/vendors/:id/wallet")
  async getWallet(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.wallet.walletForAdmin(id);
  }

  @Roles(...FINANCE)
  @Get("admin/vendors/:id/wallet/orders")
  async getWalletOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: FoodWalletOrdersQueryDto,
  ) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.wallet.earningsForAdmin(id, query.page, query.limit);
  }

  /** Records money Tirvona paid the kitchen: with a receipt image, or as cash. */
  @Roles(...FINANCE)
  @Post("admin/vendors/:id/payments")
  async recordPayment(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordFoodPaymentDto,
  ) {
    await this.location.assertVendor(await this.location.scopeFor(user), id);
    return this.wallet.recordPayment({ id: user.id, name: user.name }, id, dto);
  }

  /** Takes a wrongly entered payment out of the totals; it stays in the history as void. */
  @Roles(...FINANCE)
  @Post("admin/payments/:id/void")
  async voidPayment(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoidFoodPaymentDto,
  ) {
    await this.location.assertPayment(await this.location.scopeFor(user), id);
    return this.wallet.voidPayment({ id: user.id, name: user.name }, id, dto.reason);
  }

  @Roles(...FINANCE)
  @Get("finance/settlements")
  async getSettlements(@CurrentUser() user: AuthenticatedUser, @Query("outletId") outletId?: string) {
    const filter: any = {};
    if (outletId) filter.outletId = outletId;
    const outletIds = await this.location.outletIds(await this.location.scopeFor(user));
    if (outletIds) filter.outletId = outletId ? (outletIds.includes(outletId) ? outletId : { $in: [] }) : { $in: outletIds };
    return this.financeService.getSettlements(filter);
  }

  /** Creates settlements for every kitchen with completed, paid orders in the period. */
  @Roles(...FINANCE)
  @Post("finance/settlements/generate")
  async generateSettlements(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateFoodSettlementsDto) {
    const scope = await this.location.scopeFor(user);
    if (scope) {
      // An HR login settles only the kitchens of its area.
      if (dto.outletId) await this.location.assertOutlet(scope, dto.outletId);
      const outletIds = dto.outletId ? [dto.outletId] : ((await this.location.outletIds(scope)) ?? []);
      const settlements: any[] = [];
      for (const outletId of outletIds) {
        const result = await this.financeService.generateSettlements(new Date(dto.from), new Date(dto.to), outletId);
        settlements.push(...result.settlements);
      }
      return { created: settlements.length, settlements };
    }
    return this.financeService.generateSettlements(
      new Date(dto.from),
      new Date(dto.to),
      dto.outletId,
    );
  }

  /** Refreshes the state of bank transfers that were started automatically. */
  @Roles(...FINANCE)
  @Post("finance/settlements/sync")
  async syncAllPayouts(@CurrentUser() user: AuthenticatedUser) {
    const scope = await this.location.scopeFor(user);
    if (!scope) return this.financeService.syncPayouts();
    let synced = 0;
    for (const id of await this.location.syncableSettlementIds(scope))
      synced += (await this.financeService.syncPayouts(id).catch(() => ({ synced: 0 }))).synced;
    return { synced };
  }

  @Roles(...FINANCE)
  @Post("finance/settlements/:id/sync")
  async syncPayout(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.location.assertSettlement(await this.location.scopeFor(user), id);
    return this.financeService.syncPayouts(id);
  }

  /** Tirvona sends the money to the restaurant bank account through RazorpayX. */
  @Roles(...FINANCE)
  @Post("finance/settlements/:id/pay-provider")
  async payViaProvider(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.location.assertSettlement(await this.location.scopeFor(user), id);
    return this.financeService.payViaProvider(id, user.id);
  }

  @Roles(...FINANCE)
  @Post("finance/settlements/:id/approve")
  async approveSettlement(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.location.assertSettlement(await this.location.scopeFor(user), id);
    return this.financeService.approveSettlement(id, user.id);
  }

  @Roles(...FINANCE)
  @Post("finance/settlements/:id/pay")
  async markSettlementPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: { payoutReference: string },
  ) {
    await this.location.assertSettlement(await this.location.scopeFor(user), id);
    return this.financeService.markPayoutPaid(id, body.payoutReference);
  }
}
