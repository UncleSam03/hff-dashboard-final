import db from './dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN } from './campaignManager';
import { db as firestoreDb, isConfigured } from './firebase';
import { doc, deleteDoc } from 'firebase/firestore';

/**
 * Data Maintenance Utility
 * 
 * Functions to clean up and optimize the local database.
 */

const cleanForm = (f) => String(f || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^0+/, '');
const cleanStr = (s) => String(s || '').trim().toLowerCase();

/**
 * Merges duplicate registrations based on:
 * 1. Form Number + Type + Campaign (exact form duplicate)
 * 2. First Name + Last Name + Type + Campaign (person duplicate)
 * 
 * Information from all duplicates is combined into a single master record.
 * Redundant local records and cloud documents are permanently purged.
 * 
 * @param {Object} options 
 * @param {boolean} options.dryRun - If true, only log changes without applying them.
 * @param {string} [options.campaignId] - Optional campaign UUID to scope duplicates to.
 * @returns {Promise<Object>} Summary of the operation.
 */
export async function mergeDuplicateRegistrations({ dryRun = true, campaignId = null } = {}) {
    console.log(`[DataMaintenance] Starting deduplication (${dryRun ? 'DRY RUN' : 'LIVE'}) for campaign: ${campaignId || 'all'}...`);
    
    const allRegistrations = await db.registrations.toArray();
    const registrations = allRegistrations.filter(reg => {
        if (reg.is_deleted) return false;
        if (campaignId) {
            if (reg.campaign_id) return reg.campaign_id === campaignId;
            return campaignId === DEFAULT_CAMPAIGN.uuid;
        }
        return true;
    });

    if (registrations.length <= 1) {
        return { message: "No duplicates found.", duplicatesMerged: 0, recordsDeleted: 0, recordsUpdated: 0, results: [] };
    }

    // Cluster registrations using Disjoint Set / Map clustering
    const visited = new Set();
    const clusters = [];

    // Helper to test if two records are duplicate representations of the same person/form
    const areDuplicates = (a, b) => {
        if (a.id && b.id && a.id === b.id) return false;
        if (a.uuid && b.uuid && a.uuid === b.uuid) return true;

        // Must match type if both are present
        const typeA = cleanStr(a.type);
        const typeB = cleanStr(b.type);
        if (typeA && typeB && typeA !== typeB) return false;

        // Check 1: Matching Form Number
        const formA = cleanForm(a.form_number);
        const formB = cleanForm(b.form_number);
        if (formA && formB && formA === formB) {
            return true;
        }

        // Check 2: Matching First and Last Name
        const fnA = cleanStr(a.first_name);
        const fnB = cleanStr(b.first_name);
        const lnA = cleanStr(a.last_name);
        const lnB = cleanStr(b.last_name);

        if (fnA && lnA && fnA === fnB && lnA === lnB) {
            return true;
        }

        // Check 3: Matching full name string
        const fullA = cleanStr(`${a.first_name || ''} ${a.last_name || ''}`);
        const fullB = cleanStr(`${b.first_name || ''} ${b.last_name || ''}`);
        if (fullA && fullB && fullA.length > 3 && fullA === fullB) {
            return true;
        }

        return false;
    };

    const getRecKey = (r, idx) => (r.id !== undefined && r.id !== null ? `id_${r.id}` : (r.uuid ? `uuid_${r.uuid}` : `idx_${idx}`));

    for (let i = 0; i < registrations.length; i++) {
        const current = registrations[i];
        const currentKey = getRecKey(current, i);
        if (visited.has(currentKey)) continue;

        const cluster = [current];
        visited.add(currentKey);

        for (let j = i + 1; j < registrations.length; j++) {
            const candidate = registrations[j];
            const candidateKey = getRecKey(candidate, j);
            if (visited.has(candidateKey)) continue;

            if (cluster.some(member => areDuplicates(member, candidate))) {
                cluster.push(candidate);
                visited.add(candidateKey);
            }
        }

        if (cluster.length > 1) {
            clusters.push(cluster);
        }
    }

    if (clusters.length === 0) {
        return { message: "No duplicates found.", duplicatesMerged: 0, recordsDeleted: 0, recordsUpdated: 0, results: [] };
    }

    console.log(`[DataMaintenance] Found ${clusters.length} duplicate clusters.`);

    let recordsDeletedCount = 0;
    let recordsUpdatedCount = 0;
    const results = [];

    for (const members of clusters) {
        // Score each record to pick the most authoritative master
        const scoreRecord = (r) => {
            let score = 0;
            if (r.sync_status === 'synced') score += 10;
            if (r.form_number) score += 5;
            if (r.contact) score += 3;
            if (r.place) score += 2;
            if (r.education) score += 1;
            if (r.marital_status) score += 1;
            if (r.affiliation) score += 1;
            if (r.occupation) score += 1;
            if (r.meeting_time) score += 2;
            if (r.teaching_group) score += 2;
            if (r.attendance && (Array.isArray(r.attendance) ? r.attendance.some(Boolean) : Object.keys(r.attendance).length > 0)) score += 5;
            const time = new Date(r.updated_at || r.created_at || 0).getTime();
            score += (time / 1e14); // subtle tie-breaker for newer record
            return score;
        };

        const sorted = [...members].sort((a, b) => scoreRecord(b) - scoreRecord(a));
        const master = { ...sorted[0] };
        const others = sorted.slice(1);
        let changed = false;

        others.forEach(dup => {
            const fieldsToMerge = [
                'gender', 'contact', 'place', 'education', 
                'marital_status', 'occupation', 'affiliation',
                'facilitator_uuid', 'meeting_time', 'form_number',
                'group_form_number', 'teaching_group'
            ];

            fieldsToMerge.forEach(field => {
                if (!master[field] && dup[field]) {
                    master[field] = dup[field];
                    changed = true;
                }
            });

            if (!master.books_received && dup.books_received) {
                master.books_received = true;
                changed = true;
            }

            if (dup.attendance) {
                if (Array.isArray(dup.attendance)) {
                    if (!Array.isArray(master.attendance)) {
                        master.attendance = [...dup.attendance];
                        changed = true;
                    } else {
                        const mergedAtt = master.attendance.map((val, idx) => Boolean(val || dup.attendance[idx]));
                        if (JSON.stringify(mergedAtt) !== JSON.stringify(master.attendance)) {
                            master.attendance = mergedAtt;
                            changed = true;
                        }
                    }
                } else if (typeof dup.attendance === 'object') {
                    if (!master.attendance || typeof master.attendance !== 'object') master.attendance = {};
                    Object.entries(dup.attendance).forEach(([date, present]) => {
                        if (present && !master.attendance[date]) {
                            master.attendance[date] = true;
                            changed = true;
                        }
                    });
                }
            }
        });

        // Adopt campaign_id if master was missing it
        if (!master.campaign_id) {
            const withCamp = others.find(o => o.campaign_id);
            if (withCamp) {
                master.campaign_id = withCamp.campaign_id;
                changed = true;
            }
        }

        results.push({
            masterUuid: master.uuid || `local-${master.id}`,
            masterName: `${master.first_name} ${master.last_name}`.trim(),
            formNumber: master.form_number || '',
            othersUuids: others.map(o => o.uuid || `local-${o.id}`),
            othersIds: others.map(o => o.id),
            changesApplied: changed
        });

        if (!dryRun) {
            // Update master
            master.updated_at = new Date().toISOString();
            master.sync_status = 'pending';
            await db.registrations.update(master.id, master);

            // Permanently delete duplicate records from local IndexedDB
            for (const other of others) {
                if (other.id) {
                    await db.registrations.delete(other.id);
                }
                if (other.uuid && other.uuid !== master.uuid) {
                    await db.registrations.where('uuid').equals(other.uuid).delete();
                }
            }

            // Purge duplicate documents from Firestore if online and configured
            if (isConfigured && firestoreDb && navigator.onLine) {
                for (const other of others) {
                    if (other.uuid && other.uuid !== master.uuid) {
                        try {
                            const docRef = doc(firestoreDb, 'registrations', other.uuid);
                            await deleteDoc(docRef);
                            console.log(`[DataMaintenance] Purged remote duplicate document ${other.uuid}`);
                        } catch (delErr) {
                            console.warn(`[DataMaintenance] Could not delete remote doc ${other.uuid}:`, delErr.message);
                        }
                    }
                }
            }

            recordsDeletedCount += others.length;
            recordsUpdatedCount += 1;
        }
    }

    if (!dryRun) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            window.dispatchEvent(new CustomEvent('hff-firebase-data-updated'));
        }
    }

    return {
        message: dryRun ? `Dry run complete. Found ${clusters.length} duplicate groups.` : `Merge complete. Cleaned ${recordsDeletedCount} duplicate records.`,
        duplicatesMerged: clusters.length,
        recordsDeleted: dryRun ? clusters.reduce((acc, c) => acc + (c.length - 1), 0) : recordsDeletedCount,
        recordsUpdated: recordsUpdatedCount,
        results
    };
}

/**
 * Automatically runs a live deduplication pass on startup to clean up duplicates
 */
export async function autoDeduplicateRegistrations() {
    try {
        const res = await mergeDuplicateRegistrations({ dryRun: false });
        if (res.duplicatesMerged > 0) {
            console.log(`[AutoDeduplicate] Cleaned up ${res.duplicatesMerged} duplicate groups (${res.recordsDeleted} redundant records removed).`);
        }
    } catch (err) {
        console.warn('[AutoDeduplicate] Warning during automatic deduplication:', err);
    }
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

