// Integration coverage for the User serialization layer.
//
// The unit tests run against a plain object. This file runs against a REAL
// persisted Mongoose document, hydrated from a real MongoDB, because a hydrated
// document behaves differently from a POJO: it carries getters, virtuals, an
// `id` virtual, `_doc`, and a `toJSON` of its own. A serializer that is correct
// for a POJO can still leak through a document.
//
// It also asserts the property PR-2's whole design rests on: shaping the
// RESPONSE must leave the DOCUMENT complete, so authentication internals keep
// working inside backend logic and middleware.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-config';
process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = (await import('mongoose')).default;

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'serializer_verify' });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const User = (await import('../src/models/User.js')).default;
const {
  serializeUser, serializeUsers, USER_VIEWS, INTERNAL_ONLY_FIELDS,
} = await import('../src/serializers/userSerializer.js');

const PLAIN_PASSWORD = 'SuperSecret123';
let persisted;

before(async () => {
  persisted = await User.create({
    name: 'Integration Person', email: 'integration@test.com', phone: '9222222222',
    passwordHash: PLAIN_PASSWORD, // hashed by the pre-save hook
    role: 'manager', status: 'active',
    aadhaarId: '999988887777',
    govtId: { idType: 'Aadhaar', idNumber: '999988887777', documentUrl: 'https://x/doc.pdf' },
    googleId: 'google-sub-123456',
    district: 'Varanasi', state: 'UP',
    permissions: ['bookings.read'],
    deviceSessions: [{ token: 'device-session-token', deviceName: 'iPhone', ipAddress: '1.2.3.4' }],
  });
});

// ── Hydrated documents ──────────────────────────────────────────────────────
test('a hydrated document serializes with no internal field, in every view', async () => {
  const doc = await User.findById(persisted._id);
  for (const view of USER_VIEWS) {
    const keys = Object.keys(serializeUser(doc, view));
    for (const forbidden of INTERNAL_ONLY_FIELDS) {
      assert.ok(!keys.includes(forbidden), `view '${view}' leaks '${forbidden}' from a hydrated doc`);
    }
  }
});

test('what actually reaches the wire carries no secret value', async () => {
  const doc = await User.findById(persisted._id);
  const secrets = [doc.passwordHash, '999988887777', 'google-sub-123456', 'device-session-token'];
  for (const view of USER_VIEWS) {
    // res.json() runs JSON.stringify — this is the real wire format.
    const wire = JSON.stringify({ success: true, data: serializeUser(doc, view) });
    for (const secret of secrets) {
      assert.ok(!wire.includes(secret), `view '${view}' put '${String(secret).slice(0, 12)}...' on the wire`);
    }
  }
});

test('a .lean() object serializes identically to a hydrated document', async () => {
  const hydrated = await User.findById(persisted._id);
  const lean = await User.findById(persisted._id).lean();
  for (const view of USER_VIEWS) {
    assert.deepEqual(
      Object.keys(serializeUser(lean, view)).sort(),
      Object.keys(serializeUser(hydrated, view)).sort(),
      `view '${view}' differs between lean and hydrated`
    );
  }
});

test('serializeUsers over a real query result', async () => {
  const users = await User.find({});
  const out = serializeUsers(users, 'admin');
  assert.equal(out.length, users.length);
  assert.ok(out.length > 0);
  for (const row of out) {
    for (const forbidden of INTERNAL_ONLY_FIELDS) {
      assert.ok(!(forbidden in row), `list row leaks '${forbidden}'`);
    }
  }
});

// ── Requirement 5: authentication internals stay usable ─────────────────────
test('the document keeps passwordHash — matchPassword still works', async () => {
  const doc = await User.findById(persisted._id);
  serializeUser(doc, 'admin'); // serializing must not mutate the document

  assert.ok(doc.passwordHash, 'passwordHash was stripped from the document');
  assert.equal(await doc.matchPassword(PLAIN_PASSWORD), true, 'correct password rejected');
  assert.equal(await doc.matchPassword('wrong-password'), false, 'wrong password accepted');
});

test('the document keeps tokenVersion — session revocation still works', async () => {
  const doc = await User.findById(persisted._id);
  serializeUser(doc, 'self');

  // Mirrors authMiddleware.protect:
  //   if ((decoded.tv || 0) !== (user.tokenVersion || 0)) -> reject
  assert.equal(typeof doc.tokenVersion, 'number', 'tokenVersion is not loaded');

  const issuedTv = doc.tokenVersion;
  assert.equal((issuedTv || 0) !== (doc.tokenVersion || 0), false, 'a valid token would be rejected');

  doc.tokenVersion = issuedTv + 1; // simulate a password reset
  await doc.save({ validateModifiedOnly: true });

  const reloaded = await User.findById(persisted._id);
  assert.equal((issuedTv || 0) !== (reloaded.tokenVersion || 0), true, 'a revoked token would still be accepted');
});

test('the document keeps deviceSessions and govtId for backend use', async () => {
  const doc = await User.findById(persisted._id);
  serializeUser(doc, 'admin');
  assert.equal(doc.deviceSessions.length, 1, 'deviceSessions stripped from the document');
  assert.equal(doc.govtId.idNumber, '999988887777', 'govtId stripped from the document');
  assert.equal(doc.aadhaarId, '999988887777', 'aadhaarId stripped from the document');
});

// ── Regression marker for the leak PR-2b/2c will close ──────────────────────
test('the raw document DOES leak — proving the serializer is necessary', async () => {
  const doc = await User.findById(persisted._id);
  const rawWire = JSON.parse(JSON.stringify(doc)); // what `data: user` emits today
  assert.ok(rawWire.passwordHash, 'expected the raw document to still leak passwordHash');
  assert.ok(rawWire.aadhaarId, 'expected the raw document to still leak aadhaarId');
  // Once PR-2b and PR-2c land, no controller should ever emit this shape.
});
