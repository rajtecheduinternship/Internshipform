import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publicClassNotice } from '@/lib/live-classes';

export async function GET() {
  try {
    const [items, classNotice] = await Promise.all([
      db.getActiveNews(),
      // Keep manually authored news available even during staged migration/deployment.
      publicClassNotice().catch((e) => { console.error('Class notice unavailable:', e); return null; }),
    ]);
    // Identical for every visitor and polled by every open home page: let the CDN absorb it.
    // News edits can take up to ~30s to appear (60s more while a refresh happens in the background).
    return NextResponse.json(classNotice ? [classNotice, ...items] : items, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (err) {
    console.error('GET /api/news error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
