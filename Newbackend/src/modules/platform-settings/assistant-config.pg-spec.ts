/// <reference types="jest" />
/**
 * The Tirvona Assistant configuration API end to end: real controller, role guard, validation pipe and
 * storage driver against a throwaway Postgres 17 (never the hosted database).
 * Run with `npm run test:pg -- assistant-config`. The tests share state and run in order.
 */
import "reflect-metadata";
import {
  Injectable,
  UnauthorizedException,
  ValidationPipe,
  VERSION_NEUTRAL,
  VersioningType,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { OrmModule } from "../../database/orm-nest";
import { ApiExceptionFilter } from "../../common/filters/api-exception.filter";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { environment } from "../../config/environment";
import { DRIVER_URI } from "../../database/database";
import { enablePostgresDriver } from "../../database/pg/pg-driver";
import { REGISTRY } from "../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../database/pg/test-database";
import { as, newUser } from "../providers/testing/provider-test-app";
import { PlatformSettingsModule } from "./platform-settings.module";

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic && !req.headers["x-test-user"]) return true;
    if (!req.headers["x-test-user"]) throw new UnauthorizedException("Authentication required");
    req.user = JSON.parse(String(req.headers["x-test-user"]));
    return true;
  }
}

const entry = (id: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  visible: true,
  enabled: true,
  order,
  ...extra,
});

describe("Assistant configuration API (real Postgres)", () => {
  let db: TestDatabase;
  let app: INestApplication;
  const superAdmin = newUser("super_admin", "Super Admin");
  const manager = newUser("manager", "Manager");
  const customer = newUser("customer", "Pilgrim");
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    db = await createTestDatabase(REGISTRY.tables);
    enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
        OrmModule.forRoot(DRIVER_URI),
        PlatformSettingsModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: TestAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_PIPE, useValue: new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }) },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  });

  it("serves the built-in default (no overrides) to anyone, signed in or not", async () => {
    const res = await http().get("/api/assistant-config").expect(200);
    expect(res.body.data).toEqual({ revision: 0, entries: [], updatedAt: null });
  });

  it("refuses everyone but a super admin for the admin read, publish and reset", async () => {
    await http().get("/api/assistant-config/admin").expect(401);
    for (const user of [customer, manager]) {
      await http().get("/api/assistant-config/admin").set(as(user)).expect(403);
      await http().put("/api/assistant-config").set(as(user)).send({ entries: [] }).expect(403);
      await http().delete("/api/assistant-config").set(as(user)).expect(403);
    }
    await http().put("/api/assistant-config").send({ entries: [] }).expect(401);
  });

  it("rejects invalid configurations and stores nothing", async () => {
    const put = (entries: unknown[], extra: Record<string, unknown> = {}) =>
      http().put("/api/assistant-config").set(as(superAdmin)).send({ entries, ...extra });
    await put([entry("stays", 1), entry("stays", 2)]).expect(400); // duplicate id
    await put([entry("stays/find", 1)]).expect(400); // parent missing
    await put([entry("Stays Menu", 1)]).expect(400); // bad id
    await put([entry("stays", 1, { label: "<script>x</script>" })]).expect(400);
    await put([entry("stays", 1), entry("stays/find", 2, { label: "Renamed" })]).expect(400); // only modules rename
    await put([entry("stays", 1, { url: "javascript:alert(1)" })]).expect(400); // unknown field
    await put([{ ...entry("stays", 1), order: -4 }]).expect(400);
    const res = await http().get("/api/assistant-config").expect(200);
    expect(res.body.data.entries).toEqual([]);
  });

  it("publishes for everyone: hide, disable, rename and reorder persist and are shared", async () => {
    const entries = [
      entry("market", 10, { label: "Shop Sacred" }),
      entry("stays", 20, { visible: false }),
      entry("stays/find", 30),
      entry("food", 40, { enabled: false }),
    ];
    const saved = await http().put("/api/assistant-config").set(as(superAdmin)).send({ entries }).expect(200);
    expect(saved.body.data.revision).toBe(1);
    expect(saved.body.data.updatedByName).toBe("Super Admin");

    // A different visitor, a guest and a customer, all read the same published configuration.
    for (const headers of [{}, as(customer)]) {
      const res = await http().get("/api/assistant-config").set(headers).expect(200);
      expect(res.body.data.entries).toEqual(entries);
      expect(res.body.data.revision).toBe(1);
      // identity of the administrator is not part of the public view
      expect(res.body.data.updatedBy).toBeUndefined();
      expect(res.body.data.updatedByName).toBeUndefined();
    }
    const admin = await http().get("/api/assistant-config/admin").set(as(superAdmin)).expect(200);
    expect(admin.body.data.updatedBy).toBe(superAdmin.id);
  });

  it("does not touch the public platform settings row or the real features", async () => {
    const res = await http().get("/api/platform-settings").expect(200);
    expect(res.body.data.assistantConfig).toBeUndefined();
    expect(res.body.data.key).toBe("main");
  });

  it("refuses a stale save (someone published in between)", async () => {
    await http()
      .put("/api/assistant-config")
      .set(as(superAdmin))
      .send({ entries: [entry("market", 1)], expectedRevision: 0 })
      .expect(409);
    const ok = await http()
      .put("/api/assistant-config")
      .set(as(superAdmin))
      .send({ entries: [entry("market", 1), entry("stays", 2)], expectedRevision: 1 })
      .expect(200);
    expect(ok.body.data.revision).toBe(2);
  });

  it("restores the built-in menu on reset", async () => {
    const res = await http().delete("/api/assistant-config").set(as(superAdmin)).expect(200);
    expect(res.body.data.entries).toEqual([]);
    const pub = await http().get("/api/assistant-config").expect(200);
    expect(pub.body.data.entries).toEqual([]);
    expect(pub.body.data.revision).toBe(3);
  });
});
