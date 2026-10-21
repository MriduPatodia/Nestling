// Isometric room renderer.
// World space: tiles (wx, wy) from 0..ROOM_SIZE, height z in px. The back walls are the planes wx=0 ("L") and wy=0 ("R").
import { ITEMS, ROOM_SIZE as R, WALL_HEIGHT as WH, WALLPAPERS, FLOORS } from '/shared/catalog.js';
import { dims } from '/shared/placement.js';
import { ART, WALL_ART, RUG_ART } from './art.js';
import { paintWall, paintFloor } from './surfaces.js';

export const TW = 64, TH = 32;
export const project = (wx, wy, z = 0) => [(wx - wy) * TW / 2, (wx + wy) * TH / 2 - z];
export const unproject = (X, Y, z = 0) => {
  const s = (Y + z) / (TH / 2), dlt = X / (TW / 2);
  return [(s + dlt) / 2, (s - dlt) / 2];
};
export const BOUNDS = { x0: -R * 32 - 14, x1: R * 32 + 14, y0: -WH - 14, y1: R * 16 * 2 + 18 };

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
export const poly = (ctx, pts, fill, stroke) => {
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
};

/* ---------------- time of day ---------------- */
export function daylight(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  // 0 = full night, 1 = full day, with dawn 6-7.5 and dusk 18-19.5
  if (h < 6 || h >= 19.5) return 0;
  if (h < 7.5) return (h - 6) / 1.5;
  if (h >= 18) return 1 - (h - 18) / 1.5;
  return 1;
}

/* ---------------- primitive builder ----------------
   Art functions draw in local coords (u along width, v along depth, z up) as if rot = 0.
   Each call becomes a primitive with a world-space bounding box for depth sorting. */
function makeBuilder(p, baseZ, prims, alpha, tint) {
  const it = ITEMS[p.item];
  const lw = it.w, ld = it.d;
  const rot = p.rot || 0;
  const toW = (u, v) => {
    switch (rot) {
      case 1: return [p.x + v, p.y + (lw - u)];
      case 2: return [p.x + (lw - u), p.y + (ld - v)];
      case 3: return [p.x + (ld - v), p.y + u];
      default: return [p.x + u, p.y + v];
    }
  };
  const normal = (axis, dir) => {
    // local +u / +v → world direction
    const map = { u: [[1, 0], [0, -1], [-1, 0], [0, 1]], v: [[0, 1], [1, 0], [0, -1], [-1, 0]] };
    const [nx, ny] = map[axis][rot];
    return [nx * dir, ny * dir];
  };
  const P = (u, v, z) => { const [wx, wy] = toW(u, v); return project(wx, wy, z + baseZ); };
  const push = (bb, draw) => prims.push({ bb, draw, owner: p.id ?? 'ghost', alpha, tint });
  const bbOf = (pts3) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [u, v, z] of pts3) {
      const [wx, wy] = toW(u, v);
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
      z0 = Math.min(z0, z + baseZ); z1 = Math.max(z1, z + baseZ);
    }
    return { x0, x1, y0, y1, z0, z1 };
  };

  const g = {
    t: 0, rot,
    box(u0, v0, u1, v1, z0, z1, color, opt = {}) {
      const bb = bbOf([[u0, v0, z0], [u1, v1, z1]]);
      push(bb, (ctx) => {
        const { x0, x1, y0, y1 } = bb, Z0 = bb.z0, Z1 = bb.z1;
        const pr = (x, y, z) => project(x, y, z);
        const s = opt.stroke === false ? null : 'rgba(0,0,0,.18)';
        poly(ctx, [pr(x0, y1, Z0), pr(x1, y1, Z0), pr(x1, y1, Z1), pr(x0, y1, Z1)], shade(color, -0.12), s);
        poly(ctx, [pr(x1, y0, Z0), pr(x1, y1, Z0), pr(x1, y1, Z1), pr(x1, y0, Z1)], shade(color, -0.26), s);
        poly(ctx, [pr(x0, y0, Z1), pr(x1, y0, Z1), pr(x1, y1, Z1), pr(x0, y1, Z1)], opt.top || color, s);
      });
    },
    /** Flat shape lying on a horizontal plane at height z (rect or ellipse). */
    flat(u0, v0, u1, v1, z, color, shape = 'rect') {
      const bb = bbOf([[u0, v0, z], [u1, v1, z]]);
      push(bb, (ctx) => {
        if (shape === 'circle') {
          const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, ru = (u1 - u0) / 2, rv = (v1 - v0) / 2;
          const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(P(cu + Math.cos(a) * ru, cv + Math.sin(a) * rv, z)); }
          poly(ctx, pts, color);
        } else poly(ctx, [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], color);
      });
    },
    /** Vertical cylinder centred at (u, v) with radius r (tiles). */
    cyl(u, v, r, z0, z1, color, topColor) {
      const bb = bbOf([[u - r, v - r, z0], [u + r, v + r, z1]]);
      push(bb, (ctx) => {
        const [cx, cy0] = P(u, v, z0), [, cy1] = P(u, v, z1);
        const rx = r * TW / 2 * Math.SQRT2, ry = r * TH / 2 * Math.SQRT2;
        const grad = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
        grad.addColorStop(0, shade(color, -0.05)); grad.addColorStop(1, shade(color, -0.32));
        ctx.beginPath(); ctx.ellipse(cx, cy0, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy1); ctx.ellipse(cx, cy1, rx, ry, 0, Math.PI, 0, true); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy1, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = topColor || color; ctx.fill();
      });
    },
    /** Sphere-ish blob (radius in px). */
    ball(u, v, z, rpx, color) {
      const rt = rpx / (TW / 2 * Math.SQRT2);
      const bb = bbOf([[u - rt, v - rt, z - rpx * 0.6], [u + rt, v + rt, z + rpx * 0.6]]);
      push(bb, (ctx) => {
        const [x, y] = P(u, v, z);
        const grad = ctx.createRadialGradient(x - rpx * 0.35, y - rpx * 0.35, rpx * 0.1, x, y, rpx);
        grad.addColorStop(0, shade(color, 0.18)); grad.addColorStop(1, shade(color, -0.18));
        ctx.beginPath(); ctx.arc(x, y, rpx, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
      });
    },
    /** Shape painted on a vertical local face: axis 'v' face at v=at spans u a0..a1; axis 'u' face at u=at spans v a0..a1.
        dir = which way the face points (+1/-1). Hidden faces are skipped. */
    decal(axis, at, dir, a0, a1, z0, z1, color, shape = 'rect') {
      const [nx, ny] = normal(axis, dir);
      if (nx < 0 || ny < 0) return; // faces away from the viewer
      const pt = (a, z) => (axis === 'v' ? [a, at, z] : [at, a, z]);
      const bb = bbOf([pt(a0, z0), pt(a1, z1)]);
      push(bb, (ctx) => {
        let pts;
        if (shape === 'circle') {
          const ca = (a0 + a1) / 2, cz = (z0 + z1) / 2, ra = (a1 - a0) / 2, rz = (z1 - z0) / 2;
          pts = []; for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; pts.push(P(...pt(ca + Math.cos(t) * ra, cz + Math.sin(t) * rz))); }
        } else pts = [pt(a0, z0), pt(a1, z0), pt(a1, z1), pt(a0, z1)].map((q) => P(...q));
        poly(ctx, pts, typeof color === 'function' ? color(ctx, pts) : color);
      });
    },
    /** Escape hatch: draw anything at a projected anchor. bb in local coords. */
    custom(u0, v0, u1, v1, z0, z1, fn) {
      const bb = bbOf([[u0, v0, z0], [u1, v1, z1]]);
      push(bb, (ctx) => fn(ctx, P, g.t));
    },
  };
  return g;
}

/* ---------------- depth sorting ---------------- */
const EPS = 0.001;
function behind(a, b) {
  const A = a.bb, B = b.bb;
  const ox = A.x0 < B.x1 - EPS && B.x0 < A.x1 - EPS;
  const oy = A.y0 < B.y1 - EPS && B.y0 < A.y1 - EPS;
  if (ox && oy) return A.z0 < B.z0 - EPS || (Math.abs(A.z0 - B.z0) <= EPS && A.z1 < B.z1 - EPS);
  if (A.x1 <= B.x0 + EPS && !(B.y1 <= A.y0 + EPS)) return true;
  if (A.y1 <= B.y0 + EPS && !(B.x1 <= A.x0 + EPS)) return true;
  return false;
}
function topoSort(prims) {
  const n = prims.length, out = [], state = new Uint8Array(n);
  const visit = (i) => {
    if (state[i]) return;
    state[i] = 1;
    for (let j = 0; j < n; j++) if (j !== i && !state[j] && behind(prims[j], prims[i])) visit(j);
    out.push(prims[i]);
  };
  // Seed in a sensible default order so cycles resolve nicely.
  const order = prims.map((p, i) => i).sort((a, b) => {
    const A = prims[a].bb, B = prims[b].bb;
    return (A.x0 + A.x1 + A.y0 + A.y1) - (B.x0 + B.x1 + B.y0 + B.y1) || A.z0 - B.z0;
  });
  for (const i of order) visit(i);
  return out;
}

/* ---------------- geometry helpers for hit testing ---------------- */
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const inside = (pt, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

export function wallFrame(wall) {
  // Returns an affine mapping wall-local (a px along wall, left→right as seen; z up) to screen.
  return wall === 'R' ? [1, 0.5, 0, -1, 0, 0] : [1, -0.5, 0, -1, -R * 32, R * 16];
}
const wallItemLeft = (p) => (p.wall === 'R' ? p.x * 32 : (R - p.x - ITEMS[p.item].w) * 32);
function wallPoly(p) {
  const it = ITEMS[p.item];
  const [a, b, c, d, e, f] = wallFrame(p.wall);
  const L = wallItemLeft(p), Rr = L + it.w * 32;
  const map = (x, z) => [a * x + c * z + e, b * x + d * z + f];
  return [map(L, it.z), map(Rr, it.z), map(Rr, it.z + it.h), map(L, it.z + it.h)];
}

export function elevationOf(p, placements) {
  const it = ITEMS[p.item];
  if (it.layer !== 'small') return 0;
  const host = placements.find((q) => q !== p && q.id !== p.id && ITEMS[q.item].layer === 'floor' && ITEMS[q.item].surface && (() => {
    const { w, d } = dims(q); return p.x >= q.x && p.x < q.x + w && p.y >= q.y && p.y < q.y + d;
  })());
  return host ? ITEMS[host.item].surface : 0;
}

/* ---------------- the renderer ---------------- */
export function drawRoom(ctx, room, placements, opts = {}) {
  const t = opts.time ?? performance.now();
  const day = opts.daylight ?? daylight();
  const wp = WALLPAPERS[room.wallpaper] || WALLPAPERS.sage;
  const fl = FLOORS[room.floor] || FLOORS.oak;
  const all = opts.ghost ? placements.concat([opts.ghost]) : placements;

  // floor slab edges
  const slab = 12;
  poly(ctx, [project(0, R), project(R, R), project(R, R, -slab), project(0, R, -slab)], '#8E6A4E');
  poly(ctx, [project(R, 0), project(R, R), project(R, R, -slab), project(R, 0, -slab)], '#6F5139');
  // floor
  ctx.save(); ctx.transform(32, 16, -32, 16, 0, 0);
  ctx.beginPath(); ctx.rect(0, 0, R, R); ctx.clip();
  paintFloor(ctx, fl, R);
  ctx.restore();
  // walls (a little thickness on top) + skirting
  for (const wall of ['L', 'R']) {
    ctx.save(); ctx.transform(...wallFrame(wall));
    ctx.beginPath(); ctx.rect(0, 0, R * 32, WH); ctx.clip();
    paintWall(ctx, wp, R * 32, WH, wall);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, R * 32, 6);
    ctx.fillStyle = shade(wp.base, -0.35); ctx.fillRect(0, 0, R * 32, 4);
    // ambient occlusion where the walls meet
    const grad = ctx.createLinearGradient(wall === 'R' ? 0 : R * 32, 0, wall === 'R' ? 26 : R * 32 - 26, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, R * 32, WH);
    ctx.restore();
  }
  const cap = 7;
  poly(ctx, [project(0, R, WH), project(0, 0, WH), project(-cap / 32 * 2, 0, WH), project(-cap / 32 * 2, R, WH)], shade(wp.base, -0.45));
  poly(ctx, [project(0, 0, WH), project(R, 0, WH), project(R, -cap / 32 * 2, WH), project(-cap / 32 * 2, -cap / 32 * 2, WH), project(-cap / 32 * 2, 0, WH)], shade(wp.base, -0.45));

  // wall items
  for (const p of all.filter((q) => ITEMS[q.item]?.layer === 'wall')) {
    const it = ITEMS[p.item];
    ctx.save();
    if (p === opts.ghost) ctx.globalAlpha = 0.6;
    ctx.transform(...wallFrame(p.wall));
    ctx.translate(wallItemLeft(p), it.z + it.h); ctx.scale(1, -1);
    (WALL_ART[p.item] || WALL_ART._default)(ctx, it.w * 32, it.h, t, { day, wall: p.wall });
    if (p === opts.ghost && opts.ghostBad) { ctx.fillStyle = 'rgba(224,83,47,.45)'; ctx.fillRect(0, 0, it.w * 32, it.h); }
    if (opts.selected === p.id) { ctx.strokeStyle = '#F3B93A'; ctx.lineWidth = 2.5; ctx.strokeRect(-2, -2, it.w * 32 + 4, it.h + 4); }
    ctx.restore();
  }

  // rugs
  for (const p of all.filter((q) => ITEMS[q.item]?.layer === 'rug')) {
    const { w, d } = dims(p);
    ctx.save();
    if (p === opts.ghost) ctx.globalAlpha = 0.6;
    ctx.transform(32, 16, -32, 16, 0, 0); ctx.translate(p.x, p.y);
    (RUG_ART[p.item] || RUG_ART._default)(ctx, w, d, p.rot || 0);
    if (p === opts.ghost && opts.ghostBad) { ctx.fillStyle = 'rgba(224,83,47,.45)'; ctx.fillRect(0, 0, w, d); }
    if (opts.selected === p.id) { ctx.strokeStyle = '#F3B93A'; ctx.lineWidth = 0.08; ctx.strokeRect(0, 0, w, d); }
    ctx.restore();
  }

  // furniture
  const prims = [];
  for (const p of all) {
    const it = ITEMS[p.item];
    if (!it || it.layer === 'wall' || it.layer === 'rug') continue;
    const isGhost = p === opts.ghost;
    const g = makeBuilder(p, elevationOf(p, all), prims, isGhost ? 0.6 : 1, isGhost && opts.ghostBad ? 'bad' : (opts.selected === p.id ? 'sel' : null));
    g.t = t; g.day = day;
    (ART[p.item] || ART._default)(g, it, t, day);
  }
  // the character: a thin box so it sorts correctly against chairs, desks and beds
  if (opts.actor) {
    const a = opts.actor, w = 0.17;
    prims.push({ bb: { x0: a.x - w, x1: a.x + w, y0: a.y - w, y1: a.y + w, z0: a.z, z1: a.z + 58 }, owner: 'actor', alpha: 1, tint: null,
      draw: (ctx) => { const [X, Y] = project(a.x, a.y, a.z); ctx.translate(X, Y); a.draw(ctx); } });
  }
  const sorted = topoSort(prims);
  for (const pr of sorted) {
    ctx.save();
    if (pr.alpha !== 1) ctx.globalAlpha = pr.alpha;
    pr.draw(ctx);
    ctx.restore();
  }
  // selection / invalid tint overlays
  for (const p of all) {
    if (!(opts.selected === p.id || (p === opts.ghost && opts.ghostBad))) continue;
    const it = ITEMS[p.item];
    if (!it || it.layer === 'wall' || it.layer === 'rug') continue;
    const h = itemHull(p, all);
    ctx.save();
    poly(ctx, h, p === opts.ghost ? 'rgba(224,83,47,.35)' : null, null);
    if (opts.selected === p.id) { ctx.setLineDash([5, 4]); ctx.lineWidth = 2; poly(ctx, h, null, '#F3B93A'); }
    ctx.restore();
  }

  // night: dim the room, then let lights glow
  if (day < 1) {
    ctx.save();
    ctx.beginPath();
    const outline = [project(0, R, 0), project(0, R, -slab), project(R, R, -slab), project(R, 0, -slab), project(R, 0, WH + 2), project(-0.25, -0.25, WH + 2), project(-0.25, R, WH + 2)];
    outline.forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.clip();
    ctx.globalCompositeOperation = 'source-atop'; // only darken what's been painted
    ctx.fillStyle = `rgba(16,20,52,${0.5 * (1 - day)})`;
    ctx.fillRect(BOUNDS.x0, BOUNDS.y0, BOUNDS.x1 - BOUNDS.x0, BOUNDS.y1 - BOUNDS.y0);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of all) {
      const it = ITEMS[p.item];
      if (!it?.light) continue;
      let X, Y, r = 70;
      if (it.layer === 'wall') { const pts = wallPoly(p); X = (pts[0][0] + pts[2][0]) / 2; Y = (pts[0][1] + pts[2][1]) / 2; r = 60 * it.w; }
      else { const { w, d } = dims(p); [X, Y] = project(p.x + w / 2, p.y + d / 2, elevationOf(p, all) + it.h * 0.85); r = p.item === 'candle' ? 40 : p.item === 'fireplace' ? 110 : 80; }
      const flick = p.item === 'candle' || p.item === 'fireplace' ? 1 + Math.sin(t / 90 + p.x) * 0.05 : 1;
      const grad = ctx.createRadialGradient(X, Y, 2, X, Y, r * flick);
      const col = p.item === 'aquarium' ? '90,180,255' : p.item === 'neon' ? '255,90,170' : '255,190,90';
      grad.addColorStop(0, `rgba(${col},${0.42 * (1 - day)})`); grad.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = grad; ctx.fillRect(X - r * 1.2, Y - r * 1.2, r * 2.4, r * 2.4);
    }
    ctx.restore();
  }
}

/** Screen-space outline of a placed item (for hit testing and highlights). */
export function itemHull(p, all) {
  const it = ITEMS[p.item];
  if (it.layer === 'wall') return wallPoly(p);
  const { w, d } = dims(p);
  const z0 = elevationOf(p, all), z1 = z0 + Math.max(it.h, 2);
  if (it.layer === 'rug') return [project(p.x, p.y), project(p.x + w, p.y), project(p.x + w, p.y + d), project(p.x, p.y + d)];
  const pts = [];
  for (const x of [p.x, p.x + w]) for (const y of [p.y, p.y + d]) for (const z of [z0, z1]) pts.push(project(x, y, z));
  return hull(pts);
}

/** Which placed item is under screen point (X, Y)? Front-most wins. */
export function pickItem(X, Y, placements) {
  const layerRank = { rug: 0, wall: 1, floor: 2, small: 3 };
  let best = null, bestKey = -Infinity;
  for (const p of placements) {
    const it = ITEMS[p.item];
    if (!inside([X, Y], itemHull(p, placements))) continue;
    const { w, d } = dims(p);
    const key = layerRank[it.layer] * 1000 + (it.layer === 'wall' ? 0 : (p.x + w + p.y + d) * 10 + elevationOf(p, placements) / 10);
    if (key > bestKey) { bestKey = key; best = p; }
  }
  return best;
}

/** Fit the room into a canvas of css size (w, h) and return the transform. */
export function fitRoom(cssW, cssH, pad = 10) {
  const bw = BOUNDS.x1 - BOUNDS.x0, bh = BOUNDS.y1 - BOUNDS.y0;
  const scale = Math.min((cssW - pad * 2) / bw, (cssH - pad * 2) / bh);
  const ox = cssW / 2 - ((BOUNDS.x0 + BOUNDS.x1) / 2) * scale;
  const oy = cssH / 2 - ((BOUNDS.y0 + BOUNDS.y1) / 2) * scale;
  return { scale, ox, oy };
}

/** Render a single item on a little tile for catalog thumbnails. */
export function drawItemThumb(ctx, itemId, size, t = 0) {
  const it = ITEMS[itemId];
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  if (it.layer === 'wall') {
    const s = size / Math.max(it.w * 32 + 16, it.h + 16);
    ctx.translate(size / 2 - (it.w * 32 * s) / 2, size / 2 - (it.h * s) / 2); ctx.scale(s, s);
    (WALL_ART[itemId] || WALL_ART._default)(ctx, it.w * 32, it.h, t, { day: 1, wall: 'R' });
    ctx.restore(); return;
  }
  const w = it.w, d = it.d;
  const span = (w + d) * 32, tall = (w + d) * 16 + it.h + 12;
  if (it.layer === 'small') {
    // Small things are tiny on a full tile; zoom in on the object itself.
    const s = size / (Math.max(it.h, 10) + 34);
    const [cx, cy] = project(0.5, 0.5, it.h / 2);
    ctx.translate(size / 2 - cx * s, size / 2 - cy * s);
    ctx.scale(s, s);
  } else {
    const s = Math.min(size / (span + 12), size / (tall + 12));
    ctx.translate(size / 2 - ((w - d) * 16) * s, size / 2 + (tall / 2 - (w + d) * 16 - 2) * s);
    ctx.scale(s, s);
  }
  const p = { id: 'thumb', item: itemId, x: 0, y: 0, rot: 0 };
  if (it.layer === 'rug') {
    ctx.transform(32, 16, -32, 16, 0, 0);
    (RUG_ART[itemId] || RUG_ART._default)(ctx, w, d, 0);
  } else {
    if (it.layer !== 'small') poly(ctx, [project(0, 0), project(w, 0), project(w, d), project(0, d)], 'rgba(120,120,120,.18)');
    const prims = [];
    const g = makeBuilder(p, 0, prims, 1, null); g.t = t; g.day = 1;
    (ART[itemId] || ART._default)(g, it, t, 1);
    for (const pr of topoSort(prims)) { ctx.save(); pr.draw(ctx); ctx.restore(); }
  }
  ctx.restore();
}
