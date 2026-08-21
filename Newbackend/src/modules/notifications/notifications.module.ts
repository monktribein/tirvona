import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { BookingsModule } from "../bookings/bookings.module";
import { ParkingModule } from "../parking/parking.module";
import { UsersModule } from "../users/users.module";
import { CommunityModule } from "../community/community.module";
import { NotificationOutboxService } from "./notification-outbox.service";
import { NotificationWorker } from "./notification.worker";
import { NotificationsGateway } from "./notifications.gateway";
import { WhatsAppModule } from "../../integrations/whatsapp/whatsapp.module";
@Module({
  imports: [
    BookingsModule,
    ParkingModule,
    UsersModule,
    CommunityModule,
    WhatsAppModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwtSecret") || "development-only-secret",
        verifyOptions: {
          issuer: config.get<string>("jwtIssuer"),
          audience: config.get<string>("jwtAudience"),
        },
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(
          config.get<string>("redisUrl") ?? "redis://127.0.0.1:6379",
        );
        return {
          prefix: config.get<string>("queuePrefix") ?? "tirvona",
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === "rediss:" ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: "notifications" }),
  ],
  providers: [
    NotificationsGateway,
    NotificationOutboxService,
    NotificationWorker,
  ],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
