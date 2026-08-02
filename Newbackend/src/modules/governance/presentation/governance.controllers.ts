import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { GovernanceService } from "../application/governance.service";
import {
  ApprovalCommentDto,
  ApprovalRequestDto,
  BulkNotificationDto,
  InstitutionDto,
  ResubmitRoomCategoryRequestDto,
  ReviewApprovalDto,
  RoomCategoryRequestDto,
  UpdateInstitutionDto,
} from "./dtos/governance.dto";

@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly governance: GovernanceService) {}
  @Post("requests") create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApprovalRequestDto,
  ) {
    return this.governance.createApproval(user, dto);
  }
  @Get("requests") list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.governance.approvals(user, query);
  }
  @Get("requests/stats") stats() {
    return this.governance.approvalStats();
  }
  @Get("requests/:id") one(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.governance.approval(user, id);
  }
  @Put("requests/:id/review") @Roles("super_admin") review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewApprovalDto,
  ) {
    return this.governance.reviewApproval(
      user,
      id,
      dto.action,
      dto.reviewComment,
    );
  }
  @Post("requests/:id/comment") comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApprovalCommentDto,
  ) {
    return this.governance.commentApproval(user, id, dto.text);
  }
  @Post("room-categories") createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RoomCategoryRequestDto,
  ) {
    return this.governance.createRoomCategory(user, body);
  }
  @Get("room-categories") rooms(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.governance.approvals(user, {
      ...query,
      module: "room_category",
    });
  }
  @Get("room-categories/:id") room(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.governance.approval(user, id);
  }
  @Put("room-categories/:id/review") @Roles("super_admin") reviewRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewApprovalDto,
  ) {
    return this.governance.reviewApproval(
      user,
      id,
      dto.action,
      dto.reviewComment,
    );
  }
  @Put("room-categories/:id/resubmit") resubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: ResubmitRoomCategoryRequestDto,
  ) {
    return this.governance.resubmitApproval(user, id, body);
  }
}

@Controller("institution")
export class InstitutionsController {
  constructor(private readonly governance: GovernanceService) {}
  @Public() @Get() list(@Query() query: Record<string, string>) {
    return this.governance.institutions(query);
  }
  @Public() @Get(":id") one(@Param("id") id: string) {
    return this.governance.institution(id);
  }
  @Post()
  @Roles("super_admin", "district_officer", "government_admin", "govt_admin")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: InstitutionDto) {
    return this.governance.createInstitution(user, dto);
  }
  @Put(":id")
  @Roles("super_admin", "district_officer", "government_admin", "govt_admin")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateInstitutionDto,
  ) {
    return this.governance.updateInstitution(user, id, dto);
  }
  @Delete(":id") @Roles("super_admin") remove(@Param("id") id: string) {
    return this.governance.deleteInstitution(id);
  }
}

@Controller("enterprise-notifications")
export class EnterpriseNotificationsController {
  constructor(private readonly governance: GovernanceService) {}
  @Get("stats") stats() {
    return this.governance.telemetryStats();
  }
  @Get("activities") activities(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.governance.activities(user, query);
  }
  @Get("notifications") notifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.governance.notifications(user, query);
  }
  @Patch("notifications/:id/read") read(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.governance.markNotification(user, id);
  }
  @Delete("notifications/:id") remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.governance.deleteNotification(user, id);
  }
  @Post("notifications/bulk") bulk(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkNotificationDto,
  ) {
    return this.governance.bulkNotifications(user, dto);
  }
  @Post("seed") @Roles("super_admin") seed() {
    return this.governance.seedTelemetry();
  }
}

@Controller("admin/crud")
@Roles(
  "super_admin",
  "national_admin",
  "state_admin",
  "government_admin",
  "govt_admin",
  "district_officer",
  "inspector",
  "banner_manager",
  "content_manager",
  "offer_manager",
  "blog_manager",
  "local_manager",
  "marketplace_manager",
  "finance_manager",
  "support",
  "service_manager",
)
export class AdminCrudController {
  constructor(private readonly governance: GovernanceService) {}
  @Get(":moduleKey") list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("moduleKey") moduleKey: string,
    @Query("subKey") subKey: string | undefined,
    @Query() query: Record<string, string>,
  ) {
    return this.governance.adminList(user, moduleKey, subKey, query);
  }
  @Post(":moduleKey") save(
    @CurrentUser() user: AuthenticatedUser,
    @Param("moduleKey") moduleKey: string,
    @Query("subKey") subKey: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.governance.adminSave(user, moduleKey, subKey, body);
  }
  @Delete(":moduleKey/:id") remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("moduleKey") moduleKey: string,
    @Param("id") id: string,
  ) {
    return this.governance.adminDelete(user, moduleKey, id);
  }
}
