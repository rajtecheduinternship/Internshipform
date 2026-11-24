'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import ExamResults from './ExamResults';
import ScopeResults from './ScopeResults';
import EditorDrawer from './EditorDrawer';
import { useAdminDraft } from './UnsavedChanges';
import { classInput, classInstant } from '@/lib/class-calendar';
import type { BankQuestion, QuestionInput } from '@/lib/exam-validation';
import type { ExamSummary, QuestionBankSummary } from '@/lib/exams';
import type { PracticeSummary } from '@/lib/practice';
type Course = { id: string; title: string };
type Module = Course & { courses: Course[]; is_mandatory: boolean };
const emptyQuestion = { prompt: '', options: '', answer_index: 0 };
const emptyPractice = { title: '', module_id: '', course_ids: [] as string[], pass_percent: 50, question_ids: [] as string[] };
const emptyExam = { title: '', module_id: '', course_ids: [] as string[], duration_minutes: 30, pass_percent: 50, requires_module_completion: false, opens_at: '', closes_at: '', question_ids: [] as string[] };
export default function ExamsManager() {
  const t = useCopy();
  const [courses, setCourses] = useState<Course[]>([]); const [modules, setModules] = useState<Module[]>([]);
  const [courseId, setCourse] = useState(''); const [moduleId, setModule] = useState('');
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]); const [bankId, setBankId] = useState(''); const [bankName, setBankName] = useState<{ id: string | null; title: string; description: string } | null>(null);
  const [bank, setBank] = useState<BankQuestion[]>([]); const [pickBanks, setPickBanks] = useState<string[]>([]); const [pickQs, setPickQs] = useState<BankQuestion[]>([]); const [exams, setExams] = useState<ExamSummary[]>([]);
  const [question, setQuestion] = useState(emptyQuestion); const [questionId, setQuestionId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyExam); const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuestionInput[]>([]); const [previewScope, setPreviewScope] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [view, setView] = useState<'bank' | 'exams' | 'practice' | 'results'>('exams');
  const [practice, setPractice] = useState<PracticeSummary[]>([]); const [practiceDraft, setPracticeDraft] = useState(emptyPractice); const [practiceId, setPracticeId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'question' | 'import' | 'exam' | 'practice' | 'bank' | null>(null);
  const baseline = useRef(''); const resultHeading = useRef<HTMLHeadingElement>(null);
  const [resultExam, setResultExam] = useState<ExamSummary | null>(null);
  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([api<{ courses: Course[] }>('/api/admin/courses'), api<{ modules: Module[] }>('/api/admin/modules'), api<{ exams: ExamSummary[] }>('/api/admin/exams'), api<{ practice: PracticeSummary[] }>('/api/admin/practice'), api<{ banks: QuestionBankSummary[] }>('/api/admin/question-banks')]);
    setCourses(a.courses); setModules(b.modules); setExams(c.exams); setPractice(d.practice); setBanks(e.banks);
  }, []);
  const loadBank = useCallback(async () => {
    if (!bankId) { setBank([]); return; }
    setBank((await api<{ questions: BankQuestion[] }>(`/api/admin/question-bank?bank_id=${bankId}`)).questions);
  }, [bankId]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  useEffect(() => {
    let active = true;
    setBank([]);
    if (bankId) void api<{ questions: BankQuestion[] }>(`/api/admin/question-bank?bank_id=${bankId}`).then((d) => { if (active) setBank(d.questions); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [bankId]);
  // Questions offered when building an exam / practice set: every question of every ticked bank.
  useEffect(() => {
    let active = true;
    if (!pickBanks.length) { setPickQs([]); return; }
    void api<{ questions: BankQuestion[] }>(`/api/admin/question-bank?bank_ids=${pickBanks.join(',')}`).then((d) => { if (active) setPickQs(d.questions); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [pickBanks]);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); setMessage(t('Saved successfully.', 'सफलतापूर्वक सेव हो गया।')); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const dirty = panel === 'bank' ? JSON.stringify({ title: bankName?.title, description: bankName?.description }) !== baseline.current : panel === 'question' ? JSON.stringify(question) !== baseline.current : panel === 'exam' ? JSON.stringify(draft) !== baseline.current : panel === 'practice' ? JSON.stringify(practiceDraft) !== baseline.current : panel === 'import' && preview.length > 0;
  const canLeave = useAdminDraft(!!panel && !!dirty, busy);
  function closePanel() { if (canLeave()) { setPanel(null); setPreview([]); } }
  function chooseView(next: typeof view) { if (!canLeave()) return; setPanel(null); setView(next); const url = new URL(window.location.href); url.searchParams.set('assessment', next); window.history.replaceState(null, '', url); }
  useEffect(() => { const value = new URL(window.location.href).searchParams.get('assessment'); if (value === 'bank' || value === 'exams' || value === 'practice' || value === 'results') setView(value); }, []);
  useEffect(() => { if (view === 'results' && resultExam) { resultHeading.current?.focus(); resultHeading.current?.scrollIntoView({ block: 'start' }); } }, [view, resultExam]);
  function changeCourse(id: string) {
    if (!canLeave()) return; setPanel(null);
    setCourse(id); setModule(''); setResultExam(null);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setPreview([]);
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch('/api/admin/question-bank/import', { method: 'POST', body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Import failed');
      setPreview(data.questions); setPreviewScope(bankId);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const availableModules = modules.filter((m) => m.is_mandatory || m.courses.some((c) => c.id === courseId));
  const availableQuestions = pickQs;
  /** Courses that can take the chosen module (mandatory modules go to every course). */
  const coursesFor = (moduleIdValue: string) => { const m = modules.find((x) => x.id === moduleIdValue); return !m ? [] : m.is_mandatory ? courses : courses.filter((c) => m.courses.some((x) => x.id === c.id)); };

  function openBankName(b?: QuestionBankSummary) { if (!canLeave()) return; setBankName({ id: b?.id || null, title: b?.title || '', description: b?.description || '' }); setPanel('bank'); setError(''); baseline.current = JSON.stringify({ title: b?.title || '', description: b?.description || '' }); }
  function openQuestion(q?: BankQuestion) {
    if (!canLeave()) return;
    const value = q ? { prompt: q.prompt, options: q.options.join('\n'), answer_index: q.answer_index } : emptyQuestion;
    setQuestion(value); setQuestionId(q?.id || null); baseline.current = JSON.stringify(value); setPanel('question'); setError('');
  }
  function openExam(exam?: ExamSummary) {
    if (!canLeave()) return;
    const value = exam ? { title: exam.title, module_id: exam.module_id, course_ids: exam.course_ids || [], duration_minutes: exam.duration_minutes, pass_percent: exam.pass_percent, requires_module_completion: exam.requires_module_completion, opens_at: exam.opens_at ? classInput(exam.opens_at) : '', closes_at: exam.closes_at ? classInput(exam.closes_at) : '', question_ids: exam.question_ids } : emptyExam;
    setPickBanks(exam ? banks.map((b) => b.id) : []);
    setDraft(value); setEditId(exam?.id || null); baseline.current = JSON.stringify(value); setPanel('exam'); setError('');
  }
  function openPractice(item?: PracticeSummary) {
    if (!canLeave()) return;
    const value = item ? { title: item.title, module_id: item.module_id, course_ids: item.course_ids || [], pass_percent: item.pass_percent, question_ids: item.question_ids } : emptyPractice;
    setPickBanks(item ? banks.map((b) => b.id) : []);
    setPracticeDraft(value); setPracticeId(item?.id || null); baseline.current = JSON.stringify(value); setPanel('practice'); setError('');
  }
  function openResults(exam: ExamSummary) { chooseView('results'); setResultExam(exam); }
  const shownExams = exams.filter((e) => (!courseId || e.course_ids?.includes(courseId)) && (!moduleId || e.module_id === moduleId));
  const shownPractice = practice.filter((x) => (!courseId || x.course_ids?.includes(courseId)) && (!moduleId || x.module_id === moduleId));
  const courseNames = (ids?: string[]) => (ids || []).map((id) => courses.find((c) => c.id === id)?.title).filter(Boolean).join(', ');
  const shownBank = bank;
  return <div className="max-w-5xl mx-auto p-4 space-y-5">
    {error && !panel && <p role="alert" className="ui-card ui-card-pad">{error} <button className="ui-link" onClick={() => run(async () => { await load(); await loadBank(); })}>{t('Reload data', 'जानकारी फिर लोड करें')}</button></p>}{message && <p role="status">{message}</p>}
    <nav className="admin-view-tabs" aria-label={t('Assessment areas', 'मूल्यांकन के भाग')}>
      {([['bank','Question Bank','प्रश्न बैंक'],['exams','Exams','परीक्षाएँ'],['practice','Practice','अभ्यास'],['results','Results','परिणाम']] as const).map(([key,en,hi]) => <button key={key} className={`ui-btn ${view === key ? 'ui-btn-primary' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => chooseView(key)}>{t(en,hi)}</button>)}
    </nav>
    {view !== 'bank' && <section className="ui-card ui-card-pad admin-filter-grid" aria-label={t('Course context', 'कोर्स का संदर्भ')}>
      <label>{t('Course', 'कोर्स')}<select aria-label={t('Course', 'कोर्स')} disabled={busy} className="ui-field" value={courseId} onChange={(e) => changeCourse(e.target.value)}><option value="">{t('All courses', 'सभी कोर्स')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>{t('Module', 'मॉड्यूल')}<select aria-label={t('Module', 'मॉड्यूल')} disabled={busy || !courseId} className="ui-field" value={moduleId} onChange={(e) => { if (canLeave()) { setModule(e.target.value); setPanel(null); } }}><option value="">{t('All modules', 'सभी मॉड्यूल')}</option>{availableModules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
    </section>}
    {view === 'bank' && <>
      <div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="ui-h2">{t('Question banks', 'प्रश्न बैंक')}</h2><button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => openBankName()}>{t('New question bank', 'नया प्रश्न बैंक')}</button></div>
      <p>{t('A question bank is a named set of questions that is not tied to any course. Create as many as you like, then pick questions from one or several banks when you build an exam or practice set for one or many courses.', 'प्रश्न बैंक प्रश्नों का एक नामित समूह है, जो किसी कोर्स से बँधा नहीं होता। जितने चाहें बनाएँ, फिर एक या कई कोर्स की परीक्षा या अभ्यास बनाते समय एक या कई बैंक से प्रश्न चुनें।')}</p>
      <label>{t('Question bank', 'प्रश्न बैंक')}<select aria-label={t('Question bank', 'प्रश्न बैंक')} className="ui-field" disabled={busy} value={bankId} onChange={(e) => { if (canLeave()) { setPanel(null); setBankId(e.target.value); } }}><option value="">{banks.length ? t('Choose a bank', 'बैंक चुनें') : t('No banks yet', 'अभी कोई बैंक नहीं')}</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.question_count})</option>)}</select></label>
      {bankId && <div className="flex flex-wrap gap-2"><button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => openQuestion()}>{t('Add question', 'प्रश्न जोड़ें')}</button><button className="ui-btn" disabled={busy} onClick={() => { if (canLeave()) { setPreview([]); setPanel('import'); } }}>{t('Import Word questions', 'Word प्रश्न आयात करें')}</button><button className="ui-btn" disabled={busy} onClick={() => openBankName(banks.find((b) => b.id === bankId))}>{t('Rename bank', 'बैंक का नाम बदलें')}</button><button className="ui-btn" disabled={busy} onClick={() => { if (window.confirm(t('Delete this question bank and all its questions? Published exams keep their own frozen copy; draft exams and practice sets lose these questions.', 'यह प्रश्न बैंक और उसके सभी प्रश्न हटाएँ? प्रकाशित परीक्षाओं की अपनी प्रति सुरक्षित रहती है; ड्राफ्ट परीक्षाओं और अभ्यास सेट से ये प्रश्न हट जाएँगे।'))) void run(async () => { await api(`/api/admin/question-banks/${bankId}`, 'DELETE'); setBankId(''); await load(); }); }}>{t('Delete bank', 'बैंक हटाएँ')}</button></div>}
      {!bankId ? <p>{t('Choose a bank to see and edit its questions, or create a new one.', 'प्रश्न देखने और बदलने के लिए बैंक चुनें, या नया बनाएँ।')}</p> : !shownBank.length ? <p>{t('No questions in this bank yet.', 'इस बैंक में अभी कोई प्रश्न नहीं है।')}</p> : shownBank.map((q,i) => <article key={q.id} className="ui-card ui-card-pad space-y-2"><h3 className="font-semibold">{i+1}. {q.prompt}</h3><p>{t('Answer', 'उत्तर')}: {q.options[q.answer_index]}</p><div className="flex gap-2"><button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => openQuestion(q)}>{t('Edit question', 'प्रश्न बदलें')}</button><button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => { if (window.confirm(t('Delete this question?', 'यह प्रश्न हटाएँ?'))) void run(async () => { await api('/api/admin/question-bank', 'DELETE', { bank_id: bankId, id: q.id }); await loadBank(); await load(); }); }}>{t('Delete', 'हटाएँ')}</button></div></article>)}
    </>}
    {view === 'exams' && <><div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="ui-h2">{t('Examinations', 'परीक्षाएँ')}</h2><button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => openExam()}>{t('Create exam', 'परीक्षा बनाएँ')}</button></div>      {!shownExams.length && <p>{t('No examinations match this selection.', 'इस चयन में कोई परीक्षा नहीं है।')}</p>}
      {shownExams.map((exam) => <article key={exam.id} className="ui-card ui-card-pad space-y-3"><h3 className="ui-h2">{exam.title}</h3><p>{exam.module_title} · {courseNames(exam.course_ids)} · {exam.duration_minutes} {t('minutes', 'मिनट')} · {exam.is_published ? t('Published exam', 'प्रकाशित परीक्षा') : exam.published_at ? t('Unpublished · locked', 'अप्रकाशित · बदलाव बंद') : t('Draft · editable', 'ड्राफ्ट · बदला जा सकता है')}</p><div className="flex flex-wrap gap-2">
        {!exam.published_at && <button className="ui-btn" disabled={busy} onClick={() => openExam(exam)}>{t('Edit draft', 'ड्राफ्ट बदलें')}</button>}
        <button className="ui-btn" disabled={busy} onClick={() => { if (window.confirm(exam.is_published ? t('Hide this exam? Existing timers keep running.', 'परीक्षा छिपाएँ? समय-सीमा चलती रहेगी।') : t('Publish this exam? Questions and rules will be locked.', 'परीक्षा प्रकाशित करें? प्रश्न और नियम स्थायी हो जाएँगे।'))) void run(async () => { await api(`/api/admin/exams/${exam.id}`, 'PATCH', { is_published: !exam.is_published }); await load(); }); }}>{exam.is_published ? t('Unpublish exam', 'परीक्षा का प्रकाशन हटाएँ') : t('Publish exam', 'परीक्षा प्रकाशित करें')}</button>
        <button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => openResults(exam)}>{t('View results', 'परिणाम देखें')}</button>
      </div></article>)}
    </>}
    {view === 'practice' && <><div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="ui-h2">{t('Practice exams', 'अभ्यास परीक्षाएँ')}</h2><button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => openPractice()}>{t('Create practice exam', 'अभ्यास परीक्षा बनाएँ')}</button></div>
      <p>{t('Students can retake a practice exam as many times as they like and see their result straight away. It stays available until you delete it. Practice never affects real exam results.', 'छात्र अभ्यास परीक्षा जितनी बार चाहें दे सकते हैं और तुरंत परिणाम देखते हैं। जब तक आप हटाएँ नहीं, यह उपलब्ध रहती है। अभ्यास का असली परीक्षा परिणाम पर कोई असर नहीं पड़ता।')}</p>
      {!shownPractice.length && <p>{t('No practice exams match this selection.', 'इस चयन में कोई अभ्यास परीक्षा नहीं है।')}</p>}
      {shownPractice.map((x) => <article key={x.id} className="ui-card ui-card-pad space-y-3"><h3 className="ui-h2 break-words">{x.title}</h3><p>{x.module_title} · {courseNames(x.course_ids)} · {x.question_count} {t('questions', 'प्रश्न')} · {t('Pass', 'उत्तीर्ण')}: {x.pass_percent}% · {x.is_published ? t('Published', 'प्रकाशित') : t('Draft', 'ड्राफ्ट')}</p><p className="ui-muted">{x.attempts || 0} {t('attempts by', 'प्रयास,')} {x.students || 0} {t('students', 'छात्रों के')}</p><div className="flex flex-wrap gap-2">
        <button className="ui-btn" disabled={busy} onClick={() => openPractice(x)}>{t('Edit', 'बदलें')}</button>
        <button className="ui-btn" disabled={busy} onClick={() => void run(async () => { await api(`/api/admin/practice/${x.id}`, 'PATCH', { is_published: !x.is_published }); await load(); })}>{x.is_published ? t('Unpublish', 'प्रकाशन हटाएँ') : t('Publish', 'प्रकाशित करें')}</button>
        <button className="ui-btn" disabled={busy} onClick={() => { if (window.confirm(t('Delete this practice exam? Students lose access and all their practice attempts on it are removed. This cannot be undone.', 'यह अभ्यास परीक्षा हटाएँ? छात्रों की पहुँच बंद होगी और इस पर उनके सभी अभ्यास प्रयास मिट जाएँगे। इसे वापस नहीं किया जा सकता।'))) void run(async () => { await api(`/api/admin/practice/${x.id}`, 'DELETE'); await load(); }); }}>{t('Delete', 'हटाएँ')}</button>
      </div></article>)}
    </>}
    {view === 'results' && <><h2 ref={resultHeading} tabIndex={-1} className="ui-h2" style={{ scrollMarginTop: 100 }}>{t('Examination results', 'परीक्षा परिणाम')}{resultExam ? ` · ${resultExam.title}` : ''}</h2><label>{t('Choose examination', 'परीक्षा चुनें')}<select className="ui-field" value={resultExam?.id || ''} onChange={(e) => setResultExam(exams.find((x) => x.id === e.target.value) || null)}><option value="">{t('Choose examination', 'परीक्षा चुनें')}</option>{shownExams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>{courseId ? <ScopeResults key={`${courseId}:${moduleId}`} courseId={courseId} moduleId={moduleId} onOpenExam={(id) => setResultExam(exams.find((x) => x.id === id) || null)} /> : <p>{t('Choose a course (and optionally a module) above to publish results for all its exams at once.', 'किसी कोर्स (और चाहें तो मॉड्यूल) को चुनें, ताकि उसकी सभी परीक्षाओं के परिणाम एक साथ प्रकाशित हों।')}</p>}{resultExam && <ExamResults key={resultExam.id} examId={resultExam.id} />}</>}
    {panel && <EditorDrawer title={panel === 'bank' ? (bankName?.id ? t('Rename question bank', 'प्रश्न बैंक का नाम बदलें') : t('New question bank', 'नया प्रश्न बैंक')) : panel === 'question' ? (questionId ? t('Edit bank question', 'बैंक प्रश्न बदलें') : t('Add question', 'प्रश्न जोड़ें')) : panel === 'import' ? t('Import Word questions', 'Word प्रश्न आयात करें') : panel === 'practice' ? (practiceId ? t('Edit practice exam', 'अभ्यास परीक्षा बदलें') : t('Create practice exam', 'अभ्यास परीक्षा बनाएँ')) : editId ? t('Edit draft exam', 'ड्राफ्ट परीक्षा बदलें') : t('Create exam', 'परीक्षा बनाएँ')} onClose={closePanel} busy={busy}>
      {error && <p role="alert">{error}</p>}
{panel === 'question' && <>      <form className="ui-card ui-card-pad space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        const q = { ...question, options: question.options.split('\n').map((v) => v.trim()).filter(Boolean) };
        await api('/api/admin/question-bank', questionId ? 'PATCH' : 'POST', questionId ? { bank_id: bankId, id: questionId, question: q } : { bank_id: bankId, questions: [q] });
        setQuestion(emptyQuestion); setQuestionId(null); setPanel(null); await loadBank(); await load();
      }); }}>
        <label className="block">{t('Question (Hindi or English)', 'प्रश्न (हिंदी या अंग्रेज़ी)')}<textarea required maxLength={3000} className="ui-field" value={question.prompt} onChange={(e) => setQuestion({ ...question, prompt: e.target.value })} /></label>
        <label className="block">{t('Options (2–6, one per line)', 'विकल्प (2–6, हर पंक्ति में एक)')}<textarea required rows={4} className="ui-field" value={question.options} onChange={(e) => setQuestion({ ...question, options: e.target.value })} /></label>
        <label className="block">{t('Correct answer', 'सही उत्तर')}<select className="ui-field" value={question.answer_index} onChange={(e) => setQuestion({ ...question, answer_index: Number(e.target.value) })}>{question.options.split('\n').filter((v) => v.trim()).map((v, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}) {v}</option>)}</select></label>
        <button className="ui-btn ui-btn-primary" disabled={busy}>{t('Save to question bank', 'प्रश्न बैंक में सेव करें')}</button>{questionId && <button type="button" className="ui-btn ml-2" onClick={closePanel}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
      </form></>}
{panel === 'import' && <>      <section className="ui-card ui-card-pad space-y-3">
        <h3 className="ui-h2">{t('Import Word question bank', 'Word प्रश्न बैंक आयात करें')}</h3>
        <p>{t('Use a .docx up to 2 MB, plain paragraphs, explicit labels (not automatic numbering). Repeat this block for each question. Review the answer keys before saving. Legacy .doc, tables and tracked changes are not supported.', 'अधिकतम 2 MB की .docx में सामान्य पैराग्राफ और नीचे दिए लेबल लिखें (ऑटो नंबरिंग नहीं)। हर प्रश्न के लिए यही प्रारूप दोहराएँ। सेव करने से पहले उत्तर जाँचें। .doc, तालिकाएँ और ट्रैक किए बदलाव समर्थित नहीं हैं।')}</p>
        <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{'Q: What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nANSWER: B'}</pre>
        <label>{t('Select Word document for preview', 'पूर्वावलोकन के लिए Word फ़ाइल चुनें')}<input disabled={busy} type="file" accept=".docx" className="ui-field" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {!!preview.length && <><h4>{preview.length} {t('questions to review', 'प्रश्न जाँचें')}</h4><ol className="space-y-3 max-h-96 overflow-auto">{preview.map((q, i) => <li key={i}><strong>{i + 1}. {q.prompt}</strong><ul>{q.options.map((v, n) => <li key={n}>{String.fromCharCode(65 + n)}) {v}{n === q.answer_index ? ' ✓' : ''}</li>)}</ul></li>)}</ol><button className="ui-btn ui-btn-primary" disabled={busy || previewScope !== bankId} onClick={() => run(async () => { await api('/api/admin/question-bank', 'POST', { bank_id: bankId, questions: preview }); setPreview([]); setPanel(null); await loadBank(); await load(); })}>{t('Confirm and save reviewed questions', 'जाँचे हुए प्रश्नों की पुष्टि करके सेव करें')}</button></>}
      </section>
</>}
{panel === 'bank' && bankName && <>      <form className="ui-card ui-card-pad space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        const d = await api<{ bank: QuestionBankSummary }>(`/api/admin/question-banks${bankName.id ? `/${bankName.id}` : ''}`, bankName.id ? 'PATCH' : 'POST', { title: bankName.title, description: bankName.description });
        setPanel(null); setBankName(null); await load(); setBankId(d.bank.id);
      }); }}>
        <label className="block">{t('Bank name', 'बैंक का नाम')}<input required maxLength={200} className="ui-field" value={bankName.title} onChange={(e) => setBankName({ ...bankName, title: e.target.value })} /></label>
        <label className="block">{t('Description (optional)', 'विवरण (वैकल्पिक)')}<textarea maxLength={1000} className="ui-field" value={bankName.description} onChange={(e) => setBankName({ ...bankName, description: e.target.value })} /></label>
        <button className="ui-btn ui-btn-primary" disabled={busy}>{t('Save bank', 'बैंक सेव करें')}</button>
      </form></>}
{panel === 'practice' && <>      <form className="ui-card ui-card-pad space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        await api(`/api/admin/practice${practiceId ? `/${practiceId}` : ''}`, practiceId ? 'PATCH' : 'POST', practiceDraft);
        setPracticeDraft(emptyPractice); setPracticeId(null); setPanel(null); setPickBanks([]); await load();
      }); }}>
        <label className="block">{t('Module', 'मॉड्यूल')}<select required className="ui-field" value={practiceDraft.module_id} onChange={(e) => setPracticeDraft({ ...practiceDraft, module_id: e.target.value, course_ids: [] })}><option value="">{t('Choose module', 'मॉड्यूल चुनें')}</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
        <fieldset className="space-y-1"><legend>{t('Courses that get this (select one or more)', 'ये किन कोर्स को मिले (एक या अधिक चुनें)')} · {practiceDraft.course_ids.length}</legend>{!practiceDraft.module_id ? <small>{t('Choose a module first; only courses that include it are listed.', 'पहले मॉड्यूल चुनें; केवल वही कोर्स दिखेंगे जिनमें वह शामिल है।')}</small> : coursesFor(practiceDraft.module_id).map((c) => <label key={c.id} className="flex gap-2"><input type="checkbox" checked={practiceDraft.course_ids.includes(c.id)} onChange={(e) => setPracticeDraft({ ...practiceDraft, course_ids: e.target.checked ? [...practiceDraft.course_ids, c.id] : practiceDraft.course_ids.filter((id) => id !== c.id) })} />{c.title}</label>)}</fieldset>
        <fieldset className="space-y-1"><legend>{t('Question banks to pick from', 'किन प्रश्न बैंक से प्रश्न चुनने हैं')}</legend>{!banks.length && <small>{t('Create a question bank first (Question Bank tab).', 'पहले प्रश्न बैंक बनाएँ (Question Bank टैब)।')}</small>}{banks.map((b) => <label key={b.id} className="flex gap-2"><input type="checkbox" checked={pickBanks.includes(b.id)} onChange={(e) => setPickBanks(e.target.checked ? [...pickBanks, b.id] : pickBanks.filter((id) => id !== b.id))} />{b.title} ({b.question_count})</label>)}</fieldset>
        <label className="block">{t('Practice exam title', 'अभ्यास परीक्षा का नाम')}<input required maxLength={200} className="ui-field" value={practiceDraft.title} onChange={(e) => setPracticeDraft({ ...practiceDraft, title: e.target.value })} /></label>
        <label className="block">{t('Pass percentage', 'उत्तीर्ण प्रतिशत')}<input type="number" min={0} max={100} required className="ui-field" value={practiceDraft.pass_percent} onChange={(e) => setPracticeDraft({ ...practiceDraft, pass_percent: Number(e.target.value) })} /></label>
        <fieldset className="space-y-2 max-h-96 overflow-auto"><legend>{t('Select bank questions (1–200)', 'बैंक प्रश्न चुनें (1–200)')} · {practiceDraft.question_ids.length}</legend><button type="button" className="ui-btn ui-btn-sm" onClick={() => setPracticeDraft({ ...practiceDraft, question_ids: practiceDraft.question_ids.length === availableQuestions.length ? [] : availableQuestions.map((q) => q.id) })}>{practiceDraft.question_ids.length === availableQuestions.length ? t('Clear all', 'सब हटाएँ') : t('Select all', 'सब चुनें')}</button>{availableQuestions.map((q) => <div key={q.id} className="border-t pt-2"><small className="ui-muted">{banks.find((b) => b.id === q.bank_id)?.title}</small><label className="flex gap-2"><input type="checkbox" checked={practiceDraft.question_ids.includes(q.id)} onChange={(e) => setPracticeDraft({ ...practiceDraft, question_ids: e.target.checked ? [...practiceDraft.question_ids, q.id] : practiceDraft.question_ids.filter((id) => id !== q.id) })} /><span className="break-words min-w-0">{q.prompt}</span></label></div>)}</fieldset>
        <p>{t('Practice exams can be edited at any time. Students see the latest questions on their next attempt.', 'अभ्यास परीक्षा कभी भी बदली जा सकती है। छात्रों को अगले प्रयास में नए प्रश्न दिखेंगे।')}</p>
        <button className="ui-btn ui-btn-primary" disabled={busy || !practiceDraft.module_id || !practiceDraft.course_ids.length || !practiceDraft.question_ids.length}>{t('Save practice exam', 'अभ्यास परीक्षा सेव करें')}</button>{practiceId && <button type="button" className="ui-btn ml-2" onClick={closePanel}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
      </form></>}
{panel === 'exam' && <>      <form className="ui-card ui-card-pad space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        await api(`/api/admin/exams${editId ? `/${editId}` : ''}`, editId ? 'PATCH' : 'POST', { ...draft, opens_at: draft.opens_at ? classInstant(draft.opens_at) : null, closes_at: draft.closes_at ? classInstant(draft.closes_at) : null });
        setDraft(emptyExam); setEditId(null); setPanel(null); setPickBanks([]); await load();
      }); }}>
        <label className="block">{t('Module', 'मॉड्यूल')}<select required className="ui-field" value={draft.module_id} onChange={(e) => setDraft({ ...draft, module_id: e.target.value, course_ids: [] })}><option value="">{t('Choose module', 'मॉड्यूल चुनें')}</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
        <fieldset className="space-y-1"><legend>{t('Courses that get this (select one or more)', 'ये किन कोर्स को मिले (एक या अधिक चुनें)')} · {draft.course_ids.length}</legend>{!draft.module_id ? <small>{t('Choose a module first; only courses that include it are listed.', 'पहले मॉड्यूल चुनें; केवल वही कोर्स दिखेंगे जिनमें वह शामिल है।')}</small> : coursesFor(draft.module_id).map((c) => <label key={c.id} className="flex gap-2"><input type="checkbox" checked={draft.course_ids.includes(c.id)} onChange={(e) => setDraft({ ...draft, course_ids: e.target.checked ? [...draft.course_ids, c.id] : draft.course_ids.filter((id) => id !== c.id) })} />{c.title}</label>)}</fieldset>
        <fieldset className="space-y-1"><legend>{t('Question banks to pick from', 'किन प्रश्न बैंक से प्रश्न चुनने हैं')}</legend>{!banks.length && <small>{t('Create a question bank first (Question Bank tab).', 'पहले प्रश्न बैंक बनाएँ (Question Bank टैब)।')}</small>}{banks.map((b) => <label key={b.id} className="flex gap-2"><input type="checkbox" checked={pickBanks.includes(b.id)} onChange={(e) => setPickBanks(e.target.checked ? [...pickBanks, b.id] : pickBanks.filter((id) => id !== b.id))} />{b.title} ({b.question_count})</label>)}</fieldset>
        <label className="block">{t('Exam title', 'परीक्षा का नाम')}<input required maxLength={200} className="ui-field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <div className="grid sm:grid-cols-2 gap-4"><label>{t('Duration (minutes)', 'अवधि (मिनट)')}<input type="number" min={1} max={300} required className="ui-field" value={draft.duration_minutes} onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) })} /></label><label>{t('Pass percentage', 'उत्तीर्ण प्रतिशत')}<input type="number" min={0} max={100} required className="ui-field" value={draft.pass_percent} onChange={(e) => setDraft({ ...draft, pass_percent: Number(e.target.value) })} /></label></div>
        <div className="grid sm:grid-cols-2 gap-4">{(['opens_at', 'closes_at'] as const).map((key) => <label key={key}>{key === 'opens_at' ? t('Opens (IST, optional)', 'शुरू (IST, वैकल्पिक)') : t('Closes (IST, optional)', 'समाप्त (IST, वैकल्पिक)')}<input type="datetime-local" className="ui-field" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
        <fieldset className="space-y-2 max-h-96 overflow-auto"><legend>{t('Select bank questions (1–200)', 'बैंक प्रश्न चुनें (1–200)')} · {draft.question_ids.length}</legend>{availableQuestions.map((q) => <div key={q.id} className="border-t pt-2"><small className="ui-muted">{banks.find((b) => b.id === q.bank_id)?.title}</small><label className="flex gap-2"><input type="checkbox" checked={draft.question_ids.includes(q.id)} onChange={(e) => setDraft({ ...draft, question_ids: e.target.checked ? [...draft.question_ids, q.id] : draft.question_ids.filter((id) => id !== q.id) })} />{q.prompt}</label><small>{t('Answer', 'उत्तर')}: {q.options[q.answer_index]}</small></div>)}</fieldset>
        <p>{t('Publishing freezes questions, options, answers and rules. Make a new exam for a retake or any later change. Closing time may shorten the student’s timer.', 'प्रकाशित करने पर प्रश्न, विकल्प, उत्तर और नियम स्थायी हो जाते हैं। दोबारा परीक्षा या बाद के बदलाव के लिए नई परीक्षा बनाएँ। समाप्ति समय छात्र की समय-सीमा कम कर सकता है।')}</p>
        <button className="ui-btn ui-btn-primary" disabled={busy || !draft.module_id || !draft.course_ids.length || !draft.question_ids.length}>{t('Save draft exam', 'ड्राफ्ट परीक्षा सेव करें')}</button>{editId && <button type="button" className="ui-btn ml-2" onClick={closePanel}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
      </form></>}
    </EditorDrawer>}
  </div>;
}
