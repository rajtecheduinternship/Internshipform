export function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Only https URLs or site-relative paths: blocks javascript: and data: URLs in thumbnails. */
export function safeUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const u = v.trim().slice(0, 500);
  return /^(https:\/\/|\/[^/])/i.test(u) ? u : null;
}

/** Accepts a bare 11-char YouTube id or any youtube.com / youtu.be URL; returns the id. */
export function parseYouTubeId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      id = u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
