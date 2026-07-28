/**
 * Backfill `isVerified` on accounts that predate the OTP feature.
 *
 * Every existing user is treated as verified: they registered before OTP was a
 * requirement and must never be locked out or asked to re-verify. Only accounts
 * created through the new public registration flow carry `isVerified: false`,
 * and those are left alone by the filter below.
 *
 * The User schema also defaults `isVerified` to true, so old documents already
 * read as verified even before this runs — this script just makes it explicit
 * and queryable/indexable.
 *
 * Run from the backend/ directory:  node src/scripts/migrate_users_verified.js
 * Pass --dry to preview without writing.
 */
import dns from 'dns';
import mongoose from 'mongoose';
import config from '../config/env.js';
import User from '../models/User.js';

// Atlas SRV lookups fail with this machine's default DNS resolver (see config/db.js).
dns.setServers(['8.8.8.8', '1.1.1.1']);

const isDryRun = process.argv.includes('--dry');

const run = async () => {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to ${mongoose.connection.name}`);

  // Only documents that have never had the field set. An account explicitly
  // marked false by the registration flow is mid-verification, not legacy.
  const filter = { isVerified: { $exists: false } };

  const pending = await User.countDocuments(filter);
  const total = await User.countDocuments();
  console.log(`${total} users total; ${pending} missing isVerified.`);

  if (pending === 0) {
    console.log('Nothing to migrate.');
  } else if (isDryRun) {
    console.log(`[DRY RUN] Would set isVerified=true on ${pending} user(s). No changes written.`);
  } else {
    const result = await User.updateMany(filter, { $set: { isVerified: true } });
    console.log(`Migrated ${result.modifiedCount} user(s) to isVerified=true.`);
  }

  const unverified = await User.countDocuments({ isVerified: false });
  console.log(`${unverified} account(s) remain unverified (awaiting registration OTP).`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
