import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { DashboardService } from "../application/dashboard.service";
import { LedgerService } from "../application/ledger.service";
import { OrderService } from "../application/order.service";
import { PayoutService } from "../application/payout.service";
import { ProductService } from "../application/product.service";
import { ReviewService } from "../application/review.service";
import { VendorService } from "../application/vendor.service";
import {
  AddBankAccountDto,
  AddVendorDocumentDto,
  CreateProductDto,
  CreateVendorProfileDto,
  LedgerQueryDto,
  OrderQueryDto,
  PayoutQueryDto,
  ProductQueryDto,
  RequestPayoutDto,
  ReviewQueryDto,
  SetListingDto,
  SetStockDto,
  UpdateFulfillmentDto,
  UpdateProductDto,
  UpdateVendorProfileDto,
} from "./marketplace.dto";

/**
 * Seller console. Any signed-in Tirvona user can create a store; every other
 * route resolves the caller's OWN vendor profile from the auth token and
 * scopes every query to it, so one vendor can never reach another's data.
 */
@ApiTags("Marketplace Vendor")
@ApiBearerAuth()
@Controller("marketplace/vendor")
export class MarketplaceVendorController {
  constructor(
    private readonly vendors: VendorService,
    private readonly products: ProductService,
    private readonly orders: OrderService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutService,
    private readonly dashboard: DashboardService,
    private readonly reviews: ReviewService,
  ) {}

  /** Seller dashboard numbers, all scoped to the caller's own store. */
  @Get("dashboard")
  async dashboardStats(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.dashboard.vendorDashboard(user) };
  }

  // ------------------------------------------------------------ profile
  @Post("profile")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorProfileDto) {
    return { success: true, data: await this.vendors.createProfile(user, dto) };
  }

  @Get("profile")
  async profile(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.vendors.getOwnProfile(user) };
  }

  @Put("profile")
  async update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateVendorProfileDto) {
    return { success: true, data: await this.vendors.updateOwnProfile(user, dto) };
  }

  @Post("profile/submit")
  @HttpCode(200)
  async submit(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.vendors.submitForVerification(user) };
  }

  @Post("profile/activate")
  @HttpCode(200)
  async activate(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.vendors.activate(user) };
  }

  @Post("profile/deactivate")
  @HttpCode(200)
  async deactivate(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.vendors.deactivateOwn(user) };
  }

  @Post("documents")
  async addDocument(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddVendorDocumentDto) {
    return { success: true, data: await this.vendors.addDocument(user, dto) };
  }

  @Delete("documents/:id")
  async removeDocument(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vendors.removeDocument(user, id);
  }

  @Get("bank-accounts")
  async bankAccounts(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.vendors.listBankAccounts(user) };
  }

  @Post("bank-accounts")
  async addBank(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddBankAccountDto) {
    return { success: true, data: await this.vendors.addBankAccount(user, dto) };
  }

  @Post("bank-accounts/:id/default")
  @HttpCode(200)
  async defaultBank(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.vendors.setDefaultBankAccount(user, id) };
  }

  @Delete("bank-accounts/:id")
  async removeBank(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vendors.removeBankAccount(user, id);
  }

  // ----------------------------------------------------------- products
  @Post("products")
  async createProduct(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    return { success: true, data: await this.products.vendorCreate(user, dto) };
  }

  @Get("products")
  async listProducts(@CurrentUser() user: AuthenticatedUser, @Query() query: ProductQueryDto) {
    return { success: true, ...(await this.products.vendorList(user, query)) };
  }

  @Get("products/low-stock")
  async lowStock(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.products.vendorLowStock(user) };
  }

  @Get("products/:id")
  async getProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.products.vendorGet(user, id) };
  }

  @Put("products/:id")
  async updateProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateProductDto) {
    return { success: true, data: await this.products.vendorUpdate(user, id, dto) };
  }

  @Post("products/:id/submit")
  @HttpCode(200)
  async submitProduct(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.products.vendorSubmit(user, id) };
  }

  @Patch("products/:id/listing")
  async listing(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SetListingDto) {
    return { success: true, data: await this.products.vendorSetListing(user, id, dto.listingStatus) };
  }

  @Patch("products/:id/stock")
  async stock(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SetStockDto) {
    return { success: true, data: await this.products.vendorSetStock(user, id, dto.stock, dto.lowStockThreshold) };
  }

  // ------------------------------------------------------------- orders
  @Get("orders")
  async listOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: OrderQueryDto) {
    return { success: true, ...(await this.orders.vendorList(user, query)) };
  }

  @Get("orders/:id")
  async getOrder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.orders.vendorGet(user, id) };
  }

  @Patch("orders/:id/fulfillment")
  async fulfil(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateFulfillmentDto) {
    return { success: true, data: await this.orders.vendorUpdateFulfillment(user, id, dto) };
  }

  // ------------------------------------------------------------ finance
  @Get("wallet")
  async wallet(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.payouts.summary(user) };
  }

  @Get("ledger")
  async ledgerEntries(@CurrentUser() user: AuthenticatedUser, @Query() query: LedgerQueryDto) {
    const vendor = await this.vendors.requireOwnVendor(user);
    return { success: true, ...(await this.ledger.list(vendor._id, query)) };
  }

  @Get("payouts")
  async listPayouts(@CurrentUser() user: AuthenticatedUser, @Query() query: PayoutQueryDto) {
    return { success: true, ...(await this.payouts.listOwn(user, query)) };
  }

  @Post("payouts")
  async requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return { success: true, data: await this.payouts.request(user, dto) };
  }

  @Get("reviews")
  async ownReviews(@CurrentUser() user: AuthenticatedUser, @Query() query: ReviewQueryDto) {
    const vendor = await this.vendors.requireOwnVendor(user);
    return { success: true, ...(await this.reviews.list({ ...query, vendorId: vendor._id })) };
  }

  @Post("payouts/:id/cancel")
  @HttpCode(200)
  async cancelPayout(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.payouts.cancelOwn(user, id) };
  }
}
