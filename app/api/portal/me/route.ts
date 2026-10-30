import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, publicProfile } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile(req);
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ profile: publicProfile(profile) });
}
