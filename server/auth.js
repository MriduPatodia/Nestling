import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { HttpError } from './http.js';

const COOKIE = 'ss_session';
const SESSION_DAYS = 30;
const sha = (s) => createHash('sha256').update(s).digest('hex');

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hashHex, 'hex');
  const got = scryptSync(pw, Buffer.from(saltHex, 'hex'), want.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(want, got);
}

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,24}$/.test(username))
    throw new HttpError(400, 'Usernames are 3–24 characters: letters, numbers, dots, dashes or underscores.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200)
    throw new HttpError(400, 'Passwords need at least 8 characters.');
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha(token), userId, Date.now() + SESSION_DAYS * 864e5);
  db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return token;
}
export function destroySession(db, req) {
  const t = readCookie(req, COOKIE);
  if (t) db.run('DELETE FROM sessions WHERE token_hash = ?', sha(t));
}
export function sessionCookie(token, secure, clear = false) {
  const parts = [`${COOKIE}=${clear ? '' : token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${clear ? 0 : SESSION_DAYS * 86400}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
export function readCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
export function userFromRequest(db, req) {
  const t = readCookie(req, COOKIE);
  if (!t) return null;
  return db.one(`SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
                 WHERE s.token_hash = ? AND s.expires_at > ?`, sha(t), Date.now()) || null;
}

// Very small in-memory rate limiter (per key, sliding window).
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr);
  return true;
}
