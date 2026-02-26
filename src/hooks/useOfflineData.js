import { useState, useEffect } from 'react';
import db from '../lib/dexieDb';

/**
 * Custom hook for managing offline participant data via IndexedDB (Dexie).
 * 
 * Features:
 * - Immediate offline saving of new registrations.
 * - Tracking of sync_status (pending, synced, failed).
 * - Automatic background loading of stored records.
 */
const useOfflineData = () => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial load of all participants from IndexedDB
    useEffect(() => {
        loadParticipants();

        // Refresh when sync completes or data is updated from Supabase
        window.addEventListener('hff-supabase-sync-complete', loadParticipants);
        window.addEventListener('hff-supabase-data-updated', loadParticipants);

        return () => {
            window.removeEventListener('hff-supabase-sync-complete', loadParticipants);
            window.removeEventListener('hff-supabase-data-updated', loadParticipants);
        };
    }, []);

    const loadParticipants = async () => {
        setLoading(true);
        try {
            const allParticipants = await db.participants.reverse().toArray();
            setParticipants(allParticipants);
        } catch (error) {
            console.error("Failed to load offline participants:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Saves a new participant record to IndexedDB immediately.
     * Marks sync_status as 'pending' by default.
     * 
     * @param {Object} data - Participant data (name, gender, age, attendance, etc.)
     */
    const saveRegistration = async (data) => {
        const record = {
            uuid: data.uuid || crypto.randomUUID(),
            name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            gender: data.gender || 'Unknown',
            age: data.age || null,
            // 12-day attendance array (defaults to 12 falses if not provided)
            attendance: data.attendance || Array(12).fill(false),
            sync_status: 'pending',
            createdAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data
        };

        try {
            const id = await db.participants.add(record);
            console.log(`[OfflineData] Saved registration ${record.uuid} to IndexedDB.`);
            await loadParticipants(); // Refresh local state
            return id;
        } catch (error) {
            console.error("[OfflineData] Error saving offline:", error);
            throw error;
        }
    };

    /**
     * Updates the sync status of a record.
     * Valid statuses: 'pending', 'synced', 'failed'
     */
    const updateSyncStatus = async (id, status) => {
        try {
            await db.participants.update(id, {
                sync_status: status,
                syncedAt: status === 'synced' ? new Date() : undefined
            });
            await loadParticipants();
        } catch (error) {
            console.error("[OfflineData] Error updating sync status:", error);
        }
    };

    /**
     * Retrieves only pending records for sync operations.
     */
    const getPendingRecords = async () => {
        return await db.participants.where('sync_status').equals('pending').toArray();
    };

    return {
        participants,
        loading,
        saveRegistration,
        updateSyncStatus,
        getPendingRecords,
        refresh: loadParticipants
    };
};

export default useOfflineData;
