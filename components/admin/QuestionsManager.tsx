'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Badge, ConfirmDialog, Empty, ErrorNote, timeAgo } from '@/components/ui';
import { useAdminCopy } from '@/components/admin/copy';
import { useCopy, useLang } from '@/components/help/i18n';

interface Q {
  id: string; question: string; answer: string | null; answered_at: string | null; created_at: string;
  full_name: string; phone: string; course_title: string | null; video_title: string | null;
}
type F = 'open' | 'answered' | 'all';

export default function QuestionsManager({ onChanged }: { onChanged?: () => void }) {
  const t = useAdminCopy();
  const copy = useCopy();
  const { lang } = useLang();
  const [filter, setFilter] = useState<F>('open');
  const [items, setItems] = useState<Q[] | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Q | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await api<{ questions: Q[] }>(`/api/admin/questions?filter=${filter}`)).questions); setError(''); }
    catch (e) { setError((e as Error).message); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  async function answer(q: Q) {
    const text = (drafts[q.id] ?? q.answer ?? '').trim();
    if (!text) return;
    setBusy(q.id); setSaved(false);
    try {
      await api(`/api/admin/questions/${q.id}`, 'PATCH', { answer: text });
      setDrafts((d) => { const n = { ...d }; delete n[q.id]; return n; });
      await load(); onChanged?.(); setSaved(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function remove(q: Q) {
    setDeleting(null); setBusy(q.id);
    try { await api(`/api/admin/questions/${q.id}`, 'DELETE'); await load(); onChanged?.(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filter questions')}>{(['open', 'answered', 'all'] as F[]).map((f) => <button key={f} className={`ui-btn ui-btn-sm ${filter === f ? 'ui-btn-primary' : ''}`} aria-pressed={filter === f} onClick={() => { setFilter(f); setSaved(false); }}>{f === 'open' ? t('Waiting for answer') : f === 'answered' ? t('Answered') : t('All')}</button>)}</div>
      {error && <ErrorNote>{copy('Could not load or save questions. Please try again.', 'सवाल खोलने या सेव करने में परेशानी हुई। फिर कोशिश करें।')} <button className="ui-link" onClick={load}>{copy('Try again', 'फिर कोशिश करें')}</button></ErrorNote>}
      {saved && <p role="status" className="text-sm" style={{ color: 'var(--ok)' }}>{copy('Answer saved. The student can now see it on their lesson page.', 'जवाब सेव हो गया। छात्र इसे अपने पाठ के नीचे देख सकता है।')}</p>}
      {!items && !error ? <div className="ui-skeleton h-32" /> : items?.length === 0 ? <div className="ui-card"><Empty title={filter === 'open' ? t('No questions waiting') : t('No questions here')}>{t('Students can ask from any lecture page.')}</Empty></div> : items?.map((q) => <article key={q.id} className="ui-card ui-card-pad space-y-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div style={{ fontWeight: 650 }}>{q.full_name} <span className="ui-muted font-normal">· {q.phone}</span></div><div className="ui-muted">{q.course_title || t('No course')}{q.video_title ? ` · ${q.video_title}` : ''} · {timeAgo(q.created_at, lang)}</div></div>{q.answer ? <Badge tone="ok">{t('Answered')}</Badge> : <Badge tone="warn">{t('Waiting')}</Badge>}</div><p className="text-sm whitespace-pre-wrap">{q.question}</p><div><label className="ui-label" htmlFor={`a-${q.id}`}>{q.answer ? t('Your answer (you can edit it)') : t('Your answer')}</label><textarea id={`a-${q.id}`} className="ui-field" rows={3} maxLength={5000} value={drafts[q.id] ?? q.answer ?? ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} placeholder={t('Type the answer the student will see…')} /></div><div className="flex gap-2"><button className="ui-btn ui-btn-primary" disabled={busy === q.id || !(drafts[q.id] ?? q.answer ?? '').trim()} onClick={() => answer(q)}>{busy === q.id ? copy('Saving…', 'सेव हो रहा है…') : q.answer ? t('Update answer') : t('Send answer')}</button><button className="ui-btn ui-btn-danger" disabled={busy === q.id} onClick={() => setDeleting(q)}>{t('Delete')}</button></div></article>)}
      {deleting && <ConfirmDialog title={copy('Delete this question?', 'यह सवाल हटाएँ?')} body={copy('The question and its answer will be permanently removed. This cannot be undone.', 'सवाल और उसका जवाब हमेशा के लिए हट जाएँगे। इन्हें वापस नहीं ला सकते।')} confirmLabel={t('Delete')} onCancel={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
    </div>
  );
}
