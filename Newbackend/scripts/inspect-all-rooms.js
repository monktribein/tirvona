const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);
const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function inspect() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const ashrams = await db.collection('ashrams').find({ deletedAt: null }).toArray();
  const rooms = await db.collection('rooms').find({ deletedAt: null }).toArray();
  const offlineRooms = await db.collection('offline_rooms').find({ deletedAt: null }).toArray();

  console.log(`Total active ashrams: ${ashrams.length}`);
  console.log(`Total active rooms: ${rooms.length}`);
  console.log(`Total active offline room records: ${offlineRooms.length}`);

  const ashramMap = new Map(ashrams.map(a => [String(a._id), a]));
  const roomCountByAshram = new Map();
  const inventoryByAshram = new Map();

  for (const r of rooms) {
    const aid = String(r.ashramId);
    roomCountByAshram.set(aid, (roomCountByAshram.get(aid) || 0) + 1);
    inventoryByAshram.set(aid, (inventoryByAshram.get(aid) || 0) + (Number(r.totalInventory) || 0));
  }

  const offlineByAshram = new Map();
  for (const o of offlineRooms) {
    const aid = String(o.ashramId);
    offlineByAshram.set(aid, (offlineByAshram.get(aid) || 0) + (Number(o.totalUnits) || 0));
  }

  console.log('\n--- Ashram Breakdown ---');
  for (const a of ashrams) {
    const aid = String(a._id);
    const regUnits = inventoryByAshram.get(aid) || 0;
    const offUnits = offlineByAshram.get(aid) || 0;
    console.log(`[${a.status}] ${a.name} (${a.slug || 'no-slug'}, city: ${a.address?.city || a.citySlug}) => Registered: ${regUnits} rooms (${roomCountByAshram.get(aid) || 0} categories) | Offline: ${offUnits}`);
  }

  const totalRegistered = Array.from(inventoryByAshram.values()).reduce((a, b) => a + b, 0);
  const totalOffline = Array.from(offlineByAshram.values()).reduce((a, b) => a + b, 0);
  console.log(`\nGrand Total Registered Rooms: ${totalRegistered}`);
  console.log(`Grand Total Offline Rooms: ${totalOffline}`);
  console.log(`Total Rooms: ${totalRegistered + totalOffline}`);

  await mongoose.disconnect();
}

inspect().catch(console.error);
