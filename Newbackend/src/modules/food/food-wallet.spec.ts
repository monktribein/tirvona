import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { FoodVendorService } from "./application/food-vendor.service";
import { FoodWalletService } from "./application/food-wallet.service";
import { earningOf } from "./domain/food-wallet";
import { RecordFoodPaymentDto } from "./presentation/food-wallet.dto";
import { fakeModel } from "./testing/fake-model";

const RECEIPT = "https://res.cloudinary.com/demo/image/upload/v1/tirvona/food-receipts/utr-1.jpg";
const admin = { id: "user_admin", name: "Super Admin" };

describe("Kitchen wallet: what Tirvona owes a kitchen and what it has paid", () => {
  let vendors: ReturnType<typeof fakeModel>;
  let outlets: ReturnType<typeof fakeModel>;
  let orders: ReturnType<typeof fakeModel>;
  let ledger: ReturnType<typeof fakeModel>;
  let settlements: ReturnType<typeof fakeModel>;
  let payments: ReturnType<typeof fakeModel>;
  let service: FoodWalletService;

  const order = (id: string, outletId: string, subtotalPaise: number, extra: Record<string, unknown> = {}) => ({
    _id: id,
    orderNumber: `TF-${id}`,
    outletId,
    subtotalPaise,
    orderStatus: "DELIVERED",
    paymentStatus: "PAID",
    deliveredAt: new Date("2026-10-10T10:00:00Z"),
    createdAt: new Date("2026-10-10T08:00:00Z"),
    ...extra,
  });

  beforeEach(() => {
    vendors = fakeModel([
      { _id: "v1", businessName: "Radha Rasoi", ownerUserId: "user_owner", status: "active" },
      { _id: "v2", businessName: "Brij Foods", ownerUserId: "user_other", status: "active" },
      { _id: "v3", businessName: "Quiet Kitchen", ownerUserId: "user_quiet", status: "active" },
    ]);
    outlets = fakeModel([
      { _id: "o1", vendorId: "v1", brandName: "Radha Main", commissionRateBps: 1250 },
      { _id: "o2", vendorId: "v1", brandName: "Radha Express", commissionRateBps: 1000 },
      { _id: "o3", vendorId: "v2", brandName: "Brij Kitchen", commissionRateBps: 1250 },
    ]);
    orders = fakeModel();
    ledger = fakeModel();
    settlements = fakeModel();
    payments = fakeModel();
    service = new FoodWalletService(
      vendors as any,
      outlets as any,
      orders as any,
      ledger as any,
      settlements as any,
      payments as any,
    );
  });

  const addOrders = (...rows: ReturnType<typeof order>[]) => {
    for (const row of rows) orders.rows.push(row);
  };

  describe("what the kitchen has earned", () => {
    it("counts only paid orders that were handed over, after commission and GST on commission", async () => {
      addOrders(
        order("A", "o1", 20000), // delivered
        order("B", "o1", 10000, { orderStatus: "COMPLETED" }),
        order("C", "o2", 30000, { orderStatus: "PICKED_UP" }), // this outlet's rate is 10%
        order("D", "o1", 99999, { orderStatus: "ACCEPTED" }), // still cooking
        order("E", "o1", 88888, { orderStatus: "REFUNDED", paymentStatus: "REFUNDED" }),
        order("F", "o1", 77777, { paymentStatus: "PENDING" }), // not paid
        order("G", "o3", 66666), // another kitchen
        order("H", "o1", 55555, { orderStatus: "CANCELLED", paymentStatus: "REFUNDED" }),
      );

      const { summary } = await service.walletForOwner("user_owner");

      expect(summary.deliveredOrders).toBe(3);
      expect(summary.foodValuePaise).toBe(60000);
      // 12.5% of 20000 and 10000, 10% of 30000
      expect(summary.commissionPaise).toBe(2500 + 1250 + 3000);
      // 18% of each order's commission
      expect(summary.gstOnCommissionPaise).toBe(450 + 225 + 540);
      expect(summary.earnedPaise).toBe(17050 + 8525 + 26460);
      expect(summary.receivedPaise).toBe(0);
      expect(summary.remainingPaise).toBe(52035);
      expect(summary.lastPayment).toBeNull();
    });

    it("rounds the way settlements do", () => {
      // 12.5% of ₹249 is 3112.5 paise, which rounds up; GST on 3113 is 560.34
      expect(earningOf(24900, undefined, 1250)).toEqual({
        foodValuePaise: 24900,
        commissionPaise: 3113,
        gstOnCommissionPaise: 560,
        netPaise: 21227,
      });
    });

    it("keeps the commission that was booked when the customer paid, even if the outlet's rate changed since", async () => {
      addOrders(order("A", "o1", 20000));
      // At payment time the kitchen was on 10% (vendor share 18000); the outlet is on 12.5% now.
      ledger.rows.push({ _id: "l1", orderId: "A", entryType: "vendor_credit", creditPaise: 18000 });

      const { summary } = await service.walletForOwner("user_owner");

      expect(summary.commissionPaise).toBe(2000);
      expect(summary.gstOnCommissionPaise).toBe(360);
      expect(summary.earnedPaise).toBe(20000 - 2000 - 360);
    });

    it("a delivered order that is later refunded stops counting on its own", async () => {
      addOrders(order("A", "o1", 20000), order("B", "o1", 10000));
      expect((await service.walletForOwner("user_owner")).summary.deliveredOrders).toBe(2);

      Object.assign(orders.rows[0], { orderStatus: "REFUNDED", paymentStatus: "REFUNDED" });

      const { summary } = await service.walletForOwner("user_owner");
      expect(summary.deliveredOrders).toBe(1);
      expect(summary.earnedPaise).toBe(8525);
    });

    it("lists the delivered orders newest first, a page at a time", async () => {
      addOrders(
        order("A", "o1", 10000, { deliveredAt: new Date("2026-10-01T10:00:00Z") }),
        order("B", "o1", 10000, { deliveredAt: new Date("2026-10-03T10:00:00Z") }),
        // pickup orders never get a delivered time: the last update stands in
        order("C", "o1", 10000, { orderStatus: "PICKED_UP", deliveredAt: undefined, updatedAt: new Date("2026-10-02T10:00:00Z") }),
      );

      const first = await service.earningsForOwner("user_owner", 1, 2);
      expect(first.total).toBe(3);
      expect(first.data.map((r) => r.orderNumber)).toEqual(["TF-B", "TF-C"]);
      expect(first.data[0]).toMatchObject({ outletName: "Radha Main", foodValuePaise: 10000, netPaise: 8525 });

      const second = await service.earningsForOwner("user_owner", 2, 2);
      expect(second.data.map((r) => r.orderNumber)).toEqual(["TF-A"]);
    });
  });

  describe("recording a payment", () => {
    beforeEach(() => addOrders(order("A", "o1", 20000))); // owed: 17050

    it("a bank transfer with its receipt reduces what is owed", async () => {
      const res = await service.recordPayment(admin, "v1", {
        amountPaise: 10000,
        method: "bank_transfer",
        reference: "UTR123456",
        receiptUrl: RECEIPT,
        note: "First instalment",
      });

      expect(res.summary.receivedPaise).toBe(10000);
      expect(res.summary.remainingPaise).toBe(7050);
      expect(res.summary.lastPayment).toMatchObject({ amountPaise: 10000, method: "bank_transfer" });
      expect(res.payments).toHaveLength(1);
      expect(res.payments[0]).toMatchObject({
        status: "recorded",
        method: "bank_transfer",
        reference: "UTR123456",
        receiptUrl: RECEIPT,
        recordedByName: "Super Admin",
      });
      expect(res.payments[0].paymentNumber).toMatch(/^FWP-\d{8}-[0-9A-F]{6}$/);
    });

    it("UPI needs the receipt too, but cash does not", async () => {
      await expect(
        service.recordPayment(admin, "v1", { amountPaise: 5000, method: "upi" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.recordPayment(admin, "v1", { amountPaise: 5000, method: "bank_transfer", receiptUrl: undefined }),
      ).rejects.toThrow(/receipt/i);
      expect(payments.rows).toHaveLength(0);

      const cash = await service.recordPayment(admin, "v1", { amountPaise: 5000, method: "cash" });
      expect(cash.payments[0]).toMatchObject({ method: "cash", receiptUrl: null });
      expect(cash.summary.remainingPaise).toBe(12050);
    });

    it("never keeps a receipt on a cash payment", async () => {
      const res = await service.recordPayment(admin, "v1", { amountPaise: 5000, method: "cash", receiptUrl: RECEIPT });
      expect(res.payments[0].receiptUrl).toBeNull();
      expect(payments.rows[0].receiptUrl).toBeUndefined();
    });

    it("accepts more than is owed and shows the surplus as an advance", async () => {
      const res = await service.recordPayment(admin, "v1", { amountPaise: 20000, method: "cash" });
      expect(res.summary.remainingPaise).toBe(17050 - 20000);
      expect(res.summary.remainingPaise).toBeLessThan(0);
    });

    it("refuses a date in the future and one that is not a date", async () => {
      const tomorrow = new Date(Date.now() + 24 * 3_600_000).toISOString();
      await expect(
        service.recordPayment(admin, "v1", { amountPaise: 5000, method: "cash", paidAt: tomorrow }),
      ).rejects.toThrow(/future/);
      await expect(
        service.recordPayment(admin, "v1", { amountPaise: 5000, method: "cash", paidAt: "not-a-date" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(payments.rows).toHaveLength(0);
    });

    it("can be dated in the past", async () => {
      const res = await service.recordPayment(admin, "v1", {
        amountPaise: 5000,
        method: "cash",
        paidAt: "2026-10-01T00:00:00.000Z",
      });
      expect(new Date(res.payments[0].paidAt).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    });

    it("an unknown restaurant is not found", async () => {
      await expect(
        service.recordPayment(admin, "nope", { amountPaise: 5000, method: "cash" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("a retried request records one payment, not two", async () => {
      const dto = { amountPaise: 5000, method: "cash" as const, idempotencyKey: "form-key-0001" };
      const first = await service.recordPayment(admin, "v1", dto);
      const again = await service.recordPayment(admin, "v1", dto);

      expect(payments.rows).toHaveLength(1);
      expect(again.paymentId).toBe(first.paymentId);
      expect(again.summary.receivedPaise).toBe(5000);
    });

    it("the same request id cannot be reused for another restaurant", async () => {
      await service.recordPayment(admin, "v1", { amountPaise: 5000, method: "cash", idempotencyKey: "form-key-0001" });
      await expect(
        service.recordPayment(admin, "v2", { amountPaise: 5000, method: "cash", idempotencyKey: "form-key-0001" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("two identical requests arriving together still record one payment", async () => {
      const dto = { amountPaise: 5000, method: "cash" as const, idempotencyKey: "form-key-0002" };
      const winner = await service.recordPayment(admin, "v1", dto);

      // The loser got past the first check before the winner saved, then hit the unique key.
      const lookup = payments.findOne;
      jest.spyOn(payments, "findOne").mockImplementationOnce(
        () => ({ then: (res: any, rej?: any) => Promise.resolve(null).then(res, rej) }) as any,
      );
      jest.spyOn(payments, "create").mockRejectedValueOnce(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
      (payments as any).findOne = lookup.bind(payments); // later lookups behave normally

      const loser = await service.recordPayment(admin, "v1", dto);
      expect(loser.paymentId).toBe(winner.paymentId);
      expect(payments.rows).toHaveLength(1);
    });
  });

  describe("voiding a wrongly entered payment", () => {
    let paymentId: string;

    beforeEach(async () => {
      addOrders(order("A", "o1", 20000));
      paymentId = (await service.recordPayment(admin, "v1", { amountPaise: 10000, method: "cash" })).paymentId;
    });

    it("restores what is owed but keeps the entry in the history", async () => {
      const res = await service.voidPayment(admin, paymentId, "Entered twice by mistake");

      expect(res.summary.receivedPaise).toBe(0);
      expect(res.summary.remainingPaise).toBe(17050);
      expect(res.summary.lastPayment).toBeNull();
      expect(res.payments).toHaveLength(1);
      expect(res.payments[0]).toMatchObject({ status: "voided", voidReason: "Entered twice by mistake" });
      expect(payments.rows[0]).toMatchObject({ status: "voided", voidedBy: "user_admin" });
    });

    it("can only be voided once", async () => {
      await service.voidPayment(admin, paymentId, "Entered twice by mistake");
      await expect(service.voidPayment(admin, paymentId, "again")).rejects.toThrow(/already voided/);
    });

    it("an unknown payment is not found", async () => {
      await expect(service.voidPayment(admin, "nope", "reason")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("payments made through settlements", () => {
    it("a paid settlement counts as money received; one still waiting does not", async () => {
      addOrders(order("A", "o1", 20000));
      settlements.rows.push(
        { _id: "s1", vendorId: "v1", status: "paid", netPayablePaise: 6000, payoutReference: "UTR:999", paidAt: new Date("2026-10-12T10:00:00Z"), periodStart: new Date("2026-10-01"), periodEnd: new Date("2026-10-07") },
        { _id: "s2", vendorId: "v1", status: "approved", netPayablePaise: 4000 },
        { _id: "s3", vendorId: "v2", status: "paid", netPayablePaise: 9000 },
      );

      const { summary, payments: list } = await service.walletForOwner("user_owner");

      expect(summary.receivedPaise).toBe(6000);
      expect(summary.remainingPaise).toBe(17050 - 6000);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ source: "settlement", amountPaise: 6000, method: "bank_transfer", reference: "UTR:999", receiptUrl: null });
    });
  });

  describe("who sees what", () => {
    beforeEach(async () => {
      addOrders(order("A", "o1", 20000), order("B", "o3", 10000));
      await service.recordPayment(admin, "v1", { amountPaise: 1000, method: "cash" });
      await service.recordPayment(admin, "v2", { amountPaise: 2000, method: "cash" });
    });

    it("an owner sees only their own restaurant's wallet", async () => {
      const mine = await service.walletForOwner("user_owner");
      expect(mine.summary).toMatchObject({ vendorId: "v1", businessName: "Radha Rasoi", receivedPaise: 1000 });
      expect(mine.payments).toHaveLength(1);

      const theirs = await service.walletForOwner("user_other");
      expect(theirs.summary).toMatchObject({ vendorId: "v2", receivedPaise: 2000 });
    });

    it("someone with no restaurant has no wallet", async () => {
      await expect(service.walletForOwner("user_nobody")).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.earningsForOwner("user_nobody")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("who entered a payment is for Tirvona only, not for the kitchen", async () => {
      expect((await service.walletForOwner("user_owner")).payments[0]).not.toHaveProperty("recordedByName");
      expect((await service.walletForAdmin("v1")).payments[0].recordedByName).toBe("Super Admin");
    });

    it("never sends bank account details out, only whether they exist", async () => {
      Object.assign(vendors.rows[0], { bankAccountNumber: "enc:secret", bankIfscCode: "SBIN0001234", bankAccountHolderName: "Radha" });
      const { summary } = await service.walletForOwner("user_owner");
      expect(summary.hasBankDetails).toBe(true);
      expect(JSON.stringify(summary)).not.toContain("secret");
      expect(JSON.stringify(summary)).not.toContain("SBIN");
    });
  });

  describe("overview for Tirvona", () => {
    it("lists who is owed the most first, and leaves out kitchens with no activity", async () => {
      addOrders(order("A", "o1", 20000), order("B", "o3", 100000));

      const { rows, totals } = await service.overview();

      expect(rows.map((r) => r.businessName)).toEqual(["Brij Foods", "Radha Rasoi"]);
      expect(rows[0].remainingPaise).toBe(100000 - 12500 - 2250);
      expect(totals).toEqual({
        restaurants: 2,
        owedPaise: 85250 + 17050,
        advancePaise: 0,
        receivedPaise: 0,
      });
    });

    it("counts an overpaid kitchen as an advance, not as money owed", async () => {
      addOrders(order("A", "o1", 20000));
      await service.recordPayment(admin, "v1", { amountPaise: 20000, method: "cash" });

      const { rows, totals } = await service.overview();

      expect(rows[0].remainingPaise).toBe(-2950);
      expect(totals).toMatchObject({ owedPaise: 0, advancePaise: 2950, receivedPaise: 20000 });
    });
  });
});

describe("RecordFoodPaymentDto", () => {
  const check = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(RecordFoodPaymentDto, body))).map((e) => e.property);

  it("accepts a normal bank transfer and a cash payment", async () => {
    expect(await check({ amountPaise: 25000, method: "bank_transfer", receiptUrl: RECEIPT, reference: "UTR1" })).toEqual([]);
    expect(await check({ amountPaise: 25000, method: "cash" })).toEqual([]);
  });

  it("only takes https receipts, because the kitchen is shown them as a link", async () => {
    expect(await check({ amountPaise: 25000, method: "upi", receiptUrl: "http://example.com/r.jpg" })).toEqual(["receiptUrl"]);
    expect(await check({ amountPaise: 25000, method: "upi", receiptUrl: "javascript:alert(1)" })).toEqual(["receiptUrl"]);
  });

  it("treats empty fields as not given", async () => {
    expect(await check({ amountPaise: 25000, method: "cash", receiptUrl: "", reference: "  ", note: "" })).toEqual([]);
  });

  it("rejects an unknown method and amounts outside ₹1 to ₹10,00,000", async () => {
    expect(await check({ amountPaise: 25000, method: "cheque" })).toEqual(["method"]);
    expect(await check({ amountPaise: 50, method: "cash" })).toEqual(["amountPaise"]);
    expect(await check({ amountPaise: 100_000_001, method: "cash" })).toEqual(["amountPaise"]);
    expect(await check({ amountPaise: 99.5, method: "cash" })).toEqual(["amountPaise"]);
  });
});

describe("Restaurant dashboard figures", () => {
  it("count every order the kitchen handed over, not only the ones marked COMPLETED", async () => {
    const vendors = fakeModel([{ _id: "v1", ownerUserId: "user_owner" }]);
    const outlets = fakeModel([{ _id: "o1", vendorId: "v1", brandName: "Radha Main", commissionRateBps: 1250 }]);
    const orders = fakeModel([
      { _id: "a", outletId: "o1", orderStatus: "DELIVERED", paymentStatus: "PAID", subtotalPaise: 20000 },
      { _id: "b", outletId: "o1", orderStatus: "PICKED_UP", paymentStatus: "PAID", subtotalPaise: 10000 },
      { _id: "c", outletId: "o1", orderStatus: "COMPLETED", paymentStatus: "PAID", subtotalPaise: 5000 },
      { _id: "d", outletId: "o1", orderStatus: "PREPARING", paymentStatus: "PAID", subtotalPaise: 99999 },
      { _id: "e", outletId: "o1", orderStatus: "DELIVERED", paymentStatus: "REFUNDED", subtotalPaise: 88888 },
    ]);
    const service = new FoodVendorService(vendors as any, outlets as any, fakeModel() as any, orders as any);

    const stats = await service.getVendorDashboardStats("user_owner");

    expect(stats.completedCount).toBe(3);
    expect(stats.totalSalesPaise).toBe(35000);
    expect(stats.preparingCount).toBe(1);
  });
});
