'use client';

import { BusyText } from '@/components/LoadingState';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LangToggle, useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';
import { ErrorNote } from '@/components/ui';

export default function StudentLoginPage() {
  const t = useCopy();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<'phone' | 'password' | 'login' | 'network' | 'pending' | 'rejected' | null>(null);
  const errors = {
    pending: t('Your application is waiting for admin approval. You can sign in only after the admin approves it.', 'आपके आवेदन की मंज़ूरी बाकी है। एडमिन की मंज़ूरी के बाद ही आप लॉगिन कर सकते हैं।'),
    rejected: t('Your application was not approved. Please contact the internship team if you need help.', 'आपका आवेदन मंज़ूर नहीं हुआ है। मदद के लिए इंटर्नशिप टीम से संपर्क करें।'),
    phone: t('Enter the 10-digit phone number from your application.', 'फॉर्म में दिया गया 10 अंकों का मोबाइल नंबर लिखें।'),
    password: t('Enter your password. First time? Use your college roll number.', 'अपना पासवर्ड लिखें। पहली बार? कॉलेज का रोल नंबर डालें।'),
    login: t('We could not sign you in. Please check the two steps below.', 'लॉगिन नहीं हो पाया। कृपया नीचे के दो स्टेप जाँचें।'),
    network: t('Could not connect. Check your internet and try again.', 'कनेक्शन नहीं हुआ। इंटरनेट जाँचें और फिर कोशिश करें।'),
  };
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.trim())) { setError('phone'); return; }
    if (!password.trim()) { setError('password'); return; }
    setIsLoading(true); setError(null);
    try {
      const res = await fetch('/api/portal/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim(), password: password.trim() }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.code === 'APPLICATION_PENDING' ? 'pending' : data.code === 'APPLICATION_REJECTED' ? 'rejected' : 'login'); return; }
      router.push('/portal/videos');
    } catch { setError('network'); }
    finally { setIsLoading(false); }
  }

  return (
    <div className="auth-page ui-page">
      <aside className="auth-story">
        <Link href="/" className="portal-brand"><span className="brand-logo"><Image src="/logo.png" alt="" width={34} height={34} /></span><span><strong>RAJTECH<span className="brand-dot">.</span></strong><small>TECHNOLOGICAL SYSTEMS</small></span></Link>
        <div><div className="hero-label">{t('LEARN TODAY. LEAD TOMORROW.', 'आज सीखें। कल आगे बढ़ें।')}</div><h1>{t('Your next chapter ', 'आपकी नई शुरुआत ')}<br /><span>{t('starts with you.', 'आपसे ही होगी।')}</span></h1><p>{t('Practical skills. Helpful teachers. A learning space that’s yours.', 'काम आने वाले हुनर। मदद करने वाले शिक्षक। सीखने की अपनी जगह।')}</p><ol className="auth-steps"><li><span>01</span>{t('Sign in with your phone number', 'अपने मोबाइल नंबर से लॉगिन करें')}</li><li><span>02</span>{t('Learn one lesson at a time', 'एक-एक पाठ समझते हुए सीखें')}</li><li><span>03</span>{t('See yourself make progress', 'अपनी प्रगति खुद देखें')}</li></ol></div>
        <div className="auth-story-footer">{t('For the students building their tomorrow.', 'उन छात्रों के लिए जो अपना कल बना रहे हैं।')}<br />Rajtech · Bihar, India</div>
      </aside>
      <main className="auth-form-panel">
        <div className="auth-top"><Link href="/">← {t('Back to website', 'वेबसाइट पर वापस')}</Link><LangToggle /></div>
        <div className="auth-form-wrap"><span className="stat-icon teal"><Icon name="book" size={24} /></span><h2>{t('Welcome to your space.', 'अपनी पढ़ाई में स्वागत है।')}</h2><p>{t('Approved students can sign in to start learning.', 'मंज़ूरी मिलने के बाद छात्र लॉगिन करके पढ़ाई शुरू कर सकते हैं।')}</p>
          {error && <div className="mt-5" id="login-error"><ErrorNote>{errors[error]}</ErrorNote></div>}
          {error === 'login' && <div className="auth-hint mt-3" role="note"><Icon name="help" size={17} /><span><strong>{t('How to sign in', 'लॉगिन कैसे करें')}</strong><br />1. {t('Mobile number: use the number you gave your college when you registered.', 'मोबाइल नंबर: वही नंबर डालें जो आपने रजिस्ट्रेशन के समय कॉलेज में दिया था।')}<br />2. {t('Password: your university roll number (the long number on your admit card). Capital or small letters both work.', 'पासवर्ड: आपका यूनिवर्सिटी रोल नंबर (एडमिट कार्ड वाला लंबा नंबर)। बड़े या छोटे अक्षर दोनों चलेंगे।')}<br />{t('Still stuck? ', 'फिर भी नहीं हो रहा? ')}<Link href="/enquiry" className="ui-link">{t('Ask our team', 'हमारी टीम से पूछें')}</Link></span></div>}
          <form onSubmit={handleLogin} className="space-y-5" aria-busy={isLoading}>
            <div><label className="ui-label" htmlFor="phone">{t('Mobile number', 'मोबाइल नंबर')}</label><input id="phone" type="tel" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder={t('Your 10-digit mobile number', 'अपना 10 अंकों का नंबर लिखें')} className="ui-field" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} aria-describedby={error === 'phone' ? 'login-error' : 'phone-hint'} aria-invalid={error === 'phone'} /><p id="phone-hint" className="ui-muted mt-2">{t('Use the mobile number you gave your college.', 'वही मोबाइल नंबर डालें जो आपने कॉलेज में दिया था।')}</p></div>
            <div><label className="ui-label" htmlFor="pw">{t('Password', 'पासवर्ड')}</label><div className="password-wrap"><input id="pw" type={showPassword ? 'text' : 'password'} required className="ui-field" autoComplete="current-password" placeholder={t('Enter your password', 'अपना पासवर्ड डालें')} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-hint" /><button type="button" className="icon-button" aria-pressed={showPassword} aria-label={showPassword ? t('Hide password', 'पासवर्ड छिपाएँ') : t('Show password', 'पासवर्ड दिखाएँ')} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={18} /></button></div></div>
            <div className="auth-hint" id="password-hint"><Icon name="help" size={17} /><span><strong>{t('First time here?', 'पहली बार आए हैं?')}</strong> {t('Mobile number = the number you gave your college. Password = your university roll number. Already registered? Do not fill the form again, just sign in.', 'मोबाइल नंबर = जो नंबर आपने कॉलेज में दिया था। पासवर्ड = आपका यूनिवर्सिटी रोल नंबर। पहले से रजिस्टर्ड हैं? फॉर्म दोबारा न भरें, सीधे लॉगिन करें।')}</span></div>
            <button type="submit" disabled={isLoading} className="ui-btn ui-btn-primary w-full">{isLoading ? <BusyText>{t('Signing in…', 'लॉगिन हो रहा है…')}</BusyText> : t('Sign in & start learning', 'लॉगिन करें और सीखें')}<Icon name="arrow" size={18} /></button>
          </form>
          <div className="auth-register">{t('New student, not registered yet?', 'नए छात्र, अभी रजिस्टर नहीं किया?')} <Link href="/apply">{t('Register here', 'यहाँ फॉर्म भरें')} →</Link></div>
        </div>
        <p className="auth-bottom">{t('Need help signing in?', 'लॉगिन में मदद चाहिए?')} <Link href="/enquiry" className="ui-link">{t('Contact our team', 'हमारी टीम से पूछें')}</Link></p>
      </main>
    </div>
  );
}
