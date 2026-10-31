'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import { useStudent } from '@/hooks/useStudent';
import { useExams } from '@/hooks/useExams';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import type { PublicAttempt } from '@/lib/exams';
export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  return <ExamAttempt key={id} id={id} />;
}
function ExamAttempt({ id }: { id: string }) {
  const student = useStudent(); const t = useCopy();
  const { exams, loading: examLoading, error: listError, reload: reloadExams } = useExams(!!student); const exam = exams.find((e) => e.id === id);
  const [attempt, setAttempt] = useState<PublicAttempt | null>(null); const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({}); const answerRef = useRef<Record<string, number>>({});
  const [error, setError] = useState(''); const [pending, setPending] = useState(0); const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0); const target = useRef(0); const active = useRef(false); const expiredRequest = useRef(false); const nextExpiryCheck = useRef(0);
  const queue = useRef(Promise.resolve()); const revision = useRef(0); const [savedRevision, setSavedRevision] = useState(0);
  const send = useCallback(async (method: string, body?: unknown) => {
    const r = await fetch(`/api/portal/exams/${id}/attempt`, { method, cache: 'no-store', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed');
    const a: PublicAttempt | null = d.attempt;
    setAttempt(a); active.current = !!a && !a.submitted_at;
    if (a) {
      target.current = performance.now() + Math.max(0, +new Date(a.deadline_at) - +new Date(a.server_now));
      setRemaining(Math.max(0, Math.ceil((target.current - performance.now()) / 1000)));
    }
    return a;
  }, [id]);
  const enqueue = useCallback((task: () => Promise<void>) => {
    setPending((n) => n + 1);
    queue.current = queue.current.then(task).catch((e) => setError((e as Error).message)).finally(() => setPending((n) => n - 1));
  }, []);
  useEffect(() => {
    if (!student) return;
    void send('GET').then((a) => { answerRef.current = a?.answers || {}; setAnswers(answerRef.current); setReady(true); }).catch((e) => { setError(e.message); setReady(true); });
  }, [student, send]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!active.current) return;
      const left = Math.max(0, Math.ceil((target.current - performance.now()) / 1000)); setRemaining(left);
      if (!left && !expiredRequest.current && performance.now() >= nextExpiryCheck.current) {
        expiredRequest.current = true;
        enqueue(async () => { try { await send('GET'); setError(''); } finally { expiredRequest.current = false; nextExpiryCheck.current = performance.now() + 15000; } });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [send, enqueue]);
  useEffect(() => {
    if (!attempt || attempt.submitted_at) return;
    function warn(e: BeforeUnloadEvent) { e.preventDefault(); }
    function visibility() {
      if (document.hidden && active.current) {
        const snapshot = { ...answerRef.current }; const rev = revision.current;
        enqueue(async () => { await send('PATCH', { answers: snapshot, focus_event: true }); setSavedRevision(rev); setError(''); });
      } else if (active.current) enqueue(async () => { await send('GET'); });
    }
    window.addEventListener('beforeunload', warn); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('visibilitychange', visibility); };
  }, [attempt, enqueue, send]);
  function choose(questionId: string, answer: number) {
    const snapshot = { ...answerRef.current, [questionId]: answer };
    answerRef.current = snapshot; setAnswers(snapshot); const rev = ++revision.current;
    enqueue(async () => { await send('PATCH', { answers: snapshot }); setSavedRevision(rev); setError(''); });
  }
  function submit() {
    if (!window.confirm(t('Submit your examination? You cannot change answers after submission.', 'परीक्षा जमा करें? जमा करने के बाद उत्तर नहीं बदल सकते।'))) return;
    setSubmitting(true);
    enqueue(async () => { try { await send('PUT', { answers: answerRef.current }); setError(''); } finally { setSubmitting(false); } });
  }
  const ongoing = !!attempt && !attempt.submitted_at;
  return <div className="ui-page student-page"><StudentNavbar /><main id="main-content" className="portal-main space-y-5">
    <Link href="/portal/exams" className="ui-link">← {t('All examinations', 'सभी परीक्षाएँ')}</Link>
    <h1 className="ui-h1">{exam?.title || t('Module examination', 'मॉड्यूल परीक्षा')}</h1>
    {error && <p role="alert" className="ui-card ui-card-pad">{error} <button className="ui-link" onClick={() => enqueue(async () => { await reloadExams(); const a = await send('GET'); if (a) { answerRef.current = { ...a.answers, ...answerRef.current }; setAnswers(answerRef.current); } setReady(true); setError(''); })}>{t('Reconnect / reload status', 'फिर जुड़ें / स्थिति लोड करें')}</button>{ongoing && <button className="ui-btn ml-2" onClick={() => enqueue(async () => { await send('PATCH', { answers: answerRef.current }); setSavedRevision(revision.current); setError(''); })}>{t('Retry saving answers', 'उत्तर फिर सेव करें')}</button>}</p>}
    {!ready || examLoading ? <p role="status">{t('Loading examination…', 'परीक्षा लोड हो रही है…')}</p> : !exam || listError ? <p>{t('This exam is not currently available for your course.', 'यह परीक्षा अभी आपके कोर्स के लिए उपलब्ध नहीं है।')}</p> : !attempt ? <section className="ui-card ui-card-pad space-y-4">
      <h2 className="ui-h2">{t('Read before you start', 'शुरू करने से पहले पढ़ें')}</h2>
      <p>{exam.module_title} · {exam.duration_minutes} {t('minutes', 'मिनट')} · {t('Pass percentage', 'उत्तीर्ण प्रतिशत')}: {exam.pass_percent}%</p>
      {exam.opens_at && <p>{t('Opens', 'शुरू')}: {classTime(exam.opens_at)} IST</p>}{exam.closes_at && <p>{t('Closes', 'समाप्त')}: {classTime(exam.closes_at)} IST</p>}
      <p>{t('One attempt only. Your server timer starts when you press Start and keeps running if you leave, disconnect or reload. The closing time can shorten it. Only answers received before the deadline count; saved answers are automatically graded when time expires.', 'केवल एक प्रयास। शुरू दबाने पर सर्वर का समय शुरू होगा और पेज छोड़ने, इंटरनेट टूटने या रीलोड करने पर भी चलता रहेगा। समाप्ति समय इसे कम कर सकता है। समय-सीमा से पहले प्राप्त उत्तर ही मान्य हैं; समय पूरा होने पर सेव उत्तरों का मूल्यांकन अपने आप होगा।')}</p>
      <p>{t('Work independently. Copying and context menus are discouraged; tab visibility changes are recorded. This is not full proctoring and does not prevent screenshots or use of other devices.', 'स्वयं उत्तर दें। कॉपी और संदर्भ मेन्यू पर रोक लगाने का प्रयास है; टैब की दृश्यता के बदलाव दर्ज होते हैं। यह पूर्ण निगरानी नहीं है और स्क्रीनशॉट या दूसरे उपकरण नहीं रोक सकता।')}</p>
      {!exam.eligible && <p>{t('Complete this module’s published lessons first.', 'पहले इस मॉड्यूल के प्रकाशित पाठ पूरे करें।')}</p>}
      <button className="ui-btn ui-btn-primary" disabled={pending > 0 || !exam.eligible || !!error} onClick={() => { if (window.confirm(t('Start now? Your timer cannot be paused.', 'अभी शुरू करें? समय रोका नहीं जा सकता।'))) enqueue(async () => { const a = await send('POST'); answerRef.current = a?.answers || {}; setAnswers(answerRef.current); setError(''); }); }}>{t('Start examination', 'परीक्षा शुरू करें')}</button>
    </section> : attempt.submitted_at ? <section className="ui-card ui-card-pad space-y-3" role="status"><h2 className="ui-h2">{t('Examination submitted', 'परीक्षा जमा हो गई')}</h2><p>{attempt.correct_count}/{attempt.questions.length} · {attempt.score_percent}% · {attempt.passed ? t('Passed', 'उत्तीर्ण') : t('Not passed', 'अनुत्तीर्ण')}</p><p>{t('Your result is saved. Your teacher can view it. A new exam is needed for another attempt.', 'परिणाम सेव हो गया है। शिक्षक इसे देख सकते हैं। दोबारा प्रयास के लिए नई परीक्षा चाहिए।')}</p></section> : <>
      <div className="ui-card ui-card-pad sticky top-0 z-10 bg-white flex flex-wrap justify-between gap-3"><strong role="timer" aria-label={t('Time remaining', 'बाकी समय')}>{t('Time remaining', 'बाकी समय')}: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong><span role="status">{pending ? t('Saving…', 'सेव हो रहा है…') : savedRevision < revision.current ? t('Answers not saved — retry', 'उत्तर सेव नहीं हुए — फिर कोशिश करें') : t('All changes saved', 'सभी बदलाव सेव हैं')}</span></div>
      <form className="space-y-4 select-none" style={{ userSelect: 'none' }} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {attempt.questions.map((q, i) => <fieldset key={q.id} className="ui-card ui-card-pad space-y-3" disabled={remaining <= 0 || submitting}><legend className="font-semibold">{i + 1}. {q.prompt}</legend>{q.options.map((option, n) => <label key={n} className="flex gap-3 items-start border rounded p-3 cursor-pointer"><input type="radio" name={q.id} value={n} checked={answers[q.id] === n} onChange={() => choose(q.id, n)} /><span>{String.fromCharCode(65 + n)}) {option}</span></label>)}</fieldset>)}
        <p>{Object.keys(answers).length}/{attempt.questions.length} {t('answered. Unanswered questions score zero.', 'उत्तर दिए। खाली प्रश्न पर शून्य अंक मिलेंगे।')}</p>
        <button className="ui-btn ui-btn-primary" disabled={submitting || remaining <= 0}>{submitting ? t('Submitting…', 'जमा हो रहा है…') : t('Submit examination', 'परीक्षा जमा करें')}</button>
      </form>
    </>}
  </main><PortalFooter /></div>;
}
