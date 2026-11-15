/**
 * Test harness for Yatra: the real module, controllers, role guard, validation pipe and error
 * filter on a real Postgres 17 (the embedded instance from test/pg/global-setup.js).
 * Faked on purpose: authentication (a test header instead of a JWT), notifications, private document
 * storage and, optionally, the Razorpay reconciliation client. Razorpay checkout runs in demo mode.
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
import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { OrmModule, getModelToken } from "../../../database/orm-nest";
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
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
import { FcmService } from "../../notifications/fcm/fcm.service";
import { NotificationsModule } from "../../notifications/notifications.module";
import { YatraModule } from "../yatra.module";
import { YatraDocumentStorage } from "../application/yatra-support.service";
import { RAZORPAY_RECON_CLIENT, type RazorpayReconClient } from "../application/yatra-finance.service";

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

export const as = (user: TestUser) => ({ "x-test-user": JSON.stringify(user) });

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const header = req.headers["x-test-user"];
    if (header) req.user = JSON.parse(String(header));
    if (isPublic) return true;
    if (!header) throw new UnauthorizedException("Authentication required");
    return true;
  }
}

export class FakeStorage {
  stored: string[] = [];
  async put(buffer: Buffer, folder: string, resourceType: string) {
    const publicId = `${folder}/doc-${this.stored.length + 1}`;
    this.stored.push(publicId);
    return { publicId, resourceType, format: "png", bytes: buffer.length };
  }
  signedUrl(storage: { publicId: string }) {
    return { url: `https://signed.example.test/${storage.publicId}?exp=300`, expiresAt: new Date(Date.now() + 300_000) };
  }
  async remove() {}
}

export const PNG = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(32, 1)]);
export const demoPay = () => `demo_pay_${randomBytes(6).toString("hex")}`;

export interface YatraTestApp {
  app: INestApplication;
  db: TestDatabase;
  model: (name: string) => any;
  rows: (sql: string, params?: unknown[]) => Promise<any[]>;
  get: (path: string, user?: TestUser) => request.Test;
  post: (path: string, user: TestUser | null, body?: object) => request.Test;
  patch: (path: string, user: TestUser, body?: object) => request.Test;
  put: (path: string, user: TestUser, body?: object) => request.Test;
  upload: (path: string, user: TestUser, fields: Record<string, string>, fileField?: string) => request.Test;
  newUser: (role: string, name: string) => Promise<TestUser>;
  close: () => Promise<void>;
}

let counter = 0;

export async function createYatraTestApp(options: { recon?: RazorpayReconClient } = {}): Promise<YatraTestApp> {
  Object.assign(process.env, {
    NODE_ENV: "test",
    YATRA_ENABLED: "true",
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: "",
    JWT_SECRET: "yatra-test-jwt-secret-that-is-long-enough-123",
    FRONTEND_URL: "https://www.tirvona.test",
    PAYOUT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  });
  const db = await createTestDatabase(REGISTRY.tables);
  enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

  @Global()
  @Module({
    providers: [
      { provide: InAppNotificationService, useValue: { notifyUsers: async () => undefined } },
      { provide: NotificationsGateway, useValue: { send: () => undefined } },
      { provide: FcmService, useValue: {} },
    ],
    exports: [InAppNotificationService, NotificationsGateway, FcmService],
  })
  class FakeNotificationsModule {}

  @Global()
  @Module({ providers: [TransactionService], exports: [TransactionService] })
  class TransactionsModule {}

  let builder = Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }), OrmModule.forRoot(DRIVER_URI), TransactionsModule, YatraModule],
    providers: [
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
      { provide: APP_PIPE, useValue: new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }) },
    ],
  })
    .overrideModule(NotificationsModule)
    .useModule(FakeNotificationsModule)
    .overrideProvider(YatraDocumentStorage)
    .useValue(new FakeStorage());
  if (options.recon) builder = builder.overrideProvider(RAZORPAY_RECON_CLIENT).useValue(options.recon);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL });
  await app.init();
  // One listening server for every request (supertest would otherwise listen once per request).
  await app.listen(0, "127.0.0.1");

  const http = () => request(app.getHttpServer());
  const model = (name: string) => app.get(getModelToken(name));
  return {
    app,
    db,
    model,
    rows: async (sql, params = []) => (await db.pool.query(sql, params)).rows,
    get: (path, user) => (user ? http().get(`/api${path}`).set(as(user)) : http().get(`/api${path}`)),
    post: (path, user, body = {}) => (user ? http().post(`/api${path}`).set(as(user)).send(body) : http().post(`/api${path}`).send(body)),
    patch: (path, user, body = {}) => http().patch(`/api${path}`).set(as(user)).send(body),
    put: (path, user, body = {}) => http().put(`/api${path}`).set(as(user)).send(body),
    upload: (path, user, fields, fileField = "file") => {
      const req = http().post(`/api${path}`).set(as(user));
      for (const [k, v] of Object.entries(fields)) req.field(k, v);
      return req.attach(fileField, PNG, "doc.png");
    },
    newUser: async (role, name) => {
      const n = ++counter;
      const { Types } = await import("../../../database/orm");
      const user: TestUser = {
        id: new Types.ObjectId().toHexString(),
        name,
        email: `user${n}.${Date.now()}@example.test`,
        phone: `9${String(800000000 + n * 7919).slice(0, 9)}`,
        role,
        status: "active",
        permissions: [],
        scopedAshramIds: [],
        scopedTempleIds: [],
      };
      await model("YatraUserRef").create({ _id: user.id, name, email: user.email, phone: user.phone, role, status: "active", isDeleted: false });
      return user;
    },
    close: async () => {
      await app.close();
      await db.drop();
    },
  };
}

/**
 * An approved organiser with a verified vehicle, a published tour to `destination` and an open
 * departure `daysAhead` days out. Returns everything a test needs to book.
 */
export async function seedOrganiser(
  ctx: YatraTestApp,
  admin: TestUser,
  owner: TestUser,
  opts: { name: string; destination?: string; seats?: number; blocked?: string[]; daysAhead?: number; seatMode?: string } ,
) {
  const reg = await ctx.post("/v1/yatra/operator/register", owner, { organisationName: opts.name, city: "Delhi", contactPhone: "9876500001" }).expect(201);
  const operatorId = reg.body.data.operator.id;
  await ctx.patch("/v1/yatra/operator/profile", owner, { panNumber: "ABCDE1234F" }).expect(200);
  await ctx.upload("/v1/yatra/operator/documents", owner, { documentType: "pan_card" }).expect(201);
  await ctx.post("/v1/yatra/operator/submit", owner, { acceptTerms: true }).expect(201);
  await ctx.post(`/v1/yatra/admin/operators/${operatorId}/review`, admin, { action: "approve" }).expect(201);
  await ctx.put("/v1/yatra/operator/payout", owner, { accountHolderName: opts.name, accountNumber: "123456789012", ifsc: "SBIN0001234", bankName: "SBI" }).expect(200);
  const reg2 = `UP${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const vehicle = await ctx.post("/v1/yatra/operator/vehicles", owner, { registrationNumber: reg2, seatCapacity: opts.seats ?? 20, layoutTemplate: "2x2" }).expect(201);
  for (const documentType of ["registration_certificate", "insurance", "tourist_permit"])
    await ctx.upload("/v1/yatra/operator/documents", owner, { documentType, vehicleId: vehicle.body.data.id }).expect(201);
  await ctx.post(`/v1/yatra/operator/vehicles/${vehicle.body.data.id}/submit`, owner).expect(201);
  await ctx.post(`/v1/yatra/admin/vehicles/${vehicle.body.data.id}/review`, admin, { action: "approve" }).expect(201);
  const tour = await ctx.post("/v1/yatra/operator/tours", owner, {
    title: `${opts.name} Braj Yatra`,
    originCity: "Delhi",
    destinationCity: opts.destination ?? "Vrindavan",
    durationDays: 2,
    baseFare: 1500,
    summary: "Darshan",
    itinerary: [{ dayNumber: 1, title: "Day one" }],
    inclusions: ["Bus"],
  }).expect(201);
  await ctx.post(`/v1/yatra/operator/tours/${tour.body.data.id}/submit`, owner).expect(201);
  await ctx.post(`/v1/yatra/admin/tours/${tour.body.data.id}/review`, admin, { action: "publish" }).expect(201);
  const departure = await openDeparture(ctx, owner, tour.body.data.id, vehicle.body.data.id, opts);
  return { operatorId, vehicleId: vehicle.body.data.id, tourId: tour.body.data.id, ...departure };
}

export async function openDeparture(ctx: YatraTestApp, owner: TestUser, tourId: string, vehicleId: string, opts: { blocked?: string[]; daysAhead?: number; seatMode?: string }) {
  const dep = await ctx.post("/v1/yatra/operator/departures", owner, {
    tourId,
    vehicleId,
    departAt: new Date(Date.now() + (opts.daysAhead ?? 10) * 86_400_000).toISOString(),
    blockedSeats: opts.blocked ?? [],
    seatMode: opts.seatMode ?? "choose",
    boardingPoints: [{ name: "Kashmere Gate ISBT" }],
  }).expect(201);
  await ctx.post(`/v1/yatra/operator/departures/${dep.body.data.id}/open`, owner).expect(201);
  return { departureId: dep.body.data.id as string, code: dep.body.data.departureCode as string, boardingPointId: dep.body.data.boardingPoints[0].id as string, departAt: dep.body.data.departAt as string };
}

/** Holds seats and pays for them in demo mode. Returns the confirmed booking and journey. */
export async function bookAndPay(ctx: YatraTestApp, user: TestUser, dep: { code: string; boardingPointId: string }, seats: string[]) {
  const held = await ctx.post("/v1/yatra/bookings", user, {
    departureCode: dep.code,
    boardingPointId: dep.boardingPointId,
    seats,
    passengers: seats.map((s, i) => ({ name: `Traveller ${i + 1}` })),
    contact: { name: user.name, phone: "9876543210" },
  }).expect(201);
  const order = await ctx.post(`/v1/yatra/bookings/${held.body.data.id}/payment-order`, user).expect(201);
  const paid = await ctx.post(`/v1/yatra/bookings/${held.body.data.id}/confirm-payment`, user, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
  return { bookingId: held.body.data.id as string, journeyId: paid.body.data.journeyId as string, orderId: order.body.data.orderId as string };
}
