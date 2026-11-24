'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PracticeSummary } from '@/lib/practice';
export function usePractice(enabled = true) {
  const [practice, setPractice] = useState<PracticeSummary[]>([]); const [error, setError] = useState(false); const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try { const r = await fetch('/api/portal/practice', { cache: 'no-store' }); if (!r.ok) throw new Error('practice'); setPractice((await r.json()).practice); setError(false); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
  return { practice, error, loading, reload };
}
