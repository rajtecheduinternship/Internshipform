'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import { useStudent } from '@/hooks/useStudent';
import { useCopy } from '@/components/help/i18n';
import type { PracticeAttempt } from '@/lib/practice';
type History = { id: string; submitted_at: string; correct_count: number; total: number; score_percent: number; passed: boolean }[];
export default function PracticePage() { const { id } = useParams<{ id: string }>(); return <Practice key={id} id={id} />; }
function Practice({ id }: { id: string }) {
  const student = useStudent(); const t = useCopy();
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null); const [history, setHistory] = useState<History>([]);
  const [title, setTitle] = useState(''); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({}); const queue = useRef(Promise.resolve());
  const call = useCallback(async (method: string, body?: unknown) => {
    const r = await fetch(`/api/portal/practice/${id}/attempt`, { method, cache: 'no-store', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed');
    setAttempt(d.attempt); setAnswers(d.attempt?.answers || {}); return d.attempt as PracticeAttempt | null;
  }, [id]);
  const loadHistory = useCallback(async () => {
    const r = await fetch(`/api/portal/practice/${id}/history`, { cache: 'no-store' }); if (r.ok) setHistory((await r.json()).history);
  }, [id]);
  useEffect(() => {
    if (!student) return;
    void (async () => {
      try {
        const list = await (await fetch('/api/portal/practice', { cache: 'no-store' })).json();
        setTitle((list.practice || []).find((p: { id: string; title: string }) => p.id === id)?.title || '');
        await call('GET'); await loadHistory();
      } catch (e) { setError((e as Error).message); } finally { setReady(true); }
    })();
  }, [student, call, loadHistory, id]);
  const run = (fn: () => Promise<void>) => { setBusy(true); queue.current = queue.current.then(fn).catch((e) => setError((e as Error).message)).finally(() => setBusy(false)); };
  const choose = (qid: string, n: number) => { const next = { ...answers, [qid]: n }; setAnswers(next); run(async () => { await call('PATCH', { answers: next }); setError(''); }); };
  const ongoing = !!attempt && !attempt.submitted_at, done = !!attempt?.submitted_at;
  const r = attempt?.result;
  return <div className="ui-page student-page"><StudentNavbar /><main id="main-content" className="portal-main space-y-5">
    <Link href="/portal/exams" className="ui-link">← {t('All examinations', 'सभी परीक्षाएँ')}</Link>
    <h1 className="ui-h1 break-words">{title || t('Practice exam', 'अभ्यास परीक्षा')}</h1>
    {error && <p role="alert" className="ui-card ui-card-pad">{error}</p>}
    {!ready ? <p role="status">{t('Loading…', 'लोड हो रहा है…')}</p> : !title ? <p>{t('This practice exam is not available.', 'यह अभ्यास परीक्षा उपलब्ध नहीं है।')}</p> : !attempt || done ? <>
      {done && r && <section className="ui-card ui-card-pad space-y-4" role="status"><h2 className="ui-h2">{t('Your result', 'आपका परिणाम')}</h2>
        <p className="text-lg font-semibold">{r.correct_count}/{r.total_questions} · {r.score_percent}% · {r.passed ? t('Passed', 'उत्तीर्ण') : t('Not passed yet', 'अभी उत्तीर्ण नहीं')}</p>
        <p>{t('Correct', 'सही')}: {r.correct_count} · {t('Wrong', 'गलत')}: {r.incorrect_count} · {t('Not answered', 'छोड़े गए')}: {r.unanswered_count}</p>
        <ol className="space-y-3">{r.questions.map((q, i) => <li key={q.id} className="border rounded p-3 space-y-1"><p className="font-semibold break-words">{i + 1}. {q.prompt}</p>
          <p className="break-words">{t('Your answer', 'आपका उत्तर')}: {q.selected_answer ?? t('(not answered)', '(उत्तर नहीं दिया)')} {q.is_correct ? '✓' : '✗'}</p>
          {!q.is_correct && <p className="break-words">{t('Correct answer', 'सही उत्तर')}: {q.correct_answer}</p>}</li>)}</ol></section>}
      <section className="ui-card ui-card-pad space-y-3"><p>{t('Untimed practice. You can take it as many times as you like; questions are shuffled each time and your result shows as soon as you submit. It does not count as your real exam.', 'बिना समय-सीमा का अभ्यास। इसे जितनी बार चाहें दे सकते हैं; हर बार प्रश्न बदलकर आते हैं और जमा करते ही परिणाम दिखता है। यह आपकी असली परीक्षा में नहीं गिना जाता।')}</p>
        <button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => run(async () => { await call('POST'); setError(''); })}>{done ? t('Practise again', 'फिर अभ्यास करें') : t('Start practice', 'अभ्यास शुरू करें')}</button></section>
      {!!history.length && <section className="space-y-2"><h2 className="ui-h2">{t('Your earlier attempts', 'आपके पिछले प्रयास')}</h2><ul className="space-y-1">{history.map((h) => <li key={h.id}>{new Date(h.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {h.correct_count}/{h.total} · {h.score_percent}% · {h.passed ? t('Passed', 'उत्तीर्ण') : t('Not passed', 'अनुत्तीर्ण')}</li>)}</ul></section>}
    </> : <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (window.confirm(t('Submit this practice attempt?', 'यह अभ्यास प्रयास जमा करें?'))) run(async () => { await call('PUT', { answers }); await loadHistory(); setError(''); }); }}>
      {attempt.questions.map((q, i) => <div key={q.id} role="group" aria-labelledby={`q-${q.id}`} className="ui-card ui-card-pad space-y-3"><h2 id={`q-${q.id}`} className="font-semibold break-words">{i + 1}. {q.prompt}</h2>{q.options.map((o, n) => <label key={n} className="flex gap-3 items-start border rounded p-3 cursor-pointer"><input type="radio" name={q.id} checked={answers[q.id] === n} disabled={busy} onChange={() => choose(q.id, n)} /><span className="break-words min-w-0">{String.fromCharCode(65 + n)}) {o}</span></label>)}</div>)}
      <p>{Object.keys(answers).length}/{attempt.questions.length} {t('answered', 'उत्तर दिए')}</p>
      <button className="ui-btn ui-btn-primary" disabled={busy || !ongoing}>{t('Submit and see result', 'जमा करें और परिणाम देखें')}</button></form>}
  </main><PortalFooter /></div>;
}
