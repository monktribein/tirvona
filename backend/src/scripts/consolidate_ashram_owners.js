import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Ashram from '../models/Ashram.js';

dotenv.config();

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const consolidateOwners = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB Atlas.');

    const ashrams = await Ashram.find();
    console.log(`Found ${ashrams.length} Ashrams.\n`);

    for (const ashram of ashrams) {
      console.log(`\nProcessing Ashram: "${ashram.name}"...`);

      // Extract key search terms from ashram name
      const cleanName = ashram.name
        .replace(/ashram|dharamshala|guest house|guesthouse|retreat|trust|sangha|himalayas|jkp/gi, '')
        .trim();
      const firstWord = cleanName.split(/\s+/)[0] || ashram.name;

      // Find all owner users matching this ashram name or email prefix
      const matchingUsers = await User.find({
        role: 'owner',
        $or: [
          { name: { $regex: firstWord, $options: 'i' } },
          { email: { $regex: firstWord.toLowerCase(), $options: 'i' } }
        ]
      });

      console.log(`  Found ${matchingUsers.length} matching owner user accounts:`, matchingUsers.map(u => u.email));

      if (matchingUsers.length > 0) {
        // Pick the primary user (or update all matching users to point to this ashram)
        const primaryUser = matchingUsers[0];
        
        // Update Ashram's ownerId to primaryUser._id
        ashram.ownerId = primaryUser._id;
        await ashram.save();
        console.log(`  -> Linked Ashram "${ashram.name}" to Owner User: ${primaryUser.email} (ID: ${primaryUser._id})`);

        // Also ensure all other matching user accounts (e.g. sapt@tirvona.com and saptrishi@tirvona.com) exist with same password
        for (const u of matchingUsers) {
          u.passwordHash = 'admin123';
          await u.save();
        }
      }
    }

    console.log('\n===================================================================');
    console.log('       ALL ASHRAMS CONSOLIDATED AND LINKED TO OWNER ACCOUNTS!');
    console.log('===================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error consolidating owners:', error);
    process.exit(1);
  }
};

consolidateOwners();
