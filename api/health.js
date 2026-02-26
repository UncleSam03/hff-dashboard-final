import { supabase } from '../src/lib/supabase.js';

export default async function handler(req, res) {
    try {
        // Simple health check to verify Supabase connectivity
        const { data, error } = await supabase.from('notes').select('count', { count: 'exact', head: true });

        if (error) throw error;

        res.status(200).json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Health] Supabase connection failed:', err);
        res.status(503).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
}

