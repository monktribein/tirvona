import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { CategoryService } from "../application/category.service";
import { OrderService } from "../application/order.service";
import { ProductService } from "../application/product.service";
import { ReviewService } from "../application/review.service";
import { VendorService } from "../application/vendor.service";
import { PageQueryDto, ProductQueryDto, QuoteDto } from "./marketplace.dto";

/** Public storefront API: only approved, active products of active vendors. */
@ApiTags("Marketplace Store (public)")
@Public()
@Controller("marketplace/store")
export class MarketplacePublicController {
  constructor(
    private readonly products: ProductService,
    private readonly categories: CategoryService,
    private readonly vendors: VendorService,
    private readonly reviews: ReviewService,
    private readonly orders: OrderService,
  ) {}

  @Get("categories")
  async categoryTree() {
    return { success: true, data: await this.categories.publicTree() };
  }

  @Get("products")
  async list(@Query() query: ProductQueryDto) {
    return { success: true, ...(await this.products.publicList(query)) };
  }

  @Get("products/:idOrSlug")
  async one(@Param("idOrSlug") idOrSlug: string) {
    return { success: true, data: await this.products.publicGet(idOrSlug) };
  }

  @Get("products/:id/reviews")
  async productReviews(@Param("id") id: string, @Query() query: PageQueryDto) {
    return { success: true, ...(await this.reviews.listForProduct(id, query)) };
  }

  @Get("vendors/:slug")
  async store(@Param("slug") slug: string) {
    return { success: true, data: await this.vendors.publicStore(slug) };
  }

  /** Server-priced cart preview split by store. */
  @Post("cart/quote")
  @HttpCode(200)
  async quote(@Body() dto: QuoteDto) {
    return { success: true, data: await this.orders.publicQuote(dto.items) };
  }
}
