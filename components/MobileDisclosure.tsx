'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';

/** Keep long secondary content open on desktop and opt-in on small screens. */
export default function MobileDisclosure({ title, children, className = '' }: {
  title: string; children: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setOpen(!media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <details className={`mobile-disclosure ${className}`} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{title}<Icon name="chevron" size={18} /></summary>
    <div>{children}</div>
  </details>;
}
