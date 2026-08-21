import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { OffersService } from "../application/offers.service";
import {
  SaveOfferDto,
  UpdateOfferDto,
  UpdateOfferStatusDto,
  ValidatePromoDto,
} from "./dtos/booking.dto";

@Controller("offers")
export class OffersController {
  constructor(private readonly service: OffersService) {}
  @Public() @Get() async active(@Query() query: Record<string, string>) {
    const data = await this.service.active(query);
    return {
      success: true,
      data,
      pagination: {
        total: data.length,
        page: Number(query.page) || 1,
        pages: 1,
      },
    };
  }
  @Public() @Get("public/all") async publicAll(
    @Query() query: Record<string, string>,
  ) {
    return { success: true, data: await this.service.active(query) };
  }
  @Post("validate-promo") @Public() @HttpCode(200) async validate(
    @Body() dto: ValidatePromoDto,
  ) {
    return { success: true, data: await this.service.validate(dto) };
  }
  @Get("my-offers")
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.mine(user);
    const now = new Date();
    return {
      success: true,
      stats: {
        totalOffers: data.length,
        activeOffers: data.filter(
          (o: any) => o.status === "active" && new Date(o.validTill) >= now,
        ).length,
        scheduledOffers: data.filter(
          (o: any) => o.status === "scheduled" || new Date(o.validFrom) > now,
        ).length,
        expiredOffers: data.filter(
          (o: any) => o.status === "expired" || new Date(o.validTill) < now,
        ).length,
        redeemedOffers: data.reduce(
          (n: number, o: any) => n + Number(o.redemptionsCount ?? 0),
          0,
        ),
        revenueGenerated: data.reduce(
          (n: number, o: any) => n + Number(o.revenueGenerated ?? 0),
          0,
        ),
      },
      data,
    };
  }
  @Get("manage/:id")
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async manageOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const data = await this.service.one(id, false);
    await this.service.assertReadable(user, data);
    return { success: true, data };
  }
  @Public() @Get("public/:id") async publicOne(@Param("id") id: string) {
    return { success: true, data: await this.service.one(id) };
  }
  @Public() @Get(":id") async one(@Param("id") id: string) {
    return { success: true, data: await this.service.one(id) };
  }
  @Post()
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveOfferDto,
  ) {
    return { success: true, data: await this.service.save(user, dto) };
  }
  @Put(":id")
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return {
      success: true,
      message: "Offer updated successfully",
      data: await this.service.update(user, id, dto),
    };
  }
  @Patch(":id/status")
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return {
      success: true,
      message: `Offer marked as ${dto.status}`,
      data: await this.service.setStatus(user, id, dto.status),
    };
  }
  @Delete(":id")
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const result = await this.service.remove(user, id);
    return {
      success: true,
      message: result.archived
        ? `Offer archived — it was redeemed ${result.redemptions} time(s), so its booking records are preserved`
        : "Offer deleted successfully",
      data: result,
    };
  }
  @Post(":id/duplicate")
  @Roles("owner", "manager", "offer_manager", "super_admin")
  async duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.duplicate(user, id) };
  }
}
