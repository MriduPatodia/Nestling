import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';
import { COINS } from '../shared/settings.js';

let app;
before(async () => { app = await startApp(); await app.call('POST', '/api/auth/signup', { username: 'calm_kid', password: 'password123' }); });
after(() => app.close());

test('check-in saves once per day, can be edited, and pays once', async () => {
  let r = await app.call('PUT', '/api/checkin', { mood: 2, stress: 4, sleep: 5.5, body: ['Headache', 'Tired'], topics: ['Exams'] });
  assert.equal(r.status, 200);
  assert.equal(r.data.rewards[0].coins, COINS.daily_checkin);
  r = await app.call('PUT', '/api/checkin', { mood: 3, stress: 3, sleep: 6, body: [], topics: [] });
  assert.equal(r.data.rewards.length, 0);
  const w = (await app.call('GET', '/api/wellbeing')).data;
  assert.equal(w.today.mood, 3);
  assert.equal(w.history.length, 1);
});

test('check-in rejects bad values', async () => {
  assert.equal((await app.call('PUT', '/api/checkin', { mood: 9, stress: 1 })).status, 400);
  assert.equal((await app.call('PUT', '/api/checkin', { mood: 3, stress: 2, body: ['<script>'] })).status, 400);
  assert.equal((await app.call('PUT', '/api/checkin', { mood: 3, stress: 2, sleep: 30 })).status, 400);
});

test('journal entries pay once a day, are private and deletable', async () => {
  let r = await app.call('POST', '/api/journal', { prompt: 'Three good things', text: 'Sunny walk home.' });
  assert.equal(r.data.rewards[0].coins, COINS.journal_entry);
  const id = r.data.entry.id;
  r = await app.call('POST', '/api/journal', { text: 'Second entry' });
  assert.equal(r.data.rewards.length, 0);
  assert.equal((await app.call('POST', '/api/journal', { text: '   ' })).status, 400);
  const mine = app.cookie;
  await app.call('POST', '/api/auth/signup', { username: 'other_one', password: 'password123' });
  assert.equal((await app.call('GET', '/api/wellbeing')).data.entries.length, 0);
  assert.equal((await app.call('DELETE', `/api/journal/${id}`)).status, 404);
  app.setCookie(mine);
  assert.equal((await app.call('DELETE', `/api/journal/${id}`)).status, 200);
  assert.equal((await app.call('GET', '/api/wellbeing')).data.entries.length, 1);
});

test('nickname, character and theme are saved and validated', async () => {
  const look = { base: 'short', hair: 'curly', hairColor: '#B5452E', skin: '#9A5F3E', eyes: '#3E7A52', top: '#4F81BD', bottom: '#2F3238', extra: 'glasses', blush: false };
  let r = await app.call('POST', '/api/auth/signup', { username: 'designer1', password: 'password123', nickname: '  Pip  ', avatar: look });
  assert.equal(r.status, 200);
  let me = (await app.call('GET', '/api/me')).data.profile;
  assert.equal(me.nickname, 'Pip');
  assert.deepEqual(me.avatar, look);
  assert.equal((await app.call('PATCH', '/api/profile', { avatar: { ...look, hair: 'buns' } })).status, 400); // buns are a long-hair style
  assert.equal((await app.call('PATCH', '/api/profile', { avatar: { ...look, skin: 'red' } })).status, 400);
  assert.equal((await app.call('PATCH', '/api/profile', { nickname: 'x'.repeat(30) })).status, 400);
  r = await app.call('PATCH', '/api/profile', { nickname: 'Pippa', avatar: { ...look, base: 'long', hair: 'buns' }, prefs: { theme: 'coral' } });
  assert.equal(r.data.profile.nickname, 'Pippa');
  assert.equal(r.data.profile.avatar.hair, 'buns');
  assert.equal(r.data.profile.prefs.theme, 'coral');
  assert.equal((await app.call('POST', '/api/auth/signup', { username: 'designer2', password: 'password123', avatar: { base: 'tall' } })).status, 400);
});
