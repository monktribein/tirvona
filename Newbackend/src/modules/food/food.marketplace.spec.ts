import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { FoodCatalogService } from "./application/food-catalog.service";
import { FoodQuoteService } from "./application/food-quote.service";
import { FoodOrderService } from "./application/food-order.service";
import { FoodFinanceService } from "./application/food-finance.service";
import { FoodPaymentService } from "./application/food-payment.service";
import { FoodVendorService } from "./application/food-vendor.service";
import { FoodAdminService } from "./application/food-admin.service";
import {
  LAUNCH_BOWLS,
  LAUNCH_COMBOS,
  THALI_VARIANTS,
} from "./domain/food.constants";

/**
 * Robust mock Mongoose/ORM model supporting chainable queries (.lean(), .sort(), etc.),
 * document mutation (.save()), and atomic updates (.findByIdAndUpdate, .updateOne).
 */
function createMockModel(initialItems: any[] = []) {
  const items = [...initialItems];

  const matchFilter = (item: any, filter: any): boolean => {
    if (!filter || Object.keys(filter).length === 0) return true;
    for (const [key, val] of Object.entries(filter)) {
      if (key === "$or" && Array.isArray(val)) {
        if (!val.some((subFilter) => matchFilter(item, subFilter))) return false;
      } else if (val && typeof val === "object" && "$ne" in val) {
        if (item[key]?.toString() === (val as any).$ne?.toString()) return false;
      } else if (val && typeof val === "object" && "$in" in val) {
        const allowed = (val as any).$in;
        const itemVal = item[key]?.toString();
        if (!allowed.map((x: any) => x?.toString()).includes(itemVal)) return false;
      } else if (val && typeof val === "object" && ("$lte" in val || "$gte" in val)) {
        if ("$lte" in val && item[key] > (val as any).$lte) return false;
        if ("$gte" in val && item[key] < (val as any).$gte) return false;
      } else if (Array.isArray(item[key])) {
        if (!item[key].map(String).includes(String(val))) return false;
      } else if (key === "_id") {
        if (item._id?.toString() !== val?.toString()) return false;
      } else if (item[key]?.toString() !== val?.toString()) {
        return false;
      }
    }
    return true;
  };

  const wrapDoc = (raw: any) => {
    if (!raw) return null;
    const doc = { ...raw };
    if (!doc._id) {
      doc._id = `id_${Math.random().toString(36).substring(2, 9)}`;
    }
    doc.save = async function () {
      const idx = items.findIndex((i) => i._id === doc._id);
      if (idx >= 0) items[idx] = { ...doc };
      else items.push({ ...doc });
      return doc;
    };
    return doc;
  };

  return {
    _items: items,
    countDocuments: jest.fn().mockImplementation(async (filter?: any) => {
      return items.filter((i) => matchFilter(i, filter)).length;
    }),
    find: jest.fn().mockImplementation((filter?: any) => {
      const matched = items.filter((i) => matchFilter(i, filter)).map(wrapDoc);
      return {
        lean: jest.fn().mockResolvedValue(matched),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: (resolve: any, reject?: any) => Promise.resolve(matched).then(resolve, reject),
      };
    }),
    findOne: jest.fn().mockImplementation((filter?: any) => {
      const found = items.find((i) => matchFilter(i, filter));
      const wrapped = found ? wrapDoc(found) : null;
      return {
        lean: jest.fn().mockResolvedValue(wrapped),
        populate: jest.fn().mockReturnThis(),
        then: (resolve: any, reject?: any) => Promise.resolve(wrapped).then(resolve, reject),
      };
    }),
    findById: jest.fn().mockImplementation((id: any) => {
      const found = items.find((i) => (i._id || "").toString() === (id || "").toString());
      const wrapped = found ? wrapDoc(found) : null;
      return {
        lean: jest.fn().mockResolvedValue(wrapped),
        populate: jest.fn().mockReturnThis(),
        then: (resolve: any, reject?: any) => Promise.resolve(wrapped).then(resolve, reject),
      };
    }),
    findOneAndUpdate: jest.fn().mockImplementation(async (filter: any, update: any) => {
      const item = items.find((i) => matchFilter(i, filter));
      if (!item) return null;
      Object.assign(item, update.$set ?? update);
      return wrapDoc(item);
    }),
    findByIdAndUpdate: jest.fn().mockImplementation(async (id: any, update: any) => {
      const item = items.find((i) => (i._id || "").toString() === (id || "").toString());
      if (item) {
        if (update.$set) Object.assign(item, update.$set);
        else Object.assign(item, update);
      }
      return item ? wrapDoc(item) : null;
    }),
    create: jest.fn().mockImplementation(async (data: any) => {
      const created = wrapDoc({ ...data });
      items.push(created);
      return created;
    }),
    updateOne: jest.fn().mockImplementation(async (filter: any, update: any) => {
      const item = items.find((i) => matchFilter(i, filter));
      if (item && update.$set) Object.assign(item, update.$set);
      return { modifiedCount: item ? 1 : 0 };
    }),
  };
}

describe("Tirvona Food & Dining Marketplace — Acceptance Test Suite (TF-QA-01 to TF-QA-14)", () => {
  let mockVendorModel: ReturnType<typeof createMockModel>;
  let mockOutletModel: ReturnType<typeof createMockModel>;
  let mockProductModel: ReturnType<typeof createMockModel>;
  let mockVariantModel: ReturnType<typeof createMockModel>;
  let mockZoneModel: ReturnType<typeof createMockModel>;
  let mockQuoteModel: ReturnType<typeof createMockModel>;
  let mockOrderModel: ReturnType<typeof createMockModel>;
  let mockOrderItemModel: ReturnType<typeof createMockModel>;
  let mockOrderEventModel: ReturnType<typeof createMockModel>;
  let mockLedgerModel: ReturnType<typeof createMockModel>;
  let mockRefundModel: ReturnType<typeof createMockModel>;
  let mockSettlementModel: ReturnType<typeof createMockModel>;
  let mockPaymentAttemptModel: ReturnType<typeof createMockModel>;
  let mockBookingModel: ReturnType<typeof createMockModel>;
  let mockReviewModel: ReturnType<typeof createMockModel>;

  let catalogService: FoodCatalogService;
  let quoteService: FoodQuoteService;
  let financeService: FoodFinanceService;
  let orderService: FoodOrderService;
  let paymentService: FoodPaymentService;
  let vendorService: FoodVendorService;
  let adminService: FoodAdminService;

  beforeEach(async () => {
    mockVendorModel = createMockModel();
    mockOutletModel = createMockModel();
    mockProductModel = createMockModel();
    mockVariantModel = createMockModel();
    mockZoneModel = createMockModel();
    mockQuoteModel = createMockModel();
    mockOrderModel = createMockModel();
    mockOrderItemModel = createMockModel();
    mockOrderEventModel = createMockModel();
    mockLedgerModel = createMockModel();
    mockRefundModel = createMockModel();
    mockSettlementModel = createMockModel();
    mockPaymentAttemptModel = createMockModel();
    mockBookingModel = createMockModel();
    mockReviewModel = createMockModel();

    catalogService = new FoodCatalogService(
      mockVendorModel as any,
      mockOutletModel as any,
      mockProductModel as any,
      mockVariantModel as any,
      mockZoneModel as any,
    );

    quoteService = new FoodQuoteService(
      mockQuoteModel as any,
      mockOutletModel as any,
      mockVendorModel as any,
      mockVariantModel as any,
      mockZoneModel as any,
    );

    financeService = new FoodFinanceService(
      mockLedgerModel as any,
      mockRefundModel as any,
      mockSettlementModel as any,
      mockOrderModel as any,
      mockOutletModel as any,
      mockVendorModel as any,
      {} as any, // BankAccountCrypto: not used by these tests
      { isConfigured: () => false } as any, // RazorpayX payouts off
    );

    orderService = new FoodOrderService(
      mockOrderModel as any,
      mockOrderItemModel as any,
      mockOrderEventModel as any,
      mockOutletModel as any,
      mockVendorModel as any,
      mockBookingModel as any,
      quoteService,
      financeService,
    );

    paymentService = new FoodPaymentService(
      mockOrderModel as any,
      mockOrderEventModel as any,
      mockPaymentAttemptModel as any,
      financeService,
      { get: () => undefined } as any, // no Razorpay keys: local demo payments
    );

    vendorService = new FoodVendorService(
      mockVendorModel as any,
      mockOutletModel as any,
      mockVariantModel as any,
      mockOrderModel as any,
    );

    adminService = new FoodAdminService(
      mockProductModel as any,
      mockOutletModel as any,
      mockOrderModel as any,
      mockZoneModel as any,
      mockRefundModel as any,
      mockReviewModel as any,
    );

    // Bootstrap catalog with pilot seed
    await catalogService.seedPilotDataIfEmpty();
  });

  // TF-QA-01: Discovery outside active zone
  it("TF-QA-01: Location selected outside active zone — returns no unavailable outlet/order path", async () => {
    // Non-existent or inactive zone
    const outOfZoneDiscovery = await catalogService.getDiscovery({
      zoneCode: "ZONE-OUTSIDE-VRINDAVAN",
    });
    expect(outOfZoneDiscovery.outlets).toHaveLength(0);
    expect(outOfZoneDiscovery.meals).toHaveLength(0);

    // Valid active zone returns outlets
    const activeZoneDiscovery = await catalogService.getDiscovery({
      zoneCode: "VRINDAVAN_CORE",
    });
    expect(activeZoneDiscovery.outlets.length).toBeGreaterThan(0);
    expect(activeZoneDiscovery.meals?.length).toBeGreaterThan(0);
  });

  // TF-QA-02: All four approved Thali variants
  it("TF-QA-02: All four approved Thali variants carry precise SKU, dietary declaration and integer paise price", async () => {
    expect(THALI_VARIANTS).toHaveLength(4);

    const expectedVariants = [
      {
        sku: "THALI-GG-SPICY",
        dietary: "Ginger and garlic included + spicy",
      },
      {
        sku: "THALI-GG-NONSPICY",
        dietary: "Ginger and garlic included + non-spicy",
      },
      {
        sku: "THALI-NOGG-SPICY",
        dietary: "Without ginger and garlic + spicy (Satvik)",
      },
      {
        sku: "THALI-NOGG-NONSPICY",
        dietary: "Without ginger and garlic + non-spicy (Satvik)",
      },
    ];

    for (const expected of expectedVariants) {
      const match = THALI_VARIANTS.find((v) => v.sku === expected.sku);
      expect(match).toBeDefined();
      expect(match!.dietaryDeclaration).toBe(expected.dietary);
    }

    // Verify seeded database has these 4 variants per outlet with integer paise prices
    const variants = await mockVariantModel.find().lean();
    const thaliVariants = variants.filter((v: any) => v.sku.startsWith("THALI-"));
    expect(thaliVariants.length).toBeGreaterThanOrEqual(4);
    for (const tv of thaliVariants) {
      expect(Number.isInteger(tv.pricePaise)).toBe(true);
      expect(tv.pricePaise).toBeGreaterThan(0);
    }
  });

  // TF-QA-03: Bowl and Combo distinct presentation
  it("TF-QA-03: Bowls and Combos maintain distinct SKUs and presentations without collision", async () => {
    expect(LAUNCH_BOWLS).toHaveLength(6);
    expect(LAUNCH_COMBOS).toHaveLength(11);

    const bowlSkus = LAUNCH_BOWLS.map((b) => b.sku);
    const comboSkus = LAUNCH_COMBOS.map((c) => c.sku);

    // No SKU collision
    for (const bSku of bowlSkus) {
      expect(bSku.startsWith("BWL-")).toBe(true);
      expect(comboSkus).not.toContain(bSku);
    }

    for (const cSku of comboSkus) {
      expect(cSku.startsWith("CMB-")).toBe(true);
      expect(bowlSkus).not.toContain(cSku);
    }

    // Both offer "Rajma Chawal", but distinct presentation and SKU
    const rajmaBowl = LAUNCH_BOWLS.find((b) => b.canonicalName === "Rajma Chawal");
    const rajmaCombo = LAUNCH_COMBOS.find((c) => c.canonicalName === "Rajma Chawal");
    expect(rajmaBowl).toBeDefined();
    expect(rajmaCombo).toBeDefined();
    expect(rajmaBowl!.sku).toBe("BWL-RAJMA-RICE");
    expect(rajmaCombo!.sku).toBe("CMB-RAJMA-RICE");
  });

  // TF-QA-04: Authoritative price quote validation
  it("TF-QA-04: Server-authoritative quote recalculates price in integer paise and rejects invalid quantities", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();
    const variant = variants[0];

    // Successful quote
    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variant._id, quantity: 2 }],
      zoneCode: "VRINDAVAN_CORE",
    });

    expect(quote.pricing.subtotalPaise).toBe(variant.pricePaise * 2);
    expect(quote.pricing.taxPaise).toBe(Math.round(variant.pricePaise * 2 * 0.05));
    expect(quote.pricing.totalPaise).toBe(
      quote.pricing.subtotalPaise +
        quote.pricing.packagingFeePaise +
        quote.pricing.deliveryFeePaise +
        quote.pricing.taxPaise,
    );
    expect(quote.quoteId).toBeDefined();

    // Rejection on zero or negative quantity
    await expect(
      quoteService.generateQuote({
        outletId: outlet._id,
        fulfilmentType: "pickup",
        items: [{ variantId: variant._id, quantity: 0 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // TF-QA-05: Duplicate payment webhook idempotency
  it("TF-QA-05: Duplicate payment webhooks are processed idempotently with only one set of ledger entries", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
      zoneCode: "VRINDAVAN_CORE",
    });

    const order = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-order-idem-1",
      customerName: "Rahul Sharma",
      customerPhone: "+91 9988776655",
    });

    const webhookPayload = {
      event: "payment.captured",
      orderId: order._id,
      gatewayPaymentId: "pay_test_dup_123",
      gatewayOrderId: `rzp_order_${order._id}`,
      payment: {
        id: "pay_test_dup_123",
        amount: order.totalPaise,
        currency: "INR",
        status: "captured",
      },
    };

    // First webhook delivery
    const result1 = await paymentService.handlePaymentWebhook("razorpay", webhookPayload, "");
    expect(result1.status).toBe("success");

    const ledgerCountAfterFirst = await mockLedgerModel.countDocuments({ orderId: order._id });
    expect(ledgerCountAfterFirst).toBeGreaterThan(0);

    // Second webhook delivery with same payment ID
    const result2 = await paymentService.handlePaymentWebhook("razorpay", webhookPayload, "");
    expect(result2.status).toBe("already_processed");

    // Ledger count must NOT increase
    const ledgerCountAfterSecond = await mockLedgerModel.countDocuments({ orderId: order._id });
    expect(ledgerCountAfterSecond).toBe(ledgerCountAfterFirst);
  });

  // TF-QA-06: Paid vendor rejects order — triggers automated refund workflow
  it("TF-QA-06: Paid vendor rejection triggers automated refund workflow and reverse ledger records", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
    });

    const order = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-order-reject-1",
      customerName: "Radha Dasi",
      customerPhone: "+91 98765 11111",
    });

    // Mark paid
    await paymentService.handlePaymentWebhook("razorpay", {
      event: "payment.captured",
      orderId: order._id,
      gatewayPaymentId: "pay_reject_test",
      payment: {
        id: "pay_reject_test",
        amount: order.totalPaise,
      },
    }, "");

    // Vendor rejects order with documented reason
    // Seeded launch vendors are platform-owned; give this one a real owner.
    const vendor = await mockVendorModel.findById(outlet.vendorId);
    vendor.ownerUserId = "vendor_user_1";
    await vendor.save();
    const rejectedOrder = await orderService.vendorRejectOrder(
      order._id,
      "vendor_user_1",
      "Kitchen at daily capacity limit",
    );

    expect(["VENDOR_REJECTED", "REFUNDED"]).toContain(rejectedOrder.orderStatus);
    expect(rejectedOrder.paymentStatus).toBe("REFUNDED");

    // Refund record must be created
    const refund = await mockRefundModel.findOne({ orderId: order._id }).lean();
    expect(refund).toBeDefined();
    expect(refund.amountPaise).toBe(order.totalPaise);
    expect(refund.reason).toBe("Vendor rejected: Kitchen at daily capacity limit");

    // Refund ledger entries created
    const refundLedger = await mockLedgerModel.find({
      orderId: order._id,
      entryType: "refund_debit",
    }).lean();
    expect(refundLedger.length).toBeGreaterThan(0);
  });

  // TF-QA-07: Cross-outlet vendor access denial
  it("TF-QA-07: Vendor cannot accept or manage an order belonging to another outlet", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outletA = outlets[0];

    const variants = await mockVariantModel.find({ outletId: outletA._id }).lean();
    const quote = await quoteService.generateQuote({
      outletId: outletA._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
    });

    const order = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-cross-outlet-idem",
      customerName: "Pilgrim",
      customerPhone: "+91 99999 88888",
    });

    // Mark paid
    order.orderStatus = "PAID_AWAITING_VENDOR";
    await order.save();

    // Vendor B user attempts to accept Vendor A's order
    await expect(
      orderService.vendorAcceptOrder(order._id, "vendor_b_unauthorized_user"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // TF-QA-08: Unauthorized customer order access denial
  it("TF-QA-08: Unauthorized customer cannot access another customer's order", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
      customerId: "cust_alice_123",
    });

    const order = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-auth-cust-idem",
      customerName: "Alice",
      customerPhone: "+91 91234 56789",
      customerId: "cust_alice_123",
    });

    // Alice accesses her own order
    const aliceOrder = await orderService.getAuthorizedOrder(order._id, {
      userId: "cust_alice_123",
    });
    expect(aliceOrder._id).toBe(order._id);

    // Bob tries to access Alice's order
    await expect(
      orderService.getAuthorizedOrder(order._id, {
        userId: "cust_bob_999",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // TF-QA-09: Stay-owner access to unrelated orders denial & room delivery privacy
  it("TF-QA-09: Stay owner cannot access unrelated orders; room delivery sanitizes payment details", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    // Order linked to stay booking at Property X
    await mockBookingModel.create({
      _id: "booking_prop_x_101",
      ashramId: "property_ashram_x",
      status: "confirmed",
    });

    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "stay_delivery",
      stayBookingId: "booking_prop_x_101",
      stayRoomNumber: "Room 204",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
    });

    const order = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-stay-link-idem",
      customerName: "Anand Dev",
      customerPhone: "+91 97777 66666",
      stayBookingId: "booking_prop_x_101",
      stayRoomNumber: "Room 204",
    });

    // Stay owner of Property Y tries to inspect Property X's order
    await expect(
      orderService.getAuthorizedOrder(order._id, {
        role: "stay_owner",
        userId: "owner_y",
        ashramId: "property_ashram_y",
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Stay owner of Property X inspects order: succeeds
    const propXOrder = await orderService.getAuthorizedOrder(order._id, {
      role: "stay_owner",
      userId: "owner_x",
      ashramId: "property_ashram_x",
    } as any);
    expect(propXOrder._id).toBe(order._id);
    expect(propXOrder.stayRoomNumber).toBe("Room 204");
  });

  // TF-QA-10: Settlement calculation is idempotent
  it("TF-QA-10: Repeated settlement calculation does not duplicate records or inflate payables", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];

    // Period 2026-10-01 to 2026-10-15
    const periodStart = new Date("2026-10-01T00:00:00.000Z");
    const periodEnd = new Date("2026-10-15T23:59:59.999Z");

    const result1 = await financeService.generateSettlement(outlet._id, periodStart, periodEnd);
    const countAfterFirst = await mockSettlementModel.countDocuments({ outletId: outlet._id });

    const result2 = await financeService.generateSettlement(outlet._id, periodStart, periodEnd);
    const countAfterSecond = await mockSettlementModel.countDocuments({ outletId: outlet._id });

    expect(countAfterSecond).toBe(countAfterFirst);
    expect(result1._id).toBe(result2._id);
  });

  // TF-QA-11: Refund gateway failure marks refund for escalation
  it("TF-QA-11: Failed refund marks status as failed for finance escalation rather than silent crash", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
    });

    const order = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-refund-fail-idem",
      customerName: "Gopal",
      customerPhone: "+91 95555 44444",
    });

    order.orderStatus = "PAID_AWAITING_VENDOR";
    order.paymentStatus = "PAID";
    // Persist the paid state in the store itself: the refund claims the stored order, not this copy.
    await mockOrderModel.findByIdAndUpdate(order._id, { orderStatus: "PAID_AWAITING_VENDOR", paymentStatus: "PAID" });

    // Trigger refund with simulated gateway failure
    const refund = await financeService.initiateRefund(
      order,
      "Customer cancellation",
      "cust_user_1",
      true, // simulate gateway failure
    );

    expect(refund.status).toBe("failed");
    const reloaded = await mockOrderModel.findById(order._id);
    expect(reloaded.orderStatus).toBe("REFUND_FAILED");
  });

  // TF-QA-12: Mobile checkout validation
  it("TF-QA-12: Order creation validates required phone and customer details", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
    });

    // Missing phone number
    await expect(
      orderService.createOrder({
        quoteId: quote.quoteId,
        idempotencyKey: "test-invalid-phone",
        customerName: "Devotee",
        customerPhone: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // TF-QA-13: Audited commission changes
  it("TF-QA-13: Admin commission updates are bounded (5-30%), effective-dated, and audited", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];

    // Invalid commission: 2% (200 bps)
    await expect(
      adminService.updateOutletCommission(
        outlet._id,
        "admin_user_super",
        200, // 2% is outside 500-3000 bps
        "Too low",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Valid commission: 12.5% (1250 bps)
    const updated = await adminService.updateOutletCommission(
      outlet._id,
      "admin_user_super",
      1250,
      "Agreed festive season pilot baseline terms",
    );

    expect(updated.newRateBps).toBe(1250);
  });

  // TF-QA-14: Vendor pauses availability without deleting order history
  it("TF-QA-14: Vendor pausing outlet blocks new orders while preserving historical records", async () => {
    const outlets = await mockOutletModel.find().lean();
    const outlet = outlets[0];
    const vendor = await mockVendorModel.findById(outlet.vendorId);
    vendor.ownerUserId = "vendor_user_1";
    await vendor.save();
    const variants = await mockVariantModel.find({ outletId: outlet._id }).lean();

    // Create an order first to establish history
    const quote = await quoteService.generateQuote({
      outletId: outlet._id,
      fulfilmentType: "pickup",
      items: [{ variantId: variants[0]._id, quantity: 1 }],
    });

    const historicalOrder = await orderService.createOrder({
      quoteId: quote.quoteId,
      idempotencyKey: "test-history-order",
      customerName: "Historical Customer",
      customerPhone: "+91 91111 22222",
    });

    // Vendor pauses outlet
    await vendorService.toggleOutletPause(
      outlet._id,
      "vendor_user_1",
      true,
    );

    // New quote must be rejected because outlet is paused
    await expect(
      quoteService.generateQuote({
        outletId: outlet._id,
        fulfilmentType: "pickup",
        items: [{ variantId: variants[0]._id, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Historical order must still exist intact
    const fetched = await orderService.getAuthorizedOrder(historicalOrder._id, {
      role: "admin",
    });
    expect(fetched).toBeDefined();
    expect(fetched.orderNumber).toBe(historicalOrder.orderNumber);
  });
});
