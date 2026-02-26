import { createClient } from "@supabase/supabase-js";

import { getEnv } from "./env.js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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

export { supabase, isConfigured };
