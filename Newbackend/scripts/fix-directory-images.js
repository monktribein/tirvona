const { MongoClient } = require("mongodb");
require("dotenv").config();

async function fixDirectoryImages() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("test");
    const collection = db.collection("sacreddirectoryitems");

    const updates = [
      {
        slug: "ganga-kripa-rudraksha-haridwar",
        coverImage: "/images/services/rudraksha_store.jpg",
      },
      {
        slug: "haridwar-chardham-innova-cab",
        coverImage: "/images/services/innova_cab.jpg",
      },
      {
        slug: "bhagavad-gita-gold-edition",
        coverImage: "/images/services/bhagavad_gita.jpg",
      },
      {
        slug: "chotiwala-satvik-restaurant-rishikesh",
        coverImage: "/images/services/satvik_thali.jpg",
      },
    ];

    for (const u of updates) {
      const result = await collection.updateOne(
        { slug: u.slug },
        { $set: { coverImage: u.coverImage } }
      );
      console.log(`Updated ${u.slug}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    }

    console.log("All directory image updates completed successfully.");
  } catch (err) {
    console.error("Error updating directory images:", err);
  } finally {
    await client.close();
  }
}

fixDirectoryImages();
