import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let app, roomId;
before(async () => {
  app = await startApp();
  await app.call('POST', '/api/auth/signup', { username: 'decor_kid', password: 'password123' });
  app.db.run('UPDATE profiles SET coins = 2000');
  roomId = (await app.call('GET', '/api/home')).data.rooms[0].id;
});
after(() => app.close());

test('a desk tile has 4 spots for small things', async () => {
  // starter desk at (1,0)-(2,0): books in spot 0 of (1,0), lamp in spot 1 of (2,0)
  let r = await app.call('POST', '/api/items', { item: 'mug', roomId, x: 1, y: 0, rot: 0, slot: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await app.call('POST', '/api/items', { item: 'laptop', roomId, x: 1, y: 0, rot: 0, slot: 2 });
  assert.equal(r.status, 200);
  assert.equal((await app.call('POST', '/api/items', { item: 'candle', roomId, x: 1, y: 0, rot: 0, slot: 1 })).status, 409); // taken
  assert.equal((await app.call('POST', '/api/items', { item: 'candle', roomId, x: 1, y: 0, rot: 0, slot: 7 })).status, 409); // no such spot
  assert.equal((await app.call('POST', '/api/items', { item: 'candle', roomId, x: 4, y: 4, rot: 0, slot: 0 })).status, 409); // spots only on desks
  assert.equal((await app.call('POST', '/api/items', { item: 'candle', roomId, x: 4, y: 4, rot: 0 })).status, 200); // floor is fine
  const home = (await app.call('GET', '/api/home')).data;
  assert.equal(home.items.filter((i) => i.roomId === roomId && i.x === 1 && i.y === 0 && i.slot != null).length, 3);
});

test('furniture, floors and walls can be recoloured with palette colours', async () => {
  const home = (await app.call('GET', '/api/home')).data;
  const bed = home.items.find((i) => i.item === 'bed_single');
  let r = await app.call('POST', `/api/items/${bed.id}/paint`, { color: '#E39BB6' });
  assert.equal(r.data.home.items.find((i) => i.id === bed.id).color, '#E39BB6');
  assert.equal((await app.call('POST', `/api/items/${bed.id}/paint`, { color: '#123456' })).status, 400);
  const cactus = home.items.find((i) => i.item === 'cactus');
  assert.equal((await app.call('POST', `/api/items/${cactus.id}/paint`, { color: '#E39BB6' })).status, 400); // not paintable
  r = await app.call('POST', `/api/items/${bed.id}/paint`, { color: null });
  assert.equal(r.data.home.items.find((i) => i.id === bed.id).color, null);
  r = await app.call('POST', `/api/rooms/${roomId}/tint`, { floor: '#5A3A24', wall: '#CFE0EE' });
  const room = r.data.home.rooms.find((x) => x.id === roomId);
  assert.deepEqual([room.floorTint, room.wallTint], ['#5A3A24', '#CFE0EE']);
  assert.equal((await app.call('POST', `/api/rooms/${roomId}/tint`, { floor: 'red' })).status, 400);
});
