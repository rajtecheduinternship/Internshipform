'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LangToggle, useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';

export default function PublicNavbar() {
  const t = useCopy();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const links = [
    { href: '/', label: t('Home', 'मुख्य पेज') },
    { href: '/about', label: t('The programme', 'कार्यक्रम के बारे में') },
    { href: '/courses', label: t('Courses', 'कोर्स') },
    { href: '/benefits', label: t('Why Rajtech', 'राजटेक क्यों') },
    { href: '/enquiry', label: t('Get help', 'मदद लें') },
  ];
  return (
    <header className="public-header">
      <div className="public-header-inner"><Link href="/" className="portal-brand"><span className="brand-logo"><Image src="/logo.png" alt="" width={34} height={34} /></span><span><strong>RAJTECH<span className="brand-dot">.</span></strong><small>{t('Skills for your next chapter', 'आगे बढ़ने के लिए नए हुनर')}</small></span></Link>
        <nav className="public-desktop-nav" aria-label={t('Main navigation', 'वेबसाइट नेविगेशन')}>{links.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</nav>
        <div className="public-header-actions"><LangToggle /><Link href="/portal/login" className="ui-btn ui-btn-sm public-signin">{t('Student sign in', 'छात्र लॉगिन')}<Icon name="arrow" size={16} /></Link><Link href="/apply" className="ui-btn ui-btn-primary ui-btn-sm public-register">{t('Register', 'फॉर्म भरें')}</Link><button className="icon-button public-menu-button" aria-controls="public-mobile-menu" aria-expanded={open} aria-label={open ? t('Close menu', 'मेन्यू बंद करें') : t('Open menu', 'मेन्यू खोलें')} onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} size={20} /></button></div>
      </div>
      {open && <nav id="public-mobile-menu" className="public-mobile-menu" aria-label={t('Main navigation', 'वेबसाइट नेविगेशन')}>{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}<Icon name="chevron" size={17} /></Link>)}<div className="flex gap-3 pt-3"><Link onClick={() => setOpen(false)} href="/portal/login" className="ui-btn flex-1">{t('Student sign in', 'छात्र लॉगिन')}</Link><Link onClick={() => setOpen(false)} href="/apply" className="ui-btn ui-btn-primary flex-1">{t('Register', 'फॉर्म भरें')}</Link></div></nav>}
    </header>
  );
}
