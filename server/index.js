import { APP_NAME } from '../shared/brand.js';
import { createServer } from 'node:http';
import { loadEnv, config } from './env.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

loadEnv();
const cfg = config();
const db = openDb(cfg.dbPath);
const server = createServer(createApp({ db, cfg }));
server.listen(cfg.port, () => {
  console.log(`${APP_NAME} running at http://localhost:${cfg.port}`);
  if (!cfg.openrouter.key) console.log('Note: OPENROUTER_API_KEY is not set, so AI features are switched off. Add it to .env.');
  else console.log(`AI model: ${cfg.openrouter.model}`);
});
const shutdown = () => { server.close(); db.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
