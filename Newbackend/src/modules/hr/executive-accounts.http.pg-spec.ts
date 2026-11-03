/// <reference types="jest" />
/**
 * Executive accounts (logins with the `executive` role): the same office assignment as HR
 * accounts, and the stays of the office area that become the login's assigned stays.
 * Throwaway Postgres 17. Run with `npm run test:pg -- executive-accounts`. Run the whole file.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { getModelToken } from "../../database/orm-nest";
import { as, newUser } from "../providers/testing/provider-test-app";
import { HrLocationService } from "./application/hr-location.service";
import { createHrTestApp, type HrTestApp } from "./testing/hr-test-app";

type User = ReturnType<typeof newUser>;

describe("Executive accounts and area stays (real Postgres)", () => {
  let ctx: HrTestApp;
  let app: INestApplication;

  const superAdmin = newUser("super_admin", "Super Admin");
  const executive = newUser("executive", "Shyam Executive");
  const hrUser = newUser("hr", "Radha HR");
  const offices: Record<string, string> = {};
  const stays: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const get = (path: string, user: User) => http().get(`/api${path}`).set(as(user));
  const post = (path: string, user: User, body: object = {}) => http().post(`/api${path}`).set(as(user)).send(body);

  beforeAll(async () => {
    ctx = await createHrTestApp();
    app = ctx.app;
    const users = app.get(getModelToken("User"));
    for (const u of [executive, hrUser])
      await users.create({ _id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: "active" });
    const office = await post("/hr/offices", superAdmin, { code: "BRJ", name: "Braj Office", city: "Mathura" }).expect(201);
    offices.braj = office.body.data.id;

    const ashrams = app.get(getModelToken("Ashram"));
    const stay = (name: string, street: string, city: string, district: string, status = "approved") =>
      ashrams.create({
        name,
        ownerId: superAdmin.id,
        description: "A quiet stay",
        status,
        address: { street, city, district, state: "Uttar Pradesh", pincode: "281121" },
      });
    stays.vrindavan = String((await stay("Radha Kunj", "Raman Reti", "Vrindavan", "Mathura"))._id);
    stays.pending = String((await stay("New Bhawan", "Parikrama Marg", "Vrindaban", "Mathura", "pending_inspection"))._id);
    stays.haridwar = String((await stay("Ganga Niwas", "Har Ki Pauri", "Haridwar", "Haridwar"))._id);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it("lists executive logins separately from HR logins", async () => {
    const res = await get("/hr/executive-accounts", superAdmin).expect(200);
    expect(res.body.data.map((r: any) => r.name)).toEqual(["Shyam Executive"]);
    const hr = await get("/hr/hr-accounts", superAdmin).expect(200);
    expect(hr.body.data.map((r: any) => r.name)).toEqual(["Radha HR"]);
    await get("/hr/executive-accounts", executive).expect(403);
  });

  it("refuses to give an HR login an office through the executive list", async () => {
    await post(`/hr/executive-accounts/${hrUser.id}/office`, superAdmin, { officeId: offices.braj }).expect(404);
  });

  it("assigns the office: the executive covers Vrindavan and Mathura", async () => {
    const res = await post(`/hr/executive-accounts/${executive.id}/office`, superAdmin, { officeId: offices.braj }).expect(201);
    expect(res.body.data.area).toBe("Vrindavan & Mathura");
    const location = await get("/hr/me/location", executive).expect(200);
    expect(location.body.data.terms).toEqual(expect.arrayContaining(["vrindavan", "mathura"]));
  });

  it("gives the executive every stay of the area as its assigned stays, pending ones included", async () => {
    const ids = await app.get(HrLocationService).stayIdsInArea({ id: executive.id, role: "executive" } as any);
    expect(ids).toEqual(expect.arrayContaining([stays.vrindavan, stays.pending]));
    expect(ids).not.toContain(stays.haridwar);
  });

  it("gives an HR login without an office no stays, and other roles no area at all", async () => {
    expect(await app.get(HrLocationService).stayIdsInArea({ id: hrUser.id, role: "hr" } as any)).toEqual([]);
    expect(await app.get(HrLocationService).stayIdsInArea({ id: superAdmin.id, role: "super_admin" } as any)).toBeNull();
  });
});
