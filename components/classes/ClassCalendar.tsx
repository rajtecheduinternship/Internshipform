'use client';
import { JoinClass } from './StudentAttendance';
import { useState } from 'react';
import { useCopy } from '@/components/help/i18n';
import { classDay, classTime } from '@/lib/class-calendar';
import type { LiveClass } from '@/lib/live-classes';

export default function ClassCalendar({ classes, now, admin = false, onEdit, onAttendance }: { classes: LiveClass[]; now: number; admin?: boolean; onEdit?: (c: LiveClass) => void; onAttendance?: (c: LiveClass) => void }) {
  const t = useCopy();
  const today = classDay(new Date(now));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [year, mon] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  const selected = classes.filter((c) => classDay(c.starts_at) === day).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  return <section className="ui-card ui-card-pad space-y-4">
    <div className="flex flex-wrap items-end gap-4"><h2 className="ui-h2">{t('Class calendar', 'कक्षा कैलेंडर')}</h2><label>{t('Month (India time)', 'महीना (भारतीय समय)')}<input type="month" className="ui-field" value={month} onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setDay(`${e.target.value}-01`); } }} /></label></div>
    <div className="grid grid-cols-7 gap-1" role="group" aria-label={t('Choose class date', 'कक्षा की तारीख चुनें')}>
      {['Sun / रवि', 'Mon / सोम', 'Tue / मंगल', 'Wed / बुध', 'Thu / गुरु', 'Fri / शुक्र', 'Sat / शनि'].map((d) => <span key={d} className="text-center text-xs">{d}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const count = classes.filter((c) => classDay(c.starts_at) === date && !c.is_cancelled).length;
        return <button key={date} className={`ui-btn flex-col min-w-0 px-1 ${day === date ? 'ui-btn-primary' : ''}`} aria-pressed={day === date} aria-label={`${date}: ${count} classes`} onClick={() => setDay(date)}>{i + 1}<small>{count ? `${count} ●` : '·'}</small></button>;
      })}
    </div>
    <h3 className="font-semibold">{day} · IST</h3>
    {!selected.length && <p>{t('No classes scheduled for this day.', 'इस दिन कोई कक्षा तय नहीं है।')}</p>}
    {selected.map((c) => <article key={c.id} className="ui-card ui-card-pad space-y-2">
      <h3 className="ui-h2">{c.title}</h3>{admin && <p>{!c.is_published ? t('Draft · not visible to students', 'ड्राफ्ट · छात्रों को नहीं दिखता') : t('Published', 'प्रकाशित')}</p>}<p className="ui-muted">{c.course_title}{c.module_title ? ` · ${c.module_title}` : ''}</p>
      <p>{classTime(c.starts_at)} – {classTime(c.ends_at)} IST</p><p className="whitespace-pre-wrap">{c.description}</p>
      {onAttendance && <button className="ui-btn ui-btn-primary" onClick={() => onAttendance(c)}>{t('Attendance', 'उपस्थिति')}</button>}
      {onEdit && <button className="ui-btn" onClick={() => onEdit(c)}>{t('Edit / publish', 'बदलें / प्रकाशित करें')}</button>}
      {c.is_cancelled ? <p role="status">{t('Cancelled', 'रद्द की गई')}</p> : admin && !c.is_published ? null : +new Date(c.ends_at) <= now ? <p>{t('Class ended', 'कक्षा समाप्त हो गई')}</p> : admin ? <a className="ui-btn ui-btn-primary" href={c.meet_url} target="_blank" rel="noopener noreferrer">{t('Open Google Meet', 'Google Meet खोलें')} ↗</a> : <JoinClass item={c} now={now} />}
    </article>)}
  </section>;
}
