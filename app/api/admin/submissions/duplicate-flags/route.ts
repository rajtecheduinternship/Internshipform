import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { pendingDuplicateCounts } from '@/lib/duplicates';

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ flags: await pendingDuplicateCounts() }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch (error) {
    console.error('Duplicate flags error:', error);
    return NextResponse.json({ flags: {} });
  }
}
