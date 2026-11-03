/// <reference types="jest" />
/**
 * The pandit console for an `hr` login: the Super Admin pandit routes, limited to the pandits
 * whose home or service city is in the login's HR office area. Real controllers, guards and
 * Postgres 17. Run with `npm run test:pg -- providers-hr-location`. Run the whole file.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { getModelToken } from "../../database/orm-nest";
import { Types } from "../../database/orm";
import { as, createProviderTestApp, idemKey, newUser, type ProviderTestApp, type TestUser } from "./testing/provider-test-app";

const V2 = "/api/v2";

describe("pandit console for an HR login (real Postgres)", () => {
  let ctx: ProviderTestApp;
  let app: INestApplication;

  const root = newUser("super_admin", "Root");
  const hrBraj = newUser("hr", "Braj HR");
  const customer = newUser("customer", "Pilgrim");
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const get = (path: string, user: TestUser) => http().get(`${V2}${path}`).set(as(user));
  const post = (path: string, user: TestUser, body: object = {}) =>
    http().post(`${V2}${path}`).set(as(user)).set("Idempotency-Key", idemKey()).send(body);
  const text = (body: unknown) => JSON.stringify(body);

  beforeAll(async () => {
    ctx = await createProviderTestApp();
    app = ctx.app;
    const model = (name: string) => app.get(getModelToken(name));

    const office = await model("HrOffice").create({ code: "BRJ", name: "Braj Office", nameKey: "braj office", city: "Vrindavan", active: true });
    await model("HrEmployee").create({
      employeeCode: "EMP-0001",
      fullName: hrBraj.name,
      userId: hrBraj.id,
      primaryOfficeId: office._id,
      officeIds: [office._id],
      status: "active",
    });

    const pandits: Array<[string, Record<string, unknown>]> = [
      ["vrindavan", { displayName: "Pandit Radheshyam", homeCity: "Vrindavan" }],
      // Lives elsewhere but serves Mathura: in the Braj area through its service cities.
      ["serves", { displayName: "Acharya Agra Wale", homeCity: "Agra", serviceCities: ["agra", "mathura"] }],
      ["haridwar", { displayName: "Pandit Gangadhar", homeCity: "Haridwar", serviceCities: ["haridwar"] }],
    ];
    for (const [key, fields] of pandits) {
      const row = await model("ProviderProfile").create({
        userId: new Types.ObjectId(),
        slug: `pandit-${key}`,
        status: "ACTIVE",
        ...fields,
      });
      ids[key] = String(row._id);
    }
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it("is closed to customers", async () => {
    await get("/admin/providers", customer).expect(403);
  });

  it("lists only the pandits of the area, by home city or service city", async () => {
    const res = await get("/admin/providers", hrBraj).expect(200);
    expect(text(res.body)).toContain("Pandit Radheshyam");
    expect(text(res.body)).toContain("Acharya Agra Wale");
    expect(text(res.body)).not.toContain("Pandit Gangadhar");

    const all = await get("/admin/providers", root).expect(200);
    expect(text(all.body)).toContain("Pandit Gangadhar");
  });

  it("counts only the area's pandits on the overview", async () => {
    const res = await get("/admin/providers/overview", hrBraj).expect(200);
    expect(res.body.data.totalProviders).toBe(2);
  });

  it("treats a pandit outside the area as not found, and can act on one inside it", async () => {
    await get(`/admin/providers/${ids.haridwar}`, hrBraj).expect(404);
    await post(`/admin/providers/${ids.haridwar}:suspend`, hrBraj, { reasonCode: "COMPLIANCE_VIOLATION", note: "test" }).expect(404);
    await get(`/admin/providers/${ids.vrindavan}`, hrBraj).expect(200);
  });

  it("reads the shared ritual catalogue but cannot change it", async () => {
    await get("/admin/rituals", hrBraj).expect(200);
    await post("/admin/rituals", hrBraj, { title: "Satyanarayan Katha" }).expect(403);
  });

  it("opens the bookings, offerings, consultations and withdrawal queues for its area", async () => {
    await get("/admin/provider-bookings", hrBraj).expect(200);
    await get("/admin/offerings", hrBraj).expect(200);
    await get("/admin/consultations", hrBraj).expect(200);
    await get("/admin/provider-wallets/withdrawals", hrBraj).expect(200);
    await get("/admin/provider-wallets/overview", hrBraj).expect(200);
    await get("/verification-cases", hrBraj).expect(200);
  });
});
