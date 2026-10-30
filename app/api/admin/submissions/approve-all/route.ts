import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, invalidateProfileCache, requireAdmin } from '@/lib/auth';
import { isUuid } from '@/lib/lms';
import { cleanText } from '@/lib/security';

// Each call approves at most BATCH pending applications so it stays inside serverless time limits.
// The admin page calls again until `remaining` is 0.
const BATCH = 40;
const PARALLEL = 5;

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000)) {
    return NextResponse.json({ error: 'Review notes must be at most 1000 characters.' }, { status: 400 });
  }
  const note = cleanText(body.note || '', 1000);
  // Applications that already failed in this run are skipped so one bad record cannot loop forever.
  const skipIds: string[] = Array.isArray(body.skipIds) ? body.skipIds.filter((x: unknown): x is string => typeof x === 'string' && isUuid(x)) : [];

  try {
    const { rows: batch, total } = await db.listPendingApplications(BATCH, skipIds);

    let approved = 0;
    const failed: { id: string; name: string; reason: string }[] = [];
    for (let i = 0; i < batch.length; i += PARALLEL) {
      await Promise.all(batch.slice(i, i + PARALLEL).map(async (a) => {
        try {
          // Same rules as single approval: password = verified roll number, course must be published.
          const hash = await hashPassword(a.university_roll_number);
          const review = await db.reviewApplication(a.id, 'approved', note, hash);
          if (review.profile_id) invalidateProfileCache(review.profile_id);
          approved++;
        } catch (e) {
          const code = (e as { code?: string }).code;
          failed.push({
            id: a.id, name: a.student_name,
            reason: code === '22023' ? 'No published course' : code === '23505' ? 'Phone or email already used by another account' : 'Could not save',
          });
        }
      }));
    }
    return NextResponse.json(
      { approved, failed, remaining: Math.max(0, total - batch.length) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Bulk approval error:', error);
    return NextResponse.json({ error: 'Could not approve applications. Please try again.' }, { status: 500 });
  }
}
