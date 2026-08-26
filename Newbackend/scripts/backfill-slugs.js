/**
 * Backfills slugs for the entities whose public URLs became slug-based:
 * volunteer jobs and featured banners.
 *
 * Without this their legacy /volunteer/<id> and /featured-banner/<id> URLs
 * resolve to nothing and answer 404 instead of redirecting.
 *
 *   node scripts/backfill-slugs.js           # report only
 *   node scripts/backfill-slugs.js --apply   # write changes
 */
const mongoose = require("mongoose");
const dns = require("node:dns");
require("dotenv").config();

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

/** See backfill-ashram-slugs.js — Node's own DNS client can refuse SRV lookups. */
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
  await dns.promises.resolveSrv(record);
};

const TARGETS = [
  {
    label: "volunteer jobs",
    collection: "volunteerjobs",
    titleFields: ["title", "roleTitle", "name"],
    legacyPaths: (id) => [`/volunteer/${id}`, `/volunteer/job/${id}`],
    publicPath: (slug) => `/volunteer/${slug}`,
    entityType: "volunteerJob",
    fallback: "seva-role",
  },
  {
    label: "featured banners",
    collection: "featured_banners",
    titleFields: ["title", "heading", "name"],
    legacyPaths: (id) => [`/featured-banner/${id}`],
    publicPath: (slug) => `/featured-banner/${slug}`,
    entityType: "featuredBanner",
    fallback: "banner",
  },
];

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
  const redirects = db.collection("url_redirects");

  for (const target of TARGETS) {
    const rows = await db.collection(target.collection).find({}).toArray();
    const used = new Set(
      rows.map((row) => row.slug).filter((slug) => typeof slug === "string"),
    );
    const planned = [];

    for (const row of rows) {
      if (typeof row.slug === "string" && row.slug) continue;
      const title =
        target.titleFields.map((f) => row[f]).find((v) => String(v ?? "").trim()) ??
        "";
      const base = slugify(title) || target.fallback;
      let slug = base;
      for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
      used.add(slug);
      planned.push({ _id: row._id, title: title || "(untitled)", slug });
    }

    console.log(`\n${target.label}: ${rows.length} row(s), ${planned.length} need a slug`);
    for (const item of planned.slice(0, 10))
      console.log(`  ${item.title} -> ${target.publicPath(item.slug)}`);
    if (planned.length > 10) console.log(`  ... and ${planned.length - 10} more`);

    if (!APPLY) continue;

    for (const item of planned) {
      await db
        .collection(target.collection)
        .updateOne({ _id: item._id }, { $set: { slug: item.slug } });
      for (const from of target.legacyPaths(item._id))
        await redirects.updateOne(
          { fromPath: from.toLowerCase() },
          {
            $set: {
              toPath: target.publicPath(item.slug),
              entityType: target.entityType,
              entityId: item._id,
              reason: "slug backfill",
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );
    }
    console.log(`  applied to ${planned.length} row(s).`);
  }

  if (!APPLY)
    console.log("\nreport only. re-run with --apply to write these changes.");
  await mongoose.disconnect();
})().catch((error) => {
  console.error("ERR:", error.message);
  process.exit(1);
});
