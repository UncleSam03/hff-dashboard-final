import { doc, getDocs, collection, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';
import db from './dexieDb';
import { checkConnectivity } from './syncManager';

let isSyncing = false;
let isPulling = false;

/**
 * Recursively remove undefined values to avoid Firestore serialization errors
 */
function sanitizeForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => item === undefined ? null : sanitizeForFirestore(item));
    }
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            clean[key] = (typeof value === 'object' && value !== null) ? sanitizeForFirestore(value) : value;
        }
    }
    return clean;
}

/**
 * Push all pending records from IndexedDB to Firebase for a specific store in batches
 */
async function pushStorePending(storeName) {
    if (!isConfigured) return;

    const online = await checkConnectivity();
    if (!online) return;

    const pending = await db[storeName]
        .where('sync_status')
        .equals('pending')
        .toArray();

    // Also pick up any local records marked is_deleted: true that might have been marked synced previously
    const legacyDeleted = await db[storeName]
        .filter(r => Boolean(r.is_deleted) && r.sync_status !== 'pending')
        .toArray();

    const allToProcess = [...pending, ...legacyDeleted];

    if (allToProcess.length === 0) return;

    console.log(`[FirebaseSync] Syncing ${allToProcess.length} records from ${storeName} in batches...`);

    const BATCH_SIZE = 400; // Firestore limit is 500 operations per batch

    for (let i = 0; i < allToProcess.length; i += BATCH_SIZE) {
        const slice = allToProcess.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        const syncedItems = [];
        const deletedItems = [];

        for (const record of slice) {
            // Strip only local IndexedDB tracking fields
            const {
                id,
                sync_status,
                synced_at,
                processed_at,
                ...rest
            } = record;

            if (!record.uuid) continue;

            const docRef = doc(firestoreDb, storeName, record.uuid);

            if (record.is_deleted) {
                batch.delete(docRef);
                deletedItems.push({ id, uuid: record.uuid });
            } else {
                const recordToSync = sanitizeForFirestore({
                    ...rest,
                    updated_at: rest.updated_at || new Date().toISOString()
                });
                batch.set(docRef, recordToSync, { merge: true });
                syncedItems.push({ id, uuid: record.uuid });
            }
        }

        try {
            await batch.commit();
            const now = new Date().toISOString();
            await db.transaction('rw', db[storeName], async () => {
                for (const item of syncedItems) {
                    await db[storeName].update(item.id, {
                        sync_status: 'synced',
                        synced_at: now
                    });
                }
                for (const item of deletedItems) {
                    await db[storeName].delete(item.id);
                }
            });
        } catch (error) {
            console.error(`[FirebaseSync] Batch error syncing ${storeName} chunk (attempting fallback):`, error.message);
            // Fallback: commit individually if batch failed to isolate any faulty doc
            for (const item of slice) {
                try {
                    const { id, sync_status, synced_at, processed_at, ...rest } = item;
                    if (!item.uuid) continue;
                    const docRef = doc(firestoreDb, storeName, item.uuid);
                    if (item.is_deleted) {
                        await deleteDoc(docRef);
                        await db[storeName].delete(id);
                    } else {
                        const recordToSync = sanitizeForFirestore({
                            ...rest,
                            updated_at: rest.updated_at || new Date().toISOString()
                        });
                        await setDoc(docRef, recordToSync, { merge: true });
                        await db[storeName].update(id, {
                            sync_status: 'synced',
                            synced_at: new Date().toISOString()
                        });
                    }
                } catch (fallbackErr) {
                    console.error(`[FirebaseSync] Fallback failed for ${storeName} record ${item.uuid}:`, fallbackErr.message);
                }
            }
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
                // Clean up soft-deleted doc from Firestore backend
                if (remoteRecord.uuid) {
                    try {
                        const docRef = doc(firestoreDb, storeName, remoteRecord.uuid);
                        await deleteDoc(docRef);
                        console.log(`[FirebaseSync] Purged legacy soft-deleted doc ${remoteRecord.uuid} from Firestore ${storeName}`);
                    } catch (delErr) {
                        console.warn(`[FirebaseSync] Could not purge legacy doc ${remoteRecord.uuid} from Firestore:`, delErr.message);
                    }
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

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.is_deleted) {
                deleteDoc(docSnap.ref).catch(() => {});
                return;
            }
            regRows.push({
                ...data,
                is_deleted: false,
                sync_status: 'synced',
                synced_at: now,
            });
        });

        const campaignSnapshot = await getDocs(collection(firestoreDb, 'campaigns'));
        const campaignRows = [];
        campaignSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.is_deleted) {
                deleteDoc(docSnap.ref).catch(() => {});
                return;
            }
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
