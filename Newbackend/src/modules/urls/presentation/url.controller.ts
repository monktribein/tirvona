import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../../common/decorators/public.decorator";
import { UrlResolverService } from "../application/url-resolver.service";

@ApiTags("URLs")
@Controller("url")
export class UrlController {
  constructor(private readonly resolver: UrlResolverService) {}

  /**
   * nginx proxies legacy id-based paths here, e.g.
   *   /ashram/68a1f0c2d3e4f5a6b7c8d9e0
   * arrives as
   *   /url/resolve/ashram/68a1f0c2d3e4f5a6b7c8d9e0
   * and this answers with a real 301 so search engines move their ranking to
   * the new slug URL. Anything unknown gets a 404, never a bounce to "/".
   */
  @Public()
  @Get("resolve/*")
  async resolveLegacy(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const original = request.path.replace(/^\/url\/resolve/, "") || "/";
    const target = await this.resolver.resolve(original);

    response.setHeader("Cache-Control", "no-store");
    if (!target) {
      response.status(404).json({
        success: false,
        statusCode: 404,
        message: "That page does not exist.",
        path: original,
      });
      return;
    }
    response.redirect(301, target);
  }

  /**
   * Lets the SPA ask where a path should go without following a redirect,
   * so client-side navigation can replace the URL in one hop.
   */
  @Public()
  @Get("lookup")
  async lookup(@Query("path") path?: string) {
    const target = path ? await this.resolver.resolve(path) : null;
    return target
      ? { success: true, found: true, redirectTo: target, status: 301 }
      : { success: true, found: false, redirectTo: null, status: 404 };
  }
}
