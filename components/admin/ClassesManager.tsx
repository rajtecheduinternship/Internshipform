'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import { classInput, classInstant, classTime } from '@/lib/class-calendar';
import type { LiveClass } from '@/lib/live-classes';
import ClassCalendar from '@/components/classes/ClassCalendar';
type Course = { id: string; title: string };
type Module = Course & { courses: Course[]; is_mandatory: boolean };
const empty = { course_id: '', module_id: '', title: '', description: '', meet_url: '', starts_at: '', ends_at: '', is_published: false, is_cancelled: false };
export default function ClassesManager() {
  const t = useCopy();
  const [items, setItems] = useState<LiveClass[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [draft, setDraft] = useState(empty);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(''); const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([api<{ classes: LiveClass[] }>('/api/admin/classes'), api<{ courses: Course[] }>('/api/admin/courses'), api<{ modules: Module[] }>('/api/admin/modules')]);
      setItems(a.classes); setCourses(b.courses); setModules(c.modules); setLoaded(true); setNow(Date.now());
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api(`/api/admin/classes${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', { ...draft, module_id: draft.module_id || null, starts_at: classInstant(draft.starts_at), ends_at: classInstant(draft.ends_at) });
      setId(null); setDraft(empty); await load(); setMessage(t('Class saved.', 'कक्षा सेव हो गई।'));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function edit(c: LiveClass) {
    setId(c.id); setDraft({ course_id: c.course_id, module_id: c.module_id || '', title: c.title, description: c.description, meet_url: c.meet_url, starts_at: classInput(c.starts_at), ends_at: classInput(c.ends_at), is_published: c.is_published, is_cancelled: c.is_cancelled });
    document.getElementById('class-form')?.scrollIntoView({ behavior: 'smooth' });
  }
  return <div className="max-w-5xl mx-auto p-4 space-y-5">
    {error && <p role="alert">{error} <button className="ui-link" onClick={load}>{t('Retry loading', 'फिर लोड करें')}</button></p>}{message && <p role="status">{message}</p>}
    <form id="class-form" onSubmit={save} className="ui-card ui-card-pad space-y-4">
      <h2 className="ui-h2">{id ? t('Edit class', 'कक्षा बदलें') : t('Schedule Google Meet', 'Google Meet कक्षा तय करें')}</h2>
      <p>{t('Enter each occurrence separately; any number of classes per day. All times are India time (IST). Save as draft, then publish when ready.', 'हर कक्षा अलग जोड़ें; एक दिन में कितनी भी कक्षाएँ। सभी समय भारतीय समय (IST) में हैं। पहले ड्राफ्ट सेव करें, फिर तैयार होने पर प्रकाशित करें।')}</p>
      <label className="block">{t('Course', 'कोर्स')}<select required className="ui-field" value={draft.course_id} onChange={(e) => setDraft({ ...draft, course_id: e.target.value, module_id: '' })}><option value="">{t('Choose course', 'कोर्स चुनें')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="block">{t('Module (optional)', 'मॉड्यूल (वैकल्पिक)')}<select className="ui-field" value={draft.module_id} onChange={(e) => setDraft({ ...draft, module_id: e.target.value })}><option value="">{t('Entire course', 'पूरा कोर्स')}</option>{modules.filter((m) => m.is_mandatory || m.courses.some((c) => c.id === draft.course_id)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
      <label className="block">{t('Class title', 'कक्षा का नाम')}<input required maxLength={200} className="ui-field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className="block">{t('Description / instructions', 'विवरण / निर्देश')}<textarea maxLength={3000} className="ui-field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Google Meet URL<input required type="url" placeholder="https://meet.google.com/abc-defg-hij" className="ui-field" value={draft.meet_url} onChange={(e) => setDraft({ ...draft, meet_url: e.target.value })} /></label>
      <div className="grid sm:grid-cols-2 gap-4">{(['starts_at', 'ends_at'] as const).map((key) => <label key={key}>{key === 'starts_at' ? t('Starts (IST)', 'शुरू (IST)') : t('Ends (IST)', 'समाप्त (IST)')}<input type="datetime-local" required className="ui-field" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
      <label className="flex gap-2"><input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />{t('Published to enrolled students', 'इस कोर्स के छात्रों के लिए प्रकाशित')}</label>
      <label className="flex gap-2"><input type="checkbox" checked={draft.is_cancelled} onChange={(e) => setDraft({ ...draft, is_cancelled: e.target.checked })} />{t('Cancelled (show cancellation on calendar)', 'रद्द (कैलेंडर पर रद्द दिखाएँ)')}</label>
      <button className="ui-btn ui-btn-primary" disabled={busy || !loaded}>{busy ? t('Saving…', 'सेव हो रहा है…') : t('Save class', 'कक्षा सेव करें')}</button>{id && <button type="button" className="ui-btn ml-2" onClick={() => { setId(null); setDraft(empty); }}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
    </form>
    <ClassCalendar classes={items.filter((c) => c.is_published)} now={now} />
    <h2 className="ui-h2">{t('All scheduled classes', 'सभी तय कक्षाएँ')}</h2>
    {items.map((c) => <article key={c.id} className="ui-card ui-card-pad flex justify-between gap-3"><div><strong>{c.title}</strong><p>{c.course_title} · {classTime(c.starts_at)} IST</p><p>{c.is_published ? t('Published', 'प्रकाशित') : t('Draft', 'ड्राफ्ट')}{c.is_cancelled ? ` · ${t('Cancelled', 'रद्द')}` : ''}</p></div><button type="button" className="ui-btn" onClick={() => edit(c)}>{t('Edit / publish', 'बदलें / प्रकाशित करें')}</button></article>)}
  </div>;
}
