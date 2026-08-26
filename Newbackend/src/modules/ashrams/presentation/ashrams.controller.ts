import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { AshramsService } from "../application/ashrams.service";
import {
  AshramSlugService,
  ashramPath,
} from "../application/ashram-slug.service";
import {
  AshramDocumentsDto,
  AshramQueryDto,
  SaveAddOnDto,
  SaveAshramDto,
  UpdateAddOnDto,
  UpdateAshramDto,
} from "./dtos/ashram.dto";

const addOnBody = new ValidationPipe({ transform: true, whitelist: true });

@ApiTags("Ashrams")
@Controller("ashrams")
export class AshramsController {
  constructor(
    private readonly service: AshramsService,
    private readonly slugs: AshramSlugService,
  ) {}
  @Public() @Get() @Header("Cache-Control", "no-store") list(@Query() query: AshramQueryDto) {
    return this.service.publicList(query);
  }
  @Get("my-listings/all")
  @ApiBearerAuth()
  @Roles("owner", "stay_admin", "manager", "offer_manager", "super_admin")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.listForUser(user);
    return { success: true, count: data.length, data };
  }
  @Get("owner-parking")
  @ApiBearerAuth()
  @Roles("owner")
  async ownerParking(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.ownerParking(user) };
  }
  @Post("owner-parking")
  @ApiBearerAuth()
  @Roles("owner")
  async onboardOwnerParking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, any>,
  ) {
    return {
      success: true,
      message: "Parking partner access created. New parking remains pending until Super Admin approval.",
      data: await this.service.onboardOwnerParking(user, body),
    };
  }
  @Public() @Get("destinations") async destinations() {
    const data = await this.service.destinations();
    return { success: true, count: data.length, data };
  }
  @Public() @Get("destinations/:city") async byDestination(
    @Param("city") city: string,
  ) {
    const data = await this.service.byDestination(city);
    return { success: true, count: data.length, data };
  }
  @Get("manage/:id")
  @ApiBearerAuth()
  @Roles("owner", "stay_admin", "manager", "super_admin")
  async managedDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.managedDetail(user, id) };
  }
  @Public()
  @Get("by-slug/:city/:slug")
  @Header("Cache-Control", "no-store")
  async bySlug(@Param("city") city: string, @Param("slug") slug: string) {
    const ashram = await this.slugs.findByPath(city, slug);
    if (!ashram) throw new NotFoundException("Ashram not found");
    const parts = await this.slugs.ensureSlug(ashram);
    return {
      success: true,
      canonicalPath: parts ? ashramPath(parts) : null,
      data: await this.service.detail(String(ashram._id)),
    };
  }

  @Public() @Get(":id") @Header("Cache-Control", "no-store") async detail(@Param("id") id: string) {
    return { success: true, data: await this.service.detail(id) };
  }
  @Post() @ApiBearerAuth() @Roles("owner", "stay_admin", "super_admin") async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveAshramDto,
  ) {
    const result = await this.service.create(user, dto);
    return {
      success: true,
      message: "Ashram submitted for review.",
      data: result.ashram,
      roomsCreated: result.roomsCreated,
    };
  }
  @Put(":id") @ApiBearerAuth() @Roles("owner", "stay_admin", "manager") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAshramDto,
  ) {
    return {
      success: true,
      message: "Ashram updated.",
      data: await this.service.update(user, id, dto),
    };
  }
  @Post(":id/documents")
  @ApiBearerAuth()
  @Roles("owner", "stay_admin", "manager")
  async documents(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: AshramDocumentsDto,
  ) {
    const result = await this.service.saveDocuments(user, id, body);
    return {
      success: true,
      message: result.reopened
        ? "Documents uploaded. Your application is back in the verification queue."
        : "Documents uploaded.",
      data: result.documents,
      status: result.status,
    };
  }
  @Public() @Get(":id/add-ons") async addons(@Param("id") id: string) {
    const data = await this.service.listAddOns(id);
    return { success: true, count: data.length, data };
  }
  @Post(":id/add-ons") @Roles("owner", "stay_admin", "manager") async createAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(addOnBody) body: SaveAddOnDto,
  ) {
    const data = await this.service.createAddOn(user, id, body);
    return { success: true, message: "Add-on saved.", count: data.length, data };
  }
  @Put(":id/add-ons/:addonId") @Roles("owner", "stay_admin", "manager") async updateAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("addonId") addonId: string,
    @Body(addOnBody) body: UpdateAddOnDto,
  ) {
    const data = await this.service.updateAddOn(user, id, addonId, body);
    return {
      success: true,
      message: "Add-on updated.",
      count: data.length,
      data,
    };
  }
  @Delete(":id/add-ons/:addonId") @Roles("owner", "stay_admin", "manager") async deleteAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("addonId") addonId: string,
  ) {
    const data = await this.service.deleteAddOn(user, id, addonId);
    return {
      success: true,
      message: "Add-on removed.",
      count: data.length,
      data,
    };
  }
}
