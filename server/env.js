// Minimal .env loader (no dependencies). Real environment variables win over the file.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(file = resolve(process.cwd(), '.env')) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export function config() {
  const e = process.env;
  return {
    port: Number(e.PORT || 3000),
    dbPath: e.DATABASE_PATH || resolve(process.cwd(), 'data/studystead.db'),
    cookieSecure: e.COOKIE_SECURE === 'true',
    appUrl: e.APP_URL || 'http://localhost:' + (e.PORT || 3000),
    openrouter: {
      key: e.OPENROUTER_API_KEY || '',
      model: e.OPENROUTER_MODEL || 'openrouter/auto',
      fastModel: e.OPENROUTER_MODEL_FAST || e.OPENROUTER_MODEL || 'openrouter/auto',
      visionModel: e.OPENROUTER_MODEL_VISION || e.OPENROUTER_MODEL || 'openrouter/auto',
      baseUrl: (e.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    },
    aiHourlyLimit: Number(e.AI_HOURLY_LIMIT || 60),
  };
}
