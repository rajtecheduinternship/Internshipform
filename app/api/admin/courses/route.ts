import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminCreateCourse, adminListCourses } from '@/lib/lms';
import { cleanText } from '@/lib/security';
import { clampInt, safeUrl } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ courses: await adminListCourses() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const title = cleanText(String(b?.title || ''), 150);
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const course = await adminCreateCourse({
    title,
    description: cleanText(String(b?.description || ''), 2000),
    category: cleanText(String(b?.category || ''), 80) || undefined,
    thumbnail_url: safeUrl(b?.thumbnail_url),
    duration_weeks: clampInt(b?.duration_weeks, 1, 52, 4),
    duration_hours: clampInt(b?.duration_hours, 1, 1000, 90),
    is_published: b?.is_published !== false,
  });
  return NextResponse.json({ course }, { status: 201 });
}
