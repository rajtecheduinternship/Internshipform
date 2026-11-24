import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { learningErrorResponse } from '@/lib/learning-errors';
import { pdfResponse, studentSyllabus, studentSyllabusFile } from '@/lib/syllabus';
/** The student's own course syllabus. ?file=1 streams the PDF (add &download=1 to force a download). */
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    if (req.nextUrl.searchParams.get('file')) {
      const f = await studentSyllabusFile(profile.course_id);
      if (!f) return NextResponse.json({ error: 'No syllabus available.' }, { status: 404 });
      return pdfResponse(f.data, f.filename, !!req.nextUrl.searchParams.get('download'));
    }
    return NextResponse.json({ syllabus: await studentSyllabus(profile.course_id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
