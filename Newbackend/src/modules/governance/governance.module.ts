import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { GovernanceService } from "./application/governance.service";
import { GOVERNANCE_REPOSITORY } from "./domain/governance.repository";
import { GOVERNANCE_MODELS } from "./infrastructure/persistence/governance.schemas";
import { MongooseGovernanceRepository } from "./infrastructure/persistence/mongoose-governance.repository";
import {
  AdminCrudController,
  ApprovalsController,
  EnterpriseNotificationsController,
  InstitutionsController,
} from "./presentation/governance.controllers";
@Module({
  imports: [MongooseModule.forFeature(GOVERNANCE_MODELS)],
  controllers: [
    ApprovalsController,
    InstitutionsController,
    EnterpriseNotificationsController,
    AdminCrudController,
  ],
  providers: [
    GovernanceService,
    { provide: GOVERNANCE_REPOSITORY, useClass: MongooseGovernanceRepository },
  ],
})
export class GovernanceModule {}
