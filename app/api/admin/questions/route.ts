import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminListQuestions } from '@/lib/lms';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const f = req.nextUrl.searchParams.get('filter');
  const filter = f === 'answered' || f === 'all' ? f : 'open';
  const student = req.nextUrl.searchParams.get('student') || undefined;
  return NextResponse.json({ questions: await adminListQuestions(filter, student) }, { headers: { 'Cache-Control': 'no-store' } });
}
