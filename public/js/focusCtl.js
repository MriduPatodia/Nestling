import { APP_NAME } from '/shared/brand.js';
// Focus timer controller. Focus sessions are timed by the server; breaks are timed locally.
// Lives outside the views so the timer keeps going while you decorate.
import { api } from './api.js';
import { state, applyResult, notify } from './store.js';
import { toast } from './ui.js';
import { AUTO_PAUSE_FOCUS } from '/shared/settings.js';

const LS = 'studystead.focus';
export const timer = {
  session: null, fetchedAt: 0,           // server session snapshot
  mode: 'focus', round: 1,               // what's next / current
  breakEndsAt: null, breakLeft: null,    // local break timer
  setId: null, roomId: null,
};
const listeners = new Set();
export const onTimer = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(timer));

function persist() {
  try { localStorage.setItem(LS, JSON.stringify({ mode: timer.mode, round: timer.round, breakEndsAt: timer.breakEndsAt, breakLeft: timer.breakLeft, setId: timer.setId, roomId: timer.roomId })); } catch { /* ignore */ }
}
function restore() {
  try { Object.assign(timer, JSON.parse(localStorage.getItem(LS) || '{}')); } catch { /* ignore */ }
}

export const lengths = () => state.profile?.timer || { focus: 25, short: 5, long: 15, rounds: 4 };

/** Seconds left in whatever is current, and its total. */
export function remaining() {
  const L = lengths();
  if (timer.mode === 'focus') {
    const s = timer.session;
    if (!s) return { left: L.focus * 60, total: L.focus * 60, running: false, paused: false };
    const live = s.status === 'running' ? Date.now() - timer.fetchedAt : 0;
    const total = s.plannedMin * 60;
    return { left: Math.max(0, total - (s.elapsedMs + live) / 1000), total, running: s.status === 'running', paused: s.status === 'paused' };
  }
  const total = L[timer.mode] * 60;
  if (timer.breakEndsAt) return { left: Math.max(0, (timer.breakEndsAt - Date.now()) / 1000), total, running: true, paused: false };
  return { left: timer.breakLeft ?? total, total, running: false, paused: timer.breakLeft != null && timer.breakLeft < total };
}

function take(res) {
  applyResult(res);
  if ('session' in res) { timer.session = res.session; timer.fetchedAt = Date.now(); }
  if (timer.session && timer.session.status === 'done') finishFocus(true);
  else if (timer.session && timer.session.status === 'stopped') timer.session = null;
  emit();
}

function finishFocus(natural) {
  timer.session = null;
  const L = lengths();
  timer.mode = timer.round % L.rounds === 0 ? 'long' : 'short';
  timer.breakEndsAt = null; timer.breakLeft = null;
  if (natural) { chime(); toast(timer.mode === 'long' ? 'Great work! Take a long break.' : 'Session done. Take a short break.'); }
  persist();
}

export async function start() {
  timer.autoPaused = null;
  if (timer.mode === 'focus') {
    if (timer.session?.status === 'paused') return take(await api('POST', '/api/focus/resume'));
    unlockAudio();
    return take(await api('POST', '/api/focus/start', { minutes: lengths().focus, setId: timer.setId || null }));
  }
  const left = timer.breakLeft ?? lengths()[timer.mode] * 60;
  timer.breakEndsAt = Date.now() + left * 1000; timer.breakLeft = null; persist(); emit();
}
/**
 * Pause a running focus session because the student left (another page, another tab, or closed the app).
 * Uses keepalive so the request still goes through while the tab is closing.
 */
export function autoPause(reason) {
  if (!AUTO_PAUSE_FOCUS || timer.mode !== 'focus' || timer.session?.status !== 'running') return;
  timer.autoPaused = reason;
  timer.session = { ...timer.session, status: 'paused', elapsedMs: timer.session.elapsedMs + (Date.now() - timer.fetchedAt) };
  timer.fetchedAt = Date.now();
  fetch('/api/focus/pause', { method: 'POST', credentials: 'same-origin', keepalive: true })
    .then((r) => r.json()).then((res) => { if (res.session) take(res); }).catch(() => {});
  emit();
}

export async function pause() {
  timer.autoPaused = null;
  if (timer.mode === 'focus') return take(await api('POST', '/api/focus/pause'));
  timer.breakLeft = remaining().left; timer.breakEndsAt = null; persist(); emit();
}
export async function stop() {
  if (timer.mode === 'focus') { if (timer.session) take(await api('POST', '/api/focus/stop')); return; }
  timer.breakEndsAt = null; timer.breakLeft = null; persist(); emit();
}
export async function skip() {
  if (timer.mode === 'focus') { if (timer.session) take(await api('POST', '/api/focus/stop')); finishFocus(false); }
  else { timer.round = timer.mode === 'long' ? 1 : timer.round + 1; timer.mode = 'focus'; timer.breakEndsAt = null; timer.breakLeft = null; }
  persist(); emit();
}
export function setMode(mode) {
  if (timer.session) return toast('Stop the current focus session first.');
  timer.mode = mode; timer.breakEndsAt = null; timer.breakLeft = null; persist(); emit();
}
export function setChoice(key, val) { timer[key] = val; persist(); emit(); }

let lastSync = 0, syncing = false;
async function loop() {
  const r = remaining();
  if (timer.mode === 'focus' && timer.session?.status === 'running' && !syncing) {
    // Sync with the server every 20s, and right when the session should end.
    if (Date.now() - lastSync > 20000 || r.left <= 0) {
      syncing = true; lastSync = Date.now();
      try { take(await api('POST', '/api/focus/tick')); } catch { /* retry next loop */ }
      syncing = false;
    }
  }
  if (timer.mode !== 'focus' && timer.breakEndsAt && r.left <= 0) {
    const wasLong = timer.mode === 'long';
    timer.mode = 'focus'; timer.round = wasLong ? 1 : timer.round + 1; timer.breakEndsAt = null;
    chime(); toast('Break over. Ready for the next round?'); persist();
  }
  emit();
  document.title = r.running ? `${fmt(r.left)} · ${APP_NAME}` : APP_NAME;
}
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

let audio = null;
function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } }
function chime() {
  if (!audio) return;
  [660, 880, 1100].forEach((f, i) => {
    const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; o.connect(g); g.connect(audio.destination);
    const t0 = audio.currentTime + i * 0.18; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5); o.start(t0); o.stop(t0 + 0.55);
  });
}

let started = false;
export async function initFocus() {
  restore();
  try { const r = await api('GET', '/api/focus'); timer.session = r.session; timer.fetchedAt = Date.now(); if (r.session) timer.mode = 'focus'; } catch { /* ignore */ }
  if (!started) {
    started = true; setInterval(loop, 500);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause('tab'); });
    window.addEventListener('pagehide', () => autoPause('closed'));
  }
  // Opened the app somewhere other than the Focus page while a session was running
  if (!location.hash.startsWith('#/focus')) autoPause('page');
  emit(); notify();
}
