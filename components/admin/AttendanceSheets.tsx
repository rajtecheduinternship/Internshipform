'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useCopy } from '@/components/help/i18n';
import { classTime } from '@/lib/class-calendar';
import type { ReportSummary } from '@/lib/attendance-report';

type Course = { id: string; title: string };
type Range = { first: string | null; last: string | null; days: number };
/** Generate, review and publish each student's attendance sheet for a course, one by one or all at once. */
export default function AttendanceSheets() {
  const t = useCopy();
  const [courses, setCourses] = useState<Course[]>([]); const [courseId, setCourse] = useState('');
  const [reports, setReports] = useState<ReportSummary[]>([]); const [range, setRange] = useState<Range | null>(null);
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [missing, setMissing] = useState(0);
  const [refCode, setRefCode] = useState(''); const [refYear, setRefYear] = useState(new Date().getFullYear());
  const [picked, setPicked] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { void api<{ courses: Course[] }>('/api/admin/courses').then((d) => setCourses(d.courses)).catch((e) => setError(e.message)); }, []);
  const load = useCallback(async () => {
    if (!courseId) { setReports([]); setRange(null); return; }
    const d = await api<{ reports: ReportSummary[]; range: Range; ref: { code: string; year: number }; missing: number }>(`/api/admin/attendance-reports?course_id=${courseId}`);
    setReports(d.reports); setRange(d.range); setPicked([]);
    setRefCode(d.ref.code); setRefYear(d.ref.year); setMissing(d.missing);
    setStart((v) => v || d.range.first || ''); setEnd((v) => v || d.range.last || '');
  }, [courseId]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  async function run(fn: () => Promise<string>) {
    setBusy(true); setError(''); setMessage('');
    try { setMessage(await fn()); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const generate = (mode: 'new' | 'drafts') => run(async () => {
    const r = await api<{ generated: number; kept: number; class_days: number; ref_code: string }>('/api/admin/attendance-reports', 'POST', { course_id: courseId, start_date: start, end_date: end, ref_code: refCode.trim(), mode });
    setRefCode(r.ref_code);
    return `${r.generated} ${t('sheets generated from', 'शीट बनीं,')} ${r.class_days} ${t('class days.', 'कक्षा-दिनों से।')}${r.kept ? ` ${r.kept} ${t('existing sheets were left unchanged.', 'मौजूदा शीट जस की तस रहीं।')}` : ''} ${t('Review, then publish.', 'जाँचें, फिर प्रकाशित करें।')}`;
  });
  const publish = (ids: string[] | undefined, value: boolean) => run(async () => {
    const r = await api<{ updated: number }>('/api/admin/attendance-reports', 'PATCH', { course_id: courseId, ids, is_published: value });
    return `${r.updated} ${value ? t('sheets published.', 'शीट प्रकाशित हुईं।') : t('sheets hidden.', 'शीट छिपाई गईं।')}`;
  });
  const drafts = reports.filter((r) => !r.is_published).length;
  const flagged = reports.filter((r) => r.topped_up_days > 0 || r.missing_registration).length;
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  return <div className="max-w-5xl mx-auto p-4 space-y-5">
    {error && <p role="alert" className="ui-card ui-card-pad">{error}</p>}{message && <p role="status">{message}</p>}
    <section className="ui-card ui-card-pad space-y-4">
      <label className="block">{t('Course', 'कोर्स')}<select className="ui-field" disabled={busy} value={courseId} onChange={(e) => { setCourse(e.target.value); setStart(''); setEnd(''); setMessage(''); setError(''); }}><option value="">{t('Choose course', 'कोर्स चुनें')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      {courseId && <>
        <p className="ui-muted">{range?.days ? `${t('Class days held so far', 'अब तक की कक्षाएँ')}: ${range.days} (${range.first} → ${range.last}).` : t('No published class has taken place on this course yet.', 'इस कोर्स की कोई प्रकाशित कक्षा अभी तक नहीं हुई।')}</p>
        <div className="grid sm:grid-cols-2 gap-4"><label>{t('Internship start date', 'इंटर्नशिप शुरू होने की तारीख')}<input type="date" className="ui-field" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>{t('Internship end date', 'इंटर्नशिप समाप्त होने की तारीख')}<input type="date" className="ui-field" value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
        <label className="block max-w-xs">{t('Reference code', 'संदर्भ कोड')}<input className="ui-field" maxLength={12} pattern="[A-Za-z0-9\-]{1,12}" value={refCode} onChange={(e) => setRefCode(e.target.value)} aria-describedby="ref-hint" /></label>
        <p id="ref-hint" className="ui-muted">{t('Each sheet gets its own number, e.g.', 'हर शीट का अपना नंबर होता है, जैसे')} <strong>{refYear}/{refCode.trim() || '003'}/1</strong>, {refYear}/{refCode.trim() || '003'}/2 … {t('Published sheets keep their number. Changing the code re-numbers draft sheets from 1 under the new code.', 'प्रकाशित शीट का नंबर नहीं बदलता। कोड बदलने पर ड्राफ्ट शीट नए कोड के साथ 1 से दोबारा नंबर पाती हैं।')}</p>
        <p className="ui-muted">{t('Each class day in this range becomes one row (Day-1, Day-2 …). Classes whose attendance was never marked count as present, and the sheet is raised to at least 90% overall.', 'इस अवधि का हर कक्षा-दिन एक पंक्ति बनता है (Day-1, Day-2 …)। जिन कक्षाओं की उपस्थिति दर्ज नहीं हुई, वे उपस्थित गिनी जाती हैं और शीट कम से कम 90% तक पहुँचाई जाती है।')}</p>
        <div className="flex flex-wrap gap-2">
          <button className="ui-btn ui-btn-primary" disabled={busy || !start || !end || !range?.days || !missing || !/^[A-Za-z0-9-]{1,12}$/.test(refCode.trim())} onClick={() => generate('new')}>{t('Generate sheets for students without one', 'बिना शीट वाले छात्रों की शीट बनाएँ')} ({missing})</button>
          <button className="ui-btn" disabled={busy || !start || !end || !range?.days || !reports.some((r) => !r.is_published)} onClick={() => window.confirm(t('Rebuild every DRAFT sheet using these dates? Published sheets are not touched.', 'इन तारीखों से सभी ड्राफ्ट शीट दोबारा बनाएँ? प्रकाशित शीट नहीं बदलेंगी।')) && generate('drafts')}>{t('Rebuild draft sheets', 'ड्राफ्ट शीट दोबारा बनाएँ')}</button>
        </div>
        <p className="ui-muted">{t('Published sheets are never changed by generating. To redo one, hide it first, then rebuild drafts. Use different dates for a later batch, e.g. a new college, and only their sheets are created, continuing the numbering.', 'प्रकाशित शीट बनाने से कभी नहीं बदलती। किसी को दोबारा बनाना हो तो पहले उसे छिपाएँ, फिर ड्राफ्ट दोबारा बनाएँ। नए बैच (जैसे नया कॉलेज) के लिए अलग तारीखें चुनें; केवल उनकी शीट बनेंगी और नंबर आगे बढ़ेगा।')}</p>
      </>}
    </section>
    {courseId && !!reports.length && <section className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="ui-h2">{reports.length} {t('sheets', 'शीट')} · {drafts} {t('draft', 'ड्राफ्ट')}</h2>
        <div className="flex flex-wrap gap-2"><button className="ui-btn ui-btn-primary" disabled={busy || !drafts} onClick={() => window.confirm(t(`Publish all ${drafts} draft sheets? Students will be able to view and download them.`, `सभी ${drafts} ड्राफ्ट शीट प्रकाशित करें? छात्र उन्हें देख और डाउनलोड कर पाएँगे।`)) && publish(undefined, true)}>{t('Publish all drafts', 'सभी ड्राफ्ट प्रकाशित करें')}</button>
          <button className="ui-btn" disabled={busy || !picked.length} onClick={() => publish(picked, true)}>{t('Publish selected', 'चुनी हुई प्रकाशित करें')} ({picked.length})</button>
          <button className="ui-btn" disabled={busy || !picked.length} onClick={() => publish(picked, false)}>{t('Hide selected', 'चुनी हुई छिपाएँ')}</button></div></div>
      {!!flagged && <p className="ui-card ui-card-pad" role="note">{flagged} {t('sheet(s) need a look: either attendance was raised to reach 90%, or the student has no registration number on file (printed as N/A).', 'शीट देखने लायक हैं: या तो 90% तक पहुँचाने के लिए उपस्थिति बढ़ाई गई, या छात्र का पंजीकरण नंबर दर्ज नहीं है (N/A छपेगा)।')}</p>}
      <ul className="space-y-2">{reports.map((r) => <li key={r.id} className="ui-card ui-card-pad flex flex-wrap gap-3 items-center justify-between">
        <label className="flex gap-3 items-start min-w-0"><input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} /><span className="min-w-0 break-words"><strong>{r.student_name}</strong> · {r.ref_no}<br /><span className="ui-muted">{t('Recorded', 'दर्ज')} {r.recorded_percent}% → {t('Sheet', 'शीट')} {r.sheet_percent}% · {r.start_date} → {r.end_date} · {r.total_days} {t('days', 'दिन')}{r.unmarked_days ? ` · ${r.unmarked_days} ${t('unmarked', 'अचिह्नित')}` : ''}{r.topped_up_days ? ` · ${r.topped_up_days} ${t('days raised to Present', 'दिन उपस्थित किए गए')}` : ''}{r.missing_registration ? ` · ${t('no registration no.', 'पंजीकरण नंबर नहीं')}` : ''}</span><br /><span>{r.is_published ? `${t('Published', 'प्रकाशित')} · ${r.published_at ? classTime(r.published_at) + ' IST' : ''}` : t('Draft', 'ड्राफ्ट')}</span></span></label>
        <div className="flex flex-wrap gap-2"><a className="ui-btn ui-btn-sm" target="_blank" rel="noopener noreferrer" href={`/api/admin/attendance-reports/${r.id}/pdf`}>{t('Preview PDF', 'PDF देखें')}</a><button className="ui-btn ui-btn-sm" disabled={busy} onClick={() => publish([r.id], !r.is_published)}>{r.is_published ? t('Hide', 'छिपाएँ') : t('Publish', 'प्रकाशित करें')}</button></div>
      </li>)}</ul>
    </section>}
  </div>;
}
