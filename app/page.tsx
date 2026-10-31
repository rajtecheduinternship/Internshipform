'use client';

import Link from 'next/link';
import PublicNavbar from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import NoticeBoard from '@/components/home/NoticeBoard';
import { useCopy } from '@/components/help/i18n';
import { Icon, IconName } from '@/components/icons';

export default function HomePage() {
  const t = useCopy();
  const tracks: { icon: IconName; title: string; description: string; tag: string }[] = [
    { icon: 'file', title: t('Office & digital skills', 'ऑफ़िस और डिजिटल हुनर'), description: t('Work confidently with documents, spreadsheets, presentations, and everyday computer tools.', 'दस्तावेज़, स्प्रेडशीट, प्रेज़ेंटेशन और रोज़मर्रा के कंप्यूटर काम सीखें।'), tag: t('Build your foundation', 'मज़बूत शुरुआत') },
    { icon: 'grid', title: t('AI & practical projects', 'AI और काम करके सीखना'), description: t('Understand AI tools and put them to work on useful, practical tasks.', 'AI टूल समझें और असली कामों में उनका इस्तेमाल करना सीखें।'), tag: t('Explore something new', 'कुछ नया सीखें') },
    { icon: 'chart', title: t('Tally & GST', 'टैली और GST'), description: t('Learn the basics of accounts, business entries, and working with Tally.', 'हिसाब-किताब, व्यापार की एंट्री और टैली पर काम करने की बुनियाद सीखें।'), tag: t('Skills for the workplace', 'काम में आने वाला हुनर') },
    { icon: 'lock', title: t('IT & online safety', 'कंप्यूटर और ऑनलाइन सुरक्षा'), description: t('Get comfortable with computers, the internet, and safer digital habits.', 'कंप्यूटर और इंटरनेट चलाना सीखें। ऑनलाइन सुरक्षित रहने की आदतें जानें।'), tag: t('Learn with confidence', 'भरोसे के साथ सीखें') },
  ];
  return (
    <div className="ui-page public-page"><PublicNavbar />
      <main>
        <section className="public-hero"><div className="public-hero-copy"><span className="public-kicker"><span className="status-dot" />{t('YOUR NEXT STEP STARTS HERE', 'आपका अगला कदम यहीं से शुरू होता है')}</span><span className="home-hindi-highlight" lang="hi">सीखें। आगे बढ़ें।</span><h1>{t('Practical skills.', 'काम आने वाले हुनर।')}<br /><span>{t('A confident you.', 'आत्मविश्वास से भरे आप।')}</span></h1><p>{t('Make your internship a chance to learn something useful. Watch clear lessons, practise new skills, and get help in Hindi or English.', 'इंटर्नशिप में कुछ काम का सीखें। आसान पाठ देखें, नए हुनर का अभ्यास करें और हिन्दी या अंग्रेज़ी में मदद लें।')}</p><div className="public-hero-actions"><Link href="/portal/login" className="ui-btn ui-btn-primary">{t('Student sign in · Start your course', 'छात्र लॉगिन · अपना कोर्स शुरू करें')}<Icon name="arrow" size={18} /></Link><Link href="/courses" className="ui-btn">{t('Explore courses', 'कोर्स देखें')}</Link></div><div className="public-hero-notes"><span><Icon name="check" size={16} />{t('Learn on your phone', 'मोबाइल पर सीखें')}</span><span><Icon name="check" size={16} />{t('Hindi & English help', 'हिन्दी और अंग्रेज़ी में मदद')}</span><span><Icon name="check" size={16} />{t('Your progress, saved', 'आपकी प्रगति सेव रहेगी')}</span></div></div>
          <NoticeBoard />
        </section>
        <section className="public-tracks"><div className="section-heading"><div><div className="ui-eyebrow">{t('LEARN SOMETHING YOU CAN USE', 'कुछ ऐसा सीखें जो काम आए')}</div><h2>{t('Find a path that interests you.', 'अपनी पसंद का रास्ता चुनें।')}</h2></div><Link href="/courses" className="ui-link">{t('View the syllabus', 'पूरा पाठ्यक्रम देखें')} →</Link></div><div className="public-track-grid">{tracks.map((track, i) => <Link key={track.title} className="public-track-card" href="/courses"><span className={`stat-icon ${i % 3 === 0 ? 'teal' : i % 3 === 1 ? 'orange' : 'violet'}`}><Icon name={track.icon} size={23} /></span><small>{track.tag}</small><h3>{track.title}</h3><p>{track.description}</p><span className="ui-link flex items-center gap-2 mt-auto pt-5">{t('See what you’ll learn', 'क्या सीखेंगे, देखें')}<Icon name="arrow" size={16} /></span></Link>)}</div></section>
        <section className="public-support"><div><div className="ui-eyebrow">{t('A LITTLE HELP MAKES A BIG DIFFERENCE', 'थोड़ी मदद, बड़ा फ़र्क')}</div><h2>{t('Not sure what to do next?', 'अगला कदम समझ नहीं आ रहा?')}</h2><p>{t('Questions about courses, your application, or signing in? Our team can help you find your next step.', 'कोर्स, फॉर्म या लॉगिन के बारे में सवाल है? हमारी टीम आपको अगला कदम समझने में मदद करेगी।')}</p></div><Link href="/enquiry" className="ui-btn ui-btn-primary"><Icon name="message" size={18} />{t('Talk to our team', 'हमारी टीम से पूछें')}</Link></section>
      </main><Footer />
    </div>
  );
}
