import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommunityService } from "./application/community.service";
import { COMMUNITY_REPOSITORY } from "./domain/community.repository";
import { COMMUNITY_MODELS } from "./infrastructure/persistence/community.schemas";
import { MongooseCommunityRepository } from "./infrastructure/persistence/mongoose-community.repository";
import {
  UserMemoryController,
  VisitorArticlesController,
  VolunteerController,
} from "./presentation/community.controllers";
@Module({
  imports: [MongooseModule.forFeature(COMMUNITY_MODELS)],
  controllers: [
    UserMemoryController,
    VolunteerController,
    VisitorArticlesController,
  ],
  providers: [
    CommunityService,
    { provide: COMMUNITY_REPOSITORY, useClass: MongooseCommunityRepository },
  ],
})
export class CommunityModule {}
