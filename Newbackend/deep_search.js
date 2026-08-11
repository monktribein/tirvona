const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, 'node_modules', 'mongoose'));

const uri = "mongodb+srv://nktechipl_db_user:6xb6D9ZbvZ9KkUzY@cluster0.0zchdel.mongodb.net/test?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  
  console.log("Searching all string fields across all collections for '2CHV8RFS' or 'PKG'...");

  for (const col of collections) {
    const docs = await db.collection(col.name).find({
      $where: function() {
        return JSON.stringify(this).toLowerCase().includes("2chv8rfs");
      }
    }).toArray();

    if (docs.length > 0) {
      console.log(`\n=== MATCH FOUND in ${col.name} ===`);
      console.log(JSON.stringify(docs, null, 2));
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
