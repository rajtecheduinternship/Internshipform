import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionProfile, isAdmin } from '@/lib/auth';
import { isUuid } from '@/lib/lms';

// Fields safe to show to anyone who scans the application QR code.
const PUBLIC_FIELDS = [
  'id', 'student_name', 'college_name', 'university_name', 'university_roll_number',
  'internship_topic', 'created_at', 'approval_status', 'reviewed_at',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const formData = await db.getApplicationById(id);
    if (!formData) {
      return NextResponse.json({ error: 'Form not found or has expired' }, { status: 404 });
    }

    // Full record only for the admin or the student who owns this application.
    let full = isAdmin(request);
    if (!full) {
      const profile = await getSessionProfile(request);
      full = Boolean(profile && profile.application_id === id);
    }

    let data: Record<string, unknown>;
    if (full) {
      const { ip_address, ...rest } = formData; // never expose the submitter's IP
      void ip_address;
      data = rest;
    } else {
      data = Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, formData[k]]));
    }

    return NextResponse.json(
      { success: true, data, restricted: !full },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Failed to fetch form data' }, { status: 500 });
  }
}
