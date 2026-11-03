/// <reference types="jest" />
/**
 * The food console for an `hr` login: the same Super Admin routes, limited to the restaurants
 * whose outlets are in the login's HR office area. Real controllers, guards and Postgres 17.
 * Run with `npm run test:pg -- food-hr-location`. The tests share state: run the whole file.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { getModelToken } from "../../database/orm-nest";
import { as, newUser } from "../providers/testing/provider-test-app";
import { createFoodTestApp, type FoodTestApp } from "./testing/food-test-app";

type User = ReturnType<typeof newUser>;

describe("food console for an HR login (real Postgres)", () => {
  let ctx: FoodTestApp;
  let app: INestApplication;

  const superAdmin = newUser("super_admin", "Super Admin");
  const hrBraj = newUser("hr", "Braj HR");
  const hrNoOffice = newUser("hr", "Unassigned HR");
  const executiveBraj = newUser("executive", "Braj Executive");
  const customer = newUser("customer", "Pilgrim");
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const get = (path: string, user: User) => http().get(`/api${path}`).set(as(user));
  const post = (path: string, user: User, body: object = {}) => http().post(`/api${path}`).set(as(user)).send(body);
  const names = (body: unknown) => JSON.stringify(body);

  beforeAll(async () => {
    ctx = await createFoodTestApp();
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
    await model("HrEmployee").create({
      employeeCode: "EMP-0002",
      fullName: executiveBraj.name,
      userId: executiveBraj.id,
      primaryOfficeId: office._id,
      officeIds: [office._id],
      status: "active",
    });

    const kitchens = [
      ["vrindavan", "Radhe Rasoi", "Raman Reti, Vrindavan, UP"],
      ["mathura", "Mathura Bhojanalaya", "Near Railway Station, MATHURA"],
      ["haridwar", "Ganga Kitchen", "Har Ki Pauri, Haridwar"],
    ];
    for (const [key, businessName, address] of kitchens) {
      const vendor = await model("FoodVendor").create({ businessName, status: "active" });
      const outlet = await model("FoodOutlet").create({ vendorId: vendor._id, brandName: businessName, address, commissionRateBps: 1000 });
      ids[`${key}Vendor`] = String(vendor._id);
      ids[`${key}Outlet`] = String(outlet._id);
      await model("FoodOrder").create({
        orderNumber: `TF-HR-${key}`,
        customerName: "Devotee",
        customerPhone: "9876543210",
        outletId: outlet._id,
        fulfilmentType: "vendor_delivery",
        orderStatus: "DELIVERED",
        paymentStatus: "PAID",
        subtotalPaise: 20000,
        totalPaise: 20000,
        deliveredAt: new Date("2026-10-05T10:00:00Z"),
      });
    }
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it("is closed to customers", async () => {
    await get("/v1/food/admin/vendors", customer).expect(403);
  });

  it("lists only the restaurants of the HR office's area (Vrindavan covers Mathura too)", async () => {
    const res = await get("/v1/food/admin/vendors", hrBraj).expect(200);
    expect(names(res.body)).toContain("Radhe Rasoi");
    expect(names(res.body)).toContain("Mathura Bhojanalaya");
    expect(names(res.body)).not.toContain("Ganga Kitchen");

    const all = await get("/v1/food/admin/vendors", superAdmin).expect(200);
    expect(names(all.body)).toContain("Ganga Kitchen");
  });

  it("gives an Executive login the same area-limited console", async () => {
    const res = await get("/v1/food/admin/vendors", executiveBraj).expect(200);
    expect(names(res.body)).toContain("Radhe Rasoi");
    expect(names(res.body)).not.toContain("Ganga Kitchen");
    await get(`/v1/food/admin/vendors/${ids.haridwarVendor}`, executiveBraj).expect(404);
  });

  it("shows an HR login without an office nothing", async () => {
    const res = await get("/v1/food/admin/vendors", hrNoOffice).expect(200);
    expect(names(res.body)).not.toMatch(/Radhe Rasoi|Mathura Bhojanalaya|Ganga Kitchen/);
  });

  it("treats a restaurant outside the area as not found, for reads and for changes", async () => {
    await get(`/v1/food/admin/vendors/${ids.haridwarVendor}`, hrBraj).expect(404);
    await post(`/v1/food/admin/vendors/${ids.haridwarVendor}/status`, hrBraj, { status: "suspended", reason: "x" }).expect(404);
    await get(`/v1/food/admin/outlets/${ids.haridwarOutlet}/menu`, hrBraj).expect(404);
    await get(`/v1/food/admin/vendors/${ids.haridwarVendor}/wallet`, hrBraj).expect(404);
  });

  it("manages a restaurant inside the area like Super Admin would", async () => {
    await get(`/v1/food/admin/vendors/${ids.vrindavanVendor}`, hrBraj).expect(200);
    const res = await post(`/v1/food/admin/vendors/${ids.mathuraVendor}/status`, hrBraj, { status: "suspended", reason: "Hygiene check" });
    expect(res.status).toBeLessThan(300);
    await get(`/v1/food/admin/vendors/${ids.vrindavanVendor}/wallet`, hrBraj).expect(200);
  });

  it("sees only the orders and wallets of its area", async () => {
    const orders = await get("/v1/food/admin/orders", hrBraj).expect(200);
    expect(names(orders.body)).toContain("TF-HR-vrindavan");
    expect(names(orders.body)).toContain("TF-HR-mathura");
    expect(names(orders.body)).not.toContain("TF-HR-haridwar");

    const wallets = await get("/v1/food/admin/wallets", hrBraj).expect(200);
    expect(names(wallets.body)).toContain("Radhe Rasoi");
    expect(names(wallets.body)).not.toContain("Ganga Kitchen");
  });

  it("adds a restaurant only when its outlet is in the area", async () => {
    await app.get(getModelToken("FoodServiceZone")).create({ zoneCode: "VRN-CENTRAL", name: "Vrindavan central" });
    const restaurant = (address: string, n: number) => ({
      businessName: `New Kitchen ${n}`,
      ownerName: "Owner",
      email: `owner${n}@example.test`,
      phone: `98765000${10 + n}`,
      password: "Secret#12345",
      outlet: { brandName: `New Kitchen ${n}`, address, serviceZoneCodes: ["VRN-CENTRAL"] },
    });
    const outside = await post("/v1/food/admin/vendors", hrBraj, restaurant("Rishikesh Road, Haridwar", 1)).expect(403);
    expect(outside.body.message).toMatch(/outside your office/);
    const inside = await post("/v1/food/admin/vendors", hrBraj, restaurant("Parikrama Marg, Vrindavan", 2));
    expect(inside.status).toBeLessThan(300);
    const listed = await get("/v1/food/admin/vendors", hrBraj).expect(200);
    expect(names(listed.body)).toContain("New Kitchen 2");
  });
});
