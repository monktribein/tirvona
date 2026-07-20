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
    await mongoose.connect(connStr);
    const ashrams = await Ashram.find({}, 'name address.city images');
    for (let ashram of ashrams) {
      console.log(`Ashram: ${ashram.name} (${ashram.address.city})`);
      console.log(`Images (${ashram.images?.length || 0}):`);
      if (ashram.images) {
        ashram.images.forEach((img, i) => {
          console.log(`  [${i}]: ${img}`);
        });
      }
      console.log('----------------------------------------------------');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
