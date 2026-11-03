import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, Res } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { IsArray, IsOptional, IsString, MaxLength, ArrayMaxSize, Matches } from "class-validator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SeoRenderService } from "../application/seo-render.service";

export class InvalidateSeoCacheDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @Matches(/^\/[^\s?#\\]*$/, { each: true, message: "paths must be site-relative paths" })
  paths?: string[];
}

/**
 * Headers the global helmet() middleware adds for JSON API responses. They must
 * not reach the HTML document: its CSP (`script-src 'self'`, `default-src 'self'`)
 * would block the inline gtag snippet, calls to api.tirvona.com, remote images
 * and the Razorpay iframe, and COOP/Referrer-Policy would change payment and
 * analytics behaviour. Dropping them makes the rendered page carry the same
 * headers as the static index.html nginx serves today.
 */
const API_ONLY_HEADERS = [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Cross-Origin-Embedder-Policy",
  "Origin-Agent-Cluster",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-DNS-Prefetch-Control",
  "X-Download-Options",
  "X-Frame-Options",
  "X-Permitted-Cross-Domain-Policies",
  "X-XSS-Protection",
];

const MAX_PATH_LENGTH = 2048;
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\u0000-\u001f\u007f\\]/;

/**
 * Server-rendered HTML for the public website.
 *
 * nginx forwards page requests here with the original request URI in
 * `X-Seo-Path` (see deploy/nginx/tirvona-web.conf, section 3b). If this endpoint fails
 * with a 5xx, nginx serves the plain index.html as before, so the site never
 * depends on it being up. It reads files only from the configured shell path
 * and never fetches URLs, so the requested path cannot reach other hosts or files.
 */
@Controller("seo")
export class SeoController {
  private readonly logger = new Logger(SeoController.name);

  constructor(private readonly renderer: SeoRenderService) {}

  // Every page view arrives from nginx; if TRUST_PROXY is off they all share one
  // per-IP bucket and a busy minute would degrade crawlers to the static shell.
  // The ipAbuse ceiling still applies.
  @Public()
  @SkipThrottle({ default: true })
  @Get("render")
  async render(@Req() req: Request, @Res() res: Response, @Query("path") queryPath?: string): Promise<void> {
    const raw = String(req.headers["x-seo-path"] ?? queryPath ?? "/");
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.length > MAX_PATH_LENGTH || UNSAFE.test(raw)) {
      res.status(400).type("text/plain").send("Bad request");
      return;
    }
    const hashless = raw.split("#")[0];
    const queryAt = hashless.indexOf("?");
    const pathname = queryAt === -1 ? hashless : hashless.slice(0, queryAt);
    const search = queryAt === -1 ? "" : hashless.slice(queryAt);
    try {
      const result = await this.renderer.render(pathname, search);
      for (const header of API_ONLY_HEADERS) res.removeHeader(header);
      res.status(result.status).set(result.headers).send(result.body);
    } catch (error) {
      // 503 tells nginx to fall back to the static index.html.
      this.logger.warn(`SEO render failed for ${pathname}: ${(error as Error).message}`);
      res.status(503).set({ "Retry-After": "30", "Cache-Control": "no-store" }).type("text/plain").send("Unavailable");
    }
  }

  /** Clears cached pages after an editor changes public content. Super admins only. */
  @Post("cache/invalidate")
  @HttpCode(200)
  @ApiBearerAuth()
  @Roles("super_admin")
  invalidate(@Body() dto: InvalidateSeoCacheDto) {
    return { success: true, data: { dropped: this.renderer.invalidate(dto.paths) } };
  }
}
