/// <reference types="jest" />
/**
 * The kitchen wallet API end to end: real controllers, role guards, validation and error envelope, the
 * wallet service and the Postgres storage driver against a real Postgres 17. Run with `npm run test:pg`.
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { getModelToken } from "../../database/orm-nest";
import { Types } from "../../database/orm";
import { as, newUser } from "../providers/testing/provider-test-app";
import { createFoodTestApp, type FoodTestApp } from "./testing/food-test-app";

const RECEIPT = "https://res.cloudinary.com/demo/image/upload/v1/tirvona/food-receipts/utr-1.jpg";

describe("kitchen wallet API (real Postgres)", () => {
  let ctx: FoodTestApp;
  let app: INestApplication;

  const owner = newUser("customer", "Kushal");
  const otherOwner = newUser("customer", "Gopal");
  const stranger = newUser("customer", "No Restaurant");
  const finance = newUser("finance_manager", "Finance Fiona");
  const superAdmin = newUser("super_admin", "Super Admin");
  const support = newUser("support", "Support Sam");

  let vendorId: string;
  let otherVendorId: string;

  const get = (path: string, user?: ReturnType<typeof newUser>) => {
    const req = request(app.getHttpServer()).get(`/api${path}`);
    return user ? req.set(as(user)) : req;
  };
  const post = (path: string, user: ReturnType<typeof newUser>, body: object = {}) =>
    request(app.getHttpServer()).post(`/api${path}`).set(as(user)).send(body);
  const rows = async (sql: string) => (await ctx.db.pool.query(sql)).rows;

  beforeAll(async () => {
    ctx = await createFoodTestApp();
    app = ctx.app;

    const vendors = app.get(getModelToken("FoodVendor"));
    const outlets = app.get(getModelToken("FoodOutlet"));
    const orders = app.get(getModelToken("FoodOrder"));

    const vendor = await vendors.create({ businessName: "Shashank Kitchen", ownerUserId: owner.id, status: "active" });
    const other = await vendors.create({ businessName: "Brij Foods", ownerUserId: otherOwner.id, status: "active" });
    vendorId = String(vendor._id);
    otherVendorId = String(other._id);
    const outlet = await outlets.create({ vendorId: vendor._id, brandName: "Shashank Main", address: "Raman Reti, Vrindavan", commissionRateBps: 1250 });
    const otherOutlet = await outlets.create({ vendorId: other._id, brandName: "Brij Kitchen", address: "Mathura Road", commissionRateBps: 1250 });

    const order = (n: number, outletId: unknown, subtotalPaise: number, extra: object = {}) => ({
      orderNumber: `TF-WALLET-${n}`,
      customerName: "Devotee",
      customerPhone: "9876543210",
      outletId,
      fulfilmentType: "vendor_delivery",
      orderStatus: "DELIVERED",
      paymentStatus: "PAID",
      subtotalPaise,
      totalPaise: subtotalPaise,
      deliveredAt: new Date(`2026-10-${String(n).padStart(2, "0")}T10:00:00Z`),
      ...extra,
    });
    // 20 thalis of ₹249: each earns 24900 - 3113 commission - 560 GST = 21227.
    for (let i = 1; i <= 9; i += 1) await orders.create(order(i, outlet._id, 24900));
    await orders.create(order(10, outlet._id, 24900, { orderStatus: "PREPARING" })); // still cooking: not earned
    await orders.create(order(11, otherOutlet._id, 10000)); // another kitchen
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe("the owner's wallet", () => {
    it("shows what Tirvona owes for delivered orders", async () => {
      const res = await get("/v1/food/vendor/wallet", owner).expect(200);
      expect(res.body.summary).toMatchObject({
        vendorId,
        businessName: "Shashank Kitchen",
        deliveredOrders: 9,
        foodValuePaise: 9 * 24900,
        commissionPaise: 9 * 3113,
        gstOnCommissionPaise: 9 * 560,
        earnedPaise: 9 * 21227,
        receivedPaise: 0,
        remainingPaise: 9 * 21227,
        hasBankDetails: false,
        lastPayment: null,
      });
      expect(res.body.payments).toEqual([]);
    });

    it("pages through the delivered orders, newest first", async () => {
      const res = await get("/v1/food/vendor/wallet/orders?page=2&limit=4", owner).expect(200);
      expect(res.body).toMatchObject({ total: 9, page: 2, limit: 4 });
      expect(res.body.data).toHaveLength(4);
      expect(res.body.data[0]).toMatchObject({ outletName: "Shashank Main", netPaise: 21227 });
      await get("/v1/food/vendor/wallet/orders?limit=1000", owner).expect(400);
    });

    it("needs a sign-in and a restaurant", async () => {
      await get("/v1/food/vendor/wallet").expect(401);
      const none = await get("/v1/food/vendor/wallet", stranger).expect(404);
      expect(none.body.message).toMatch(/not registered a restaurant/i);
    });
  });

  describe("recording what Tirvona paid", () => {
    it("is closed to kitchen owners and support, and open to finance and Super Admin", async () => {
      const body = { amountPaise: 10000, method: "cash" };
      await post(`/v1/food/admin/vendors/${vendorId}/payments`, owner, body).expect(403);
      await post(`/v1/food/admin/vendors/${vendorId}/payments`, stranger, body).expect(403);
      await post(`/v1/food/admin/vendors/${vendorId}/payments`, support, body).expect(403);
      expect(await rows("SELECT id FROM public.food_vendor_payments")).toHaveLength(0);
    });

    it("refuses a bank transfer without a receipt, and a receipt that is not https", async () => {
      const path = `/v1/food/admin/vendors/${vendorId}/payments`;
      const noReceipt = await post(path, finance, { amountPaise: 100000, method: "bank_transfer" }).expect(400);
      expect(noReceipt.body.message).toMatch(/receipt/i);
      await post(path, finance, { amountPaise: 100000, method: "upi" }).expect(400);
      await post(path, finance, { amountPaise: 100000, method: "upi", receiptUrl: "http://example.com/r.jpg" }).expect(400);
      await post(path, finance, { amountPaise: 100000, method: "cheque" }).expect(400);
      await post(path, finance, { amountPaise: 50, method: "cash" }).expect(400);
      await post(path, finance, { amountPaise: 100000, method: "cash", surprise: true }).expect(400); // unknown field
      await post(`/v1/food/admin/vendors/${new Types.ObjectId().toHexString()}/payments`, finance, { amountPaise: 100000, method: "cash" }).expect(404);
      expect(await rows("SELECT id FROM public.food_vendor_payments")).toHaveLength(0);
    });

    it("records a bank transfer with its receipt and lowers what is owed", async () => {
      const res = await post(`/v1/food/admin/vendors/${vendorId}/payments`, finance, {
        amountPaise: 100000,
        method: "bank_transfer",
        reference: "UTR998877",
        receiptUrl: RECEIPT,
        note: "Week 1",
      }).expect(201);

      expect(res.body.summary).toMatchObject({ receivedPaise: 100000, remainingPaise: 9 * 21227 - 100000 });
      expect(res.body.summary.lastPayment).toMatchObject({ amountPaise: 100000, method: "bank_transfer" });
      expect(res.body.payments[0]).toMatchObject({
        method: "bank_transfer",
        reference: "UTR998877",
        receiptUrl: RECEIPT,
        recordedByName: "Finance Fiona",
        status: "recorded",
      });
      const [row] = await rows("SELECT payment_number, amount_paise, status, receipt_url FROM public.food_vendor_payments");
      expect(row).toMatchObject({ amount_paise: 100000, status: "recorded", receipt_url: RECEIPT });
      expect(row.payment_number).toMatch(/^FWP-\d{8}-[0-9A-F]{6}$/);
    });

    it("records cash without any receipt, and ignores a receipt sent with it", async () => {
      const res = await post(`/v1/food/admin/vendors/${vendorId}/payments`, superAdmin, {
        amountPaise: 20000,
        method: "cash",
        receiptUrl: RECEIPT,
        paidAt: "2026-10-02T09:30:00.000Z",
      }).expect(201);
      const cash = res.body.payments.find((p: any) => p.method === "cash");
      expect(cash).toMatchObject({ receiptUrl: null, recordedByName: "Super Admin" });
      expect(new Date(cash.paidAt).toISOString()).toBe("2026-10-02T09:30:00.000Z");
      const stored = await rows("SELECT receipt_url FROM public.food_vendor_payments WHERE method = 'cash'");
      expect(stored[0].receipt_url).toBeNull();
    });

    it("a double click records one payment, not two", async () => {
      const body = { amountPaise: 5000, method: "cash", idempotencyKey: "form-key-abcdef01" };
      const path = `/v1/food/admin/vendors/${vendorId}/payments`;
      const [first, second] = await Promise.all([post(path, finance, body), post(path, finance, body)]);
      expect([first.status, second.status].every((s) => s === 201)).toBe(true);
      expect(first.body.paymentId).toBe(second.body.paymentId);
      expect(await rows("SELECT id FROM public.food_vendor_payments WHERE idempotency_key = 'form-key-abcdef01'")).toHaveLength(1);

      // The same key for another restaurant is a mistake, not a retry.
      await post(`/v1/food/admin/vendors/${otherVendorId}/payments`, finance, body).expect(409);
    });

    it("rejects a payment dated in the future", async () => {
      const tomorrow = new Date(Date.now() + 36 * 3_600_000).toISOString();
      const res = await post(`/v1/food/admin/vendors/${vendorId}/payments`, finance, { amountPaise: 5000, method: "cash", paidAt: tomorrow }).expect(400);
      expect(res.body.message).toMatch(/future/);
    });

    it("the database itself refuses a repeated request id, but lets payments without one pile up", async () => {
      await expect(
        ctx.db.pool.query(
          "INSERT INTO public.food_vendor_payments (id, payment_number, vendor_id, idempotency_key) VALUES ('dup1', 'FWP-X-1', 'v', 'form-key-abcdef01')",
        ),
      ).rejects.toThrow(/unique|duplicate/i);
      const withoutKey = await rows("SELECT id FROM public.food_vendor_payments WHERE idempotency_key IS NULL");
      expect(withoutKey.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("what the kitchen and Tirvona see afterwards", () => {
    it("the kitchen sees the payments with their receipts, but not who entered them", async () => {
      const res = await get("/v1/food/vendor/wallet", owner).expect(200);
      const earned = 9 * 21227;
      expect(res.body.summary).toMatchObject({ receivedPaise: 100000 + 20000 + 5000, remainingPaise: earned - 125000 });
      expect(res.body.payments).toHaveLength(3);
      expect(res.body.payments.map((p: any) => p.method).sort()).toEqual(["bank_transfer", "cash", "cash"]);
      expect(res.body.payments.find((p: any) => p.method === "bank_transfer").receiptUrl).toBe(RECEIPT);
      for (const payment of res.body.payments) expect(payment).not.toHaveProperty("recordedByName");
    });

    it("another kitchen never sees these payments", async () => {
      const res = await get("/v1/food/vendor/wallet", otherOwner).expect(200);
      expect(res.body.summary).toMatchObject({ vendorId: otherVendorId, receivedPaise: 0, deliveredOrders: 1 });
      expect(res.body.payments).toEqual([]);
    });

    it("Tirvona sees every restaurant's balance, who is owed most first", async () => {
      const res = await get("/v1/food/admin/wallets", superAdmin).expect(200);
      expect(res.body.rows.map((r: any) => r.businessName)).toEqual(["Shashank Kitchen", "Brij Foods"]);
      expect(res.body.totals).toMatchObject({ restaurants: 2, receivedPaise: 125000, advancePaise: 0 });
      await get("/v1/food/admin/wallets", finance).expect(200);
      await get("/v1/food/admin/wallets", owner).expect(403);
    });

    it("Tirvona sees one kitchen's wallet with who recorded each payment", async () => {
      const res = await get(`/v1/food/admin/vendors/${vendorId}/wallet`, finance).expect(200);
      expect(res.body.payments.every((p: any) => typeof p.recordedByName === "string" && p.recordedByName)).toBe(true);
      await get(`/v1/food/admin/vendors/${vendorId}/wallet`, owner).expect(403);
      await get(`/v1/food/admin/vendors/${vendorId}/wallet/orders?limit=3`, superAdmin).expect(200);
    });
  });

  describe("voiding a wrong payment", () => {
    it("takes it out of the totals but keeps it in the history, once", async () => {
      const before = (await get("/v1/food/vendor/wallet", owner)).body;
      const cash = before.payments.find((p: any) => p.method === "bank_transfer");

      await post(`/v1/food/admin/payments/${cash.id}/void`, owner, { reason: "Typo in the amount" }).expect(403);
      await post(`/v1/food/admin/payments/${cash.id}/void`, finance, { reason: "x" }).expect(400); // reason too short
      const res = await post(`/v1/food/admin/payments/${cash.id}/void`, finance, { reason: "Typo in the amount" }).expect(201);
      expect(res.body.summary.receivedPaise).toBe(25000);
      expect(res.body.payments.find((p: any) => p.id === cash.id)).toMatchObject({ status: "voided", voidReason: "Typo in the amount" });

      const again = await post(`/v1/food/admin/payments/${cash.id}/void`, finance, { reason: "Typo in the amount" }).expect(400);
      expect(again.body.message).toMatch(/already voided/);

      const [row] = await rows(`SELECT status, void_reason, voided_at FROM public.food_vendor_payments WHERE id = '${cash.id}'`);
      expect(row).toMatchObject({ status: "voided", void_reason: "Typo in the amount" });
      expect(row.voided_at).toBeInstanceOf(Date);

      // The kitchen sees the correction too.
      const after = (await get("/v1/food/vendor/wallet", owner)).body;
      expect(after.summary.receivedPaise).toBe(25000);
      expect(after.payments).toHaveLength(3);
    });
  });
});
