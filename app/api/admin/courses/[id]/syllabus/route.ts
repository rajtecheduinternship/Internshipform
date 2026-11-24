import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { LearningError, learningErrorResponse, readLearningJson } from '@/lib/learning-errors';
import { adminSyllabus, adminSyllabusFile, deleteSyllabus, MAX_SYLLABUS_BYTES, pdfResponse, readBounded, saveSyllabus, setSyllabusPublished, validatePdf } from '@/lib/syllabus';
type Ctx = { params: Promise<{ id: string }> };
const noStore = { headers: { 'Cache-Control': 'no-store' } };
/** GET → metadata; GET ?file=1 → the PDF itself, so the admin can preview before publishing. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const id = (await ctx.params).id;
    if (req.nextUrl.searchParams.get('file')) { const f = await adminSyllabusFile(id); return pdfResponse(f.data, f.filename, false); }
    return NextResponse.json({ syllabus: await adminSyllabus(id) }, noStore);
  } catch (e) { return learningErrorResponse(e); }
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const body = await readBounded(req, MAX_SYLLABUS_BYTES);
    const form = await new Request(req.url, { method: 'POST', headers: { 'content-type': req.headers.get('content-type') || '' }, body }).formData()
      .catch(() => { throw new LearningError('Upload a valid PDF file.'); });
    const file = form.get('file');
    if (!(file instanceof File)) throw new LearningError('Upload a PDF file.');
    const data = Buffer.from(await file.arrayBuffer());
    return NextResponse.json({ syllabus: await saveSyllabus((await ctx.params).id, data, validatePdf(data, file.name)) }, { status: 201, ...noStore });
  } catch (e) { return learningErrorResponse(e); }
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    const d = await readLearningJson(req);
    return NextResponse.json({ syllabus: await setSyllabusPublished((await ctx.params).id, d.is_published) }, noStore);
  } catch (e) { return learningErrorResponse(e); }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(req); if (denied) return denied;
  try { await deleteSyllabus((await ctx.params).id); return NextResponse.json({ ok: true }, noStore); }
  catch (e) { return learningErrorResponse(e); }
}
