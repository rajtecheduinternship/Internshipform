'use client';

import StudentExamRecord from '@/components/exams/StudentExamRecord';
import LoadingState from '@/components/LoadingState';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import { Course } from '@/lib/types';
import { formatDuration } from '@/lib/tracking';
import { useStudent } from '@/hooks/useStudent';
import { Badge, Empty, ErrorNote, Progress, Stat } from '@/components/ui';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';

export default function StudentProfilePage() {
  const t = useCopy();
  const student = useStudent();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('courses');
      const data = await res.json(); setCourses(data.courses || []);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (student) void load(); }, [student, load]);

  const course = courses[0];
  const vids = course?.modules?.flatMap((m) => m.videos || []) || [];
  const done = vids.filter((v) => v.progress?.is_completed).length;
  const secs = vids.reduce((a, v) => a + (v.progress?.total_seconds_watched || 0), 0);
  const pct = course?.completion?.percentage ?? 0;
  const next = vids.find((v) => !v.progress?.is_completed);

  return (
    <div className="ui-page student-page flex flex-col"><StudentNavbar /><main id="main-content" tabIndex={-1} className="portal-main space-y-6">
      <div className="page-heading"><div><div className="ui-eyebrow">{t('EVERY LESSON COUNTS', 'हर पाठ मायने रखता है')}</div><h1>{t('See how far you’ve come.', 'देखें, आपने कितना सीख लिया।')}</h1><p>{t('Your completed lessons and watch time, all in one place.', 'पूरे हुए पाठ और पढ़ाई का समय, सब एक जगह।')}</p></div><Link href={next ? `/portal/watch/${next.id}` : '/portal/videos'} className="ui-btn ui-btn-primary"><Icon name="play" size={17} />{t('Continue learning', 'पढ़ाई जारी रखें')}</Link></div>
      {loading ? <LoadingState label={t('Loading progress', 'प्रगति लोड हो रही है')} /> : error ? <div className="ui-card ui-card-pad space-y-4"><ErrorNote>{t('Progress could not load. Check your connection and try again.', 'प्रगति नहीं खुल पाई। इंटरनेट जाँचें और फिर कोशिश करें।')}</ErrorNote><button className="ui-btn" onClick={load}>{t('Try again', 'फिर कोशिश करें')}</button></div> : !course ? <div className="ui-card"><Empty title={t('No course assigned yet', 'अभी कोर्स नहीं जुड़ा है')}>{t('Your coordinator can add your course. Your progress will appear here once you start learning.', 'अपने शिक्षक से कोर्स जोड़ने के लिए कहें। पढ़ाई शुरू होने पर प्रगति यहाँ दिखेगी।')}</Empty></div> : <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label={t('Lessons completed', 'पूरे हुए पाठ')} value={`${done}/${vids.length}`} hint={t('One step at a time', 'एक-एक कदम आगे')} /><Stat label={t('Course progress', 'कोर्स की प्रगति')} value={`${pct}%`} hint={t('Based on completed lessons', 'पूरे हुए पाठों के आधार पर')} /><Stat label={t('Time watched', 'वीडियो देखने का समय')} value={formatDuration(secs)} hint={t('Your recorded watch time', 'आपका दर्ज किया गया समय')} /><Stat label={t('Lessons remaining', 'बाकी पाठ')} value={vids.length - done} hint={course?.completion?.is_completed ? t('Well done! All lessons finished.', 'बहुत बढ़िया! सभी पाठ पूरे।') : t('Keep learning at your pace', 'अपने समय पर सीखते रहें')} /></div>
        <section className="ui-card ui-card-pad"><div className="section-heading mb-4"><h2>{course.title}</h2><Badge tone={pct === 100 && vids.length > 0 ? 'ok' : 'brand'}>{pct}% {t('complete', 'पूरा')}</Badge></div><Progress value={pct} label={t('Course progress', 'कोर्स की प्रगति')} /><p className="ui-muted mt-3">{t('A lesson is complete after you watch its required portion. Open a lesson to see its exact requirement.', 'ज़रूरी हिस्सा देखने के बाद पाठ पूरा माना जाता है। कितना देखना है, यह उस पाठ को खोलने पर दिखेगा।')}</p></section>
        {course.modules?.map((mod, mi) => <section key={mod.id} className="ui-card overflow-hidden"><div className="ui-card-head"><div className="flex gap-3 items-center"><span className="module-number">{String(mi + 1).padStart(2, '0')}</span><h2 className="ui-h2">{mod.title}</h2></div><span className="ui-muted">{mod.videos?.filter((v) => v.progress?.is_completed).length || 0}/{mod.videos?.length || 0} {t('completed', 'पूरे')}</span></div><ul>{mod.videos?.map((v) => {
          const c = Number(v.progress?.completion_percentage || 0);
          return <li key={v.id}><Link className="lesson-row" href={`/portal/watch/${v.id}`}><span className={`lesson-state ${v.progress?.is_completed ? 'is-complete' : ''}`}><Icon name={v.progress?.is_completed ? 'check' : 'play'} size={18} /></span><span className="min-w-0 flex-1"><strong>{v.title}</strong><span className="block mt-2 max-w-64"><Progress value={c} done={v.progress?.is_completed} label={v.title} /></span><span className="lesson-meta">{formatDuration(v.progress?.total_seconds_watched || 0)} {t('watched', 'देखा गया')}</span></span>{v.progress?.is_completed ? <Badge tone="ok">{t('Completed', 'पूरा हुआ')}</Badge> : <span className="ui-muted">{Math.round(c)}%</span>}<Icon name="chevron" size={16} /></Link></li>;
        })}</ul>{!mod.videos?.length && <p className="ui-muted p-5">{t('Lessons will appear here soon.', 'पाठ जल्द यहाँ दिखेंगे।')}</p>}</section>)}
      </>}
    <StudentExamRecord enabled={!!student} /></main><PortalFooter /></div>
  );
}
