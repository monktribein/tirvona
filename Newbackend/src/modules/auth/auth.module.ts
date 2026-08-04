import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { AuthService } from "./application/auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtStrategy } from "./infrastructure/jwt.strategy";
import { AuthController } from "./presentation/auth.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthChallengeSchema } from "./infrastructure/auth-challenge.schema";
import { ParkingModule } from "../parking/parking.module";

@Module({
  imports: [
    UsersModule,
    // Login needs to tell a Guest Visitor from a role holder, and parking roles
    // are grants in `parking_staff` rather than values of `User.role`.
    // ParkingModule re-exports MongooseModule, so its models resolve here.
    ParkingModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwtSecret") || "development-only-secret",
        signOptions: {
          expiresIn: (config.get<string>("jwtExpiresIn") ?? "30d") as never,
          issuer: config.get<string>("jwtIssuer"),
          audience: config.get<string>("jwtAudience"),
        },
      }),
    }),
    MongooseModule.forFeature([
      { name: "AuthChallenge", schema: AuthChallengeSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
