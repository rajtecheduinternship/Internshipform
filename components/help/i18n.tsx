'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type Lang = 'en' | 'hi';
const KEY = 'rts_lang';

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => undefined });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const v = localStorage.getItem(KEY); if (v === 'hi' || v === 'en') setLangState(v); } catch { /* private mode */ }
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** Pick the string for the current language: t({ en: '…', hi: '…' }) */
export function useT() {
  const { lang } = useLang();
  return (s: { en: string; hi: string }) => s[lang];
}

/** Short copy helper for screen-level labels. User-entered course content is never translated. */
export function useCopy() {
  const { lang } = useLang();
  return (en: string, hi: string) => lang === 'hi' ? hi : en;
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label={lang === 'hi' ? 'भाषा चुनें' : 'Choose language'} className="language-toggle">
      {(['en', 'hi'] as Lang[]).map((l) => (
        <button type="button" key={l} onClick={() => setLang(l)} aria-pressed={lang === l} lang={l}>
          {l === 'en' ? 'English' : 'हिन्दी'}
        </button>
      ))}
    </div>
  );
}
