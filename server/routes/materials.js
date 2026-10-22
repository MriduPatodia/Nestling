// Uploaded study materials: files are turned into text on upload and only the text is stored.
import { HttpError, bad, notFound, int, str } from '../http.js';
import { rateLimit } from '../auth.js';
import { extractMaterial, kindOf, imageMime, MAX_UPLOAD_BYTES, MAX_TEXT_CHARS } from '../extract/index.js';
import { getSet } from './study.js';

const MAX_PER_SET = 20;
const out = (m) => ({ id: m.id, name: m.name, kind: m.kind, method: m.method, pages: m.pages, chars: m.chars, use: !!m.use });

/** Attach the materials a set should use for AI work. */
export function withMaterials(db, set) {
  set.materials = db.all('SELECT name, text FROM materials WHERE set_id = ? AND use = 1 ORDER BY id', set.id);
  return set;
}

export function register(r) {
  r.add('POST', '/api/sets/:id/materials', async ({ db, ai, cfg, user, params, body }) => {
    const set = getSet(db, user.id, params.id);
    const name = str(body.name, 200, 'File name').replace(/[\\/]/g, '_') || 'upload';
    if (typeof body.data !== 'string' || !body.data) throw bad('The file was empty.');
    const buf = Buffer.from(body.data, 'base64');
    if (!buf.length) throw bad('The file was empty.');
    if (buf.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'That file is too big. The limit is 15 MB.');
    if (db.one('SELECT COUNT(*) AS n FROM materials WHERE set_id = ?', set.id).n >= MAX_PER_SET)
      throw new HttpError(409, `A set can hold ${MAX_PER_SET} files. Remove one first, or start a new set.`);

    const res = extractMaterial(buf, name);
    let text = res.text, method = res.method;
    if (res.needsAi) {
      if (!ai.configured()) throw new HttpError(503, 'This looks like a photo or a scan. Reading those needs the AI tutor, which isn\'t set up yet: add OPENROUTER_API_KEY to .env.');
      if (!rateLimit('ai:' + user.id, cfg.aiHourlyLimit, 3600e3)) throw new HttpError(429, 'You\'ve used the AI a lot this hour. Try again later.');
      text = (await ai.transcribe({ kind: res.needsAi, name, mime: res.needsAi === 'image' ? imageMime(name) : 'application/pdf', base64: buf.toString('base64') })).slice(0, MAX_TEXT_CHARS);
      method = 'ai';
    }
    if (!text || !text.trim()) throw new HttpError(422, `There's no text in “${name}”.`);
    const { lastInsertRowid } = db.run('INSERT INTO materials (set_id, user_id, name, kind, method, pages, chars, text, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      set.id, user.id, name, kindOf(name), method, res.pages ?? null, text.length, text, Date.now());
    db.run('UPDATE sets SET updated_at = ? WHERE id = ?', Date.now(), set.id);
    return { material: out(db.one('SELECT * FROM materials WHERE id = ?', lastInsertRowid)) };
  }, { bodyLimit: Math.ceil(MAX_UPLOAD_BYTES * 1.37) + 4096 });

  r.add('GET', '/api/materials/:id', ({ db, user, params }) => {
    const m = db.one('SELECT * FROM materials WHERE id = ? AND user_id = ?', int(params.id, 'File'), user.id);
    if (!m) throw notFound('That file doesn\'t exist.');
    return { material: { ...out(m), text: m.text } };
  });

  r.add('PATCH', '/api/materials/:id', ({ db, user, params, body }) => {
    const m = db.one('SELECT * FROM materials WHERE id = ? AND user_id = ?', int(params.id, 'File'), user.id);
    if (!m) throw notFound('That file doesn\'t exist.');
    if (typeof body.use !== 'boolean') throw bad('Say whether to use this file.');
    db.run('UPDATE materials SET use = ? WHERE id = ?', body.use ? 1 : 0, m.id);
    return { material: out({ ...m, use: body.use }) };
  });

  r.add('DELETE', '/api/materials/:id', ({ db, user, params }) => {
    const { changes } = db.run('DELETE FROM materials WHERE id = ? AND user_id = ?', int(params.id, 'File'), user.id);
    if (!changes) throw notFound('That file doesn\'t exist.');
    return { ok: true };
  });
}
