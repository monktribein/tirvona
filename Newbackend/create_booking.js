require("dotenv").config({ path: require("path").join(__dirname, ".", ".env") });
const { setServers } = require('node:dns');
setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const mongoose = require(path.join(__dirname, 'node_modules', 'mongoose'));

const uri = process.env.MONGODB_URI || (() => { throw new Error("Set MONGODB_URI in Newbackend/.env"); })();

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  const targetBookingId = "TVN-PKG-2CHV8RFS";

  console.log(`\nCreating new parking booking document in 'parking_bookings' with reference '${targetBookingId}'...`);

  // Fetch a sample parking location or create fallback
  let location = await db.collection('parking_locations').findOne({});
  let locationId = location ? location._id : new mongoose.Types.ObjectId();

  const newBooking = {
    _id: new mongoose.Types.ObjectId(),
    bookingId: targetBookingId,
    reference: targetBookingId,
    userId: "6a687c7a6fd012ffeef99f56",
    locationId: locationId,
    vehicleNumber: "MH12AB1234",
    vehicleType: "car",
    entryAt: "2026-08-19T09:00:00.000Z",
    exitAt: "2026-08-19T18:00:00.000Z",
    status: "confirmed",
    paymentStatus: "paid",
    totalAmount: 250,
    amountPaid: 250,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const res = await db.collection('parking_bookings').insertOne(newBooking);
  console.log(`\nSUCCESS! Created booking document with _id: ${res.insertedId}`);
  console.log("Document details:");
  console.log(JSON.stringify(newBooking, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
