/// <reference types="jest" />
/**
 * HR accounts (logins with the `hr` role) and the office that decides which area they can
 * see, end to end on a throwaway Postgres 17. Run with `npm run test:pg -- hr-accounts`.
 * The tests share state and run in order: run the whole file.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { getModelToken } from "../../database/orm-nest";
import { as, newUser } from "../providers/testing/provider-test-app";
import { createHrTestApp, type HrTestApp } from "./testing/hr-test-app";

type User = ReturnType<typeof newUser>;

describe("HR accounts and office areas (real Postgres)", () => {
  let ctx: HrTestApp;
  let app: INestApplication;

  const superAdmin = newUser("super_admin", "Super Admin");
  const customer = newUser("customer", "Pilgrim");
  const hrActive = newUser("hr", "Radha HR");
  const hrPending = newUser("hr", "Pending HR");
  const offices: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const get = (path: string, user: User) => http().get(`/api${path}`).set(as(user));
  const post = (path: string, user: User, body: object = {}) => http().post(`/api${path}`).set(as(user)).send(body);

  beforeAll(async () => {
    ctx = await createHrTestApp();
    app = ctx.app;
    const users = app.get(getModelToken("User"));
    await users.create({ _id: hrActive.id, name: hrActive.name, email: hrActive.email, phone: hrActive.phone, role: "hr", status: "active" });
    await users.create({ _id: hrPending.id, name: hrPending.name, email: hrPending.email, phone: hrPending.phone, role: "hr", status: "pending_approval" });
    for (const [key, body] of Object.entries({
      vrindavan: { code: "VRN", name: "Vrindavan Office", city: "Vrindavan" },
      haridwar: { code: "HDW", name: "Haridwar Office", city: "Haridwar" },
      nocity: { code: "HQ", name: "Head Office" },
    })) {
      const res = await post("/hr/offices", superAdmin, body).expect(201);
      offices[key] = res.body.data.id;
    }
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it("lists HR logins for Super Admin only, with no office yet", async () => {
    await get("/hr/hr-accounts", customer).expect(403);
    await get("/hr/hr-accounts", hrActive).expect(403);
    const res = await get("/hr/hr-accounts", superAdmin).expect(200);
    const names = res.body.data.map((row: any) => row.name).sort();
    expect(names).toEqual(["Pending HR", "Radha HR"]);
    expect(res.body.data.every((row: any) => row.office === null && row.coverage.length === 0)).toBe(true);
  });

  it("gives an HR login without an office no area at all", async () => {
    const res = await get("/hr/me/location", hrActive).expect(200);
    expect(res.body.data).toEqual({ city: "", officeName: "", area: "", terms: [] });
    // Every other role is not location-restricted.
    expect((await get("/hr/me/location", superAdmin).expect(200)).body.data).toBeNull();
  });

  it("refuses an office for an account that is not active yet, or an office without a city", async () => {
    const pending = await post(`/hr/hr-accounts/${hrPending.id}/office`, superAdmin, { officeId: offices.vrindavan }).expect(409);
    expect(pending.body.message).toMatch(/Active/);
    const noCity = await post(`/hr/hr-accounts/${hrActive.id}/office`, superAdmin, { officeId: offices.nocity }).expect(400);
    expect(noCity.body.message).toMatch(/city/i);
    await post(`/hr/hr-accounts/${customer.id}/office`, superAdmin, { officeId: offices.vrindavan }).expect(404);
    await post(`/hr/hr-accounts/${hrActive.id}/office`, customer, { officeId: offices.vrindavan }).expect(403);
  });

  it("assigns the Vrindavan office: the login then covers Vrindavan and Mathura", async () => {
    const res = await post(`/hr/hr-accounts/${hrActive.id}/office`, superAdmin, { officeId: offices.vrindavan }).expect(201);
    expect(res.body.data.office).toMatchObject({ name: "Vrindavan Office", city: "Vrindavan" });
    expect(res.body.data.coverage).toEqual(expect.arrayContaining(["vrindavan", "mathura"]));
    expect(res.body.data.area).toBe("Vrindavan & Mathura");
    expect(res.body.data.employee.employeeCode).toMatch(/^EMP-/);

    const location = await get("/hr/me/location", hrActive).expect(200);
    expect(location.body.data.officeName).toBe("Vrindavan Office");
    expect(location.body.data.terms).toEqual(expect.arrayContaining(["vrindavan", "mathura"]));
  });

  it("moves the login to another office without creating a second profile", async () => {
    await post(`/hr/hr-accounts/${hrActive.id}/office`, superAdmin, { officeId: offices.haridwar }).expect(201);
    const location = await get("/hr/me/location", hrActive).expect(200);
    expect(location.body.data.terms).toEqual(["haridwar"]);
    const employees = app.get(getModelToken("HrEmployee"));
    expect(await employees.countDocuments({ userId: hrActive.id })).toBe(1);
  });

  it("takes the area away at once when the HR profile is deactivated", async () => {
    const accounts = await get("/hr/hr-accounts", superAdmin).expect(200);
    const employeeId = accounts.body.data.find((row: any) => row.userId === hrActive.id).employee.id;
    await http()
      .patch(`/api/hr/employees/${employeeId}/status`)
      .set(as(superAdmin))
      .send({ status: "inactive", reason: "Left the company" })
      .expect(200);
    const location = await get("/hr/me/location", hrActive).expect(200);
    expect(location.body.data.terms).toEqual([]);
    const after = await get("/hr/hr-accounts", superAdmin).expect(200);
    expect(after.body.data.find((row: any) => row.userId === hrActive.id).coverage).toEqual([]);
  });
});
