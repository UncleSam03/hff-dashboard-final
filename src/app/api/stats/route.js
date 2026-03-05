/**
 * GET /api/stats
 * 
 * PRODUCTION (Vercel): Reads registrations from Supabase (source of truth).
 * The ?source=cloud param is still respected for backward compatibility,
 * but both paths now read from Supabase.
 *
 * LOCAL (Express): Uses SQLite via server/index.js (kept for field use).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                error: "Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
            }, { status: 503 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch all registrations from Supabase
        const { data: registrations, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({
            registrations: registrations || [],
            source: 'supabase',
            count: registrations?.length || 0,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[API] /api/stats error:', err);
        return NextResponse.json({
            error: "Failed to load stats",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
