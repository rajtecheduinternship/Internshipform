'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import { ErrorNote } from '@/components/ui';
import { classTime } from '@/lib/class-calendar';
import type { SyllabusMeta } from '@/lib/syllabus';

/** Upload, preview, publish and replace one course's syllabus PDF. Replacing a live syllabus updates what students see. */
export default function SyllabusPanel({ courseId }: { courseId: string }) {
  const t = useCopy();
  const [s, setS] = useState<SyllabusMeta | null>(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setS((await api<{ syllabus: SyllabusMeta | null }>(`/api/admin/courses/${courseId}/syllabus`)).syllabus); }, [courseId]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); await load(); setMessage(ok); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function upload(file?: File) {
    if (!file) return;
    if (s?.is_published && !window.confirm(t('Replace the live syllabus? Students will see the new file straight away.', 'चालू सिलेबस बदलें? छात्रों को नई फ़ाइल तुरंत दिखेगी।'))) return;
    void run(async () => {
      const form = new FormData(); form.set('file', file);
      const r = await fetch(`/api/admin/courses/${courseId}/syllabus`, { method: 'POST', body: form });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Upload failed');
    }, s?.is_published ? t('New version published to students.', 'नया संस्करण छात्रों के लिए प्रकाशित हो गया।') : t('Uploaded as a draft. Preview it, then publish.', 'ड्राफ्ट के रूप में अपलोड हुआ। देखें, फिर प्रकाशित करें।'));
  }
  const url = `/api/admin/courses/${courseId}/syllabus?file=1`;
  return <section className="space-y-3" aria-label={t('Course syllabus', 'कोर्स सिलेबस')}>
    <div className="ui-eyebrow">{t('Syllabus (PDF)', 'सिलेबस (PDF)')}</div>
    {error && <ErrorNote>{error}</ErrorNote>}{message && <p role="status" className="ui-muted">{message}</p>}
    {s ? <div className="ui-card ui-card-pad space-y-2">
      <p className="break-words"><strong>{s.filename}</strong> · {(s.size_bytes / 1048576).toFixed(2)} MB · {t('version', 'संस्करण')} {s.version}</p>
      <p className="ui-muted">{s.is_published ? `${t('Live for students', 'छात्रों को दिख रहा है')} · ${s.published_at ? classTime(s.published_at) + ' IST' : ''}` : t('Draft — students cannot see it yet', 'ड्राफ्ट — छात्रों को अभी नहीं दिखता')}</p>
      <div className="flex flex-wrap gap-2">
        <a className="ui-btn ui-btn-sm" href={url} target="_blank" rel="noopener noreferrer">{t('Preview', 'देखें')}</a>
        <button className="ui-btn ui-btn-sm ui-btn-primary" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/courses/${courseId}/syllabus`, 'PATCH', { is_published: !s.is_published }); }, s.is_published ? t('Hidden from students.', 'छात्रों से छिपा दिया।') : t('Published to students.', 'छात्रों के लिए प्रकाशित हो गया।'))}>{s.is_published ? t('Unpublish', 'प्रकाशन हटाएँ') : t('Publish', 'प्रकाशित करें')}</button>
        <button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => input.current?.click()}>{t('Replace with new PDF', 'नया PDF लगाएँ')}</button>
        <button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => { if (window.confirm(t('Delete this syllabus?', 'यह सिलेबस हटाएँ?'))) void run(async () => { await api(`/api/admin/courses/${courseId}/syllabus`, 'DELETE'); }, t('Syllabus deleted.', 'सिलेबस हटा दिया।')); }}>{t('Delete', 'हटाएँ')}</button>
      </div></div>
      : <div className="ui-card ui-card-pad space-y-2"><p className="ui-muted">{t('No syllabus yet. Upload a PDF up to 8 MB; it stays hidden until you publish it.', 'अभी कोई सिलेबस नहीं। 8 MB तक का PDF अपलोड करें; प्रकाशित करने तक यह छिपा रहेगा।')}</p><button className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy} onClick={() => input.current?.click()}>{t('Upload syllabus PDF', 'सिलेबस PDF अपलोड करें')}</button></div>}
    <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
  </section>;
}
