const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  console.log("=== Recent 5 records in 'parking_bookings' ===");
  const pb = await db.collection('parking_bookings').find({}).sort({ _id: -1 }).limit(5).toArray();
  console.log(JSON.stringify(pb, null, 2));

  console.log("\n=== Recent 5 records in 'bookings' ===");
  const b = await db.collection('bookings').find({}).sort({ _id: -1 }).limit(5).toArray();
  console.log(JSON.stringify(b, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
