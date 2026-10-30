import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, invalidateProfileCache, requireAdmin } from '@/lib/auth';
import { isUuid } from '@/lib/lms';
import { cleanText } from '@/lib/security';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid application ID' }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || !['approved', 'rejected'].includes(body.decision) || (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000))) {
    return NextResponse.json({ error: 'Choose approve or reject. Review notes must be at most 1000 characters.' }, { status: 400 });
  }
  try {
    const application = await db.getApplicationById(id);
    if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    // The server loads the verified roll number. Never accept a password or course from the browser.
    const passwordHash = body.decision === 'approved' ? await hashPassword(application.university_roll_number) : '';
    const review = await db.reviewApplication(id, body.decision, cleanText(body.note || '', 1000), passwordHash);
    if (review.profile_id) invalidateProfileCache(review.profile_id);
    return NextResponse.json({ success: true, review }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P0002') return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    if (code === '22023') return NextResponse.json({ error: 'A published course must be assigned before approval.' }, { status: 409 });
    if (code === '23505') return NextResponse.json({ error: 'Another account already uses these details. Review the student record before approving.' }, { status: 409 });
    console.error('Application review error:', error);
    return NextResponse.json({ error: 'Could not save this decision. Please try again.' }, { status: 500 });
  }
}
