import { LearningError, text } from '@/lib/learning-errors';
import { isUuid } from '@/lib/lms';
export interface BankQuestion { id: string; course_id: string; module_id: string | null; prompt: string; options: string[]; answer_index: number }
export type QuestionInput = Pick<BankQuestion, 'prompt' | 'options' | 'answer_index'>;
export function validateQuestion(raw: unknown): QuestionInput {
  if (!raw || typeof raw !== 'object') throw new LearningError('Invalid question.');
  const d = raw as Record<string, unknown>;
  const prompt = text(d.prompt, 3000, 'Question');
  if (!Array.isArray(d.options) || d.options.length < 2 || d.options.length > 6) throw new LearningError('Each question needs 2–6 options.');
  const options = d.options.map((v) => text(v, 1000, 'Option'));
  if (new Set(options.map((v) => v.toLocaleLowerCase())).size !== options.length) throw new LearningError('Question options must be distinct.');
  if (!Number.isInteger(d.answer_index) || Number(d.answer_index) < 0 || Number(d.answer_index) >= options.length) throw new LearningError('Choose one correct answer for every question.');
  return { prompt, options, answer_index: Number(d.answer_index) };
}
export function validateExam(raw: Record<string, unknown>) {
  if (!raw || !isUuid(raw.course_id) || !isUuid(raw.module_id)) throw new LearningError('Choose a valid course and module.');
  if (!Number.isInteger(raw.duration_minutes) || Number(raw.duration_minutes) < 1 || Number(raw.duration_minutes) > 300) throw new LearningError('Duration must be 1–300 minutes.');
  if (!Number.isInteger(raw.pass_percent) || Number(raw.pass_percent) < 0 || Number(raw.pass_percent) > 100) throw new LearningError('Pass percentage must be 0–100.');
  if (typeof raw.requires_module_completion !== 'boolean') throw new LearningError('Choose the module completion requirement.');
  if (!Array.isArray(raw.question_ids) || !raw.question_ids.length || raw.question_ids.length > 200 || !raw.question_ids.every(isUuid) || new Set(raw.question_ids).size !== raw.question_ids.length) throw new LearningError('Select 1–200 distinct bank questions.');
  function date(v: unknown) {
    if (v === null || v === undefined || v === '') return null;
    const d = new Date(String(v));
    if (!Number.isFinite(+d)) throw new LearningError('Invalid exam date.');
    return d.toISOString();
  }
  const opens = date(raw.opens_at); const closes = date(raw.closes_at);
  if (opens && closes && closes <= opens) throw new LearningError('Closing time must follow opening time.');
  return { course_id: raw.course_id, module_id: raw.module_id, title: text(raw.title, 200, 'Title'), duration_minutes: raw.duration_minutes as number, pass_percent: raw.pass_percent as number, requires_module_completion: raw.requires_module_completion, opens_at: opens, closes_at: closes, question_ids: raw.question_ids as string[] };
}
