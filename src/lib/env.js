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
        if (name === "VITE_FIREBASE_API_KEY") return import.meta.env.VITE_FIREBASE_API_KEY;
        if (name === "VITE_FIREBASE_AUTH_DOMAIN") return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
        if (name === "VITE_FIREBASE_PROJECT_ID") return import.meta.env.VITE_FIREBASE_PROJECT_ID;
        if (name === "VITE_FIREBASE_STORAGE_BUCKET") return import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
        if (name === "VITE_FIREBASE_MESSAGING_SENDER_ID") return import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
        if (name === "VITE_FIREBASE_APP_ID") return import.meta.env.VITE_FIREBASE_APP_ID;

        return import.meta.env[name];
    }
    return undefined;
}
