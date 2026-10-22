import { APP_NAME } from '../shared/settings.js';
import { COINS } from '../shared/settings.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeOpenRouter, startApp } from './helpers.js';

let ai, app;
before(async () => { ai = await fakeOpenRouter(); app = await startApp(ai.url); });
after(() => { app.close(); ai.close(); });

test('signup creates a profile, starter room and example set', async () => {
  let r = await app.call('POST', '/api/auth/signup', { username: 'sunny_owl', password: 'password123', tz: 'Asia/Singapore' });
  assert.equal(r.status, 200);
  r = await app.call('GET', '/api/me');
  assert.equal(r.data.user.username, 'sunny_owl');
  assert.equal(r.data.profile.coins, 150);
  assert.equal(r.data.profile.prefs.tz, 'Asia/Singapore');
  assert.equal(r.data.ai, true);
  const home = (await app.call('GET', '/api/home')).data;
  assert.equal(home.rooms.length, 1);
  assert.ok(home.items.length >= 8);
  const sets = (await app.call('GET', '/api/sets')).data.sets;
  assert.equal(sets.length, 1);
});

test('duplicate usernames and bad passwords are refused', async () => {
  assert.equal((await app.call('POST', '/api/auth/signup', { username: 'SUNNY_OWL', password: 'password123' })).status, 409);
  assert.equal((await app.call('POST', '/api/auth/signup', { username: 'x', password: 'password123' })).status, 400);
  assert.equal((await app.call('POST', '/api/auth/signup', { username: 'okname', password: 'short' })).status, 400);
});

test('requests need JSON and a session', async () => {
  const res = await fetch(app.base + '/api/sets', { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: app.cookie }, body: 'title=x' });
  assert.equal(res.status, 415);
  const anon = await fetch(app.base + '/api/home');
  assert.equal(anon.status, 401);
});

test('placing furniture checks coins, collisions and surfaces', async () => {
  const home = (await app.call('GET', '/api/home')).data;
  const roomId = home.rooms[0].id;
  // the starter desk is at (1,0)-(2,0); a sofa there collides
  let r = await app.call('POST', '/api/items', { item: 'sofa', roomId, x: 1, y: 0, rot: 0 });
  assert.equal(r.status, 409);
  // a mug can sit on the desk (books are at 1,0 and lamp at 2,0, so no free spot) -> refused
  r = await app.call('POST', '/api/items', { item: 'mug', roomId, x: 1, y: 0, rot: 0 });
  assert.equal(r.status, 409);
  r = await app.call('POST', '/api/items', { item: 'mug', roomId, x: 4, y: 4, rot: 0 });
  assert.equal(r.status, 200);
  assert.equal(r.data.profile.coins, 150 - 6);
  // locked by independence tier
  r = await app.call('POST', '/api/items', { item: 'piano', roomId, x: 3, y: 4, rot: 0 });
  assert.equal(r.status, 403);
  // doesn't belong in a bedroom
  r = await app.call('POST', '/api/items', { item: 'toilet', roomId, x: 2, y: 4, rot: 0 });
  assert.equal(r.status, 409);
  assert.match(r.data.error, /doesn't belong in a bedroom\. Put it in a bathroom/);
  // too expensive
  const coins = app.db.one('SELECT coins FROM profiles WHERE user_id = 1').coins;
  app.db.run('UPDATE profiles SET coins = 50 WHERE user_id = 1');
  r = await app.call('POST', '/api/items', { item: 'wardrobe', roomId, x: 2, y: 4, rot: 0 });
  assert.equal(r.status, 402);
  app.db.run('UPDATE profiles SET coins = ? WHERE user_id = 1', coins);
  // wall item on an occupied spot
  r = await app.call('POST', '/api/items', { item: 'clock', roomId, x: 3, wall: 'R' });
  assert.equal(r.status, 409);
  r = await app.call('POST', '/api/items', { item: 'clock', roomId, x: 0, wall: 'R' });
  assert.equal(r.status, 200);
});

test('moving a desk carries what is on it; selling refunds half', async () => {
  const home = (await app.call('GET', '/api/home')).data;
  const desk = home.items.find((i) => i.item === 'desk');
  const lamp = home.items.find((i) => i.item === 'lamp_desk');
  // chair sits at (1,1); move the desk to (3,2)
  let r = await app.call('PATCH', `/api/items/${desk.id}`, { roomId: desk.roomId, x: 3, y: 2, rot: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const lamp2 = r.data.home.items.find((i) => i.id === lamp.id);
  assert.deepEqual([lamp2.x, lamp2.y], [lamp.x + 2, lamp.y + 2]);
  const before = (await app.call('GET', '/api/me')).data.profile.coins;
  r = await app.call('DELETE', `/api/items/${desk.id}`);
  assert.equal(r.data.refund, 35);
  assert.equal(r.data.profile.coins, before + 35);
  assert.equal(r.data.stored, 2); // books + lamp went to storage
});

test('own notes pay per new word, once', async () => {
  const sets = (await app.call('GET', '/api/sets')).data.sets;
  const id = sets[0].id;
  const set = (await app.call('GET', `/api/sets/${id}`)).data.set;
  const notes = set.notesOwn + ' ' + 'word '.repeat(40);
  let r = await app.call('PUT', `/api/sets/${id}/notes`, { notes });
  assert.equal(r.data.rewards[0].action, 'notes_own');
  assert.equal(r.data.rewards[0].coins, 5 * COINS.own_notes_per_8_words);
  r = await app.call('PUT', `/api/sets/${id}/notes`, { notes });
  assert.equal(r.data.rewards.length, 0);
});

test('quiz answers are checked on the server, and hints lower the reward', async () => {
  const id = (await app.call('GET', '/api/sets')).data.sets[0].id;
  const set = (await app.call('GET', `/api/sets/${id}`)).data.set;
  const [q1, q2] = set.quiz;
  let r = await app.call('POST', `/api/quiz/${q1.id}/answer`, { choice: (q1.answer + 1) % 4 });
  assert.equal(r.data.correct, false);
  assert.equal(r.data.profile.day.quiz, 1);
  r = await app.call('POST', `/api/quiz/${q1.id}/answer`, { choice: q1.answer });
  assert.equal(r.data.correct, true);
  assert.equal(r.data.rewards[0].action, 'quiz_correct');
  // same question again within 10 minutes pays nothing
  r = await app.call('POST', `/api/quiz/${q1.id}/answer`, { choice: q1.answer });
  assert.equal(r.data.rewards.length, 0);
  r = await app.call('POST', `/api/quiz/${q2.id}/hint`);
  assert.equal(r.data.hint, 'A short hint.');
  r = await app.call('POST', `/api/quiz/${q2.id}/answer`, { choice: q2.answer });
  assert.equal(r.data.rewards[0].action, 'quiz_correct_hint');
});

test('AI notes stream through OpenRouter and are saved', async () => {
  const id = (await app.call('GET', '/api/sets')).data.sets[0].id;
  const r = await app.call('POST', `/api/sets/${id}/ai/notes`, {});
  const lines = r.data.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.filter((l) => l.t === 'delta').map((l) => l.text).join(''), '## Notes\n- **Key** idea\n- another');
  const done = lines.at(-1);
  assert.equal(done.t, 'done');
  assert.equal(done.rewards[0].action, 'notes_ai');
  const call = ai.calls.at(-1);
  assert.equal(call.body.model, 'test/model');
  assert.equal(call.body.stream, true);
  assert.equal(call.headers['x-title'], APP_NAME);
  const set = (await app.call('GET', `/api/sets/${id}`)).data.set;
  assert.match(set.notesAi, /Key/);
});

test('AI cards and quiz are parsed tolerantly and validated', async () => {
  const id = (await app.call('GET', '/api/sets')).data.sets[0].id;
  let r = await app.call('POST', `/api/sets/${id}/ai/cards`);
  assert.equal(r.status, 200);
  assert.equal(r.data.cards.length, 2);
  r = await app.call('POST', `/api/sets/${id}/ai/quiz`);
  assert.equal(r.data.questions.length, 1);
  assert.equal(r.data.questions[0].answer, 1);
  assert.equal(ai.calls.filter((c) => c.body.model === 'test/fast').length, 1); // hint used the fast model
});

test('tutor chat streams and keeps history', async () => {
  const id = (await app.call('GET', '/api/sets')).data.sets[0].id;
  const r = await app.call('POST', `/api/sets/${id}/chat`, { message: 'What is chlorophyll?' });
  assert.match(r.data, /"t":"done"/);
  const set = (await app.call('GET', `/api/sets/${id}`)).data.set;
  assert.equal(set.chat.length, 2);
  const sent = ai.calls.at(-1).body.messages;
  assert.equal(sent[0].role, 'system');
  assert.equal(sent.at(-1).content, 'What is chlorophyll?');
});

test('focus sessions are timed by the server', async () => {
  let r = await app.call('POST', '/api/focus/start', { minutes: 2 });
  assert.equal(r.data.session.status, 'running');
  // pretend the session started 2.5 minutes ago
  app.db.run('UPDATE focus SET started_at = ? WHERE id = ?', Date.now() - 150000, r.data.session.id);
  r = await app.call('POST', '/api/focus/tick');
  assert.equal(r.data.session.status, 'done');
  const actions = r.data.rewards.map((x) => x.action);
  assert.deepEqual(actions.filter((a) => a === 'focus_minute').length, 2);
  assert.ok(actions.includes('focus_complete'));
});

test('building rooms needs support underneath and enough coins', async () => {
  app.db.run('UPDATE profiles SET coins = 1000');
  // slot 4 is on the second floor and needs slot 2 underneath
  let r = await app.call('POST', '/api/rooms', { slot: 4, type: 'study' });
  assert.equal(r.status, 409);
  assert.equal((await app.call('POST', '/api/rooms', { slot: 9, type: 'study' })).status, 400);
  assert.equal((await app.call('POST', '/api/rooms', { slot: 1, type: 'observatory' })).status, 403);
  r = await app.call('POST', '/api/rooms', { slot: 1, type: 'kitchen' });
  assert.equal(r.status, 200);
  assert.equal(r.data.profile.coins, 1000 - 150);
  const kitchen = r.data.home.rooms[1].id, bedroom = r.data.home.rooms[0].id;
  // kitchen things go in the kitchen; basics go anywhere; bedroom things can't be moved in
  assert.equal((await app.call('POST', '/api/items', { item: 'kettle', roomId: kitchen, x: 0, y: 0, rot: 0 })).status, 200);
  assert.equal((await app.call('POST', '/api/items', { item: 'plant_tall', roomId: kitchen, x: 5, y: 5, rot: 0 })).status, 200);
  assert.equal((await app.call('POST', '/api/items', { item: 'bed_single', roomId: kitchen, x: 2, y: 2, rot: 0 })).status, 409);
  const bed = app.db.one("SELECT id FROM items WHERE user_id = 1 AND item = 'bed_single'").id;
  assert.equal((await app.call('PATCH', `/api/items/${bed}`, { roomId: kitchen, x: 2, y: 2, rot: 0 })).status, 409);
  assert.equal((await app.call('PATCH', `/api/items/${bed}`, { roomId: bedroom, x: 0, y: 4, rot: 0 })).status, 200); // moving within its own room is fine
  app.db.run('UPDATE profiles SET coins = 850 WHERE user_id = 1');
  r = await app.call('POST', `/api/rooms/${kitchen}/style`, { kind: 'wallpaper', id: 'brick' });
  assert.equal(r.data.bought, true);
  assert.equal(r.data.profile.coins, 850 - 70);
});

test('people can only see their own things', async () => {
  const mine = (await app.call('GET', '/api/sets')).data.sets[0].id;
  const myCookie = app.cookie;
  await app.call('POST', '/api/auth/signup', { username: 'other_kid', password: 'password123' });
  assert.equal((await app.call('GET', `/api/sets/${mine}`)).status, 404);
  const myItem = app.db.one('SELECT id FROM items WHERE user_id = 1 LIMIT 1').id;
  assert.equal((await app.call('DELETE', `/api/items/${myItem}`)).status, 404);
  app.setCookie(myCookie);
});

test('account deletion removes everything', async () => {
  await app.call('POST', '/api/auth/signup', { username: 'leaver', password: 'password123' });
  const uid = app.db.one('SELECT id FROM users WHERE username = ?', 'leaver').id;
  assert.equal((await app.call('POST', '/api/me/delete', { password: 'nope-nope' })).status, 401);
  assert.equal((await app.call('POST', '/api/me/delete', { password: 'password123' })).status, 200);
  assert.equal(app.db.one('SELECT COUNT(*) AS n FROM items WHERE user_id = ?', uid).n, 0);
  assert.equal(app.db.one('SELECT COUNT(*) AS n FROM sets WHERE user_id = ?', uid).n, 0);
});
