/**
 * Move any image still hosted on the local disk (`/uploads/...`, typically with
 * a localhost base URL) up to Cloudinary, and repoint the database at the new
 * secure URL.
 *
 * Why: the API filesystem is ephemeral on Render, so `public/uploads` is wiped
 * on every deploy — and a stored `http://localhost:5000/uploads/...` URL is
 * broken for every visitor who is not the developer. The local-disk upload
 * fallback has been removed; this cleans up what it already produced.
 *
 * Also clears ashram image references that point at files which do not exist,
 * so the UI falls back to its placeholder instead of firing a 404 per image.
 *
 * Run from the backend/ directory:
 *   node src/scripts/migrate_local_images_to_cloudinary.js          (dry run)
 *   node src/scripts/migrate_local_images_to_cloudinary.js --apply
 */
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import config from '../config/env.js';
import { uploadBuffer, isCloudinaryConfigured } from '../config/cloudinary.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const APPLY = process.argv.includes('--apply');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const FRONTEND_PUBLIC = path.resolve(process.cwd(), '..', 'frontend', 'public');

// Pull the on-disk filename out of any /uploads/<file> URL.
const localFilename = (value) => {
  const match = typeof value === 'string' && value.match(/\/uploads\/([^/?#"']+)/);
  return match ? match[1] : null;
};

const pushToCloudinary = async (filename) => {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return { error: `file missing on disk: ${filename}` };
  const result = await uploadBuffer(fs.readFileSync(filePath), { folder: 'ashray-bharat/migrated' });
  return { url: result.secure_url };
};

const run = async () => {
  if (!isCloudinaryConfigured()) {
    console.error('Cloudinary is not configured — cannot migrate. Set CLOUDINARY_* in .env.');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  console.log(`Connected to ${mongoose.connection.name}${APPLY ? '' : '  [DRY RUN — no writes]'}\n`);
  const db = mongoose.connection.db;

  // ── 1. Any document anywhere still pointing at /uploads/ ──────────────────
  console.log('1. Locally-hosted images still referenced in the database');
  const collections = await db.listCollections().toArray();
  let migrated = 0;

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).limit(5000).toArray();
    for (const doc of docs) {
      const raw = JSON.stringify(doc);
      if (!raw.includes('/uploads/')) continue;

      const filename = localFilename(raw);
      if (!filename) continue;

      console.log(`   ${name} ${doc._id} → ${filename}`);
      if (!APPLY) {
        migrated++;
        continue;
      }

      const { url, error } = await pushToCloudinary(filename);
      if (error) {
        console.log(`     ! ${error} — leaving as is`);
        continue;
      }

      // Rewrite every occurrence of the old URL, wherever it sits in the doc.
      const oldUrlPattern = new RegExp(`https?://[^"']*?/uploads/${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      const patched = JSON.parse(raw.replace(oldUrlPattern, url));
      delete patched._id;
      await db.collection(name).updateOne({ _id: doc._id }, { $set: patched });
      console.log(`     ✔ now ${url}`);
      migrated++;
    }
  }
  if (migrated === 0) console.log('   (none)');

  // ── 2. Ashram images pointing at files that do not exist ──────────────────
  console.log('\n2. Broken ashram image references');
  const ashrams = await db.collection('ashrams').find({}).project({ name: 1, images: 1 }).toArray();
  let cleaned = 0;

  for (const ashram of ashrams) {
    const images = ashram.images || [];
    const kept = images.filter((url) => {
      if (!url.startsWith('/')) return true; // remote URL — leave alone
      return fs.existsSync(path.join(FRONTEND_PUBLIC, url));
    });

    if (kept.length === images.length) continue;

    const dropped = images.filter((u) => !kept.includes(u));
    console.log(`   ${ashram.name}: dropping ${dropped.length} broken → ${JSON.stringify(dropped)}`);
    if (APPLY) {
      await db.collection('ashrams').updateOne({ _id: ashram._id }, { $set: { images: kept } });
    }
    cleaned++;
  }
  if (cleaned === 0) console.log('   (none)');

  console.log(`\n${APPLY ? 'Applied.' : 'Dry run complete — re-run with --apply to write.'}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
