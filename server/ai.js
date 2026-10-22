import { APP_NAME } from '../shared/brand.js';
// OpenRouter client (OpenAI-compatible chat completions API). The API key never leaves the server.
import { HttpError } from './http.js';

export class AiError extends HttpError {}

export function makeAi(cfg) {
  const { key, model, fastModel, visionModel, baseUrl } = cfg.openrouter;

  const configured = () => Boolean(key);

  async function request(body, signal) {
    if (!key) throw new AiError(503, 'The AI tutor is not set up yet. Add OPENROUTER_API_KEY to the .env file and restart the server.');
    let res;
    try {
      res = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // Optional OpenRouter attribution headers
          'HTTP-Referer': cfg.appUrl,
          'X-Title': APP_NAME,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new AiError(502, 'Could not reach OpenRouter. Check the server\'s internet connection.');
    }
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = j?.error?.message || ''; } catch { /* ignore */ }
      if (res.status === 401) throw new AiError(502, 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env.');
      if (res.status === 402) throw new AiError(502, 'The OpenRouter account is out of credits.');
      if (res.status === 429) throw new AiError(429, 'The AI is busy right now. Try again in a minute.');
      throw new AiError(502, `The AI request failed (${res.status})${msg ? ': ' + msg : ''}.`);
    }
    return res;
  }

  /** Non-streaming completion → text. */
  async function complete(messages, { fast = false, maxTokens = 1200, temperature = 0.6, signal } = {}) {
    const res = await request({ model: fast ? fastModel : model, messages, max_tokens: maxTokens, temperature }, signal);
    const j = await res.json();
    if (j.error) throw new AiError(502, 'The AI returned an error: ' + (j.error.message || 'unknown'));
    const text = j.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new AiError(502, 'The AI sent back an empty answer. Try again.');
    return text;
  }

  /** Streaming completion. Calls onDelta(textChunk); resolves with the full text. */
  async function stream(messages, onDelta, { maxTokens = 1200, temperature = 0.6, signal } = {}) {
    const res = await request({ model, messages, max_tokens: maxTokens, temperature, stream: true }, signal);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue; // SSE comments like ": OPENROUTER PROCESSING"
        const data = line.slice(5).trim();
        if (data === '[DONE]') return full;
        let j;
        try { j = JSON.parse(data); } catch { continue; }
        if (j.error) throw new AiError(502, 'The AI stopped with an error: ' + (j.error.message || 'unknown'));
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) { full += delta; onDelta(delta); }
      }
    }
    return full;
  }

  /** Ask for JSON and parse it tolerantly (handles code fences and chatter around it). */
  async function json(messages, opts) {
    const text = await complete(messages, { temperature: 0.4, ...opts });
    const parsed = extractJson(text);
    if (parsed === undefined) throw new AiError(502, 'The AI answer could not be read. Try again.');
    return parsed;
  }

  /**
   * Read a photo or scanned PDF and return its text. The file is sent once, at upload time;
   * only the transcribed text is kept.
   */
  async function transcribe({ kind, name, mime, base64 }) {
    const part = kind === 'image'
      ? { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
      : { type: 'file', file: { filename: name, file_data: `data:application/pdf;base64,${base64}` } };
    const res = await request({
      model: visionModel, max_tokens: 6000, temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'This is study material a student uploaded (a photo of notes, a worksheet, a textbook page or a scanned document). Transcribe ALL of its text faithfully, in reading order, keeping headings and lists. Write maths in plain text. Describe any diagrams, graphs or tables briefly in [square brackets]. Reply with the transcription only, no commentary. If there is no readable text, reply with exactly: NO_TEXT' },
        part,
      ] }],
    });
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim() || text.trim() === 'NO_TEXT')
      throw new AiError(422, `The tutor couldn't find any readable text in “${name}”. Try a clearer, well-lit photo.`);
    return text.trim();
  }

  return { configured, complete, stream, json, transcribe, model };
}

export function extractJson(text) {
  const t = String(text).replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  for (const [open, close] of [['[', ']'], ['{', '}']]) {
    const a = t.indexOf(open), b = t.lastIndexOf(close);
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* next */ } }
  }
  return undefined;
}

/* ---------------- prompts ---------------- */
const who = (prefs) => `a ${prefs.level} student who learns best with ${prefs.style}`;
/** Share a character budget across uploaded materials so one huge file doesn't crowd out the rest. */
export function budgetMaterials(materials, budget = 24000) {
  const out = materials.map((m) => ({ name: m.name, text: m.text, take: 0 }));
  let left = budget, open = out.filter((m) => m.text.length);
  while (left > 0 && open.length) {
    const share = Math.floor(left / open.length);
    if (share < 1) break;
    for (const m of open) { const add = Math.min(share, m.text.length - m.take); m.take += add; left -= add; }
    open = open.filter((m) => m.take < m.text.length);
  }
  return out.map((m) => ({ name: m.name, text: m.text.slice(0, m.take), cut: m.take < m.text.length }));
}

export function contextOf(set, { includeAi = true } = {}) {
  const parts = [];
  const mats = budgetMaterials(set.materials || []);
  for (const m of mats) parts.push(`Uploaded material "${m.name}"${m.cut ? ' (shortened)' : ''}:\n${m.text}`);
  if (set.source) parts.push('Text the student pasted in:\n' + set.source.slice(0, 8000));
  if (set.notes_own) parts.push("The student's own notes:\n" + set.notes_own.slice(0, 4000));
  if (includeAi && set.notes_ai) parts.push('Tutor notes written earlier:\n' + set.notes_ai.slice(0, 3000));
  return parts.join('\n\n') || '(No material yet. Use standard curriculum knowledge for this topic.)';
}

export const prompts = {
  notes: (set, prefs) => {
    const hasMaterials = (set.materials || []).length > 0;
    return [
    { role: 'system', content: `You are a patient study tutor writing revision notes for ${who(prefs)}. Adapt vocabulary and depth to their level and use their preferred style.` },
    { role: 'user', content: `Topic: "${set.title}"\n\n${contextOf(set, { includeAi: false })}\n\n${hasMaterials ? 'Base the notes on the uploaded materials: cover their key points, definitions, formulas and examples, in a logical order, and don\'t add topics they don\'t mention. ' : ''}Write clear revision notes in plain markdown: "## " headings, "- " bullets, **bold** key terms. If the student's own notes contain a mistake, add a short "## Fixes to your notes" section. End with "## Check yourself" containing 3 short questions without answers. Stay under ${hasMaterials ? 700 : 450} words.` },
  ];
  },
  cards: (set, prefs, existing) => [
    { role: 'system', content: 'You write flashcards. Reply with only JSON, no prose.' },
    { role: 'user', content: `Write 8 flashcards for ${who(prefs)} on "${set.title}". Reply with only a JSON array of objects {"q": string, "a": string}. Each question tests one idea; answers are under 25 words. Do not repeat these existing questions: ${JSON.stringify(existing.slice(0, 40))}\n\n${contextOf(set)}` },
  ],
  quiz: (set, prefs, existing) => [
    { role: 'system', content: 'You write multiple-choice quiz questions. Reply with only JSON, no prose.' },
    { role: 'user', content: `Write 5 multiple-choice questions for ${who(prefs)} on "${set.title}". Reply with only a JSON array of objects {"q": string, "options": [4 strings], "answer": index 0-3 of the correct option, "explain": one short sentence}. Mix recall and application, and vary which index is correct. Do not repeat: ${JSON.stringify(existing.slice(0, 40))}\n\n${contextOf(set)}` },
  ],
  hint: (q, prefs) => [
    { role: 'system', content: `You give hints to ${who(prefs)}. Never reveal or name the correct option.` },
    { role: 'user', content: `Give ONE short hint (max 25 words) for this question.\nQuestion: ${q.q}\nOptions: ${JSON.parse(q.options).join(' | ')}` },
  ],
  tutor: (set, prefs, history) => [
    { role: 'system', content: `You are a warm, Socratic study tutor for ${who(prefs)}, working on "${set.title}". Encourage independence: when the student asks for an answer, first ask a guiding question or give a hint, and only explain fully if they are still stuck after trying. Keep replies under 150 words, plain text, no headings. If the student says they feel overwhelmed, unsafe, or very low, respond kindly, and suggest the "Talk to someone" page in the app, where they can chat anonymously with a trained person at IMH.\n\nStudy material:\n${contextOf(set)}` },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ],
};
