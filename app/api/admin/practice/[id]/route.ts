import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deletePractice, savePractice, setPracticePublished } from '@/lib/practice';
import { learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const { id } = await ctx.params; const d = await readLearningJson(req, 64000);
    if (Object.keys(d).length === 1 && 'is_published' in d) return NextResponse.json(await setPracticePublished(id, d.is_published));
    return NextResponse.json({ practice: await savePractice(d, id) });
  } catch (e) { return learningErrorResponse(e); }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { await deletePractice((await ctx.params).id); return NextResponse.json({ ok: true }); }
  catch (e) { return learningErrorResponse(e); }
}
