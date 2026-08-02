import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { PlatformSettingsService } from "../application/platform-settings.service";
import { UpdatePlatformSettingsDto } from "./platform-settings.dto";
@Controller("platform-settings")
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}
  @Public() @Get() async get() {
    return { success: true, data: await this.service.get() };
  }
  @Put() @Roles("super_admin", "manager") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    return {
      success: true,
      message: "Platform settings updated successfully",
      data: await this.service.update(user, dto),
    };
  }
}
