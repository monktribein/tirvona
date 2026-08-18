import { Controller, Get, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { AnalyticsService } from "../application/analytics.service";
import {
  AnalyticsOverviewQueryDto,
  RecentBookingsQueryDto,
} from "./dtos/analytics.dto";

/** The roles allowed to read platform-wide, jurisdiction-scoped telemetry. */
const OVERSIGHT_ROLES = [
  "inspector",
  "district_officer",
  "state_admin",
  "govt_admin",
  "government_admin",
  "national_admin",
  "super_admin",
] as const;

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Get("dashboard")
  @Roles("owner", "stay_admin", "manager", "staff", "super_admin")
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query("ashramId") ashramId?: string,
  ) {
    return {
      success: true,
      data: await this.service.dashboard(user, ashramId),
    };
  }
  @Get("system")
  @Roles(...OVERSIGHT_ROLES)
  async system(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.system(user) };
  }
  @Get("overview")
  @Roles(...OVERSIGHT_ROLES)
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsOverviewQueryDto,
  ) {
    return {
      success: true,
      data: await this.service.overview(user, query.range),
    };
  }
  @Get("recent-bookings")
  @Roles(...OVERSIGHT_ROLES)
  async recentBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentBookingsQueryDto,
  ) {
    const data = await this.service.recentBookings(user, query.limit);
    return { success: true, count: data.length, data };
  }
  @Get("audit-logs") @Roles("super_admin") async logs(
    @Query("module") module?: string,
    @Query("action") action?: string,
  ) {
    const data = await this.service.logs(module, action);
    return { success: true, count: data.length, data };
  }
}
