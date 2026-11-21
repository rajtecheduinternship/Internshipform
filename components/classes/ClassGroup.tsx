'use client';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import type { LiveClass } from '@/lib/live-classes';

/** Admin-only: one class scheduled for several courses is stored as one row per course; show it once. */
export function groupClasses(classes: LiveClass[]): LiveClass[][] {
  const groups = new Map<string, LiveClass[]>(); const out: LiveClass[][] = [];
  for (const c of classes) {
    if (c.module_id) { out.push([c]); continue; }
    const key = [c.title, c.description, c.meet_url, +new Date(c.starts_at), +new Date(c.ends_at), c.is_published, c.is_cancelled].join('|');
    const g = groups.get(key);
    if (g) g.push(c); else { const n = [c]; groups.set(key, n); out.push(n); }
  }
  return out;
}

export default function ClassGroupCard({ items, now, onEdit, onAttendance }: { items: LiveClass[]; now: number; onEdit?: (c: LiveClass) => void; onAttendance?: (c: LiveClass) => void }) {
  const t = useCopy(); const c = items[0];
  return <article className="ui-card ui-card-pad space-y-2">
    <h3 className="ui-h2">{c.title}</h3>
    <p>{c.is_cancelled ? t('Cancelled', 'रद्द की गई') : c.is_published ? t('Published', 'प्रकाशित') : t('Draft · not visible to students', 'ड्राफ्ट · छात्रों को नहीं दिखता')}</p>
    <p className="ui-muted">{t(`Scheduled for ${items.length} courses together`, `${items.length} कोर्स के लिए एक साथ तय`)}</p>
    <p>{classTime(c.starts_at)} – {classTime(c.ends_at)} IST</p><p className="whitespace-pre-wrap">{c.description}</p>
    {!c.is_cancelled && c.is_published && +new Date(c.ends_at) > now && <a className="ui-btn ui-btn-primary" href={c.meet_url} target="_blank" rel="noopener noreferrer">{t('Open Google Meet', 'Google Meet खोलें')} ↗</a>}
    <details><summary>{t('Per-course attendance and edit', 'कोर्स के अनुसार उपस्थिति और बदलाव')}</summary>
      <ul className="space-y-2 mt-2">{items.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-2"><span>{i.course_title}</span>{onAttendance && <button type="button" className="ui-btn" onClick={() => onAttendance(i)}>{t('Attendance', 'उपस्थिति')}</button>}{onEdit && <button type="button" className="ui-btn" onClick={() => onEdit(i)}>{t('Edit / publish', 'बदलें / प्रकाशित करें')}</button>}</li>)}</ul>
    </details>
  </article>;
}
