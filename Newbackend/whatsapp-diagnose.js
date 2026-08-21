const mongoose = require("mongoose");
require("dotenv").config();

(async () => {
  const uri = process.env.MONGODB_URI
    .replace("<username>", encodeURIComponent(process.env.MONGODB_USERNAME || ""))
    .replace("<password>", encodeURIComponent(process.env.MONGODB_PASSWORD || ""));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const rows = await mongoose.connection.db
    .collection("booking_notifications")
    .find({})
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray();

  console.log("\nmost recent booking notifications (newest first):\n");
  for (const r of rows) {
    console.log([
      r.createdAt?.toISOString?.() ?? "?",
      (r.event || "?").padEnd(20),
      ("row:" + r.status).padEnd(12),
      ("chan:" + r.channel).padEnd(14),
      "wa:" + (r.meta?.whatsappStatus ?? "(never attempted)"),
      r.meta?.whatsappReason ? "reason:" + r.meta.whatsappReason : "",
      r.recipientPhone ? "phone:***" + String(r.recipientPhone).slice(-4) : "phone:MISSING",
      r.deliveryError ? "err:" + r.deliveryError : "",
    ].join("  "));
  }

  const stuck = await mongoose.connection.db
    .collection("booking_notifications")
    .countDocuments({ status: "queued" });
  console.log(`\nrows still stuck in status "queued": ${stuck}`);
  console.log('(the outbox poller only reads the OLDEST 100 queued rows per pass —');
  console.log(' if this number is at or above 100, new notifications are being starved)\n');

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
