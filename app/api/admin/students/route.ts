import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminListStudents } from '@/lib/lms';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ students: await adminListStudents() }, { headers: { 'Cache-Control': 'no-store' } });
}
