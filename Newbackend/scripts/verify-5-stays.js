const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);
const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function verify() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const slugs = ['hotel-sharda-palace', 'girraj-stay-inn', 'radha-palace', 'shri-prakash-dham', 'satya-nikunj-inn'];
  const stays = await db.collection('ashrams').find({ slug: { $in: slugs } }).toArray();
  
  console.log(`\nFound ${stays.length} of 5 stays in database:`);
  let grandTotalRooms = 0;
  for (const s of stays) {
    const rooms = await db.collection('rooms').find({ ashramId: s._id }).toArray();
    const totalInventory = rooms.reduce((sum, r) => sum + (r.totalInventory || 0), 0);
    grandTotalRooms += totalInventory;
    console.log(`\n🏨 ${s.name} [slug: ${s.slug}]`);
    console.log(`   Address: ${s.address.street}, ${s.address.city}`);
    console.log(`   Phone: ${s.contact.phone} | Status: ${s.status} | Booking Paused: ${s.bookingPaused}`);
    console.log(`   Images: ${s.images ? s.images.length : 0} photos | Lowest Price: ₹${s.pricing ? s.pricing.lowestNightPrice : 0}`);
    if (s.images && s.images.length) {
      s.images.slice(0, 3).forEach((im, idx) => console.log(`     [Img ${idx+1}] ${im}`));
    }
    console.log(`   Total Rooms: ${totalInventory}`);
    rooms.forEach(r => {
      console.log(`     • ${r.name} (${r.acType}): ${r.totalInventory} units @ ₹${r.basePrice}`);
      if (r.images && r.images.length) console.log(`       -> Room img: ${r.images[0]}`);
    });
  }
  console.log(`\n========================================`);
  console.log(`Grand Total Rooms Across 5 Stays: ${grandTotalRooms}`);
  console.log(`========================================\n`);
  await mongoose.disconnect();
}

verify().catch(console.error);
