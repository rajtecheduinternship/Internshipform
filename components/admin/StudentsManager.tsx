'use client';

import LoadingState from '@/components/LoadingState';

import { useCopy, useLang } from '@/components/help/i18n';
import { useAdminCopy } from '@/components/admin/copy';

import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { Badge, Drawer, Empty, ErrorNote, Progress, Thumb, fmtHours, timeAgo } from '@/components/ui';

interface Student {
  id: string; full_name: string; email: string; phone: string; college: string | null; roll_number: string | null; course_id: string | null;
  course_title: string | null; total_videos: number; completed_videos: number; watch_seconds: number;
  last_login_at: string | null; last_activity: string | null;
}
interface CourseOpt { id: string; title: string; student_count: number }
interface DetailVideo { id: string; title: string; duration_seconds: number; thumbnail_url: string | null;
  progress: null | { completion_percentage: number; is_completed: boolean; total_seconds_watched: number } }
interface Detail {
  profile: { id: string; full_name: string; phone: string; email: string; college: string | null; roll_number: string | null; course_id: string | null; last_login_at: string | null };
  course: null | { title: string; modules: { id: string; title: string; videos: DetailVideo[] }[] };
}

type Status = 'all' | 'active' | 'idle' | 'finished' | 'not-started';
const DAY = 86400000;

function statusOf(s: Student): Exclude<Status, 'all'> {
  if (s.total_videos > 0 && s.completed_videos >= s.total_videos) return 'finished';
  const last = s.last_activity ? new Date(s.last_activity).getTime() : 0;
  if (!last) return 'not-started';
  return Date.now() - last < 7 * DAY ? 'active' : 'idle';
}
const STATUS_LABEL: Record<Status, string> = { all: 'All', active: 'Active', idle: 'Idle 7d+', finished: 'Finished', 'not-started': 'Not started' };

export default function StudentsManager({ initialCourse }: { initialCourse?: string }) {
  const t = useAdminCopy();
  const copy = useCopy();
  const { lang } = useLang();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [q, setQ] = useState('');
  const [course, setCourse] = useState<string>(initialCourse || 'all');
  const [status, setStatus] = useState<Status>('all');
  const [college, setCollege] = useState<string>('all');
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([
        api<{ students: Student[] }>('/api/admin/students'),
        api<{ courses: CourseOpt[] }>('/api/admin/courses'),
      ]);
      setStudents(s.students); setCourses(c.courses); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const inCourse = useMemo(
    () => (students || []).filter((s) => course === 'all' || (course === 'none' ? !s.course_id : s.course_id === course)),
    [students, course]
  );
  // Colleges (with student counts) within the selected course, biggest first.
  const colleges = useMemo(() => {
    const m = new Map<string, number>();
    inCourse.forEach((s) => { const k = (s.college || '').trim() || 'Not specified'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [inCourse]);
  const activeCollege = colleges.some(([k]) => k === college) ? college : 'all';
  const inCollege = useMemo(
    () => inCourse.filter((s) => activeCollege === 'all' || ((s.college || '').trim() || 'Not specified') === activeCollege),
    [inCourse, activeCollege]
  );
  const counts = useMemo(() => {
    const c: Record<Status, number> = { all: inCollege.length, active: 0, idle: 0, finished: 0, 'not-started': 0 };
    inCollege.forEach((s) => { c[statusOf(s)]++; });
    return c;
  }, [inCollege]);
  const shown = inCollege.filter((s) =>
    (status === 'all' || statusOf(s) === status) &&
    `${s.full_name} ${s.phone} ${s.email} ${s.college || ''} ${s.roll_number || ''}`.toLowerCase().includes(q.toLowerCase()));

  const unassigned = (students || []).filter((s) => !s.course_id).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Course rail */}
        <nav aria-label={t("Courses")} className="lg:sticky lg:top-4 lg:self-start">
          <div className="ui-eyebrow" style={{ marginBottom: 8 }}>{t("Course")}</div>
          <div className="admin-student-courses flex gap-1 overflow-x-auto lg:flex-col">
            <RailItem active={course === 'all'} label={t("All students")} n={students?.length ?? 0} onClick={() => setCourse('all')} />
            {courses.map((c) => (
              <RailItem key={c.id} active={course === c.id} label={c.title} n={c.student_count} onClick={() => setCourse(c.id)} />
            ))}
            {unassigned > 0 && <RailItem active={course === 'none'} label={t("No course")} n={unassigned} onClick={() => setCourse('none')} />}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input className="ui-field" style={{ maxWidth: 300 }} placeholder={t("Search name, phone, college, roll no.")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search students")} />
            <select className="ui-field" style={{ maxWidth: 260 }} value={activeCollege}
              onChange={(e) => setCollege(e.target.value)} aria-label={t("Filter by college")}>
              <option value="all">{t("All colleges")} ({inCourse.length})</option>
              {colleges.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
            </select>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t("Filter by status")}>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <button key={s} className={`ui-btn ui-btn-sm ${status === s ? 'ui-btn-primary' : ''}`} onClick={() => setStatus(s)} aria-pressed={status === s}>
                  {t(STATUS_LABEL[s])} <span className="tnum" style={{ opacity: 0.7 }}>{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>
          {error && <ErrorNote>{copy('Student details could not load. Check your connection and try again.', 'छात्र की जानकारी नहीं खुल पाई। इंटरनेट जाँचें और फिर कोशिश करें।')} <button className="ui-link" onClick={load}>{copy('Try again', 'फिर कोशिश करें')}</button></ErrorNote>}

          <div className="ui-card overflow-x-auto">
            {!students && error ? null : !students ? <LoadingState /> : shown.length === 0 ? <Empty title={t("No students match")}>{t("Try another course or clear the filters.")}</Empty> : (
              <>
              <div className="admin-student-cards">{shown.map((s) => {
                const pct = s.total_videos ? Math.round(s.completed_videos / s.total_videos * 100) : 0;
                return <article key={s.id} className="admin-student-card">
                  <button onClick={() => setOpenId(s.id)}><span>{s.full_name}</span><span aria-hidden="true">→</span></button>
                  <div className="admin-student-meta"><span>{s.phone}</span><span>{s.course_title || t('No course')}</span></div>
                  {s.college && <p className="ui-muted">{s.college}</p>}
                  <Progress value={pct} label={`${s.full_name}: ${pct}%`} />
                  <div className="admin-student-meta"><span>{pct}% · {s.completed_videos}/{s.total_videos} {copy('lessons', 'पाठ')}</span><span>{timeAgo(s.last_activity || s.last_login_at, lang)}</span></div>
                </article>;
              })}</div>
              <table className="ui-table admin-student-table">
                <thead><tr><th>{t("Student")}</th><th>{t("Course")}</th><th style={{ minWidth: 170 }}>{t("Progress")}</th><th>{t("Watch time")}</th><th>{t("Last active")}</th></tr></thead>
                <tbody>
                  {shown.map((s) => {
                    const pct = s.total_videos ? Math.round((s.completed_videos / s.total_videos) * 100) : 0;
                    return (
                      <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
                        <td>
                          <button className="ui-row-btn" style={{ fontWeight: 600 }}>{s.full_name}</button>
                          <div className="ui-muted">{s.phone}{s.college ? ` · ${s.college}` : ''}</div>
                        </td>
                        <td>{s.course_title || <Badge tone="warn">{t("No course")}</Badge>}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1 }}><Progress value={pct} /></div>
                            <span className="tnum" style={{ width: 36, textAlign: 'right' }}>{pct}%</span>
                          </div>
                          <div className="ui-muted tnum">{copy(`${s.completed_videos} of ${s.total_videos} lessons`, `${s.total_videos} में से ${s.completed_videos} पाठ पूरे`)}</div>
                        </td>
                        <td className="tnum">{fmtHours(s.watch_seconds, lang)}</td>
                        <td className="ui-muted">{timeAgo(s.last_activity || s.last_login_at, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>
        </div>
      </div>

      {openId && <StudentDrawer id={openId} courses={courses} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function RailItem({ active, label, n, onClick }: { active: boolean; label: string; n: number; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      className="flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13px] lg:w-full"
      style={{ background: active ? 'var(--brand-soft)' : 'transparent', color: active ? 'var(--brand)' : 'var(--ink-2)', fontWeight: active ? 650 : 500, border: 0, cursor: 'pointer' }}>
      <span className="truncate">{label}</span>
      <span className="tnum" style={{ fontSize: 12, opacity: 0.75 }}>{n}</span>
    </button>
  );
}

function StudentDrawer({ id, courses, onClose, onChanged }: { id: string; courses: CourseOpt[]; onClose: () => void; onChanged: () => void }) {
  const t = useAdminCopy();
  const { lang } = useLang();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [openMod, setOpenMod] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => api<Detail>(`/api/admin/students/${id}`).then(setD).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeCourse = async (courseId: string) => {
    setSaving(true);
    try { await api(`/api/admin/students/${id}`, 'PATCH', { course_id: courseId || null }); await reload(); onChanged(); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const all = d?.course?.modules.flatMap((m) => m.videos) || [];
  const done = all.filter((v) => v.progress?.is_completed).length;
  const secs = all.reduce((a, v) => a + (v.progress?.total_seconds_watched || 0), 0);
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;

  return (
    <Drawer onClose={onClose}>
      <div className="ui-card-head" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
        <div className="min-w-0">
          <div className="ui-h2 truncate">{d?.profile.full_name || t("Student")}</div>
          <div className="ui-muted">{t("Student record")}</div>
        </div>
        <button className="ui-btn ui-btn-sm" onClick={onClose}>{t("Close")}</button>
      </div>
      <div className="space-y-5 p-5">
        {saving && <LoadingState compact />}
        {error && <ErrorNote>{error}</ErrorNote>}
        {!d && !error && <LoadingState />}
        {d && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <Field label={t("Phone")} value={d.profile.phone} />
              <Field label={t("Email")} value={d.profile.email} />
              <Field label={t("College")} value={d.profile.college || '—'} />
              <Field label={t("Roll number")} value={d.profile.roll_number || '—'} />
              <Field label={t("Last sign-in")} value={timeAgo(d.profile.last_login_at, lang)} />
            </dl>

            <div>
              <label className="ui-label" htmlFor="stu-course">{t("Course")}</label>
              <select disabled={saving} aria-busy={saving} id="stu-course" className="ui-field" value={d.profile.course_id || ''} onChange={(e) => changeCourse(e.target.value)}>
                <option value="">{t("No course")}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <div className="ui-muted" style={{ marginTop: 4 }}>{t("Changing the course swaps the lectures this student sees. Past progress is kept.")}</div>
            </div>

            {d.course ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Mini label={t("Completed")} value={`${done}/${all.length}`} />
                  <Mini label={t("Progress")} value={`${pct}%`} />
                  <Mini label={t("Watched")} value={fmtHours(secs, lang)} />
                </div>
                <div>
                  <div className="ui-eyebrow" style={{ marginBottom: 8 }}>{t("Modules")}</div>
                  <div className="ui-card" style={{ overflow: 'hidden' }}>
                    {d.course.modules.map((m, i) => {
                      const md = m.videos.filter((v) => v.progress?.is_completed).length;
                      const open = openMod === m.id;
                      return (
                        <div key={m.id} style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
                          <button className="ui-row-btn flex w-full items-center justify-between gap-3 px-4 py-3" aria-expanded={open} onClick={() => setOpenMod(open ? null : m.id)}>
                            <span style={{ fontWeight: 600 }}>{m.title}</span>
                            <span className="ui-muted tnum">{md}/{m.videos.length} {open ? '▴' : '▾'}</span>
                          </button>
                          {open && (
                            <div style={{ background: '#faf9f6', padding: '0.25rem 1rem 0.75rem' }}>
                              {m.videos.length === 0 && <div className="ui-muted" style={{ padding: '0.5rem 0' }}>{t("No lectures in this module.")}</div>}
                              {m.videos.map((v) => {
                                const p = v.progress;
                                return (
                                  <div key={v.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px', gap: 12, alignItems: 'center', padding: '0.5rem 0' }}>
                                    <div className="flex min-w-0 items-center gap-3">
                                      <Thumb src={v.thumbnail_url} w={48} h={30} />
                                      <div className="min-w-0">
                                        <div className="truncate text-[13px]" style={{ fontWeight: 500 }}>{v.title}</div>
                                        <div className="ui-muted tnum">{p ? fmtHours(p.total_seconds_watched, lang) : fmtHours(0, lang)} {t("watched")}</div>
                                      </div>
                                    </div>
                                    <div>
                                      {p?.is_completed ? <Badge tone="ok">{t("Completed")}</Badge> : (
                                        <><Progress value={p?.completion_percentage ?? 0} /><div className="ui-muted tnum" style={{ textAlign: 'right', fontSize: 11 }}>{Math.round(p?.completion_percentage ?? 0)}%</div></>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : <Empty title={t("No course assigned")}>{t("Pick one above to give this student their lectures.")}</Empty>}
          </>
        )}
      </div>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="ui-eyebrow">{label}</dt><dd className="truncate" style={{ marginTop: 2 }}>{value}</dd></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="ui-card" style={{ padding: '0.625rem 0.75rem' }}><div className="ui-eyebrow">{label}</div><div className="tnum" style={{ fontSize: '1.125rem', fontWeight: 650 }}>{value}</div></div>;
}
