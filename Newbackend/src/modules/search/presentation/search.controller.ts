import { Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { SearchService } from "../application/search.service";
import { GlobalSearchQueryDto } from "./dtos/search.dto";

@Controller("search")
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GlobalSearchQueryDto,
  ) {
    return {
      success: true,
      data: await this.service.search(user, query.q, query.perType),
    };
  }
}
