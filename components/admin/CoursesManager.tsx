'use client';

import { BusyText } from '@/components/LoadingState';

import LoadingState from '@/components/LoadingState';

import { useAdminCopy } from '@/components/admin/copy';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Badge, ConfirmDialog, Drawer, Empty, ErrorNote, Thumb } from '@/components/ui';

interface Course {
  id: string; title: string; description: string | null; category: string | null; thumbnail_url: string | null;
  duration_weeks: number | null; is_published: boolean; module_count: number; student_count: number;
}
interface ModuleSummary {
  id: string; title: string; description: string | null; thumbnail_url: string | null; video_count: number; is_mandatory: boolean;
  courses: { id: string; title: string }[];
}
interface AdminVideo {
  id: string; title: string; description: string | null; youtube_video_id: string; thumbnail_url: string | null;
  duration_seconds: number; required_watch_percent: number; is_published: boolean; archived_at: string | null; watcher_count: number;
}
type Confirm = { title: string; body: ReactNode; label: string; run: () => Promise<unknown> } | null;

export default function CoursesManager() {
  const t = useAdminCopy();
  const [view, setView] = useState<'courses' | 'modules'>('courses');
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [error, setError] = useState('');
  const [editCourse, setEditCourse] = useState<string | 'new' | null>(null);
  const [editModule, setEditModule] = useState<string | 'new' | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        api<{ courses: Course[] }>('/api/admin/courses'),
        api<{ modules: ModuleSummary[] }>('/api/admin/modules'),
      ]);
      setCourses(c.courses); setModules(m.modules); setError('');
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try { await fn(); await load(); setError(''); } catch (e) { setError((e as Error).message); } finally { setWorking(false); }
  };
  const doConfirm = async () => { const c = confirm; setConfirm(null); if (c) await run(c.run); };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label={t("Courses")}>
          {(['courses', 'modules'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} className={`ui-btn ${view === v ? 'ui-btn-primary' : ''}`} onClick={() => setView(v)}>
              {v === 'courses' ? `${t('Courses')} ${courses?.length ?? ''}` : `${t('Module library')} ${modules.length}`}
            </button>
          ))}
        </div>
        <button className="ui-btn ui-btn-primary" onClick={() => (view === 'courses' ? setEditCourse('new') : setEditModule('new'))}>
          {view === 'courses' ? t("New course") : t("New module")}
        </button>
      </div>
      {working && <LoadingState compact />}
      {error && <ErrorNote>{error}</ErrorNote>}

      {view === 'courses' && (
        !courses && error ? null : !courses ? <LoadingState /> : courses.length === 0 ? (
          <div className="ui-card"><Empty title={t("No courses yet")}>{t("Create a course, then attach modules from the library.")}</Empty></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <article key={c.id} className="ui-card flex flex-col" style={{ overflow: 'hidden' }}>
                <div className="admin-course-cover"><Thumb src={c.thumbnail_url} w={640} h={280} fill /></div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="ui-h2">{c.title}</h3>
                    <Badge tone={c.is_published ? 'ok' : undefined}>{c.is_published ? t("Published") : t("Hidden")}</Badge>
                  </div>
                  <p className="ui-muted line-clamp-2" style={{ minHeight: '2.4em' }}>{c.description || t("No description yet.")}</p>
                  <div className="ui-muted tnum">{c.module_count} {t("modules ·")} {c.student_count} {t("students")}{c.duration_weeks ? ` · ${c.duration_weeks} wk` : ''}</div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <button className="ui-btn ui-btn-sm" onClick={() => setEditCourse(c.id)}>{t("Edit & modules")}</button>
                    <button className="ui-btn ui-btn-sm" onClick={() => run(() => api(`/api/admin/courses/${c.id}`, 'PATCH', { is_published: !c.is_published }))}>
                      {c.is_published ? t("Hide") : t("Publish")}
                    </button>
                    <button className="ui-btn ui-btn-sm ui-btn-danger" style={{ marginLeft: 'auto' }}
                      onClick={() => setConfirm({
                        title: `Delete “${c.title}”?`,
                        body: <>{t("This removes the course permanently.")} {c.student_count > 0
                          ? <><strong>{c.student_count} {t("enrolled student")}{c.student_count === 1 ? '' : 's'}</strong> {t("will be left without a course until you reassign them.")} </> : null}{t("Modules and videos stay in the library.")}</>,
                        label: t("Delete course"),
                        run: () => api(`/api/admin/courses/${c.id}`, 'DELETE'),
                      })}>{t("Delete")}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {view === 'modules' && (
        <div className="ui-card">
          {loading ? <LoadingState /> : modules.length === 0 ? <Empty title={t("The library is empty")}>{t("Modules are shared building blocks that any course can use.")}</Empty> : modules.map((m, i) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-4" style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
              <Thumb src={m.thumbnail_url} w={72} h={44} />
              <div className="min-w-0 flex-1">
                <div style={{ fontWeight: 600 }}>{m.title}{m.is_mandatory && <span style={{ marginLeft: 8 }}><Badge tone="brand">{t("Common to all courses")}</Badge></span>}</div>
                <div className="ui-muted">{m.video_count} {t("videos ·")} {m.is_mandatory ? t("Shown to every student") : m.courses.length ? `Used in ${m.courses.map((c) => c.title).join(', ')}` : t("Not used in any course yet")}</div>
              </div>
              <button className="ui-btn ui-btn-sm" onClick={() => setEditModule(m.id)}>{t("Edit & videos")}</button>
              <button className="ui-btn ui-btn-sm ui-btn-danger"
                onClick={() => setConfirm({
                  title: `Delete module “${m.title}”?`,
                  body: <>{t("All")} {m.video_count} {t("videos in it and every student’s progress on them are erased.")} {m.courses.length > 0 && <>{t("It is currently used by")} {m.courses.length} {t("course")}{m.courses.length === 1 ? '' : 's'}. </>}{t("This cannot be undone.")}</>,
                  label: t("Delete module"),
                  run: () => api(`/api/admin/modules/${m.id}`, 'DELETE'),
                })}>{t("Delete")}</button>
            </div>
          ))}
        </div>
      )}

      {editCourse && (
        <Drawer onClose={() => setEditCourse(null)}>
          <CourseEditor id={editCourse === 'new' ? null : editCourse} allModules={modules}
            onClose={() => setEditCourse(null)} onChanged={load} />
        </Drawer>
      )}
      {editModule && (
        <Drawer onClose={() => setEditModule(null)}>
          <ModuleEditor id={editModule === 'new' ? null : editModule} onClose={() => setEditModule(null)} onChanged={load} />
        </Drawer>
      )}
      {confirm && <ConfirmDialog title={confirm.title} body={confirm.body} confirmLabel={confirm.label} onConfirm={doConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function DrawerHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  const t = useAdminCopy();
  return (
    <div className="ui-card-head" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
      <div className="min-w-0"><div className="ui-h2 truncate">{title}</div>{sub && <div className="ui-muted">{sub}</div>}</div>
      <button className="ui-btn ui-btn-sm" onClick={onClose}>{t("Close")}</button>
    </div>
  );
}
const L = ({ label, children }: { label: string; children: ReactNode }) => <div><label className="ui-label">{label}</label>{children}</div>;

function CourseEditor({ id, allModules, onClose, onChanged }: { id: string | null; allModules: ModuleSummary[]; onClose: () => void; onChanged: () => void }) {
  const t = useAdminCopy();
  const [f, setF] = useState({ title: '', description: '', thumbnail_url: '', duration_weeks: 4 });
  const [attached, setAttached] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [courseId, setCourseId] = useState(id);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<{ course: Course & { modules: { id: string }[] } }>(`/api/admin/courses/${id}`).then((d) => {
      setF({ title: d.course.title, description: d.course.description || '', thumbnail_url: d.course.thumbnail_url || '', duration_weeks: d.course.duration_weeks || 4 });
      setAttached(d.course.modules.map((m) => m.id));
    }).catch((e) => setMsg({ ok: false, t: e.message })).finally(() => setLoading(false));
  }, [id]);

  const saveDetails = async () => {
    setSaving(true);
    try {
      if (courseId) await api(`/api/admin/courses/${courseId}`, 'PATCH', f);
      else { const r = await api<{ course: { id: string } }>('/api/admin/courses', 'POST', f); setCourseId(r.course.id); }
      setMsg({ ok: true, t: 'Saved' }); onChanged();
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } finally { setSaving(false); }
  };
  const saveModules = async (next: string[]) => {
    if (!courseId) return;
    setAttached(next); setSaving(true);
    try { await api(`/api/admin/courses/${courseId}`, 'PATCH', { module_ids: next }); setMsg({ ok: true, t: 'Saved' }); onChanged(); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); } finally { setSaving(false); }
  };
  const move = (i: number, d: number) => {
    const n = [...attached]; const j = i + d; if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]]; saveModules(n);
  };
  const byId = (mid: string) => allModules.find((m) => m.id === mid);
  const mandatory = allModules.filter((m) => m.is_mandatory);
  const available = allModules.filter((m) => !attached.includes(m.id) && !m.is_mandatory);

  return (
    <>
      <DrawerHead title={courseId ? (f.title || t("Edit course")) : t("New course")} sub="Course details and modules" onClose={onClose} />
      {saving && <LoadingState compact />}
      {loading && <LoadingState />}
      <fieldset disabled={loading || saving} aria-busy={loading || saving} className="space-y-5 p-5 min-w-0">
        <div className="space-y-3">
          <L label={t("Course name")}><input className="ui-field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
          <L label={t("Description")}><textarea className="ui-field" rows={3} placeholder={t("What does this course cover?")} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <L label={t("Thumbnail URL (https)")}><input className="ui-field" value={f.thumbnail_url} onChange={(e) => setF({ ...f, thumbnail_url: e.target.value })} /></L>
            <L label={t("Weeks")}><input className="ui-field" type="number" min={1} max={52} value={f.duration_weeks} onChange={(e) => setF({ ...f, duration_weeks: Number(e.target.value) })} /></L>
          </div>
          <button className="ui-btn ui-btn-primary" disabled={!f.title.trim()} onClick={saveDetails}>{saving ? <BusyText>{t("Saving…")}</BusyText> : courseId ? t("Save details") : t("Create course")}</button>
        </div>

        <div>
          {mandatory.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="ui-eyebrow" style={{ marginBottom: 8 }}>{t("Common modules (every student gets these automatically)")}</div>
              <div className="ui-card" style={{ overflow: 'hidden', background: 'var(--brand-soft)', borderColor: 'transparent' }}>
                {mandatory.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
                    <Badge tone="brand">{t("Common")}</Badge>
                    <div className="min-w-0 flex-1 truncate text-[13px]" style={{ fontWeight: 500 }}>{m.title}<span className="ui-muted"> · {m.video_count} {t("videos")}</span></div>
                  </div>
                ))}
              </div>
              <div className="ui-muted" style={{ marginTop: 4 }}>{t("Change this list in the Module library.")}</div>
            </div>
          )}
          <div className="ui-eyebrow" style={{ marginBottom: 8 }}>{t("Modules only for this course, in the order students see them")}</div>
          {!courseId ? <div className="ui-muted">{t("Create the course first, then attach modules.")}</div> : (
            <>
              <div className="ui-card" style={{ overflow: 'hidden' }}>
                {attached.length === 0 && <div className="ui-muted p-4">{t("No modules yet. Attach one from the library below.")}</div>}
                {attached.map((mid, i) => {
                  const m = byId(mid);
                  return (
                    <div key={mid} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
                      <span className="tnum ui-muted" style={{ width: 18 }}>{i + 1}</span>
                      <Thumb src={m?.thumbnail_url} w={44} h={28} />
                      <div className="min-w-0 flex-1 truncate text-[13px]" style={{ fontWeight: 500 }}>{m?.title || mid}<span className="ui-muted"> · {m?.video_count ?? 0} {t("videos")}</span></div>
                      <button className="ui-btn ui-btn-sm" aria-label={t("Move up")} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button className="ui-btn ui-btn-sm" aria-label={t("Move down")} disabled={i === attached.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button className="ui-btn ui-btn-sm" onClick={() => saveModules(attached.filter((x) => x !== mid))}>{t("Remove")}</button>
                    </div>
                  );
                })}
              </div>
              {available.length > 0 && (
                <select className="ui-field" style={{ marginTop: 10 }} value="" aria-label={t("Attach a module")}
                  onChange={(e) => e.target.value && saveModules([...attached, e.target.value])}>
                  <option value="">{t("Attach a module from the library…")}</option>
                  {available.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.video_count} {t("videos)")}</option>)}
                </select>
              )}
            </>
          )}
        </div>
        {msg && (msg.ok ? <div className="ui-muted" role="status">{t(msg.t)}</div> : <ErrorNote>{t(msg.t)}</ErrorNote>)}
      </fieldset>
    </>
  );
}

function ModuleEditor({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const t = useAdminCopy();
  const [moduleId, setModuleId] = useState(id);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ title: '', description: '', thumbnail_url: '', is_mandatory: false });
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [confirm, setConfirm] = useState<AdminVideo | null>(null);
  const blank = { title: '', youtube_url: '', duration_minutes: '', description: '', thumbnail_url: '', required_watch_percent: 90 };
  const [nv, setNv] = useState(blank);

  const reload = useCallback((mid: string) => {
    setLoading(true);
    return api<{ module: ModuleSummary & { videos: AdminVideo[] } }>(`/api/admin/modules/${mid}`).then((d) => {
      setF({ title: d.module.title, description: d.module.description || '', thumbnail_url: d.module.thumbnail_url || '', is_mandatory: !!d.module.is_mandatory });
      setVideos(d.module.videos);
    }).catch((e) => setMsg({ ok: false, t: e.message })).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (id) reload(id); }, [id, reload]);

  const act = async (fn: () => Promise<unknown>, ok = 'Saved') => {
    setSaving(true);
    try { await fn(); setMsg({ ok: true, t: ok }); if (moduleId) await reload(moduleId); onChanged(); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); } finally { setSaving(false); }
  };
  const saveDetails = () => act(async () => {
    if (moduleId) await api(`/api/admin/modules/${moduleId}`, 'PATCH', f);
    else { const r = await api<{ module: { id: string } }>('/api/admin/modules', 'POST', f); setModuleId(r.module.id); }
  });

  return (
    <>
      <DrawerHead title={moduleId ? (f.title || t("Edit module")) : t("New module")} sub="Shared by every course that includes it" onClose={onClose} />
      {saving && <LoadingState compact />}
      {loading && <LoadingState />}
      <fieldset disabled={loading || saving} aria-busy={loading || saving} className="space-y-5 p-5 min-w-0">
        <div className="space-y-3">
          <L label={t("Module name")}><input className="ui-field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
          <L label={t("Description")}><textarea className="ui-field" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L>
          <L label={t("Thumbnail URL (https)")}><input className="ui-field" value={f.thumbnail_url} onChange={(e) => setF({ ...f, thumbnail_url: e.target.value })} /></L>
          <label className="flex cursor-pointer items-start gap-3 rounded-md p-3" style={{ background: 'var(--brand-soft)' }}>
            <input type="checkbox" checked={f.is_mandatory} onChange={(e) => setF({ ...f, is_mandatory: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--brand)' }} />
            <span className="text-[13px]"><strong>{t("Common to all courses")}</strong><br /><span className="ui-muted">{t("Every student gets this module automatically, so you do not have to add it to each course.")}</span></span>
          </label>
          <button className="ui-btn ui-btn-primary" disabled={!f.title.trim()} onClick={saveDetails}>{saving ? <BusyText>{t("Saving…")}</BusyText> : moduleId ? t("Save details") : t("Create module")}</button>
        </div>

        {moduleId && (
          <>
            <div>
              <div className="ui-eyebrow" style={{ marginBottom: 8 }}>{t("Videos")}</div>
              <div className="ui-card" style={{ overflow: 'hidden' }}>
                {videos.length === 0 && <div className="ui-muted p-4">{t("No videos yet. Add the first one below.")}</div>}
                {videos.map((v, i) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={{ borderTop: i ? '1px solid var(--line)' : 0, opacity: v.archived_at ? 0.65 : 1 }}>
                    <Thumb src={v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg`} w={64} h={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]" style={{ fontWeight: 600 }}>{v.title}
                        {v.archived_at && <span style={{ marginLeft: 6 }}><Badge>{t("Archived")}</Badge></span>}
                        {!v.is_published && !v.archived_at && <span style={{ marginLeft: 6 }}><Badge tone="warn">{t("Draft")}</Badge></span>}
                      </div>
                      <div className="ui-muted tnum">{Math.round(v.duration_seconds / 60)} {t("min ·")} {v.required_watch_percent}{t("% to complete ·")} {v.watcher_count} {t("students")}</div>
                    </div>
                    <div className="flex gap-1">
                      <button className="ui-btn ui-btn-sm" onClick={() => act(() => api(`/api/admin/videos/${v.id}`, 'PATCH', { is_published: !v.is_published }))}>{v.is_published ? t("Unpublish") : t("Publish")}</button>
                      <button className="ui-btn ui-btn-sm" onClick={() => act(() => api(`/api/admin/videos/${v.id}`, 'PATCH', { archived: !v.archived_at }))}>{v.archived_at ? t("Restore") : t("Archive")}</button>
                      <button className="ui-btn ui-btn-sm ui-btn-danger" onClick={() => setConfirm(v)}>{t("Delete")}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await api('/api/admin/videos', 'POST', {
                  module_id: moduleId, title: nv.title, youtube_url: nv.youtube_url, description: nv.description,
                  thumbnail_url: nv.thumbnail_url, duration_seconds: Math.round(Number(nv.duration_minutes) * 60),
                  required_watch_percent: nv.required_watch_percent,
                });
                setNv(blank);
              }, t("Video added"));
            }}>
              <div className="ui-eyebrow">{t("Add a video")}</div>
              <L label={t("Title")}><input className="ui-field" required value={nv.title} onChange={(e) => setNv({ ...nv, title: e.target.value })} /></L>
              <L label={t("YouTube link or ID")}><input className="ui-field" required value={nv.youtube_url} onChange={(e) => setNv({ ...nv, youtube_url: e.target.value })} /></L>
              <div className="grid grid-cols-2 gap-3">
                <L label={t("Duration (minutes)")}><input className="ui-field" type="number" step="0.1" min="0.1" required value={nv.duration_minutes} onChange={(e) => setNv({ ...nv, duration_minutes: e.target.value })} /></L>
                <L label={t("Watch % to complete")}><input className="ui-field" type="number" min={1} max={100} value={nv.required_watch_percent} onChange={(e) => setNv({ ...nv, required_watch_percent: Number(e.target.value) })} /></L>
              </div>
              <L label={t("Thumbnail URL (optional)")}><input className="ui-field" value={nv.thumbnail_url} onChange={(e) => setNv({ ...nv, thumbnail_url: e.target.value })} /></L>
              <L label={t("Description")}><textarea className="ui-field" rows={2} value={nv.description} onChange={(e) => setNv({ ...nv, description: e.target.value })} /></L>
              <button className="ui-btn ui-btn-primary">{t("Add video")}</button>
            </form>
          </>
        )}
        {msg && (msg.ok ? <div className="ui-muted" role="status">{t(msg.t)}</div> : <ErrorNote>{t(msg.t)}</ErrorNote>)}
      </fieldset>
      {confirm && (
        <ConfirmDialog title={`Delete “${confirm.title}”?`}
          body={<>{t("This permanently erases the progress of")} <strong>{confirm.watcher_count} {t("student")}{confirm.watcher_count === 1 ? '' : 's'}</strong> {t("on this video. Use Archive to hide it and keep progress.")}</>}
          confirmLabel={t("Delete video")} onCancel={() => setConfirm(null)}
          onConfirm={() => { const v = confirm; setConfirm(null); act(() => api(`/api/admin/videos/${v.id}`, 'DELETE'), t("Deleted")); }} />
      )}
    </>
  );
}
