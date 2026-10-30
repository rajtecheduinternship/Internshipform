import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { getVideoForStudent } from '@/lib/lms';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const { id } = await params;
    const video = await getVideoForStudent(id, profile.course_id, profile.id);
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    return NextResponse.json({ video });
  } catch (error) {
    console.error('Video GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}
