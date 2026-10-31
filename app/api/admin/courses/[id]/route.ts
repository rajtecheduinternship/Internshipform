import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminDeleteCourse, adminGetCourse, adminSetCourseModules, adminUpdateCourse, isUuid } from '@/lib/lms';
import { cleanText } from '@/lib/security';
import { clampInt, safeUrl } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const course = await adminGetCourse((await params).id);
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // Attach / detach / reorder modules: { module_ids: [...] } in display order
  if (Array.isArray(b.module_ids)) {
    const ids = [...new Set(b.module_ids.map(String))].filter(isUuid);
    try {
      await adminSetCourseModules(id, ids);
    } catch {
      return NextResponse.json({ error: 'Unknown module in list' }, { status: 400 });
    }
  }

  const patch: Parameters<typeof adminUpdateCourse>[1] = {};
  if (b.title !== undefined) {
    const t = cleanText(String(b.title), 150);
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = t;
  }
  if (b.description !== undefined) patch.description = cleanText(String(b.description), 2000);
  if (b.category !== undefined) patch.category = cleanText(String(b.category), 80);
  if (b.thumbnail_url !== undefined) patch.thumbnail_url = safeUrl(b.thumbnail_url);
  if (b.duration_weeks !== undefined) patch.duration_weeks = clampInt(b.duration_weeks, 1, 52, 4);
  if (b.duration_hours !== undefined) patch.duration_hours = clampInt(b.duration_hours, 1, 1000, 90);
  if (b.is_published !== undefined) patch.is_published = Boolean(b.is_published);
  if (Object.keys(patch).length) await adminUpdateCourse(id, patch);

  return NextResponse.json({ course: await adminGetCourse(id) });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id) || !(await adminDeleteCourse(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
