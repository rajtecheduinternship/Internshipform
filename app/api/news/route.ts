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
    return NextResponse.json(classNotice ? [classNotice, ...items] : items, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/news error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
