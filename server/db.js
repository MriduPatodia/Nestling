// SQLite via Node's built-in node:sqlite (Node 22.13+). No native modules to install.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL, earned INTEGER NOT NULL DEFAULT 0, ind_xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0, last_done TEXT, freezes INTEGER NOT NULL DEFAULT 0,
  goals TEXT NOT NULL, prefs TEXT NOT NULL, timer TEXT NOT NULL, day TEXT NOT NULL, house_color TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL, action TEXT NOT NULL, kind TEXT NOT NULL, coins INTEGER NOT NULL,
  units_ai INTEGER NOT NULL DEFAULT 0, units_ind INTEGER NOT NULL DEFAULT 0, ref TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_user_day ON events(user_id, day);
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', notes_own TEXT NOT NULL DEFAULT '',
  own_credited INTEGER NOT NULL DEFAULT 0, notes_ai TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY, set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, q TEXT NOT NULL, a TEXT NOT NULL, src TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS quiz (
  id INTEGER PRIMARY KEY, set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, q TEXT NOT NULL, options TEXT NOT NULL, answer INTEGER NOT NULL,
  explain TEXT NOT NULL DEFAULT '', src TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS hints (
  user_id INTEGER NOT NULL, quiz_id INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  text TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, quiz_id));
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY, set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS focus (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id INTEGER, planned_min INTEGER NOT NULL, started_at INTEGER NOT NULL, paused_at INTEGER,
  paused_ms INTEGER NOT NULL DEFAULT 0, credited INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'running');
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL, type TEXT NOT NULL, wallpaper TEXT NOT NULL, floor TEXT NOT NULL,
  created_at INTEGER NOT NULL, UNIQUE(user_id, slot));
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item TEXT NOT NULL, room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  x INTEGER NOT NULL DEFAULT 0, y INTEGER NOT NULL DEFAULT 0, rot INTEGER NOT NULL DEFAULT 0, wall TEXT,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY, set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, kind TEXT NOT NULL,
  method TEXT NOT NULL, pages INTEGER, chars INTEGER NOT NULL, text TEXT NOT NULL,
  use INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL,
  mood INTEGER NOT NULL, stress INTEGER NOT NULL, sleep REAL, body TEXT NOT NULL DEFAULT '[]', topics TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id, day));
CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS styles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, style TEXT NOT NULL,
  PRIMARY KEY (user_id, style));
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  // Columns added after the first release: add them to existing databases.
  const cols = db.prepare('PRAGMA table_info(profiles)').all().map((c) => c.name);
  if (!cols.includes('nickname')) db.exec("ALTER TABLE profiles ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('avatar')) db.exec('ALTER TABLE profiles ADD COLUMN avatar TEXT');
  let depth = 0;
  /** Run fn inside a transaction (re-entrant). */
  db.tx = (fn) => {
    if (depth > 0) return fn();
    db.exec('BEGIN IMMEDIATE');
    depth++;
    try { const r = fn(); depth--; db.exec('COMMIT'); return r; }
    catch (e) { depth--; db.exec('ROLLBACK'); throw e; }
  };
  db.one = (sql, ...a) => db.prepare(sql).get(...a);
  db.all = (sql, ...a) => db.prepare(sql).all(...a);
  db.run = (sql, ...a) => db.prepare(sql).run(...a);
  return db;
}
