import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import { setServers } from "node:dns";
import type { Connection, Model } from "mongoose";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { USER_ROLES } from "../src/modules/users/infrastructure/persistence/user.schema";

jest.setTimeout(120_000);

type Role = (typeof USER_ROLES)[number];

describe("role-based acceptance matrix", () => {
  let app: INestApplication;
  let connection: Connection;
  let users: Model<any>;
  let jwt: JwtService;
  const tokens = new Map<Role, string>();
  let ashramId: string;
  let otherAshramId: string;
  let volunteerJobId: string;

  const auth = (role: Role) => ({ Authorization: `Bearer ${tokens.get(role)}` });

  beforeAll(async () => {
    setServers(["8.8.8.8", "1.1.1.1"]);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    connection = module.get<Connection>(getConnectionToken());
    if (connection.name !== "tirvona_rbac_qa")
      throw new Error(
        `RBAC acceptance tests require tirvona_rbac_qa; received ${connection.name}`,
      );
    await connection.dropDatabase();

    users = module.get<Model<any>>(getModelToken("User"));
    const config = module.get(ConfigService);
    jwt = new JwtService({
      secret: config.get<string>("jwtSecret") || "development-only-secret",
      signOptions: {
        issuer: config.get<string>("jwtIssuer"),
        audience: config.get<string>("jwtAudience"),
      },
    });
    const accounts = await users.insertMany(
      USER_ROLES.map((role, index) => ({
        name: `QA ${role}`,
        email: `qa.${role}@tirvona.test`,
        phone: `+91000${String(index + 1).padStart(7, "0")}`,
        role,
        status: "active",
        isVerified: true,
        tokenVersion: 0,
        district: ["district_officer", "inspector"].includes(role)
          ? "Haridwar"
          : "",
        state: [
          "inspector",
          "district_officer",
          "state_admin",
          "govt_admin",
          "government_admin",
        ].includes(role)
          ? "Uttarakhand"
          : "",
      })),
    );
    for (const account of accounts) {
      tokens.set(
        account.role,
        jwt.sign({
          id: String(account._id),
          sub: String(account._id),
          tv: 0,
        }),
      );
    }

    const ownerAshram = await request(app.getHttpServer())
      .post("/api/ashrams")
      .set(auth("owner"))
      .send({
        name: "QA Ganga Test Ashram",
        description: "Isolated acceptance-test ashram",
        address: {
          street: "QA Test Road",
          city: "Haridwar",
          district: "Haridwar",
          state: "Uttarakhand",
          pincode: "249401",
        },
        contact: { phone: "+911111111111", email: "ashram@tirvona.test" },
        trust: {},
        rooms: [
          {
            name: "QA Guest Room",
            type: "private_room",
            acType: "Non-AC",
            capacity: 2,
            totalInventory: 3,
            basePrice: 500,
          },
        ],
      })
      .expect(201);
    ashramId = ownerAshram.body.data._id;

    const secondary = await request(app.getHttpServer())
      .post("/api/ashrams")
      .set(auth("super_admin"))
      .send({
        name: "QA Out-of-Scope Ashram",
        description: "Scope isolation fixture",
        address: {
          street: "QA Other Road",
          city: "Rishikesh",
          district: "Dehradun",
          state: "Uttarakhand",
          pincode: "249201",
        },
        contact: { phone: "+912222222222", email: "other@tirvona.test" },
        trust: {},
      })
      .expect(201);
    otherAshramId = secondary.body.data._id;

    await users.updateMany(
      {
        role: {
          $in: [
            "manager",
            "reception",
            "housekeeping",
            "staff",
            "offer_manager",
            "finance_manager",
          ],
        },
      },
      { $set: { employerAshramId: ashramId, scopedAshramIds: [ashramId] } },
    );

    const job = await request(app.getHttpServer())
      .post("/api/volunteer/jobs")
      .set(auth("owner"))
      .send({
        ashramId,
        ashramName: "QA Ganga Test Ashram",
        city: "Haridwar",
        state: "Uttarakhand",
        title: "QA Garden Volunteer",
        department: "Gardening",
        openingsCount: 2,
        status: "open",
      })
      .expect(201);
    volunteerJobId = job.body.data._id;
  });

  afterAll(async () => {
    if (connection?.name === "tirvona_rbac_qa") await connection.dropDatabase();
    await app?.close();
  });

  it.each(USER_ROLES)("creates and authenticates the %s account", async (role) => {
    const response = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set(auth(role))
      .expect(200);
    expect(response.body).toMatchObject({ success: true, data: { role } });
  });

  it("permits only super admin to read audit logs", async () => {
    await request(app.getHttpServer())
      .get("/api/analytics/audit-logs")
      .set(auth("super_admin"))
      .expect(200);
    for (const role of USER_ROLES.filter((item) => item !== "super_admin")) {
      await request(app.getHttpServer())
        .get("/api/analytics/audit-logs")
        .set(auth(role))
        .expect(403);
    }
  });

  it("enforces owner and manager ashram scope", async () => {
    const mine = await request(app.getHttpServer())
      .get("/api/ashrams/my-listings/all")
      .set(auth("owner"))
      .expect(200);
    expect(mine.body.data.map((item: any) => String(item._id))).toContain(ashramId);

    await request(app.getHttpServer())
      .get(`/api/ashrams/manage/${ashramId}`)
      .set(auth("manager"))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/ashrams/manage/${otherAshramId}`)
      .set(auth("manager"))
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/ashrams")
      .set(auth("manager"))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/ashrams")
      .set(auth("customer"))
      .send({})
      .expect(403);
  });

  it("enforces the ashram document, inspection, approval, and publication workflow", async () => {
    await request(app.getHttpServer())
      .post(`/api/ashrams/${ashramId}/documents`)
      .set(auth("owner"))
      .send({
        trustDeedUrl: "https://qa.tirvona.test/trust-deed.pdf",
        fireSafetyCertificateUrl: "https://qa.tirvona.test/fire-safety.pdf",
        landOwnershipUrl: "https://qa.tirvona.test/land-ownership.pdf",
      })
      .expect(201);

    const inspectionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await request(app.getHttpServer())
      .post(`/api/verify/${ashramId}/schedule`)
      .set(auth("inspector"))
      .send({ date: inspectionDate.toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/verify/${ashramId}/status`)
      .set(auth("inspector"))
      .send({ status: "approved" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/verify/${ashramId}/status`)
      .set(auth("district_officer"))
      .send({ status: "approved", comments: "QA acceptance approval" })
      .expect(201);

    const published = await request(app.getHttpServer())
      .get(`/api/ashrams/${ashramId}`)
      .expect(200);
    expect(published.body.data.ashram).toMatchObject({
      _id: ashramId,
      status: "approved",
    });
    expect(published.body.data.rooms).toHaveLength(1);
  });

  it.each([
    ["national_admin", "/api/analytics/system"],
    ["state_admin", "/api/analytics/system"],
    ["govt_admin", "/api/analytics/system"],
    ["government_admin", "/api/analytics/system"],
    ["district_officer", "/api/analytics/system"],
    ["inspector", "/api/verify/pending"],
    ["staff", `/api/analytics/dashboard?ashramId=${"__ASHRAM__"}`],
    ["reception", `/api/housekeeping?ashramId=${"__ASHRAM__"}`],
    ["housekeeping", `/api/housekeeping?ashramId=${"__ASHRAM__"}`],
    ["banner_manager", "/api/admin/crud/banner"],
    ["content_manager", "/api/admin/crud/blogs"],
    ["offer_manager", "/api/offers/my-offers"],
    ["blog_manager", "/api/admin/crud/blogs"],
    ["local_manager", "/api/admin/crud/local"],
    ["marketplace_manager", "/api/admin/crud/marketplace"],
    ["service_manager", "/api/admin/crud/providers"],
    ["finance_manager", "/api/booking-finance/refunds"],
    ["support", "/api/support"],
    ["customer", "/api/bookings/history"],
    ["owner", "/api/analytics/dashboard"],
    ["manager", `/api/analytics/dashboard?ashramId=${"__ASHRAM__"}`],
    ["super_admin", "/api/users"],
  ] as const)("allows %s to open its primary API", async (role, path) => {
    await request(app.getHttpServer())
      .get(path.replace("__ASHRAM__", ashramId))
      .set(auth(role))
      .expect(200);
  });

  it("allows a volunteer account to apply for an opening", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/volunteer/apply")
      .set(auth("volunteer"))
      .send({
        jobId: volunteerJobId,
        applicantName: "QA volunteer",
        email: "qa.volunteer@tirvona.test",
        phone: "+910000000021",
        city: "Haridwar",
        motivation: "Acceptance test application",
      })
      .expect(201);
    expect(response.body).toMatchObject({ success: true });
  });

  it("rejects representative cross-role privilege escalation", async () => {
    await request(app.getHttpServer())
      .get("/api/users")
      .set(auth("owner"))
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/booking-finance/refunds")
      .set(auth("customer"))
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/admin/crud/marketplace")
      .set(auth("blog_manager"))
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/verify/pending")
      .set(auth("support"))
      .expect(403);
  });
});
