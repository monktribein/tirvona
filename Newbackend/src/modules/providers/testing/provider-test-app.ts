/**
 * Test harness for the providers module: the real controllers, guards, pipes,
 * filters, interceptors and services running on a real Postgres 17 (the
 * embedded instance started by test/pg/global-setup.js).
 *
 * Faked on purpose: authentication (the signed-in user is read from a test
 * header instead of a JWT) and the notification channel. Everything else is
 * production code, including the Postgres storage driver, transactions and
 * the generated table layout.
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
import { MongooseModule } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ApiExceptionFilter } from "../../../common/filters/api-exception.filter";
import { RequestIdInterceptor } from "../../../common/interceptors/request-id.interceptor";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import { environment } from "../../../config/environment";
import { DRIVER_URI } from "../../../database/database";
import { enablePostgresDriver } from "../../../database/pg/pg-driver";
import { REGISTRY } from "../../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../../database/pg/test-database";
import { UserSchema } from "../../users/infrastructure/persistence/user.schema";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
import { NotificationsModule } from "../../notifications/notifications.module";
import { ProvidersModule } from "../providers.module";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  permissions: string[];
  scopedAshramIds: string[];
  scopedTempleIds: string[];
}

export const newUser = (role = "customer", name = `User ${randomUUID().slice(0, 6)}`): TestUser => ({
  id: new Types.ObjectId().toHexString(),
  name,
  email: `${randomUUID().slice(0, 8)}@example.test`,
  phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
  role,
  status: "active",
  permissions: [],
  scopedAshramIds: [],
  scopedTempleIds: [],
});

/** Header that makes the test guard treat the request as coming from `user`. */
export const as = (user: TestUser) => ({ "x-test-user": JSON.stringify(user) });
export const idemKey = () => `test-${randomUUID().replace(/-/g, "")}`;

export interface SentNotification {
  userIds: string[];
  title: string;
  kind?: string;
}

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

export interface LiveEvent {
  userId: string;
  event: string;
  payload: unknown;
}

export interface ProviderTestApp {
  app: INestApplication;
  liveEvents: LiveEvent[];
  db: TestDatabase;
  notifications: SentNotification[];
  close(): Promise<void>;
}

export async function createProviderTestApp(): Promise<ProviderTestApp> {
  const db = await createTestDatabase(REGISTRY.tables);
  enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

  const notifications: SentNotification[] = [];
  const liveEvents: LiveEvent[] = [];
  const fakeGateway = { send: (userId: string, event: string, payload: unknown) => void liveEvents.push({ userId, event, payload }) };
  const fakeNotifier = {
    notifyUsers: async (userIds: string[], input: { title: string; kind?: string }) => {
      notifications.push({ userIds, title: input.title, kind: input.kind });
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
  class TransactionsModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      // ignoreEnvFile: tests must never read the workspace .env (it holds real credentials).
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
      MongooseModule.forRoot(DRIVER_URI),
      // Only the dev-fixture tests touch users; the providers module itself never reads them.
      MongooseModule.forFeature([{ name: "User", schema: UserSchema }]),
      TransactionsModule,
      ProvidersModule,
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
    notifications,
    liveEvents,
    async close() {
      await app.close();
      await db.drop();
    },
  };
}
