'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ExamSummary } from '@/lib/exams';
export function useExams(enabled = true) {
  const [exams, setExams] = useState<ExamSummary[]>([]); const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try { const r = await fetch('/api/portal/exams', { cache: 'no-store' }); if (!r.ok) throw new Error('exams'); setExams((await r.json()).exams); setError(false); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void reload(); const timer = setInterval(() => { void reload(); }, 60000);
    window.addEventListener('focus', reload);
    return () => { clearInterval(timer); window.removeEventListener('focus', reload); };
  }, [enabled, reload]);
  return { exams, error, loading, reload };
}
