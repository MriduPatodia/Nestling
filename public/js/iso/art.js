// Furniture art. Each floor item is built from boxes/cylinders/decals in local coordinates as if rot = 0,
// with the item's front facing +v (towards the viewer, lower-left). Wall items draw in a w×h box (y down).
// Rug art draws in tile space.

const WOOD = '#B07A4A', WOOD_D = '#7C5233', WOOD_L = '#D3A06A', METAL = '#3B3F48', WHITE = '#F4F2EC';
// Recolour helper: lighten (f > 0) or darken (f < 0) a hex colour.
const tone = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, q = Math.abs(f); r = Math.round((t - r) * q + r); gg = Math.round((t - gg) * q + gg); b = Math.round((t - b) * q + b); return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1); };
const legs = (g, u0, v0, u1, v1, z1, c = WOOD_D, s = 0.07) => {
  g.box(u0, v0, u0 + s, v0 + s, 0, z1, c); g.box(u1 - s, v0, u1, v0 + s, 0, z1, c);
  g.box(u0, v1 - s, u0 + s, v1, 0, z1, c); g.box(u1 - s, v1 - s, u1, v1, 0, z1, c);
};
const leafy = (g, u, v, z, n, size, cols, seed = 1) => {
  for (let i = 0; i < n; i++) {
    const a = i * 2.39 + seed, rr = 0.06 + (i % 3) * 0.05;
    g.ball(u + Math.cos(a) * rr, v + Math.sin(a) * rr, z + (i % 4) * size * 0.45, size * (0.8 + (i % 2) * 0.3), cols[i % cols.length]);
  }
};

export const ART = {
  _default(g, it) { g.box(0.1, 0.1, it.w - 0.1, it.d - 0.1, 0, it.h || 10, '#AAB'); },

  /* beds */
  bed_single(g) { const B = g.paint || '#5C7FC0';
    g.box(0.03, 0.02, 0.97, 0.12, 0, 42, WOOD_D);
    g.box(0.05, 0.1, 0.95, 1.96, 0, 12, WOOD);
    g.box(0.08, 0.12, 0.92, 1.92, 12, 21, WHITE);
    g.box(0.2, 0.18, 0.8, 0.52, 21, 27, '#FFFFFF');
    g.box(0.06, 0.66, 0.94, 1.94, 13, 23, B, { top: tone(B, 0.12) });
    g.flat(0.06, 0.8, 0.94, 0.9, 23.2, tone(B, -0.15));
  },
  bed_double(g) { const B = g.paint || '#D98B6A';
    g.box(0.03, 0.02, 1.97, 0.12, 0, 46, WOOD_D);
    g.box(0.05, 0.1, 1.95, 1.96, 0, 12, WOOD);
    g.box(0.08, 0.12, 1.92, 1.92, 12, 21, WHITE);
    g.box(0.18, 0.18, 0.9, 0.52, 21, 27, '#FFFFFF'); g.box(1.1, 0.18, 1.82, 0.52, 21, 27, '#FFFFFF');
    g.box(0.06, 0.68, 1.94, 1.94, 13, 23, B, { top: tone(B, 0.12) });
    g.flat(0.06, 0.82, 1.94, 0.92, 23.2, tone(B, -0.12));
  },
  bed_canopy(g) {
    ART.bed_double(g);
    for (const [u, v] of [[0.03, 0.03], [1.9, 0.03], [0.03, 1.9], [1.9, 1.9]]) g.box(u, v, u + 0.07, v + 0.07, 0, 88, WOOD_D);
    g.box(0.03, 0.03, 1.97, 0.1, 82, 88, WOOD_D); g.box(0.03, 1.9, 1.97, 1.97, 82, 88, WOOD_D);
    g.box(0.03, 0.03, 0.1, 1.97, 82, 88, WOOD_D); g.box(1.9, 0.03, 1.97, 1.97, 82, 88, WOOD_D);
    g.decal('v', 0.1, 1, 0.1, 1.9, 40, 82, 'rgba(240,220,235,.55)');
    g.decal('u', 0.1, 1, 0.1, 1.9, 40, 82, 'rgba(240,220,235,.35)');
  },

  /* seating */
  chair_desk(g) { const F = g.paint || '#3F6E8C';
    g.box(0.3, 0.3, 0.7, 0.7, 0, 3, METAL); g.box(0.46, 0.46, 0.54, 0.54, 3, 16, METAL);
    g.box(0.24, 0.26, 0.76, 0.76, 16, 21, F);
    g.box(0.26, 0.2, 0.74, 0.3, 21, 42, F);
  },
  armchair(g) { const F = g.paint || '#C46A4E';
    g.box(0.08, 0.1, 0.92, 0.95, 0, 14, F);
    g.box(0.08, 0.08, 0.92, 0.32, 14, 36, F);
    g.box(0.08, 0.3, 0.24, 0.95, 14, 24, tone(F, -0.1)); g.box(0.76, 0.3, 0.92, 0.95, 14, 24, tone(F, -0.1));
    g.box(0.24, 0.32, 0.76, 0.93, 14, 18, tone(F, 0.12));
  },
  sofa(g) { const F = g.paint || '#557A6A';
    g.box(0.05, 0.1, 1.95, 0.95, 0, 14, F);
    g.box(0.05, 0.08, 1.95, 0.33, 14, 36, F);
    g.box(0.05, 0.3, 0.2, 0.95, 14, 25, tone(F, -0.1)); g.box(1.8, 0.3, 1.95, 0.95, 14, 25, tone(F, -0.1));
    g.box(0.2, 0.33, 0.99, 0.93, 14, 19, tone(F, 0.14)); g.box(1.01, 0.33, 1.8, 0.93, 14, 19, tone(F, 0.14));
    g.box(0.3, 0.32, 0.62, 0.42, 19, 32, '#E8C35C');
  },
  beanbag(g) { const F = g.paint || '#E07A5F'; g.ball(0.5, 0.52, 8, 15, F); g.ball(0.5, 0.42, 16, 10, tone(F, 0.14)); },

  /* tables */
  desk(g) { const W = g.paint || '#D3A06A';
    legs(g, 0.04, 0.06, 0.6, 0.94, 26, tone(W, -0.4));
    g.box(1.3, 0.06, 1.96, 0.94, 0, 26, tone(W, -0.15));
    g.decal('v', 0.94, 1, 1.36, 1.9, 15, 23, tone(W, -0.28)); g.decal('v', 0.94, 1, 1.36, 1.9, 4, 12, tone(W, -0.28));
    g.decal('v', 0.94, 1, 1.58, 1.68, 18, 20, '#E9D29C'); g.decal('v', 0.94, 1, 1.58, 1.68, 7, 9, '#E9D29C');
    g.box(0.02, 0.02, 1.98, 0.98, 26, 30, W);
  },
  table_coffee(g) { const W = g.paint || '#D3A06A'; legs(g, 0.12, 0.12, 0.88, 0.88, 10, tone(W, -0.4)); g.box(0.08, 0.08, 0.92, 0.92, 10, 14, W); },
  table_dining(g) { const W = g.paint || '#B07A4A'; legs(g, 0.12, 0.12, 1.88, 1.88, 26, tone(W, -0.3)); g.box(0.05, 0.05, 1.95, 1.95, 26, 30, W); },
  nightstand(g) { const W = g.paint || '#B07A4A';
    g.box(0.15, 0.15, 0.85, 0.85, 0, 22, W);
    g.decal('v', 0.85, 1, 0.22, 0.78, 12, 19, tone(W, -0.15)); g.decal('v', 0.85, 1, 0.45, 0.55, 15, 16.5, '#E9D29C');
  },

  /* storage */
  bookshelf(g) { const W = g.paint || '#7C5233';
    g.box(0.06, 0.12, 0.94, 0.88, 0, 80, W);
    const cols = ['#C0504D', '#4F81BD', '#9BBB59', '#F1C232', '#8064A2', '#4BACC6', '#E46C0A'];
    let k = 0;
    for (let s = 0; s < 4; s++) {
      const z0 = 4 + s * 19;
      g.decal('v', 0.88, 1, 0.12, 0.88, z0, z0 + 16, '#4A3020');
      let u = 0.14;
      while (u < 0.84) {
        const w = 0.05 + ((k * 7) % 5) * 0.012, h = 10 + ((k * 3) % 5);
        g.decal('v', 0.881, 1, u, Math.min(u + w, 0.86), z0, z0 + h, cols[k % cols.length]);
        u += w + 0.01; k++;
      }
    }
    g.decal('u', 0.94, 1, 0.12, 0.88, 0, 80, tone(W, -0.12));
  },
  wardrobe(g) { const W = g.paint || '#E3D5BE';
    g.box(0.06, 0.08, 0.94, 0.92, 0, 86, W);
    g.decal('v', 0.92, 1, 0.495, 0.505, 4, 82, tone(W, -0.2));
    g.decal('v', 0.92, 1, 0.42, 0.46, 40, 50, '#8A6F48'); g.decal('v', 0.92, 1, 0.54, 0.58, 40, 50, '#8A6F48');
    g.box(0.04, 0.06, 0.96, 0.94, 86, 89, tone(W, -0.1));
  },
  dresser(g) { const W = g.paint || '#7FA3A8';
    g.box(0.05, 0.12, 1.95, 0.9, 0, 30, W);
    for (const z of [3, 12, 21]) { g.decal('v', 0.9, 1, 0.12, 1.88, z, z + 7, tone(W, 0.1)); g.decal('v', 0.9, 1, 0.9, 1.1, z + 3, z + 4.5, '#F2E3B3'); }
  },
  counter(g) { const W = g.paint || '#F1EEE6';
    g.box(0.04, 0.08, 1.96, 0.92, 0, 29, W);
    for (const u of [0.1, 1.02]) g.decal('v', 0.92, 1, u, u + 0.86, 4, 26, tone(W, -0.06));
    g.decal('v', 0.92, 1, 0.84, 0.92, 14, 17, METAL); g.decal('v', 0.92, 1, 1.08, 1.16, 14, 17, METAL);
    g.box(0.02, 0.04, 1.98, 0.96, 29, 32, '#3E4A52');
    g.flat(1.2, 0.25, 1.75, 0.75, 32.2, '#A7B4BC');
    g.box(1.44, 0.18, 1.5, 0.24, 32, 44, '#A7B4BC');
  },
  fridge(g) {
    g.box(0.08, 0.08, 0.92, 0.92, 0, 88, '#E9EEF0');
    g.decal('v', 0.92, 1, 0.08, 0.92, 55, 56.5, '#BCC6CA');
    g.decal('v', 0.92, 1, 0.76, 0.82, 30, 50, '#9AA5AB'); g.decal('v', 0.92, 1, 0.76, 0.82, 62, 80, '#9AA5AB');
    g.decal('v', 0.92, 1, 0.2, 0.34, 66, 74, '#F2C14E');
  },
  stove(g) {
    g.box(0.06, 0.08, 0.94, 0.92, 0, 32, '#D9DDE0', { top: '#2E3338' });
    g.decal('v', 0.92, 1, 0.16, 0.84, 6, 22, '#2E3338'); g.decal('v', 0.92, 1, 0.22, 0.78, 25, 27, '#888');
    for (const [u, v] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) g.flat(u - 0.13, v - 0.13, u + 0.13, v + 0.13, 32.3, '#555', 'circle');
  },
  bathtub(g) {
    g.box(0.05, 0.1, 1.95, 0.92, 0, 24, WHITE);
    g.flat(0.18, 0.2, 1.82, 0.82, 24.2, '#9ED3E8');
    g.flat(0.4, 0.35, 0.7, 0.55, 24.4, 'rgba(255,255,255,.7)', 'circle');
    g.box(1.75, 0.15, 1.82, 0.22, 24, 36, '#B9C2C8');
  },

  /* decor */
  plant_tall(g) { g.cyl(0.5, 0.5, 0.2, 0, 16, '#C8734F'); leafy(g, 0.5, 0.5, 26, 9, 9, ['#3E8E4A', '#4FA35A', '#2F7A3D'], 2); },
  cactus(g) {
    g.cyl(0.5, 0.5, 0.17, 0, 11, '#D88C5A');
    g.cyl(0.5, 0.5, 0.08, 11, 36, '#5E9E54', '#73B566');
    g.cyl(0.38, 0.5, 0.045, 20, 29, '#5E9E54', '#73B566'); g.cyl(0.62, 0.5, 0.045, 16, 25, '#5E9E54', '#73B566');
    g.ball(0.5, 0.5, 37, 2.5, '#F28AB0');
  },
  floor_lamp(g, it, t, day) {
    g.cyl(0.5, 0.5, 0.17, 0, 3, METAL); g.box(0.48, 0.48, 0.52, 0.52, 3, 58, METAL);
    g.cyl(0.5, 0.5, 0.22, 56, 72, day < 1 ? '#FFE3A3' : '#F2E6C9');
  },
  cat(g, it, t) {
    g.cyl(0.5, 0.5, 0.36, 0, 6, '#C9505E', '#E7A3AC');
    g.custom(0.15, 0.15, 0.85, 0.85, 6, 20, (ctx, P, tt) => {
      const [x, y] = P(0.5, 0.52, 6);
      const breathe = Math.sin(tt / 700) * 0.6;
      ctx.fillStyle = '#E39B4C';
      ctx.beginPath(); ctx.ellipse(x, y - 5, 11 + breathe, 6.5 + breathe * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 9, y - 9, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 13, y - 12); ctx.lineTo(x - 12, y - 18); ctx.lineTo(x - 8.5, y - 13); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 8, y - 13); ctx.lineTo(x - 5, y - 17.5); ctx.lineTo(x - 4, y - 11); ctx.fill();
      ctx.strokeStyle = '#E39B4C'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const sway = Math.sin(tt / 400) * 4;
      ctx.beginPath(); ctx.moveTo(x + 9, y - 4); ctx.quadraticCurveTo(x + 17, y - 2, x + 14 + sway * 0.4, y - 10 - Math.abs(sway) * 0.3); ctx.stroke();
      ctx.strokeStyle = '#5A3A22'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 11.5, y - 9); ctx.lineTo(x - 9.5, y - 9); ctx.moveTo(x - 8, y - 9); ctx.lineTo(x - 6, y - 9); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 3, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    });
  },
  guitar(g) {
    g.custom(0.3, 0.3, 0.7, 0.7, 0, 56, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 0);
      ctx.strokeStyle = METAL; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 2); ctx.lineTo(x, y - 14); ctx.lineTo(x + 8, y + 2); ctx.stroke();
      ctx.fillStyle = '#C2763A';
      ctx.beginPath(); ctx.ellipse(x, y - 12, 10, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y - 27, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2B1D14'; ctx.beginPath(); ctx.arc(x, y - 20, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5A3A22'; ctx.fillRect(x - 1.8, y - 55, 3.6, 30); ctx.fillRect(x - 3, y - 58, 6, 6);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.4;
      for (const dx of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 55); ctx.lineTo(x + dx, y - 6); ctx.stroke(); }
    });
  },
  easel(g) {
    g.custom(0.2, 0.2, 0.8, 0.8, 0, 64, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 0);
      ctx.strokeStyle = WOOD_D; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 12, y + 4); ctx.lineTo(x, y - 64); ctx.lineTo(x + 12, y + 4); ctx.moveTo(x, y - 60); ctx.lineTo(x + 2, y + 6); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.fillRect(x - 15, y - 54, 30, 26);
      ctx.fillStyle = '#7FB3D5'; ctx.fillRect(x - 13, y - 52, 26, 11);
      ctx.fillStyle = '#7DB46C'; ctx.beginPath(); ctx.moveTo(x - 13, y - 30); ctx.quadraticCurveTo(x - 2, y - 44, x + 13, y - 34); ctx.lineTo(x + 13, y - 30); ctx.fill();
      ctx.fillStyle = '#F7C548'; ctx.beginPath(); ctx.arc(x + 6, y - 46, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WOOD_D; ctx.fillRect(x - 16, y - 28, 32, 3);
    });
  },
  tv(g, it, t) {
    g.box(0.05, 0.2, 1.95, 0.9, 0, 18, '#4B4F57');
    g.decal('v', 0.9, 1, 0.15, 0.95, 4, 14, '#5C616A'); g.decal('v', 0.9, 1, 1.05, 1.85, 4, 14, '#5C616A');
    g.box(0.95, 0.42, 1.05, 0.52, 18, 22, '#222');
    g.box(0.15, 0.4, 1.85, 0.48, 22, 58, '#1C1D21');
    g.decal('v', 0.48, 1, 0.2, 1.8, 25, 55, (ctx, pts) => {
      const gr = ctx.createLinearGradient(pts[0][0], pts[3][1], pts[1][0], pts[0][1]);
      const hue = (t / 60) % 360;
      gr.addColorStop(0, `hsl(${hue},55%,45%)`); gr.addColorStop(1, `hsl(${(hue + 80) % 360},60%,60%)`);
      return gr;
    });
  },
  aquarium(g, it, t) {
    g.box(0.05, 0.15, 1.95, 0.9, 0, 18, WOOD_D);
    g.box(0.1, 0.2, 1.9, 0.85, 18, 52, '#7CC3E6', { top: '#9AD7F2' });
    g.custom(0.1, 0.84, 1.9, 0.86, 18, 52, (ctx, P, tt) => {
      for (let i = 0; i < 4; i++) {
        const u = 0.3 + ((tt / 4000 + i * 0.27) % 1) * 1.4, z = 26 + (i * 7) % 20 + Math.sin(tt / 500 + i) * 2;
        const [x, y] = P(u, 0.85, z);
        ctx.fillStyle = ['#F28C38', '#F2D338', '#E85A7A', '#5AE8C8'][i];
        ctx.beginPath(); ctx.ellipse(x, y, 4, 2.4, 0.46, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 3, y - 1.5); ctx.lineTo(x - 7, y - 4); ctx.lineTo(x - 6, y + 1); ctx.fill();
      }
      const [bx, by] = P(1.6, 0.85, 18);
      ctx.strokeStyle = '#3E8E4A'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(bx + k * 4, by); ctx.quadraticCurveTo(bx + k * 4 + Math.sin(tt / 600 + k) * 3, by - 10, bx + k * 4, by - 20 - k * 3); ctx.stroke(); }
    });
    g.box(0.08, 0.18, 1.92, 0.87, 52, 55, '#333');
  },
  fireplace(g, it, t) {
    g.box(0.05, 0.1, 1.95, 0.7, 0, 56, '#B9654B');
    g.decal('v', 0.7, 1, 0.45, 1.55, 0, 32, '#2A1B16');
    g.decal('v', 0.701, 1, 0.6, 1.4, 2, 6, '#6B4423');
    g.custom(0.5, 0.69, 1.5, 0.71, 0, 30, (ctx, P, tt) => {
      for (let i = 0; i < 5; i++) {
        const [x, y] = P(0.65 + i * 0.17, 0.7, 6);
        const h = 12 + Math.sin(tt / 120 + i * 1.7) * 4 + (i % 2) * 4;
        ctx.fillStyle = i % 2 ? '#F7B538' : '#F26B38';
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x - 4, y - h * 0.6, x, y - h); ctx.quadraticCurveTo(x + 4, y - h * 0.6, x + 5, y); ctx.fill();
      }
    });
    g.box(0.0, 0.05, 2.0, 0.8, 56, 61, '#7A4A35');
  },
  piano(g) {
    g.box(0.05, 0.1, 1.95, 0.55, 0, 56, '#1E1C22');
    g.box(0.1, 0.55, 1.9, 0.85, 26, 31, '#1E1C22');
    g.flat(0.12, 0.6, 1.88, 0.8, 31.2, '#F7F5EF');
    g.custom(0.12, 0.6, 1.88, 0.8, 31, 32, (ctx, P) => {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.6;
      for (let u = 0.12; u < 1.88; u += 0.073) { const a = P(u, 0.6, 31.3), b = P(u, 0.8, 31.3); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
      ctx.fillStyle = '#111';
      for (let u = 0.17, k = 0; u < 1.85; u += 0.073, k++) {
        if (k % 7 === 2 || k % 7 === 6) continue;
        const a = P(u, 0.6, 31.4), b = P(u + 0.035, 0.6, 31.4), c = P(u + 0.035, 0.7, 31.4), d = P(u, 0.7, 31.4);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.fill();
      }
    });
    legs(g, 0.1, 0.75, 1.9, 0.85, 26, '#1E1C22', 0.08);
    g.decal('v', 0.55, 1, 0.7, 1.3, 40, 52, '#F2E9D8');
  },
  telescope(g) {
    g.custom(0.2, 0.2, 0.8, 0.8, 0, 64, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 0);
      ctx.strokeStyle = '#5A4632'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 12, y + 4); ctx.lineTo(x, y - 30); ctx.lineTo(x + 12, y + 4); ctx.moveTo(x, y - 30); ctx.lineTo(x + 2, y + 8); ctx.stroke();
      ctx.save(); ctx.translate(x, y - 34); ctx.rotate(-0.6);
      ctx.fillStyle = '#2F4A7A'; ctx.fillRect(-14, -5, 36, 10);
      ctx.fillStyle = '#D8B25A'; ctx.fillRect(18, -6, 6, 12); ctx.fillRect(-18, -3.5, 5, 7);
      ctx.restore();
    });
  },

  /* small things (sit on surfaces or the floor) */
  lamp_desk(g, it, t, day) {
    g.cyl(0.5, 0.55, 0.13, 0, 2, METAL);
    g.custom(0.3, 0.3, 0.7, 0.7, 0, 22, (ctx, P) => {
      const [x, y] = P(0.5, 0.55, 2);
      ctx.strokeStyle = METAL; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 12); ctx.lineTo(x + 3, y - 19); ctx.stroke();
      ctx.fillStyle = '#E1564A';
      ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 9, y - 16); ctx.lineTo(x + 4, y - 13); ctx.closePath(); ctx.fill();
      if (day < 1) { ctx.fillStyle = 'rgba(255,230,150,.8)'; ctx.beginPath(); ctx.ellipse(x + 6.5, y - 14.5, 3, 1.4, -0.6, 0, Math.PI * 2); ctx.fill(); }
    });
  },
  laptop(g, it, t) {
    g.box(0.2, 0.3, 0.8, 0.75, 0, 1.5, '#B9BEC6');
    g.box(0.2, 0.26, 0.8, 0.31, 1.5, 13, '#9CA3AD');
    g.decal('v', 0.31, 1, 0.24, 0.76, 2.5, 12, (ctx, pts) => {
      const gr = ctx.createLinearGradient(pts[0][0], pts[2][1], pts[1][0], pts[0][1]);
      gr.addColorStop(0, '#2C3E66'); gr.addColorStop(1, '#4C78B0'); return gr;
    });
    g.decal('v', 0.311, 1, 0.3, 0.6, 9, 10, 'rgba(255,255,255,.7)'); g.decal('v', 0.311, 1, 0.3, 0.52, 7, 8, 'rgba(255,255,255,.5)');
  },
  books(g) {
    g.box(0.22, 0.25, 0.78, 0.75, 0, 4, '#C0504D', { top: '#F2EAD8' });
    g.box(0.26, 0.28, 0.75, 0.72, 4, 8, '#4F81BD', { top: '#F2EAD8' });
    g.box(0.24, 0.3, 0.72, 0.7, 8, 12, '#9BBB59', { top: '#F2EAD8' });
  },
  succulent(g) { g.cyl(0.5, 0.5, 0.14, 0, 8, '#E8E1D5'); leafy(g, 0.5, 0.5, 10, 5, 3.5, ['#7FB685', '#9CCB91'], 4); },
  globe(g) {
    g.cyl(0.5, 0.5, 0.12, 0, 2, WOOD_D); g.box(0.48, 0.48, 0.52, 0.52, 2, 8, WOOD_D);
    g.custom(0.3, 0.3, 0.7, 0.7, 8, 24, (ctx, P, tt) => {
      const [x, y] = P(0.5, 0.5, 15);
      ctx.fillStyle = '#4A90C8'; ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.clip();
      const off = ((tt / 120) % 30) - 15;
      ctx.fillStyle = '#7CC36C';
      for (const [dx, dy, r] of [[-3, -2, 3.2], [4, 2, 2.6], [-1, 4, 2], [12, -1, 3]]) { ctx.beginPath(); ctx.arc(x + dx + off * 0.5, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = '#C9A24A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 9, -2.2, 1.0); ctx.stroke();
    });
  },
  mug(g) { g.cyl(0.5, 0.5, 0.1, 0, 8, '#4FA3A5', '#6B4226'); g.custom(0.55, 0.45, 0.7, 0.55, 2, 7, (ctx, P) => { const [x, y] = P(0.62, 0.5, 5); ctx.strokeStyle = '#4FA3A5'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 2.5, -1.5, 1.5); ctx.stroke(); }); },
  fishbowl(g, it, t) {
    g.custom(0.25, 0.25, 0.75, 0.75, 0, 16, (ctx, P, tt) => {
      const [x, y] = P(0.5, 0.5, 8);
      ctx.fillStyle = 'rgba(140,200,235,.75)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x, y - 7, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
      const fx = x + Math.sin(tt / 700) * 4;
      ctx.fillStyle = '#F28C38'; ctx.beginPath(); ctx.ellipse(fx, y + 1, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      const dir = Math.cos(tt / 700) > 0 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(fx + dir * 2.5, y + 1); ctx.lineTo(fx + dir * 5.5, y - 1.5); ctx.lineTo(fx + dir * 5.5, y + 3.5); ctx.fill();
    });
  },
  candle(g, it, t) {
    g.cyl(0.5, 0.5, 0.08, 0, 9, '#F4EBD7');
    g.custom(0.4, 0.4, 0.6, 0.6, 9, 14, (ctx, P, tt) => {
      const [x, y] = P(0.5, 0.5, 9);
      const f = Math.sin(tt / 80) * 0.6;
      ctx.fillStyle = '#F7B538'; ctx.beginPath(); ctx.moveTo(x - 2, y - 1); ctx.quadraticCurveTo(x + f, y - 9, x + f * 0.5, y - 9); ctx.quadraticCurveTo(x + 2, y - 4, x + 2, y - 1); ctx.fill();
    });
  },
  record(g, it, t) {
    g.box(0.15, 0.2, 0.85, 0.8, 0, 6, WOOD_L);
    g.flat(0.22, 0.27, 0.72, 0.73, 6.2, '#17171A', 'circle');
    g.flat(0.4, 0.42, 0.54, 0.58, 6.4, '#E1564A', 'circle');
    g.box(0.74, 0.26, 0.8, 0.32, 6, 10, METAL);
  },
  trophy(g) {
    g.box(0.36, 0.36, 0.64, 0.64, 0, 4, '#5A3A22');
    g.custom(0.3, 0.3, 0.7, 0.7, 4, 22, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 4);
      ctx.fillStyle = '#E5B53B';
      ctx.fillRect(x - 1.5, y - 7, 3, 7);
      ctx.beginPath(); ctx.moveTo(x - 7, y - 18); ctx.lineTo(x + 7, y - 18); ctx.quadraticCurveTo(x + 6, y - 8, x, y - 7); ctx.quadraticCurveTo(x - 6, y - 8, x - 7, y - 18); ctx.fill();
      ctx.strokeStyle = '#E5B53B'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x - 7, y - 14, 3, 1.5, 4.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 7, y - 14, 3, -1.6, 1.6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 4, y - 17, 2, 6);
    });
  },
  /* ---------- bathroom ---------- */
  toilet(g) {
    g.box(0.3, 0.05, 0.7, 0.3, 14, 36, WHITE);                      // cistern
    g.box(0.34, 0.07, 0.66, 0.28, 36, 38, '#E4E1D8');
    g.cyl(0.5, 0.58, 0.2, 0, 14, '#ECE9E1');                         // pedestal
    g.cyl(0.5, 0.56, 0.26, 14, 20, WHITE, '#DCE6EA');               // bowl + seat
    g.flat(0.33, 0.4, 0.67, 0.72, 20.2, '#BFD3DA', 'circle');
  },
  vanity(g) {
    g.box(0.1, 0.12, 0.9, 0.9, 0, 27, '#7FA3A8');
    g.decal('v', 0.9, 1, 0.16, 0.48, 4, 24, '#8DB2B7'); g.decal('v', 0.9, 1, 0.52, 0.84, 4, 24, '#8DB2B7');
    g.decal('v', 0.9, 1, 0.42, 0.46, 12, 17, '#F2E3B3'); g.decal('v', 0.9, 1, 0.54, 0.58, 12, 17, '#F2E3B3');
    g.box(0.06, 0.08, 0.94, 0.94, 27, 30, WHITE);
    g.flat(0.28, 0.32, 0.72, 0.76, 30.2, '#BFD3DA', 'circle');
    g.box(0.47, 0.14, 0.53, 0.2, 30, 38, '#A7B4BC');
  },
  shower(g) {
    g.box(0.04, 0.04, 0.96, 0.96, 0, 4, WHITE);
    g.box(0.06, 0.06, 0.94, 0.12, 4, 90, '#DCE9EE', { stroke: false });
    g.box(0.06, 0.06, 0.12, 0.94, 4, 90, '#DCE9EE', { stroke: false });
    g.box(0.45, 0.12, 0.5, 0.2, 60, 84, '#A7B4BC');
    g.cyl(0.47, 0.3, 0.1, 82, 85, '#A7B4BC');
    g.decal('v', 0.94, 1, 0.06, 0.94, 4, 90, 'rgba(190,225,240,.35)');
    g.decal('u', 0.94, 1, 0.06, 0.94, 4, 90, 'rgba(190,225,240,.28)');
    g.decal('v', 0.941, 1, 0.12, 0.2, 20, 80, 'rgba(255,255,255,.55)');
  },
  laundry(g) {
    g.cyl(0.5, 0.5, 0.3, 0, 22, '#C9A86A', '#E9DFC8');
    g.box(0.3, 0.32, 0.66, 0.6, 21, 25, '#6B8FD0'); g.box(0.36, 0.38, 0.7, 0.66, 25, 28, '#E39C7B');
  },
  duck(g) {
    g.ball(0.5, 0.52, 4, 5.5, '#F7CF3A'); g.ball(0.44, 0.48, 10, 3.8, '#F7CF3A');
    g.custom(0.3, 0.3, 0.6, 0.6, 8, 12, (ctx, P) => { const [x, y] = P(0.4, 0.5, 10); ctx.fillStyle = '#F08A24'; ctx.beginPath(); ctx.ellipse(x - 3.5, y + 0.5, 2.4, 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x - 1.5, y - 1.5, 1, 1); });
  },
  toiletries(g) {
    g.cyl(0.38, 0.5, 0.09, 0, 9, '#7FC4C9', '#5FA8AE');
    g.box(0.36, 0.48, 0.39, 0.51, 9, 15, '#E85A7A'); g.box(0.4, 0.5, 0.43, 0.53, 9, 14, '#4C78B0');
    g.box(0.56, 0.42, 0.74, 0.6, 0, 11, '#F2C6D8'); g.box(0.63, 0.49, 0.67, 0.53, 11, 15, '#A7B4BC');
  },
  /* ---------- kitchen ---------- */
  sink_counter(g) {
    ART.counter(g);
  },
  island(g) { const W = g.paint || '#5B7A8C';
    g.box(0.06, 0.1, 1.94, 0.9, 0, 29, W);
    for (const u of [0.12, 1.02]) g.decal('v', 0.9, 1, u, u + 0.86, 4, 26, tone(W, 0.1));
    g.box(0.02, 0.04, 1.98, 0.96, 29, 32, '#E8E2D4');
  },
  dining_chair(g) { const W = g.paint || '#B07A4A';
    legs(g, 0.25, 0.25, 0.75, 0.75, 18, tone(W, -0.3), 0.06);
    g.box(0.22, 0.22, 0.78, 0.78, 18, 21, W);
    g.box(0.22, 0.2, 0.78, 0.28, 21, 44, W);
    g.decal('v', 0.28, 1, 0.3, 0.7, 30, 40, tone(W, 0.2));
  },
  bin(g) { g.cyl(0.5, 0.5, 0.2, 0, 22, '#A7B4BC', '#8A969E'); g.box(0.6, 0.62, 0.7, 0.72, 0, 3, '#555'); },
  fruit_bowl(g) {
    g.cyl(0.5, 0.5, 0.24, 0, 5, '#E8E1D5', '#C9BFAE');
    g.ball(0.42, 0.45, 7, 4, '#E1564A'); g.ball(0.58, 0.48, 7, 4, '#7DB46C'); g.ball(0.5, 0.58, 7, 4, '#F2A93B'); g.ball(0.5, 0.48, 11, 3.5, '#F7D54A');
  },
  kettle(g) {
    g.cyl(0.5, 0.5, 0.17, 0, 13, '#E1564A', '#C8473C');
    g.cyl(0.5, 0.5, 0.06, 13, 15, '#333');
    g.custom(0.3, 0.3, 0.75, 0.7, 4, 14, (ctx, P) => { const [x, y] = P(0.68, 0.5, 9); ctx.strokeStyle = '#C8473C'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 3, y - 4); ctx.stroke(); });
  },
  toaster(g) {
    g.box(0.25, 0.32, 0.75, 0.68, 0, 11, '#C9CDD4', { top: '#B5BAC2' });
    g.flat(0.32, 0.42, 0.68, 0.47, 11.2, '#333'); g.flat(0.32, 0.53, 0.68, 0.58, 11.2, '#333');
    g.box(0.36, 0.42, 0.64, 0.47, 11, 14, '#D9A86C'); g.decal('v', 0.68, 1, 0.62, 0.7, 4, 6, '#333');
  },
  microwave(g) {
    g.box(0.12, 0.2, 0.88, 0.8, 0, 15, '#E9EEF0');
    g.decal('v', 0.8, 1, 0.16, 0.66, 2, 13, '#2E3338');
    g.decal('v', 0.801, 1, 0.7, 0.84, 9, 12, '#7CC36C');
  },
  herbs(g) {
    for (const [u, c] of [[0.3, '#4FA35A'], [0.5, '#7DB46C'], [0.7, '#3E8E4A']]) { g.cyl(u, 0.5, 0.08, 0, 6, '#C8734F'); g.ball(u, 0.5, 10, 4, c); }
  },
  /* ---------- study / living ---------- */
  teddy(g) {
    g.ball(0.5, 0.55, 5, 6.5, '#B5733C'); g.ball(0.5, 0.5, 13, 4.8, '#B5733C');
    g.ball(0.45, 0.47, 17, 1.8, '#9A5F2F'); g.ball(0.57, 0.5, 17, 1.8, '#9A5F2F');
    g.custom(0.4, 0.4, 0.6, 0.6, 10, 16, (ctx, P) => { const [x, y] = P(0.5, 0.5, 13); ctx.fillStyle = '#EBC9A0'; ctx.beginPath(); ctx.arc(x - 1, y + 1.5, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x - 3, y - 1.5, 1, 1); ctx.fillRect(x + 1, y - 1.5, 1, 1); });
  },
  alarm(g) {
    g.custom(0.3, 0.3, 0.7, 0.7, 0, 12, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 6);
      ctx.fillStyle = '#E1564A'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 4.5, y - 5.5, 2.4, 0, Math.PI * 2); ctx.arc(x + 4.5, y - 5.5, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FBF8F0'; ctx.beginPath(); ctx.arc(x, y, 4.4, 0, Math.PI * 2); ctx.fill();
      const now = new Date(), a = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2, b = now.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * 3.6, y + Math.sin(b) * 3.6); ctx.stroke();
    });
  },
  filing(g) { const W = g.paint || '#8E99A6';
    g.box(0.15, 0.12, 0.85, 0.88, 0, 30, W);
    for (const z of [3, 12, 21]) { g.decal('v', 0.88, 1, 0.2, 0.8, z, z + 7, tone(W, 0.1)); g.decal('v', 0.881, 1, 0.42, 0.58, z + 3, z + 4.5, '#5C6570'); }
  },
  side_table(g) { const W = g.paint || '#D3A06A'; g.cyl(0.5, 0.5, 0.06, 0, 18, tone(W, -0.4)); g.cyl(0.5, 0.5, 0.18, 0, 2, tone(W, -0.4)); g.cyl(0.5, 0.5, 0.34, 18, 22, W); },
  vase(g) {
    g.cyl(0.5, 0.5, 0.1, 0, 11, '#5B8FB9', '#4A7BA3');
    g.custom(0.3, 0.3, 0.7, 0.7, 11, 24, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 11);
      ctx.strokeStyle = '#3E8E4A'; ctx.lineWidth = 1;
      for (const [dx, h, c] of [[-4, 10, '#F28AB0'], [0, 13, '#F7D54A'], [4, 9, '#E1564A']]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y - h); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx, y - h, 2.6, 0, Math.PI * 2); ctx.fill(); }
    });
  },
  /* ---------- music ---------- */
  drums(g) {
    g.cyl(1, 1.25, 0.32, 4, 22, '#C2413A', '#EDE8E0');             // bass drum (lying cylinder, approximated)
    g.cyl(0.6, 0.85, 0.18, 22, 28, '#C2413A', '#EDE8E0');
    g.cyl(1.4, 0.85, 0.18, 22, 28, '#C2413A', '#EDE8E0');
    g.cyl(0.45, 1.5, 0.2, 18, 24, '#C2413A', '#EDE8E0');
    for (const [u, v] of [[0.3, 0.5], [1.75, 0.55]]) { g.box(u - 0.02, v - 0.02, u + 0.02, v + 0.02, 0, 38, '#888'); g.flat(u - 0.22, v - 0.22, u + 0.22, v + 0.22, 38, '#E5B53B', 'circle'); }
    g.cyl(1, 1.75, 0.15, 0, 16, '#333', '#555');                    // stool
  },
  amp(g) {
    g.box(0.12, 0.18, 0.88, 0.82, 0, 34, '#2B2B30');
    g.decal('v', 0.82, 1, 0.2, 0.8, 4, 26, '#3E3E46');
    g.decal('v', 0.821, 1, 0.3, 0.7, 7, 23, '#1C1C20', 'circle');
    g.box(0.12, 0.18, 0.88, 0.3, 28, 34, '#E5B53B');
  },
  music_stand(g) {
    g.cyl(0.5, 0.5, 0.16, 0, 2, METAL); g.box(0.48, 0.48, 0.52, 0.52, 2, 38, METAL);
    g.box(0.18, 0.46, 0.82, 0.52, 36, 50, '#2F3238');
    g.decal('v', 0.52, 1, 0.24, 0.5, 38, 49, '#F7F3E8'); g.decal('v', 0.52, 1, 0.5, 0.76, 38, 49, '#EFEADC');
  },
  /* ---------- library ---------- */
  bookcase(g) { const W = g.paint || '#7C5233';
    g.box(0.04, 0.1, 1.96, 0.85, 0, 96, W);
    const cols = ['#C0504D', '#4F81BD', '#9BBB59', '#F1C232', '#8064A2', '#4BACC6', '#E46C0A', '#7A5230'];
    let k = 0;
    for (let sh = 0; sh < 5; sh++) {
      const z0 = 4 + sh * 18.4;
      g.decal('v', 0.85, 1, 0.1, 1.9, z0, z0 + 15, '#3E2818');
      for (let u = 0.12; u < 1.86;) { const w = 0.045 + ((k * 7) % 5) * 0.012; g.decal('v', 0.851, 1, u, Math.min(u + w, 1.88), z0, z0 + 10 + ((k * 3) % 5), cols[k % cols.length]); u += w + 0.008; k++; }
    }
    g.box(1.55, 0.86, 1.62, 0.95, 0, 90, '#5A3A22');               // ladder rails
    g.box(1.82, 0.86, 1.89, 0.95, 0, 90, '#5A3A22');
    for (let z = 12; z < 90; z += 14) g.box(1.55, 0.88, 1.89, 0.93, z, z + 2.5, '#6A4630');
  },
  /* ---------- greenhouse ---------- */
  potting_bench(g) { const W = g.paint || '#B08A5E';
    legs(g, 0.06, 0.1, 1.94, 0.9, 26, tone(W, -0.22));
    g.box(0.08, 0.12, 1.92, 0.88, 6, 9, tone(W, -0.1));
    g.box(0.04, 0.06, 1.96, 0.94, 26, 30, W);
    g.box(0.2, 0.2, 0.5, 0.45, 9, 15, '#C8734F'); g.box(0.55, 0.2, 0.8, 0.45, 9, 14, '#C8734F');
  },
  tomato(g) {
    g.cyl(0.5, 0.5, 0.2, 0, 12, '#C8734F');
    g.box(0.49, 0.49, 0.51, 0.51, 12, 44, '#7A5130');
    leafy(g, 0.5, 0.5, 22, 7, 7, ['#3E8E4A', '#4FA35A'], 5);
    for (const [u, v, z] of [[0.38, 0.55, 26], [0.6, 0.45, 32], [0.5, 0.6, 38], [0.62, 0.6, 22]]) g.ball(u, v, z, 3, '#E1342A');
  },
  sunflower(g) {
    g.cyl(0.5, 0.5, 0.2, 0, 12, '#5B8FB9');
    g.custom(0.3, 0.3, 0.7, 0.7, 12, 58, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 12);
      for (const [dx, h] of [[-5, 40], [3, 46], [7, 34]]) {
        ctx.strokeStyle = '#4FA35A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y - h); ctx.stroke();
        ctx.fillStyle = '#F7C548';
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + dx + Math.cos(a) * 4.5, y - h + Math.sin(a) * 4.5, 2.6, 1.3, a, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#6B4226'; ctx.beginPath(); ctx.arc(x + dx, y - h, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#3E8E4A'; ctx.beginPath(); ctx.ellipse(x - 4, y - 16, 5, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    });
  },
  garden_bench(g) {
    for (const u of [0.15, 1.75]) g.box(u, 0.25, u + 0.1, 0.9, 0, 28, '#3B3F48');
    for (const v of [0.35, 0.5, 0.65, 0.8]) g.box(0.08, v, 1.92, v + 0.12, 14, 17, '#B08A5E');
    for (const z of [20, 25]) g.box(0.08, 0.2, 1.92, 0.27, z, z + 4, '#B08A5E');
  },
  orchid(g) {
    g.cyl(0.5, 0.5, 0.11, 0, 7, '#F4F2EC');
    g.custom(0.3, 0.3, 0.7, 0.7, 7, 22, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 7);
      ctx.fillStyle = '#3E8E4A'; ctx.beginPath(); ctx.ellipse(x - 3, y - 1, 4, 1.6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 3, y - 1, 4, 1.6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4A6B3A'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1, y - 14, x + 6, y - 15); ctx.stroke();
      ctx.fillStyle = '#E18BD0';
      for (const [dx, dy] of [[1, -12], [4, -15], [7, -13]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.3, 0, Math.PI * 2); ctx.fill(); }
    });
  },
  watering_can(g) {
    g.cyl(0.48, 0.5, 0.14, 0, 10, '#4FA3A5', '#3E8A8C');
    g.custom(0.3, 0.3, 0.8, 0.7, 2, 12, (ctx, P) => { const [x, y] = P(0.6, 0.5, 4); ctx.strokeStyle = '#4FA3A5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 7); ctx.stroke(); const [hx, hy] = P(0.48, 0.5, 10); ctx.beginPath(); ctx.arc(hx, hy - 2, 3.5, Math.PI, 0); ctx.stroke(); });
  },
  seedlings(g) {
    g.box(0.15, 0.25, 0.85, 0.75, 0, 4, '#3B3F48', { top: '#5A3A22' });
    for (let i = 0; i < 6; i++) g.ball(0.25 + (i % 3) * 0.25, 0.37 + Math.floor(i / 3) * 0.26, 6, 2.2, '#7DB46C');
  },
  /* ---------- observatory ---------- */
  moon_lamp(g, it, t, day) {
    g.cyl(0.5, 0.5, 0.1, 0, 2, WOOD_D);
    g.custom(0.3, 0.3, 0.7, 0.7, 2, 16, (ctx, P) => {
      const [x, y] = P(0.5, 0.5, 9);
      ctx.fillStyle = day < 1 ? '#FFF3C4' : '#EDE6D2'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; for (const [dx, dy, r] of [[-2, -2, 1.6], [2, 1, 1.2], [-1, 3, 1]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
    });
  },
  projector(g, it, t, day) {
    g.cyl(0.5, 0.5, 0.15, 0, 4, '#2F3A5A');
    g.custom(0.3, 0.3, 0.7, 0.7, 4, 12, (ctx, P, tt) => {
      const [x, y] = P(0.5, 0.5, 4);
      ctx.fillStyle = '#3F4E78'; ctx.beginPath(); ctx.arc(x, y - 4, 5.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#F7E7A8';
      for (let i = 0; i < 6; i++) { const a = i + tt / 3000; ctx.globalAlpha = day < 1 ? 1 : 0.6; ctx.fillRect(x + Math.cos(a) * 3, y - 5 + Math.sin(a) * 1.5, 1, 1); }
      ctx.globalAlpha = 1;
    });
  },
};

/* ---------------- rugs (tile space) ---------------- */
export const RUG_ART = {
  bath_mat(ctx, w, d, rot, paint) { const C = paint || '#9ED3E8';
    ctx.fillStyle = C; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0.12, 0.12, w - 0.24, d - 0.24, 0.2) : ctx.rect(0.12, 0.12, w - 0.24, d - 0.24); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.05;
    for (let k = 0.3; k < Math.max(w, d) - 0.2; k += 0.25) { ctx.beginPath(); if (d > w) { ctx.moveTo(0.2, k); ctx.lineTo(w - 0.2, k); } else { ctx.moveTo(k, 0.2); ctx.lineTo(k, d - 0.2); } ctx.stroke(); }
  },
  _default(ctx, w, d) { ctx.fillStyle = '#C9B8A0'; ctx.fillRect(0.1, 0.1, w - 0.2, d - 0.2); },
  rug_round(ctx, w, d, rot, paint) { const C = paint || '#D9805F';
    ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(w / 2, d / 2, w / 2 - 0.08, d / 2 - 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#F3D9B1'; ctx.lineWidth = 0.08;
    for (const k of [0.75, 0.5, 0.25]) { ctx.beginPath(); ctx.ellipse(w / 2, d / 2, (w / 2 - 0.1) * k, (d / 2 - 0.1) * k, 0, 0, Math.PI * 2); ctx.stroke(); }
  },
  rug_stripe(ctx, w, d, rot, paint) { const C = paint || '#3E6E8E';
    ctx.fillStyle = '#EDE3CF'; ctx.fillRect(0.1, 0.1, w - 0.2, d - 0.2);
    const cols = [C, '#E0A458', C, tone(C, -0.25)];
    const along = rot % 2 ? w : d;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      const s = 0.35 + i * (along - 0.7) / 4;
      if (rot % 2) ctx.fillRect(s, 0.1, 0.18, d - 0.2); else ctx.fillRect(0.1, s, w - 0.2, 0.18);
    }
    ctx.fillStyle = '#EDE3CF';
    for (let k = 0.15; k < (rot % 2 ? d : w) - 0.1; k += 0.15) { if (rot % 2) { ctx.fillRect(0, k, 0.1, 0.05); ctx.fillRect(w - 0.1, k, 0.1, 0.05); } else { ctx.fillRect(k, 0, 0.05, 0.1); ctx.fillRect(k, d - 0.1, 0.05, 0.1); } }
  },
  rug_check(ctx, w, d, rot, paint) { const C = paint || '#2F4858';
    for (let x = 0; x < w * 2; x++) for (let y = 0; y < d * 2; y++) { ctx.fillStyle = (x + y) % 2 ? C : '#F6E7C1'; ctx.fillRect(0.1 + x * (w - 0.2) / (w * 2), 0.1 + y * (d - 0.2) / (d * 2), (w - 0.2) / (w * 2), (d - 0.2) / (d * 2)); }
  },
  rug_fluffy(ctx, w, d, rot, paint) { const C = paint || '#F1E9F4';
    ctx.fillStyle = C;
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * (w / 2 - 0.25), d / 2 + Math.sin(a) * (d / 2 - 0.25), 0.16, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(w / 2, d / 2, w / 2 - 0.2, d / 2 - 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tone(C, -0.08); ctx.beginPath(); ctx.ellipse(w / 2, d / 2, w / 4, d / 4, 0, 0, Math.PI * 2); ctx.fill();
  },
};

/* ---------------- wall items (w×h box, y down) ---------------- */
function sky(ctx, x, y, w, h, day, t) {
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  if (day > 0.5) { gr.addColorStop(0, '#7EC4EC'); gr.addColorStop(1, '#CBE9F7'); }
  else if (day > 0) { gr.addColorStop(0, '#5B5FA8'); gr.addColorStop(1, '#F2A65A'); }
  else { gr.addColorStop(0, '#0E1638'); gr.addColorStop(1, '#283A72'); }
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  if (day > 0.5) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    const cx = x + ((t / 400) % (w + 30)) - 15;
    ctx.beginPath(); ctx.arc(cx, y + h * 0.35, 4, 0, Math.PI * 2); ctx.arc(cx + 5, y + h * 0.33, 5, 0, Math.PI * 2); ctx.arc(cx + 10, y + h * 0.36, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (day === 0) {
    ctx.fillStyle = '#FFF6D5'; ctx.beginPath(); ctx.arc(x + w * 0.72, y + h * 0.28, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1B2650'; ctx.beginPath(); ctx.arc(x + w * 0.72 + 2, y + h * 0.26, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF'; for (let i = 0; i < 6; i++) ctx.fillRect(x + ((i * 37) % w), y + ((i * 23) % (h * 0.7)), 1, 1);
  }
}

export const WALL_ART = {
  towel_rack(ctx, w, h) {
    ctx.fillStyle = '#A7B4BC'; ctx.fillRect(2, 2, w - 4, 2.5); ctx.fillRect(3, 0, 2, 6); ctx.fillRect(w - 5, 0, 2, 6);
    ctx.fillStyle = '#E39C7B'; ctx.fillRect(5, 3, 11, h - 5); ctx.fillStyle = '#6B8FD0'; ctx.fillRect(17, 3, 11, h - 9);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(5, h - 7, 11, 2); ctx.fillRect(17, h - 11, 11, 2);
  },
  mirror_cab(ctx, w, h) {
    ctx.fillStyle = '#E9EEF0'; ctx.fillRect(0, 0, w, h);
    const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#E4EEF2'); gr.addColorStop(1, '#A9BEC8');
    ctx.fillStyle = gr; ctx.fillRect(3, 3, w - 6, h - 6);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(14, 5); ctx.moveTo(8, 17); ctx.lineTo(19, 7); ctx.stroke();
  },
  pan_rack(ctx, w, h) {
    ctx.fillStyle = '#3B3F48'; ctx.fillRect(2, 1, w - 4, 2.5);
    for (const [x, r, c] of [[12, 6, '#3B3F48'], [30, 7.5, '#B8763C'], [49, 5.5, '#3B3F48']]) {
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x, 10); ctx.stroke();
      ctx.fillStyle = c; ctx.fillRect(x - 1, 8, 2, 8); ctx.beginPath(); ctx.arc(x, 16 + r, r, 0, Math.PI * 2); ctx.fill();
    }
  },
  jar_shelf(ctx, w, h) {
    ctx.fillStyle = '#8A5D33'; ctx.fillRect(0, h - 4, w, 4);
    const jars = [[4, '#F2C14E'], [16, '#E1564A'], [28, '#7DB46C'], [40, '#C9955F'], [52, '#F4F2EC']];
    for (const [x, c] of jars) { ctx.fillStyle = 'rgba(220,235,240,.8)'; ctx.fillRect(x, 4, 9, h - 8); ctx.fillStyle = c; ctx.fillRect(x + 1, 9, 7, h - 13); ctx.fillStyle = '#5A3A22'; ctx.fillRect(x, 3, 9, 2.5); }
  },
  map_poster(ctx, w, h) {
    ctx.fillStyle = '#5A3A22'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9FCBE0'; ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#E8D7A6';
    for (const [x, y, rx, ry] of [[14, 12, 7, 5], [18, 24, 4, 7], [33, 11, 5, 4], [36, 22, 5, 7], [50, 13, 8, 5], [53, 28, 4, 3]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#E1564A'; ctx.beginPath(); ctx.arc(50, 18, 1.5, 0, Math.PI * 2); ctx.fill();
  },
  certificate(ctx, w, h) {
    ctx.fillStyle = '#C9A24A'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FBF6E7'; ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#5A3A22'; ctx.fillRect(7, 6, w - 14, 1.6); ctx.fillRect(9, 10, w - 18, 1); ctx.fillRect(9, 13, w - 18, 1);
    ctx.fillStyle = '#C2413A'; ctx.beginPath(); ctx.arc(w - 9, h - 7, 3.5, 0, Math.PI * 2); ctx.fill();
  },
  vinyl_wall(ctx, w, h) {
    for (const [x, c] of [[2, '#E1564A'], [22, '#4F81BD'], [42, '#F2C14E']]) {
      ctx.fillStyle = '#1B1B1F'; ctx.fillRect(x, 2, 20, h - 4);
      ctx.fillStyle = '#2E2E34'; ctx.beginPath(); ctx.arc(x + 10, h / 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 10, h / 2, 3, 0, Math.PI * 2); ctx.fill();
    }
  },
  hanging_plant(ctx, w, h) {
    ctx.strokeStyle = '#8A6A45'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 - 8, h - 14); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 + 8, h - 14); ctx.stroke();
    ctx.fillStyle = '#C8734F'; ctx.beginPath(); ctx.moveTo(w / 2 - 9, h - 15); ctx.lineTo(w / 2 + 9, h - 15); ctx.lineTo(w / 2 + 6, h - 6); ctx.lineTo(w / 2 - 6, h - 6); ctx.fill();
    ctx.strokeStyle = '#3E8E4A'; ctx.lineWidth = 1.6;
    for (const dx of [-7, -2, 3, 8]) { ctx.beginPath(); ctx.moveTo(w / 2 + dx * 0.6, h - 14); ctx.quadraticCurveTo(w / 2 + dx * 1.5, h - 6, w / 2 + dx, h + 4 + Math.abs(dx)); ctx.stroke(); }
  },
  star_map(ctx, w, h) {
    ctx.fillStyle = '#C9A24A'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16204A'; ctx.fillRect(2, 2, w - 4, h - 4);
    const stars = [[10, 10], [18, 15], [26, 9], [34, 14], [44, 24], [50, 18], [56, 28], [14, 30], [22, 28]];
    ctx.strokeStyle = 'rgba(247,231,168,.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); stars.slice(0, 4).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.moveTo(44, 24); ctx.lineTo(50, 18); ctx.lineTo(56, 28); ctx.stroke();
    ctx.fillStyle = '#F7E7A8'; for (const [x, y] of stars) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2); ctx.stroke();
  },
  _default(ctx, w, h) { ctx.fillStyle = '#999'; ctx.fillRect(0, 0, w, h); },
  window(ctx, w, h, t, { day }) {
    ctx.fillStyle = '#F6F3EC'; ctx.fillRect(0, 0, w, h);
    sky(ctx, 3, 3, w - 6, h - 9, day, t);
    ctx.fillStyle = '#F6F3EC'; ctx.fillRect(w / 2 - 1, 3, 2, h - 9); ctx.fillRect(3, (h - 6) / 2, w - 6, 2);
    ctx.fillStyle = '#DDD6C8'; ctx.fillRect(-2, h - 5, w + 4, 5);
  },
  window_big(ctx, w, h, t, { day }) {
    ctx.fillStyle = '#F6F3EC'; ctx.fillRect(0, 0, w, h);
    sky(ctx, 4, 4, w - 8, h - 10, day, t);
    ctx.fillStyle = '#F6F3EC'; for (const k of [1, 2, 3]) ctx.fillRect(k * w / 4 - 1, 4, 2, h - 10);
    ctx.fillStyle = '#DDD6C8'; ctx.fillRect(-3, h - 6, w + 6, 6);
    ctx.fillStyle = '#C96F6F';
    ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(10, -4); ctx.quadraticCurveTo(4, h / 2, 8, h); ctx.lineTo(-4, h); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w + 4, -4); ctx.lineTo(w - 10, -4); ctx.quadraticCurveTo(w - 4, h / 2, w - 8, h); ctx.lineTo(w + 4, h); ctx.fill();
    ctx.fillStyle = '#8A5D33'; ctx.fillRect(-6, -6, w + 12, 3);
  },
  poster_wave(ctx, w, h) {
    ctx.fillStyle = '#F3EAD7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2D5D8C';
    ctx.beginPath(); ctx.moveTo(2, h - 2); ctx.quadraticCurveTo(6, h * 0.35, w * 0.55, h * 0.3); ctx.quadraticCurveTo(w * 0.8, h * 0.3, w * 0.7, h * 0.5);
    ctx.quadraticCurveTo(w * 0.62, h * 0.4, w * 0.5, h * 0.55); ctx.lineTo(w - 2, h - 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(w * 0.6 + i * 2.5, h * 0.33 + i * 1.5, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#D9534F'; ctx.beginPath(); ctx.arc(w * 0.25, h * 0.2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  },
  poster_planet(ctx, w, h) {
    ctx.fillStyle = '#1D2340'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFF'; for (let i = 0; i < 12; i++) ctx.fillRect((i * 13) % w, (i * 7) % h, 0.8, 0.8);
    ctx.fillStyle = '#E8A35A'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#F2D6A2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 14, 4, -0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#EDEDED'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  },
  painting(ctx, w, h) {
    ctx.fillStyle = '#C9A24A'; ctx.fillRect(0, 0, w, h);
    const gr = ctx.createLinearGradient(0, 3, 0, h - 3); gr.addColorStop(0, '#F4C59A'); gr.addColorStop(1, '#F9E3C7');
    ctx.fillStyle = gr; ctx.fillRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#F6E27A'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.38, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7A9E7E'; ctx.beginPath(); ctx.moveTo(3, h - 3); ctx.lineTo(3, h * 0.6); ctx.quadraticCurveTo(w * 0.3, h * 0.3, w * 0.55, h * 0.65); ctx.lineTo(w * 0.55, h - 3); ctx.fill();
    ctx.fillStyle = '#4E7A63'; ctx.beginPath(); ctx.moveTo(w * 0.3, h - 3); ctx.quadraticCurveTo(w * 0.6, h * 0.45, w - 3, h * 0.7); ctx.lineTo(w - 3, h - 3); ctx.fill();
  },
  clock(ctx, w, h) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 1;
    ctx.fillStyle = '#3B3F48'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FBF8F0'; ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3B3F48';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillRect(cx + Math.cos(a) * (r - 4) - 0.5, cy + Math.sin(a) * (r - 4) - 0.5, 1, 1); }
    const now = new Date(), hr = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * Math.PI * 2 - Math.PI / 2, mn = (now.getMinutes() + now.getSeconds() / 60) / 60 * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#3B3F48'; ctx.lineCap = 'round';
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(hr) * (r - 7), cy + Math.sin(hr) * (r - 7)); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mn) * (r - 4), cy + Math.sin(mn) * (r - 4)); ctx.stroke();
    const sc = now.getSeconds() / 60 * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#E1564A'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sc) * (r - 3), cy + Math.sin(sc) * (r - 3)); ctx.stroke();
  },
  shelf_plants(ctx, w, h) {
    ctx.fillStyle = '#8A5D33'; ctx.fillRect(0, h - 4, w, 4);
    const pots = [[8, '#C8734F', '#4FA35A'], [26, '#E8E1D5', '#7FB685'], [44, '#4F81BD', '#3E8E4A']];
    for (const [x, pot, leaf] of pots) {
      ctx.fillStyle = leaf;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 2) * 2.5, h - 14 - (i % 2) * 3, 2.5, 6, (i - 2) * 0.35, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = pot; ctx.fillRect(x - 6, h - 12, 12, 8);
    }
    ctx.strokeStyle = '#3E8E4A'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(44, h - 6); ctx.quadraticCurveTo(50, h + 4, 46, h + 12); ctx.stroke();
  },
  lights(ctx, w, h, t) {
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(w / 4, h, w / 2, 2); ctx.quadraticCurveTo(w * 3 / 4, h, w, 2); ctx.stroke();
    const cols = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2'];
    for (let i = 0; i < 10; i++) {
      const s = (i + 0.5) / 10, seg = s < 0.5 ? s * 2 : (s - 0.5) * 2, base = s < 0.5 ? 0 : w / 2;
      const x = base + seg * w / 2, y = 2 + (1 - Math.pow(2 * seg - 1, 2)) * (h - 2) * 0.5;
      const on = 0.6 + 0.4 * Math.sin(t / 300 + i * 1.3);
      ctx.fillStyle = cols[i % 4]; ctx.globalAlpha = on; ctx.beginPath(); ctx.arc(x, y + 2, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  },
  mirror(ctx, w, h) {
    ctx.fillStyle = '#C9A24A'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
    const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#E4EEF2'); gr.addColorStop(1, '#AFC3CC');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 3.5, h / 2 - 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.3); ctx.lineTo(w * 0.45, h * 0.18); ctx.stroke();
  },
  corkboard(ctx, w, h) {
    ctx.fillStyle = '#8A5D33'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#C9955F'; ctx.fillRect(2, 2, w - 4, h - 4);
    const notes = [[6, 5, '#FFF2A8'], [24, 8, '#BDE0FE'], [42, 4, '#FFC8DD'], [14, 19, '#CAFFBF'], [36, 18, '#FFF2A8']];
    for (const [x, y, c] of notes) { ctx.fillStyle = c; ctx.fillRect(x, y, 12, 10); ctx.fillStyle = '#E1564A'; ctx.beginPath(); ctx.arc(x + 6, y + 1.5, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 2, y + 5, 8, 0.7); ctx.fillRect(x + 2, y + 7, 6, 0.7); }
  },
  whiteboard(ctx, w, h) {
    ctx.fillStyle = '#9AA3AD'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FBFCFD'; ctx.fillRect(2, 2, w - 4, h - 6);
    ctx.fillStyle = '#9AA3AD'; ctx.fillRect(6, h - 4, w - 12, 3);
    ctx.fillStyle = '#2F5DA8'; ctx.font = '600 8px sans-serif'; ctx.fillText('a² + b² = c²', 7, 13);
    ctx.strokeStyle = '#D33F49'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, 20); ctx.lineTo(20, 28); ctx.lineTo(34, 18); ctx.lineTo(50, 26); ctx.stroke();
    ctx.strokeStyle = '#2A9D5C'; ctx.beginPath(); ctx.arc(52, 14, 4, 0, Math.PI * 2); ctx.stroke();
  },
  neon(ctx, w, h, t) {
    ctx.fillStyle = 'rgba(30,20,40,.85)'; ctx.fillRect(0, 0, w, h);
    ctx.font = '700 15px "Bricolage Grotesque", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const flick = Math.sin(t / 50) > 0.97 ? 0.5 : 1;
    ctx.shadowColor = '#FF5AAA'; ctx.shadowBlur = 8 * flick; ctx.fillStyle = `rgba(255,140,200,${flick})`;
    ctx.fillText('study', w / 2, h / 2 + 1);
    ctx.shadowBlur = 0;
  },
};
