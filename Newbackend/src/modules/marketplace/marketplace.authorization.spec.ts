import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { MarketplaceAdminController } from "./presentation/marketplace-admin.controller";
import { MarketplaceVendorController } from "./presentation/marketplace-vendor.controller";
import { MarketplaceCustomerController } from "./presentation/marketplace-customer.controller";
import { getMetadataStorage } from "class-validator";
import { UpdateVendorProfileDto } from "./presentation/marketplace.dto";
import { buildMarketplace, makeUser } from "./testing/harness";

describe("Marketplace authorization", () => {
  async function twoVendorsWithOrders() {
    const h = buildMarketplace();
    const cat = await h.category();
    const a = await h.activeVendor("Store A");
    const b = await h.activeVendor("Store B");
    const pa = await h.publishedProduct(a.user, String(cat._id));
    const pb = await h.publishedProduct(b.user, String(cat._id));
    const buyer = makeUser();
    const { order } = await h.paidOrder(buyer, [
      { productId: String(pa._id), quantity: 1 },
      { productId: String(pb._id), quantity: 1 },
    ]);
    const vos: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
    const voA = vos.find((v) => String(v.vendorId) === String(a.vendor._id));
    const voB = vos.find((v) => String(v.vendorId) === String(b.vendor._id));
    return { h, a, b, pa, pb, buyer, order, voA, voB };
  }

  it("a vendor can read and edit its own products", async () => {
    const { h, a, pa } = await twoVendorsWithOrders();
    await expect(h.productService.vendorGet(a.user, String(pa._id))).resolves.toMatchObject({ name: pa.name });
    await expect(h.productService.vendorUpdate(a.user, String(pa._id), { price: 600 })).resolves.toMatchObject({ price: 600 });
  });

  it("a vendor cannot view, edit, restock, submit or archive another vendor's product", async () => {
    const { h, a, pb } = await twoVendorsWithOrders();
    const id = String(pb._id);
    await expect(h.productService.vendorGet(a.user, id)).rejects.toThrow(/not found/i);
    await expect(h.productService.vendorUpdate(a.user, id, { price: 1 })).rejects.toThrow(/not found/i);
    await expect(h.productService.vendorSetStock(a.user, id, 999)).rejects.toThrow(/not found/i);
    await expect(h.productService.vendorSubmit(a.user, id)).rejects.toThrow(/not found/i);
    await expect(h.productService.vendorSetListing(a.user, id, "archived")).rejects.toThrow(/not found/i);
    const list = await h.productService.vendorList(a.user, {});
    expect(list.data.every((p: any) => String(p.vendorId) === String((list.data[0] as any).vendorId))).toBe(true);
    expect(list.data.map((p: any) => String(p._id))).not.toContain(id);
    expect(((await h.models.products.findById(pb._id).lean()) as any).price).toBe(500);
  });

  it("a vendor only sees its own vendor order and cannot fulfil another's", async () => {
    const { h, a, voA, voB } = await twoVendorsWithOrders();
    const own = await h.orderService.vendorList(a.user, {});
    expect(own.data.map((v: any) => String(v._id))).toEqual([String(voA._id)]);
    await expect(h.orderService.vendorGet(a.user, String(voB._id))).rejects.toThrow(/not found/i);
    await expect(h.orderService.vendorUpdateFulfillment(a.user, String(voB._id), { status: "shipped" })).rejects.toThrow(/not found/i);
  });

  it("a vendor cannot see another vendor's wallet, ledger or payouts", async () => {
    const { h, a, b } = await twoVendorsWithOrders();
    const ledgerA = await h.ledger.list(a.vendor._id, {});
    expect(ledgerA.data.every((e: any) => String(e.vendorId) === String(a.vendor._id))).toBe(true);
    const walletA = await h.payoutService.summary(a.user);
    const walletB = await h.payoutService.summary(b.user);
    expect(walletA.pending).toBeGreaterThan(0);
    expect(walletB.pending).toBeGreaterThan(0);
    // Payout ids of vendor B are invisible to vendor A
    await h.settings.update({ minimumPayoutAmount: 1 }, h.admin);
    await h.ledger.adjust(h.admin, String(b.vendor._id), "credit", 100, "Test credit");
    const payoutB = await h.payoutService.request(b.user, { amount: 50 });
    await expect(h.payoutService.cancelOwn(a.user, String(payoutB._id))).rejects.toThrow(/not found/i);
    expect((await h.payoutService.listOwn(a.user, {})).total).toBe(0);
  });

  it("a user without a vendor profile cannot use vendor APIs", async () => {
    const { h } = await twoVendorsWithOrders();
    const customer = makeUser();
    await expect(h.productService.vendorList(customer, {})).rejects.toThrow(/not created a vendor profile/);
    await expect(h.orderService.vendorList(customer, {})).rejects.toThrow(/not created a vendor profile/);
    await expect(h.payoutService.summary(customer)).rejects.toThrow(/not created a vendor profile/);
  });

  it("a customer cannot read another customer's order", async () => {
    const { h, order } = await twoVendorsWithOrders();
    await expect(h.orderService.getMine(makeUser(), String(order._id))).rejects.toThrow(/not found/i);
    await expect(h.orderService.cancelMine(makeUser(), String(order._id))).rejects.toThrow(/not found/i);
  });

  it("customer-facing order views never expose commission", async () => {
    const { h, buyer, order } = await twoVendorsWithOrders();
    const view = await h.orderService.getMine(buyer, String(order._id));
    expect(view.pricing.commissionAmount).toBeUndefined();
    expect(JSON.stringify(view.vendorOrders)).not.toMatch(/commission|vendorEarning/);
  });

  it("a vendor cannot approve its own product or change its own commission (no such vendor routes)", () => {
    const vendorRoutes = Object.getOwnPropertyNames(MarketplaceVendorController.prototype);
    expect(vendorRoutes).not.toEqual(expect.arrayContaining(["reviewProduct", "vendorCommission", "adjust", "approvePayout"]));
    const vendorProfileFields = ["commissionPercent", "status", "isPlatformVendor"];
    // UpdateVendorProfileDto has no commission/status fields; the global ValidationPipe
    // (whitelist + forbidNonWhitelisted) rejects them.
    const props = getMetadataStorage().getTargetValidationMetadatas(UpdateVendorProfileDto, "", true, false).map((m: any) => m.propertyName);
    for (const f of vendorProfileFields) expect(props).not.toContain(f);
  });

  describe("role guard on admin routes", () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = (role: string, handler: string) =>
      ({
        getHandler: () => (MarketplaceAdminController.prototype as any)[handler],
        getClass: () => MarketplaceAdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: { ...makeUser(role), name: "x" } }) }),
      }) as any;

    it("blocks customers and vendors (plain users) from every admin route", () => {
      for (const handler of ["vendorsList", "reviewProduct", "approvePayout", "updateSettings", "overview"]) {
        expect(guard.canActivate(ctx("customer", handler))).toBe(false);
      }
    });

    it("lets super_admin in everywhere, and limits money routes to finance roles", () => {
      expect(guard.canActivate(ctx("super_admin", "approvePayout"))).toBe(true);
      expect(guard.canActivate(ctx("marketplace_manager", "reviewProduct"))).toBe(true);
      expect(guard.canActivate(ctx("marketplace_manager", "approvePayout"))).toBe(false);
      expect(guard.canActivate(ctx("finance_manager", "approvePayout"))).toBe(true);
      expect(guard.canActivate(ctx("marketplace_manager", "updateSettings"))).toBe(false);
      expect(guard.canActivate(ctx("marketplace_manager", "vendorCommission"))).toBe(false);
    });

    it("vendor and checkout controllers carry no admin roles", () => {
      const r = new Reflector();
      expect(r.get(ROLES_KEY, MarketplaceVendorController)).toBeUndefined();
      expect(r.get(ROLES_KEY, MarketplaceCustomerController)).toBeUndefined();
    });
  });
});
