// Text from Word (.docx) and PowerPoint (.pptx) files.
import { readZip } from './zip.js';

export const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&');

const tidy = (t) => t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function wordXmlToText(xml) {
  return decodeXml(xml
    .replace(/<w:(instrText|delText)\b[^>]*>[\s\S]*?<\/w:\1>/g, '')
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br\b[^>]*\/>/g, '\n').replace(/<w:cr\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t')
    .replace(/<[^>]+>/g, ''));
}

export function docxText(buf) {
  const zip = readZip(buf);
  const doc = zip.read('word/document.xml');
  if (!doc) throw new Error('This Word file has no document body.');
  let text = wordXmlToText(doc.toString('utf8'));
  // footnotes are often useful in study material
  const foot = zip.read('word/footnotes.xml');
  if (foot) { const f = wordXmlToText(foot.toString('utf8')).trim(); if (f) text += '\n\nFootnotes:\n' + f; }
  return tidy(text);
}

export function pptxText(buf) {
  const zip = readZip(buf);
  const num = (n) => +n.match(/(\d+)\.xml$/)[1];
  const slides = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  if (!slides.length) throw new Error('This PowerPoint file has no slides.');
  const out = slides.map((name) => {
    const xml = zip.read(name).toString('utf8');
    const body = decodeXml(xml.replace(/<a:br\b[^>]*\/>/g, '\n').replace(/<\/a:p>/g, '\n').replace(/<a:tab\/>/g, '\t').replace(/<[^>]+>/g, ''));
    const notesName = `ppt/notesSlides/notesSlide${num(name)}.xml`;
    let notes = '';
    const nx = zip.read(notesName);
    if (nx) notes = decodeXml(nx.toString('utf8').replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/^\s*\d+\s*$/m, '').trim();
    return `Slide ${num(name)}:\n${tidy(body)}${notes ? `\nSpeaker notes: ${notes}` : ''}`;
  });
  return { text: tidy(out.join('\n\n')), pages: slides.length };
}
