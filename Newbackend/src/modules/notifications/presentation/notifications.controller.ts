import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { NotificationsAdminService } from "../application/notifications-admin.service";
import { UserInboxService } from "../application/user-inbox.service";
import {
  AudiencePreviewDto,
  InboxQueryDto,
  ListCampaignsQueryDto,
  SendCampaignDto,
} from "./notifications.dto";

/** Roles allowed to compose and send a push campaign — a platform admin, or
 * an ashram-owner-tier role whose audience the AudienceResolverService
 * narrows to their own ashram's customers. */
const PUSH_SENDER_ROLES = [
  "super_admin",
  "ashram_owner",
  "owner",
  "temple_owner",
  "ashram_admin",
];

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly inbox: UserInboxService,
    private readonly admin: NotificationsAdminService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxQueryDto) {
    const page = await this.inbox.fetchInbox(user.id, query.page, query.limit);
    return { success: true, ...page };
  }

  @Patch(":id/read")
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.inbox.markRead(user.id, id);
    return { success: true };
  }

  @Patch("read-all")
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.inbox.markAllRead(user.id);
    return { success: true };
  }

  @Post("admin/audience/preview")
  @Roles(...PUSH_SENDER_ROLES)
  async previewAudience(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AudiencePreviewDto,
  ) {
    return { success: true, count: await this.admin.previewAudience(user, dto) };
  }

  @Get("admin/customers")
  @Roles(...PUSH_SENDER_ROLES)
  async listCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
  ) {
    const data = await this.admin.listCustomers(user, search);
    return { success: true, count: data.length, data };
  }

  @Post("admin/campaigns")
  @Roles(...PUSH_SENDER_ROLES)
  async sendCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendCampaignDto,
  ) {
    return { success: true, data: await this.admin.sendCampaign(user, dto) };
  }

  @Get("admin/campaigns")
  @Roles(...PUSH_SENDER_ROLES)
  async listCampaigns(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCampaignsQueryDto,
  ) {
    return {
      success: true,
      data: await this.admin.listCampaigns(user, query.page, query.limit),
    };
  }
}
