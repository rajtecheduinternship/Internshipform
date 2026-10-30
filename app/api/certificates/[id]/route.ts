import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/lms';

// Certificate verification is public by design (QR on the certificate), so it only
// returns what is printed on the certificate itself - never DOB, address, phone, e-mail, photo.
const CERT_APPLICATION_FIELDS = [
  'student_name', 'father_name', 'college_name', 'course', 'current_semester',
  'university_roll_number', 'university_registration_number', 'internship_topic',
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const certificate = await db.getCertificateById(id);
    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const application = await db.getApplicationById(certificate.application_id);
    if (!application) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const publicApplication = Object.fromEntries(CERT_APPLICATION_FIELDS.map((k) => [k, application[k]]));

    return NextResponse.json(
      { success: true, data: { certificate, application: publicApplication } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching certificate:', error);
    return NextResponse.json({ error: 'Failed to fetch certificate' }, { status: 500 });
  }
}
