import { getPendingSubmissions, markAsSynced } from './offlineStorage';
import { hffFetch } from './api';
import { pushPendingToSupabase, pullFromSupabase, reconcileStoreDeletions } from './supabaseSync';
import { supabase, isConfigured } from './supabase';

let isSyncing = false;
let isActuallyOnline = navigator.onLine;

/**
 * Checks for true connectivity.
 * 
 * Uses Supabase as the primary connectivity probe (always available in production).
 * Falls back to /api/health for Express-only dev environments.
 */
export async function checkConnectivity() {
    const previousStatus = isActuallyOnline;
    try {
        // Primary: lightweight health probe (works on Vercel + local)
        const health = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
        if (health.ok) {
            isActuallyOnline = true;
        } else if (isConfigured && supabase) {
            // Secondary: Supabase probe (may fail with RLS in some configs)
            const { error } = await supabase.from('registrations').select('uuid', { count: 'exact', head: true }).limit(0);
            isActuallyOnline = !error;
        } else {
            isActuallyOnline = false;
        }
    } catch (_) {
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
    isSyncing = true;

    try {
        // Check true connectivity before attempting sync
        const online = await checkConnectivity();
        if (!online) return;

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
 * Perform a deep reconciliation with the cloud.
 * This is slower than syncSubmissions but ensures 100% parity 
 * by checking for deleted records on the server.
 */
export async function reconcileWithCloud() {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const online = await checkConnectivity();
        if (!online) return;

        console.log("[SyncManager] Starting Full Cloud Reconciliation...");
        
        // 1. First push any local changes
        await pushPendingToSupabase();
        
        // 2. Pull all updates
        await pullFromSupabase();
        
        // 3. Reconcile deletions for both registrations and notices
        await reconcileStoreDeletions('registrations');
        await reconcileStoreDeletions('notices');

        console.log("[SyncManager] Reconciliation Complete.");
        
        // Trigger generic update event
        window.dispatchEvent(new CustomEvent('hff-supabase-data-updated'));
        
    } catch (err) {
        console.error("[SyncManager] Reconciliation error:", err);
    } finally {
        isSyncing = false;
    }
}

/**
 * Starts the background sync interval.
 */
// syncIntervalMs: full sync cadence (registrations/participants via Supabase + submission sync)
// heartbeatIntervalMs: lightweight connectivity check cadence
export function startAutoSync(syncIntervalMs = 30 * 1000, heartbeatIntervalMs = 15 * 1000) {
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

