/**
 * Universal environment variable accessor
 * Works in Vite (import.meta.env) and Node.js (process.env)
 */
export function getEnv(name) {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
        return import.meta.env[name];
    }
    return undefined;
}
