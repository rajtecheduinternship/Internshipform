'use client';

import { BusyText } from '@/components/LoadingState';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PublicNavbar from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';
import { COLLEGES } from '@/lib/types';

export default function EnquiryPage() {
  const t = useCopy();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    college: '',
    courseInterest: '',
    message: '',
  });
  const [courseTitles, setCourseTitles] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/courses')
      .then((r) => r.json())
      .then((d) => setCourseTitles((d.courses || []).map((c: { title: string }) => c.title)))
      .catch(() => setCourseTitles([]));
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setStatus({ type: 'error', message: t('Please fill in the fields marked *.', 'कृपया * वाले सभी खाने भरें।') });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          college: formData.college,
          course_interest: formData.courseInterest,
          message: formData.message,
        }),
      });

      if (res.ok) {
        setStatus({
          type: 'success',
          message: t('Your message has been received. Our internship team will contact you.', 'आपका संदेश मिल गया। हमारी इंटर्नशिप टीम आपसे संपर्क करेगी।'),
        });
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          college: '',
          courseInterest: '',
          message: '',
        });
      } else {
        const data = await res.json();
        setStatus({ type: 'error', message: data.error || t('Could not send your message. Please try again.', 'संदेश नहीं भेज पाए। फिर कोशिश करें।') });
      }
    } catch {
      setStatus({ type: 'error', message: t('Check your internet and try again.', 'इंटरनेट जाँचें और फिर कोशिश करें।') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ui-page public-page"><PublicNavbar /><main className="portal-main">
      <div className="page-heading"><div><div className="ui-eyebrow">{t('WE’RE HERE TO HELP', 'हम आपकी मदद के लिए हैं')}</div><h1>{t('Let’s find your next step.', 'आइए, आपका अगला कदम समझें।')}</h1><p>{t('Ask about courses, fees, your application, or signing in. Write in Hindi or English.', 'कोर्स, फ़ीस, फॉर्म या लॉगिन के बारे में पूछें। हिन्दी या अंग्रेज़ी में लिख सकते हैं।')}</p></div></div>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="ui-card ui-card-pad">
          {status && <p role={status.type === 'error' ? 'alert' : 'status'} className="rounded-xl p-4 mb-5 text-sm" style={{ background: status.type === 'success' ? 'var(--ok-soft)' : 'var(--bad-soft)', color: status.type === 'success' ? 'var(--ok)' : 'var(--bad)' }}>{status.message}</p>}
          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isSubmitting}>
            <p className="ui-muted">{t('Fields marked * are required.', '* वाले खाने भरना ज़रूरी है।')}</p>
            <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="enquiry-name" className="ui-label">{t('Your full name', 'आपका पूरा नाम')} *</label><input id="enquiry-name" className="ui-field" required autoComplete="name" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div><div><label htmlFor="enquiry-email" className="ui-label">{t('Email address', 'ईमेल पता')} *</label><input id="enquiry-email" type="email" className="ui-field" required autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="enquiry-phone" className="ui-label">{t('Mobile number', 'मोबाइल नंबर')} *</label><input id="enquiry-phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required autoComplete="tel-national" className="ui-field" placeholder={t('10-digit mobile number', '10 अंकों का मोबाइल नंबर')} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} /></div><div><label htmlFor="enquiry-college" className="ui-label">{t('College (optional)', 'कॉलेज (ज़रूरी नहीं)')}</label><select id="enquiry-college" className="ui-field" value={formData.college} onChange={(e) => setFormData({ ...formData, college: e.target.value })}><option value="">{t('Choose your college', 'अपना कॉलेज चुनें')}</option>{COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div></div>
            <div><label htmlFor="enquiry-course" className="ui-label">{t('Course you’re interested in (optional)', 'आपकी पसंद का कोर्स (ज़रूरी नहीं)')}</label><select id="enquiry-course" className="ui-field" value={formData.courseInterest} onChange={(e) => setFormData({ ...formData, courseInterest: e.target.value })}><option value="">{t('Not sure yet — help me choose', 'अभी तय नहीं है — चुनने में मदद चाहिए')}</option>{courseTitles.map((title) => <option key={title} value={title}>{title}</option>)}</select></div>
            <div><label htmlFor="enquiry-message" className="ui-label">{t('What would you like to ask? (optional)', 'आप क्या पूछना चाहते हैं? (ज़रूरी नहीं)')}</label><textarea id="enquiry-message" rows={4} maxLength={2000} className="ui-field" placeholder={t('Tell us what you need help with…', 'बताइए, किस बात में मदद चाहिए…')} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} /></div>
            <button disabled={isSubmitting} className="ui-btn ui-btn-primary">{isSubmitting ? <BusyText>{t('Sending…', 'भेज रहे हैं…')}</BusyText> : t('Send my question', 'मेरा सवाल भेजें')}<Icon name="arrow" size={17} /></button>
          </form>
        </section><aside className="space-y-5"><div className="help-card"><span className="stat-icon orange"><Icon name="message" /></span><h2>{t('Prefer to talk?', 'बात करना चाहेंगे?')}</h2><p>{t('Call our team for help with your internship.', 'इंटर्नशिप में मदद के लिए हमारी टीम को कॉल करें।')}</p><a href="tel:+919931005560" className="ui-link">+91 9931005560</a></div><div className="ui-card ui-card-pad"><h2 className="ui-h2">{t('Already registered?', 'फॉर्म भर चुके हैं?')}</h2><p className="ui-muted mt-2">{t('Sign in with your phone number. Your first password is your college roll number.', 'अपने मोबाइल नंबर से लॉगिन करें। पहला पासवर्ड कॉलेज का रोल नंबर है।')}</p><Link href="/portal/login" className="ui-link block mt-4">{t('Go to student sign in', 'छात्र लॉगिन पर जाएँ')} →</Link></div></aside>
      </div>
    </main><Footer /></div>
  );
}
