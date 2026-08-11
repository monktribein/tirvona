import {
  Body,
  Controller,
  Delete,
  Get,
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
  AshramDocumentsDto,
  AshramQueryDto,
  SaveAddOnDto,
  SaveAshramDto,
  UpdateAddOnDto,
  UpdateAshramDto,
} from "./dtos/ashram.dto";

/**
 * Add-on editors round-trip the record they loaded, so the saved payload still
 * carries `_id`, `ashramId`, and timestamps. Strip those instead of rejecting
 * the request the way the global pipe would.
 */
const addOnBody = new ValidationPipe({ transform: true, whitelist: true });

@ApiTags("Ashrams")
@Controller("ashrams")
export class AshramsController {
  constructor(private readonly service: AshramsService) {}
  @Public() @Get() list(@Query() query: AshramQueryDto) {
    return this.service.publicList(query);
  }
  @Get("my-listings/all")
  @ApiBearerAuth()
  @Roles("owner", "manager", "super_admin")
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.listForUser(user);
    return { success: true, count: data.length, data };
  }
  /**
   * The destinations ashrams are actually located in, each with a count.
   *
   * Backs the two-step location picker: a destination is chosen first, then
   * only the ashrams in it are offered. Derived from `address.city` rather
   * than a fixed list, so a new city appears the moment its first ashram is
   * published and an emptied one disappears. Declared before `:id` so the
   * literal segment cannot be swallowed by the detail route.
   */
  @Public() @Get("destinations") async destinations() {
    const data = await this.service.destinations();
    return { success: true, count: data.length, data };
  }
  /** The ashrams in one destination, slimmed to what a picker renders. */
  @Public() @Get("destinations/:city") async byDestination(
    @Param("city") city: string,
  ) {
    const data = await this.service.byDestination(city);
    return { success: true, count: data.length, data };
  }
  @Get("manage/:id")
  @ApiBearerAuth()
  @Roles("owner", "manager", "super_admin")
  async managedDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.service.managedDetail(user, id) };
  }
  @Public() @Get(":id") async detail(@Param("id") id: string) {
    return { success: true, data: await this.service.detail(id) };
  }
  @Post() @ApiBearerAuth() @Roles("owner", "super_admin") async create(
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
  @Put(":id") @ApiBearerAuth() @Roles("owner", "manager") async update(
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
  @Roles("owner", "manager")
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
  // Add-on mutations answer with the ashram's whole catalogue: the owner
  // console renders the list straight from the response.
  @Post(":id/add-ons") @Roles("owner", "manager") async createAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(addOnBody) body: SaveAddOnDto,
  ) {
    const data = await this.service.createAddOn(user, id, body);
    return { success: true, message: "Add-on saved.", count: data.length, data };
  }
  @Put(":id/add-ons/:addonId") @Roles("owner", "manager") async updateAddon(
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
  @Delete(":id/add-ons/:addonId") @Roles("owner", "manager") async deleteAddon(
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
