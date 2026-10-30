'use client';

import Link from 'next/link';
import { useCopy } from '@/components/help/i18n';

export default function PortalFooter() {
  const t = useCopy();
  return (
    <footer className="portal-footer">
      <span>© {new Date().getFullYear()} Rajtech Technological Systems</span>
      <div><span>{t('Learn at your pace. Keep moving forward.', 'अपने समय पर सीखें। आगे बढ़ते रहें।')}</span><Link href="/">{t('Visit website', 'वेबसाइट देखें')} ↗</Link></div>
    </footer>
  );
}
