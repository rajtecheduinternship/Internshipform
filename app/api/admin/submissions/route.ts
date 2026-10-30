import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { data: submissions, error } = await db.getAllApplications();
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }
    const response = NextResponse.json({ submissions }, { status: 200 });
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
