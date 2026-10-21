import { HttpError } from '../http.js';
import { hashPassword, verifyPassword, validateCredentials, createSession, destroySession, sessionCookie, rateLimit } from '../auth.js';
import { createProfile, loadProfile, rollover, saveProfile, publicProfile } from '../economy.js';
import { createStarterHome } from './home.js';
import { cleanLook } from '../../shared/avatar.js';

export function cleanNickname(v) {
  const n = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!n) throw new HttpError(400, 'Pick a nickname.');
  if (n.length > 20) throw new HttpError(400, 'Nicknames can be up to 20 characters.');
  return n;
}
import { createExampleSet } from './study.js';

const ip = (req) => req.socket.remoteAddress || 'unknown';

export function register(r) {
  r.add('POST', '/api/auth/signup', ({ db, cfg, body, req, res }) => {
    if (!rateLimit('signup:' + ip(req), 10, 3600e3)) throw new HttpError(429, 'Too many new accounts from here. Try again later.');
    const { username, password, tz } = body;
    validateCredentials(username, password);
    const nickname = cleanNickname(body.nickname ?? username);
    let avatar = null;
    if (body.avatar !== undefined) { try { avatar = cleanLook(body.avatar); } catch (e) { throw new HttpError(400, e.message); } }
    if (db.one('SELECT 1 FROM users WHERE username = ?', username)) throw new HttpError(409, 'That username is taken. Try another.');
    const userId = db.tx(() => {
      const { lastInsertRowid } = db.run('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)', username, hashPassword(password), Date.now());
      const id = Number(lastInsertRowid);
      createProfile(db, id, typeof tz === 'string' ? tz.slice(0, 64) : 'UTC', nickname, avatar);
      createStarterHome(db, id);
      createExampleSet(db, id);
      return id;
    });
    res.setHeader('Set-Cookie', sessionCookie(createSession(db, userId), cfg.cookieSecure));
    return { ok: true };
  }, { public: true });

  r.add('POST', '/api/auth/login', ({ db, cfg, body, req, res }) => {
    const { username, password } = body;
    if (!rateLimit('login:' + ip(req) + ':' + String(username).toLowerCase(), 10, 15 * 60e3))
      throw new HttpError(429, 'Too many tries. Wait 15 minutes and try again.');
    const u = typeof username === 'string' && db.one('SELECT id, pass_hash FROM users WHERE username = ?', username);
    if (!u || typeof password !== 'string' || !verifyPassword(password, u.pass_hash)) throw new HttpError(401, 'That username and password don\'t match.');
    res.setHeader('Set-Cookie', sessionCookie(createSession(db, u.id), cfg.cookieSecure));
    return { ok: true };
  }, { public: true });

  r.add('POST', '/api/auth/logout', ({ db, cfg, req, res }) => {
    destroySession(db, req);
    res.setHeader('Set-Cookie', sessionCookie('', cfg.cookieSecure, true));
    return { ok: true };
  }, { public: true });

  r.add('GET', '/api/me', ({ db, ai, user }) => {
    const p = loadProfile(db, user.id);
    const notices = rollover(p);
    if (notices.length) saveProfile(db, p);
    return { user: { id: user.id, username: user.username }, profile: publicProfile(p), notices, ai: ai.configured() };
  });

  // Privacy: people can delete everything about themselves.
  r.add('POST', '/api/me/delete', ({ db, cfg, user, body, res }) => {
    const u = db.one('SELECT pass_hash FROM users WHERE id = ?', user.id);
    if (typeof body.password !== 'string' || !verifyPassword(body.password, u.pass_hash)) throw new HttpError(401, 'That password is wrong.');
    db.run('DELETE FROM users WHERE id = ?', user.id); // cascades to everything
    res.setHeader('Set-Cookie', sessionCookie('', cfg.cookieSecure, true));
    return { ok: true };
  });
}
