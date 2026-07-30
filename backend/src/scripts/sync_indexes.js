/**
 * Reconcile every MongoDB collection's indexes with what its Mongoose schema
 * declares — creating what is missing and dropping what is no longer declared.
 *
 *   node src/scripts/sync_indexes.js            # DRY RUN — report only
 *   node src/scripts/sync_indexes.js --apply    # actually create/drop
 *
 * Why this script exists rather than relying on `autoIndex`:
 *
 *   Mongoose's autoIndex (on by default; this project does not disable it) only
 *   ever CREATES indexes declared in a schema. It never drops one that has been
 *   removed from the schema. So deleting a `schema.index(...)` line is invisible
 *   to a running server — the stale index keeps consuming write throughput and
 *   RAM forever. Dropping requires syncIndexes(), which is what --apply calls.
 *
 * Safety notes:
 *   - Default mode writes nothing. Read the plan, then re-run with --apply.
 *   - syncIndexes() drops ANY index not declared in the schema, except `_id`.
 *     If you have hand-created an index in Atlas that no schema knows about,
 *     the dry run will list it under "DROP" — add it to the schema first if you
 *     want to keep it.
 *   - Index builds on MongoDB 4.2+ do not block reads or writes, but they do
 *     consume I/O. Prefer a low-traffic window on a large collection.
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// Connect through the application's own connector rather than calling
// mongoose.connect() directly. config/db.js overrides the system DNS resolver
// with 8.8.8.8 / 1.1.1.1 before connecting, which this project needs: the
// mongodb+srv:// scheme requires an SRV record lookup, and some ISP/router
// resolvers refuse it (querySrv ECONNREFUSED). Importing this module also
// applies that override, so a script that bypassed it would fail to resolve
// the cluster on exactly the machines where the server itself works fine.
import connectDB from '../config/db.js';

const APPLY = process.argv.includes('--apply');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Recursively collect every model file so mongoose.models gets fully populated.
const collectModelFiles = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectModelFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const modelFiles = [
  ...collectModelFiles(path.join(__dirname, '../models')),
  ...collectModelFiles(path.join(__dirname, '../modules/parking/models')),
];

for (const file of modelFiles) {
  // pathToFileURL keeps this working on Windows, where a bare path is not a
  // valid ESM specifier.
  await import(pathToFileURL(file).href);
}

await connectDB();

// connectDB() logs and returns undefined when every retry is exhausted rather
// than throwing (the server is designed to stay up and keep retrying). A script
// must not carry on and report "0 indexes to sync" against a dead connection,
// so fail loudly here instead.
if (mongoose.connection.readyState !== 1) {
  console.error(
    '\nCould not reach MongoDB — aborting without changes.\n' +
    'If the error above is "querySrv ECONNREFUSED", the SRV lookup for the\n' +
    'mongodb+srv:// host failed. Check network/VPN, or that this machine can\n' +
    'reach 8.8.8.8 / 1.1.1.1 on port 53.\n'
  );
  process.exit(1);
}

console.log(`Connected to ${mongoose.connection.name}`);
console.log(APPLY ? '\n*** APPLY MODE — changes will be written ***\n' : '\n--- DRY RUN — nothing will be modified (pass --apply to execute) ---\n');

const names = Object.keys(mongoose.models).sort();
let toCreate = 0;
let toDrop = 0;
const failures = [];

for (const name of names) {
  const Model = mongoose.models[name];
  try {
    // diffIndexes() reports the delta without touching anything.
    const { toCreate: create = [], toDrop: drop = [] } = await Model.diffIndexes();

    if (create.length === 0 && drop.length === 0) continue;

    console.log(`\n${name}  (${Model.collection.collectionName})`);
    for (const spec of create) {
      console.log(`   + CREATE ${JSON.stringify(spec)}`);
      toCreate++;
    }
    for (const idxName of drop) {
      console.log(`   - DROP   ${idxName}`);
      toDrop++;
    }

    if (APPLY) {
      await Model.syncIndexes();
      console.log(`   => synced`);
    }
  } catch (err) {
    // A collection that does not exist yet has nothing to diff — not an error.
    if (err.codeName === 'NamespaceNotFound' || /ns does not exist/i.test(err.message)) {
      continue;
    }
    failures.push({ name, message: err.message });
    console.log(`\n${name}\n   ! ERROR: ${err.message}`);
  }
}

console.log('\n' + '='.repeat(64));
console.log(`Models scanned : ${names.length}`);
console.log(`Indexes to create: ${toCreate}`);
console.log(`Indexes to drop  : ${toDrop}`);
if (failures.length) console.log(`Errors           : ${failures.length}`);
console.log(APPLY ? 'Status: APPLIED' : 'Status: DRY RUN (re-run with --apply to execute)');
console.log('='.repeat(64));

await mongoose.disconnect();
process.exit(failures.length ? 1 : 0);
