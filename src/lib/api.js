import { getEnv } from './env';

const API_KEY = process.env.NEXT_PUBLIC_HFF_API_KEY || process.env.VITE_HFF_API_KEY || "";

/**
 * Enhanced fetch wrapper that automatically adds API key headers
 */
export async function hffFetch(url, options = {}) {
    const headers = {
        ...options.headers,
    };

    if (API_KEY) {
        headers['x-api-key'] = API_KEY;
    }

    console.log(`[hffFetch] Requesting: ${url}`, { headers });
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        console.log(`[hffFetch] Response from ${url}: Status ${response.status}`);
        return response;
    } catch (error) {
        console.error(`[hffFetch] Fetch error for ${url}:`, error);
        throw error;
    }
}
