import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listClasses, saveClass, saveClassForAllCourses } from '@/lib/live-classes';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ classes: await listClasses() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && body.scope === 'all') { const classes = await saveClassForAllCourses(body); return NextResponse.json({ classes, class: classes[0] }, { status: 201 }); }
    return NextResponse.json({ class: await saveClass(body) }, { status: 201 });
  }
  catch (e) { return learningErrorResponse(e); }
}
