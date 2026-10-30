import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, isSameOrigin } from '@/lib/auth';
import { recordWatchEvent } from '@/lib/lms';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const ok = await recordWatchEvent({
      studentEmail: profile.email.toLowerCase(),
      sessionId: String(body?.session_id || ''),
      eventType: String(body?.event_type || ''),
      videoTime: Number(body?.video_time || 0),
    });
    // 404 when the session is not the caller's or the event type is not allowed
    if (!ok) return NextResponse.json({ error: 'Invalid event' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watch event API exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
