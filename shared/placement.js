// Placement rules for furniture inside a room. Shared by the server (authoritative)
// and the room editor (live green/red ghost).
import { ITEMS, ROOM_SIZE } from './catalog.js';

/** Footprint in world tiles after rotation. */
export function dims(p) {
  const it = ITEMS[p.item];
  return p.rot % 2 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
}

export function tilesOf(p) {
  const { w, d } = dims(p);
  const out = [];
  for (let x = p.x; x < p.x + w; x++) for (let y = p.y; y < p.y + d; y++) out.push(x + ',' + y);
  return out;
}

/** The surface item (desk, table...) covering tile x,y, if any. */
export function surfaceAt(placements, x, y, ignoreId) {
  return placements.find((p) => p.id !== ignoreId && ITEMS[p.item]?.layer === 'floor' && ITEMS[p.item].surface &&
    tilesOf(p).includes(x + ',' + y)) || null;
}

const inRoom = (p) => {
  const { w, d } = dims(p);
  return p.x >= 0 && p.y >= 0 && p.x + w <= ROOM_SIZE && p.y + d <= ROOM_SIZE;
};

/**
 * Can `cand` ({id?, item, x, y, rot, wall}) be placed among `placements` (same room)?
 * Returns { ok: true } or { ok: false, reason }.
 */
export function canPlace(placements, cand) {
  const it = ITEMS[cand.item];
  if (!it) return { ok: false, reason: 'Unknown item.' };
  if (![0, 1, 2, 3].includes(cand.rot)) return { ok: false, reason: 'Bad rotation.' };
  if (!Number.isInteger(cand.x) || !Number.isInteger(cand.y)) return { ok: false, reason: 'Bad position.' };
  const others = placements.filter((p) => p.id !== cand.id);

  if (it.layer === 'wall') {
    if (cand.wall !== 'L' && cand.wall !== 'R') return { ok: false, reason: 'Pick a wall.' };
    if (cand.x < 0 || cand.x + it.w > ROOM_SIZE) return { ok: false, reason: 'That doesn\'t fit on the wall.' };
    const clash = others.some((p) => ITEMS[p.item].layer === 'wall' && p.wall === cand.wall &&
      p.x < cand.x + it.w && cand.x < p.x + ITEMS[p.item].w);
    return clash ? { ok: false, reason: 'Something is already hanging there.' } : { ok: true };
  }

  if (!inRoom(cand)) return { ok: false, reason: 'That doesn\'t fit in the room there.' };
  const mine = tilesOf(cand);

  if (it.layer === 'rug') {
    const clash = others.some((p) => ITEMS[p.item].layer === 'rug' && tilesOf(p).some((t) => mine.includes(t)));
    return clash ? { ok: false, reason: 'Rugs can\'t overlap.' } : { ok: true };
  }

  // Tiles blocked at floor level: floor furniture, plus small items standing on the floor.
  const blocked = new Set();
  for (const p of others) {
    const L = ITEMS[p.item].layer;
    if (L === 'floor') tilesOf(p).forEach((t) => blocked.add(t));
    if (L === 'small' && !surfaceAt(others, p.x, p.y)) blocked.add(p.x + ',' + p.y);
  }

  if (it.layer === 'small') {
    const host = surfaceAt(others, cand.x, cand.y);
    if (host) {
      // Each desk/table tile has 4 spots (slot 0-3). An item without a slot takes the whole tile.
      if (cand.slot != null && ![0, 1, 2, 3].includes(cand.slot)) return { ok: false, reason: 'Bad spot.' };
      const taken = others.some((p) => ITEMS[p.item].layer === 'small' && p.x === cand.x && p.y === cand.y &&
        (p.slot == null || cand.slot == null || p.slot === cand.slot));
      return taken ? { ok: false, reason: 'There\'s already something on that spot.' } : { ok: true, host };
    }
    if (cand.slot != null) return { ok: false, reason: 'Small spots are only on desks and tables.' };
    return blocked.has(mine[0]) ? { ok: false, reason: 'That spot is taken.' } : { ok: true };
  }

  // floor furniture
  if (mine.some((t) => blocked.has(t))) return { ok: false, reason: 'That spot is taken.' };
  return { ok: true };
}

/** Small items resting on a given surface placement. */
export function itemsOnTop(placements, host) {
  const tiles = tilesOf(host);
  return placements.filter((p) => ITEMS[p.item].layer === 'small' && tiles.includes(p.x + ',' + p.y));
}
