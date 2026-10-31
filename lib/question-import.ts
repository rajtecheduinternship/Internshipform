import { inflateRawSync } from 'node:zlib';
import { LearningError } from '@/lib/learning-errors';
import { QuestionInput, validateQuestion } from '@/lib/exam-validation';

export const MAX_WORD_BYTES = 2 * 1024 * 1024;
// Read just word/document.xml, with bounded decompression. Never extract paths,
// execute macros, resolve entities, fetch external relationships or process images.
function documentXml(file: Buffer): string {
  if (file.length > MAX_WORD_BYTES || file.length < 22) throw new LearningError('Upload a .docx file up to 2 MB.');
  let end = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 65557); i--) {
    if (file.readUInt32LE(i) === 0x06054b50 && i + 22 + file.readUInt16LE(i + 20) === file.length) { end = i; break; }
  }
  if (end < 0 || file.readUInt16LE(end + 4) || file.readUInt16LE(end + 6)) throw new LearningError('Invalid or unsupported Word archive.');
  const entries = file.readUInt16LE(end + 10);
  let pos = file.readUInt32LE(end + 16);
  if (entries > 1000 || pos + file.readUInt32LE(end + 12) > end) throw new LearningError('Word archive is too complex.');
  let xml: string | undefined;
  for (let n = 0; n < entries; n++) {
    if (pos + 46 > end || file.readUInt32LE(pos) !== 0x02014b50) throw new LearningError('Invalid Word archive directory.');
    const flags = file.readUInt16LE(pos + 8), method = file.readUInt16LE(pos + 10);
    const packed = file.readUInt32LE(pos + 20), size = file.readUInt32LE(pos + 24);
    const nameLen = file.readUInt16LE(pos + 28), extraLen = file.readUInt16LE(pos + 30), commentLen = file.readUInt16LE(pos + 32);
    if (pos + 46 + nameLen + extraLen + commentLen > end) throw new LearningError('Invalid Word archive entry.');
    const name = file.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    if (/vbaProject/i.test(name)) throw new LearningError('Macro-enabled Word files are not supported.');
    if (name === 'word/document.xml') {
      if (xml !== undefined || flags & 1 || ![0, 8].includes(method) || size > MAX_WORD_BYTES) throw new LearningError('Unsupported or oversized Word document.');
      const local = file.readUInt32LE(pos + 42);
      if (local + 30 > file.length || file.readUInt32LE(local) !== 0x04034b50) throw new LearningError('Invalid Word document entry.');
      const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
      if (start + packed > file.length) throw new LearningError('Truncated Word document.');
      const compressed = file.subarray(start, start + packed);
      let data: Buffer;
      try { data = method === 8 ? inflateRawSync(compressed, { maxOutputLength: MAX_WORD_BYTES }) : compressed; }
      catch { throw new LearningError('Unable to read Word document (invalid or too large).'); }
      if (data.length !== size || data.length > MAX_WORD_BYTES) throw new LearningError('Invalid Word document size.');
      xml = data.toString('utf8');
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (!xml || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new LearningError('Word document text is missing or unsupported.');
  return xml;
}
function unescapeXml(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (entity.startsWith('#')) {
      const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) throw new LearningError('Invalid character in document.');
      return String.fromCodePoint(n);
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[entity];
  });
}
export function parseQuestionText(value: string): QuestionInput[] {
  const blocks = value.trim().split(/\n\s*\n/).filter(Boolean);
  if (!blocks.length || blocks.length > 200) throw new LearningError('Import needs 1–200 questions.');
  return blocks.map((block, index) => {
    const lines = block.split('\n').map((v) => v.trim()).filter(Boolean);
    const prefix = `Question ${index + 1}: `;
    if (!/^Q:\s*\S/i.test(lines[0])) throw new LearningError(prefix + 'start with Q: followed by the question.');
    const answer = lines.at(-1)?.match(/^ANSWER:\s*([A-F])\s*$/i);
    if (!answer) throw new LearningError(prefix + 'end with ANSWER: A (or the correct letter).');
    const options = lines.slice(1, -1).map((line, i) => {
      const option = line.match(/^([A-F])[).]\s*(.+)$/i);
      if (!option || option[1].toUpperCase() !== String.fromCharCode(65 + i)) throw new LearningError(prefix + 'options must be A) through F), one per line, in order.');
      return option[2];
    });
    try { return validateQuestion({ prompt: lines[0].replace(/^Q:\s*/i, ''), options, answer_index: answer[1].toUpperCase().charCodeAt(0) - 65 }); }
    catch (e) { throw new LearningError(prefix + (e as Error).message); }
  });
}
export function importWordQuestions(file: Buffer): QuestionInput[] {
  const xml = documentXml(file);
  // Deliberately constrained format: explicit Q:/A)/ANSWER: text. Word's automatic
  // numbering, tables and tracked changes are not guessed; the preview is mandatory.
  if (/<w:(?:tbl|ins|del)\b/.test(xml)) throw new LearningError('Use plain paragraphs, not tables or tracked changes.');
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map((p) => {
    return [...p[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:br|cr)\b[^>]*\/>/g)].map((t) => t[1] === undefined ? '\n' : unescapeXml(t[1])).join('');
  });
  // Word paragraphs may be separated with or without blank paragraphs; each Q: starts a block.
  const lines = paragraphs.join('\n').split('\n').map((v) => v.trim()).filter(Boolean);
  return parseQuestionText(lines.join('\n').replace(/\n(?=Q:)/gi, '\n\n'));
}
