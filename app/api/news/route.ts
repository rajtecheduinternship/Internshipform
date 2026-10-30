import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const items = await db.getActiveNews();
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/news error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
