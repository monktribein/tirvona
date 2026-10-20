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
import { FoodVendorService } from "../application/food-vendor.service";
import { FoodFinanceService } from "../application/food-finance.service";
import { FoodPartnerService } from "../application/food-partner.service";
import { FoodWalletService } from "../application/food-wallet.service";
import {
  FoodMenuItemDto,
  FoodMenuItemUpdateDto,
  FoodOutletInputDto,
  FoodOutletUpdateDto,
  RegisterFoodVendorDto,
  UpdateFoodVendorDto,
} from "./food-partner.dto";
import { FoodWalletOrdersQueryDto } from "./food-wallet.dto";

@Controller("v1/food/vendor")
export class FoodVendorController {
  constructor(
    private readonly orderService: FoodOrderService,
    private readonly vendorService: FoodVendorService,
    private readonly financeService: FoodFinanceService,
    private readonly partner: FoodPartnerService,
    private readonly wallet: FoodWalletService,
  ) {}

  // ---- Restaurant owner self-service (scoped to the caller's own restaurant)

  /** The caller's restaurant and outlets, or null when they have not registered one. */
  @Get("profile")
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.partner.getMyProfile(user.id);
  }

  /** Sign up as a restaurant owner. Stays pending until Super Admin approves. */
  @Post("register")
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterFoodVendorDto,
  ) {
    return this.partner.register({ id: user.id, isAdmin: false }, dto);
  }

  @Patch("profile")
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFoodVendorDto,
  ) {
    return this.partner.updateVendor({ id: user.id, isAdmin: false }, dto);
  }

  @Post("outlets")
  async addOutlet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FoodOutletInputDto,
  ) {
    return this.partner.addOutlet({ id: user.id, isAdmin: false }, dto);
  }

  @Patch("outlets/:id")
  async updateOutlet(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FoodOutletUpdateDto,
  ) {
    return this.partner.updateOutlet({ id: user.id, isAdmin: false }, id, dto);
  }

  @Get("outlets/:id/menu")
  async listMenu(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.listMenu({ id: user.id, isAdmin: false }, id);
  }

  @Post("outlets/:id/menu")
  async createMenuItem(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FoodMenuItemDto,
  ) {
    return this.partner.createMenuItem({ id: user.id, isAdmin: false }, id, dto);
  }

  @Patch("menu/:id")
  async updateMenuItem(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FoodMenuItemUpdateDto,
  ) {
    return this.partner.updateMenuItem({ id: user.id, isAdmin: false }, id, dto);
  }

  @Delete("menu/:id")
  async deleteMenuItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.deleteMenuItem({ id: user.id, isAdmin: false }, id);
  }

  @Get("orders")
  async getOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
  ) {
    return this.orderService.getVendorOrders(user.id, status);
  }

  @Post("orders/:id/accept")
  async acceptOrder(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orderService.vendorAcceptOrder(id, user.id);
  }

  @Post("orders/:id/reject")
  async rejectOrder(
    @Param("id") id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orderService.vendorRejectOrder(id, user.id, body.reason);
  }

  @Patch("orders/:id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { status: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orderService.updateVendorOrderStatus(id, user.id, body.status);
  }

  @Get("outlets/mine")
  async getMyOutlets(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorService.getMyOutlets(user.id);
  }

  @Patch("outlets/:id/status")
  async toggleOutletStatus(
    @Param("id") id: string,
    @Body() body: { isPaused: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorService.toggleOutletPause(id, user.id, body.isPaused);
  }

  @Patch("variants/:id/availability")
  async toggleVariantAvailability(
    @Param("id") id: string,
    @Body() body: { isAvailable: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorService.toggleVariantAvailability(
      id,
      user.id,
      body.isAvailable,
    );
  }

  @Get("stats")
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorService.getVendorDashboardStats(user.id);
  }

  /** What Tirvona owes this kitchen, what it has paid so far, and each payment with its receipt. */
  @Get("wallet")
  async getWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.walletForOwner(user.id);
  }

  /** The delivered orders behind the wallet, newest first. */
  @Get("wallet/orders")
  async getWalletOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FoodWalletOrdersQueryDto,
  ) {
    return this.wallet.earningsForOwner(user.id, query.page, query.limit);
  }

  @Get("settlements")
  async getSettlements(@CurrentUser() user: AuthenticatedUser) {
    const outlets = await this.vendorService.getMyOutlets(user.id);
    const outletIds = outlets.map((o) => o._id);
    return this.financeService.getSettlements({ outletId: { $in: outletIds } });
  }
}
