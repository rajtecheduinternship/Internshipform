import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { publishScopeResults, resultScopeSummary } from '@/lib/exams';
import { learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const q = req.nextUrl.searchParams;
    return NextResponse.json({ exams: await resultScopeSummary(q.get('course_id'), q.get('module_id') || undefined) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const d = await readLearningJson(req);
    return NextResponse.json(await publishScopeResults(d.course_id, d.module_id || null, d.is_published));
  } catch (e) { return learningErrorResponse(e); }
}
