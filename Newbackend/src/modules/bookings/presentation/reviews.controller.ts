import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { ReviewsService } from "../application/reviews.service";
import {
  CreateReviewDto,
  ReviewDisplayNameDto,
  ReviewStatusDto,
} from "./dtos/booking.dto";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Post() async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return {
      success: true,
      message: "Review submitted successfully",
      data: await this.service.create(user, dto),
    };
  }

  @Get("admin/list") @Roles("super_admin") async adminList(
    @Query() query: Record<string, string>,
  ) {
    return { success: true, ...(await this.service.adminList(query)) };
  }

  @Patch(":id/status") @Roles("super_admin") async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewStatusDto,
  ) {
    return {
      success: true,
      message: dto.status === "hidden" ? "Review hidden" : "Review published",
      data: await this.service.setStatus(user, id, dto.status),
    };
  }

  @Patch(":id/display-name") @Roles("super_admin") async displayName(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewDisplayNameDto,
  ) {
    return {
      success: true,
      message: "Reviewer name updated",
      data: await this.service.setDisplayName(user, id, dto.displayName),
    };
  }

  @Delete(":id") async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      data: await this.service.remove(user, id),
    };
  }

  @Get("eligibility/:ashramId") async eligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ashramId") ashramId: string,
  ) {
    return {
      success: true,
      data: await this.service.eligibility(user, ashramId),
    };
  }

  @Public() @Get("recent") async recent() {
    const data = await this.service.recent();
    return { success: true, count: data.length, data };
  }
  @Public() @Get("ashram/:ashramId") async forAshram(
    @Param("ashramId") id: string,
  ) {
    const data = await this.service.forAshram(id);
    return { success: true, count: data.length, data };
  }
}
