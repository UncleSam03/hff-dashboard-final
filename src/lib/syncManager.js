import { getPendingSubmissions, markAsSynced } from './offlineStorage';
import { hffFetch } from './api';
import { pushPendingToSupabase, pullFromSupabase } from './supabaseSync';

let isSyncing = false;
let isActuallyOnline = navigator.onLine;

/**
 * Checks for true connectivity by pinging the health endpoint.
 */
export async function checkConnectivity() {
    const previousStatus = isActuallyOnline;
    try {
        const resp = await hffFetch('/api/health', {
            method: 'GET',
            cache: 'no-store'
        });
        isActuallyOnline = resp.ok;
    } catch (e) {
        isActuallyOnline = false;
    }

    if (isActuallyOnline !== previousStatus) {
        console.log(`[SyncManager] Connectivity status changed: ${isActuallyOnline ? 'ONLINE' : 'OFFLINE'}`);
        window.dispatchEvent(new CustomEvent('hff-connectivity-status', { detail: { online: isActuallyOnline } }));

        if (isActuallyOnline) {
            syncSubmissions();
        }
    }

    return isActuallyOnline;
}

/**
 * Attempts to sync all pending submissions to the backend.
 */
export async function syncSubmissions() {
    if (isSyncing) return;

    // Check true connectivity before attempting sync
    const online = await checkConnectivity();
    if (!online) return;

    isSyncing = true;

    try {
        // 1. Sync Enketo submissions via API
        const pending = await getPendingSubmissions();
        if (pending.length > 0) {
            console.log(`[SyncManager] Syncing ${pending.length} Enketo submissions...`);
            for (const submission of pending) {
                try {
                    const resp = await hffFetch('/api/submissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ xml: submission.modelXml }),
                    });

                    if (resp.ok) {
                        await markAsSynced(submission.id);
                        window.dispatchEvent(new CustomEvent('hff-sync-complete', { detail: { uuid: submission.uuid } }));
                    }
                } catch (e) {
                    console.error(`[SyncManager] Error syncing submission ${submission.uuid}:`, e);
                }
            }
        }

        // 2. Sync Native Dashboard data (registrations / participants) via Supabase client
        await pushPendingToSupabase();
        await pullFromSupabase();

    } finally {
        isSyncing = false;
    }
}

/**
 * Starts the background sync interval.
 */
export function startAutoSync(syncIntervalMs = 30000, heartbeatIntervalMs = 15000) {
    checkConnectivity();
    syncSubmissions();

    window.addEventListener('online', () => {
        checkConnectivity();
    });

    window.addEventListener('offline', () => {
        isActuallyOnline = false;
        window.dispatchEvent(new CustomEvent('hff-connectivity-status', { detail: { online: false } }));
    });

    setInterval(checkConnectivity, heartbeatIntervalMs);
    setInterval(syncSubmissions, syncIntervalMs);
}

