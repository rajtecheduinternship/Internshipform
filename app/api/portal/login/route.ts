import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  SESSION_COOKIE,
  createSessionToken,
  getClientIp,
  hashPassword,
  isSameOrigin,
  normalizePhone,
  publicProfile,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_PHONE = 8; // per account, regardless of IP
const MAX_ATTEMPTS_PER_IP = 60; // generous: a campus shares one IP
const INVALID = 'Invalid phone number or password.';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });

    const ip = getClientIp(req);
    const ipLimit = await db.checkRateLimit(ip, 'login', MAX_ATTEMPTS_PER_IP, WINDOW_MS, true);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const phone = normalizePhone(String(body?.phone || ''));
    const password = String(body?.password || '').slice(0, 128);

    if (!/^\d{10}$/.test(phone) || !password.trim()) {
      return NextResponse.json({ error: 'Enter your 10-digit phone number and password.' }, { status: 400 });
    }

    // Per-account lockout: only failed attempts count, so legitimate logins are never throttled.
    const failKey = `phone:${phone}`;
    if ((await db.countRecentAttempts(failKey, 'login_fail', WINDOW_MS)) >= MAX_FAILS_PER_PHONE) {
      return NextResponse.json({ error: 'Too many failed attempts for this account. Try again in 15 minutes.' }, { status: 429 });
    }

    let profile = await db.getProfileByPhone(phone);
    let applicantStatus: string | undefined;

    if (!profile) {
      // Applicant who registered before accounts existed: provision the account
      // from their application, but only if phone + roll number both match.
      const application = await db.findApplicationByPhoneAndRoll(phone, password);
      applicantStatus = application?.approval_status;
      if (application?.id && application.approval_status === 'approved') {
        const created = await db.createProfile({
          full_name: application.student_name,
          email: application.email_address,
          phone,
          college: application.college_name,
          roll_number: application.university_roll_number,
          password_hash: await hashPassword(application.university_roll_number),
          application_id: application.id,
          course_id: application.course_id ?? null,
        });
        if (created.error) console.error('Profile provisioning error:', created.error);
        profile = await db.getProfileByPhone(phone);
      }
    }

    // A correct phone + roll number may identify a pending legacy application,
    // but must never create an account or issue a session before approval.
    if (!profile && (applicantStatus === 'pending' || applicantStatus === 'rejected')) {
      await verifyPassword(password, 'x:00:00');
      return NextResponse.json({ error: applicantStatus === 'pending' ? 'Your application is waiting for admin approval.' : 'Your application was not approved. Contact the internship team.', code: applicantStatus === 'pending' ? 'APPLICATION_PENDING' : 'APPLICATION_REJECTED' }, { status: 403 });
    }

    // Always run one scrypt so "no such account" and "wrong password" take the same time.
    const ok = await verifyPassword(password, profile?.password_hash ?? 'x:00:00');
    if (!profile || profile.role !== 'student' || !ok) {
      await db.recordAttempt(failKey, 'login_fail');
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const approval = profile.application_id ? await db.getApplicationApproval(profile.application_id) : null;
    if (approval !== 'approved') {
      return NextResponse.json({ error: approval === 'rejected' ? 'Your application was not approved. Contact the internship team.' : 'Your application is waiting for admin approval.', code: approval === 'rejected' ? 'APPLICATION_REJECTED' : 'APPLICATION_PENDING' }, { status: 403 });
    }

    await db.clearAttempts(failKey, 'login_fail');
    await db.touchLastLogin(profile.id);

    const res = NextResponse.json({ success: true, profile: publicProfile(profile) });
    res.cookies.set(SESSION_COOKIE, createSessionToken(profile.id, profile.token_version ?? 0), sessionCookieOptions);
    return res;
  } catch (error) {
    console.error('Portal login error:', error);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
