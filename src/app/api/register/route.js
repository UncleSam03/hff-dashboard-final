/**
 * PUT /api/register
 * 
 * PRODUCTION (Vercel): Writes registration rows directly to Supabase.
 * Accepts legacy row-array format and converts to structured Supabase records.
 *
 * LOCAL (Express): Uses SQLite via server/index.js (kept for field use).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function PUT(req) {
    try {
        const { rows } = await req.json();
        if (!Array.isArray(rows) || !rows.every((r) => Array.isArray(r))) {
            return NextResponse.json({ error: "Body must be { rows: any[][] }" }, { status: 400 });
        }

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                error: "Supabase not configured.",
            }, { status: 503 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Skip header rows (first 2), convert remaining to Supabase records
        const dataRows = rows.slice(2);
        const records = dataRows.map(row => ({
            uuid: crypto.randomUUID(),
            first_name: row[1] || '',
            last_name: row[2] || '',
            gender: row[3] || '',
            age: parseInt(row[4]) || null,
            education: row[6] || '',
            marital_status: row[7] || '',
            occupation: row[9] || '',
            attendance: (row.slice(10) || []).map(v => v === "1" || v === 1 || v === true),
            type: 'participant',
            source: 'api_register',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        if (records.length > 0) {
            const { error } = await supabase
                .from('registrations')
                .insert(records);

            if (error) throw error;
        }

        return NextResponse.json({
            ok: true,
            inserted: records.length,
        });
    } catch (err) {
        console.error('[API] /api/register error:', err);
        return NextResponse.json({
            error: "Failed to write register",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
