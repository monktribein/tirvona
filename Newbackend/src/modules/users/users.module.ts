import { Module } from "@nestjs/common";
import { OrmModule } from "../../database/orm-nest";
import { USER_REPOSITORY } from "./domain/user.repository";
import { PgUserRepository } from "./infrastructure/persistence/pg-user.repository";
import { User, UserSchema } from "./infrastructure/persistence/user.schema";
import { AshramsModule } from "../ashrams/ashrams.module";
import { TemplesModule } from "../temples/temples.module";
import { ParkingModule } from "../parking/parking.module";
import { AuditModule } from "../audit/audit.module";
import { UsersService } from "./application/users.service";
import { UsersController } from "./presentation/users.controller";
import { AshramRoleMigrationService } from "./application/ashram-role-migration.service";

@Module({
  imports: [
    OrmModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AshramsModule,
    TemplesModule,
    ParkingModule,
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
    UsersService,
    AshramRoleMigrationService,
  ],
  exports: [OrmModule, USER_REPOSITORY],
})
export class UsersModule {}
