import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createAdminToken,
  getClientIp,
  isAdmin,
  isSameOrigin,
  safeCompare,
} from '@/lib/auth';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

/** GET: is the current admin cookie valid? (lets the page survive a refresh) */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isAdmin(req) });
}

/** POST: exchange the admin password for a signed, httpOnly, 8-hour cookie. */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD not set in environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const key = `admin:${getClientIp(req)}`;
    if ((await db.countRecentAttempts(key, 'admin_fail', WINDOW_MS)) >= MAX_FAILS) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const { password } = await req.json().catch(() => ({ password: '' }));
    if (typeof password !== 'string' || !safeCompare(password, adminPassword)) {
      await db.recordAttempt(key, 'admin_fail');
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    await db.clearAttempts(key, 'admin_fail');
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, createAdminToken(), adminCookieOptions);
    return res;
  } catch (error) {
    console.error('Admin verify error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
