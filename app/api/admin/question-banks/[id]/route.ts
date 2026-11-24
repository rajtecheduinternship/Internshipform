import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deleteBankSet, saveBankMeta } from '@/lib/exams';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ bank: await saveBankMeta(await req.json(), (await ctx.params).id) }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { await deleteBankSet((await ctx.params).id); return NextResponse.json({ ok: true }); }
  catch (e) { return learningErrorResponse(e); }
}
