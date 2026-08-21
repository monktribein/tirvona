import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../../common/decorators/current-user.decorator";
import { EVENT_MODEL } from "../../domain/event.constants";
import { EventRegistrationService } from "../../application/event-registration.service";
import {
  CancelRegistrationDto,
  CreateRegistrationDto,
  PaginationDto,
  PassFormatDto,
} from "../dtos/event.dto";

@ApiTags("Event Registrations")
@ApiBearerAuth()
@Controller("events/registrations")
export class EventRegistrationController {
  constructor(
    private readonly service: EventRegistrationService,
    @InjectModel(EVENT_MODEL.Notification)
    private readonly notifications: Model<any>,
  ) {}

  @Post() async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegistrationDto,
  ) {
    return {
      success: true,
      message: "You are registered. Your entry pass is ready.",
      data: await this.service.register(user, dto),
    };
  }

  @Get() async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() page: PaginationDto,
    @Query("status") status?: string,
  ) {
    const result = await this.service.listMine(
      user.id,
      status,
      page.page,
      page.limit,
    );
    return {
      success: true,
      count: result.items.length,
      total: result.total,
      page: page.page,
      totalPages: Math.ceil(result.total / page.limit) || 1,
      data: result.items,
    };
  }

  @Get("notifications") async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() page: PaginationDto,
  ) {
    const filter = { userId: user.id };
    const [data, total, unread] = await Promise.all([
      this.notifications
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page.page - 1) * page.limit)
        .limit(page.limit),
      this.notifications.countDocuments(filter),
      this.notifications.countDocuments({ ...filter, readAt: null }),
    ]);
    return { success: true, count: data.length, total, unread, data };
  }

  @Post("notifications/read-all") async readNotifications(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.notifications.updateMany(
      { userId: user.id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return { success: true, data: { updated: result.modifiedCount } };
  }

  @Get(":id") async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      data: await this.service.ownRegistration(id, user.id),
    };
  }

  @Get(":id/pass") async pass(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: PassFormatDto,
  ) {
    return {
      success: true,
      data: await this.service.currentPass(id, user.id, query.format),
    };
  }

  @Post(":id/pass/reissue") async reissue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: PassFormatDto,
  ) {
    return {
      success: true,
      message: "A new pass has been issued. Older passes no longer work.",
      data: await this.service.reissuePass(id, user.id, query.format),
    };
  }

  @Post(":id/cancel") async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CancelRegistrationDto,
  ) {
    return {
      success: true,
      message: "Your registration has been cancelled.",
      data: await this.service.cancel(id, user, dto),
    };
  }
}
