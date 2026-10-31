import { getPgPool } from '@/lib/db';
import { isUuid } from '@/lib/lms';
import { LearningError, text } from '@/lib/learning-errors';

export interface LiveClass {
  id: string; course_id: string; module_id: string | null; title: string; description: string;
  meet_url: string; starts_at: string; ends_at: string; is_published: boolean; is_cancelled: boolean;
  course_title: string; module_title: string | null;
}
export function validateClass(raw: Record<string, unknown>) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new LearningError('Invalid class data.');
  if (!isUuid(raw.course_id) || (raw.module_id && !isUuid(raw.module_id))) throw new LearningError('Choose a valid course and module.');
  const meet = String(raw.meet_url || '').trim();
  if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(meet)) throw new LearningError('Enter a Google Meet link such as https://meet.google.com/abc-defg-hij.');
  const start = new Date(String(raw.starts_at || ''));
  const end = new Date(String(raw.ends_at || ''));
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || +end <= +start) throw new LearningError('End time must be after start time.');
  if ((raw.is_published !== undefined && typeof raw.is_published !== 'boolean') || (raw.is_cancelled !== undefined && typeof raw.is_cancelled !== 'boolean')) throw new LearningError('Invalid publication or cancellation state.');
  return { course_id: raw.course_id, module_id: raw.module_id || null, title: text(raw.title, 200, 'Title'), description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 3000) : '', meet_url: meet, starts_at: start.toISOString(), ends_at: end.toISOString(), is_published: raw.is_published === true, is_cancelled: raw.is_cancelled === true };
}
export async function saveClass(raw: Record<string, unknown>, id?: string) {
  if (id && !isUuid(id)) throw new LearningError('Invalid class.', 404);
  const d = validateClass(raw); const db = await getPgPool().connect();
  try {
    await db.query('BEGIN');
    if (id) {
      const old = (await db.query('SELECT course_id,module_id,starts_at FROM live_classes WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!old) throw new LearningError('Class not found.', 404);
      if ((old.course_id !== d.course_id || old.module_id !== d.module_id || +old.starts_at !== +new Date(d.starts_at)) && (await db.query('SELECT 1 FROM class_attendance WHERE class_id=$1 LIMIT 1', [id])).rowCount) throw new LearningError('The course, module and start time cannot be changed after attendance activity. Create a new class instead.', 409);
    }
    const applicable = await db.query(`SELECT 1 FROM courses c WHERE c.id=$1 AND ($2::uuid IS NULL OR EXISTS (
      SELECT 1 FROM modules m WHERE m.id=$2 AND (m.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.course_id=c.id AND cm.module_id=m.id))))`, [d.course_id, d.module_id]);
    if (!applicable.rowCount) throw new LearningError('The module must belong to the selected course.');
    const values = Object.values(d);
    const result = id
      ? await db.query(`UPDATE live_classes SET course_id=$1,module_id=$2,title=$3,description=$4,meet_url=$5,starts_at=$6,ends_at=$7,is_published=$8,is_cancelled=$9 WHERE id=$10 RETURNING *`, [...values, id])
      : await db.query(`INSERT INTO live_classes(course_id,module_id,title,description,meet_url,starts_at,ends_at,is_published,is_cancelled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, values);
    await db.query('COMMIT'); return result.rows[0];
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
export async function listClasses(courseId?: string | null) {
  if (courseId !== undefined && !isUuid(courseId)) return [];
  const result = await getPgPool().query(`SELECT lc.*, c.title AS course_title, m.title AS module_title
    FROM live_classes lc JOIN courses c ON c.id=lc.course_id LEFT JOIN modules m ON m.id=lc.module_id
    ${courseId === undefined ? '' : `WHERE lc.course_id=$1 AND c.is_published AND lc.is_published
      AND (lc.module_id IS NULL OR (m.is_published AND (m.is_mandatory OR EXISTS (
        SELECT 1 FROM course_modules cm WHERE cm.course_id=c.id AND cm.module_id=m.id))))`}
    ORDER BY lc.starts_at DESC`, courseId === undefined ? [] : [courseId]);
  return result.rows as LiveClass[];
}

/** Public notice-board teaser only. Never expose class titles, course IDs or Meet links. */
export async function publicClassNotice() {
  const result = await getPgPool().query(`SELECT lc.created_at FROM live_classes lc
    JOIN courses c ON c.id=lc.course_id LEFT JOIN modules m ON m.id=lc.module_id
    WHERE lc.is_published AND NOT lc.is_cancelled AND lc.ends_at>NOW() AND c.is_published
      AND (lc.module_id IS NULL OR (m.is_published AND (m.is_mandatory OR EXISTS (
        SELECT 1 FROM course_modules cm WHERE cm.course_id=c.id AND cm.module_id=m.id))))
    ORDER BY lc.created_at DESC LIMIT 1`);
  return result.rowCount ? {
    id: 'online-class-notice',
    message: 'Online classes are scheduled on Google Meet. Students: sign in to view your course calendar. | Google Meet पर ऑनलाइन कक्षाएँ निर्धारित हैं। छात्र: अपने कोर्स का कैलेंडर देखने के लिए लॉगिन करें।',
    created_at: result.rows[0].created_at, link_url: '/portal/classes', is_active: true, sort_order: -1,
  } : null;
}
