// The player's character, drawn with canvas shapes.
// drawCharacter(ctx, look, opts) draws with the anchor at (0,0): the feet when standing, the seat when sitting.
// Facing: 'fl' / 'fr' = towards the viewer (left / right), 'bl' / 'br' = away from the viewer.
import { DEFAULT_LOOK } from '/shared/avatar.js';

const SHOE = '#34373F';
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
};
const rr = (ctx, x, y, w, h, r, fill) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fillStyle = fill; ctx.fill(); };
const circ = (ctx, x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
const limb = (ctx, x1, y1, x2, y2, w, color) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

/* ---------------- hair ---------------- */
const LONG = new Set(['straight', 'wavy', 'ponytail', 'buns']);
function hairBack(ctx, L, hx, hy, back, t) {
  const c = L.hairColor;
  if (L.hair === 'straight') rr(ctx, hx - 9.5, hy - 6, 20, 22, 6, c);
  if (L.hair === 'wavy') { rr(ctx, hx - 9.5, hy - 6, 20, 19, 6, c); for (let i = 0; i < 5; i++) circ(ctx, hx - 8 + i * 4.2, hy + 13 + (i % 2) * 1.2, 2.8, c); }
  if (L.hair === 'ponytail' && back) {
    const sw = Math.sin(t / 500) * 1.2;
    ctx.beginPath(); ctx.moveTo(hx - 3, hy - 2); ctx.quadraticCurveTo(hx + sw - 6, hy + 10, hx + sw, hy + 16); ctx.quadraticCurveTo(hx + sw + 6, hy + 10, hx + 3, hy - 2); ctx.fillStyle = c; ctx.fill();
  }
}
function hairFront(ctx, L, hx, hy, r, back, t) {
  const c = L.hairColor, hl = shade(c, 0.18);
  if (back) {
    circ(ctx, hx, hy - 0.5, r + 1.3, c);
    if (L.hair === 'curly') for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; circ(ctx, hx + Math.cos(a) * (r + 0.5), hy - 1 + Math.sin(a) * (r + 0.5), 3.3, c); }
    if (L.hair === 'buzz') { circ(ctx, hx, hy - 0.5, r + 0.6, shade(c, 0.08)); }
    if (LONG.has(L.hair) && L.hair !== 'ponytail' && L.hair !== 'buns') rr(ctx, hx - r - 1, hy - 2, (r + 1) * 2, 16, 5, c);
    if (L.hair === 'ponytail') { const sw = Math.sin(t / 500) * 1.2; ctx.beginPath(); ctx.moveTo(hx - 3, hy + 3); ctx.quadraticCurveTo(hx + sw - 5, hy + 13, hx + sw, hy + 19); ctx.quadraticCurveTo(hx + sw + 5, hy + 13, hx + 3, hy + 3); ctx.fillStyle = c; ctx.fill(); circ(ctx, hx, hy + 3, 2, '#E1564A'); }
    if (L.hair === 'buns') { circ(ctx, hx - 6, hy - 9, 4.2, c); circ(ctx, hx + 6, hy - 9, 4.2, c); }
    return;
  }
  // front: a cap over the top of the head, plus a side lock on the far side
  ctx.save();
  ctx.beginPath();
  ctx.rect(hx - 15, hy - 16, 30, L.hair === 'buzz' ? 10 : 12.2);
  ctx.clip();
  circ(ctx, hx, hy - 0.4, r + (L.hair === 'buzz' ? 0.5 : 1.5), c);
  ctx.restore();
  // far-side hair framing the face, following the curve of the head
  const sideLen = L.hair === 'buzz' ? 0 : L.hair === 'crop' || L.hair === 'curly' || L.hair === 'swept' ? 6 : 11;
  if (sideLen) { ctx.beginPath(); ctx.moveTo(hx + 3, hy - 4); ctx.quadraticCurveTo(hx + r + 3, hy - 3, hx + r + 0.8, hy - 4 + sideLen); ctx.quadraticCurveTo(hx + r - 3, hy - 4 + sideLen * 0.6, hx + 3, hy - 4); ctx.fillStyle = c; ctx.fill(); }
  if (L.hair === 'curly') for (let i = 0; i < 8; i++) { const a = Math.PI + 0.15 + i / 7 * (Math.PI - 0.3); circ(ctx, hx + Math.cos(a) * (r + 0.3), hy - 0.5 + Math.sin(a) * (r + 0.3), 3.1, c); }
  if (L.hair === 'swept') { ctx.beginPath(); ctx.moveTo(hx + 7, hy - 8); ctx.quadraticCurveTo(hx - 4, hy - 10, hx - 10, hy - 2); ctx.quadraticCurveTo(hx - 3, hy - 6, hx + 3, hy - 4); ctx.fillStyle = c; ctx.fill(); }
  if (L.hair === 'wavy' || L.hair === 'straight') { rr(ctx, hx - r - 1.2, hy - 6, 3.2, L.hair === 'wavy' ? 13 : 15, 1.6, c); }
  if (L.hair === 'buns') { circ(ctx, hx - 6, hy - 9.5, 4.2, c); circ(ctx, hx + 5, hy - 10, 4.2, c); }
  if (L.hair === 'ponytail') { circ(ctx, hx + 8.5, hy - 3, 2, '#E1564A'); }
  // shine
  ctx.strokeStyle = hl; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx - 1, hy - 1, r - 2, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
}
function extras(ctx, L, hx, hy, r, back) {
  if (L.extra === 'glasses' && !back) {
    ctx.strokeStyle = '#2A2A30'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(hx - 4.3, hy - 0.5, 2.5, 0, Math.PI * 2); ctx.moveTo(hx + 3.3, hy - 0.5); ctx.arc(hx + 0.8, hy - 0.5, 2.5, 0, Math.PI * 2);
    ctx.moveTo(hx - 1.8, hy - 0.8); ctx.lineTo(hx - 1.7, hy - 0.8); ctx.moveTo(hx + 3.3, hy - 1); ctx.lineTo(hx + 8.5, hy - 2); ctx.stroke();
  }
  if (L.extra === 'headband') { ctx.strokeStyle = '#E1564A'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(hx, hy + 1, r + 1, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); }
  if (L.extra === 'beanie') {
    ctx.beginPath(); ctx.arc(hx, hy - 2.5, r + 2, Math.PI, 0); ctx.fillStyle = '#C2413A'; ctx.fill();
    rr(ctx, hx - r - 2.5, hy - 4, (r + 2.5) * 2, 3.6, 1.5, '#A8352F'); circ(ctx, hx, hy - r - 4, 2.4, '#F2EDE4');
  }
  if (L.extra === 'cap') {
    ctx.beginPath(); ctx.arc(hx, hy - 3, r + 1.5, Math.PI, 0); ctx.fillStyle = '#3B5BA8'; ctx.fill();
    if (!back) { ctx.beginPath(); ctx.ellipse(hx - 9, hy - 3.6, 7, 1.8, -0.08, 0, Math.PI * 2); ctx.fillStyle = '#2F4A8C'; ctx.fill(); }
    circ(ctx, hx, hy - r - 4, 1.2, '#2F4A8C');
  }
  if (L.extra === 'bow') {
    const bx = hx + 5.5, by = hy - 9;
    ctx.fillStyle = '#F07AA8';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 4.5, by - 3); ctx.lineTo(bx - 4.5, by + 3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 4.5, by - 3); ctx.lineTo(bx + 4.5, by + 3); ctx.closePath(); ctx.fill();
    circ(ctx, bx, by, 1.4, '#D9558A');
  }
}
function face(ctx, L, hx, hy, t, closed) {
  const blink = closed || (t % 3700) < 130;
  if (blink) { limb(ctx, hx - 5.6, hy - 0.4, hx - 3.2, hy - 0.4, 0.9, '#2A1E16'); limb(ctx, hx - 0.4, hy - 0.4, hx + 2, hy - 0.4, 0.9, '#2A1E16'); }
  else {
    circ(ctx, hx - 4.3, hy - 0.5, 1.35, L.eyes); circ(ctx, hx + 0.8, hy - 0.5, 1.35, L.eyes);
    circ(ctx, hx - 4.7, hy - 1, 0.45, '#fff'); circ(ctx, hx + 0.4, hy - 1, 0.45, '#fff');
  }
  ctx.strokeStyle = '#7A3E2E'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(hx - 1.8, hy + 2.6, 1.6, 0.25, Math.PI - 0.25); ctx.stroke();
  if (L.blush) { ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(hx - 6.2, hy + 2.3, 1.7, 1, 0, 0, Math.PI * 2); ctx.ellipse(hx + 3.2, hy + 2.3, 1.7, 1, 0, 0, Math.PI * 2); ctx.fillStyle = '#F28A8A'; ctx.fill(); ctx.globalAlpha = 1; }
}

/* ---------------- props ---------------- */
function prop(ctx, kind, y0, t, seated) {
  if (kind === 'book') {
    const flip = (t % 5000) / 5000;
    ctx.save(); ctx.translate(-6, y0);
    rr(ctx, -6, -1, 12, 7.5, 1, '#4F81BD');
    ctx.fillStyle = '#FBF7EC'; ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(0, 1.4); ctx.lineTo(0, 7); ctx.lineTo(-5.5, 5.8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5.5, 0); ctx.lineTo(0, 1.4); ctx.lineTo(0, 7); ctx.lineTo(5.5, 5.8); ctx.fill();
    ctx.strokeStyle = '#C9C2B0'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4.5, 2 + i * 1.4); ctx.lineTo(-1, 3 + i * 1.4); ctx.moveTo(1, 3 + i * 1.4); ctx.lineTo(4.5, 2 + i * 1.4); ctx.stroke(); }
    if (flip > 0.85) { const k = (flip - 0.85) / 0.15; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(0, 1.4); ctx.lineTo(5.5 - k * 11, -1 - Math.sin(k * Math.PI) * 3); ctx.lineTo(5.5 - k * 11, 4.5 - Math.sin(k * Math.PI) * 3); ctx.lineTo(0, 7); ctx.fill(); }
    ctx.restore();
  }
  if (kind === 'laptop') {
    ctx.save(); ctx.translate(-7, y0 + (seated ? 1 : 2));
    ctx.fillStyle = '#AEB4BD'; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(5, 3); ctx.lineTo(7, 6); ctx.lineTo(-5, 6); ctx.fill();
    ctx.fillStyle = '#7D848E'; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-9, -6); ctx.lineTo(3, -6); ctx.lineTo(5, 3); ctx.fill();
    ctx.fillStyle = `rgba(140,190,255,${0.75 + Math.sin(t / 700) * 0.1})`; ctx.beginPath(); ctx.moveTo(-6.3, 2.2); ctx.lineTo(-7.9, -5); ctx.lineTo(2.2, -5); ctx.lineTo(3.9, 2.2); ctx.fill();
    ctx.restore();
  }
  if (kind === 'guitar') {
    ctx.save(); ctx.translate(-4, y0 + 2); ctx.rotate(-0.5);
    ctx.fillStyle = '#C2763A'; ctx.beginPath(); ctx.ellipse(0, 3, 6.5, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(-6, 2, 4.6, 4, 0, 0, Math.PI * 2); ctx.fill();
    circ(ctx, -2, 2.5, 1.8, '#2B1D14');
    ctx.fillStyle = '#5A3A22'; ctx.fillRect(-24, 1.4, 18, 2.2); ctx.fillRect(-27, 0.6, 4, 3.8);
    ctx.restore();
  }
}

/** Draw the character. opts: { pose, facing, t, prop, seat (px), wave, bubble } */
export function drawCharacter(ctx, look, opts = {}) {
  const L = { ...DEFAULT_LOOK, ...(look || {}) };
  const t = opts.t ?? performance.now();
  const pose = opts.pose || 'stand';
  const facing = opts.facing || 'fl';
  const back = facing[0] === 'b';
  const mirror = facing[1] === 'r';
  ctx.save();
  if (opts.scale) ctx.scale(opts.scale, opts.scale);

  // shadow
  if (pose !== 'sit') { ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.ellipse(0, 0, pose === 'floor' ? 10 : 7.5, 3, 0, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1; }
  if (mirror) ctx.scale(-1, 1);

  const walking = pose === 'walk';
  const sw = walking ? Math.sin(t / 110) : 0;
  const breathe = Math.sin(t / 650) * 0.4;
  // vertical offset of the upper body (standing torso sits at y -31..-15)
  const up = pose === 'sit' ? 15 : pose === 'floor' ? 11 : -Math.abs(sw) * 1.1;
  const hx = -0.5, hy = -41 + up + breathe * 0.6 + (opts.focus ? Math.sin(t / 900) * 0.5 : 0), r = 9.5;
  const bottom = L.bottom, top = L.top, skin = L.skin;
  const holding = opts.prop && !back;

  // long hair behind everything
  if (!back) hairBack(ctx, L, hx, hy, back, t);

  // legs
  if (pose === 'sit') {
    const drop = Math.min(opts.seat ?? 18, 19);
    if (opts.stool) { rr(ctx, -6, 0, 12, 3, 1.5, '#5A3A22'); limb(ctx, -4, 3, -5, drop, 1.6, '#5A3A22'); limb(ctx, 4, 3, 5, drop, 1.6, '#5A3A22'); }
    limb(ctx, 1, -2, -8, -2.5, 4.6, bottom); limb(ctx, 3, -1, -6.5, -1, 4.6, shade(bottom, -0.12));
    limb(ctx, -8.5, -2, -9, drop - 2, 4, bottom); limb(ctx, -6.5, -1, -6.8, drop - 1.5, 4, shade(bottom, -0.12));
    rr(ctx, -12, drop - 2.6, 5.5, 2.8, 1.3, SHOE); rr(ctx, -9.8, drop - 2, 5.5, 2.8, 1.3, SHOE);
  } else if (pose === 'floor') {
    ctx.beginPath(); ctx.ellipse(-1, -3, 10, 3.6, 0, 0, Math.PI * 2); ctx.fillStyle = bottom; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-3, -2.2, 7, 2.6, 0.25, 0, Math.PI * 2); ctx.fillStyle = shade(bottom, -0.12); ctx.fill();
    rr(ctx, -11.5, -4, 4, 2.6, 1.2, SHOE); rr(ctx, 6, -3.5, 4, 2.6, 1.2, SHOE);
  } else {
    const a = sw * 2.6;
    limb(ctx, 1.8, -16 + up, 1.8 - a * 0.6, -2 - Math.max(0, -sw) * 1.5, 4.2, shade(bottom, -0.12));
    limb(ctx, -1.8, -16 + up, -1.8 + a * 0.6, -2 - Math.max(0, sw) * 1.5, 4.2, bottom);
    rr(ctx, -0.6 - a * 0.6, -2.6 - Math.max(0, -sw) * 1.5, 5, 2.8, 1.3, SHOE);
    rr(ctx, -4.6 + a * 0.6, -2.6 - Math.max(0, sw) * 1.5, 5, 2.8, 1.3, SHOE);
  }

  // far arm (behind body)
  const shoulderY = -28.5 + up;
  if (!back) {
    if (holding) limb(ctx, 4, shoulderY + 1, -1, shoulderY + 10, 3.2, shade(top, -0.2));
    else if (pose === 'stretch') limb(ctx, 5, shoulderY, 7, shoulderY - 13, 3.2, shade(top, -0.2));
    else limb(ctx, 5.5, shoulderY, 6.5 - sw * 2, shoulderY + 12, 3.2, shade(top, -0.2));
  }

  // body
  rr(ctx, -6.5, -31 + up + breathe * 0.3, 13, 17 - breathe * 0.3, 3.5, top);
  rr(ctx, -6.5, -18.5 + up, 13, 4.5, 1.5, bottom);
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(2.5, -30 + up, 4, 15);
  rr(ctx, -2, -33.5 + up, 4, 3.5, 1, skin); // neck

  // head
  if (back) hairBack(ctx, L, hx, hy, back, t);
  circ(ctx, hx, hy, r, skin);
  if (!back) { circ(ctx, hx + 8.3, hy + 1, 1.8, shade(skin, -0.08)); face(ctx, L, hx, hy, t, opts.focus && opts.prop === 'piano' && (t % 2400) < 1200); }
  hairFront(ctx, L, hx, hy, r, back, t);
  extras(ctx, L, hx, hy, r, back);

  // near arm + prop
  const handY = pose === 'sit' ? -10 + 15 : pose === 'floor' ? -10 + 11 : -16;
  if (back) {
    if (pose === 'stretch') { limb(ctx, -5, shoulderY, -7, shoulderY - 13, 3.2, top); limb(ctx, 5, shoulderY, 7, shoulderY - 13, 3.2, top); }
    else limb(ctx, -5.5, shoulderY, -6.5 + sw * 2, shoulderY + 12, 3.2, top);
  } else if (pose === 'wave' || opts.wave) {
    const wv = Math.sin(t / 120) * 3;
    limb(ctx, -5.5, shoulderY, -9 + wv, shoulderY - 11, 3.2, top); circ(ctx, -9 + wv, shoulderY - 12.5, 2, skin);
  } else if (pose === 'stretch') {
    limb(ctx, -5, shoulderY, -7, shoulderY - 13, 3.2, top); circ(ctx, -7, shoulderY - 14.5, 2, skin); circ(ctx, 7, shoulderY - 14.5, 2, skin);
  } else if (holding) {
    const tap = opts.prop === 'laptop' || opts.prop === 'piano' ? Math.sin(t / 90) * 0.8 : 0;
    const strum = opts.prop === 'guitar' ? Math.sin(t / 160) * 2 : 0;
    if (opts.prop === 'piano') { limb(ctx, -5, shoulderY + 1, -11, shoulderY + 6 + tap, 3.2, top); circ(ctx, -11.5, shoulderY + 6.5 + tap, 1.9, skin); }
    else {
      prop(ctx, opts.prop, handY - 6, t, pose === 'sit');
      limb(ctx, -5.5, shoulderY + 1, -9 + strum, handY - 3 + tap, 3.2, top); circ(ctx, -9.5 + strum, handY - 2.5 + tap, 1.9, skin);
    }
  } else {
    limb(ctx, -5.5, shoulderY, -6.5 + sw * 2, shoulderY + 12, 3.2, top); circ(ctx, -6.6 + sw * 2, shoulderY + 13.3, 1.9, skin);
  }
  ctx.restore();

  // little focus bubble above the head (not mirrored, so text and notes read the right way)
  if (opts.bubble) bubble(ctx, opts.bubble, hy * (opts.scale || 1) - 16, t);
}

function bubble(ctx, kind, y, t) {
  ctx.save();
  if (kind === 'music') {
    for (let i = 0; i < 2; i++) {
      const k = ((t / 1800) + i * 0.5) % 1;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#4F81BD';
      const x = 6 + i * 6 + Math.sin(k * 6) * 2, yy = y - k * 14;
      ctx.beginPath(); ctx.ellipse(x, yy, 2, 1.5, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 1.4, yy - 7, 0.9, 7);
    }
  } else if (kind === 'think') {
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(10, y - 6, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    circ(ctx, 3, y + 1, 1.6, '#FFFFFF');
    for (let i = 0; i < 3; i++) { const on = Math.floor(t / 400) % 4 > i; circ(ctx, 6 + i * 4, y - 6, 1.2, on ? '#5A6B63' : '#C9D3CE'); }
  } else if (kind === 'heart') {
    const k = (t % 1500) / 1500; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#F07AA8';
    const x = 8, yy = y - k * 10;
    ctx.beginPath(); ctx.moveTo(x, yy + 2.5); ctx.bezierCurveTo(x - 4, yy - 1, x - 2, yy - 4, x, yy - 1.5); ctx.bezierCurveTo(x + 2, yy - 4, x + 4, yy - 1, x, yy + 2.5); ctx.fill();
  } else if (typeof kind === 'object' && kind.text) {
    ctx.font = '700 9px Nunito, sans-serif';
    const w = ctx.measureText(kind.text).width + 12;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, y - 20, w, 15, 6) : ctx.rect(-w / 2, y - 20, w, 15); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, y - 5.5); ctx.lineTo(0, y - 1); ctx.lineTo(3, y - 5.5); ctx.fill();
    ctx.fillStyle = '#16261F'; ctx.textAlign = 'center'; ctx.fillText(kind.text, 0, y - 9.5);
  }
  ctx.restore();
}

/** Draw a head-and-shoulders portrait into a square canvas (for the sidebar avatar). */
export function drawPortrait(canvas, look) {
  const ctx = canvas.getContext('2d'), s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.save(); ctx.translate(s / 2, s * 1.86); ctx.scale(s / 30, s / 30); // head centred in the circle
  drawCharacter(ctx, look, { t: 1000, facing: 'fl' });
  ctx.restore();
}
