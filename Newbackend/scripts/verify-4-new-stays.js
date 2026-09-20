const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);
const mongoose = require('mongoose');
const uri = 'mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority';

async function verify() {
  await mongoose.connect(uri);
  const slugs = ['shri-hari-singh-dham', 'kripa-hotel', 'the-vrind-orchid-hotel', 'comfort-inn-braj'];
  const stays = await mongoose.connection.db.collection('ashrams').find({ slug: { $in: slugs } }).toArray();
  
  console.log(`\nFound ${stays.length} of 4 new stays in database:`);
  let grandTotal = 0;
  for (const s of stays) {
    const rooms = await mongoose.connection.db.collection('rooms').find({ ashramId: s._id }).toArray();
    const total = rooms.reduce((acc, r) => acc + (r.totalInventory || 0), 0);
    grandTotal += total;
    console.log(`\n🏨 ${s.name} (${s.slug})`);
    console.log(`   Address: ${s.address.street}, ${s.address.city}`);
    console.log(`   Phone: ${s.contact.phone} | Status: ${s.status} | Booking Paused: ${s.bookingPaused}`);
    console.log(`   Images: ${s.images.length} photos`);
    if (s.images.length) console.log(`     [Img 1] ${s.images[0]}`);
    console.log(`   Total Rooms: ${total}`);
    rooms.forEach(r => console.log(`     • ${r.name} (${r.acType}): ${r.totalInventory} units @ ₹${r.basePrice}`));
  }
  console.log(`\n========================================`);
  console.log(`Grand Total Rooms Across 4 New Stays: ${grandTotal}`);
  console.log(`========================================\n`);
  await mongoose.disconnect();
}

verify().catch(console.error);
