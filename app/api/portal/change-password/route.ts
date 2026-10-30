import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  SESSION_COOKIE,
  createSessionToken,
  hashCustomPassword,
  invalidateProfileCache,
  isSameOrigin,
  getSessionProfile,
  sessionCookieOptions,
  validateNewPassword,
  verifyPassword,
} from '@/lib/auth';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });

  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const current = String(body?.currentPassword || '').slice(0, 128);
  const next = String(body?.newPassword || '');

  const failKey = `chpw:${profile.id}`;
  if ((await db.countRecentAttempts(failKey, 'chpw_fail', WINDOW_MS)) >= MAX_FAILS) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }

  if (!(await verifyPassword(current, profile.password_hash))) {
    await db.recordAttempt(failKey, 'chpw_fail');
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 });
  }

  const problem = validateNewPassword(next);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (next.trim().toLowerCase() === (profile.roll_number || '').trim().toLowerCase()) {
    return NextResponse.json({ error: 'New password must be different from your roll number.' }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'New password must be different from the current one.' }, { status: 400 });
  }

  await db.clearAttempts(failKey, 'chpw_fail');
  // Bumping token_version signs out every other device; this device gets a fresh cookie.
  const version = await db.updatePassword(profile.id, await hashCustomPassword(next));
  invalidateProfileCache(profile.id);

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(profile.id, version), sessionCookieOptions);
  return res;
}
