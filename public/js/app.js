import { APP_NAME } from '/shared/brand.js';
document.title = APP_NAME;
// App shell + hash router.
import { api, setUnauthorizedHandler } from './api.js';
import { state, subscribe, notify, applyResult } from './store.js';
import { esc, icon, coinSvg, $, fmtTime, toast } from './ui.js';
import { initFocus, onTimer, remaining, timer, autoPause } from './focusCtl.js';
import * as authView from './views/auth.js';
import * as houseView from './views/house.js';
import * as roomView from './views/room.js';
import * as studyView from './views/study.js';
import * as focusView from './views/focus.js';
import * as progressView from './views/progress.js';
import * as talkView from './views/talk.js';
import * as wellbeingView from './views/wellbeing.js';
import * as meView from './views/me.js';
import { drawPortrait } from './character.js';

const NAV = [
  ['home', 'My home', 'house'], ['study', 'Study', 'book'], ['focus', 'Focus', 'timer'],
  ['progress', 'Goals & streaks', 'flame'], ['checkin', 'Check-in & journal', 'leaf'], ['talk', 'Talk to someone', 'heart'],
];
const ROUTES = [
  [/^\/?(home)?$/, houseView, 'home'],
  [/^\/room\/(\d+)$/, roomView, 'home'],
  [/^\/study(?:\/(\d+))?(?:\/(notes|cards|quiz|tutor))?$/, studyView, 'study'],
  [/^\/focus$/, focusView, 'focus'],
  [/^\/progress$/, progressView, 'progress'],
  [/^\/checkin$/, wellbeingView, 'checkin'],
  [/^\/me$/, meView, 'me'],
  [/^\/talk$/, talkView, 'talk'],
];

let cleanup = null;
let shellBuilt = false;

function buildShell() {
  const app = $('#app');
  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <a class="brand" href="#/home">${logo()}<span>${esc(APP_NAME)}</span></a>
      <nav class="side-nav" aria-label="Main">${NAV.map(([k, label, ic]) => `<a href="#/${k}" data-nav="${k}" class="${k === 'talk' ? 'talk' : ''}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav>
      <div class="player">
        <a class="player-name" href="#/me" data-nav="me" title="Edit your character"><canvas class="portrait" width="72" height="72" data-portrait></canvas><span><b data-nick></b><small>Edit me</small></span></a>
        <div class="hud" data-hud></div>
        <a href="#/focus" class="mini-timer" data-mini hidden></a>
        <button class="btn ghost small" id="logoutBtn">${icon('logout')} Log out</button>
      </div>
    </aside>
    <header class="topbar"><a class="brand" href="#/home">${logo()}</a><a href="#/me" class="top-me" aria-label="Edit your character"><canvas class="portrait" width="72" height="72" data-portrait></canvas></a><div class="hud" data-hud></div><a href="#/focus" class="mini-timer" data-mini hidden></a></header>
    <main id="view" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Main">${NAV.map(([k, label, ic]) => `<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${label.split(' ')[0]}</span></a>`).join('')}</nav>
  </div>`;
  $('#logoutBtn').onclick = async () => { await api('POST', '/api/auth/logout'); location.hash = '#/home'; location.reload(); };
  subscribe(renderHud); renderHud();
  onTimer(renderMini);
  shellBuilt = true;
}

const logo = () => '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15 16 5l12 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="14" width="16" height="13" rx="2" fill="var(--accent)" stroke="currentColor" stroke-width="2.5"/><rect x="14" y="19" width="5" height="8" fill="var(--gold)" stroke="currentColor" stroke-width="2"/></svg>';

let shownCoins = null, coinAnim = 0;
function renderHud() {
  const p = state.profile; if (!p) return;
  document.documentElement.dataset.accent = p.prefs.theme || 'green';
  for (const c of document.querySelectorAll('[data-portrait]')) drawPortrait(c, p.avatar);
  for (const b of document.querySelectorAll('[data-nick]')) b.textContent = p.nickname || state.user.username;
  // count the coin number up or down instead of jumping
  const from = shownCoins ?? p.coins, to = p.coins, t0 = performance.now();
  cancelAnimationFrame(coinAnim);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 700), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    shownCoins = v;
    document.querySelectorAll('.hud-coins b').forEach((b) => { b.textContent = v.toLocaleString(); });
    if (k < 1) coinAnim = requestAnimationFrame(step);
  };
  for (const el of document.querySelectorAll('[data-hud]')) {
    el.innerHTML = `
      <span class="hud-coins" title="Coins">${coinSvg}<b>${(shownCoins ?? p.coins).toLocaleString()}</b></span>
      <span class="hud-streak" title="Day streak">${icon('flame')}<b>${p.streak}</b></span>
      <span class="hud-mult" title="Streak multiplier: every coin you earn is multiplied by this">×${p.multiplier.toFixed(1)}</span>`;
  }
  if (from !== to) coinAnim = requestAnimationFrame(step);
}
function renderMini() {
  const r = remaining();
  for (const el of document.querySelectorAll('[data-mini]')) {
    const show = r.running || r.paused;
    el.hidden = !show;
    if (show) el.innerHTML = `${icon(timer.mode === 'focus' ? 'timer' : 'heart')}<b>${fmtTime(r.left)}</b><span>${timer.mode === 'focus' ? (r.paused ? 'paused' : 'focusing') : 'break'}</span>`;
  }
}

let lastPath = '';
async function route() {
  const path = location.hash.replace(/^#/, '') || '/home';
  if (lastPath === '/focus' && path !== '/focus' && timer.session?.status === 'running') {
    autoPause('page');
    toast('Focus paused while you\'re away. Go back to Focus to carry on.');
  }
  lastPath = path;
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }

  if (!state.user) {
    if (path === '/talk') { $('#app').innerHTML = '<main id="view" class="solo"></main>'; shellBuilt = false; cleanup = talkView.mount($('#view'), [], { loggedOut: true }); return; }
    shellBuilt = false;
    cleanup = authView.mount($('#app'), [], { onDone: boot });
    return;
  }
  if (!shellBuilt) buildShell();
  let match = null;
  for (const [re, view, nav] of ROUTES) { const m = re.exec(path); if (m) { match = { view, nav, params: m.slice(1) }; break; } }
  if (!match) { location.hash = '#/home'; return; }
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === match.nav));
  const el = $('#view');
  el.className = 'view-' + match.nav + ' page-in';
  el.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = match.view.mount(el, match.params) || null;
}

async function boot() {
  try {
    const me = await api('GET', '/api/me');
    state.user = me.user; state.profile = me.profile; state.ai = me.ai;
    // Keep the server's day boundary in the student's own time zone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== me.profile.prefs.tz) api('PATCH', '/api/profile', { prefs: { tz } }).then(applyResult).catch(() => {});
    applyResult({ notices: me.notices });
    const home = await api('GET', '/api/home');
    state.home = home;
    await initFocus();
  } catch {
    state.user = null;
  }
  notify();
  route();
}

setUnauthorizedHandler(() => { if (state.user) { state.user = null; shellBuilt = false; route(); } });
window.addEventListener('hashchange', route);
boot();
