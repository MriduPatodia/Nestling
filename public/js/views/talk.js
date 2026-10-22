import { APP_NAME } from '/shared/brand.js';
import { icon, esc } from '../ui.js';

export function mount(el, _p, { loggedOut } = {}) {
  el.innerHTML = `
  <div class="talk-page">
    ${loggedOut ? '<a class="btn ghost small back-link" href="#/">← Back to ${esc(APP_NAME)}</a>' : ''}
    <section class="talk-hero">
      <p class="eyebrow">A safe space</p>
      <h1>Talk to a real person, anonymously</h1>
      <p>Stressed about exams, or about anything else? You can chat with a trained person at the Institute of Mental Health (IMH). You don't have to give your name, and it doesn't have to be about studying.</p>
      <a class="btn big light" href="https://www.nhghealth.com.sg/imh/chat/get-help" target="_blank" rel="noopener noreferrer">${icon('heart')} Open the IMH chat ↗</a>
    </section>
    <div class="lines">
      <div class="card"><p class="eyebrow">Emergency</p><b class="num">995</b><p class="small muted">If you or someone else is in immediate danger.</p></div>
      <div class="card"><p class="eyebrow">Samaritans of Singapore · 24 hours</p><b class="num">1767</b><p class="small muted">If you're having thoughts of suicide or are in crisis.</p></div>
      <div class="card"><p class="eyebrow">IMH Mental Health Helpline · 24 hours</p><b class="num">6389 2222</b><p class="small muted">For mental health support and advice.</p></div>
    </div>
    <section class="card breathe-card">
      <h3>Need a minute first?</h3>
      <p class="muted">Breathe in as the circle grows, and out as it shrinks.</p>
      <div class="breathe" aria-hidden="true"><span>breathe</span></div>
    </section>
    <p class="small muted center-text">Nothing on this page earns coins, and ${esc(APP_NAME)} doesn't record whether you visit it or use the chat.<br>The chat is with people, not the AI tutor.</p>
  </div>`;
}
