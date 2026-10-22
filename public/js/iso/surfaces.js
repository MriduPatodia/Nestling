// Wallpaper and floor patterns. Walls are painted in wall space (x along the wall, y = height, pointing up);
// floors in tile space (0..R on both axes).
import { shade } from './render.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function paintWall(ctx, wp, W, H, wall) {
  const light = wall === 'R' ? 0 : -0.07; // the left wall sits a touch more in shadow
  const base = shade(wp.base, light), alt = wp.alt ? shade(wp.alt, light) : base;
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  const r = rng(wall === 'R' ? 7 : 13);
  switch (wp.pattern) {
    case 'stripes':
      ctx.fillStyle = alt;
      for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 7, H);
      break;
    case 'dots':
      ctx.fillStyle = alt;
      for (let y = 8, row = 0; y < H; y += 14, row++) for (let x = row % 2 ? 6 : 13; x < W; x += 14) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'tiles':
      ctx.strokeStyle = alt; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      break;
    case 'brick':
      for (let y = 0, row = 0; y < H; y += 9, row++) {
        for (let x = row % 2 ? -10 : 0; x < W; x += 20) {
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.14);
          ctx.fillRect(x + 1, y + 1, 18, 7);
        }
      }
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = alt; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      break;
    case 'panel':
      for (let x = 0; x < W; x += 14) { ctx.fillStyle = shade(base, (r() - 0.5) * 0.12); ctx.fillRect(x, 0, 13, H); }
      ctx.fillStyle = alt; ctx.fillRect(0, H * 0.42, W, 3); ctx.fillRect(0, H - 6, W, 6);
      break;
    case 'leaves':
      for (let i = 0; i < W * H / 260; i++) {
        const x = r() * W, y = r() * H, a = r() * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = r() > 0.5 ? alt : shade(alt, 0.25);
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      break;
    case 'glass': {
      const g = ctx.createLinearGradient(0, H, W, 0);
      g.addColorStop(0, '#9FD3DA'); g.addColorStop(1, '#E3F4F2');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let x = 10; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + 14, 10); ctx.lineTo(x + 40, H - 10); ctx.lineTo(x + 26, H - 10); ctx.fill(); }
      ctx.fillStyle = '#5B6B6A';
      for (let x = 0; x <= W; x += 48) ctx.fillRect(x - 1.5, 0, 3, H);
      ctx.fillRect(0, H * 0.5, W, 2.5);
      break;
    }
    case 'stars':
      for (let i = 0; i < W * H / 120; i++) {
        const x = r() * W, y = r() * H, s = r();
        ctx.fillStyle = s > 0.92 ? alt : `rgba(255,255,255,${0.25 + s * 0.5})`;
        ctx.fillRect(x, y, s > 0.92 ? 2 : 1.2, s > 0.92 ? 2 : 1.2);
      }
      break;
    default: {
      // plain paint: a soft vertical gradient so it doesn't look flat
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, shade(base, -0.04)); g.addColorStop(1, shade(base, 0.05));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
}

export function paintFloor(ctx, fl, R) {
  ctx.fillStyle = fl.base; ctx.fillRect(0, 0, R, R);
  const r = rng(42);
  const lw = 1 / 32;
  switch (fl.pattern) {
    case 'planks':
      for (let y = 0; y < R; y += 0.5) {
        let x = -r() * 1.5;
        while (x < R) {
          const len = 1.4 + r() * 1.6;
          ctx.fillStyle = shade(fl.base, (r() - 0.5) * 0.12);
          ctx.fillRect(x, y, len, 0.5);
          ctx.fillStyle = fl.alt; ctx.fillRect(x, y, lw * 1.5, 0.5);
          x += len;
        }
        ctx.fillStyle = fl.alt; ctx.fillRect(0, y, R, lw * 1.2);
      }
      break;
    case 'checker':
      for (let x = 0; x < R * 2; x++) for (let y = 0; y < R * 2; y++) if ((x + y) % 2) { ctx.fillStyle = fl.alt; ctx.fillRect(x / 2, y / 2, 0.5, 0.5); }
      break;
    case 'terrazzo':
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = ['#C77E62', '#7FA38C', '#3D4A5C', '#D8B25A'][Math.floor(r() * 4)];
        ctx.beginPath(); ctx.ellipse(r() * R, r() * R, 0.03 + r() * 0.05, 0.02 + r() * 0.04, r() * 3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'tatami':
      for (let x = 0; x < R; x += 2) for (let y = 0; y < R; y += 1) {
        const ox = y % 2 ? 1 : 0;
        ctx.fillStyle = shade(fl.base, (r() - 0.5) * 0.08); ctx.fillRect(x - ox, y, 2, 1);
        ctx.strokeStyle = fl.alt; ctx.lineWidth = 0.06; ctx.strokeRect(x - ox + 0.03, y + 0.03, 1.94, 0.94);
      }
      break;
    case 'marble':
      ctx.strokeStyle = fl.alt; ctx.lineWidth = 0.025;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath(); let x = r() * R, y = r() * R; ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 1.2; y += (r() - 0.5) * 0.9; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = lw;
      for (let k = 0; k <= R; k += 1.5) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, R); ctx.moveTo(0, k); ctx.lineTo(R, k); ctx.stroke(); }
      break;
    default:
      for (let i = 0; i < 500; i++) { ctx.fillStyle = r() > 0.5 ? fl.alt : shade(fl.base, 0.05); ctx.fillRect(r() * R, r() * R, 0.04, 0.04); }
  }
  // soft light falling from the front
  const g = ctx.createLinearGradient(0, 0, R, R);
  g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(255,255,255,.06)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, R, R);
}
