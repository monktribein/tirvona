// PR-2d: the generic admin CRUD surface, asserted on real response bodies.
//
// This controller reaches 29 models through 43 module keys. Only User carries
// credential-class fields, so only User is shaped — which makes the two things
// worth proving here: User-backed keys are clean, and the other 28 models still
// pass through untouched.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-config';
process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = (await import('mongoose')).default;

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'gencrud_verify' });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const User = (await import('../src/models/User.js')).default;
const Ashram = (await import('../src/models/Ashram.js')).default;
const Offer = (await import('../src/models/Offer.js')).default;
const { INTERNAL_ONLY_FIELDS } = await import('../src/serializers/userSerializer.js');
const { getCrudList, saveCrudRecord, deleteCrudRecord } =
  await import('../src/admin/shared/genericCrudController.js');

const mockRes = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const rq = (o = {}) => ({ body: {}, params: {}, query: {}, headers: {}, ip: '127.0.0.1', ...o });

const SECRETS = { aadhaar: '777788889999', google: 'g-sub-gencrud', device: 'DEVICE-TOKEN-GENCRUD' };
const asAdmin = { role: 'super_admin', id: 'x' };

// The four module keys that resolve to User.
const USER_KEYS = ['users', 'pilgrims', 'owners', 'staff'];

let owner, seededUser;

before(async () => {
  owner = await User.create({
    name: 'Owner', email: 'owner@test.com', phone: '9700000001',
    passwordHash: 'OwnerPass123', role: 'owner', status: 'active',
  });
  seededUser = await User.create({
    name: 'Target', email: 'target@test.com', phone: '9700000002',
    passwordHash: 'TargetPass123', role: 'manager', status: 'active',
    employeeId: 'EMP-2026-9999', designation: 'Manager', department: 'Ops',
    permissions: ['bookings.read'],
    aadhaarId: SECRETS.aadhaar, googleId: SECRETS.google,
    govtId: { idType: 'Aadhaar', idNumber: SECRETS.aadhaar, documentUrl: 'https://x' },
    deviceSessions: [{ token: SECRETS.device, deviceName: 'iPhone', ipAddress: '1.1.1.1' }],
  });
  await Ashram.create({
    ownerId: owner._id, name: 'CRUD Ashram', description: 'fixture',
    address: { street: 's', city: 'Varanasi', district: 'Varanasi', state: 'UP', pincode: '221001' },
  });
  await Offer.create({
    ownerId: owner._id, offerTitle: 'CRUD Offer', description: 'fixture',
    promoCode: 'CRUD10', discountType: 'Percentage', discountValue: 10,
    validFrom: new Date(Date.now() - 86400000), validTill: new Date(Date.now() + 86400000),
    status: 'active',
  });
});

const assertNoInternals = (body, label) => {
  const wire = JSON.stringify(body);
  for (const f of INTERNAL_ONLY_FIELDS) {
    assert.ok(!wire.includes(`"${f}"`), `${label} leaks the key '${f}'`);
  }
  for (const [name, value] of Object.entries(SECRETS)) {
    assert.ok(!wire.includes(value), `${label} leaks the ${name} value`);
  }
  assert.ok(!/\$2[aby]\$\d{2}\$/.test(wire), `${label} leaks a bcrypt hash`);
};

// ── Read path: all four User-backed keys ────────────────────────────────────
for (const key of USER_KEYS) {
  test(`getCrudList '${key}' — no internal field on the wire`, async () => {
    const res = mockRes();
    await getCrudList(rq({ params: { moduleKey: key }, query: {}, user: asAdmin }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length > 0, `'${key}' returned no rows`);
    assertNoInternals(res.body, `getCrudList('${key}')`);
    res.body.data.forEach((row, i) => assertNoInternals(row, `getCrudList('${key}')[${i}]`));
  });
}

test('getCrudList users — EnterpriseModulePage column + form contract intact', async () => {
  const res = mockRes();
  await getCrudList(rq({ params: { moduleKey: 'users' }, query: {}, user: asAdmin }), res);
  const row = res.body.data.find((r) => r.email === 'target@test.com');
  assert.ok(row, 'seeded user missing from the list');
  // Columns rendered: name, email, phone, role. Form fields: + status. Rows keyed by _id.
  for (const f of ['_id', 'name', 'email', 'phone', 'role', 'status']) {
    assert.ok(f in row, `users list dropped '${f}' — the admin table would break`);
  }
  // Admin-console extras the screen may surface.
  for (const f of ['permissions', 'employeeId', 'designation', 'department', 'isSuspended']) {
    assert.ok(f in row, `users list dropped admin field '${f}'`);
  }
});

test('getCrudList users — envelope unchanged and count matches', async () => {
  const res = mockRes();
  await getCrudList(rq({ params: { moduleKey: 'users' }, query: {}, user: asAdmin }), res);
  assert.deepEqual(Object.keys(res.body).sort(), ['count', 'data', 'success']);
  assert.equal(res.body.count, res.body.data.length);
});

// ── Pass-through: the 28 models with no view registered ─────────────────────
test('non-User models are returned untouched', async () => {
  for (const [key, expectField] of [['ashrams', 'description'], ['offers', 'promoCode']]) {
    const res = mockRes();
    await getCrudList(rq({ params: { moduleKey: key }, query: {}, user: asAdmin }), res);
    assert.equal(res.statusCode, 200, `'${key}' failed`);
    assert.ok(res.body.data.length > 0, `'${key}' returned no rows`);
    const row = JSON.parse(JSON.stringify(res.body.data[0]));
    assert.ok(expectField in row, `'${key}' lost '${expectField}' — pass-through broken`);
    // Untouched means __v is still present; only shaped models lose it.
    assert.ok('__v' in row, `'${key}' was shaped but should have passed through`);
  }
});

// ── Write paths ─────────────────────────────────────────────────────────────
test('saveCrudRecord create (users) — response is shaped', async () => {
  const res = mockRes();
  await saveCrudRecord(rq({
    params: { moduleKey: 'users' }, query: {}, user: asAdmin,
    body: { name: 'Created User', email: 'created@test.com', phone: '9700000010', role: 'reception' },
  }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Record created successfully');
  assertNoInternals(res.body, 'saveCrudRecord create');
  assert.equal(res.body.data.name, 'Created User');
  assert.ok(res.body.data._id, 'created record has no _id for the UI to address');
});

test('saveCrudRecord update (users) — response is shaped', async () => {
  const res = mockRes();
  await saveCrudRecord(rq({
    params: { moduleKey: 'users' }, query: {}, user: asAdmin,
    body: { _id: seededUser._id.toString(), designation: 'Senior Manager' },
  }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Record saved successfully');
  assertNoInternals(res.body, 'saveCrudRecord update');
  assert.equal(res.body.data.designation, 'Senior Manager', 'update did not apply');
});

test('saveCrudRecord create (non-User) still passes through', async () => {
  const res = mockRes();
  await saveCrudRecord(rq({
    params: { moduleKey: 'ashrams' }, query: {}, user: asAdmin,
    body: {
      name: 'New CRUD Ashram', description: 'created via generic crud', ownerId: owner._id.toString(),
      address: { street: 's', city: 'Varanasi', district: 'Varanasi', state: 'UP', pincode: '221001' },
    },
  }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, 'New CRUD Ashram');
});

// ── Privilege filtering still applies (unchanged by this PR) ────────────────
test('a non-super_admin still cannot write privileged User fields', async () => {
  const res = mockRes();
  await saveCrudRecord(rq({
    params: { moduleKey: 'users' }, query: {}, user: { role: 'district_officer', id: 'y' },
    body: { _id: seededUser._id.toString(), role: 'super_admin', isVerified: true },
  }), res);
  const reloaded = await User.findById(seededUser._id);
  assert.notEqual(reloaded.role, 'super_admin', 'privilege escalation through generic CRUD');
});

// ── Unchanged behaviour pinned so later PRs change it deliberately ──────────
test('unknown moduleKey still returns the synthetic fallback (H9, not this PR)', async () => {
  const res = mockRes();
  await getCrudList(rq({ params: { moduleKey: 'not_a_real_module' }, query: {}, user: asAdmin }), res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 8, 'fabricated fallback changed — is that intentional?');
});

test('deleteCrudRecord still guards User deletion to super_admin', async () => {
  const res = mockRes();
  await deleteCrudRecord(rq({
    params: { moduleKey: 'users', id: seededUser._id.toString() },
    user: { role: 'district_officer', id: 'y' },
  }), res);
  assert.equal(res.statusCode, 403);
  assert.ok(await User.findById(seededUser._id), 'user was deleted despite the guard');
});

// ── Backend internals intact ────────────────────────────────────────────────
test('documents keep their internals after shaping', async () => {
  const doc = await User.findById(seededUser._id);
  assert.ok(doc.passwordHash, 'passwordHash lost from the document');
  assert.equal(await doc.matchPassword('TargetPass123'), true, 'login would now fail');
  assert.equal(typeof doc.tokenVersion, 'number', 'tokenVersion lost — revocation would break');
  assert.equal(doc.aadhaarId, SECRETS.aadhaar, 'aadhaarId lost from the document');
});
