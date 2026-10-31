import { NextRequest, NextResponse } from 'next/server';
import { hashCustomPassword, hashPassword, invalidateProfileCache, requireAdmin } from '@/lib/auth';
import { cleanText, isValidEmail } from '@/lib/security';
import { adminStudentDetail, adminUpdateStudent, isUuid, type StudentEdit } from '@/lib/lms';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const detail = await adminStudentDetail((await params).id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
}

const TEXT_LIMITS: Record<string, number> = {
  full_name: 100, college: 200, roll_number: 50, father_name: 100, mother_name: 100, gender: 20, address: 500,
};

/**
 * Admin can edit any detail of a student: profile, application details, course and password.
 * Body: any of the fields below, plus `password` (a new custom password) or `reset_password: true`
 * (back to the student's roll number). Changing the password signs the student out everywhere.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!isUuid(id) || !b || typeof b !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const edit: StudentEdit = {};
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    if (b[key] === undefined) continue;
    const v = cleanText(String(b[key] ?? ''), max);
    if (!v) return NextResponse.json({ error: `${key.replace(/_/g, ' ')} cannot be empty` }, { status: 400 });
    (edit as Record<string, unknown>)[key] = v;
  }
  if (b.phone !== undefined) {
    const phone = String(b.phone).replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) return NextResponse.json({ error: 'Phone must be 10 digits' }, { status: 400 });
    edit.phone = phone;
  }
  if (b.whatsapp_number !== undefined) {
    const w = String(b.whatsapp_number || '').replace(/\D/g, '').slice(-10);
    if (w && w.length !== 10) return NextResponse.json({ error: 'WhatsApp number must be 10 digits' }, { status: 400 });
    edit.whatsapp_number = w || undefined;
  }
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    edit.email = email;
  }
  if (b.date_of_birth !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date_of_birth)) || Number.isNaN(Date.parse(String(b.date_of_birth)))) {
      return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
    }
    edit.date_of_birth = String(b.date_of_birth);
  }
  if (b.course_id !== undefined) {
    if (b.course_id !== null && !isUuid(String(b.course_id))) return NextResponse.json({ error: 'Invalid course' }, { status: 400 });
    edit.course_id = b.course_id === null ? null : String(b.course_id);
  }
  if (b.reset_password === true) {
    const roll = edit.roll_number ?? String((await adminStudentDetail(id))?.profile.roll_number ?? '');
    if (!roll) return NextResponse.json({ error: 'This student has no roll number to reset the password to' }, { status: 400 });
    edit.password_hash = await hashPassword(roll);
  } else if (b.password !== undefined) {
    const pw = String(b.password);
    if (pw.length < 6 || pw.length > 100) return NextResponse.json({ error: 'Password must be 6 to 100 characters' }, { status: 400 });
    edit.password_hash = await hashCustomPassword(pw);
  }
  if (!Object.keys(edit).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  try {
    if (!(await adminUpdateStudent(id, edit))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '23505') return NextResponse.json({ error: 'Another student already uses this phone, email or roll number.' }, { status: 409 });
    if (code === '23503') return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    console.error('Student update error:', error);
    return NextResponse.json({ error: 'Could not save changes' }, { status: 500 });
  }
  invalidateProfileCache(id); // changes show up on the student's next request on this instance
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
