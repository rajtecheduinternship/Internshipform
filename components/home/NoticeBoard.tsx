'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { useCopy, useLang } from '@/components/help/i18n';

interface Notice { id: string; message: string; link_url: string | null; created_at: string }

/** Uses the existing admin announcements API; no separate notice store or demo content. */
export default function NoticeBoard() {
  const t = useCopy();
  const { lang } = useLang();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const res = await fetch('/api/news', { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('notices');
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('notices');
      setNotices(data.filter((item): item is Notice => !!item && typeof item.id === 'string' && typeof item.message === 'string'));
      setError(false);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { window.clearInterval(timer); request.current?.abort(); };
  }, [load]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const box = viewport.current;
    if (!box || !list.current) return;
    const measure = () => setOverflow(box.scrollHeight > box.clientHeight + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box); observer.observe(list.current);
    return () => observer.disconnect();
  }, [loading, notices.length]);

  // A single real list, not duplicate marquee links. Reverse gently at the ends;
  // hovering, keyboard focus, manual scrolling and reduced-motion all stop motion.
  useEffect(() => {
    const box = viewport.current;
    if (!box || !overflow || paused || hovered || focused || reducedMotion) return;
    let frame = 0, last = 0, direction = 1, position = box.scrollTop;
    let waitUntil = performance.now() + 1800;
    const step = (now: number) => {
      if (document.hidden) { last = now; frame = requestAnimationFrame(step); return; }
      if (last && now >= waitUntil) {
        const end = box.scrollHeight - box.clientHeight;
        position = Math.max(0, Math.min(end, position + Math.min(now - last, 50) * .018 * direction));
        box.scrollTop = position;
        if (position >= end || position <= 0) { direction *= -1; waitUntil = now + 2200; }
      }
      last = now; frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [overflow, paused, hovered, focused, reducedMotion, notices.length]);

  return (
    <section id="notice-board" className="home-notice-board scroll-mt-28" aria-labelledby="notice-heading">
      <div className="notice-board-head"><span className="notice-bell"><Icon name="bell" size={24} /></span><div><span className="notice-kicker" lang="hi">ज़रूरी सूचना</span><h2 id="notice-heading">{t('Notice board', 'सूचना बोर्ड')}</h2></div><span className="notice-live"><span aria-hidden="true" />{t('UPDATES', 'सूचनाएँ')}</span></div>
      <div className="notice-board-toolbar"><p>{t('The latest from Rajtech', 'राजटेक की नई सूचनाएँ')}{notices.length ? ` · ${notices.length}` : ''}</p>{overflow && !reducedMotion && <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Icon name="play" size={13} /> : <span aria-hidden="true" className="notice-pause-icon">Ⅱ</span>}{paused ? t('Resume', 'फिर चलाएँ') : t('Pause', 'रोकें')}</button>}</div>
      {loading ? <div className="p-5 space-y-4" role="status" aria-label={t('Loading notices', 'सूचनाएँ लोड हो रही हैं')}><div className="ui-skeleton h-20" /><div className="ui-skeleton h-20" /><div className="ui-skeleton h-20" /></div> : notices.length ? <div ref={viewport} className="notice-viewport" tabIndex={overflow ? 0 : undefined} role="region" aria-label={t('Notices. Scroll to read more. Automatic scrolling pauses while focused.', 'सूचनाएँ। और पढ़ने के लिए स्क्रॉल करें। यहाँ आने पर अपने आप चलना रुक जाएगा।')} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }} onWheel={() => setPaused(true)} onTouchStart={() => setPaused(true)}><ol ref={list} className="notice-list">{notices.map((notice, i) => {
        const link = notice.link_url && (/^https?:\/\//i.test(notice.link_url) || /^\/(?!\/)/.test(notice.link_url)) ? notice.link_url : null;
        const date = new Date(notice.created_at);
        const validDate = !Number.isNaN(date.getTime());
        return <li key={notice.id} className={`notice-item ${i === 0 ? 'notice-latest' : ''}`}><div className="notice-item-meta"><span>{i === 0 ? t('HIGHLIGHT', 'ज़रूरी') : `${t('NOTICE', 'सूचना')} ${String(i + 1).padStart(2, '0')}`}</span>{validDate && <time dateTime={notice.created_at}>{date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}</div><p>{notice.message}</p>{link && <a href={link} target="_blank" rel="noopener noreferrer" className="notice-read-more">{t('View details', 'पूरी जानकारी देखें')}<Icon name="arrow" size={14} /></a>}</li>;
      })}</ol></div> : <div className="notice-empty"><span className="stat-icon teal"><Icon name="bell" size={25} /></span><h3>{error ? t('Notices could not load', 'सूचनाएँ नहीं खुल पाईं') : t('You’re all caught up.', 'अभी कोई नई सूचना नहीं है।')}</h3><p>{error ? t('Check your connection and try again.', 'इंटरनेट जाँचें और फिर कोशिश करें।') : t('New announcements from the Rajtech team will appear here.', 'राजटेक टीम की नई सूचनाएँ यहाँ दिखेंगी।')}</p>{error && <button className="ui-btn ui-btn-sm mt-3" onClick={load}>{t('Try again', 'फिर कोशिश करें')}</button>}</div>}
      {overflow && <div className="notice-scroll-hint"><Icon name="chevron" size={13} />{t('Scroll to read all notices', 'सभी सूचनाएँ पढ़ने के लिए स्क्रॉल करें')}</div>}
      {error && notices.length > 0 && <p role="status" className="notice-refresh-error">{t('Showing the last received updates. We’ll try refreshing again.', 'पहले मिली सूचनाएँ दिख रही हैं। हम फिर से लाने की कोशिश करेंगे।')}</p>}
      <div className="notice-board-footer"><Link href="/apply" className="ui-btn ui-btn-primary w-full">{t('Start your registration', 'अपना फॉर्म भरें')}<Icon name="arrow" size={17} /></Link><span lang="hi">यहाँ से शुरू करें</span><p>{t('Already registered?', 'फॉर्म भर चुके हैं?')} <Link href="/portal/login">{t('Student sign in', 'छात्र लॉगिन')} →</Link></p></div>
    </section>
  );
}
