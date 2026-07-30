/**
 * Static guard: every field named in a schema.index() must be a real path on
 * that schema. Runs offline — no database connection, no environment secrets.
 *
 *   node src/scripts/check_index_paths.js
 *
 * Exits 1 on any violation, so it is safe to run in CI.
 *
 * Why this exists
 * ---------------
 * Mongoose builds an index from schema.index() WITHOUT validating that the
 * fields exist on the schema. A typo, or a field that was renamed or never
 * added, produces a real index in MongoDB in which every document stores a
 * null key — costing write throughput and RAM while being unusable by any
 * query. Nothing surfaces this at runtime: no warning, no error, and the
 * collection keeps working.
 *
 * This repository shipped exactly that bug for some time:
 *
 *     ashramSchema.index({ isVerified: 1, status: 1 });
 *
 * `isVerified` was never a path on the Ashram schema — verification is
 * modelled purely as status: 'approved'. The index was dead on arrival.
 * This check makes that class of mistake fail the build instead.
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..');

const collectModelFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectModelFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const modelFiles = [
  ...collectModelFiles(path.join(SRC, 'models')),
  ...collectModelFiles(path.join(SRC, 'modules/parking/models')),
];

// Importing a model file registers its schema on mongoose.models. No DB needed.
for (const file of modelFiles) {
  await import(pathToFileURL(file).href);
}

/**
 * Models allowed to keep a single-field index that is a prefix of a compound
 * one. Only justified when the compound index is PARTIAL: a partial index
 * contains just the documents matching its filter, so the planner may decline
 * to use it for a bare equality query, leaving the prefix index doing real work.
 */
const PREFIX_EXEMPT = new Set([
  'Otp', // { userId, type } and { identifier, type } are unique + partial
]);

const violations = [];
const redundant = [];
let fieldsChecked = 0;

const modelNames = Object.keys(mongoose.models).sort();

for (const modelName of modelNames) {
  const schema = mongoose.models[modelName].schema;

  for (const [keyPattern] of schema.indexes()) {
    for (const field of Object.keys(keyPattern)) {
      // `_id` is implicit; `$**` wildcard and text-index meta keys are not paths.
      if (field === '_id' || field.startsWith('$')) continue;
      fieldsChecked++;

      // Valid if mongoose resolves it directly, if it is a declared nested
      // object, or if it is the parent of known paths — the last case covers
      // nested objects such as the GeoJSON 'address.coordinates'.
      const isDirectPath = Boolean(schema.path(field));
      const isNestedObject = Boolean(schema.nested?.[field]);
      const isParentOfPaths = Object.keys(schema.paths).some(
        (p) => p === field || p.startsWith(`${field}.`)
      );

      if (!isDirectPath && !isNestedObject && !isParentOfPaths) {
        violations.push({ modelName, field, keyPattern });
      }
    }
  }

  // ── Prefix redundancy ────────────────────────────────────────────────────
  // A single-field index whose key is the leading prefix of a compound index
  // can never be the only usable plan — the compound serves those queries
  // already. It costs a B-tree write on every insert/update for no read
  // benefit. Skipped for special indexes (unique/sparse/partial/TTL), whose
  // semantics differ from plain lookup.
  if (PREFIX_EXEMPT.has(modelName)) continue;

  const allIndexes = schema.indexes();
  for (const [keyA, optsA] of allIndexes) {
    const a = Object.keys(keyA);
    if (a.length !== 1) continue;
    if (typeof keyA[a[0]] === 'string') continue; // text / 2dsphere
    if (optsA && ['unique', 'sparse', 'partialFilterExpression', 'expireAfterSeconds']
      .some((o) => optsA[o] !== undefined)) continue;

    const container = allIndexes.find(([keyB]) => {
      const b = Object.keys(keyB);
      return b.length > a.length && a.every((k, i) => k === b[i]);
    });
    if (container) {
      redundant.push({ modelName, field: a[0], container: Object.keys(container[0]) });
    }
  }
}

if (violations.length > 0) {
  console.error('\nPhantom index fields detected:\n');
  for (const v of violations) {
    console.error(`  ${v.modelName}: index(${JSON.stringify(v.keyPattern)})`);
    console.error(`      '${v.field}' is not a path on the ${v.modelName} schema\n`);
  }
  console.error(
    `${violations.length} violation(s) across ${modelNames.length} models.\n` +
    `Either add the field to the schema or remove it from the index.\n`
  );
}

if (redundant.length > 0) {
  console.error('\nPrefix-redundant indexes detected:\n');
  for (const r of redundant) {
    console.error(`  ${r.modelName}: { ${r.field}: 1 } is a prefix of { ${r.container.join(', ')} }`);
    console.error(`      The compound index already serves those queries — drop the single-field one`);
    console.error(`      (usually an 'index: true' on the field, or a standalone schema.index() call).\n`);
  }
  console.error(
    `${redundant.length} redundant index(es). If one is genuinely needed — e.g. the\n` +
    `compound is partial and the planner will not use it — add the model to\n` +
    `PREFIX_EXEMPT in this script with a comment explaining why.\n`
  );
}

if (violations.length > 0 || redundant.length > 0) {
  process.exit(1);
}

console.log(
  `OK — ${fieldsChecked} indexed fields across ${modelNames.length} models ` +
  `all resolve to real schema paths, with no prefix-redundant indexes.`
);
process.exit(0);
