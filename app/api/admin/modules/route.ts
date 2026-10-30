import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminCreateModule, adminListModules } from '@/lib/lms';
import { cleanText } from '@/lib/security';
import { safeUrl } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ modules: await adminListModules() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const title = cleanText(String(b?.title || ''), 150);
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const mod = await adminCreateModule({
    title,
    description: cleanText(String(b?.description || ''), 2000),
    thumbnail_url: safeUrl(b?.thumbnail_url),
    is_mandatory: b?.is_mandatory === true,
  });
  return NextResponse.json({ module: mod }, { status: 201 });
}
