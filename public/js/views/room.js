import { api } from '../api.js';
import { state, subscribe, applyResult } from '../store.js';
import { esc, $, icon, coinSvg, toast, errorToast, confirmBox } from '../ui.js';
import { ITEMS, ROOM_SHOPS, BASICS, allowedIn, homeOf, ROOM_TYPES, WALLPAPERS, FLOORS, TIERS, ROOM_SIZE as R, WALL_HEIGHT as WH, SELL_BACK } from '/shared/catalog.js';
import { canPlace, dims, itemsOnTop } from '/shared/placement.js';
import { liveRoom } from '../iso/liveRoom.js';
import { unproject, pickItem, drawItemThumb } from '../iso/render.js';
import { characterRoomId, moveCharacterTo, actorFor, currentActor, focusMode, look, nickname, roomName } from '../charCtl.js';
import { paintWall, paintFloor } from '../iso/surfaces.js';

const thumbs = new Map();
function thumb(id) {
  if (!thumbs.has(id)) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    drawItemThumb(c.getContext('2d'), id, 128, 0);
    thumbs.set(id, c.toDataURL());
  }
  return thumbs.get(id);
}
const swatches = new Map();
function swatch(kind, id) {
  const key = kind + id;
  if (!swatches.has(key)) {
    const c = document.createElement('canvas'); c.width = 120; c.height = 90;
    const ctx = c.getContext('2d');
    if (kind === 'wp') { ctx.translate(0, 90); ctx.scale(1, -1); paintWall(ctx, WALLPAPERS[id], 120, 90, 'R'); }
    else { ctx.scale(20, 15); paintFloor(ctx, FLOORS[id], 6); }
    swatches.set(key, c.toDataURL());
  }
  return swatches.get(key);
}

export function mount(el, [roomIdStr]) {
  const roomId = +roomIdStr;
  let tab = 'furniture', mode = null, selected = null, lastPointer = 'mouse', shiftHeld = false;
  const room = () => state.home?.rooms.find((r) => r.id === roomId);
  const placed = () => state.home.items.filter((i) => i.roomId === roomId);

  if (!room()) { el.innerHTML = '<div class="card"><h2>That room doesn\'t exist.</h2><a class="btn" href="#/home">Back to the house</a></div>'; return; }

  el.innerHTML = `
  <div class="page-head room-head">
    <a class="btn ghost icon-btn" href="#/home" aria-label="Back to the house">${icon('back')}</a>
    <div class="grow"><p class="eyebrow">Decorating</p><h1 id="roomTitle"></h1></div>
    <div class="room-tabs" id="roomTabs"></div>
  </div>
  <div class="room-grid">
    <section class="room-stage">
      <canvas id="roomCv" aria-label="Your room. Choose an item from the shop, then click the floor or a wall to place it."></canvas>
      <div class="stage-bar" id="stageBar" aria-live="polite"></div>
    </section>
    <aside class="catalog card">
      <div class="cat-tabs" id="catTabs" role="tablist"></div>
      <div class="cat-grid" id="catGrid"></div>
    </aside>
  </div>`;

  const canvas = $('#roomCv', el);
  moveCharacterTo(roomId); // your character follows you into the room
  const live = liveRoom(canvas, scene, { pad: 14 });

  /* ---------- scene ---------- */
  function movingSet() {
    if (!mode || mode.kind !== 'move') return { hide: new Set(), riders: [] };
    const orig = placed().find((p) => p.id === mode.id);
    if (!orig) return { hide: new Set([mode.id]), riders: [] };
    const riders = ITEMS[orig.item].surface ? itemsOnTop(placed(), orig) : [];
    return { hide: new Set([orig.id, ...riders.map((r) => r.id)]), riders, orig };
  }
  function ghost() {
    if (!mode || mode.x == null) return null;
    return { id: mode.id ?? 'ghost', item: mode.item, x: mode.x, y: mode.y ?? 0, rot: mode.rot, wall: mode.wall };
  }
  function scene(now) {
    const r = room(); if (!r) return null;
    const { hide, riders, orig } = movingSet();
    let items = placed().filter((p) => !hide.has(p.id));
    const g = ghost();
    if (g && riders.length && orig && g.rot === orig.rot) items = items.concat(riders.map((q) => ({ ...q, x: q.x + g.x - orig.x, y: q.y + g.y - orig.y })));
    const opts = { ghost: g, ghostBad: g && !mode.valid, selected };
    if (characterRoomId() === roomId) {
      const a = actorFor(roomId);
      a.look = look(); a.name = nickname();
      a.update(now ?? performance.now(), r, placed(), focusMode());
      opts.actor = a.render(now ?? performance.now());
    }
    return { room: r, items, opts };
  }

  /* ---------- placement ---------- */
  function others() {
    const { hide, riders, orig } = movingSet();
    const keepRiders = !(orig && mode && mode.rot === orig.rot);
    return placed().filter((p) => !hide.has(p.id) || (keepRiders && riders.some((q) => q.id === p.id)));
  }
  function updateGhost(X, Y) {
    const it = ITEMS[mode.item];
    if (it.layer === 'wall') {
      let wall, a;
      if (X >= 0) { wall = 'R'; a = X / 32; } else { wall = 'L'; a = -X / 32; }
      // position along the wall, from the back corner. Wall L positions count along wy, R along wx.
      mode.wall = wall;
      mode.x = Math.max(0, Math.min(R - it.w, Math.round(a - it.w / 2)));
      mode.y = 0;
    } else if (it.layer === 'small') {
      let best = null;
      for (const s of others().filter((p) => ITEMS[p.item].surface)) {
        const [wx, wy] = unproject(X, Y, ITEMS[s.item].surface);
        const tx = Math.floor(wx), ty = Math.floor(wy), { w, d } = dims(s);
        if (tx >= s.x && tx < s.x + w && ty >= s.y && ty < s.y + d && (!best || ITEMS[s.item].surface > best.h)) best = { x: tx, y: ty, h: ITEMS[s.item].surface };
      }
      if (best) { mode.x = best.x; mode.y = best.y; }
      else { const [wx, wy] = unproject(X, Y, 0); mode.x = Math.max(0, Math.min(R - 1, Math.floor(wx))); mode.y = Math.max(0, Math.min(R - 1, Math.floor(wy))); }
    } else {
      const [wx, wy] = unproject(X, Y, 0);
      const { w, d } = dims({ item: mode.item, rot: mode.rot });
      mode.x = Math.max(0, Math.min(R - w, Math.round(wx - w / 2)));
      mode.y = Math.max(0, Math.min(R - d, Math.round(wy - d / 2)));
    }
    const res = canPlace(others(), ghost());
    mode.valid = res.ok; mode.reason = res.reason;
    renderBar();
  }

  async function confirmPlace() {
    if (!mode || mode.x == null) return;
    if (!mode.valid) return toast(esc(mode.reason || 'That doesn\'t fit there.'));
    const it = ITEMS[mode.item];
    const body = { roomId, x: mode.x, y: mode.y ?? 0, rot: mode.rot, wall: mode.wall };
    try {
      if (mode.kind === 'buy') {
        applyResult(await api('POST', '/api/items', { item: mode.item, ...body }));
        toast(`Placed ${esc(it.name)} <b class="minus">${coinSvg}−${it.price}</b>`);
        if (!(shiftHeld && state.profile.coins >= it.price)) mode = null;
      } else {
        const res = applyResult(await api('PATCH', `/api/items/${mode.id}`, body));
        if (res.stored) toast(`${res.stored} item${res.stored > 1 ? 's' : ''} from the top went into storage.`);
        selected = mode.id; mode = null;
      }
    } catch (e) { errorToast(e); }
    render();
  }

  function startBuy(itemId) {
    const it = ITEMS[itemId];
    if (it.tier && state.profile.tier < it.tier) return toast(`${esc(it.name)} unlocks at <b>${TIERS[it.tier].name}</b> independence. Do more work without AI to get there.`);
    if (state.profile.coins < it.price) return toast(`You need ${it.price - state.profile.coins} more coins for the ${esc(it.name.toLowerCase())}. Go study!`);
    mode = { kind: 'buy', item: itemId, rot: 0, x: null, valid: false };
    selected = null; render();
  }
  function startMove(p) { mode = { kind: 'move', id: p.id, item: p.item, rot: p.rot || 0, x: null, valid: false }; selected = null; render(); }

  function rotate() {
    if (mode) { if (['wall'].includes(ITEMS[mode.item].layer)) return; mode.rot = (mode.rot + 1) % 4; if (mode.x != null) { const res = canPlace(others(), ghost()); mode.valid = res.ok; mode.reason = res.reason; } renderBar(); return; }
    const p = placed().find((q) => q.id === selected);
    if (!p || ITEMS[p.item].layer === 'wall') return;
    // try rotating in place; nudge back inside the room if needed
    const rot = ((p.rot || 0) + 1) % 4, { w, d } = dims({ item: p.item, rot });
    const cand = { ...p, rot, x: Math.min(p.x, R - w), y: Math.min(p.y, R - d) };
    const res = canPlace(placed(), cand);
    if (!res.ok) return toast(esc(res.reason) + ' Try moving it first.');
    api('PATCH', `/api/items/${p.id}`, { roomId, x: cand.x, y: cand.y, rot, wall: null })
      .then((r) => { applyResult(r); if (r.stored) toast(`${r.stored} item${r.stored > 1 ? 's' : ''} from the top went into storage.`); }).catch(errorToast);
  }
  async function store(p) {
    try { const r = applyResult(await api('PATCH', `/api/items/${p.id}`, { roomId: null })); selected = null; toast(`${esc(ITEMS[p.item].name)} put in storage.` + (r.stored ? ` ${r.stored} item${r.stored > 1 ? 's' : ''} on top went too.` : '')); render(); } catch (e) { errorToast(e); }
  }
  async function sell(p) {
    const it = ITEMS[p.item], back = Math.floor(it.price * SELL_BACK);
    if (!(await confirmBox({ title: `Sell the ${esc(it.name.toLowerCase())}?`, body: `You'll get ${back} coins back (half the price).`, yes: `Sell for ${back}` }))) return;
    try { applyResult(await api('DELETE', `/api/items/${p.id}`)); selected = null; toast(`Sold ${esc(it.name)} <b class="plus">${coinSvg}+${back}</b>`); render(); } catch (e) { errorToast(e); }
  }

  /* ---------- pointer + keys ---------- */
  canvas.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
  canvas.addEventListener('pointermove', (e) => {
    const [X, Y] = live.toIso(e);
    if (mode) { if (e.pointerType !== 'touch') updateGhost(X, Y); return; }
    canvas.style.cursor = pickItem(X, Y, placed()) ? 'pointer' : 'default';
  });
  canvas.addEventListener('click', (e) => {
    const [X, Y] = live.toIso(e);
    shiftHeld = e.shiftKey;
    if (mode) {
      if (lastPointer === 'touch') {
        // on touch: first tap previews, a second tap on the same spot confirms
        const before = JSON.stringify([mode.x, mode.y, mode.wall]);
        updateGhost(X, Y);
        if (before !== JSON.stringify([mode.x, mode.y, mode.wall])) return;
      }
      confirmPlace(); return;
    }
    const a = currentActor(roomId);
    if (a && characterRoomId() === roomId && a.hit(X, Y)) { a.poke(); return; }
    const p = pickItem(X, Y, placed());
    selected = p ? p.id : null; renderBar();
  });
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rotate(); }
    else if (e.key === 'Escape') { mode = null; selected = null; render(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { const p = placed().find((q) => q.id === selected); if (p) store(p); }
  };
  document.addEventListener('keydown', onKey);

  /* ---------- UI ---------- */
  function renderHead() {
    const r = room();
    $('#roomTitle', el).textContent = ROOM_TYPES[r.type].name;
    $('#roomTabs', el).innerHTML = state.home.rooms.map((x) => `<a class="pill ${x.id === roomId ? 'on' : ''}" href="#/room/${x.id}">${esc(ROOM_TYPES[x.type].name)}</a>`).join('');
  }
  function renderBar() {
    const bar = $('#stageBar', el);
    if (mode) {
      const it = ITEMS[mode.item];
      const what = mode.kind === 'buy' ? `Placing <b>${esc(it.name)}</b> · ${coinSvg}${it.price}` : `Moving <b>${esc(it.name)}</b>`;
      const how = mode.x == null ? (lastPointer === 'touch' ? 'Tap a spot to preview, then tap it again to place.' : 'Point at the room to choose a spot.')
        : mode.valid ? (lastPointer === 'touch' ? 'Tap again to place it here.' : 'Click to place.' + (mode.kind === 'buy' ? ' Hold Shift to place another.' : ''))
          : `<span class="bad">${esc(mode.reason || 'That doesn\'t fit there.')}</span>`;
      bar.innerHTML = `<img src="${thumb(mode.item)}" alt="" width="40" height="40"><div class="grow"><div>${what}</div><small>${how}</small></div>
        ${it.layer !== 'wall' ? `<button class="btn small" id="bRot">${icon('rotate')} Rotate <kbd>R</kbd></button>` : ''}<button class="btn small ghost" id="bCancel">Cancel <kbd>Esc</kbd></button>`;
      $('#bRot', bar)?.addEventListener('click', rotate);
      $('#bCancel', bar).onclick = () => { mode = null; render(); };
      return;
    }
    const p = selected && placed().find((q) => q.id === selected);
    if (p) {
      const it = ITEMS[p.item];
      bar.innerHTML = `<img src="${thumb(p.item)}" alt="" width="40" height="40"><div class="grow"><b>${esc(it.name)}</b><small>${it.surface ? 'Small things can sit on top of this.' : ''}</small></div>
        ${it.layer !== 'wall' ? `<button class="btn small" id="bRot">${icon('rotate')} Rotate</button>` : ''}
        <button class="btn small" id="bMove">${icon('move')} Move</button>
        <button class="btn small" id="bStore">${icon('box')} Put away</button>
        <button class="btn small ghost" id="bSell">Sell · ${Math.floor(it.price * SELL_BACK)}</button>`;
      $('#bRot', bar)?.addEventListener('click', rotate);
      $('#bMove', bar).onclick = () => startMove(p);
      $('#bStore', bar).onclick = () => store(p);
      $('#bSell', bar).onclick = () => sell(p);
      return;
    }
    const away = characterRoomId() !== roomId ? ` ${esc(nickname())} is focusing in the ${esc(roomName(characterRoomId()).toLowerCase())} right now.` : ` Click ${esc(nickname())} to say hi.`;
    bar.innerHTML = `<div class="grow muted">Pick something from the shop, or click a piece of furniture to move it.${away}</div>`;
  }

  function renderCatalog() {
    const stored = state.home.items.filter((i) => i.roomId == null);
    const type = room().type, shop = ROOM_SHOPS[type];
    const roomName = ROOM_TYPES[type].name;
    // This room's own shop, split by where things go, plus basics that suit any room.
    const groups = {
      furniture: shop.items.filter((i) => ['floor', 'rug'].includes(ITEMS[i].layer)),
      small: shop.items.filter((i) => ITEMS[i].layer === 'small'),
      walls: shop.items.filter((i) => ITEMS[i].layer === 'wall'),
      basics: BASICS,
    };
    const tabs = [['furniture', `${roomName} furniture`], ['small', 'Small things'], ['walls', 'On the walls'], ['basics', 'Basics'],
      ['wallpaper', 'Wallpaper'], ['floor', 'Flooring'], ['storage', `Put away${stored.length ? ` (${stored.length})` : ''}`]]
      .filter(([k]) => !groups[k] || groups[k].length);
    if (!tabs.some(([k]) => k === tab)) tab = 'furniture';
    $('#catTabs', el).innerHTML = tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${n}</button>`).join('');
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderCatalog(); }));
    const grid = $('#catGrid', el);
    const p = state.profile;
    if (tab === 'wallpaper' || tab === 'floor') {
      const defs = tab === 'wallpaper' ? WALLPAPERS : FLOORS, kind = tab === 'wallpaper' ? 'wp' : 'fl';
      const current = tab === 'wallpaper' ? room().wallpaper : room().floor;
      const picks = tab === 'wallpaper' ? shop.wallpapers : shop.floors;
      const ordered = [...picks.map((id) => [id, defs[id]]), ...Object.entries(defs).filter(([id]) => !picks.includes(id))];
      grid.innerHTML = ordered.map(([id, d]) => {
        const owned = d.price === 0 || state.home.styles.includes(kind + ':' + id);
        const locked = !owned && d.tier && p.tier < d.tier;
        const label = id === current ? '<span class="chip ok">In use</span>' : owned ? '<span class="chip">Owned</span>' : locked ? `<span class="lock">${icon('lock')} ${TIERS[d.tier].name}</span>` : `<span class="price ${p.coins < d.price ? 'short' : ''}">${coinSvg}${d.price}</span>`;
        const suits = picks.includes(id) ? `<span class="suits">Suits a ${esc(roomName.toLowerCase())}</span>` : '';
        return `<button class="shop-item swatch-item ${locked ? 'locked' : ''} ${id === current ? 'on' : ''}" data-style="${id}">${suits}<img src="${swatch(kind, id)}" alt=""><span class="name">${esc(d.name)}</span>${label}</button>`;
      }).join('');
      grid.querySelectorAll('[data-style]').forEach((b) => (b.onclick = async () => {
        const d = defs[b.dataset.style];
        const owned = d.price === 0 || state.home.styles.includes(kind + ':' + b.dataset.style);
        if (!owned && d.tier && p.tier < d.tier) return toast(`${esc(d.name)} unlocks at ${TIERS[d.tier].name} independence.`);
        if (!owned && p.coins < d.price) return toast(`You need ${d.price - p.coins} more coins.`);
        try {
          const r = applyResult(await api('POST', `/api/rooms/${roomId}/style`, { kind: tab, id: b.dataset.style }));
          if (r.bought) toast(`Bought ${esc(d.name)} <b class="minus">${coinSvg}−${d.price}</b>. You can reuse it in any room.`);
        } catch (e) { errorToast(e); }
      }));
      return;
    }
    if (tab === 'storage') {
            const byItem = {};
      for (const s of stored) (byItem[s.item] ||= []).push(s);
      const entries = Object.entries(byItem).sort(([a], [b]) => allowedIn(type, b) - allowedIn(type, a));
      grid.innerHTML = entries.length ? entries.map(([id, list]) => {
        const fits = allowedIn(type, id), home = homeOf(id);
        return `<button class="shop-item ${fits ? '' : 'locked'}" data-stored="${list[0].id}"><img src="${thumb(id)}" alt=""><span class="name">${esc(ITEMS[id].name)}</span>${fits ? `<span class="chip">×${list.length}</span>` : `<span class="lock">For a ${esc(ROOM_TYPES[home]?.name.toLowerCase() || 'other room')}</span>`}</button>`;
      }).join('') : '<p class="muted empty-note">Nothing in storage. Furniture you put away waits here, ready to place again.</p>';
      grid.querySelectorAll('[data-stored]').forEach((b) => (b.onclick = () => {
        const s = stored.find((x) => x.id === +b.dataset.stored);
        if (!allowedIn(type, s.item)) return toast(`The ${esc(ITEMS[s.item].name.toLowerCase())} belongs in a ${esc(ROOM_TYPES[homeOf(s.item)]?.name.toLowerCase() || 'different room')}.`);
        startMove(s);
      }));
      return;
    }
    grid.innerHTML = groups[tab].map((id) => [id, ITEMS[id]]).map(([id, it]) => {
      const locked = it.tier && p.tier < it.tier;
      return `<button class="shop-item ${locked ? 'locked' : ''} ${mode?.item === id && mode.kind === 'buy' ? 'on' : ''}" data-buy="${id}">
        <img src="${thumb(id)}" alt=""><span class="name">${esc(it.name)}</span>
        ${locked ? `<span class="lock">${icon('lock')} ${TIERS[it.tier].name}</span>` : `<span class="price ${p.coins < it.price ? 'short' : ''}">${coinSvg}${it.price}</span>`}
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => startBuy(b.dataset.buy)));
  }

  function render() {
    if (!room()) { location.hash = '#/home'; return; }
    renderHead(); renderBar(); renderCatalog();
  }
  render();
  const unsub = subscribe(() => { if (state.home) render(); });
  return () => { unsub(); live.destroy(); document.removeEventListener('keydown', onKey); };
}
