import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../../common/decorators/public.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { PilgrimageDiscoveryService } from "../../application/pilgrimage-discovery.service";
import { PilgrimagePlannerService } from "../../application/pilgrimage-planner.service";
import {
  CircuitSearchDto,
  GenerateItineraryDto,
  PaginationDto,
  SaveItineraryDto,
  TemplateQueryDto,
} from "../dtos/pilgrimage.dto";

@ApiTags("Pilgrimage Circuits")
@Controller("pilgrimage")
export class PilgrimagePublicController {
  constructor(
    private readonly discovery: PilgrimageDiscoveryService,
    private readonly planner: PilgrimagePlannerService,
  ) {}

  @Public() @Get("filters") filters() {
    return { success: true, data: this.discovery.filters() };
  }

  @Public() @Get("circuits") search(@Query() query: CircuitSearchDto) {
    return this.discovery.search(query);
  }

  @Public() @Get("templates") async templates(@Query() query: TemplateQueryDto) {
    const data = await this.discovery.templates(query);
    return { success: true, count: data.length, data };
  }

  @Public() @Post("planner/generate")
  async generate(@Body() dto: GenerateItineraryDto) {
    return { success: true, data: await this.planner.generate(dto) };
  }

  @ApiBearerAuth()
  @Get("itineraries")
  async myItineraries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() page: PaginationDto,
  ) {
    return {
      success: true,
      ...(await this.planner.listMine(user.id, page.page, page.limit)),
    };
  }

  @ApiBearerAuth()
  @Post("itineraries")
  async saveItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveItineraryDto,
  ) {
    return {
      success: true,
      message: "Itinerary saved to your account.",
      data: await this.planner.save(user, dto),
    };
  }

  @ApiBearerAuth()
  @Get("itineraries/:id")
  async getItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return { success: true, data: await this.planner.getMine(id, user.id) };
  }

  @ApiBearerAuth()
  @Delete("itineraries/:id")
  async removeItinerary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Itinerary removed.",
      data: await this.planner.removeMine(id, user.id),
    };
  }

  // Declared last so "circuits", "templates" and "itineraries" are matched by
  // their own routes before this catch-all slug.
  @Public() @Get("circuits/:idOrSlug")
  async detail(@Param("idOrSlug") idOrSlug: string) {
    const data = await this.discovery.detail(idOrSlug);
    if (!data) throw new NotFoundException("Pilgrimage circuit not found.");
    return { success: true, data };
  }
}
