import { doc, writeBatch, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';
import db from './dexieDb';
import { checkConnectivity } from './syncManager';
import { normalizeAttendance } from './analytics';
import { TOTAL_CAMPAIGN_DAYS } from './constants';
import { useState, useEffect, useCallback } from 'react';

/**
 * In-memory queue of pending attendance modifications
 * Map<participantUuid, PendingItem>
 */
const pendingAttendanceQueue = new Map();
let debounceTimer = null;
let currentSyncStatus = 'synced'; // 'synced' | 'saving' | 'offline-saved' | 'error'
let lastSyncedTimestamp = null;
let activeListenerUnsub = null;

/**
 * Notify all subscribers of the sync state transition
 */
function broadcastSyncState(status, extra = {}) {
    currentSyncStatus = status;
    if (status === 'synced') {
        lastSyncedTimestamp = new Date().toISOString();
    }
    const detail = {
        status,
        pendingCount: pendingAttendanceQueue.size,
        lastSyncedAt: lastSyncedTimestamp,
        ...extra
    };
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hff-attendance-sync-status', { detail }));
    }
}

/**
 * Formats user attribution from auth/profile
 */
function extractAttribution(user, profile) {
    return {
        uid: user?.uid || profile?.id || null,
        name: profile?.full_name || user?.displayName || user?.email?.split('@')[0] || 'Field Staff',
        email: user?.email || profile?.email || null,
        role: profile?.role || 'facilitator'
    };
}

/**
 * Flush all pending attendance changes in the queue directly to Firestore
 */
export async function flushAttendanceSyncImmediately() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    if (pendingAttendanceQueue.size === 0) {
        broadcastSyncState('synced');
        return;
    }

    const online = await checkConnectivity();

    if (!isConfigured || !online) {
        console.log(`[AttendanceSync] Offline or unconfigured. ${pendingAttendanceQueue.size} attendance records preserved locally in IndexedDB.`);
        broadcastSyncState('offline-saved', {
            message: 'Saved to local device. Will push to cloud once reconnected.'
        });
        return;
    }

    // Take a snapshot of items to sync and clear the queue
    const itemsToSync = Array.from(pendingAttendanceQueue.values());
    pendingAttendanceQueue.clear();

    broadcastSyncState('saving', { count: itemsToSync.length });

    // Helper to sanitize payload and remove undefined properties (which crash Firestore writeBatch)
    const sanitizePayload = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const clean = {};
        for (const [key, val] of Object.entries(obj)) {
            if (val === undefined) continue;
            if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
                clean[key] = sanitizePayload(val);
            } else {
                clean[key] = val;
            }
        }
        return clean;
    };

    try {
        const BATCH_SIZE = 400;
        for (let i = 0; i < itemsToSync.length; i += BATCH_SIZE) {
            const chunk = itemsToSync.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(firestoreDb);

            for (const item of chunk) {
                const docRef = doc(firestoreDb, 'registrations', item.uuid);
                const payload = {
                    attendance: item.attendance,
                    updated_at: item.updated_at,
                    updated_by_uid: item.attribution?.uid || null,
                    updated_by_name: item.attribution?.name || null,
                    updated_by_email: item.attribution?.email || null,
                    updated_by_role: item.attribution?.role || null,
                    ...(item.books_received !== undefined ? { books_received: item.books_received } : {}),
                    ...(item.lastDayIndex !== null && item.lastDayIndex !== undefined ? {
                        last_attendance_mark: {
                            day_index: item.lastDayIndex,
                            day_label: `D${item.lastDayIndex + 1}`,
                            value: Boolean(item.attendance?.[item.lastDayIndex]),
                            marked_at: item.updated_at,
                            marked_by: item.attribution?.name || 'Field Staff'
                        }
                    } : {})
                };
                batch.set(docRef, sanitizePayload(payload), { merge: true });
            }

            await batch.commit();

            // Mark these records as synced in local Dexie
            const now = new Date().toISOString();
            await db.transaction('rw', db.registrations, async () => {
                for (const item of chunk) {
                    if (item.id) {
                        await db.registrations.update(item.id, {
                            sync_status: 'synced',
                            synced_at: now
                        });
                    } else if (item.uuid) {
                        await db.registrations.where('uuid').equals(item.uuid).modify({
                            sync_status: 'synced',
                            synced_at: now
                        });
                    }
                }
            });
        }

        console.log(`[AttendanceSync] Successfully pushed ${itemsToSync.length} attendance updates to Firestore.`);
        broadcastSyncState('synced', { count: itemsToSync.length });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hff-firebase-sync-complete'));
        }
    } catch (err) {
        console.error('[AttendanceSync] Error batch syncing attendance to Firebase:', err);
        // Put failed items back into queue
        for (const item of itemsToSync) {
            pendingAttendanceQueue.set(item.uuid, item);
        }
        broadcastSyncState('error', { error: err.message });
    }
}

/**
 * Queue an attendance update with automatic debounced Firestore commit
 */
export async function queueAttendanceUpdate({ participantId, participantUuid, updatedAttendance, attribution, lastDayIndex = null, books_received }) {
    const now = new Date().toISOString();

    const updateObj = {
        attendance: updatedAttendance,
        sync_status: 'pending',
        updated_at: now,
        updated_by_uid: attribution?.uid || null,
        updated_by_name: attribution?.name || null,
        updated_by_email: attribution?.email || null,
        updated_by_role: attribution?.role || null
    };
    if (books_received !== undefined) {
        updateObj.books_received = books_received;
    }

    // 1. Instant local persistence in Dexie (optimistic UI update, 0ms latency)
    try {
        if (participantId) {
            await db.registrations.update(participantId, updateObj);
        } else if (participantUuid) {
            await db.registrations.where('uuid').equals(participantUuid).modify(updateObj);
        }
    } catch (err) {
        console.warn('[AttendanceSync] Local Dexie update warning, attempting fallback by uuid:', err);
        if (participantUuid) {
            await db.registrations.where('uuid').equals(participantUuid).modify(updateObj);
        }
    }

    // 2. Enqueue for debounced Firestore batch write
    const existing = pendingAttendanceQueue.get(participantUuid) || {};
    pendingAttendanceQueue.set(participantUuid, {
        ...existing,
        id: participantId,
        uuid: participantUuid,
        attendance: updatedAttendance,
        ...(books_received !== undefined ? { books_received } : {}),
        attribution: attribution || {},
        updated_at: now,
        lastDayIndex
    });

    broadcastSyncState('saving', { pendingCount: pendingAttendanceQueue.size });

    // 3. Reset debounce timer (800ms)
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        flushAttendanceSyncImmediately();
    }, 800);
}

/**
 * Toggle attendance for a single participant on a specific day
 */
export async function toggleSingleAttendance({ participant, dayIndex, forceValue = null, user = null, profile = null }) {
    let currentAttendance = normalizeAttendance(participant.attendance);
    if (!Array.isArray(currentAttendance)) {
        currentAttendance = Array(TOTAL_CAMPAIGN_DAYS).fill(false);
    }

    const newValue = forceValue !== null ? forceValue : !currentAttendance[dayIndex];
    if (currentAttendance[dayIndex] === newValue) return currentAttendance;

    const updatedAttendance = [...currentAttendance];
    updatedAttendance[dayIndex] = newValue;

    const attribution = extractAttribution(user, profile);

    await queueAttendanceUpdate({
        participantId: participant.id,
        participantUuid: participant.uuid,
        updatedAttendance,
        attribution,
        lastDayIndex: dayIndex
    });

    return updatedAttendance;
}

/**
 * Mark or clear an entire day column for a list of participants
 */
export async function markDayColumnForGroup({ participants, dayIndex, presentValue = true, user = null, profile = null }) {
    if (!participants || participants.length === 0) return 0;

    const attribution = extractAttribution(user, profile);
    const now = new Date().toISOString();
    let updatedCount = 0;

    await db.transaction('rw', db.registrations, async () => {
        for (const p of participants) {
            let currentAttendance = normalizeAttendance(p.attendance);
            if (!Array.isArray(currentAttendance)) {
                currentAttendance = Array(TOTAL_CAMPAIGN_DAYS).fill(false);
            }

            if (currentAttendance[dayIndex] !== presentValue) {
                const updatedAttendance = [...currentAttendance];
                updatedAttendance[dayIndex] = presentValue;

                if (p.id) {
                    await db.registrations.update(p.id, {
                        attendance: updatedAttendance,
                        sync_status: 'pending',
                        updated_at: now,
                        updated_by_uid: attribution.uid,
                        updated_by_name: attribution.name,
                        updated_by_email: attribution.email
                    });
                } else if (p.uuid) {
                    await db.registrations.where('uuid').equals(p.uuid).modify({
                        attendance: updatedAttendance,
                        sync_status: 'pending',
                        updated_at: now,
                        updated_by_uid: attribution.uid,
                        updated_by_name: attribution.name,
                        updated_by_email: attribution.email
                    });
                }

                pendingAttendanceQueue.set(p.uuid, {
                    id: p.id,
                    uuid: p.uuid,
                    attendance: updatedAttendance,
                    attribution,
                    updated_at: now,
                    lastDayIndex: dayIndex
                });

                updatedCount++;
            }
        }
    });

    if (updatedCount > 0) {
        broadcastSyncState('saving', { pendingCount: pendingAttendanceQueue.size });
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            flushAttendanceSyncImmediately();
        }, 500);
    }

    return updatedCount;
}

/**
 * Mark or clear all days for a specific participant
 */
export async function markAllDaysForParticipant({ participant, presentValue = true, user = null, profile = null }) {
    const updatedAttendance = Array(TOTAL_CAMPAIGN_DAYS).fill(presentValue);
    const attribution = extractAttribution(user, profile);

    await queueAttendanceUpdate({
        participantId: participant.id,
        participantUuid: participant.uuid,
        updatedAttendance,
        attribution,
        lastDayIndex: null
    });

    return updatedAttendance;
}

/**
 * Toggle book received status and sync across local Dexie and Firestore
 */
export async function toggleBookReceivedSync({ participant, newStatus = null, user = null, profile = null }) {
    const statusToSet = newStatus !== null ? newStatus : !participant.books_received;
    const now = new Date().toISOString();
    const attribution = extractAttribution(user, profile);

    const updateObj = {
        books_received: statusToSet,
        sync_status: 'pending',
        updated_at: now,
        updated_by_uid: attribution?.uid || null,
        updated_by_name: attribution?.name || null,
        updated_by_email: attribution?.email || null
    };

    try {
        if (participant.id) {
            await db.registrations.update(participant.id, updateObj);
        } else if (participant.uuid) {
            await db.registrations.where('uuid').equals(participant.uuid).modify(updateObj);
        }
    } catch (err) {
        if (participant.uuid) {
            await db.registrations.where('uuid').equals(participant.uuid).modify(updateObj);
        }
    }

    const currentAttendance = normalizeAttendance(participant.attendance);
    const existing = pendingAttendanceQueue.get(participant.uuid) || {};
    pendingAttendanceQueue.set(participant.uuid, {
        ...existing,
        id: participant.id,
        uuid: participant.uuid,
        attendance: existing.attendance || currentAttendance,
        books_received: statusToSet,
        attribution,
        updated_at: now
    });

    broadcastSyncState('saving', { pendingCount: pendingAttendanceQueue.size });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        flushAttendanceSyncImmediately();
    }, 800);

    return statusToSet;
}

/**
 * Subscribe to real-time attendance changes from Firestore for a facilitator group
 */
export function subscribeToAttendanceRoster({ aliasUuids, onRemoteUpdate }) {
    if (!isConfigured || !aliasUuids || aliasUuids.length === 0) return () => {};

    // Stop any existing listener
    if (activeListenerUnsub) {
        activeListenerUnsub();
        activeListenerUnsub = null;
    }

    try {
        const targetUuids = aliasUuids.slice(0, 30); // Firestore 'in' limit is 30
        const q = query(
            collection(firestoreDb, 'registrations'),
            where('facilitator_uuid', 'in', targetUuids)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const remoteData = change.doc.data();
                    const uuid = remoteData.uuid || change.doc.id;

                    // If local record has a pending edit in flight, NEVER overwrite it!
                    if (pendingAttendanceQueue.has(uuid)) {
                        return;
                    }

                    const localRecord = await db.registrations.where('uuid').equals(uuid).first();
                    if (localRecord) {
                        if (localRecord.sync_status === 'pending') {
                            return; // User has unsynced local changes
                        }

                        // Reconcile if remote has newer timestamp
                        const remoteTime = new Date(remoteData.updated_at || 0).getTime();
                        const localTime = new Date(localRecord.updated_at || 0).getTime();

                        if (remoteTime > localTime) {
                            const localAtt = normalizeAttendance(localRecord.attendance);
                            const remoteAtt = normalizeAttendance(remoteData.attendance);
                            const mergedAtt = localAtt.map((val, idx) => Boolean(val || remoteAtt[idx]));
                            const lastMark = remoteData.last_attendance_mark;
                            if (lastMark && typeof lastMark.day_index === 'number' && lastMark.value === false) {
                                mergedAtt[lastMark.day_index] = false;
                            }

                            await db.registrations.update(localRecord.id, {
                                attendance: mergedAtt,
                                updated_at: remoteData.updated_at,
                                updated_by_name: remoteData.updated_by_name || localRecord.updated_by_name,
                                updated_by_email: remoteData.updated_by_email || localRecord.updated_by_email,
                                sync_status: 'synced',
                                synced_at: new Date().toISOString()
                            });

                            if (onRemoteUpdate) {
                                onRemoteUpdate({ ...remoteData, attendance: mergedAtt });
                            }
                        }
                    }
                }
            });
        }, (error) => {
            console.warn('[AttendanceSync] Real-time roster listener error:', error.message);
        });

        activeListenerUnsub = unsubscribe;
        return unsubscribe;
    } catch (err) {
        console.warn('[AttendanceSync] Could not attach real-time attendance listener:', err);
        return () => {};
    }
}

/**
 * React hook to observe attendance sync status in any component
 */
export function useAttendanceSyncStatus() {
    const [state, setState] = useState({
        status: currentSyncStatus,
        pendingCount: pendingAttendanceQueue.size,
        lastSyncedAt: lastSyncedTimestamp,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
    });

    useEffect(() => {
        const handleStatus = (e) => {
            setState(prev => ({
                ...prev,
                status: e.detail.status,
                pendingCount: e.detail.pendingCount ?? pendingAttendanceQueue.size,
                lastSyncedAt: e.detail.lastSyncedAt ?? prev.lastSyncedAt
            }));
        };

        const handleConn = (e) => {
            setState(prev => ({
                ...prev,
                isOnline: e.detail.online
            }));
        };

        window.addEventListener('hff-attendance-sync-status', handleStatus);
        window.addEventListener('hff-connectivity-status', handleConn);

        return () => {
            window.removeEventListener('hff-attendance-sync-status', handleStatus);
            window.removeEventListener('hff-connectivity-status', handleConn);
        };
    }, []);

    const flush = useCallback(async () => {
        await flushAttendanceSyncImmediately();
    }, []);

    return {
        ...state,
        flushSync: flush
    };
}
