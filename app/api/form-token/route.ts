import { NextRequest, NextResponse } from 'next/server';
import { createFormToken } from '@/lib/form-token';

/** API routes export HTTP handlers only; reusable token helpers live in lib. */
export async function GET(request: NextRequest) {
  try {
    const clientIP = request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    return NextResponse.json({ token: createFormToken(clientIP) });
  } catch (error) {
    console.error('Form token generation error:', error);
    return NextResponse.json({ error: 'Failed to generate form token' }, { status: 500 });
  }
}
