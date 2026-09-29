import { buildMarketplace, makeUser } from "./testing/harness";

describe("Vendor lifecycle", () => {
  it("one vendor profile per user", async () => {
    const h = buildMarketplace();
    const u = makeUser();
    await h.vendorService.createProfile(u, { storeName: "Radha Store" });
    await expect(h.vendorService.createProfile(u, { storeName: "Second" })).rejects.toThrow(/already have/);
  });

  it("reject needs a reason; rejected vendor can fix and resubmit", async () => {
    const h = buildMarketplace();
    const u = makeUser();
    const v = await h.vendorService.createProfile(u, { storeName: "Radha Store", contactPhone: "9876543210", address: { line1: "x road", city: "Mathura", state: "UP", pincode: "281001" } });
    await h.vendorService.addDocument(u, { type: "identity", fileUrl: "https://f.example.com/1.pdf" });
    await h.vendorService.addDocument(u, { type: "address_proof", fileUrl: "https://f.example.com/2.pdf" });
    await h.vendorService.submitForVerification(u);
    await expect(h.vendorService.adminSetStatus(h.admin, String(v._id), "reject")).rejects.toThrow(/reason/);
    const rejected = await h.vendorService.adminSetStatus(h.admin, String(v._id), "reject", "Blurry ID");
    expect(rejected).toMatchObject({ status: "rejected", rejectionReason: "Blurry ID" });
    await h.vendorService.updateOwnProfile(u, { legalBusinessName: "Radha Traders" }); // allowed while rejected
    expect((await h.vendorService.submitForVerification(u)).status).toBe("pending_verification");
  });

  it("legal details lock after verification; illegal transitions are refused", async () => {
    const h = buildMarketplace();
    const { user, vendor } = await h.activeVendor();
    await expect(h.vendorService.updateOwnProfile(user, { legalBusinessName: "New Legal Name" })).rejects.toThrow(/Legal business details/);
    await expect(h.vendorService.adminSetStatus(h.admin, String(vendor._id), "approve")).rejects.toThrow(/cannot move/);
  });

  it("suspension hides every product and blocks selling; reactivation restores approved listings", async () => {
    const h = buildMarketplace();
    const cat = await h.category();
    const { user, vendor } = await h.activeVendor();
    const p = await h.publishedProduct(user, String(cat._id));
    await h.vendorService.adminSetStatus(h.admin, String(vendor._id), "suspend", "Complaints");
    expect(((await h.models.products.findById(p._id).lean()) as any).status).toBe("suspended");
    expect((await h.productService.publicList({})).total).toBe(0);
    await expect(h.orderService.checkout(makeUser(), { items: [{ productId: String(p._id), quantity: 1 }], address: h.address } as any)).rejects.toThrow(/no longer available/);
    await expect(h.payoutService.request(user, { amount: 100 })).rejects.toThrow(/suspended/);
    await h.vendorService.adminSetStatus(h.admin, String(vendor._id), "reactivate");
    expect((await h.productService.publicList({})).total).toBe(1);
  });

  it("vendor documents: admin verifies or rejects with a note", async () => {
    const h = buildMarketplace();
    const u = makeUser();
    await h.vendorService.createProfile(u, { storeName: "Doc Store" });
    const d = await h.vendorService.addDocument(u, { type: "gst", fileUrl: "https://f.example.com/gst.pdf" });
    await expect(h.vendorService.adminReviewDocument(h.admin, String(d._id), "rejected")).rejects.toThrow(/note/);
    expect((await h.vendorService.adminReviewDocument(h.admin, String(d._id), "verified")).status).toBe("verified");
    await expect(h.vendorService.removeDocument(u, String(d._id))).rejects.toThrow(/already verified/);
  });
});

describe("Product lifecycle", () => {
  it("draft vendor cannot submit; only an ACTIVE store can", async () => {
    const h = buildMarketplace();
    const cat = await h.category();
    const u = makeUser();
    await h.vendorService.createProfile(u, { storeName: "New Store" });
    const p = await h.productService.vendorCreate(u, { name: "Tulsi Mala", categoryId: String(cat._id), price: 250, description: "d", images: ["https://i.example.com/a.jpg"] } as any);
    await expect(h.productService.vendorSubmit(u, String(p._id))).rejects.toThrow(/approved and activated/);
  });

  it("reject -> edit -> resubmit -> approve; material edits after approval go back to review and hide the product", async () => {
    const h = buildMarketplace();
    const cat = await h.category();
    const { user } = await h.activeVendor();
    const p = await h.productService.vendorCreate(user, { name: "Rudraksha", categoryId: String(cat._id), price: 800, description: "5 mukhi", images: ["https://i.example.com/r.jpg"], stock: 4 } as any);
    await h.productService.vendorSubmit(user, String(p._id));
    await expect(h.productService.adminReview(h.admin, String(p._id), "reject")).rejects.toThrow(/reason/);
    await h.productService.adminReview(h.admin, String(p._id), "reject", "Blurry photo");
    await h.productService.vendorUpdate(user, String(p._id), { images: ["https://i.example.com/r2.jpg"] });
    await h.productService.vendorSubmit(user, String(p._id));
    await h.productService.adminReview(h.admin, String(p._id), "approve");
    expect((await h.productService.publicList({})).total).toBe(1);

    // price change: stays live
    await h.productService.vendorUpdate(user, String(p._id), { price: 900 });
    expect((await h.productService.publicList({})).total).toBe(1);
    // name change: back to review, hidden
    const edited = await h.productService.vendorUpdate(user, String(p._id), { name: "Rudraksha 5 Mukhi" });
    expect(edited.approvalStatus).toBe("pending");
    expect((await h.productService.publicList({})).total).toBe(0);
  });

  it("vendor cannot self-publish and cannot re-enable an admin-disabled product", async () => {
    const h = buildMarketplace();
    const cat = await h.category();
    const { user } = await h.activeVendor();
    const draft = await h.productService.vendorCreate(user, { name: "Ganga Jal", categoryId: String(cat._id), price: 99 } as any);
    await h.productService.vendorSetListing(user, String(draft._id), "active");
    expect((await h.productService.publicList({})).total).toBe(0); // active but unapproved = not public
    const p = await h.publishedProduct(user, String(cat._id));
    await h.productService.adminSetDisabled(h.admin, String(p._id), true, "Policy");
    await expect(h.productService.vendorSetListing(user, String(p._id), "active")).rejects.toThrow(/disabled by Tirvona/);
  });

  it("duplicate SKU per vendor is refused; public search, category tree and filters work", async () => {
    const h = buildMarketplace();
    const root = await h.category("Sacred Products");
    const child = await h.categoryService.create(h.admin, { name: "Mala", parentId: String(root._id) });
    const { user } = await h.activeVendor();
    await h.publishedProduct(user, String(child._id), { name: "Tulsi Mala", sku: "MALA-1", price: 300 });
    await expect(h.productService.vendorCreate(user, { name: "Other", categoryId: String(child._id), price: 10, sku: "mala-1" } as any)).rejects.toThrow(/SKU/);
    const tree = await h.categoryService.publicTree();
    expect(tree[0].children[0].name).toBe("Mala");
    expect((await h.productService.publicList({ categoryId: String(root._id) })).total).toBe(1); // includes descendants
    expect((await h.productService.publicList({ search: "tulsi" })).total).toBe(1);
    expect((await h.productService.publicList({ maxPrice: 100 })).total).toBe(0);
    const detail = await h.productService.publicGet("tulsi-mala");
    expect(detail.inventory).toBeUndefined();
  });

  it("category hierarchy refuses cycles", async () => {
    const h = buildMarketplace();
    const a = await h.category("A");
    const b = await h.categoryService.create(h.admin, { name: "B", parentId: String(a._id) });
    await expect(h.categoryService.update(h.admin, String(a._id), { parentId: String(b._id) })).rejects.toThrow(/own ancestor/);
  });
});

describe("Finance", () => {
  it("commission precedence: vendor override > category > global", async () => {
    const h = buildMarketplace();
    await h.settings.update({ defaultCommissionPercent: 10 }, h.admin);
    const root = await h.category("Sacred", 12);
    const child = await h.categoryService.create(h.admin, { name: "Idols", parentId: String(root._id) });
    const { user, vendor } = await h.activeVendor();
    const p = await h.publishedProduct(user, String(child._id), { price: 1000 });
    let q = await h.orderService.quote([{ productId: String(p._id), quantity: 1 }]);
    expect(q.vendorOrders[0].commissionAmount).toBe(120); // inherited from parent category
    await h.vendorService.adminSetCommission(h.admin, String(vendor._id), 5);
    q = await h.orderService.quote([{ productId: String(p._id), quantity: 1 }]);
    expect(q.vendorOrders[0].commissionAmount).toBe(50);
  });

  it("commission is frozen on the order when rates later change", async () => {
    const h = buildMarketplace();
    await h.settings.update({ defaultCommissionPercent: 10 }, h.admin);
    const cat = await h.category();
    const { user } = await h.activeVendor();
    const p = await h.publishedProduct(user, String(cat._id), { price: 1000 });
    await h.paidOrder(makeUser(), [{ productId: String(p._id), quantity: 1 }]);
    await h.settings.update({ defaultCommissionPercent: 30 }, h.admin);
    const [vo]: any[] = await h.models.vendorOrders.find({}).lean();
    expect(vo.commissionAmount).toBe(100);
  });

  it("settlement hold keeps earnings pending until the hold passes", async () => {
    const h = buildMarketplace();
    await h.settings.update({ settlementHoldDays: 7 }, h.admin);
    const cat = await h.category();
    const { user, vendor } = await h.activeVendor();
    const p = await h.publishedProduct(user, String(cat._id), { price: 1000 });
    const { order } = await h.paidOrder(makeUser(), [{ productId: String(p._id), quantity: 1 }]);
    const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
    await h.orderService.vendorUpdateFulfillment(user, String(vo._id), { status: "shipped" });
    await h.orderService.vendorUpdateFulfillment(user, String(vo._id), { status: "delivered" });
    expect((await h.ledger.balance(vendor._id)).available).toBe(0);
    const in8days = new Date(Date.now() + 8 * 86400000);
    expect((await h.ledger.balance(vendor._id, in8days)).available).toBe(1050);
  });

  it("payouts: minimum amount, no double-spend under concurrent requests, failure returns funds", async () => {
    const h = buildMarketplace();
    const { user, vendor } = await h.activeVendor();
    await h.ledger.adjust(h.admin, String(vendor._id), "credit", 500, "Opening balance");
    await expect(h.payoutService.request(user, { amount: 50 })).rejects.toThrow(/Minimum payout/);
    const results = await Promise.allSettled([
      h.payoutService.request(user, { amount: 400 }),
      h.payoutService.request(user, { amount: 400 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await h.payoutService.summary(user)).available).toBe(100);
    const payout: any = (results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>).value;
    await h.payoutService.adminMarkFailed(h.admin, String(payout._id), "Bank rejected");
    expect((await h.payoutService.summary(user)).available).toBe(500);
    await expect(h.payoutService.adminMarkFailed(h.admin, String(payout._id), "again")).rejects.toThrow(/cannot move/);
  });

  it("RazorpayX path: needs a verified bank account, then processing -> paid via provider sync", async () => {
    const h = buildMarketplace();
    h.payoutProvider.isConfigured.mockReturnValue(true);
    const { user, vendor } = await h.activeVendor();
    await h.ledger.adjust(h.admin, String(vendor._id), "credit", 1000, "Opening balance");
    const payout = await h.payoutService.request(user, { amount: 1000 });
    await expect(h.payoutService.adminApprove(h.admin, String(payout._id))).rejects.toThrow(/Verify the vendor's bank account/);
    const [acct]: any[] = await h.models.bankAccounts.find({ vendorId: vendor._id }).lean();
    await h.vendorService.adminVerifyBankAccount(h.admin, String(acct._id), "verified");
    const approved = await h.payoutService.adminApprove(h.admin, String(payout._id));
    expect(approved.status).toBe("processing");
    expect(h.payoutProvider.createFundAccount).toHaveBeenCalledWith("cont_1", expect.objectContaining({ accountNumber: "123456789012", ifsc: "SBIN0001234" }));
    const synced = await h.payoutService.adminSync(h.admin, String(payout._id));
    expect(synced).toMatchObject({ status: "paid", utr: "UTR123456" });
    await expect(h.payoutService.adminMarkPaid(h.admin, String(payout._id), "UTR999999")).rejects.toThrow(/syncing with the provider/);
  });

  it("vendors cannot mint money: ledger entries are only written by server events", async () => {
    const h = buildMarketplace();
    const { vendor } = await h.activeVendor();
    await h.ledger.append([{ vendorId: vendor._id, type: "adjustment_credit", amount: 10, idempotencyKey: "k1", availableAt: new Date() }]);
    await h.ledger.append([{ vendorId: vendor._id, type: "adjustment_credit", amount: 10, idempotencyKey: "k1", availableAt: new Date() }]);
    expect((await h.ledger.balance(vendor._id)).available).toBe(10);
  });
});

describe("Reviews", () => {
  it("only verified, delivered purchases can be reviewed, once", async () => {
    const h = buildMarketplace();
    const cat = await h.category();
    const { user } = await h.activeVendor();
    const p = await h.publishedProduct(user, String(cat._id));
    const buyer = makeUser();
    const { order } = await h.paidOrder(buyer, [{ productId: String(p._id), quantity: 1 }]);
    const [vo]: any[] = await h.models.vendorOrders.find({ masterOrderId: order._id }).lean();
    const dto = { vendorOrderId: String(vo._id), productId: String(p._id), rating: 5, comment: "Divine" };
    await expect(h.reviewService.create(buyer, dto)).rejects.toThrow(/after it has been delivered/);
    await h.orderService.vendorUpdateFulfillment(user, String(vo._id), { status: "shipped" });
    await h.orderService.vendorUpdateFulfillment(user, String(vo._id), { status: "delivered" });
    await expect(h.reviewService.create(makeUser(), dto)).rejects.toThrow(/after it has been delivered/);
    await h.reviewService.create(buyer, dto);
    await expect(h.reviewService.create(buyer, dto)).rejects.toThrow(/already reviewed/);
    expect(await h.models.products.findById(p._id).lean()).toMatchObject({ rating: 5, reviewCount: 1 });
  });
});
