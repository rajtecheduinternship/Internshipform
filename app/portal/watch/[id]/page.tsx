'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import YouTubePlayer from '@/components/video/YouTubePlayer';
import { Video, Course } from '@/lib/types';
import { useStudent } from '@/hooks/useStudent';
import { Badge, Empty, Progress } from '@/components/ui';
import AskQuestion from '@/components/help/AskQuestion';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: videoId } = use(params);
  const t = useCopy();
  const student = useStudent();
  const [video, setVideo] = useState<Video | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadedId, setLoadedId] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [liveProgress, setLiveProgress] = useState<{ percentage: number; totalSeconds: number; isCompleted: boolean } | null>(null);

  useEffect(() => {
    if (!student) return;
    let active = true;
    fetch(`/api/videos/${videoId}`).then((res) => res.ok ? res.json() : { video: null }).then((data) => {
      if (!active) return;
      setVideo(data.video || null);
      const p = data.video?.progress;
      setLiveProgress(p ? { percentage: Number(p.completion_percentage), totalSeconds: p.total_seconds_watched, isCompleted: p.is_completed } : null);
      setLoadedId(videoId);
    }).catch(() => { if (active) { setVideo(null); setLoadedId(videoId); } });
    fetch('/api/courses').then((res) => res.ok ? res.json() : { courses: [] }).then((data) => { if (active) setCourses(data.courses || []); }).catch(() => undefined);
    return () => { active = false; };
  }, [videoId, student, attempt]);

  const course = courses[0];
  const lectures = course?.modules?.flatMap((m) => m.videos || []) || [];
  const index = lectures.findIndex((v) => v.id === videoId);
  const next = index >= 0 ? lectures[index + 1] : undefined;
  const previous = index > 0 ? lectures[index - 1] : undefined;
  const loading = loadedId !== videoId;

  return (
    <div className="ui-page student-page flex flex-col"><StudentNavbar /><main id="main-content" tabIndex={-1} className="portal-main space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/portal/videos" className="ui-link">← {t('Back to my learning', 'मेरी पढ़ाई पर वापस')}</Link>{index >= 0 && <span className="ui-muted">{t('Lesson', 'पाठ')} {index + 1} / {lectures.length}</span>}</div>
      {loading && <div role="status" aria-label={t('Loading lesson', 'पाठ लोड हो रहा है')} className="ui-skeleton aspect-video" />}
      {!loading && !video && <div className="ui-card"><Empty title={t('This lesson could not be opened', 'यह पाठ नहीं खुल पाया')}>{t('Check your connection and try again. If this continues, ask your coordinator to check your course access.', 'इंटरनेट जाँचें और फिर कोशिश करें। परेशानी बनी रहे तो अपने शिक्षक से कोर्स की अनुमति जाँचने को कहें।')}<div className="mt-4"><button className="ui-btn" onClick={() => { setLoadedId(''); setAttempt((n) => n + 1); }}>{t('Try again', 'फिर कोशिश करें')}</button></div></Empty></div>}
      {!loading && video && student && <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <YouTubePlayer key={video.id} videoId={video.id} youtubeId={video.youtube_video_id} studentEmail={student.email} requiredPercent={video.required_watch_percent || 90} initialIntervals={video.progress?.watched_intervals || []} lastPosition={video.progress?.last_watched_position || 0} onProgress={setLiveProgress} />
          <div className="ui-card ui-card-pad"><div className="flex flex-wrap items-start justify-between gap-3"><h1 className="ui-h1">{video.title}</h1>{liveProgress?.isCompleted ? <Badge tone="ok">{t('Completed', 'पूरा हुआ')}</Badge> : <Badge tone="brand">{Math.round(liveProgress?.percentage || 0)}% {t('watched', 'देखा')}</Badge>}</div>{video.description && <p className="ui-muted mt-3">{video.description}</p>}<div className="watch-guidance mt-5"><Icon name="help" size={19} /><p>{t('Watch the lesson without skipping. Your progress is saved as you learn. Have a question? Write it below in Hindi or English.', 'पाठ बिना आगे बढ़ाए ध्यान से देखें। आपकी प्रगति अपने आप सेव होती है। सवाल है? नीचे हिन्दी या अंग्रेज़ी में लिखें।')}</p></div></div>
          <div className="flex flex-wrap justify-between gap-3">{previous ? <Link href={`/portal/watch/${previous.id}`} className="ui-btn">← {t('Previous lesson', 'पिछला पाठ')}</Link> : <span />}{next ? <Link href={`/portal/watch/${next.id}`} className="ui-btn ui-btn-primary">{t('Next lesson', 'अगला पाठ')}<Icon name="arrow" size={17} /></Link> : <Link href="/portal/profile" className="ui-btn ui-btn-primary">{t('See my progress', 'मेरी प्रगति देखें')}<Icon name="chart" size={17} /></Link>}</div>
          <div id="ask-question" className="scroll-mt-28"><AskQuestion key={video.id} videoId={video.id} /></div>
        </div>
        <aside className="ui-card self-start overflow-hidden"><div className="ui-card-head"><div><div className="ui-eyebrow">{t('KEEP EXPLORING', 'आगे सीखते रहें')}</div><h2 className="ui-h2 mt-1">{t('Your lesson list', 'आपके सभी पाठ')}</h2></div><Icon name="book" size={21} /></div><div className="max-h-[660px] overflow-y-auto">{course?.modules?.map((mod) => <div key={mod.id}><div className="ui-eyebrow px-5 pt-5 pb-2">{mod.title}</div>{mod.videos?.map((v) => {
          const current = v.id === video.id;
          const completed = current ? liveProgress?.isCompleted : v.progress?.is_completed;
          return <Link key={v.id} href={`/portal/watch/${v.id}`} aria-current={current ? 'page' : undefined} className="flex items-center gap-3 px-5 py-3 text-[13px]" style={{ background: current ? 'var(--brand-soft)' : undefined, color: current ? 'var(--brand)' : 'var(--ink)', fontWeight: current ? 650 : 500 }}><Icon name={completed ? 'check' : 'play'} size={16} /><span className="min-w-0 flex-1">{v.title}{current && <span className="block text-[11px] mt-1">{t('You are here', 'आप यहाँ हैं')}</span>}</span><span className="sr-only">{completed ? t('Completed', 'पूरा हुआ') : t('Not completed', 'अभी पूरा नहीं हुआ')}</span></Link>;
        })}</div>)}</div><div className="p-5 border-t" style={{ borderColor: 'var(--line)' }}><Progress value={lectures.length ? lectures.filter((v) => v.id === videoId ? liveProgress?.isCompleted : v.progress?.is_completed).length / lectures.length * 100 : 0} label={t('Course progress', 'कोर्स की प्रगति')} /><Link href="/portal/profile" className="ui-link block mt-3">{t('View all my progress', 'मेरी पूरी प्रगति देखें')} →</Link></div></aside>
      </div>}
    </main><PortalFooter /></div>
  );
}
