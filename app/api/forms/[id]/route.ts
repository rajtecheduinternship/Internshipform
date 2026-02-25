import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Form ID is required' },
        { status: 400 }
      );
    }

    // Fetch the form data from database
    const formData = await db.getApplicationById(id);

    if (!formData) {
      return NextResponse.json(
        { error: 'Form not found or has expired' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: formData },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form data' },
      { status: 500 }
    );
  }
}

