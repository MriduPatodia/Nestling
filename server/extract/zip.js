// Minimal ZIP reader (enough for .docx/.pptx). No dependencies.
import { inflateRawSync } from 'node:zlib';

const MAX_TOTAL = 80 * 1024 * 1024; // guard against zip bombs

export function readZip(buf) {
  // Find the End Of Central Directory record (it sits in the last 64 KB).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    entries.set(name, () => {
      if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('bad zip entry');
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + compSize);
      total += size;
      if (total > MAX_TOTAL) throw new Error('zip too large');
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_TOTAL });
      throw new Error('unsupported zip compression');
    });
  }
  return { names: [...entries.keys()], read: (name) => entries.get(name)?.() ?? null };
}
