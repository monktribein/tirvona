import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { AuthenticatedUploadThrottle } from "../../../common/throttling/rate-limit.decorators";
import { isStaff } from "../application/support-access";
import { SupportAttachmentService } from "../application/support-attachment.service";
import { SupportCategoryService } from "../application/support-category.service";
import { SupportEntityService } from "../application/support-entity.service";
import { SupportTicketService } from "../application/support-ticket.service";
import { ATTACHMENT_MAX_BYTES } from "../domain/support.constants";
import {
  CreateTicketDto,
  LegacyCreateTicketDto,
  LinkableQueryDto,
  MyTicketsQueryDto,
  ReopenDto,
  ReplyDto,
  TicketMessageDto,
} from "./support.dto";

/**
 * Help & Support for any signed-in user. Every route is scoped to the
 * caller's own tickets; internal notes and staff-only fields are never
 * returned here.
 */
@ApiTags("Support")
@ApiBearerAuth()
@Controller("support")
export class SupportController {
  constructor(
    private readonly tickets: SupportTicketService,
    private readonly categories: SupportCategoryService,
    private readonly entities: SupportEntityService,
    private readonly attachments: SupportAttachmentService,
  ) {}

  @Get("categories")
  async categoriesList() {
    return { success: true, data: await this.categories.listActive() };
  }

  /** The caller's own bookings/orders/… of one type, to link to a new ticket. */
  @Get("linkable")
  async linkable(@CurrentUser() user: AuthenticatedUser, @Query() query: LinkableQueryDto) {
    return { success: true, data: await this.entities.listOwned(query.type, user.id) };
  }

  @Post("attachments")
  @AuthenticatedUploadThrottle(30, 900_000)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: ATTACHMENT_MAX_BYTES } }))
  async upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return { success: true, data: await this.attachments.upload(user, file) };
  }

  @Get("tickets")
  async myTickets(@CurrentUser() user: AuthenticatedUser, @Query() query: MyTicketsQueryDto) {
    return { success: true, ...(await this.tickets.listMine(user, query)) };
  }

  @Post("tickets")
  @AuthenticatedUploadThrottle(10, 3_600_000)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    const data = await this.tickets.createForCustomer(user, dto);
    return { success: true, message: `Ticket ${data.ticketNumber} created`, data };
  }

  @Get("tickets/:id")
  async myTicket(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.tickets.getMine(user, id) };
  }

  @Post("tickets/:id/messages")
  @AuthenticatedUploadThrottle(60, 600_000)
  async reply(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReplyDto) {
    return { success: true, data: await this.tickets.replyAsCustomer(user, id, dto.body, dto.attachmentIds) };
  }

  /** Customer confirms the issue is solved (or no longer needs help). */
  @Post("tickets/:id/close")
  async close(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, message: "Ticket closed", data: await this.tickets.closeAsCustomer(user, id) };
  }

  @Post("tickets/:id/reopen")
  async reopen(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReopenDto) {
    return { success: true, message: "Ticket reopened", data: await this.tickets.reopenAsCustomer(user, id, dto.reason) };
  }

  // ---------------------------------------------------------------- legacy
  // The first version's routes, kept so older app builds keep working.

  @Post()
  @AuthenticatedUploadThrottle(10, 3_600_000)
  async createLegacy(@CurrentUser() user: AuthenticatedUser, @Body() dto: LegacyCreateTicketDto) {
    return { success: true, data: await this.tickets.createLegacy(user, dto) };
  }

  @Get()
  async listLegacy(@CurrentUser() user: AuthenticatedUser) {
    const page = isStaff(user)
      ? await this.tickets.adminList(user, { view: "all", limit: 100 })
      : await this.tickets.listMine(user, { limit: 50 });
    return { success: true, data: page.data };
  }

  @Post(":id/message")
  async messageLegacy(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: TicketMessageDto) {
    const data = isStaff(user)
      ? await this.tickets.replyAsStaff(user, id, { body: dto.text })
      : await this.tickets.replyAsCustomer(user, id, dto.text);
    return { success: true, data };
  }

  @Post(":id/resolve")
  async resolveLegacy(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const data = isStaff(user)
      ? await this.tickets.update(user, id, { status: "RESOLVED" })
      : await this.tickets.closeAsCustomer(user, id);
    return { success: true, message: "Ticket successfully marked as resolved", data };
  }
}
