// Turn an uploaded file into study text. Files that have no text layer (photos, scans) are flagged
// for AI transcription instead.
import { docxText, pptxText } from './office.js';
import { pdfText, looksReadable } from './pdf.js';
import { HttpError } from '../http.js';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_TEXT_CHARS = 120000;
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export const kindOf = (name) => {
  const ext = String(name).toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (['txt', 'md', 'markdown', 'csv', 'rtf'].includes(ext)) return 'text';
  if (IMAGE_TYPES[ext]) return 'image';
  if (['doc', 'ppt', 'xls', 'pages', 'key'].includes(ext)) throw new HttpError(415, `Old .${ext} files can't be read. Save it as .docx, .pptx or PDF and upload that.`);
  throw new HttpError(415, 'That file type isn\'t supported. Upload a PDF, Word (.docx), PowerPoint (.pptx), text file, or a photo.');
};
export const imageMime = (name) => IMAGE_TYPES[String(name).toLowerCase().split('.').pop()];

// Symbol-font bullets come out as private-use characters; show them as normal bullets.
const clean = (t) => t.replace(/[\uE000-\uF8FF]/g, '•').replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT_CHARS);

/**
 * Returns { text, pages, method } when text could be read directly,
 * or { needsAi: 'image' | 'pdf', pages } when the file must be transcribed by the AI.
 */
export function extractMaterial(buf, name) {
  const kind = kindOf(name);
  try {
    if (kind === 'text') {
      let t = buf.toString('utf8');
      if (name.toLowerCase().endsWith('.rtf')) t = t.replace(/\\par[d]?/g, '\n').replace(/\{\\[^{}]*\}|\\[a-z]+-?\d* ?|[{}]/g, '');
      return { kind, text: clean(t), pages: null, method: 'text' };
    }
    if (kind === 'docx') return { kind, text: clean(docxText(buf)), pages: null, method: 'text' };
    if (kind === 'pptx') { const r = pptxText(buf); return { kind, text: clean(r.text), pages: r.pages, method: 'text' }; }
    if (kind === 'image') return { kind, needsAi: 'image', pages: null };
    // PDF: use the text layer if it's readable, otherwise it's a scan.
    const r = pdfText(buf);
    if (looksReadable(r.text, r.pages)) return { kind, text: clean(r.text), pages: r.pages, method: 'text' };
    return { kind, needsAi: 'pdf', pages: r.pages };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (/password/.test(e.message)) throw new HttpError(422, e.message);
    if (kind === 'pdf') return { kind, needsAi: 'pdf', pages: null }; // unusual PDF: let the AI try
    throw new HttpError(422, `Couldn't read “${name}”. It may be damaged. Try saving it again, or export it as a PDF.`);
  }
}
