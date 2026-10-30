import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminAnswerQuestion, adminDeleteQuestion } from '@/lib/lms';
import { cleanText } from '@/lib/security';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const answer = cleanText(String(b?.answer || ''), 3000);
  if (!answer) return NextResponse.json({ error: 'Write an answer first.' }, { status: 400 });
  if (!(await adminAnswerQuestion((await params).id, answer))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!(await adminDeleteQuestion((await params).id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
