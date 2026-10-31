'use client';

import LoadingState from '@/components/LoadingState';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import Walkthrough from '@/components/help/Walkthrough';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';
import { Course, Video } from '@/lib/types';
import { formatDuration } from '@/lib/tracking';
import { useStudent } from '@/hooks/useStudent';
import { Badge, Empty, ErrorNote, Progress, Thumb } from '@/components/ui';

const thumbFor = (v: Video & { thumbnail_url?: string | null }) =>
  v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg`;

export default function VideoLibraryPage() {
  const t = useCopy();
  const student = useStudent();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'remaining' | 'completed'>('all');

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (student) void load(); }, [student, load]);

  const course = courses[0];
  const all = course?.modules?.flatMap((m) => m.videos || []) || [];
  const done = all.filter((v) => v.progress?.is_completed).length;
  const pct = course?.completion?.percentage ?? 0;
  const next = all.find((v) => !v.progress?.is_completed && (v.progress?.completion_percentage || 0) > 0) || all.find((v) => !v.progress?.is_completed);
  const modules = course?.modules?.map((mod) => ({ ...mod, videos: (mod.videos || []).filter((v) =>
    `${v.title} ${mod.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (filter === 'all' || (filter === 'completed' ? v.progress?.is_completed : !v.progress?.is_completed))) })) || [];
  const hasResults = modules.some((m) => m.videos.length > 0);
  const firstName = student?.full_name.split(' ')[0];

  return (
    <div className="ui-page student-page learning-page flex flex-col">
      <StudentNavbar />
      <main id="main-content" className="portal-main" tabIndex={-1}>
        <div className="page-heading">
          <div><div className="ui-eyebrow">{t('YOUR LEARNING JOURNEY', 'आपकी सीखने की यात्रा')}</div>
            <h1>{t('Welcome back', 'स्वागत है')}{firstName ? `, ${firstName}` : ''}<span className="brand-dot">.</span></h1>
            <p>{t('A little learning today. A step closer to your future.', 'आज थोड़ा सीखें। अपने सपने की ओर एक कदम बढ़ाएँ।')}</p></div>
          <div className="heading-note"><span className="status-dot" />{t('Your space to grow', 'सीखने और आगे बढ़ने की जगह')}</div>
        </div>

        {loading ? <LoadingState label={t('Loading your course', 'आपका कोर्स लोड हो रहा है')} /> : error ? (
          <div className="ui-card ui-card-pad space-y-4"><ErrorNote>{t('Your lessons could not load. Check your connection and try again.', 'पाठ नहीं खुल पाए। इंटरनेट जाँचें और फिर कोशिश करें।')}</ErrorNote><button onClick={load} className="ui-btn">{t('Try again', 'फिर कोशिश करें')}</button></div>
        ) : !course ? (
          <div className="ui-card"><Empty title={t('Your course is on its way', 'आपका कोर्स जल्द दिखेगा')}>{t('Ask your internship coordinator to assign your course. Once added, all your lessons will appear here.', 'अपने इंटर्नशिप शिक्षक से कोर्स जोड़ने के लिए कहें। उसके बाद सभी पाठ यहाँ दिखेंगे।')}<div className="mt-5"><Link href="/enquiry" className="ui-btn ui-btn-primary">{t('Contact the team', 'टीम से संपर्क करें')}<Icon name="arrow" size={16} /></Link></div></Empty></div>
        ) : (
          <div className="learning-layout">
            <div className="min-w-0 space-y-6">
              <section className="learning-hero">
                <div className="hero-copy">
                  <span className="hero-label"><span className="status-dot" />{t('YOUR NEXT STEP', 'अब क्या करें')}</span>
                  <h2>{done === all.length && all.length > 0 ? t('All lessons complete. Well done!', 'बहुत बढ़िया! सभी पाठ पूरे हुए।') : done ? t('Ready for your next lesson?', 'आज एक नया पाठ सीखें।') : t('Your first step starts here.', 'पहला कदम यहीं से शुरू करें।')}</h2>
                  <p>{next ? t('Pick up a lesson. Watch, learn, and ask anything along the way.', 'एक पाठ खोलें। ध्यान से देखें और कोई भी सवाल पूछें।') : all.length ? t('You’ve finished every lesson. Revisit any topic whenever you need.', 'आपने सभी पाठ पूरे कर लिए हैं। किसी भी विषय को फिर से देख सकते हैं।') : t('Your teacher is preparing your lessons. Check back soon.', 'आपके शिक्षक पाठ तैयार कर रहे हैं। कुछ समय बाद फिर देखें।')}</p>
                  {next ? <Link className="ui-btn ui-btn-light hero-cta" href={`/portal/watch/${next.id}`}><Icon name="play" size={17} />{(next.progress?.completion_percentage || 0) > 0 ? t('Resume learning', 'पढ़ाई जारी रखें') : t('Start learning', 'पढ़ाई शुरू करें')}<Icon name="arrow" size={17} /></Link> : all.length > 0 ? <Link href="/portal/profile" className="ui-btn ui-btn-light hero-cta">{t('See my progress', 'मेरी प्रगति देखें')}<Icon name="arrow" size={17} /></Link> : null}
                  {next && <div className="hero-next">{t('Up next', 'अगला पाठ')}: <strong>{next.title}</strong></div>}
                </div>
                <div className="hero-art" aria-hidden="true"><div className="art-orbit" /><div className="art-book"><Icon name="book" size={58} /><span>LEARN. GROW.</span></div><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✦</span><span className="art-check"><Icon name="check" size={23} /></span></div>
              </section>

              <div className="learning-stats">
                <div><span className="stat-icon teal"><Icon name="book" /></span><span><strong>{all.length}</strong><small>{t('Total lessons', 'कुल पाठ')}</small></span></div>
                <div><span className="stat-icon orange"><Icon name="check" /></span><span><strong>{done}</strong><small>{t('Lessons completed', 'पूरे हुए पाठ')}</small></span></div>
                <div><span className="stat-icon violet"><Icon name="chart" /></span><span><strong>{pct}%</strong><small>{t('Course progress', 'कोर्स की प्रगति')}</small></span></div>
              </div>

              <section aria-labelledby="course-title" className="space-y-4">
                <div className="section-heading"><div><div className="ui-eyebrow">{t('YOUR COURSE', 'आपका कोर्स')}</div><h2 id="course-title">{course.title}</h2></div><Badge tone="brand">{course.modules?.length || 0} {t('modules', 'भाग')}</Badge></div>
                {course.description && <p className="ui-muted">{course.description}</p>}
                {all.length > 0 && <div className="lesson-toolbar"><div role="group" aria-label={t('Filter lessons', 'पाठ चुनें')} className="lesson-filters">{(['all', 'remaining', 'completed'] as const).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? t('All lessons', 'सभी पाठ') : f === 'remaining' ? t('To watch', 'बाकी पाठ') : t('Completed', 'पूरे हुए')}</button>)}</div><input className="ui-field" type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('Search lessons', 'पाठ खोजें')} placeholder={t('Find a lesson…', 'पाठ खोजें…')} /></div>}
                {all.length > 0 && !hasResults && <div className="ui-card"><Empty title={t('No lessons match', 'कोई पाठ नहीं मिला')}>{t('Try a different search or show all lessons.', 'कुछ और खोजें या सभी पाठ देखें।')}<div className="mt-3"><button className="ui-btn" onClick={() => { setQuery(''); setFilter('all'); }}>{t('Show all lessons', 'सभी पाठ देखें')}</button></div></Empty></div>}
                {(hasResults || !all.length) && modules.map((mod, mIdx) => {
                  if (all.length && !mod.videos.length) return null;
                  const original = course.modules?.find((m) => m.id === mod.id)?.videos || [];
                  const completedCount = original.filter((v) => v.progress?.is_completed).length;
                  return (
                    <details key={mod.id} className="module-card" open>
                      <summary><span className="module-number">{String(mIdx + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><strong>{mod.title}</strong><small>{completedCount}/{original.length} {t('completed', 'पाठ पूरे')}{(mod as { is_mandatory?: boolean }).is_mandatory ? ` · ${t('For all students', 'सभी छात्रों के लिए')}` : ''}</small></span><Icon name="chevron" size={18} /></summary>
                      {!mod.videos.length ? <p className="ui-muted p-5">{t('Lessons will be added here soon.', 'पाठ जल्द यहाँ जोड़े जाएँगे।')}</p> : <ul>{mod.videos.map((v, i) => {
                        const completed = !!v.progress?.is_completed;
                        const c = Number(v.progress?.completion_percentage || 0);
                        return <li key={v.id}><Link href={`/portal/watch/${v.id}`} className={`lesson-row ${next?.id === v.id ? 'next-lesson' : ''}`}><span className={`lesson-state ${completed ? 'is-complete' : ''}`}>{completed ? <Icon name="check" size={18} /> : <Icon name="play" size={15} />}</span><Thumb src={thumbFor(v)} w={88} h={52} /><span className="min-w-0 flex-1"><strong>{v.title}</strong><span className="lesson-meta"><Icon name="clock" size={13} />{formatDuration(v.duration_seconds)}{next?.id === v.id && <span className="next-label">{t('Your next lesson', 'आपका अगला पाठ')}</span>}</span>{!completed && c > 0 && <span className="block mt-2 max-w-48"><Progress value={c} label={v.title} /></span>}</span><span className="lesson-status">{completed ? <Badge tone="ok">{t('Completed', 'पूरा हुआ')}</Badge> : c > 0 ? <span className="ui-muted">{Math.round(c)}%</span> : <span className="lesson-index">{String(i + 1).padStart(2, '0')}</span>}</span><Icon name="chevron" size={16} /></Link></li>;
                      })}</ul>}
                    </details>
                  );
                })}
              </section>
            </div>

            <aside className="learning-aside space-y-5">
              <section className="ui-card ui-card-pad progress-card"><div className="section-heading"><h2>{t('Small steps. Real progress.', 'छोटे कदम। सच्ची प्रगति।')}</h2><Icon name="chart" size={20} /></div><div className="progress-ring" style={{ '--progress': `${pct * 3.6}deg` } as React.CSSProperties}><div><strong>{pct}<span>%</span></strong><small>{t('complete', 'पूरा हुआ')}</small></div></div><p className="text-center text-sm">{done} / {all.length} {t('lessons completed', 'पाठ पूरे हुए')}</p><Progress value={pct} label={t('Course progress', 'कोर्स की प्रगति')} /><Link href="/portal/profile" className="ui-link flex items-center justify-center gap-2 mt-4">{t('View my progress', 'मेरी प्रगति देखें')}<Icon name="arrow" size={15} /></Link></section>
              <section className="ui-card ui-card-pad"><div className="ui-eyebrow">{t('NOT SURE WHERE TO START?', 'शुरू कहाँ से करें?')}</div><h2 className="ui-h2 mt-2">{t('It’s as easy as 1, 2, 3', 'बस ये 3 आसान कदम')}</h2><ol className="learning-steps">{[[t('Open a lesson', 'एक पाठ खोलें'), t('Use the start button above.', 'ऊपर शुरू करने का बटन दबाएँ।')], [t('Watch and understand', 'देखें और समझें'), t('Your watch progress is saved as you learn.', 'पढ़ते समय आपकी प्रगति अपने आप सेव होती है।')], [t('Ask, then keep going', 'सवाल पूछें, फिर आगे बढ़ें'), t('Ask your teacher below any lesson.', 'हर पाठ के नीचे शिक्षक से सवाल पूछें।')]].map(([title, body], i) => <li key={i}><span>{i + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>)}</ol><Walkthrough kind="student" storageKey="rts_tour_student" /></section>
              <section className="help-card"><span className="stat-icon orange"><Icon name="message" /></span><h2>{t('A question is a good start.', 'सवाल पूछना अच्छी शुरुआत है।')}</h2><p>{t('Stuck on a topic? Open that lesson and write to your teacher in Hindi or English.', 'कुछ समझ नहीं आया? उस पाठ को खोलकर हिन्दी या अंग्रेज़ी में अपना सवाल लिखें।')}</p>{next && <Link href={`/portal/watch/${next.id}#ask-question`} className="ui-link">{t('Ask about my next lesson', 'अगले पाठ पर सवाल पूछें')} →</Link>}</section>
            </aside>
          </div>
        )}
      </main>
      <PortalFooter />
    </div>
  );
}
