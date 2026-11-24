'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';

type Row = { exam_id: string; title: string; module_title: string; submitted: number; published: number };
/** Publish or hide submitted exam results for a whole course, or one module of it, in one action. */
export default function ScopeResults({ courseId, moduleId, onOpenExam }: { courseId: string; moduleId: string; onOpenExam: (examId: string) => void }) {
  const t = useCopy();
  const [rows, setRows] = useState<Row[]>([]); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setRows((await api<{ exams: Row[] }>(`/api/admin/exam-results?course_id=${courseId}${moduleId ? `&module_id=${moduleId}` : ''}`)).exams);
  }, [courseId, moduleId]);
  useEffect(() => { setMessage(''); void load().catch((e) => setError(e.message)); }, [load]);
  const pending = rows.reduce((n, r) => n + r.submitted - r.published, 0);
  const live = rows.reduce((n, r) => n + r.published, 0);
  async function publish(published: boolean) {
    const what = moduleId ? t('this module', 'इस मॉड्यूल') : t('this course', 'इस कोर्स');
    if (!window.confirm(published ? t(`Publish all submitted results for ${what}? Students will see their marks.`, `${what} के सभी जमा परिणाम प्रकाशित करें? छात्र अपने अंक देख पाएँगे।`) : t(`Hide all published results for ${what}?`, `${what} के सभी प्रकाशित परिणाम छिपाएँ?`))) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await api<{ updated: number }>('/api/admin/exam-results', 'PATCH', { course_id: courseId, module_id: moduleId || null, is_published: published });
      await load(); setMessage(`${r.updated} ${published ? t('results published.', 'परिणाम प्रकाशित हुए।') : t('results made private.', 'परिणाम निजी किए गए।')}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="ui-card ui-card-pad space-y-3" aria-label={t('Publish results by course or module', 'कोर्स या मॉड्यूल के अनुसार परिणाम प्रकाशित करें')}>
    <h3 className="ui-h2">{moduleId ? t('All exams in this module', 'इस मॉड्यूल की सभी परीक्षाएँ') : t('All exams in this course', 'इस कोर्स की सभी परीक्षाएँ')}</h3>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!rows.length ? <p>{t('No exams in this selection.', 'इस चयन में कोई परीक्षा नहीं है।')}</p> : <ul className="space-y-1">{rows.map((r) => <li key={r.exam_id} className="break-words"><strong>{r.title}</strong> · {r.module_title} · {r.submitted} {t('submitted', 'जमा')} · {r.published} {t('published', 'प्रकाशित')} <button className="ui-link" onClick={() => onOpenExam(r.exam_id)}>{t('Open', 'खोलें')}</button></li>)}</ul>}
    <div className="flex flex-wrap gap-2"><button className="ui-btn ui-btn-primary" disabled={busy || !pending} onClick={() => publish(true)}>{t('Publish all results', 'सभी परिणाम प्रकाशित करें')}{pending ? ` (${pending})` : ''}</button><button className="ui-btn" disabled={busy || !live} onClick={() => publish(false)}>{t('Make all private', 'सभी निजी करें')}</button></div>
  </section>;
}
