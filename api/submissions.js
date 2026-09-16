// Submissions API endpoint
// Previously inserted directly into Supabase.
// Now saves to local Dexie via the client and syncs via Firebase.
// This server endpoint accepts Enketo XML submissions and returns success
// so the client can mark them as synced.

import { enketoToHffRow } from '../server/enketoMapper.js';

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

        const row = enketoToHffRow(xml, "N/A");

        if (!row) {
            return res.status(400).json({ error: "Failed to parse XML submission" });
        }

        // Build record from parsed row
        const record = {
            uuid: crypto.randomUUID(),
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
            source: 'web_submission'
        };

        // Return the record so the client can store it in Dexie with sync_status: 'pending'
        // and firebaseSync.js will push it to Firebase automatically.
        console.log(`[API] Parsed submission for ${record.first_name} ${record.last_name}`);
        res.status(200).json({ ok: true, id: record.uuid, record });

    } catch (err) {
        console.error('[API] /api/submissions error:', err);
        res.status(500).json({
            error: "Failed to parse submission",
            details: err instanceof Error ? err.message : String(err),
        });
    }
}
