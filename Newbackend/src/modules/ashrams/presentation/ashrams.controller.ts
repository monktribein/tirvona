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
  SaveAshramDto,
} from "./dtos/ashram.dto";

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
    const filter =
      user.role === "super_admin"
        ? {}
        : user.role === "owner"
          ? { ownerId: user.id }
          : { _id: { $in: user.scopedAshramIds } };
    const data = await this.service.ashrams
      .find(filter)
      .sort({ createdAt: -1 });
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
    @Body() dto: SaveAshramDto,
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
    const ashram = await this.service.ashrams.findById(id);
    if (!ashram) return { success: false, message: "Ashram not found" };
    this.service.assertScope(user, ashram);
    ashram.documents = { ...ashram.documents?.toObject?.(), ...body };
    await ashram.save();
    return {
      success: true,
      message: "Documents uploaded.",
      data: ashram.documents,
    };
  }
  @Public() @Get(":id/add-ons") async addons(@Param("id") id: string) {
    const data = await this.service.addons.find({ ashramId: id });
    return { success: true, count: data.length, data };
  }
  @Post(":id/add-ons") @Roles("owner", "manager") async createAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: Record<string, any>,
  ) {
    const ashram = await this.service.ashrams.findById(id);
    this.service.assertScope(user, ashram);
    return {
      success: true,
      data: await this.service.addons.create({
        ...body,
        ashramId: id,
        createdBy: user.id,
      }),
    };
  }
  @Put(":id/add-ons/:addonId") @Roles("owner", "manager") async updateAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("addonId") addonId: string,
    @Body() body: Record<string, any>,
  ) {
    const ashram = await this.service.ashrams.findById(id);
    this.service.assertScope(user, ashram);
    return {
      success: true,
      data: await this.service.addons.findOneAndUpdate(
        { _id: addonId, ashramId: id },
        { $set: body },
        { new: true },
      ),
    };
  }
  @Delete(":id/add-ons/:addonId") @Roles("owner", "manager") async deleteAddon(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("addonId") addonId: string,
  ) {
    const ashram = await this.service.ashrams.findById(id);
    this.service.assertScope(user, ashram);
    await this.service.addons.deleteOne({ _id: addonId, ashramId: id });
    return { success: true, message: "Add-on removed." };
  }
}
