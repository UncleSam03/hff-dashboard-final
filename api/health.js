// Health check endpoint
// No longer depends on Supabase. Returns healthy if the API layer is reachable.
export default async function handler(req, res) {
    res.status(200).json({
        status: 'healthy',
        backend: 'firebase',
        timestamp: new Date().toISOString()
    });
}
