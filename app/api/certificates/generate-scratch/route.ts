import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { uploadCertificatePDF, uploadImagesToStorage } from '@/lib/storage';
import { calculateGrade, generateCertificatePDF } from '@/lib/certificate';

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a.padEnd(Math.max(a.length, b.length)));
    const bufB = Buffer.from(b.padEnd(Math.max(a.length, b.length)));
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB) && a.length === b.length;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('Authorization');
  const password = authHeader?.replace('Bearer ', '') ?? '';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || !safeCompare(password, adminPassword)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    studentName, fatherName, gender = 'Male',
    dob, contact, email,
    course, college, honoursSubject, semester,
    rollNo, regNo, classRoll, topic,
    photo,
    rtsRegNumber, marks, startDate, endDate,
  } = body as Record<string, string | number | null | undefined>;

  // Validate required fields
  const required: Record<string, unknown> = { studentName, fatherName, course, college, semester, rollNo, regNo, classRoll, topic, rtsRegNumber, startDate, endDate };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
  }
  if (typeof marks !== 'number' || !Number.isInteger(marks) || marks < 0 || marks > 100) {
    return NextResponse.json({ error: 'marks must be an integer between 0 and 100' }, { status: 400 });
  }

  // Handle photo upload (Supabase in prod, base64 fallback in local dev)
  let photoUrl: string | undefined;
  if (photo && typeof photo === 'string') {
    const { photoUrl: uploaded } = await uploadImagesToStorage(photo, undefined, String(rollNo));
    photoUrl = uploaded;
  }

  // Auto-generate email if not provided
  const emailAddress = (email && String(email).trim())
    ? String(email).trim()
    : `cert-${String(rollNo).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}@rts-generated.local`;

  // Insert application record
  const { error: appError, id: applicationId } = await db.insertApplication({
    student_name: String(studentName),
    father_name: String(fatherName),
    mother_name: 'N/A',
    gender: String(gender),
    date_of_birth: dob ? String(dob) : '2000-01-01',
    address: 'N/A',
    internship_topic: String(topic),
    course: String(course),
    college_name: String(college),
    honours_subject: honoursSubject ? String(honoursSubject) : String(course),
    current_semester: String(semester),
    class_roll_no: String(classRoll),
    university_name: 'Patliputra University',
    university_roll_number: String(rollNo),
    university_registration_number: String(regNo),
    contact_number: contact ? String(contact) : 'N/A',
    email_address: emailAddress,
    photo: photoUrl,
  });

  if (appError || !applicationId) {
    // Check if it's a duplicate roll number
    const existing = await db.findByRollNumber(String(rollNo));
    if (existing) {
      return NextResponse.json({
        error: `A student with roll number "${rollNo}" already exists in the system. Use the "Certificate" button next to their name in the table instead.`,
      }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed to create student record: ${appError?.message}` }, { status: 500 });
  }

  // Fetch the full application record for PDF generation
  const application = await db.getApplicationById(applicationId);
  if (!application) {
    return NextResponse.json({ error: 'Failed to retrieve application after insert' }, { status: 500 });
  }

  // Calculate grade + serial
  const { grade, gradePoint } = calculateGrade(marks);
  const serialNumber = await db.getNextCertificateSerial(new Date().getFullYear());

  // Insert certificate record (UUID needed for QR code URL)
  const { error: certInsertError, id: certId } = await db.insertCertificate({
    application_id: applicationId,
    serial_number: serialNumber,
    rts_reg_number: String(rtsRegNumber).trim(),
    marks,
    grade,
    grade_point: gradePoint,
    start_date: String(startDate),
    end_date: String(endDate),
  });

  if (certInsertError || !certId) {
    console.error('Failed to insert certificate:', certInsertError);
    return NextResponse.json({ error: 'Failed to create certificate record' }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;

  // Generate PDF
  const pdfBuffer = await generateCertificatePDF({
    application,
    marks,
    grade,
    gradePoint,
    startDate: String(startDate),
    endDate: String(endDate),
    serialNumber,
    rtsRegNumber: String(rtsRegNumber).trim(),
    certId,
    baseUrl,
  });

  // Upload PDF
  const pdfUrl = await uploadCertificatePDF(pdfBuffer, certId);
  if (pdfUrl) {
    await db.updateCertificateUrl(certId, pdfUrl);
  }

  const viewUrl = `${baseUrl}/certificate/view/${certId}`;

  return NextResponse.json({
    success: true,
    certificateId: certId,
    applicationId,
    serialNumber,
    grade,
    gradePoint,
    certificateUrl: pdfUrl,
    viewUrl,
  }, { status: 200 });
}
