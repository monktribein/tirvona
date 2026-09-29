import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CategoryService } from "../application/category.service";
import { DashboardService } from "../application/dashboard.service";
import { LedgerService } from "../application/ledger.service";
import { MarketplaceSettingsService } from "../application/marketplace-settings.service";
import { OrderService } from "../application/order.service";
import { PayoutService } from "../application/payout.service";
import { ProductService } from "../application/product.service";
import { ReviewService } from "../application/review.service";
import { VendorService } from "../application/vendor.service";
import {
  AdjustmentDto,
  CreateCategoryDto,
  LedgerQueryDto,
  MarkPayoutPaidDto,
  OrderQueryDto,
  PayoutQueryDto,
  ProductDisableDto,
  ProductQueryDto,
  ProductReviewDecisionDto,
  ReasonDto,
  ReorderCategoriesDto,
  ResolveReturnDto,
  ReviewDocumentDto,
  ReviewQueryDto,
  ReviewStatusDto,
  UpdateCategoryDto,
  UpdateFulfillmentDto,
  UpdateSettingsDto,
  VendorAdminQueryDto,
  VendorActionDto,
  VendorCommissionDto,
  VerifyBankAccountDto,
} from "./marketplace.dto";

const FINANCE = ["super_admin", "finance_manager"];

/**
 * Super Admin marketplace console, on the existing JWT + RolesGuard
 * (super_admin always passes; marketplace_manager runs day-to-day ops;
 * money movement is limited to super_admin / finance_manager).
 */
@ApiTags("Marketplace Admin")
@ApiBearerAuth()
@Roles("super_admin", "marketplace_manager")
@Controller("marketplace/admin")
export class MarketplaceAdminController {
  constructor(
    private readonly vendors: VendorService,
    private readonly products: ProductService,
    private readonly categories: CategoryService,
    private readonly orders: OrderService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutService,
    private readonly settings: MarketplaceSettingsService,
    private readonly reviews: ReviewService,
    private readonly dashboard: DashboardService,
  ) {}

  // ----------------------------------------------------------- overview
  @Get("overview")
  async overview() {
    return { success: true, data: await this.dashboard.adminOverview() };
  }

  // ------------------------------------------------------------ vendors
  @Get("vendors")
  async vendorsList(@Query() query: VendorAdminQueryDto) {
    return { success: true, ...(await this.vendors.adminList(query)) };
  }

  @Get("vendors/:id")
  async vendor(@Param("id") id: string) {
    return { success: true, data: await this.vendors.adminGet(id) };
  }

  /** action: start_review | approve | reject | suspend | reactivate (reject/suspend need a reason). */
  @Post("vendors/:id/status")
  @HttpCode(200)
  async vendorAction(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: VendorActionDto) {
    return { success: true, data: await this.vendors.adminSetStatus(user, id, dto.action, dto.reason) };
  }

  @Put("vendors/:id/commission")
  @Roles("super_admin")
  async vendorCommission(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: VendorCommissionDto) {
    return { success: true, data: await this.vendors.adminSetCommission(user, id, dto.commissionPercent ?? null) };
  }

  @Patch("documents/:id")
  async reviewDocument(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReviewDocumentDto) {
    return { success: true, data: await this.vendors.adminReviewDocument(user, id, dto.status, dto.note) };
  }

  @Patch("bank-accounts/:id")
  @Roles(...FINANCE)
  async verifyBank(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: VerifyBankAccountDto) {
    return { success: true, data: await this.vendors.adminVerifyBankAccount(user, id, dto.status) };
  }

  @Get("vendors/:id/wallet")
  @Roles("super_admin", "finance_manager", "marketplace_manager")
  async vendorWallet(@Param("id") id: string) {
    return { success: true, data: await this.payouts.vendorSummary(id) };
  }

  @Get("vendors/:id/ledger")
  @Roles("super_admin", "finance_manager", "marketplace_manager")
  async vendorLedger(@Param("id") id: string, @Query() query: LedgerQueryDto) {
    await this.vendors.adminGet(id); // 404 for unknown vendor
    return { success: true, ...(await this.ledger.list(id, query)) };
  }

  @Post("vendors/:id/adjustments")
  @Roles(...FINANCE)
  async adjust(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AdjustmentDto) {
    await this.vendors.adminGet(id);
    return { success: true, data: await this.ledger.adjust(user, id, dto.direction, dto.amount, dto.reason) };
  }

  // ----------------------------------------------------------- products
  @Get("products")
  async productsList(@Query() query: ProductQueryDto) {
    return { success: true, ...(await this.products.adminList(query)) };
  }

  @Get("products/:id")
  async product(@Param("id") id: string) {
    return { success: true, data: await this.products.adminGet(id) };
  }

  @Post("products/:id/review")
  @HttpCode(200)
  async reviewProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ProductReviewDecisionDto) {
    return { success: true, data: await this.products.adminReview(user, id, dto.decision, dto.reason) };
  }

  @Post("products/:id/disable")
  @HttpCode(200)
  async disableProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ProductDisableDto) {
    return { success: true, data: await this.products.adminSetDisabled(user, id, dto.disabled, dto.reason) };
  }

  // --------------------------------------------------------- categories
  @Get("categories")
  async categoriesList() {
    return { success: true, data: await this.categories.adminList() };
  }

  @Post("categories")
  async createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto) {
    return { success: true, data: await this.categories.create(user, dto) };
  }

  @Put("categories/:id")
  async updateCategory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return { success: true, data: await this.categories.update(user, id, dto) };
  }

  @Post("categories/reorder")
  @HttpCode(200)
  async reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderCategoriesDto) {
    return { success: true, data: await this.categories.reorder(user, dto.order) };
  }

  // ------------------------------------------------------------- orders
  @Get("orders")
  async ordersList(@Query() query: OrderQueryDto) {
    return { success: true, ...(await this.orders.adminList(query)) };
  }

  @Get("orders/:id")
  async order(@Param("id") id: string) {
    return { success: true, data: await this.orders.adminGet(id) };
  }

  @Get("vendor-orders")
  async vendorOrders(@Query() query: OrderQueryDto) {
    return { success: true, ...(await this.orders.adminListVendorOrders(query)) };
  }

  @Patch("vendor-orders/:id/fulfillment")
  async fulfil(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateFulfillmentDto) {
    return { success: true, data: await this.orders.adminUpdateFulfillment(user, id, dto) };
  }

  @Post("vendor-orders/:id/return")
  @HttpCode(200)
  async resolveReturn(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ResolveReturnDto) {
    return { success: true, data: await this.orders.adminResolveReturn(user, id, dto.approve, dto.note) };
  }

  @Post("vendor-orders/:id/retry-refund")
  @HttpCode(200)
  @Roles(...FINANCE)
  async retryRefund(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.orders.adminRetryRefund(user, id) };
  }

  @Post("orders/expire-stale")
  @HttpCode(200)
  async expireStale() {
    return { success: true, data: { expired: await this.orders.expireStaleOrders() } };
  }

  // ------------------------------------------------------------ finance
  @Get("finance/commission")
  @Roles("super_admin", "finance_manager", "marketplace_manager")
  async commission(@Query("vendorId") vendorId?: string) {
    return { success: true, data: await this.ledger.commissionSummary(vendorId) };
  }

  @Get("payouts")
  @Roles("super_admin", "finance_manager", "marketplace_manager")
  async payoutsList(@Query() query: PayoutQueryDto) {
    return { success: true, ...(await this.payouts.adminList(query)) };
  }

  @Post("payouts/:id/approve")
  @HttpCode(200)
  @Roles(...FINANCE)
  async approvePayout(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.payouts.adminApprove(user, id) };
  }

  @Post("payouts/:id/sync")
  @HttpCode(200)
  @Roles(...FINANCE)
  async syncPayout(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.payouts.adminSync(user, id) };
  }

  @Post("payouts/:id/mark-paid")
  @HttpCode(200)
  @Roles(...FINANCE)
  async markPaid(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: MarkPayoutPaidDto) {
    return { success: true, data: await this.payouts.adminMarkPaid(user, id, dto.utr) };
  }

  @Post("payouts/:id/mark-failed")
  @HttpCode(200)
  @Roles(...FINANCE)
  async markFailed(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReasonDto) {
    return { success: true, data: await this.payouts.adminMarkFailed(user, id, dto.reason ?? "") };
  }

  // ------------------------------------------------------------ reviews
  @Get("reviews")
  async reviewsList(@Query() query: ReviewQueryDto) {
    return { success: true, ...(await this.reviews.list(query)) };
  }

  @Patch("reviews/:id")
  async reviewStatus(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReviewStatusDto) {
    return { success: true, data: await this.reviews.adminSetStatus(user, id, dto.status) };
  }

  // ----------------------------------------------------------- settings
  @Get("settings")
  async getSettings() {
    return { success: true, data: await this.settings.get() };
  }

  @Put("settings")
  @Roles("super_admin")
  async updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsDto) {
    return { success: true, data: await this.settings.update(dto, user) };
  }
}
