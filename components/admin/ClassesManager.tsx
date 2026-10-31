'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import { classInput, classInstant, classTime } from '@/lib/class-calendar';
import type { LiveClass } from '@/lib/live-classes';
import ClassAttendance from './ClassAttendance';
import EditorDrawer from './EditorDrawer';
import { useAdminDraft } from './UnsavedChanges';
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
  const timing = useRef<{ starts_at: string; ends_at: string } | null>(null);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [open, setOpen] = useState(false); const baseline = useRef(JSON.stringify(empty));
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [courseFilter, setCourseFilter] = useState(''); const [statusFilter, setStatusFilter] = useState('all');
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
      await api(`/api/admin/classes${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', { ...draft, module_id: draft.module_id || null, starts_at: timing.current && draft.starts_at === classInput(timing.current.starts_at) ? timing.current.starts_at : classInstant(draft.starts_at), ends_at: timing.current && draft.ends_at === classInput(timing.current.ends_at) ? timing.current.ends_at : classInstant(draft.ends_at) });
      setId(null); setDraft(empty); setOpen(false); await load(); setMessage(t('Class saved.', 'कक्षा सेव हो गई।'));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function edit(c: LiveClass) {
    timing.current = { starts_at: c.starts_at, ends_at: c.ends_at }; setId(c.id); const value = { course_id: c.course_id, module_id: c.module_id || '', title: c.title, description: c.description, meet_url: c.meet_url, starts_at: classInput(c.starts_at), ends_at: classInput(c.ends_at), is_published: c.is_published, is_cancelled: c.is_cancelled }; setDraft(value); baseline.current = JSON.stringify(value); setOpen(true); setError('');
  }
  const canLeave = useAdminDraft(open && JSON.stringify(draft) !== baseline.current, busy);
  const close = () => { if (canLeave()) setOpen(false); };
  const shown = items.filter((c) => (!courseFilter || c.course_id === courseFilter) && (statusFilter === 'all' || (statusFilter === 'draft' ? !c.is_published && !c.is_cancelled : statusFilter === 'cancelled' ? c.is_cancelled : c.is_published && !c.is_cancelled))).sort((a,b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  return <div className="max-w-5xl mx-auto p-4 space-y-5">
    {error && !open && <p role="alert">{error} <button className="ui-link" onClick={load}>{t('Retry loading', 'फिर लोड करें')}</button></p>}{message && <p role="status">{message}</p>}
    <div className="flex flex-wrap justify-between items-center gap-3"><nav className="admin-view-tabs" aria-label={t('Class views', 'कक्षा दृश्य')}>{(['calendar','list'] as const).map((key) => <button key={key} className={`ui-btn ${view === key ? 'ui-btn-primary' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>{key === 'calendar' ? t('Calendar', 'कैलेंडर') : t('Class list', 'कक्षा सूची')}</button>)}</nav><button className="ui-btn ui-btn-primary" disabled={!loaded || busy} onClick={() => { timing.current = null; setId(null); setDraft(empty); baseline.current = JSON.stringify(empty); setOpen(true); setError(''); }}>{t('Schedule class', 'कक्षा तय करें')}</button></div>
    <div className="ui-card ui-card-pad admin-filter-grid"><label>{t('Course filter', 'कोर्स फ़िल्टर')}<select className="ui-field" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}><option value="">{t('All courses', 'सभी कोर्स')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>{t('Class status', 'कक्षा की स्थिति')}<select className="ui-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">{t('All statuses', 'सभी स्थितियाँ')}</option><option value="draft">{t('Draft', 'ड्राफ्ट')}</option><option value="published">{t('Published', 'प्रकाशित')}</option><option value="cancelled">{t('Cancelled', 'रद्द')}</option></select></label></div>
    <p className="ui-muted">{t('Drafts are visible here for planning, but never to students. All times are IST.', 'योजना के लिए ड्राफ्ट यहाँ दिखते हैं, छात्रों को नहीं। सभी समय IST में हैं।')}</p>
    {!loaded ? <p role="status">{t('Loading classes…', 'कक्षाएँ लोड हो रही हैं…')}</p> : view === 'calendar' ? <ClassCalendar classes={shown} now={now} admin onEdit={edit} onAttendance={(c) => setAttendanceId(c.id)} /> : <><h2 className="ui-h2">{t('Scheduled classes', 'तय कक्षाएँ')}</h2>{!shown.length && <p>{t('No classes match these filters.', 'इन फ़िल्टर में कोई कक्षा नहीं है।')}</p>}{shown.map((c) => <article key={c.id} className="ui-card ui-card-pad space-y-3"><h3 className="ui-h2">{c.title}</h3><p>{c.course_title} · {classTime(c.starts_at)} IST</p><p>{c.is_cancelled ? t('Cancelled', 'रद्द') : c.is_published ? t('Published', 'प्रकाशित') : t('Draft', 'ड्राफ्ट')}</p><div className="flex flex-wrap gap-2"><button type="button" className="ui-btn" onClick={() => edit(c)}>{t('Edit / publish', 'बदलें / प्रकाशित करें')}</button><button className="ui-btn ui-btn-primary" onClick={() => setAttendanceId(c.id)}>{t('Attendance', 'उपस्थिति')}</button></div></article>)}</>}
    {attendanceId && <EditorDrawer title={t('Class attendance', 'कक्षा उपस्थिति')} onClose={() => { if (canLeave()) setAttendanceId(null); }}><ClassAttendance classId={attendanceId} /></EditorDrawer>}
    {open && <EditorDrawer title={id ? t('Edit class', 'कक्षा बदलें') : t('Schedule Google Meet', 'Google Meet कक्षा तय करें')} onClose={close} busy={busy}>{error && <p role="alert">{error}</p>}
    <form id="class-form" onSubmit={save} className="ui-card ui-card-pad space-y-4">
      <p>{t('Enter each occurrence separately; any number of classes per day. All times are India time (IST). Save as draft, then publish when ready.', 'हर कक्षा अलग जोड़ें; एक दिन में कितनी भी कक्षाएँ। सभी समय भारतीय समय (IST) में हैं। पहले ड्राफ्ट सेव करें, फिर तैयार होने पर प्रकाशित करें।')}</p>
      <label className="block">{t('Course', 'कोर्स')}<select aria-label={t('Course', 'कोर्स')} required className="ui-field" value={draft.course_id} onChange={(e) => setDraft({ ...draft, course_id: e.target.value, module_id: '' })}><option value="">{t('Choose course', 'कोर्स चुनें')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="block">{t('Module (optional)', 'मॉड्यूल (वैकल्पिक)')}<select aria-label={t('Module (optional)', 'मॉड्यूल (वैकल्पिक)')} className="ui-field" value={draft.module_id} onChange={(e) => setDraft({ ...draft, module_id: e.target.value })}><option value="">{t('Entire course', 'पूरा कोर्स')}</option>{modules.filter((m) => m.is_mandatory || m.courses.some((c) => c.id === draft.course_id)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
      <label className="block">{t('Class title', 'कक्षा का नाम')}<input required maxLength={200} className="ui-field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className="block">{t('Description / instructions', 'विवरण / निर्देश')}<textarea aria-label={t('Description / instructions', 'विवरण / निर्देश')} maxLength={3000} className="ui-field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Google Meet URL<input required type="url" placeholder="https://meet.google.com/abc-defg-hij" className="ui-field" value={draft.meet_url} onChange={(e) => setDraft({ ...draft, meet_url: e.target.value })} /></label>
      <div className="grid sm:grid-cols-2 gap-4">{(['starts_at', 'ends_at'] as const).map((key) => <label key={key}>{key === 'starts_at' ? t('Starts (IST)', 'शुरू (IST)') : t('Ends (IST)', 'समाप्त (IST)')}<input type="datetime-local" required className="ui-field" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
      <label className="flex gap-2"><input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />{t('Published to enrolled students', 'इस कोर्स के छात्रों के लिए प्रकाशित')}</label>
      <label className="flex gap-2"><input type="checkbox" checked={draft.is_cancelled} onChange={(e) => setDraft({ ...draft, is_cancelled: e.target.checked })} />{t('Cancelled (show cancellation on calendar)', 'रद्द (कैलेंडर पर रद्द दिखाएँ)')}</label>
      <button className="ui-btn ui-btn-primary" disabled={busy || !loaded}>{busy ? t('Saving…', 'सेव हो रहा है…') : t('Save class', 'कक्षा सेव करें')}</button>{id && <button type="button" className="ui-btn ml-2" onClick={close}>{t('Cancel edit', 'बदलाव छोड़ें')}</button>}
    </form></EditorDrawer>}
  </div>;
}
