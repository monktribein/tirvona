/**
 * update_credentials.js
 * Updates all existing user emails from ashraybharat.gov.in → tirvona.com
 * and resets all passwords to admin123.
 * Run: node src/scripts/update_credentials.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB:', MONGO_URI);

    // 1. Hash the new password
    const newPasswordHash = await bcrypt.hash('admin123', 10);

    // 2. Fetch and update all users with old domain
    const oldDomainUsers = await User.find({ email: /@ashraybharat\.gov\.in/i });
    console.log(`Found ${oldDomainUsers.length} users with old email domain.`);

    let updated = 0;
    for (const user of oldDomainUsers) {
      const newEmail = user.email.replace(/@ashraybharat\.gov\.in/i, '@tirvona.com');
      await User.updateOne(
        { _id: user._id },
        { $set: { email: newEmail, passwordHash: newPasswordHash } }
      );
      console.log(`  ✓ ${user.email}  →  ${newEmail}`);
      updated++;
    }

    // 3. Also reset password for ALL remaining users (already on tirvona.com domain)
    const allOtherUsers = await User.find({ email: { $not: /@ashraybharat\.gov\.in/i } });
    for (const user of allOtherUsers) {
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordHash: newPasswordHash } }
      );
    }
    console.log(`  ✓ Password reset for ${allOtherUsers.length} other users.`);

    console.log(`\n✅ Done! Updated ${updated} email(s). All passwords set to: admin123`);
    console.log('\n📋 Quick Login Credentials:');
    console.log('   Guest Stay      : pilgrim@tirvona.com  / admin123');
    console.log('   Ashram Owner    : owner@tirvona.com    / admin123');
    console.log('   District Officer: officer@tirvona.com  / admin123');
    console.log('   Super Admin     : admin@tirvona.com    / admin123');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
    process.exit(0);
  }
};

run();
