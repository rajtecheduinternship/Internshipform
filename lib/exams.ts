import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/db';
import { isUuid } from '@/lib/lms';
import { LearningError } from '@/lib/learning-errors';
import { BankQuestion, validateExam, validateQuestion } from '@/lib/exam-validation';

export type Questions = Pick<BankQuestion, 'id' | 'prompt' | 'options' | 'answer_index'>[];
export interface ExamSummary {
  id: string; title: string; course_id: string; module_id: string; module_title: string;
  duration_minutes: number; pass_percent: number; requires_module_completion: boolean;
  opens_at: string | null; closes_at: string | null; is_published: boolean; published_at: string | null;
  question_ids: string[]; eligible?: boolean;
  attempt_status?: 'not_started' | 'in_progress' | 'submitted';
  result_published_at?: string | null; score_percent?: number | null; passed?: boolean | null;
}
export interface PublicAttempt {
  id: string; deadline_at: string; server_now: string; submitted_at: string | null;
  questions: { id: string; prompt: string; options: string[] }[]; answers: Record<string, number>;
  correct_count: number | null; score_percent: number | null; passed: boolean | null;
  result_published_at: string | null;
}
async function inTransaction<T>(fn: (db: PoolClient) => Promise<T>) {
  const db = await getPgPool().connect();
  try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT'); return result; }
  catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
async function validateScope(db: PoolClient, courseId: string, moduleId: string | null) {
  const r = await db.query(`SELECT 1 FROM courses c WHERE c.id=$1 AND ($2::uuid IS NULL OR EXISTS (
    SELECT 1 FROM modules m WHERE m.id=$2 AND (m.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.course_id=c.id AND cm.module_id=m.id))))`, [courseId, moduleId]);
  if (!r.rowCount) throw new LearningError('Module must belong to the selected course.');
}
export async function listBank(courseId: string) {
  if (!isUuid(courseId)) throw new LearningError('Choose a course.');
  return (await getPgPool().query('SELECT * FROM question_bank WHERE course_id=$1 ORDER BY created_at DESC', [courseId])).rows as BankQuestion[];
}
export async function saveBank(courseId: unknown, moduleId: unknown, raw: unknown[], id?: string) {
  if (!isUuid(courseId) || (moduleId && !isUuid(moduleId)) || (id && !isUuid(id))) throw new LearningError('Invalid course, module or question.');
  if (!Array.isArray(raw) || !raw.length || raw.length > 200 || (id && raw.length !== 1)) throw new LearningError('Provide 1–200 questions.');
  const questions = raw.map(validateQuestion);
  return inTransaction(async (db) => {
    await validateScope(db, courseId, (moduleId as string) || null);
    const result: BankQuestion[] = [];
    for (const q of questions) {
      const values = [courseId, moduleId || null, q.prompt, JSON.stringify(q.options), q.answer_index];
      const r = id ? await db.query('UPDATE question_bank SET module_id=$2,prompt=$3,options=$4,answer_index=$5 WHERE course_id=$1 AND id=$6 RETURNING *', [...values, id])
        : await db.query('INSERT INTO question_bank(course_id,module_id,prompt,options,answer_index) VALUES($1,$2,$3,$4,$5) RETURNING *', values);
      if (!r.rows[0]) throw new LearningError('Question not found.', 404);
      result.push(r.rows[0]);
    }
    return result;
  });
}
export async function saveExam(raw: Record<string, unknown>, id?: string) {
  const d = validateExam(raw);
  if (id && !isUuid(id)) throw new LearningError('Exam not found.', 404);
  return inTransaction(async (db) => {
    await validateScope(db, d.course_id, d.module_id);
    if (id) {
      const prev = (await db.query('SELECT published_at FROM exams WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!prev) throw new LearningError('Exam not found.', 404);
      if (prev.published_at) throw new LearningError('A previously published exam is immutable. Create a new exam for changes.', 409);
    }
    const bank = await db.query('SELECT id FROM question_bank WHERE id=ANY($1::uuid[]) AND course_id=$2 AND (module_id IS NULL OR module_id=$3)', [d.question_ids, d.course_id, d.module_id]);
    if (bank.rowCount !== d.question_ids.length) throw new LearningError('All questions must belong to this course/module.');
    const values = Object.values(d);
    const r = id ? await db.query('UPDATE exams SET course_id=$1,module_id=$2,title=$3,duration_minutes=$4,pass_percent=$5,requires_module_completion=$6,opens_at=$7,closes_at=$8,question_ids=$9 WHERE id=$10 RETURNING *', [...values, id])
      : await db.query('INSERT INTO exams(course_id,module_id,title,duration_minutes,pass_percent,requires_module_completion,opens_at,closes_at,question_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', values);
    return r.rows[0];
  });
}
export async function publishExam(id: string, published: boolean) {
  if (!isUuid(id) || typeof published !== 'boolean') throw new LearningError('Invalid publication request.');
  return inTransaction(async (db) => {
    const exam = (await db.query('SELECT * FROM exams WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!exam) throw new LearningError('Exam not found.', 404);
    let questions = exam.questions;
    if (published && !exam.published_at) {
      const scope = await db.query('SELECT 1 FROM courses c JOIN modules m ON m.id=$2 WHERE c.id=$1 AND c.is_published AND m.is_published', [exam.course_id, exam.module_id]);
      if (!scope.rowCount) throw new LearningError('Publish the course and module first.');
      await validateScope(db, exam.course_id, exam.module_id);
      const r = await db.query('SELECT id,prompt,options,answer_index FROM question_bank WHERE id=ANY($1::uuid[]) AND course_id=$2 AND (module_id IS NULL OR module_id=$3)', [exam.question_ids, exam.course_id, exam.module_id]);
      if (r.rowCount !== exam.question_ids.length) throw new LearningError('Some selected questions are no longer available.');
      questions = r.rows;
    }
    return (await db.query('UPDATE exams SET is_published=$2, questions=$3, published_at=CASE WHEN $2 THEN COALESCE(published_at,NOW()) ELSE published_at END WHERE id=$1 RETURNING *', [id, published, JSON.stringify(questions)])).rows[0];
  });
}
// Same publication/enrollment predicate for listing, start, resume, save and submit.
const visible = `e.course_id=$1 AND e.is_published AND c.is_published AND m.is_published
  AND (m.is_mandatory OR EXISTS (SELECT 1 FROM course_modules cm WHERE cm.course_id=e.course_id AND cm.module_id=e.module_id))`;
const moduleDone = `EXISTS (SELECT 1 FROM videos v WHERE v.module_id=e.module_id AND v.is_published AND v.archived_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM videos v LEFT JOIN video_progress p ON p.video_id=v.id AND p.student_id=$2
  WHERE v.module_id=e.module_id AND v.is_published AND v.archived_at IS NULL AND NOT COALESCE(p.is_completed,false))`;
export async function studentExams(courseId: string | null | undefined, studentId: string) {
  if (!isUuid(courseId)) return [];
  return inTransaction(async (db) => {
    await finalizeExpired(db, undefined, studentId);
    return (await db.query(`SELECT e.id,e.title,e.course_id,e.module_id,m.title AS module_title,e.duration_minutes,e.pass_percent,
      e.requires_module_completion,e.opens_at,e.closes_at,e.is_published, (NOT e.requires_module_completion OR (${moduleDone})) AS eligible,
      CASE WHEN a.id IS NULL THEN 'not_started' WHEN a.submitted_at IS NULL THEN 'in_progress' ELSE 'submitted' END AS attempt_status,
      a.result_published_at,
      CASE WHEN a.result_published_at IS NOT NULL THEN a.score_percent::float END AS score_percent,
      CASE WHEN a.result_published_at IS NOT NULL THEN a.passed END AS passed
      FROM exams e JOIN courses c ON c.id=e.course_id JOIN modules m ON m.id=e.module_id
      LEFT JOIN exam_attempts a ON a.exam_id=e.id AND a.student_id=$2
      WHERE (${visible}) OR (e.course_id=$1 AND c.is_published AND a.result_published_at IS NOT NULL) ORDER BY e.created_at DESC`, [courseId, studentId])).rows as ExamSummary[];
  });
}
export async function adminExams() {
  return (await getPgPool().query(`SELECT e.id,e.title,e.course_id,e.module_id,m.title AS module_title,e.duration_minutes,e.pass_percent,
    e.requires_module_completion,e.opens_at,e.closes_at,e.is_published,e.published_at,e.question_ids
    FROM exams e JOIN modules m ON m.id=e.module_id ORDER BY e.created_at DESC`)).rows as ExamSummary[];
}
function shuffle<T>(items: T[]): T[] {
  const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out;
}
function attemptQuestions(questions: Questions): Questions {
  return shuffle(questions).map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return { ...q, options: order.map((i) => q.options[i]), answer_index: order.indexOf(q.answer_index) };
  });
}
function checkedAnswers(raw: unknown, questions: Questions): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new LearningError('Invalid answers.');
  const answers: Record<string, number> = {};
  for (const [id, answer] of Object.entries(raw)) {
    const q = questions.find((q) => q.id === id);
    if (!q || !Number.isInteger(answer) || Number(answer) < 0 || Number(answer) >= q.options.length) throw new LearningError('Invalid question or answer option.');
    answers[id] = Number(answer);
  }
  return answers;
}
export async function attemptExam(args: { examId: string; courseId: string | null | undefined; studentId: string; action: 'read' | 'start' | 'save' | 'submit'; answers?: unknown; focusEvent?: boolean }) {
  if (!isUuid(args.examId) || !isUuid(args.courseId)) throw new LearningError('Exam not available.', 404);
  return inTransaction(async (db) => {
    const exam = (await db.query(`SELECT e.*, (NOT e.requires_module_completion OR (${moduleDone})) AS eligible
      FROM exams e JOIN courses c ON c.id=e.course_id JOIN modules m ON m.id=e.module_id
      WHERE ((${visible}) ${args.action === 'read' ? `OR (e.course_id=$1 AND c.is_published AND EXISTS (SELECT 1 FROM exam_attempts a WHERE a.exam_id=e.id AND a.student_id=$2 AND a.result_published_at IS NOT NULL))` : ''}) AND e.id=$3 FOR SHARE OF e`, [args.courseId, args.studentId, args.examId])).rows[0];
    if (!exam) throw new LearningError('Exam not available.', 404);
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`exam:${args.examId}:${args.studentId}`]);
    let attempt = (await db.query('SELECT * FROM exam_attempts WHERE exam_id=$1 AND student_id=$2 FOR UPDATE', [args.examId, args.studentId])).rows[0];
    const now: Date = (await db.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if (!attempt && args.action === 'start') {
      if (exam.opens_at && +now < +exam.opens_at) throw new LearningError('Exam has not opened yet.', 403);
      if (exam.closes_at && +now >= +exam.closes_at) throw new LearningError('Exam has closed.', 403);
      if (!exam.eligible) throw new LearningError('Complete the published module lessons before starting this exam.', 403);
      const deadline = new Date(Math.min(+now + exam.duration_minutes * 60000, exam.closes_at ? +exam.closes_at : Infinity));
      attempt = (await db.query('INSERT INTO exam_attempts(exam_id,student_id,questions,started_at,deadline_at) VALUES($1,$2,$3,$4,$5) RETURNING *', [exam.id, args.studentId, JSON.stringify(attemptQuestions(exam.questions)), now, deadline])).rows[0];
    }
    if (!attempt) {
      if (args.action !== 'read') throw new LearningError('Start the exam first.', 409);
      return null;
    }
    const expired = +now >= +attempt.deadline_at;
    // Late answers are deliberately ignored; grade only answers saved before deadline.
    if (!attempt.submitted_at && !expired && (args.action === 'save' || args.action === 'submit')) {
      const incoming = args.answers === undefined && args.focusEvent ? {} : checkedAnswers(args.answers, attempt.questions);
      // Merge patches so an answer save cannot erase unrelated answers from another request.
      attempt.answers = { ...attempt.answers, ...incoming };
      attempt = (await db.query('UPDATE exam_attempts SET answers=$2,focus_events=LEAST(focus_events+$3,10000) WHERE id=$1 RETURNING *', [attempt.id, JSON.stringify(attempt.answers), args.focusEvent ? 1 : 0])).rows[0];
    }
    if (!attempt.submitted_at && (expired || args.action === 'submit')) {
      const questions: Questions = attempt.questions;
      const grade = gradeAttempt(questions, attempt.answers, exam.pass_percent);
      attempt = (await db.query('UPDATE exam_attempts SET submitted_at=$2,correct_count=$3,score_percent=$4,passed=$5 WHERE id=$1 RETURNING *', [attempt.id, expired ? attempt.deadline_at : now, grade.correct_count, grade.score_percent, grade.passed])).rows[0];
    }
    return {
      id: attempt.id, deadline_at: attempt.deadline_at, server_now: now.toISOString(), submitted_at: attempt.submitted_at,
      questions: (attempt.questions as Questions).map(({ id, prompt, options }) => ({ id, prompt, options })),
      answers: attempt.answers, result_published_at: attempt.result_published_at,
      correct_count: attempt.result_published_at ? attempt.correct_count : null,
      score_percent: attempt.result_published_at ? Number(attempt.score_percent) : null,
      passed: attempt.result_published_at ? attempt.passed : null,
    } as PublicAttempt;
  });
}
/** Single grading rule used by submission, expiry and the admin answer review. */
export function gradeAttempt(questions: Questions, answers: Record<string, number>, passPercent: number) {
  const items = questions.map((q) => {
    const selected = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
    const correct = selected === q.answer_index;
    return { id: q.id, prompt: q.prompt, options: q.options, selected_index: selected,
      selected_answer: selected === null ? null : q.options[selected], correct_index: q.answer_index,
      correct_answer: q.options[q.answer_index], is_correct: correct, marks_awarded: correct ? 1 : 0, maximum_marks: 1 };
  });
  const correct = items.filter((q) => q.is_correct).length;
  return { questions: items, correct_count: correct, total_questions: questions.length,
    unanswered_count: items.filter((q) => q.selected_index === null).length,
    incorrect_count: items.filter((q) => q.selected_index !== null && !q.is_correct).length,
    score_percent: Math.round(correct / questions.length * 10000) / 100,
    pass_percent: passPercent, passed: correct * 100 >= passPercent * questions.length };
}
async function finalizeExpired(db: PoolClient, examId?: string, studentId?: string) {
  const rows = (await db.query(`SELECT a.*, e.pass_percent FROM exam_attempts a JOIN exams e ON e.id=a.exam_id
    WHERE ($1::uuid IS NULL OR a.exam_id=$1) AND ($2::uuid IS NULL OR a.student_id=$2)
    AND a.submitted_at IS NULL AND a.deadline_at<=clock_timestamp() ORDER BY a.id FOR UPDATE OF a`, [examId || null, studentId || null])).rows;
  for (const a of rows) {
    const g = gradeAttempt(a.questions, a.answers, a.pass_percent);
    await db.query('UPDATE exam_attempts SET submitted_at=deadline_at,correct_count=$2,score_percent=$3,passed=$4 WHERE id=$1', [a.id, g.correct_count, g.score_percent, g.passed]);
  }
}
export interface AdminExamResult {
  id: string; exam_id: string; student_id: string; full_name: string; phone: string;
  exam_title: string; module_title: string; started_at: string; deadline_at: string;
  submitted_at: string | null; result_published_at: string | null;
  correct_count: number | null; score_percent: number | null; passed: boolean | null;
  focus_events: number; total_questions: number;
}
export interface AdminAnswerReview {
  id: string; exam_id: string; student_id: string; full_name: string; exam_title: string;
  submitted_at: string; result_published_at: string | null;
  grade: ReturnType<typeof gradeAttempt>;
}
export async function adminExamResults(examId: string) {
  if (!isUuid(examId)) throw new LearningError('Invalid exam.');
  return inTransaction(async (db) => {
    await finalizeExpired(db, examId);
    return (await db.query(`SELECT a.id,a.exam_id,a.student_id,p.full_name,p.phone,e.title AS exam_title,m.title AS module_title,
      a.started_at,a.deadline_at,a.submitted_at,a.result_published_at,a.correct_count,a.score_percent::float,a.passed,
      a.focus_events,jsonb_array_length(a.questions) AS total_questions
      FROM exam_attempts a JOIN profiles p ON p.id=a.student_id JOIN exams e ON e.id=a.exam_id
      JOIN modules m ON m.id=e.module_id WHERE a.exam_id=$1 ORDER BY a.started_at DESC`, [examId])).rows as AdminExamResult[];
  });
}
export async function adminAnswerReview(examId: string, attemptId: string): Promise<AdminAnswerReview> {
  if (!isUuid(examId) || !isUuid(attemptId)) throw new LearningError('Result not found.', 404);
  return inTransaction(async (db) => {
    await finalizeExpired(db, examId);
    const a = (await db.query(`SELECT a.*,p.full_name,e.title AS exam_title,e.pass_percent FROM exam_attempts a
      JOIN profiles p ON p.id=a.student_id JOIN exams e ON e.id=a.exam_id
      WHERE a.exam_id=$1 AND a.id=$2 FOR SHARE OF a`, [examId, attemptId])).rows[0];
    if (!a) throw new LearningError('Result not found.', 404);
    if (!a.submitted_at) throw new LearningError('Answer review is available after submission.', 409);
    return { id: a.id, exam_id: a.exam_id, student_id: a.student_id, full_name: a.full_name,
      exam_title: a.exam_title, submitted_at: a.submitted_at, result_published_at: a.result_published_at,
      grade: gradeAttempt(a.questions, a.answers, a.pass_percent) };
  });
}
/** A one-time release of existing submissions, not an auto-release setting for future attempts. */
export async function publishExamResults(examId: string, published: boolean, attemptId?: string) {
  if (!isUuid(examId) || (attemptId !== undefined && !isUuid(attemptId)) || typeof published !== 'boolean') throw new LearningError('Invalid result publication request.');
  return inTransaction(async (db) => {
    if (!(await db.query('SELECT 1 FROM exams WHERE id=$1', [examId])).rowCount) throw new LearningError('Exam not found.', 404);
    await finalizeExpired(db, examId);
    if (attemptId) {
      const a = (await db.query('SELECT submitted_at FROM exam_attempts WHERE exam_id=$1 AND id=$2 FOR UPDATE', [examId, attemptId])).rows[0];
      if (!a) throw new LearningError('Result not found.', 404);
      if (!a.submitted_at) throw new LearningError('Cannot publish an unfinished attempt.', 409);
    }
    const rows = await db.query(`UPDATE exam_attempts SET result_published_at=CASE WHEN $2 THEN COALESCE(result_published_at,clock_timestamp()) ELSE NULL END
      WHERE exam_id=$1 AND ($3::uuid IS NULL OR id=$3) AND submitted_at IS NOT NULL RETURNING id`, [examId, published, attemptId || null]);
    return { updated: rows.rowCount || 0 };
  });
}
export async function adminStudentExams(studentId: string) {
  if (!isUuid(studentId)) throw new LearningError('Student not found.', 404);
  return inTransaction(async (db) => {
    await finalizeExpired(db, undefined, studentId);
    return (await db.query(`SELECT a.id,a.exam_id,a.student_id,p.full_name,p.phone,e.title AS exam_title,m.title AS module_title,
      a.started_at,a.deadline_at,a.submitted_at,a.result_published_at,a.correct_count,a.score_percent::float,a.passed,
      a.focus_events,jsonb_array_length(a.questions) AS total_questions
      FROM exam_attempts a JOIN profiles p ON p.id=a.student_id JOIN exams e ON e.id=a.exam_id
      JOIN modules m ON m.id=e.module_id WHERE a.student_id=$1 ORDER BY a.started_at DESC`, [studentId])).rows as AdminExamResult[];
  });
}
