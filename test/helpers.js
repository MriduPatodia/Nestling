import { createServer } from 'node:http';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';

/** Fake OpenRouter: streams SSE for stream:true, otherwise returns JSON chosen by the prompt. */
export function fakeOpenRouter() {
  const calls = [];
  const srv = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const j = JSON.parse(body); calls.push({ headers: req.headers, body: j });
    if (req.headers.authorization !== 'Bearer test-key') { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end('{"error":{"message":"bad key"}}'); }
    const prompt = j.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
    if (j.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(': OPENROUTER PROCESSING\n\n');
      for (const part of ['## Notes\n', '- **Key** idea\n', '- another']) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
      return;
    }
    let content = 'A short hint.';
    if (prompt.includes('Transcribe ALL')) content = 'Enzymes are biological catalysts. They speed up reactions.';
    if (prompt.includes('flashcards')) content = '```json\n[{"q":"What is X?","a":"Y"},{"q":"Q2","a":"A2"},{"bad":1}]\n```';
    if (prompt.includes('multiple-choice')) content = 'Here you go: [{"q":"Pick B","options":["A","B","C","D"],"answer":1,"explain":"B is right"},{"q":"broken","options":["x"],"answer":3}]';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  return new Promise((r) => srv.listen(0, () => r({ url: `http://127.0.0.1:${srv.address().port}`, calls, close: () => srv.close() })));
}

export async function startApp(aiUrl) {
  const db = openDb(':memory:');
  const cfg = { port: 0, cookieSecure: false, appUrl: 'http://test', aiHourlyLimit: 100,
    openrouter: { key: aiUrl ? 'test-key' : '', model: 'test/model', fastModel: 'test/fast', baseUrl: aiUrl || 'http://unused' } };
  const srv = createServer(createApp({ db, cfg }));
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
  return { db, base, call, close: () => srv.close(), setCookie: (c) => { cookie = c; }, get cookie() { return cookie; } };
}
