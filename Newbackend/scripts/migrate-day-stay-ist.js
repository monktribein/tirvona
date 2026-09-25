// One-off: Day Stay bookings created before the IST fix stored the IST wall
// time as if it were UTC (06:00 IST saved as 06:00Z). Shift them back by
// 5h30m so they are real instants.
//
//   node scripts/migrate-day-stay-ist.js            # dry run, shows what would change
//   node scripts/migrate-day-stay-ist.js --apply    # writes
//
// Rows are marked `dayStayDetails.istMigrated: true`, so re-running is safe.
// Only bookings created before CUTOFF are touched (set it to the deploy time).
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const path = require("path");
const mongoose = require(path.join(__dirname, "..", "node_modules", "mongoose"));

const APPLY = process.argv.includes("--apply");
const cutoffArg = process.argv.find((a) => a.startsWith("--cutoff="));
const CUTOFF = cutoffArg ? new Date(cutoffArg.split("=")[1]) : new Date();
const SHIFT_MS = 330 * 60000;
const FIELDS = [
  "dayStayDetails.slotStartTime",
  "dayStayDetails.slotEndTime",
  "dayStayDetails.graceExpiresAt",
  "dayStayDetails.housekeepingEndsAt",
  "checkInDate",
  "checkOutDate",
];

const get = (obj, p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGODB_URI in Newbackend/.env");
  if (isNaN(CUTOFF.getTime())) throw new Error("Invalid --cutoff date");
  await mongoose.connect(uri);
  const bookings = mongoose.connection.db.collection("booking_bookings");

  const filter = {
    bookingType: { $in: ["day_rest", "freshen_up"] },
    "dayStayDetails.istMigrated": { $ne: true },
    createdAt: { $lt: CUTOFF },
  };
  const rows = await bookings.find(filter).toArray();
  console.log(`${rows.length} Day Stay booking(s) created before ${CUTOFF.toISOString()} to shift by -5:30`);

  for (const b of rows) {
    const $set = { "dayStayDetails.istMigrated": true };
    for (const f of FIELDS) {
      const v = get(b, f);
      if (v instanceof Date) $set[f] = new Date(v.getTime() - SHIFT_MS);
    }
    console.log(
      `${b.bookingId} ${b.status}: ${get(b, "dayStayDetails.slotStartTime")?.toISOString()} -> ${$set["dayStayDetails.slotStartTime"]?.toISOString()}`,
    );
    if (APPLY) await bookings.updateOne({ _id: b._id, "dayStayDetails.istMigrated": { $ne: true } }, { $set });
  }

  console.log(APPLY ? "Done." : "Dry run only. Re-run with --apply to write.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
