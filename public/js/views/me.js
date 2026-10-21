import { api } from '../api.js';
import { state, applyResult } from '../store.js';
import { esc, $, toast, errorToast } from '../ui.js';
import { mountDesigner } from '../designer.js';
import { THEMES, DEFAULT_LOOK } from '/shared/avatar.js';

export function mount(el) {
  const p = state.profile;
  let look = { ...DEFAULT_LOOK, ...(p.avatar || {}) }, theme = p.prefs.theme || 'green';
  el.innerHTML = `
  <div class="page-head"><div><p class="eyebrow">Make it yours</p><h1>Me</h1></div></div>
  <div class="me-grid">
    <section class="card stack">
      <label class="f">Nickname<input id="nick" maxlength="20" value="${esc(p.nickname || state.user.username)}"></label>
      <div id="designer"></div>
    </section>
    <aside class="stack">
      <section class="card stack">
        <h3>Colour theme</h3>
        <div class="themes">${Object.entries(THEMES).map(([k, n]) => `<button type="button" class="theme-btn" data-theme-pick="${k}" aria-pressed="${k === theme}"><i class="t-${k}"></i>${n}</button>`).join('')}</div>
        <p class="hint">Changes the colour of buttons, highlights and charts across the app.</p>
      </section>
      <section class="card stack">
        <button class="btn primary wide" id="save">Save changes</button>
        <p class="hint">Your character lives in your house. Open a room to see them wander around, and start a focus session to watch them get to work.</p>
      </section>
    </aside>
  </div>`;
  const designer = mountDesigner($('#designer', el), look, (l) => { look = l; });
  el.querySelectorAll('[data-theme-pick]').forEach((b) => (b.onclick = () => {
    theme = b.dataset.themePick;
    document.documentElement.dataset.accent = theme; // preview straight away
    el.querySelectorAll('[data-theme-pick]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  $('#save', el).onclick = async () => {
    try {
      applyResult(await api('PATCH', '/api/profile', { nickname: $('#nick', el).value, avatar: look, prefs: { theme } }));
      toast('Saved. Looking good!');
    } catch (e) { errorToast(e); }
  };
  return () => { designer.destroy(); document.documentElement.dataset.accent = state.profile.prefs.theme || 'green'; };
}
