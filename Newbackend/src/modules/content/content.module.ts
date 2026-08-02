import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ContentService } from "./application/content.service";
import { CONTENT_REPOSITORY } from "./domain/content.repository";
import { MongooseContentRepository } from "./infrastructure/persistence/mongoose-content.repository";
import { CONTENT_MODELS } from "./infrastructure/persistence/content.schemas";
import {
  BlogController,
  CmsController,
  LocalServicesController,
  PlannerController,
  SacredServicesController,
} from "./presentation/content.controllers";

@Module({
  imports: [MongooseModule.forFeature(CONTENT_MODELS)],
  controllers: [
    BlogController,
    CmsController,
    SacredServicesController,
    PlannerController,
    LocalServicesController,
  ],
  providers: [
    ContentService,
    { provide: CONTENT_REPOSITORY, useClass: MongooseContentRepository },
  ],
})
export class ContentModule {}
