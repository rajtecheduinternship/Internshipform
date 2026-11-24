import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/db';
import { isUuid } from '@/lib/lms';
import { LearningError, text } from '@/lib/learning-errors';
import { gradeAttempt, type Questions } from '@/lib/exams';

/**
 * Practice exams: untimed module practice. A student may retake as often as they like and sees the
 * full result (with correct answers) straight after submitting. A set stays available until an admin
 * deletes (or unpublishes) it. Nothing here touches the real `exams` / `exam_attempts` records.
 */
export interface PracticeSummary {
  id: string; title: string; course_id: string; module_id: string; module_title: string; pass_percent: number;
  question_ids: string[]; question_count: number; is_published: boolean; published_at: string | null; created_at: string;
  attempts?: number; students?: number;
  my_attempts?: number; my_last_percent?: number | null; my_best_percent?: number | null; my_in_progress?: boolean;
}
export interface PracticeAttempt {
  id: string; practice_id: string; started_at: string; submitted_at: string | null;
  questions: { id: string; prompt: string; options: string[] }[]; answers: Record<string, number>;
  /** Present only after submission. */
  result: null | (Omit<ReturnType<typeof gradeAttempt>, 'questions'> & { questions: ReturnType<typeof gradeAttempt>['questions'] });
}
async function inTransaction<T>(fn: (db: PoolClient) => Promise<T>) {
  const db = await getPgPool().connect();
  try { await db.query('BEGIN'); const r = await fn(db); await db.query('COMMIT'); return r; }
  catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
function shuffle<T>(items: T[]): T[] {
  const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out;
}
function mix(questions: Questions): Questions {
  return shuffle(questions).map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return { ...q, options: order.map((i) => q.options[i]), answer_index: order.indexOf(q.answer_index) };
  });
}
const SUMMARY = `p.id, p.title, p.course_id, p.module_id, m.title AS module_title, p.pass_percent, p.question_ids,
  cardinality(p.question_ids) AS question_count, p.is_published, p.published_at, p.created_at`;

/* ---------------- admin ---------------- */
function validate(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new LearningError('Invalid practice exam.');
  const d = raw as Record<string, unknown>;
  if (!isUuid(d.course_id) || !isUuid(d.module_id)) throw new LearningError('Choose a valid course and module.');
  if (!Number.isInteger(d.pass_percent) || Number(d.pass_percent) < 0 || Number(d.pass_percent) > 100) throw new LearningError('Pass percentage must be 0–100.');
  if (!Array.isArray(d.question_ids) || !d.question_ids.length || d.question_ids.length > 200 || !d.question_ids.every(isUuid) || new Set(d.question_ids).size !== d.question_ids.length) throw new LearningError('Select 1–200 distinct bank questions.');
  return { course_id: d.course_id as string, module_id: d.module_id as string, title: text(d.title, 200, 'Title'), pass_percent: d.pass_percent as number, question_ids: d.question_ids as string[] };
}
export async function adminPractice(courseId?: unknown) {
  if (courseId !== undefined && courseId !== null && courseId !== '' && !isUuid(courseId)) throw new LearningError('Choose a course.');
  return (await getPgPool().query(`SELECT ${SUMMARY},
    (SELECT COUNT(*) FROM practice_attempts a WHERE a.practice_id=p.id AND a.submitted_at IS NOT NULL)::int AS attempts,
    (SELECT COUNT(DISTINCT a.student_id) FROM practice_attempts a WHERE a.practice_id=p.id AND a.submitted_at IS NOT NULL)::int AS students
    FROM practice_exams p JOIN modules m ON m.id=p.module_id WHERE ($1::uuid IS NULL OR p.course_id=$1) ORDER BY p.created_at DESC`, [courseId || null])).rows as PracticeSummary[];
}
export async function savePractice(raw: unknown, id?: string) {
  const d = validate(raw);
  if (id && !isUuid(id)) throw new LearningError('Practice exam not found.', 404);
  return inTransaction(async (db) => {
    const scope = await db.query(`SELECT 1 FROM courses c WHERE c.id=$1 AND EXISTS (SELECT 1 FROM modules m WHERE m.id=$2 AND (m.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.course_id=c.id AND cm.module_id=m.id)))`, [d.course_id, d.module_id]);
    if (!scope.rowCount) throw new LearningError('Module must belong to the selected course.');
    const bank = await db.query('SELECT 1 FROM question_bank WHERE id=ANY($1::uuid[]) AND course_id=$2 AND (module_id IS NULL OR module_id=$3)', [d.question_ids, d.course_id, d.module_id]);
    if (bank.rowCount !== d.question_ids.length) throw new LearningError('All questions must belong to this course/module.');
    const r = id
      ? await db.query('UPDATE practice_exams SET course_id=$1,module_id=$2,title=$3,pass_percent=$4,question_ids=$5 WHERE id=$6 RETURNING id', [d.course_id, d.module_id, d.title, d.pass_percent, d.question_ids, id])
      : await db.query('INSERT INTO practice_exams(course_id,module_id,title,pass_percent,question_ids) VALUES($1,$2,$3,$4,$5) RETURNING id', [d.course_id, d.module_id, d.title, d.pass_percent, d.question_ids]);
    if (!r.rows[0]) throw new LearningError('Practice exam not found.', 404);
    return (await db.query(`SELECT ${SUMMARY} FROM practice_exams p JOIN modules m ON m.id=p.module_id WHERE p.id=$1`, [r.rows[0].id])).rows[0] as PracticeSummary;
  });
}
export async function setPracticePublished(id: unknown, published: unknown) {
  if (!isUuid(id) || typeof published !== 'boolean') throw new LearningError('Invalid request.');
  const r = await getPgPool().query(`UPDATE practice_exams SET is_published=$2, published_at=CASE WHEN $2 THEN COALESCE(published_at,clock_timestamp()) ELSE published_at END
    WHERE id=$1 AND ($2 = false OR EXISTS (SELECT 1 FROM courses c JOIN modules m ON m.id=practice_exams.module_id WHERE c.id=practice_exams.course_id AND c.is_published AND m.is_published))
    RETURNING id`, [id, published]);
  if (!r.rowCount) {
    if (!(await getPgPool().query('SELECT 1 FROM practice_exams WHERE id=$1', [id])).rowCount) throw new LearningError('Practice exam not found.', 404);
    throw new LearningError('Publish the course and module first.');
  }
  return { ok: true };
}
/** Deleting a practice set removes it, and every student's attempts on it, for good. */
export async function deletePractice(id: unknown) {
  if (!isUuid(id)) throw new LearningError('Practice exam not found.', 404);
  const r = await getPgPool().query('DELETE FROM practice_exams WHERE id=$1', [id]);
  if (!r.rowCount) throw new LearningError('Practice exam not found.', 404);
}

/* ---------------- student ---------------- */
const visible = `p.course_id=$1 AND p.is_published AND c.is_published AND m.is_published
  AND (m.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.course_id=p.course_id AND cm.module_id=p.module_id))`;
export async function studentPractice(courseId: string | null | undefined, studentId: string) {
  if (!isUuid(courseId)) return [];
  return (await getPgPool().query(`SELECT ${SUMMARY},
    (SELECT COUNT(*) FROM practice_attempts a WHERE a.practice_id=p.id AND a.student_id=$2 AND a.submitted_at IS NOT NULL)::int AS my_attempts,
    (SELECT a.score_percent::float FROM practice_attempts a WHERE a.practice_id=p.id AND a.student_id=$2 AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 1) AS my_last_percent,
    (SELECT MAX(a.score_percent)::float FROM practice_attempts a WHERE a.practice_id=p.id AND a.student_id=$2 AND a.submitted_at IS NOT NULL) AS my_best_percent,
    EXISTS (SELECT 1 FROM practice_attempts a WHERE a.practice_id=p.id AND a.student_id=$2 AND a.submitted_at IS NULL) AS my_in_progress
    FROM practice_exams p JOIN courses c ON c.id=p.course_id JOIN modules m ON m.id=p.module_id
    WHERE ${visible} ORDER BY m.title, p.created_at DESC`, [courseId, studentId])).rows.map((r) => { const { question_ids, ...rest } = r; void question_ids; return rest as PracticeSummary; });
}
function present(a: { id: string; practice_id: string; started_at: string; submitted_at: string | null; questions: Questions; answers: Record<string, number> }, passPercent: number): PracticeAttempt {
  return {
    id: a.id, practice_id: a.practice_id, started_at: a.started_at, submitted_at: a.submitted_at, answers: a.answers,
    questions: a.questions.map(({ id, prompt, options }) => ({ id, prompt, options })), // answer key never leaves before submission
    result: a.submitted_at ? gradeAttempt(a.questions, a.answers, passPercent) : null,
  };
}
function checked(raw: unknown, questions: Questions) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new LearningError('Invalid answers.');
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw)) {
    const q = questions.find((x) => x.id === id);
    if (!q || !Number.isInteger(v) || Number(v) < 0 || Number(v) >= q.options.length) throw new LearningError('Invalid question or answer option.');
    out[id] = Number(v);
  }
  return out;
}
/**
 * read   – the unfinished attempt, else the most recent finished one, else null.
 * start  – resume the unfinished attempt, or begin a fresh one (a retake) with newly shuffled questions.
 * save   – merge answers into the unfinished attempt.
 * submit – merge answers, grade and return the full result.
 */
export async function practiceAttempt(args: { practiceId: string; courseId: string | null | undefined; studentId: string; action: 'read' | 'start' | 'save' | 'submit'; answers?: unknown }) {
  if (!isUuid(args.practiceId) || !isUuid(args.courseId)) throw new LearningError('Practice exam not available.', 404);
  return inTransaction(async (db) => {
    const p = (await db.query(`SELECT p.* FROM practice_exams p JOIN courses c ON c.id=p.course_id JOIN modules m ON m.id=p.module_id WHERE ${visible} AND p.id=$2 FOR SHARE OF p`,
      [args.courseId, args.practiceId])).rows[0];
    if (!p) throw new LearningError('Practice exam not available.', 404);
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`practice:${args.practiceId}:${args.studentId}`]);
    let a = (await db.query('SELECT * FROM practice_attempts WHERE practice_id=$1 AND student_id=$2 AND submitted_at IS NULL FOR UPDATE', [args.practiceId, args.studentId])).rows[0];
    if (args.action === 'read') {
      if (!a) a = (await db.query('SELECT * FROM practice_attempts WHERE practice_id=$1 AND student_id=$2 ORDER BY submitted_at DESC LIMIT 1', [args.practiceId, args.studentId])).rows[0];
      return a ? present(a, p.pass_percent) : null;
    }
    if (args.action === 'start') {
      if (!a) {
        // Always the current bank text; a question an admin removed from the bank simply drops out.
        const qs = (await db.query('SELECT id,prompt,options,answer_index FROM question_bank WHERE id=ANY($1::uuid[]) AND course_id=$2', [p.question_ids, p.course_id])).rows as Questions;
        if (!qs.length) throw new LearningError('This practice exam has no questions available.', 409);
        a = (await db.query('INSERT INTO practice_attempts(practice_id,student_id,questions) VALUES($1,$2,$3) RETURNING *', [p.id, args.studentId, JSON.stringify(mix(qs))])).rows[0];
      }
      return present(a, p.pass_percent);
    }
    if (!a) throw new LearningError('Start the practice exam first.', 409);
    a.answers = { ...a.answers, ...(args.answers === undefined ? {} : checked(args.answers, a.questions)) };
    if (args.action === 'save') a = (await db.query('UPDATE practice_attempts SET answers=$2 WHERE id=$1 RETURNING *', [a.id, JSON.stringify(a.answers)])).rows[0];
    else {
      const g = gradeAttempt(a.questions, a.answers, p.pass_percent);
      a = (await db.query('UPDATE practice_attempts SET answers=$2,submitted_at=clock_timestamp(),correct_count=$3,score_percent=$4,passed=$5 WHERE id=$1 RETURNING *', [a.id, JSON.stringify(a.answers), g.correct_count, g.score_percent, g.passed])).rows[0];
    }
    return present(a, p.pass_percent);
  });
}
/** Every finished attempt of this student on one practice exam, newest first. */
export async function practiceHistory(practiceId: string, courseId: string | null | undefined, studentId: string) {
  if (!isUuid(practiceId) || !isUuid(courseId)) throw new LearningError('Practice exam not available.', 404);
  const open = await getPgPool().query(`SELECT 1 FROM practice_exams p JOIN courses c ON c.id=p.course_id JOIN modules m ON m.id=p.module_id WHERE ${visible} AND p.id=$2`, [courseId, practiceId]);
  if (!open.rowCount) throw new LearningError('Practice exam not available.', 404);
  const r = await getPgPool().query(`SELECT a.id, a.submitted_at, a.correct_count, jsonb_array_length(a.questions) AS total, a.score_percent::float, a.passed
    FROM practice_attempts a JOIN practice_exams p ON p.id=a.practice_id JOIN courses c ON c.id=p.course_id JOIN modules m ON m.id=p.module_id
    WHERE ${visible} AND p.id=$3 AND a.student_id=$2 AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 100`, [courseId, studentId, practiceId]);
  return r.rows as { id: string; submitted_at: string; correct_count: number; total: number; score_percent: number; passed: boolean }[];
}
