const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);
const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function checkSummary() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const ashrams = await db.collection('ashrams').find({ deletedAt: null }).toArray();
  const rooms = await db.collection('rooms').find({ deletedAt: null }).toArray();
  const offline = await db.collection('offline_rooms').find({ deletedAt: null, status: "active" }).toArray();

  const registeredUnits = rooms.reduce((sum, r) => sum + (Number(r.totalInventory) || 0), 0);
  const offlineUnits = offline.reduce((sum, o) => sum + (Number(o.totalUnits) || 0), 0);
  const onlineRooms = rooms.filter(r => r.status !== 'under_maintenance').reduce((sum, r) => sum + (Number(r.totalInventory) || 0), 0);

  console.log("\n================ API STATS PREVIEW ================");
  console.log(`TOTAL ROOMS (Tirvona + Offline): ${registeredUnits + offlineUnits}`);
  console.log(`REGISTERED ROOMS:                ${registeredUnits}`);
  console.log(`TIRVONA ROOMS (Sellable online): ${onlineRooms}`);
  console.log(`OFFLINE ROOMS (Held for desk):   ${offlineUnits}`);
  console.log(`AVAILABLE ROOMS:                 ${onlineRooms}`);
  console.log(`Active Properties Count:         ${ashrams.length}`);
  console.log("====================================================\n");

  await mongoose.disconnect();
}

checkSummary().catch(console.error);
