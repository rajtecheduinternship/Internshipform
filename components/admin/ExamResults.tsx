'use client';
import { useCallback, useEffect, useState } from 'react';
import EditorDrawer from './EditorDrawer';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import type { AdminExamResult, AdminAnswerReview } from '@/lib/exams';

/** Shared by the exam report and an individual student's admin record. */
export default function ExamResults({ examId, studentId }: { examId?: string; studentId?: string }) {
  const t = useCopy();
  const [results, setResults] = useState<AdminExamResult[]>([]);
  const [review, setReview] = useState<AdminAnswerReview | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const endpoint = examId ? `/api/admin/exams/${examId}/results` : `/api/admin/students/${studentId}/exams`;
    setResults((await api<{ results: AdminExamResult[] }>(endpoint)).results);
  }, [examId, studentId]);
  useEffect(() => { void load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [load]);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function publish(published: boolean, row?: AdminExamResult) {
    if (!window.confirm(published ? t('Release these submitted scores to the student(s)? Future submissions will remain private.', 'इन जमा परिणामों को छात्रों के लिए प्रकाशित करें? आगे जमा होने वाले परिणाम निजी रहेंगे।') : t('Hide these scores from students? Internal answers and scores will remain saved.', 'छात्रों से ये अंक छिपाएँ? आंतरिक उत्तर और अंक सेव रहेंगे।'))) return;
    await run(async () => {
      await api(`/api/admin/exams/${row?.exam_id || examId}/results${row ? `/${row.id}` : ''}`, 'PATCH', { is_published: published });
      await load(); setReview(null); setMessage(published ? t('Results published to students.', 'परिणाम छात्रों के लिए प्रकाशित हो गए।') : t('Results are private. Internal records are retained.', 'परिणाम निजी हैं। आंतरिक रिकॉर्ड सुरक्षित हैं।'));
    });
  }
  return <section className="ui-card ui-card-pad space-y-4">
    <h2 className="ui-h2">{t('Exam participation & results', 'परीक्षा उपस्थिति और परिणाम')}</h2>
    <p>{t('Scores are private by default. Review the answer sheet, then publish a result only when you want the student to see their marks. Publishing does not release answer keys.', 'अंक शुरू में निजी रहते हैं। उत्तर-पत्र जाँचें, फिर चाहें तभी छात्र के लिए अंक प्रकाशित करें। प्रकाशित करने से सही उत्तर छात्रों को नहीं दिखते।')}</p>
    <p className="ui-muted">{t('Tab switches are advisory signals, not proof of cheating.', 'टैब बदलने की जानकारी केवल संकेत है, नकल का प्रमाण नहीं।')}</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="flex flex-wrap gap-2"><button className="ui-btn" disabled={busy} onClick={() => run(load)}>{t('Refresh results', 'परिणाम फिर लोड करें')}</button>{examId && <><button className="ui-btn ui-btn-primary" disabled={busy || !results.some((r) => r.submitted_at && !r.result_published_at)} onClick={() => publish(true)}>{t('Publish all submitted results', 'सभी जमा परिणाम प्रकाशित करें')}</button><button className="ui-btn" disabled={busy || !results.some((r) => r.result_published_at)} onClick={() => publish(false)}>{t('Make all results private', 'सभी परिणाम निजी करें')}</button></>}</div>
    {loading ? <p role="status">{t('Loading results…', 'परिणाम लोड हो रहे हैं…')}</p> : !results.length ? <p>{t('No attempts yet.', 'अभी कोई प्रयास नहीं।')}</p> : results.map((r) => <article key={r.id} className="border-t pt-3 space-y-2">
      <h3 className="font-semibold">{r.full_name} · {r.exam_title}</h3><p className="ui-muted">{r.module_title}</p>
      {r.submitted_at ? <><p>{t('Appeared · Submitted', 'परीक्षा दी · जमा की')} · {r.correct_count}/{r.total_questions} · {r.score_percent}% · {r.passed ? t('Passed', 'उत्तीर्ण') : t('Not passed', 'अनुत्तीर्ण')}</p><p>{r.result_published_at ? `${t('Result published', 'परिणाम प्रकाशित')} · ${classTime(r.result_published_at)} IST` : t('Private result · student sees submission only, not marks', 'निजी परिणाम · छात्र को केवल जमा होने की स्थिति दिखती है, अंक नहीं')}</p><div className="flex flex-wrap gap-2"><button className="ui-btn" disabled={busy} onClick={() => run(async () => { setReview((await api<{ review: AdminAnswerReview }>(`/api/admin/exams/${r.exam_id}/results/${r.id}`)).review); })}>{t('Review answers & calculation', 'उत्तर और गणना देखें')}</button><button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => publish(!r.result_published_at, r)}>{r.result_published_at ? t('Make result private', 'परिणाम निजी करें') : t('Publish result', 'परिणाम प्रकाशित करें')}</button></div></> : <p>{t('In progress until', 'इस समय तक जारी')}: {classTime(r.deadline_at)} IST</p>}
      <small>{t('Visibility changes', 'दृश्यता बदलाव')}: {r.focus_events}</small>
    </article>)}
    {review && <EditorDrawer title={t('Answer sheet review', 'उत्तर-पत्र की समीक्षा')} onClose={() => setReview(null)}><section className="space-y-4" aria-label={t('Answer sheet review', 'उत्तर-पत्र की समीक्षा')}>
      <div className="flex flex-wrap justify-between gap-2"><h3 className="ui-h2">{review.full_name} · {review.exam_title}</h3><button className="ui-btn" onClick={() => setReview(null)}>{t('Close answer review', 'उत्तर समीक्षा बंद करें')}</button></div>
      <p>{t('Equal-weight marking: 1 mark for a correct answer; 0 for incorrect or unanswered. No negative marks.', 'समान अंक: सही उत्तर पर 1 अंक; गलत या खाली उत्तर पर 0। कोई नकारात्मक अंक नहीं।')}</p>
      <p>{t('Calculation', 'गणना')}: {review.grade.correct_count} ÷ {review.grade.total_questions} × 100 = {review.grade.score_percent}% · {t('Pass threshold', 'उत्तीर्ण सीमा')}: {review.grade.pass_percent}%</p>
      <p>{t('Correct / Incorrect / Unanswered', 'सही / गलत / खाली')}: {review.grade.correct_count} / {review.grade.incorrect_count} / {review.grade.unanswered_count}</p>
      <p className="ui-muted">{t('Passing uses the unrounded ratio. Answers and keys below are the saved, shuffled attempt—not the current question bank.', 'उत्तीर्ण स्थिति बिना राउंड किए अनुपात से तय होती है। नीचे सेव किए प्रयास के क्रम वाले उत्तर हैं, वर्तमान प्रश्न बैंक के नहीं।')}</p>
      {review.grade.questions.map((q, i) => <article key={q.id} className="ui-card ui-card-pad space-y-2"><h4 className="font-semibold">{i + 1}. {q.prompt}</h4><ol>{q.options.map((v, n) => <li key={n}>{String.fromCharCode(65 + n)}) {v}{n === q.selected_index ? ` · ${t('Student selected', 'छात्र ने चुना')}` : ''}{n === q.correct_index ? ` · ${t('Correct answer', 'सही उत्तर')}` : ''}</li>)}</ol><p>{t('Student answer', 'छात्र का उत्तर')}: {q.selected_index === null ? t('Unanswered', 'खाली') : `${String.fromCharCode(65 + q.selected_index)}) ${q.selected_answer}`}</p><p>{t('Correct answer', 'सही उत्तर')}: {String.fromCharCode(65 + q.correct_index)}) {q.correct_answer}</p><strong>{t('Marks awarded', 'प्राप्त अंक')}: {q.marks_awarded}/{q.maximum_marks}</strong></article>)}
    </section></EditorDrawer>}
  </section>;
}
