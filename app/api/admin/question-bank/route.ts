import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listBank, saveBank } from '@/lib/exams';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ questions: await listBank(req.nextUrl.searchParams.get('course_id') || '') }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await req.json(); return NextResponse.json({ questions: await saveBank(d?.course_id, d?.module_id, d?.questions) }, { status: 201 }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { const d = await req.json(); return NextResponse.json({ questions: await saveBank(d?.course_id, d?.module_id, [d?.question], d?.id || 'invalid') }); }
  catch (e) { return learningErrorResponse(e); }
}
