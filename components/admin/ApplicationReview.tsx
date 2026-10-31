'use client';

import { BusyText } from '@/components/LoadingState';

import { useState } from 'react';
import type { ApprovalStatus } from '@/lib/db';
import { Badge, ConfirmDialog, ErrorNote } from '@/components/ui';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';

export function ApplicationStatus({ status }: { status?: ApprovalStatus }) {
  const t = useCopy();
  return <Badge tone={status === 'approved' ? 'ok' : status === 'rejected' ? 'bad' : 'warn'}>{status === 'approved' ? t('Approved', 'मंज़ूर') : status === 'rejected' ? t('Rejected', 'नामंज़ूर') : t('Pending review', 'मंज़ूरी बाकी')}</Badge>;
}

export default function ApplicationReview({ application, onReviewed }: {
  application: { id: string; student_name: string; approval_status?: ApprovalStatus; review_note?: string | null; reviewed_at?: string | null };
  onReviewed: (update: { approval_status: ApprovalStatus; review_note: string | null; reviewed_at: string }) => void;
}) {
  const t = useCopy();
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!decision) return;
    const chosen = decision;
    setDecision(null); setBusy(true); setError(''); setSaved(false);
    try {
      const res = await fetch(`/api/admin/submissions/${application.id}/review`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: chosen, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(res.status === 409 ? t('This application could not be approved. Check that its course is published and its contact details do not belong to another account.', 'मंज़ूरी नहीं मिल पाई। कोर्स प्रकाशित है या नहीं और यही संपर्क जानकारी किसी दूसरे खाते में तो नहीं है, यह जाँचें।') : t('Could not save the decision. Please try again.', 'फ़ैसला सेव नहीं हुआ। फिर कोशिश करें।')); return; }
      onReviewed({ approval_status: data.review.approval_status, review_note: note.trim() || null, reviewed_at: new Date().toISOString() });
      setSaved(true); setNote('');
    } catch { setError(t('Check your connection and try again.', 'इंटरनेट जाँचें और फिर कोशिश करें।')); }
    finally { setBusy(false); }
  }

  return <section className="ui-card ui-card-pad space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="ui-h2">{t('Admission decision', 'प्रवेश का फ़ैसला')}</h3><ApplicationStatus status={application.approval_status} /></div>
    <p className="ui-muted">{application.approval_status === 'approved' ? t('Portal access is enabled. Rejecting this application will revoke access, including existing sessions.', 'छात्र पेज का प्रवेश चालू है। आवेदन नामंज़ूर करने पर प्रवेश बंद होगा और चल रहे लॉगिन भी काम नहीं करेंगे।') : t('This student cannot use the learning portal until you approve this application. Approval creates their account for the assigned course.', 'आपकी मंज़ूरी के बिना यह छात्र पढ़ाई का पेज इस्तेमाल नहीं कर सकता। मंज़ूरी पर तय कोर्स के लिए उसका खाता बनेगा।')}</p>
    {application.review_note && <p className="ui-muted whitespace-pre-wrap"><strong>{t('Review note:', 'फ़ैसले का नोट:')}</strong> {application.review_note}</p>}
    {application.reviewed_at && <p className="ui-muted">{t('Last reviewed:', 'आख़िरी जाँच:')} {new Date(application.reviewed_at).toLocaleString('en-IN')}</p>}
    {error && <ErrorNote>{error}</ErrorNote>}
    {saved && <p role="status" className="text-sm" style={{ color: 'var(--ok)' }}>{t('Decision saved.', 'फ़ैसला सेव हो गया।')}</p>}
    <div className="flex flex-wrap gap-3">{application.approval_status !== 'approved' && <button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => { setNote(''); setDecision('approved'); }}><Icon name="check" size={17} />{busy ? <BusyText>{t('Saving…', 'सेव हो रहा है…')}</BusyText> : t('Approve & enable access', 'मंज़ूर करें और प्रवेश दें')}</button>}{application.approval_status !== 'rejected' && <button className="ui-btn ui-btn-danger" disabled={busy} onClick={() => { setNote(''); setDecision('rejected'); }}><Icon name="close" size={17} />{busy ? <BusyText>{t('Saving…', 'सेव हो रहा है…')}</BusyText> : application.approval_status === 'approved' ? t('Reject & revoke access', 'नामंज़ूर करें और प्रवेश रोकें') : t('Reject application', 'आवेदन नामंज़ूर करें')}</button>}</div>
    {decision && <ConfirmDialog tone={decision === 'approved' ? 'brand' : 'danger'} title={decision === 'approved' ? t('Approve this student?', 'इस छात्र को मंज़ूरी दें?') : t('Reject this application?', 'यह आवेदन नामंज़ूर करें?')} body={<><p>{decision === 'approved' ? t(`${application.student_name} will be allowed to sign in and learn in their assigned course.`, `${application.student_name} अपने तय कोर्स में लॉगिन करके पढ़ सकेंगे।`) : t(`${application.student_name} will not be able to sign in or access course content. Existing access will be revoked.`, `${application.student_name} लॉगिन या पाठ नहीं देख सकेंगे। पहले से मिला प्रवेश भी बंद हो जाएगा।`)}</p><label htmlFor="application-review-note" className="ui-label mt-4">{t('Internal review note (optional)', 'अंदरूनी नोट (ज़रूरी नहीं)')}</label><textarea id="application-review-note" className="ui-field" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></>} confirmLabel={decision === 'approved' ? t('Approve student', 'छात्र को मंज़ूरी दें') : t('Reject application', 'आवेदन नामंज़ूर करें')} onCancel={() => setDecision(null)} onConfirm={save} />}
  </section>;
}
