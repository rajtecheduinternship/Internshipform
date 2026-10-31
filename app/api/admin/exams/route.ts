import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminExams, saveExam } from '@/lib/exams';
import { learningErrorResponse } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ exams: await adminExams() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ exam: await saveExam(await req.json()) }, { status: 201 }); }
  catch (e) { return learningErrorResponse(e); }
}
