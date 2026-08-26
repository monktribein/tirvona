/**
 * Backfills clean, city-scoped slugs for ashrams created before slug routing.
 *
 * Existing rows carry a slug like "saptrishi-ashram-a3f91b2c" (name + random
 * suffix) and no citySlug. This assigns the clean form, scoped per city, and
 * records a redirect from every previous public path so nothing that is already
 * indexed turns into a 404.
 *
 * It also drops the old global unique index on `slug`, which would otherwise
 * reject two cities legitimately using the same clean slug.
 *
 *   node scripts/backfill-ashram-slugs.js           # report only
 *   node scripts/backfill-ashram-slugs.js --apply   # write changes
 */
const mongoose = require("mongoose");
const dns = require("node:dns");
require("dotenv").config();

/**
 * Node resolves `mongodb+srv://` with its own DNS client rather than the OS
 * resolver, and some setups (VPNs, custom or IPv6 resolvers) refuse those
 * queries even when `nslookup` works — surfacing as `querySrv ECONNREFUSED`.
 * Retrying through a public resolver keeps the script usable on those machines.
 */
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
        '  node scripts/backfill-ashram-slugs.js --uri "mongodb://user:pass@host:27017,.../db?ssl=true&authSource=admin"',
    );
  }
};

const APPLY = process.argv.includes("--apply");

const slugify = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

const RESERVED = new Set(["book", "booking", "search", "admin", "new", "edit"]);

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
  const redirects = db.collection("url_redirects");

  const rows = await ashrams
    .find({ deletedAt: null })
    .project({ name: 1, slug: 1, citySlug: 1, "address.city": 1, "address.district": 1 })
    .toArray();

  const used = new Set();
  const planned = [];

  for (const row of rows) {
    const city =
      slugify(row.address?.city || row.address?.district || "") || "india";
    let base = slugify(row.name) || "ashram";
    if (RESERVED.has(base)) base = `${base}-listing`;

    let slug = base;
    for (let n = 2; used.has(`${city}/${slug}`); n += 1) slug = `${base}-${n}`;
    used.add(`${city}/${slug}`);

    if (row.slug === slug && row.citySlug === city) continue;
    planned.push({
      _id: row._id,
      name: row.name,
      from: row.slug ? `/ashram/${row._id}` : null,
      previousSlugPath:
        row.slug && row.citySlug ? `/ashrams/${row.citySlug}/${row.slug}` : null,
      to: `/ashrams/${city}/${slug}`,
      city,
      slug,
    });
  }

  console.log(`ashrams scanned : ${rows.length}`);
  console.log(`needing a slug  : ${planned.length}`);
  for (const item of planned.slice(0, 15))
    console.log(`  ${item.name} -> ${item.to}`);
  if (planned.length > 15) console.log(`  ... and ${planned.length - 15} more`);

  if (!APPLY) {
    console.log("\nreport only. re-run with --apply to write these changes.");
    await mongoose.disconnect();
    return;
  }

  // The old global unique index would reject the same clean slug in two cities.
  const indexes = await ashrams.indexes();
  for (const index of indexes)
    if (index.key && index.key.slug === 1 && !index.key.citySlug && index.unique) {
      await ashrams.dropIndex(index.name);
      console.log(`dropped global unique index: ${index.name}`);
    }

  let updated = 0;
  for (const item of planned) {
    await ashrams.updateOne(
      { _id: item._id },
      { $set: { slug: item.slug, citySlug: item.city } },
    );
    updated += 1;

    for (const from of [item.from, item.previousSlugPath].filter(Boolean))
      await redirects.updateOne(
        { fromPath: from.toLowerCase() },
        {
          $set: {
            toPath: item.to,
            entityType: "ashram",
            entityId: item._id,
            reason: "ashram slug backfill",
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
  }

  await ashrams.createIndex(
    { citySlug: 1, slug: 1 },
    {
      unique: true,
      partialFilterExpression: {
        citySlug: { $type: "string" },
        slug: { $type: "string" },
      },
    },
  );

  console.log(`\nupdated ${updated} ashram(s); compound unique index in place.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error("ERR:", error.message);
  process.exit(1);
});
