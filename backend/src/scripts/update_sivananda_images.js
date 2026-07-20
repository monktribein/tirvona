import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Ashram from '../models/Ashram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat';

const run = async () => {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(connStr);
    console.log('Connected to MongoDB successfully.');

    // 1. Update Sivananda Ashram
    const sivanandaName = 'Sivananda Ashram';
    const sivanandaImages = [
      '/assets/uploads/sivananda-ashram-cover.jpg',
      '/assets/uploads/sivananda-ashram-gallery-1.jpg',
      '/assets/uploads/sivananda-ashram-gallery-2.jpg',
      '/assets/uploads/sivananda-ashram-gallery-3.jpg',
      '/assets/uploads/sivananda-ashram-gallery-4.jpg',
      '/assets/uploads/sivananda-ashram-gallery-5.jpg'
    ];

    const result = await Ashram.updateOne(
      { name: sivanandaName, 'address.city': 'Rishikesh' },
      { $set: { images: sivanandaImages } }
    );

    if (result.matchedCount > 0) {
      console.log(`Successfully updated image references for ${sivanandaName}.`);
    } else {
      console.warn(`WARNING: Could not find ashram with name "${sivanandaName}" in Rishikesh!`);
    }

    // 2. Log status of Sivananda to verify
    const updatedSivananda = await Ashram.findOne({ name: sivanandaName, 'address.city': 'Rishikesh' });
    if (updatedSivananda) {
      console.log(`\nVerification of ${sivanandaName}:`);
      console.log(`- Images Array:`, updatedSivananda.images);
    }

    console.log('\nDatabase update completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update database:', err);
    process.exit(1);
  }
};

run();
