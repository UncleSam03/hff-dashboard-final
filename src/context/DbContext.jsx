import React, { createContext, useContext, useState, useCallback } from 'react';
import db, { invalidateDexieCache, reSyncCampaign, MOCHUDI_CAMPAIGN_ID } from '../lib/db.js';

export const DbContext = createContext(null);

export function DbProvider({ children }) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncError, setSyncError] = useState(null);

    const triggerInvalidateCache = useCallback(async (campaignId = MOCHUDI_CAMPAIGN_ID) => {
        setIsSyncing(true);
        setSyncError(null);
        try {
            await invalidateDexieCache(campaignId);
            setLastSyncTime(new Date().toISOString());
        } catch (err) {
            console.error('[DbContext] Invalidate cache failed:', err);
            setSyncError(err.message || String(err));
            throw err;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    const triggerReSync = useCallback(async (campaignId = MOCHUDI_CAMPAIGN_ID) => {
        setIsSyncing(true);
        setSyncError(null);
        try {
            await reSyncCampaign(campaignId);
            setLastSyncTime(new Date().toISOString());
        } catch (err) {
            console.error('[DbContext] Re-sync failed:', err);
            setSyncError(err.message || String(err));
            throw err;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    return (
        <DbContext.Provider value={{
            db,
            isSyncing,
            lastSyncTime,
            syncError,
            invalidateCache: triggerInvalidateCache,
            reSync: triggerReSync,
            campaignId: MOCHUDI_CAMPAIGN_ID
        }}>
            {children}
        </DbContext.Provider>
    );
}

export function useDb() {
    const ctx = useContext(DbContext);
    if (!ctx) {
        return {
            db,
            isSyncing: false,
            lastSyncTime: null,
            syncError: null,
            invalidateCache: invalidateDexieCache,
            reSync: reSyncCampaign,
            campaignId: MOCHUDI_CAMPAIGN_ID
        };
    }
    return ctx;
}

export default DbContext;
