import { COINS } from '../shared/settings.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createProfile, award, loadProfile, saveProfile, rollover, addDays, localDay } from '../server/economy.js';
import { canPlace } from '../shared/placement.js';
import { ITEMS, WALLPAPERS, FLOORS, ROOM_SHOPS, ROOM_TYPES, BASICS, homeOf } from '../shared/catalog.js';

function setup() {
  const db = openDb(':memory:');
  db.run("INSERT INTO users (id, username, pass_hash, created_at) VALUES (1, 'a', 'x', 0)");
  createProfile(db, 1, 'UTC');
  return db;
}

test('AI work pays less as independence grows', () => {
  const db = setup();
  assert.equal(award(db, 1, 'notes_ai').rewards[0].coins, COINS.ai_notes);
  db.run('UPDATE profiles SET ind_xp = 700');
  assert.equal(award(db, 1, 'notes_ai').rewards[0].coins, Math.round(COINS.ai_notes * 0.25));
  assert.equal(award(db, 1, 'card_own').rewards[0].coins, COINS.own_flashcard);
});

test('finishing goals opens the chest, grows the streak and applies the multiplier', () => {
  const db = setup();
  const p = loadProfile(db, 1);
  p.goals = { focus: 0, cards: 0, quiz: 1, indep: 1 };
  p.lastDone = addDays(p.day.d, -1); p.streak = 4;
  saveProfile(db, p);
  const r = award(db, 1, 'quiz_correct');
  assert.ok(r.notices.some((n) => n.type === 'chest'));
  assert.equal(r.profile.streak, 5);
  const chest = r.rewards.find((x) => x.action === 'chest');
  assert.equal(chest.coins, Math.round(COINS.daily_chest * 1.5));
});

test('daily caps stop farming', () => {
  const db = setup();
  let paid = 0;
  for (let i = 0; i < 45; i++) paid += award(db, 1, 'card_own').rewards[0].coins;
  assert.equal(paid, 40 * COINS.own_flashcard);
});

test('streak freezes cover missed days, otherwise the streak resets', () => {
  const p = { streak: 6, freezes: 1, lastDone: '2026-10-17', day: { d: '2026-10-17' }, prefs: { tz: 'UTC' } };
  const now = Date.UTC(2026, 9, 19, 12);
  assert.equal(localDay('UTC', now), '2026-10-19');
  let notes = rollover(p, now);
  assert.equal(p.streak, 6); assert.equal(p.freezes, 0); assert.equal(notes[0].type, 'freeze');
  const q = { streak: 6, freezes: 0, lastDone: '2026-10-16', day: { d: '2026-10-16' }, prefs: { tz: 'UTC' } };
  notes = rollover(q, now);
  assert.equal(q.streak, 0); assert.equal(notes[0].type, 'streak_lost');
});

test('placement rules', () => {
  const placed = [{ id: 1, item: 'desk', x: 0, y: 0, rot: 0 }, { id: 2, item: 'bed_single', x: 4, y: 0, rot: 0 }];
  assert.equal(canPlace(placed, { item: 'laptop', x: 1, y: 0, rot: 0 }).ok, true);           // on the desk
  assert.equal(canPlace(placed, { item: 'laptop', x: 4, y: 1, rot: 0 }).ok, false);          // on the bed
  assert.equal(canPlace(placed, { item: 'sofa', x: 5, y: 3, rot: 0 }).ok, false);            // out of room
  assert.equal(canPlace(placed, { item: 'sofa', x: 5, y: 3, rot: 1 }).ok, true);             // rotated fits
  assert.equal(canPlace(placed, { item: 'rug_check', x: 0, y: 0, rot: 0 }).ok, true);        // rugs go under
  assert.equal(canPlace(placed, { item: 'window_big', x: 5, y: 0, rot: 0, wall: 'L' }).ok, false);
  assert.equal(canPlace(placed, { id: 1, item: 'desk', x: 1, y: 2, rot: 1 }).ok, true);      // moving itself
});

test('every room type has a shop, and every item is sold somewhere', () => {
  for (const type of Object.keys(ROOM_TYPES)) {
    const shop = ROOM_SHOPS[type];
    assert.ok(shop, type);
    for (const i of shop.items) assert.ok(ITEMS[i], `${type} sells unknown item ${i}`);
    for (const w of shop.wallpapers) assert.ok(WALLPAPERS[w], w);
    for (const f of shop.floors) assert.ok(FLOORS[f], f);
  }
  for (const id of Object.keys(ITEMS)) assert.ok(BASICS.includes(id) || homeOf(id), `${id} isn't sold in any room`);
});
