import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, ProfileRecord } from '@/lib/db';

export const SESSION_COOKIE = 'rts_session';
export const ADMIN_COOKIE = 'rts_admin';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const ADMIN_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

const isProd = process.env.NODE_ENV === 'production';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProd) {
    // Never fall back to a guessable key in production: anyone could forge sessions.
    throw new Error('SESSION_SECRET must be set (min 16 chars) in production');
  }
  return 'dev-only-insecure-secret';
}

// ==================== CREDENTIALS ====================
// User ID  = 10-digit phone number
// Initial password = college / university roll number (student can change it later)

export function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

/** Roll numbers are compared case-insensitively and ignoring surrounding spaces. */
export function normalizePassword(rollNumber: string): string {
  return (rollNumber || '').trim().toLowerCase();
}

const scryptAsync = (password: string, salt: string, keylen: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key)))
  );

/**
 * Stored formats:
 *   "salt:hash"      legacy / initial roll-number password (case-insensitive)
 *   "x:salt:hash"    password chosen by the student (exact, case-sensitive)
 */
export async function hashPassword(rollNumber: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(normalizePassword(rollNumber), salt, 64)).toString('hex');
  return `${salt}:${hash}`;
}

export async function hashCustomPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)).toString('hex');
  return `x:${salt}:${hash}`;
}

export async function verifyPassword(input: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(':');
  const exact = parts[0] === 'x';
  const [salt, hash] = exact ? parts.slice(1) : parts;
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = exact ? input : normalizePassword(input);
  const actual = await scryptAsync(candidate, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export function validateNewPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';
  return null;
}

// ==================== TOKENS ====================

const sign = (payload: string) => createHmac('sha256', getSecret()).update(payload).digest('hex');

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** token = profileId.tokenVersion.expires.signature */
export function createSessionToken(profileId: string, tokenVersion = 0): string {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${profileId}.${tokenVersion}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string | undefined): { profileId: string; version: number } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [profileId, version, expires, signature] = parts;
  if (!safeEqualHex(signature, sign(`${profileId}.${version}.${expires}`))) return null;
  if (Number(expires) < Date.now()) return null;
  return { profileId, version: Number(version) };
}

export function createAdminToken(): string {
  const expires = Date.now() + ADMIN_MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  if (!safeEqualHex(parts[2], sign(`admin.${parts[1]}`))) return false;
  return Number(parts[1]) >= Date.now();
}

const baseCookie = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: isProd,
  path: '/',
};

export const sessionCookieOptions = { ...baseCookie, maxAge: SESSION_MAX_AGE_SECONDS };
export const adminCookieOptions = { ...baseCookie, maxAge: ADMIN_MAX_AGE_SECONDS };

/** Constant-time comparison of two strings of any length. */
export function safeCompare(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ==================== REQUEST HELPERS ====================

/** Best-effort client IP. Needs a trusted reverse proxy (Cloudflare / Vercel / nginx) in front. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * Same-origin guard for state-changing requests (CSRF defence in depth on top of SameSite=Strict).
 * Returns true when the Origin header (if present) matches the Host.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients / same-origin GETs
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

// ==================== STUDENT SESSION ====================

// Short-lived in-process cache so every heartbeat does not hit the database.
// Password change / logout-everywhere takes effect within PROFILE_CACHE_TTL_MS.
const PROFILE_CACHE_TTL_MS = 30_000;
const PROFILE_CACHE_MAX = 2000;
// Kept on globalThis: Next bundles route handlers separately, so a module-level Map would be
// duplicated per route and invalidation in one route would not reach the others.
type CacheEntry = { profile: ProfileRecord | null; at: number };
const g = globalThis as unknown as { __rtsProfileCache?: Map<string, CacheEntry> };
const profileCache = (g.__rtsProfileCache ??= new Map<string, CacheEntry>());

export function invalidateProfileCache(profileId: string) {
  profileCache.delete(profileId);
}

async function loadProfile(profileId: string): Promise<ProfileRecord | null> {
  const hit = profileCache.get(profileId);
  if (hit && Date.now() - hit.at < PROFILE_CACHE_TTL_MS) return hit.profile;
  const profile = await db.getProfileById(profileId);
  if (profileCache.size >= PROFILE_CACHE_MAX) {
    const oldest = profileCache.keys().next().value;
    if (oldest) profileCache.delete(oldest);
  }
  profileCache.set(profileId, { profile, at: Date.now() });
  return profile;
}

/** Returns the logged-in student profile for this request, or null. */
export async function getSessionProfile(req: NextRequest): Promise<ProfileRecord | null> {
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  let profile = await loadProfile(session.profileId);
  // A cached copy can be stale (password just changed on another route/instance):
  // before rejecting a signed cookie on a version mismatch, confirm against the database.
  if (profile && (profile.token_version ?? 0) !== session.version) {
    invalidateProfileCache(session.profileId);
    profile = await loadProfile(session.profileId);
  }
  if (!profile || profile.role !== 'student' || !profile.application_id) return null;
  // Deliberately uncached: a rejected/revoked student must lose course access immediately,
  // including signed cookies issued on another server instance. Missing schema fails closed.
  const access = await db.getStudentAccess(profile.id);
  if (!access || access.role !== 'student' || access.application_id !== profile.application_id || access.approval_status !== 'approved' || access.token_version !== session.version) {
    invalidateProfileCache(profile.id);
    return null;
  }
  if ((profile.token_version ?? 0) !== session.version) return null;
  return { ...profile, course_id: access.course_id };
}

/** Strip server-only fields before sending a profile to the browser. */
export function publicProfile(profile: ProfileRecord) {
  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    college: profile.college,
    roll_number: profile.roll_number,
    course_id: profile.course_id ?? null,
  };
}

// ==================== ADMIN SESSION ====================

export function isAdmin(req: NextRequest): boolean {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

/**
 * Guard for admin routes. Returns a NextResponse to send back when the request is
 * not an authenticated admin (or fails the CSRF origin check); returns null when OK.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (req.method !== 'GET' && !isSameOrigin(req)) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  }
  return null;
}
