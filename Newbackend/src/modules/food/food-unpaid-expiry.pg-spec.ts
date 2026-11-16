/// <reference types="jest" />
/**
 * Unpaid food orders are closed after a day instead of reading "Payment
 * pending" forever — against a real Postgres 17. Run with `npm run test:pg`.
 */
import { getModelToken } from "../../database/orm-nest";
import { FoodOrderService } from "./application/food-order.service";
import { createFoodTestApp, type FoodTestApp } from "./testing/food-test-app";

describe("unpaid food orders expire (real Postgres)", () => {
  let ctx: FoodTestApp;

  beforeAll(async () => {
    ctx = await createFoodTestApp();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it("closes day-old unpaid orders only, once, with an audit event", async () => {
    const vendors = ctx.app.get(getModelToken("FoodVendor"));
    const outlets = ctx.app.get(getModelToken("FoodOutlet"));
    const orders = ctx.app.get(getModelToken("FoodOrder"));
    const events = ctx.app.get(getModelToken("FoodOrderEvent"));
    const service = ctx.app.get(FoodOrderService);

    const vendor = await vendors.create({ businessName: "Expiry Kitchen", status: "active" });
    const outlet = await outlets.create({
      vendorId: vendor._id,
      brandName: "Expiry Main",
      address: "Vrindavan",
      commissionRateBps: 1250,
    });
    const order = (n: number, extra: object = {}) =>
      orders.create({
        orderNumber: `TF-EXPIRY-${n}`,
        customerName: "Devotee",
        customerPhone: "9876543210",
        outletId: outlet._id,
        fulfilmentType: "vendor_delivery",
        orderStatus: "PAYMENT_PENDING",
        paymentStatus: "PENDING",
        subtotalPaise: 24900,
        totalPaise: 24900,
        ...extra,
      });
    const abandoned = await order(1);
    const recent = await order(2);
    const paidLate = await order(3, { paymentStatus: "PAID" });
    // Age two of them past the one-day window.
    await ctx.db.pool.query(
      `update food_orders set created_at = now() - interval '25 hours' where id = any($1)`,
      [[String(abandoned._id), String(paidLate._id)]],
    );

    await expect(service.expireUnpaidOrders()).resolves.toBe(1);

    const statusOf = async (id: unknown) =>
      ((await orders.findById(id).lean()) as any).orderStatus;
    expect(await statusOf(abandoned._id)).toBe("PAYMENT_EXPIRED");
    expect(await statusOf(recent._id)).toBe("PAYMENT_PENDING");
    // Never touch an order whose money has arrived.
    expect(await statusOf(paidLate._id)).toBe("PAYMENT_PENDING");
    const trail = await events.find({ orderId: abandoned._id, toStatus: "PAYMENT_EXPIRED" }).lean();
    expect(trail).toHaveLength(1);

    // A second run finds nothing left to do.
    await expect(service.expireUnpaidOrders()).resolves.toBe(0);
  });
});
