/**
 * Universal environment variable accessor
 * Works in Vite (import.meta.env) and Next.js (process.env)
 */
export function getEnv(name) {
    // Standard Next.js client-side compatibility (static access)
    // Dynamic access process.env[name] fails in Next.js browser bundles.
    if (name === 'NEXT_PUBLIC_SUPABASE_URL') return process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (name === 'VITE_SUPABASE_URL') return process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (name === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY') return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    if (name === 'VITE_SUPABASE_ANON_KEY') return process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (name === 'HFF_API_KEY' || name === 'VITE_HFF_API_KEY') return process.env.NEXT_PUBLIC_HFF_API_KEY || process.env.VITE_HFF_API_KEY || process.env.HFF_API_KEY;

    // Fallback for non-standard keys or server-side
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }
    if (typeof process !== 'undefined' && process.env && process.env[`NEXT_PUBLIC_${name}`]) {
        return process.env[`NEXT_PUBLIC_${name}`];
    }
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
        return import.meta.env[name];
    }
    return undefined;
}
