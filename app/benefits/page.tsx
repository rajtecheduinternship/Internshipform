'use client';

import Link from 'next/link';
import PublicNavbar from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import NewsTicker from '@/components/layout/NewsTicker';
import { useCopy } from '@/components/help/i18n';
import { Icon, IconName } from '@/components/icons';

export default function BenefitsPage() {
  const t = useCopy();
  const benefits: { icon: IconName; title: string; text: string }[] = [
    { icon: 'play', title: t('Learn at your own pace', 'अपने समय पर सीखें'), text: t('Open recorded lessons on your phone or computer. Come back to a topic when you need another look.', 'रिकॉर्ड किए हुए पाठ मोबाइल या कंप्यूटर पर देखें। ज़रूरत हो तो किसी विषय को फिर से देखें।') },
    { icon: 'chart', title: t('Know where you stand', 'जानें, आप कहाँ तक पहुँचे'), text: t('See completed lessons, watched time, and what to learn next in your student portal.', 'छात्र पेज पर पूरे हुए पाठ, देखने का समय और अगला पाठ देखें।') },
    { icon: 'message', title: t('Get help in your language', 'अपनी भाषा में मदद लें'), text: t('Use Hindi or English for the interface and your questions. Ask your teacher below any lesson.', 'हिन्दी या अंग्रेज़ी में पेज इस्तेमाल करें और सवाल पूछें। हर पाठ के नीचे शिक्षक से पूछ सकते हैं।') },
    { icon: 'file', title: t('Build practical skills', 'काम के हुनर सीखें'), text: t('Learn tools used for documents, office work, accounts, and everyday digital tasks.', 'दस्तावेज़, ऑफ़िस, हिसाब-किताब और रोज़ के डिजिटल कामों में इस्तेमाल होने वाले टूल सीखें।') },
    { icon: 'award', title: t('A certificate you can verify', 'जाँचा जा सकने वाला प्रमाणपत्र'), text: t('Issued certificates include a QR code and serial number for online verification. Ask your coordinator about completion requirements.', 'जारी किए गए प्रमाणपत्र में ऑनलाइन जाँच के लिए QR कोड और क्रम संख्या होती है। पूरा करने की शर्तें अपने शिक्षक से पूछें।') },
    { icon: 'user', title: t('Take your next step with confidence', 'आत्मविश्वास के साथ आगे बढ़ें'), text: t('Use what you learn in college projects, everyday work, and your next learning opportunity.', 'सीखे हुए हुनर को कॉलेज प्रोजेक्ट, रोज़ के काम और आगे की पढ़ाई में इस्तेमाल करें।') },
  ];
  return <div className="ui-page public-page"><PublicNavbar /><NewsTicker /><main className="portal-main space-y-8"><div className="page-heading"><div><div className="ui-eyebrow">{t('WHY LEARN WITH RAJTECH', 'राजटेक के साथ क्यों सीखें')}</div><h1>{t('A learning experience that helps you move forward.', 'ऐसी पढ़ाई जो आपको आगे बढ़ने में मदद करे।')}</h1><p>{t('Useful lessons, a clear path, and help when you need it.', 'काम के पाठ, साफ़ रास्ता और ज़रूरत पर मदद।')}</p></div></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{benefits.map((benefit, i) => <section key={benefit.title} className="ui-card ui-card-pad public-info-card"><span className={`stat-icon ${i % 3 === 0 ? 'teal' : i % 3 === 1 ? 'orange' : 'violet'}`}><Icon name={benefit.icon} size={23} /></span><h2 className="ui-h2 mt-5">{benefit.title}</h2><p className="ui-muted mt-3">{benefit.text}</p></section>)}</div><section className="public-support !m-0"><div><h2>{t('Choose what you want to learn.', 'चुनें, आप क्या सीखना चाहते हैं।')}</h2><p>{t('Browse the course outlines, then ask our team which course is right for your internship.', 'कोर्स की जानकारी देखें। फिर हमारी टीम से पूछें कि आपकी इंटर्नशिप के लिए कौन सा कोर्स सही है।')}</p></div><Link href="/courses" className="ui-btn ui-btn-primary">{t('Explore courses', 'कोर्स देखें')}<Icon name="arrow" size={17} /></Link></section></main><Footer /></div>;
}
