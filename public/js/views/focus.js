import { api } from '../api.js';
import { state, applyResult, subscribe } from '../store.js';
import { esc, $, icon, coinSvg, fmtTime, errorToast } from '../ui.js';
import { ROOM_TYPES } from '/shared/catalog.js';
import { timer, onTimer, remaining, lengths, start, pause, stop, skip, setMode, setChoice } from '../focusCtl.js';
import { liveRoom } from '../iso/liveRoom.js';
import { sceneFor, moveCharacterTo, focusRoomId, nickname } from '../charCtl.js';

const C = 2 * Math.PI * 52;

export function mount(el) {
  let sets = [];
  el.innerHTML = `
  <div class="page-head"><div><p class="eyebrow">Study timer</p><h1>Focus</h1></div></div>
  <div class="focus-grid">
    <section class="card timer-card">
      <div class="seg center" id="modes" role="tablist">
        <button data-mode="focus">Focus</button><button data-mode="short">Short break</button><button data-mode="long">Long break</button>
      </div>
      <div class="ring">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" id="arc" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="ring-text"><b id="tLeft">25:00</b><span id="tLabel"></span></div>
      </div>
      <div class="dots" id="dots"></div>
      <div class="away-note" id="awayNote" hidden></div>
      <div class="row center" id="ctrls"></div>
      <label class="f">What are you studying?<select id="fSet"><option value="">Anything</option></select></label>
      <details class="settings"><summary>Customise the timer</summary>
        <div class="grid4">
          <label class="f">Focus (min)<input type="number" id="sFocus" min="1" max="180"></label>
          <label class="f">Short break<input type="number" id="sShort" min="1" max="60"></label>
          <label class="f">Long break<input type="number" id="sLong" min="1" max="90"></label>
          <label class="f">Rounds<input type="number" id="sRounds" min="1" max="12"></label>
        </div>
        <div class="row"><span class="muted small">Presets:</span>
          <button class="btn small ghost" data-preset="25,5,15,4">Pomodoro 25/5</button>
          <button class="btn small ghost" data-preset="50,10,20,3">Deep work 50/10</button>
          <button class="btn small ghost" data-preset="15,3,10,4">Quick 15/3</button></div>
      </details>
    </section>
    <section class="card room-view">
      <canvas id="fRoom" aria-label="Your room while you study"></canvas>
      <div class="room-view-foot">
        <div><b id="fLine"></b><p class="hint">Each focused minute earns ${coinSvg}1, and finishing a session adds ${coinSvg}5. Your streak multiplier applies. The server keeps time, so the timer keeps running if you switch pages.</p></div>
        <label class="f">Room<select id="fRoomSel"></select></label>
      </div>
    </section>
  </div>`;

  const rooms = () => state.home?.rooms || [];
  const roomSel = $('#fRoomSel', el);
  roomSel.innerHTML = rooms().map((r) => `<option value="${r.id}">${esc(ROOM_TYPES[r.type].name)}</option>`).join('');
  if (!rooms().some((r) => r.id === timer.roomId)) timer.roomId = rooms()[0]?.id;
  roomSel.value = timer.roomId;
  roomSel.onchange = () => { setChoice('roomId', +roomSel.value); moveCharacterTo(+roomSel.value); };
  moveCharacterTo(focusRoomId());
  const live = liveRoom($('#fRoom', el), (now) => sceneFor(focusRoomId(), now), { pad: 8 });

  api('GET', '/api/sets').then((r) => {
    sets = r.sets;
    $('#fSet', el).innerHTML = '<option value="">Anything</option>' + sets.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
    $('#fSet', el).value = timer.setId || '';
  }).catch(() => {});
  $('#fSet', el).onchange = (e) => setChoice('setId', e.target.value ? +e.target.value : null);

  el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  const inputs = { focus: '#sFocus', short: '#sShort', long: '#sLong', rounds: '#sRounds' };
  const fillSettings = () => { for (const [k, s] of Object.entries(inputs)) $(s, el).value = lengths()[k]; };
  fillSettings();
  for (const [k, s] of Object.entries(inputs)) $(s, el).onchange = async (e) => {
    try { applyResult(await api('PATCH', '/api/profile', { timer: { [k]: +e.target.value } })); } catch (err) { errorToast(err); fillSettings(); }
  };
  el.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = async () => {
    const [focus, short, long, rounds] = b.dataset.preset.split(',').map(Number);
    try { applyResult(await api('PATCH', '/api/profile', { timer: { focus, short, long, rounds } })); fillSettings(); } catch (err) { errorToast(err); }
  }));

  const act = (fn) => async () => { try { await fn(); } catch (e) { errorToast(e); } };
  function render() {
    const r = remaining(), L = lengths();
    $('#tLeft', el).textContent = fmtTime(r.left);
    const names = { focus: 'Focus', short: 'Short break', long: 'Long break' };
    $('#tLabel', el).textContent = `${names[timer.mode]} · round ${Math.min(timer.round, L.rounds)} of ${L.rounds}`;
    $('#arc', el).setAttribute('stroke-dashoffset', (C * (1 - r.left / r.total)).toFixed(1));
    $('#arc', el).classList.toggle('break', timer.mode !== 'focus');
    el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === timer.mode));
    $('#dots', el).innerHTML = Array.from({ length: L.rounds }, (_, i) => `<i class="${i < timer.round - (timer.mode === 'focus' ? 1 : 0) ? 'on' : ''}"></i>`).join('');
    const away = $('#awayNote', el);
    const why = { page: 'you left the Focus page', tab: 'you switched to another tab or app', closed: 'the app was closed' }[timer.autoPaused];
    away.hidden = !(r.paused && why);
    if (why) away.textContent = `Paused because ${why}. Ready to carry on?`;
    const ctrls = $('#ctrls', el);
    const sig = `${r.running}|${r.paused}|${timer.mode}`;
    if (ctrls.dataset.sig !== sig) {
      ctrls.dataset.sig = sig;
      ctrls.innerHTML = r.running
        ? `<button class="btn primary big" id="cPause">${icon('pause')} Pause</button><button class="btn ghost" id="cStop">${icon('stop')} Stop</button>`
        : `<button class="btn primary big" id="cStart">${icon('play')} ${r.paused ? 'Resume' : timer.mode === 'focus' ? 'Start focusing' : 'Start break'}</button>${r.paused ? `<button class="btn ghost" id="cStop">${icon('stop')} Stop</button>` : ''}<button class="btn ghost" id="cSkip">${icon('skip')} Skip</button>`;
      $('#cStart', ctrls)?.addEventListener('click', act(start));
      $('#cPause', ctrls)?.addEventListener('click', act(pause));
      $('#cStop', ctrls)?.addEventListener('click', act(stop));
      $('#cSkip', ctrls)?.addEventListener('click', act(skip));
    }
    const lines = timer.mode === 'focus'
      ? (r.running ? `${nickname()} is focusing with you.` : r.paused ? `Paused. ${nickname()} is waiting for you.` : `${nickname()} is ready when you are.`)
      : `Break time. ${nickname()} is stretching. You could too, and drink some water.`;
    $('#fLine', el).textContent = lines;
  }
  render();
  const off = onTimer(render);
  const unsub = subscribe(render);
  return () => { off(); unsub(); live.destroy(); };
}
