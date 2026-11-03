import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { AuditLogSchema } from "../audit/audit.module";
import { SeoPagesService } from "./application/seo-pages.service";
import { SeoPublishingService } from "./application/seo-publishing.service";
import { SeoRenderService } from "./application/seo-render.service";
import { SEO_PAGE_MODEL, SeoPageSchema } from "./infrastructure/seo-page.schema";
import { SeoController } from "./presentation/seo.controller";
import { SeoPublishingController } from "./presentation/seo-publishing.controller";

/**
 * Server-rendered head tags and crawlable content for public pages, the data behind
 * sitemap.xml, and the SEO publishing workflow. The renderer only reads (other modules'
 * models through the connection); the only table this module writes is its own seo_pages.
 */
@Module({
  imports: [
    OrmModule.forFeature([
      { name: SEO_PAGE_MODEL, schema: SeoPageSchema },
      { name: "AuditLog", schema: AuditLogSchema },
    ]),
  ],
  controllers: [SeoController, SeoPublishingController],
  providers: [SeoPagesService, SeoRenderService, SeoPublishingService],
  exports: [SeoPagesService, SeoRenderService],
})
export class SeoModule {}
