'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

import { useCopy } from '@/components/help/i18n';
import { Icon } from '@/components/icons';

export const fmtHours = (s: number, lang: 'en' | 'hi' = 'en') => {
  const m = Math.round(s / 60);
  if (lang === 'hi') return m >= 60 ? `${Math.floor(m / 60)} घं ${m % 60} मिनट` : `${m} मिनट`;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export const timeAgo = (d: string | null | undefined, lang: 'en' | 'hi' = 'en') => {
  if (!d) return lang === 'hi' ? 'अभी तक नहीं' : 'Not yet';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'hi' ? 'अभी' : 'Just now';
  if (m < 60) return lang === 'hi' ? `${m} मिनट पहले` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'hi' ? `${h} घंटे पहले` : `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 30 ? (lang === 'hi' ? `${days} दिन पहले` : `${days}d ago`) : new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN');
};

export function Progress({ value, done, label }: { value: number; done?: boolean; label?: string }) {
  const t = useCopy();
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className={`ui-progress ${done || v >= 100 ? 'done' : ''}`} role="progressbar" aria-label={label || t('Progress', 'प्रगति')} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'bad' | 'brand'; children: ReactNode }) {
  return <span className={`ui-badge ${tone ? `ui-badge-${tone}` : ''}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="ui-card ui-card-pad ui-stat">
      <div className="ui-eyebrow">{label}</div>
      <div className="tnum" style={{ fontSize: '1.75rem', fontWeight: 650, lineHeight: 1.2, marginTop: 6 }}>{value}</div>
      {hint && <div className="ui-muted" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** Course / video thumbnail with a neutral placeholder when none is set. */
export function Thumb({ src, alt = '', w = 64, h = 40, fill = false }: { src?: string | null; alt?: string; w?: number; h?: number; fill?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const style = { width: fill ? '100%' : w, height: fill ? '100%' : h };
  // eslint-disable-next-line @next/next/no-img-element
  if (src && failed !== src) return <img src={src} alt={alt} width={w} height={h} className={`ui-thumb ${loaded !== src ? 'ui-skeleton' : ''}`} style={style} loading="lazy" onLoad={() => setLoaded(src)} onError={() => setFailed(src)} />;
  return <div className="ui-thumb ui-thumb-fallback" style={style} aria-hidden><Icon name="book" size={fill ? 38 : 20} /></div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ui-empty">
      <span className="empty-icon"><Icon name="book" size={27} /></span>
      <div className="ui-h2">{title}</div>
      {children && <div className="ui-muted" style={{ marginTop: 4 }}>{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div role="alert" style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid #efc9c5', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>{children}</div>;
}

/** Trap focus, lock background scrolling and restore the trigger when a dialog closes. */
export function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
    const controls = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(selector) || []).filter((el) => el.getClientRects().length > 0);
    (controls()[0] || ref.current)?.focus();
    const handle = (e: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((el) => el.getClientRects().length > 0);
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return ref;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, tone = 'danger' }: {
  title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; tone?: 'danger' | 'brand';
}) {
  const t = useCopy();
  const ref = useDialogFocus(true, onCancel);
  return (
    <div className="ui-overlay" onClick={onCancel}>
      <div ref={ref} tabIndex={-1} className="ui-modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ui-h2">{title}</div>
        <div className="ui-muted" style={{ marginTop: 8, lineHeight: 1.6 }}>{body}</div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="ui-btn" onClick={onCancel}>{t('Cancel', 'रद्द करें')}</button>
          <button className={`ui-btn ${tone === 'brand' ? 'ui-btn-primary' : 'ui-btn-solid-danger'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const t = useCopy();
  const ref = useDialogFocus(true, onClose);
  return (
    <div className="ui-overlay" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className="ui-drawer" role="dialog" aria-modal="true" aria-label={t('Edit details', 'जानकारी बदलें')} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
