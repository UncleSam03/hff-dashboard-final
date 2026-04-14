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
            sync_status: _unusedSyncStatus,
            synced_at: _unusedSyncedAt,
            processed: _unusedProcessed,
            processed_at: _unusedProcessedAt,
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

        // Removed agent log

        const { data, error } = await supabase
            .from(storeName)
            .select('*')
            .gt('updated_at', lastSyncTime);

        // Removed agent log

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

        // Optional: Trigger reconciliation if this is a "deep pulse" sync
        // or if explicitly requested. For now, we'll keep it as a separate call.

    } finally {
        isPulling = false;
    }
}

/**
 * Reconciliation: Fetches all UUIDs from Supabase and deletes local records that aren't in that list.
 * This is the only way to handle HARD deletions from the Supabase dashboard/UI.
 */
export async function reconcileStoreDeletions(storeName) {
    if (!isConfigured) return;
    
    const online = await checkConnectivity();
    if (!online) return;

    console.log(`[SupabaseSync] Reconciling deletions for ${storeName}...`);
    
    // Fetch ONLY UUIDs to keep bandwidth low
    const { data: remoteUuids, error } = await supabase
        .from(storeName)
        .select('uuid');

    if (error) {
        console.error(`[SupabaseSync] Reconciliation failed for ${storeName}:`, error.message);
        return;
    }

    const remoteUuidSet = new Set((remoteUuids || []).map(r => r.uuid));
    const localRecords = await db[storeName].toArray();
    
    const toDelete = localRecords.filter(r => 
        r.uuid && 
        r.sync_status === 'synced' && // Only delete records that were previously synced
        !remoteUuidSet.has(r.uuid)
    );

    if (toDelete.length > 0) {
        console.log(`[SupabaseSync] Purging ${toDelete.length} ghost records from ${storeName}`);
        const idsToDelete = toDelete.map(r => r.id);
        await db[storeName].bulkDelete(idsToDelete);
        window.dispatchEvent(new CustomEvent(`hff-supabase-${storeName}-updated`));
        window.dispatchEvent(new CustomEvent('hff-supabase-data-updated'));
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
    if (regErr && !regErr.message?.includes('public.notices')) {
        throw new Error(regErr.message);
    }

    let notices = [];
    let noticeOk = false;
    if (noticeRes.status === 'fulfilled') {
        const { data, error } = noticeRes.value;
        if (!error) {
            notices = data || [];
            noticeOk = true;
        } else {
            console.warn('[SupabaseSync] resetLocalFromSupabase: notices select failed:', error.message);
        }
    } else {
        console.warn('[SupabaseSync] resetLocalFromSupabase: notices promise rejected');
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
    } catch (_) {
        // no-op
    }
}

