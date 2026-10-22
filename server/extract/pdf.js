// A small, dependency-free PDF text extractor.
// Handles compressed streams, object streams, page order, ToUnicode maps (Word/Google Docs exports),
// simple-font encodings and form XObjects. Scanned PDFs have no text layer; the caller detects that
// and falls back to AI transcription.
import { inflateSync, inflateRawSync, constants } from 'node:zlib';

const MAX_OUT = 64 * 1024 * 1024;
const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([...'()<>[]{}/%'].map((c) => c.charCodeAt(0)));

/* ---------------- object syntax ---------------- */
class Lexer {
  constructor(buf, pos = 0, end = buf.length) { this.b = buf; this.p = pos; this.end = end; }
  skip() {
    const b = this.b;
    while (this.p < this.end) {
      const c = b[this.p];
      if (WS.has(c)) this.p++;
      else if (c === 37) { while (this.p < this.end && b[this.p] !== 10 && b[this.p] !== 13) this.p++; } // % comment
      else break;
    }
  }
  /** Next value or operator. Returns undefined at end. Operators come back as {op}. */
  next() {
    this.skip();
    const b = this.b;
    if (this.p >= this.end) return undefined;
    const c = b[this.p];
    if (c === 47) { // /Name
      let s = ++this.p;
      while (this.p < this.end && !WS.has(b[this.p]) && !DELIM.has(b[this.p])) this.p++;
      return '/' + b.toString('latin1', s, this.p).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    if (c === 40) return { str: this.literal() };
    if (c === 60) {
      if (b[this.p + 1] === 60) { this.p += 2; return this.dict(); }
      const s = ++this.p;
      while (this.p < this.end && b[this.p] !== 62) this.p++;
      let hex = b.toString('latin1', s, this.p++).replace(/[^0-9a-fA-F]/g, '');
      if (hex.length % 2) hex += '0';
      return { str: Buffer.from(hex, 'hex'), hex: true };
    }
    if (c === 91) { this.p++; const arr = []; for (;;) { this.skip(); if (b[this.p] === 93 || this.p >= this.end) { this.p++; return arr; } arr.push(this.next()); } }
    if (c === 62 && b[this.p + 1] === 62) { this.p += 2; return { op: '>>' }; }
    if (c === 93 || c === 41 || c === 123 || c === 125 || c === 62) { this.p++; return { op: String.fromCharCode(c) }; }
    // number or keyword
    const s = this.p;
    while (this.p < this.end && !WS.has(b[this.p]) && !DELIM.has(b[this.p])) this.p++;
    if (this.p === s) { this.p++; return { op: String.fromCharCode(c) }; }
    const tok = b.toString('latin1', s, this.p);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
      const n = parseFloat(tok);
      // "12 0 R" → reference
      if (/^\d+$/.test(tok)) {
        const save = this.p;
        this.skip();
        const m = /^(\d+)\s+R(?![A-Za-z])/.exec(b.toString('latin1', this.p, Math.min(this.end, this.p + 16)));
        if (m) { this.p += m[0].length; return { ref: n }; }
        this.p = save;
      }
      return n;
    }
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'null') return null;
    return { op: tok };
  }
  dict() {
    const d = {};
    for (;;) {
      const k = this.next();
      if (k === undefined || (k && k.op === '>>')) return d;
      if (typeof k === 'string' && k[0] === '/') d[k.slice(1)] = this.next();
    }
  }
  literal() {
    const b = this.b, out = [];
    let depth = 1; this.p++;
    while (this.p < this.end) {
      let c = b[this.p++];
      if (c === 92) { // backslash escape
        c = b[this.p++];
        const map = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 };
        if (map[c] !== undefined) out.push(map[c]);
        else if (c >= 48 && c <= 55) {
          let v = c - 48;
          for (let k = 0; k < 2 && b[this.p] >= 48 && b[this.p] <= 55; k++) v = v * 8 + (b[this.p++] - 48);
          out.push(v & 255);
        } else if (c === 13) { if (b[this.p] === 10) this.p++; }
        else if (c !== 10) out.push(c);
      } else if (c === 40) { depth++; out.push(c); }
      else if (c === 41) { if (--depth === 0) break; out.push(c); }
      else out.push(c);
    }
    return Buffer.from(out);
  }
}
const isName = (v, n) => v === '/' + n;

/* ---------------- streams ---------------- */
function inflate(data) {
  for (const fn of [
    () => inflateSync(data, { maxOutputLength: MAX_OUT }),
    () => inflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH, maxOutputLength: MAX_OUT }),
    () => inflateRawSync(data, { maxOutputLength: MAX_OUT }),
  ]) { try { return fn(); } catch { /* try next */ } }
  return null;
}
function decode(dict, raw) {
  let data = raw;
  const filters = [].concat(dict.Filter ?? []);
  for (const f of filters) {
    if (data === null) return null;
    if (isName(f, 'FlateDecode') || isName(f, 'Fl')) data = inflate(data);
    else if (isName(f, 'ASCIIHexDecode') || isName(f, 'AHx')) data = Buffer.from(data.toString('latin1').replace(/[^0-9a-fA-F]/g, ''), 'hex');
    else return null; // images (DCT, JBIG2...) and rare filters: not text
  }
  return data;
}

/* ---------------- document ---------------- */
function parseDocument(buf) {
  const src = buf.toString('latin1');
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(src))) {
    const num = +m[1];
    const lx = new Lexer(buf, re.lastIndex);
    let value;
    try { value = lx.next(); } catch { continue; }
    let stream = null;
    lx.skip();
    if (src.startsWith('stream', lx.p)) {
      let s = lx.p + 6;
      if (src[s] === '\r') s++;
      if (src[s] === '\n') s++;
      let len = value && typeof value.Length === 'number' ? value.Length : -1;
      let e = len >= 0 && src.startsWith('endstream', skipWs(src, s + len)) ? s + len : src.indexOf('endstream', s);
      if (e < 0) e = src.length;
      stream = buf.subarray(s, e);
      re.lastIndex = e;
    }
    objs.set(num, { value, stream });
  }
  // Objects packed inside object streams (PDF 1.5+)
  for (const [, o] of [...objs]) {
    if (!o.stream || !o.value || !isName(o.value.Type, 'ObjStm')) continue;
    const data = decode(o.value, o.stream);
    if (!data) continue;
    const n = o.value.N, first = o.value.First;
    const head = new Lexer(data, 0, first);
    const pairs = [];
    for (let i = 0; i < n; i++) pairs.push([head.next(), head.next()]);
    pairs.forEach(([num, off], i) => {
      if (objs.has(num)) return;
      const end = i + 1 < pairs.length ? first + pairs[i + 1][1] : data.length;
      try { objs.set(num, { value: new Lexer(data, first + off, end).next(), stream: null }); } catch { /* skip */ }
    });
  }
  return objs;
}
const skipWs = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };

/* ---------------- fonts ---------------- */
const GLYPHS = {
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%', ampersand: '&', quotesingle: "'",
  parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',', hyphen: '-', period: '.', slash: '/',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  colon: ':', semicolon: ';', less: '<', equal: '=', greater: '>', question: '?', at: '@', bracketleft: '[',
  backslash: '\\', bracketright: ']', asciicircum: '^', underscore: '_', grave: '`', braceleft: '{', bar: '|',
  braceright: '}', asciitilde: '~', quoteleft: '‘', quoteright: '’', quotedblleft: '“', quotedblright: '”',
  endash: '–', emdash: '—', bullet: '•', ellipsis: '…', fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl',
  degree: '°', multiply: '×', divide: '÷', minus: '−', copyright: '©', registered: '®', trademark: '™',
  section: '§', paragraph: '¶', dagger: '†', periodcentered: '·', plusminus: '±', mu: 'µ', nbspace: ' ',
};
function glyphToChar(name) {
  if (name.length === 1) return name;
  if (GLYPHS[name]) return GLYPHS[name];
  const u = /^uni([0-9A-Fa-f]{4})/.exec(name) || /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (u) return String.fromCodePoint(parseInt(u[1], 16));
  const base = name.split('.')[0];
  return base !== name ? glyphToChar(base) : '';
}

function utf16be(bytes) {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return s;
}

function parseCMap(data) {
  const map = new Map();
  let width = 1;
  const text = data.toString('latin1');
  const cs = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(text);
  if (cs) { const h = /<([0-9a-fA-F]+)>/.exec(cs[1]); if (h) width = h[1].length / 2; }
  const hex = (h) => Buffer.from(h.length % 2 ? h + '0' : h, 'hex');
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16be(hex(m[2])));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const lx = new Lexer(Buffer.from(block[1], 'latin1'));
    for (;;) {
      const a = lx.next(), b = lx.next(), dst = lx.next();
      if (a === undefined || b === undefined || dst === undefined) break;
      const lo = parseInt(a.str.toString('hex'), 16), hi = parseInt(b.str.toString('hex'), 16);
      if (hi - lo > 65535) continue;
      if (Array.isArray(dst)) dst.forEach((d, i) => d?.str && map.set(lo + i, utf16be(d.str)));
      else if (dst?.str) {
        const base = Buffer.from(dst.str);
        for (let c = lo; c <= hi; c++) {
          const out = Buffer.from(base);
          out.writeUInt16BE((out.readUInt16BE(out.length - 2) + (c - lo)) & 0xffff, out.length - 2);
          map.set(c, utf16be(out));
        }
      }
    }
  }
  return { map, width };
}

function makeFont(doc, fontRef) {
  const font = doc.get(fontRef) || {};
  let cmap = null;
  if (font.ToUnicode) {
    const o = doc.raw(font.ToUnicode);
    const data = o?.stream && decode(o.value || {}, o.stream);
    if (data) cmap = parseCMap(data);
  }
  const composite = isName(font.Subtype, 'Type0');
  const diffs = new Map();
  const enc = doc.get(font.Encoding);
  if (enc && Array.isArray(enc.Differences)) {
    let code = 0;
    for (const d of enc.Differences) {
      if (typeof d === 'number') code = d;
      else if (typeof d === 'string') diffs.set(code++, glyphToChar(d.slice(1)));
    }
  }
  const width = cmap ? cmap.width : composite ? 2 : 1;
  return {
    composite, known: Boolean(cmap) || !composite,
    decode(bytes) {
      let s = '';
      for (let i = 0; i + width <= bytes.length; i += width) {
        const code = width === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
        if (cmap && cmap.map.has(code)) s += cmap.map.get(code);
        else if (diffs.has(code)) s += diffs.get(code);
        else if (!composite) s += code === 0x92 ? '’' : code === 0x93 ? '“' : code === 0x94 ? '”' : code === 0x96 ? '–' : code === 0x97 ? '—' : code === 0x95 ? '•' : String.fromCharCode(code);
        else s += '�';
      }
      return s;
    },
  };
}

/* ---------------- content streams ---------------- */
function runContent(doc, data, resources, out, depth) {
  const res = doc.get(resources) || {};
  const fontsDict = doc.get(res.Font) || {};
  const xobjs = doc.get(res.XObject) || {};
  const fonts = {};
  // Track the text line position so runs on the same baseline join with a space, and new baselines start new lines.
  let font = null, lineY = 0, lastY = null, moved = false, forceNL = false, lineStarted = false;
  const lx = new Lexer(data);
  const ops = [];
  const newline = () => { if (lineStarted) { out.push('\n'); lineStarted = false; } };
  const space = () => { const last = out[out.length - 1]; if (lineStarted && last && !/\s$/.test(last)) out.push(' '); };
  const show = (bytes) => {
    if (!font) return;
    const t = font.decode(bytes);
    if (!t) return;
    if (lastY !== null && (forceNL || Math.abs(lineY - lastY) > 0.4)) newline();
    else if (moved && !/^[.,;:!?)\]]/.test(t)) space();
    lastY = lineY; moved = false; forceNL = false;
    out.push(t); lineStarted = true;
  };
  for (;;) {
    let tok;
    try { tok = lx.next(); } catch { break; }
    if (tok === undefined) break;
    if (!(tok && typeof tok === 'object' && 'op' in tok)) { ops.push(tok); continue; }
    const op = tok.op;
    const num = (k) => (typeof ops[ops.length - k] === 'number' ? ops[ops.length - k] : 0);
    switch (op) {
      case 'BT': lineY = 0; moved = true; break;
      case 'Tf': {
        const name = String(ops[ops.length - 2] || '').slice(1);
        if (!(name in fonts)) fonts[name] = fontsDict[name] ? makeFont(doc, fontsDict[name]) : null;
        font = fonts[name];
        break;
      }
      case 'Td': case 'TD': lineY += num(1); moved = true; break;
      case 'Tm': lineY = num(1); moved = true; break;
      case 'T*': forceNL = true; break;
      case 'Tj': if (ops[ops.length - 1]?.str) show(ops[ops.length - 1].str); break;
      case "'": case '"': forceNL = true; if (ops[ops.length - 1]?.str) show(ops[ops.length - 1].str); break;
      case 'TJ': {
        const arr = ops[ops.length - 1];
        if (Array.isArray(arr)) for (const part of arr) {
          if (part?.str) show(part.str);
          else if (typeof part === 'number' && part < -180) moved = true;
        }
        break;
      }
      case 'ET': break;
      case 'Do': {
        const name = String(ops[ops.length - 1] || '').slice(1);
        const raw = xobjs[name] && doc.raw(xobjs[name]);
        if (raw?.stream && raw.value && isName(raw.value.Subtype, 'Form') && depth < 4) {
          const d = decode(raw.value, raw.stream);
          if (d) { newline(); runContent(doc, d, raw.value.Resources || resources, out, depth + 1); newline(); lastY = null; }
        }
        break;
      }
      case 'BI': { // inline image: skip to EI
        const s = data.indexOf('ID', lx.p, 'latin1');
        const e = s < 0 ? -1 : data.indexOf('EI', s + 2, 'latin1');
        lx.p = e < 0 ? data.length : e + 2;
        break;
      }
      default: break;
    }
    ops.length = 0;
  }
  newline();
}

/** Extract text from a PDF. Returns { text, pages, unknownFonts }. Throws on unreadable/encrypted files. */
export function pdfText(buf) {
  if (buf.toString('latin1', 0, 1024).indexOf('%PDF') < 0) throw new Error('This file is not a PDF.');
  const objs = parseDocument(buf);
  const doc = {
    raw: (v) => (v && v.ref !== undefined ? objs.get(v.ref) : null),
    get(v) { let d = 0; while (v && v.ref !== undefined && d++ < 20) v = objs.get(v.ref)?.value; return v; },
  };
  if ([...objs.values()].some((o) => o.value && o.value.Filter && isName(o.value.Filter, 'Standard')))
    throw new Error('This PDF is password-protected. Remove the password and upload it again.');

  // Pages in reading order: walk the page tree from the catalog.
  const pages = [];
  const walk = (node, inherited, depth) => {
    const n = doc.get(node);
    if (!n || depth > 40) return;
    const resources = n.Resources || inherited;
    if (isName(n.Type, 'Pages') || Array.isArray(n.Kids)) (n.Kids || []).forEach((k) => walk(k, resources, depth + 1));
    else pages.push({ node: n, resources });
  };
  const catalog = [...objs.values()].find((o) => o.value && isName(o.value.Type, 'Catalog'));
  if (catalog) walk(catalog.value.Pages, null, 0);
  if (!pages.length) for (const [, o] of [...objs].sort((a, b) => a[0] - b[0])) if (o.value && isName(o.value.Type, 'Page')) pages.push({ node: o.value, resources: o.value.Resources });

  const parts = [];
  let unknownFonts = false;
  pages.forEach((pg, i) => {
    const contents = [].concat(pg.node.Contents ?? []);
    const chunks = contents.map((c) => { const o = doc.raw(c); return o?.stream ? decode(o.value || {}, o.stream) : null; }).filter(Boolean);
    if (!chunks.length) { parts.push(''); return; }
    const out = [];
    runContent(doc, Buffer.concat(chunks.flatMap((c) => [c, Buffer.from('\n')])), pg.resources, out, 0);
    let t = out.join('').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (t.includes('�')) unknownFonts = true;
    parts.push(t);
    void i;
  });
  return { text: parts.map((t, i) => (pages.length > 1 && t ? `[Page ${i + 1}]\n${t}` : t)).filter(Boolean).join('\n\n'), pages: pages.length, unknownFonts };
}

/** Does extracted text look like real readable text (not a scan or garbled fonts)? */
export function looksReadable(text, pages = 1) {
  const body = text.replace(/\[Page \d+\]/g, '');
  const nonSpace = body.replace(/\s/g, '');
  if (nonSpace.length < Math.max(40, 25 * pages)) return false;
  const good = (nonSpace.match(/[\p{L}\p{N}.,;:!?'"()\-–—’“”%/+=]/gu) || []).length;
  const bad = (body.match(/[�\u0000-\u0008\u000E-\u001F]/g) || []).length;
  const words = body.split(/\s+/).filter(Boolean);
  const avg = nonSpace.length / Math.max(1, words.length);
  return good / nonSpace.length > 0.85 && bad / nonSpace.length < 0.02 && avg < 20;
}
