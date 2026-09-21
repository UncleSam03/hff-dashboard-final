import db from './dexieDb';
import * as XLSX from 'xlsx';
import { parseHffRegisterRows, detectHffHeaderRowIndex, normalizeGender } from './hffRegister';

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

                const parseBool = (val, defaultVal = false) => {
                    if (val === undefined || val === null || val === '') return defaultVal;
                    if (typeof val === 'boolean') return val;
                    const s = String(val).trim().toLowerCase();
                    if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === '✓') return true;
                    if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
                    return defaultVal;
                };

                const parseIntOrNull = (val) => {
                    if (val === undefined || val === null || val === '') return null;
                    const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
                    return isNaN(n) ? null : n;
                };

                const parseStringOrNull = (val) => {
                    if (val === undefined || val === null) return null;
                    const s = String(val).trim();
                    return s === '' ? null : s;
                };

                const safeIsoDate = (val, fallback) => {
                    if (!val) return fallback;
                    try {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) return d.toISOString();
                    } catch {
                        // ignore invalid date strings
                    }
                    return fallback;
                };

                const parseAttendance = (val) => {
                    if (!val) return Array(12).fill(false);
                    if (Array.isArray(val)) {
                        return val.map(v => Boolean(v));
                    }
                    if (typeof val === 'object') {
                        return val;
                    }
                    if (typeof val === 'string') {
                        const trimmed = val.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            try {
                                const parsed = JSON.parse(trimmed);
                                if (Array.isArray(parsed)) {
                                    return parsed.map(v => Boolean(v));
                                }
                            } catch {
                                // fallback below
                            }
                        }
                    }
                    return Array(12).fill(false);
                };

                const isUuidLike = (s) => typeof s === 'string' && s.length >= 24 && s.includes('-');

                const records = [];

                if (hasHffHeader) {
                    const parsed = parseHffRegisterRows(rows);
                    const now = new Date().toISOString();
                    for (const p of (parsed.participants || [])) {
                        records.push({
                            uuid: (crypto.randomUUID ? crypto.randomUUID() : 'reg-' + Math.random().toString(36).slice(2)),
                            first_name: p.firstName || '',
                            last_name: p.lastName || '',
                            gender: p.gender || 'Unknown',
                            age: p.age ? parseIntOrNull(p.age) : null,
                            education: p.education || null,
                            marital_status: p.maritalStatus || null,
                            occupation: p.occupation || null,
                            type: 'participant',
                            affiliation: p.affiliation || null,
                            contact: p.contact || null,
                            place: p.place || null,
                            participants_count: null,
                            books_distributed: null,
                            books_received: Boolean(p.booksReceived),
                            facilitator_uuid: null,
                            attendance: Array.isArray(p.attendance) ? p.attendance : parseAttendance(p.attendance),
                            source: 'excel_register',
                            campaign_id: campaignId,
                            sync_status: 'pending',
                            created_at: now,
                            updated_at: now,
                            is_deleted: false,
                            processed: false
                        });
                    }
                } else {
                    // Standard tabular CSV format (First row is headers)
                    const headers = (rows[0] || []).map(h => String(h || '').trim().toLowerCase());
                    const findCol = (...aliases) => {
                        const exact = headers.findIndex(h => aliases.some(a => h === a));
                        if (exact >= 0) return exact;
                        const starts = headers.findIndex(h => aliases.some(a => h.startsWith(a)));
                        if (starts >= 0) return starts;
                        return headers.findIndex(h => aliases.some(a => h.includes(a)));
                    };

                    const uuidCol = findCol('uuid');
                    const idCol = findCol('id');
                    const fnCol = findCol('first_name', 'firstname', 'first name', 'first');
                    const lnCol = findCol('last_name', 'lastname', 'last name', 'surname');
                    const typeCol = findCol('type', 'role');
                    const genCol = findCol('gender', 'sex', 'bong');
                    const ageCol = findCol('age');
                    const contactCol = findCol('contact', 'phone', 'cell', 'telephone', 'mobile');
                    const placeCol = findCol('place', 'location', 'village', 'town');
                    const eduCol = findCol('education', 'education_level');
                    const marCol = findCol('marital_status', 'marital');
                    const occCol = findCol('occupation', 'job');
                    const affCol = findCol('affiliation', 'organization', 'organisation', 'ward', 'group');
                    const partCountCol = findCol('participants_count', 'hall group', 'participants count', 'participants');
                    const booksDistCol = findCol('books_distributed', 'books distributed');
                    const booksRecCol = findCol('books_received', 'books received', 'books');
                    const facUuidCol = findCol('facilitator_uuid', 'facilitator uuid', 'facilitator_id');
                    const attendanceCol = findCol('attendance');
                    const sourceCol = findCol('source');
                    const createdAtCol = findCol('created_at', 'created at');
                    const updatedAtCol = findCol('updated_at', 'updated at');
                    const processedCol = findCol('processed');
                    const deletedCol = findCol('is_deleted', 'deleted');
                    const formNumCol = findCol('form_number', 'form number');
                    const grpFormNumCol = findCol('group_form_number', 'group form number');
                    const teachGrpCol = findCol('teaching_group', 'teaching group');
                    const meetTimeCol = findCol('meeting_time', 'meeting time');

                    // Detect if there are individual day columns Day 1, Day 2, ..., Day 12
                    const dayCols = [];
                    for (let d = 1; d <= 12; d++) {
                        const colIdx = findCol(`day ${d}`, `day_${d}`, `day${d}`, `d${d}`, `attendance_day${d}`, `attendance_${d}`);
                        dayCols.push(colIdx);
                    }
                    const hasDayCols = dayCols.some(idx => idx >= 0);

                    const now = new Date().toISOString();

                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;

                        const firstName = fnCol >= 0 ? parseStringOrNull(row[fnCol]) : parseStringOrNull(row[0]);
                        if (!firstName) continue;

                        const rawUuid = uuidCol >= 0 ? parseStringOrNull(row[uuidCol]) : null;
                        const rawId = idCol >= 0 ? parseStringOrNull(row[idCol]) : null;
                        const recordUuid = isUuidLike(rawUuid) 
                            ? rawUuid 
                            : (isUuidLike(rawId) ? rawId : (crypto.randomUUID ? crypto.randomUUID() : 'reg-' + Math.random().toString(36).slice(2)));

                        const lastName = lnCol >= 0 ? parseStringOrNull(row[lnCol]) || '' : '';
                        const rawType = typeCol >= 0 ? String(row[typeCol] || '').toLowerCase() : 'participant';
                        const type = rawType.includes('fac') ? 'facilitator' : 'participant';
                        const gender = genCol >= 0 ? normalizeGender(row[genCol]) : 'Unknown';
                        const age = ageCol >= 0 ? parseIntOrNull(row[ageCol]) : null;
                        const contact = contactCol >= 0 ? parseStringOrNull(row[contactCol]) : null;
                        const place = placeCol >= 0 ? parseStringOrNull(row[placeCol]) : null;
                        const education = eduCol >= 0 ? parseStringOrNull(row[eduCol]) : null;
                        const marital_status = marCol >= 0 ? parseStringOrNull(row[marCol]) : null;
                        const occupation = occCol >= 0 ? parseStringOrNull(row[occCol]) : null;
                        const affiliation = affCol >= 0 ? parseStringOrNull(row[affCol]) : null;
                        const participants_count = partCountCol >= 0 ? parseIntOrNull(row[partCountCol]) : (type === 'facilitator' ? 1 : null);
                        const books_distributed = booksDistCol >= 0 ? parseIntOrNull(row[booksDistCol]) : (type === 'facilitator' ? 0 : null);
                        const books_received = booksRecCol >= 0 ? parseBool(row[booksRecCol], false) : false;
                        const facilitator_uuid = facUuidCol >= 0 ? parseStringOrNull(row[facUuidCol]) : null;

                        let attendance = Array(12).fill(false);
                        if (attendanceCol >= 0 && row[attendanceCol] !== undefined && row[attendanceCol] !== null && String(row[attendanceCol]).trim() !== '') {
                            attendance = parseAttendance(row[attendanceCol]);
                        } else if (hasDayCols) {
                            attendance = dayCols.map(colIdx => {
                                if (colIdx < 0 || row[colIdx] === undefined || row[colIdx] === null || row[colIdx] === '') return false;
                                return parseBool(row[colIdx], false);
                            });
                        }
                        const source = sourceCol >= 0 && parseStringOrNull(row[sourceCol]) ? parseStringOrNull(row[sourceCol]) : 'csv_import';
                        const created_at = createdAtCol >= 0 ? safeIsoDate(row[createdAtCol], now) : now;
                        const updated_at = updatedAtCol >= 0 ? safeIsoDate(row[updatedAtCol], now) : now;
                        const is_deleted = deletedCol >= 0 ? parseBool(row[deletedCol], false) : false;
                        const processed = processedCol >= 0 ? parseBool(row[processedCol], false) : false;
                        const form_number = formNumCol >= 0 ? parseStringOrNull(row[formNumCol]) : null;
                        const group_form_number = grpFormNumCol >= 0 ? parseStringOrNull(row[grpFormNumCol]) : null;
                        const teaching_group = teachGrpCol >= 0 ? parseBool(row[teachGrpCol], type === 'facilitator') : (type === 'facilitator');
                        const meeting_time = meetTimeCol >= 0 ? parseStringOrNull(row[meetTimeCol]) : null;

                        records.push({
                            uuid: recordUuid,
                            first_name: firstName,
                            last_name: lastName,
                            type,
                            gender,
                            age,
                            contact,
                            place,
                            education,
                            marital_status,
                            occupation,
                            affiliation,
                            participants_count,
                            books_distributed,
                            books_received,
                            facilitator_uuid,
                            attendance,
                            source,
                            form_number,
                            group_form_number,
                            teaching_group,
                            meeting_time,
                            campaign_id: campaignId,
                            sync_status: 'pending',
                            created_at,
                            updated_at,
                            is_deleted,
                            processed
                        });
                    }
                }

                if (records.length > 0) {
                    // Check for existing records to prevent duplicates and safely update/insert
                    const existing = await db.registrations.where('campaign_id').equals(campaignId).toArray();
                    const existingMap = new Map(existing.map(r => [r.uuid, r.id]));
                    const toAdd = [];
                    const toUpdate = [];

                    for (const rec of records) {
                        if (existingMap.has(rec.uuid)) {
                            toUpdate.push({ ...rec, id: existingMap.get(rec.uuid) });
                        } else {
                            toAdd.push(rec);
                        }
                    }

                    const CHUNK_SIZE = 500;
                    if (toAdd.length > 0) {
                        for (let c = 0; c < toAdd.length; c += CHUNK_SIZE) {
                            await db.registrations.bulkAdd(toAdd.slice(c, c + CHUNK_SIZE));
                        }
                    }
                    if (toUpdate.length > 0) {
                        for (let c = 0; c < toUpdate.length; c += CHUNK_SIZE) {
                            await db.registrations.bulkPut(toUpdate.slice(c, c + CHUNK_SIZE));
                        }
                    }

                    importedCount = records.length;
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
