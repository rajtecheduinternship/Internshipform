import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { LearningError, learningErrorResponse } from '@/lib/learning-errors';
import { importWordQuestions, MAX_WORD_BYTES } from '@/lib/question-import';
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req); if (denied) return denied;
  try {
    // Bound the actual stream, not only the user-controlled Content-Length header.
    const reader = req.body?.getReader(); if (!reader) throw new LearningError('Upload a Word document.');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > MAX_WORD_BYTES + 16384) { await reader.cancel(); throw new LearningError('Upload a .docx file up to 2 MB.'); } chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const bounded = new Request(req.url, { method: 'POST', headers: { 'content-type': req.headers.get('content-type') || '' }, body: Buffer.concat(chunks) });
    const form = await bounded.formData().catch(() => { throw new LearningError('Upload a valid multipart Word document.'); }); const file = form.get('file');
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.docx') || file.size > MAX_WORD_BYTES) throw new LearningError('Upload a .docx file up to 2 MB.');
    return NextResponse.json({ questions: importWordQuestions(Buffer.from(await file.arrayBuffer())) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return learningErrorResponse(e); }
}
