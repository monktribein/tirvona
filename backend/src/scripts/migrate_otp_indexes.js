/**
 * Rebuild the `otps` collection indexes for pre-account (Google) OTPs.
 *
 * The original unique index on {userId, type} was non-partial. Pre-account
 * challenges have no userId, so more than one of them would collide on a single
 * null key. This replaces it with two partial unique indexes:
 *
 *   {userId, type}     unique, only where userId exists
 *   {identifier, type} unique, only where identifier exists
 *
 * Safe to run repeatedly. The otps collection is transient (TTL-reaped), so
 * rebuilding its indexes cannot lose durable data.
 *
 * Run from the backend/ directory:  node src/scripts/migrate_otp_indexes.js
 */
import dns from 'dns';
import mongoose from 'mongoose';
import config from '../config/env.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const run = async () => {
  await mongoose.connect(config.mongoUri);
  const otps = mongoose.connection.db.collection('otps');
  console.log(`Connected to ${mongoose.connection.name}`);

  const before = await otps.indexes();
  console.log('Existing indexes:', before.map((i) => i.name).join(', '));

  // Drop the old non-partial composite if present.
  const legacy = before.find((i) => i.name === 'userId_1_type_1' && !i.partialFilterExpression);
  if (legacy) {
    await otps.dropIndex('userId_1_type_1');
    console.log('Dropped legacy non-partial index userId_1_type_1');
  } else {
    console.log('No legacy non-partial index to drop.');
  }

  await otps.createIndex(
    { userId: 1, type: 1 },
    { unique: true, partialFilterExpression: { userId: { $exists: true } }, name: 'userId_1_type_1' }
  );
  await otps.createIndex(
    { identifier: 1, type: 1 },
    { unique: true, partialFilterExpression: { identifier: { $exists: true } }, name: 'identifier_1_type_1' }
  );

  const after = await otps.indexes();
  console.log('Final indexes:');
  after.forEach((i) =>
    console.log(
      `  ${i.name}${i.unique ? ' UNIQUE' : ''}${i.partialFilterExpression ? ' PARTIAL' : ''}` +
        `${i.expireAfterSeconds !== undefined ? ` TTL ${i.expireAfterSeconds}s` : ''}`
    )
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Index migration failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
