'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCopy } from '@/components/help/i18n';

export default function Footer() {
  const t = useCopy();
  return (
    <footer className="public-footer"><div className="public-footer-grid">
      <div><Link href="/" className="portal-brand"><span className="brand-logo"><Image src="/logo.png" alt="" width={32} height={32} /></span><span><strong>RAJTECH<span className="brand-dot">.</span></strong><small>Technological System Pvt. Ltd.</small></span></Link><p>{t('Practical learning for students ready to take their next step.', 'उन छात्रों के लिए काम आने वाली पढ़ाई, जो अगला कदम बढ़ाना चाहते हैं।')}</p><p>{t('Nalanda / Patna, Bihar, India', 'नालंदा / पटना, बिहार, भारत')}</p></div>
      <div><h2>{t('Find your way', 'ज़रूरी पेज')}</h2><Link href="/about">{t('About the internship', 'इंटर्नशिप के बारे में')}</Link><Link href="/courses">{t('Courses & syllabus', 'कोर्स और पाठ्यक्रम')}</Link><Link href="/benefits">{t('Why learn with us', 'हमारे साथ क्यों सीखें')}</Link><Link href="/apply">{t('Apply for the internship', 'इंटर्नशिप का फॉर्म भरें')}</Link></div>
      <div><h2>{t('Your learning space', 'आपकी पढ़ाई की जगह')}</h2><Link href="/portal/login">{t('Student sign in', 'छात्र लॉगिन')}</Link><Link href="/portal/videos">{t('My learning', 'मेरी पढ़ाई')}</Link><Link href="/portal/profile">{t('My progress', 'मेरी प्रगति')}</Link><Link href="/enquiry">{t('Ask us a question', 'हमसे सवाल पूछें')}</Link></div>
      <div><h2>{t('Talk to our team', 'हमारी टीम से बात करें')}</h2><a href="tel:+919931005560">+91 9931005560</a><a href="tel:+918986996208">+91 8986996208</a><a href="mailto:rtseducationintern@gmail.com" className="break-all">rtseducationintern@gmail.com</a><Link href="/enquiry" className="footer-contact">{t('Send an enquiry', 'पूछताछ भेजें')} →</Link></div>
    </div><div className="public-footer-bottom"><span>© {new Date().getFullYear()} Rajtech Technological System Pvt. Ltd.</span><span>{t('Made for learning. Made for you.', 'सीखने के लिए। आपके लिए।')}<Link href="/admin">{t('Admin', 'एडमिन')}</Link></span></div></footer>
  );
}
