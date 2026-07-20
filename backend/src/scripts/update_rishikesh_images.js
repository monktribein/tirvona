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

    // 1. Update Parmarth Niketan Ashram
    const parmarthName = 'Parmarth Niketan Ashram';
    const parmarthImages = [
      '/assets/uploads/parmarth-niketan-cover.jpg',
      '/assets/uploads/parmarth-niketan-gallery-1.jpg',
      '/assets/uploads/parmarth-niketan-gallery-2.jpg',
      '/assets/uploads/parmarth-niketan-gallery-3.jpg',
      '/assets/uploads/parmarth-niketan-gallery-4.jpg',
      '/assets/uploads/parmarth-niketan-gallery-5.jpg'
    ];

    const result = await Ashram.updateOne(
      { name: parmarthName, 'address.city': 'Rishikesh' },
      { $set: { images: parmarthImages } }
    );

    if (result.matchedCount > 0) {
      console.log(`Successfully updated image references for ${parmarthName}.`);
    } else {
      console.warn(`WARNING: Could not find ashram with name "${parmarthName}" in Rishikesh!`);
    }

    // 2. Log status of other Rishikesh Ashrams (to confirm they are left untouched)
    const otherAshrams = await Ashram.find({
      'address.city': 'Rishikesh',
      name: { $ne: parmarthName }
    });
    console.log('\nOther Rishikesh Ashrams (Left untouched):');
    otherAshrams.forEach(ashram => {
      console.log(`- ${ashram.name}: ${ashram.images?.length || 0} images (Unmodified)`);
    });

    console.log('\nDatabase update completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update database:', err);
    process.exit(1);
  }
};

run();
