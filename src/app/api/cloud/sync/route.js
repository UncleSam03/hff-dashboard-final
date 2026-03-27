/**
 * POST /api/cloud/sync
 * 
 * Deprecated: Google Sheets integration removed. Supabase is the source of truth.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Google Sheets integration has been removed. No cloud sync required.",
    },
    { status: 410 }
  );
}
