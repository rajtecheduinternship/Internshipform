'use client';

import { useEffect, useState } from 'react';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';

interface NewsItem { id: string; message: string; link_url?: string; created_at: string }

/** Stationary, expandable updates are easier to read than an auto-scrolling ticker. */
export default function NewsTicker() {
  const t = useCopy();
  const [news, setNews] = useState<NewsItem[]>([]);
  useEffect(() => {
    fetch('/api/news').then((r) => r.json()).then((data) => { if (Array.isArray(data)) setNews(data); }).catch(() => undefined);
  }, []);
  if (!news.length) return null;
  return <aside className="public-updates"><details><summary><Icon name="bell" size={17} /><strong>{t('Updates', 'ज़रूरी सूचना')}</strong><span>{news[0].message}</span><small>{t('View all', 'सभी देखें')} ({news.length})</small><Icon name="chevron" size={15} /></summary><ul>{news.map((item) => <li key={item.id}>{item.link_url ? <a href={item.link_url} target="_blank" rel="noopener noreferrer">{item.message} ↗</a> : item.message}</li>)}</ul></details></aside>;
}
