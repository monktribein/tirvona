/**
 * Test harness for the HR module: the real controllers, guards (roles and permissions), pipes,
 * filters and services running on a real Postgres 17 (the embedded instance started by
 * test/pg/global-setup.js), never the hosted database.
 *
 * Faked on purpose: authentication (the signed-in user is read from a test header instead of a
 * JWT) and the notification channel, which records what would have been sent. The scheduled
 * reminder sweep never runs on its own: no ScheduleModule is loaded.
 */
import "reflect-metadata";
import {
  Global,
  Injectable,
  Module,
  UnauthorizedException,
  ValidationPipe,
  VERSION_NEUTRAL,
  VersioningType,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, Reflector } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { OrmModule } from "../../../database/orm-nest";
import { Test } from "@nestjs/testing";
import { ApiExceptionFilter } from "../../../common/filters/api-exception.filter";
import { RequestIdInterceptor } from "../../../common/interceptors/request-id.interceptor";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import { environment } from "../../../config/environment";
import { DRIVER_URI } from "../../../database/database";
import { enablePostgresDriver } from "../../../database/pg/pg-driver";
import { REGISTRY } from "../../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../../database/pg/test-database";
import { InAppNotificationService, type InAppNotificationInput } from "../../notifications/application/in-app-notification.service";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
import { NotificationsModule } from "../../notifications/notifications.module";
import { HrModule } from "../hr.module";

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers["x-test-user"];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    if (!header) throw new UnauthorizedException("Authentication required");
    request.user = JSON.parse(String(header));
    return true;
  }
}

export interface SentNotification extends InAppNotificationInput {
  userIds: string[];
}

export interface HrTestApp {
  app: INestApplication;
  db: TestDatabase;
  sent: SentNotification[];
  close(): Promise<void>;
}

export async function createHrTestApp(): Promise<HrTestApp> {
  const db = await createTestDatabase(REGISTRY.tables);
  enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

  const sent: SentNotification[] = [];
  const fakeGateway = { send: () => undefined };
  const fakeNotifier = {
    notifyUsers: async (userIds: string[], input: InAppNotificationInput) => {
      sent.push({ userIds: [...userIds], ...input });
    },
  };

  @Global()
  @Module({
    providers: [
      { provide: InAppNotificationService, useValue: fakeNotifier },
      { provide: NotificationsGateway, useValue: fakeGateway },
    ],
    exports: [InAppNotificationService, NotificationsGateway],
  })
  class FakeNotificationsModule {}

  @Global()
  @Module({ providers: [TransactionService], exports: [TransactionService] })
  class TestCommonModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      // ignoreEnvFile: tests must never read the workspace .env (it holds real credentials).
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
      OrmModule.forRoot(DRIVER_URI),
      TestCommonModule,
      HrModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
      { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
      {
        provide: APP_PIPE,
        useValue: new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false }),
      },
    ],
  })
    .overrideModule(NotificationsModule)
    .useModule(FakeNotificationsModule)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL });
  await app.init();

  return {
    app,
    db,
    sent,
    async close() {
      await app.close();
      await db.drop();
    },
  };
}
