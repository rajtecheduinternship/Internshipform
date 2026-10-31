'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { useCopy } from '@/components/help/i18n';
type Draft = { dirty: boolean; busy: boolean };
const Context = createContext<{ register: (id: string, state: Draft | null) => void; canLeave: () => boolean }>({ register: (_id: string, _state: Draft | null) => { void _id; void _state; }, canLeave: () => true });
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, Draft>()); const t = useCopy();
  const register = useCallback((id: string, state: Draft | null) => { if (state) drafts.current.set(id, state); else drafts.current.delete(id); }, []);
  const canLeave = () => {
    const states = [...drafts.current.values()];
    if (states.some((d) => d.busy)) { window.alert(t('Please wait for the current save to finish.', 'वर्तमान सेव पूरा होने की प्रतीक्षा करें।')); return false; }
    return !states.some((d) => d.dirty) || window.confirm(t('Discard unsaved changes? Saved records will not be affected.', 'बिना सेव किए बदलाव छोड़ दें? सेव किए रिकॉर्ड नहीं बदलेंगे।'));
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if ([...drafts.current.values()].some((d) => d.dirty || d.busy)) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return <Context.Provider value={{ register, canLeave }}>{children}</Context.Provider>;
}
export const useAdminNavigation = () => useContext(Context);
export function useAdminDraft(dirty: boolean, busy = false) {
  const id = useId(); const { register, canLeave } = useContext(Context);
  useEffect(() => { register(id, { dirty, busy }); return () => register(id, null); }, [id, dirty, busy, register]);
  return canLeave;
}
