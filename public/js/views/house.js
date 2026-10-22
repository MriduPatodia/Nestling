import { api } from '../api.js';
import { state, subscribe, applyResult } from '../store.js';
import { esc, $, icon, coinSvg, modal, errorToast, toast } from '../ui.js';
import { ROOM_TYPES, HOUSE_SLOTS, HOUSE_COLORS, TIERS, roomBuildCost, homeLevel } from '/shared/catalog.js';
import { snapshotRoom, liveRoom } from '../iso/liveRoom.js';
import { characterRoomId, moveCharacterTo, sceneFor, focusMode, nickname } from '../charCtl.js';
import { daylight } from '../iso/render.js';

// Slot layout, top to bottom: attic (6), second floor (4,5), first floor (2,3), ground (0,1).
const FLOORS = [[4, 5], [2, 3], [0, 1]];
const supported = (built, slot) => slot < 2 || (slot === 6 ? built.has(4) || built.has(5) : built.has(slot - 2));

function goalsHtml(p) {
  const labels = { focus: 'Focus minutes', cards: 'Flashcards reviewed', quiz: 'Quiz questions', indep: 'Independent tasks' };
  return Object.entries(p.goals).filter(([, n]) => n > 0).map(([k, n]) => {
    const v = Math.min(p.day[k] || 0, n);
    return `<div class="goal ${v >= n ? 'done' : ''}"><span>${labels[k]}</span><span class="num">${v}/${n}</span><div class="bar"><i style="width:${(v / n) * 100}%"></i></div></div>`;
  }).join('');
}

export function mount(el) {
  const render = () => {
    const home = state.home, p = state.profile;
    if (!home || !p) return;
    const built = new Map(home.rooms.map((r) => [r.slot, r]));
    const builtSet = new Set(built.keys());
    const cost = roomBuildCost(home.rooms.length);
    const lvl = homeLevel(home.value);
    const night = daylight() < 0.5;
    const charRoom = characterRoomId();
    // Show the floors you've built plus one more to build on, so a new house isn't a wall of locks.
    const topFloor = Math.max(0, ...home.rooms.filter((r) => r.slot < 6).map((r) => Math.floor(r.slot / 2)));
    const cell = (slot) => {
      const r = built.get(slot);
      if (r) {
        const here = r.id === charRoom;
        return `<button class="room-cell ${here ? 'here' : ''}" data-room="${r.id}" aria-label="Open ${esc(ROOM_TYPES[r.type].name)}"><canvas data-thumb="${r.id}"></canvas><span class="room-label">${esc(ROOM_TYPES[r.type].name)}${here ? ` <em>· ${esc(nickname())} ${focusMode() === 'focus' ? 'is focusing' : 'is here'}</em>` : ''}</span></button>`;
      }
      if (slot >= HOUSE_SLOTS) return '';
      if (!supported(builtSet, slot)) return `<div class="room-cell empty locked"><span>${icon('lock')}Build below first</span></div>`;
      return `<button class="room-cell empty" data-build="${slot}"><span class="plus">${icon('plus')}</span><span>Build a room</span><span class="price">${coinSvg}${cost}</span></button>`;
    };
    el.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Welcome home, ${esc(nickname())}</p><h1>${esc(lvl.name)}</h1></div>
      <a class="btn primary" href="#/focus">${icon('timer')} Start studying</a>
    </div>
    <div class="house-grid">
      <section class="house-stage ${night ? 'night' : ''}" style="--house:${esc(p.houseColor)}">
        <div class="sky-deco" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="house">
          <div class="roof"><div class="chimney"></div>${built.has(6) || supported(builtSet, 6) ? `<div class="attic">${cell(6)}</div>` : ''}</div>
          <div class="storeys">${FLOORS.filter((row) => Math.floor(row[0] / 2) <= topFloor + 1).map((row) => `<div class="storey">${row.map(cell).join('')}</div>`).join('')}</div>
        </div>
        <div class="lawn"></div>
      </section>
      <aside class="stack">
        <div class="card">
          <div class="row between"><p class="eyebrow">Home value</p><span class="chip gold">${coinSvg}${home.value.toLocaleString()}</span></div>
          <h3>${esc(lvl.name)} <small class="muted">· level ${lvl.index + 1}</small></h3>
          <div class="bar gold"><i style="width:${lvl.next ? ((home.value - lvl.floor) / (lvl.next[0] - lvl.floor)) * 100 : 100}%"></i></div>
          <p class="hint">${lvl.next ? `${(lvl.next[0] - home.value).toLocaleString()} more to become a <b>${esc(lvl.next[1])}</b>. Furniture, rooms and wallpaper all count.` : 'You\'ve reached the top level!'}</p>
        </div>
        <div class="card">
          <div class="row between"><h3>Today's goals</h3><span class="chip ${p.day.chest ? 'ok' : 'gold'}">${p.day.chest ? 'Chest opened' : 'Chest · 25 coins'}</span></div>
          <div class="goals">${goalsHtml(p)}</div>
          <a class="link" href="#/progress">Change goals →</a>
        </div>
        <div class="card">
          <h3>Paint the house</h3>
          <div class="swatches">${HOUSE_COLORS.map((c) => `<button class="swatch ${c === p.houseColor ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="House colour ${c}"></button>`).join('')}</div>
          <p class="hint">Free to change any time. Tap a room to decorate it.</p>
        </div>
      </aside>
    </div>`;

    // room thumbnails
    lives.forEach((l) => l.destroy()); lives = [];
    for (const cv of el.querySelectorAll('canvas[data-thumb]')) {
      const r = home.rooms.find((x) => x.id === +cv.dataset.thumb);
      // the room the character is in is live and animated; the rest are still pictures
      if (r.id === charRoom) { lives.push(liveRoom(cv, (now) => sceneFor(r.id, now), { pad: 4, fps: 30 })); continue; }
      const box = cv.getBoundingClientRect();
      snapshotRoom(cv, r, home.items.filter((i) => i.roomId === r.id), box.width || 220, box.height || 170, { time: performance.now() });
    }
    el.querySelectorAll('[data-room]').forEach((b) => (b.onclick = () => { location.hash = '#/room/' + b.dataset.room; }));
    el.querySelectorAll('[data-build]').forEach((b) => (b.onclick = () => buildDialog(+b.dataset.build, cost)));
    el.querySelectorAll('[data-color]').forEach((b) => (b.onclick = async () => {
      try { applyResult(await api('PATCH', '/api/profile', { houseColor: b.dataset.color })); } catch (e) { errorToast(e); }
    }));
  };

  function buildDialog(slot, cost) {
    const tier = state.profile.tier;
    const m = modal(`
      <h3>Build a new room</h3>
      <p class="muted">This room costs <b>${cost} coins</b>. You have ${state.profile.coins.toLocaleString()}.</p>
      <div class="type-grid">${Object.entries(ROOM_TYPES).map(([id, t]) => {
        const locked = t.tier && tier < t.tier;
        return `<button class="type-card ${locked ? 'locked' : ''}" data-type="${id}" ${locked ? 'aria-disabled="true"' : ''}><b>${esc(t.name)}</b>${locked ? `<small>${icon('lock')} Needs ${TIERS[t.tier].name}</small>` : '<small>Comes with its own wallpaper and floor</small>'}</button>`;
      }).join('')}</div>
      <div class="row end"><button class="btn ghost" data-close>Cancel</button></div>`, { wide: true });
    m.el.querySelectorAll('[data-type]').forEach((b) => (b.onclick = async () => {
      const t = ROOM_TYPES[b.dataset.type];
      if (t.tier && tier < t.tier) return toast(`${esc(t.name)} unlocks at ${TIERS[t.tier].name} independence. Do more work on your own to get there.`);
      if (state.profile.coins < cost) return toast(`You need ${cost - state.profile.coins} more coins. Study a bit more first!`);
      try {
        const res = applyResult(await api('POST', '/api/rooms', { slot, type: b.dataset.type }));
        m.close();
        const room = res.home.rooms.find((r) => r.slot === slot);
        toast(`Built a ${esc(t.name.toLowerCase())}! Time to decorate.`);
        location.hash = '#/room/' + room.id;
      } catch (e) { errorToast(e); }
    }));
  }

  let lives = [], lastSig = '';
  // Re-render only when something visible changed (coin ticks shouldn't restart the animation).
  const maybeRender = () => {
    const sig = JSON.stringify([state.home, state.profile?.houseColor, state.profile?.nickname, state.profile?.avatar, state.profile?.day, characterRoomId(), focusMode()]);
    if (sig !== lastSig) { lastSig = sig; render(); }
  };
  maybeRender();
  const unsub = subscribe(maybeRender);
  // keep window light / clocks roughly current
  const iv = setInterval(() => { lastSig = ''; maybeRender(); }, 60000);
  // every so often the character wanders off to another room
  const wander = setInterval(() => {
    const rooms = state.home?.rooms || [];
    if (focusMode() === 'focus' || rooms.length < 2) return maybeRender();
    const others = rooms.filter((r) => r.id !== characterRoomId());
    moveCharacterTo(others[Math.floor(Math.random() * others.length)].id);
    maybeRender();
  }, 30000);
  const poll = setInterval(maybeRender, 1000); // notices focus starting/stopping
  return () => { unsub(); clearInterval(iv); clearInterval(wander); clearInterval(poll); lives.forEach((l) => l.destroy()); };
}
