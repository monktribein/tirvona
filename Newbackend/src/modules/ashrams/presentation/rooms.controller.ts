import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { AshramsService } from "../application/ashrams.service";
import { CreateRoomDto, RoomAvailabilityDto } from "./dtos/ashram.dto";

@ApiTags("Rooms")
@ApiBearerAuth()
@Roles("owner", "manager", "super_admin")
@Controller("rooms")
export class RoomsController {
  constructor(private readonly service: AshramsService) {}
  @Post() async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto,
  ) {
    return { success: true, data: await this.service.createRoom(user, dto) };
  }
  @Put(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CreateRoomDto,
  ) {
    return {
      success: true,
      data: await this.service.updateRoom(user, id, dto),
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
  /**
   * Visitor-facing availability. `@Public` overrides the controller-level
   * `@Roles`, which is why this is a separate route rather than a flag on the
   * owner calendar: a pilgrim needs price and free-count only, never the
   * held/booked/maintenance split.
   */
  @Public()
  @Get(":id/availability-calendar")
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
