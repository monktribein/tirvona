import { Module } from "@nestjs/common";
import { AshramsModule } from "../ashrams/ashrams.module";
import { AuditModule } from "../audit/audit.module";
import { VerificationService } from "./application/verification.service";
import { VerificationController } from "./presentation/verification.controller";
import { UsersModule } from "../users/users.module";
@Module({
  imports: [AshramsModule, AuditModule, UsersModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
