// Small UI helpers: escaping, toasts, modals, markdown-lite, icons.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

export function md(text) {
  let out = '', inList = false;
  for (const line of esc(text).split('\n')) {
    const li = /^\s*([-*•]|\d+[.)])\s/.test(line);
    if (li && !inList) { out += '<ul>'; inList = true; }
    if (!li && inList) { out += '</ul>'; inList = false; }
    if (/^\s*#{1,4}\s/.test(line)) out += '<h4>' + line.replace(/^\s*#+\s/, '') + '</h4>';
    else if (li) out += '<li>' + line.replace(/^\s*([-*•]|\d+[.)])\s/, '') + '</li>';
    else if (line.trim()) out += '<p>' + line + '</p>';
  }
  if (inList) out += '</ul>';
  return out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

export function toast(html, kind = '') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.innerHTML = html;
  box.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300); }, 2800);
}
export const errorToast = (e) => toast(esc(e?.message || 'Something went wrong.'), 'err');

/** Modal dialog. Returns { el, close }. Buttons with data-close close it. */
export function modal(html, { onClose, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  const prevFocus = document.activeElement;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  requestAnimationFrame(() => (wrap.querySelector('[autofocus], input, textarea, select, button.primary') || wrap.querySelector('button'))?.focus());
  return { el: wrap.firstElementChild, close };
}

export function confirmBox({ title, body, yes = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal(`<h3>${title}</h3><p>${body}</p><div class="row end"><button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfYes">${yes}</button></div>`,
      { onClose: () => { if (!answered) resolve(false); } });
    m.el.querySelector('#cfYes').onclick = () => { answered = true; m.close(); resolve(true); };
  });
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const colors = ['#F3B93A', '#E0532F', '#2B7A57', '#4F81BD', '#E39BB6', '#8064A2'];
  const bits = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6, s: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const frame = (now) => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const b of bits) { b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += 0.15; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); }
    if (now - t0 < 2600) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

export function celebrate(title, body, art = 'star') {
  confetti();
  modal(`<div class="celebrate"><div class="burst">${ICONS[art] || ICONS.star}</div><h2>${title}</h2><p>${body}</p><button class="btn primary" data-close>Nice!</button></div>`);
}

export const coinSvg = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#F3B93A" stroke="#7A5200" stroke-width="1.6"/><circle cx="12" cy="12" r="6" fill="none" stroke="#7A5200" stroke-width="1.3" opacity=".5"/><path d="M8.5 9.5a4 4 0 0 1 5-1.6" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/></svg>';

const ic = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICONS = {
  house: ic('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
  book: ic('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/><path d="M8 7h7M8 11h5"/>'),
  timer: ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  flame: ic('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8Z"/>'),
  heart: ic('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>'),
  back: ic('<path d="M15 5l-7 7 7 7"/>'),
  rotate: ic('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>'),
  move: ic('<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
  box: ic('<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>'),
  coins: ic('<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>'),
  sparkle: ic('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  pencil: ic('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M14 6l4 4"/>'),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  lock: ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  paint: ic('<path d="M4 4h13v5H4z"/><path d="M17 6h3v6h-8v3"/><path d="M11 15h2v6h-2z"/>'),
  floor: ic('<path d="M3 15 12 10l9 5-9 5-9-5Z"/><path d="M7.5 12.5l9 5M16.5 12.5l-9 5"/>'),
  star: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4l8 18 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2Z" fill="#F3B93A" stroke="#7A5200" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  chest: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="26" width="48" height="28" rx="4" fill="#B5733C" stroke="#4A2B12" stroke-width="2.5"/><path d="M8 30c0-12 10-18 24-18s24 6 24 18Z" fill="#CF8A4E" stroke="#4A2B12" stroke-width="2.5"/><rect x="27" y="28" width="10" height="12" rx="2" fill="#F3B93A" stroke="#4A2B12" stroke-width="2"/><path d="M8 30h48" stroke="#4A2B12" stroke-width="2.5"/><circle cx="20" cy="10" r="3" fill="#F3B93A"/><circle cx="46" cy="8" r="2" fill="#F3B93A"/></svg>',
  logout: ic('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  send: ic('<path d="M4 12l16-8-6 16-3-6-7-2Z"/>'),
  stop: ic('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  play: ic('<path d="M7 4v16l13-8Z"/>'),
  pause: ic('<path d="M8 5v14M16 5v14"/>'),
  skip: ic('<path d="M5 5l10 7-10 7Z"/><path d="M19 5v14"/>'),
  leaf: ic('<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Z"/><path d="M5 19 13 11"/>'),
  upload: ic('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
  file: ic('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  trash: ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};
export const icon = (name) => ICONS[name] || '';

export const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
