/**
 * End-to-end success path from the marketplace spec:
 * user -> vendor -> KYC -> approval -> product -> approval -> public ->
 * purchase -> payment -> master/vendor orders -> stock -> commission ->
 * ledger -> delivered -> settlement -> payout -> paid.
 */
import { buildMarketplace, makeUser } from "./testing/harness";

describe("Marketplace end-to-end flow", () => {
  it("runs the full vendor -> customer -> payout lifecycle", async () => {
    const h = buildMarketplace();
    await h.settings.update({ defaultCommissionPercent: 10, settlementHoldDays: 0 }, h.admin);

    // Existing Tirvona user becomes a vendor
    const seller = makeUser("customer");
    const created = await h.vendorService.createProfile(seller, {
      storeName: "Banke Bihari Prasad",
      contactPhone: "9876543210",
      address: { line1: "Temple Road", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
    });
    expect(created.status).toBe("draft");
    expect(created.slug).toBe("banke-bihari-prasad");

    // KYC
    await expect(h.vendorService.submitForVerification(seller)).rejects.toThrow(/Upload these documents/);
    await h.vendorService.addDocument(seller, { type: "identity", fileUrl: "https://f.example.com/id.pdf" });
    await h.vendorService.addDocument(seller, { type: "address_proof", fileUrl: "https://f.example.com/a.pdf" });
    expect((await h.vendorService.submitForVerification(seller)).status).toBe("pending_verification");

    // Super admin approves; vendor adds a bank account and goes live
    const vendorId = String(created._id);
    await h.vendorService.adminSetStatus(h.admin, vendorId, "start_review");
    expect((await h.vendorService.adminSetStatus(h.admin, vendorId, "approve")).status).toBe("approved");
    await expect(h.vendorService.activate(seller)).rejects.toThrow(/bank account/);
    const bank = await h.vendorService.addBankAccount(seller, { accountHolderName: "Banke Bihari Prasad", accountNumber: "001122334455", ifsc: "HDFC0001234" });
    expect(bank.accountNumberMasked).toBe("XXXXXX4455");
    expect(bank.accountNumberEncrypted).toBeUndefined();
    expect((await h.vendorService.activate(seller)).status).toBe("active");

    // Product: create -> submit -> approve -> public
    const cat = await h.category("Prasad");
    const product = await h.productService.vendorCreate(seller, {
      name: "Peda Prasad 500g",
      categoryId: String(cat._id),
      description: "Fresh peda",
      price: 1000,
      images: ["https://img.example.com/peda.jpg"],
      stock: 5,
      sku: "PEDA-500",
    } as any);
    expect(product.status).toBe("suspended"); // hidden from the legacy API while a draft
    expect((await h.productService.publicList({})).total).toBe(0);
    await h.productService.vendorSubmit(seller, String(product._id));
    expect((await h.productService.publicList({})).total).toBe(0); // pending is not public
    await h.productService.adminReview(h.admin, String(product._id), "approve");
    const pub = await h.productService.publicList({});
    expect(pub.total).toBe(1);
    expect(pub.data[0]).toMatchObject({ name: "Peda Prasad 500g", sellingPrice: 1000, inStock: true });

    // Customer buys 2
    const buyer = makeUser("customer");
    const { order, payment } = await h.orderService.checkout(buyer, { items: [{ productId: String(product._id), quantity: 2 }], address: h.address } as any);
    expect(order.status).toBe("pending_payment");
    expect(payment.amount).toBe(Math.round((2000 + 100 + 0) * 100)); // 5% GST, free shipping >= 999
    let p: any = await h.models.products.findById(product._id).lean();
    expect(p.stock).toBe(3);
    expect(p.inventory.reserved).toBe(2);

    // Payment via existing Razorpay flow (signature verified server-side)
    const { sign } = await import("./testing/harness");
    await h.orderService.confirmPayment(buyer, String(order._id), {
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: "pay_1",
      razorpay_signature: sign(payment.razorpayOrderId, "pay_1"),
    });
    const master: any = await h.models.masterOrders.findById(order._id).lean();
    expect(master).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
    expect(vo).toMatchObject({ fulfillmentStatus: "confirmed", subtotal: 2000, gstAmount: 100, total: 2100, commissionAmount: 200, vendorEarning: 1900 });
    p = await h.models.products.findById(product._id).lean();
    expect(p.inventory).toMatchObject({ reserved: 0, sold: 2 });
    expect(p.stock).toBe(3);

    // Earnings pending until delivery
    let wallet = await h.payoutService.summary(seller);
    expect(wallet).toMatchObject({ pending: 1900, available: 0 });

    // Vendor fulfils
    await h.orderService.vendorUpdateFulfillment(seller, String(vo._id), { status: "processing" });
    await h.orderService.vendorUpdateFulfillment(seller, String(vo._id), { status: "shipped", tracking: { carrier: "India Post", trackingNumber: "EE123" } });
    await h.orderService.vendorUpdateFulfillment(seller, String(vo._id), { status: "delivered" });
    expect(((await h.models.masterOrders.findById(order._id).lean()) as any).status).toBe("completed");


    // Settlement (hold = 0 days) -> available
    wallet = await h.payoutService.summary(seller);
    expect(wallet).toMatchObject({ pending: 0, available: 1900 });

    // Payout requested -> reviewed -> paid (manual transfer; no RazorpayX configured)
    await expect(h.payoutService.request(seller, { amount: 5000 })).rejects.toThrow(/Insufficient available balance/);
    const payout = await h.payoutService.request(seller, { amount: 1900 });
    expect((await h.payoutService.summary(seller)).available).toBe(0);
    await h.payoutService.adminApprove(h.admin, String(payout._id));
    const paid = await h.payoutService.adminMarkPaid(h.admin, String(payout._id), "UTR00012345");
    expect(paid.status).toBe("paid");
    wallet = await h.payoutService.summary(seller);
    expect(wallet).toMatchObject({ available: 0, paidOut: 1900 });

    // Commission report + audit trail
    expect(await h.ledger.commissionSummary()).toMatchObject({ netCommission: 200 });
    const actions = (await h.models.audit.find({}).lean()).map((a: any) => a.action);
    expect(actions).toEqual(expect.arrayContaining([
      "marketplace.vendor.approve", "marketplace.product.approved", "marketplace.order.paid", "marketplace.payout.paid",
    ]));
  });
});
