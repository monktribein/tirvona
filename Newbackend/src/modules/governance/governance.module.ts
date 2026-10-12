import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { GovernanceService } from "./application/governance.service";
import { GOVERNANCE_REPOSITORY } from "./domain/governance.repository";
import { GOVERNANCE_MODELS } from "./infrastructure/persistence/governance.schemas";
import { PgGovernanceRepository } from "./infrastructure/persistence/pg-governance.repository";
import {
  AdminCrudController,
  ApprovalsController,
  EnterpriseNotificationsController,
  InstitutionsController,
} from "./presentation/governance.controllers";
@Module({
  imports: [OrmModule.forFeature(GOVERNANCE_MODELS)],
  controllers: [
    ApprovalsController,
    InstitutionsController,
    EnterpriseNotificationsController,
    AdminCrudController,
  ],
  providers: [
    GovernanceService,
    { provide: GOVERNANCE_REPOSITORY, useClass: PgGovernanceRepository },
  ],
})
export class GovernanceModule {}
