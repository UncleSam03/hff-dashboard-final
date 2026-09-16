import db from './dexieDb';
import * as XLSX from 'xlsx';
import { parseHffRegisterRows, detectHffHeaderRowIndex } from './hffRegister';

export const DEFAULT_CAMPAIGN = {
    uuid: 'campaign-default-mahalapye',
    name: 'Mahalapye West Campaign',
    village: 'Mahalapye',
    year: '2026',
    status: 'active',
    description: 'Evidence-based community and family strengthening program in Central District.',
    targetAttendees: 500,
    created_at: '2026-01-15T08:00:00.000Z',
    sync_status: 'synced'
};

const STORAGE_KEY = 'hff_active_campaign_id';

/**
 * Initialize default campaign if none exists, and link existing unassigned records
 */
export async function seedDefaultCampaignIfEmpty() {
    try {
        const count = await db.campaigns.count();
        if (count === 0) {
            await db.campaigns.add({
                ...DEFAULT_CAMPAIGN,
                created_at: new Date().toISOString()
            });
        }

        // Backfill any existing records without a campaign_id to default
        const unassigned = await db.registrations.filter(r => !r.campaign_id).toArray();
        if (unassigned.length > 0) {
            console.log(`[CampaignManager] Backfilling ${unassigned.length} records to default campaign`);
            await db.transaction('rw', db.registrations, async () => {
                for (const r of unassigned) {
                    await db.registrations.update(r.id, { campaign_id: DEFAULT_CAMPAIGN.uuid });
                }
            });
        }
    } catch (err) {
        console.warn('[CampaignManager] Seeding default campaign warning:', err);
    }
}

/**
 * Get all campaigns from Dexie
 */
export async function getAllCampaigns() {
    await seedDefaultCampaignIfEmpty();
    return db.campaigns.toArray();
}

/**
 * Get active campaign UUID
 */
export function getActiveCampaignId() {
    return localStorage.getItem(STORAGE_KEY) || null;
}

/**
 * Set active campaign UUID
 */
export function setActiveCampaignId(uuid) {
    if (uuid) {
        localStorage.setItem(STORAGE_KEY, uuid);
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

/**
 * Create a new campaign
 */
export async function createCampaign({ name, village, targetAttendees }) {
    const uuid = 'campaign-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36));
    const campaign = {
        uuid,
        name: (name || 'New Campaign').trim(),
        village: (village || 'National').trim(),
        year: String(new Date().getFullYear()),
        targetAttendees: Number(targetAttendees) || 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
    };
    await db.campaigns.add(campaign);
    window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
    return campaign;
}

/**
 * Delete a campaign and its associated records
 */
export async function deleteCampaign(uuid) {
    if (uuid === DEFAULT_CAMPAIGN.uuid) {
        throw new Error('Default campaign cannot be deleted.');
    }
    await db.transaction('rw', [db.campaigns, db.registrations], async () => {
        await db.campaigns.where('uuid').equals(uuid).delete();
        await db.registrations.where('campaign_id').equals(uuid).delete();
    });
    if (getActiveCampaignId() === uuid) {
        setActiveCampaignId(null);
    }
    window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
}

/**
 * Parse an uploaded CSV or XLSX file and import into a specific campaign
 */
export async function importFileToCampaign(file, campaignId) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (!rows || rows.length === 0) {
                    throw new Error('The selected file is empty.');
                }

                // Check if it's the HFF Attendance Register format (has a "No." header)
                const hasHffHeader = detectHffHeaderRowIndex(rows) >= 0;
                let importedCount = 0;

                if (hasHffHeader) {
                    const parsed = parseHffRegisterRows(rows);
                    const records = (parsed.participants || []).map(p => ({
                        uuid: 'reg-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
                        first_name: p.firstName || '',
                        last_name: p.lastName || '',
                        gender: p.gender || 'Unknown',
                        age: p.age ? String(p.age) : '',
                        education: p.education || '',
                        marital_status: p.maritalStatus || '',
                        occupation: p.occupation || '',
                        type: 'participant',
                        affiliation: '',
                        attendance: p.attendance || {},
                        books_received: false,
                        campaign_id: campaignId,
                        sync_status: 'pending',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }));

                    if (records.length > 0) {
                        await db.registrations.bulkAdd(records);
                        importedCount = records.length;
                    }
                } else {
                    // Standard tabular CSV format (First row is headers)
                    const headers = (rows[0] || []).map(h => String(h || '').trim().toLowerCase());
                    const findCol = (...aliases) => headers.findIndex(h => aliases.some(a => h.includes(a)));

                    const fnCol = findCol('first name', 'firstname', 'first', 'name');
                    const lnCol = findCol('last name', 'lastname', 'surname');
                    const typeCol = findCol('type', 'role');
                    const genCol = findCol('gender', 'sex');
                    const ageCol = findCol('age');
                    const eduCol = findCol('education');
                    const marCol = findCol('marital');
                    const occCol = findCol('occupation', 'job');
                    const affCol = findCol('affiliation', 'organization', 'group');

                    const records = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;
                        const firstName = fnCol >= 0 ? String(row[fnCol] || '').trim() : String(row[0] || '').trim();
                        if (!firstName) continue;

                        const lastName = lnCol >= 0 ? String(row[lnCol] || '').trim() : '';
                        const rawType = typeCol >= 0 ? String(row[typeCol] || '').toLowerCase() : 'participant';
                        const type = rawType.includes('fac') ? 'facilitator' : 'participant';
                        const gender = genCol >= 0 ? String(row[genCol] || '').trim() : 'Unknown';
                        const age = ageCol >= 0 ? String(row[ageCol] || '').trim() : '';
                        const education = eduCol >= 0 ? String(row[eduCol] || '').trim() : '';
                        const marital_status = marCol >= 0 ? String(row[marCol] || '').trim() : '';
                        const occupation = occCol >= 0 ? String(row[occCol] || '').trim() : '';
                        const affiliation = affCol >= 0 ? String(row[affCol] || '').trim() : '';

                        records.push({
                            uuid: 'reg-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
                            first_name: firstName,
                            last_name: lastName,
                            type,
                            gender,
                            age,
                            education,
                            marital_status,
                            occupation,
                            affiliation,
                            attendance: {},
                            books_received: false,
                            campaign_id: campaignId,
                            sync_status: 'pending',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    }

                    if (records.length > 0) {
                        await db.registrations.bulkAdd(records);
                        importedCount = records.length;
                    }
                }

                window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
                resolve({ success: true, count: importedCount });
            } catch (err) {
                console.error('[CampaignManager] File import failed:', err);
                reject(err);
            }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}
