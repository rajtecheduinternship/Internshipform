'use client';

import LoadingState from '@/components/LoadingState';

import { useCopy, useLang } from '@/components/help/i18n';
import { useAdminCopy } from '@/components/admin/copy';

import { useEffect, useState } from 'react';
import { api } from './api';
import { Badge, Empty, ErrorNote, Progress, Stat, fmtHours, timeAgo } from '@/components/ui';

interface CourseRow { id: string; title: string; is_published: boolean; students: number; videos: number; completions: number; active_7d: number }
interface Overview {
  totals: { students: number; unassigned: number; active7d: number; watchSeconds: number; enquiries: number };
  courses: CourseRow[];
  daily: { day: string; seconds: number; students: number }[];
}
interface VideoStat { id: string; title: string; module_title: string; duration_seconds: number; started: number; completed: number; avg_pct: number }
interface Recent { id: string; student_email: string; video_title: string; duration_seconds: number; start_time: string }

export default function OverviewTab({ onOpenCourse, recent }: { onOpenCourse: (courseId: string) => void; recent: Recent[] }) {
  const t = useAdminCopy();
  const copy = useCopy();
  const { lang } = useLang();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>('/api/admin/overview').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><ErrorNote>{error}</ErrorNote></div>;
  if (!data) return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <LoadingState />
    </div>
  );

  const totals = data.totals;
  const totalVideos = data.courses.reduce((a, c) => a + c.videos * c.students, 0);
  const totalDone = data.courses.reduce((a, c) => a + c.completions, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Students")} value={totals.students} hint={totals.unassigned ? copy(`${totals.unassigned} without a course`, `${totals.unassigned} को कोर्स देना बाकी है`) : t("All assigned to a course")} />
        <Stat label={t("Active, last 7 days")} value={totals.active7d} hint={totals.students ? copy(`${Math.round((totals.active7d / totals.students) * 100)}% of students`, `${Math.round((totals.active7d / totals.students) * 100)}% छात्रों ने पढ़ाई की`) : '—'} />
        <Stat label={t("Time watched")} value={fmtHours(totals.watchSeconds, lang)} hint={t("Verified playback only")} />
        <Stat label={t("Lecture completion")} value={totalVideos ? `${Math.round((totalDone / totalVideos) * 100)}%` : '—'} hint={copy(`${totalDone} of ${totalVideos} assigned lessons`, `${totalVideos} में से ${totalDone} पाठ पूरे`)} />
      </div>

      <section className="ui-card">
        <div className="ui-card-head">
          <h2 className="ui-h2">{t("Watch time per day")}</h2>
          <span className="ui-muted">{t("Last 14 days, minutes")}</span>
        </div>
        <div className="ui-card-pad"><DailyBars daily={data.daily} /></div>
      </section>

      <section className="ui-card">
        <div className="ui-card-head">
          <h2 className="ui-h2">{t("Courses")}</h2>
          <span className="ui-muted">{t("Select a course to see where students drop off")}</span>
        </div>
        {data.courses.length === 0 ? <Empty title={t("No courses yet")}>{t("Create one in the Courses tab.")}</Empty> : (
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead><tr><th>{t("Course")}</th><th>{t("Students")}</th><th>{t("Active 7d")}</th><th style={{ minWidth: 180 }}>{t("Completion")}</th><th /></tr></thead>
              <tbody>
                {data.courses.map((c) => {
                  const possible = c.videos * c.students;
                  const pct = possible ? Math.round((c.completions / possible) * 100) : 0;
                  return (
                    <CourseRowView key={c.id} c={c} pct={pct} expanded={open === c.id}
                      onToggle={() => setOpen(open === c.id ? null : c.id)} onStudents={() => onOpenCourse(c.id)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ui-card">
        <div className="ui-card-head"><h2 className="ui-h2">{t("Recent viewing sessions")}</h2></div>
        {recent.length === 0 ? <Empty title={t("No sessions yet")}>{t("They appear here as students watch lectures.")}</Empty> : (
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead><tr><th>{t("Student")}</th><th>{t("Lecture")}</th><th>{t("Watched")}</th><th>{t("When")}</th></tr></thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{s.student_email}</td>
                    <td>{s.video_title}</td>
                    <td className="tnum">{fmtHours(s.duration_seconds || 0, lang)}</td>
                    <td className="ui-muted">{timeAgo(s.start_time, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CourseRowView({ c, pct, expanded, onToggle, onStudents }: {
  c: CourseRow; pct: number; expanded: boolean; onToggle: () => void; onStudents: () => void;
}) {
  const t = useAdminCopy();
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td>
          <button className="ui-row-btn" aria-expanded={expanded} style={{ fontWeight: 600 }}>{c.title}</button>
          {!c.is_published && <span style={{ marginLeft: 8 }}><Badge>{t("Hidden")}</Badge></span>}
          <div className="ui-muted">{c.videos} {t("lectures")}</div>
        </td>
        <td className="tnum">{c.students}</td>
        <td className="tnum">{c.active_7d}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}><Progress value={pct} /></div>
            <span className="tnum" style={{ width: 36, textAlign: 'right' }}>{pct}%</span>
          </div>
        </td>
        <td style={{ textAlign: 'right' }}>
          <button className="ui-link" onClick={(e) => { e.stopPropagation(); onStudents(); }}>{t("View students →")}</button>
        </td>
      </tr>
      {expanded && (
        <tr><td colSpan={5} style={{ background: '#faf9f6' }}><VideoFunnel courseId={c.id} students={c.students} /></td></tr>
      )}
    </>
  );
}

function VideoFunnel({ courseId, students }: { courseId: string; students: number }) {
  const t = useAdminCopy();
  const [rows, setRows] = useState<VideoStat[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ videos: VideoStat[] }>(`/api/admin/courses/${courseId}/stats`).then((d) => setRows(d.videos)).catch((e) => setError(e.message));
  }, [courseId]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!rows) return <LoadingState compact />;
  if (!rows.length) return <div className="ui-muted">{t("This course has no published lectures yet.")}</div>;
  return (
    <div style={{ padding: '0.25rem 0' }}>
      <div className="ui-eyebrow" style={{ marginBottom: 8 }}>{t("Lecture by lecture ·")} {students} {t("enrolled")}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((v) => (
          <div key={v.id} className="admin-lecture-stats" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 150px', gap: 12, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
              <div className="ui-muted">{v.module_title}</div>
            </div>
            <div className="tnum ui-muted" style={{ fontSize: '0.75rem' }}>{v.started} {t("started ·")} {v.completed} {t("done")}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}><Progress value={students ? (v.completed / students) * 100 : 0} /></div>
              <span className="tnum" style={{ width: 34, textAlign: 'right', fontSize: '0.75rem' }}>{students ? Math.round((v.completed / students) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Single-series bar chart: one hue, rounded data end, hover value. */
function DailyBars({ daily }: { daily: { day: string; seconds: number; students: number }[] }) {
  const t = useAdminCopy();
  const { lang } = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const W = 700, H = 160, padL = 34, padB = 22, padT = 8;
  const max = Math.max(60, ...daily.map((d) => d.seconds));
  const niceMax = Math.ceil(max / 60 / 10) * 10 * 60 || 600;
  const bw = (W - padL) / Math.max(1, daily.length);
  const y = (s: number) => padT + (H - padT - padB) * (1 - s / niceMax);
  const ticks = [0, 0.5, 1].map((f) => Math.round((niceMax * f) / 60));
  const none = daily.every((d) => d.seconds === 0);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Watch minutes per day, last 14 days")} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t * 60)} y2={y(t * 60)} stroke="var(--line)" strokeWidth={1} />
            <text x={padL - 6} y={y(t * 60) + 3} textAnchor="end" fontSize={10} fill="var(--ink-2)">{t}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = padL + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const top = y(d.seconds);
          const h = Math.max(d.seconds ? 2 : 0, H - padB - top);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={0} width={bw} height={H - padB} fill="transparent" />
              {h > 0 && <rect x={x} y={H - padB - h} width={w} height={h} rx={3} fill="var(--brand)" opacity={hover === null || hover === i ? 1 : 0.45} />}
              {(i % 2 === 0 || daily.length < 8) && (
                <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-2)">
                  {new Date(d.day + 'T00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{
          position: 'absolute', top: 0, left: `${((padL + hover * bw + bw / 2) / W) * 100}%`, transform: 'translateX(-50%)',
          background: '#161e2b', color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {new Date(daily[hover].day + 'T00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}: {fmtHours(daily[hover].seconds, lang)} · {daily[hover].students} {t("student")}
        </div>
      )}
      {none && <div className="ui-muted" style={{ textAlign: 'center', marginTop: 4 }}>{t("No viewing in the last 14 days.")}</div>}
    </div>
  );
}
