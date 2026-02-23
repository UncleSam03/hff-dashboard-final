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

export { supabase, isConfigured };
