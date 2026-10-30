'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT, useLang } from './i18n';
import { Badge, ErrorNote, timeAgo } from '@/components/ui';

interface Q { id: string; question: string; answer: string | null; created_at: string; video_id: string | null; video_title: string | null }

export default function AskQuestion({ videoId }: { videoId: string }) {
  const t = useT();
  const { lang } = useLang();
  const [items, setItems] = useState<Q[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    fetch('/api/portal/questions').then((r) => (r.ok ? r.json() : { questions: [] }))
      .then((d) => setItems(d.questions || [])).catch(() => undefined);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSent(false);
    setBusy(true);
    try {
      const res = await fetch('/api/portal/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, video_id: videoId }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) { setError(t({ en: 'Could not send. Please try again.', hi: 'भेजा नहीं जा सका। कृपया फिर से कोशिश करें।' })); return; }
      setText(''); setSent(true); load();
    } catch {
      setError(t({ en: 'Network problem. Please try again.', hi: 'इंटरनेट जाँचें और फिर कोशिश करें।' }));
    } finally { setBusy(false); }
  }

  const mine = items.filter((q) => q.video_id === videoId);
  const others = items.filter((q) => q.video_id !== videoId);

  return (
    <section className="ui-card ui-card-pad">
      <h2 className="ui-h2">{t({ en: 'Ask a question', hi: 'अपना सवाल पूछें' })}</h2>
      <p className="ui-muted" style={{ marginTop: 2 }}>{t({ en: 'Write your doubt about this lecture in Hindi or English. The teacher will reply here.', hi: 'इस पाठ से जुड़ा अपना सवाल हिन्दी या अंग्रेज़ी में लिखें। शिक्षक का जवाब यहीं दिखेगा।' })}</p>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <textarea className="ui-field" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
          aria-label={t({ en: 'Your question', hi: 'आपका सवाल' })} placeholder={t({ en: 'Type your question…', hi: 'अपना सवाल यहाँ लिखिए…' })} />
        {error && <ErrorNote>{error}</ErrorNote>}
        {sent && <div role="status" className="text-[13px]" style={{ color: 'var(--ok)' }}>{t({ en: 'Sent. You will see the answer below.', hi: 'भेज दिया गया। जवाब नीचे दिखेगा।' })}</div>}
        <button className="ui-btn ui-btn-primary" disabled={busy || text.trim().length < 5}>{busy ? t({ en: 'Sending…', hi: 'भेज रहे हैं…' }) : t({ en: 'Send question', hi: 'सवाल भेजें' })}</button>
      </form>

      {(mine.length > 0 || others.length > 0) && (
        <div className="mt-5 space-y-3">
          <div className="ui-eyebrow">{t({ en: 'Your questions', hi: 'आपके सवाल' })}</div>
          {[...mine, ...others].map((q) => (
            <div key={q.id} className="rounded-md p-3" style={{ background: 'var(--bg)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="ui-muted">{q.video_title && q.video_id !== videoId ? `${q.video_title} · ` : ''}{timeAgo(q.created_at, lang)}</span>
                {q.answer ? <Badge tone="ok">{t({ en: 'Answered', hi: 'जवाब आ गया' })}</Badge> : <Badge tone="warn">{t({ en: 'Waiting for teacher', hi: 'टीचर के जवाब का इंतज़ार' })}</Badge>}
              </div>
              <p className="mt-1 text-[14px]" style={{ whiteSpace: 'pre-wrap' }}>{q.question}</p>
              {q.answer && (
                <div className="mt-2 rounded-md p-3 text-[14px]" style={{ background: 'var(--brand-soft)', borderLeft: '3px solid var(--brand)' }}>
                  <div className="ui-eyebrow" style={{ color: 'var(--brand)' }}>{t({ en: 'Teacher’s answer', hi: 'टीचर का जवाब' })}</div>
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{q.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
