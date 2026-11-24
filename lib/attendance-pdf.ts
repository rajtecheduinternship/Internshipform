import { jsPDF } from 'jspdf';
import { LETTERHEAD, SEAL } from '@/lib/attendance-assets';
import type { SheetReport } from '@/lib/attendance-report';

/** DD/MM/YYYY. Plain 'YYYY-MM-DD' strings are used as-is; timestamps are shown as the date in India. */
const dmy = (value: string | Date) => {
  const iso = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`;
};
type Word = { text: string; bold: boolean; width: number };

/** Builds the "Internship Attendance Sheet" on the company letterhead. All values come from the stored report snapshot. */
export function generateAttendancePDF(report: SheetReport): Buffer {
  const d = report.details;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, left = 18, right = 192, rowH = 6.4;
  const female = d.gender.toLowerCase().startsWith('f'), male = d.gender.toLowerCase().startsWith('m');
  const title = female ? 'Ms.' : male ? 'Mr.' : 'Mr./Ms.';
  const poss = female ? 'her' : male ? 'his' : 'his/her';

  // Letterhead: keep its true aspect ratio (it is not A4-shaped) and write Ref / Date over its dotted lines.
  const headH = W * LETTERHEAD.height / LETTERHEAD.width;
  doc.addImage(LETTERHEAD.data, 'JPEG', 0, 0, W, headH);
  doc.setFont('times', 'bold'); doc.setFontSize(12);
  doc.text(report.ref_no, 22, headH - 5.4);
  doc.text(dmy(report.generated_at), 177, headH - 5.4);

  const clean = (v: string, fallback: string) => v.trim() ? v.trim().toUpperCase() === v.trim() ? v.trim() : v.trim() : fallback;
  const text = [
    `This is to formally acknowledge that ${title} **${d.student_name.toUpperCase()}** bearing University Registration Number **${clean(d.registration_number, 'N/A')}** , University Roll Number **${clean(d.roll_number, 'N/A')}**`,
    `from **${(d.college || 'N/A').toUpperCase()}** ,${d.university ? ` under **${d.university}**,` : ''} has successfully completed on **${dmy(report.start_date)} to ${dmy(report.end_date)} , ${d.hours} hours Duration** ${poss} internship program at **Rajtech Technological System (P) Ltd.**`,
  ].join(' ');

  // Justified paragraph with inline bold.
  const fontSize = 13; doc.setFontSize(fontSize);
  const space = (b: boolean) => { doc.setFont('times', b ? 'bold' : 'normal'); return doc.getTextWidth(' '); };
  const words: Word[] = [];
  for (const chunk of text.split(/(\*\*.*?\*\*)/g)) {
    if (!chunk) continue;
    const bold = chunk.startsWith('**'); doc.setFont('times', bold ? 'bold' : 'normal');
    for (const w of (bold ? chunk.slice(2, -2) : chunk).split(/\s+/).filter(Boolean)) words.push({ text: w, bold, width: doc.getTextWidth(w) });
  }
  const lines: Word[][] = []; let cur: Word[] = [], curW = 0; const maxW = right - left;
  for (const w of words) {
    const gap = cur.length ? space(w.bold) : 0;
    if (cur.length && curW + gap + w.width > maxW) { lines.push(cur); cur = []; curW = 0; }
    curW += (cur.length ? space(w.bold) : 0) + w.width; cur.push(w);
  }
  if (cur.length) lines.push(cur);
  let y = headH + 14;
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    const natural = line.reduce((n, w) => n + w.width, 0);
    const gap = !last && line.length > 1 ? (maxW - natural) / (line.length - 1) : space(true);
    let x = left;
    for (const w of line) { doc.setFont('times', w.bold ? 'bold' : 'normal'); doc.text(w.text, x, y); x += w.width + gap; }
    y += 8.2;
  });

  // Table, same three columns and title row as the Word template.
  const tx = 30, cols = [38, 32, 36], tw = cols.reduce((a, b) => a + b, 0);
  doc.setLineWidth(0.25);
  const cell = (str: string, x: number, w: number, top: number, bold = false) => {
    doc.rect(x, top, w, rowH); doc.setFont('times', bold ? 'bold' : 'normal'); doc.setFontSize(11.5);
    doc.text(str, x + w / 2, top + rowH - 1.9, { align: 'center' });
  };
  const header = () => {
    doc.rect(tx, y, tw, rowH + 0.6); doc.setFont('times', 'bold'); doc.setFontSize(13);
    doc.text('Internship Attendance Sheet', tx + tw / 2, y + rowH - 1.5, { align: 'center' }); y += rowH + 0.6;
    ['Date', 'Days', 'Attendance'].forEach((h, i) => cell(h, tx + cols.slice(0, i).reduce((a, b) => a + b, 0), cols[i], y)); y += rowH;
  };
  y += 3; header();
  for (const row of d.rows) {
    if (y + rowH > 282) { doc.addPage(); y = 20; header(); }
    [dmy(row.date), `Day-${row.day}`, row.status].forEach((v, i) => cell(v, tx + cols.slice(0, i).reduce((a, b) => a + b, 0), cols[i], y));
    y += rowH;
  }

  // Seal + signature label, kept on the last page.
  const sealW = 46, sealH = sealW * SEAL.height / SEAL.width;
  if (y + sealH > 290) { doc.addPage(); y = 25; }
  const sy = Math.min(y - 4, 290 - sealH - 9);
  doc.addImage(SEAL.data, 'JPEG', 140, sy, sealW, sealH);
  doc.setFont('times', 'normal'); doc.setFontSize(13); doc.text('Signature & Seal', 143, sy + sealH + 6);
  return Buffer.from(doc.output('arraybuffer'));
}
