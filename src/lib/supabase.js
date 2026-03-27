import { createClient } from "@supabase/supabase-js";

import { getEnv } from "./env.js";

const supabaseUrl =
    getEnv("VITE_SUPABASE_URL") ||
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    getEnv("SUPABASE_URL");
const supabaseAnonKey =
    getEnv("VITE_SUPABASE_ANON_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_ANON_KEY");

// Resilient configuration check
const isConfigured =
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== "YOUR_SUPABASE_URL" &&
    supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY";

let supabase = null;

if (isConfigured) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// #region agent log
try {
    const host = (() => {
        try {
            return supabaseUrl ? new URL(supabaseUrl).host : null;
        } catch {
            return "invalid_url";
        }
    })();
    fetch('http://127.0.0.1:7491/ingest/d310bdd2-b950-4c68-be76-23013d6da606', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b0c4c' },
        body: JSON.stringify({
            sessionId: '4b0c4c',
            runId: 'baseline',
            hypothesisId: 'A',
            location: 'src/lib/supabase.js:log_config',
            message: 'Supabase configuration snapshot',
            data: { isConfigured: !!isConfigured, hasUrl: !!supabaseUrl, urlHost: host, hasAnonKey: !!supabaseAnonKey },
            timestamp: Date.now()
        })
    }).catch(() => { });
} catch { }
// #endregion agent log

export { supabase, isConfigured };
