/**
 * POST /api/cloud/sync
 * 
 * PRODUCTION (Vercel): Reads from Supabase and syncs to Google Sheets as backup.
 * LOCAL (Express): Reads from SQLite and syncs to Google Sheets.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST() {
    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                error: "Supabase not configured.",
            }, { status: 503 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Read all registrations from Supabase
        const { data: registrations, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Convert to row format for Google Sheets
        const headerRow = ["No.", "First Name", "Last Name", "Gender", "Age", "Other", "Education", "Marital Status", "Other", "Occupation",
            "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Day 11", "Day 12"];
        const dateRow = ["", "", "", "", "", "", "", "", "", "DATE:", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

        const dataRows = (registrations || []).map((r, i) => {
            const att = r.attendance || [];
            return [
                i + 1,
                r.first_name || '',
                r.last_name || '',
                r.gender || '',
                r.age || '',
                '',
                r.education || '',
                r.marital_status || '',
                '',
                r.occupation || '',
                ...Array.from({ length: 12 }, (_, d) => att[d] ? "1" : ""),
            ];
        });

        const values = [headerRow, dateRow, ...dataRows];

        // Write to Google Sheets
        const { writeRegister } = await import("@/lib/server/googleSheets");
        console.log(`[API] Syncing ${dataRows.length} rows to Google Sheets from Supabase...`);
        await writeRegister(values);

        return NextResponse.json({
            ok: true,
            message: `Successfully synced ${dataRows.length} registrations to Google Sheets`,
        });
    } catch (err) {
        console.error('[API] /api/cloud/sync error:', err);
        return NextResponse.json({
            error: "Failed to sync to cloud",
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}
