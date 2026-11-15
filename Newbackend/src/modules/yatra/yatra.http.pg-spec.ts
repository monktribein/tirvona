/// <reference types="jest" />
/**
 * Tirvona Yatra end to end on a real Postgres 17: the real controllers, role guard, validation pipe,
 * error filter, services, wallet and the Postgres storage driver with the generated table layout.
 * Faked on purpose: authentication (a test header instead of a JWT), notifications, and Cloudinary
 * (private document storage). Razorpay runs in its built-in demo mode (no keys), which is refused in
 * production. Run with `npm run test:pg`.
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
import { OrmModule, getModelToken } from "../../database/orm-nest";
import { ApiExceptionFilter } from "../../common/filters/api-exception.filter";
import { RequestIdInterceptor } from "../../common/interceptors/request-id.interceptor";
import { RolesGuard } from "../../common/guards/roles.guard";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { TransactionService } from "../../common/database/transaction.service";
import { environment } from "../../config/environment";
import { DRIVER_URI } from "../../database/database";
import { enablePostgresDriver } from "../../database/pg/pg-driver";
import { REGISTRY } from "../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../database/pg/test-database";
import { InAppNotificationService } from "../notifications/application/in-app-notification.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { FcmService } from "../notifications/fcm/fcm.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { newUser, as, type TestUser } from "../providers/testing/provider-test-app";
import { YatraModule } from "./yatra.module";
import { YatraDocumentStorage } from "./application/yatra-support.service";
import { YatraWebhookService } from "./application/yatra-insights.service";
import { YatraBookingService } from "./application/yatra-booking.service";

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

const stored: string[] = [];
class FakeStorage {
  async put(buffer: Buffer, folder: string, resourceType: string) {
    const publicId = `${folder}/doc-${stored.length + 1}`;
    stored.push(publicId);
    return { publicId, resourceType, format: "png", bytes: buffer.length };
  }
  signedUrl(storage: { publicId: string }) {
    return { url: `https://signed.example.test/${storage.publicId}?exp=300`, expiresAt: new Date(Date.now() + 300_000) };
  }
  async remove() {}
}

const PNG = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(32, 1)]);
const day = 86_400_000;
const demoPay = () => `demo_pay_${randomBytes(6).toString("hex")}`;

describe("Tirvona Yatra (real Postgres)", () => {
  let db: TestDatabase;
  let app: INestApplication;
  const model = (name: string) => app.get(getModelToken(name));
  const rows = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows;

  const http = () => request(app.getHttpServer());
  const get = (path: string, user?: TestUser) => (user ? http().get(`/api${path}`).set(as(user)) : http().get(`/api${path}`));
  const post = (path: string, user: TestUser | null, body: object = {}) =>
    user ? http().post(`/api${path}`).set(as(user)).send(body) : http().post(`/api${path}`).send(body);
  const patch = (path: string, user: TestUser, body: object = {}) => http().patch(`/api${path}`).set(as(user)).send(body);
  const put = (path: string, user: TestUser, body: object = {}) => http().put(`/api${path}`).set(as(user)).send(body);
  const upload = (user: TestUser, fields: Record<string, string>) => {
    const req = http().post("/api/v1/yatra/operator/documents").set(as(user));
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    return req.attach("file", PNG, "doc.png");
  };

  const ownerA = newUser("customer", "Shyam Travels Owner");
  const ownerB = newUser("customer", "Radhe Tours Owner");
  const staffA = newUser("customer", "Shyam Staff");
  const superAdmin = newUser("super_admin", "Super Admin");
  const support = newUser("support", "Support Sam");
  const foodOwner = newUser("customer", "Kitchen Owner");
  const pandit = newUser("pandit_provider", "Pandit Ji");
  const pilgrims = Array.from({ length: 12 }, (_, i) => newUser("customer", `Pilgrim ${i + 1}`));

  const state: Record<string, any> = {};

  const passengers = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Traveller ${i + 1}`, age: 30 + i, gender: "female" }));
  const book = (user: TestUser, body: Record<string, unknown>) =>
    post("/v1/yatra/bookings", user, {
      departureCode: state.code,
      boardingPointId: state.boardingPointId,
      contact: { name: user.name, phone: user.phone },
      ...body,
    });
  const payDemo = async (user: TestUser, bookingId: string) => {
    const order = await post(`/v1/yatra/bookings/${bookingId}/payment-order`, user).expect(201);
    expect(order.body.data.demo).toBe(true);
    const paymentId = demoPay();
    const res = await post(`/v1/yatra/bookings/${bookingId}/confirm-payment`, user, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId });
    return { res, orderId: order.body.data.orderId as string, paymentId };
  };
  const walletBalance = async (user: TestUser) => Number((await model("PilgrimWallet").findOne({ userId: user.id }).lean())?.balance ?? 0);

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      YATRA_ENABLED: "true",
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      JWT_SECRET: "yatra-test-jwt-secret-that-is-long-enough-123",
      FRONTEND_URL: "https://www.tirvona.test",
      PAYOUT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    });
    db = await createTestDatabase(REGISTRY.tables);
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

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
        OrmModule.forRoot(DRIVER_URI),
        TransactionsModule,
        YatraModule,
      ],
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
      .useClass(FakeStorage)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL });
    await app.init();

    // Rows owned by other modules that Yatra only reads.
    for (const u of [ownerA, ownerB, staffA, superAdmin, foodOwner, pandit, ...pilgrims])
      await model("YatraUserRef").create({ _id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: "active", isDeleted: false });
    state.vendor = await model("YatraFoodVendorRef").create({ businessName: "Brij Bhojanalaya", ownerUserId: foodOwner.id, status: "active" });
    state.provider = await model("YatraProviderRef").create({ userId: pandit.id, displayName: "Pandit Ramesh", homeCity: "Vrindavan", status: "ACTIVE", isPubliclyListed: true });
    state.circuit = await model("YatraCircuitRef").create({ name: "Braj 84 Kos Darshan", startCity: "Mathura", endCity: "Vrindavan", state: "Uttar Pradesh", durationDays: 2, status: "approved", usableAsPlannerTemplate: true });
    await model("YatraCircuitStopRef").create({ circuitId: state.circuit._id, dayNumber: 1, order: 0, name: "Shri Krishna Janmabhoomi", city: "Mathura", stopType: "temple" });
    await model("YatraCircuitStopRef").create({ circuitId: state.circuit._id, dayNumber: 2, order: 0, name: "Banke Bihari Temple", city: "Vrindavan", stopType: "temple" });
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  });

  // ===================================================================== organisers
  describe("organiser registration and Super Admin approval", () => {
    it("registers an organiser once per account, as its owner", async () => {
      const res = await post("/v1/yatra/operator/register", ownerA, { organisationName: "Shyam Travels", city: "Mathura", contactPhone: "9876500001" }).expect(201);
      expect(res.body.data).toMatchObject({ registered: true, operator: { organisationName: "Shyam Travels", status: "draft" }, member: { role: "owner" } });
      expect(res.body.data.permissions).toContain("manageStaff");
      await post("/v1/yatra/operator/register", ownerA, { organisationName: "Again" }).expect(409);
      await get("/v1/yatra/operator/me").expect(401);
    });

    it("refuses submission until PAN details and the PAN document are in", async () => {
      const res = await post("/v1/yatra/operator/submit", ownerA, { acceptTerms: true }).expect(400);
      expect(res.body.message).toMatch(/PAN/);
      await patch("/v1/yatra/operator/profile", ownerA, { panNumber: "ABCDE1234F", address: "Holi Gate, Mathura" }).expect(200);
      await patch("/v1/yatra/operator/profile", ownerA, { panNumber: "bad" }).expect(400);
      const doc = await upload(ownerA, { documentType: "pan_card", documentNumber: "ABCDE1234F" }).expect(201);
      expect(doc.body.data).toMatchObject({ documentType: "pan_card", status: "pending", mimeType: "image/png" });
      expect(JSON.stringify(doc.body.data)).not.toMatch(/https?:\/\//);
      state.panDocId = doc.body.data.id;
      const link = await get(`/v1/yatra/operator/documents/${state.panDocId}/link`, ownerA).expect(200);
      expect(link.body.data.url).toMatch(/^https:\/\/signed\.example\.test\//);
      await http().post("/api/v1/yatra/operator/documents").set(as(ownerA)).field("documentType", "pan_card").attach("file", Buffer.from("not a real file at all"), "x.txt").expect(400);
    });

    it("submits, then locks the legal identity", async () => {
      await post("/v1/yatra/operator/submit", ownerA, { acceptTerms: false }).expect(400);
      const res = await post("/v1/yatra/operator/submit", ownerA, { acceptTerms: true }).expect(201);
      expect(res.body.data.operator.status).toBe("submitted");
      await patch("/v1/yatra/operator/profile", ownerA, { organisationName: "Renamed Travels" }).expect(400);
    });

    it("lets only Super Admin review organisers and documents", async () => {
      const { body } = await get("/v1/yatra/admin/operators?status=submitted", superAdmin).expect(200);
      state.operatorA = body.data[0].id;
      await post(`/v1/yatra/admin/operators/${state.operatorA}/review`, ownerA, { action: "approve" }).expect(403);
      await post(`/v1/yatra/admin/operators/${state.operatorA}/review`, support, { action: "approve" }).expect(403);
      await post(`/v1/yatra/admin/operators/${state.operatorA}/review`, superAdmin, { action: "reject" }).expect(400);
      await post(`/v1/yatra/admin/documents/${state.panDocId}/review`, superAdmin, { decision: "approve" }).expect(201);
      const approved = await post(`/v1/yatra/admin/operators/${state.operatorA}/review`, superAdmin, { action: "approve", note: "KYC verified" }).expect(201);
      expect(approved.body.data.status).toBe("approved");
      await post(`/v1/yatra/admin/operators/${state.operatorA}/review`, superAdmin, { action: "approve" }).expect(409);
      const audit = await get("/v1/yatra/admin/audit?action=operator.approve", superAdmin).expect(200);
      expect(audit.body.data[0]).toMatchObject({ action: "operator.approve", before: { status: "submitted" }, after: { status: "approved" } });
    });

    it("stores payout details encrypted and shows only the last four digits", async () => {
      const res = await put("/v1/yatra/operator/payout", ownerA, { accountHolderName: "Shyam Travels", accountNumber: "123456789012", ifsc: "SBIN0001234", bankName: "SBI" }).expect(200);
      expect(res.body.data.operator.payout).toMatchObject({ accountNumberLast4: "9012" });
      expect(JSON.stringify(res.body)).not.toContain("123456789012");
      const [row] = await rows("SELECT payout FROM public.yatra_operators WHERE id = $1", [state.operatorA]);
      expect(JSON.stringify(row.payout)).not.toContain("123456789012");
      await put("/v1/yatra/operator/payout", staffA, { accountHolderName: "Staff Person", upiId: "staff@upi" }).expect(404);
    });
  });

  // ======================================================================= staff
  describe("organiser staff", () => {
    it("adds an existing Tirvona account as staff, whose role is limited", async () => {
      await post("/v1/yatra/operator/staff", ownerA, { emailOrPhone: "nobody@example.test", role: "staff" }).expect(404);
      const res = await post("/v1/yatra/operator/staff", ownerA, { emailOrPhone: staffA.email, role: "staff" }).expect(201);
      expect(res.body.data).toMatchObject({ role: "staff", status: "active" });
      const me = await get("/v1/yatra/operator/me", staffA).expect(200);
      expect(me.body.data.permissions).toEqual(expect.arrayContaining(["createBookings", "checkIn"]));
      expect(me.body.data.permissions).not.toContain("manageTours");
      await post("/v1/yatra/operator/tours", staffA, { title: "Staff tour", originCity: "Delhi", destinationCity: "Mathura", durationDays: 1, baseFare: 500 }).expect(403);
      await post("/v1/yatra/operator/staff", staffA, { emailOrPhone: pilgrims[0].email, role: "staff" }).expect(403);
    });
  });

  // ==================================================================== vehicles
  describe("vehicles", () => {
    it("needs RC, insurance and a permit before verification", async () => {
      const res = await post("/v1/yatra/operator/vehicles", ownerA, { registrationNumber: "UP85 AT 1234", seatCapacity: 20, layoutTemplate: "2x2", isAc: true, vehicleType: "bus" }).expect(201);
      state.vehicle = res.body.data.id;
      expect(res.body.data.seatLayout.seats).toHaveLength(20);
      await post("/v1/yatra/operator/vehicles", ownerA, { registrationNumber: "up-85-at-1234", seatCapacity: 10 }).expect(409);
      const missing = await post(`/v1/yatra/operator/vehicles/${state.vehicle}/submit`, ownerA).expect(400);
      expect(missing.body.message).toMatch(/registration certificate/);
      for (const documentType of ["registration_certificate", "insurance", "tourist_permit"])
        await upload(ownerA, { documentType, vehicleId: state.vehicle }).expect(201);
      await upload(ownerA, { documentType: "pan_card", vehicleId: state.vehicle }).expect(400);
      await post(`/v1/yatra/operator/vehicles/${state.vehicle}/submit`, ownerA).expect(201);
      await post(`/v1/yatra/admin/vehicles/${state.vehicle}/review`, ownerA, { action: "approve" }).expect(403);
      const ok = await post(`/v1/yatra/admin/vehicles/${state.vehicle}/review`, superAdmin, { action: "approve" }).expect(201);
      expect(ok.body.data.status).toBe("approved");
    });
  });

  // ======================================================================= tours
  describe("tours: organisers draft, only Super Admin publishes", () => {
    it("starts a tour from a Pilgrimage Circuit template without changing the circuit", async () => {
      const list = await get("/v1/yatra/operator/circuit-templates", ownerA).expect(200);
      expect(list.body.data.map((c: any) => c.name)).toContain("Braj 84 Kos Darshan");
      const tpl = await get(`/v1/yatra/operator/circuit-templates/${String(state.circuit._id)}`, ownerA).expect(200);
      expect(tpl.body.data.stops.map((s: any) => s.name)).toEqual(["Shri Krishna Janmabhoomi", "Banke Bihari Temple"]);
      const t = tpl.body.data;
      const res = await post("/v1/yatra/operator/tours", ownerA, {
        title: "Delhi to Braj Darshan",
        originCity: "Delhi",
        destinationCity: "Vrindavan",
        durationDays: 2,
        baseFare: 1500,
        summary: "Two days of Braj darshan by AC bus.",
        stops: t.stops.map((s: any) => ({ name: s.name, dayNumber: s.dayNumber, city: s.city })),
        itinerary: t.itinerary,
        inclusions: ["AC bus", "Guide"],
        circuitTemplateId: t.circuitTemplateId,
      }).expect(201);
      state.tour = res.body.data.id;
      expect(res.body.data).toMatchObject({ status: "draft", circuitTemplateName: "Braj 84 Kos Darshan" });
      const [circuit] = await rows("SELECT name, status FROM public.pilgrimage_circuits WHERE id = $1", [String(state.circuit._id)]);
      expect(circuit).toEqual({ name: "Braj 84 Kos Darshan", status: "approved" });
    });

    it("cannot be published by the organiser, and is locked while in review", async () => {
      await post(`/v1/yatra/admin/tours/${state.tour}/review`, ownerA, { action: "publish" }).expect(403);
      await post(`/v1/yatra/operator/tours/${state.tour}/submit`, ownerA).expect(201);
      const locked = await patch(`/v1/yatra/operator/tours/${state.tour}`, ownerA, { title: "Changed" }).expect(409);
      expect(locked.body.code).toBe("TOUR_LOCKED");
      const pub = await post(`/v1/yatra/admin/tours/${state.tour}/review`, superAdmin, { action: "publish" }).expect(201);
      expect(pub.body.data.status).toBe("published");
    });

    it("will not publish a tour of an organiser that is not approved", async () => {
      await post("/v1/yatra/operator/register", ownerB, { organisationName: "Radhe Tours", city: "Delhi", contactPhone: "9876500002" }).expect(201);
      const t = await post("/v1/yatra/operator/tours", ownerB, { title: "Radhe Yatra", originCity: "Delhi", destinationCity: "Mathura", durationDays: 1, baseFare: 900, summary: "Day trip", itinerary: [{ dayNumber: 1, title: "Mathura" }], inclusions: ["Bus"] }).expect(201);
      state.tourB = t.body.data.id;
      await post(`/v1/yatra/operator/tours/${state.tourB}/submit`, ownerB).expect(201);
      const refused = await post(`/v1/yatra/admin/tours/${state.tourB}/review`, superAdmin, { action: "publish" }).expect(409);
      expect(refused.body.code).toBe("OPERATOR_NOT_APPROVED");
    });
  });

  // ================================================================== departures
  describe("departures and the public site", () => {
    it("creates a draft that is invisible until the owner opens it", async () => {
      const res = await post("/v1/yatra/operator/departures", ownerA, {
        tourId: state.tour,
        vehicleId: state.vehicle,
        departAt: new Date(Date.now() + 10 * day).toISOString(),
        blockedSeats: ["20"],
        boardingPoints: [{ name: "Kashmere Gate ISBT" }, { name: "Sarai Kale Khan" }],
      }).expect(201);
      state.departure = res.body.data.id;
      state.code = res.body.data.departureCode;
      state.boardingPointId = res.body.data.boardingPoints[0].id;
      expect(res.body.data).toMatchObject({ status: "draft", capacity: 19, fare: 1500 });
      const search = await get("/v1/yatra/search?destination=vrindavan").expect(200);
      expect(search.body.data).toHaveLength(0);
      await get(`/v1/yatra/departures/${state.code}`).expect(200).then((r) => expect(r.body.data.bookable).toBe(false));
      await post(`/v1/yatra/operator/departures/${state.departure}/open`, staffA).expect(403);
      const opened = await post(`/v1/yatra/operator/departures/${state.departure}/open`, ownerA).expect(201);
      expect(opened.body.data.status).toBe("scheduled");
      const seats = await rows("SELECT status, count(*)::int AS n FROM public.yatra_seats WHERE departure_id = $1 GROUP BY status ORDER BY status", [state.departure]);
      expect(seats).toEqual([{ status: "available", n: 19 }, { status: "blocked", n: 1 }]);
    });

    it("shows the open departure to everyone", async () => {
      const search = await get("/v1/yatra/search?origin=Delhi&destination=Vrindavan&seats=2").expect(200);
      expect(search.body.data).toHaveLength(1);
      expect(search.body.data[0]).toMatchObject({ departureCode: state.code, seatsLeft: 19, tour: { title: "Delhi to Braj Darshan" }, operator: { name: "Shyam Travels" } });
      expect(JSON.stringify(search.body.data[0])).not.toMatch(/panNumber|ownerUserId|payout/);
      const page = await get(`/v1/yatra/departures/${state.code}`).expect(200);
      expect(page.body.data).toMatchObject({ bookable: true, departure: { seatsLeft: 19 } });
      const filters = await get("/v1/yatra/filters").expect(200);
      expect(filters.body.data.destinations).toContain("Vrindavan");
    });

    it("keeps organisers out of each other's departures", async () => {
      await get(`/v1/yatra/operator/departures/${state.departure}`, ownerB).expect(404);
      await get(`/v1/yatra/operator/departures/${state.departure}/manifest`, ownerB).expect(404);
      await get(`/v1/yatra/operator/departures/${state.departure}`, pilgrims[0]).expect(404);
    });
  });

  // ==================================================================== bookings
  describe("customer booking and payment", () => {
    it("holds the chosen seats, and never lets two bookings hold the same seat", async () => {
      const res = await book(pilgrims[0], { seats: ["1", "2"], passengers: passengers(2) }).expect(201);
      state.booking1 = res.body.data.id;
      expect(res.body.data).toMatchObject({ status: "held", seats: ["1", "2"], source: "MARKETPLACE", pricing: { totalAmount: 3000 } });
      const clash = await book(pilgrims[1], { seats: ["2"], passengers: passengers(1) }).expect(409);
      expect(clash.body.code).toBe("SEAT_TAKEN");
      await book(pilgrims[1], { seats: ["99"], passengers: passengers(1) }).expect(400);
      await book(pilgrims[1], { seats: ["20"], passengers: passengers(1) }).expect(409);
      await book(pilgrims[1], { seats: ["3"], passengers: passengers(2) }).expect(400);
      const map = await get(`/v1/yatra/departures/${state.code}/seats`).expect(200);
      const status = Object.fromEntries(map.body.data.seats.map((s: any) => [s.seatNo, s.status]));
      expect(status).toMatchObject({ "1": "unavailable", "2": "unavailable", "3": "available", "20": "blocked" });
    });

    it("rejects a forged payment and confirms only a verified one", async () => {
      const order = await post(`/v1/yatra/bookings/${state.booking1}/payment-order`, pilgrims[0]).expect(201);
      await post(`/v1/yatra/bookings/${state.booking1}/confirm-payment`, pilgrims[0], { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: "pay_forged", razorpay_signature: "x" }).expect(400);
      await post(`/v1/yatra/bookings/${state.booking1}/confirm-payment`, pilgrims[1], { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(404);
      state.payment1 = demoPay();
      state.order1 = order.body.data.orderId;
      const res = await post(`/v1/yatra/bookings/${state.booking1}/confirm-payment`, pilgrims[0], { razorpay_order_id: state.order1, razorpay_payment_id: state.payment1 }).expect(201);
      expect(res.body.data.booking).toMatchObject({ status: "confirmed", paymentStatus: "paid", pricing: { amountPaid: 3000 } });
      expect(res.body.data.journeyId).toBeTruthy();
      state.journey1 = res.body.data.journeyId;
      const [dep] = await rows("SELECT booked_seats FROM public.yatra_departures WHERE id = $1", [state.departure]);
      expect(dep.booked_seats).toBe(2);
    });

    it("processes duplicate confirmations and webhook retries exactly once", async () => {
      await post(`/v1/yatra/bookings/${state.booking1}/confirm-payment`, pilgrims[0], { razorpay_order_id: state.order1, razorpay_payment_id: state.payment1 }).expect(201);
      const webhook = app.get(YatraWebhookService);
      expect(await webhook.confirmPaymentFromWebhook(state.order1, state.payment1, { amountPaise: 300000 })).toBe(true);
      expect(await webhook.confirmPaymentFromWebhook(state.order1, state.payment1, { amountPaise: 300000 })).toBe(true);
      expect(await webhook.confirmPaymentFromWebhook("order_not_yatra", "pay_x")).toBe(false);
      const ledger = await rows("SELECT type FROM public.yatra_ledger_entries WHERE booking_id = $1", [state.booking1]);
      expect(ledger).toEqual([{ type: "booking_payment" }]);
      const [dep] = await rows("SELECT booked_seats FROM public.yatra_departures WHERE id = $1", [state.departure]);
      expect(dep.booked_seats).toBe(2);
      expect(await rows("SELECT id FROM public.yatra_journeys WHERE booking_id = $1", [state.booking1])).toHaveLength(1);
    });

    it("returns a second, different payment for the same booking to the wallet, once", async () => {
      const webhook = app.get(YatraWebhookService);
      const extra = demoPay();
      expect(await webhook.confirmPaymentFromWebhook(state.order1, extra, { amountPaise: 300000 })).toBe(true);
      expect(await webhook.confirmPaymentFromWebhook(state.order1, extra, { amountPaise: 300000 })).toBe(true);
      expect(await walletBalance(pilgrims[0])).toBe(3000);
      const types = (await rows("SELECT type FROM public.yatra_ledger_entries WHERE booking_id = $1 ORDER BY type", [state.booking1])).map((r) => r.type);
      expect(types).toEqual(["booking_payment", "unapplied_payment", "unapplied_refund"]);
    });

    it("issues a ticket with a QR code only to its owner", async () => {
      const t = await get(`/v1/yatra/bookings/${state.booking1}/ticket`, pilgrims[0]).expect(200);
      expect(t.body.data.qr).toMatch(/^data:image\/png;base64,/);
      expect(t.body.data.booking.ticketCode).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/);
      state.ticketCode = t.body.data.booking.ticketCode;
      await get(`/v1/yatra/bookings/${state.booking1}/ticket`, pilgrims[1]).expect(404);
    });

    it("handles a failed or abandoned payment by releasing the seat", async () => {
      const res = await book(pilgrims[8], { seats: ["10"], passengers: passengers(1) }).expect(201);
      const order = await post(`/v1/yatra/bookings/${res.body.data.id}/payment-order`, pilgrims[8]).expect(201);
      const mismatch = await post(`/v1/yatra/bookings/${res.body.data.id}/confirm-payment`, pilgrims[8], { razorpay_order_id: state.order1, razorpay_payment_id: demoPay() }).expect(400);
      expect(mismatch.body.code).toBe("ORDER_MISMATCH");
      expect(order.body.data.orderId).not.toBe(state.order1);
      const released = await post(`/v1/yatra/bookings/${res.body.data.id}/release`, pilgrims[8]).expect(201);
      expect(released.body.data.status).toBe("cancelled");
      const [seat] = await rows("SELECT status, booking_id FROM public.yatra_seats WHERE departure_id = $1 AND seat_no = '10'", [state.departure]);
      expect(seat).toEqual({ status: "available", booking_id: null });
    });
  });

  // ============================================================ organiser-assisted
  describe("organiser-assisted booking", () => {
    it("holds seats from the same inventory and records the staff member", async () => {
      const res = await post("/v1/yatra/operator/bookings", staffA, {
        departureId: state.departure,
        seats: ["5"],
        passengers: [{ name: "Kamla Devi", age: 62, gender: "female", phone: "9876543210" }],
        contact: { name: "Kamla Devi", phone: "9876543210" },
        boardingPointId: state.boardingPointId,
      }).expect(201);
      state.assisted = res.body.data.booking.id;
      state.payLink = res.body.data.paymentLink as string;
      expect(res.body.data.booking).toMatchObject({ source: "ORGANIZER", organizerStaffUserId: staffA.id, organizerMemberRole: "staff", customerId: null, status: "held" });
      expect(state.payLink).toMatch(/^https:\/\/www\.tirvona\.test\/yatra\/pay\//);
      const taken = await book(pilgrims[1], { seats: ["5"], passengers: passengers(1) }).expect(409);
      expect(taken.body.code).toBe("SEAT_TAKEN");
      await post("/v1/yatra/operator/bookings", ownerB, { departureId: state.departure, seats: ["6"], passengers: passengers(1), contact: { name: "Other Customer", phone: "9876543210" } }).expect(403);
    });

    it("lets the customer claim and pay through the link; nobody else can", async () => {
      const token = state.payLink.split("/yatra/pay/")[1];
      const summary = await get(`/v1/yatra/payment-links/${token}`).expect(200);
      expect(summary.body.data).toMatchObject({ status: "payable", seats: ["5"], amount: 1500, organiser: "Shyam Travels" });
      await get(`/v1/yatra/payment-links/${token}x`).expect(404);
      const order = await post(`/v1/yatra/payment-links/${token}/order`, pilgrims[2]).expect(201);
      await post(`/v1/yatra/payment-links/${token}/order`, pilgrims[3]).expect(409);
      const paid = await post(`/v1/yatra/payment-links/${token}/confirm`, pilgrims[2], { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      expect(paid.body.data.booking).toMatchObject({ status: "confirmed", source: "ORGANIZER" });
      state.journey2 = paid.body.data.journeyId;
      const staffView = await get(`/v1/yatra/operator/bookings/${state.assisted}`, staffA).expect(200);
      expect(staffView.body.data).toMatchObject({ customerId: pilgrims[2].id, organizerStaffUserId: staffA.id, status: "confirmed" });
      await post(`/v1/yatra/operator/bookings/${state.assisted}/payment-link`, staffA).expect(409);
      expect((await get(`/v1/yatra/payment-links/${token}`).expect(200)).body.data.status).toBe("paid");
    });
  });

  // ================================================================ booking links
  describe("organiser booking links", () => {
    it("attributes a link booking to its organiser, and ignores foreign codes", async () => {
      const link = await post("/v1/yatra/operator/links", ownerA, { tourId: state.tour, departureId: state.departure, campaign: "Temple poster" }).expect(201);
      expect(link.body.data.qr).toMatch(/^data:image\/png/);
      const resolved = await get(`/v1/yatra/links/${link.body.data.code}`).expect(200);
      expect(resolved.body.data.departureCode).toBe(state.code);
      const viaLink = await book(pilgrims[4], { seats: ["11"], passengers: passengers(1), linkCode: link.body.data.code }).expect(201);
      expect(viaLink.body.data.source).toBe("OPERATOR_LINK");
      const pay = await payDemo(pilgrims[4], viaLink.body.data.id);
      expect(pay.res.status).toBe(201);
      const links = await get("/v1/yatra/operator/links", ownerA).expect(200);
      expect(links.body.data[0].bookingsCount).toBe(1);
      const foreign = await book(pilgrims[5], { seats: ["12"], passengers: passengers(1), linkCode: "zzzzzzzz" }).expect(201);
      expect(foreign.body.data.source).toBe("MARKETPLACE");
      await post(`/v1/yatra/bookings/${foreign.body.data.id}/release`, pilgrims[5]).expect(201);
    });
  });

  // =============================================================== expired holds
  describe("expired seat holds", () => {
    const expire = (bookingId: string) =>
      db.pool.query(
        "UPDATE public.yatra_bookings SET hold_expires_at = now() - interval '10 minutes' WHERE id = $1; ",
        [bookingId],
      ).then(() => db.pool.query("UPDATE public.yatra_seats SET hold_expires_at = now() - interval '10 minutes' WHERE booking_id = $1", [bookingId]));

    it("lets another customer take a seat whose hold lapsed, and refunds the late payer", async () => {
      const first = await book(pilgrims[6], { seats: ["8"], passengers: passengers(1) }).expect(201);
      const order = await post(`/v1/yatra/bookings/${first.body.data.id}/payment-order`, pilgrims[6]).expect(201);
      await expire(first.body.data.id);
      const second = await book(pilgrims[7], { seats: ["8"], passengers: passengers(1) }).expect(201);
      const late = await post(`/v1/yatra/bookings/${first.body.data.id}/confirm-payment`, pilgrims[6], { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(409);
      expect(late.body.code).toBe("PAYMENT_REFUNDED_TO_WALLET");
      expect(await walletBalance(pilgrims[6])).toBe(1500);
      const [seat] = await rows("SELECT status, booking_id FROM public.yatra_seats WHERE departure_id = $1 AND seat_no = '8'", [state.departure]);
      expect(seat).toEqual({ status: "held", booking_id: second.body.data.id });
      await post(`/v1/yatra/bookings/${second.body.data.id}/release`, pilgrims[7]).expect(201);
    });

    it("expires lapsed holds in the sweep and still accepts a late payment while the seat is free", async () => {
      const b = await book(pilgrims[9], { seats: ["9"], passengers: passengers(1) }).expect(201);
      const order = await post(`/v1/yatra/bookings/${b.body.data.id}/payment-order`, pilgrims[9]).expect(201);
      await expire(b.body.data.id);
      expect(await app.get(YatraBookingService).expireLapsed()).toBeGreaterThanOrEqual(1);
      const [after] = await rows("SELECT status FROM public.yatra_bookings WHERE id = $1", [b.body.data.id]);
      expect(after.status).toBe("expired");
      const [free] = await rows("SELECT status FROM public.yatra_seats WHERE departure_id = $1 AND seat_no = '9'", [state.departure]);
      expect(free.status).toBe("available");
      const paid = await post(`/v1/yatra/bookings/${b.body.data.id}/confirm-payment`, pilgrims[9], { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      expect(paid.body.data.booking.status).toBe("confirmed");
      await post(`/v1/yatra/bookings/${b.body.data.id}/payment-order`, pilgrims[9]).expect(409);
    });
  });

  // ============================================================ manifest & boarding
  describe("manifest and boarding", () => {
    it("lists only confirmed travellers and checks them in with the ticket", async () => {
      const m = await get(`/v1/yatra/operator/departures/${state.departure}/manifest`, staffA).expect(200);
      expect(m.body.data.passengers.map((p: any) => p.seatNo)).toEqual(["1", "2", "5", "9", "11"]);
      const csv = await get(`/v1/yatra/operator/departures/${state.departure}/manifest.csv`, ownerA).expect(200);
      expect(csv.text).toContain("Kamla Devi");
      await post(`/v1/yatra/operator/departures/${state.departure}/check-in`, staffA, { bookingReference: "TVN-YTR-NOPE", ticketCode: "AAA-AAA" }).expect(404);
      const ref = (await get(`/v1/yatra/bookings/${state.booking1}`, pilgrims[0])).body.data.booking.bookingReference;
      await post(`/v1/yatra/operator/departures/${state.departure}/check-in`, staffA, { bookingReference: ref, ticketCode: "WRO-NG0" }).expect(400);
      const ok = await post(`/v1/yatra/operator/departures/${state.departure}/check-in`, staffA, { qr: JSON.stringify({ t: "yatra", r: ref, c: state.ticketCode }), seatNos: ["1"] }).expect(201);
      expect(ok.body.data.passengers.find((p: any) => p.seatNo === "1").checkedInAt).toBeTruthy();
      expect(ok.body.data.passengers.find((p: any) => p.seatNo === "2").checkedInAt).toBeNull();
    });
  });

  // ==================================================== cancellation & wallet refund
  describe("cancellation and wallet refund", () => {
    it("quotes the policy, waits for Super Admin, and refunds to the wallet exactly once", async () => {
      const preview = await get(`/v1/yatra/bookings/${state.booking1}/refund-preview`, pilgrims[0]).expect(200);
      expect(preview.body.data).toMatchObject({ refundPercent: 90, refundAmount: 2700 });
      await post(`/v1/yatra/bookings/${state.booking1}/cancel-request`, pilgrims[1], { reason: "Not mine" }).expect(404);
      const req = await post(`/v1/yatra/bookings/${state.booking1}/cancel-request`, pilgrims[0], { reason: "Family emergency" }).expect(201);
      expect(req.body.data.booking.status).toBe("cancellation_requested");
      await post(`/v1/yatra/bookings/${state.booking1}/cancel-request`, pilgrims[0], { reason: "Again please" }).expect(409);
      await post(`/v1/yatra/admin/bookings/${state.booking1}/cancellation`, ownerA, { decision: "approve" }).expect(403);
      const before = await walletBalance(pilgrims[0]);
      const done = await post(`/v1/yatra/admin/bookings/${state.booking1}/cancellation`, superAdmin, { decision: "approve" }).expect(201);
      expect(done.body.data).toMatchObject({ status: "cancelled", paymentStatus: "partially_refunded", cancellation: { refundAmount: 2700, refundPercent: 90 } });
      expect(await walletBalance(pilgrims[0])).toBe(before + 2700);
      await post(`/v1/yatra/admin/bookings/${state.booking1}/cancellation`, superAdmin, { decision: "approve" }).expect(409);
      expect(await walletBalance(pilgrims[0])).toBe(before + 2700);
      const seats = await rows("SELECT seat_no, status FROM public.yatra_seats WHERE departure_id = $1 AND seat_no IN ('1','2') ORDER BY seat_no", [state.departure]);
      expect(seats).toEqual([{ seat_no: "1", status: "available" }, { seat_no: "2", status: "available" }]);
      const txns = await rows("SELECT idempotency_key FROM public.pilgrim_wallet_transactions WHERE user_id = $1 AND category = 'refund'", [pilgrims[0].id]);
      expect(txns.filter((t) => t.idempotency_key === `refund:yatra:${state.booking1}`)).toHaveLength(1);
      const journey = await get(`/v1/yatra/journeys/${state.journey1}`, pilgrims[0]).expect(200);
      expect(journey.body.data.journey.status).toBe("cancelled");
    });
  });

  // ================================================================= concurrency
  describe("concurrent checkouts", () => {
    it("never oversells: 100 simultaneous attempts on 19 seats sell each seat once", async () => {
      const dep = await post("/v1/yatra/operator/departures", ownerA, {
        tourId: state.tour,
        vehicleId: state.vehicle,
        departAt: new Date(Date.now() + 20 * day).toISOString(),
        blockedSeats: ["20"],
        boardingPoints: [{ name: "Kashmere Gate ISBT" }],
      }).expect(201);
      await post(`/v1/yatra/operator/departures/${dep.body.data.id}/open`, ownerA).expect(201);
      state.raceDeparture = dep.body.data.id;
      const crowd = Array.from({ length: 100 }, (_, i) => newUser("customer", `Racer ${i}`));
      const results = await Promise.all(
        crowd.map((u, i) =>
          post("/v1/yatra/bookings", u, {
            departureCode: dep.body.data.departureCode,
            boardingPointId: dep.body.data.boardingPoints[0].id,
            seats: [String((i % 19) + 1)],
            passengers: passengers(1),
            contact: { name: u.name, phone: u.phone },
          }),
        ),
      );
      const won = results.filter((r) => r.status === 201);
      const lost = results.filter((r) => r.status === 409);
      expect(won).toHaveLength(19);
      expect(lost).toHaveLength(81);
      const held = await rows("SELECT seat_no, count(DISTINCT booking_id)::int AS owners FROM public.yatra_seats WHERE departure_id = $1 AND status = 'held' GROUP BY seat_no", [state.raceDeparture]);
      expect(held).toHaveLength(19);
      expect(held.every((r) => r.owners === 1)).toBe(true);
      const live = await rows("SELECT count(*)::int AS n FROM public.yatra_bookings WHERE departure_id = $1 AND status = 'held'", [state.raceDeparture]);
      expect(live[0].n).toBe(19);
    }, 120_000);

    it("never oversells in automatic seat mode either", async () => {
      const dep = await post("/v1/yatra/operator/departures", ownerA, {
        tourId: state.tour,
        vehicleId: state.vehicle,
        departAt: new Date(Date.now() + 21 * day).toISOString(),
        seatMode: "auto",
        blockedSeats: ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
        boardingPoints: [{ name: "Kashmere Gate ISBT" }],
      }).expect(201);
      await post(`/v1/yatra/operator/departures/${dep.body.data.id}/open`, ownerA).expect(201);
      const crowd = Array.from({ length: 40 }, (_, i) => newUser("customer", `Auto ${i}`));
      const results = await Promise.all(
        crowd.map((u) =>
          post("/v1/yatra/bookings", u, { departureCode: dep.body.data.departureCode, passengers: passengers(1), contact: { name: u.name, phone: u.phone } }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(10);
      const seats = new Set(results.filter((r) => r.status === 201).map((r) => r.body.data.seats[0]));
      expect(seats.size).toBe(10);
    }, 120_000);
  });

  // ============================================================ journey & add-ons
  describe("journey hub and add-ons", () => {
    it("creates one journey per confirmed booking with everything for the trip", async () => {
      const list = await get("/v1/yatra/journeys", pilgrims[2]).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({ id: state.journey2, status: "upcoming", destinationCity: "Vrindavan" });
      const detail = await get(`/v1/yatra/journeys/${state.journey2}`, pilgrims[2]).expect(200);
      expect(detail.body.data).toMatchObject({ booking: { seats: ["5"] }, departure: { boardingPoint: { name: "Kashmere Gate ISBT" } }, operator: { name: "Shyam Travels" } });
      expect(detail.body.data.tour.itinerary.length).toBeGreaterThan(0);
      await get(`/v1/yatra/journeys/${state.journey2}`, pilgrims[0]).expect(404);
    });

    it("attaches the pilgrim's own existing stay booking, read-only", async () => {
      const start = new Date(Date.now() + 10 * day);
      const mine = await model("YatraStayBookingRef").create({ bookingId: "BK-YTR-TEST-1", customerId: pilgrims[2].id, reservationNumber: "TVN-STAY-1", checkInDate: start, checkOutDate: new Date(start.getTime() + day), status: "confirmed" });
      const other = await model("YatraStayBookingRef").create({ bookingId: "BK-YTR-TEST-2", customerId: pilgrims[3].id, reservationNumber: "TVN-STAY-2", checkInDate: start, status: "confirmed" });
      const linkable = await get(`/v1/yatra/journeys/${state.journey2}/linkable`, pilgrims[2]).expect(200);
      expect(linkable.body.data.map((r: any) => r.reference)).toEqual(["TVN-STAY-1"]);
      await post(`/v1/yatra/journeys/${state.journey2}/links`, pilgrims[2], { module: "stay", refId: String(other._id) }).expect(404);
      await post(`/v1/yatra/journeys/${state.journey2}/links`, pilgrims[2], { module: "stay", refId: String(mine._id) }).expect(201);
      await post(`/v1/yatra/journeys/${state.journey2}/links`, pilgrims[2], { module: "stay", refId: String(mine._id) }).expect(409);
      const detail = await get(`/v1/yatra/journeys/${state.journey2}`, pilgrims[2]).expect(200);
      expect(detail.body.data.links).toEqual([expect.objectContaining({ module: "stay", reference: "TVN-STAY-1", status: "confirmed" })]);
    });

    it("confirms a food add-on only after the restaurant accepts and the customer pays", async () => {
      const date = new Date(Date.now() + 10 * day).toISOString();
      await post(`/v1/yatra/journeys/${state.journey2}/requests`, pilgrims[2], { serviceType: "food", serviceDate: new Date(Date.now() + 40 * day).toISOString(), location: "Vrindavan", mealType: "lunch", quantity: 1 }).expect(400);
      const req = await post(`/v1/yatra/journeys/${state.journey2}/requests`, pilgrims[2], { serviceType: "food", serviceDate: date, location: "Parikrama Marg, Vrindavan", mealType: "lunch", quantity: 1, dietaryPreference: "satvik", foodVendorId: String(state.vendor._id) }).expect(201);
      const id = req.body.data.id;
      expect(req.body.data).toMatchObject({ status: "supplier_pending", supplierName: "Brij Bhojanalaya" });
      await post(`/v1/yatra/requests/${id}/payment-order`, pilgrims[2]).expect(409);
      await get("/v1/yatra/supplier/requests", pilgrims[5]).expect(404);
      const inbox = await get("/v1/yatra/supplier/requests", foodOwner).expect(200);
      expect(inbox.body.data[0]).toMatchObject({ id, customer: null });
      await post(`/v1/yatra/supplier/requests/${id}/respond`, foodOwner, { decision: "accept" }).expect(400);
      await post(`/v1/yatra/supplier/requests/${id}/respond`, foodOwner, { decision: "accept", quotedAmount: 250 }).expect(201);
      const order = await post(`/v1/yatra/requests/${id}/payment-order`, pilgrims[2]).expect(201);
      const paid = await post(`/v1/yatra/requests/${id}/confirm-payment`, pilgrims[2], { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      expect(paid.body.data).toMatchObject({ status: "confirmed", paymentStatus: "paid", quotedAmount: 250 });
      const after = await get("/v1/yatra/supplier/requests", foodOwner).expect(200);
      expect(after.body.data[0].customer).toMatchObject({ name: pilgrims[2].name });
      await post(`/v1/yatra/supplier/requests/${id}/fulfil`, foodOwner).expect(201);
    });

    it("routes a puja request through Tirvona to a pandit, who may decline", async () => {
      const req = await post(`/v1/yatra/journeys/${state.journey2}/requests`, pilgrims[2], { serviceType: "puja", serviceDate: new Date(Date.now() + 11 * day).toISOString(), location: "Yamuna Ghat", ritualName: "Yamuna Aarti Sankalp" }).expect(201);
      expect(req.body.data.status).toBe("requested");
      await post(`/v1/yatra/admin/service-requests/${req.body.data.id}/assign`, superAdmin, { providerId: String(state.provider._id) }).expect(201);
      await post(`/v1/yatra/supplier/requests/${req.body.data.id}/respond`, pandit, { decision: "reject" }).expect(400);
      const rejected = await post(`/v1/yatra/supplier/requests/${req.body.data.id}/respond`, pandit, { decision: "reject", note: "Not available that day" }).expect(201);
      expect(rejected.body.data.status).toBe("rejected");
    });
  });

  // ============================================================ departure cancel
  describe("Super Admin cancels a departure", () => {
    it("refunds every paid traveller in full to the wallet and frees unpaid holds", async () => {
      const code = (await get(`/v1/yatra/admin/departures/${state.raceDeparture}`, superAdmin).expect(200)).body.data.departure.departureCode;
      const held = await rows("SELECT id, customer_id FROM public.yatra_bookings WHERE departure_id = $1 AND status = 'held' LIMIT 1", [state.raceDeparture]);
      const payer = { ...newUser("customer"), id: held[0].customer_id } as TestUser;
      await payDemo(payer, held[0].id);
      await post(`/v1/yatra/admin/departures/${state.raceDeparture}/cancel`, ownerA, { reason: "Road closed" }).expect(403);
      const res = await post(`/v1/yatra/admin/departures/${state.raceDeparture}/cancel`, superAdmin, { reason: "Road closed by flood" }).expect(201);
      expect(res.body.data).toMatchObject({ refunded: 1, released: 18, failed: [] });
      expect(await walletBalance(payer)).toBe(1500);
      const left = await rows("SELECT status, count(*)::int AS n FROM public.yatra_seats WHERE departure_id = $1 GROUP BY status ORDER BY status", [state.raceDeparture]);
      expect(left).toEqual([{ status: "available", n: 19 }, { status: "blocked", n: 1 }]);
      await get(`/v1/yatra/departures/${code}`).expect(200).then((r) => expect(r.body.data.bookable).toBe(false));
    });

    it("reports the money in the admin overview from the ledger", async () => {
      const o = await get("/v1/yatra/admin/overview", superAdmin).expect(200);
      expect(o.body.data.money.collected).toBeGreaterThan(0);
      expect(o.body.data.money.refundedToWallet).toBeGreaterThanOrEqual(2700 + 1500);
      const earnings = await get("/v1/yatra/operator/earnings", ownerA).expect(200);
      // No commission rule exists in this suite, so nothing is posted as payable yet (see yatra-p5 for the ledger).
      expect(earnings.body.summary.confirmedBookings).toBeGreaterThan(0);
      expect(earnings.body.summary.available).toBe(0);
      expect(earnings.body.summary.directSales).toBeGreaterThan(0);
      await get("/v1/yatra/operator/earnings", staffA).expect(403);
    });
  });
});
