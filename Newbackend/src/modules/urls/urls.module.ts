import { Global, Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { UrlResolverService } from "./application/url-resolver.service";
import { UrlRedirectSchema } from "./infrastructure/url-redirect.schema";
import { UrlController } from "./presentation/url.controller";

/**
 * Global so any module can register its own legacy-url resolver and record a
 * slug change without importing this module explicitly.
 */
@Global()
@Module({
  imports: [
    OrmModule.forFeature([
      { name: "UrlRedirect", schema: UrlRedirectSchema },
    ]),
  ],
  controllers: [UrlController],
  providers: [UrlResolverService],
  exports: [UrlResolverService, OrmModule],
})
export class UrlsModule {}
