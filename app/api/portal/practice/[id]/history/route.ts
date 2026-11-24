import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { practiceHistory } from '@/lib/practice';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try { return NextResponse.json({ history: await practiceHistory((await ctx.params).id, profile.course_id, profile.id) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
