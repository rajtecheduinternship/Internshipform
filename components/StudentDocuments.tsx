'use client';
import { useEffect, useState } from 'react';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';

type Syllabus = { filename: string; size_bytes: number; version: number; published_at: string | null; updated_at: string };
type Sheet = { ref_no: string; start_date: string; end_date: string; published_at: string | null };
/** The student's published syllabus and attendance sheet, each with view and download. Renders nothing if neither exists. */
export default function StudentDocuments() {
  const t = useCopy();
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null); const [sheet, setSheet] = useState<Sheet | null>(null);
  useEffect(() => {
    let live = true;
    const get = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null);
    void Promise.all([get('/api/portal/syllabus'), get('/api/portal/attendance-sheet')]).then(([a, b]) => { if (live) { setSyllabus(a?.syllabus ?? null); setSheet(b?.sheet ?? null); } });
    return () => { live = false; };
  }, []);
  if (!syllabus && !sheet) return null;
  return <section className="ui-card ui-card-pad space-y-4" aria-label={t('My documents', 'मेरे दस्तावेज़')}>
    <h2 className="ui-h2">{t('My documents', 'मेरे दस्तावेज़')}</h2>
    {syllabus && <div className="flex flex-wrap gap-3 items-center justify-between"><div className="min-w-0 break-words"><strong>{t('Course syllabus', 'कोर्स सिलेबस')}</strong><br /><span className="ui-muted">{syllabus.filename}{syllabus.version > 1 ? ` · ${t('updated', 'अपडेट')} ${classTime(syllabus.updated_at)}` : ''}</span></div>
      <div className="flex gap-2"><a className="ui-btn ui-btn-sm" href="/api/portal/syllabus?file=1" target="_blank" rel="noopener noreferrer">{t('View', 'देखें')}</a><a className="ui-btn ui-btn-sm ui-btn-primary" href="/api/portal/syllabus?file=1&download=1">{t('Download', 'डाउनलोड')}</a></div></div>}
    {sheet && <div className="flex flex-wrap gap-3 items-center justify-between"><div className="min-w-0 break-words"><strong>{t('Internship attendance sheet', 'इंटर्नशिप उपस्थिति शीट')}</strong><br /><span className="ui-muted">{sheet.ref_no}</span></div>
      <div className="flex gap-2"><a className="ui-btn ui-btn-sm" href="/api/portal/attendance-sheet?file=1" target="_blank" rel="noopener noreferrer">{t('View', 'देखें')}</a><a className="ui-btn ui-btn-sm ui-btn-primary" href="/api/portal/attendance-sheet?file=1&download=1">{t('Download', 'डाउनलोड')}</a></div></div>}
  </section>;
}
