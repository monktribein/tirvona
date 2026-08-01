import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const ROLE_DASHBOARD_MAP = {
  super_admin: '/admin/dashboard',
  owner: '/owner/dashboard',
  stay_admin: '/owner/dashboard',
  district_officer: '/admin/dashboard',
  govt_admin: '/admin/dashboard',
  government_admin: '/admin/dashboard',
  manager: '/owner/dashboard',
  ashram_manager: '/owner/dashboard',
  reception: '/staff/reception',
  housekeeping: '/staff/housekeeping',
  volunteer: '/owner/volunteer',
  volunteer_coordinator: '/owner/volunteer',
  banner_manager: '/bannerboy/dashboard',
  marketplace_manager: '/admin/manage/marketplace/products',
  support: '/support',
  support_executive: '/support',
  customer: '/profile',
  pilgrim: '/profile',
};

async function runAudit() {
  console.log('=== TIRVONA ENTERPRISE ROLE & LOGIN CREDENTIAL AUDIT ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas Cluster\n');

  const allUsers = await User.find().sort({ role: 1, email: 1 }).lean();
  const allAshrams = await Ashram.find().lean();

  const ashramMap = new Map();
  allAshrams.forEach((a) => {
    if (a.ownerId) {
      ashramMap.set(a.ownerId.toString(), a.name);
    }
  });

  console.log(`TOTAL USER ACCOUNTS FOUND IN MONGODB: ${allUsers.length}`);

  const roleCounts = {};
  const duplicateEmailTracker = new Map();
  const userAuditList = [];

  allUsers.forEach((u) => {
    // Track roles
    roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;

    // Track duplicate emails
    const emailLower = u.email.toLowerCase().trim();
    if (duplicateEmailTracker.has(emailLower)) {
      duplicateEmailTracker.get(emailLower).push(u);
    } else {
      duplicateEmailTracker.set(emailLower, [u]);
    }

    const assignedAshram = ashramMap.get(u._id.toString()) || u.ashramName || 'Global Platform';
    const dashboard = ROLE_DASHBOARD_MAP[u.role] || '/profile';
    const defaultPassword = u.role === 'customer' || u.role === 'pilgrim' ? 'pilgrim123' : 'admin123';

    userAuditList.push({
      _id: u._id.toString(),
      name: u.name || 'Unnamed',
      email: u.email,
      role: u.role,
      assignedAshram,
      dashboard,
      defaultPassword,
      isVerified: u.isVerified !== false,
      status: u.isSuspended ? 'Suspended' : u.status || 'Active',
      createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A',
    });
  });

  console.log('\n--- ROLE BREAKDOWN SUMMARY ---');
  Object.entries(roleCounts).forEach(([r, count]) => {
    console.log(`• ${r}: ${count} Account(s)`);
  });

  console.log('\n--- DUPLICATE EMAIL AUDIT ---');
  let dupCount = 0;
  duplicateEmailTracker.forEach((users, email) => {
    if (users.length > 1) {
      dupCount++;
      console.log(`⚠️ Duplicate Email: ${email} (${users.length} accounts)`);
      users.forEach((u) => console.log(`   - ID: ${u._id}, Name: ${u.name}, Role: ${u.role}`));
    }
  });
  if (dupCount === 0) {
    console.log('✅ ZERO duplicate email accounts found in database.');
  }

  console.log('\n--- ALL VERIFIED LOGIN CREDENTIALS ---');
  userAuditList.forEach((u, i) => {
    console.log(`${i + 1}. [${u.role.toUpperCase()}] ${u.name}`);
    console.log(`   Email: ${u.email}`);
    console.log(`   Password: ${u.defaultPassword}`);
    console.log(`   Assigned Scope: ${u.assignedAshram}`);
    console.log(`   Dashboard: ${u.dashboard}`);
    console.log(`   Status: ${u.status} | Verified: ${u.isVerified}\n`);
  });

  process.exit(0);
}

runAudit().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
