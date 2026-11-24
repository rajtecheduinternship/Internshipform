import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { adminReport } from '@/lib/attendance-report';
import { generateAttendancePDF } from '@/lib/attendance-pdf';
import { learningErrorResponse } from '@/lib/learning-errors';
import { pdfResponse } from '@/lib/syllabus';
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const r = await adminReport((await ctx.params).id);
    return pdfResponse(generateAttendancePDF(r), `Attendance-${r.ref_no}-${r.student_name.replace(/\s+/g, '_')}.pdf`, !!req.nextUrl.searchParams.get('download'));
  } catch (e) { return learningErrorResponse(e); }
}
