import { HttpError, int } from '../http.js';
import { award } from '../economy.js';
import { merge } from './study.js';

// Focus sessions are timed on the server, so minutes can't be invented by the browser.
const elapsedMs = (f, now) => Math.max(0, (f.paused_at ?? now) - f.started_at - f.paused_ms);
const active = (db, userId) => db.one(`SELECT * FROM focus WHERE user_id = ? AND status IN ('running','paused') ORDER BY id DESC LIMIT 1`, userId);
const out = (f, now = Date.now()) => f && ({
  id: f.id, setId: f.set_id, plannedMin: f.planned_min, status: f.status,
  elapsedMs: elapsedMs(f, now), credited: f.credited, serverNow: now,
});

/** Pay for any whole minutes not yet credited; finish the session if it's over. */
function settle(db, userId, f, finalStatus) {
  const now = Date.now();
  const results = [];
  const mins = Math.min(f.planned_min, Math.floor(elapsedMs(f, now) / 60000));
  for (let m = f.credited; m < mins; m++) results.push(award(db, userId, 'focus_minute', { ref: 'focus:' + f.id }));
  let status = f.status;
  if (mins >= f.planned_min) { status = 'done'; results.push(award(db, userId, 'focus_complete', { ref: 'focus:' + f.id })); }
  else if (finalStatus) status = finalStatus;
  db.run('UPDATE focus SET credited = ?, status = ? WHERE id = ?', mins, status, f.id);
  return { session: out({ ...f, credited: mins, status }, now), ...merge(...results) };
}

export function register(r) {
  r.add('GET', '/api/focus', ({ db, user }) => ({ session: out(active(db, user.id)) || null, serverNow: Date.now() }));

  r.add('POST', '/api/focus/start', ({ db, user, body }) => {
    const minutes = int(body.minutes, 'Minutes');
    if (minutes < 1 || minutes > 180) throw new HttpError(400, 'Focus sessions are 1 to 180 minutes.');
    const setId = body.setId ? int(body.setId, 'Set') : null;
    if (setId && !db.one('SELECT 1 FROM sets WHERE id = ? AND user_id = ?', setId, user.id)) throw new HttpError(404, 'That set doesn\'t exist.');
    const prev = active(db, user.id);
    const prevResult = prev ? settle(db, user.id, prev, 'stopped') : null;
    const { lastInsertRowid } = db.run('INSERT INTO focus (user_id, set_id, planned_min, started_at) VALUES (?,?,?,?)', user.id, setId, minutes, Date.now());
    const f = db.one('SELECT * FROM focus WHERE id = ?', lastInsertRowid);
    return { ...merge(prevResult), session: out(f) };
  });

  r.add('POST', '/api/focus/tick', ({ db, user }) => {
    const f = active(db, user.id);
    if (!f) return { session: null, rewards: [], notices: [], profile: null };
    return settle(db, user.id, f);
  });

  r.add('POST', '/api/focus/pause', ({ db, user }) => {
    const f = active(db, user.id);
    if (!f || f.status !== 'running') throw new HttpError(409, 'No running session to pause.');
    const res = settle(db, user.id, f);
    if (res.session.status === 'done') return res;
    db.run(`UPDATE focus SET status = 'paused', paused_at = ? WHERE id = ?`, Date.now(), f.id);
    return { ...res, session: out(db.one('SELECT * FROM focus WHERE id = ?', f.id)) };
  });

  r.add('POST', '/api/focus/resume', ({ db, user }) => {
    const f = active(db, user.id);
    if (!f || f.status !== 'paused') throw new HttpError(409, 'No paused session to resume.');
    db.run(`UPDATE focus SET status = 'running', paused_ms = paused_ms + ?, paused_at = NULL WHERE id = ?`, Date.now() - f.paused_at, f.id);
    return { session: out(db.one('SELECT * FROM focus WHERE id = ?', f.id)) };
  });

  r.add('POST', '/api/focus/stop', ({ db, user }) => {
    const f = active(db, user.id);
    if (!f) return { session: null, rewards: [], notices: [], profile: null };
    return settle(db, user.id, f, 'stopped');
  });
}
