import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { ReviewsService } from "../application/reviews.service";
import { CreateReviewDto } from "./dtos/booking.dto";

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
