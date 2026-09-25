require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
/**
 * Clean dummy data and set actual inventory:
 * Total Rooms: 320
 * Tirvona Rooms: 270
 * Offline Rooms: 50
 */
const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'node_modules', 'mongoose'));

const uri = process.env.MONGODB_URI || (() => { throw new Error("Set MONGODB_URI in Newbackend/.env"); })();

const ACTUAL_STAYS = [
  { name: "Hotel Sharda Palace", slug: "hotel-sharda-palace", rooms: 14 },
  { name: "Girraj Stay Inn", slug: "girraj-stay-inn", rooms: 20 },
  { name: "Radha Palace", slug: "radha-palace", rooms: 10 },
  { name: "Shri Prakash Dham", slug: "shri-prakash-dham", rooms: 15 },
  { name: "Satya Nikunj Inn", slug: "satya-nikunj-inn", rooms: 20 },
  { name: "Hotel Krishna Anandam", slug: "hotel-krishna-anandam", rooms: 32 },
  { name: "Hotel Shakun Palace", slug: "hotel-shakun-palace", rooms: 18 },
  { name: "Sukhram Dham", slug: "sukhram-dham", rooms: 9 },
  { name: "Sukhram Dham (A)", slug: "sukhram-dham-a", rooms: 6 },
  { name: "Hotel Dwarika Palace", slug: "hotel-dwarika-palace", rooms: 6 },
  { name: "Laxmi Bhawan", slug: "laxmi-bhawan", rooms: 30 },
  { name: "Prem Mandir Dharamshala", slug: "prem-mandir-dharamshala", rooms: 90, offline: 50 },
];

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const ashramsCol = db.collection('ashrams');
  const roomsCol = db.collection('rooms');
  const offlineCol = db.collection('offline_rooms');
  const inventoryCol = db.collection('booking_daily_availability');

  const now = new Date();

  const actualSlugs = new Set(ACTUAL_STAYS.map(s => s.slug));
  const actualNames = new Set(ACTUAL_STAYS.map(s => s.name.toLowerCase()));

  // 1. Find all ashrams
  const allAshrams = await ashramsCol.find({}).toArray();
  const keepAshramIds = [];
  const removeAshramIds = [];

  for (const a of allAshrams) {
    const isActual = actualSlugs.has(a.slug) || actualNames.has((a.name || '').toLowerCase());
    if (isActual) {
      keepAshramIds.push(a._id);
    } else {
      removeAshramIds.push(a._id);
    }
  }

  console.log(`Ashrams to keep active: ${keepAshramIds.length}`);
  console.log(`Ashrams to remove (dummy): ${removeAshramIds.length}`);

  // 2. Soft-delete dummy ashrams and ALL rooms not belonging to keepAshramIds
  const keepIdsString = keepAshramIds.map(id => String(id));
  const keepIdsObject = keepAshramIds.map(id => new mongoose.Types.ObjectId(id));

  const roomOrphanRes = await roomsCol.updateMany(
    {
      $and: [
        { ashramId: { $nin: [...keepIdsObject, ...keepIdsString] } },
        { deletedAt: null }
      ]
    },
    { $set: { deletedAt: now, status: "under_maintenance" } }
  );
  console.log(`Marked orphan/dummy rooms as deleted: ${roomOrphanRes.modifiedCount}`);

  if (removeAshramIds.length > 0) {
    const ashramRes = await ashramsCol.updateMany(
      { _id: { $in: removeAshramIds } },
      { $set: { deletedAt: now, status: "rejected", bookingPaused: true } }
    );
    console.log(`Marked dummy ashrams as deleted: ${ashramRes.modifiedCount}`);

    const offRes = await offlineCol.updateMany(
      { ashramId: { $in: removeAshramIds } },
      { $set: { deletedAt: now, status: "inactive" } }
    );
    console.log(`Marked dummy offline rooms as deleted: ${offRes.modifiedCount}`);

    const invRes = await inventoryCol.deleteMany({
      ashramId: { $in: removeAshramIds }
    });
    console.log(`Cleaned dummy daily inventory rows: ${invRes.deletedCount}`);
  }

  // 3. Ensure actual ashrams are active and non-deleted
  await ashramsCol.updateMany(
    { _id: { $in: keepAshramIds } },
    { $set: { deletedAt: null, status: "approved", bookingPaused: false } }
  );

  // 4. Configure Prem Mandir Dharamshala: 90 Tirvona rooms + 50 Offline rooms
  const premMandir = await ashramsCol.findOne({ slug: "prem-mandir-dharamshala" });
  if (premMandir) {
    console.log("\nConfiguring Prem Mandir Dharamshala (90 Tirvona rooms + 50 Offline rooms)...");
    // Ensure rooms total 90
    // Let's check existing rooms of Prem Mandir Dharamshala
    const pmRooms = await roomsCol.find({ ashramId: premMandir._id, deletedAt: null }).toArray();
    console.log(`Existing Prem Mandir room categories: ${pmRooms.length}`);

    // Update rooms to total 90
    if (pmRooms.length >= 3) {
      await roomsCol.updateOne({ _id: pmRooms[0]._id }, { $set: { totalInventory: 40, status: "active", deletedAt: null } });
      await roomsCol.updateOne({ _id: pmRooms[1]._id }, { $set: { totalInventory: 30, status: "active", deletedAt: null } });
      await roomsCol.updateOne({ _id: pmRooms[2]._id }, { $set: { totalInventory: 20, status: "active", deletedAt: null } });
      // Delete any excess room categories for Prem Mandir
      if (pmRooms.length > 3) {
        const excessIds = pmRooms.slice(3).map(r => r._id);
        await roomsCol.updateMany({ _id: { $in: excessIds } }, { $set: { deletedAt: now, status: "under_maintenance" } });
      }
    } else {
      // Recreate clean rooms
      await roomsCol.deleteMany({ ashramId: premMandir._id });
      await roomsCol.insertMany([
        {
          ashramId: premMandir._id,
          name: "Deluxe AC Room",
          type: "private_room",
          acType: "AC",
          capacity: 2,
          totalInventory: 40,
          basePrice: 1500,
          sellingPrice: 1500,
          status: "active",
          amenities: ["AC", "Attached Bath", "Free Wi-Fi"],
          images: [],
          pricingRules: [],
          deletedAt: null,
          createdAt: now,
          updatedAt: now
        },
        {
          ashramId: premMandir._id,
          name: "AC Family Room",
          type: "family_room",
          acType: "AC",
          capacity: 4,
          totalInventory: 30,
          basePrice: 2200,
          sellingPrice: 2200,
          status: "active",
          amenities: ["AC", "Attached Bath", "Free Wi-Fi"],
          images: [],
          pricingRules: [],
          deletedAt: null,
          createdAt: now,
          updatedAt: now
        },
        {
          ashramId: premMandir._id,
          name: "Standard AC Room",
          type: "private_room",
          acType: "AC",
          capacity: 2,
          totalInventory: 20,
          basePrice: 1100,
          sellingPrice: 1100,
          status: "active",
          amenities: ["AC", "Attached Bath"],
          images: [],
          pricingRules: [],
          deletedAt: null,
          createdAt: now,
          updatedAt: now
        }
      ]);
    }

    // Set offline rooms for Prem Mandir Dharamshala to exactly 50 units
    const activePmRooms = await roomsCol.find({ ashramId: premMandir._id, deletedAt: null }).toArray();
    await offlineCol.deleteMany({ ashramId: premMandir._id });
    await offlineCol.insertOne({
      ashramId: premMandir._id,
      roomId: activePmRooms[0]._id,
      label: "Front Desk Offline Quota",
      totalUnits: 50,
      transferredUnits: 0,
      blockedUnits: 0,
      status: "active",
      notes: "Held back for walk-in yatris and front desk",
      createdBy: premMandir.ownerId,
      updatedBy: premMandir.ownerId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    });
    console.log("Prem Mandir Dharamshala offline quota set to 50 units.");
  }

  // 5. Clean up any other active offline rooms outside our actual list
  await offlineCol.updateMany(
    { ashramId: { $ne: premMandir ? premMandir._id : null } },
    { $set: { deletedAt: now, status: "inactive" } }
  );

  // 6. Ensure all active rooms across keepAshramIds are marked active with deletedAt: null
  await roomsCol.updateMany(
    { ashramId: { $in: keepAshramIds }, deletedAt: null },
    { $set: { status: "active" } }
  );

  // 7. Reset any test/blocked daily inventory counts for today
  await inventoryCol.updateMany(
    { ashramId: { $in: keepAshramIds } },
    { $set: { isClosed: false, maintenanceCount: 0, heldCount: 0 } }
  );

  // 8. Verify totals
  console.log("\n=================== VERIFICATION ===================");
  const finalActiveRooms = await roomsCol.find({
    ashramId: { $in: keepAshramIds },
    deletedAt: null,
    status: "active"
  }).toArray();

  const finalOffline = await offlineCol.find({
    ashramId: { $in: keepAshramIds },
    deletedAt: null,
    status: "active"
  }).toArray();

  const registeredTotal = finalActiveRooms.reduce((sum, r) => sum + (r.totalInventory || 0), 0);
  const offlineTotal = finalOffline.reduce((sum, o) => sum + (o.totalUnits || 0), 0);
  const grandTotal = registeredTotal + offlineTotal;

  console.log(`Registered Rooms (Tirvona): ${registeredTotal}`);
  console.log(`Offline Rooms:              ${offlineTotal}`);
  console.log(`TOTAL ROOMS:                ${grandTotal}`);
  console.log("====================================================");

  for (const item of ACTUAL_STAYS) {
    const a = await ashramsCol.findOne({ slug: item.slug });
    if (a) {
      const rs = await roomsCol.find({ ashramId: a._id, deletedAt: null }).toArray();
      const rTotal = rs.reduce((sum, r) => sum + (r.totalInventory || 0), 0);
      const offs = await offlineCol.find({ ashramId: a._id, deletedAt: null, status: "active" }).toArray();
      const offTotal = offs.reduce((sum, o) => sum + (o.totalUnits || 0), 0);
      console.log(`🏨 ${a.name}: ${rTotal} Tirvona rooms ${offTotal > 0 ? `+ ${offTotal} offline` : ''}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Clean script error:", err);
  process.exit(1);
});
