'use client';
import type { ReactNode } from 'react';
import { Drawer } from '@/components/ui';
import { useCopy } from '@/components/help/i18n';
export default function EditorDrawer({ title, onClose, busy = false, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const t = useCopy();
  return <Drawer onClose={onClose} title={title}><header className="ui-card-head admin-editor-header"><h2 className="ui-h2">{title}</h2><button type="button" className="ui-btn ui-btn-sm" disabled={busy} onClick={onClose}>{t('Close', 'बंद करें')}</button></header><fieldset disabled={busy} aria-busy={busy} className="p-4 sm:p-5 space-y-4 admin-editor-body min-w-0">{children}</fieldset></Drawer>;
}
