'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { StudentProfile } from '@/hooks/useStudent';
import Walkthrough from '@/components/help/Walkthrough';
import { LangToggle, useCopy } from '@/components/help/i18n';
import { Icon, IconName } from '@/components/icons';

export default function StudentNavbar() {
  const t = useCopy();
  const pathname = usePathname();
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/portal/me').then((res) => res.ok ? res.json() : null)
      .then((data) => { if (active) setStudent(data?.profile ?? null); }).catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);

  async function handleLogout() {
    setSigningOut(true); setError(false);
    try {
      const res = await fetch('/api/portal/logout', { method: 'POST' });
      if (!res.ok) throw new Error('logout');
      setStudent(null); router.push('/portal/login');
    } catch { setError(true); setSigningOut(false); }
  }

  const links: { href: string; label: string; icon: IconName; active: boolean }[] = [
    { href: '/portal/videos', label: t('My learning', 'मेरी पढ़ाई'), icon: 'book', active: pathname.startsWith('/portal/videos') || pathname.startsWith('/portal/watch') },
    { href: '/portal/profile', label: t('My progress', 'मेरी प्रगति'), icon: 'chart', active: pathname === '/portal/profile' },
    { href: '/portal/account', label: t('My account', 'मेरा खाता'), icon: 'user', active: pathname === '/portal/account' },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">{t('Skip to content', 'मुख्य जानकारी पर जाएँ')}</a>
      <header className="student-header">
        <div className="student-header-inner">
          <Link href="/portal/videos" className="portal-brand">
            <span className="brand-logo"><Image src="/logo.png" alt="" width={34} height={34} /></span>
            <span><strong>RAJTECH<span className="brand-dot">.</span></strong><small>{t('Student learning space', 'सीखने की अपनी जगह')}</small></span>
          </Link>
          <nav className="student-nav" aria-label={t('Student navigation', 'छात्र नेविगेशन')}>
            {links.map((l) => <Link key={l.href} href={l.href} aria-current={l.active ? 'page' : undefined}><Icon name={l.icon} size={18} />{l.label}</Link>)}
          </nav>
          <div className="student-header-actions">
            <LangToggle />
            <span className="desktop-tour"><Walkthrough kind="student" storageKey="rts_tour_student" /></span>
            {student && <button onClick={handleLogout} disabled={signingOut} className="icon-button" aria-label={t('Sign out', 'बाहर निकलें')} title={t('Sign out', 'बाहर निकलें')}><Icon name="logout" size={19} /></button>}
          </div>
        </div>
        {error && <p role="alert" className="text-center text-sm pb-2" style={{ color: 'var(--bad)' }}>{t('Could not sign out. Try again.', 'बाहर नहीं निकल पाए। फिर कोशिश करें।')}</p>}
      </header>
      <nav className="student-mobile-nav" aria-label={t('Student navigation', 'छात्र नेविगेशन')}>
        {links.map((l) => <Link key={l.href} href={l.href} aria-current={l.active ? 'page' : undefined}><Icon name={l.icon} size={21} />{l.label}</Link>)}
      </nav>
    </>
  );
}
