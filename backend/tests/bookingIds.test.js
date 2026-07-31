import test from 'node:test';
import assert from 'node:assert/strict';

import { generateBookingId, generateCheckInCode } from '../src/utils/bookingIds.js';

// The unambiguous alphabet: no I, L, O or U, so a guest reading a reference
// aloud cannot be misheard.
const UNAMBIGUOUS = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/;

test('generateBookingId — shape is TVN-<time>-<5 random>', () => {
  assert.match(generateBookingId(), /^TVN-[0-9A-Z]+-[0-9A-Z]{5}$/);
});

test('generateBookingId — uses only unambiguous characters', () => {
  for (let i = 0; i < 500; i += 1) {
    const parts = generateBookingId().split('-');
    assert.equal(parts.length, 3);
    assert.equal(parts[0], 'TVN');
    assert.match(parts[1], UNAMBIGUOUS, 'time segment leaked an ambiguous character');
    assert.match(parts[2], UNAMBIGUOUS, 'random segment leaked an ambiguous character');
  }
});

test("generateBookingId — fits Razorpay's 40-character receipt limit", () => {
  // Passed straight through as the Razorpay order `receipt`.
  assert.ok(generateBookingId().length <= 40);
});

test('generateBookingId — no duplicates across 10,000 rapid calls', () => {
  // Booking.bookingId carries a unique index. This exercises the worst case the
  // time prefix has to survive: every call landing in the same few milliseconds.
  const seen = new Set();
  for (let i = 0; i < 10_000; i += 1) seen.add(generateBookingId());
  assert.equal(seen.size, 10_000);
});

test('generateBookingId — is not deterministic', () => {
  assert.notEqual(generateBookingId(), generateBookingId());
});

test('generateCheckInCode — returns a String, not a Number', () => {
  // Load-bearing: verifyCheckin compares with `!==` against the string the
  // reception form posts. A Number here would fail every check-in.
  assert.equal(typeof generateCheckInCode(), 'string');
});

test('generateCheckInCode — is exactly six digits with no leading zero', () => {
  for (let i = 0; i < 1000; i += 1) {
    const code = generateCheckInCode();
    assert.match(code, /^[1-9][0-9]{5}$/);
  }
});

test('generateCheckInCode — survives a strict-equality round trip', () => {
  const code = generateCheckInCode();
  // Mirrors bookingController.verifyCheckin: `booking.checkInCode !== req.body.checkInCode`
  assert.equal(code === String(code), true);
  assert.equal(code !== Number(code), true, 'a Number must never compare equal');
});

test('generateCheckInCode — is well distributed, not constant', () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i += 1) seen.add(generateCheckInCode());
  // 1000 draws from 900k values: collisions are possible but clustering is not.
  assert.ok(seen.size > 950, `expected >950 distinct codes, got ${seen.size}`);
});
