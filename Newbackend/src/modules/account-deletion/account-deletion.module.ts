import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { AccountDeletionService } from "./application/account-deletion.service";
import { OpenCommitmentsService } from "./application/open-commitments.service";
import { AccountDeletionController } from "./presentation/account-deletion.controller";

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService, OpenCommitmentsService],
})
export class AccountDeletionModule {}
