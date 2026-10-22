import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeOpenRouter, startApp } from './helpers.js';

const fx = (f) => readFileSync(new URL('./fixtures/' + f, import.meta.url)).toString('base64');
let ai, app, setId;
before(async () => {
  ai = await fakeOpenRouter(); app = await startApp(ai.url);
  await app.call('POST', '/api/auth/signup', { username: 'uploader', password: 'password123' });
  setId = (await app.call('POST', '/api/sets', { title: 'Biology' })).data.set.id;
});
after(() => { app.close(); ai.close(); });

const upload = (name, data) => app.call('POST', `/api/sets/${setId}/materials`, { name, data });

test('Word, PowerPoint, text and text-based PDFs are read without the AI', async () => {
  const before = ai.calls.length;
  for (const [f, want] of [['cells.docx', 'powerhouse of the cell'], ['history.pptx', 'Remember the acronym MAIN'], ['cells.pdf', 'partially permeable membrane'], ['chem.pdf', 'Hydrochloric acid']]) {
    const r = await upload(f, fx(f));
    assert.equal(r.status, 200, f + ' ' + JSON.stringify(r.data));
    assert.equal(r.data.material.method, 'text');
    const full = (await app.call('GET', `/api/materials/${r.data.material.id}`)).data.material;
    assert.ok(full.text.includes(want), `${f} should contain "${want}" but was: ${full.text.slice(0, 200)}`);
  }
  const t = await upload('notes.txt', Buffer.from('Glucose is a sugar.').toString('base64'));
  assert.equal(t.data.material.chars, 19);
  assert.equal(ai.calls.length, before, 'no AI calls for text files');
});

test('photos and scanned PDFs are transcribed by the AI once', async () => {
  const png = await upload('notes.png', Buffer.from('fake image bytes').toString('base64'));
  assert.equal(png.status, 200);
  assert.equal(png.data.material.method, 'ai');
  const imgCall = ai.calls.at(-1).body;
  assert.equal(imgCall.messages[0].content[1].type, 'image_url');
  assert.match(imgCall.messages[0].content[1].image_url.url, /^data:image\/png;base64,/);
  const scan = await upload('scan.pdf', fx('notes.pdf'));
  assert.equal(scan.data.material.method, 'ai');
  const pdfCall = ai.calls.at(-1).body;
  assert.equal(pdfCall.messages[0].content[1].type, 'file');
  assert.match(pdfCall.messages[0].content[1].file.file_data, /^data:application\/pdf;base64,/);
});

test('AI notes are built from the materials that are switched on', async () => {
  const set = (await app.call('GET', `/api/sets/${setId}`)).data.set;
  const docx = set.materials.find((m) => m.name === 'cells.docx');
  await app.call('PATCH', `/api/materials/${docx.id}`, { use: false });
  await app.call('POST', `/api/sets/${setId}/ai/notes`, {});
  const prompt = ai.calls.at(-1).body.messages.map((m) => m.content).join('\n');
  assert.match(prompt, /Uploaded material "history.pptx"/);
  assert.match(prompt, /Base the notes on the uploaded materials/);
  assert.match(prompt, /Enzymes are biological catalysts/);
  assert.doesNotMatch(prompt, /Uploaded material "cells.docx"/);
  await app.call('POST', `/api/sets/${setId}/ai/quiz`);
  assert.match(ai.calls.at(-1).body.messages[1].content, /Hydrochloric acid/);
});

test('bad uploads get clear errors', async () => {
  assert.equal((await upload('old.doc', 'AAAA')).status, 415);
  assert.equal((await upload('virus.exe', 'AAAA')).status, 415);
  assert.equal((await upload('broken.docx', Buffer.from('not a zip').toString('base64'))).status, 422);
  assert.equal((await upload('empty.txt', '')).status, 400);
});

test('materials are private and can be deleted', async () => {
  const set = (await app.call('GET', `/api/sets/${setId}`)).data.set;
  const id = set.materials[0].id;
  const mine = app.cookie;
  await app.call('POST', '/api/auth/signup', { username: 'snoop', password: 'password123' });
  assert.equal((await app.call('GET', `/api/materials/${id}`)).status, 404);
  assert.equal((await app.call('POST', `/api/sets/${setId}/materials`, { name: 'x.txt', data: 'eA==' })).status, 404);
  app.setCookie(mine);
  assert.equal((await app.call('DELETE', `/api/materials/${id}`)).status, 200);
  assert.equal((await app.call('GET', `/api/materials/${id}`)).status, 404);
});
