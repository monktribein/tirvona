import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SupportCategoryService } from "../application/support-category.service";
import { SupportDashboardService } from "../application/support-dashboard.service";
import { SupportEntityService } from "../application/support-entity.service";
import { SupportTicketService } from "../application/support-ticket.service";
import { SUPPORT_HANDLER_ROLES } from "../domain/support.constants";
import {
  AdminCreateTicketDto,
  AdminTicketsQueryDto,
  AssignTicketDto,
  CreateSupportCategoryDto,
  EscalateTicketDto,
  LinkableQueryDto,
  LinkEntityDto,
  StaffReplyDto,
  UpdateSupportCategoryDto,
  UpdateTicketDto,
  UserSearchQueryDto,
} from "./support.dto";

/**
 * Support Management console. super_admin (always) and the support handler
 * roles reach it; which tickets each person sees is decided per request by
 * SupportTicketService (supervisor → all; agent → own + unassigned; handler
 * role → own + unassigned in the categories it handles). Category setup is
 * super_admin only.
 */
@ApiTags("Support Admin")
@ApiBearerAuth()
@Roles("super_admin", ...SUPPORT_HANDLER_ROLES)
@Controller("support/admin")
export class SupportAdminController {
  constructor(
    private readonly tickets: SupportTicketService,
    private readonly dashboard: SupportDashboardService,
    private readonly categories: SupportCategoryService,
    private readonly entities: SupportEntityService,
  ) {}

  @Get("dashboard")
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.dashboard.overview(user) };
  }

  // ---------------------------------------------------------------- tickets
  @Get("tickets")
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminTicketsQueryDto) {
    return { success: true, ...(await this.tickets.adminList(user, query)) };
  }

  /** Raising tickets for customers (and looking customers up) is the support team's job, not the handler roles'. */
  @Post("tickets")
  @Roles("super_admin", "support")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdminCreateTicketDto) {
    const data = await this.tickets.adminCreate(user, dto);
    return { success: true, message: `Ticket ${data.ticketNumber} created`, data };
  }

  @Get("tickets/:id")
  async get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.tickets.adminGet(user, id) };
  }

  /** Status / priority / category, each recorded on the timeline. */
  @Patch("tickets/:id")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateTicketDto) {
    return { success: true, message: "Ticket updated", data: await this.tickets.update(user, id, dto) };
  }

  @Post("tickets/:id/assign")
  async assign(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AssignTicketDto) {
    const data = await this.tickets.assign(user, id, dto.assigneeId);
    return { success: true, message: dto.assigneeId ? "Ticket assigned" : "Ticket unassigned", data };
  }

  @Post("tickets/:id/escalate")
  async escalate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: EscalateTicketDto) {
    return { success: true, message: "Ticket escalated", data: await this.tickets.escalate(user, id, dto.reason) };
  }

  /** Reply to the customer, or `internal: true` for a staff-only note. */
  @Post("tickets/:id/messages")
  async reply(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: StaffReplyDto) {
    const data = await this.tickets.replyAsStaff(user, id, dto);
    return { success: true, message: dto.internal ? "Internal note added" : "Reply sent", data };
  }

  @Put("tickets/:id/related-entity")
  async link(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: LinkEntityDto) {
    const data = await this.tickets.linkEntity(user, id, dto.relatedEntity);
    return { success: true, message: dto.relatedEntity ? "Record linked" : "Link removed", data };
  }

  // ------------------------------------------------------------ people/data
  @Get("staff")
  async staff(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.tickets.assignableStaff(user) };
  }

  @Get("customers")
  @Roles("super_admin", "support")
  async customers(@CurrentUser() user: AuthenticatedUser, @Query() query: UserSearchQueryDto) {
    return { success: true, data: await this.tickets.searchCustomers(user, query.search) };
  }

  @Get("customers/:userId/linkable")
  @Roles("super_admin", "support")
  async customerLinkable(@Param("userId") userId: string, @Query() query: LinkableQueryDto) {
    return { success: true, data: await this.entities.listOwned(query.type, userId) };
  }

  // ------------------------------------------------------------- categories
  @Get("categories")
  async categoriesList() {
    return { success: true, data: await this.categories.listAll() };
  }

  @Post("categories")
  @Roles("super_admin")
  async createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupportCategoryDto) {
    return { success: true, message: "Category created", data: await this.categories.create(user, dto) };
  }

  @Put("categories/:id")
  @Roles("super_admin")
  async updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateSupportCategoryDto,
  ) {
    return { success: true, message: "Category updated", data: await this.categories.update(user, id, dto) };
  }
}
