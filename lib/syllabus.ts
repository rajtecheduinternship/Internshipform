import { getPgPool } from '@/lib/db';
import { isUuid } from '@/lib/lms';
import { LearningError } from '@/lib/learning-errors';

export const MAX_SYLLABUS_BYTES = 8 * 1024 * 1024;
export interface SyllabusMeta { course_id: string; filename: string; size_bytes: number; version: number; is_published: boolean; published_at: string | null; updated_at: string }
const META = 'course_id, filename, size_bytes, version, is_published, published_at, updated_at';

/** Read the real request stream with a hard cap, regardless of the Content-Length header. */
export async function readBounded(req: Request, max: number) {
  const reader = req.body?.getReader(); if (!reader) throw new LearningError('Upload a PDF file.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.length;
      if (bytes > max + 65536) { await reader.cancel(); throw new LearningError('The PDF must be 8 MB or smaller.', 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function validatePdf(data: Buffer, filename: unknown) {
  if (!data.length || data.length > MAX_SYLLABUS_BYTES) throw new LearningError('The PDF must be 8 MB or smaller.');
  if (data.subarray(0, 5).toString('latin1') !== '%PDF-') throw new LearningError('Upload a valid PDF file.');
  // Best effort only: scripts inside compressed streams cannot be seen here.
  if (/\/(JavaScript|Launch)\b/.test(data.toString('latin1'))) throw new LearningError('PDFs with scripts or launch actions are not allowed.');
  const base = String(filename || '').split(/[\\/]/).pop() || '';
  if (!/\.pdf$/i.test(base)) throw new LearningError('Upload a file ending in .pdf.');
  return base.replace(/[^\w .()\-]/g, '_').slice(0, 160) || 'Syllabus.pdf';
}

export async function adminSyllabus(courseId: unknown) {
  if (!isUuid(courseId)) throw new LearningError('Course not found.', 404);
  return ((await getPgPool().query(`SELECT ${META} FROM course_syllabi WHERE course_id=$1`, [courseId])).rows[0] as SyllabusMeta | undefined) || null;
}
/** First upload creates it as a draft. Re-uploading replaces the file and bumps the version; a live syllabus stays live. */
export async function saveSyllabus(courseId: unknown, data: Buffer, filename: string) {
  if (!isUuid(courseId)) throw new LearningError('Course not found.', 404);
  if (!(await getPgPool().query('SELECT 1 FROM courses WHERE id=$1', [courseId])).rowCount) throw new LearningError('Course not found.', 404);
  return (await getPgPool().query(`INSERT INTO course_syllabi(course_id, filename, size_bytes, data) VALUES($1,$2,$3,$4)
    ON CONFLICT(course_id) DO UPDATE SET filename=EXCLUDED.filename, size_bytes=EXCLUDED.size_bytes, data=EXCLUDED.data,
      version=course_syllabi.version+1, updated_at=clock_timestamp(),
      published_at=CASE WHEN course_syllabi.is_published THEN clock_timestamp() ELSE course_syllabi.published_at END
    RETURNING ${META}`, [courseId, filename, data.length, data])).rows[0] as SyllabusMeta;
}
export async function setSyllabusPublished(courseId: unknown, published: unknown) {
  if (!isUuid(courseId) || typeof published !== 'boolean') throw new LearningError('Invalid request.');
  const r = await getPgPool().query(`UPDATE course_syllabi SET is_published=$2,
    published_at=CASE WHEN $2 AND NOT is_published THEN clock_timestamp() WHEN $2 THEN published_at ELSE NULL END
    WHERE course_id=$1 RETURNING ${META}`, [courseId, published]);
  if (!r.rowCount) throw new LearningError('Upload a syllabus PDF first.', 404);
  return r.rows[0] as SyllabusMeta;
}
export async function deleteSyllabus(courseId: unknown) {
  if (!isUuid(courseId)) throw new LearningError('Course not found.', 404);
  await getPgPool().query('DELETE FROM course_syllabi WHERE course_id=$1', [courseId]);
}
export async function adminSyllabusFile(courseId: unknown) {
  if (!isUuid(courseId)) throw new LearningError('Course not found.', 404);
  const r = (await getPgPool().query('SELECT filename, data, version FROM course_syllabi WHERE course_id=$1', [courseId])).rows[0];
  if (!r) throw new LearningError('No syllabus uploaded.', 404);
  return r as { filename: string; data: Buffer; version: number };
}
/** Students get only a published syllabus for their own, published course. */
export async function studentSyllabus(courseId: string | null | undefined) {
  if (!isUuid(courseId)) return null;
  return ((await getPgPool().query(`SELECT s.course_id, s.filename, s.size_bytes, s.version, s.is_published, s.published_at, s.updated_at
    FROM course_syllabi s JOIN courses c ON c.id=s.course_id WHERE s.course_id=$1 AND s.is_published AND c.is_published`, [courseId])).rows[0] as SyllabusMeta | undefined) || null;
}
export async function studentSyllabusFile(courseId: string | null | undefined) {
  if (!isUuid(courseId)) return null;
  return ((await getPgPool().query(`SELECT s.filename, s.data, s.version FROM course_syllabi s JOIN courses c ON c.id=s.course_id
    WHERE s.course_id=$1 AND s.is_published AND c.is_published`, [courseId])).rows[0] as { filename: string; data: Buffer; version: number } | undefined) || null;
}
export function pdfResponse(data: Buffer | Uint8Array, filename: string, download: boolean, etag?: string) {
  const safe = filename.replace(/[^\w .()\-]/g, '_');
  return new Response(new Uint8Array(data), { headers: {
    'Content-Type': 'application/pdf', 'Content-Length': String(data.length), 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safe}"`, 'Cache-Control': 'private, no-store', ...(etag ? { ETag: etag } : {}),
  } });
}
