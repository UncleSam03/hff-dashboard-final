// Notes API endpoint
// Previously used Supabase. Now returns an empty set since notes
// are stored locally and synced via Firebase client SDK.
export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json([]);
    }

    if (req.method === 'POST') {
        // Notes are saved locally via Dexie and synced via Firebase client SDK.
        // This endpoint is a no-op stub for backwards compatibility.
        const { content } = req.body || {};
        return res.status(201).json({
            id: crypto.randomUUID(),
            content: content || '',
            created_at: new Date().toISOString()
        });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
