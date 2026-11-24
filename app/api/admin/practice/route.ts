import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminPractice, savePractice } from '@/lib/practice';
import { learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ practice: await adminPractice(req.nextUrl.searchParams.get('course_id')) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return learningErrorResponse(e); }
}
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { return NextResponse.json({ practice: await savePractice(await readLearningJson(req, 64000)) }, { status: 201 }); }
  catch (e) { return learningErrorResponse(e); }
}
