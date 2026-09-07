import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { TemplesService } from "../application/temples.service";
import { CreateTempleDto, UpdateTempleDto, CreateAartiDto, CreateFestivalDto } from "./dtos/temple.dto";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

@Controller("temples")
export class TemplesController {
  constructor(private readonly templesService: TemplesService) {}

  // Public Routes — reachable without a session (the app applies JwtAuthGuard
  // globally, so each anonymous route must opt out explicitly).
  @Public()
  @Get()
  async getPublicTemples(@Query() query: any) {
    // Force status to published for public queries unless hit via admin route
    query.public = true;
    const result = await this.templesService.findAll(query);
    return { success: true, data: result };
  }

  @Public()
  @Get("nearby")
  async getNearbyByCoordinates(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("radius") radius: string
  ) {
    if (!lat || !lng) {
      return { success: false, message: "Latitude and longitude are required" };
    }
    const radiusKm = radius ? parseFloat(radius) : 10; // Default to 10km for global search
    const nearby = await this.templesService.findNearbyEntitiesByCoords(
      parseFloat(lng),
      parseFloat(lat),
      radiusKm
    );
    return { success: true, data: nearby };
  }

  @Public()
  @Get("slug/:slug")
  async getTempleBySlug(@Param("slug") slug: string) {
    const temple = await this.templesService.findOneBySlug(slug, true);
    return { success: true, data: temple };
  }

  @Public()
  @Get(":id/aartis")
  async getTempleAartis(@Param("id") id: string) {
    const aartis = await this.templesService.getAartis(id, true);
    return { success: true, data: aartis };
  }

  @Public()
  @Get(":id/festivals")
  async getTempleFestivals(@Param("id") id: string) {
    const festivals = await this.templesService.getFestivals(id);
    return { success: true, data: festivals };
  }

  @Public()
  @Get(":id/nearby")
  async getNearbyEntities(@Param("id") id: string, @Query("radius") radius: string) {
    const radiusKm = radius ? parseFloat(radius) : 5;
    const nearby = await this.templesService.findNearbyEntities(id, radiusKm);
    return { success: true, data: nearby };
  }

  // Admin Routes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Get("admin/all")
  async getAllTemplesAdmin(@Query() query: any) {
    const result = await this.templesService.findAll(query);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Post("admin")
  async createTemple(@Body() dto: CreateTempleDto, @CurrentUser() user: AuthenticatedUser) {
    const temple = await this.templesService.create(dto, user);
    return { success: true, data: temple };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Get("admin/:id")
  async getTempleByIdAdmin(@Param("id") id: string) {
    const temple = await this.templesService.findOneById(id);
    return { success: true, data: temple };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Patch("admin/:id")
  async updateTemple(@Param("id") id: string, @Body() dto: UpdateTempleDto, @CurrentUser() user: AuthenticatedUser) {
    const temple = await this.templesService.update(id, dto, user);
    return { success: true, data: temple };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Delete("admin/:id")
  async deleteTemple(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.templesService.delete(id, user);
    return { success: true, message: "Temple deleted successfully" };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Get("admin/:id/aartis")
  async getTempleAartisAdmin(@Param("id") id: string) {
    return { success: true, data: await this.templesService.getAartis(id, false) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Get("admin/:id/festivals")
  async getTempleFestivalsAdmin(@Param("id") id: string) {
    return { success: true, data: await this.templesService.getFestivals(id, false) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Post("admin/:id/aartis")
  async addAarti(@Param("id") id: string, @Body() dto: CreateAartiDto, @CurrentUser() user: AuthenticatedUser) {
    const aarti = await this.templesService.addAarti(id, dto, user);
    return { success: true, data: aarti };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Patch("admin/:id/aartis/:aartiId")
  async updateAarti(@Param("id") id: string, @Param("aartiId") aartiId: string, @Body() dto: Partial<CreateAartiDto>, @CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.templesService.updateAarti(id, aartiId, dto, user) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Delete("admin/:id/aartis/:aartiId")
  async deleteAarti(@Param("id") id: string, @Param("aartiId") aartiId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.templesService.deleteAarti(id, aartiId, user);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Post("admin/:id/festivals")
  async addFestival(@Param("id") id: string, @Body() dto: CreateFestivalDto, @CurrentUser() user: AuthenticatedUser) {
    const festival = await this.templesService.addFestival(id, dto, user);
    return { success: true, data: festival };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @Patch("admin/:id/festivals/:festivalId")
  async updateFestival(@Param("id") id: string, @Param("festivalId") festivalId: string, @Body() dto: Partial<CreateFestivalDto>, @CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.templesService.updateFestival(id, festivalId, dto, user) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin", "national_admin")
  @Delete("admin/:id/festivals/:festivalId")
  async deleteFestival(@Param("id") id: string, @Param("festivalId") festivalId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.templesService.deleteFestival(id, festivalId, user);
    return { success: true };
  }

  @Public()
  @Get(":slug")
  async getTempleByNativeSlug(@Param("slug") slug: string) {
    const temple = await this.templesService.findOneBySlug(slug, true);
    return { success: true, data: temple };
  }
}
