import { DashboardService, startOfIndianDay } from "./application/dashboard.service";
import { buildMarketplace, makeUser } from "./testing/harness";

async function setup() {
  const h = buildMarketplace();
  await h.settings.update({ defaultCommissionPercent: 10 }, h.admin);
  const cat = await h.category();
  const a = await h.activeVendor("Store A");
  const b = await h.activeVendor("Store B");
  const dashboard = new DashboardService(
    h.models.vendors, h.models.products, h.models.masterOrders, h.models.vendorOrders, h.models.payouts,
    h.vendorService, h.productService, h.payoutService, h.ledger, h.audit,
  );
  // The in-memory test model cannot evaluate $expr (used by the low-stock query),
  // so emulate it here with the same rule: tracked stock <= lowStockThreshold.
  jest.spyOn(h.productService, "vendorLowStock").mockImplementation(async (user: any) => {
    const vendor = await h.vendorService.requireOwnVendor(user);
    const rows: any[] = await h.models.products.find({ vendorId: vendor._id, deletedAt: null }).lean();
    return rows.filter((p) => p.inventory?.trackInventory !== false && p.listingStatus !== "archived" && p.stock <= (p.inventory?.lowStockThreshold ?? 5));
  });
  return { h, cat, a, b, dashboard };
}

describe("Marketplace dashboards", () => {
  it("vendor dashboard counts only the caller's own store", async () => {
    const { h, cat, a, b, dashboard } = await setup();
    const pa = await h.publishedProduct(a.user, String(cat._id), { price: 1200, stock: 3 });
    const pb = await h.publishedProduct(b.user, String(cat._id), { price: 200 });
    await h.productService.vendorCreate(a.user, { name: "Draft Mala", categoryId: String(cat._id), price: 300 } as any);
    await h.paidOrder(makeUser(), [
      { productId: String(pa._id), quantity: 1 },
      { productId: String(pb._id), quantity: 2 },
    ]);
    // The in-memory model does not apply schema timestamps; MongoDB does.
    await h.models.vendorOrders.updateMany({}, { $set: { createdAt: new Date() } });

    const da = await dashboard.vendorDashboard(a.user);
    expect(da.store.storeName).toBe("Store A");
    expect(da.orders).toMatchObject({ today: 1, pending: 1, total: 1 });
    expect(da.products).toMatchObject({ total: 2, live: 1, pendingApproval: 0 });
    expect(da.products.lowStock).toBe(2); // 2 left of the sold item + the draft at 0, threshold 5
    expect(da.sales.gross).toBe(1260); // Store A's order only, not Store B's 480
    expect(da.recentOrders).toHaveLength(1);
    expect(da.topProducts.map((p: any) => String(p._id))).toEqual([String(pa._id)]);
    expect(da.wallet.pending).toBe(1260 - 120);
    expect(da.commission.netCommission).toBe(120);

    const db = await dashboard.vendorDashboard(b.user);
    expect(db.sales.gross).toBe(480);
    expect(db.topProducts.map((p: any) => String(p._id))).toEqual([String(pb._id)]);
  });

  it("a user without a store gets 404 instead of someone else's numbers", async () => {
    const { dashboard } = await setup();
    await expect(dashboard.vendorDashboard(makeUser())).rejects.toThrow(/vendor profile/);
  });

  it("admin overview summarises vendors, products, orders and commission", async () => {
    const { h, cat, a, dashboard } = await setup();
    const p = await h.publishedProduct(a.user, String(cat._id), { price: 1000 });
    const pending = await h.productService.vendorCreate(a.user, { name: "Rudraksha", categoryId: String(cat._id), price: 800, description: "Five-mukhi mala", images: ["https://img.example.com/r.jpg"] } as any);
    await h.productService.vendorSubmit(a.user, String(pending._id));
    await h.vendorService.createProfile(makeUser(), { storeName: "New Applicant" });
    await h.paidOrder(makeUser(), [{ productId: String(p._id), quantity: 1 }]);

    const o = await dashboard.adminOverview();
    expect(o.vendors).toMatchObject({ total: 3, active: 2 });
    expect(o.products).toMatchObject({ total: 2, approved: 1, pending: 1 });
    expect(o.orders).toMatchObject({ paid: 1, awaitingFulfilment: 1 });
    expect(o.sales.gross).toBe(1050);
    expect(o.commission.netCommission).toBe(100);
    expect(o.recentOrders).toHaveLength(1);
    expect(o.recentActivity.length).toBeGreaterThan(0);
  });

  it("business day starts at midnight IST", () => {
    expect(startOfIndianDay(new Date("2026-09-29T20:00:00Z")).toISOString()).toBe("2026-09-29T18:30:00.000Z");
    expect(startOfIndianDay(new Date("2026-09-29T10:00:00Z")).toISOString()).toBe("2026-09-28T18:30:00.000Z");
  });
});

describe("Marketplace review listing", () => {
  it("scopes a vendor's reviews to its own store", async () => {
    const { h, cat, a, b } = await setup();
    const pa = await h.publishedProduct(a.user, String(cat._id));
    const pb = await h.publishedProduct(b.user, String(cat._id));
    for (const [p, v] of [[pa, a], [pb, b]] as const) {
      await h.models.reviews.create({ productId: p._id, vendorId: v.vendor._id, customerId: makeUser().id, vendorOrderId: p._id, rating: 5 });
    }
    const own = await h.reviewService.list({ vendorId: a.vendor._id });
    expect(own.total).toBe(1);
    expect(String(own.data[0].vendorId)).toBe(String(a.vendor._id));
    expect((await h.reviewService.list({})).total).toBe(2);
  });
});
