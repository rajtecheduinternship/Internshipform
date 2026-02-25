import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { urlToBase64 } from './storage';
import { ApplicationRecord } from './db';

export function calculateGrade(marks: number): { grade: string; gradePoint: number } {
  if (marks >= 90) return { grade: 'O (Outstanding)', gradePoint: 10 };
  if (marks >= 80) return { grade: 'A+', gradePoint: 9 };
  if (marks >= 70) return { grade: 'A', gradePoint: 8 };
  if (marks >= 60) return { grade: 'B+', gradePoint: 7 };
  if (marks >= 50) return { grade: 'B', gradePoint: 6 };
  if (marks >= 45) return { grade: 'C', gradePoint: 5 };
  if (marks >= 40) return { grade: 'D', gradePoint: 4 };
  return { grade: 'F (Fail)', gradePoint: 0 };
}

export function calculateDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function getGenderTokens(gender: string) {
  const isFemale = gender.toLowerCase().startsWith('f');
  return {
    salutation: isFemale ? 'Ms.' : 'Mr.',
    relation: isFemale ? 'D/o' : 'S/o',
    pronoun: isFemale ? 'her' : 'him',
    possessive: isFemale ? 'her' : 'his',
  };
}

function formatDateDMY(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export interface CertificateInput {
  application: ApplicationRecord;
  marks: number;
  grade: string;
  gradePoint: number;
  startDate: string;
  endDate: string;
  serialNumber: string;
  rtsRegNumber: string;
  certId: string;
  baseUrl: string;
}

export async function generateCertificatePDF(input: CertificateInput): Promise<Buffer> {
  const { application, marks, grade, startDate, endDate, serialNumber, rtsRegNumber, certId, baseUrl } = input;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // Page: 297mm × 210mm

  // ── Helper for Rich Text Formatting (Inline Bolds) ─────────────────────────
  const drawFormattedText = (text: string, startY: number, lineSpacing: number, maxWidth: number) => {
    const chunks = text.split(/(\*\*.*?\*\*)/g);
    doc.setFontSize(11);

    const spaceWidths = {
      normal: (doc.setFont('helvetica', 'normal'), doc.getTextWidth(' ')),
      bold: (doc.setFont('helvetica', 'bold'), doc.getTextWidth(' ')),
    };

    const lines: any[] = [];
    let currentLine: any[] = [];
    let currentLineWidth = 0;

    for (let chunk of chunks) {
      if (!chunk) continue;

      const isBold = chunk.startsWith('**') && chunk.endsWith('**');
      const content = isBold ? chunk.slice(2, -2) : chunk;
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');

      const words = content.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        const isWhitespace = /^\\s+$/.test(word);
        const wordWidth = isWhitespace ? spaceWidths[isBold ? 'bold' : 'normal'] * word.length : doc.getTextWidth(word);

        if (currentLineWidth + wordWidth > maxWidth && !isWhitespace && currentLine.length > 0) {
          lines.push({ elements: currentLine, width: currentLineWidth });
          currentLine = [];
          currentLineWidth = 0;
        }

        if (currentLine.length === 0 && isWhitespace) continue;

        currentLine.push({ text: word, isBold, width: wordWidth });
        currentLineWidth += wordWidth;
      }
    }
    if (currentLine.length > 0) lines.push({ elements: currentLine, width: currentLineWidth });

    let y = startY;
    for (const line of lines) {
      // Shift left slightly to make room for photo/QR on the right
      let x = 140 - (line.width / 2);
      for (const el of line.elements) {
        if (!/^\\s+$/.test(el.text)) {
          doc.setFont('helvetica', el.isBold ? 'bold' : 'normal');
          doc.text(el.text, x, y);
        }
        x += el.width;
      }
      y += lineSpacing;
    }
  };

  // ── Load image assets ──────────────────────────────────────────────────────

  // RTS logo 
  const rtsLogoPath = path.join(process.cwd(), 'public', 'logo.png');
  const rtsLogoBase64 = `data:image/png;base64,${fs.readFileSync(rtsLogoPath).toString('base64')}`;

  // ISO logo (optional)
  let isoLogoBase64: string | null = null;
  try {
    const isoLogoPath = path.join(process.cwd(), 'public', 'ISO_cropped.png');
    isoLogoBase64 = `data:image/png;base64,${fs.readFileSync(isoLogoPath).toString('base64')}`;
  } catch { }

  let ppuLogoBase64: string | null = null;
  try {
    const ppuLogoPath = path.join(process.cwd(), 'public', 'ppu-logo.png');
    ppuLogoBase64 = `data:image/png;base64,${fs.readFileSync(ppuLogoPath).toString('base64')}`;
  } catch { }

  let photoBase64: string | null = null;
  let photoFormat: 'JPEG' | 'PNG' = 'JPEG';
  if (application.photo) {
    try {
      const raw = application.photo.startsWith('http')
        ? await urlToBase64(application.photo)
        : application.photo;
      if (raw) {
        photoBase64 = raw;
        photoFormat = raw.includes('image/png') ? 'PNG' : 'JPEG';
      }
    } catch { }
  }

  const certViewUrl = `${baseUrl}/certificate/view/${certId}`;
  const qrBase64 = await QRCode.toDataURL(certViewUrl, { margin: 1 });

  // ── Drawing ────────────────────────────────────────────────────────────────

  // 1. Background Texture (Light Cream)
  doc.setFillColor(253, 252, 245);
  doc.rect(0, 0, 297, 210, 'F');

  // 2. Borders (Double Green)
  doc.setDrawColor(20, 100, 40); // Outer green border
  doc.setLineWidth(5);
  doc.rect(8, 8, 281, 194);

  doc.setDrawColor(20, 100, 40); // Inner green border
  doc.setLineWidth(1);
  doc.rect(15, 15, 267, 180);

  // Decorative inner corners
  doc.setFillColor(20, 100, 40);
  doc.rect(14, 14, 3, 3, 'F');
  doc.rect(280, 14, 3, 3, 'F');
  doc.rect(14, 193, 3, 3, 'F');
  doc.rect(280, 193, 3, 3, 'F');

  // 3. Verification text
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('To verify genuineness of the certificate please visit on www.rtseducation.in', 5, 185, { angle: 90 });

  // 4. Dual Header Row
  if (ppuLogoBase64) doc.addImage(ppuLogoBase64, 'PNG', 18, 18, 22, 22);
  doc.setFontSize(10);
  doc.setTextColor(20, 100, 40);
  doc.setFont('helvetica', 'bold');
  doc.text('PATLIPUTRA UNIVERSITY', ppuLogoBase64 ? 42 : 18, 26);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Patna, Bihar', ppuLogoBase64 ? 42 : 18, 31);
  doc.setFontSize(7);
  doc.text('www.ppup.ac.in', ppuLogoBase64 ? 42 : 18, 35);

  doc.addImage(rtsLogoBase64, 'PNG', 256, 18, 22, 22);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 100, 40);
  doc.text('RAJTECH TECHNOLOGICAL SYSTEM', 252, 24, { align: 'right' });
  doc.text('(PVT.) LTD', 252, 29, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Reg. No: U72900BR2023PTC062819', 252, 34, { align: 'right' });

  if (isoLogoBase64) {
    doc.addImage(isoLogoBase64, 'PNG', 205, 35, 12, 12);
  }
  doc.text('ISO 9001:2015 Certified', 252, 43, { align: 'right' });

  // Divider
  doc.setDrawColor(20, 100, 40);
  doc.setLineWidth(0.4);
  doc.line(18, 50, 279, 50);

  // 5. "Certificate" Heading
  doc.setFontSize(32);
  doc.setFont('times', 'italic');
  doc.setTextColor(150, 20, 20); // Deep red
  doc.text('Certificate', 148.5, 64, { align: 'center' });

  doc.setDrawColor(20, 100, 40);
  doc.setLineWidth(0.7);
  doc.line(116, 67, 181, 67);

  // 6. Body text with Bolding
  const { salutation, relation, pronoun, possessive } = getGenderTokens(application.gender);
  const firstName = application.student_name.split(' ')[0];
  const durationDays = calculateDurationDays(startDate, endDate);

  const bodyText =
    `This is to certify that ${salutation} **${application.student_name}** ` +
    (rtsRegNumber ? `Reg. No. **${rtsRegNumber}** ` : ``) +
    `${relation} ${application.father_name}, student of **${application.current_semester}** at **PATLIPUTRA UNIVERSITY** ` +
    `has interned at our institution for a period of **${durationDays} days**. ` +
    `Trained with **${application.internship_topic}** for one of our institutions AT **RAJTECH TECHNOLOGICAL SYSTEM ` +
    `PRIVATE LIMITED** and has achieved the grade **'${grade}'** in the examination. ` +
    `During the period of internship **${firstName}** was found to be efficient, hard working and diligent. ` +
    `We wish ${pronoun} the very best in all ${possessive} future endeavours.`;

  doc.setTextColor(40, 40, 40);
  drawFormattedText(bodyText, 74, 6, 200);

  // 7. Student ID grid
  const gridY = 125;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(`Roll No.:`, 18, gridY);
  doc.text(`Class Roll:`, 120, gridY);
  doc.text(`Reg. No. (University):`, 18, gridY + 8);
  doc.text(`Marks Obtained:`, 18, gridY + 16);
  doc.text(`Internship Period:`, 18, gridY + 24);

  doc.setFont('helvetica', 'bold');
  doc.text(`${application.university_roll_number}`, 60, gridY);
  doc.text(`${application.class_roll_no}`, 145, gridY);
  doc.text(`${application.university_registration_number}`, 60, gridY + 8);
  doc.text(`${marks}/100`, 60, gridY + 16);
  doc.text(`${formatDateDMY(startDate)} to ${formatDateDMY(endDate)}`, 60, gridY + 24);

  // 8. Photo (Right Side, below logo)
  if (photoBase64) {
    doc.addImage(photoBase64, photoFormat, 256, 48, 20, 25);
    doc.setDrawColor(20, 100, 40);
    doc.setLineWidth(0.5);
    doc.rect(256, 48, 20, 25);
  }

  // 9. QR and Details (Moved up, Right Side)
  doc.addImage(qrBase64, 'PNG', 255, 78, 22, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Scan to verify', 266, 104, { align: 'center' });

  // Right aligned Sl No. so it never breaks out of the right border
  doc.setFontSize(8);
  doc.text(`Sl. No. ${serialNumber}`, 278, 114, { align: 'right' });


  // 10. Bottom Row: Date and Signatures
  const bottomY = 180;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  // Left: Date of Issue
  doc.text(`Date of Issue: ${formatDateDMY(new Date().toISOString())}`, 18, bottomY + 5);

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);

  // Center: Auth. Signatory
  doc.line(110, bottomY, 180, bottomY);
  doc.text('Auth. Signatory', 145, bottomY + 5, { align: 'center' });

  // Right: Director
  doc.line(205, bottomY, 275, bottomY);
  doc.text('Director', 240, bottomY + 5, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
