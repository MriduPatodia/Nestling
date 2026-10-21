import { ACTIONS } from '../../shared/catalog.js';
import { bad, notFound, str, int } from '../http.js';
import { award } from '../economy.js';

const now = () => Date.now();
const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

export function getSet(db, userId, id) {
  const s = db.one('SELECT * FROM sets WHERE id = ? AND user_id = ?', int(id, 'Set'), userId);
  if (!s) throw notFound('That study set doesn\'t exist.');
  return s;
}
const cardOut = (c) => ({ id: c.id, q: c.q, a: c.a, src: c.src });
const quizOut = (q, hint) => ({ id: q.id, q: q.q, options: JSON.parse(q.options), answer: q.answer, explain: q.explain, src: q.src, hint: hint || null });

export function fullSet(db, userId, s) {
  const hints = Object.fromEntries(db.all('SELECT h.quiz_id, h.text FROM hints h JOIN quiz q ON q.id = h.quiz_id WHERE h.user_id = ? AND q.set_id = ?', userId, s.id).map((h) => [h.quiz_id, h.text]));
  return {
    id: s.id, title: s.title, source: s.source, notesOwn: s.notes_own, ownCredited: s.own_credited, notesAi: s.notes_ai,
    example: s.title.endsWith('(example)'),
    cards: db.all('SELECT * FROM cards WHERE set_id = ? ORDER BY id', s.id).map(cardOut),
    quiz: db.all('SELECT * FROM quiz WHERE set_id = ? ORDER BY id', s.id).map((q) => quizOut(q, hints[q.id])),
    chat: db.all('SELECT role, content FROM chat WHERE set_id = ? ORDER BY id', s.id),
    materials: db.all('SELECT id, name, kind, method, pages, chars, use FROM materials WHERE set_id = ? ORDER BY id', s.id).map((m) => ({ ...m, use: !!m.use })),
  };
}

/** Merge several award() results into one response. */
export function merge(...results) {
  const out = { rewards: [], notices: [], profile: null };
  for (const r of results.filter(Boolean)) { out.rewards.push(...r.rewards); out.notices.push(...r.notices); out.profile = r.profile; }
  return out;
}

function validQuiz(body) {
  const q = str(body.q, 300, 'Question');
  if (!q) throw bad('Write a question.');
  if (!Array.isArray(body.options)) throw bad('Add some options.');
  const options = body.options.map((o, i) => str(String(o ?? ''), 200, `Option ${i + 1}`)).filter(Boolean);
  if (options.length < 2 || options.length > 6) throw bad('Give between 2 and 6 options.');
  const answer = int(body.answer, 'Correct option');
  if (answer < 0 || answer >= options.length) throw bad('Mark which option is correct.');
  return { q, options, answer, explain: str(String(body.explain ?? ''), 300, 'Explanation') };
}

export function createExampleSet(db, userId) {
  const t = now();
  const { lastInsertRowid } = db.run(`INSERT INTO sets (user_id, title, source, notes_own, own_credited, notes_ai, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    userId, 'Photosynthesis (example)', '',
    'Plants make glucose from CO2 and water using light.\nHappens in the chloroplast; chlorophyll absorbs mostly red and blue light.\nOxygen is released as a by-product.',
    24,
    '## The big idea\n- **Photosynthesis** turns light energy into chemical energy stored in glucose.\n- Word equation: carbon dioxide + water → glucose + oxygen.\n## Where it happens\n- In **chloroplasts**, mostly in leaf palisade cells.\n## Limiting factors\n- Light intensity, CO2 concentration and temperature.\n## Check yourself\n- Why are leaves thin and flat?\n- What gas is a by-product?\n- Name one limiting factor.',
    t, t);
  const sid = Number(lastInsertRowid);
  const cards = [
    ['Where in the cell does photosynthesis happen?', 'In the chloroplasts', 'own'],
    ['Word equation for photosynthesis', 'Carbon dioxide + water → glucose + oxygen', 'ai'],
    ['What pigment absorbs light?', 'Chlorophyll', 'ai'],
    ['Name three limiting factors', 'Light intensity, CO2 concentration, temperature', 'own'],
  ];
  for (const [q, a, src] of cards) db.run('INSERT INTO cards (set_id, user_id, q, a, src, created_at) VALUES (?,?,?,?,?,?)', sid, userId, q, a, src, t);
  const quiz = [
    ['Which gas is released during photosynthesis?', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], 1, 'Oxygen is released when water is split.', 'ai'],
    ['Which colour of light does chlorophyll absorb least?', ['Red', 'Blue', 'Green', 'Violet'], 2, 'Green light is mostly reflected, which is why leaves look green.', 'own'],
    ['What do plants store the captured energy in?', ['Glucose', 'Protein', 'Oxygen', 'Water'], 0, 'Glucose stores chemical energy and can be turned into starch.', 'ai'],
  ];
  for (const [q, o, a, e, src] of quiz) db.run('INSERT INTO quiz (set_id, user_id, q, options, answer, explain, src, created_at) VALUES (?,?,?,?,?,?,?,?)', sid, userId, q, JSON.stringify(o), a, e, src, t);
}

export function register(r) {
  r.add('GET', '/api/sets', ({ db, user }) => ({
    sets: db.all(`SELECT s.id, s.title, s.updated_at,
                    (SELECT COUNT(*) FROM cards c WHERE c.set_id = s.id) AS cards,
                    (SELECT COUNT(*) FROM quiz q WHERE q.set_id = s.id) AS quiz,
                    length(s.notes_own) AS own_len
                  FROM sets s WHERE s.user_id = ? ORDER BY s.updated_at DESC`, user.id),
  }));

  r.add('POST', '/api/sets', ({ db, user, body }) => {
    const title = str(body.title, 80, 'Topic');
    if (!title) throw bad('Give the set a topic.');
    const source = str(String(body.source ?? ''), 20000, 'Source text');
    if (db.one('SELECT COUNT(*) AS n FROM sets WHERE user_id = ?', user.id).n >= 200) throw bad('You have 200 sets already. Delete some first.');
    const { lastInsertRowid } = db.run('INSERT INTO sets (user_id, title, source, created_at, updated_at) VALUES (?,?,?,?,?)', user.id, title, source, now(), now());
    return { set: fullSet(db, user.id, getSet(db, user.id, Number(lastInsertRowid))) };
  });

  r.add('GET', '/api/sets/:id', ({ db, user, params }) => ({ set: fullSet(db, user.id, getSet(db, user.id, params.id)) }));

  r.add('PATCH', '/api/sets/:id', ({ db, user, params, body }) => {
    const s = getSet(db, user.id, params.id);
    const title = body.title !== undefined ? str(body.title, 80, 'Topic') || s.title : s.title;
    const source = body.source !== undefined ? str(String(body.source), 20000, 'Source text') : s.source;
    db.run('UPDATE sets SET title = ?, source = ?, updated_at = ? WHERE id = ?', title, source, now(), s.id);
    return { set: fullSet(db, user.id, getSet(db, user.id, s.id)) };
  });

  r.add('DELETE', '/api/sets/:id', ({ db, user, params }) => {
    const s = getSet(db, user.id, params.id);
    db.run('DELETE FROM sets WHERE id = ?', s.id);
    return { ok: true };
  });

  // Own notes: 1 coin per 8 new words, max 40 per save. "New" is measured against words already paid for.
  r.add('PUT', '/api/sets/:id/notes', ({ db, user, params, body }) => {
    const s = getSet(db, user.id, params.id);
    const notes = str(String(body.notes ?? ''), 30000, 'Notes');
    const fresh = words(notes) - s.own_credited;
    let result = null, credited = s.own_credited;
    if (fresh >= 8) {
      const chunks = Math.min(40, Math.floor(fresh / 8));
      credited += chunks * 8;
      result = award(db, user.id, 'notes_own', { base: chunks * ACTIONS.notes_own.base, ref: 'set:' + s.id });
    }
    db.run('UPDATE sets SET notes_own = ?, own_credited = ?, updated_at = ? WHERE id = ?', notes, credited, now(), s.id);
    return { ...merge(result), ownCredited: credited };
  });

  /* flashcards */
  r.add('POST', '/api/sets/:id/cards', ({ db, user, params, body }) => {
    const s = getSet(db, user.id, params.id);
    const q = str(body.q, 300, 'Front'), a = str(body.a, 500, 'Back');
    if (!q || !a) throw bad('Fill in both sides of the card.');
    const { lastInsertRowid } = db.run('INSERT INTO cards (set_id, user_id, q, a, src, created_at) VALUES (?,?,?,?,?,?)', s.id, user.id, q, a, 'own', now());
    db.run('UPDATE sets SET updated_at = ? WHERE id = ?', now(), s.id);
    return { card: { id: Number(lastInsertRowid), q, a, src: 'own' }, ...merge(award(db, user.id, 'card_own', { ref: 'card:' + lastInsertRowid })) };
  });

  r.add('DELETE', '/api/cards/:id', ({ db, user, params }) => {
    const { changes } = db.run('DELETE FROM cards WHERE id = ? AND user_id = ?', int(params.id, 'Card'), user.id);
    if (!changes) throw notFound();
    return { ok: true };
  });

  // Self-graded review. Recall pays more, but each card pays recall at most once per 5 minutes.
  r.add('POST', '/api/cards/:id/review', ({ db, user, params, body }) => {
    const c = db.one('SELECT id FROM cards WHERE id = ? AND user_id = ?', int(params.id, 'Card'), user.id);
    if (!c) throw notFound();
    const recalled = body.typed === true && body.knew === true;
    let action = recalled ? 'card_recall' : 'card_flip';
    if (recalled && db.one(`SELECT 1 FROM events WHERE user_id = ? AND action = 'card_recall' AND ref = ? AND created_at > ?`, user.id, 'card:' + c.id, now() - 5 * 60e3)) action = 'card_flip';
    return merge(award(db, user.id, action, { ref: 'card:' + c.id }));
  });

  /* quiz */
  r.add('POST', '/api/sets/:id/quiz', ({ db, user, params, body }) => {
    const s = getSet(db, user.id, params.id);
    const q = validQuiz(body);
    const { lastInsertRowid } = db.run('INSERT INTO quiz (set_id, user_id, q, options, answer, explain, src, created_at) VALUES (?,?,?,?,?,?,?,?)',
      s.id, user.id, q.q, JSON.stringify(q.options), q.answer, q.explain, 'own', now());
    db.run('UPDATE sets SET updated_at = ? WHERE id = ?', now(), s.id);
    const row = db.one('SELECT * FROM quiz WHERE id = ?', lastInsertRowid);
    return { question: quizOut(row), ...merge(award(db, user.id, 'quiz_own', { ref: 'quiz:' + row.id })) };
  });

  r.add('DELETE', '/api/quiz/:id', ({ db, user, params }) => {
    const { changes } = db.run('DELETE FROM quiz WHERE id = ? AND user_id = ?', int(params.id, 'Question'), user.id);
    if (!changes) throw notFound();
    return { ok: true };
  });

  // The server checks the answer, and knows whether a hint was used.
  r.add('POST', '/api/quiz/:id/answer', ({ db, user, params, body }) => {
    const q = db.one('SELECT * FROM quiz WHERE id = ? AND user_id = ?', int(params.id, 'Question'), user.id);
    if (!q) throw notFound();
    const choice = int(body.choice, 'Choice');
    const correct = choice === q.answer;
    const hinted = !!db.one('SELECT 1 FROM hints WHERE user_id = ? AND quiz_id = ? AND created_at > ?', user.id, q.id, now() - 6 * 3600e3);
    const action = !correct ? 'quiz_wrong' : hinted ? 'quiz_correct_hint' : 'quiz_correct';
    // Paying for the same question repeatedly in a short time is farming: count it, but pay nothing.
    const recent = correct && db.one('SELECT 1 FROM events WHERE user_id = ? AND ref = ? AND coins > 0 AND created_at > ?', user.id, 'quiz:' + q.id, now() - 10 * 60e3);
    const res = award(db, user.id, recent ? 'quiz_wrong' : action, { ref: 'quiz:' + q.id });
    return { correct, answer: q.answer, explain: q.explain, hinted, ...merge(res) };
  });

  r.add('DELETE', '/api/sets/:id/chat', ({ db, user, params }) => {
    const s = getSet(db, user.id, params.id);
    db.run('DELETE FROM chat WHERE set_id = ?', s.id);
    return { ok: true };
  });

}
