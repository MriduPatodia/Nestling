import { HttpError, str, int, notFound } from '../http.js';
import { rateLimit } from '../auth.js';
import { award, loadProfile } from '../economy.js';
import { prompts } from '../ai.js';
import { getSet, merge } from './study.js';
import { withMaterials } from './materials.js';

function guard(ai, cfg, user) {
  if (!ai.configured()) throw new HttpError(503, 'The AI tutor is not set up yet. Add OPENROUTER_API_KEY to the .env file and restart the server.');
  if (!rateLimit('ai:' + user.id, cfg.aiHourlyLimit, 3600e3)) throw new HttpError(429, 'You\'ve asked the AI a lot this hour. Take a break, or try it yourself first.');
}

/** NDJSON stream: {t:'delta',text} lines, then {t:'done',...} or {t:'error',message}. */
function ndjson(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ctrl.abort(); });
  return {
    signal: ctrl.signal,
    send: (o) => { if (!res.writableEnded) res.write(JSON.stringify(o) + '\n'); },
    end: (o) => { if (!res.writableEnded) res.end(JSON.stringify(o) + '\n'); },
  };
}

const cleanCards = (arr) => (Array.isArray(arr) ? arr : [])
  .filter((c) => c && typeof c.q === 'string' && typeof c.a === 'string' && c.q.trim() && c.a.trim())
  .slice(0, 8).map((c) => ({ q: c.q.trim().slice(0, 300), a: c.a.trim().slice(0, 500) }));
const cleanQuiz = (arr) => (Array.isArray(arr) ? arr : [])
  .filter((q) => q && typeof q.q === 'string' && Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6 &&
    Number.isInteger(Number(q.answer)) && Number(q.answer) >= 0 && Number(q.answer) < q.options.length)
  .slice(0, 5).map((q) => ({ q: q.q.trim().slice(0, 300), options: q.options.map((o) => String(o).slice(0, 200)), answer: Number(q.answer), explain: String(q.explain || '').slice(0, 300) }));

export function register(r) {
  r.add('POST', '/api/sets/:id/ai/notes', async ({ db, ai, cfg, user, params, req, res }) => {
    const s = withMaterials(db, getSet(db, user.id, params.id));
    guard(ai, cfg, user);
    const prefs = loadProfile(db, user.id).prefs;
    const out = ndjson(req, res);
    try {
      const text = await ai.stream(prompts.notes(s, prefs), (d) => out.send({ t: 'delta', text: d }), { signal: out.signal, maxTokens: s.materials.length ? 2000 : 1100 });
      if (!text.trim()) throw new HttpError(502, 'The AI sent back empty notes. Try again.');
      db.run('UPDATE sets SET notes_ai = ?, updated_at = ? WHERE id = ?', text, Date.now(), s.id);
      out.end({ t: 'done', text, ...merge(award(db, user.id, 'notes_ai', { ref: 'set:' + s.id })) });
    } catch (e) {
      if (e.name !== 'AbortError') out.end({ t: 'error', message: e instanceof HttpError ? e.message : 'The tutor stopped unexpectedly. Try again.' });
    }
  });

  r.add('POST', '/api/sets/:id/ai/cards', async ({ db, ai, cfg, user, params }) => {
    const s = withMaterials(db, getSet(db, user.id, params.id));
    guard(ai, cfg, user);
    const prefs = loadProfile(db, user.id).prefs;
    const existing = db.all('SELECT q FROM cards WHERE set_id = ?', s.id).map((c) => c.q);
    const cards = cleanCards(await ai.json(prompts.cards(s, prefs, existing)));
    if (!cards.length) throw new HttpError(502, 'The tutor sent back no usable cards. Try again.');
    const t = Date.now();
    const saved = db.tx(() => cards.map((c) => {
      const { lastInsertRowid } = db.run('INSERT INTO cards (set_id, user_id, q, a, src, created_at) VALUES (?,?,?,?,?,?)', s.id, user.id, c.q, c.a, 'ai', t);
      return { id: Number(lastInsertRowid), ...c, src: 'ai' };
    }));
    db.run('UPDATE sets SET updated_at = ? WHERE id = ?', t, s.id);
    return { cards: saved, ...merge(award(db, user.id, 'cards_ai', { ref: 'set:' + s.id })) };
  });

  r.add('POST', '/api/sets/:id/ai/quiz', async ({ db, ai, cfg, user, params }) => {
    const s = withMaterials(db, getSet(db, user.id, params.id));
    guard(ai, cfg, user);
    const prefs = loadProfile(db, user.id).prefs;
    const existing = db.all('SELECT q FROM quiz WHERE set_id = ?', s.id).map((q) => q.q);
    const qs = cleanQuiz(await ai.json(prompts.quiz(s, prefs, existing)));
    if (!qs.length) throw new HttpError(502, 'The tutor sent back no usable questions. Try again.');
    const t = Date.now();
    const saved = db.tx(() => qs.map((q) => {
      const { lastInsertRowid } = db.run('INSERT INTO quiz (set_id, user_id, q, options, answer, explain, src, created_at) VALUES (?,?,?,?,?,?,?,?)',
        s.id, user.id, q.q, JSON.stringify(q.options), q.answer, q.explain, 'ai', t);
      return { id: Number(lastInsertRowid), ...q, src: 'ai', hint: null };
    }));
    db.run('UPDATE sets SET updated_at = ? WHERE id = ?', t, s.id);
    return { questions: saved, ...merge(award(db, user.id, 'quiz_ai', { ref: 'set:' + s.id })) };
  });

  r.add('POST', '/api/quiz/:id/hint', async ({ db, ai, cfg, user, params }) => {
    const q = db.one('SELECT * FROM quiz WHERE id = ? AND user_id = ?', int(params.id, 'Question'), user.id);
    if (!q) throw notFound();
    const prev = db.one('SELECT text FROM hints WHERE user_id = ? AND quiz_id = ?', user.id, q.id);
    guard(ai, cfg, user);
    const text = prev?.text || (await ai.complete(prompts.hint(q, loadProfile(db, user.id).prefs), { fast: true, maxTokens: 120 })).trim().slice(0, 400);
    db.run('INSERT INTO hints (user_id, quiz_id, text, created_at) VALUES (?,?,?,?) ON CONFLICT(user_id, quiz_id) DO UPDATE SET created_at = excluded.created_at',
      user.id, q.id, text, Date.now());
    return { hint: text, ...merge(award(db, user.id, 'hint', { ref: 'quiz:' + q.id })) };
  });

  r.add('POST', '/api/sets/:id/chat', async ({ db, ai, cfg, user, params, body, req, res }) => {
    const s = withMaterials(db, getSet(db, user.id, params.id));
    const message = str(body.message, 2000, 'Message');
    if (!message) throw new HttpError(400, 'Type a question first.');
    guard(ai, cfg, user);
    db.run('INSERT INTO chat (set_id, user_id, role, content, created_at) VALUES (?,?,?,?,?)', s.id, user.id, 'user', message, Date.now());
    const history = db.all('SELECT role, content FROM chat WHERE set_id = ? ORDER BY id DESC LIMIT 20', s.id).reverse();
    const prefs = loadProfile(db, user.id).prefs;
    const out = ndjson(req, res);
    try {
      const text = await ai.stream(prompts.tutor(s, prefs, history), (d) => out.send({ t: 'delta', text: d }), { signal: out.signal, maxTokens: 500 });
      db.run('INSERT INTO chat (set_id, user_id, role, content, created_at) VALUES (?,?,?,?,?)', s.id, user.id, 'assistant', text, Date.now());
      out.end({ t: 'done', text, ...merge(award(db, user.id, 'tutor', { ref: 'set:' + s.id })) });
    } catch (e) {
      if (e.name !== 'AbortError') out.end({ t: 'error', message: e instanceof HttpError ? e.message : 'The tutor stopped unexpectedly. Try again.' });
    }
  });
}
