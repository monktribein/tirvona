import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

async function generateSummary() {
  await mongoose.connect(MONGO_URI);
  const users = await User.find().lean();
  const ashrams = await Ashram.find().lean();

  const ashramOwnerMap = new Map();
  ashrams.forEach(a => {
    if (a.ownerId) ashramOwnerMap.set(a.ownerId.toString(), a.name);
  });

  const roles = {};
  users.forEach(u => {
    roles[u.role] = (roles[u.role] || 0) + 1;
  });

  console.log('TOTAL USERS:', users.length);
  console.log('ROLE COUNTS:', JSON.stringify(roles, null, 2));

  console.log('\n--- KEY SUPPORT & HANDOVER ACCOUNTS ---');
  const keyRoles = ['super_admin', 'district_officer', 'owner', 'manager', 'reception', 'housekeeping', 'banner_manager', 'marketplace_manager', 'support', 'customer'];
  
  keyRoles.forEach(r => {
    const list = users.filter(u => u.role === r);
    console.log(`\n=== ROLE: ${r.toUpperCase()} (${list.length} accounts) ===`);
    list.slice(0, 5).forEach(u => {
      console.log(`Name: ${u.name} | Email: ${u.email} | Scope: ${ashramOwnerMap.get(u._id.toString()) || u.ashramName || 'Global'}`);
    });
  });

  process.exit(0);
}

generateSummary().catch(console.error);
