/**
 * Test harness for the food module: the real controllers, guards, pipes, filters and services running on
 * a real Postgres 17 (the embedded instance started by test/pg/global-setup.js).
 *
 * Faked on purpose: authentication (the signed-in user is read from a test header instead of a JWT) and
 * the notification channel. Everything else is production code, including the Postgres storage driver and
 * the generated table layout. The scheduled sweeps never run: no ScheduleModule is loaded.
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
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { environment } from "../../../config/environment";
import { DRIVER_URI } from "../../../database/database";
import { enablePostgresDriver } from "../../../database/pg/pg-driver";
import { REGISTRY } from "../../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../../database/pg/test-database";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
import { NotificationsModule } from "../../notifications/notifications.module";
import { FoodModule } from "../food.module";

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers["x-test-user"];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!header) throw new UnauthorizedException("Authentication required");
    request.user = JSON.parse(String(header));
    return true;
  }
}

export interface FoodTestApp {
  app: INestApplication;
  db: TestDatabase;
  close(): Promise<void>;
}

export async function createFoodTestApp(): Promise<FoodTestApp> {
  const db = await createTestDatabase(REGISTRY.tables);
  enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

  const fakeGateway = { send: () => undefined };
  const fakeNotifier = { notifyUsers: async () => undefined };

  @Global()
  @Module({
    providers: [
      { provide: InAppNotificationService, useValue: fakeNotifier },
      { provide: NotificationsGateway, useValue: fakeGateway },
    ],
    exports: [InAppNotificationService, NotificationsGateway],
  })
  class FakeNotificationsModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      // ignoreEnvFile: tests must never read the workspace .env (it holds real credentials).
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
      OrmModule.forRoot(DRIVER_URI),
      FoodModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
      {
        provide: APP_PIPE,
        useValue: new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
          stopAtFirstError: false,
        }),
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
    async close() {
      await app.close();
      await db.drop();
    },
  };
}
