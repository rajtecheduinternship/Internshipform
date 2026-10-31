import { NextResponse } from 'next/server';
export class LearningError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function learningErrorResponse(error: unknown) {
  if (error instanceof LearningError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Learning API failed:', error);
  return NextResponse.json({ error: 'Unable to complete request. Please try again.' }, { status: 500 });
}
export function text(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new LearningError(`${name} is required (maximum ${max} characters).`);
  return value.trim();
}
