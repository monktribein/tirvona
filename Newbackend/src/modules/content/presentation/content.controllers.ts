import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ContentService } from "../application/content.service";
import {
  BlogCommentDto,
  CmsChangeDto,
  GenerateItineraryDto,
  RejectContentDto,
} from "./dtos/content.dto";

@Controller("blog")
export class BlogController {
  constructor(private readonly content: ContentService) {}
  @Public() @Get("posts") posts(@Query() query: Record<string, string>) {
    return this.content.blogPosts(query);
  }
  @Public() @Get("posts/:slug") post(@Param("slug") slug: string) {
    return this.content.blogPost(slug);
  }
  @Public() @Post("posts/:slug/comments") comment(
    @Param("slug") slug: string,
    @Body() dto: BlogCommentDto,
  ) {
    return this.content.comment(slug, dto);
  }
  @Public() @Post("posts/:slug/like") like(@Param("slug") slug: string) {
    return this.content.like(slug);
  }
}

@Controller("cms")
export class CmsController {
  constructor(private readonly content: ContentService) {}
  @Public() @Get("published") published() {
    return this.content.published();
  }
  @Post("request-change")
  @Roles("banner_manager", "content_manager", "super_admin", "owner", "manager")
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: CmsChangeDto) {
    return this.content.submitChange(user, dto);
  }
  @Get("my-requests")
  @Roles("banner_manager", "content_manager", "super_admin", "owner", "manager")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.content.cmsRequests({ userId: user.id });
  }
  @Get("pending-approvals")
  @Roles("owner", "manager", "super_admin", "government_admin", "govt_admin")
  pending(@Query() query: Record<string, string>) {
    return this.content.cmsRequests({
      status: query.status ?? "pending",
      ...(query.page ? { page: query.page } : {}),
    });
  }
  @Post("approve/:id")
  @Roles("owner", "super_admin", "government_admin", "govt_admin")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.publish(id, user, true);
  }
  @Post("reject/:id")
  @Roles("owner", "super_admin", "government_admin", "govt_admin")
  reject(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectContentDto,
  ) {
    return this.content.publish(id, user, false, dto.reason);
  }
  @Delete("request/:id")
  @Roles("banner_manager", "content_manager", "super_admin", "owner", "manager")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.deleteRequest(id, user);
  }
  @Post("reset-section/:section")
  @Roles("owner", "super_admin", "government_admin", "govt_admin")
  reset(
    @Param("section") section: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.content.resetSection(section, user);
  }
}

@Controller("services")
export class SacredServicesController {
  constructor(private readonly content: ContentService) {}
  @Public() @Get("circuits") circuits(@Query() query: Record<string, string>) {
    return this.content.catalogue("circuits", query);
  }
  @Public() @Get("circuits/:slug") circuit(@Param("slug") slug: string) {
    return this.content.catalogueOne("circuits", slug);
  }
  @Public() @Get("temples") temples(@Query() query: Record<string, string>) {
    return this.content.catalogue("temples", query);
  }
  @Public() @Get("temples/:slug") temple(@Param("slug") slug: string) {
    return this.content.catalogueOne("temples", slug);
  }
  @Public() @Get("events") events(@Query() query: Record<string, string>) {
    return this.content.catalogue("events", query);
  }
  @Public() @Get("events/:slug") event(@Param("slug") slug: string) {
    return this.content.catalogueOne("events", slug);
  }
  @Public() @Get("directory") directory(
    @Query() query: Record<string, string>,
  ) {
    return this.content.catalogue("directory", query);
  }
}

@Controller("planner")
export class PlannerController {
  constructor(private readonly content: ContentService) {}
  @Public() @Post("generate") generate(@Body() dto: GenerateItineraryDto) {
    return this.content.itinerary(dto);
  }
  @Public() @Get("templates") templates() {
    return this.content.templates();
  }
}

@Controller("local")
export class LocalServicesController {
  constructor(private readonly content: ContentService) {}
  @Public() @Get() all(@Query() query: Record<string, string>) {
    return this.content.local(query);
  }
  @Public() @Get("guides") guides(@Query() query: Record<string, string>) {
    return this.content.local(query, "guides");
  }
  @Public() @Get("transport") transport(
    @Query() query: Record<string, string>,
  ) {
    return this.content.local(query, "transport");
  }
  @Public() @Get("restaurants") restaurants(
    @Query() query: Record<string, string>,
  ) {
    return this.content.local(query, "food");
  }
  @Public() @Get("events") events(@Query() query: Record<string, string>) {
    return this.content.local(query, "events");
  }
  @Public() @Get("medical") medical(@Query() query: Record<string, string>) {
    return this.content.local(query, "medical");
  }
}
