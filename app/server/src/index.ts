import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { outboxMailer, type Ctx } from './context.js';
import { seedContent } from './content/seed.js';
import { runDailyJobs } from './jobs.js';
import { cloudinaryImageStore, localImageStore, parseCloudinaryUrl, type ImageStore } from './images.js';

const here = dirname(fileURLToPath(import.meta.url));
const prod = process.env.NODE_ENV === 'production';
const dataDir = resolve(join(here, '../data'));
const dbPath = resolve(process.env.DB_PATH ?? join(dataDir, 'readbuddy.db'));
mkdirSync(dirname(dbPath), { recursive: true });

const db = openDb(dbPath);
const seeded = seedContent(db);
console.log(`Content library: ${seeded.upserted} seed exercises up to date, ${seeded.retired} retired.`);

// FR-CNT-05 / A-6 — E4 pictures go to Cloudinary when CLOUDINARY_URL is set, otherwise to a local folder.
const mediaDir = resolve(process.env.MEDIA_DIR ?? join(dataDir, 'media'));
let images: ImageStore;
const cloudinary = process.env.CLOUDINARY_URL ? parseCloudinaryUrl(process.env.CLOUDINARY_URL, process.env.CLOUDINARY_FOLDER) : null;
if (process.env.CLOUDINARY_URL && !cloudinary) throw new Error('CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>');
if (cloudinary) {
  images = cloudinaryImageStore(cloudinary);
  console.log(`E4 pictures: Cloudinary cloud "${cloudinary.cloudName}", folder "${cloudinary.folder}".`);
} else {
  images = localImageStore(mediaDir);
  console.log(`E4 pictures: local folder ${mediaDir} (set CLOUDINARY_URL to use Cloudinary).`);
}

const port = Number(process.env.PORT ?? 3000);
const ctx: Ctx = {
  db,
  mailer: outboxMailer(db),
  images,
  baseUrl: process.env.BASE_URL ?? (prod ? `http://localhost:${port}` : 'http://localhost:5173'),
  now: () => Date.now(),
};

const app = createApp(ctx, {
  staticDir: process.env.STATIC_DIR ?? join(here, '../../client/dist'),
  mediaDir: cloudinary ? undefined : mediaDir,
  devTools: !prod,
});

runDailyJobs(ctx);
setInterval(() => runDailyJobs(ctx), 24 * 3600 * 1000).unref();

app.listen(port, () => console.log(`ReadBuddy server on http://localhost:${port} (db: ${dbPath})`));
