import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { RoomSummaryService } from "../application/room-summary.service";
import {
  CreateRoomDto,
  RoomAvailabilityDto,
  UpdateRoomDto,
} from "./dtos/ashram.dto";
import { RoomSummaryQueryDto } from "./dtos/room-summary.dto";

@ApiTags("Rooms")
@ApiBearerAuth()
@Roles("owner", "stay_admin", "manager", "super_admin")
@Controller("rooms")
export class RoomsController {
  constructor(
    private readonly service: AshramsService,
    private readonly summaries: RoomSummaryService,
  ) {}

  /**
   * Estate-wide room totals plus a category-by-category breakdown for one
   * night. Declared ahead of the ":id" routes so "summary" is never read as an
   * identifier. Scope is resolved per caller, so an owner sees only their own
   * ashrams here while a super admin sees every one.
   */
  @Get("summary")
  @Header("Cache-Control", "no-store")
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RoomSummaryQueryDto,
  ) {
    return { success: true, data: await this.summaries.summary(user, query) };
  }

  @Post() async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto,
  ) {
    return { success: true, data: await this.service.createRoom(user, dto) };
  }
  @Put(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return {
      success: true,
      message: "Room category updated successfully",
      data: await this.service.updateRoom(user, id, dto),
    };
  }
  @Delete(":id") async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Room category removed successfully",
      data: await this.service.deleteRoom(user, id),
    };
  }
  @Post(":id/availability") async availability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RoomAvailabilityDto,
  ) {
    return {
      success: true,
      data: await this.service.setAvailability(user, id, dto),
    };
  }
  @Public()
  @Get(":id/availability-calendar")
  @Header("Cache-Control", "no-store")
  async publicCalendar(
    @Param("id") id: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return {
      success: true,
      data: await this.service.publicCalendar(id, startDate, endDate),
    };
  }

  @Get(":id/calendar") async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return {
      success: true,
      data: await this.service.calendar(user, id, startDate, endDate),
    };
  }
}
