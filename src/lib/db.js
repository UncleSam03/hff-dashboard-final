import db from './dexieDb.js';
import { resetLocalFromFirebase } from './firebaseSync.js';
import { reconcileWithCloud } from './syncManager.js';
import { DEFAULT_CAMPAIGN } from './campaignManager.js';

export const MOCHUDI_CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22';

/**
 * Invalidate local Dexie cache and re-fetch the complete Firestore dataset
 * for campaign 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22' (or specified campaign).
 */
export async function invalidateDexieCache(campaignId = MOCHUDI_CAMPAIGN_ID) {
    console.log(`[db] Invalidating Dexie cache for campaign: ${campaignId}...`);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('hff_last_pull_registrations');
            localStorage.removeItem('hff_last_pull_campaigns');
            localStorage.removeItem('hff_last_pull_notices');
            localStorage.removeItem('hff_last_pull_time');
        }
    } catch (e) {
        console.warn('[db] Failed clearing localStorage pull timestamps:', e);
    }

    // Force full snapshot reset from Firebase into Dexie
    await resetLocalFromFirebase();
    console.log(`[db] Cache invalidation & re-fetch completed for ${campaignId}.`);
    return true;
}

/**
 * Deep reconciliation with cloud Firestore
 */
export async function reSyncCampaign(campaignId = MOCHUDI_CAMPAIGN_ID) {
    console.log(`[db] Re-syncing campaign data with Cloud Firestore for ${campaignId}...`);
    await reconcileWithCloud();
    return true;
}

export { db };
export default db;
