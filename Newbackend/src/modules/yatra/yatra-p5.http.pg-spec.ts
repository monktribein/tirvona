/// <reference types="jest" />
/**
 * Tirvona Yatra P5 end to end on a real Postgres 17: ride partners and rides, commission rules and the
 * payee ledger, manual payouts, Razorpay settlement reconciliation, Destination Ops city scope,
 * background jobs and the central-inventory race. Run with `npm run test:pg`.
 */
import { bookAndPay, createYatraTestApp, demoPay, openDeparture, seedOrganiser, type TestUser, type YatraTestApp } from "./testing/yatra-test-app";
import { YatraMaintenanceService } from "./application/yatra-insights.service";
import { YatraWebhookService } from "./application/yatra-insights.service";

const HOUR = 3_600_000;
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** Razorpay as seen by reconciliation, keyed by payment id. */
const gatewayView = new Map<string, { status: string; amount: number }>();
const fakeRecon = {
  configured: () => true,
  fetchPayment: async (id: string) => gatewayView.get(id) ?? null,
  settledPayments: async () => [...gatewayView.entries()].filter(([, v]) => v.status === "captured").slice(0, 1).map(([paymentId, v]) => ({ paymentId, amount: v.amount, settlementId: "setl_1" })),
};

describe("Tirvona Yatra P5 (real Postgres)", () => {
  let ctx: YatraTestApp;
  let admin: TestUser, finance: TestUser, support: TestUser, ownerA: TestUser, ownerB: TestUser, pilgrim: TestUser, pilgrim2: TestUser;
  let partner: TestUser, partner2: TestUser, hrVrindavan: TestUser, hrHaridwar: TestUser, foodOwner: TestUser;
  const s: Record<string, any> = {};
  const wallet = async (u: TestUser) => Number((await ctx.model("PilgrimWallet").findOne({ userId: u.id }).lean())?.balance ?? 0);

  beforeAll(async () => {
    ctx = await createYatraTestApp({ recon: fakeRecon });
    admin = await ctx.newUser("super_admin", "Super Admin");
    finance = await ctx.newUser("finance_manager", "Finance Fiona");
    support = await ctx.newUser("support", "Support Sam");
    ownerA = await ctx.newUser("customer", "Owner A");
    ownerB = await ctx.newUser("customer", "Owner B");
    pilgrim = await ctx.newUser("customer", "Radha Devi");
    pilgrim2 = await ctx.newUser("customer", "Gopal Das");
    partner = await ctx.newUser("customer", "Krishna Cabs Owner");
    partner2 = await ctx.newUser("customer", "Other Cabs Owner");
    hrVrindavan = await ctx.newUser("hr", "HR Vrindavan");
    hrHaridwar = await ctx.newUser("hr", "HR Haridwar");
    foodOwner = await ctx.newUser("customer", "Kitchen Owner");
    s.vendor = await ctx.model("YatraFoodVendorRef").create({ businessName: "Brij Bhojanalaya", ownerUserId: foodOwner.id, status: "active" });
    // HR offices drive the Destination Ops city scope (same lookup as Leads / Food / Pandits).
    for (const [user, city] of [[hrVrindavan, "Vrindavan"], [hrHaridwar, "Haridwar"]] as const) {
      const office = await ctx.model("HrOffice").create({ code: `OFF-${city}`, name: `${city} office`, nameKey: `${city.toLowerCase()} office`, city, active: true });
      await ctx.model("HrEmployee").create({ userId: user.id, fullName: user.name, status: "active", primaryOfficeId: office._id, employeeCode: `EMP-${city}` });
    }
  });

  afterAll(async () => {
    await ctx?.close();
  });

  // ============================================================ commission rules
  describe("commission rules", () => {
    it("are created and versioned only by Finance, never hard-coded", async () => {
      await ctx.post("/v1/yatra/finance/rules", support, { appliesTo: "yatra_booking", commissionBps: 1000 }).expect(403);
      await ctx.post("/v1/yatra/finance/rules", ownerA, { appliesTo: "yatra_booking", commissionBps: 1000 }).expect(403);
      const v1 = await ctx.post("/v1/yatra/finance/rules", finance, { name: "Marketplace", appliesTo: "yatra_booking", channel: "any", commissionBps: 1000, taxOnCommissionBps: 1800, tdsBps: 10 }).expect(201);
      expect(v1.body.data).toMatchObject({ version: 1, status: "active", commissionBps: 1000 });
      s.ruleV1 = v1.body.data;
      await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "ride", commissionBps: 1500, taxOnCommissionBps: 1800 }).expect(201);
      await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "addon_referral", commissionBps: 500 }).expect(201);
      await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "yatra_booking", commissionBps: 20000 }).expect(400);
    });
  });

  // ========================================================= payee ledger & refunds
  describe("organiser earnings and the payee ledger", () => {
    it("keeps the commission rule that applied when the booking was created", async () => {
      s.a = await seedOrganiser(ctx, admin, ownerA, { name: "Shyam Travels", destination: "Vrindavan", seats: 20 });
      // Seats held under v1 ...
      const held = await ctx.post("/v1/yatra/bookings", pilgrim, { departureCode: s.a.code, boardingPointId: s.a.boardingPointId, seats: ["1", "2"], passengers: [{ name: "Asha" }, { name: "Bina" }], contact: { name: "Radha", phone: "9876543210" } }).expect(201);
      // ... then Finance changes the rate to 12% (v2) before the pilgrim pays.
      const v2 = await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "yatra_booking", channel: "any", commissionBps: 1200, taxOnCommissionBps: 1800, tdsBps: 10 }).expect(201);
      expect(v2.body.data.version).toBe(2);
      const rules = await ctx.get("/v1/yatra/finance/rules?appliesTo=yatra_booking", finance).expect(200);
      expect(rules.body.data.filter((r: any) => r.status === "active")).toHaveLength(1);
      const order = await ctx.post(`/v1/yatra/bookings/${held.body.data.id}/payment-order`, pilgrim).expect(201);
      const paid = await ctx.post(`/v1/yatra/bookings/${held.body.data.id}/confirm-payment`, pilgrim, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      s.booking1 = held.body.data.id;
      s.journey1 = paid.body.data.journeyId;
      const entries = await ctx.rows("SELECT entry_type, amount FROM public.yatra_payee_entries WHERE booking_id = $1 ORDER BY entry_type", [s.booking1]);
      // ₹3,000 at v1: 10% commission, 18% GST on it, 0.1% TDS.
      expect(entries).toEqual([
        { entry_type: "commission", amount: 300 },
        { entry_type: "gross_earning", amount: 3000 },
        { entry_type: "tax_on_commission", amount: 54 },
        { entry_type: "tds", amount: 3 },
      ]);
    });

    it("holds earnings as pending until the journey ends, then makes them payable", async () => {
      const before = await ctx.get("/v1/yatra/operator/earnings", ownerA).expect(200);
      expect(before.body.summary).toMatchObject({ available: 0, pending: 2643, requestable: 0 });
      await ctx.rows("UPDATE public.yatra_payee_entries SET eligible_at = now() - interval '1 hour' WHERE booking_id = $1", [s.booking1]);
      const after = await ctx.get("/v1/yatra/operator/earnings", ownerA).expect(200);
      expect(after.body.summary).toMatchObject({ grossEarnings: 3000, commission: 300, taxOnCommission: 54, tds: 3, available: 2643, pending: 0, requestable: 2643 });
    });

    it("reverses commission and taxes in proportion when a booking is refunded", async () => {
      const b = await bookAndPay(ctx, pilgrim2, s.a, ["5"]);
      await ctx.post(`/v1/yatra/bookings/${b.bookingId}/cancel-request`, pilgrim2, { reason: "Change of plan" }).expect(201);
      await ctx.post(`/v1/yatra/admin/bookings/${b.bookingId}/cancellation`, admin, { decision: "approve" }).expect(201);
      const rows = await ctx.rows("SELECT entry_type, direction, amount FROM public.yatra_payee_entries WHERE booking_id = $1 ORDER BY entry_type", [b.bookingId]);
      const byType = Object.fromEntries(rows.map((r: any) => [r.entry_type, Number(r.amount)]));
      // ₹1,500 at v2 (12%): commission 180, GST 32.40, TDS 1.50; 90% refunded.
      expect(byType).toMatchObject({ gross_earning: 1500, commission: 180, tax_on_commission: 32.4, tds: 1.5, refund_deduction: 1350, commission_reversal: 162, tax_reversal: 29.16, tds_reversal: 1.35 });
      const net = 1500 - 180 - 32.4 - 1.5 - 1350 + 162 + 29.16 + 1.35;
      expect(Math.round(net * 100) / 100).toBe(128.61);
    });
  });

  // =========================================================== manual payouts
  describe("manual organiser payouts", () => {
    it("lets an organiser request up to its payable balance, once at a time", async () => {
      await ctx.post("/v1/yatra/operator/payouts", ownerA, { amount: 99999 }).expect(400);
      const req = await ctx.post("/v1/yatra/operator/payouts", ownerA, { amount: 2000, note: "November" }).expect(201);
      expect(req.body.data).toMatchObject({ status: "pending", amount: 2000, bank: { accountNumberLast4: "9012" } });
      s.payout1 = req.body.data.id;
      const dup = await ctx.post("/v1/yatra/operator/payouts", ownerA, { amount: 100 }).expect(409);
      expect(dup.body.code).toBe("PAYOUT_ALREADY_OPEN");
      const list = await ctx.get("/v1/yatra/operator/payouts", ownerA).expect(200);
      expect(list.body.data.items).toHaveLength(1);
    });

    it("keeps payouts private to their organiser and Finance", async () => {
      s.b = await seedOrganiser(ctx, admin, ownerB, { name: "Radhe Tours", destination: "Haridwar", seats: 12 });
      await ctx.post(`/v1/yatra/operator/payouts/${s.payout1}/cancel`, ownerB).expect(404);
      await ctx.get(`/v1/yatra/operator/payouts/${s.payout1}/proof`, ownerB).expect(404);
      expect((await ctx.get("/v1/yatra/operator/payouts", ownerB).expect(200)).body.data.items).toHaveLength(0);
      await ctx.get("/v1/yatra/finance/payouts", support).expect(403);
      await ctx.get("/v1/yatra/finance/payouts", ownerA).expect(403);
    });

    it("moves through review, approval and a recorded transfer — never automatically", async () => {
      await ctx.post(`/v1/yatra/finance/payouts/${s.payout1}/review`, finance, { action: "start_review" }).expect(201);
      await ctx.upload(`/v1/yatra/finance/payouts/${s.payout1}/transfer`, finance, { method: "neft", transferDate: new Date().toISOString(), reference: "UTR12345678", amount: "2000" }, "proof").expect(409);
      await ctx.post(`/v1/yatra/finance/payouts/${s.payout1}/review`, finance, { action: "approve" }).expect(201);
      await ctx.upload(`/v1/yatra/finance/payouts/${s.payout1}/transfer`, ownerA, { method: "neft", transferDate: new Date().toISOString(), reference: "UTR12345678", amount: "2000" }, "proof").expect(403);
      await ctx.upload(`/v1/yatra/finance/payouts/${s.payout1}/transfer`, finance, { method: "neft", transferDate: new Date().toISOString(), reference: "UTR12345678", amount: "1999" }, "proof").expect(400);
      const done = await ctx.upload(`/v1/yatra/finance/payouts/${s.payout1}/transfer`, finance, { method: "neft", transferDate: new Date().toISOString(), reference: "UTR12345678", amount: "2000", note: "SBI NEFT" }, "proof").expect(201);
      expect(done.body.data).toMatchObject({ status: "transfer_recorded", transfer: { reference: "UTR12345678", amount: 2000, hasProof: true } });
      await ctx.upload(`/v1/yatra/finance/payouts/${s.payout1}/transfer`, finance, { method: "neft", transferDate: new Date().toISOString(), reference: "UTR12345678", amount: "2000" }, "proof").expect(409);
      const proof = await ctx.get(`/v1/yatra/operator/payouts/${s.payout1}/proof`, ownerA).expect(200);
      expect(proof.body.data.url).toMatch(/^https:\/\/signed\.example\.test\/yatra-payouts\//);
      const summary = (await ctx.get("/v1/yatra/operator/earnings", ownerA).expect(200)).body.summary;
      expect(summary).toMatchObject({ transfers: 2000, available: 643, requestable: 643 });
      const transfers = await ctx.rows("SELECT count(*)::int AS n FROM public.yatra_payee_entries WHERE payout_id = $1", [s.payout1]);
      expect(transfers[0].n).toBe(1);
    });

    it("refuses a bank reference already used on another payout", async () => {
      const p2 = await ctx.post("/v1/yatra/finance/payouts", finance, { payeeType: "operator", payeeId: s.a.operatorId, amount: 100 }).expect(201);
      await ctx.post(`/v1/yatra/finance/payouts/${p2.body.data.id}/review`, finance, { action: "approve" }).expect(201);
      const dupe = await ctx.upload(`/v1/yatra/finance/payouts/${p2.body.data.id}/transfer`, finance, { method: "imps", transferDate: new Date().toISOString(), reference: "utr12345678", amount: "100" }, "proof").expect(409);
      expect(dupe.body.code).toBe("DUPLICATE_UTR");
      await ctx.post(`/v1/yatra/finance/payouts/${p2.body.data.id}/review`, finance, { action: "reject", note: "Wrong reference, redo next cycle" }).expect(201);
    });

    it("reconciles a transfer against the bank statement, recording any difference", async () => {
      const diff = await ctx.post(`/v1/yatra/finance/payouts/${s.payout1}/reconcile`, finance, { bankAmount: 1990 }).expect(400);
      expect(diff.body.code).toBe("RECONCILIATION_DIFFERENCE");
      const ok = await ctx.post(`/v1/yatra/finance/payouts/${s.payout1}/reconcile`, finance, { bankAmount: 2000 }).expect(201);
      expect(ok.body.data).toMatchObject({ status: "reconciled", reconciliation: { difference: 0 } });
      const dash = await ctx.get("/v1/yatra/finance/dashboard", finance).expect(200);
      expect(dash.body.data.transfers.completed).toBe(2000);
      expect(dash.body.data.tirvona.commission).toBeGreaterThan(0);
      expect(dash.body.data.collections.total).toBeGreaterThan(dash.body.data.tirvona.commission);
    });
  });

  // ============================================================== ride partners
  describe("ride partners", () => {
    it("onboard with KYC, vehicles and service areas, and need Super Admin approval", async () => {
      await ctx.post("/v1/yatra/ride-partner/register", partner, { businessName: "Krishna Cabs", city: "Vrindavan", contactPhone: "9876511111", serviceAreas: ["Vrindavan", "Mathura"] }).expect(201);
      await ctx.put("/v1/yatra/ride-partner/vehicles", partner, { vehicles: [{ registrationNumber: "UP85 CB 1001", vehicleType: "suv", seats: 6, isAc: true }, { registrationNumber: "UP85 CB 2002", vehicleType: "tempo_traveller", seats: 12 }] }).expect(200);
      await ctx.patch("/v1/yatra/ride-partner/profile", partner, { panNumber: "ABCDE1234F", drivingLicenceNumber: "UP8520200001", availability: { weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "05:00", endTime: "23:00", accepting: true } }).expect(200);
      const early = await ctx.post("/v1/yatra/ride-partner/submit", partner, { acceptTerms: true }).expect(400);
      expect(early.body.message).toMatch(/PAN card/);
      for (const documentType of ["pan_card", "driving_licence", "registration_certificate", "insurance"]) await ctx.upload("/v1/yatra/ride-partner/documents", partner, { documentType }).expect(201);
      await ctx.put("/v1/yatra/ride-partner/payout", partner, { accountHolderName: "Krishna Cabs", upiId: "krishna@upi" }).expect(200);
      await ctx.post("/v1/yatra/ride-partner/submit", partner, { acceptTerms: true }).expect(201);
      // The organiser KYC queue and its overview count are not disturbed by ride partner documents.
      const pendingBefore = (await ctx.get("/v1/yatra/admin/overview", admin).expect(200)).body.data.documentsPending;
      const queue = await ctx.get("/v1/yatra/admin/documents?status=pending&page=1&limit=50", admin).expect(200);
      expect(queue.body.data.every((d: any) => d.operatorName)).toBe(true);
      const list = await ctx.get("/v1/yatra/admin/ride-partners?status=submitted", admin).expect(200);
      s.partnerId = list.body.data[0].id;
      const partnerDocs = (await ctx.get(`/v1/yatra/admin/ride-partners/${s.partnerId}`, admin).expect(200)).body.data.documents;
      expect(partnerDocs).toHaveLength(4);
      await ctx.post(`/v1/yatra/admin/documents/${partnerDocs[0].id}/review`, admin, { decision: "approve" }).expect(404);
      await ctx.post(`/v1/yatra/admin/ride-partners/${s.partnerId}/review`, finance, { action: "approve" }).expect(403);
      await ctx.post(`/v1/yatra/admin/ride-partners/${s.partnerId}/review`, admin, { action: "approve" }).expect(201);
      // Approval verifies the documents the partner submitted.
      const mine = await ctx.get("/v1/yatra/ride-partner/documents", partner).expect(200);
      expect(mine.body.data.map((d: any) => d.status)).toEqual(["approved", "approved", "approved", "approved"]);
      expect((await ctx.get("/v1/yatra/admin/overview", admin).expect(200)).body.data.documentsPending).toBe(pendingBefore);
      // A partner that is not approved never appears and cannot be assigned.
      const other = await ctx.post("/v1/yatra/ride-partner/register", partner2, { businessName: "Other Cabs", city: "Vrindavan", serviceAreas: ["Vrindavan"] }).expect(201);
      s.partner2Id = other.body.data.partner.id;
      const available = await ctx.get("/v1/yatra/ride-partners?city=Vrindavan", pilgrim).expect(200);
      expect(available.body.data.map((p: any) => p.name)).toEqual(["Krishna Cabs"]);
    });
  });

  // ================================================================= ride lifecycle
  describe("ride requests", () => {
    const pickupSoon = () => new Date(new Date(s.a.departAt).getTime() + 3 * HOUR).toISOString();

    it("refuses unapproved partners and lets the chosen partner decline", async () => {
      const bad = await ctx.post(`/v1/yatra/journeys/${s.journey1}/rides`, pilgrim, { pickupAddress: "Kashmere Gate", dropAddress: "Banke Bihari", pickupAt: pickupSoon(), passengers: 2, partnerId: s.partner2Id }).expect(409);
      expect(bad.body.code).toBe("PARTNER_NOT_APPROVED");
      const r1 = await ctx.post(`/v1/yatra/journeys/${s.journey1}/rides`, pilgrim, { pickupAddress: "Vrindavan bus stand", dropAddress: "Prem Mandir", pickupAt: pickupSoon(), passengers: 2, rideType: "suv", partnerId: s.partnerId }).expect(201);
      expect(r1.body.data).toMatchObject({ status: "partner_pending", partnerName: "Krishna Cabs", assignment: null });
      await ctx.post(`/v1/yatra/ride-partner/requests/${r1.body.data.id}/accept`, partner2, { fare: 500, vehicleId: "x" }).expect(404);
      await ctx.post(`/v1/yatra/ride-partner/requests/${r1.body.data.id}/reject`, partner, { reason: "No driver that day" }).expect(201);
      const rides = await ctx.get(`/v1/yatra/journeys/${s.journey1}/rides`, pilgrim).expect(200);
      expect(rides.body.data[0].status).toBe("rejected");
    });

    it("confirms only after the partner accepts and the pilgrim pays, then runs to completion", async () => {
      const r = await ctx.post(`/v1/yatra/journeys/${s.journey1}/rides`, pilgrim, { pickupAddress: "Vrindavan bus stand", dropAddress: "Govardhan", pickupAt: pickupSoon(), passengers: 4, partnerId: s.partnerId }).expect(201);
      s.ride = r.body.data.id;
      await ctx.post(`/v1/yatra/rides/${s.ride}/payment-order`, pilgrim).expect(409);
      const inbox = await ctx.get("/v1/yatra/ride-partner/requests?tab=new", partner).expect(200);
      const vehicle = (await ctx.get("/v1/yatra/ride-partner/me", partner).expect(200)).body.data.partner.vehicles[0];
      expect(inbox.body.data[0]).toMatchObject({ id: s.ride, customer: null });
      await ctx.post(`/v1/yatra/ride-partner/requests/${s.ride}/accept`, partner, { fare: 800, vehicleId: vehicle.id, driverName: "Mohan", driverPhone: "9876522222" }).expect(201);
      const order = await ctx.post(`/v1/yatra/rides/${s.ride}/payment-order`, pilgrim).expect(201);
      const paymentId = demoPay();
      const paid = await ctx.post(`/v1/yatra/rides/${s.ride}/confirm-payment`, pilgrim, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId }).expect(201);
      expect(paid.body.data).toMatchObject({ status: "confirmed", assignment: { driverName: "Mohan" } });
      expect(await ctx.app.get(YatraWebhookService).confirmPaymentFromWebhook(order.body.data.orderId, paymentId, { amountPaise: 80000 })).toBe(true);
      expect(await ctx.rows("SELECT id FROM public.yatra_ledger_entries WHERE ride_request_id = $1 AND type = 'ride_payment'", [s.ride])).toHaveLength(1);
      const active = await ctx.get("/v1/yatra/ride-partner/requests?tab=active", partner).expect(200);
      expect(active.body.data[0].customer).toMatchObject({ name: pilgrim.name });
      await ctx.post(`/v1/yatra/ride-partner/requests/${s.ride}/start`, partner).expect(409);
      await ctx.rows("UPDATE public.yatra_ride_requests SET pickup_at = now() + interval '30 minutes' WHERE id = $1", [s.ride]);
      await ctx.post(`/v1/yatra/ride-partner/requests/${s.ride}/start`, partner).expect(201);
      await ctx.post(`/v1/yatra/ride-partner/requests/${s.ride}/complete`, partner).expect(201);
      const earnings = await ctx.get("/v1/yatra/ride-partner/earnings", partner).expect(200);
      // ₹800 under the ride rule: 15% commission, 18% GST on it.
      expect(earnings.body.summary).toMatchObject({ grossEarnings: 800, commission: 120, taxOnCommission: 21.6, available: 658.4 });
      const pr = await ctx.post("/v1/yatra/ride-partner/payouts", partner, { amount: 658.4 }).expect(201);
      expect(pr.body.data).toMatchObject({ payeeType: "ride_partner", bank: { upiId: "krishna@upi" } });
    });

    it("refunds a paid ride cancelled early to the wallet, and records reported issues", async () => {
      const r = await ctx.post(`/v1/yatra/journeys/${s.journey1}/rides`, pilgrim, { pickupAddress: "Hotel", dropAddress: "Station", pickupAt: pickupSoon(), passengers: 2, partnerId: s.partnerId }).expect(201);
      const vehicle = (await ctx.get("/v1/yatra/ride-partner/me", partner).expect(200)).body.data.partner.vehicles[0];
      await ctx.post(`/v1/yatra/ride-partner/requests/${r.body.data.id}/accept`, partner, { fare: 400, vehicleId: vehicle.id }).expect(201);
      const order = await ctx.post(`/v1/yatra/rides/${r.body.data.id}/payment-order`, pilgrim).expect(201);
      await ctx.post(`/v1/yatra/rides/${r.body.data.id}/confirm-payment`, pilgrim, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      const before = await wallet(pilgrim);
      const cancelled = await ctx.post(`/v1/yatra/rides/${r.body.data.id}/cancel`, pilgrim, { reason: "Plans changed" }).expect(201);
      expect(cancelled.body.data).toMatchObject({ status: "cancelled", refundAmount: 400 });
      expect(await wallet(pilgrim)).toBe(before + 400);
      const issue = await ctx.post(`/v1/yatra/rides/${s.ride}/issues`, pilgrim, { description: "Driver was 40 minutes late", severity: "low" }).expect(201);
      expect(issue.body.data.issueNumber).toMatch(/^YIS-/);
    });
  });

  // ===================================================== add-on referral (journey)
  describe("full journey integration", () => {
    it("credits the organiser's referral share when a paid add-on is delivered", async () => {
      const req = await ctx.post(`/v1/yatra/journeys/${s.journey1}/requests`, pilgrim, { serviceType: "food", serviceDate: new Date(new Date(s.a.departAt).getTime() + 2 * HOUR).toISOString(), location: "Vrindavan", mealType: "lunch", quantity: 2, foodVendorId: String(s.vendor._id) }).expect(201);
      await ctx.post(`/v1/yatra/supplier/requests/${req.body.data.id}/respond`, foodOwner, { decision: "accept", quotedAmount: 600 }).expect(201);
      const order = await ctx.post(`/v1/yatra/requests/${req.body.data.id}/payment-order`, pilgrim).expect(201);
      await ctx.post(`/v1/yatra/requests/${req.body.data.id}/confirm-payment`, pilgrim, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      await ctx.post(`/v1/yatra/supplier/requests/${req.body.data.id}/fulfil`, foodOwner).expect(201);
      const ref = await ctx.rows("SELECT entry_type, amount FROM public.yatra_payee_entries WHERE service_request_id = $1", [req.body.data.id]);
      expect(ref).toEqual([{ entry_type: "referral_earning", amount: 30 }]);
    });
  });

  // ========================================================= Razorpay reconciliation
  describe("Razorpay settlement reconciliation", () => {
    it("checks each captured payment against Razorpay, separately from payouts, and is re-runnable", async () => {
      const paid = await ctx.rows("SELECT id, amount, gateway FROM public.yatra_payments WHERE status = 'paid' ORDER BY created_at LIMIT 2");
      for (const p of paid) await ctx.rows("UPDATE public.yatra_payments SET method = 'razorpay' WHERE id = $1", [p.id]);
      gatewayView.set(paid[0].gateway.paymentId, { status: "captured", amount: Math.round(Number(paid[0].amount) * 100) });
      gatewayView.set(paid[1].gateway.paymentId, { status: "captured", amount: 1 });
      const day = istDay(new Date());
      await ctx.post("/v1/yatra/finance/reconciliation", support, { date: day }).expect(403);
      const run = await ctx.post("/v1/yatra/finance/reconciliation", finance, { date: day }).expect(201);
      expect(run.body.data).toMatchObject({ status: "completed", checkedCount: 2, matchedCount: 1, settledCount: 1 });
      expect(run.body.data.mismatches).toEqual([expect.objectContaining({ issue: "amount_mismatch" })]);
      await ctx.post("/v1/yatra/finance/reconciliation", finance, { date: day }).expect(201);
      const runs = await ctx.get("/v1/yatra/finance/reconciliation", finance).expect(200);
      expect(runs.body.data.filter((r: any) => r.periodDate === day)).toHaveLength(1);
      const csv = await ctx.get(`/v1/yatra/finance/report.csv?from=${day}&to=${day}`, finance).expect(200);
      expect(csv.text).toContain("Tirvona commission");
    });
  });

  // ================================================================ Destination Ops
  describe("Destination Ops city scope", () => {
    it("shows HR / Executive only their own office city", async () => {
      const date = istDay(new Date(s.a.departAt));
      const mine = await ctx.get(`/v1/yatra/ops/dashboard?date=${date}`, hrVrindavan).expect(200);
      expect(mine.body.data.scope).toMatch(/Vrindavan/);
      expect(mine.body.data.arrivals.map((a: any) => a.departureCode)).toContain(s.a.code);
      const theirs = await ctx.get(`/v1/yatra/ops/dashboard?date=${date}`, hrHaridwar).expect(200);
      expect(theirs.body.data.arrivals.map((a: any) => a.departureCode)).not.toContain(s.a.code);
      const ref = (await ctx.get(`/v1/yatra/bookings/${s.booking1}`, pilgrim).expect(200)).body.data.booking.bookingReference;
      await ctx.get(`/v1/yatra/ops/bookings/lookup?reference=${ref}`, hrVrindavan).expect(200);
      await ctx.get(`/v1/yatra/ops/bookings/lookup?reference=${ref}`, hrHaridwar).expect(404);
      await ctx.post("/v1/yatra/ops/issues", hrHaridwar, { city: "Vrindavan", title: "Crowd at ghat" }).expect(403);
      const incident = await ctx.post("/v1/yatra/ops/issues", hrVrindavan, { city: "Vrindavan", title: "Bus breakdown near Chhatikara", severity: "high", bookingReference: ref }).expect(201);
      await ctx.patch(`/v1/yatra/ops/issues/${incident.body.data.id}`, hrHaridwar, { status: "resolved", resolution: "Fixed" }).expect(404);
      await ctx.patch(`/v1/yatra/ops/issues/${incident.body.data.id}`, hrVrindavan, { status: "resolved", resolution: "Replacement bus sent" }).expect(200);
      await ctx.get("/v1/yatra/ops/dashboard", pilgrim).expect(403);
      await ctx.get("/v1/yatra/ops/dashboard", finance).expect(403);
      const all = await ctx.get(`/v1/yatra/ops/dashboard?date=${date}&city=Vrindavan`, admin).expect(200);
      expect(all.body.data.arrivals.map((a: any) => a.departureCode)).toContain(s.a.code);
      const report = await ctx.get(`/v1/yatra/ops/report?from=${date}&to=${date}`, hrVrindavan).expect(200);
      expect(report.body.data.rows[0]).toMatchObject({ date, arrivingGroups: 1 });
    });
  });

  // ================================================================ background jobs
  describe("background jobs", () => {
    it("release unanswered ride requests and send each journey reminder once", async () => {
      const r = await ctx.post(`/v1/yatra/journeys/${s.journey1}/rides`, pilgrim, { pickupAddress: "Ashram", dropAddress: "Ghat", pickupAt: new Date(new Date(s.a.departAt).getTime() + 5 * HOUR).toISOString(), passengers: 1, partnerId: s.partnerId }).expect(201);
      await ctx.rows("UPDATE public.yatra_ride_requests SET partner_assigned_at = now() - interval '7 hours' WHERE id = $1", [r.body.data.id]);
      await ctx.rows("UPDATE public.yatra_bookings SET depart_at = now() + interval '2 hours' WHERE id = $1", [s.booking1]);
      const jobs = ctx.app.get(YatraMaintenanceService);
      const first = await jobs.runOnce();
      expect(first).toMatchObject({ ridesReleased: 1, reminders: 1 });
      const [ride] = await ctx.rows("SELECT status, partner_id FROM public.yatra_ride_requests WHERE id = $1", [r.body.data.id]);
      expect(ride).toEqual({ status: "requested", partner_id: null });
      const second = await jobs.runOnce();
      expect(second).toMatchObject({ ridesReleased: 0, reminders: 0 });
    });
  });

  // ============================================================ central inventory
  describe("central inventory under load", () => {
    it("100 concurrent attempts on 40 seats never confirm more than 40 seats", async () => {
      const dep = await openDeparture(ctx, ownerA, s.a.tourId, (await ctx.post("/v1/yatra/operator/vehicles", ownerA, { registrationNumber: "UP85 RACE 45", seatCapacity: 45, layoutTemplate: "2x2" }).expect(201).then(async (v) => {
        for (const documentType of ["registration_certificate", "insurance", "tourist_permit"]) await ctx.upload("/v1/yatra/operator/documents", ownerA, { documentType, vehicleId: v.body.data.id }).expect(201);
        await ctx.post(`/v1/yatra/operator/vehicles/${v.body.data.id}/submit`, ownerA).expect(201);
        await ctx.post(`/v1/yatra/admin/vehicles/${v.body.data.id}/review`, admin, { action: "approve" }).expect(201);
        return v.body.data.id;
      })), { blocked: ["41", "42", "43", "44", "45"], daysAhead: 12 });
      const crowd = await Promise.all(Array.from({ length: 100 }, (_, i) => ctx.newUser("customer", `Racer ${i}`)));
      const holds = await Promise.all(
        crowd.map((u, i) =>
          ctx.post("/v1/yatra/bookings", u, { departureCode: dep.code, boardingPointId: dep.boardingPointId, seats: [String((i % 40) + 1)], passengers: [{ name: u.name }], contact: { name: u.name, phone: "9876543210" } }),
        ),
      );
      const won = holds.map((h, i) => ({ h, u: crowd[i] })).filter((x) => x.h.status === 201);
      expect(won).toHaveLength(40);
      expect(holds.filter((h) => h.status === 409)).toHaveLength(60);
      // Everyone who won a hold now pays at the same time, and the losers try to pay too.
      const pays: any[] = [];
      for (let i = 0; i < won.length; i += 20) {
        const wave = await Promise.all(
          won.slice(i, i + 20).map(async ({ h, u }) => {
            const order = await ctx.post(`/v1/yatra/bookings/${h.body.data.id}/payment-order`, u);
            return ctx.post(`/v1/yatra/bookings/${h.body.data.id}/confirm-payment`, u, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() });
          }),
        );
        pays.push(...wave);
      }
      expect(pays.filter((p) => p.status === 201)).toHaveLength(40);
      const booked = await ctx.rows("SELECT count(*)::int AS n, count(DISTINCT seat_no)::int AS seats, count(DISTINCT booking_id)::int AS bookings FROM public.yatra_seats WHERE departure_id = $1 AND status = 'booked'", [dep.departureId]);
      expect(booked[0]).toEqual({ n: 40, seats: 40, bookings: 40 });
      const [d] = await ctx.rows("SELECT booked_seats, capacity FROM public.yatra_departures WHERE id = $1", [dep.departureId]);
      expect(d).toEqual({ booked_seats: 40, capacity: 40 });
    }, 180_000);
  });
});
