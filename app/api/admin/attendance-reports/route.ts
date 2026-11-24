import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { classDateRange, generateReports, listReports, missingCount, refSettings, setReportsPublished } from '@/lib/attendance-report';
import { learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
const noStore = { headers: { 'Cache-Control': 'no-store' } };
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const course = req.nextUrl.searchParams.get('course_id');
    return NextResponse.json({ reports: await listReports(course), range: await classDateRange(course), ref: await refSettings(), missing: await missingCount(course) }, noStore);
  } catch (e) { return learningErrorResponse(e); }
}
/** Generate (or regenerate) sheets for every approved student of a course for a date range. */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await readLearningJson(req); return NextResponse.json(await generateReports(d.course_id, d.start_date, d.end_date, d.ref_code, d.mode), { status: 201, ...noStore }); }
  catch (e) { return learningErrorResponse(e); }
}
/** Publish or hide selected sheets (`ids`) or, with no ids, every sheet on the course. */
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await readLearningJson(req); return NextResponse.json(await setReportsPublished(d.course_id, d.ids, d.is_published), noStore); }
  catch (e) { return learningErrorResponse(e); }
}
