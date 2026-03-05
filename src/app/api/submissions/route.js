/**
 * POST /api/submissions
 * 
 * PRODUCTION (Vercel): Parses Enketo XML and writes the result to Supabase.
 * LOCAL (Express): Uses SQLite via server/index.js (kept for field use).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req) {
    try {
        const { xml } = await req.json();
        if (!xml) {
            return NextResponse.json({ error: "Body must contain 'xml'" }, { status: 400 });
        }

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                error: "Supabase not configured.",
            }, { status: 503 });
        }

        // Parse the Enketo XML to extract fields
        const { enketoToHffRow } = await import("@/lib/server/enketoMapper");
        const row = enketoToHffRow(xml, 0);

        if (!row) {
            return NextResponse.json({ error: "Failed to parse XML submission" }, { status: 400 });
        }

        // Convert row array to structured Supabase record
        const [, firstName, lastName, gender, age, , education, maritalStatus, , occupation, ...attendanceDays] = row;

        const attendance = attendanceDays.map(v => v === "1" || v === 1 || v === true);
        const uuid = crypto.randomUUID();

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('registrations')
            .insert({
                uuid,
                first_name: firstName,
                last_name: lastName,
                gender,
                age: parseInt(age) || null,
                education,
                marital_status: maritalStatus,
                occupation,
                attendance,
                type: 'participant',
                source: 'enketo',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select();

        if (error) throw error;

        return NextResponse.json({ ok: true, uuid, id: data?.[0]?.id });
    } catch (err) {
        console.error('[API] /api/submissions error:', err);
        return NextResponse.json({
            error: "Failed to sync submission",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
