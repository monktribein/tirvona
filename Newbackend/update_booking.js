const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  let foundCount = 0;
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
      foundCount += docs.length;
      console.log(`\nFOUND IN '${col.name}':`, JSON.stringify(docs, null, 2));
      
      for (const doc of docs) {
        const updateFields = {};
        if (doc.entryAt) {
          const newEntry = new Date(doc.entryAt);
          newEntry.setFullYear(2026, 7, 19); // 19th Aug 2026
          updateFields.entryAt = newEntry.toISOString();
        }
        if (doc.exitAt) {
          const newExit = new Date(doc.exitAt);
          newExit.setFullYear(2026, 7, 19);
          updateFields.exitAt = newExit.toISOString();
        }
        if (doc.start) {
          const newStart = new Date(doc.start);
          newStart.setFullYear(2026, 7, 19);
          updateFields.start = newStart.toISOString();
        }
        if (doc.end) {
          const newEnd = new Date(doc.end);
          newEnd.setFullYear(2026, 7, 19);
          updateFields.end = newEnd.toISOString();
        }

        if (Object.keys(updateFields).length > 0) {
          await db.collection(col.name).updateOne({ _id: doc._id }, { $set: updateFields });
          console.log(`SUCCESS: Updated document ${doc._id} in collection '${col.name}' with:`, updateFields);
        } else {
          console.log(`Doc found but no standard date fields to update.`);
        }
      }
    }
  }

  if (foundCount === 0) {
    console.log("\nNo document matching '2CHV8RFS' was found in the DB.");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
