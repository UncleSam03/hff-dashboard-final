import { supabase, isConfigured } from './supabase';
import db from './dexieDb';
import { checkConnectivity } from './syncManager';

/**
 * Supabase Sync Engine
 * 
 * Implements:
 * 1. UUID-based identification (prevents collisions).
 * 2. Last-Write-Wins logic using 'updated_at' timestamps.
 * 3. Atomic push of pending records from IndexedDB.
 */

let isSyncing = false;

/**
 * Push all pending records from IndexedDB to Supabase for a specific store
 */
async function pushStorePending(storeName) {
    if (!isConfigured) return;

    // Use real connectivity check instead of unreliable navigator.onLine
    const online = await checkConnectivity();
    if (!online) return;

    const pending = await db[storeName]
        .where('sync_status')
        .equals('pending')
        .toArray();

    if (pending.length === 0) return;

    console.log(`[SupabaseSync] Syncing ${pending.length} records from ${storeName}...`);

    for (const record of pending) {
        // Strip out purely local tracking fields that don't exist in Supabase
        const {
            id,
            sync_status,
            synced_at,
            processed,
            processed_at,
            ...recordToSync
        } = record;

        if (!recordToSync.updated_at) {
            recordToSync.updated_at = new Date().toISOString();
        }

        // Bug Fix #2: Avoid onConflict upsert without DB unique constraint
        const { data: existing } = await supabase
            .from(storeName)
            .select('uuid')
            .eq('uuid', recordToSync.uuid)
            .maybeSingle();

        let error;
        if (existing) {
            const { error: updateError } = await supabase
                .from(storeName)
                .update(recordToSync)
                .eq('uuid', recordToSync.uuid);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from(storeName)
                .insert(recordToSync);
            error = insertError;
        }

        if (!error) {
            await db[storeName].update(id, {
                sync_status: 'synced',
                synced_at: new Date().toISOString()
            });
        } else {
            console.error(`[SupabaseSync] Error syncing ${storeName} record ${record.uuid}:`, error.message);
            // Keep as 'pending' so it retries on the next cycle instead of
            // marking as 'failed' and losing it forever.
        }
    }
}

let isPulling = false;

/**
 * Pull updates from Supabase to IndexedDB for a specific store
 */
async function pullStoreUpdates(storeName) {
    if (!isConfigured || !navigator.onLine || isPulling) return;

    isPulling = true;
    try {
        const latestLocal = await db[storeName].orderBy('updated_at').last();
        const lastSyncTime = latestLocal?.updated_at || new Date(0).toISOString();

        // #region agent log
        try {
            fetch('http://127.0.0.1:7491/ingest/d310bdd2-b950-4c68-be76-23013d6da606', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b0c4c' },
                body: JSON.stringify({
                    sessionId: '4b0c4c',
                    runId: 'baseline',
                    hypothesisId: 'D',
                    location: 'src/lib/supabaseSync.js:pullStoreUpdates:before',
                    message: 'pullStoreUpdates about to query',
                    data: { storeName, navigatorOnLine: !!navigator.onLine, lastSyncTime },
                    timestamp: Date.now()
                })
            }).catch(() => { });
        } catch { }
        // #endregion agent log

        const { data, error } = await supabase
            .from(storeName)
            .select('*')
            .gt('updated_at', lastSyncTime);

        // #region agent log
        try {
            fetch('http://127.0.0.1:7491/ingest/d310bdd2-b950-4c68-be76-23013d6da606', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b0c4c' },
                body: JSON.stringify({
                    sessionId: '4b0c4c',
                    runId: 'baseline',
                    hypothesisId: 'D',
                    location: 'src/lib/supabaseSync.js:pullStoreUpdates:after',
                    message: 'pullStoreUpdates query result',
                    data: {
                        storeName,
                        rows: Array.isArray(data) ? data.length : null,
                        error: error ? { message: error.message, code: error.code, status: error.status, name: error.name } : null
                    },
                    timestamp: Date.now()
                })
            }).catch(() => { });
        } catch { }
        // #endregion agent log

        if (error) {
            // Check for aborted signal (common in some browser states)
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                console.warn(`[SupabaseSync] Pull ${storeName} aborted:`, error.message);
            } else {
                console.error(`[SupabaseSync] Error pulling ${storeName} updates:`, error.message);
            }
            return;
        }

        if (data && data.length > 0) {
            console.log(`[SupabaseSync] Pulling ${data.length} new records from ${storeName}...`);
            for (const remoteRecord of data) {
                const existing = await db[storeName].where('uuid').equals(remoteRecord.uuid).first();

                if (existing) {
                    if (new Date(remoteRecord.updated_at) > new Date(existing.updated_at)) {
                        await db[storeName].update(existing.id, {
                            ...remoteRecord,
                            sync_status: 'synced'
                        });
                    }
                } else {
                    await db[storeName].add({
                        ...remoteRecord,
                        sync_status: 'synced'
                    });
                }
            }
            window.dispatchEvent(new CustomEvent(`hff-supabase-${storeName}-updated`));
        }
    } finally {
        isPulling = false;
    }
}

/**
 * Orchestrates push for registrations
 */
export async function pushPendingToSupabase() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await pushStorePending('registrations');
        // Notices are typically created by Admin in Supabase; facilitators only pull.
    } finally {
        isSyncing = false;
        window.dispatchEvent(new CustomEvent('hff-supabase-sync-complete'));
    }
}

/**
 * Orchestrates pull for registrations
 */
export async function pullFromSupabase() {
    await Promise.all([
        pullStoreUpdates('registrations'),
        pullStoreUpdates('notices')
    ]);
}

/**
 * Replace local IndexedDB state with the current Supabase snapshot.
 * Useful when Supabase was edited out-of-band (e.g. rows deleted in dashboard)
 * and you want local devices to match the authoritative server state.
 */
export async function resetLocalFromSupabase() {
    if (!isConfigured) {
        throw new Error("Supabase is not configured.");
    }

    const online = await checkConnectivity();
    if (!online) {
        throw new Error("Offline: cannot refresh from Supabase.");
    }

    const [regRes, noticeRes] = await Promise.allSettled([
        supabase.from('registrations').select('*').order('created_at', { ascending: true }),
        supabase.from('notices').select('*').order('created_at', { ascending: true })
    ]);

    if (regRes.status !== 'fulfilled') {
        throw new Error(regRes.reason?.message || String(regRes.reason));
    }
    const { data: registrations, error: regErr } = regRes.value;
    if (regErr) throw new Error(regErr.message);

    let notices = [];
    let noticeOk = false;
    if (noticeRes.status === 'fulfilled') {
        const { data, error } = noticeRes.value;
        if (!error) {
            notices = data || [];
            noticeOk = true;
        } else {
            // Notices are ancillary; allow reset-from-cloud to still clear registrations.
            console.warn('[SupabaseSync] resetLocalFromSupabase: notices select failed:', error.message);
        }
    }

    const now = new Date().toISOString();
    const regRows = (registrations || []).map((r) => {
        // Dexie uses its own auto-increment `id`; avoid inserting Supabase `id` if present.
        const { id: _supabaseId, is_deleted, ...rest } = r;
        return {
        ...rest,
        is_deleted: is_deleted ?? false,
        sync_status: 'synced',
        synced_at: now,
        };
    });
    const noticeRows = (notices || []).map((n) => {
        const { id: _supabaseId, ...rest } = n;
        return {
        ...rest,
        sync_status: 'synced',
        synced_at: now,
        };
    });

    await db.transaction('rw', ...(noticeOk ? [db.registrations, db.notices] : [db.registrations]), async () => {
        await db.registrations.clear();
        if (noticeOk) await db.notices.clear();

        if (regRows.length) await db.registrations.bulkAdd(regRows);
        if (noticeOk && noticeRows.length) await db.notices.bulkAdd(noticeRows);
    });

    window.dispatchEvent(new CustomEvent('hff-supabase-data-updated'));
}

/**
 * Optional initializer (called from `src/app/page.jsx`).
 * Keeps startup resilient even if other sync engines change.
 */
export async function initSupabaseSync() {
    // Best-effort initial pull (does not throw if offline / unconfigured).
    try {
        await pullFromSupabase();
    } catch (_e) {
        // no-op
    }
}

