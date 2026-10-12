import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { CommunityService } from "./application/community.service";
import { COMMUNITY_REPOSITORY } from "./domain/community.repository";
import { COMMUNITY_MODELS } from "./infrastructure/persistence/community.schemas";
import { PgCommunityRepository } from "./infrastructure/persistence/pg-community.repository";
import {
  UserMemoryController,
  VisitorArticlesController,
  VolunteerController,
} from "./presentation/community.controllers";
@Module({
  imports: [OrmModule.forFeature(COMMUNITY_MODELS)],
  controllers: [
    UserMemoryController,
    VolunteerController,
    VisitorArticlesController,
  ],
  providers: [
    CommunityService,
    { provide: COMMUNITY_REPOSITORY, useClass: PgCommunityRepository },
  ],
  exports: [OrmModule],
})
export class CommunityModule {}
