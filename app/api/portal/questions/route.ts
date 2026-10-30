import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionProfile, isSameOrigin } from '@/lib/auth';
import { getVideoAccessMeta, studentAskQuestion, studentListQuestions } from '@/lib/lms';
import { cleanText, containsSpam } from '@/lib/security';

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ questions: await studentListQuestions(profile.id) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const profile = await getSessionProfile(req);
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // 10 questions per hour per student: enough for real doubts, not enough to flood the admin.
  const key = `q:${profile.id}`;
  const limit = await db.checkRateLimit(key, 'question', 10, 60 * 60 * 1000, true);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many questions. Please try again later.' }, { status: 429 });

  const b = await req.json().catch(() => null);
  const question = cleanText(String(b?.question || ''), 1000);
  if (question.length < 5) return NextResponse.json({ error: 'Please write your question (at least 5 characters).' }, { status: 400 });
  if (containsSpam(question)) return NextResponse.json({ error: 'Your question looks like spam.' }, { status: 400 });

  // Optional lecture: must be one this student can actually see.
  let videoId: string | null = null;
  if (b?.video_id) {
    const v = await getVideoAccessMeta(String(b.video_id), profile.course_id);
    if (!v) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
    videoId = v.id;
  }
  const id = await studentAskQuestion(profile.id, question, videoId);
  return NextResponse.json({ success: true, id }, { status: 201 });
}
