import { enketoToHffRow } from '../server/enketoMapper.js';
import { supabase } from '../src/lib/supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { xml } = req.body || {};
        if (!xml) {
            return res.status(400).json({ error: "Body must contain 'xml'" });
        }

        console.log('[API] Received Enketo submission XML');

        // Parse XML using existing mapper
        // Note: nextId is used for legacy local ID, might not be needed for Supabase UUIDs
        // blocked by not having DB access. We'll pass "N/A" or fetch count if critical,
        // but for Supabase we rely on UUID/Identity.
        const row = enketoToHffRow(xml, "N/A");

        if (!row) {
            return res.status(400).json({ error: "Failed to parse XML submission" });
        }

        // Map the array row back to an object for Supabase
        // Row structure from mapper:
        // [0:id, 1:fname, 2:lname, 3:gender, 4:age, 5:other1, 6:edu, 7:marital, 8:other2, 9:occup, 10..27:attendance]
        const record = {
            first_name: row[1],
            last_name: row[2],
            gender: row[3],
            age: row[4],
            other_1: row[5],
            education: row[6],
            marital_status: row[7],
            other_2: row[8],
            occupation: row[9],
            attendance: JSON.stringify(row.slice(10)),
            updated_at: new Date().toISOString(),
            sync_status: 'synced', // It's directly on the server
            source: 'web_submission'
        };

        // Insert into Supabase
        const { data, error } = await supabase
            .from('registrations')
            .insert([record])
            .select();

        if (error) {
            throw error;
        }

        console.log(`[API] Saved submission to Supabase: ${data[0]?.id}`);
        res.status(200).json({ ok: true, id: data[0]?.id });

    } catch (err) {
        console.error('[API] /api/submissions error:', err);
        res.status(500).json({
            error: "Failed to save submission",
            details: err instanceof Error ? err.message : String(err),
        });
    }
}
