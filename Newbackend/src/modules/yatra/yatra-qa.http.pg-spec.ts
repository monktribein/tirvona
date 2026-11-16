/// <reference types="jest" />
/**
 * Tirvona Yatra final QA verification on a real Postgres 17 (isolated test database, demo payments,
 * fake private storage). Fills the gaps the P0–P4 and P5 suites leave: the customer-vs-organiser seat
 * race, hold expiry and duplicate confirmations checked against database rows, an independent
 * recalculation of commission / GST / TDS / refund reversal and the wallet, payout concurrency and
 * duplicate transfers, ride-partner and pilgrim data isolation (IDOR), the role matrix, input
 * validation, and unpublished or suspended tours staying off the public site.
 */
import bcrypt from "bcryptjs";
import { bookAndPay, createYatraTestApp, demoPay, openDeparture, seedOrganiser, type TestUser, type YatraTestApp } from "./testing/yatra-test-app";
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

  // ===================================================== admin-created organiser accounts
  describe("Super Admin creates an organiser account", () => {
    const dto = (n: string) => ({ name: `New Organiser ${n}`, email: `new.organiser.${n}.${Date.now()}@example.test`, phone: `9${String(700000000 + Number(n) * 7919).slice(0, 9)}`, organisationName: `Brij Yatra Sewa ${n}`, city: "Mathura", state: "Uttar Pradesh" });

    it("creates the login and a draft organisation, shows the one-time password once, and refuses repeats", async () => {
      const body = dto("1");
      await ctx.post("/v1/yatra/admin/operators", finance, body).expect(403);
      await ctx.post("/v1/yatra/admin/operators", ownerA, body).expect(403);
      await ctx.post("/v1/yatra/admin/operators", admin, { ...body, password: "short" }).expect(400);
      const res = await ctx.post("/v1/yatra/admin/operators", admin, body).expect(201);
      const { login, organiser } = res.body.data;
      expect(login.temporaryPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
      expect(login).toMatchObject({ email: body.email.toLowerCase(), mustChangePassword: false });
      expect(organiser.operator).toMatchObject({ organisationName: body.organisationName, status: "draft", city: "Mathura" });
      // The password is stored only as a bcrypt hash, the account is an ordinary customer, and no password change is forced.
      const [row] = await ctx.rows("SELECT role, status, password_hash, _extra FROM public.users WHERE id = $1", [login.userId]);
      expect(row).toMatchObject({ role: "customer", status: "active" });
      expect(row.password_hash).not.toContain(login.temporaryPassword);
      expect(await bcrypt.compare(login.temporaryPassword, row.password_hash)).toBe(true);
      expect(JSON.stringify(row._extra ?? {})).not.toContain("mustChangePassword");
      // The organiser signs in with that login and owns the draft organisation.
      const asOrganiser = { ...(await ctx.newUser("customer", body.name)), id: login.userId, email: body.email.toLowerCase() };
      const mine = await ctx.get("/v1/yatra/operator/me", asOrganiser).expect(200);
      expect(mine.body.data).toMatchObject({ registered: true, operator: { status: "draft" } });
      await ctx.post("/v1/yatra/operator/register", asOrganiser, { organisationName: "Second Organisation" }).expect(409);
      // Repeats and clashes are refused without creating anything.
      await ctx.post("/v1/yatra/admin/operators", admin, body).expect(409);
      const clash = await ctx.post("/v1/yatra/admin/operators", admin, { ...dto("2"), phone: body.phone }).expect(409);
      expect(clash.body.code).toBe("PHONE_EXISTS");
      const audit = await ctx.get("/v1/yatra/admin/audit?action=operator.account_created&page=1&limit=10", admin).expect(200);
      expect(JSON.stringify(audit.body.data)).not.toContain(login.temporaryPassword);
    });

    it("lets the admin choose the password instead of generating one", async () => {
      const body = { ...dto("3"), password: "Radha-Krishna-2026" };
      const res = await ctx.post("/v1/yatra/admin/operators", admin, body).expect(201);
      expect(res.body.data.login.temporaryPassword).toBe("Radha-Krishna-2026");
      const [row] = await ctx.rows("SELECT password_hash FROM public.users WHERE id = $1", [res.body.data.login.userId]);
      expect(await bcrypt.compare("Radha-Krishna-2026", row.password_hash)).toBe(true);
    });
  });

  // ===================================== what customers can trust: documents, ratings, experience
  describe("verified bus badges and trip ratings", () => {
    const publicView = async () => (await ctx.get(`/v1/yatra/departures/${s.a.code}`).expect(200)).body.data;

    it("shows RC verified after the vehicle is verified, and a pollution certificate only when approved and valid", async () => {
      const view = await publicView();
      expect(view.vehicle).toMatchObject({ rcVerified: true, pollutionValidTill: null });
      // The documents themselves are never part of the public view.
      expect(JSON.stringify(view)).not.toMatch(/signed|storage|publicId/);
      const future = new Date(Date.now() + 200 * 86_400_000).toISOString();
      const expired = new Date(Date.now() - 5 * 86_400_000).toISOString();
      const upload = (expiresAt: string) => ctx.upload("/v1/yatra/operator/documents", ownerA, { documentType: "pollution_certificate", vehicleId: s.a.vehicleId, expiresAt }).expect(201);
      const pending = await upload(future);
      expect((await publicView()).vehicle.pollutionValidTill).toBeNull(); // uploaded but not yet verified
      await ctx.post(`/v1/yatra/admin/documents/${pending.body.data.id}/review`, admin, { decision: "approve" }).expect(201);
      expect(new Date((await publicView()).vehicle.pollutionValidTill).getTime()).toBeGreaterThan(Date.now());
      // An approved certificate that has expired is not shown.
      const old = await upload(expired);
      await ctx.post(`/v1/yatra/admin/documents/${old.body.data.id}/review`, admin, { decision: "approve" }).expect(201);
      await ctx.rows("UPDATE public.yatra_documents SET status = 'rejected' WHERE id = $1", [pending.body.data.id]);
      expect((await publicView()).vehicle.pollutionValidTill).toBeNull();
    });

    it("lets only people who travelled rate, once, after the trip, and shows the average and reviews publicly", async () => {
      const rider1 = await ctx.newUser("customer", "Meera Sharma");
      const rider2 = await ctx.newUser("customer", "Gopal Das");
      const stranger = await ctx.newUser("customer", "Stranger Singh");
      // Its own departure, so moving it into the past does not disturb the other tests.
      const trip = await openDeparture(ctx, ownerA, s.a.tourId, s.a.vehicleId, { daysAhead: 6 });
      const b1 = await bookAndPay(ctx, rider1, trip, ["1"]);
      const b2 = await bookAndPay(ctx, rider2, trip, ["2"]);
      expect((await publicView()).operator.rating).toMatchObject({ average: 0, count: 0, breakdown: [0, 0, 0, 0, 0], tags: [] });
      // Not before the trip has finished.
      const early = await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1, { stars: 5 }).expect(409);
      expect(early.body.code).toBe("CANNOT_RATE_YET");
      expect((await ctx.get(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1).expect(200)).body.data).toMatchObject({ canRate: false, rating: null });
      // The trip finishes.
      await ctx.rows("UPDATE public.yatra_departures SET depart_at = now() - interval '3 days', return_at = now() - interval '1 day' WHERE id = $1", [trip.departureId]);
      await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, stranger, { stars: 1 }).expect(404);
      await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1, { stars: 6 }).expect(400);
      await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1, { stars: 0 }).expect(400);
      expect((await ctx.get(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1).expect(200)).body.data).toMatchObject({ canRate: true });
      await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1, { stars: 5, comment: "Smooth journey, very punctual driver." }).expect(201);
      const again = await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, rider1, { stars: 1 }).expect(409);
      expect(again.body.code).toBe("ALREADY_RATED");
      await ctx.post(`/v1/yatra/bookings/${b2.bookingId}/rating`, rider2, { stars: 3 }).expect(201);
      const view = await publicView();
      expect(view.operator.rating).toMatchObject({ average: 4, count: 2 });
      expect(view.operator.reviews).toEqual([expect.objectContaining({ stars: 5, comment: "Smooth journey, very punctual driver.", name: "Meera" })]);
      expect(JSON.stringify(view.operator.reviews)).not.toContain("Sharma");
      // The rating also appears on the search card of the organiser's other departures.
      const next = await openDeparture(ctx, ownerA, s.a.tourId, s.a.vehicleId, { daysAhead: 15 });
      const found = (await ctx.get("/v1/yatra/search?destination=Vrindavan").expect(200)).body.data.find((d: any) => d.departureCode === next.code);
      expect(found.operator.rating).toMatchObject({ average: 4, count: 2 });
      expect(found.operator.yearsInBusiness).toBeDefined();
    });
  });

  // ======================================================= double-decker sleeper
  describe("double-decker sleeper bus", () => {
    it("sells lower and upper deck berths from one inventory and shows them by deck", async () => {
      const vehicle = await ctx.post("/v1/yatra/operator/vehicles", ownerA, { registrationNumber: "UP85 DD 4040", seatCapacity: 10, layoutTemplate: "sleeper_double", images: ["https://res.cloudinary.com/test/image/upload/bus.jpg"] }).expect(201);
      const layout = vehicle.body.data.seatLayout;
      expect(layout.template).toBe("sleeper_double");
      expect(layout.seats.filter((x: any) => x.deck === "lower")).toHaveLength(5);
      expect(layout.seats.filter((x: any) => x.deck === "upper")).toHaveLength(5);
      for (const documentType of ["registration_certificate", "insurance", "tourist_permit"]) await ctx.upload("/v1/yatra/operator/documents", ownerA, { documentType, vehicleId: vehicle.body.data.id }).expect(201);
      await ctx.post(`/v1/yatra/operator/vehicles/${vehicle.body.data.id}/submit`, ownerA).expect(201);
      await ctx.post(`/v1/yatra/admin/vehicles/${vehicle.body.data.id}/review`, admin, { action: "approve" }).expect(201);
      const dep = await openDeparture(ctx, ownerA, s.a.tourId, vehicle.body.data.id, { daysAhead: 9 });
      const map = (await ctx.get(`/v1/yatra/departures/${dep.code}/seats`).expect(200)).body.data.seats;
      expect(map).toHaveLength(10);
      expect(map.filter((x: any) => x.deck === "upper").map((x: any) => x.seatNo).sort()).toEqual(["10", "6", "7", "8", "9"]);
      expect(map.every((x: any) => x.kind === "sleeper")).toBe(true);
      const view = (await ctx.get(`/v1/yatra/departures/${dep.code}`).expect(200)).body.data;
      expect(view.vehicle).toMatchObject({ images: ["https://res.cloudinary.com/test/image/upload/bus.jpg"], rcVerified: true });
      // An upper-deck berth is sold exactly once.
      const buyers = await Promise.all([ctx.newUser("customer", "Upper One"), ctx.newUser("customer", "Upper Two")]);
      const holds = await Promise.all(buyers.map((u) => ctx.post("/v1/yatra/bookings", u, { departureCode: dep.code, boardingPointId: dep.boardingPointId, seats: ["8"], passengers: [{ name: u.name }], contact: { name: u.name, phone: "9876543210" } })));
      expect(holds.map((h) => h.status).sort()).toEqual([201, 409]);
    });
  });

  // ============================ trip details, live location, full-bus requests
  describe("trip details, live location and full-bus requests", () => {
    const vehicleId = () => s.a.vehicleId as string;
    const newDeparture = async (extra: Record<string, unknown> = {}, daysAhead = 12) => {
      const created = await ctx.post("/v1/yatra/operator/departures", ownerA, {
        tourId: s.a.tourId,
        vehicleId: vehicleId(),
        departAt: new Date(Date.now() + daysAhead * 86_400_000).toISOString(),
        seatMode: "choose",
        boardingPoints: [{ name: "Kashmere Gate ISBT", time: new Date(Date.now() + daysAhead * 86_400_000).toISOString() }],
        ...extra,
      }).expect(201);
      await ctx.post(`/v1/yatra/operator/departures/${created.body.data.id}/open`, ownerA).expect(201);
      return created.body.data;
    };

    it("stores boarding and dropping points with times and rest stops, and asks for a dropping point when there are some", async () => {
      const at = (hours: number) => new Date(Date.now() + 12 * 86_400_000 + hours * 3_600_000).toISOString();
      const dep = await newDeparture({
        returnAt: at(48),
        droppingPoints: [{ name: "Vrindavan Bus Stand", time: at(9) }, { name: "Mathura Junction", time: at(10) }],
        restStops: [{ name: "Haveli Dhaba, NH-19", time: at(4), durationMinutes: 30 }],
        charterEnabled: true,
      });
      expect(dep.droppingPoints).toHaveLength(2);
      expect(dep.restStops).toMatchObject([{ name: "Haveli Dhaba, NH-19", durationMinutes: 30 }]);
      expect(dep.charterEnabled).toBe(true);
      const view = (await ctx.get(`/v1/yatra/departures/${dep.departureCode}`).expect(200)).body.data.departure;
      expect(view.droppingPoints.map((p: any) => p.name)).toEqual(["Vrindavan Bus Stand", "Mathura Junction"]);
      expect(view.restStops).toHaveLength(1);
      const rider = await ctx.newUser("customer", "Dropping Rider");
      const base = { departureCode: dep.departureCode, boardingPointId: dep.boardingPoints[0].id, seats: ["3"], passengers: [{ name: "Rider One" }], contact: { name: "Rider One", phone: "9876543210" } };
      const missing = await ctx.post("/v1/yatra/bookings", rider, base).expect(400);
      expect(missing.body.code).toBe("DROPPING_POINT_REQUIRED");
      await ctx.post("/v1/yatra/bookings", rider, { ...base, droppingPointId: "not-a-point" }).expect(400);
      const held = await ctx.post("/v1/yatra/bookings", rider, { ...base, droppingPointId: dep.droppingPoints[1].id }).expect(201);
      expect(held.body.data).toMatchObject({ droppingPointName: "Mathura Junction" });
      // A rest stop that falls long after the trip has ended is rejected.
      await ctx.post("/v1/yatra/operator/departures", ownerA, { tourId: s.a.tourId, vehicleId: vehicleId(), departAt: at(0), returnAt: at(24), boardingPoints: [{ name: "X Gate" }], restStops: [{ name: "Late stop", time: at(24 * 5) }] }).expect(400);
    });

    it("shows an organiser's own policies, and Tirvona's wording for the ones left empty", async () => {
      const tour = await ctx.post("/v1/yatra/operator/tours", ownerA, {
        title: "Policy Yatra", originCity: "Delhi", destinationCity: "Mathura", durationDays: 2, baseFare: 1200, summary: "Darshan",
        itinerary: [{ dayNumber: 1, title: "Day one" }], inclusions: ["Bus"],
        otherPolicies: { petsPolicy: "Small pets in a carrier are welcome.", childPolicy: "  " },
      }).expect(201);
      expect(tour.body.data.otherPolicies).toEqual({ petsPolicy: "Small pets in a carrier are welcome." });
      const policies = tour.body.data.policies as Array<{ key: string; text: string; custom: boolean }>;
      expect(policies).toHaveLength(5);
      expect(policies.find((p) => p.key === "petsPolicy")).toMatchObject({ custom: true, text: "Small pets in a carrier are welcome." });
      expect(policies.find((p) => p.key === "alcoholPolicy")).toMatchObject({ custom: false });
      await ctx.post("/v1/yatra/operator/tours", ownerA, { title: "Bad Policy", originCity: "Delhi", destinationCity: "Mathura", durationDays: 2, baseFare: 1200, otherPolicies: { petsPolicy: "x".repeat(501) } }).expect(400);
    });

    it("ties rating tags to real ratings and counts stars for the distribution bars", async () => {
      const [r1, r2] = await Promise.all([ctx.newUser("customer", "Tag One"), ctx.newUser("customer", "Tag Two")]);
      const trip = await openDeparture(ctx, ownerA, s.a.tourId, vehicleId(), { daysAhead: 7 });
      const b1 = await bookAndPay(ctx, r1, trip, ["4"]);
      const b2 = await bookAndPay(ctx, r2, trip, ["5"]);
      await ctx.rows("UPDATE public.yatra_departures SET depart_at = now() - interval '3 days', return_at = now() - interval '1 day' WHERE id = $1", [trip.departureId]);
      await ctx.post(`/v1/yatra/bookings/${b1.bookingId}/rating`, r1, { stars: 5, tags: ["Punctual", "Clean bus"] }).expect(201);
      await ctx.post(`/v1/yatra/bookings/${b2.bookingId}/rating`, r2, { stars: 4, tags: ["Punctual", "Safe driving", "Punctual"] }).expect(400); // duplicate tag
      await ctx.post(`/v1/yatra/bookings/${b2.bookingId}/rating`, r2, { stars: 4, tags: ["Free biryani"] }).expect(400); // unknown tag
      await ctx.post(`/v1/yatra/bookings/${b2.bookingId}/rating`, r2, { stars: 4, tags: ["Punctual", "Safe driving"] }).expect(201);
      const rating = (await ctx.get(`/v1/yatra/departures/${trip.code}`).expect(200)).body.data.operator.rating;
      expect(rating.breakdown.slice(0, 2).every((n: number) => n >= 1)).toBe(true);
      expect(rating.tags[0]).toMatchObject({ tag: "Punctual", count: 2 });
    });

    it("lets only the organiser's team share the bus location, only inside the trip window, and only paid pilgrims see it", async () => {
      const rider = await ctx.newUser("customer", "Live Rider");
      const stranger = await ctx.newUser("customer", "Not A Rider");
      const dep = await newDeparture();
      const booked = await bookAndPay(ctx, rider, { code: dep.departureCode, boardingPointId: dep.boardingPoints[0].id }, ["1"]);
      const fix = { latitude: 28.6692, longitude: 77.2285, speedKmph: 54, accuracyM: 12 };
      // 12 days before departure: too early.
      const early = await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location`, ownerA, fix).expect(409);
      expect(early.body.code).toBe("LOCATION_NOT_ALLOWED");
      expect((await ctx.get(`/v1/yatra/bookings/${booked.bookingId}/tracking`, rider).expect(200)).body.data.state).toBe("not_started");
      // The morning of the trip.
      await ctx.rows("UPDATE public.yatra_departures SET depart_at = now() + interval '2 hours', return_at = now() + interval '30 hours' WHERE id = $1", [dep.id]);
      await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location`, ownerA, { latitude: 120, longitude: 77 }).expect(400);
      await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location`, ownerB, fix).expect(404); // another organiser
      await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location`, rider, fix).expect(404); // not an organiser
      const started = await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location`, ownerA, fix).expect(201);
      expect(started.body.data).toMatchObject({ sharing: true, startedNow: true });
      expect((await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location`, ownerA, { ...fix, latitude: 28.67 }).expect(201)).body.data.startedNow).toBe(false);
      const live = (await ctx.get(`/v1/yatra/bookings/${booked.bookingId}/tracking`, rider).expect(200)).body.data;
      expect(live).toMatchObject({ state: "live", position: { latitude: 28.67, longitude: 77.2285 } });
      // Strangers and other organisers cannot see it.
      await ctx.get(`/v1/yatra/bookings/${booked.bookingId}/tracking`, stranger).expect(404);
      expect((await ctx.get(`/v1/yatra/operator/departures/${dep.id}/location`, ownerA).expect(200)).body.data).toMatchObject({ sharing: true, canShare: true });
      expect((await ctx.get(`/v1/yatra/admin/departures/${dep.id}/location`, admin).expect(200)).body.data.state).toBe("live");
      // An old position is shown as stale rather than live.
      await ctx.rows("UPDATE public.yatra_trip_locations SET recorded_at = now() - interval '20 minutes' WHERE departure_id = $1", [dep.id]);
      expect((await ctx.get(`/v1/yatra/bookings/${booked.bookingId}/tracking`, rider).expect(200)).body.data.state).toBe("stale");
      // Stopping removes the position from view.
      await ctx.post(`/v1/yatra/operator/departures/${dep.id}/location/stop`, ownerA).expect(201);
      expect((await ctx.get(`/v1/yatra/bookings/${booked.bookingId}/tracking`, rider).expect(200)).body.data).toMatchObject({ state: "paused", position: null });
      // Long after the trip nothing is shown.
      await ctx.rows("UPDATE public.yatra_departures SET depart_at = now() - interval '5 days', return_at = now() - interval '4 days' WHERE id = $1", [dep.id]);
      expect((await ctx.get(`/v1/yatra/bookings/${booked.bookingId}/tracking`, rider).expect(200)).body.data).toMatchObject({ state: "ended", position: null });
    });

    it("moves a full-bus request through organiser acceptance to normal payment, and refuses it when it cannot be honoured", async () => {
      const pilgrim = await ctx.newUser("customer", "Group Leader");
      const other = await ctx.newUser("customer", "Another Group");
      const dep = await newDeparture({ charterEnabled: true });
      const request = { departureCode: dep.departureCode, groupSize: 20, contact: { name: "Group Leader", phone: "9876543210" }, message: "Our satsang group of 20." };
      // Not offered on a departure whose organiser did not switch it on.
      const plain = await newDeparture({ charterEnabled: false });
      expect((await ctx.post("/v1/yatra/charter-requests", pilgrim, { ...request, departureCode: plain.departureCode }).expect(409)).body.code).toBe("CHARTER_NOT_OFFERED");
      await ctx.post("/v1/yatra/charter-requests", pilgrim, { ...request, groupSize: 0 }).expect(400);
      const created = await ctx.post("/v1/yatra/charter-requests", pilgrim, request).expect(201);
      expect(created.body.data).toMatchObject({ status: "requested", groupSize: 20 });
      expect(created.body.data.wholeBusSeats).toBeGreaterThan(0);
      expect((await ctx.post("/v1/yatra/charter-requests", pilgrim, request).expect(409)).body.code).toBe("ALREADY_REQUESTED");
      // Only the organiser that owns the departure sees and answers it.
      const mine = (await ctx.get("/v1/yatra/operator/charter-requests", ownerA).expect(200)).body.data;
      expect(mine.map((r: any) => r.id)).toContain(created.body.data.id);
      expect((await ctx.get("/v1/yatra/operator/charter-requests", ownerB).expect(200)).body.data.map((r: any) => r.id)).not.toContain(created.body.data.id);
      await ctx.post(`/v1/yatra/operator/charter-requests/${created.body.data.id}/respond`, ownerB, { action: "accept" }).expect(404);
      await ctx.post(`/v1/yatra/operator/charter-requests/${created.body.data.id}/respond`, ownerA, { action: "maybe" }).expect(400);
      const accepted = await ctx.post(`/v1/yatra/operator/charter-requests/${created.body.data.id}/respond`, ownerA, { action: "accept", note: "Happy to take your group." }).expect(201);
      expect(accepted.body.data).toMatchObject({ status: "accepted", organiserNote: "Happy to take your group." });
      const bookingId = accepted.body.data.bookingId as string;
      // Every seat is held for the pilgrim, who still has to pay Tirvona; the organiser confirms nothing.
      const held = (await ctx.get(`/v1/yatra/bookings/${bookingId}`, pilgrim).expect(200)).body.data.booking;
      expect(held).toMatchObject({ status: "held", paymentStatus: "unpaid", seatCount: accepted.body.data.wholeBusSeats });
      expect(held.pricing.totalAmount).toBe(accepted.body.data.wholeBusPrice);
      expect((await ctx.get(`/v1/yatra/departures/${dep.departureCode}`).expect(200)).body.data.departure.seatsLeft).toBe(0);
      await ctx.post(`/v1/yatra/operator/charter-requests/${created.body.data.id}/respond`, ownerA, { action: "decline" }).expect(409);
      // A second group cannot ask for a bus that is already taken.
      expect((await ctx.post("/v1/yatra/charter-requests", other, request).expect(409)).body.code).toBe("SEATS_TAKEN");
      const order = await ctx.post(`/v1/yatra/bookings/${bookingId}/payment-order`, pilgrim).expect(201);
      const paid = await ctx.post(`/v1/yatra/bookings/${bookingId}/confirm-payment`, pilgrim, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
      expect(paid.body.data.booking).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    });

    it("lets the organiser decline, and the pilgrim withdraw, a full-bus request", async () => {
      const a = await ctx.newUser("customer", "Decline Me");
      const b = await ctx.newUser("customer", "Withdraw Me");
      const dep = await newDeparture({ charterEnabled: true });
      const make = (user: any) => ctx.post("/v1/yatra/charter-requests", user, { departureCode: dep.departureCode, groupSize: 10, contact: { name: user.name, phone: "9876543210" } }).expect(201);
      const first = await make(a);
      const declined = await ctx.post(`/v1/yatra/operator/charter-requests/${first.body.data.id}/respond`, ownerA, { action: "decline", note: "Bus is reserved." }).expect(201);
      expect(declined.body.data).toMatchObject({ status: "declined", bookingId: null });
      expect((await ctx.get("/v1/yatra/charter-requests", a).expect(200)).body.data[0]).toMatchObject({ status: "declined", organiserNote: "Bus is reserved." });
      const second = await make(b);
      await ctx.post(`/v1/yatra/charter-requests/${second.body.data.id}/cancel`, a).expect(404); // not theirs
      expect((await ctx.post(`/v1/yatra/charter-requests/${second.body.data.id}/cancel`, b).expect(201)).body.data.status).toBe("cancelled");
      // Nothing was held in either case.
      expect((await ctx.get(`/v1/yatra/departures/${dep.departureCode}`).expect(200)).body.data.departure.seatsLeft).toBeGreaterThan(0);
    });
  });

  // ========================= seat plans, per-seat rates, cancellation protection
  describe("seat plans, per-seat rates and cancellation protection", () => {
    const hold = (user: TestUser, dep: { code: string; boardingPointId: string }, seats: string[], extra: Record<string, unknown> = {}) =>
      ctx.post("/v1/yatra/bookings", user, { departureCode: dep.code, boardingPointId: dep.boardingPointId, seats, passengers: seats.map((_, i) => ({ name: `Traveller ${i + 1}` })), contact: { name: user.name, phone: "9876543210" }, ...extra });
    const pay = async (user: TestUser, bookingId: string) => {
      const order = await ctx.post(`/v1/yatra/bookings/${bookingId}/payment-order`, user).expect(201);
      return ctx.post(`/v1/yatra/bookings/${bookingId}/confirm-payment`, user, { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: demoPay() }).expect(201);
    };

    it("builds any left/right seat plan, such as 2 + 3 or 1 + 2, and refuses nonsense", async () => {
      const cases: Array<[string, number, number[]]> = [["2x3", 6, [0, 1, 3, 4, 5]], ["1x2", 4, [0, 2, 3]], ["sleeper_3x2", 6, [0, 1, 2, 4, 5]]];
      for (const [i, [template, columns, used]] of cases.entries()) {
        const vehicle = await ctx.post("/v1/yatra/operator/vehicles", ownerA, { registrationNumber: `UP85 LR 70${i}1`, seatCapacity: 10, layoutTemplate: template }).expect(201);
        const layout = vehicle.body.data.seatLayout;
        expect(layout.columns).toBe(columns);
        expect([...new Set(layout.seats.map((x: any) => x.col))].sort()).toEqual(used);
        expect(layout.seats).toHaveLength(10);
        expect(layout.seats.every((x: any) => x.kind === (template.startsWith("sleeper") ? "sleeper" : "seater"))).toBe(true);
      }
      await ctx.post("/v1/yatra/operator/vehicles", ownerA, { registrationNumber: "UP85 LR 7099", seatCapacity: 10, layoutTemplate: "5x5" }).expect(400);
    });

    it("sells each seat at its own rate, and every other seat at the default fare", async () => {
      const created = await ctx.post("/v1/yatra/operator/departures", ownerA, {
        tourId: s.a.tourId, vehicleId: s.a.vehicleId, departAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        boardingPoints: [{ name: "Kashmere Gate ISBT" }], seatFares: { "1": 2000, "2": 900, "6": 1500 },
      }).expect(201);
      const dep = created.body.data;
      expect(dep.seatFares).toEqual({ "1": 2000, "2": 900 }); // seat 6 equals the default fare, so it is not stored
      await ctx.post("/v1/yatra/operator/departures", ownerA, { tourId: s.a.tourId, vehicleId: s.a.vehicleId, departAt: dep.departAt, boardingPoints: [{ name: "X" }], seatFares: { "99": 500 } }).expect(400);
      await ctx.post("/v1/yatra/operator/departures", ownerA, { tourId: s.a.tourId, vehicleId: s.a.vehicleId, departAt: dep.departAt, boardingPoints: [{ name: "X" }], seatFares: { "3": 0 } }).expect(400);
      await ctx.post(`/v1/yatra/operator/departures/${dep.id}/open`, ownerA).expect(201);
      const map = (await ctx.get(`/v1/yatra/departures/${dep.departureCode}/seats`).expect(200)).body.data.seats;
      const priceOf = (no: string) => map.find((x: any) => x.seatNo === no).price;
      expect([priceOf("1"), priceOf("2"), priceOf("3")]).toEqual([2000, 900, 1500]);
      const card = (await ctx.get("/v1/yatra/search?destination=Vrindavan&limit=100").expect(200)).body.data.find((x: any) => x.departureCode === dep.departureCode);
      expect(card.fromFare).toBe(900);

      const rider = await ctx.newUser("customer", "Rate Rider");
      const held = await hold(rider, { code: dep.departureCode, boardingPointId: dep.boardingPoints[0].id }, ["1", "3", "2"]).expect(201);
      expect(held.body.data.pricing).toMatchObject({ subtotal: 4400, totalAmount: 4400, protectionFee: 0 }); // 2000 + 1500 + 900
      // A rate can change while the departure is open, but not for a seat somebody holds or has bought.
      await ctx.patch(`/v1/yatra/operator/departures/${dep.id}`, ownerA, { seatFares: { "1": 2500, "2": 900 } }).expect(409);
      const changed = await ctx.patch(`/v1/yatra/operator/departures/${dep.id}`, ownerA, { seatFares: { "1": 2000, "2": 900, "5": 1800 } }).expect(200);
      expect(changed.body.data.seatFares).toEqual({ "1": 2000, "2": 900, "5": 1800 });
      expect((await ctx.get(`/v1/yatra/departures/${dep.departureCode}/seats`).expect(200)).body.data.seats.find((x: any) => x.seatNo === "5").price).toBe(1800);
    });

    it("adds a protection fee per seat, refunds the whole fare on an early cancellation, and never refunds or commissions the fee", async () => {
      const rider = await ctx.newUser("customer", "Protected Rider");
      const dep = await openDeparture(ctx, ownerA, s.a.tourId, s.a.vehicleId, { daysAhead: 20 });
      const held = await hold(rider, dep, ["7", "8"], { cancellationProtection: true }).expect(201);
      expect(held.body.data.pricing).toMatchObject({ protected: true, protectionFee: 30, subtotal: 3000, totalAmount: 3030 });
      const paid = await pay(rider, held.body.data.id);
      expect(paid.body.data.booking.pricing).toMatchObject({ amountPaid: 3030, protectionFee: 30 });
      // Commission, GST and TDS are worked out on the fare (3000), not on the fee.
      const entries = Object.fromEntries((await ctx.rows("SELECT entry_type, amount FROM public.yatra_payee_entries WHERE booking_id = $1", [held.body.data.id])).map((r) => [r.entry_type, Number(r.amount)]));
      expect(entries).toMatchObject({ gross_earning: 3000, commission: 300, tax_on_commission: 54, tds: 30 });
      // 20 days ahead the policy alone would refund 90%; protection makes it the whole fare.
      const preview = (await ctx.get(`/v1/yatra/bookings/${held.body.data.id}/refund-preview`, rider).expect(200)).body.data;
      expect(preview).toMatchObject({ refundPercent: 100, refundAmount: 3000 });
      await ctx.post(`/v1/yatra/bookings/${held.body.data.id}/cancel-request`, rider, { reason: "Plans changed" }).expect(201);
      const before = await wallet(rider);
      await ctx.post(`/v1/yatra/admin/bookings/${held.body.data.id}/cancellation`, admin, { decision: "approve", note: "Protected booking" }).expect(201);
      expect(await wallet(rider)).toBe(before + 3000); // the 30 fee stays with Tirvona
      const [row] = await ctx.rows("SELECT payment_status FROM public.yatra_bookings WHERE id = $1", [held.body.data.id]);
      expect(row.payment_status).toBe("refunded");
      const after = Object.fromEntries((await ctx.rows("SELECT entry_type, amount FROM public.yatra_payee_entries WHERE booking_id = $1", [held.body.data.id])).map((r) => [r.entry_type, Number(r.amount)]));
      expect(after).toMatchObject({ refund_deduction: 3000, commission_reversal: 300 });

      // Without protection the same cancellation follows the policy (90% of 1500).
      const plain = await ctx.newUser("customer", "Plain Rider");
      const plainBooking = await bookAndPay(ctx, plain, dep, ["10"]);
      expect((await ctx.get(`/v1/yatra/bookings/${plainBooking.bookingId}/refund-preview`, plain).expect(200)).body.data).toMatchObject({ refundPercent: 90, refundAmount: 1350 });
    });

    it("does not give the full refund once the cancellation is closer to departure than the cutoff", async () => {
      const rider = await ctx.newUser("customer", "Late Protected Rider");
      const dep = await openDeparture(ctx, ownerA, s.a.tourId, s.a.vehicleId, { daysAhead: 20 });
      const held = await hold(rider, dep, ["11"], { cancellationProtection: true }).expect(201);
      expect(held.body.data.pricing).toMatchObject({ protectionFee: 15, totalAmount: 1515 });
      await pay(rider, held.body.data.id);
      await ctx.rows("UPDATE public.yatra_bookings SET depart_at = now() + interval '3 hours' WHERE id = $1", [held.body.data.id]);
      expect((await ctx.get(`/v1/yatra/bookings/${held.body.data.id}/refund-preview`, rider).expect(200)).body.data).toMatchObject({ refundPercent: 0, refundAmount: 0 });
    });


    it("shows each itinerary day with its date, start time and breaks, and prices the stay, food and taxi a pilgrim adds", async () => {
      const dep = await openDeparture(ctx, ownerA, s.a.tourId, s.a.vehicleId, { daysAhead: 20 });
      const tour = (await ctx.get(`/v1/yatra/departures/${dep.code}`).expect(200)).body.data.tour;
      expect(tour.itinerary[0]).toMatchObject({ date: "2026-12-01", time: "06:30", breaks: [{ place: "Mathura highway dhaba", time: "09:00", minutes: 30 }] });
      // Only what the partner offered is listed; a taxi they did not offer is ignored when asked for.
      expect(tour.serviceAddOns.map((a: any) => [a.key, a.price])).toEqual([["stay", 400], ["food", 150]]);
      const rider = await ctx.newUser("customer", "Add-on Rider");
      const held = await hold(rider, dep, ["20", "21"], { addOns: ["food", "taxi"] }).expect(201);
      expect(held.body.data.pricing).toMatchObject({ subtotal: 3000, addOnsTotal: 300, totalAmount: 3300 });
      expect(held.body.data.pricing.addOns).toEqual([{ key: "food", title: "Food and meals", price: 150, amount: 300 }]);
      await ctx.post("/v1/yatra/operator/tours", ownerA, { title: "Bad Day", originCity: "Delhi", destinationCity: "Mathura", durationDays: 2, baseFare: 1200, itinerary: [{ dayNumber: 1, title: "x", time: "25:99" }] }).expect(400);
    });

    it("sends the ticket on WhatsApp once payment confirms: seats, points, rules, refund policy and the app link", async () => {
      const rider = await ctx.newUser("customer", "WhatsApp Rider");
      const dep = await openDeparture(ctx, ownerA, s.a.tourId, s.a.vehicleId, { daysAhead: 20 });
      const held = await hold(rider, dep, ["12", "13"], { cancellationProtection: true }).expect(201);
      // Nothing goes out while the booking is only held.
      expect(ctx.whatsappSent.filter((m) => m.bookingId === held.body.data.id)).toHaveLength(0);
      await pay(rider, held.body.data.id);
      const sent = ctx.whatsappSent.filter((m) => m.bookingId === held.body.data.id);
      expect(sent).toHaveLength(1);
      expect(sent[0].phone).toBe("9876543210");
      expect(sent[0].context).toMatchObject({
        seats: ["12", "13"],
        protectionFee: 30,
        appUrl: "https://play.google.com/store/apps/details?id=com.tirvona.app",
      });
      expect(sent[0].context.passengers).toHaveLength(2);
      expect(sent[0].context.refundLines.join(" ")).toMatch(/cancellation protection/);
      expect(sent[0].context.ruleLines.length).toBeGreaterThan(0);
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
