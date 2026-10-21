// Mounts an animated room on a canvas, sized to its CSS box (handles HiDPI + resizes).
import { drawRoom, fitRoom } from './render.js';

export function liveRoom(canvas, getScene, { pad = 10, fps = 45 } = {}) {
  let raf = 0, dpr = 1, w = 0, h = 0, fit = null, last = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2); w = r.width; h = r.height;
    canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    fit = fitRoom(w, h, pad);
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / fps) return;
    last = now;
    const scene = getScene(now);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!scene || !fit) return;
    ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.ox, dpr * fit.oy);
    drawRoom(ctx, scene.room, scene.items, scene.opts || {});
  };
  raf = requestAnimationFrame(frame);
  return {
    /** Convert a pointer event into iso screen space. */
    toIso(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left - fit.ox) / fit.scale, (e.clientY - r.top - fit.oy) / fit.scale]; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

/** Render a room once into a canvas of given CSS size (for thumbnails). */
export function snapshotRoom(canvas, room, items, cssW, cssH, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  const f = fitRoom(cssW, cssH, 4);
  ctx.setTransform(dpr * f.scale, 0, 0, dpr * f.scale, dpr * f.ox, dpr * f.oy);
  drawRoom(ctx, room, items, opts);
}
