import db from './dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN } from './campaignManager';

/**
 * Data Maintenance Utility
 * 
 * Functions to clean up and optimize the local database.
 */

/**
 * Merges duplicate registrations based on (first_name, last_name, age, affiliation).
 * Information from all duplicates is combined into a single master record.
 * 
 * @param {Object} options 
 * @param {boolean} options.dryRun - If true, only log changes without applying them.
 * @param {string} [options.campaignId] - Optional campaign UUID to scope duplicates to.
 * @returns {Promise<Object>} Summary of the operation.
 */
export async function mergeDuplicateRegistrations({ dryRun = true, campaignId = null } = {}) {
    const activeCampId = campaignId || getActiveCampaignId();
    console.log(`[DataMaintenance] Starting merge process (${dryRun ? 'DRY RUN' : 'LIVE'}) for campaign: ${activeCampId || 'all'}...`);
    
    const allRegistrations = await db.registrations.toArray();
    const registrations = allRegistrations.filter(reg => {
        if (reg.is_deleted) return false;
        if (activeCampId) {
            if (reg.campaign_id) return reg.campaign_id === activeCampId;
            return activeCampId === DEFAULT_CAMPAIGN.uuid;
        }
        return true;
    });

    const groups = new Map();

    // 1. Group by (first_name, last_name, age, affiliation)
    registrations.forEach(reg => {
        // Normalize for matching
        const fn = (reg.first_name || '').trim().toLowerCase();
        const ln = (reg.last_name || '').trim().toLowerCase();
        const age = reg.age || 'unknown';
        const aff = (reg.affiliation || '').trim().toLowerCase();
        
        const key = `${fn}|${ln}|${age}|${aff}`;
        
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(reg);
    });

    const duplicatesFound = [];
    for (const [key, members] of groups.entries()) {
        if (members.length > 1) {
            duplicatesFound.push({ key, members });
        }
    }

    if (duplicatesFound.length === 0) {
        return { message: "No duplicates found.", duplicatesMerged: 0, recordsDeleted: 0 };
    }

    console.log(`[DataMaintenance] Found ${duplicatesFound.length} sets of duplicates.`);

    let recordsDeletedCount = 0;
    let recordsUpdatedCount = 0;

    const results = [];

    for (const { members } of duplicatesFound) {
        // Sort by updated_at descending, then created_at descending
        const sorted = [...members].sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0);
            const dateB = new Date(b.updated_at || b.created_at || 0);
            return dateB - dateA;
        });

        const master = { ...sorted[0] };
        const others = sorted.slice(1);
        
        let changed = false;

        others.forEach(dup => {
            // Merge simple fields if master is missing them
            const fieldsToMerge = [
                'gender', 'contact', 'place', 'education', 
                'marital_status', 'occupation', 'facilitator_uuid'
            ];

            fieldsToMerge.forEach(field => {
                if (!master[field] && dup[field]) {
                    master[field] = dup[field];
                    changed = true;
                }
            });

            // Special handling for books_received (boolean)
            if (!master.books_received && dup.books_received) {
                master.books_received = true;
                changed = true;
            }

            // Special handling for attendance (object map)
            if (dup.attendance && typeof dup.attendance === 'object') {
                if (!master.attendance) master.attendance = {};
                
                Object.entries(dup.attendance).forEach(([date, present]) => {
                    if (present && !master.attendance[date]) {
                        master.attendance[date] = true;
                        changed = true;
                    }
                });
            }
        });

        if (!master.campaign_id && activeCampId) {
            master.campaign_id = activeCampId;
            changed = true;
        }

        if (changed) {
            master.updated_at = new Date().toISOString();
            master.sync_status = 'pending'; // Ensure it gets pushed to Firebase
        }

        results.push({
            masterUuid: master.uuid,
            othersUuids: others.map(o => o.uuid),
            masterName: `${master.first_name} ${master.last_name}`,
            changesApplied: changed
        });

        if (!dryRun) {
            await db.transaction('rw', db.registrations, async () => {
                // Update master
                await db.registrations.update(master.id, master);
                
                // Mark others as deleted (Soft Delete)
                for (const other of others) {
                    await db.registrations.update(other.id, {
                        ...other,
                        is_deleted: true,
                        sync_status: 'pending',
                        updated_at: new Date().toISOString()
                    });
                }
            });
            recordsDeletedCount += others.length;
            recordsUpdatedCount += 1;
        }
    }

    if (!dryRun && typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
    }

    return {
        message: dryRun ? "Dry run complete. Check logs." : "Merge complete.",
        duplicatesMerged: duplicatesFound.length,
        recordsDeleted: dryRun ? othersCount(duplicatesFound) : recordsDeletedCount,
        recordsUpdated: recordsUpdatedCount,
        results
    };
}

function othersCount(duplicatesFound) {
    return duplicatesFound.reduce((acc, group) => acc + (group.members.length - 1), 0);
}

/**
 * Auto-sanitizes raw string types in IndexedDB into native types.
 * Converts string JSON attendance to Array, string booleans ("TRUE"/"FALSE") to boolean,
 * and string numbers to integer.
 */
export async function sanitizeExistingRegistrations() {
    try {
        const records = await db.registrations.toArray();
        const parseBool = (v, defaultVal = false) => {
            if (v === undefined || v === null || v === '') return defaultVal;
            if (typeof v === 'boolean') return v;
            const s = String(v).trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === '✓') return true;
            if (s === 'false' || s === '0' || s === 'no') return false;
            return defaultVal;
        };

        const parseIntOrNull = (v) => {
            if (v === undefined || v === null || v === '') return null;
            if (typeof v === 'number') return v;
            const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
            return isNaN(n) ? null : n;
        };

        const updates = [];

        for (const r of records) {
            let needsUpdate = false;
            const updated = {};

            // 1. Attendance
            if (typeof r.attendance === 'string') {
                const trimmed = r.attendance.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (Array.isArray(parsed)) {
                            updated.attendance = parsed.map(Boolean);
                            needsUpdate = true;
                        }
                    } catch {}
                }
            }

            // 2. Books received
            if (typeof r.books_received === 'string') {
                updated.books_received = parseBool(r.books_received, false);
                needsUpdate = true;
            }

            // 3. Is deleted
            if (typeof r.is_deleted === 'string') {
                updated.is_deleted = parseBool(r.is_deleted, false);
                needsUpdate = true;
            }

            // 4. Processed
            if (typeof r.processed === 'string') {
                updated.processed = parseBool(r.processed, false);
                needsUpdate = true;
            }

            // 5. Age
            if (typeof r.age === 'string' && r.age.trim() !== '') {
                const parsedAge = parseIntOrNull(r.age);
                if (parsedAge !== null) {
                    updated.age = parsedAge;
                    needsUpdate = true;
                }
            }

            // 6. Participants count
            if (typeof r.participants_count === 'string' && r.participants_count.trim() !== '') {
                const parsedCount = parseIntOrNull(r.participants_count);
                if (parsedCount !== null) {
                    updated.participants_count = parsedCount;
                    needsUpdate = true;
                }
            }

            // 7. Books distributed
            if (typeof r.books_distributed === 'string' && r.books_distributed.trim() !== '') {
                const parsedDist = parseIntOrNull(r.books_distributed);
                if (parsedDist !== null) {
                    updated.books_distributed = parsedDist;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                updates.push({ id: r.id, ...updated });
            }
        }

        if (updates.length > 0) {
            console.log(`[DataSanitizer] Auto-sanitizing ${updates.length} records in IndexedDB...`);
            const CHUNK_SIZE = 500;
            for (let c = 0; c < updates.length; c += CHUNK_SIZE) {
                const chunk = updates.slice(c, c + CHUNK_SIZE);
                await db.transaction('rw', db.registrations, async () => {
                    for (const item of chunk) {
                        const { id, ...fields } = item;
                        await db.registrations.update(id, fields);
                    }
                });
            }
            console.log(`[DataSanitizer] Completed sanitization of ${updates.length} records.`);
            window.dispatchEvent(new CustomEvent('hff-firebase-data-updated'));
        }
    } catch (err) {
        console.warn('[DataSanitizer] Sanitization warning:', err);
    }
}

