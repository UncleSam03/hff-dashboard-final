/**
 * Universal environment variable accessor
 * Works in Vite (import.meta.env) and Node.js (process.env)
 */
export function getEnv(name) {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }

    // Vite requires static strings for production environment variable replacement.
    // Dynamic access like import.meta.env[name] will NOT work in production.
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (name === "VITE_SUPABASE_URL") return import.meta.env.VITE_SUPABASE_URL;
        if (name === "VITE_SUPABASE_ANON_KEY") return import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (name === "NEXT_PUBLIC_SUPABASE_URL") return import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
        if (name === "NEXT_PUBLIC_SUPABASE_ANON_KEY") return import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (name === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY") return import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

        return import.meta.env[name];
    }
    return undefined;
}
