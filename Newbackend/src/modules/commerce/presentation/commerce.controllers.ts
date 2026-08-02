import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CommerceService } from "../application/commerce.service";
import {
  MarketplaceOrderDto,
  ProductDto,
  ServiceBookingDto,
  ServiceProviderDto,
  UpdateProductDto,
  UpdateServiceProviderDto,
  WaitlistDto,
} from "./dtos/commerce.dto";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly commerce: CommerceService) {}
  @Public() @Get("categories") categories() {
    return this.commerce.categories();
  }
  @Public() @Get("category/:slug") category(@Param("slug") slug: string) {
    return this.commerce.category(slug);
  }
  @Public() @Get("products") products(@Query() query: Record<string, string>) {
    return this.commerce.products(query);
  }
  @Public() @Get("products/:idOrSlug") product(@Param("idOrSlug") id: string) {
    return this.commerce.product(id);
  }
  @Post("order") @Roles("customer", "owner", "manager", "super_admin") order(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarketplaceOrderDto,
  ) {
    return this.commerce.order(user, dto);
  }
  @Post("products")
  @Roles("super_admin", "owner", "manager", "marketplace_manager")
  create(@Body() dto: ProductDto) {
    return this.commerce.createProduct(dto);
  }
  @Put("products/:id")
  @Roles("super_admin", "owner", "manager", "marketplace_manager")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.commerce.updateProduct(id, dto);
  }
  @Delete("products/:id")
  @Roles("super_admin", "owner", "manager", "marketplace_manager")
  remove(@Param("id") id: string) {
    return this.commerce.deleteProduct(id);
  }
}

@Controller("marketplace/hub")
export class MarketplaceHubController {
  constructor(private readonly commerce: CommerceService) {}
  @Public() @Post("waitlist") waitlist(@Body() dto: WaitlistDto) {
    return this.commerce.waitlist(dto);
  }
  @Public() @Post("newsletter") newsletter(@Body() dto: WaitlistDto) {
    return this.commerce.waitlist(dto);
  }
}

@Controller("enterprise-services")
export class EnterpriseServicesController {
  constructor(private readonly commerce: CommerceService) {}
  @Public() @Get() list(@Query() query: Record<string, string>) {
    return this.commerce.providers(query);
  }
  @Public() @Get(":id") one(@Param("id") id: string) {
    return this.commerce.provider(id);
  }
  @Post("book") @Roles("customer", "owner", "manager", "super_admin") book(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ServiceBookingDto,
  ) {
    return this.commerce.bookService(user, dto);
  }
  @Post() @Roles("super_admin", "owner", "manager", "service_manager") create(
    @Body() dto: ServiceProviderDto,
  ) {
    return this.commerce.createProvider(dto);
  }
  @Put(":id")
  @Roles("super_admin", "owner", "manager", "service_manager")
  update(@Param("id") id: string, @Body() dto: UpdateServiceProviderDto) {
    return this.commerce.updateProvider(id, dto);
  }
  @Delete(":id")
  @Roles("super_admin", "owner", "manager", "service_manager")
  remove(@Param("id") id: string) {
    return this.commerce.deleteProvider(id);
  }
}
