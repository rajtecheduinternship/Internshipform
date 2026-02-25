import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { uploadCertificatePDF } from '@/lib/storage';
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
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    const password = authHeader?.replace('Bearer ', '') ?? '';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || !safeCompare(password, adminPassword)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { applicationId, rtsRegNumber, marks, startDate, endDate } = body;

    if (!applicationId || typeof applicationId !== 'string') {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }
    if (!rtsRegNumber || typeof rtsRegNumber !== 'string' || rtsRegNumber.trim() === '') {
      return NextResponse.json({ error: 'rtsRegNumber is required' }, { status: 400 });
    }
    if (typeof marks !== 'number' || !Number.isInteger(marks) || marks < 0 || marks > 100) {
      return NextResponse.json({ error: 'marks must be an integer between 0 and 100' }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Fetch application
    const application = await db.getApplicationById(applicationId);
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Check for existing certificate
    const existing = await db.getCertificateByApplicationId(applicationId);
    if (existing) {
      return NextResponse.json(
        {
          error: 'Certificate already exists for this application',
          certificateId: existing.id,
          serialNumber: existing.serial_number,
          certificateUrl: existing.certificate_url,
        },
        { status: 409 }
      );
    }

    // Calculate grade
    const { grade, gradePoint } = calculateGrade(marks);

    // Get serial number
    const serialNumber = await db.getNextCertificateSerial(new Date().getFullYear());

    // Insert certificate record first (need UUID for QR code)
    const { error: insertError, id: certId } = await db.insertCertificate({
      application_id: applicationId,
      serial_number: serialNumber,
      rts_reg_number: rtsRegNumber.trim(),
      marks,
      grade,
      grade_point: gradePoint,
      start_date: startDate,
      end_date: endDate,
    });

    if (insertError || !certId) {
      console.error('Failed to insert certificate:', insertError);
      return NextResponse.json({ error: 'Failed to create certificate record' }, { status: 500 });
    }

    // Determine base URL
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;

    // Generate PDF
    const pdfBuffer = await generateCertificatePDF({
      application,
      marks,
      grade,
      gradePoint,
      startDate,
      endDate,
      serialNumber,
      rtsRegNumber: rtsRegNumber.trim(),
      certId,
      baseUrl,
    });

    // Upload PDF
    const pdfUrl = await uploadCertificatePDF(pdfBuffer, certId);

    // Update URL in DB
    if (pdfUrl) {
      await db.updateCertificateUrl(certId, pdfUrl);
    }

    const viewUrl = `${baseUrl}/certificate/view/${certId}`;

    return NextResponse.json(
      {
        success: true,
        certificateId: certId,
        serialNumber,
        grade,
        gradePoint,
        certificateUrl: pdfUrl,
        viewUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Certificate generation error:', error);
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 });
  }
}
