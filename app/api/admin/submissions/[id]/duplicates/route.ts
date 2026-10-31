import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPgPool } from '@/lib/db';
import { findDuplicates } from '@/lib/duplicates';
import { isUuid } from '@/lib/lms';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid application' }, { status: 400 });

  try {
    const { rows } = await getPgPool().query(
      `SELECT student_name, father_name, mother_name, date_of_birth::text AS date_of_birth, contact_number, email_address, university_roll_number, college_name
       FROM internship_applications WHERE id = $1`, [id]);
    const a = rows[0];
    if (!a) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const matches = await findDuplicates({
      studentName: a.student_name, fatherName: a.father_name, dateOfBirth: a.date_of_birth,
      phone: a.contact_number, email: a.email_address, roll: a.university_roll_number, excludeId: id,
    });
    return NextResponse.json({ current: a, matches }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  } catch (error) {
    console.error('Duplicate check error:', error);
    return NextResponse.json({ error: 'Could not check for duplicates' }, { status: 500 });
  }
}
