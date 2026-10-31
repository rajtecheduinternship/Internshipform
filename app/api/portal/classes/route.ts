import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { listClasses } from '@/lib/live-classes';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try { return NextResponse.json({ classes: await listClasses(profile.course_id ?? null) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
