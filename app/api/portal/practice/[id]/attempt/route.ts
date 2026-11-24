import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, isSameOrigin } from '@/lib/auth';
import { practiceAttempt } from '@/lib/practice';
import { learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
type Ctx = { params: Promise<{ id: string }> };
async function handle(req: NextRequest, ctx: Ctx, action: 'read' | 'start' | 'save' | 'submit') {
  if (action !== 'read' && !isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const d = action === 'save' || action === 'submit' ? await readLearningJson(req, 64000) : {};
    return NextResponse.json({ attempt: await practiceAttempt({ practiceId: (await ctx.params).id, courseId: profile.course_id, studentId: profile.id, action, answers: d?.answers }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
export const GET = (r: NextRequest, c: Ctx) => handle(r, c, 'read');
export const POST = (r: NextRequest, c: Ctx) => handle(r, c, 'start');
export const PATCH = (r: NextRequest, c: Ctx) => handle(r, c, 'save');
export const PUT = (r: NextRequest, c: Ctx) => handle(r, c, 'submit');
