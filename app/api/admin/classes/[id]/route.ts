import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { saveClass } from '@/lib/live-classes';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ class: await saveClass(await req.json().catch(() => ({})), (await ctx.params).id) }); }
  catch (e) { return learningErrorResponse(e); }
}
