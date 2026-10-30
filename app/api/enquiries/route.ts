import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getClientIp, isSameOrigin, requireAdmin } from '@/lib/auth';
import { cleanText, containsSpam, isValidEmail } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });

    const limit = await db.checkRateLimit(getClientIp(req), 'enquiry', 5, 60 * 60 * 1000, true);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many enquiries. Please try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const full_name = cleanText(String(body?.full_name || ''), 100);
    const email = cleanText(String(body?.email || ''), 254).toLowerCase();
    const phone = String(body?.phone || '').replace(/\D/g, '').slice(-10);
    const college = cleanText(String(body?.college || ''), 200);
    const course_interest = cleanText(String(body?.course_interest || ''), 150);
    const message = cleanText(String(body?.message || ''), 1000);

    if (!full_name || !email || !phone) {
      return NextResponse.json({ error: 'Please provide full name, email, and phone number' }, { status: 400 });
    }
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    if (!/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 });
    if (containsSpam(message) || containsSpam(full_name)) {
      return NextResponse.json({ error: 'Your message looks like spam.' }, { status: 400 });
    }

    const { id, error } = await db.insertEnquiry({ full_name, email, phone, college, course_interest, message });
    if (error) {
      console.error('Enquiry insert error:', error);
      return NextResponse.json({ error: 'Failed to record enquiry' }, { status: 500 });
    }
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Enquiry API exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { data, error } = await db.getAllEnquiries();
    if (error) return NextResponse.json({ error: 'Failed to fetch enquiries' }, { status: 500 });
    return NextResponse.json({ enquiries: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Enquiries GET exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
