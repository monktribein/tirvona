import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { AuditModule } from "../audit/audit.module";
import { ContentService } from "./application/content.service";
import { CONTENT_REPOSITORY } from "./domain/content.repository";
import { PgContentRepository } from "./infrastructure/persistence/pg-content.repository";
import { CONTENT_MODELS } from "./infrastructure/persistence/content.schemas";
import {
  BlogController,
  CmsController,
  LocalServicesController,
  PlannerController,
  SacredServicesController,
} from "./presentation/content.controllers";

@Module({
  imports: [OrmModule.forFeature(CONTENT_MODELS), AuditModule],
  controllers: [
    BlogController,
    CmsController,
    SacredServicesController,
    PlannerController,
    LocalServicesController,
  ],
  providers: [
    ContentService,
    { provide: CONTENT_REPOSITORY, useClass: PgContentRepository },
  ],
  exports: [OrmModule],
})
export class ContentModule {}
