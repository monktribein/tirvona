import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
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
import { CommunityService } from "../application/community.service";
import {
  AdminUpdateVisitorArticleDto,
  ApplicationStatusDto,
  ArticleCommentDto,
  ReviewVisitorArticleDto,
  UpdateVisitorArticleDto,
  UpdateVolunteerJobDto,
  UserMemoryDto,
  VisitorArticleDto,
  VolunteerApplicationDto,
  VolunteerJobDto,
} from "./dtos/community.dto";

@Controller("user-memory")
export class UserMemoryController {
  constructor(private readonly community: CommunityService) {}
  @Public() @Get() get(@Headers("x-session-id") sessionId: string) {
    return this.community.memory(sessionId);
  }
  @Public() @Post() save(
    @Headers("x-session-id") sessionId: string,
    @Body() dto: UserMemoryDto,
  ) {
    return this.community.saveMemory(sessionId, dto);
  }
  @Public() @Delete(":category") clear(
    @Headers("x-session-id") sessionId: string,
    @Param("category") category: string,
  ) {
    return this.community.clearMemory(sessionId, category);
  }
}

@Controller("volunteer")
export class VolunteerController {
  constructor(private readonly community: CommunityService) {}
  @Public() @Get("jobs") jobs(@Query() query: Record<string, string>) {
    return this.community.jobs(query);
  }
  @Get("owner/jobs") @Roles("owner", "stay_admin", "manager", "super_admin") ownerJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.community.managedJobs(user, query);
  }
  @Public() @Get("jobs/:id") job(@Param("id") id: string) {
    return this.community.job(id);
  }
  @Post("apply")
  @Roles("customer", "volunteer", "owner", "manager", "super_admin")
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VolunteerApplicationDto,
  ) {
    return this.community.apply(user, dto);
  }
  @Get("applications/mine")
  @Roles("customer", "volunteer", "owner", "manager", "super_admin")
  myApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.community.myApplications(user, query);
  }
  @Post("jobs") @Roles("owner", "stay_admin", "manager", "super_admin") create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VolunteerJobDto,
  ) {
    return this.community.createJob(user, dto);
  }
  @Put("jobs/:id") @Roles("owner", "stay_admin", "manager", "super_admin") update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVolunteerJobDto,
  ) {
    return this.community.updateJob(user, id, dto);
  }
  @Delete("jobs/:id") @Roles("owner", "stay_admin", "manager", "super_admin") remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.community.deleteJob(user, id);
  }
  @Get("applications") @Roles("owner", "stay_admin", "manager", "super_admin") applications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    return this.community.applications(user, query);
  }
  @Put("applications/:id/status")
  @Roles("owner", "stay_admin", "manager", "super_admin")
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ApplicationStatusDto,
  ) {
    return this.community.applicationStatus(user, id, dto);
  }
}

@Controller("visitor-articles")
export class VisitorArticlesController {
  constructor(private readonly community: CommunityService) {}
  @Public() @Get("public") publicList(@Query() query: Record<string, string>) {
    return this.community.publicArticles(query);
  }
  @Public() @Get("public/:slug") publicOne(@Param("slug") slug: string) {
    return this.community.publicArticle(slug);
  }
  @Get("visitor/eligible-bookings") @Roles("customer") eligible(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.community.eligibleBookings(user);
  }
  @Get("visitor/my-articles") @Roles("customer") mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
  ) {
    return this.community.myArticles(user, status);
  }
  @Get("owner/list") @Roles("owner", "manager", "super_admin") owner(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
  ) {
    return this.community.ownerArticles(user, status);
  }
  @Post() @Roles("customer") create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VisitorArticleDto,
  ) {
    return this.community.createArticle(user, dto);
  }
  @Put(":id") @Roles("customer") update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVisitorArticleDto,
  ) {
    return this.community.updateArticle(user, id, dto);
  }
  // Administrator copy-edit. Order against the visitor's `@Put(":id")` above
  // does not matter: `:id` matches a single segment, so it can never swallow
  // the two-segment `admin/:id`.
  @Put("admin/:id") @Roles("owner", "manager", "super_admin") adminUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AdminUpdateVisitorArticleDto,
  ) {
    return this.community.adminUpdateArticle(user, id, dto);
  }
  @Delete(":id") @Roles("owner", "manager", "super_admin") remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.community.deleteArticle(user, id);
  }
  @Post(":id/review") @Roles("owner", "manager", "super_admin") review(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReviewVisitorArticleDto,
  ) {
    return this.community.reviewArticle(
      user,
      id,
      dto.action,
      dto.rejectionReason,
    );
  }
  @Post(":id/like") like(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.community.likeArticle(user, id);
  }
  @Post(":id/comments") comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ArticleCommentDto,
  ) {
    return this.community.commentArticle(user, id, dto.comment, dto.parentId);
  }
}
