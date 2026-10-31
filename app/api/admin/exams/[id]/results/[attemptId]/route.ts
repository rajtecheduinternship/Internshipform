import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminAnswerReview, publishExamResults } from '@/lib/exams';
import { LearningError, learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
type Context = { params: Promise<{ id: string; attemptId: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const { id, attemptId } = await ctx.params;
    return NextResponse.json({ review: await adminAnswerReview(id, attemptId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
export async function PATCH(req: NextRequest, ctx: Context) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const d = await readLearningJson(req); const { id, attemptId } = await ctx.params;
    if (Object.keys(d).length !== 1 || typeof d.is_published !== 'boolean') throw new LearningError('Provide only is_published: true or false.');
    return NextResponse.json(await publishExamResults(id, d.is_published, attemptId));
  } catch (e) { return learningErrorResponse(e); }
}
