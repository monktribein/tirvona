import { buildMarketplace, makeUser, sign } from "./testing/harness";

async function setup(opts: Parameters<typeof buildMarketplace>[0] = {}) {
  const h = buildMarketplace(opts);
  await h.settings.update({ defaultCommissionPercent: 10 }, h.admin);
  const cat = await h.category();
  const a = await h.activeVendor("Store A");
  const b = await h.activeVendor("Store B");
  return { h, cat, a, b };
}

describe("Marketplace orders", () => {
  it("single-vendor order creates one vendor order", async () => {
    const { h, cat, a } = await setup();
    const p = await h.publishedProduct(a.user, String(cat._id), { price: 300 });
    const { order } = await h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any);
    expect(order.vendorOrderIds).toHaveLength(1);
    expect(order.pricing).toMatchObject({ itemsSubtotal: 300, gstAmount: 15, shippingFee: 60, totalAmount: 375 });
  });

  it("multi-vendor cart becomes one master order split into per-vendor orders", async () => {
    const { h, cat, a, b } = await setup();
    const pa = await h.publishedProduct(a.user, String(cat._id), { price: 1200 });
    const pb = await h.publishedProduct(b.user, String(cat._id), { price: 200 });
    const { order } = await h.orderService.checkout(makeUser(), {
      items: [{ productId: String(pa._id), quantity: 1 }, { productId: String(pb._id), quantity: 2 }],
      address: h.address,
    } as any);
    const vos: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
    expect(vos).toHaveLength(2);
    const va = vos.find((v) => String(v.vendorId) === String(a.vendor._id));
    const vb = vos.find((v) => String(v.vendorId) === String(b.vendor._id));
    expect(va).toMatchObject({ subtotal: 1200, gstAmount: 60, shippingFee: 0, total: 1260, commissionAmount: 120, vendorEarning: 1140 });
    expect(vb).toMatchObject({ subtotal: 400, gstAmount: 20, shippingFee: 60, total: 480, commissionAmount: 40, vendorEarning: 440 });
    expect(order.pricing.totalAmount).toBe(1260 + 480);
  });

  it("keeps a historical snapshot when the vendor later changes the product", async () => {
    const { h, cat, a } = await setup();
    const p = await h.publishedProduct(a.user, String(cat._id), { price: 500, name: "Laddu Box", sku: "LAD-1" });
    await h.paidOrder(makeUser(), [{ productId: String(p._id), quantity: 1 }]);
    await h.productService.vendorUpdate(a.user, String(p._id), { price: 900, name: "Laddu Box Deluxe" });
    await h.vendorService.updateOwnProfile(a.user, { storeName: "Renamed Store" });
    const [vo]: any[] = await h.models.vendorOrders.find({ vendorId: a.vendor._id }).lean();
    expect(vo.items[0]).toMatchObject({ name: "Laddu Box", sku: "LAD-1", unitPrice: 500 });
    expect(vo.vendorSnapshot.storeName).toBe("Store A");
  });

  it("never trusts client prices: only productId + quantity are accepted", async () => {
    const { h, cat, a } = await setup();
    const p = await h.publishedProduct(a.user, String(cat._id), { price: 500 });
    const { order } = await h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 1, price: 1 } as any], address: h.address } as any);
    expect(order.pricing.itemsSubtotal).toBe(500);
  });

  it("rejects buying from your own store and unpublished products", async () => {
    const { h, cat, a } = await setup();
    const p = await h.publishedProduct(a.user, String(cat._id));
    await expect(h.orderService.checkout(a.user, { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any)).rejects.toThrow(/your own store/);
    const draft = await h.productService.vendorCreate(a.user, { name: "Draft item", categoryId: String(cat._id), price: 100 } as any);
    await expect(h.orderService.checkout(makeUser(), { items: [{ productId: String(draft._id), quantity: 1 }], address: h.address } as any)).rejects.toThrow(/no longer available/);
  });

  describe("inventory", () => {
    it("rejects quantities above stock", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 2 });
      await expect(h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 3 }], address: h.address } as any)).rejects.toThrow(/only 2 left/);
    });

    it("two customers racing for the last unit: exactly one wins, stock never goes negative", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 1 });
      const attempt = () => h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any);
      const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const after: any = await h.models.products.findById(p._id).lean();
      expect(after.stock).toBe(0);
      expect(after.inventory.reserved).toBe(1);
    });

    it("all-or-nothing reservation across a multi-item cart", async () => {
      const { h, cat, a, b } = await setup();
      const pa = await h.publishedProduct(a.user, String(cat._id), { stock: 5 });
      const pb = await h.publishedProduct(b.user, String(cat._id), { stock: 1 });
      // Quote passes, but someone else takes pb's last unit before reservation.
      await h.inventory.reserveAll([{ productId: pb._id, quantity: 1 }]);
      await expect(h.inventory.reserveAll([{ productId: pa._id, quantity: 2 }, { productId: pb._id, quantity: 1 }])).rejects.toThrow(/stock/);
      expect(((await h.models.products.findById(pa._id).lean()) as any).stock).toBe(5); // rolled back
    });

    it("expired unpaid orders release their stock", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 3 });
      const { order } = await h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 2 }], address: h.address } as any);
      await h.models.masterOrders.updateOne({ _id: order._id }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
      expect(await h.orderService.expireStaleOrders()).toBe(1);
      const after: any = await h.models.products.findById(p._id).lean();
      expect(after).toMatchObject({ stock: 3, inventory: expect.objectContaining({ reserved: 0 }) });
      expect(((await h.models.masterOrders.findById(order._id).lean()) as any).status).toBe("expired");
    });
  });

  describe("payment", () => {
    it("duplicate confirmations (browser + webhook) record the sale and commission once", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id));
      const buyer = makeUser();
      const { order, payment } = await h.orderService.checkout(buyer, { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any);
      const dto = { razorpay_order_id: payment.razorpayOrderId, razorpay_payment_id: "pay_x", razorpay_signature: sign(payment.razorpayOrderId, "pay_x") };
      await Promise.all([
        h.orderService.confirmPayment(buyer, String(order._id), dto),
        h.orderService.confirmPaymentFromWebhook(payment.razorpayOrderId, "pay_x", { amountPaise: payment.amount }),
        h.orderService.confirmPayment(buyer, String(order._id), dto),
      ]);
      const entries: any[] = await h.models.ledger.find({ vendorId: a.vendor._id }).lean();
      expect(entries.filter((e) => e.type === "sale_credit")).toHaveLength(1);
      expect(entries.filter((e) => e.type === "commission_debit")).toHaveLength(1);
      const after: any = await h.models.products.findById(p._id).lean();
      expect(after.inventory.sold).toBe(1);
    });

    it("rejects a forged signature, a payment for a different order, and demo markers when live keys exist", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id));
      const buyer = makeUser();
      const { order, payment } = await h.orderService.checkout(buyer, { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any);
      await expect(h.orderService.confirmPayment(buyer, String(order._id), { razorpay_order_id: payment.razorpayOrderId, razorpay_payment_id: "pay_1", razorpay_signature: "bad" })).rejects.toThrow(/verification failed/);
      await expect(h.orderService.confirmPayment(buyer, String(order._id), { razorpay_order_id: "order_cheap", razorpay_payment_id: "pay_1", razorpay_signature: sign("order_cheap", "pay_1") })).rejects.toThrow(/does not belong/);
      await expect(h.orderService.confirmPayment(buyer, String(order._id), { razorpay_order_id: payment.razorpayOrderId, razorpay_payment_id: "pay_sim_1", razorpay_signature: "demo_simulated_sig" })).rejects.toThrow(/verification failed/);
      expect(((await h.models.masterOrders.findById(order._id).lean()) as any).paymentStatus).toBe("pending");
    });

    it("webhook with the wrong captured amount is flagged, not confirmed", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id));
      const { order, payment } = await h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any);
      await expect(h.orderService.confirmPaymentFromWebhook(payment.razorpayOrderId, "pay_1", { amountPaise: 100 })).resolves.toBe(true);
      const m: any = await h.models.masterOrders.findById(order._id).lean();
      expect(m.paymentStatus).toBe("pending");
      expect(m.reconciliationNote).toMatch(/AMOUNT_MISMATCH/);
    });

    it("webhook for an unknown order returns false (other modules get a chance)", async () => {
      const { h } = await setup();
      await expect(h.orderService.confirmPaymentFromWebhook("order_unknown", "pay_1")).resolves.toBe(false);
    });

    it("checkout fails cleanly (stock released) when the gateway is down", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 4 });
      h.gateway.orders.create.mockRejectedValueOnce(new Error("down"));
      await expect(h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 2 }], address: h.address } as any)).rejects.toThrow(/gateway is unavailable/);
      expect(((await h.models.products.findById(p._id).lean()) as any).stock).toBe(4);
    });

    it("refuses checkout in production without payment keys (no silent demo mode)", async () => {
      const { h, cat, a } = await setup({ razorpay: false, nodeEnv: "production" });
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 4 });
      await expect(h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any)).rejects.toThrow(/not configured/);
      expect(((await h.models.products.findById(p._id).lean()) as any).stock).toBe(4);
    });

    it("paid after the hold expired and stock is gone -> refunded, not oversold", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 1 });
      const late = makeUser();
      const { order, payment } = await h.orderService.checkout(late, { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any);
      await h.models.masterOrders.updateOne({ _id: order._id }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
      await h.orderService.expireStaleOrders();
      await h.paidOrder(makeUser(), [{ productId: String(p._id), quantity: 1 }]); // someone else buys it
      await h.orderService.confirmPayment(late, String(order._id), {
        razorpay_order_id: payment.razorpayOrderId, razorpay_payment_id: "pay_late", razorpay_signature: sign(payment.razorpayOrderId, "pay_late"),
      });
      const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
      expect(vo.fulfillmentStatus).toBe("refunded");
      expect(h.wallet.credit).toHaveBeenCalled();
      const prod: any = await h.models.products.findById(p._id).lean();
      expect(prod.stock).toBe(0);
      expect(prod.inventory.sold).toBe(1);
    });
  });

  describe("cancellation, refunds and returns", () => {
    it("customer cancels a paid multi-vendor order: each vendor order refunded, stock restored, earnings reversed", async () => {
      const { h, cat, a, b } = await setup();
      const pa = await h.publishedProduct(a.user, String(cat._id), { stock: 3 });
      const pb = await h.publishedProduct(b.user, String(cat._id), { stock: 3 });
      const buyer = makeUser();
      const { order } = await h.paidOrder(buyer, [{ productId: String(pa._id), quantity: 1 }, { productId: String(pb._id), quantity: 2 }]);
      const view = await h.orderService.cancelMine(buyer, String(order._id), "Changed my mind");
      expect(view.status).toBe("cancelled");
      expect(view.paymentStatus).toBe("refunded");
      expect(h.wallet.credit).toHaveBeenCalledTimes(2);
      expect(((await h.models.products.findById(pb._id).lean()) as any).stock).toBe(3);
      expect(await h.ledger.balance(b.vendor._id)).toMatchObject({ pending: 0, available: 0 });
    });

    it("cannot cancel after shipping", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id));
      const buyer = makeUser();
      const { order } = await h.paidOrder(buyer, [{ productId: String(p._id), quantity: 1 }]);
      const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
      await h.orderService.vendorUpdateFulfillment(a.user, String(vo._id), { status: "shipped" });
      await expect(h.orderService.cancelMine(buyer, String(order._id))).rejects.toThrow(/already shipped/);
    });

    it("a failed wallet refund is flagged for retry, never marked refunded", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id));
      const buyer = makeUser();
      const { order } = await h.paidOrder(buyer, [{ productId: String(p._id), quantity: 1 }]);
      h.wallet.credit.mockRejectedValueOnce(new Error("wallet down"));
      await h.orderService.cancelMine(buyer, String(order._id));
      let [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
      expect(vo).toMatchObject({ fulfillmentStatus: "cancelled", refundError: "wallet down" });
      await h.orderService.adminRetryRefund(h.admin, String(vo._id));
      [vo] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
      expect(vo.fulfillmentStatus).toBe("refunded");
    });

    it("returns: only within the configured window, admin approval refunds and reverses a settled sale", async () => {
      const { h, cat, a } = await setup();
      await h.settings.update({ returnWindowDays: 7, settlementHoldDays: 0 }, h.admin);
      const p = await h.publishedProduct(a.user, String(cat._id), { stock: 2 });
      const buyer = makeUser();
      const { order } = await h.paidOrder(buyer, [{ productId: String(p._id), quantity: 1 }]);
      const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
      await expect(h.orderService.requestReturn(buyer, String(vo._id), "Damaged box")).rejects.toThrow(/Only delivered/);
      await h.orderService.vendorUpdateFulfillment(a.user, String(vo._id), { status: "shipped" });
      await h.orderService.vendorUpdateFulfillment(a.user, String(vo._id), { status: "delivered" });
      expect((await h.ledger.balance(a.vendor._id)).available).toBeGreaterThan(0);
      await h.orderService.requestReturn(buyer, String(vo._id), "Damaged box");
      await h.orderService.adminResolveReturn(h.admin, String(vo._id), true, "Photo evidence ok");
      const after: any = await h.models.vendorOrders.findById(vo._id).lean();
      expect(after.fulfillmentStatus).toBe("refunded");
      expect(await h.ledger.balance(a.vendor._id)).toMatchObject({ available: 0, pending: 0 });
      expect(((await h.models.products.findById(p._id).lean()) as any).stock).toBe(2);
    });

    it("vendors cannot jump the state machine", async () => {
      const { h, cat, a } = await setup();
      const p = await h.publishedProduct(a.user, String(cat._id));
      const { order } = await h.paidOrder(makeUser(), [{ productId: String(p._id), quantity: 1 }]);
      const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
      await expect(h.orderService.vendorUpdateFulfillment(a.user, String(vo._id), { status: "delivered" })).rejects.toThrow(/cannot move/);
      await expect(h.orderService.vendorUpdateFulfillment(a.user, String(vo._id), { status: "refunded" })).rejects.toThrow(/cannot set/);
    });
  });
});
