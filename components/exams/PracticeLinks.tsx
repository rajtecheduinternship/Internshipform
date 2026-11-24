'use client';
import Link from 'next/link';
import { useCopy } from '@/components/help/i18n';
import type { PracticeSummary } from '@/lib/practice';
export default function PracticeLinks({ items }: { items: PracticeSummary[] }) {
  const t = useCopy();
  return <div className="space-y-3">{items.map((p) => <article key={p.id} className="border-t p-4 space-y-2"><h3 className="font-semibold break-words">{p.title}</h3>
    <p>{p.module_title} · {p.question_count} {t('questions', 'प्रश्न')} · {t('Pass', 'उत्तीर्ण')}: {p.pass_percent}%</p>
    <p className="ui-muted">{p.my_in_progress ? t('Attempt in progress', 'प्रयास जारी है') : p.my_attempts ? `${t('Attempts', 'प्रयास')}: ${p.my_attempts} · ${t('Last', 'पिछला')}: ${p.my_last_percent}% · ${t('Best', 'सर्वश्रेष्ठ')}: ${p.my_best_percent}%` : t('Not attempted yet', 'अभी तक नहीं दिया')}</p>
    <Link className="ui-btn ui-btn-primary ui-btn-sm" href={`/portal/practice/${p.id}`}>{p.my_in_progress ? t('Continue', 'जारी रखें') : p.my_attempts ? t('Practice again', 'फिर अभ्यास करें') : t('Start practice', 'अभ्यास शुरू करें')}</Link></article>)}</div>;
}
