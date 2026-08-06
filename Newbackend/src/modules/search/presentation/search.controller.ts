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

  /**
   * Type-ahead search across every domain the caller may see.
   *
   * Deliberately not `@Public()` and not role-gated at the route: what a caller
   * can find is decided per entity inside the service, so an owner and a
   * district officer hit the same URL and get different estates back.
   *
   * The throttle is looser than the global default because a debounced
   * type-ahead legitimately fires several times per query.
   */
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
