// Daily check-ins and journal. Private to each person and never sent to the AI.
import { bad, notFound, int, str } from '../http.js';
import { award, loadProfile, localDay, addDays } from '../economy.js';
import { merge } from './study.js';
import { MOODS, STRESS, BODY, TOPICS } from '../../shared/wellbeing.js';

const checkinOut = (c) => c && ({ day: c.day, mood: c.mood, stress: c.stress, sleep: c.sleep, body: JSON.parse(c.body), topics: JSON.parse(c.topics) });
const pick = (arr, allowed, name) => {
  if (arr === undefined) return [];
  if (!Array.isArray(arr) || arr.some((x) => !allowed.includes(x))) throw bad(`Unknown ${name}.`);
  return [...new Set(arr)];
};
// A wellbeing page shouldn't nag about limits: once today's coins are paid, say nothing.
const quiet = (res) => { res.rewards = res.rewards.filter((x) => !x.capped); return res; };
const today = (db, userId) => localDay(loadProfile(db, userId).prefs.tz);

export function register(r) {
  r.add('GET', '/api/wellbeing', ({ db, user }) => {
    const day = today(db, user.id);
    return {
      today: checkinOut(db.one('SELECT * FROM checkins WHERE user_id = ? AND day = ?', user.id, day)),
      history: db.all('SELECT * FROM checkins WHERE user_id = ? AND day >= ? ORDER BY day', user.id, addDays(day, -13)).map(checkinOut),
      entries: db.all('SELECT id, day, prompt, text, created_at FROM journal WHERE user_id = ? ORDER BY id DESC LIMIT 60', user.id),
      day,
    };
  });

  r.add('PUT', '/api/checkin', ({ db, user, body }) => {
    const mood = int(body.mood, 'Mood'), stress = int(body.stress, 'Stress');
    if (mood < 1 || mood > MOODS.length) throw bad('Pick how you feel.');
    if (stress < 1 || stress > STRESS.length) throw bad('Pick your stress level.');
    let sleep = null;
    if (body.sleep !== null && body.sleep !== undefined && body.sleep !== '') {
      sleep = Number(body.sleep);
      if (!Number.isFinite(sleep) || sleep < 0 || sleep > 16) throw bad('Sleep should be between 0 and 16 hours.');
      sleep = Math.round(sleep * 2) / 2;
    }
    const b = pick(body.body, BODY, 'body feeling'), t = pick(body.topics, TOPICS, 'topic');
    const day = today(db, user.id), now = Date.now();
    const existed = db.one('SELECT 1 FROM checkins WHERE user_id = ? AND day = ?', user.id, day);
    db.run(`INSERT INTO checkins (user_id, day, mood, stress, sleep, body, topics, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id, day) DO UPDATE SET mood = excluded.mood, stress = excluded.stress, sleep = excluded.sleep,
            body = excluded.body, topics = excluded.topics, updated_at = excluded.updated_at`,
    user.id, day, mood, stress, sleep, JSON.stringify(b), JSON.stringify(t), now, now);
    const result = existed ? null : award(db, user.id, 'checkin', { ref: 'checkin:' + day });
    return { checkin: checkinOut(db.one('SELECT * FROM checkins WHERE user_id = ? AND day = ?', user.id, day)), ...merge(result) };
  });

  r.add('POST', '/api/journal', ({ db, user, body }) => {
    const text = str(body.text, 20000, 'Entry');
    if (!text) throw bad('Write something first.');
    const prompt = str(String(body.prompt ?? ''), 300, 'Prompt');
    const day = today(db, user.id);
    const { lastInsertRowid } = db.run('INSERT INTO journal (user_id, day, prompt, text, created_at) VALUES (?,?,?,?,?)', user.id, day, prompt, text, Date.now());
    const entry = db.one('SELECT id, day, prompt, text, created_at FROM journal WHERE id = ?', lastInsertRowid);
    return { entry, ...merge(quiet(award(db, user.id, 'journal', { ref: 'journal:' + entry.id }))) };
  });

  r.add('DELETE', '/api/journal/:id', ({ db, user, params }) => {
    const { changes } = db.run('DELETE FROM journal WHERE id = ? AND user_id = ?', int(params.id, 'Entry'), user.id);
    if (!changes) throw notFound('That entry doesn\'t exist.');
    return { ok: true };
  });
}
