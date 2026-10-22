// Character designer: live animated preview + controls. Used at sign-up and on the Me page.
import { BASES, HAIR_STYLE_NAMES, SKIN, HAIR_COLORS, EYES, CLOTHES, EXTRAS, EXTRA_NAMES, DEFAULT_LOOK } from '/shared/avatar.js';
import { drawCharacter } from './character.js';
import { esc } from './ui.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function mountDesigner(root, initial, onChange) {
  let look = { ...DEFAULT_LOOK, ...(initial || {}) };
  let raf = 0, waveUntil = 0;
  root.innerHTML = `
    <div class="designer">
      <div class="designer-stage"><canvas class="designer-canvas" aria-label="Your character"></canvas>
        <button type="button" class="btn small ghost" data-act="random">Surprise me</button></div>
      <div class="designer-controls">
        <div class="base-pick" role="radiogroup" aria-label="Hair length">
          ${['long', 'short'].map((b) => `<button type="button" class="base-card" data-base="${b}" role="radio"><canvas width="120" height="120"></canvas><span>${b === 'long' ? 'Long hair' : 'Short hair'}</span></button>`).join('')}
        </div>
        <div class="dz" data-group="hair"></div>
        <div class="dz"><span class="dz-label">Hair colour</span><div class="sw-row" data-swatch="hairColor"></div></div>
        <div class="dz"><span class="dz-label">Skin tone</span><div class="sw-row" data-swatch="skin"></div></div>
        <div class="dz"><span class="dz-label">Eyes</span><div class="sw-row" data-swatch="eyes"></div></div>
        <div class="dz"><span class="dz-label">Top</span><div class="sw-row" data-swatch="top"></div></div>
        <div class="dz"><span class="dz-label">Bottoms</span><div class="sw-row" data-swatch="bottom"></div></div>
        <div class="dz"><span class="dz-label">Accessory</span><div class="chip-row" data-group="extra"></div></div>
        <label class="toggle"><input type="checkbox" data-blush> Rosy cheeks</label>
      </div>
    </div>`;
  const lists = { hairColor: HAIR_COLORS, skin: SKIN, eyes: EYES, top: CLOTHES, bottom: CLOTHES };

  function render() {
    root.querySelectorAll('[data-base]').forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.base === look.base);
      const c = b.querySelector('canvas'), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 120, 120); ctx.save(); ctx.translate(60, 112); ctx.scale(1.9, 1.9);
      const base = b.dataset.base;
      drawCharacter(ctx, { ...look, base, hair: base === look.base ? look.hair : BASES[base][0] }, { t: 1000 });
      ctx.restore();
    });
    root.querySelector('[data-group="hair"]').innerHTML = `<span class="dz-label">Hair style</span><div class="chip-row">${BASES[look.base].map((h) => `<button type="button" class="chip-btn" data-hair="${h}" aria-pressed="${look.hair === h}">${HAIR_STYLE_NAMES[h]}</button>`).join('')}</div>`;
    for (const [k, list] of Object.entries(lists)) {
      root.querySelector(`[data-swatch="${k}"]`).innerHTML = list.map((c) => `<button type="button" class="sw" data-k="${k}" data-v="${c}" style="background:${c}" aria-pressed="${look[k] === c}" aria-label="${esc(k)} ${c}"></button>`).join('');
    }
    root.querySelector('[data-group="extra"]').innerHTML = EXTRAS.map((x) => `<button type="button" class="chip-btn" data-extra="${x}" aria-pressed="${look.extra === x}">${EXTRA_NAMES[x]}</button>`).join('');
    root.querySelector('[data-blush]').checked = look.blush;
  }
  const set = (patch) => { look = { ...look, ...patch }; waveUntil = performance.now() + 900; render(); onChange?.(look); };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.base) set({ base: b.dataset.base, hair: BASES[b.dataset.base].includes(look.hair) ? look.hair : BASES[b.dataset.base][0] });
    else if (b.dataset.hair) set({ hair: b.dataset.hair });
    else if (b.dataset.k) set({ [b.dataset.k]: b.dataset.v });
    else if (b.dataset.extra) set({ extra: b.dataset.extra });
    else if (b.dataset.act === 'random') {
      const base = pick(['long', 'short']);
      set({ base, hair: pick(BASES[base]), hairColor: pick(HAIR_COLORS), skin: pick(SKIN), eyes: pick(EYES), top: pick(CLOTHES), bottom: pick(CLOTHES), extra: pick(EXTRAS), blush: Math.random() < 0.5 });
    }
  });
  root.querySelector('[data-blush]').addEventListener('change', (e) => set({ blush: e.target.checked }));

  // animated preview
  const cv = root.querySelector('.designer-canvas');
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    const s = (r.height * dpr) / 66;
    ctx.translate(cv.width / 2, cv.height - 6 * dpr); ctx.scale(s, s);
    const waving = now < waveUntil || (now % 9000) < 1400;
    drawCharacter(ctx, look, { t: now, pose: waving ? 'wave' : 'stand', facing: 'fl' });
  };
  raf = requestAnimationFrame(loop);
  render();
  return { get: () => look, destroy: () => cancelAnimationFrame(raf) };
}
