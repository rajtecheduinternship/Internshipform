import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getSessionProfile, isSameOrigin } from '@/lib/auth';
import { getVideoAccessMeta, startWatchSession } from '@/lib/lms';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const video = await getVideoAccessMeta(String(body?.video_id || ''), profile.course_id);
    if (!video) return NextResponse.json({ error: 'Video not available' }, { status: 404 });

    const sessionId = await startWatchSession({
      studentEmail: profile.email.toLowerCase(),
      videoId: video.id,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') || '',
    });
    return NextResponse.json({ success: true, session_id: sessionId });
  } catch (error) {
    console.error('Session API exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
