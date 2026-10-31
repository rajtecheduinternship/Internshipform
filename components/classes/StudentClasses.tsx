'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import type { LiveClass } from '@/lib/live-classes';
import StudentAttendance, { AttendanceProvider, JoinClass } from './StudentAttendance';
import ClassCalendar from './ClassCalendar';
export default function StudentClasses({ calendar = false }: { calendar?: boolean }) {
  const t = useCopy();
  const [items, setItems] = useState<LiveClass[]>([]);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/classes', { cache: 'no-store' });
      if (!res.ok) throw new Error('classes');
      setItems((await res.json()).classes); setError(false);
    } catch { setError(true); } finally { setLoading(false); setNow(Date.now()); }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, 60000);
    window.addEventListener('focus', load);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);
  const upcoming = items.filter((c) => !c.is_cancelled && +new Date(c.ends_at) > now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  if (loading) return <p role="status">{t('Loading class notices…', 'कक्षा सूचनाएँ लोड हो रही हैं…')}</p>;
  if (error) return <p role="alert">{t('Could not load class notices.', 'कक्षा सूचनाएँ नहीं खुलीं।')} <button className="ui-link" onClick={load}>{t('Retry', 'फिर कोशिश करें')}</button></p>;
  return <AttendanceProvider><div className="space-y-4 mb-6">
    <section className="ui-card ui-card-pad space-y-3" aria-label="Notice board / सूचना पट्ट">
      <h2 className="ui-h2">{t('Notice board · Online classes', 'सूचना पट्ट · ऑनलाइन कक्षाएँ')}</h2>
      {!upcoming.length && <p>{t('No upcoming online classes. Check back for your next class.', 'अभी कोई आगामी ऑनलाइन कक्षा नहीं है। अगली कक्षा के लिए फिर देखें।')}</p>}
      {upcoming.slice(0, calendar ? 20 : 3).map((c) => <div key={c.id} className="border-t pt-3 space-y-1">
        <strong>{c.title}</strong><p>{classTime(c.starts_at)} IST{c.module_title ? ` · ${c.module_title}` : ''}</p>
        {+new Date(c.starts_at) <= now ? <><p>Student, your online class is live on Google Meet. Join now.</p><p lang="hi">छात्र, आपकी ऑनलाइन कक्षा Google Meet पर चल रही है। अभी जुड़ें।</p></> : <><p>You have an upcoming Google Meet class. Sign in and join at the scheduled time.</p><p lang="hi">आपकी Google Meet कक्षा आने वाली है। निर्धारित समय पर लॉगिन करके जुड़ें।</p></>}
        <JoinClass item={c} now={now} />
      </div>)}
      {!calendar && <Link href="/portal/classes" className="ui-link">{t('View full class calendar', 'पूरा कक्षा कैलेंडर देखें')} →</Link>}
    </section>
    {calendar && <><ClassCalendar classes={items} now={now} /><StudentAttendance /></>}
  </div></AttendanceProvider>;
}
