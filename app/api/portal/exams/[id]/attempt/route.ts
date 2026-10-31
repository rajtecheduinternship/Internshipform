import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, isSameOrigin } from '@/lib/auth';
import { attemptExam } from '@/lib/exams';
import { readLearningJson, learningErrorResponse } from '@/lib/learning-errors';
type Context = { params: Promise<{ id: string }> };
async function handle(req: NextRequest, ctx: Context, action: 'read' | 'start' | 'save' | 'submit') {
  if (action !== 'read' && !isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const d = action === 'save' || action === 'submit' ? await readLearningJson(req, 32000) : {};
    return NextResponse.json({ attempt: await attemptExam({ examId: (await ctx.params).id, courseId: profile.course_id, studentId: profile.id, action, answers: d?.answers, focusEvent: d?.focus_event === true }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
export const GET = (r: NextRequest, c: Context) => handle(r, c, 'read');
export const POST = (r: NextRequest, c: Context) => handle(r, c, 'start');
export const PATCH = (r: NextRequest, c: Context) => handle(r, c, 'save');
export const PUT = (r: NextRequest, c: Context) => handle(r, c, 'submit');
