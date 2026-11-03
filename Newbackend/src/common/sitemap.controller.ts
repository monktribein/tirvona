import { Controller, Get, Header } from "@nestjs/common";
import { InjectConnection } from "../database/orm-nest";
import { Connection } from "../database/orm";
import { Public } from "./decorators/public.decorator";
import { buildSitemapEntries, renderSitemapXml } from "../modules/seo/application/seo-sitemap";

/**
 * The single, authoritative sitemap for https://www.tirvona.com. Built from the
 * route policy's static pages and the current public records, with each
 * record's real updatedAt as <lastmod>. The old hand-written
 * frontend/public/sitemap.xml was removed so nginx always reaches this one.
 */
@Controller()
export class SitemapController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Public()
  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  @Header("Cache-Control", "public, max-age=3600")
  async getSitemap(): Promise<string> {
    return renderSitemapXml(await buildSitemapEntries(this.connection));
  }
}
