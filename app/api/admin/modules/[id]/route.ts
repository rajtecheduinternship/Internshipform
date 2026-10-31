import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminDeleteModule, adminGetModule, adminSetModuleCourses, adminUpdateModule, isUuid } from '@/lib/lms';
import { cleanText } from '@/lib/security';
import { safeUrl } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const mod = await adminGetModule((await params).id);
  if (!mod) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ module: mod });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const patch: Parameters<typeof adminUpdateModule>[1] = {};
  if (b.title !== undefined) {
    const t = cleanText(String(b.title), 150);
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = t;
  }
  if (b.description !== undefined) patch.description = cleanText(String(b.description), 2000);
  if (b.thumbnail_url !== undefined) patch.thumbnail_url = safeUrl(b.thumbnail_url);
  if (b.is_mandatory !== undefined) patch.is_mandatory = b.is_mandatory === true;
  if (Array.isArray(b.course_ids)) {
    try { await adminSetModuleCourses(id, [...new Set(b.course_ids.map(String))].filter(isUuid)); }
    catch { return NextResponse.json({ error: 'Could not update courses' }, { status: 400 }); }
  }
  const mod = Object.keys(patch).length ? await adminUpdateModule(id, patch) : await adminGetModule(id);
  if (!mod) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ module: mod });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id) || !(await adminDeleteModule(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
