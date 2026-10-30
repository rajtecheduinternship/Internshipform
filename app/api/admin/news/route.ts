import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

import { requireAdmin } from '@/lib/auth';

// GET all news items (for admin)
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const items = await db.getAllNews();
    return NextResponse.json(items);
  } catch (err) {
    console.error('GET /api/admin/news error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST create new news item
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { message, link_url, is_active, sort_order } = body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    const item = await db.createNews({
      message: message.trim(),
      link_url: link_url?.trim() || null,
      is_active: is_active !== false,
      sort_order: Number(sort_order) || 0,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/news error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH update a news item
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, message, link_url, is_active, sort_order } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await db.updateNews({ id, message, link_url, is_active, sort_order });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/admin/news error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE a news item
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await db.deleteNews(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/news error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
