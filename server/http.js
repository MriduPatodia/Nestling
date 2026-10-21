// Tiny router + JSON helpers on top of node:http.
export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export async function readJson(req, limit = 512 * 1024) {
  limit = limit || 512 * 1024;
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const type = req.headers['content-type'] || '';
  const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
  // Rejecting non-JSON bodies blocks cross-site form posts (a CSRF defence alongside SameSite cookies).
  // Forms always send a content type, so only a body-less request may omit it.
  if (type ? !type.startsWith('application/json') : hasBody) throw new HttpError(415, 'Send JSON.');
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, limit > 1e6 ? 'That file is too big. The limit is 15 MB.' : 'That is too much text to send at once.');
    chunks.push(c);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw bad('That request was not valid JSON.'); }
}

export function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler, opts = {}) {
      const keys = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      routes.push({ method, re, keys, handler, opts });
    },
    match(method, path) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      }
      return null;
    },
  };
}

// Small input helpers
export const str = (v, max, name) => {
  if (typeof v !== 'string') throw bad(`${name} is missing.`);
  const s = v.trim();
  if (s.length > max) throw bad(`${name} is too long (max ${max} characters).`);
  return s;
};
export const int = (v, name) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw bad(`${name} must be a whole number.`);
  return n;
};
