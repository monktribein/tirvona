import { Body, Controller, Get, Header, HttpException, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { CurrentUser, type AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { SeoPublishingService } from "../application/seo-publishing.service";
import {
  CreateSeoPageDto,
  SeoMetaQueryDto,
  SeoPagesQueryDto,
  SeoTransitionDto,
  UpdateSeoPageDto,
} from "./seo-publishing.dto";

const ACTIONS = ["submit", "verify", "approve", "reject", "publish", "retire"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * SEO publishing (docs/seo/README.md). Admin routes need a signed-in user with one of the
 * seo.pages.* permissions (super_admin has all); each action checks its own permission in the
 * service. `GET /seo/meta` is public and returns published overrides only.
 */
@Controller("seo")
export class SeoPublishingController {
  constructor(private readonly publishing: SeoPublishingService) {}

  /** Same limits as /seo/render: every in-app navigation calls it once. */
  @Public()
  @SkipThrottle({ default: true })
  @Get("meta")
  @Header("Cache-Control", "public, max-age=300")
  async meta(@Query() query: SeoMetaQueryDto) {
    const result = await this.publishing.publicMeta(query.path);
    if (result.status === 404) throw new NotFoundException("No published SEO record for this page.");
    if (result.status === 410) throw new HttpException({ success: false, message: "This page was removed.", redirectTo: result.redirectTo }, 410);
    return { success: true, data: result.meta };
  }

  @ApiBearerAuth()
  @Get("pages")
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: SeoPagesQueryDto) {
    return { success: true, data: await this.publishing.list(user, query) };
  }

  @ApiBearerAuth()
  @Get("pages/:id")
  async get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { success: true, data: await this.publishing.get(user, id) };
  }

  @ApiBearerAuth()
  @Post("pages")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSeoPageDto) {
    return { success: true, data: await this.publishing.create(user, dto) };
  }

  @ApiBearerAuth()
  @Patch("pages/:id")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateSeoPageDto) {
    return { success: true, data: await this.publishing.update(user, id, dto) };
  }

  @ApiBearerAuth()
  @Post("pages/:id/:action")
  async transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() dto: SeoTransitionDto,
  ) {
    if (!(ACTIONS as readonly string[]).includes(action)) throw new NotFoundException();
    return { success: true, data: await this.publishing.transition(user, id, action as Action, dto) };
  }
}
