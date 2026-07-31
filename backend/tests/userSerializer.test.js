// Unit coverage for the User serialization layer.
//
// The fixture deliberately populates EVERY schema path, including every secret,
// so a leak shows up as a failing assertion rather than as an absent field that
// nobody thought to check.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  serializeUser, serializeUsers,
  publicUser, selfUser, staffUser, ownerUser, adminUser,
  USER_VIEWS, INTERNAL_ONLY_FIELDS, PUBLIC_USER_FIELDS,
} from '../src/serializers/userSerializer.js';

const FIXTURE = {
  _id: '650000000000000000000001',
  name: 'Test Person', email: 'person@test.com', phone: '9000000000',
  avatarUrl: 'https://cdn.test/a.png',
  role: 'manager', status: 'active', isVerified: true,
  employeeId: 'EMP-2026-1234', username: 'tperson',
  designation: 'Manager', department: 'Operations',
  employerAshramId: '650000000000000000000002',
  assignedAshram: '650000000000000000000003',
  joiningDate: new Date('2026-01-01'),
  district: 'Varanasi', state: 'UP',
  permissions: ['bookings.read'], remarks: 'note',
  isSuspended: false, suspensionType: 'none', suspensionReason: '',
  suspendedAt: null, suspensionEndDate: null,
  visibleMessage: '', internalNotes: 'internal note', reactivatedAt: null,
  isDeleted: false, deletedAt: null,
  gender: 'Female', dob: new Date('1990-05-05'),
  lastLoginAt: new Date('2026-07-30'), authProvider: 'local',
  phoneVerifiedAt: new Date('2026-01-02'), emailVerifiedAt: new Date('2026-01-02'),
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-07-30'),

  // ── everything below must NEVER reach a response ──
  passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
  tokenVersion: 7,
  deviceSessions: [{ token: 'sess', deviceName: 'iPhone', ipAddress: '1.2.3.4' }],
  resetTokenHash: 'deadbeef', resetTokenExpiresAt: new Date(),
  aadhaarId: '123412341234',
  govtId: { idType: 'Aadhaar', idNumber: '123412341234', documentUrl: 'https://x' },
  googleId: '10987654321',
  __v: 0,
};

const ALL_VIEWS = { public: publicUser, self: selfUser, staff: staffUser, owner: ownerUser, admin: adminUser };

// ── The core guarantee ──────────────────────────────────────────────────────
test('no view leaks any internal-only field', () => {
  for (const [name, view] of Object.entries(ALL_VIEWS)) {
    const keys = Object.keys(view(FIXTURE));
    for (const forbidden of INTERNAL_ONLY_FIELDS) {
      assert.ok(!keys.includes(forbidden), `view '${name}' leaks '${forbidden}'`);
    }
  }
});

test('no view leaks an internal value even under a different key', () => {
  // Guards against a rename smuggling a secret through under an alias.
  const secrets = [FIXTURE.passwordHash, FIXTURE.resetTokenHash, FIXTURE.aadhaarId, FIXTURE.googleId];
  for (const [name, view] of Object.entries(ALL_VIEWS)) {
    const wire = JSON.stringify(view(FIXTURE));
    for (const secret of secrets) {
      assert.ok(!wire.includes(secret), `view '${name}' emits the value '${secret}'`);
    }
  }
});

test('deviceSessions token never appears on the wire', () => {
  for (const [name, view] of Object.entries(ALL_VIEWS)) {
    assert.ok(!JSON.stringify(view(FIXTURE)).includes('sess'), `view '${name}' leaks a device session`);
  }
});

// ── Exact shape: catches accidental HIDING as well as accidental exposure ───
test('public view exposes exactly the intended fields', () => {
  assert.deepEqual(Object.keys(publicUser(FIXTURE)).sort(), ['_id', 'avatarUrl', 'id', 'name']);
});

test('self view exposes exactly the intended fields', () => {
  assert.deepEqual(Object.keys(selfUser(FIXTURE)).sort(), [
    '_id', 'authProvider', 'avatarUrl', 'createdAt', 'dob', 'email', 'gender',
    'id', 'isVerified', 'lastLoginAt', 'name', 'phone', 'role', 'status',
  ]);
});

test('staff view exposes exactly the intended fields', () => {
  assert.deepEqual(Object.keys(staffUser(FIXTURE)).sort(), [
    '_id', 'assignedAshram', 'avatarUrl', 'department', 'designation', 'email',
    'employeeId', 'employerAshramId', 'id', 'joiningDate', 'name', 'phone', 'role', 'status',
  ]);
});

// ── Containment invariants ──────────────────────────────────────────────────
const keysOf = (view) => new Set(Object.keys(view(FIXTURE)));
const isSubset = (a, b) => [...a].every((k) => b.has(k));

test('containment: public subset-of staff subset-of owner subset-of admin', () => {
  const [pub, stf, own, adm] = [keysOf(publicUser), keysOf(staffUser), keysOf(ownerUser), keysOf(adminUser)];
  assert.ok(isSubset(pub, stf), 'public is not a subset of staff');
  assert.ok(isSubset(stf, own), 'staff is not a subset of owner');
  assert.ok(isSubset(own, adm), 'owner is not a subset of admin');
});

test('containment: admin is a superset of self', () => {
  assert.ok(isSubset(keysOf(selfUser), keysOf(adminUser)), 'admin does not cover self');
});

test('admin view is still strictly narrower than the raw document', () => {
  const adminKeys = Object.keys(adminUser(FIXTURE));
  const rawKeys = Object.keys(FIXTURE);
  assert.ok(adminKeys.length < rawKeys.length, 'admin view is not narrowing anything');
});

// ── Dispatch behaviour ──────────────────────────────────────────────────────
test('serializeUser dispatches to every declared view', () => {
  for (const view of USER_VIEWS) {
    assert.deepEqual(serializeUser(FIXTURE, view), ALL_VIEWS[view](FIXTURE));
  }
});

test('serializeUser throws on an unknown view rather than defaulting', () => {
  // A typo must fail loudly, never fall back to the most permissive shape.
  assert.throws(() => serializeUser(FIXTURE, 'administrator'), /Unknown user view/);
  assert.throws(() => serializeUser(FIXTURE, undefined), /Unknown user view/);
});

test('serializeUsers maps arrays and rejects an unknown view', () => {
  const out = serializeUsers([FIXTURE, FIXTURE], 'public');
  assert.equal(out.length, 2);
  assert.deepEqual(Object.keys(out[0]).sort(), ['_id', 'avatarUrl', 'id', 'name']);
  assert.deepEqual(serializeUsers(null, 'public'), []);
  assert.throws(() => serializeUsers([FIXTURE], 'nope'), /Unknown user view/);
});

test('null and undefined users serialize to null, not a crash', () => {
  for (const view of USER_VIEWS) {
    assert.equal(serializeUser(null, view), null);
    assert.equal(serializeUser(undefined, view), null);
  }
});

// ── Frontend compatibility ──────────────────────────────────────────────────
test('both _id and id are emitted', () => {
  // UserManagementPage reads `u._id`; the auth session payload has always used
  // `id`. Emitting only one would break the other on migration.
  for (const view of USER_VIEWS) {
    const out = serializeUser(FIXTURE, view);
    assert.ok(out._id, `view '${view}' dropped _id`);
    assert.equal(out.id, String(FIXTURE._id), `view '${view}' dropped or mis-shaped id`);
  }
});

test('PUBLIC_USER_FIELDS is a mongoose-populate-ready string', () => {
  assert.equal(typeof PUBLIC_USER_FIELDS, 'string');
  assert.ok(PUBLIC_USER_FIELDS.split(' ').includes('name'));
  for (const forbidden of INTERNAL_ONLY_FIELDS) {
    assert.ok(!PUBLIC_USER_FIELDS.split(' ').includes(forbidden), `PUBLIC_USER_FIELDS includes '${forbidden}'`);
  }
});
