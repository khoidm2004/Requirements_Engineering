import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { openDb } from './db.js';
import { createApp } from './app.js';
import type { Ctx } from './context.js';
import { diskStorage } from './storage.js';
import { seedContent } from './content/seed.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR ?? join(here, '../data'));
mkdirSync(dataDir, { recursive: true });

const db = openDb(process.env.DB_PATH ?? join(dataDir, 'readbuddy.db'));
const seeded = seedContent(db);
if (seeded) console.log(`Added ${seeded} shared exercises.`);

const ctx: Ctx = { db, storage: diskStorage(join(dataDir, 'files')), now: () => Date.now() };
const app = createApp(ctx, { staticDir: process.env.STATIC_DIR ?? join(here, '../../client/dist') });

// Clean up expired sessions once an hour.
setInterval(() => db.prepare('DELETE FROM sessions WHERE last_seen < ?').run(Date.now() - 8 * 3600 * 1000), 3600 * 1000).unref();

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`ReadBuddy (version B) on http://localhost:${port} (data: ${dataDir})`));
