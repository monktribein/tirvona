// PR-2b: the five migrated authController handlers, exercised against a real
// MongoDB and asserted on the ACTUAL response body — not on the serializer in
// isolation. A handler can serialize correctly and still leak by returning the
// raw document somewhere else in the same response.
//
// Also pins the two handlers deliberately NOT migrated (register, verifyOTP),
// because they carry the session/token contract the whole frontend depends on.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-config';
process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = (await import('mongoose')).default;

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'authctl_verify' });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const User = (await import('../src/models/User.js')).default;
const { INTERNAL_ONLY_FIELDS } = await import('../src/serializers/userSerializer.js');
const {
  getMe, updateMe, getOwnerStaff, createOwnerStaff, toggleStaffStatus, register,
} = await import('../src/controllers/authController.js');

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

const MASTER_EMAIL = 'stayadmin@tirvona.com';
const SECRETS = { aadhaar: '999988887777', google: 'google-sub-abc', device: 'device-token-xyz' };

let master, pilgrim, staffMember;

before(async () => {
  master = await User.create({
    name: 'Master Owner', email: MASTER_EMAIL, phone: '9111100001',
    passwordHash: 'MasterPass123', role: 'super_admin', status: 'active',
  });
  pilgrim = await User.create({
    name: 'Pilgrim', email: 'pilgrim@test.com', phone: '9111100002',
    passwordHash: 'PilgrimPass123', role: 'customer', status: 'active',
    district: 'Varanasi', state: 'UP',
    aadhaarId: SECRETS.aadhaar, googleId: SECRETS.google,
    govtId: { idType: 'Aadhaar', idNumber: SECRETS.aadhaar, documentUrl: 'https://x/d.pdf' },
    deviceSessions: [{ token: SECRETS.device, deviceName: 'iPhone', ipAddress: '1.2.3.4' }],
  });
  staffMember = await User.create({
    name: 'Reception Person', email: 'reception@test.com', phone: '9111100003',
    passwordHash: 'StaffPass123', role: 'reception', status: 'active',
    aadhaarId: SECRETS.aadhaar,
  });
});

const asMaster = () => ({ id: master._id.toString(), _id: master._id, email: MASTER_EMAIL, role: 'super_admin', status: 'active' });
const asPilgrim = () => ({ id: pilgrim._id.toString(), _id: pilgrim._id, email: pilgrim.email, role: 'customer', status: 'active' });

/** Requirement 4: no INTERNAL_ONLY_FIELDS anywhere in the response, at any depth. */
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

/** Requirement 5: envelope shape is unchanged. */
const assertEnvelope = (res, { status, message }, label) => {
  assert.equal(res.statusCode, status, `${label}: wrong HTTP status`);
  assert.equal(res.body.success, true, `${label}: missing success:true`);
  assert.ok('data' in res.body, `${label}: missing data key`);
  if (message) assert.equal(res.body.message, message, `${label}: message changed`);
};

// ── getMe ───────────────────────────────────────────────────────────────────
test('getMe — envelope, status and no internals', async () => {
  const res = mockRes();
  await getMe(mockReq({ user: asPilgrim() }), res);
  assertEnvelope(res, { status: 200 }, 'getMe');
  assertNoInternals(res.body, 'getMe');
});

test('getMe — matches the AuthContext contract exactly', async () => {
  const res = mockRes();
  await getMe(mockReq({ user: asPilgrim() }), res);
  const d = res.body.data;
  // The five fields the frontend actually reads off the session user.
  for (const f of ['role', 'name', 'phone', 'email', 'id']) {
    assert.ok(d[f] !== undefined, `getMe dropped '${f}', which the frontend reads`);
  }
  assert.equal(d.id, String(pilgrim._id));
  assert.equal(d.name, 'Pilgrim');
});

test('getMe — browser refresh now yields a usable `id` (latent bug fixed)', async () => {
  // Before PR-2b this returned `_id` only: Mongoose omits virtuals from toJSON,
  // so `user.id` was undefined after every page reload, while AuthContext's
  // User interface declares `id: string`. The serializer emits both.
  const res = mockRes();
  await getMe(mockReq({ user: asPilgrim() }), res);
  const wire = JSON.parse(JSON.stringify(res.body)); // exactly what the browser receives
  assert.ok(wire.data.id, 'id missing — refresh would leave user.id undefined');
  assert.ok(wire.data._id, '_id missing — record-addressing consumers would break');
  assert.equal(wire.data.id, String(pilgrim._id));
});

test('getMe — district/state deliberately omitted (option a, least privilege)', async () => {
  const res = mockRes();
  await getMe(mockReq({ user: asPilgrim() }), res);
  // Declared optional on the frontend User interface, verified never read.
  assert.equal(res.body.data.district, undefined);
  assert.equal(res.body.data.state, undefined);
});

// ── updateMe ────────────────────────────────────────────────────────────────
test('updateMe — envelope, message and no internals', async () => {
  const res = mockRes();
  await updateMe(mockReq({ user: asPilgrim(), body: { name: 'Pilgrim Renamed' } }), res);
  assertEnvelope(res, { status: 200, message: 'Profile updated' }, 'updateMe');
  assertNoInternals(res.body, 'updateMe');
  assert.equal(res.body.data.name, 'Pilgrim Renamed');
  // Previously handcrafted with exactly these keys — all still present.
  for (const f of ['id', 'name', 'email', 'phone', 'role', 'status']) {
    assert.ok(res.body.data[f] !== undefined, `updateMe dropped '${f}'`);
  }
});

// ── getOwnerStaff ───────────────────────────────────────────────────────────
test('getOwnerStaff — every array element is clean', async () => {
  const res = mockRes();
  await getOwnerStaff(mockReq({ user: asMaster() }), res);
  assertEnvelope(res, { status: 200 }, 'getOwnerStaff');
  assert.ok(Array.isArray(res.body.data) && res.body.data.length > 0);
  assertNoInternals(res.body, 'getOwnerStaff');           // whole payload
  res.body.data.forEach((row, i) => assertNoInternals(row, `getOwnerStaff[${i}]`));
});

test('getOwnerStaff — OwnerUsersPage and AllAshramsPage contracts intact', async () => {
  const res = mockRes();
  await getOwnerStaff(mockReq({ user: asMaster() }), res);
  const row = res.body.data.find((r) => r.email === 'reception@test.com');
  assert.ok(row, 'seeded staff member missing from the list');
  // OwnerUsersPage renders these; AllAshramsPage filters on `role`.
  for (const f of ['_id', 'name', 'email', 'phone', 'role', 'status']) {
    assert.ok(row[f] !== undefined, `getOwnerStaff dropped '${f}' — the staff table would break`);
  }
});

test('getOwnerStaff — a non-master caller is still refused (403 unchanged)', async () => {
  const res = mockRes();
  await getOwnerStaff(mockReq({ user: { ...asPilgrim(), role: 'owner' } }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

// ── createOwnerStaff ────────────────────────────────────────────────────────
test('createOwnerStaff — 201 envelope preserved, no internals', async () => {
  const res = mockRes();
  await createOwnerStaff(mockReq({
    user: asMaster(),
    body: { name: 'New Manager', email: 'newmgr@test.com', phone: '9111100009', password: 'NewPass123', role: 'manager' },
  }), res);
  assertEnvelope(res, { status: 201, message: 'Staff member created successfully' }, 'createOwnerStaff');
  assertNoInternals(res.body, 'createOwnerStaff');
  for (const f of ['id', 'name', 'email', 'phone', 'role', 'status']) {
    assert.ok(res.body.data[f] !== undefined, `createOwnerStaff dropped '${f}'`);
  }
});

// ── toggleStaffStatus — the critical passwordHash leak ──────────────────────
test('toggleStaffStatus — passwordHash no longer reaches the wire', async () => {
  const res = mockRes();
  await toggleStaffStatus(mockReq({
    user: asMaster(), params: { id: staffMember._id.toString() }, body: { status: 'suspended' },
  }), res);
  assertEnvelope(res, { status: 200 }, 'toggleStaffStatus');
  assertNoInternals(res.body, 'toggleStaffStatus');
  assert.equal(res.body.data.status, 'suspended');
  assert.match(res.body.message, /Status updated to suspended/);
});

test('toggleStaffStatus — the status change still persists', async () => {
  const res = mockRes();
  await toggleStaffStatus(mockReq({
    user: asMaster(), params: { id: staffMember._id.toString() }, body: { status: 'active' },
  }), res);
  assert.equal(res.statusCode, 200);
  const reloaded = await User.findById(staffMember._id);
  assert.equal(reloaded.status, 'active', 'serialization must not affect persistence');
});

// ── NOT migrated: the session/token contract ────────────────────────────────
test('register — still emits a top-level token (contract preserved)', async () => {
  const res = mockRes();
  await register(mockReq({
    body: { name: 'Fresh Owner', email: 'fresh@test.com', phone: '9111100010', password: 'FreshPass123', role: 'owner' },
  }), res);
  assert.equal(res.statusCode, 201);
  // AuthContext.persistSession destructures `token` off `data`. Losing it here
  // would break login and registration platform-wide.
  assert.ok(res.body.data.token, 'register dropped the session token');
  assert.equal(typeof res.body.data.token, 'string');
  for (const f of ['id', 'name', 'email', 'phone', 'role', 'status']) {
    assert.ok(res.body.data[f] !== undefined, `register dropped '${f}'`);
  }
  assertNoInternals(res.body, 'register');
});

// ── Response shape contracts ────────────────────────────────────────────────
//
// Explicit key lists rather than generated snapshots, deliberately. A snapshot
// file is regenerated with a flag, and the habit of regenerating on red is
// exactly how an added field slips through unreviewed. These lists live in the
// diff: adding or removing a field from a view fails every endpoint using it,
// and the fix is to edit a list a reviewer can see.
//
// Derived from the views in userSerializer.js. See serializers/ENDPOINT_CONTRACTS.md.

const SELF_CONTRACT = Object.freeze([
  '_id', 'authProvider', 'avatarUrl', 'createdAt', 'dob', 'email', 'gender', 'id',
  'isVerified', 'lastLoginAt', 'name', 'phone', 'role', 'status',
]);

const STAFF_CONTRACT = Object.freeze([
  '_id', 'assignedAshram', 'avatarUrl', 'department', 'designation', 'email',
  'employeeId', 'employerAshramId', 'id', 'joiningDate', 'name', 'phone', 'role', 'status',
]);

const ADMIN_CONTRACT = Object.freeze([
  '_id', 'assignedAshram', 'authProvider', 'avatarUrl', 'createdAt', 'deletedAt',
  'department', 'designation', 'district', 'dob', 'email', 'emailVerifiedAt',
  'employeeId', 'employerAshramId', 'gender', 'id', 'internalNotes', 'isDeleted',
  'isSuspended', 'isVerified', 'joiningDate', 'lastLoginAt', 'name', 'permissions',
  'phone', 'phoneVerifiedAt', 'reactivatedAt', 'remarks', 'role', 'state', 'status',
  'suspendedAt', 'suspensionEndDate', 'suspensionReason', 'suspensionType',
  'updatedAt', 'username', 'visibleMessage',
]);

/** register/verifyOTP are NOT serialized — their shape is the session contract. */
const SESSION_CONTRACT = Object.freeze(['email', 'id', 'name', 'phone', 'role', 'status', 'token']);

const assertContract = (data, contract, label) => {
  assert.deepEqual(
    Object.keys(data).sort(),
    [...contract].sort(),
    `${label}: response shape changed. If intentional, update the contract here and in serializers/ENDPOINT_CONTRACTS.md.`
  );
};

test('contract — GET /auth/me returns exactly the self view', async () => {
  const res = mockRes();
  await getMe(mockReq({ user: asPilgrim() }), res);
  assertContract(res.body.data, SELF_CONTRACT, 'getMe');
});

test('contract — PUT /auth/me returns exactly the self view', async () => {
  const res = mockRes();
  await updateMe(mockReq({ user: asPilgrim(), body: { name: 'Contract Check' } }), res);
  assertContract(res.body.data, SELF_CONTRACT, 'updateMe');
});

test('contract — GET /auth/owner-staff returns exactly the staff view, per row', async () => {
  const res = mockRes();
  await getOwnerStaff(mockReq({ user: asMaster() }), res);
  res.body.data.forEach((row, i) => assertContract(row, STAFF_CONTRACT, `getOwnerStaff[${i}]`));
});

test('contract — POST /auth/owner-staff returns exactly the staff view', async () => {
  const res = mockRes();
  await createOwnerStaff(mockReq({
    user: asMaster(),
    body: { name: 'Contract Staff', email: 'contract@test.com', phone: '9111100011', password: 'Pass12345', role: 'reception' },
  }), res);
  assertContract(res.body.data, STAFF_CONTRACT, 'createOwnerStaff');
});

test('contract — PUT /auth/owner-staff/:id/status returns exactly the admin view', async () => {
  const res = mockRes();
  await toggleStaffStatus(mockReq({
    user: asMaster(), params: { id: staffMember._id.toString() }, body: { status: 'active' },
  }), res);
  assertContract(res.body.data, ADMIN_CONTRACT, 'toggleStaffStatus');
});

test('contract — POST /auth/register keeps the unserialized session shape', async () => {
  const res = mockRes();
  await register(mockReq({
    body: { name: 'Contract Owner', email: 'contractowner@test.com', phone: '9111100012', password: 'Pass12345', role: 'owner' },
  }), res);
  // Pinned so a future "tidy-up" cannot quietly serialize this and drop `token`.
  assertContract(res.body.data, SESSION_CONTRACT, 'register');
});

test('contract — no contract list contains an internal-only field', () => {
  for (const [name, contract] of Object.entries({ SELF_CONTRACT, STAFF_CONTRACT, ADMIN_CONTRACT, SESSION_CONTRACT })) {
    for (const forbidden of INTERNAL_ONLY_FIELDS) {
      assert.ok(!contract.includes(forbidden), `${name} would permit '${forbidden}'`);
    }
  }
});

// ── Backend internals still intact (PR-2a guarantee, re-asserted here) ──────
test('serialization did not strip anything from the stored documents', async () => {
  const doc = await User.findById(pilgrim._id);
  assert.ok(doc.passwordHash, 'passwordHash lost from the document');
  assert.equal(await doc.matchPassword('PilgrimPass123'), true, 'login would now fail');
  assert.equal(typeof doc.tokenVersion, 'number', 'tokenVersion lost — revocation would silently break');
  assert.equal(doc.aadhaarId, SECRETS.aadhaar, 'aadhaarId lost from the document');
});
