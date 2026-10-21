// Builds the HTTP request handler. Kept separate from index.js so tests can start it on any port.
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter, sendJson, readJson, HttpError } from './http.js';
import { userFromRequest } from './auth.js';
import { makeAi } from './ai.js';
import * as authRoutes from './routes/auth.js';
import * as profileRoutes from './routes/profile.js';
import * as studyRoutes from './routes/study.js';
import * as aiRoutes from './routes/ai.js';
import * as focusRoutes from './routes/focus.js';
import * as homeRoutes from './routes/home.js';
import * as materialRoutes from './routes/materials.js';
import * as wellbeingRoutes from './routes/wellbeing.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const STATIC = { '/shared/': join(ROOT, 'shared'), '/': join(ROOT, 'public') };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export function createApp({ db, cfg, ai = makeAi(cfg) }) {
  const router = createRouter();
  for (const m of [authRoutes, profileRoutes, studyRoutes, aiRoutes, focusRoutes, homeRoutes, materialRoutes, wellbeingRoutes]) m.register(router);

  function serveStatic(req, res, pathname) {
    for (const [prefix, dir] of Object.entries(STATIC)) {
      if (!pathname.startsWith(prefix)) continue;
      let rel = pathname.slice(prefix.length) || 'index.html';
      const file = normalize(join(dir, rel));
      if (!file.startsWith(dir)) break; // path traversal
      let st;
      try { st = statSync(file); } catch { st = null; }
      if (!st || !st.isFile()) {
        // SPA fallback for app routes without an extension
        if (prefix === '/' && !extname(rel)) return serveStatic(req, res, '/index.html');
        break;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(file).pipe(res);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS }); res.end('Not found');
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const path = url.pathname;
    if (!path.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, path);
    }
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      const m = router.match(req.method, path);
      if (!m) throw new HttpError(404, 'No such API route.');
      const user = userFromRequest(db, req);
      if (!m.route.opts.public && !user) throw new HttpError(401, 'Please log in.');
      const body = await readJson(req, m.route.opts.bodyLimit);
      const data = await m.route.handler({ db, cfg, ai, req, res, user, body, params: m.params, query: url.searchParams });
      if (!res.headersSent) sendJson(res, 200, data ?? { ok: true });
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      if (res.headersSent) { try { res.end(); } catch { /* ignore */ } return; }
      sendJson(res, e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' });
    }
  };
}
