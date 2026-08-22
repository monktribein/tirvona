import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { USER_REPOSITORY } from "./domain/user.repository";
import { MongooseUserRepository } from "./infrastructure/persistence/mongoose-user.repository";
import { User, UserSchema } from "./infrastructure/persistence/user.schema";
import { AshramsModule } from "../ashrams/ashrams.module";
import { ParkingModule } from "../parking/parking.module";
import { AuditModule } from "../audit/audit.module";
import { UsersService } from "./application/users.service";
import { UsersController } from "./presentation/users.controller";
import { AshramRoleMigrationService } from "./application/ashram-role-migration.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AshramsModule,
    ParkingModule,
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: MongooseUserRepository },
    UsersService,
    AshramRoleMigrationService,
  ],
  exports: [MongooseModule, USER_REPOSITORY],
})
export class UsersModule {}
