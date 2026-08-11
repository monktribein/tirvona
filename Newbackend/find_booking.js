const path = require('path');
const mongoose = require(path.join(__dirname, 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  let found = false;
  for (const col of collections) {
    const docs = await db.collection(col.name).find({
      $or: [
        { reference: /2CHV8RFS/i },
        { bookingId: /2CHV8RFS/i },
        { displayCode: /2CHV8RFS/i },
        { _id: /2CHV8RFS/i }
      ]
    }).toArray();

    if (docs.length > 0) {
      found = true;
      console.log(`\n=== Found ${docs.length} matching document(s) in collection: ${col.name} ===`);
      console.log(JSON.stringify(docs, null, 2));
    }
  }

  if (!found) {
    console.log("\nNo document matching reference '2CHV8RFS' was found in any collection.");
    console.log("Listing recent parking bookings in database...");
    for (const name of ['parking_bookings', 'bookings', 'parking_qrcodes']) {
      if (collections.some(c => c.name === name)) {
        const sample = await db.collection(name).find({}).sort({ _id: -1 }).limit(5).toArray();
        console.log(`\n--- Recent documents in ${name} ---`);
        console.log(JSON.stringify(sample, null, 2));
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
