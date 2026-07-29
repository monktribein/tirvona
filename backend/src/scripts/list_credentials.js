import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('\n===============================================================');
  console.log('                 ALL ASHRAM LOGIN CREDENTIALS                  ');
  console.log('===============================================================\n');

  const ashrams = await Ashram.find().populate('ownerId');
  const list = ashrams.map(a => ({
    'Ashram Name': a.name,
    'City': a.city,
    'Login Email': a.ownerId ? a.ownerId.email : 'No owner assigned',
    'Password': 'admin123'
  }));

  console.table(list);

  console.log('\n===============================================================');
  console.log('                 SYSTEM ADMIN ACCOUNTS                         ');
  console.log('===============================================================\n');

  const admins = await User.find({ role: { $in: ['admin', 'super_admin', 'owner', 'district_officer'] } });
  const adminList = admins.map(u => ({
    'Role': u.role,
    'Name': u.name,
    'Login Email': u.email,
    'Password': 'admin123'
  }));

  console.table(adminList);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
