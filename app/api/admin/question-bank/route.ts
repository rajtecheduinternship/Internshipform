import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deleteBankQuestion, listBank, saveBank } from '@/lib/exams';
import { learningErrorResponse } from '@/lib/learning-errors';
/** Questions are addressed by bank: ?bank_id=… (or ?bank_ids=a,b for several banks at once). */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const p = req.nextUrl.searchParams;
    const ids = (p.get('bank_ids') || p.get('bank_id') || '').split(',').map((v) => v.trim()).filter(Boolean);
    return NextResponse.json({ questions: await listBank(ids) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await req.json(); return NextResponse.json({ questions: await saveBank(d?.bank_id, d?.questions) }, { status: 201 }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await req.json(); return NextResponse.json({ questions: await saveBank(d?.bank_id, [d?.question], d?.id || 'invalid') }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await req.json(); await deleteBankQuestion(d?.bank_id, d?.id); return NextResponse.json({ ok: true }); }
  catch (e) { return learningErrorResponse(e); }
}
