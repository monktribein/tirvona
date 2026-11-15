/// <reference types="jest" />
/**
 * Tirvona Yatra final QA verification on a real Postgres 17 (isolated test database, demo payments,
 * fake private storage). Fills the gaps the P0–P4 and P5 suites leave: the customer-vs-organiser seat
 * race, hold expiry and duplicate confirmations checked against database rows, an independent
 * recalculation of commission / GST / TDS / refund reversal and the wallet, payout concurrency and
 * duplicate transfers, ride-partner and pilgrim data isolation (IDOR), the role matrix, input
 * validation, and unpublished or suspended tours staying off the public site.
 */
import { bookAndPay, createYatraTestApp, demoPay, seedOrganiser, type TestUser, type YatraTestApp } from "./testing/yatra-test-app";
import { YatraMaintenanceService, YatraWebhookService } from "./application/yatra-insights.service";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("Tirvona Yatra final QA (real Postgres)", () => {
  let ctx: YatraTestApp;
  let admin: TestUser, finance: TestUser, support: TestUser, ownerA: TestUser, ownerB: TestUser;
  let partnerA: TestUser, partnerB: TestUser, hrVrindavan: TestUser, execHaridwar: TestUser, hrNoOffice: TestUser;
  const s: Record<string, any> = {};
  const wallet = async (u: TestUser) => Number((await ctx.model("PilgrimWallet").findOne({ userId: u.id }).lean())?.balance ?? 0);
  const hold = (u: TestUser, seats: string[], dep = s.a) =>
    ctx.post("/v1/yatra/bookings", u, { departureCode: dep.code, boardingPointId: dep.boardingPointId, seats, passengers: seats.map((_, i) => ({ name: `Traveller ${i + 1}` })), contact: { name: u.name, phone: "9876543210" } });
  const assisted = (owner: TestUser, seats: string[], dep = s.a) =>
    ctx.post("/v1/yatra/operator/bookings", owner, { departureId: dep.departureId, boardingPointId: dep.boardingPointId, seats, passengers: seats.map((_, i) => ({ name: `Walk-in ${i + 1}` })), contact: { name: "Walk-in Customer", phone: "9876543211" } });
  const seatRow = async (seat: string, dep = s.a) => (await ctx.rows("SELECT status, booking_id FROM public.yatra_seats WHERE departure_id = $1 AND seat_no = $2", [dep.departureId, seat]))[0];
  const transfer = (payoutId: string, user: TestUser, reference: string, amount: string) =>
    ctx.upload(`/v1/yatra/finance/payouts/${payoutId}/transfer`, user, { method: "neft", transferDate: new Date().toISOString(), reference, amount }, "proof");

  const onboardPartner = async (user: TestUser, name: string, reg: string) => {
    await ctx.post("/v1/yatra/ride-partner/register", user, { businessName: name, city: "Vrindavan", contactPhone: "9876512345", serviceAreas: ["Vrindavan"] }).expect(201);
    await ctx.put("/v1/yatra/ride-partner/vehicles", user, { vehicles: [{ registrationNumber: reg, vehicleType: "suv", seats: 6 }] }).expect(200);
    for (const documentType of ["pan_card", "driving_licence", "registration_certificate", "insurance"]) await ctx.upload("/v1/yatra/ride-partner/documents", user, { documentType }).expect(201);
    await ctx.put("/v1/yatra/ride-partner/payout", user, { accountHolderName: name, upiId: "partner@upi" }).expect(200);
    await ctx.post("/v1/yatra/ride-partner/submit", user, { acceptTerms: true }).expect(201);
    const me = (await ctx.get("/v1/yatra/ride-partner/me", user).expect(200)).body.data;
    await ctx.post(`/v1/yatra/admin/ride-partners/${me.partner.id}/review`, admin, { action: "approve" }).expect(201);
    return { id: me.partner.id as string, vehicleId: me.partner.vehicles[0].id as string };
  };

  beforeAll(async () => {
    ctx = await createYatraTestApp();
    admin = await ctx.newUser("super_admin", "QA Super Admin");
    finance = await ctx.newUser("finance_manager", "QA Finance");
    support = await ctx.newUser("support", "QA Support");
    ownerA = await ctx.newUser("customer", "QA Owner A");
    ownerB = await ctx.newUser("customer", "QA Owner B");
    partnerA = await ctx.newUser("customer", "QA Partner A");
    partnerB = await ctx.newUser("customer", "QA Partner B");
    hrVrindavan = await ctx.newUser("hr", "QA HR Vrindavan");
    execHaridwar = await ctx.newUser("executive", "QA Executive Haridwar");
    hrNoOffice = await ctx.newUser("hr", "QA HR Without Office");
    for (const [user, city] of [[hrVrindavan, "Vrindavan"], [execHaridwar, "Haridwar"]] as const) {
      const office = await ctx.model("HrOffice").create({ code: `QA-${city}`, name: `${city} office`, nameKey: `qa ${city.toLowerCase()} office`, city, active: true });
      await ctx.model("HrEmployee").create({ userId: user.id, fullName: user.name, status: "active", primaryOfficeId: office._id, employeeCode: `QA-EMP-${city}` });
    }
    // The rule a booking is sold under: 10% commission, 18% GST on the commission, 1% TDS on the gross.
    await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "yatra_booking", commissionBps: 1000, taxOnCommissionBps: 1800, tdsBps: 100 }).expect(201);
    await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "ride", commissionBps: 800, taxOnCommissionBps: 1800 }).expect(201);
    s.a = await seedOrganiser(ctx, admin, ownerA, { name: "QA Shyam Travels", seats: 30 });
    s.b = await seedOrganiser(ctx, admin, ownerB, { name: "QA Ganga Tours", destination: "Haridwar", seats: 20 });
  });

  afterAll(async () => {
    await ctx?.close();
  });

  // ======================================================== P2 seat inventory
  describe("P2 central seat inventory", () => {
    it("Scenario B: a customer and an organiser racing for the same seat — exactly one wins, every round", async () => {
      const racers = await Promise.all(Array.from({ length: 10 }, (_, i) => ctx.newUser("customer", `Seat Racer ${i}`)));
      let organiserWins = 0;
      for (let i = 0; i < 10; i++) {
        const seat = String(i + 1);
        const [web, org] = await Promise.all([hold(racers[i], [seat]), assisted(ownerA, [seat])]);
        expect([web.status, org.status].sort()).toEqual([201, 409]);
        const loser = web.status === 201 ? org : web;
        expect(loser.body.code).toBe("SEAT_TAKEN");
        const winner = web.status === 201 ? web.body.data.id : org.body.data.booking.id;
        if (org.status === 201) organiserWins += 1;
        expect(await seatRow(seat)).toEqual({ status: "held", booking_id: winner });
      }
      const [held] = await ctx.rows("SELECT count(*)::int AS n FROM public.yatra_bookings WHERE departure_id = $1 AND status IN ('held', 'payment_pending')", [s.a.departureId]);
      expect(held.n).toBe(10);
      const [orgRows] = await ctx.rows("SELECT count(*)::int AS n FROM public.yatra_bookings WHERE departure_id = $1 AND source = 'ORGANIZER'", [s.a.departureId]);
      expect(orgRows.n).toBe(organiserWins);
    });

    it("Scenario C: a lapsed hold or an abandoned payment returns the seat to the shared inventory", async () => {
      const lapsed = await ctx.newUser("customer", "Lapsed Holder");
      const b = await hold(lapsed, ["11"]).expect(201);
      await ctx.post(`/v1/yatra/bookings/${b.body.data.id}/payment-order`, lapsed).expect(201);
      expect((await ctx.rows("SELECT status FROM public.yatra_bookings WHERE id = $1", [b.body.data.id]))[0].status).toBe("payment_pending");
      expect(await seatRow("11")).toEqual({ status: "held", booking_id: b.body.data.id });
      await ctx.rows("UPDATE public.yatra_bookings SET hold_expires_at = now() - interval '10 minutes' WHERE id = $1", [b.body.data.id]);
      await ctx.rows("UPDATE public.yatra_seats SET hold_expires_at = now() - interval '10 minutes' WHERE booking_id = $1", [b.body.data.id]);
      const jobs = await ctx.app.get(YatraMaintenanceService).runOnce();
      expect(jobs.expired).toBeGreaterThanOrEqual(1);
      expect((await ctx.rows("SELECT status FROM public.yatra_bookings WHERE id = $1", [b.body.data.id]))[0].status).toBe("expired");
      expect(await seatRow("11")).toEqual({ status: "available", booking_id: null });
      // The organiser can now sell the same seat from the same inventory.
      const resold = await assisted(ownerA, ["11"]).expect(201);
      expect(await seatRow("11")).toEqual({ status: "held", booking_id: resold.body.data.booking.id });

      const quitter = await ctx.newUser("customer", "Abandoned Payment");
      const c = await hold(quitter, ["12"]).expect(201);
      await ctx.post(`/v1/yatra/bookings/${c.body.data.id}/payment-order`, quitter).expect(201);
      expect((await ctx.post(`/v1/yatra/bookings/${c.body.data.id}/release`, quitter).expect(201)).body.data.status).toBe("cancelled");
      expect(await seatRow("12")).toEqual({ status: "available", booking_id: null });
      const [dep] = await ctx.rows("SELECT booked_seats FROM public.yatra_departures WHERE id = $1", [s.a.departureId]);
      expect(dep.booked_seats).toBe(0);
    });

    it("Scenario D: duplicate submissions and payment confirmations never create a second confirmed booking", async () => {
      const p = await ctx.newUser("customer", "Double Clicker");
      const tries = await Promise.all([hold(p, ["13"]), hold(p, ["13"]), hold(p, ["13"])]);
      expect(tries.filter((t) => t.status === 201)).toHaveLength(1);
      expect(tries.filter((t) => t.status === 409)).toHaveLength(2);
      const id = tries.find((t) => t.status === 201)!.body.data.id;
      const order = await ctx.post(`/v1/yatra/bookings/${id}/payment-order`, p).expect(201);
      const paymentId = demoPay();
      const webhook = ctx.app.get(YatraWebhookService);
      const results = await Promise.all([
        ...Array.from({ length: 4 }, () => ctx.post(`/v1/yatra/bookings/${id}/confirm-payment`, p, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: paymentId })),
        webhook.confirmPaymentFromWebhook(order.body.data.orderId, paymentId, { amountPaise: 150000 }),
        webhook.confirmPaymentFromWebhook(order.body.data.orderId, paymentId, { amountPaise: 150000 }),
      ]);
      expect((results.slice(0, 4) as any[]).map((r) => r.status)).toEqual([201, 201, 201, 201]);
      expect(results.slice(4)).toEqual([true, true]);
      expect(await ctx.rows("SELECT status FROM public.yatra_bookings WHERE customer_id = $1", [p.id])).toEqual([{ status: "confirmed" }]);
      expect(await ctx.rows("SELECT type FROM public.yatra_ledger_entries WHERE booking_id = $1", [id])).toEqual([{ type: "booking_payment" }]);
      expect(await ctx.rows("SELECT id FROM public.yatra_journeys WHERE booking_id = $1", [id])).toHaveLength(1);
      expect(await ctx.rows("SELECT id FROM public.yatra_payee_entries WHERE booking_id = $1 AND entry_type = 'gross_earning'", [id])).toHaveLength(1);
      expect(await seatRow("13")).toEqual({ status: "booked", booking_id: id });
      expect((await ctx.rows("SELECT booked_seats FROM public.yatra_departures WHERE id = $1", [s.a.departureId]))[0].booked_seats).toBe(1);
      s.bookingD = id;
    });
  });

  // ====================================================== P3 money, recalculated
  describe("P3 / P5 money recalculated independently", () => {
    it("matches a hand calculation of commission, GST, TDS, a 50% refund reversal and the wallet", async () => {
      const p = await ctx.newUser("customer", "Refund Checker");
      const { bookingId } = await bookAndPay(ctx, p, s.a, ["14", "15"]); // 2 × ₹1,500
      const entries = async () =>
        Object.fromEntries((await ctx.rows("SELECT entry_type, direction, amount FROM public.yatra_payee_entries WHERE booking_id = $1", [bookingId])).map((r) => [r.entry_type, [r.direction, Number(r.amount)]]));
      // Gross 3000; commission 10% = 300; GST 18% of 300 = 54; TDS 1% of 3000 = 30; organiser net 2616.
      expect(await entries()).toEqual({ gross_earning: ["credit", 3000], commission: ["debit", 300], tax_on_commission: ["debit", 54], tds: ["debit", 30] });
      const [snap] = await ctx.rows("SELECT commission_snapshot FROM public.yatra_bookings WHERE id = $1", [bookingId]);
      expect(snap.commission_snapshot).toMatchObject({ commissionBps: 1000, taxOnCommissionBps: 1800, tdsBps: 100, version: 1 });

      await ctx.post(`/v1/yatra/bookings/${bookingId}/cancel-request`, p, { reason: "Change of plan" }).expect(201);
      const before = await wallet(p);
      await ctx.post(`/v1/yatra/admin/bookings/${bookingId}/cancellation`, finance, { decision: "approve", refundPercent: 50 }).expect(403);
      await ctx.post(`/v1/yatra/admin/bookings/${bookingId}/cancellation`, admin, { decision: "approve", refundPercent: 50, note: "Half refund agreed with the pilgrim" }).expect(201);
      expect(await wallet(p)).toBe(before + 1500);
      await ctx.post(`/v1/yatra/admin/bookings/${bookingId}/cancellation`, admin, { decision: "approve", refundPercent: 50, note: "again" }).expect(409);
      expect(await wallet(p)).toBe(before + 1500);
      // Half of each: refund 1500, commission back 150, GST back 27, TDS back 15.
      expect(await entries()).toMatchObject({ refund_deduction: ["debit", 1500], commission_reversal: ["credit", 150], tax_reversal: ["credit", 27], tds_reversal: ["credit", 15] });
      const refunds = await ctx.rows("SELECT amount, type FROM public.pilgrim_wallet_transactions WHERE user_id = $1 AND idempotency_key = $2", [p.id, `refund:yatra:${bookingId}`]);
      expect(refunds.map((r) => [r.type, Number(r.amount)])).toEqual([["credit", 1500]]);
      const [txSum] = await ctx.rows("SELECT COALESCE(sum(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)::float AS total FROM public.pilgrim_wallet_transactions WHERE user_id = $1", [p.id]);
      expect(txSum.total).toBe(await wallet(p));
      expect((await ctx.rows("SELECT type, amount FROM public.yatra_ledger_entries WHERE booking_id = $1 AND type = 'booking_refund'", [bookingId])).map((r) => Number(r.amount))).toEqual([1500]);

      // The organiser's balance equals the sum of its ledger rows, and nothing is payable before the journey ends.
      const [ledger] = await ctx.rows("SELECT COALESCE(sum(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)::float AS net FROM public.yatra_payee_entries WHERE payee_id = $1", [s.a.operatorId]);
      const summary = (await ctx.get(`/v1/yatra/finance/payees/operator/${s.a.operatorId}`, finance).expect(200)).body.summary;
      expect(summary.available).toBe(0);
      expect(Math.round((summary.available + summary.pending) * 100)).toBe(Math.round(ledger.net * 100));
      // Booking D (₹1500: net 1308) + this booking after the half refund (₹1308).
      expect(summary.pending).toBe(2616);
    });
  });

  // ============================================================ manual payouts
  describe("P5 manual payouts", () => {
    it("keeps one open request under concurrency, one transfer per payout, and the right remaining balance — nothing automatic", async () => {
      await ctx.post("/v1/yatra/finance/adjustments", finance, { payeeType: "operator", payeeId: s.a.operatorId, direction: "credit", amount: 5000, reason: "QA delivered balance" }).expect(201);
      const reqs = await Promise.all(Array.from({ length: 5 }, () => ctx.post("/v1/yatra/operator/payouts", ownerA, { amount: 1000 })));
      expect(reqs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(reqs.filter((r) => r.status === 409)).toHaveLength(4);
      const payoutId = reqs.find((r) => r.status === 201)!.body.data.id;

      // Nothing moves on its own, even when the background jobs run.
      await ctx.app.get(YatraMaintenanceService).runOnce();
      expect((await ctx.rows("SELECT status FROM public.yatra_payouts WHERE id = $1", [payoutId]))[0].status).toBe("pending");
      expect(await ctx.rows("SELECT id FROM public.yatra_payee_entries WHERE payout_id = $1", [payoutId])).toHaveLength(0);

      // The organiser cannot approve or record its own transfer; another organiser cannot see it.
      await ctx.post(`/v1/yatra/finance/payouts/${payoutId}/review`, ownerA, { action: "approve" }).expect(403);
      await transfer(payoutId, ownerA, "UTRQA0000001", "1000").expect(403);
      await ctx.post(`/v1/yatra/operator/payouts/${payoutId}/cancel`, ownerB).expect(404);
      await ctx.get(`/v1/yatra/operator/payouts/${payoutId}/proof`, ownerB).expect(404);
      // A transfer cannot be recorded before approval.
      await transfer(payoutId, finance, "UTRQA0000001", "1000").expect(409);
      await ctx.post(`/v1/yatra/finance/payouts/${payoutId}/review`, finance, { action: "approve" }).expect(201);

      const recorded = await Promise.all(["UTRQA0000001", "UTRQA0000002", "UTRQA0000003"].map((ref) => transfer(payoutId, finance, ref, "1000")));
      expect(recorded.filter((r) => r.status === 201)).toHaveLength(1);
      expect(recorded.filter((r) => r.status === 409)).toHaveLength(2);
      const rows = await ctx.rows("SELECT amount FROM public.yatra_payee_entries WHERE payout_id = $1 AND entry_type = 'transfer'", [payoutId]);
      expect(rows.map((r) => Number(r.amount))).toEqual([1000]);
      const summary = (await ctx.get(`/v1/yatra/finance/payees/operator/${s.a.operatorId}`, finance).expect(200)).body.summary;
      expect(summary).toMatchObject({ available: 4000, transfers: 1000, inOpenPayouts: 0, requestable: 4000 });

      // Reconciliation: a difference needs an explanation, then it is recorded.
      const diff = await ctx.post(`/v1/yatra/finance/payouts/${payoutId}/reconcile`, finance, { bankAmount: 990 }).expect(400);
      expect(diff.body.code).toBe("RECONCILIATION_DIFFERENCE");
      const done = await ctx.post(`/v1/yatra/finance/payouts/${payoutId}/reconcile`, finance, { bankAmount: 990, note: "Bank charged a ₹10 fee" }).expect(201);
      expect(done.body.data).toMatchObject({ status: "reconciled", reconciliation: { difference: -10 } });
      const audit = await ctx.get("/v1/yatra/admin/audit?action=payout.transfer_recorded&page=1&limit=10", admin).expect(200);
      expect(audit.body.data.filter((a: any) => a.details?.payoutId === payoutId)).toHaveLength(1);
    });
  });

  // ============================================ ride partners and pilgrims (IDOR)
  describe("P5 rides: data isolation", () => {
    it("keeps each ride partner and each pilgrim to their own records", async () => {
      s.partnerA = await onboardPartner(partnerA, "QA Krishna Cabs", "UP85QA1001");
      s.partnerB = await onboardPartner(partnerB, "QA Radhe Cabs", "UP85QA2002");
      const owner = await ctx.newUser("customer", "Journey Owner");
      const other = await ctx.newUser("customer", "Someone Else");
      const { journeyId } = await bookAndPay(ctx, owner, s.a, ["16"]);
      const pickupAt = new Date(new Date(s.a.departAt).getTime() + 4 * HOUR).toISOString();
      const ride = { pickupAddress: "Bus stand", dropAddress: "Prem Mandir", pickupAt, passengers: 1, partnerId: s.partnerA.id };

      await ctx.get(`/v1/yatra/journeys/${journeyId}`, other).expect(404);
      await ctx.get(`/v1/yatra/journeys/${journeyId}/rides`, other).expect(404);
      await ctx.post(`/v1/yatra/journeys/${journeyId}/rides`, other, ride).expect(404);
      await ctx.post(`/v1/yatra/journeys/${journeyId}/issues`, other, { description: "Not my journey at all" }).expect(404);
      const r = await ctx.post(`/v1/yatra/journeys/${journeyId}/rides`, owner, ride).expect(201);

      // Partner B never sees or touches partner A's request; the pilgrim's contact is hidden until payment.
      const listB = await ctx.get("/v1/yatra/ride-partner/requests?tab=new", partnerB).expect(200);
      expect(listB.body.data.map((x: any) => x.id)).not.toContain(r.body.data.id);
      await ctx.post(`/v1/yatra/ride-partner/requests/${r.body.data.id}/accept`, partnerB, { fare: 300, vehicleId: s.partnerB.vehicleId }).expect(404);
      const listA = await ctx.get("/v1/yatra/ride-partner/requests?tab=new", partnerA).expect(200);
      expect(listA.body.data.find((x: any) => x.id === r.body.data.id).customer).toBeNull();
      await ctx.post(`/v1/yatra/ride-partner/requests/${r.body.data.id}/accept`, partnerA, { fare: 400, vehicleId: s.partnerA.vehicleId }).expect(201);

      await ctx.post(`/v1/yatra/rides/${r.body.data.id}/payment-order`, other).expect(404);
      await ctx.post(`/v1/yatra/rides/${r.body.data.id}/cancel`, other, { reason: "Trying someone else's ride" }).expect(404);
      const order = await ctx.post(`/v1/yatra/rides/${r.body.data.id}/payment-order`, owner).expect(201);
      await ctx.post(`/v1/yatra/rides/${r.body.data.id}/confirm-payment`, owner, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      const active = await ctx.get("/v1/yatra/ride-partner/requests?tab=active", partnerA).expect(200);
      expect(active.body.data.find((x: any) => x.id === r.body.data.id).customer).toMatchObject({ name: "Journey Owner" });

      // Documents and payouts stay with their owner.
      const docsA = (await ctx.get(`/v1/yatra/admin/ride-partners/${s.partnerA.id}`, admin).expect(200)).body.data.documents;
      await ctx.get(`/v1/yatra/ride-partner/documents/${docsA[0].id}/link`, partnerB).expect(404);
      await ctx.get(`/v1/yatra/ride-partner/documents/${docsA[0].id}/link`, partnerA).expect(200);
      await ctx.get(`/v1/yatra/admin/ride-partner-documents/${docsA[0].id}/link`, partnerA).expect(403);
      await ctx.get("/v1/yatra/ride-partner/requests", owner).expect(404);
      await ctx.post("/v1/yatra/finance/adjustments", finance, { payeeType: "ride_partner", payeeId: s.partnerA.id, direction: "credit", amount: 700, reason: "QA ride balance" }).expect(201);
      const pay = await ctx.post("/v1/yatra/ride-partner/payouts", partnerA, { amount: 500 }).expect(201);
      expect((await ctx.get("/v1/yatra/ride-partner/payouts", partnerB).expect(200)).body.data).toEqual([]);
      await ctx.post(`/v1/yatra/ride-partner/payouts/${pay.body.data.id}/cancel`, partnerB).expect(404);
      await ctx.post(`/v1/yatra/operator/payouts/${pay.body.data.id}/cancel`, ownerA).expect(404);
    });
  });

  // ================================================================ role matrix
  describe("roles and Super Admin protection", () => {
    it("lets only the right roles reach admin, finance and ops endpoints", async () => {
      const pilgrim = await ctx.newUser("customer", "Plain Pilgrim");
      const tours = (await ctx.get("/v1/yatra/admin/tours?page=1&limit=5", admin).expect(200)).body.data;
      for (const user of [support, finance, hrVrindavan, execHaridwar, ownerA, partnerA, pilgrim]) {
        await ctx.get("/v1/yatra/admin/overview", user).expect(403);
        await ctx.post(`/v1/yatra/admin/tours/${tours[0].id}/review`, user, { action: "unpublish", note: "not allowed" }).expect(403);
        await ctx.post(`/v1/yatra/admin/ride-partners/${s.partnerA.id}/review`, user, { action: "suspend", note: "not allowed" }).expect(403);
        await ctx.post(`/v1/yatra/admin/departures/${s.a.departureId}/cancel`, user, { reason: "not allowed" }).expect(403);
      }
      for (const user of [support, hrVrindavan, ownerA, partnerA, pilgrim]) {
        await ctx.get("/v1/yatra/finance/dashboard", user).expect(403);
        await ctx.post("/v1/yatra/finance/rules", user, { appliesTo: "yatra_booking", commissionBps: 1 }).expect(403);
      }
      for (const user of [finance, support, ownerA, partnerA, pilgrim]) await ctx.get("/v1/yatra/ops/dashboard", user).expect(403);
      await ctx.get("/v1/yatra/finance/dashboard", finance).expect(200);
      await ctx.get("/v1/yatra/finance/dashboard", admin).expect(200);
      await ctx.get("/v1/yatra/bookings").expect(401);
      await ctx.get("/v1/yatra/finance/dashboard").expect(401);
      await ctx.get("/v1/yatra/ride-partner/me").expect(401);
    });

    it("scopes Destination Ops to the office city for every lookup, including Executive logins", async () => {
      const [dep] = await ctx.rows("SELECT id FROM public.yatra_departures WHERE id = $1", [s.a.departureId]);
      await ctx.get(`/v1/yatra/ops/departures/${dep.id}/passengers`, hrVrindavan).expect(200);
      await ctx.get(`/v1/yatra/ops/departures/${dep.id}/passengers`, execHaridwar).expect(404);
      await ctx.get(`/v1/yatra/ops/departures/${s.b.departureId}/passengers`, execHaridwar).expect(200);
      const ref = (await ctx.rows("SELECT booking_reference FROM public.yatra_bookings WHERE id = $1", [s.bookingD]))[0].booking_reference;
      await ctx.get(`/v1/yatra/ops/bookings/lookup?reference=${ref}`, execHaridwar).expect(404);
      await ctx.post(`/v1/yatra/ops/rides/${"0".repeat(24)}/assign`, execHaridwar, { partnerId: s.partnerA.id }).expect(404);
      const none = await ctx.get("/v1/yatra/ops/dashboard", hrNoOffice).expect(200);
      expect(none.body.data).toMatchObject({ scope: "No office assigned", arrivals: [], departures: [], rides: [], issues: [] });
      await ctx.get(`/v1/yatra/ops/bookings/lookup?reference=${ref}`, hrNoOffice).expect(404);
    });
  });

  // ============================================== public visibility of tours
  describe("unapproved, unpublished or suspended tours stay off the public site", () => {
    it("hides draft, pending, unpublished and suspended-organiser tours from search, departure pages and booking", async () => {
      const draft = await ctx.post("/v1/yatra/operator/tours", ownerA, { title: "QA Draft Kedarnath", originCity: "Delhi", destinationCity: "Kedarnath", durationDays: 4, baseFare: 9000, summary: "Draft", itinerary: [{ dayNumber: 1, title: "Day one" }], inclusions: ["Bus"] }).expect(201);
      await ctx.post(`/v1/yatra/operator/tours/${draft.body.data.id}/submit`, ownerA).expect(201);
      await ctx.post(`/v1/yatra/admin/tours/${draft.body.data.id}/review`, ownerA, { action: "publish" }).expect(403);
      expect(JSON.stringify((await ctx.get("/v1/yatra/search?destination=Kedarnath").expect(200)).body)).not.toContain("QA Draft Kedarnath");

      const visible = async () => JSON.stringify((await ctx.get("/v1/yatra/search?destination=Vrindavan").expect(200)).body).includes(s.a.code);
      expect(await visible()).toBe(true);
      await ctx.post(`/v1/yatra/admin/tours/${s.a.tourId}/review`, admin, { action: "unpublish", note: "QA visibility check" }).expect(201);
      expect(await visible()).toBe(false);
      await ctx.get(`/v1/yatra/departures/${s.a.code}`).expect(404);
      const late = await ctx.newUser("customer", "Too Late");
      expect([404, 409]).toContain((await hold(late, ["20"])).status);
      await ctx.post(`/v1/yatra/admin/tours/${s.a.tourId}/review`, admin, { action: "publish" }).expect(201);
      expect(await visible()).toBe(true);

      const ganga = async () => JSON.stringify((await ctx.get("/v1/yatra/search?destination=Haridwar").expect(200)).body).includes(s.b.code);
      expect(await ganga()).toBe(true);
      await ctx.post(`/v1/yatra/admin/operators/${s.b.operatorId}/review`, admin, { action: "suspend", note: "QA suspension" }).expect(201);
      expect(await ganga()).toBe(false);
      await ctx.get(`/v1/yatra/departures/${s.b.code}`).expect(404);
      await ctx.post(`/v1/yatra/admin/operators/${s.b.operatorId}/review`, admin, { action: "reinstate" }).expect(201);
      expect(await ganga()).toBe(true);
    });
  });

  // ======================================== organiser-assisted channel commission
  describe("organiser-assisted channel", () => {
    it("applies the organiser-channel (DIRECT) rule to a booking paid through the organiser's link", async () => {
      await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "yatra_booking", channel: "DIRECT", commissionBps: 300, taxOnCommissionBps: 1800 }).expect(201);
      const held = await assisted(ownerA, ["18"]).expect(201);
      const token = String(held.body.data.paymentLink).split("/yatra/pay/")[1];
      const payer = await ctx.newUser("customer", "Link Payer");
      const order = await ctx.post(`/v1/yatra/payment-links/${token}/order`, payer).expect(201);
      await ctx.post(`/v1/yatra/payment-links/${token}/confirm`, payer, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      const bookingId = held.body.data.booking.id;
      const [row] = await ctx.rows("SELECT source, customer_id, organizer_staff_user_id, commission_snapshot FROM public.yatra_bookings WHERE id = $1", [bookingId]);
      expect(row).toMatchObject({ source: "ORGANIZER", customer_id: payer.id, organizer_staff_user_id: ownerA.id, commission_snapshot: { channel: "DIRECT", commissionBps: 300 } });
      // ₹1,500 at 3% = 45; GST 18% of 45 = 8.10; no TDS on this rule, so no TDS row.
      const entries = Object.fromEntries((await ctx.rows("SELECT entry_type, amount FROM public.yatra_payee_entries WHERE booking_id = $1", [bookingId])).map((r) => [r.entry_type, Number(r.amount)]));
      expect(entries).toEqual({ gross_earning: 1500, commission: 45, tax_on_commission: 8.1 }); // zero-amount rows (TDS 0) are not written
      // A website booking made now still uses the "every channel" rule (10%).
      const web = await bookAndPay(ctx, await ctx.newUser("customer", "Website Buyer"), s.a, ["19"]);
      const [snap] = await ctx.rows("SELECT commission_snapshot FROM public.yatra_bookings WHERE id = $1", [web.bookingId]);
      expect(snap.commission_snapshot).toMatchObject({ channel: "any", commissionBps: 1000 });
    });
  });

  // ========================================================= input validation
  describe("input validation and injection", () => {
    it("treats regex and SQL meta-characters as plain text and rejects malformed input", async () => {
      await ctx.get("/v1/yatra/search?origin=.*&destination=%27%3B%20DROP%20TABLE%20yatra_tours%3B--").expect(200);
      expect(await ctx.rows("SELECT count(*)::int AS n FROM public.yatra_tours")).toEqual([{ n: expect.any(Number) }]);
      await ctx.get(`/v1/yatra/ops/bookings/lookup?reference=${encodeURIComponent("' OR 1=1 --")}`, admin).expect(404);
      await ctx.get("/v1/yatra/ops/issues?city=.*&page=1&limit=5", hrVrindavan).expect(200);
      await ctx.get("/v1/yatra/bookings/not-an-id", ownerA).expect(400);
      await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "yatra_booking", commissionBps: 500, organiserShare: 95 }).expect(400);
      await ctx.post("/v1/yatra/finance/rules", finance, { appliesTo: "yatra_booking", commissionBps: 20000 }).expect(400);
      await ctx.post("/v1/yatra/operator/payouts", ownerA, { amount: -5 }).expect(400);
      await ctx.post("/v1/yatra/finance/adjustments", finance, { payeeType: "operator", payeeId: s.a.operatorId, direction: "credit", amount: 0, reason: "zero amount" }).expect(400);
      const xss = "<img src=x onerror=alert(1)>";
      const issue = await ctx.post("/v1/yatra/ops/issues", hrVrindavan, { city: "Vrindavan", title: xss }).expect(201);
      expect(issue.body.data.title).toBe(xss); // stored as text; React renders it escaped
    });
  });

  // =========================================================== P4 journey hub
  describe("P4 journey hub links", () => {
    it("links only the pilgrim's own parking booking during the journey, read-only", async () => {
      const pilgrim = await ctx.newUser("customer", "Parking Pilgrim");
      const other = await ctx.newUser("customer", "Other Parker");
      const { journeyId } = await bookAndPay(ctx, pilgrim, s.a, ["17"]);
      const at = new Date(new Date(s.a.departAt).getTime() + DAY);
      const mine = await ctx.model("YatraParkingBookingRef").create({ bookingReference: "PRK-QA-1", customerId: pilgrim.id, vehicleNumber: "UP85AB1234", entryAt: at, status: "confirmed" });
      const theirs = await ctx.model("YatraParkingBookingRef").create({ bookingReference: "PRK-QA-2", customerId: other.id, vehicleNumber: "UP85AB9999", entryAt: at, status: "confirmed" });
      const linkable = await ctx.get(`/v1/yatra/journeys/${journeyId}/linkable`, pilgrim).expect(200);
      expect(linkable.body.data.map((r: any) => r.reference)).toEqual(["PRK-QA-1"]);
      await ctx.post(`/v1/yatra/journeys/${journeyId}/links`, pilgrim, { module: "parking", refId: String(theirs._id) }).expect(404);
      await ctx.post(`/v1/yatra/journeys/${journeyId}/links`, pilgrim, { module: "parking", refId: String(mine._id) }).expect(201);
      const [row] = await ctx.rows("SELECT status FROM public.parking_bookings WHERE id = $1", [String(mine._id)]);
      expect(row.status).toBe("confirmed");
    });
  });
});
