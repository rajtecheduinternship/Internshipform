import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, isSameOrigin } from '@/lib/auth';
import { getVideoAccessMeta, saveProgress } from '@/lib/lms';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    // sendBeacon posts a Blob, which can arrive as text/plain
    const body = JSON.parse(await req.text());
    const videoId = String(body?.video_id || '');

    // The video must be in the student's own course; duration comes from the DB, not the client.
    const video = await getVideoAccessMeta(videoId, profile.course_id);
    if (!video) return NextResponse.json({ error: 'Video not available' }, { status: 404 });

    const result = await saveProgress({
      studentId: profile.id,
      studentEmail: profile.email.toLowerCase(),
      video,
      intervals: body.watched_intervals,
      position: body.last_watched_position,
    });
    if (result.error) {
      console.error('Heartbeat update error:', result.error);
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }
    return NextResponse.json({ success: true, progress: result.data });
  } catch (error) {
    console.error('Heartbeat API exception:', error);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
