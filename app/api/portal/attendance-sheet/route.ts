import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { studentReport } from '@/lib/attendance-report';
import { generateAttendancePDF } from '@/lib/attendance-pdf';
import { learningErrorResponse } from '@/lib/learning-errors';
import { pdfResponse } from '@/lib/syllabus';
/** The student's own published attendance sheet. No query → availability; ?file=1 → the PDF. */
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const r = await studentReport(profile.id, profile.course_id);
    if (!req.nextUrl.searchParams.get('file')) return NextResponse.json({ sheet: r ? { ref_no: r.ref_no, start_date: r.start_date, end_date: r.end_date, published_at: r.published_at } : null }, { headers: { 'Cache-Control': 'no-store' } });
    if (!r) return NextResponse.json({ error: 'Your attendance sheet is not available yet.' }, { status: 404 });
    return pdfResponse(generateAttendancePDF(r), `Attendance-${r.ref_no}.pdf`, !!req.nextUrl.searchParams.get('download'));
  } catch (e) { return learningErrorResponse(e); }
}
