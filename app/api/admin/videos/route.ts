import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminCreateVideo, isUuid } from '@/lib/lms';
import { cleanText } from '@/lib/security';
import { clampInt, parseYouTubeId, safeUrl } from '@/lib/validate';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const title = cleanText(String(b?.title || ''), 200);
  const youtubeId = parseYouTubeId(b?.youtube_url ?? b?.youtube_video_id);
  if (!isUuid(b?.module_id)) return NextResponse.json({ error: 'module_id is required' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!youtubeId) return NextResponse.json({ error: 'Enter a valid YouTube link or video ID' }, { status: 400 });
  const duration = clampInt(b?.duration_seconds, 1, 86400, 0);
  if (!duration) return NextResponse.json({ error: 'Duration (seconds) is required' }, { status: 400 });

  try {
    const video = await adminCreateVideo({
      module_id: b.module_id,
      title,
      description: cleanText(String(b?.description || ''), 2000),
      youtube_video_id: youtubeId,
      thumbnail_url: safeUrl(b?.thumbnail_url),
      duration_seconds: duration,
      required_watch_percent: clampInt(b?.required_watch_percent, 1, 100, 90),
      is_published: b?.is_published !== false,
    });
    return NextResponse.json({ video }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }
}
