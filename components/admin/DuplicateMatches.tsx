'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui';
import { useCopy } from '@/components/help/i18n';
import type { DuplicateMatch, DuplicateReason } from '@/lib/duplicates';

export default function DuplicateMatches({ applicationId }: { applicationId: string }) {
  const t = useCopy();
  const [matches, setMatches] = useState<DuplicateMatch[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/submissions/${applicationId}/duplicates`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (live) setMatches(d.matches); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [applicationId]);

  const reason = (r: DuplicateReason) => ({
    phone: t('Same phone', 'वही फ़ोन'), email: t('Same email', 'वही ईमेल'), roll: t('Same roll number', 'वही रोल नंबर'),
    name_father: t('Same name + father', 'वही नाम + पिता'), name_dob: t('Same name + birth date', 'वही नाम + जन्मतिथि'),
  })[r];

  if (failed) return <p className="ui-muted">{t('Could not check for duplicates.', 'डुप्लिकेट जाँच नहीं हो पाई।')}</p>;
  if (!matches) return <p className="ui-muted">{t('Checking for duplicates…', 'डुप्लिकेट जाँच रहे हैं…')}</p>;
  if (!matches.length) return <p className="ui-muted">{t('No matching student found. This looks like a new applicant.', 'कोई मिलता-जुलता छात्र नहीं मिला। यह नया आवेदक लगता है।')}</p>;

  return <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--warn-soft, #fff7e6)', border: '1px solid var(--warn, #f59e0b)' }}>
    <h4 className="font-semibold">{t(`Possible duplicate (${matches.length})`, `संभावित डुप्लिकेट (${matches.length})`)}</h4>
    <p className="text-sm">{t('This student may already be registered. Call them, and ask them to sign in with the phone number from their college and their university roll number.', 'यह छात्र पहले से रजिस्टर्ड हो सकता है। उन्हें फ़ोन करें और कहें कि कॉलेज वाले मोबाइल नंबर और यूनिवर्सिटी रोल नंबर से लॉगिन करें।')}</p>
    <div className="space-y-2 sm:hidden">{matches.map((m) => <div key={m.id} className="rounded-lg bg-white p-3 text-sm space-y-1" style={{ border: '1px solid var(--line)' }}>
      <div className="flex items-start justify-between gap-2"><strong className="min-w-0 break-words">{m.student_name}</strong><Badge tone={m.approval_status === 'approved' ? 'ok' : m.approval_status === 'rejected' ? 'bad' : 'warn'}>{m.approval_status === 'approved' ? t('Approved', 'मंज़ूर') : m.approval_status === 'rejected' ? t('Rejected', 'नामंज़ूर') : t('Pending', 'बाकी')}</Badge></div>
      <div className="ui-muted">{t('Father', 'पिता')}: {m.father_name}</div>
      <div className="tnum break-all"><a className="ui-link" href={`tel:${m.contact_number}`}>{m.contact_number}</a></div>
      <div className="break-all">{m.email_address}</div>
      <div className="ui-muted break-all">{t('Roll no.', 'रोल नंबर')}: {m.university_roll_number} · {m.college_name || '—'}</div>
      <div className="flex flex-wrap gap-1">{m.reasons.map((r) => <Badge key={r} tone={m.level === 'exact' ? 'bad' : 'warn'}>{reason(r)}</Badge>)}</div>
    </div>)}</div>
    <div className="hidden overflow-x-auto sm:block"><table className="w-full text-sm"><thead><tr className="text-left">
      {[t('Name', 'नाम'), t("Father", 'पिता'), t('Phone', 'फ़ोन'), t('Email', 'ईमेल'), t('Roll no.', 'रोल नंबर'), t('College', 'कॉलेज'), t('Status', 'स्थिति'), t('Why flagged', 'कारण')].map((h) => <th key={h} className="pr-3 py-1 font-medium">{h}</th>)}
    </tr></thead><tbody>{matches.map((m) => <tr key={m.id} className="align-top border-t">
      <td className="pr-3 py-2">{m.student_name}</td><td className="pr-3 py-2">{m.father_name}</td><td className="pr-3 py-2 tnum">{m.contact_number}</td>
      <td className="pr-3 py-2 break-all">{m.email_address}</td><td className="pr-3 py-2 tnum">{m.university_roll_number}</td><td className="pr-3 py-2">{m.college_name || '—'}</td>
      <td className="pr-3 py-2"><Badge tone={m.approval_status === 'approved' ? 'ok' : m.approval_status === 'rejected' ? 'bad' : 'warn'}>{m.approval_status === 'approved' ? t('Approved', 'मंज़ूर') : m.approval_status === 'rejected' ? t('Rejected', 'नामंज़ूर') : t('Pending', 'बाकी')}</Badge></td>
      <td className="pr-3 py-2"><div className="flex flex-wrap gap-1">{m.reasons.map((r) => <Badge key={r} tone={m.level === 'exact' ? 'bad' : 'warn'}>{reason(r)}</Badge>)}</div></td>
    </tr>)}</tbody></table></div>
  </div>;
}
