/**
 * Marks every approved ashram as "not available for booking"
 * (bookingPaused = true), except a named allowlist of stays that
 * stay available.
 *
 *   node scripts/pause-all-stays-except.js            # report only
 *   node scripts/pause-all-stays-except.js --apply    # write changes
 *
 * Edit ALWAYS_AVAILABLE below to change which stays stay bookable.
 * Matching is case-insensitive and ignores spaces/punctuation, so
 * "Sukhram Dham (A)" also matches "Sukhram Dham(A)" / "sukhram dham a".
 */
const mongoose = require("mongoose");
const dns = require("node:dns");
require("dotenv").config();

const ALWAYS_AVAILABLE = [
  "Hotel Dwarika Palace",
  "Laxmi Bhawan",
  "Sukhram Dham",
  "Sukhram Dham (A)",
];

const ensureSrvResolvable = async (uri) => {
  if (!uri.startsWith("mongodb+srv://")) return;
  const host = uri.split("@").pop().split("/")[0].split("?")[0];
  const record = `_mongodb._tcp.${host}`;
  try {
    await dns.promises.resolveSrv(record);
    return;
  } catch {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  }
  try {
    await dns.promises.resolveSrv(record);
    console.log("note: resolved the cluster through a public DNS server.");
  } catch (error) {
    throw new Error(
      `Could not resolve ${record} (${error.code || error.message}). ` +
        "Your network is blocking DNS SRV lookups. Re-run with a direct " +
        "connection string, e.g.\n" +
        '  node scripts/pause-all-stays-except.js --uri "mongodb://user:pass@host:27017,.../db?ssl=true&authSource=admin"',
    );
  }
};

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const APPLY = process.argv.includes("--apply");

(async () => {
  const override = process.argv.indexOf("--uri");
  const uri =
    override > -1 && process.argv[override + 1]
      ? process.argv[override + 1]
      : process.env.MONGODB_URI
          .replace("<username>", encodeURIComponent(process.env.MONGODB_USERNAME || ""))
          .replace("<password>", encodeURIComponent(process.env.MONGODB_PASSWORD || ""));

  await ensureSrvResolvable(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const ashrams = db.collection("ashrams");

  const allowSet = new Set(ALWAYS_AVAILABLE.map(normalize));

  const rows = await ashrams
    .find({ status: "approved", deletedAt: null })
    .project({ name: 1, bookingPaused: 1 })
    .toArray();

  const toPause = [];
  const toKeepAvailable = [];
  for (const row of rows) {
    const isAllowed = allowSet.has(normalize(row.name));
    if (isAllowed) toKeepAvailable.push(row);
    else toPause.push(row);
  }

  console.log(`approved ashrams scanned : ${rows.length}`);
  console.log(`will stay AVAILABLE      : ${toKeepAvailable.length}`);
  for (const row of toKeepAvailable) console.log(`  [available] ${row.name}`);
  const matchedNames = new Set(toKeepAvailable.map((r) => normalize(r.name)));
  for (const name of ALWAYS_AVAILABLE)
    if (!matchedNames.has(normalize(name)))
      console.log(`  WARNING: no approved ashram found matching "${name}" — check spelling.`);

  console.log(`will be marked NOT AVAILABLE : ${toPause.length}`);
  for (const row of toPause.slice(0, 20))
    console.log(`  [pause] ${row.name}${row.bookingPaused ? " (already paused)" : ""}`);
  if (toPause.length > 20) console.log(`  ... and ${toPause.length - 20} more`);

  if (!APPLY) {
    console.log("\nreport only. re-run with --apply to write these changes.");
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const pauseIds = toPause.map((r) => r._id);
  const availableIds = toKeepAvailable.map((r) => r._id);

  if (pauseIds.length)
    await ashrams.updateMany(
      { _id: { $in: pauseIds } },
      {
        $set: {
          bookingPaused: true,
          bookingPausedAt: now,
          availabilityRequest: { pending: false, requestedAt: null, requestedBy: null },
        },
      },
    );

  if (availableIds.length)
    await ashrams.updateMany(
      { _id: { $in: availableIds } },
      {
        $set: {
          bookingPaused: false,
          bookingPausedAt: null,
          availabilityRequest: { pending: false, requestedAt: null, requestedBy: null },
        },
      },
    );

  console.log(
    `\npaused ${pauseIds.length} ashram(s); kept ${availableIds.length} ashram(s) available.`,
  );
  await mongoose.disconnect();
})().catch((error) => {
  console.error("ERR:", error.message);
  process.exit(1);
});
