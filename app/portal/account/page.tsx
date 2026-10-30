'use client';

import { useState } from 'react';
import StudentNavbar from '@/components/layout/StudentNavbar';
import PortalFooter from '@/components/layout/PortalFooter';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';
import { useStudent } from '@/hooks/useStudent';

export default function AccountPage() {
  const student = useStudent();
  const t = useCopy();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (next.length < 8) return setStatus({ ok: false, text: t('New password must be at least 8 characters.', 'नया पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।') });
    if (next !== confirm) return setStatus({ ok: false, text: t('New password and confirmation do not match.', 'दोनों जगह लिखा नया पासवर्ड अलग है। एक जैसा पासवर्ड लिखें।') });

    setBusy(true);
    try {
      const res = await fetch('/api/portal/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ ok: true, text: t('Password changed. You were signed out on all other devices.', 'पासवर्ड बदल गया। बाकी सभी डिवाइस से आप लॉगआउट हो गए हैं।') });
        setCurrent(''); setNext(''); setConfirm('');
      } else {
        setStatus({ ok: false, text: data.error || t('Could not change password.', 'पासवर्ड नहीं बदल पाया। फिर कोशिश करें।') });
      }
    } catch {
      setStatus({ ok: false, text: t('Network error. Please try again.', 'इंटरनेट जाँचें और फिर कोशिश करें।') });
    } finally {
      setBusy(false);
    }
  }

  const field = 'ui-field';

  return (
    <div className="ui-page student-page flex flex-col">
      <StudentNavbar />
      <main id="main-content" tabIndex={-1} className="portal-main">
        <div className="page-heading"><div><div className="ui-eyebrow">{t('YOUR DETAILS, YOUR CONTROL', 'आपकी जानकारी, आपका खाता')}</div><h1>{t('Make yourself at home.', 'अपना खाता सँभालें।')}</h1><p>{t('Check your details and keep your password safe.', 'अपनी जानकारी देखें और पासवर्ड सुरक्षित रखें।')}</p></div></div>
        <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,26rem)]">
          <section className="ui-card ui-card-pad">
            <div className="account-avatar">{student?.full_name.charAt(0) || <Icon name="user" size={28} />}</div><div className="ui-eyebrow">{t('Student account', 'छात्र खाता')}</div>
            <h1 className="ui-h1" style={{ marginTop: 2 }}>{student?.full_name || '…'}</h1>
            <dl className="account-details">
              <div><dt className="ui-eyebrow">{t('User ID', 'मोबाइल नंबर')}</dt><dd className="tnum">{student?.phone}</dd></div>
              <div><dt className="ui-eyebrow">{t('Email', 'ईमेल')}</dt><dd className="truncate">{student?.email}</dd></div>
            </dl>
          </section>

          <section className="ui-card ui-card-pad">
            <h2 className="ui-h2">{t('Change password', 'पासवर्ड बदलें')}</h2>
            <p className="ui-muted" style={{ marginTop: 4 }}>{t('Your first password is your roll number. Choose your own to keep your account safe.', 'आपका पहला पासवर्ड रोल नंबर है। खाता सुरक्षित रखने के लिए अपना नया पासवर्ड बनाएँ।')}</p>
            {status && (
              <div role="status" className="mt-4" style={{ borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                background: status.ok ? 'var(--ok-soft)' : 'var(--bad-soft)', color: status.ok ? 'var(--ok)' : 'var(--bad)' }}>{status.text}</div>
            )}
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div><label className="ui-label" htmlFor="cur">{t('Current password', 'अभी का पासवर्ड')}</label>
                <input id="cur" type="password" required autoComplete="current-password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
              <div><label className="ui-label" htmlFor="new">{t('New password', 'नया पासवर्ड')}</label>
                <input id="new" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} />
                <div className="ui-muted" style={{ marginTop: 2 }}>{t('At least 8 characters.', 'कम से कम 8 अक्षर लिखें।')}</div></div>
              <div><label className="ui-label" htmlFor="conf">{t('Confirm new password', 'नया पासवर्ड फिर लिखें')}</label>
                <input id="conf" type="password" required autoComplete="new-password" className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              <button disabled={busy} className="ui-btn ui-btn-primary w-full">{busy ? t('Saving…', 'सेव हो रहा है…') : t('Update password', 'पासवर्ड बदलें')}</button>
            </form>
          </section>
        </div>
      </main>
      <PortalFooter />
    </div>
  );
}
