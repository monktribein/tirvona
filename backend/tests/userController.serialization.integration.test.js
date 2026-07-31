// PR-2c: the eleven migrated userController handlers, asserted on the ACTUAL
// response body against a real MongoDB.
//
// Seven of these returned the raw Mongoose document, so this file is the
// regression guard for more passwordHash leaks than PR-2b closed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-config';
process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = (await import('mongoose')).default;

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'userctl_verify' });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const User = (await import('../src/models/User.js')).default;
const Ashram = (await import('../src/models/Ashram.js')).default;
const { INTERNAL_ONLY_FIELDS } = await import('../src/serializers/userSerializer.js');
const {
  listUsers, listStaff, createStaff, updateUserStatus, suspendUser, reactivateUser,
  createAccount, changeRole, updatePermissions, softDeleteUser, restoreUser,
} = await import('../src/controllers/userController.js');

const mockRes = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const mockReq = (o = {}) => ({ body: {}, params: {}, query: {}, headers: { 'user-agent': 'node-test' }, ip: '127.0.0.1', ...o });

const SECRETS = { aadhaar: '111122223333', google: 'google-sub-uc', device: 'device-token-uc' };
let admin, owner, ashram, target;

before(async () => {
  admin = await User.create({
    name: 'Root', email: 'root@test.com', phone: '9200000001',
    passwordHash: 'RootPass123', role: 'super_admin', status: 'active',
  });
  owner = await User.create({
    name: 'Owner', email: 'owner@test.com', phone: '9200000002',
    passwordHash: 'OwnerPass123', role: 'owner', status: 'active',
  });
  ashram = await Ashram.create({
    ownerId: owner._id, name: 'Test Ashram', description: 'fixture',
    address: { street: 'S', city: 'Varanasi', district: 'Varanasi', state: 'UP', pincode: '221001' },
  });
  target = await User.create({
    name: 'Target', email: 'target@test.com', phone: '9200000003',
    passwordHash: 'TargetPass123', role: 'manager', status: 'active',
    employerAshramId: ashram._id,
    aadhaarId: SECRETS.aadhaar, googleId: SECRETS.google,
    govtId: { idType: 'Aadhaar', idNumber: SECRETS.aadhaar, documentUrl: 'https://x' },
    deviceSessions: [{ token: SECRETS.device, deviceName: 'iPhone', ipAddress: '1.2.3.4' }],
  });
});

const asAdmin = () => ({ id: admin._id.toString(), _id: admin._id, role: 'super_admin', status: 'active' });
const asOwner = () => ({ id: owner._id.toString(), _id: owner._id, role: 'owner', status: 'active' });
const tid = () => target._id.toString();

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

const assertEnvelope = (res, { status, envelope }, label) => {
  assert.equal(res.statusCode, status, `${label}: HTTP status changed`);
  assert.equal(res.body.success, true, `${label}: success flag changed`);
  assert.deepEqual(Object.keys(res.body).sort(), [...envelope].sort(), `${label}: response envelope changed`);
};

// ── List endpoints ──────────────────────────────────────────────────────────
test('listUsers — envelope, status, and clean rows', async () => {
  const res = mockRes();
  await listUsers(mockReq({ user: asAdmin(), query: {} }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'count', 'data'] }, 'listUsers');
  assert.ok(res.body.data.length > 0);
  assertNoInternals(res.body, 'listUsers');
  res.body.data.forEach((r, i) => assertNoInternals(r, `listUsers[${i}]`));
  assert.equal(res.body.count, res.body.data.length, 'count must still match');
});

test('listUsers — UserManagementPage contract intact', async () => {
  const res = mockRes();
  await listUsers(mockReq({ user: asAdmin(), query: {} }), res);
  const row = res.body.data.find((r) => r.email === 'target@test.com');
  // Every field UserManagementPage renders or filters on.
  for (const f of ['_id', 'name', 'email', 'phone', 'role', 'status', 'permissions',
    'isSuspended', 'suspensionReason', 'suspensionType', 'suspendedAt',
    'suspensionEndDate', 'internalNotes', 'visibleMessage', 'isDeleted',
    'deletedAt', 'createdAt', 'employeeId', 'username', 'designation',
    'department', 'gender', 'dob', 'assignedAshram', 'joiningDate', 'remarks']) {
    assert.ok(f in row, `listUsers dropped '${f}' — the admin table would break`);
  }
});

test('listStaff — StaffManagementPage contract intact (narrowest view)', async () => {
  const res = mockRes();
  await listStaff(mockReq({ user: asOwner() }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'count', 'data'] }, 'listStaff');
  assertNoInternals(res.body, 'listStaff');
  const row = res.body.data.find((r) => r.email === 'target@test.com');
  assert.ok(row, 'seeded staff member missing');
  // Exactly what the page reads: s.name, s.email, s.phone, s.role, s.status, s.employerAshramId
  for (const f of ['_id', 'name', 'email', 'phone', 'role', 'status', 'employerAshramId']) {
    assert.ok(f in row, `listStaff dropped '${f}' — the staff table would break`);
  }
});

test('listStaff — the populated ashram name survives serialization', async () => {
  const res = mockRes();
  await listStaff(mockReq({ user: asOwner() }), res);
  const row = res.body.data.find((r) => r.email === 'target@test.com');
  // .populate('employerAshramId', 'name') must not be flattened away.
  assert.equal(row.employerAshramId.name, 'Test Ashram', 'populated ashram lost');
});

// ── Mutation endpoints ──────────────────────────────────────────────────────
test('createStaff — 201, employerAshramId preserved, no internals', async () => {
  const res = mockRes();
  await createStaff(mockReq({
    user: asOwner(),
    body: { name: 'New Staff', email: 'newstaff@test.com', phone: '9200000010', password: 'Pass12345', role: 'reception', ashramId: ashram._id.toString() },
  }), res);
  assertEnvelope(res, { status: 201, envelope: ['success', 'data'] }, 'createStaff');
  assertNoInternals(res.body, 'createStaff');
  // Previously hand-picked; must still be present and correct.
  assert.equal(String(res.body.data.employerAshramId), String(ashram._id));
  for (const f of ['id', 'name', 'email', 'phone', 'role', 'status']) {
    assert.ok(res.body.data[f] !== undefined, `createStaff dropped '${f}'`);
  }
  assert.equal(res.body.data.name, 'New Staff'); // StaffManagementPage reads .name
  assert.equal(res.body.data.role, 'reception'); // and .role
});

test('updateUserStatus — envelope and status unchanged, no internals', async () => {
  const res = mockRes();
  await updateUserStatus(mockReq({ user: asAdmin(), params: { id: tid() }, body: { status: 'active' } }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'updateUserStatus');
  assertNoInternals(res.body, 'updateUserStatus');
  // Original five keys all still present.
  for (const f of ['id', 'name', 'email', 'role', 'status']) {
    assert.ok(res.body.data[f] !== undefined, `updateUserStatus dropped '${f}'`);
  }
});

test('suspendUser — passwordHash no longer on the wire', async () => {
  const res = mockRes();
  await suspendUser(mockReq({
    user: asAdmin(), params: { id: tid() },
    body: { reason: 'Test', suspensionType: 'temporary', durationDays: 3, internalNotes: 'n', visibleMessage: 'v' },
  }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'suspendUser');
  assertNoInternals(res.body, 'suspendUser');
  assert.equal(res.body.data.isSuspended, true);
  assert.equal(res.body.data.suspensionType, 'temporary');
  assert.match(res.body.message, /suspended \(temporary\)/);
});

test('reactivateUser — passwordHash no longer on the wire', async () => {
  const res = mockRes();
  await reactivateUser(mockReq({ user: asAdmin(), params: { id: tid() } }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'reactivateUser');
  assertNoInternals(res.body, 'reactivateUser');
  assert.equal(res.body.data.isSuspended, false);
  assert.equal(res.body.data.status, 'active');
});

test('createAccount — tempPassword contract preserved exactly', async () => {
  const res = mockRes();
  await createAccount(mockReq({
    user: asAdmin(),
    body: { name: 'Acct One', email: 'acct1@test.com', phone: '9200000011', role: 'support', permissions: ['a.b'] },
  }), res);
  // tempPassword is a SIBLING of data and the admin UI reads res.data.tempPassword.
  assertEnvelope(res, { status: 201, envelope: ['success', 'message', 'tempPassword', 'data'] }, 'createAccount');
  assert.ok(res.body.tempPassword, 'tempPassword must remain — the admin UI relays it');
  assert.equal(typeof res.body.tempPassword, 'string');
  assertNoInternals(res.body.data, 'createAccount.data');
  // The plaintext must not also be echoed inside `data`.
  assert.ok(!JSON.stringify(res.body.data).includes(res.body.tempPassword), 'tempPassword leaked into data');
  assert.deepEqual(res.body.data.permissions, ['a.b']);
});

test('changeRole — no internals, role applied', async () => {
  const res = mockRes();
  await changeRole(mockReq({ user: asAdmin(), params: { id: tid() }, body: { role: 'support' } }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'changeRole');
  assertNoInternals(res.body, 'changeRole');
  assert.equal(res.body.data.role, 'support');
});

test('updatePermissions — no internals, permissions applied', async () => {
  const res = mockRes();
  await updatePermissions(mockReq({ user: asAdmin(), params: { id: tid() }, body: { permissions: ['x.y', 'z.w'] } }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'updatePermissions');
  assertNoInternals(res.body, 'updatePermissions');
  assert.deepEqual(res.body.data.permissions, ['x.y', 'z.w']);
});

test('softDeleteUser — no internals, flag applied', async () => {
  const res = mockRes();
  await softDeleteUser(mockReq({ user: asAdmin(), params: { id: tid() } }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'softDeleteUser');
  assertNoInternals(res.body, 'softDeleteUser');
  assert.equal(res.body.data.isDeleted, true);
});

test('restoreUser — no internals, restored', async () => {
  const res = mockRes();
  await restoreUser(mockReq({ user: asAdmin(), params: { id: tid() } }), res);
  assertEnvelope(res, { status: 200, envelope: ['success', 'message', 'data'] }, 'restoreUser');
  assertNoInternals(res.body, 'restoreUser');
  assert.equal(res.body.data.isDeleted, false);
});

// ── Error paths unchanged ───────────────────────────────────────────────────
test('error statuses are untouched by serialization', async () => {
  const missing = new mongoose.Types.ObjectId().toString();

  const r404 = mockRes();
  await changeRole(mockReq({ user: asAdmin(), params: { id: missing }, body: { role: 'support' } }), r404);
  assert.equal(r404.statusCode, 404);
  assert.equal(r404.body.success, false);

  const r400 = mockRes();
  await updateUserStatus(mockReq({ user: asAdmin(), params: { id: tid() }, body: { status: 'bogus' } }), r400);
  assert.equal(r400.statusCode, 400);

  const r403 = mockRes();
  await createStaff(mockReq({
    user: asOwner(),
    body: { name: 'X', email: 'x@test.com', phone: '9200000099', password: 'Pass12345', role: 'reception', ninja: 1, ashramId: new mongoose.Types.ObjectId().toString() },
  }), r403);
  assert.equal(r403.statusCode, 403, 'ashram ownership check must still apply');
});

// ── Backend internals intact ────────────────────────────────────────────────
test('documents keep their internals after serialization', async () => {
  const doc = await User.findById(target._id);
  assert.ok(doc.passwordHash, 'passwordHash lost from the document');
  assert.equal(await doc.matchPassword('TargetPass123'), true, 'login would now fail');
  assert.equal(typeof doc.tokenVersion, 'number', 'tokenVersion lost — revocation would break');
  assert.equal(doc.aadhaarId, SECRETS.aadhaar, 'aadhaarId lost from the document');
  assert.equal(doc.deviceSessions.length, 1, 'deviceSessions lost from the document');
});
