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

const FINANCE = ["super_admin", "finance_manager"];

/** Super Admin food console. Every route here is closed to everyone else by default. */
@Roles("super_admin")
@Controller("v1/food")
export class FoodAdminController {
  constructor(
    private readonly orderService: FoodOrderService,
    private readonly adminService: FoodAdminService,
    private readonly financeService: FoodFinanceService,
    private readonly partner: FoodPartnerService,
    private readonly wallet: FoodWalletService,
  ) {}

  // ---- Restaurants: create, approve, edit, and manage their outlets and menu

  @Get("admin/vendors")
  async listVendors(@Query() query: FoodVendorListQueryDto) {
    return this.partner.listVendors(query);
  }

  @Post("admin/vendors")
  async createVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreateFoodVendorDto,
  ) {
    return this.partner.createVendorAccount({ id: user.id, isAdmin: true }, dto);
  }

  @Get("admin/vendors/:id")
  async getVendor(@Param("id") id: string) {
    return this.partner.getVendorForAdmin(id);
  }

  @Patch("admin/vendors/:id")
  async updateVendor(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFoodVendorDto) {
    return this.partner.updateVendor({ id: user.id, isAdmin: true }, dto, id);
  }

  /** Creates the owner login for a restaurant that has none. */
  @Post("admin/vendors/:id/owner-login")
  async createOwnerLogin(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminOwnerLoginDto,
  ) {
    return this.partner.createOwnerLogin({ id: user.id, isAdmin: true }, id, dto);
  }

  /** Sets a new password for the restaurant owner. */
  @Post("admin/vendors/:id/owner-password")
  async setOwnerPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminSetPasswordDto,
  ) {
    return this.partner.setOwnerPassword({ id: user.id, isAdmin: true }, id, dto.password);
  }

  @Post("admin/vendors/:id/status")
  async setVendorStatus(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FoodVendorStatusDto,
  ) {
    return this.partner.setVendorStatus({ id: user.id, isAdmin: true }, id, dto);
  }

  @Post("admin/vendors/:id/outlets")
  async addOutlet(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodOutletInputDto) {
    return this.partner.addOutlet({ id: user.id, isAdmin: true }, dto, id);
  }

  @Patch("admin/outlets/:id")
  async updateOutlet(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodOutletUpdateDto) {
    return this.partner.updateOutlet({ id: user.id, isAdmin: true }, id, dto);
  }

  @Patch("admin/outlets/:id/pause")
  async pauseOutlet(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() body: { isPaused: boolean }) {
    return this.partner.setOutletPaused({ id: user.id, isAdmin: true }, id, body.isPaused);
  }

  @Get("admin/outlets/:id/menu")
  async listMenu(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.listMenu({ id: user.id, isAdmin: true }, id);
  }

  @Post("admin/outlets/:id/menu")
  async createMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodMenuItemDto) {
    return this.partner.createMenuItem({ id: user.id, isAdmin: true }, id, dto);
  }

  @Patch("admin/menu/:id")
  async updateMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: FoodMenuItemUpdateDto) {
    return this.partner.updateMenuItem({ id: user.id, isAdmin: true }, id, dto);
  }

  @Delete("admin/menu/:id")
  async deleteMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.deleteMenuItem({ id: user.id, isAdmin: true }, id);
  }

  @Post("admin/products/approve")
  async approveProduct(
    @Body() body: { productId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.approveProduct(body.productId, user.id);
  }

  @Get("admin/orders")
  async getAdminOrders(@Query("status") status?: string) {
    const filter: any = {};
    if (status && status !== "ALL") {
      filter.orderStatus = status;
    }
    return this.orderService.getAdminOrders(filter);
  }

  @Patch("admin/outlets/:id/commission")
  async updateCommission(
    @Param("id") id: string,
    @Body() body: { commissionRateBps: number; reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.updateOutletCommission(
      id,
      user.id,
      body.commissionRateBps,
      body.reason,
    );
  }

  @Get("admin/exceptions")
  async getExceptions() {
    return this.adminService.getExceptionQueue();
  }

  // ---- Kitchen wallets: what Tirvona owes each kitchen, and the payments it has made

  /** Every restaurant's balance, biggest amount owed first. */
  @Roles(...FINANCE)
  @Get("admin/wallets")
  async walletsOverview() {
    return this.wallet.overview();
  }

  @Roles(...FINANCE)
  @Get("admin/vendors/:id/wallet")
  async getWallet(@Param("id") id: string) {
    return this.wallet.walletForAdmin(id);
  }

  @Roles(...FINANCE)
  @Get("admin/vendors/:id/wallet/orders")
  async getWalletOrders(@Param("id") id: string, @Query() query: FoodWalletOrdersQueryDto) {
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
    return this.wallet.voidPayment({ id: user.id, name: user.name }, id, dto.reason);
  }

  @Roles(...FINANCE)
  @Get("finance/settlements")
  async getSettlements(@Query("outletId") outletId?: string) {
    const filter: any = {};
    if (outletId) filter.outletId = outletId;
    return this.financeService.getSettlements(filter);
  }

  /** Creates settlements for every kitchen with completed, paid orders in the period. */
  @Roles(...FINANCE)
  @Post("finance/settlements/generate")
  async generateSettlements(@Body() dto: GenerateFoodSettlementsDto) {
    return this.financeService.generateSettlements(
      new Date(dto.from),
      new Date(dto.to),
      dto.outletId,
    );
  }

  /** Refreshes the state of bank transfers that were started automatically. */
  @Roles(...FINANCE)
  @Post("finance/settlements/sync")
  async syncAllPayouts() {
    return this.financeService.syncPayouts();
  }

  @Roles(...FINANCE)
  @Post("finance/settlements/:id/sync")
  async syncPayout(@Param("id") id: string) {
    return this.financeService.syncPayouts(id);
  }

  /** Tirvona sends the money to the restaurant bank account through RazorpayX. */
  @Roles(...FINANCE)
  @Post("finance/settlements/:id/pay-provider")
  async payViaProvider(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financeService.payViaProvider(id, user.id);
  }

  @Roles(...FINANCE)
  @Post("finance/settlements/:id/approve")
  async approveSettlement(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financeService.approveSettlement(id, user.id);
  }

  @Roles(...FINANCE)
  @Post("finance/settlements/:id/pay")
  async markSettlementPaid(
    @Param("id") id: string,
    @Body() body: { payoutReference: string },
  ) {
    return this.financeService.markPayoutPaid(id, body.payoutReference);
  }
}
