import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminDeleteVideo, adminUpdateVideo, isUuid } from '@/lib/lms';
import { cleanText } from '@/lib/security';
import { clampInt, parseYouTubeId, safeUrl } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Parameters<typeof adminUpdateVideo>[1] = {};
  if (b.title !== undefined) {
    const t = cleanText(String(b.title), 200);
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = t;
  }
  if (b.description !== undefined) patch.description = cleanText(String(b.description), 2000);
  if (b.youtube_url !== undefined || b.youtube_video_id !== undefined) {
    const y = parseYouTubeId(b.youtube_url ?? b.youtube_video_id);
    if (!y) return NextResponse.json({ error: 'Enter a valid YouTube link or video ID' }, { status: 400 });
    patch.youtube_video_id = y;
  }
  if (b.thumbnail_url !== undefined) patch.thumbnail_url = safeUrl(b.thumbnail_url);
  if (b.duration_seconds !== undefined) patch.duration_seconds = clampInt(b.duration_seconds, 1, 86400, 1);
  if (b.required_watch_percent !== undefined) patch.required_watch_percent = clampInt(b.required_watch_percent, 1, 100, 90);
  if (b.order_index !== undefined) patch.order_index = clampInt(b.order_index, 0, 10000, 0);
  if (b.is_published !== undefined) patch.is_published = Boolean(b.is_published);
  if (b.archived !== undefined) patch.archived = Boolean(b.archived);

  const video = await adminUpdateVideo(id, patch);
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ video });
}

/** Permanent delete. Prefer PATCH {archived:true}, which keeps students' progress. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id) || !(await adminDeleteVideo(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
