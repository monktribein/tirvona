import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Ashram from '../models/Ashram.js';
import Room from '../models/Room.js';
import connectDB from '../config/db.js';

dotenv.config();

async function runAudit() {
  await connectDB();
  
  const ashrams = await Ashram.find().lean();
  console.log(`=== TOTAL ASHRAMS FOUND: ${ashrams.length} ===\n`);
  
  const auditResults = [];

  for (const ashram of ashrams) {
    const rooms = await Room.find({ ashramId: ashram._id }).lean();
    
    const ashramInfo = {
      id: ashram._id.toString(),
      name: ashram.name,
      city: ashram.address?.city || '',
      state: ashram.address?.state || '',
      status: ashram.status,
      currentAmenities: ashram.amenities || [],
      foodType: ashram.food?.foodType || '',
      addOnServices: ashram.addOnServices ? ashram.addOnServices.map(s => s.name) : [],
      roomCategories: rooms.map(r => ({
        id: r._id.toString(),
        name: r.name,
        type: r.type,
        acType: r.acType,
        basePrice: r.basePrice,
        roomAmenities: r.amenities || []
      }))
    };
    
    auditResults.push(ashramInfo);
  }

  fs.writeFileSync('audit_output.json', JSON.stringify(auditResults, null, 2));
  console.log('Saved audit to audit_output.json');

  // Summary statistics of current state
  let totalWithAC = 0;
  let totalWithRiverView = 0;
  let totalWithVegFood = 0;
  let totalWithParking = 0;
  let totalWithWiFi = 0;

  auditResults.forEach(a => {
    const am = a.currentAmenities.map(x => x.toLowerCase());
    if (am.some(x => x.includes('ac'))) totalWithAC++;
    if (am.some(x => x.includes('river') || x.includes('ganga'))) totalWithRiverView++;
    if (am.some(x => x.includes('veg') || x.includes('food') || x.includes('satvik'))) totalWithVegFood++;
    if (am.some(x => x.includes('park'))) totalWithParking++;
    if (am.some(x => x.includes('wifi'))) totalWithWiFi++;
  });

  console.log('=== SUMMARY OF CURRENT AMENITIES ===');
  console.log(`Total Ashrams: ${auditResults.length}`);
  console.log(`With AC: ${totalWithAC}`);
  console.log(`With River / Ganga View: ${totalWithRiverView}`);
  console.log(`With Pure Veg / Satvik Food: ${totalWithVegFood}`);
  console.log(`With Parking: ${totalWithParking}`);
  console.log(`With WiFi: ${totalWithWiFi}`);

  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
