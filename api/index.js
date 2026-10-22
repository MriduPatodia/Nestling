// Vercel entry point: runs the whole app (pages + API) as one serverless function.
// Vercel has no permanent disk, so the database lives in /tmp and can be wiped at any time.
// Fine for a demo; for real use, host somewhere with a persistent disk (see README).
import { loadEnv, config } from '../server/env.js';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

loadEnv();
const cfg = config();
cfg.dbPath = process.env.DATABASE_PATH || '/tmp/nestling.db';
const handle = createApp({ db: openDb(cfg.dbPath), cfg });

export default function handler(req, res) {
  return handle(req, res);
}
