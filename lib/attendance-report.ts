import { getPgPool } from '@/lib/db';
import { isUuid } from '@/lib/lms';
import { LearningError } from '@/lib/learning-errors';

/** The sheet must show at least this overall attendance (admin decision). */
export const MIN_PERCENT = 90;
export const DEFAULT_REF_CODE = '003';
const REF_CODE = /^[A-Za-z0-9-]{1,12}$/;
export type ClassMark = 'present' | 'absent' | 'unmarked';
export interface SheetRow { date: string; day: number; status: 'Present' | 'Absent' }
export interface Tally { present: number; total: number; percent: number }
export interface ReportDetails {
  student_name: string; gender: string; registration_number: string; roll_number: string;
  college: string; university: string; hours: number; course_title: string;
  rows: SheetRow[];
  /** Only classes the admin explicitly approved as present. */
  recorded: Tally;
  /** What the printed sheet shows after the rules below. */
  sheet: Tally;
  unmarked_days: number;
  topped_up_days: number;
}
export interface ReportSummary {
  id: string; student_id: string; student_name: string; ref_no: string; start_date: string; end_date: string;
  recorded_percent: number; sheet_percent: number; topped_up_days: number; unmarked_days: number; total_days: number;
  missing_registration: boolean; is_published: boolean; published_at: string | null; generated_at: string;
}
export interface SheetReport extends ReportSummary { course_id: string; details: ReportDetails }

const tally = (present: number, total: number): Tally => ({ present, total, percent: total ? Math.round(present / total * 1000) / 10 : 0 });

/**
 * One sheet row per class date (several classes on one day make one row).
 *  - recorded: a day counts only if the admin approved a class that day as present.
 *  - A class nobody marked counts as attended; a day is Absent only when every class
 *    that day was explicitly marked absent.
 *  - If overall attendance is still below `minPercent`, the earliest Absent days are
 *    shown as Present until the minimum is reached (`topped_up_days` records how many).
 */
export function buildSheet(classes: { date: string; mark: ClassMark }[], minPercent = MIN_PERCENT) {
  const byDate = new Map<string, ClassMark[]>();
  for (const c of classes) byDate.set(c.date, [...(byDate.get(c.date) || []), c.mark]);
  const dates = [...byDate.keys()].sort();
  const total = dates.length;
  const recordedPresent = dates.filter((d) => byDate.get(d)!.includes('present')).length;
  const unmarkedDays = dates.filter((d) => !byDate.get(d)!.includes('present') && byDate.get(d)!.includes('unmarked')).length;
  const rows: SheetRow[] = dates.map((date, i) => ({ date, day: i + 1, status: byDate.get(date)!.every((m) => m === 'absent') ? 'Absent' : 'Present' }));
  const needed = Math.ceil(total * minPercent / 100);
  let present = rows.filter((r) => r.status === 'Present').length;
  let toppedUp = 0;
  for (const row of rows) {
    if (present >= needed) break;
    if (row.status === 'Absent') { row.status = 'Present'; present++; toppedUp++; }
  }
  return { rows, recorded: tally(recordedPresent, total), sheet: tally(present, total), unmarked_days: unmarkedDays, topped_up_days: toppedUp };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: unknown, name: string) {
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(+new Date(`${value}T00:00:00Z`))) throw new LearningError(`${name} must be a valid date.`);
  return value;
}
const ISTDATE = "(lc.starts_at AT TIME ZONE 'Asia/Kolkata')::date";
const SUMMARY = `r.id, r.student_id, p.full_name AS student_name, r.ref_no, r.start_date::text, r.end_date::text, r.is_published, r.published_at, r.generated_at,
  (r.details->'recorded'->>'percent')::float AS recorded_percent, (r.details->'sheet'->>'percent')::float AS sheet_percent,
  (r.details->>'topped_up_days')::int AS topped_up_days, (r.details->>'unmarked_days')::int AS unmarked_days, (r.details->'sheet'->>'total')::int AS total_days,
  COALESCE(r.details->>'registration_number','')='' AS missing_registration`;

/** Reference format is `<year>/<code>/<number>`, e.g. 2026/003/1. The code is admin-editable; the year is the current IST year. */
export async function refSettings() {
  const r = (await getPgPool().query("SELECT COALESCE((SELECT ref_code FROM attendance_settings WHERE id), $1) AS code, EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata')::int AS year", [DEFAULT_REF_CODE])).rows[0];
  return { code: r.code as string, year: r.year as number };
}

export async function classDateRange(courseId: unknown) {
  if (!isUuid(courseId)) throw new LearningError('Choose a course.');
  const r = (await getPgPool().query(`SELECT MIN(${ISTDATE})::text AS first, MAX(${ISTDATE})::text AS last, COUNT(DISTINCT ${ISTDATE})::int AS days
    FROM live_classes lc WHERE lc.course_id=$1 AND lc.is_published AND NOT lc.is_cancelled AND lc.starts_at<=clock_timestamp()`, [courseId])).rows[0];
  return { first: r.first as string | null, last: r.last as string | null, days: r.days as number };
}

/**
 * mode 'new'    – only approved students who have no sheet yet (a later batch, e.g. a new college). Existing sheets are left untouched.
 * mode 'drafts' – rebuild sheets that are still drafts. Published sheets are never changed here; hide one first to redo it.
 */
export async function generateReports(courseId: unknown, startDate: unknown, endDate: unknown, refCode?: unknown, mode: unknown = 'new') {
  if (mode !== 'new' && mode !== 'drafts') throw new LearningError('Choose what to generate.');
  if (!isUuid(courseId)) throw new LearningError('Choose a course.');
  const start = validDate(startDate, 'Start date'), end = validDate(endDate, 'End date');
  if (end < start) throw new LearningError('End date must not be before the start date.');
  if (+new Date(`${end}T00:00:00Z`) - +new Date(`${start}T00:00:00Z`) > 366 * 86400000) throw new LearningError('Choose a range of at most one year.');
  if (refCode !== undefined && refCode !== null && refCode !== '' && (typeof refCode !== 'string' || !REF_CODE.test(refCode.trim()))) throw new LearningError('Reference code may use letters, numbers and hyphens only (up to 12 characters).');
  const db = await getPgPool().connect();
  try {
    await db.query('BEGIN');
    if (typeof refCode === 'string' && refCode.trim()) await db.query('INSERT INTO attendance_settings(id,ref_code) VALUES(true,$1) ON CONFLICT(id) DO UPDATE SET ref_code=EXCLUDED.ref_code', [refCode.trim()]);
    const ref = (await db.query("SELECT COALESCE((SELECT ref_code FROM attendance_settings WHERE id), $1) AS code, EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata')::int AS year", [DEFAULT_REF_CODE])).rows[0] as { code: string; year: number };
    const prefix = `${ref.year}/${ref.code}/`;
    const course = (await db.query('SELECT title, duration_hours FROM courses WHERE id=$1', [courseId])).rows[0];
    if (!course) throw new LearningError('Course not found.', 404);
    const classes = (await db.query(`SELECT lc.id, ${ISTDATE}::text AS date FROM live_classes lc
      WHERE lc.course_id=$1 AND lc.is_published AND NOT lc.is_cancelled AND lc.starts_at<=clock_timestamp() AND ${ISTDATE} BETWEEN $2::date AND $3::date`, [courseId, start, end])).rows as { id: string; date: string }[];
    if (!classes.length) throw new LearningError('No published classes took place in this date range, so there is nothing to put on a sheet.', 409);
    const students = (await db.query(`SELECT p.id, p.full_name, ap.gender, ap.university_registration_number AS reg, ap.university_roll_number AS roll, ap.college_name AS college, ap.university_name AS university
      FROM profiles p JOIN internship_applications ap ON ap.id=p.application_id
      WHERE p.course_id=$1 AND p.role='student' AND ap.approval_status='approved' ORDER BY p.full_name, p.id`, [courseId])).rows;
    if (!students.length) throw new LearningError('No approved students are enrolled in this course.', 409);
    const existing = new Map((await db.query('SELECT student_id, is_published FROM attendance_reports WHERE course_id=$1', [courseId])).rows.map((r: { student_id: string; is_published: boolean }) => [r.student_id, r.is_published] as [string, boolean]));
    const todo = students.filter((st) => mode === 'new' ? !existing.has(st.id) : existing.get(st.id) === false);
    const kept = students.length - todo.length;
    if (!todo.length) throw new LearningError(mode === 'new' ? 'Every approved student already has a sheet. Nothing new to generate.' : 'There are no draft sheets to rebuild. Hide a published sheet first if it must be redone.', 409);
    const marks = (await db.query('SELECT class_id, student_id, status FROM class_attendance WHERE class_id=ANY($1::uuid[]) AND student_id=ANY($2::uuid[])',
      [classes.map((c) => c.id), todo.map((s) => s.id)])).rows as { class_id: string; student_id: string; status: string }[];
    const markOf = new Map(marks.map((m) => [`${m.class_id}:${m.student_id}`, m.status === 'present' ? 'present' : m.status === 'absent' ? 'absent' : 'unmarked'] as [string, ClassMark]));
    for (const s of todo) {
      const sheet = buildSheet(classes.map((c) => ({ date: c.date, mark: markOf.get(`${c.id}:${s.id}`) || 'unmarked' })));
      const details: ReportDetails = {
        student_name: s.full_name, gender: s.gender || '', registration_number: (s.reg || '').trim(), roll_number: (s.roll || '').trim(),
        college: (s.college || '').trim(), university: (s.university || '').trim(), hours: course.duration_hours || 90, course_title: course.title, ...sheet,
      };
      // A reference number is permanent once its sheet has ever been published (ref_final). A draft keeps
      // its number while it still matches the current year/code; otherwise it is re-issued from the current series.
      const prior = (await db.query('SELECT ref_no, ref_final FROM attendance_reports WHERE student_id=$1 AND course_id=$2 FOR UPDATE', [s.id, courseId])).rows[0] as { ref_no: string; ref_final: boolean } | undefined;
      let refNo = prior && (prior.ref_final || prior.ref_no.startsWith(prefix)) ? prior.ref_no : '';
      if (!refNo) {
        const n = (await db.query(`INSERT INTO attendance_ref_counters(year,code,last_no) VALUES($1,$2,1)
          ON CONFLICT(year,code) DO UPDATE SET last_no=attendance_ref_counters.last_no+1 RETURNING last_no`, [ref.year, ref.code])).rows[0].last_no as number;
        refNo = `${prefix}${n}`;
      }
      await db.query(`INSERT INTO attendance_reports(student_id,course_id,ref_no,start_date,end_date,min_percent,details)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(student_id,course_id) DO UPDATE SET ref_no=EXCLUDED.ref_no,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,min_percent=EXCLUDED.min_percent,
          details=EXCLUDED.details,is_published=false,published_at=NULL,generated_at=clock_timestamp()`, [s.id, courseId, refNo, start, end, MIN_PERCENT, JSON.stringify(details)]);
    }
    await db.query('COMMIT');
    return { generated: todo.length, kept, class_days: new Set(classes.map((c) => c.date)).size, ref_code: ref.code };
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}

/** Approved, enrolled students with no sheet yet. */
export async function missingCount(courseId: unknown) {
  if (!isUuid(courseId)) return 0;
  return (await getPgPool().query(`SELECT COUNT(*)::int AS n FROM profiles p JOIN internship_applications ap ON ap.id=p.application_id
    WHERE p.course_id=$1 AND p.role='student' AND ap.approval_status='approved' AND NOT EXISTS (SELECT 1 FROM attendance_reports r WHERE r.student_id=p.id AND r.course_id=$1)`, [courseId])).rows[0].n as number;
}

export async function listReports(courseId: unknown) {
  if (!isUuid(courseId)) throw new LearningError('Choose a course.');
  return (await getPgPool().query(`SELECT ${SUMMARY} FROM attendance_reports r JOIN profiles p ON p.id=r.student_id WHERE r.course_id=$1 ORDER BY p.full_name, p.id`, [courseId])).rows as ReportSummary[];
}

/** ids omitted = every sheet on the course. */
export async function setReportsPublished(courseId: unknown, ids: unknown, published: unknown) {
  if (!isUuid(courseId) || typeof published !== 'boolean') throw new LearningError('Invalid request.');
  if (ids !== undefined && ids !== null && (!Array.isArray(ids) || !ids.length || ids.length > 2000 || !ids.every(isUuid))) throw new LearningError('Select at least one sheet.');
  const r = await getPgPool().query(`UPDATE attendance_reports SET is_published=$3, ref_final=ref_final OR $3, published_at=CASE WHEN $3 THEN COALESCE(published_at,clock_timestamp()) ELSE NULL END
    WHERE course_id=$1 AND ($2::uuid[] IS NULL OR id=ANY($2::uuid[])) AND is_published<>$3 RETURNING id`, [courseId, (ids as string[] | null | undefined) ?? null, published]);
  return { updated: r.rowCount || 0 };
}

async function one(where: string, params: unknown[]) {
  const row = (await getPgPool().query(`SELECT ${SUMMARY}, r.course_id, r.details FROM attendance_reports r JOIN profiles p ON p.id=r.student_id WHERE ${where}`, params)).rows[0];
  return (row as SheetReport | undefined) || null;
}
export async function adminReport(id: unknown) {
  if (!isUuid(id)) throw new LearningError('Sheet not found.', 404);
  const r = await one('r.id=$1', [id]); if (!r) throw new LearningError('Sheet not found.', 404); return r;
}
/** A student only ever sees their own, published sheet for their current course. */
export async function studentReport(studentId: string, courseId: string | null | undefined) {
  if (!isUuid(studentId) || !isUuid(courseId)) return null;
  return one('r.student_id=$1 AND r.course_id=$2 AND r.is_published', [studentId, courseId]);
}
