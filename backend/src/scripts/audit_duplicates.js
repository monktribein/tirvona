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
    
    const imageToAshrams = {};
    let totalImagesCount = 0;
    
    for (let ashram of ashrams) {
      if (!ashram.images) continue;
      ashram.images.forEach((img) => {
        totalImagesCount++;
        if (!imageToAshrams[img]) {
          imageToAshrams[img] = [];
        }
        imageToAshrams[img].push(ashram.name);
      });
    }
    
    console.log(`--- IMAGE UNIQUENESS AUDIT ---`);
    console.log(`Total Ashrams: ${ashrams.length}`);
    console.log(`Total Image Slots: ${totalImagesCount}`);
    
    const duplicates = {};
    let duplicateSlotsCount = 0;
    
    for (let [img, names] of Object.entries(imageToAshrams)) {
      if (names.length > 1) {
        duplicates[img] = names;
        duplicateSlotsCount += names.length;
      }
    }
    
    const uniqueImagesCount = Object.keys(imageToAshrams).length;
    const duplicatedImagesCount = Object.keys(duplicates).length;
    
    console.log(`Unique Image URLs: ${uniqueImagesCount}`);
    console.log(`Duplicated Image URLs: ${duplicatedImagesCount}`);
    console.log(`Total slots occupied by duplicates: ${duplicateSlotsCount}\n`);
    
    console.log(`--- DUPLICATED IMAGE DETAILS ---`);
    let idx = 1;
    for (let [img, names] of Object.entries(duplicates)) {
      console.log(`${idx}. Image: ${img}`);
      console.log(`   Shared by (${names.length} ashrams):`);
      names.forEach(name => console.log(`     - ${name}`));
      console.log();
      idx++;
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
