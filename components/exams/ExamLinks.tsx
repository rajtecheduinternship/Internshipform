'use client';
import Link from 'next/link';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import type { ExamSummary } from '@/lib/exams';
export default function ExamLinks({ exams }: { exams: ExamSummary[] }) {
  const t = useCopy();
  return <div className="space-y-3">{exams.map((e) => <article key={e.id} className="border-t p-4 space-y-2"><h3 className="font-semibold">{e.title}</h3><p>{e.module_title} · {e.duration_minutes} {t('minutes', 'मिनट')} · {t('Pass', 'उत्तीर्ण')}: {e.pass_percent}%</p>{e.opens_at && <p>{t('Opens', 'शुरू')}: {classTime(e.opens_at)} IST</p>}{e.closes_at && <p>{t('Closes', 'समाप्त')}: {classTime(e.closes_at)} IST</p>}{!e.eligible && <p>{t('Complete this module’s published lessons before starting.', 'शुरू करने से पहले इस मॉड्यूल के प्रकाशित पाठ पूरे करें।')}</p>}<Link className="ui-btn ui-btn-primary ui-btn-sm" href={`/portal/exams/${e.id}`}>{t('View exam / my attempt', 'परीक्षा / मेरा प्रयास देखें')}</Link></article>)}</div>;
}
