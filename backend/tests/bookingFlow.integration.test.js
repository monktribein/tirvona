// End-to-end verification of the ashram booking lifecycle against a REAL
// MongoDB (mongodb-memory-server), with the real schemas and the real unique
// indexes built. Nothing here touches the production Atlas cluster.
//
// Covers the full flow PR-1 unblocked: create -> coupon -> pay -> check-in ->
// check-out -> cancel, asserting the Payment, Booking and RoomAvailability
// documents at each step.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-config';
process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = (await import('mongoose')).default;

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'pr1_verify' });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const User = (await import('../src/models/User.js')).default;
const Ashram = (await import('../src/models/Ashram.js')).default;
const Room = (await import('../src/models/Room.js')).default;
const Booking = (await import('../src/models/Booking.js')).default;
const Payment = (await import('../src/models/Payment.js')).default;
const Offer = (await import('../src/models/Offer.js')).default;
const RoomAvailability = (await import('../src/models/RoomAvailability.js')).default;
const PlatformSettings = (await import('../src/models/PlatformSettings.js')).default;

const {
  createBooking,
  processBookingPayment,
  verifyCheckin,
  verifyCheckout,
  cancelBooking,
} = await import('../src/controllers/bookingController.js');
const { generateBookingId } = await import('../src/utils/bookingIds.js');

// ── Minimal express req/res doubles ─────────────────────────────────────────
const mockRes = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const mockReq = (over = {}) => ({
  body: {}, params: {}, query: {}, headers: { 'user-agent': 'node-test' },
  ip: '127.0.0.1', ...over,
});

const DAY = 24 * 60 * 60 * 1000;
const iso = (d) => new Date(d).toISOString().split('T')[0];

let customer, staff, ashram, room, offer;
const checkIn = new Date(Date.now() + 7 * DAY);
const checkOut = new Date(Date.now() + 9 * DAY); // 2 nights

before(async () => {
  await PlatformSettings.create({ key: 'main' }); // flat ₹49 fee, default

  const owner = await User.create({
    name: 'Owner', email: 'owner@test.com', phone: '9000000001',
    role: 'owner', status: 'active',
  });
  customer = await User.create({
    name: 'Pilgrim', email: 'pilgrim@test.com', phone: '9000000002',
    role: 'customer', status: 'active',
  });
  staff = await User.create({
    name: 'Admin', email: 'admin@test.com', phone: '9000000003',
    role: 'super_admin', status: 'active',
  });

  ashram = await Ashram.create({
    ownerId: owner._id, name: 'Test Ashram', description: 'Fixture ashram for the PR-1 flow verification.',
    address: { street: 'Ghat Road', city: 'Varanasi', district: 'Varanasi', state: 'UP', pincode: '221001' },
  });

  room = await Room.create({
    ashramId: ashram._id, name: 'Standard Twin', type: 'private_room',
    acType: 'Non-AC', capacity: 3, totalInventory: 5, basePrice: 1000,
  });

  offer = await Offer.create({
    ownerId: owner._id, offerTitle: 'Launch Offer', description: 'Test offer',
    promoCode: 'TEST10', discountType: 'Percentage', discountValue: 10,
    validFrom: new Date(Date.now() - DAY), validTill: new Date(Date.now() + 30 * DAY),
    maximumRedemptions: 100, remainingRedemptions: 100, status: 'active',
  });

  // Build the real indexes, including Booking.bookingId's unique constraint.
  await Booking.syncIndexes();
  await RoomAvailability.syncIndexes();
});

const createOne = async (over = {}) => {
  const req = mockReq({
    user: { id: customer._id.toString(), _id: customer._id, role: 'customer', status: 'active' },
    body: {
      ashramId: ashram._id.toString(), roomId: room._id.toString(),
      checkInDate: checkIn.toISOString(), checkOutDate: checkOut.toISOString(),
      guestsCount: 2, roomsBookedCount: 1, ...over,
    },
  });
  const res = mockRes();
  await createBooking(req, res);
  return res;
};

// ── 1. Create booking ───────────────────────────────────────────────────────
let bookingA;
test('1a. create booking — succeeds (the PR-1 fix)', async () => {
  const res = await createOne();
  assert.equal(res.statusCode, 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.success, true);
  bookingA = res.body.data;
  assert.match(bookingA.bookingId, /^TVN-[0-9A-Z]+-[0-9A-Z]{5}$/);
  assert.match(bookingA.checkInCode, /^[1-9][0-9]{5}$/);
  assert.equal(typeof bookingA.checkInCode, 'string');
});

test('1b. booking document — every field populated as expected', () => {
  assert.equal(bookingA.status, 'pending');
  assert.equal(bookingA.paymentStatus, 'pending');
  assert.equal(bookingA.roomsBookedCount, 1, 'roomsWanted must reach the document');
  assert.equal(bookingA.guestsCount, 2);
  // 2 nights x ₹1000 x 1 room
  assert.equal(bookingA.pricing.basePrice, 2000);
  assert.equal(bookingA.pricing.amountPaid, 0);
  assert.equal(bookingA.pricing.platformFee, 49);
  assert.equal(bookingA.pricing.gstAmount, 100); // 5% of 2000
  assert.equal(bookingA.pricing.totalAmount, 2149); // 2000 + 100 + 49
});

// ── 2. Apply coupon ─────────────────────────────────────────────────────────
test('2. apply coupon — discount applied and offer telemetry incremented', async () => {
  const before = await Offer.findById(offer._id);
  const res = await createOne({ promoCode: 'TEST10' });
  assert.equal(res.statusCode, 201);
  const b = res.body.data;
  assert.equal(b.pricing.discountAmount, 200, '10% of 2000');
  assert.equal(b.promoCode, 'TEST10');
  assert.equal(b.pricing.totalAmount, 2000 - 200 + 100 + 49);

  const after = await Offer.findById(offer._id);
  assert.equal(after.remainingRedemptions, before.remainingRedemptions - 1);
  assert.equal(after.redemptionsCount, (before.redemptionsCount || 0) + 1);
});

// ── 3. Complete payment ─────────────────────────────────────────────────────
test('3. complete payment — booking confirmed', async () => {
  const req = mockReq({
    user: { id: customer._id.toString(), _id: customer._id, role: 'customer', status: 'active' },
    params: { id: bookingA._id.toString() },
    body: { method: 'upi', transactionId: 'TXN-VERIFY-001' },
  });
  const res = mockRes();
  await processBookingPayment(req, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.status, 'confirmed');
  assert.equal(res.body.data.paymentStatus, 'fully_paid');
});

test('4. payment record — persisted and correct', async () => {
  const p = await Payment.findOne({ bookingId: bookingA._id });
  assert.ok(p, 'no Payment document written');
  assert.equal(p.status, 'success');
  assert.equal(p.amount, 2149);
  assert.equal(p.userId.toString(), customer._id.toString());
});

test('5. booking record — reloaded from DB matches', async () => {
  const b = await Booking.findById(bookingA._id);
  assert.equal(b.status, 'confirmed');
  assert.equal(b.pricing.amountPaid, 2149);
  assert.equal(b.history.at(-1).status, 'confirmed');
});

test('6. room inventory — locked for every night of the stay', async () => {
  for (const d of [iso(checkIn), iso(new Date(checkIn.getTime() + DAY))]) {
    const av = await RoomAvailability.findOne({ roomId: room._id, date: new Date(d) });
    assert.ok(av, `no availability row for ${d}`);
    assert.equal(av.bookedCount, 1, `night ${d} not locked`);
  }
});

// ── 7/8. Check-in and check-out ─────────────────────────────────────────────
test('7. check-in — accepts the generated code, rejects a wrong one', async () => {
  const staffUser = { id: staff._id.toString(), _id: staff._id, role: 'super_admin', status: 'active' };

  const bad = mockRes();
  await verifyCheckin(mockReq({ user: staffUser, params: { id: bookingA._id.toString() }, body: { checkInCode: '000000' } }), bad);
  assert.equal(bad.statusCode, 400, 'a wrong code must be rejected');

  const ok = mockRes();
  await verifyCheckin(mockReq({ user: staffUser, params: { id: bookingA._id.toString() }, body: { checkInCode: bookingA.checkInCode } }), ok);
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.status, 'checked_in');
});

test('8. check-out — completes and releases inventory', async () => {
  const res = mockRes();
  await verifyCheckout(mockReq({
    user: { id: staff._id.toString(), _id: staff._id, role: 'super_admin', status: 'active' },
    params: { id: bookingA._id.toString() },
  }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.status, 'checked_out');

  const av = await RoomAvailability.findOne({ roomId: room._id, date: new Date(iso(checkIn)) });
  assert.equal(av.bookedCount, 0, 'inventory not released on check-out');
});

// ── 9/10. Cancellation and refund ───────────────────────────────────────────
test('9+10. cancellation — releases inventory and records the refund', async () => {
  const created = await createOne();
  const bookingB = created.body.data;

  const payRes = mockRes();
  await processBookingPayment(mockReq({
    user: { id: customer._id.toString(), _id: customer._id, role: 'customer', status: 'active' },
    params: { id: bookingB._id.toString() },
    body: { method: 'upi', transactionId: 'TXN-VERIFY-002' },
  }), payRes);
  assert.equal(payRes.statusCode, 200);

  const locked = await RoomAvailability.findOne({ roomId: room._id, date: new Date(iso(checkIn)) });
  assert.equal(locked.bookedCount, 1);

  const res = mockRes();
  await cancelBooking(mockReq({
    user: { id: customer._id.toString(), _id: customer._id, role: 'customer', status: 'active' },
    params: { id: bookingB._id.toString() },
    body: { reason: 'verification run' },
  }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  const b = await Booking.findById(bookingB._id);
  assert.equal(b.status, 'cancelled');
  assert.equal(b.paymentStatus, 'refunded');
  assert.equal(b.cancellation.refundAmount, 2149);
  assert.match(b.cancellation.refundTransactionId, /^REF-/);
  assert.equal(b.pricing.amountPaid, 0);

  const released = await RoomAvailability.findOne({ roomId: room._id, date: new Date(iso(checkIn)) });
  assert.equal(released.bookedCount, 0, 'inventory not released on cancellation');
});

// ── Step 3: concurrent uniqueness against the REAL unique index ─────────────
test('concurrency — 1000 concurrent inserts, unique index enforced, zero duplicates', async () => {
  const base = {
    customerId: customer._id, ashramId: ashram._id, roomId: room._id,
    checkInDate: checkIn, checkOutDate: checkOut, guestsCount: 1, roomsBookedCount: 1,
    pricing: { basePrice: 1000, servicesPrice: 0, donationAmount: 0, totalAmount: 1000, amountPaid: 0 },
    checkInCode: '123456',
  };

  const results = await Promise.allSettled(
    Array.from({ length: 1000 }, () => Booking.create({ ...base, bookingId: generateBookingId() }))
  );

  const ok = results.filter((r) => r.status === 'fulfilled');
  const dupKey = results.filter((r) => r.status === 'rejected' && r.reason?.code === 11000);
  const other = results.filter((r) => r.status === 'rejected' && r.reason?.code !== 11000);

  assert.equal(other.length, 0, `unexpected errors: ${other[0]?.reason?.message}`);
  assert.equal(dupKey.length, 0, `${dupKey.length} duplicate-key collisions on bookingId`);
  assert.equal(ok.length, 1000);

  const distinct = await Booking.distinct('bookingId');
  assert.equal(distinct.length, await Booking.countDocuments(), 'duplicate bookingId present in collection');
});
