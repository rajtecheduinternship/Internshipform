import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { studentExams } from '@/lib/exams';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try { return NextResponse.json({ exams: await studentExams(profile.course_id, profile.id) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
