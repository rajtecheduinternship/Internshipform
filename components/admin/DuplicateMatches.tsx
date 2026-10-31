'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui';
import { useCopy } from '@/components/help/i18n';
import type { DuplicateMatch, DuplicateReason } from '@/lib/duplicates';

interface Current { student_name: string; father_name: string; mother_name: string; date_of_birth: string | null; contact_number: string; email_address: string; university_roll_number: string; college_name: string | null }

const digits = (v: string) => (v || '').replace(/\D/g, '').slice(-10);
const norm = (v: string | null | undefined) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const same = (a: string | null | undefined, b: string | null | undefined) => !!norm(a) && norm(a) === norm(b);

export default function DuplicateMatches({ applicationId }: { applicationId: string }) {
  const t = useCopy();
  const [matches, setMatches] = useState<DuplicateMatch[] | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/submissions/${applicationId}/duplicates`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (live) { setMatches(d.matches); setCurrent(d.current ?? null); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [applicationId]);

  const reason = (r: DuplicateReason) => ({
    phone: t('Same phone', 'वही फ़ोन'), email: t('Same email', 'वही ईमेल'), roll: t('Same roll number', 'वही रोल नंबर'),
    name_father: t('Same name + father', 'वही नाम + पिता'), name_dob: t('Same name + birth date', 'वही नाम + जन्मतिथि'),
  })[r];

  if (failed) return <p className="ui-muted">{t('Could not check for duplicates.', 'डुप्लिकेट जाँच नहीं हो पाई।')}</p>;
  if (!matches) return <p className="ui-muted">{t('Checking for duplicates…', 'डुप्लिकेट जाँच रहे हैं…')}</p>;
  if (!matches.length) return <p className="rounded-lg p-3 text-sm" style={{ background: 'var(--ok-soft, #eaf6ee)', border: '1px solid var(--ok, #2f8f5b)' }}>{t('No other student with the same name, father, phone, email or roll number was found. This looks like a new applicant.', 'समान नाम, पिता, फ़ोन, ईमेल या रोल नंबर वाला कोई और छात्र नहीं मिला। यह नया आवेदक लगता है।')}</p>;

  const rows = (m: DuplicateMatch) => current ? [
    { label: t('Name', 'नाम'), a: current.student_name, b: m.student_name, eq: same(current.student_name, m.student_name) },
    { label: t('Father', 'पिता'), a: current.father_name, b: m.father_name, eq: same(current.father_name, m.father_name) },
    { label: t('Mother', 'माता'), a: current.mother_name, b: m.mother_name, eq: same(current.mother_name, m.mother_name) },
    { label: t('Date of birth', 'जन्मतिथि'), a: current.date_of_birth?.slice(0, 10) ?? '', b: m.date_of_birth?.slice(0, 10) ?? '', eq: !!current.date_of_birth && current.date_of_birth.slice(0, 10) === m.date_of_birth?.slice(0, 10) },
    { label: t('Phone', 'फ़ोन'), a: current.contact_number, b: m.contact_number, eq: !!digits(current.contact_number) && digits(current.contact_number) === digits(m.contact_number) },
    { label: t('Email', 'ईमेल'), a: current.email_address, b: m.email_address, eq: same(current.email_address, m.email_address) },
    { label: t('Roll no.', 'रोल नंबर'), a: current.university_roll_number, b: m.university_roll_number, eq: same(current.university_roll_number, m.university_roll_number) },
    { label: t('College', 'कॉलेज'), a: current.college_name ?? '', b: m.college_name ?? '', eq: same(current.college_name, m.college_name) },
  ] : [];
  const status = (v: string) => v === 'approved' ? t('Already registered (approved)', 'पहले से पंजीकृत (मंज़ूर)') : v === 'rejected' ? t('Rejected earlier', 'पहले नामंज़ूर') : t('Another pending application', 'एक और बाकी आवेदन');

  return <div className="rounded-xl p-3 sm:p-4 space-y-4" style={{ background: 'var(--warn-soft, #fff7e6)', border: '1px solid var(--warn, #f59e0b)' }}>
    <h4 className="font-semibold">{t(`Possible duplicate (${matches.length})`, `संभावित डुप्लिकेट (${matches.length})`)}</h4>
    <p className="text-sm">{t('Compare below. Green ticks are the same in both records; red marks differ. A student who changed only the phone number or email is probably already registered. Call them and ask them to sign in with the phone number given to their college and their university roll number, then reject this application.', 'नीचे तुलना करें। हरे निशान दोनों रिकॉर्ड में एक जैसे हैं; लाल अलग हैं। जिसने सिर्फ़ फ़ोन या ईमेल बदला है वह शायद पहले से पंजीकृत है। उन्हें कॉल करके कहें कि कॉलेज में दिए फ़ोन नंबर और यूनिवर्सिटी रोल नंबर से साइन इन करें, फिर यह आवेदन नामंज़ूर करें।')}</p>
    {matches.map((m) => <div key={m.id} className="rounded-lg bg-white p-3 space-y-2" style={{ border: '1px solid var(--line)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={m.approval_status === 'approved' ? 'ok' : m.approval_status === 'rejected' ? 'bad' : 'warn'}>{status(m.approval_status)}</Badge>
        <div className="flex flex-wrap gap-1">{m.reasons.map((r) => <Badge key={r} tone={m.level === 'exact' ? 'bad' : 'warn'}>{reason(r)}</Badge>)}</div>
      </div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] sm:text-sm">
        <div /><div className="ui-eyebrow">{t('This application', 'यह आवेदन')}</div><div className="ui-eyebrow">{t('Existing student', 'मौजूदा छात्र')}</div>
        {rows(m).map((row) => <div key={row.label} className="contents">
          <div className="ui-muted">{row.label}</div>
          <div className="break-words" style={{ fontWeight: row.eq ? 400 : 650 }}>{row.a || '—'}</div>
          <div className="break-words" style={{ color: row.eq ? 'var(--ok, #2f8f5b)' : 'var(--bad, #c0392b)' }}>{row.eq ? '✓ ' : '✗ '}{row.b || '—'}</div>
        </div>)}
      </div>
      <div className="text-xs ui-muted">{m.internship_topic || ''} · {new Date(m.created_at).toLocaleDateString('en-IN')}</div>
    </div>)}
  </div>;
}
