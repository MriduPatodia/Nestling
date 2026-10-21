// The character living in a room: walks around furniture, sits on things, and goes to the right
// spot to focus when a focus session starts.
import { ITEMS, ROOM_SIZE as R } from '/shared/catalog.js';
import { dims, tilesOf, surfaceAt } from '/shared/placement.js';
import { drawCharacter } from './character.js';
import { project } from './iso/render.js';

/* ---------------- geometry helpers ---------------- */
// Same rotation maths as the renderer: local (u, v) of an item → world tile coordinates.
function toWorld(p, u, v) {
  const it = ITEMS[p.item], lw = it.w, ld = it.d;
  switch (p.rot || 0) {
    case 1: return [p.x + v, p.y + (lw - u)];
    case 2: return [p.x + (lw - u), p.y + (ld - v)];
    case 3: return [p.x + (ld - v), p.y + u];
    default: return [p.x + u, p.y + v];
  }
}
// Which way the front (+v) of an item points, as a character facing.
const FRONT = ['fl', 'fr', 'br', 'bl'];
const OPPOSITE = { fl: 'br', br: 'fl', fr: 'bl', bl: 'fr' };
const facingFor = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'fr' : 'bl') : (dy > 0 ? 'fl' : 'br'));

// Where to sit on each kind of seat (local coords) and how high the seat is.
const SEATS = {
  chair_desk: { at: [[0.5, 0.56]], h: 21 }, dining_chair: { at: [[0.5, 0.56]], h: 21 },
  armchair: { at: [[0.5, 0.6]], h: 17 }, beanbag: { at: [[0.5, 0.55]], h: 13 },
  sofa: { at: [[0.55, 0.62], [1.45, 0.62]], h: 18 }, garden_bench: { at: [[0.6, 0.55], [1.4, 0.55]], h: 17 },
  bed_single: { at: [[0.5, 1.45]], h: 22 }, bed_double: { at: [[0.6, 1.5], [1.4, 1.5]], h: 22 }, bed_canopy: { at: [[0.6, 1.5]], h: 22 },
};

// What each room prefers for focusing, best first.
const FOCUS_PLAN = {
  bedroom: ['chair_desk', 'bed', 'beanbag', 'armchair', 'rug', 'floor'],
  study: ['chair_desk', 'armchair', 'beanbag', 'sofa', 'rug', 'floor'],
  living: ['sofa', 'armchair', 'beanbag', 'dining_chair', 'rug', 'floor'],
  kitchen: ['dining_chair', 'rug', 'floor'],
  bathroom: ['bath_mat', 'rug', 'floor'],
  music: ['piano', 'guitar', 'beanbag', 'sofa', 'armchair', 'rug', 'floor'],
  library: ['armchair', 'chair_desk', 'sofa', 'beanbag', 'rug', 'floor'],
  greenhouse: ['garden_bench', 'rug', 'floor'],
  observatory: ['beanbag', 'armchair', 'chair_desk', 'rug', 'floor'],
};
const BED = new Set(['bed_single', 'bed_double', 'bed_canopy']);

function blockedTiles(placements) {
  const b = new Set();
  for (const p of placements) {
    const L = ITEMS[p.item]?.layer;
    if (L === 'floor') tilesOf(p).forEach((t) => b.add(t));
    if (L === 'small' && !surfaceAt(placements, p.x, p.y)) b.add(p.x + ',' + p.y);
  }
  return b;
}
const key = (x, y) => x + ',' + y;
const inRoom = (x, y) => x >= 0 && y >= 0 && x < R && y < R;

/** Breadth-first path over free tiles. The goal tile may be blocked (a seat). */
function findPath(blocked, from, to) {
  const start = key(...from), goal = key(...to);
  if (start === goal) return [to];
  const prev = new Map([[start, null]]), queue = [from];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!inRoom(nx, ny) || prev.has(k)) continue;
      if (blocked.has(k) && k !== goal) continue;
      prev.set(k, key(x, y));
      if (k === goal) {
        const path = []; let c = k;
        while (c && c !== start) { path.unshift(c.split(',').map(Number)); c = prev.get(c); }
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

function seatSpots(placements, ids) {
  const out = [];
  for (const p of placements) {
    const s = SEATS[p.item];
    if (!s || (ids && !ids.includes(p.item))) continue;
    for (const [u, v] of s.at) {
      const [wx, wy] = toWorld(p, u, v);
      out.push({ item: p.item, x: wx, y: wy, z: s.h, tile: [Math.floor(wx), Math.floor(wy)], facing: FRONT[p.rot || 0], pose: 'sit' });
    }
  }
  return out;
}

function freeTiles(blocked) {
  const out = [];
  for (let x = 0; x < R; x++) for (let y = 0; y < R; y++) if (!blocked.has(key(x, y))) out.push([x, y]);
  return out;
}

/** The best place to focus in this room. */
export function focusSpot(roomType, placements) {
  const blocked = blockedTiles(placements);
  const hasLaptop = placements.some((p) => p.item === 'laptop');
  for (const kind of FOCUS_PLAN[roomType] || FOCUS_PLAN.bedroom) {
    if (SEATS[kind]) {
      const s = seatSpots(placements, [kind])[0];
      if (s) return { ...s, prop: (kind === 'chair_desk' || kind === 'dining_chair' || BED.has(kind)) && hasLaptop ? 'laptop' : 'book', bubble: 'think' };
    }
    if (kind === 'bed') {
      const s = seatSpots(placements, [...BED])[0];
      if (s) return { ...s, prop: hasLaptop ? 'laptop' : 'book', bubble: 'think' };
    }
    if (kind === 'piano') {
      const p = placements.find((q) => q.item === 'piano');
      if (p) {
        for (const u of [0.5, 1.5]) {
          const [wx, wy] = toWorld(p, u, 1.5), tx = Math.floor(wx), ty = Math.floor(wy);
          if (inRoom(tx, ty) && !blocked.has(key(tx, ty))) {
            const face = OPPOSITE[FRONT[p.rot || 0]];
            const [fx, fy] = toWorld(p, u, 1.2);
            return { x: fx, y: fy, z: 16, tile: [tx, ty], facing: face, pose: 'sit', prop: 'piano', stool: true, bubble: 'music' };
          }
        }
      }
    }
    if (kind === 'guitar') {
      const g = placements.find((q) => q.item === 'guitar');
      if (g) for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const tx = g.x + dx, ty = g.y + dy;
        if (inRoom(tx, ty) && !blocked.has(key(tx, ty))) return { x: tx + 0.5, y: ty + 0.5, z: 0, tile: [tx, ty], facing: 'fl', pose: 'floor', prop: 'guitar', bubble: 'music' };
      }
    }
    if (kind === 'rug' || kind === 'bath_mat') {
      const rugs = placements.filter((p) => ITEMS[p.item]?.layer === 'rug' && (kind === 'rug' || p.item === 'bath_mat'));
      for (const r of rugs) {
        const t = tilesOf(r).map((s) => s.split(',').map(Number)).find(([x, y]) => !blocked.has(key(x, y)));
        if (t) return { x: t[0] + 0.5, y: t[1] + 0.5, z: 0, tile: t, facing: 'fl', pose: 'floor', prop: hasLaptop ? 'laptop' : 'book', bubble: 'think' };
      }
    }
    if (kind === 'floor') {
      const tiles = freeTiles(blocked).sort((a, b) => Math.hypot(a[0] - 2.5, a[1] - 2.5) - Math.hypot(b[0] - 2.5, b[1] - 2.5));
      if (tiles[0]) return { x: tiles[0][0] + 0.5, y: tiles[0][1] + 0.5, z: 0, tile: tiles[0], facing: 'fl', pose: 'floor', prop: 'book', bubble: 'think' };
    }
  }
  return null;
}

const LINES = ['Hi, {name}!', 'Let\'s get some work done!', 'Nice room, right?', 'Snack break soon?', 'You\'ve got this!', 'I like it here.', 'Time for a stretch?', 'Drink some water!'];

/* ---------------- the actor ---------------- */
export class Actor {
  constructor({ look, name } = {}) {
    this.look = look; this.name = name || '';
    this.x = R - 0.5; this.y = R + 0.6; this.z = 0;
    this.path = []; this.target = null;
    this.state = 'enter'; this.until = 0;
    this.pose = 'walk'; this.facing = 'br'; this.prop = null; this.bubble = null; this.stool = false;
    this.mode = 'roam'; this.say = null; this.sayUntil = 0;
    this.last = performance.now();
  }

  tile() { return [Math.min(R - 1, Math.max(0, Math.floor(this.x))), Math.min(R - 1, Math.max(0, Math.floor(this.y)))]; }

  standUp() { this.z = 0; this.prop = null; this.bubble = null; this.stool = false; this.pose = 'stand'; }

  walkTo(tile, blocked, then) {
    const from = this.tile();
    const path = findPath(blocked, from, tile);
    if (!path) return false;
    this.standUp();
    this.path = path.map(([x, y]) => [x + 0.5, y + 0.5]);
    this.state = 'walk'; this.then = then;
    return true;
  }

  /** Called when clicked: wave and say something. */
  poke() {
    if (this.state === 'walk' || this.mode === 'focus') { this.say = this.mode === 'focus' ? 'Focusing…' : 'One sec!'; this.sayUntil = performance.now() + 1600; return; }
    this.standUp();
    this.state = 'wave'; this.until = performance.now() + 1800;
    this.say = LINES[Math.floor(Math.random() * LINES.length)].replace('{name}', this.name || 'friend'); this.sayUntil = this.until;
  }

  update(now, room, placements, focus) {
    const dt = Math.min(100, now - this.last); this.last = now;
    const blocked = blockedTiles(placements);

    // switch between roaming, focusing and breaks
    const want = focus || 'roam';
    if (want !== this.mode) {
      this.mode = want;
      if (want === 'focus') this.goFocus(room, placements, blocked);
      else if (want === 'break') { this.standUp(); this.state = 'stretch'; this.until = now + 3500; this.path = []; }
      else if (this.state === 'focus') { this.standUp(); this.state = 'idle'; this.until = now + 1500; }
    }
    if (this.mode === 'focus' && this.state !== 'walk' && this.state !== 'focus') this.goFocus(room, placements, blocked);

    // furniture moved onto our tile? step aside
    if (this.state === 'idle' && blocked.has(key(...this.tile()))) {
      const near = freeTiles(blocked).sort((a, b) => Math.hypot(a[0] - this.x, a[1] - this.y) - Math.hypot(b[0] - this.x, b[1] - this.y))[0];
      if (near) { this.x = near[0] + 0.5; this.y = near[1] + 0.5; }
    }

    switch (this.state) {
      case 'enter': {
        // walk in from the front edge of the room
        const free = freeTiles(blocked).sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]));
        const dest = free[Math.floor(Math.random() * Math.min(4, free.length))] || [R - 1, R - 1];
        this.path = [[R - 0.5, R - 0.5], [dest[0] + 0.5, dest[1] + 0.5]];
        this.state = 'walk'; this.then = () => { this.state = 'wave'; this.until = now + 1500; this.facing = 'fl'; };
        break;
      }
      case 'walk': {
        const next = this.path[0];
        if (!next) { this.state = 'idle'; this.until = now + 2000; this.then?.(); this.then = null; break; }
        const dx = next[0] - this.x, dy = next[1] - this.y, d = Math.hypot(dx, dy);
        const step = 0.0016 * dt;
        this.pose = 'walk'; if (d > 0.001) this.facing = facingFor(dx, dy);
        if (d <= step) { this.x = next[0]; this.y = next[1]; this.path.shift(); }
        else { this.x += (dx / d) * step; this.y += (dy / d) * step; }
        break;
      }
      case 'wave': this.pose = 'wave'; if (now > this.until) { this.state = 'idle'; this.until = now + 1500; } break;
      case 'stretch': this.pose = 'stretch'; if (now > this.until) { this.state = 'idle'; this.until = now + 1000; } break;
      case 'sit': if (now > this.until) { this.standUp(); this.state = 'idle'; this.until = now + 800; this.stepOff(blocked); } break;
      case 'focus': break;
      default: { // idle
        this.pose = 'stand';
        if (now < this.until || this.mode === 'focus') break;
        const r = Math.random();
        const seats = seatSpots(placements);
        if (r < 0.28 && seats.length) {
          const s = seats[Math.floor(Math.random() * seats.length)];
          this.walkTo(s.tile, blocked, () => this.sitAt(s, now + 7000 + Math.random() * 8000, Math.random() < 0.4 ? 'book' : null));
        } else if (r < 0.85) {
          const free = freeTiles(blocked);
          const t = free[Math.floor(Math.random() * free.length)];
          if (!t || !this.walkTo(t, blocked)) this.until = now + 2000;
        } else { this.facing = ['fl', 'fr'][Math.floor(Math.random() * 2)]; this.until = now + 2500; }
      }
    }
  }

  sitAt(s, until, prop) {
    this.x = s.x; this.y = s.y; this.z = s.z; this.facing = s.facing;
    this.pose = s.pose; this.prop = prop ?? s.prop ?? null; this.bubble = s.bubble ?? null; this.stool = !!s.stool;
    this.state = until === Infinity ? 'focus' : 'sit'; this.until = until;
  }

  /** After getting off a seat, stand on the nearest free tile. */
  stepOff(blocked) {
    const t = this.tile();
    if (!blocked.has(key(...t))) { this.x = t[0] + 0.5; this.y = t[1] + 0.5; return; }
    const near = freeTiles(blocked).sort((a, b) => Math.hypot(a[0] - this.x, a[1] - this.y) - Math.hypot(b[0] - this.x, b[1] - this.y))[0];
    if (near) { this.x = near[0] + 0.5; this.y = near[1] + 0.5; }
  }

  goFocus(room, placements, blocked) {
    const s = focusSpot(room.type, placements);
    if (!s) return;
    const go = () => this.sitAt(s, Infinity);
    if (!this.walkTo(s.tile, blocked, go)) go(); // boxed in by furniture: just appear there
  }

  /** Data for the renderer. */
  render(now) {
    const look = this.look, self = this;
    return {
      x: this.x, y: this.y, z: this.z,
      draw(ctx) {
        drawCharacter(ctx, look, {
          t: now, pose: self.pose, facing: self.facing, prop: self.state === 'focus' || self.state === 'sit' ? self.prop : null,
          seat: self.z, stool: self.stool, focus: self.state === 'focus',
          bubble: now < self.sayUntil ? { text: self.say } : self.state === 'focus' ? self.bubble : null,
        });
      },
    };
  }

  /** Is screen point (X, Y) in iso space on the character? */
  hit(X, Y) {
    const [cx, cy] = project(this.x, this.y, this.z);
    return X > cx - 12 && X < cx + 12 && Y > cy - 60 && Y < cy + 4;
  }
}
