import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { publishExam, saveExam } from '@/lib/exams';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const { id } = await ctx.params; const d = await req.json();
    return NextResponse.json({ exam: d && Object.keys(d).length === 1 && 'is_published' in d ? await publishExam(id, d.is_published) : await saveExam(d, id) });
  } catch (e) { return learningErrorResponse(e); }
}
