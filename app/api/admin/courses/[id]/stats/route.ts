import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminCourseVideoStats } from '@/lib/lms';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const videos = await adminCourseVideoStats((await params).id);
  if (!videos) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ videos }, { headers: { 'Cache-Control': 'no-store' } });
}
