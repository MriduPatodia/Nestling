import { api } from '../api.js';
import { state, applyResult, subscribe } from '../store.js';
import { esc, $, icon, coinSvg, toast, errorToast, modal, ICONS } from '../ui.js';
import { ACTIONS, TIERS, FREEZE_COST, MAX_FREEZES } from '/shared/catalog.js';

const GOAL_LABELS = { focus: 'Focus minutes', cards: 'Flashcards reviewed', quiz: 'Quiz questions answered', indep: 'Independent tasks' };
const GOAL_MAX = { focus: 600, cards: 300, quiz: 200, indep: 30 };

export function mount(el) {
  let data = null;
  const load = () => api('GET', '/api/progress').then((d) => { data = d; render(); }).catch(errorToast);

  function chart(week) {
    const W = 560, H = 170, pad = 24, bw = 46, gap = (W - 7 * bw) / 7;
    const max = Math.max(10, ...week.map((d) => d.ai + d.ind));
    const sc = (H - pad - 18) / max;
    let s = `<line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" class="axis"/>`;
    week.forEach((d, i) => {
      const x = gap / 2 + i * (bw + gap), hi = d.ind * sc, ha = d.ai * sc;
      if (hi) s += `<rect x="${x}" y="${H - pad - hi}" width="${bw}" height="${hi}" rx="5" class="b-ind"><title>${d.ind} independent</title></rect>`;
      if (ha) s += `<rect x="${x}" y="${H - pad - hi - ha}" width="${bw}" height="${ha}" rx="5" class="b-ai"><title>${d.ai} AI-assisted</title></rect>`;
      if (hi + ha) s += `<text x="${x + bw / 2}" y="${H - pad - hi - ha - 5}" text-anchor="middle" class="val">${d.ind + d.ai}</text>`;
      const lab = i === 6 ? 'Today' : new Date(d.day + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
      s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${lab}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Independent and AI-assisted work over the last 7 days">${s}</svg>`;
  }

  function render() {
    const p = state.profile; if (!p || !data) return;
    const T = TIERS[p.tier], N = TIERS[p.tier + 1];
    const tot = data.week.reduce((a, d) => ({ ai: a.ai + d.ai, ind: a.ind + d.ind }), { ai: 0, ind: 0 });
    const pct = tot.ai + tot.ind ? Math.round((tot.ind / (tot.ai + tot.ind)) * 100) : null;
    const goals = Object.entries(p.goals).filter(([, n]) => n > 0);
    el.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">Daily goals, streaks and independence</p><h1>Progress</h1></div></div>
    <div class="prog-grid">
      <section class="card streak-card">
        <div class="streak-flame">${ICONS.flame}</div>
        <div><div class="big-num">${p.streak}</div><p class="muted">day streak · best ${p.best}</p></div>
        <div class="mult-box"><b>×${p.multiplier.toFixed(1)}</b><span>coin multiplier</span></div>
        <p class="hint">Finish all your daily goals to grow the streak. Each streak day adds ×0.1 to every coin you earn, up to ×2.0.</p>
        <div class="row between freeze"><div><b>${p.freezes} / ${MAX_FREEZES} streak freezes</b><p class="hint">A freeze saves your streak if you miss a day.</p></div>
          <button class="btn small gold" id="buyFreeze" ${p.coins < FREEZE_COST || p.freezes >= MAX_FREEZES ? 'disabled' : ''}>Buy · ${coinSvg}${FREEZE_COST}</button></div>
      </section>

      <section class="card span2">
        <div class="row between"><div><p class="eyebrow">Today</p><h3>Finish every goal to open the chest</h3></div>
          <div class="chest ${p.day.chest ? 'open' : ''}" title="${p.day.chest ? 'Opened today' : 'Locked until all goals are done'}">${ICONS.chest}<span>${p.day.chest ? 'Opened!' : '25 coins'}</span></div></div>
        <div class="goals big">${goals.map(([k, n]) => { const v = Math.min(p.day[k] || 0, n); return `<div class="goal ${v >= n ? 'done' : ''}"><span>${GOAL_LABELS[k]}</span><span class="num">${v}/${n}</span><div class="bar"><i style="width:${(v / n) * 100}%"></i></div></div>`; }).join('')}</div>
        <details class="settings"><summary>Change my goals</summary>
          <form class="grid4" id="goalForm">${Object.keys(GOAL_LABELS).map((k) => `<label class="f">${GOAL_LABELS[k]}<input type="number" name="${k}" min="0" max="${GOAL_MAX[k]}" value="${p.goals[k]}"></label>`).join('')}
          <div class="span-all row"><button class="btn small primary">Save goals</button><span class="hint">Set a goal to 0 to switch it off. "Independent tasks" counts things you do without AI.</span></div></form>
        </details>
      </section>

      <section class="card span2">
        <div class="row between"><div><p class="eyebrow">Progressive independence</p><h3>${esc(T.name)}</h3></div>
          <div class="pct"><b>${pct === null ? '–' : pct + '%'}</b><span>independent this week</span></div></div>
        <div class="tiers">${TIERS.map((t, i) => `<div class="${i <= p.tier ? 'on' : ''}"><b>${t.name}</b><small>AI pays ${Math.round(t.aiRate * 100)}%</small></div>`).join('')}</div>
        <div class="bar"><i style="width:${N ? ((p.indXP - T.xp) / (N.xp - T.xp)) * 100 : 100}%"></i></div>
        <p class="hint">${N ? `${p.indXP} independence XP. ${N.xp - p.indXP} more to reach <b>${N.name}</b>, which unlocks new rooms and furniture.` : `${p.indXP} independence XP. You've reached the top level.`} You earn XP from your own notes, cards and questions, from recalling cards, and from answering without hints.</p>
        <div class="notice">At <b>${esc(T.name)}</b>, AI-assisted work pays <b>${Math.round(T.aiRate * 100)}%</b> of its usual coins${N ? `, dropping to ${Math.round(N.aiRate * 100)}% at ${N.name}` : ''}. Work you do yourself always pays in full. The more independent you get, the more doing it yourself pays off.</div>
        ${chart(data.week)}
        <div class="legend"><span><i class="k-ind"></i>Independent work</span><span><i class="k-ai"></i>AI-assisted work</span></div>
      </section>

      <section class="card">
        <h3>Recent coins</h3>
        <div class="log">${data.log.map((l) => `<div><span>${esc(l.label)} ${l.kind === 'ind' ? '<span class="tag ind">yours</span>' : l.kind === 'ai' ? '<span class="tag ai">AI</span>' : ''}</span><span class="pay">${l.coins ? '+' + l.coins : '·'}</span></div>`).join('') || '<p class="muted">Nothing yet. Start a focus session or write some notes.</p>'}</div>
      </section>

      <section class="card span2 table-card">
        <h3>How coins are earned</h3>
        <div class="table-scroll"><table>
          <thead><tr><th>Area</th><th>Action</th><th>Type</th><th class="n">Base</th><th class="n">You get now</th></tr></thead>
          <tbody>${Object.values(ACTIONS).filter((a) => !a.hidden).map((a) => {
            const now = Math.round(a.base * (a.kind === 'ai' ? p.aiRate : 1) * p.multiplier);
            return `<tr><td>${a.area}</td><td>${a.desc}</td><td>${a.kind === 'ind' ? '<span class="tag ind">yours</span>' : a.kind === 'ai' ? '<span class="tag ai">AI</span>' : '<span class="tag">neutral</span>'}</td><td class="n">${a.base}</td><td class="n">${now}</td></tr>`;
          }).join('')}</tbody></table></div>
        <p class="hint">Some actions only pay a set number of times per day, so you can't farm coins by repeating them.</p>
      </section>

      <section class="card">
        <h3>Your account</h3>
        <p class="muted">Signed in as <b>${esc(state.user.username)}</b>. Your notes, chats and home are private to your account.</p>
        <button class="btn small ghost danger-text" id="delAcct">${icon('trash')} Delete my account</button>
      </section>
    </div>`;

    $('#buyFreeze', el).onclick = async () => { try { applyResult(await api('POST', '/api/freeze')); toast('Streak freeze bought.'); } catch (e) { errorToast(e); } };
    $('#goalForm', el).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const goals = Object.fromEntries([...f.entries()].map(([k, v]) => [k, Math.round(+v || 0)]));
      try { applyResult(await api('PATCH', '/api/profile', { goals })); toast('Goals saved.'); } catch (err) { errorToast(err); }
    };
    $('#delAcct', el).onclick = () => {
      const m = modal(`<h3>Delete your account?</h3><p>This permanently deletes your notes, flashcards, chats, coins and home. It can't be undone.</p>
        <label class="f">Type your password to confirm<input type="password" id="dp" autocomplete="current-password"></label>
        <div class="row end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="dGo">Delete everything</button></div>`);
      $('#dGo', m.el).onclick = async () => {
        try { await api('POST', '/api/me/delete', { password: $('#dp', m.el).value }); location.hash = '#/'; location.reload(); } catch (e) { errorToast(e); }
      };
    };
  }

  load();
  const unsub = subscribe(() => load());
  return unsub;
}
