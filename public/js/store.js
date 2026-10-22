// Global app state and how server results (coins, notices) flow into the UI.
import { toast, celebrate, esc, coinSvg } from './ui.js';

export const state = { user: null, profile: null, ai: false, home: null, sets: null };
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const notify = () => subs.forEach((fn) => fn(state));

/** Apply a server response: profile/home updates, coin toasts, celebrations. */
export function applyResult(r) {
  if (!r) return r;
  if (r.profile) state.profile = r.profile;
  if (r.home) state.home = r.home;
  for (const rw of r.rewards || []) {
    if (rw.action === 'chest') continue;
    const tag = rw.kind === 'ind' ? '<span class="tag ind">yours</span>' : rw.kind === 'ai' ? '<span class="tag ai">AI</span>' : '';
    toast(`${tag}${esc(rw.label)} <b class="plus">${coinSvg}+${rw.coins}</b>${rw.capped ? ' <small>(daily limit reached)</small>' : ''}`, 'reward');
  }
  for (const n of r.notices || []) {
    if (n.type === 'chest') celebrate('Daily chest opened!', esc(n.text) + ' You earned 25 bonus coins.', 'chest');
    else if (n.type === 'tier') celebrate('Independence level up!', esc(n.text));
    else toast(esc(n.text));
  }
  if (r.rewards?.length) bumpCoins();
  notify();
  return r;
}

export function bumpCoins() {
  document.querySelectorAll('.hud-coins').forEach((el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
}
