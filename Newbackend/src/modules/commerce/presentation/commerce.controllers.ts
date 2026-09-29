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
  ServiceBookingDto,
  ServiceProviderDto,
  UpdateServiceProviderDto,
  WaitlistDto,
} from "./dtos/commerce.dto";

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
