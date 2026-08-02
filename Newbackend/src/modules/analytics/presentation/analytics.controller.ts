import { Controller, Get, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { AnalyticsService } from "../application/analytics.service";
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Get("dashboard")
  @Roles("owner", "manager", "staff", "super_admin")
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
  @Roles(
    "inspector",
    "district_officer",
    "state_admin",
    "govt_admin",
    "government_admin",
    "national_admin",
    "super_admin",
  )
  async system(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.system(user) };
  }
  @Get("audit-logs") @Roles("super_admin") async logs(
    @Query("module") module?: string,
    @Query("action") action?: string,
  ) {
    const data = await this.service.logs(module, action);
    return { success: true, count: data.length, data };
  }
}
