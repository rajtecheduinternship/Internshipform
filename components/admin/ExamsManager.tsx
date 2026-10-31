'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import ExamResults from './ExamResults';
import { classInput, classInstant } from '@/lib/class-calendar';
import type { BankQuestion, QuestionInput } from '@/lib/exam-validation';
import type { ExamSummary } from '@/lib/exams';
type Course = { id: string; title: string };
type Module = Course & { courses: Course[]; is_mandatory: boolean };
const emptyQuestion = { prompt: '', options: '', answer_index: 0 };
const emptyExam = { title: '', duration_minutes: 30, pass_percent: 50, requires_module_completion: true, opens_at: '', closes_at: '', question_ids: [] as string[] };
export default function ExamsManager() {
  const t = useCopy();
  const [courses, setCourses] = useState<Course[]>([]); const [modules, setModules] = useState<Module[]>([]);
  const [courseId, setCourse] = useState(''); const [moduleId, setModule] = useState('');
  const [bank, setBank] = useState<BankQuestion[]>([]); const [exams, setExams] = useState<ExamSummary[]>([]);
  const [question, setQuestion] = useState(emptyQuestion); const [questionId, setQuestionId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyExam); const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuestionInput[]>([]); const [previewScope, setPreviewScope] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [resultExam, setResultExam] = useState<ExamSummary | null>(null);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([api<{ courses: Course[] }>('/api/admin/courses'), api<{ modules: Module[] }>('/api/admin/modules'), api<{ exams: ExamSummary[] }>('/api/admin/exams')]);
    setCourses(a.courses); setModules(b.modules); setExams(c.exams);
  }, []);
  const loadBank = useCallback(async () => {
    if (!courseId) { setBank([]); return; }
    setBank((await api<{ questions: BankQuestion[] }>(`/api/admin/question-bank?course_id=${courseId}`)).questions);
  }, [courseId]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  useEffect(() => {
    let active = true;
    setBank([]);
    if (courseId) void api<{ questions: BankQuestion[] }>(`/api/admin/question-bank?course_id=${courseId}`).then((d) => { if (active) setBank(d.questions); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [courseId]);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); setMessage(t('Saved successfully.', 'सफलतापूर्वक सेव हो गया।')); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function changeCourse(id: string) {
    setCourse(id); setModule(''); setDraft(emptyExam); setEditId(null); setQuestion(emptyQuestion); setQuestionId(null); setPreview([]); setResultExam(null);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setPreview([]);
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch('/api/admin/question-bank/import', { method: 'POST', body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Import failed');
      setPreview(data.questions); setPreviewScope(`${courseId}:${moduleId}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const availableModules = modules.filter((m) => m.is_mandatory || m.courses.some((c) => c.id === courseId));
  const availableQuestions = bank.filter((q) => !q.module_id || q.module_id === moduleId);
  return <div className="max-w-5xl mx-auto p-4 space-y-5">
    {error && <p role="alert" className="ui-card ui-card-pad">{error} <button className="ui-link" onClick={() => run(async () => { await load(); await loadBank(); })}>{t('Reload data', 'जानकारी फिर लोड करें')}</button></p>}{message && <p role="status">{message}</p>}
    <section className="ui-card ui-card-pad space-y-3">
      <h2 className="ui-h2">{t('Question bank & module examinations', 'प्रश्न बैंक और मॉड्यूल परीक्षाएँ')}</h2>
      <label className="block">{t('Course', 'कोर्स')}<select aria-label={t('Course', 'कोर्स')} disabled={busy} className="ui-field" value={courseId} onChange={(e) => changeCourse(e.target.value)}><option value="">{t('Choose course', 'कोर्स चुनें')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="block">{t('Module (required for exam; optional for bank)', 'मॉड्यूल (परीक्षा के लिए आवश्यक; बैंक के लिए वैकल्पिक)')}<select aria-label={t('Module (required for exam; optional for bank)', 'मॉड्यूल (परीक्षा के लिए आवश्यक; बैंक के लिए वैकल्पिक)')} disabled={busy} className="ui-field" value={moduleId} onChange={(e) => { setModule(e.target.value); setDraft({ ...draft, question_ids: [] }); setEditId(null); setQuestionId(null); setQuestion(emptyQuestion); setPreview([]); }}><option value="">{t('Course question bank', 'कोर्स प्रश्न बैंक')}</option>{availableModules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
    </section>
    {courseId && <>
      <form className="ui-card ui-card-pad space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        const q = { ...question, options: question.options.split('\n').map((v) => v.trim()).filter(Boolean) };
        await api('/api/admin/question-bank', questionId ? 'PATCH' : 'POST', questionId ? { course_id: courseId, module_id: bank.find((q) => q.id === questionId)?.module_id || null, id: questionId, question: q } : { course_id: courseId, module_id: moduleId || null, questions: [q] });
        setQuestion(emptyQuestion); setQuestionId(null); await loadBank();
      }); }}>
        <h3 className="ui-h2">{questionId ? t('Edit bank question', 'बैंक प्रश्न बदलें') : t('Add a question', 'प्रश्न जोड़ें')}</h3>
        <label className="block">{t('Question (Hindi or English)', 'प्रश्न (हिंदी या अंग्रेज़ी)')}<textarea required maxLength={3000} className="ui-field" value={question.prompt} onChange={(e) => setQuestion({ ...question, prompt: e.target.value })} /></label>
        <label className="block">{t('Options (2–6, one per line)', 'विकल्प (2–6, हर पंक्ति में एक)')}<textarea required rows={4} className="ui-field" value={question.options} onChange={(e) => setQuestion({ ...question, options: e.target.value })} /></label>
        <label className="block">{t('Correct answer', 'सही उत्तर')}<select className="ui-field" value={question.answer_index} onChange={(e) => setQuestion({ ...question, answer_index: Number(e.target.value) })}>{question.options.split('\n').filter((v) => v.trim()).map((v, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}) {v}</option>)}</select></label>
        <button className="ui-btn ui-btn-primary" disabled={busy}>{t('Save to question bank', 'प्रश्न बैंक में सेव करें')}</button>{questionId && <button type="button" className="ui-btn ml-2" onClick={() => { setQuestion(emptyQuestion); setQuestionId(null); }}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
      </form>
      <section className="ui-card ui-card-pad space-y-3">
        <h3 className="ui-h2">{t('Import Word question bank', 'Word प्रश्न बैंक आयात करें')}</h3>
        <p>{t('Use a .docx up to 2 MB, plain paragraphs, explicit labels (not automatic numbering). Repeat this block for each question. Review the answer keys before saving. Legacy .doc, tables and tracked changes are not supported.', 'अधिकतम 2 MB की .docx में सामान्य पैराग्राफ और नीचे दिए लेबल लिखें (ऑटो नंबरिंग नहीं)। हर प्रश्न के लिए यही प्रारूप दोहराएँ। सेव करने से पहले उत्तर जाँचें। .doc, तालिकाएँ और ट्रैक किए बदलाव समर्थित नहीं हैं।')}</p>
        <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{'Q: What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nANSWER: B'}</pre>
        <label>{t('Select Word document for preview', 'पूर्वावलोकन के लिए Word फ़ाइल चुनें')}<input disabled={busy} type="file" accept=".docx" className="ui-field" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {!!preview.length && <><h4>{preview.length} {t('questions to review', 'प्रश्न जाँचें')}</h4><ol className="space-y-3 max-h-96 overflow-auto">{preview.map((q, i) => <li key={i}><strong>{i + 1}. {q.prompt}</strong><ul>{q.options.map((v, n) => <li key={n}>{String.fromCharCode(65 + n)}) {v}{n === q.answer_index ? ' ✓' : ''}</li>)}</ul></li>)}</ol><button className="ui-btn ui-btn-primary" disabled={busy || previewScope !== `${courseId}:${moduleId}`} onClick={() => run(async () => { await api('/api/admin/question-bank', 'POST', { course_id: courseId, module_id: moduleId || null, questions: preview }); setPreview([]); await loadBank(); })}>{t('Confirm and save reviewed questions', 'जाँचे हुए प्रश्नों की पुष्टि करके सेव करें')}</button></>}
      </section>
      <form className="ui-card ui-card-pad space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        await api(`/api/admin/exams${editId ? `/${editId}` : ''}`, editId ? 'PATCH' : 'POST', { ...draft, course_id: courseId, module_id: moduleId, opens_at: draft.opens_at ? classInstant(draft.opens_at) : null, closes_at: draft.closes_at ? classInstant(draft.closes_at) : null });
        setDraft(emptyExam); setEditId(null); await load();
      }); }}>
        <h3 className="ui-h2">{editId ? t('Edit draft exam', 'ड्राफ्ट परीक्षा बदलें') : t('Create draft exam', 'ड्राफ्ट परीक्षा बनाएँ')}</h3>
        <label className="block">{t('Exam title', 'परीक्षा का नाम')}<input required maxLength={200} className="ui-field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <div className="grid sm:grid-cols-2 gap-4"><label>{t('Duration (minutes)', 'अवधि (मिनट)')}<input type="number" min={1} max={300} required className="ui-field" value={draft.duration_minutes} onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) })} /></label><label>{t('Pass percentage', 'उत्तीर्ण प्रतिशत')}<input type="number" min={0} max={100} required className="ui-field" value={draft.pass_percent} onChange={(e) => setDraft({ ...draft, pass_percent: Number(e.target.value) })} /></label></div>
        <div className="grid sm:grid-cols-2 gap-4">{(['opens_at', 'closes_at'] as const).map((key) => <label key={key}>{key === 'opens_at' ? t('Opens (IST, optional)', 'शुरू (IST, वैकल्पिक)') : t('Closes (IST, optional)', 'समाप्त (IST, वैकल्पिक)')}<input type="datetime-local" className="ui-field" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
        <label className="flex gap-2"><input type="checkbox" checked={draft.requires_module_completion} onChange={(e) => setDraft({ ...draft, requires_module_completion: e.target.checked })} />{t('Require published module lessons to be completed before starting', 'शुरू करने से पहले मॉड्यूल के प्रकाशित पाठ पूरे करना आवश्यक है')}</label>
        <fieldset className="space-y-2 max-h-96 overflow-auto"><legend>{t('Select bank questions (1–200)', 'बैंक प्रश्न चुनें (1–200)')} · {draft.question_ids.length}</legend>{availableQuestions.map((q) => <div key={q.id} className="border-t pt-2"><label className="flex gap-2"><input type="checkbox" checked={draft.question_ids.includes(q.id)} onChange={(e) => setDraft({ ...draft, question_ids: e.target.checked ? [...draft.question_ids, q.id] : draft.question_ids.filter((id) => id !== q.id) })} />{q.prompt}</label><small>{t('Answer', 'उत्तर')}: {q.options[q.answer_index]}</small><button type="button" className="ui-link ml-3" disabled={busy} onClick={() => { setQuestionId(q.id); setQuestion({ prompt: q.prompt, options: q.options.join('\n'), answer_index: q.answer_index }); }}>{t('Edit question', 'प्रश्न बदलें')}</button></div>)}</fieldset>
        <p>{t('Publishing freezes questions, options, answers and rules. Make a new exam for a retake or any later change. Closing time may shorten the student’s timer.', 'प्रकाशित करने पर प्रश्न, विकल्प, उत्तर और नियम स्थायी हो जाते हैं। दोबारा परीक्षा या बाद के बदलाव के लिए नई परीक्षा बनाएँ। समाप्ति समय छात्र की समय-सीमा कम कर सकता है।')}</p>
        <button className="ui-btn ui-btn-primary" disabled={busy || !moduleId || !draft.question_ids.length}>{t('Save draft exam', 'ड्राफ्ट परीक्षा सेव करें')}</button>{editId && <button type="button" className="ui-btn ml-2" onClick={() => { setEditId(null); setDraft(emptyExam); }}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
      </form>
    </>}
    <h2 className="ui-h2">{t('Examinations', 'परीक्षाएँ')}</h2>
    {exams.filter((e) => !courseId || e.course_id === courseId).map((exam) => <article key={exam.id} className="ui-card ui-card-pad space-y-3"><h3 className="ui-h2">{exam.title}</h3><p>{exam.module_title} · {exam.duration_minutes} {t('minutes', 'मिनट')} · {exam.is_published ? t('Published', 'प्रकाशित') : t('Hidden / draft', 'छिपी / ड्राफ्ट')}</p><div className="flex flex-wrap gap-2">
      {!exam.published_at && <button className="ui-btn" disabled={busy} onClick={() => { setCourse(exam.course_id); setModule(exam.module_id); setEditId(exam.id); setDraft({ title: exam.title, duration_minutes: exam.duration_minutes, pass_percent: exam.pass_percent, requires_module_completion: exam.requires_module_completion, opens_at: exam.opens_at ? classInput(exam.opens_at) : '', closes_at: exam.closes_at ? classInput(exam.closes_at) : '', question_ids: exam.question_ids }); }}>{t('Edit draft', 'ड्राफ्ट बदलें')}</button>}
      <button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => { if (window.confirm(exam.is_published ? t('Hide this exam? Students cannot access it until republished; timers continue.', 'परीक्षा छिपाएँ? दोबारा प्रकाशित होने तक छात्र नहीं खोल पाएँगे; समय-सीमा चलती रहेगी।') : t('Publish this exam? Questions and rules cannot be changed after publishing.', 'परीक्षा प्रकाशित करें? इसके बाद प्रश्न और नियम नहीं बदल सकेंगे।'))) void run(async () => { await api(`/api/admin/exams/${exam.id}`, 'PATCH', { is_published: !exam.is_published }); await load(); }); }}>{exam.is_published ? t('Unpublish', 'प्रकाशन हटाएँ') : t('Publish exam', 'परीक्षा प्रकाशित करें')}</button>
      <button className="ui-btn" disabled={busy} onClick={() => setResultExam(exam)}>{t('View results', 'परिणाम देखें')}</button>
    </div></article>)}
    {resultExam && <div className="space-y-3"><h2 className="ui-h2">{resultExam.title}</h2><ExamResults key={resultExam.id} examId={resultExam.id} /></div>}
  </div>;
}
