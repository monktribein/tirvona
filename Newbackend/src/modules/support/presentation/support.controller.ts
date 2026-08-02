import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SupportService } from "../application/support.service";
import { CreateTicketDto, TicketMessageDto } from "./support.dto";
@Controller("support")
export class SupportController {
  constructor(private readonly service: SupportService) {}
  @Post() @Roles("customer", "owner", "manager") async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return { success: true, data: await this.service.create(user, dto) };
  }
  @Get() async list(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.service.list(user) };
  }
  @Post(":id/message") async message(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: TicketMessageDto,
  ) {
    return {
      success: true,
      data: await this.service.message(user, id, dto.text),
    };
  }
  @Post(":id/resolve") async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return {
      success: true,
      message: "Ticket successfully marked as resolved",
      data: await this.service.resolve(user, id),
    };
  }
}
