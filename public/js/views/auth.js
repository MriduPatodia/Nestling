import { APP_NAME } from '/shared/brand.js';
import { api } from '../api.js';
import { esc, $, icon } from '../ui.js';
import { liveRoom } from '../iso/liveRoom.js';
import { Actor } from '../actor.js';
import { mountDesigner } from '../designer.js';
import { DEFAULT_LOOK } from '/shared/avatar.js';

const DEMO = {
  room: { wallpaper: 'dots', floor: 'walnut' },
  items: [
    { id: 1, item: 'rug_fluffy', x: 2, y: 2, rot: 0 }, { id: 2, item: 'desk', x: 1, y: 0, rot: 0 }, { id: 3, item: 'chair_desk', x: 1, y: 1, rot: 2 },
    { id: 4, item: 'lamp_desk', x: 2, y: 0 }, { id: 5, item: 'laptop', x: 1, y: 0 }, { id: 6, item: 'bed_double', x: 0, y: 3, rot: 0 },
    { id: 7, item: 'bookshelf', x: 4, y: 0, rot: 0 }, { id: 8, item: 'plant_tall', x: 5, y: 0, rot: 0 }, { id: 9, item: 'cat', x: 3, y: 3, rot: 0 },
    { id: 10, item: 'window_big', x: 2, y: 0, wall: 'R' }, { id: 11, item: 'clock', x: 0, y: 0, wall: 'R' }, { id: 12, item: 'poster_planet', x: 3, y: 0, wall: 'L' },
    { id: 13, item: 'lights', x: 0, y: 0, wall: 'L' }, { id: 14, item: 'armchair', x: 5, y: 3, rot: 3 }, { id: 15, item: 'floor_lamp', x: 5, y: 2 },
    { id: 16, item: 'nightstand', x: 2, y: 5, rot: 0 }, { id: 17, item: 'candle', x: 2, y: 5 }, { id: 18, item: 'guitar', x: 0, y: 0 },
  ],
};

export function mount(root, _params, { onDone }) {
  let mode = 'signup', step = 1, look = { ...DEFAULT_LOOK }, nick = '', designer = null;
  root.innerHTML = `
  <div class="auth">
    <section class="auth-hero">
      <div class="auth-copy">
        <div class="brand big"><svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15 16 5l12 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="14" width="16" height="13" rx="2" fill="var(--accent)" stroke="currentColor" stroke-width="2.5"/><rect x="14" y="19" width="5" height="8" fill="var(--gold)" stroke="currentColor" stroke-width="2"/></svg><span>${esc(APP_NAME)}</span></div>
        <h1>Your own little home.<br>Grow it a day at a time.</h1>
        <p>Make a character, look after yourself, and get your work done. Notes, quizzes, focus sessions and daily check-ins all earn coins to build and decorate your dream home.</p>
      </div>
      <canvas class="auth-room" aria-label="An example room with your character in it"></canvas>
    </section>
    <section class="auth-form-wrap">
      <div class="auth-form card" id="authCard"></div>
      <a class="talk-link" href="#/talk">${icon('heart')} Need to talk to someone? You don't need an account.</a>
    </section>
  </div>`;

  // The example room on the left: your character wanders around it while you design.
  const actor = new Actor({ look, name: '' });
  const live = liveRoom($('.auth-room', root), (now) => {
    actor.look = look;
    actor.update(now, { type: 'bedroom' }, DEMO.items, null);
    return { ...DEMO, opts: { actor: actor.render(now) } };
  }, { pad: 4 });

  const card = $('#authCard', root);
  function render() {
    designer?.destroy(); designer = null;
    const tabs = `<div class="seg" role="tablist"><button type="button" role="tab" data-m="signup" aria-selected="${mode === 'signup'}">Create account</button><button type="button" role="tab" data-m="login" aria-selected="${mode === 'login'}">Log in</button></div>`;
    card.classList.toggle('wide', mode === 'signup' && step === 1);
    if (mode === 'signup' && step === 1) {
      card.innerHTML = `${tabs}
        <div><p class="eyebrow">Step 1 of 2</p><h2>Make your character</h2></div>
        <label class="f">Nickname<input id="nick" maxlength="20" placeholder="What should we call you?" value="${esc(nick)}" autocomplete="nickname"></label>
        <div id="designer"></div>
        <p class="form-err" id="aErr" role="alert"></p>
        <button class="btn primary wide" id="next">Next</button>`;
      designer = mountDesigner($('#designer', card), look, (l) => { look = l; });
      $('#nick', card).oninput = (e) => { nick = e.target.value; };
      $('#next', card).onclick = () => {
        if (!nick.trim()) { $('#aErr', card).textContent = 'Pick a nickname first.'; $('#nick', card).focus(); return; }
        step = 2; render();
      };
    } else {
      const signup = mode === 'signup';
      card.innerHTML = `${tabs}
        ${signup ? '<div><p class="eyebrow">Step 2 of 2</p><h2>Save your account</h2></div>' : '<h2>Welcome back</h2>'}
        <form class="stack" id="authForm" novalidate>
          <label class="f">Username<input id="au" autocomplete="username" required minlength="3" maxlength="24" placeholder="e.g. sunny_owl"></label>
          <label class="f">Password<input id="ap" type="password" required minlength="8" maxlength="200" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
          ${signup ? '<p class="hint">At least 8 characters. Your username is only for logging in; everyone in the app sees your nickname.</p>' : ''}
          <p class="form-err" id="aErr" role="alert"></p>
          <div class="row">${signup ? '<button type="button" class="btn ghost" id="back">Back</button>' : ''}<button class="btn primary grow" id="aGo">${signup ? 'Create my account' : 'Log in'}</button></div>
        </form>
        <p class="hint">No email needed. Everything you write is private to your account.</p>`;
      $('#back', card)?.addEventListener('click', () => { step = 1; render(); });
      $('#authForm', card).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('#aGo', card); btn.disabled = true;
        try {
          const body = { username: $('#au', card).value.trim(), password: $('#ap', card).value, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
          if (signup) Object.assign(body, { nickname: nick.trim(), avatar: look });
          await api('POST', signup ? '/api/auth/signup' : '/api/auth/login', body);
          if (!location.hash || location.hash === '#/talk') location.hash = '#/home';
          onDone();
        } catch (err) { $('#aErr', card).textContent = err.message; btn.disabled = false; }
      };
      $('#au', card).focus();
    }
    card.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; step = 1; render(); }));
  }
  render();
  return () => { live.destroy(); designer?.destroy(); };
}
