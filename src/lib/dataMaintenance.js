import db from './dexieDb';
import { supabase, isConfigured } from './supabase';
import { checkConnectivity } from './syncManager';

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
 * @returns {Promise<Object>} Summary of the operation.
 */
export async function mergeDuplicateRegistrations({ dryRun = true } = {}) {
    console.log(`[DataMaintenance] Starting merge process (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    
    const allRegistrations = await db.registrations.toArray();
    const groups = new Map();

    // 1. Group by (first_name, last_name, age, affiliation)
    allRegistrations.forEach(reg => {
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

    for (const { key, members } of duplicatesFound) {
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

        if (changed) {
            master.updated_at = new Date().toISOString();
            master.sync_status = 'pending'; // Ensure it gets pushed to Supabase
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

    return {
        message: dryRun ? "Dry run complete. Check logs." : "Merge complete.",
        duplicatesMerged: duplicatesFound.length,
        recordsDeleted: dryRun ? othersCount(duplicatesFound) : recordsDeletedCount,
        results
    };
}

function othersCount(duplicatesFound) {
    return duplicatesFound.reduce((acc, group) => acc + (group.members.length - 1), 0);
}
