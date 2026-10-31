'use client';

import { ReactNode } from 'react';
import { useCopy } from '@/components/help/i18n';

/** Decorative when paired with text; the parent owns the accessible announcement. */
export function Spinner() {
  return <span className="ui-spinner" aria-hidden="true" />;
}

export function BusyText({ children }: { children: ReactNode }) {
  return <span className="ui-busy-text" role="status"><Spinner />{children}</span>;
}

/** Consistent, visible feedback for initial loads, refreshes, and route transitions. */
export default function LoadingState({ label, compact = false, className = '' }: {
  label?: string; compact?: boolean; className?: string;
}) {
  const t = useCopy();
  return (
    <div className={`ui-loading ${compact ? 'ui-loading-compact' : ''} ${className}`} role="status" aria-live="polite">
      <div className="ui-loading-label"><Spinner /><span>{label || t('Loading…', 'लोड हो रहा है…')}</span></div>
      {!compact && <div className="ui-loading-preview" aria-hidden="true"><div className="ui-skeleton" /><div className="ui-skeleton" /><div className="ui-skeleton" /></div>}
    </div>
  );
}
