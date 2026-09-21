import { getPendingSubmissions, markAsSynced } from './offlineStorage';
import { hffFetch } from './api';
import { pushPendingToFirebase, pullFromFirebase, reconcileFirebaseDeletions } from './firebaseSync';
import { db as firestoreDb, isConfigured } from './firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

let isSyncing = false;
let isActuallyOnline = navigator.onLine;

/**
 * Checks for true connectivity.
 */
export async function checkConnectivity() {
    const previousStatus = isActuallyOnline;
    try {
        const health = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
        if (health.ok) {
            isActuallyOnline = true;
        } else if (isConfigured && firestoreDb) {
            // Secondary probe: fetch 1 doc from Firestore
            const q = query(collection(firestoreDb, 'registrations'), limit(1));
            await getDocs(q);
            isActuallyOnline = true;
        } else {
            isActuallyOnline = false;
        }
    } catch {
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

        // 2. Sync Native Dashboard data via Firebase client
        await pushPendingToFirebase();
        await pullFromFirebase();

    } finally {
        isSyncing = false;
    }
}

/**
 * Perform a deep reconciliation with the cloud.
 */
export async function reconcileWithCloud() {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const online = await checkConnectivity();
        if (!online) return;

        console.log("[SyncManager] Starting Full Cloud Reconciliation...");
        
        await pushPendingToFirebase();
        await pullFromFirebase();
        
        await reconcileFirebaseDeletions('registrations');

        console.log("[SyncManager] Reconciliation Complete.");
        
        window.dispatchEvent(new CustomEvent('hff-firebase-data-updated'));
        
    } catch (err) {
        console.error("[SyncManager] Reconciliation error:", err);
    } finally {
        isSyncing = false;
    }
}

/**
 * Starts the background sync interval.
 */
// syncIntervalMs: full sync cadence (registrations/participants via Firebase + submission sync)
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

    window.addEventListener('hff-firebase-sync-request', () => {
        console.log('[SyncManager] Received instant sync request event, triggering syncSubmissions...');
        syncSubmissions().catch(e => console.warn('[SyncManager] Instant sync error:', e));
    });

    setInterval(checkConnectivity, heartbeatIntervalMs);
    setInterval(syncSubmissions, syncIntervalMs);
}

