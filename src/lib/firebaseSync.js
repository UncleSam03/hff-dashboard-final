import { doc, getDocs, collection, setDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';
import db from './dexieDb';
import { checkConnectivity } from './syncManager';
import { autoDeduplicateRegistrations } from './dataMaintenance';
import { flushAttendanceSyncImmediately } from './attendanceSync';
import { normalizeAttendance } from './analytics';
import { DEFAULT_CAMPAIGN } from './campaignManager';

let isSyncing = false;
const pullingStores = new Set();

const STORAGE_PREFIX = 'hff_last_pull_';

function getLastPullTime(storeName) {
    try {
        return localStorage.getItem(`${STORAGE_PREFIX}${storeName}`) || null;
    } catch {
        return null;
    }
}

function setLastPullTime(storeName, timestamp) {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${storeName}`, timestamp);
    } catch {}
}

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

    if (!db[storeName]) return;

    let pending = [];
    const hasSyncStatusIndex = db[storeName]?.schema?.indexes?.some(idx => idx.name === 'sync_status');
    if (hasSyncStatusIndex) {
        pending = await db[storeName]
            .where('sync_status')
            .equals('pending')
            .toArray();
    } else {
        pending = await db[storeName]
            .filter(r => r.sync_status === 'pending')
            .toArray();
    }

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
                // Write a lightweight tombstone so all other devices receive the deletion
                // via 1-read incremental sync (where('updated_at', '>', lastPull)) instead of requiring
                // a 4,000-read full collection scan in reconcileFirebaseDeletions!
                batch.set(docRef, {
                    uuid: record.uuid,
                    campaign_id: record.campaign_id || DEFAULT_CAMPAIGN.uuid,
                    is_deleted: true,
                    updated_at: record.updated_at || new Date().toISOString()
                });
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
                        await setDoc(docRef, {
                            uuid: item.uuid,
                            campaign_id: item.campaign_id || DEFAULT_CAMPAIGN.uuid,
                            is_deleted: true,
                            updated_at: item.updated_at || new Date().toISOString()
                        });
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
 * Pull updates from Firebase to IndexedDB for a specific store.
 * Uses incremental high-watermark querying when available to protect Firestore Free Tier (50,000 reads/day).
 */
async function pullStoreUpdates(storeName, forceFull = false) {
    if (!isConfigured || !navigator.onLine || pullingStores.has(storeName)) return;

    pullingStores.add(storeName);
    try {
        let querySnapshot;
        let lastPull = getLastPullTime(storeName);
        const localCount = await db[storeName].count();

        // Zero-Cost Guard: If lastPull is missing from localStorage but records exist in Dexie,
        // recover lastPull from the latest local timestamp to avoid burning full collection read quota!
        if (!lastPull && localCount > 0) {
            try {
                const latestLocal = await db[storeName].orderBy('updated_at').last();
                if (latestLocal?.updated_at) {
                    lastPull = latestLocal.updated_at;
                    setLastPullTime(storeName, lastPull);
                    console.log(`[FirebaseSync] Recovered lastPull anchor from local ${storeName}: ${lastPull}`);
                }
            } catch {
                // fallback gracefully
            }
        }

        if (!forceFull && lastPull && localCount > 0) {
            try {
                const incrementalQ = query(
                    collection(firestoreDb, storeName),
                    where('updated_at', '>', lastPull)
                );
                querySnapshot = await getDocs(incrementalQ);
            } catch (queryErr) {
                console.warn(`[FirebaseSync] Incremental query failed for ${storeName}:`, queryErr.message);
                if (localCount === 0) {
                    querySnapshot = await getDocs(collection(firestoreDb, storeName));
                } else {
                    return; // Avoid hammering Firestore with full read on transient errors
                }
            }
        } else {
            querySnapshot = await getDocs(collection(firestoreDb, storeName));
        }

        const remoteRecords = [];
        let maxRemoteUpdatedAt = lastPull || '';

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.updated_at && (!maxRemoteUpdatedAt || data.updated_at > maxRemoteUpdatedAt)) {
                maxRemoteUpdatedAt = data.updated_at;
            }
            remoteRecords.push({
                ...data,
                uuid: data.uuid || docSnap.id
            });
        });

        // Advance lastPull using the remote high-watermark (not the local reader clock!)
        // so client clock skew never skips another laptop's writes AND we never re-read the same batch twice!
        if (maxRemoteUpdatedAt) {
            setLastPullTime(storeName, maxRemoteUpdatedAt);
        } else if (!lastPull) {
            setLastPullTime(storeName, new Date().toISOString());
        }

        if (remoteRecords.length === 0) return;

        // Load local records to compare timestamps and match business keys safely
        const localRecords = await db[storeName].toArray();
        const localMetaMap = new Map();
        const localFormMap = new Map();
        const localNameMap = new Map();

        const cleanForm = (f) => String(f || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^0+(?=\d)/, '');
        const cleanStr = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

        for (const loc of localRecords) {
            if (loc.uuid) {
                localMetaMap.set(loc.uuid, { id: loc.id, updated_at: loc.updated_at, record: loc });
            }
            if (storeName === 'registrations' && !loc.is_deleted) {
                const camp = loc.campaign_id || DEFAULT_CAMPAIGN.uuid;
                const locType = cleanStr(loc.type) || 'participant';
                const cf = cleanForm(loc.form_number);
                const gf = cleanForm(loc.group_form_number || (locType === 'participant' ? loc.form_number : ''));

                // Only index facilitators by form_number (a single form has 1 facilitator, but 10-15 participants)
                if (locType === 'facilitator' && cf) {
                    const formKey = `${camp}|facilitator|${cf}`;
                    if (!localFormMap.has(formKey)) {
                        localFormMap.set(formKey, { id: loc.id, updated_at: loc.updated_at, record: loc });
                    }
                }

                const fn = cleanStr(loc.first_name);
                const ln = cleanStr(loc.last_name);
                if (fn && ln) {
                    const groupScope = locType === 'facilitator' ? (cf || 'noform') : (gf || cleanStr(loc.facilitator_uuid) || 'ungrouped');
                    const nameKey = `${camp}|${locType}|${groupScope}|${fn}|${ln}`;
                    if (!localNameMap.has(nameKey)) {
                        localNameMap.set(nameKey, { id: loc.id, updated_at: loc.updated_at, record: loc });
                    }
                }
            }
        }

        let updatedCount = 0;

        for (const remoteRecord of remoteRecords) {
            // Find existing local record: first by exact UUID, then by campaign+group-scoped business key
            let locData = localMetaMap.get(remoteRecord.uuid);

            if (!locData && storeName === 'registrations' && !remoteRecord.is_deleted) {
                const camp = remoteRecord.campaign_id || DEFAULT_CAMPAIGN.uuid;
                const remType = cleanStr(remoteRecord.type) || 'participant';
                const cf = cleanForm(remoteRecord.form_number);
                const gf = cleanForm(remoteRecord.group_form_number || (remType === 'participant' ? remoteRecord.form_number : ''));
                const fn = cleanStr(remoteRecord.first_name);
                const ln = cleanStr(remoteRecord.last_name);

                if (remType === 'facilitator' && cf) {
                    const candidate = localFormMap.get(`${camp}|facilitator|${cf}`);
                    // Only match by facilitator form number if names also match or one is blank
                    if (candidate) {
                        const locFn = cleanStr(candidate.record?.first_name);
                        const locLn = cleanStr(candidate.record?.last_name);
                        if ((!fn && !ln) || (!locFn && !locLn) || (fn === locFn && ln === locLn)) {
                            locData = candidate;
                        }
                    }
                }
                if (!locData && fn && ln) {
                    const groupScope = remType === 'facilitator' ? (cf || 'noform') : (gf || cleanStr(remoteRecord.facilitator_uuid) || 'ungrouped');
                    locData = localNameMap.get(`${camp}|${remType}|${groupScope}|${fn}|${ln}`);
                }
            }

            // If matched locally by strict campaign+group+name key and local is already synced with a different UUID,
            // purge the redundant duplicate document from Firestore
            if (!remoteRecord.is_deleted && locData && locData.record?.uuid && remoteRecord.uuid && locData.record.uuid !== remoteRecord.uuid && locData.record.sync_status === 'synced') {
                try {
                    const dupRef = doc(firestoreDb, storeName, remoteRecord.uuid);
                    deleteDoc(dupRef).catch(() => {});
                    console.log(`[FirebaseSync] Purged redundant cloud duplicate ${remoteRecord.uuid}`);
                } catch {
                    // ignore
                }
            }
            
            // Handle tombstone soft deletions incrementally (1 read instead of 4,000-read full scan)
            if (remoteRecord.is_deleted) {
                if (locData) {
                    await db[storeName].delete(locData.id);
                    updatedCount++;
                }
                continue;
            }

            if (!locData) {
                // Truly new record from server
                await db[storeName].add({
                    ...remoteRecord,
                    sync_status: 'synced'
                });
                updatedCount++;
            } else if (locData.record?.sync_status === 'pending') {
                // PROTECT PENDING LOCAL ATTENDANCE EDITS:
                // Do not overwrite local changes if user is actively editing attendance offline or pending push
                if (storeName === 'registrations' && remoteRecord.attendance && locData.record.attendance) {
                    const localAtt = normalizeAttendance(locData.record.attendance);
                    const remoteAtt = normalizeAttendance(remoteRecord.attendance);
                    // Non-destructive merge: union of attendance days
                    const mergedAtt = localAtt.map((val, idx) => Boolean(val || remoteAtt[idx]));
                    await db[storeName].update(locData.id, {
                        ...remoteRecord,
                        ...locData.record,
                        attendance: mergedAtt,
                        sync_status: 'pending' // Preserve pending so local merge will sync upward
                    });
                }
            } else if (!locData.record?.uuid || locData.record.uuid === remoteRecord.uuid || new Date(remoteRecord.updated_at || 0) >= new Date(locData.updated_at || 0)) {
                // Skip no-op writes if record timestamp is identical
                if (locData.record?.uuid === remoteRecord.uuid && locData.updated_at && remoteRecord.updated_at && locData.updated_at === remoteRecord.updated_at && locData.record?.sync_status === 'synced') {
                    continue;
                }

                let mergedPayload = {
                    ...remoteRecord,
                    sync_status: 'synced'
                };

                // Non-destructive day-by-day attendance merge across devices while honoring explicit single-day unchecks
                if (storeName === 'registrations' && locData.record?.attendance && remoteRecord.attendance) {
                    const localAtt = normalizeAttendance(locData.record.attendance);
                    const remoteAtt = normalizeAttendance(remoteRecord.attendance);
                    const mergedAtt = localAtt.map((val, idx) => Boolean(val || remoteAtt[idx]));
                    const lastMark = remoteRecord.last_attendance_mark;
                    if (lastMark && typeof lastMark.day_index === 'number' && lastMark.value === false) {
                        mergedAtt[lastMark.day_index] = false;
                    }
                    mergedPayload.attendance = mergedAtt;
                }

                // Reconcile and update existing local record (preserves Dexie auto-increment ID and prevents duplicates)
                await db[storeName].update(locData.id, mergedPayload);
                updatedCount++;
            }
        }

        if (storeName === 'registrations' && updatedCount > 0) {
            await autoDeduplicateRegistrations();
        }

        if (updatedCount > 0) {
            console.log(`[FirebaseSync] Pulled ${updatedCount} updates for ${storeName}`);
            window.dispatchEvent(new CustomEvent(`hff-firebase-${storeName}-updated`));
        }

    } catch (error) {
        console.error(`[FirebaseSync] Error pulling ${storeName}:`, error.message);
    } finally {
        pullingStores.delete(storeName);
    }
}

/**
 * Deep Reconciliation: Only runs when explicitly forced (e.g. manual admin maintenance),
 * because normal deletions now sync incrementally as lightweight tombstones in 1 read.
 */
export async function reconcileFirebaseDeletions(storeName, force = false) {
    if (!isConfigured || !force) return;
    
    const online = await checkConnectivity();
    if (!online) return;

    const LAST_REC_KEY = `hff_last_rec_${storeName}`;
    console.log(`[FirebaseSync] Reconciling deletions for ${storeName}...`);
    
    try {
        const querySnapshot = await getDocs(collection(firestoreDb, storeName));
        const remoteUuidSet = new Set();
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.is_deleted) return;
            const u = data.uuid || docSnap.id;
            if (u) remoteUuidSet.add(u);
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
        localStorage.setItem(LAST_REC_KEY, String(Date.now()));
    } catch (error) {
        console.error(`[FirebaseSync] Reconciliation failed for ${storeName}:`, error.message);
    }
}

/**
 * Orchestrates push for registrations and flushes any debounced attendance changes
 */
export async function pushPendingToFirebase() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await flushAttendanceSyncImmediately().catch(err => console.warn('[FirebaseSync] Attendance flush error:', err));
        
        // Push core registrations first so records and deletions are guaranteed to sync
        try {
            await pushStorePending('registrations');
        } catch (err) {
            console.error('[FirebaseSync] Failed pushing registrations:', err);
        }

        try {
            await pushStorePending('campaigns');
        } catch (err) {
            console.error('[FirebaseSync] Failed pushing campaigns:', err);
        }

        try {
            await pushStorePending('notices');
        } catch (err) {
            console.error('[FirebaseSync] Failed pushing notices:', err);
        }
    } finally {
        isSyncing = false;
        window.dispatchEvent(new CustomEvent('hff-firebase-sync-complete'));
    }
}

/**
 * Orchestrates pull for registrations, campaigns, and notices
 */
export async function pullFromFirebase(forceFull = false) {
    try {
        await pullStoreUpdates('registrations', forceFull);
    } catch (err) {
        console.error('[FirebaseSync] Error pulling registrations:', err);
    }

    try {
        await pullStoreUpdates('campaigns', forceFull);
    } catch (err) {
        console.error('[FirebaseSync] Error pulling campaigns:', err);
    }

    try {
        await pullStoreUpdates('notices', forceFull);
    } catch (err) {
        console.error('[FirebaseSync] Error pulling notices:', err);
    }
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
