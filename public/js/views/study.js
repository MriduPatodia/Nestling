import { APP_NAME } from '/shared/brand.js';
import { api, stream } from '../api.js';
import { state, applyResult, subscribe } from '../store.js';
import { esc, $, md, icon, coinSvg, toast, errorToast, modal, confirmBox, words } from '../ui.js';
import { ACTIONS } from '/shared/catalog.js';

const LEVELS = ['Primary school', 'Secondary school', 'Junior college / A-levels', 'Polytechnic / diploma', 'University'];
const STYLES = ['short bullet points', 'worked examples', 'simple analogies', 'question-and-answer format', 'step-by-step explanations'];

/** Coins an action would pay right now (after streak multiplier and AI rate). */
export function coinsFor(action, base) {
  const a = ACTIONS[action], p = state.profile;
  return Math.round((base ?? a.base) * (a.kind === 'ai' ? p.aiRate : 1) * p.multiplier);
}
const pay = (action, base) => `<span class="pay">${coinSvg}+${coinsFor(action, base)}</span>`;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const aiOff = () => `<div class="notice">${icon('sparkle')} The AI tutor is switched off on this server. Whoever runs ${esc(APP_NAME)} needs to add an OpenRouter key to the <code>.env</code> file. You can still write your own notes, cards and questions, and those earn the most coins.</div>`;

export function mount(el, [idStr, tabParam]) {
  let sets = [], set = null, tab = tabParam || 'notes';
  let review = null, quizRun = null, busy = false, abort = null;

  el.innerHTML = `
  <div class="page-head"><div><p class="eyebrow">AI study tutor</p><h1>Study</h1></div>
    <button class="btn primary" id="newSet">${icon('plus')} New study set</button></div>
  <div class="study-grid">
    <aside class="stack">
      <div class="card"><h3>Your sets</h3><div class="set-list" id="setList"><p class="muted">Loading…</p></div></div>
      <div class="card stack">
        <h3>Personalise your tutor</h3>
        <label class="f">My level<select id="pLevel">${LEVELS.map((l) => `<option>${l}</option>`).join('')}</select></label>
        <label class="f">I learn best with<select id="pStyle">${STYLES.map((l) => `<option>${l}</option>`).join('')}</select></label>
      </div>
    </aside>
    <section class="card set-pane" id="pane"></section>
  </div>`;
  $('#pLevel', el).value = state.profile.prefs.level;
  $('#pStyle', el).value = state.profile.prefs.style;
  $('#pLevel', el).onchange = (e) => api('PATCH', '/api/profile', { prefs: { level: e.target.value } }).then(applyResult).then(() => toast('Your tutor will now write for that level.')).catch(errorToast);
  $('#pStyle', el).onchange = (e) => api('PATCH', '/api/profile', { prefs: { style: e.target.value } }).then(applyResult).then(() => toast('Got it. Your tutor will use that style.')).catch(errorToast);
  $('#newSet', el).onclick = newSetDialog;

  async function loadSets() {
    sets = (await api('GET', '/api/sets')).sets;
    renderList();
  }
  function renderList() {
    $('#setList', el).innerHTML = sets.length ? sets.map((s) => `<a class="set-item ${set?.id === s.id ? 'on' : ''}" href="#/study/${s.id}/${tab}">
      <b>${esc(s.title)}</b><small>${s.cards} cards · ${s.quiz} questions</small></a>`).join('') : '<p class="muted">No sets yet. Make one for each topic you\'re studying.</p>';
  }
  async function openSet(id) {
    try { set = (await api('GET', `/api/sets/${id}`)).set; } catch (e) { errorToast(e); set = null; }
    review = null; quizRun = null; renderList(); renderPane();
  }
  function refreshSummary() {
    const s = sets.find((x) => x.id === set.id);
    if (s) { s.cards = set.cards.length; s.quiz = set.quiz.length; s.title = set.title; }
    renderList();
  }

  function newSetDialog() {
    const m = modal(`<h3>New study set</h3>
      <label class="f">Topic<input id="nsT" maxlength="80" placeholder="e.g. Quadratic equations" autofocus></label>
      <label class="f">Class materials <small class="muted">(optional: PDFs, Word, PowerPoint, text, or photos of notes)</small><input type="file" id="nsF" multiple accept="${ACCEPT}"></label>
      <label class="f">Or paste text <small class="muted">(optional)</small><textarea id="nsS" rows="4"></textarea></label>
      <p class="hint" id="nsStatus" aria-live="polite"></p>
      <div class="row end"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="nsGo">Create set</button></div>`);
    $('#nsGo', m.el).onclick = async () => {
      const go = $('#nsGo', m.el), status = $('#nsStatus', m.el);
      go.disabled = true;
      try {
        const { set: s } = await api('POST', '/api/sets', { title: $('#nsT', m.el).value, source: $('#nsS', m.el).value });
        sets.unshift({ id: s.id, title: s.title, cards: 0, quiz: 0 });
        const files = [...$('#nsF', m.el).files];
        for (const [i, file] of files.entries()) {
          status.textContent = `Reading ${file.name} (${i + 1} of ${files.length})…`;
          if (file.size > 15 * 1024 * 1024) { toast(`“${esc(file.name)}” is over 15 MB, so it was skipped.`, 'err'); continue; }
          try { await api('POST', `/api/sets/${s.id}/materials`, { name: file.name, data: await readB64(file) }); }
          catch (e) { toast(`${esc(file.name)}: ${esc(e.message)}`, 'err'); }
        }
        m.close();
        location.hash = `#/study/${s.id}/notes`;
      } catch (e) { errorToast(e); go.disabled = false; status.textContent = ''; }
    };
  }

  /* ---------------- pane ---------------- */
  function renderPane() {
    const pane = $('#pane', el);
    if (!set) {
      pane.innerHTML = `<div class="empty"><h2>Pick a study set</h2><p class="muted">Each set holds notes, flashcards and a quiz for one topic.</p><button class="btn primary" id="emptyNew">${icon('plus')} New study set</button></div>`;
      $('#emptyNew', pane).onclick = newSetDialog; return;
    }
    const tabs = [['notes', 'Notes'], ['cards', `Flashcards · ${set.cards.length}`], ['quiz', `Quiz · ${set.quiz.length}`], ['tutor', 'Ask the tutor']];
    pane.innerHTML = `
      <div class="row between set-head"><div><p class="eyebrow">${set.example ? 'Example set' : 'Study set'}</p><h2>${esc(set.title)}</h2></div>
        <div class="row"><button class="btn small ghost" id="editSet">${icon('pencil')} Edit</button><button class="btn small ghost" id="delSet">${icon('trash')} Delete</button></div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<a role="tab" href="#/study/${set.id}/${k}" aria-selected="${k === tab}">${n}</a>`).join('')}</div>
      <div id="tabBody"></div>`;
    $('#delSet', pane).onclick = async () => {
      if (!(await confirmBox({ title: 'Delete this set?', body: `“${esc(set.title)}” and its notes, cards and quiz will be deleted. Coins you've earned stay.`, yes: 'Delete', danger: true }))) return;
      try { await api('DELETE', `/api/sets/${set.id}`); sets = sets.filter((s) => s.id !== set.id); set = null; location.hash = '#/study'; } catch (e) { errorToast(e); }
    };
    $('#editSet', pane).onclick = () => {
      const m = modal(`<h3>Edit set</h3><label class="f">Topic<input id="eT" maxlength="80" value="${esc(set.title)}"></label>
        <label class="f">Class material the tutor uses<textarea id="eS" rows="8">${esc(set.source)}</textarea></label>
        <div class="row end"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="eGo">Save</button></div>`);
      $('#eGo', m.el).onclick = async () => {
        try { set = (await api('PATCH', `/api/sets/${set.id}`, { title: $('#eT', m.el).value, source: $('#eS', m.el).value })).set; m.close(); refreshSummary(); renderPane(); } catch (e) { errorToast(e); }
      };
    };
    const body = $('#tabBody', pane);
    ({ notes: tabNotes, cards: tabCards, quiz: tabQuiz, tutor: tabTutor })[tab](body);
  }

  /* ---------------- notes ---------------- */
  /* ---------------- uploaded materials ---------------- */
  const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp,.gif';
  const KIND_LABEL = { pdf: 'PDF', docx: 'Word', pptx: 'Slides', text: 'Text', image: 'Photo' };
  let pending = []; // files being read right now
  const usedCount = () => (set.materials || []).filter((m) => m.use).length;
  const genLabel = () => {
    const n = usedCount();
    return n ? `Write notes from ${n === 1 ? 'my file' : `my ${n} files`}` : `${set.notesAi ? 'Rewrite' : 'Write'} notes for me`;
  };
  function materialsHtml() {
    return `<section class="materials" id="mats">
      <div class="row between">
        <div><h3>${icon('file')} Class materials</h3><p class="hint">Upload worksheets, slides, textbook pages or photos of your notes. The tutor uses them for notes, flashcards, quizzes and chat.</p></div>
        <label class="btn" for="matFile" tabindex="0" id="matBtn">${icon('upload')} Upload files</label>
        <input type="file" id="matFile" multiple accept="${ACCEPT}" hidden>
      </div>
      <div class="drop" id="drop"></div>
    </section>`;
  }
  function renderMaterials(root) {
    const drop = $('#drop', root); if (!drop) return;
    const mats = set.materials || [];
    const rows = mats.map((m) => `<div class="mat ${m.use ? '' : 'off'}">
        <input type="checkbox" data-use="${m.id}" ${m.use ? 'checked' : ''} aria-label="Use ${esc(m.name)} for AI notes and quizzes">
        <span class="kind k-${m.kind}">${KIND_LABEL[m.kind] || 'File'}</span>
        <span class="mat-name">${esc(m.name)}<small>${[m.pages ? `${m.pages} ${m.kind === 'pptx' ? 'slide' : 'page'}${m.pages === 1 ? '' : 's'}` : '', `${m.chars.toLocaleString()} characters`, m.method === 'ai' ? 'read by the AI' : ''].filter(Boolean).join(' · ')}</small></span>
        <button class="btn small ghost" data-view="${m.id}">View text</button>
        <button class="x" data-rm="${m.id}" aria-label="Remove ${esc(m.name)}">${icon('x')}</button>
      </div>`).join('') + pending.map((p) => `<div class="mat pending"><span class="spinner" aria-hidden="true"></span><span class="mat-name">${esc(p.name)}<small>${p.status}</small></span></div>`).join('');
    drop.innerHTML = rows || `<div class="drop-empty">${icon('upload')}<b>Drop files here</b><span>PDF, Word (.docx), PowerPoint (.pptx), text files, or photos of notes · up to 15 MB each</span></div>`;
    drop.classList.toggle('has', !!rows);
    const g = $('#genNotes', el); if (g && !busy) g.innerHTML = `${icon('sparkle')} ${genLabel()}`;
    drop.querySelectorAll('[data-use]').forEach((cb) => (cb.onchange = async () => {
      const m = mats.find((x) => x.id === +cb.dataset.use);
      try { await api('PATCH', `/api/materials/${m.id}`, { use: cb.checked }); m.use = cb.checked; } catch (e) { errorToast(e); cb.checked = m.use; }
      renderMaterials(root);
    }));
    drop.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => {
      const m = mats.find((x) => x.id === +b.dataset.rm);
      if (!(await confirmBox({ title: 'Remove this file?', body: `“${esc(m.name)}” will be removed from this set. Notes already written from it stay.`, yes: 'Remove' }))) return;
      try { await api('DELETE', `/api/materials/${m.id}`); set.materials = mats.filter((x) => x.id !== m.id); renderMaterials(root); } catch (e) { errorToast(e); }
    }));
    drop.querySelectorAll('[data-view]').forEach((b) => (b.onclick = async () => {
      try {
        const { material: m } = await api('GET', `/api/materials/${b.dataset.view}`);
        modal(`<h3>${esc(m.name)}</h3><p class="hint">This is the text the tutor reads from your file${m.method === 'ai' ? ' (the AI read it from the image, so check for mistakes)' : ''}.</p><pre class="mat-text">${esc(m.text)}</pre><div class="row end"><button class="btn primary" data-close>Close</button></div>`, { wide: true });
      } catch (e) { errorToast(e); }
    }));
  }
  const readB64 = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new Error(`Couldn't open “${file.name}”.`));
    fr.readAsDataURL(file);
  });
  async function upload(files, root) {
    const forSet = set;
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { toast(`“${esc(file.name)}” is over 15 MB. Try a smaller file or split it.`, 'err'); continue; }
      const isScan = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
      const p = { name: file.name, status: isScan ? 'The AI is reading your photo…' : 'Reading…' };
      pending.push(p); renderMaterials(root);
      try {
        const { material } = await api('POST', `/api/sets/${forSet.id}/materials`, { name: file.name, data: await readB64(file) });
        (forSet.materials ||= []).push(material);
        toast(`Added “${esc(material.name)}”${material.method === 'ai' ? '. The AI read it from the image.' : '.'}`);
      } catch (e) { errorToast(e); }
      pending = pending.filter((x) => x !== p);
      if (set === forSet) renderMaterials($('#tabBody', el) || root);
    }
  }
  function wireMaterials(root) {
    const input = $('#matFile', root), drop = $('#drop', root), sec = $('#mats', root);
    input.onchange = () => { upload([...input.files], root); input.value = ''; };
    $('#matBtn', root).onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    drop.onclick = (e) => { if (!drop.classList.contains('has') && !e.target.closest('button,input')) input.click(); };
    for (const t of ['dragenter', 'dragover']) sec.addEventListener(t, (e) => { e.preventDefault(); sec.classList.add('dragging'); });
    for (const t of ['dragleave', 'drop']) sec.addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || !sec.contains(e.relatedTarget)) sec.classList.remove('dragging'); });
    sec.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) upload([...e.dataTransfer.files], root); });
    renderMaterials(root);
  }

  function tabNotes(body) {
    body.innerHTML = materialsHtml() + `<div class="two">
      <div class="stack">
        <div class="row between"><h3>Your notes <span class="tag ind">yours</span></h3><span class="pay-note">${coinSvg}${coinsFor('notes_own')} per 8 new words</span></div>
        <textarea id="own" class="notes-input" placeholder="Explain the topic in your own words. Writing it yourself earns the most coins and helps you remember.">${esc(set.notesOwn)}</textarea>
        <div class="row"><button class="btn primary" id="saveOwn">Save notes</button><span class="muted small" id="ownCount"></span></div>
      </div>
      <div class="stack">
        <div class="row between"><h3>Tutor notes <span class="tag ai">AI</span></h3>${state.ai ? pay('notes_ai') : ''}</div>
        ${state.ai ? `<button class="btn" id="genNotes" ${busy ? 'disabled' : ''}>${icon('sparkle')} ${genLabel()}</button>` : aiOff()}
        <div class="notes" id="aiNotes">${set.notesAi ? md(set.notesAi) : `<p class="muted">Your tutor writes notes for a ${esc(state.profile.prefs.level.toLowerCase())} student, using ${esc(state.profile.prefs.style)}. Try writing your own first, then compare. The tutor will point out anything you got wrong.</p>`}</div>
      </div></div>`;
    wireMaterials(body);
    const ta = $('#own', body), cnt = $('#ownCount', body);
    const upd = () => { const n = Math.max(0, words(ta.value) - set.ownCredited); cnt.textContent = `${words(ta.value)} words · ${n} new`; };
    ta.oninput = upd; upd();
    $('#saveOwn', body).onclick = async () => {
      try {
        const r = applyResult(await api('PUT', `/api/sets/${set.id}/notes`, { notes: ta.value }));
        set.notesOwn = ta.value; set.ownCredited = r.ownCredited; upd();
        if (!r.rewards.length) toast('Notes saved.');
      } catch (e) { errorToast(e); }
    };
    const g = $('#genNotes', body);
    if (g) g.onclick = async () => {
      busy = true; g.disabled = true; g.innerHTML = `${icon('sparkle')} Writing…`;
      const out = $('#aiNotes', body); let text = '';
      abort = new AbortController();
      try {
        const r = await stream(`/api/sets/${set.id}/ai/notes`, {}, (d) => { text += d; out.innerHTML = md(text); }, abort.signal);
        set.notesAi = r.text; applyResult(r);
      } catch (e) { if (e.name !== 'AbortError') errorToast(e); }
      busy = false; if (tab === 'notes' && $('#genNotes', el)) renderPane();
    };
  }

  /* ---------------- flashcards ---------------- */
  function tabCards(body) {
    if (review) return renderReview(body);
    body.innerHTML = `<div class="stack">
      <div class="row between">
        <button class="btn primary" id="startRev" ${set.cards.length ? '' : 'disabled'}>${icon('play')} Study ${set.cards.length} cards</button>
        ${state.ai ? `<button class="btn" id="genCards" ${busy ? 'disabled' : ''}>${icon('sparkle')} Make 8 cards with AI ${pay('cards_ai')}</button>` : ''}
      </div>
      <form class="card inset stack" id="addCard">
        <div class="row between"><b>Make your own card <span class="tag ind">yours</span></b>${pay('card_own')}</div>
        <div class="two"><label class="f">Front<input id="cq" maxlength="300" placeholder="Question"></label><label class="f">Back<input id="ca" maxlength="500" placeholder="Answer"></label></div>
        <div><button class="btn small primary">Add card</button></div>
      </form>
      <div class="list">${set.cards.map((c) => `<div class="list-row"><span>${esc(c.q)}</span><span class="muted">${esc(c.a)}</span><span class="tag ${c.src === 'own' ? 'ind' : 'ai'}">${c.src === 'own' ? 'yours' : 'AI'}</span><button class="x" data-del="${c.id}" aria-label="Delete card">${icon('x')}</button></div>`).join('') || '<p class="muted">No cards yet.</p>'}</div>
      ${state.ai ? '' : aiOff()}
    </div>`;
    $('#addCard', body).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = applyResult(await api('POST', `/api/sets/${set.id}/cards`, { q: $('#cq', body).value, a: $('#ca', body).value }));
        set.cards.push(r.card); refreshSummary(); renderPane(); $('#cq', el)?.focus();
      } catch (err) { errorToast(err); }
    };
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      try { await api('DELETE', `/api/cards/${b.dataset.del}`); set.cards = set.cards.filter((c) => c.id !== +b.dataset.del); refreshSummary(); renderPane(); } catch (e) { errorToast(e); }
    }));
    $('#startRev', body).onclick = () => { review = { queue: shuffle(set.cards.map((c) => c.id)), done: 0, got: 0, flipped: false, typed: '' }; renderPane(); };
    const g = $('#genCards', body);
    if (g) g.onclick = async () => {
      busy = true; g.disabled = true; g.innerHTML = `${icon('sparkle')} Making cards…`;
      try { const r = applyResult(await api('POST', `/api/sets/${set.id}/ai/cards`)); set.cards.push(...r.cards); refreshSummary(); } catch (e) { errorToast(e); }
      busy = false; renderPane();
    };
  }
  function renderReview(body) {
    const r = review;
    if (!r.queue.length) {
      body.innerHTML = `<div class="empty"><div class="big-num">${r.got}/${r.done}</div><h2>Deck finished</h2><p class="muted">Cards you missed came back around until you got them.</p>
        <div class="row center"><button class="btn primary" id="again">Go again</button><button class="btn ghost" id="back">Back to cards</button></div></div>`;
      $('#again', body).onclick = () => { review = { queue: shuffle(set.cards.map((c) => c.id)), done: 0, got: 0, flipped: false, typed: '' }; renderPane(); };
      $('#back', body).onclick = () => { review = null; renderPane(); };
      return;
    }
    const c = set.cards.find((x) => x.id === r.queue[0]);
    if (!c) { r.queue.shift(); return renderReview(body); }
    body.innerHTML = `<div class="stack review">
      <div class="row between"><span class="muted">${r.queue.length} left · ${r.got} remembered</span><button class="btn small ghost" id="stop">Stop</button></div>
      <div class="flash ${r.flipped ? 'flipped' : ''}"><div class="flash-inner">
        <div class="face"><span class="eyebrow">Question</span>${esc(c.q)}</div>
        <div class="face back"><span class="eyebrow">Answer</span>${esc(c.a)}${r.typed ? `<small class="you-wrote">You wrote: ${esc(r.typed)}</small>` : ''}</div>
      </div></div>
      ${r.flipped ? `<div class="row center"><button class="btn" id="miss">I didn't know it</button><button class="btn primary" id="got">I got it</button></div>`
        : `<label class="f">Type your answer first to earn recall coins (${pay('card_recall')}), or just flip (${pay('card_flip')})<input id="typed" autocomplete="off"></label>
           <div class="row center"><button class="btn primary" id="flip">Flip card</button></div>`}
    </div>`;
    $('#stop', body).onclick = () => { review = null; renderPane(); };
    if (!r.flipped) {
      const inp = $('#typed', body); inp.focus();
      const flip = () => { r.typed = inp.value.trim(); r.flipped = true; renderPane(); };
      $('#flip', body).onclick = flip; inp.onkeydown = (e) => { if (e.key === 'Enter') flip(); };
    } else {
      const next = async (knew) => {
        const id = r.queue.shift(); r.done++;
        if (knew) r.got++; else r.queue.splice(Math.min(3, r.queue.length), 0, id);
        const typed = !!r.typed; r.flipped = false; r.typed = ''; renderPane();
        try { applyResult(await api('POST', `/api/cards/${id}/review`, { typed, knew })); } catch (e) { errorToast(e); }
      };
      $('#got', body).onclick = () => next(true);
      $('#miss', body).onclick = () => next(false);
      $('#got', body).focus();
    }
  }

  /* ---------------- quiz ---------------- */
  function tabQuiz(body) {
    if (quizRun) return renderQuizRun(body);
    body.innerHTML = `<div class="stack">
      <div class="row between">
        <button class="btn primary" id="startQ" ${set.quiz.length ? '' : 'disabled'}>${icon('play')} Take the quiz (${set.quiz.length})</button>
        ${state.ai ? `<button class="btn" id="genQ" ${busy ? 'disabled' : ''}>${icon('sparkle')} Write 5 questions with AI ${pay('quiz_ai')}</button>` : ''}
      </div>
      <details class="card inset"><summary><b>Write your own question <span class="tag ind">yours</span></b> ${pay('quiz_own')}</summary>
        <form class="stack" id="addQ">
          <label class="f">Question<input id="qq" maxlength="300"></label>
          ${[0, 1, 2, 3].map((i) => `<div class="opt-row"><input type="radio" name="qa" value="${i}" ${i === 0 ? 'checked' : ''} aria-label="Option ${i + 1} is correct"><input id="qo${i}" maxlength="200" placeholder="Option ${i + 1}${i === 0 ? ' (tick the circle next to the right answer)' : ''}"></div>`).join('')}
          <label class="f">Why is it right? <small class="muted">(optional)</small><input id="qe" maxlength="300"></label>
          <div><button class="btn small primary">Add question</button></div>
        </form></details>
      <div class="list">${set.quiz.map((q) => `<div class="list-row"><span>${esc(q.q)}</span><span class="muted">${esc(q.options[q.answer])}</span><span class="tag ${q.src === 'own' ? 'ind' : 'ai'}">${q.src === 'own' ? 'yours' : 'AI'}</span><button class="x" data-del="${q.id}" aria-label="Delete question">${icon('x')}</button></div>`).join('') || '<p class="muted">No questions yet.</p>'}</div>
      ${state.ai ? '' : aiOff()}
    </div>`;
    $('#addQ', body).onsubmit = async (e) => {
      e.preventDefault();
      const raw = [0, 1, 2, 3].map((i) => $('#qo' + i, body).value.trim());
      const correct = +body.querySelector('input[name=qa]:checked').value;
      if (!raw[correct]) return toast('Fill in the option you marked as correct.');
      const kept = raw.map((o, i) => ({ o, i })).filter((x) => x.o);
      try {
        const r = applyResult(await api('POST', `/api/sets/${set.id}/quiz`, { q: $('#qq', body).value, options: kept.map((x) => x.o), answer: kept.findIndex((x) => x.i === correct), explain: $('#qe', body).value }));
        set.quiz.push(r.question); refreshSummary(); renderPane();
      } catch (err) { errorToast(err); }
    };
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      try { await api('DELETE', `/api/quiz/${b.dataset.del}`); set.quiz = set.quiz.filter((q) => q.id !== +b.dataset.del); refreshSummary(); renderPane(); } catch (e) { errorToast(e); }
    }));
    $('#startQ', body).onclick = () => { quizRun = { order: shuffle(set.quiz.map((q) => q.id)), i: 0, score: 0, result: null, hint: null, hinting: false }; renderPane(); };
    const g = $('#genQ', body);
    if (g) g.onclick = async () => {
      busy = true; g.disabled = true; g.innerHTML = `${icon('sparkle')} Writing questions…`;
      try { const r = applyResult(await api('POST', `/api/sets/${set.id}/ai/quiz`)); set.quiz.push(...r.questions); refreshSummary(); } catch (e) { errorToast(e); }
      busy = false; renderPane();
    };
  }
  function renderQuizRun(body) {
    const r = quizRun;
    if (r.i >= r.order.length) {
      body.innerHTML = `<div class="empty"><div class="big-num">${r.score}/${r.order.length}</div><h2>${r.score === r.order.length ? 'Perfect score!' : 'Quiz done'}</h2><p class="muted">${r.score === r.order.length ? 'You know this topic well.' : 'Look over the ones you missed in your notes, then try again.'}</p>
        <div class="row center"><button class="btn primary" id="again">Retake</button><button class="btn ghost" id="back">Back</button></div></div>`;
      $('#again', body).onclick = () => { quizRun = { order: shuffle(set.quiz.map((q) => q.id)), i: 0, score: 0, result: null, hint: null, hinting: false }; renderPane(); };
      $('#back', body).onclick = () => { quizRun = null; renderPane(); };
      return;
    }
    const q = set.quiz.find((x) => x.id === r.order[r.i]);
    if (!q) { r.i++; return renderQuizRun(body); }
    const res = r.result;
    body.innerHTML = `<div class="stack quiz-run">
      <div class="row between"><span class="muted">Question ${r.i + 1} of ${r.order.length} · score ${r.score}</span><button class="btn small ghost" id="stop">Stop</button></div>
      <div class="progress-dots">${r.order.map((_, i) => `<i class="${i < r.i ? 'on' : i === r.i ? 'now' : ''}"></i>`).join('')}</div>
      <h3 class="q">${esc(q.q)}</h3>
      <div class="opts">${q.options.map((o, i) => `<button class="opt ${res ? (i === res.answer ? 'right' : i === res.choice ? 'wrong' : '') : ''}" data-i="${i}" ${res ? 'disabled' : ''}><span class="letter">${'ABCDEF'[i]}</span>${esc(o)}</button>`).join('')}</div>
      ${r.hint ? `<div class="notice">${icon('sparkle')} <b>Hint:</b> ${esc(r.hint)}</div>` : ''}
      ${res ? `<div class="notice ${res.correct ? 'good' : 'badn'}"><b>${res.correct ? 'Correct!' : 'Not quite.'}</b> ${esc(res.explain || '')}</div><div><button class="btn primary" id="nextQ">Next question</button></div>`
        : state.ai ? `<div class="row"><button class="btn small ghost" id="hintBtn" ${r.hint || r.hinting ? 'disabled' : ''}>${icon('sparkle')} ${r.hinting ? 'Thinking…' : 'Get an AI hint'}</button><small class="muted">A hint lowers this question's reward from ${coinsFor('quiz_correct')} to ${coinsFor('quiz_correct_hint')} coins.</small></div>` : ''}
    </div>`;
    $('#stop', body).onclick = () => { quizRun = null; renderPane(); };
    body.querySelectorAll('.opt').forEach((b) => (b.onclick = async () => {
      body.querySelectorAll('.opt').forEach((x) => (x.disabled = true));
      try {
        const out = applyResult(await api('POST', `/api/quiz/${q.id}/answer`, { choice: +b.dataset.i }));
        r.result = { ...out, choice: +b.dataset.i };
        if (out.correct) r.score++;
      } catch (e) { errorToast(e); }
      renderPane();
    }));
    const nb = $('#nextQ', body);
    if (nb) { nb.focus(); nb.onclick = () => { r.i++; r.result = null; r.hint = null; renderPane(); }; }
    const hb = $('#hintBtn', body);
    if (hb) hb.onclick = async () => {
      r.hinting = true; renderPane();
      try { const out = applyResult(await api('POST', `/api/quiz/${q.id}/hint`)); r.hint = out.hint; } catch (e) { errorToast(e); }
      r.hinting = false; if (quizRun === r) renderPane();
    };
  }

  /* ---------------- tutor chat ---------------- */
  function tabTutor(body) {
    if (!state.ai) { body.innerHTML = aiOff(); return; }
    body.innerHTML = `<div class="stack">
      <div class="notice">${icon('sparkle')} Your tutor helps you think things through: it asks you questions before giving answers. Chatting earns no coins, so it's best used after you've tried yourself.</div>
      <div class="chat" id="chat">${set.chat.map((m) => `<div class="msg ${m.role === 'user' ? 'me' : 'bot'}">${esc(m.content)}</div>`).join('') || `<div class="msg bot">Hi! Which part of ${esc(set.title)} is confusing you?</div>`}</div>
      <form class="chat-form" id="chatForm"><input id="chatIn" maxlength="2000" placeholder="Ask about ${esc(set.title)}…" autocomplete="off"><button class="btn primary" ${busy ? 'disabled' : ''} aria-label="Send">${icon('send')}</button></form>
      ${set.chat.length ? '<div><button class="btn small ghost" id="clearChat">Clear chat</button></div>' : ''}
    </div>`;
    const chat = $('#chat', body); chat.scrollTop = chat.scrollHeight;
    $('#clearChat', body)?.addEventListener('click', async () => { try { await api('DELETE', `/api/sets/${set.id}/chat`); set.chat = []; renderPane(); } catch (e) { errorToast(e); } });
    $('#chatForm', body).onsubmit = async (e) => {
      e.preventDefault();
      const inp = $('#chatIn', body), text = inp.value.trim();
      if (!text || busy) return;
      set.chat.push({ role: 'user', content: text }); busy = true; renderPane();
      const c2 = $('#chat', el), bubble = document.createElement('div');
      bubble.className = 'msg bot typing'; bubble.textContent = 'Thinking…'; c2.appendChild(bubble); c2.scrollTop = c2.scrollHeight;
      let acc = '';
      abort = new AbortController();
      try {
        const r = await stream(`/api/sets/${set.id}/chat`, { message: text }, (d) => { acc += d; bubble.textContent = acc; bubble.classList.remove('typing'); c2.scrollTop = c2.scrollHeight; }, abort.signal);
        set.chat.push({ role: 'assistant', content: r.text }); applyResult(r);
      } catch (err) { if (err.name !== 'AbortError') { set.chat.pop(); errorToast(err); } }
      busy = false; if (tab === 'tutor' && $('#chat', el)) { renderPane(); $('#chatIn', el)?.focus(); }
    };
    $('#chatIn', body).focus();
  }

  // boot
  loadSets().then(() => {
    const id = idStr ? +idStr : sets[0]?.id;
    if (id) { if (!idStr) history.replaceState(null, '', `#/study/${id}/${tab}`); openSet(id); } else renderPane();
  }).catch(errorToast);
  const unsub = subscribe(() => {});
  return () => { unsub(); abort?.abort(); };
}
