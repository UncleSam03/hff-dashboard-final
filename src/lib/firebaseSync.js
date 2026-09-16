import { doc, getDocs, collection, setDoc, deleteDoc } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';
import db from './dexieDb';
import { checkConnectivity } from './syncManager';

let isSyncing = false;
let isPulling = false;

/**
 * Push all pending records from IndexedDB to Firebase for a specific store
 */
async function pushStorePending(storeName) {
    if (!isConfigured) return;

    const online = await checkConnectivity();
    if (!online) return;

    const pending = await db[storeName]
        .where('sync_status')
        .equals('pending')
        .toArray();

    if (pending.length === 0) return;

    console.log(`[FirebaseSync] Syncing ${pending.length} records from ${storeName}...`);

    for (const record of pending) {
        // Strip out purely local tracking fields
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

        try {
            // In Firestore, we use the UUID as the document ID
            const docRef = doc(firestoreDb, storeName, recordToSync.uuid);
            await setDoc(docRef, recordToSync, { merge: true });

            await db[storeName].update(id, {
                sync_status: 'synced',
                synced_at: new Date().toISOString()
            });
        } catch (error) {
            console.error(`[FirebaseSync] Error syncing ${storeName} record ${record.uuid}:`, error.message);
        }
    }
}

/**
 * Pull updates from Firebase to IndexedDB for a specific store
 */
async function pullStoreUpdates(storeName) {
    if (!isConfigured || !navigator.onLine || isPulling) return;

    isPulling = true;
    try {
        const querySnapshot = await getDocs(collection(firestoreDb, storeName));
        const remoteRecords = [];
        querySnapshot.forEach((doc) => {
            remoteRecords.push(doc.data());
        });

        if (remoteRecords.length === 0) return;

        // Load local records to compare timestamps
        const localRecords = await db[storeName].toArray();
        const localMetaMap = new Map();
        for (const loc of localRecords) {
            if (loc.uuid) {
                localMetaMap.set(loc.uuid, { id: loc.id, updated_at: loc.updated_at });
            }
        }

        let updatedCount = 0;

        for (const remoteRecord of remoteRecords) {
            const locData = localMetaMap.get(remoteRecord.uuid);
            
            // Handle soft deletions if they exist
            if (remoteRecord.is_deleted) {
                if (locData) {
                    await db[storeName].delete(locData.id);
                }
                continue;
            }

            if (!locData) {
                // New record from server
                await db[storeName].add({
                    ...remoteRecord,
                    sync_status: 'synced'
                });
                updatedCount++;
            } else if (new Date(remoteRecord.updated_at) > new Date(locData.updated_at)) {
                // Remote is newer
                await db[storeName].update(locData.id, {
                    ...remoteRecord,
                    sync_status: 'synced'
                });
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            console.log(`[FirebaseSync] Pulled ${updatedCount} updates for ${storeName}`);
            window.dispatchEvent(new CustomEvent(`hff-firebase-${storeName}-updated`));
        }

    } catch (error) {
        console.error(`[FirebaseSync] Error pulling ${storeName}:`, error.message);
    } finally {
        isPulling = false;
    }
}

/**
 * Reconciliation: Fetches all UUIDs from Firebase and deletes local records that aren't in that list.
 */
export async function reconcileFirebaseDeletions(storeName) {
    if (!isConfigured) return;
    
    const online = await checkConnectivity();
    if (!online) return;

    console.log(`[FirebaseSync] Reconciling deletions for ${storeName}...`);
    
    try {
        const querySnapshot = await getDocs(collection(firestoreDb, storeName));
        const remoteUuidSet = new Set();
        querySnapshot.forEach((doc) => {
            remoteUuidSet.add(doc.data().uuid);
        });

        const localRecords = await db[storeName].toArray();
        
        const toDelete = localRecords.filter(r => 
            r.uuid && 
            r.sync_status === 'synced' &&
            !remoteUuidSet.has(r.uuid)
        );

        if (toDelete.length > 0) {
            console.log(`[FirebaseSync] Purging ${toDelete.length} ghost records from ${storeName}`);
            const idsToDelete = toDelete.map(r => r.id);
            await db[storeName].bulkDelete(idsToDelete);
            window.dispatchEvent(new CustomEvent(`hff-firebase-${storeName}-updated`));
            window.dispatchEvent(new CustomEvent('hff-firebase-data-updated'));
        }
    } catch (error) {
        console.error(`[FirebaseSync] Reconciliation failed for ${storeName}:`, error.message);
    }
}

/**
 * Orchestrates push for registrations
 */
export async function pushPendingToFirebase() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await pushStorePending('campaigns');
        await pushStorePending('registrations');
        // excluded notices/testimonies per plan
    } finally {
        isSyncing = false;
        window.dispatchEvent(new CustomEvent('hff-firebase-sync-complete'));
    }
}

/**
 * Orchestrates pull for registrations
 */
export async function pullFromFirebase() {
    await pullStoreUpdates('campaigns');
    await pullStoreUpdates('registrations');
}

/**
 * Replace local IndexedDB state with the current Firebase snapshot.
 */
export async function resetLocalFromFirebase() {
    if (!isConfigured) {
        throw new Error("Firebase is not configured.");
    }

    const online = await checkConnectivity();
    if (!online) {
        throw new Error("Offline: cannot refresh from Firebase.");
    }

    try {
        const querySnapshot = await getDocs(collection(firestoreDb, 'registrations'));
        const regRows = [];
        const now = new Date().toISOString();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            regRows.push({
                ...data,
                is_deleted: data.is_deleted ?? false,
                sync_status: 'synced',
                synced_at: now,
            });
        });

        const campaignSnapshot = await getDocs(collection(firestoreDb, 'campaigns'));
        const campaignRows = [];
        campaignSnapshot.forEach((doc) => {
            const data = doc.data();
            campaignRows.push({
                ...data,
                sync_status: 'synced',
                synced_at: now,
            });
        });

        await db.transaction('rw', [db.registrations, db.campaigns], async () => {
            await db.registrations.clear();
            if (regRows.length) await db.registrations.bulkAdd(regRows);

            await db.campaigns.clear();
            if (campaignRows.length) await db.campaigns.bulkAdd(campaignRows);
        });

        window.dispatchEvent(new CustomEvent('hff-firebase-data-updated'));
    } catch (error) {
        throw new Error(`resetLocalFromFirebase failed: ${error.message}`);
    }
}

/**
 * Optional initializer
 */
export async function initFirebaseSync() {
    try {
        await pullFromFirebase();
    } catch {
        // no-op
    }
}
