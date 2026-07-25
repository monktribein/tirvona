import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';
const DEFAULT_OWNER_PASSWORD = 'admin123'; // Standard password for all ashram owners

// Helper to construct a clean email ID from Ashram name: <first_name_of_ashram>@tirvona.com
const getAshramOwnerEmail = (ashramName) => {
  const cleanName = ashramName
    .replace(/ashram|dharamshala|guest house|guesthouse|retreat|trust|sangha|himalayas|jkp/gi, '')
    .trim();
  
  const parts = cleanName.split(/\s+/).filter(Boolean);
  let slug = parts.slice(0, 2).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) slug = ashramName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  return `${slug}@tirvona.com`;
};

const runSeedAshramOwners = async () => {
  try {
    console.log('\n=============================================');
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas successfully.');
    console.log('=============================================\n');

    const ashrams = await Ashram.find();
    console.log(`Found ${ashrams.length} Ashrams in database.\n`);

    const ownerCredentialsList = [];
    let phoneCounter = 9811000001;

    for (const ashram of ashrams) {
      const email = getAshramOwnerEmail(ashram.name);

      // Check if user already exists
      let ownerUser = await User.findOne({ email });
      if (!ownerUser) {
        let phone = (phoneCounter++).toString();
        while (await User.findOne({ phone })) {
          phone = (phoneCounter++).toString();
        }
        ownerUser = await User.create({
          name: `Trustee - ${ashram.name}`,
          email,
          phone,
          passwordHash: DEFAULT_OWNER_PASSWORD,
          role: 'owner',
          status: 'active',
        });
        console.log(`[CREATED OWNER] ${ownerUser.name} -> Email: ${email}`);
      } else {
        ownerUser.name = `Trustee - ${ashram.name}`;
        ownerUser.role = 'owner';
        ownerUser.status = 'active';
        ownerUser.passwordHash = DEFAULT_OWNER_PASSWORD;
        await ownerUser.save();
        console.log(`[UPDATED OWNER] ${ownerUser.name} -> Email: ${email}`);
      }

      // Link Ashram to this Owner
      ashram.ownerId = ownerUser._id;
      await ashram.save();

      ownerCredentialsList.push({
        ashramName: ashram.name,
        city: ashram.city,
        ownerName: ownerUser.name,
        email: ownerUser.email,
        password: DEFAULT_OWNER_PASSWORD,
        ownerId: ownerUser._id.toString(),
      });
    }

    console.log('\n========================================================================================');
    console.log('                 ALL ASHRAM OWNER ACCOUNTS CREATED & LINKED SUCCESSFULLY');
    console.log('========================================================================================');
    console.table(ownerCredentialsList.map(item => ({
      'Ashram Name': item.ashramName,
      'City': item.city,
      'Owner User ID / Email': item.email,
      'Password': item.password,
    })));
    console.log('========================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding ashram owners:', error);
    process.exit(1);
  }
};

runSeedAshramOwners();
