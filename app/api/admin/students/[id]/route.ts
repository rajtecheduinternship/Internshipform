import { NextRequest, NextResponse } from 'next/server';
import { invalidateProfileCache, requireAdmin } from '@/lib/auth';
import { adminSetStudentCourse, adminStudentDetail, isUuid } from '@/lib/lms';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const detail = await adminStudentDetail((await params).id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
}

/** Admin can move a student to a different course. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const courseId = b?.course_id === null ? null : String(b?.course_id || '');
  if (!isUuid(id) || (courseId !== null && !isUuid(courseId))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    if (!(await adminSetStudentCourse(id, courseId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }
  invalidateProfileCache(id); // student sees the new course immediately on this instance
  return NextResponse.json({ success: true });
}
