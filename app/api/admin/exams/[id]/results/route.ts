import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminExamResults, publishExamResults } from '@/lib/exams';
import { LearningError, learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ results: await adminExamResults((await ctx.params).id) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const d = await readLearningJson(req);
    if (Object.keys(d).length !== 1 || typeof d.is_published !== 'boolean') throw new LearningError('Provide only is_published: true or false.');
    return NextResponse.json(await publishExamResults((await ctx.params).id, d.is_published));
  } catch (e) { return learningErrorResponse(e); }
}
