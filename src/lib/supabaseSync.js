import { supabase, isConfigured } from './supabase';
import db from './dexieDb';

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
    if (!isConfigured || !navigator.onLine) return;

    const pending = await db[storeName]
        .where('sync_status')
        .equals('pending')
        .toArray();

    if (pending.length === 0) return;

    console.log(`[SupabaseSync] Syncing ${pending.length} records from ${storeName}...`);

    for (const record of pending) {
        const { id, sync_status, ...recordToSync } = record;

        if (!recordToSync.updated_at) {
            recordToSync.updated_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from(storeName)
            .upsert(recordToSync, {
                onConflict: 'uuid',
                ignoreDuplicates: false
            });

        if (!error) {
            await db[storeName].update(id, {
                sync_status: 'synced',
                synced_at: new Date().toISOString()
            });
        } else {
            console.error(`[SupabaseSync] Error syncing ${storeName} record ${record.uuid}:`, error.message);
            await db[storeName].update(id, { sync_status: 'failed' });
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

        const { data, error } = await supabase
            .from(storeName)
            .select('*')
            .gt('updated_at', lastSyncTime);

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
    } finally {
        isSyncing = false;
        window.dispatchEvent(new CustomEvent('hff-supabase-sync-complete'));
    }
}

/**
 * Orchestrates pull for registrations
 */
export async function pullFromSupabase() {
    await pullStoreUpdates('registrations');
}

