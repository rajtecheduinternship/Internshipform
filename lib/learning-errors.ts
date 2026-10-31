import { NextResponse } from 'next/server';
export class LearningError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function learningErrorResponse(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  if (error instanceof LearningError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Never log the exception object/message: PostgreSQL details or request errors
  // can contain submitted answers, question text or answer-key data.
  console.error('Learning API request failed. Sensitive exception details suppressed.');
  return NextResponse.json({ error: 'Unable to complete request. Please try again.' }, { status: 500 });
}
export function text(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new LearningError(`${name} is required (maximum ${max} characters).`);
  return value.trim();
}

/** Bound the actual input stream before JSON parsing, not just Content-Length. */
export async function readLearningJson(req: Request, maxBytes = 64000): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new LearningError('Request body is required.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.length;
      if (bytes > maxBytes) { await reader.cancel(); throw new LearningError('Request is too large.', 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new LearningError('Invalid request data.');
  return data;
}
