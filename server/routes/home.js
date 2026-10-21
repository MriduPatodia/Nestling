import { HttpError, bad, notFound, int } from '../http.js';
import { loadProfile, saveProfile, publicProfile } from '../economy.js';
import {
  ITEMS, ROOM_TYPES, WALLPAPERS, FLOORS, HOUSE_SLOTS, ROOM_BUILD_COST, SELL_BACK, roomBuildCost, tierIndex, homeLevel,
  allowedIn, homeOf,
} from '../../shared/catalog.js';
import { canPlace, itemsOnTop, dims } from '../../shared/placement.js';

const itemOut = (i) => ({ id: i.id, item: i.item, roomId: i.room_id, x: i.x, y: i.y, rot: i.rot, wall: i.wall });
const roomOut = (r) => ({ id: r.id, slot: r.slot, type: r.type, wallpaper: r.wallpaper, floor: r.floor });
const placedIn = (db, roomId) => db.all('SELECT * FROM items WHERE room_id = ?', roomId).map(itemOut);

/** Slots: 0,1 ground floor · 2,3 first floor · 4,5 second floor · 6 attic. Upper rooms need a room underneath. */
export function slotSupported(built, slot) {
  if (slot < 2) return true;
  if (slot === 6) return built.has(4) || built.has(5);
  return built.has(slot - 2);
}

function spend(db, userId, amount, what) {
  const p = loadProfile(db, userId);
  if (p.coins < amount) throw new HttpError(402, `You need ${amount - p.coins} more coins for ${what}.`);
  p.coins -= amount;
  saveProfile(db, p);
  return p;
}
function requireTier(db, userId, tier, what) {
  if (!tier) return;
  const p = loadProfile(db, userId);
  if (tierIndex(p.indXP) < tier) throw new HttpError(403, `${what} unlocks at a higher independence level. Do more work without AI to get there.`);
}

export function homeValue(db, userId) {
  let v = 0;
  for (const i of db.all('SELECT item FROM items WHERE user_id = ?', userId)) v += ITEMS[i.item]?.price || 0;
  const n = db.one('SELECT COUNT(*) AS n FROM rooms WHERE user_id = ?', userId).n;
  for (let k = 0; k < n; k++) v += ROOM_BUILD_COST[Math.min(k, ROOM_BUILD_COST.length - 1)];
  for (const s of db.all('SELECT style FROM styles WHERE user_id = ?', userId)) {
    const [kind, id] = s.style.split(':');
    v += (kind === 'wp' ? WALLPAPERS[id] : FLOORS[id])?.price || 0;
  }
  return v;
}

function homeState(db, userId) {
  const value = homeValue(db, userId);
  return {
    rooms: db.all('SELECT * FROM rooms WHERE user_id = ? ORDER BY slot', userId).map(roomOut),
    items: db.all('SELECT * FROM items WHERE user_id = ? ORDER BY id', userId).map(itemOut),
    styles: db.all('SELECT style FROM styles WHERE user_id = ?', userId).map((s) => s.style),
    value, level: homeLevel(value),
  };
}

export function createStarterHome(db, userId) {
  const t = Date.now();
  const { lastInsertRowid } = db.run('INSERT INTO rooms (user_id, slot, type, wallpaper, floor, created_at) VALUES (?,?,?,?,?,?)', userId, 0, 'bedroom', 'sage', 'oak', t);
  const roomId = Number(lastInsertRowid);
  const starter = [
    ['rug_round', 2, 2, 0, null], ['desk', 1, 0, 0, null], ['chair_desk', 1, 1, 2, null], ['lamp_desk', 2, 0, 0, null],
    ['books', 1, 0, 0, null], ['bed_single', 0, 3, 0, null], ['cactus', 5, 0, 0, null],
    ['window', 3, 0, 0, 'R'], ['poster_wave', 1, 0, 0, 'L'],
  ];
  for (const [item, x, y, rot, wall] of starter)
    db.run('INSERT INTO items (user_id, item, room_id, x, y, rot, wall, created_at) VALUES (?,?,?,?,?,?,?,?)', userId, item, roomId, x, y, rot, wall, t);
}

/** Each room type has its own shop; a toilet doesn't go in the bedroom. */
function requireFits(room, item) {
  if (allowedIn(room.type, item)) return;
  const it = ITEMS[item], home = homeOf(item);
  const here = ROOM_TYPES[room.type].name.toLowerCase();
  throw new HttpError(409, `The ${it.name.toLowerCase()} doesn't belong in a ${here}.` + (home ? ` Put it in a ${ROOM_TYPES[home].name.toLowerCase()}.` : ''));
}

function getRoom(db, userId, id) {
  const r = db.one('SELECT * FROM rooms WHERE id = ? AND user_id = ?', int(id, 'Room'), userId);
  if (!r) throw notFound('That room doesn\'t exist.');
  return r;
}

function readPlacement(body, item) {
  const it = ITEMS[item];
  return {
    item, x: int(body.x, 'x'), y: it.layer === 'wall' ? 0 : int(body.y, 'y'),
    rot: it.layer === 'wall' ? 0 : int(body.rot ?? 0, 'Rotation'),
    wall: it.layer === 'wall' ? body.wall : null,
  };
}

/** When a surface moves, carry what's on it (same rotation) or put it away (rotated). */
function carryTop(db, before, after, roomPlacements) {
  if (!ITEMS[before.item].surface) return 0;
  const tops = itemsOnTop(roomPlacements, before);
  const carry = after.roomId === before.roomId && after.rot === before.rot;
  for (const t of tops) {
    if (carry) db.run('UPDATE items SET x = ?, y = ? WHERE id = ?', t.x + (after.x - before.x), t.y + (after.y - before.y), t.id);
    else db.run('UPDATE items SET room_id = NULL WHERE id = ?', t.id);
  }
  return carry ? 0 : tops.length;
}

export function register(r) {
  r.add('GET', '/api/home', ({ db, user }) => homeState(db, user.id));

  r.add('POST', '/api/rooms', ({ db, user, body }) => db.tx(() => {
    const slot = int(body.slot, 'Slot');
    const type = body.type;
    if (slot < 0 || slot >= HOUSE_SLOTS) throw bad('That spot isn\'t part of the house.');
    if (!ROOM_TYPES[type]) throw bad('Pick a room type.');
    const rooms = db.all('SELECT slot FROM rooms WHERE user_id = ?', user.id);
    const built = new Set(rooms.map((x) => x.slot));
    if (built.has(slot)) throw new HttpError(409, 'There\'s already a room there.');
    if (!slotSupported(built, slot)) throw new HttpError(409, 'Build the room underneath first.');
    requireTier(db, user.id, ROOM_TYPES[type].tier, ROOM_TYPES[type].name);
    const cost = roomBuildCost(rooms.length);
    const p = spend(db, user.id, cost, 'a new room');
    const def = ROOM_TYPES[type];
    db.run('INSERT INTO rooms (user_id, slot, type, wallpaper, floor, created_at) VALUES (?,?,?,?,?,?)', user.id, slot, type, def.wallpaper, def.floor, Date.now());
    // A room comes with its default wallpaper and floor.
    db.run('INSERT OR IGNORE INTO styles (user_id, style) VALUES (?, ?)', user.id, 'wp:' + def.wallpaper);
    db.run('INSERT OR IGNORE INTO styles (user_id, style) VALUES (?, ?)', user.id, 'fl:' + def.floor);
    return { home: homeState(db, user.id), profile: publicProfile(p) };
  }));

  r.add('PATCH', '/api/rooms/:id', ({ db, user, params, body }) => db.tx(() => {
    const room = getRoom(db, user.id, params.id);
    if (body.type !== undefined) {
      if (!ROOM_TYPES[body.type]) throw bad('Unknown room type.');
      requireTier(db, user.id, ROOM_TYPES[body.type].tier, ROOM_TYPES[body.type].name);
      db.run('UPDATE rooms SET type = ? WHERE id = ?', body.type, room.id);
    }
    return { home: homeState(db, user.id) };
  }));

  // Apply a wallpaper or floor; buys it first if you don't own it yet. Owned styles are reusable everywhere.
  r.add('POST', '/api/rooms/:id/style', ({ db, user, params, body }) => db.tx(() => {
    const room = getRoom(db, user.id, params.id);
    const kind = body.kind === 'wallpaper' ? 'wp' : body.kind === 'floor' ? 'fl' : null;
    if (!kind) throw bad('Choose wallpaper or floor.');
    const def = (kind === 'wp' ? WALLPAPERS : FLOORS)[body.id];
    if (!def) throw bad('Unknown style.');
    const key = kind + ':' + body.id;
    let p = loadProfile(db, user.id);
    const owned = def.price === 0 || db.one('SELECT 1 FROM styles WHERE user_id = ? AND style = ?', user.id, key);
    if (!owned) {
      requireTier(db, user.id, def.tier, def.name);
      p = spend(db, user.id, def.price, def.name);
      db.run('INSERT INTO styles (user_id, style) VALUES (?, ?)', user.id, key);
    }
    db.run(`UPDATE rooms SET ${kind === 'wp' ? 'wallpaper' : 'floor'} = ? WHERE id = ?`, body.id, room.id);
    return { home: homeState(db, user.id), profile: publicProfile(p), bought: !owned };
  }));

  // Buy an item, optionally placing it straight into a room.
  r.add('POST', '/api/items', ({ db, user, body }) => db.tx(() => {
    const it = ITEMS[body.item];
    if (!it) throw bad('Unknown item.');
    requireTier(db, user.id, it.tier, it.name);
    let roomId = null, place = { x: 0, y: 0, rot: 0, wall: null };
    if (body.roomId != null) {
      const room = getRoom(db, user.id, body.roomId);
      roomId = room.id;
      requireFits(room, body.item);
      place = readPlacement(body, body.item);
      const check = canPlace(placedIn(db, room.id), place);
      if (!check.ok) throw new HttpError(409, check.reason);
    }
    const p = spend(db, user.id, it.price, it.name);
    db.run('INSERT INTO items (user_id, item, room_id, x, y, rot, wall, created_at) VALUES (?,?,?,?,?,?,?,?)',
      user.id, body.item, roomId, place.x, place.y, place.rot, place.wall, Date.now());
    return { home: homeState(db, user.id), profile: publicProfile(p) };
  }));

  // Move, rotate, or store (roomId: null) an item you own.
  r.add('PATCH', '/api/items/:id', ({ db, user, params, body }) => db.tx(() => {
    const row = db.one('SELECT * FROM items WHERE id = ? AND user_id = ?', int(params.id, 'Item'), user.id);
    if (!row) throw notFound('You don\'t own that item.');
    const before = itemOut(row);
    let stored = 0;
    if (body.roomId == null) {
      if (before.roomId) stored = carryTop(db, before, { ...before, roomId: null }, placedIn(db, before.roomId));
      db.run('UPDATE items SET room_id = NULL WHERE id = ?', row.id);
    } else {
      const room = getRoom(db, user.id, body.roomId);
      if (before.roomId !== room.id) requireFits(room, row.item);
      const place = { id: row.id, ...readPlacement(body, row.item) };
      const others = placedIn(db, room.id);
      // Items riding on this surface move with it, so ignore them for the collision check.
      const riders = before.roomId === room.id && ITEMS[row.item].surface && place.rot === before.rot ? itemsOnTop(others, before).map((t) => t.id) : [];
      const check = canPlace(others.filter((o) => !riders.includes(o.id)), place);
      if (!check.ok) throw new HttpError(409, check.reason);
      if (riders.length) {
        const { w, d } = dims(place);
        const dx = place.x - before.x, dy = place.y - before.y;
        const fits = itemsOnTop(others, before).every((t) => t.x + dx >= place.x && t.x + dx < place.x + w && t.y + dy >= place.y && t.y + dy < place.y + d);
        if (!fits) throw new HttpError(409, 'Clear the top first.');
      }
      if (before.roomId) stored = carryTop(db, before, { ...place, roomId: room.id }, others);
      db.run('UPDATE items SET room_id = ?, x = ?, y = ?, rot = ?, wall = ? WHERE id = ?', room.id, place.x, place.y, place.rot, place.wall, row.id);
    }
    return { home: homeState(db, user.id), stored };
  }));

  r.add('DELETE', '/api/items/:id', ({ db, user, params }) => db.tx(() => {
    const row = db.one('SELECT * FROM items WHERE id = ? AND user_id = ?', int(params.id, 'Item'), user.id);
    if (!row) throw notFound('You don\'t own that item.');
    const before = itemOut(row);
    const stored = before.roomId ? carryTop(db, before, { ...before, roomId: null }, placedIn(db, before.roomId)) : 0;
    db.run('DELETE FROM items WHERE id = ?', row.id);
    const p = loadProfile(db, user.id);
    const back = Math.floor(ITEMS[row.item].price * SELL_BACK);
    p.coins += back;
    saveProfile(db, p);
    return { home: homeState(db, user.id), profile: publicProfile(p), refund: back, stored };
  }));
}
