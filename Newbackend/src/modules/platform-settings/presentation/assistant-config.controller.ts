import { Body, Controller, Delete, Get, Put } from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { AssistantConfigService } from "../application/assistant-config.service";
import { SaveAssistantConfigDto } from "./assistant-config.dto";

@Controller("assistant-config")
export class AssistantConfigController {
  constructor(private readonly service: AssistantConfigService) {}

  @Public() @Get() async get() {
    return { success: true, data: await this.service.getPublic() };
  }

  @Get("admin") @Roles("super_admin") async getAdmin() {
    return { success: true, data: await this.service.getAdmin() };
  }

  @Put() @Roles("super_admin") async save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveAssistantConfigDto) {
    return { success: true, message: "Assistant menu published", data: await this.service.save(user, dto) };
  }

  @Delete() @Roles("super_admin") async reset(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, message: "Assistant menu restored to the default", data: await this.service.reset(user) };
  }
}
