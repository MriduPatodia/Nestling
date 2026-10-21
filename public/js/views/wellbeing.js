import { api } from '../api.js';
import { applyResult } from '../store.js';
import { esc, $, icon, toast, errorToast, confirmBox } from '../ui.js';
import { MOODS, STRESS, BODY, TOPICS, PROMPTS } from '/shared/wellbeing.js';

// Mood faces: mouth curve goes from frown (1) to big smile (5).
const MOOD_COLORS = ['#C7695B', '#D9965A', '#D9BC5A', '#8DBF6A', '#4FAE7A'];
function face(n, size = 44) {
  const curve = [-7, -3.5, 0, 4, 7][n - 1];
  return `<svg viewBox="0 0 44 44" width="${size}" height="${size}" aria-hidden="true"><circle cx="22" cy="22" r="19" fill="${MOOD_COLORS[n - 1]}" stroke="currentColor" stroke-width="2"/>
    <circle cx="15.5" cy="18" r="2.4" fill="currentColor"/><circle cx="28.5" cy="18" r="2.4" fill="currentColor"/>
    <path d="M13 ${28 - curve / 2} Q22 ${28 + curve} 31 ${28 - curve / 2}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

// Words that suggest someone might be in danger. If they show up, we gently point to real people who can help.
const CRISIS = /\b(kill(ing)? myself|suicid\w*|end (it all|my life)|want(ed)? to die|don'?t want to (live|be here)|hurt(ing)? myself|self[- ]?harm|cut(ting)? myself)\b/i;
const supportCard = () => `<div class="support-card" role="alert">
  <b>It sounds like things are really hard right now.</b>
  <p>You don't have to handle this alone. Please talk to someone today:</p>
  <ul><li>Samaritans of Singapore, 24 hours: <b>1767</b></li><li>IMH Mental Health Helpline, 24 hours: <b>6389 2222</b></li><li>If you're in danger right now, call <b>995</b></li></ul>
  <a class="btn small light" href="https://www.nhghealth.com.sg/imh/chat/get-help" target="_blank" rel="noopener noreferrer">Chat anonymously with IMH ↗</a>
</div>`;

const fmtDay = (d) => new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function mount(el) {
  let data = null, editing = false, draft = null, promptIdx = Math.floor(Math.random() * PROMPTS.length), mode = 'keep';
  let breath = null, groundStep = 0, tool = 'breathe';

  el.innerHTML = `
  <div class="page-head"><div><p class="eyebrow">Daily check-in</p><h1>How are you today?</h1></div></div>
  <div class="well-grid">
    <section class="card" id="checkCard"></section>
    <section class="card calm" id="calmCard"></section>
    <section class="card span-2" id="journalCard"></section>
    <section class="card" id="trendCard"></section>
    <section class="card" id="pastCard"></section>
  </div>
  <p class="hint center-text privacy-note">${icon('lock')} Your check-ins and journal are private to your account. They are never sent to the AI, and you can delete entries any time.</p>`;

  /* ---------------- check-in ---------------- */
  function renderCheck() {
    const card = $('#checkCard', el);
    const c = data.today;
    if (c && !editing) {
      card.innerHTML = `
        <div class="row between"><h3>Today's check-in</h3><button class="btn small ghost" id="editCheck">Edit</button></div>
        <div class="check-summary">
          ${face(c.mood, 56)}
          <div><b>Feeling ${esc(MOODS[c.mood - 1].toLowerCase())}</b><span>Stress: ${esc(STRESS[c.stress - 1].toLowerCase())}${c.sleep !== null ? ` · ${c.sleep}h sleep` : ''}</span>
          ${c.body.length ? `<span>Body: ${c.body.map(esc).join(', ').toLowerCase()}</span>` : ''}</div>
        </div>
        <div class="suggestions">${suggestions(c)}</div>`;
      $('#editCheck', card).onclick = () => { editing = true; draft = { ...c, body: [...c.body], topics: [...c.topics] }; renderCheck(); };
      card.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => { tool = b.dataset.tool; renderCalm(); $('#calmCard', el).scrollIntoView({ behavior: 'smooth', block: 'center' }); if (tool === 'breathe') startBreath(); }));
      card.querySelectorAll('[data-prompt]').forEach((b) => (b.onclick = () => { promptIdx = +b.dataset.prompt; mode = 'keep'; renderJournal(); $('#journalCard', el).scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#jText', el)?.focus(); }));
      return;
    }
    draft ||= { mood: 0, stress: 0, sleep: '', body: [], topics: [] };
    const chips = (list, key) => list.map((x) => `<button type="button" class="chip-btn" data-${key}="${esc(x)}" aria-pressed="${draft[key].includes(x)}">${esc(x)}</button>`).join('');
    card.innerHTML = `
      <form class="stack" id="checkForm">
        <fieldset><legend>How do you feel?</legend>
          <div class="moods">${MOODS.map((m, i) => `<button type="button" class="mood" data-mood="${i + 1}" aria-pressed="${draft.mood === i + 1}" aria-label="${m}">${face(i + 1)}<span>${m}</span></button>`).join('')}</div></fieldset>
        <fieldset><legend>How stressed are you?</legend>
          <div class="stress">${STRESS.map((s, i) => `<button type="button" data-stress="${i + 1}" aria-pressed="${draft.stress === i + 1}"><i style="height:${8 + i * 6}px"></i>${s}</button>`).join('')}</div></fieldset>
        <label class="f sleep">Hours of sleep last night <input type="number" id="sleep" min="0" max="16" step="0.5" placeholder="e.g. 7" value="${esc(draft.sleep ?? '')}"></label>
        <fieldset><legend>How does your body feel? <small>Stress often shows up here first.</small></legend><div class="chips">${chips(BODY, 'body')}</div></fieldset>
        <fieldset><legend>What's on your mind?</legend><div class="chips">${chips(TOPICS, 'topics')}</div></fieldset>
        <div class="row"><button class="btn primary">Save check-in</button>${editing ? '<button type="button" class="btn ghost" id="cancelEdit">Cancel</button>' : ''}</div>
      </form>`;
    card.querySelectorAll('[data-mood]').forEach((b) => (b.onclick = () => { draft.mood = +b.dataset.mood; renderCheck(); }));
    card.querySelectorAll('[data-stress]').forEach((b) => (b.onclick = () => { draft.stress = +b.dataset.stress; renderCheck(); }));
    for (const key of ['body', 'topics']) card.querySelectorAll(`[data-${key}]`).forEach((b) => (b.onclick = () => {
      const v = b.dataset[key], list = draft[key];
      draft[key] = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
      b.setAttribute('aria-pressed', draft[key].includes(v));
    }));
    $('#sleep', card).oninput = (e) => { draft.sleep = e.target.value; };
    $('#cancelEdit', card)?.addEventListener('click', () => { editing = false; draft = null; renderCheck(); });
    $('#checkForm', card).onsubmit = async (e) => {
      e.preventDefault();
      if (!draft.mood) return toast('Pick how you feel first.');
      if (!draft.stress) return toast('Pick your stress level too.');
      try {
        const r = applyResult(await api('PUT', '/api/checkin', { ...draft, sleep: draft.sleep === '' ? null : Number(draft.sleep) }));
        data.today = r.checkin;
        data.history = data.history.filter((h) => h.day !== r.checkin.day).concat(r.checkin).sort((a, b) => a.day.localeCompare(b.day));
        editing = false; draft = null;
        renderCheck(); renderTrend();
      } catch (err) { errorToast(err); }
    };
  }

  function suggestions(c) {
    const out = [];
    const tense = c.body.some((b) => ['Headache', 'Tight neck or shoulders', 'Stomach ache', 'Racing heart'].includes(b));
    if (c.mood <= 1) out.push(`<div class="sugg warm">${icon('heart')}<div><b>That sounds like a rough day.</b> It might help to talk it through with someone. <a href="#/talk">You can chat anonymously with a trained person</a>, any time.</div></div>`);
    if (c.stress >= 4 || tense) out.push(`<div class="sugg">${icon('sparkle')}<div><b>Stress can show up in your body${tense ? ', like the ' + esc(c.body.filter((b) => b !== 'Relaxed')[0].toLowerCase()) + ' you mentioned' : ''}.</b> Slow breathing can help your body settle. <button class="link-btn" data-tool="breathe">Try 2 minutes of box breathing</button></div></div>`);
    if (c.stress >= 4) out.push(`<div class="sugg">${icon('pencil')}<div><b>Getting worries out of your head can make them feel smaller.</b> <button class="link-btn" data-prompt="1">Write down what's worrying you</button></div></div>`);
    if (c.sleep !== null && c.sleep < 6) out.push(`<div class="sugg">${icon('timer')}<div><b>You slept less than 6 hours.</b> Short sleep can make stress feel bigger. If you can, keep tonight's screen time short and aim for an earlier night.</div></div>`);
    if (c.body.includes('Hard to focus') || c.body.includes('Restless')) out.push(`<div class="sugg">${icon('sparkle')}<div><b>Feeling scattered?</b> <button class="link-btn" data-tool="ground">Try the 5-4-3-2-1 grounding exercise</button>, or take a short walk before your next focus session.</div></div>`);
    if (!out.length) out.push(`<div class="sugg good">${icon('sparkle')}<div><b>Glad you're doing okay.</b> <button class="link-btn" data-prompt="0">Write down three good things about today</button> to hold on to the feeling.</div></div>`);
    return out.join('');
  }

  /* ---------------- calm tools ---------------- */
  const GROUND = [
    ['5', 'things you can see', 'Look around slowly. Name five things you can see right now.'],
    ['4', 'things you can feel', 'Your feet on the floor, your clothes, the chair, the air. Notice four.'],
    ['3', 'things you can hear', 'Listen for three sounds, near or far.'],
    ['2', 'things you can smell', 'Notice two smells. If you can\'t, think of two you like.'],
    ['1', 'thing you can taste', 'Notice one taste, or take a sip of water.'],
  ];
  function renderCalm() {
    const card = $('#calmCard', el);
    stopBreath();
    card.innerHTML = `
      <div class="row between"><h3>Calm down in 2 minutes</h3>
        <div class="seg"><button data-t="breathe" aria-selected="${tool === 'breathe'}">Breathe</button><button data-t="ground" aria-selected="${tool === 'ground'}">Ground</button></div></div>
      <div id="toolBody"></div>`;
    card.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tool = b.dataset.t; groundStep = 0; renderCalm(); }));
    const body = $('#toolBody', card);
    if (tool === 'breathe') {
      body.innerHTML = `
        <div class="box-breath" aria-hidden="true"><div class="box"><i id="dot"></i></div><div class="breath-label" id="bLabel">Ready?</div></div>
        <p class="hint center-text" id="bHint">Box breathing: breathe in for 4, hold for 4, out for 4, hold for 4. It slows your heart rate and tells your body it's safe.</p>
        <div class="row center"><button class="btn primary" id="bGo">Start</button></div>`;
      $('#bGo', body).onclick = () => (breath ? stopBreath(true) : startBreath());
    } else {
      const [n, what, how] = GROUND[groundStep] || [];
      body.innerHTML = groundStep < GROUND.length ? `
        <div class="ground"><div class="ground-n">${n}</div><div><b>${what}</b><p>${how}</p></div></div>
        <div class="progress-dots">${GROUND.map((_, i) => `<i class="${i < groundStep ? 'on' : i === groundStep ? 'now' : ''}"></i>`).join('')}</div>
        <div class="row center">${groundStep ? '<button class="btn ghost" id="gBack">Back</button>' : ''}<button class="btn primary" id="gNext">${groundStep === GROUND.length - 1 ? 'Done' : 'Next'}</button></div>`
        : `<div class="empty"><h3>Nicely done.</h3><p class="muted">Take one more slow breath before you go back to what you were doing.</p><button class="btn" id="gAgain">Start again</button></div>`;
      $('#gNext', body)?.addEventListener('click', () => { groundStep++; renderCalm(); });
      $('#gBack', body)?.addEventListener('click', () => { groundStep--; renderCalm(); });
      $('#gAgain', body)?.addEventListener('click', () => { groundStep = 0; renderCalm(); });
    }
  }
  function startBreath() {
    const card = $('#calmCard', el);
    if (!$('#dot', card)) return;
    const phases = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
    const t0 = performance.now(), total = 8 * 16000; // 8 rounds, about 2 minutes
    $('#bGo', card).textContent = 'Stop';
    const box = $('.box', card);
    const tick = (now) => {
      const t = now - t0;
      if (t >= total) { stopBreath(true); $('#bLabel', card).textContent = 'Well done'; return; }
      const phase = Math.floor((t % 16000) / 4000), within = (t % 4000) / 4000;
      const left = 4 - Math.floor(within * 4);
      $('#bLabel', card).innerHTML = `${phases[phase]}<small>${left}</small>`;
      // dot travels around the square: up the left, across the top, down the right, back along the bottom
      const p = [[0, 1 - within], [within, 0], [1, within], [1 - within, 1]][phase];
      $('#dot', card).style.left = p[0] * 100 + '%'; $('#dot', card).style.top = p[1] * 100 + '%';
      box.style.setProperty('--fill', phase === 0 ? within : phase === 2 ? 1 - within : phase === 1 ? 1 : 0);
      breath = requestAnimationFrame(tick);
    };
    breath = requestAnimationFrame(tick);
  }
  function stopBreath(resetButton) {
    if (breath) cancelAnimationFrame(breath);
    breath = null;
    if (resetButton) { const b = $('#bGo', el); if (b) b.textContent = 'Start again'; }
  }

  /* ---------------- journal ---------------- */
  function renderJournal() {
    const card = $('#journalCard', el);
    const keep = mode === 'keep';
    card.innerHTML = `
      <div class="row between"><h3>Journal</h3>
        <div class="seg"><button data-m="keep" aria-selected="${keep}">Write & keep</button><button data-m="dump" aria-selected="${!keep}">Worry dump</button></div></div>
      ${keep ? `<div class="prompt"><span>${esc(PROMPTS[promptIdx])}</span><button class="btn small ghost" id="newPrompt">Another prompt</button></div>`
        : '<p class="prompt"><span>Write down everything that\'s bothering you, as messily as you like. When you\'re done, let it go: it gets deleted, not saved.</span></p>'}
      <div class="journal-wrap"><textarea id="jText" rows="7" placeholder="${keep ? 'Start writing…' : 'Get it all out…'}"></textarea></div>
      <div id="jSupport"></div>
      <div class="row">${keep ? '<button class="btn primary" id="jSave">Save entry</button>' : '<button class="btn primary" id="jDump">Let it go</button>'}<span class="hint">${keep ? 'Only you can see your entries.' : 'Nothing you write here is stored.'}</span></div>`;
    card.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; renderJournal(); }));
    $('#newPrompt', card)?.addEventListener('click', () => { promptIdx = (promptIdx + 1) % PROMPTS.length; renderJournal(); });
    const ta = $('#jText', card);
    const check = () => { $('#jSupport', card).innerHTML = CRISIS.test(ta.value) ? supportCard() : ''; };
    ta.oninput = check;
    $('#jSave', card)?.addEventListener('click', async () => {
      check();
      try {
        const r = applyResult(await api('POST', '/api/journal', { prompt: PROMPTS[promptIdx], text: ta.value }));
        data.entries.unshift(r.entry);
        if (!r.rewards.length) toast('Saved.');
        const flagged = CRISIS.test(ta.value);
        ta.value = '';
        if (!flagged) $('#jSupport', card).innerHTML = '';
        renderPast();
      } catch (e) { errorToast(e); }
    });
    $('#jDump', card)?.addEventListener('click', () => {
      if (!ta.value.trim()) return toast('Write something first, then let it go.');
      check();
      const wrap = $('.journal-wrap', card);
      wrap.classList.add('releasing');
      setTimeout(() => { ta.value = ''; wrap.classList.remove('releasing'); toast('Gone. You don\'t have to carry that around right now.'); }, 1300);
    });
  }

  function renderPast() {
    const card = $('#pastCard', el);
    const list = data.entries;
    card.innerHTML = `<h3>Past entries</h3>
      <div class="entries">${list.length ? list.map((e) => `<details class="entry"><summary><span>${esc(fmtDay(e.day))}</span><span class="muted">${esc(e.text.slice(0, 60))}${e.text.length > 60 ? '…' : ''}</span></summary>
        ${e.prompt ? `<p class="hint">${esc(e.prompt)}</p>` : ''}<p class="entry-text">${esc(e.text)}</p>
        <button class="btn small ghost" data-del="${e.id}">${icon('trash')} Delete</button></details>`).join('') : '<p class="muted">Your saved entries will appear here.</p>'}</div>`;
    card.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox({ title: 'Delete this entry?', body: 'It will be gone for good.', yes: 'Delete', danger: true }))) return;
      try { await api('DELETE', `/api/journal/${b.dataset.del}`); data.entries = data.entries.filter((x) => x.id !== +b.dataset.del); renderPast(); } catch (e) { errorToast(e); }
    }));
  }

  /* ---------------- trends ---------------- */
  function renderTrend() {
    const card = $('#trendCard', el);
    const byDay = Object.fromEntries(data.history.map((h) => [h.day, h]));
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(data.day + 'T12:00'); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
    const W = 420, H = 170, L = 26, B = 22, T = 10, step = (W - L - 10) / 13;
    const x = (i) => L + i * step, y = (v) => T + (H - T - B) * (1 - (v - 1) / 4);
    const line = (key, cls) => {
      const pts = days.map((d, i) => byDay[d] ? [x(i), y(byDay[d][key])] : null);
      let path = '', on = false;
      for (const p of pts) { if (!p) { on = false; continue; } path += (on ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); on = true; }
      return `<path d="${path}" class="${cls}"/>` + pts.filter(Boolean).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="${cls}-dot"/>`).join('');
    };
    const sleepBars = days.map((d, i) => byDay[d]?.sleep != null ? `<rect x="${x(i) - 5}" y="${H - B - Math.min(12, byDay[d].sleep) / 12 * (H - T - B)}" width="10" height="${Math.min(12, byDay[d].sleep) / 12 * (H - T - B)}" rx="2" class="t-sleep"><title>${byDay[d].sleep}h sleep</title></rect>` : '').join('');
    const grid = [1, 3, 5].map((v) => `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" class="t-grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const labels = days.map((d, i) => (i % 3 === 1 || i === 13) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${i === 13 ? 'Today' : new Date(d + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text>` : '').join('');
    // A simple pattern from her own data, only once there's enough of it.
    const withSleep = data.history.filter((h) => h.sleep != null);
    const short = withSleep.filter((h) => h.sleep < 6), enough = withSleep.filter((h) => h.sleep >= 6);
    const avg = (a) => a.reduce((s, h) => s + h.stress, 0) / a.length;
    let insight = data.history.length < 3 ? 'Check in for a few days to start seeing patterns.' : '';
    if (short.length >= 2 && enough.length >= 2) {
      const d = avg(short) - avg(enough);
      if (d >= 0.5) insight = `On days after less than 6 hours of sleep, your stress was higher (${avg(short).toFixed(1)} vs ${avg(enough).toFixed(1)} out of 5).`;
      else if (d <= -0.5) insight = `Interesting: your stress hasn't been higher after short nights so far.`;
    }
    card.innerHTML = `<h3>Last 14 days</h3>
      <svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mood, stress and sleep over the last 14 days">${grid}${sleepBars}${line('stress', 't-stress')}${line('mood', 't-mood')}${labels}</svg>
      <div class="legend"><span><i class="k-mood"></i>Mood</span><span><i class="k-stress"></i>Stress</span><span><i class="k-sleep"></i>Sleep</span></div>
      ${insight ? `<p class="hint">${esc(insight)}</p>` : ''}`;
  }

  api('GET', '/api/wellbeing').then((d) => {
    data = d;
    renderCheck(); renderCalm(); renderJournal(); renderTrend(); renderPast();
  }).catch(errorToast);
  return () => stopBreath();
}
