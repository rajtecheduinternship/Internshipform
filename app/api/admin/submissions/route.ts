import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';

const adminRateLimit = new Map<string, { count: number; timestamp: number }>();
const ADMIN_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ADMIN_ATTEMPTS = 10; // 10 attempts per 15 mins

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  try {
    // Ensure both strings are the same length by padding
    const bufA = Buffer.from(a.padEnd(Math.max(a.length, b.length)));
    const bufB = Buffer.from(b.padEnd(Math.max(a.length, b.length)));

    // If lengths differ after padding, they're not equal
    if (bufA.length !== bufB.length) {
      return false;
    }

    return timingSafeEqual(bufA, bufB) && a.length === b.length;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Basic Rate Limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const now = Date.now();
    const record = adminRateLimit.get(ip);

    if (record) {
      if (now - record.timestamp > ADMIN_RATE_LIMIT_WINDOW) {
        adminRateLimit.set(ip, { count: 1, timestamp: now });
      } else {
        if (record.count >= MAX_ADMIN_ATTEMPTS) {
          return NextResponse.json(
            { error: 'Too many login attempts. Please try again later.' },
            { status: 429 }
          );
        }
        record.count++;
        adminRateLimit.set(ip, record);
      }
    } else {
      adminRateLimit.set(ip, { count: 1, timestamp: now });
    }

    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    const password = authHeader?.replace('Bearer ', '');
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Use timing-safe comparison to prevent timing attacks
    if (!password || !safeCompare(password, adminPassword)) {
      // Track failed attempts for potential IP banning
      console.log(`Failed admin login attempt from IP: ${ip}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch submissions from database
    const { data: submissions, error } = await db.getAllApplications();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }

    // Add security headers to response
    const response = NextResponse.json({ submissions }, { status: 200 });
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
