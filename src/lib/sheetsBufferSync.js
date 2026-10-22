import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';
import db from './dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN } from './campaignManager';
import { normalizeAttendance } from './analytics';
import { TOTAL_CAMPAIGN_DAYS } from './constants';
import * as XLSX from 'xlsx';

const LOCAL_CONFIG_KEY = 'hff_sheets_buffer_config_v1';
const FIRESTORE_SETTINGS_COLLECTION = 'system_config';
const FIRESTORE_BUFFER_DOC_ID = 'hff_sheets_buffer_config';
export const DEFAULT_SPREADSHEET_ID = '1iTQt1eDPPbpTBKIFT5u2vxCPzxj-G2pQeEQNHyzDAbc';
export const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1iTQt1eDPPbpTBKIFT5u2vxCPzxj-G2pQeEQNHyzDAbc/edit';
export const DEFAULT_GOOGLE_SHEETS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

const MASTER_TAB_NAME = 'MASTER_UNIFORM_REGISTER';
const RETIRED_CAMPAIGN_IDS = new Set([
    'campaign-e8d8587a-f452-4d61-bf9c-3b6d60687e19',
    'campaign-e1d93920-a3d4-4b92-b027-3053253a0ece'
]);

export const SHEET_HEADERS = [
    'UUID',
    'Campaign ID',
    'Record Type',
    'Form #',
    'Group Form #',
    'Facilitator UUID',
    'First Name',
    'Last Name',
    'Gender',
    'Age',
    'Phone / Contact',
    'Location / Zone',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12',
    'Total Days',
    'Books Received',
    'Entered By (Profile)',
    'Entered By Email',
    'Updated At (ISO)',
    'Source Tab'
];

let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

function extractSpreadsheetId(config) {
    if (config?.spreadsheetId) return config.spreadsheetId;
    const url = config?.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_URL;
    const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : DEFAULT_SPREADSHEET_ID;
}

async function getGoogleSheetsAccessToken(oauth) {
    if (!oauth?.clientId || !oauth?.clientSecret || !oauth?.refreshToken) {
        return null;
    }
    if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 60000) {
        return cachedAccessToken;
    }
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: oauth.clientId,
            client_secret: oauth.clientSecret,
            refresh_token: oauth.refreshToken,
            grant_type: 'refresh_token'
        })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.access_token) return null;
    cachedAccessToken = data.access_token;
    cachedTokenExpiresAt = Date.now() + ((data.expires_in || 3500) * 1000);
    return cachedAccessToken;
}

function recordToRow(r, sourceTabName) {
    const att = Array.isArray(r.attendance) ? r.attendance : [];
    const days = [];
    let totalDays = 0;
    for (let i = 0; i < 12; i++) {
        const present = Boolean(att[i]);
        days.push(present ? 'TRUE' : 'FALSE');
        if (present) totalDays++;
    }

    return [
        String(r.uuid || ''),
        String(r.campaign_id || DEFAULT_CAMPAIGN.uuid),
        String(r.type || 'participant'),
        String(r.form_number || ''),
        String(r.group_form_number || r.form_number || ''),
        String(r.facilitator_uuid || ''),
        String(r.first_name || '').trim(),
        String(r.last_name || '').trim(),
        String(r.gender || 'F'),
        r.age !== undefined && r.age !== null ? String(r.age) : '',
        String(r.contact || ''),
        String(r.place || ''),
        ...days,
        totalDays,
        r.books_received ? 'TRUE' : 'FALSE',
        String(r.updated_by_name || r.created_by_name || ''),
        String(r.updated_by_email || r.created_by_email || ''),
        String(r.updated_at || r.created_at || new Date().toISOString()),
        String(sourceTabName || '')
    ];
}

function rowToRecord(row) {
    const attendance = [];
    for (let i = 12; i < 24; i++) {
        const v = String(row[i] || '').trim().toUpperCase();
        attendance.push(v === 'TRUE' || v === '1' || v === 'YES' || v === '✓');
    }
    return {
        uuid: String(row[0] || '').trim(),
        campaign_id: String(row[1] || DEFAULT_CAMPAIGN.uuid).trim(),
        type: String(row[2] || 'participant').trim().toLowerCase(),
        form_number: String(row[3] || '').trim(),
        group_form_number: String(row[4] || '').trim(),
        facilitator_uuid: String(row[5] || '').trim(),
        first_name: String(row[6] || '').trim(),
        last_name: String(row[7] || '').trim(),
        gender: String(row[8] || 'F').trim(),
        age: row[9] !== '' && row[9] !== null && row[9] !== undefined ? Number(row[9]) || String(row[9]) : null,
        contact: String(row[10] || '').trim(),
        place: String(row[11] || '').trim(),
        attendance,
        books_received: String(row[25] || '').trim().toUpperCase() === 'TRUE',
        updated_by_name: String(row[26] || '').trim(),
        updated_by_email: String(row[27] || '').trim(),
        updated_at: String(row[28] || '').trim(),
        source_tab: String(row[29] || '').trim()
    };
}

function hexToRgbColor(hex) {
    const clean = String(hex || '#4A154B').replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return { red: r, green: g, blue: b };
}

async function ensureSheetTabDirect(spreadsheetId, accessToken, tabName, headerColorHex = '#4A154B') {
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metaResp = await fetch(`${baseUrl}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!metaResp.ok) {
        throw new Error(`Google Sheets metadata check failed (${metaResp.status})`);
    }
    const meta = await metaResp.json();
    const existingSheet = (meta.sheets || []).find(s => s.properties?.title === tabName);

    let sheetId = existingSheet?.properties?.sheetId;
    if (!existingSheet) {
        const addResp = await fetch(`${baseUrl}:batchUpdate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: tabName,
                                gridProperties: {
                                    frozenRowCount: 1,
                                    rowCount: 1000,
                                    columnCount: SHEET_HEADERS.length
                                }
                            }
                        }
                    }
                ]
            })
        });
        if (addResp.ok) {
            const addData = await addResp.json();
            sheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
        }
    }

    // Check if header row is populated
    const hdrRange = `${tabName}!A1:AD1`;
    const hdrGet = await fetch(`${baseUrl}/values/${encodeURIComponent(hdrRange)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json()).catch(() => ({}));

    if (!hdrGet?.values || hdrGet.values.length === 0 || !hdrGet.values[0]?.[0]) {
        await fetch(`${baseUrl}/values/${encodeURIComponent(hdrRange)}?valueInputOption=RAW`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [SHEET_HEADERS] })
        });

        if (sheetId !== undefined) {
            await fetch(`${baseUrl}:batchUpdate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: SHEET_HEADERS.length
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: hexToRgbColor(headerColorHex),
                                        textFormat: {
                                            bold: true,
                                            foregroundColor: { red: 1, green: 1, blue: 1 }
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        }
                    ]
                })
            }).catch(() => {});
        }
    }
}

async function upsertProfileTabDirect(spreadsheetId, accessToken, tabName, records = [], deletedUuids = [], replaceTab = true) {
    const safeTabName = String(tabName || 'PROFILE_Default').substring(0, 95);
    await ensureSheetTabDirect(spreadsheetId, accessToken, safeTabName, '#4A154B');

    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const dataRange = `${safeTabName}!A2:AD2000`;

    const existingResp = await fetch(`${baseUrl}/values/${encodeURIComponent(dataRange)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json()).catch(() => ({}));

    const rawRows = Array.isArray(existingResp?.values) ? existingResp.values : [];
    const deletedSet = new Set((deletedUuids || []).map(u => String(u || '').trim()));
    for (const r of records) {
        if (r?.is_deleted && r?.uuid) deletedSet.add(String(r.uuid).trim());
    }

    const activeRecords = (records || []).filter(r => r && r.uuid && !r.is_deleted);
    const existingByUuid = new Map();
    const keptExistingRows = [];

    for (const row of rawRows) {
        const u = String(row[0] || '').trim();
        const camp = String(row[1] || '').trim();
        if (!u || deletedSet.has(u) || RETIRED_CAMPAIGN_IDS.has(camp)) continue;
        existingByUuid.set(u, row);
        if (!replaceTab) keptExistingRows.push(row);
    }

    let inserted = 0;
    let updated = 0;
    const finalRows = replaceTab ? [] : [...keptExistingRows];
    const indexByUuid = new Map();
    if (!replaceTab) {
        finalRows.forEach((row, idx) => {
            const u = String(row[0] || '').trim();
            if (u) indexByUuid.set(u, idx);
        });
    }

    for (const rec of activeRecords) {
        const newRow = recordToRow(rec, safeTabName);
        const oldRow = existingByUuid.get(rec.uuid);

        if (oldRow) {
            let totalDays = 0;
            for (let d = 12; d < 24; d++) {
                const oldPresent = String(oldRow[d] || '').toUpperCase() === 'TRUE';
                const newPresent = String(newRow[d] || '').toUpperCase() === 'TRUE';
                const merged = oldPresent || newPresent;
                if (rec.last_attendance_mark && rec.last_attendance_mark.day_index === (d - 12) && rec.last_attendance_mark.value === false) {
                    newRow[d] = 'FALSE';
                } else {
                    newRow[d] = merged ? 'TRUE' : 'FALSE';
                }
                if (newRow[d] === 'TRUE') totalDays++;
            }
            newRow[24] = totalDays;
            updated++;
        } else {
            inserted++;
        }

        if (replaceTab) {
            finalRows.push(newRow);
        } else if (indexByUuid.has(rec.uuid)) {
            finalRows[indexByUuid.get(rec.uuid)] = newRow;
        } else {
            indexByUuid.set(rec.uuid, finalRows.length);
            finalRows.push(newRow);
        }
    }

    // Clear A2:AD2000 first so any deleted rows are completely removed
    await fetch(`${baseUrl}/values/${encodeURIComponent(dataRange)}:clear`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (finalRows.length > 0) {
        await fetch(`${baseUrl}/values/${encodeURIComponent(`${safeTabName}!A2`)}?valueInputOption=RAW`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: finalRows })
        });
    }

    return {
        tabName: safeTabName,
        inserted,
        updated,
        totalInTab: finalRows.length
    };
}

async function reconcileAllProfileTabsDirect(spreadsheetId, accessToken, deletedUuids = []) {
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    await ensureSheetTabDirect(spreadsheetId, accessToken, MASTER_TAB_NAME, '#1E3A8A');

    const metaResp = await fetch(`${baseUrl}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const meta = await metaResp.json();
    const profileSheets = (meta.sheets || [])
        .map(s => s.properties?.title)
        .filter(title => title && title.startsWith('PROFILE_'));

    const deletedSet = new Set((deletedUuids || []).map(u => String(u || '').trim()));
    const cleanStr = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const cleanForm = (f) => String(f || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^0+(?=\d)/, '');

    const masterByUuid = new Map();
    const facByFormKey = new Map();
    const personByGroupNameKey = new Map();

    let totalRawRows = 0;
    let duplicatesMerged = 0;
    const perTabStats = [];

    for (const pName of profileSheets) {
        const range = `${pName}!A2:AD2000`;
        const valResp = await fetch(`${baseUrl}/values/${encodeURIComponent(range)}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        }).then(r => r.json()).catch(() => ({}));

        const rows = Array.isArray(valResp?.values) ? valResp.values : [];
        perTabStats.push({ tabName: pName, rowCount: rows.length });

        for (const row of rows) {
            const rec = rowToRecord(row);
            if (!rec.uuid && !rec.first_name && !rec.last_name) continue;
            if (deletedSet.has(rec.uuid) || RETIRED_CAMPAIGN_IDS.has(rec.campaign_id)) continue;
            totalRawRows++;

            const camp = rec.campaign_id || DEFAULT_CAMPAIGN.uuid;
            const type = rec.type || 'participant';
            const cf = cleanForm(rec.form_number);
            const gf = cleanForm(rec.group_form_number || (type === 'participant' ? rec.form_number : ''));
            const fn = cleanStr(rec.first_name);
            const ln = cleanStr(rec.last_name);

            let existing = masterByUuid.get(rec.uuid);

            if (!existing && type === 'facilitator' && cf) {
                const candidate = facByFormKey.get(`${camp}|facilitator|${cf}`);
                if (candidate && ((!fn && !ln) || (cleanStr(candidate.first_name) === fn && cleanStr(candidate.last_name) === ln))) {
                    existing = candidate;
                }
            }

            if (!existing && fn && ln) {
                const groupScope = type === 'facilitator' ? (cf || 'noform') : (gf || cleanStr(rec.facilitator_uuid) || 'ungrouped');
                const nameKey = `${camp}|${type}|${groupScope}|${fn}|${ln}`;
                existing = personByGroupNameKey.get(nameKey);
            }

            if (!existing) {
                masterByUuid.set(rec.uuid, rec);
                if (type === 'facilitator' && cf) {
                    facByFormKey.set(`${camp}|facilitator|${cf}`, rec);
                }
                if (fn && ln) {
                    const groupScope = type === 'facilitator' ? (cf || 'noform') : (gf || cleanStr(rec.facilitator_uuid) || 'ungrouped');
                    personByGroupNameKey.set(`${camp}|${type}|${groupScope}|${fn}|${ln}`, rec);
                }
            } else {
                duplicatesMerged++;
                for (let d = 0; d < 12; d++) {
                    existing.attendance[d] = Boolean(existing.attendance[d] || rec.attendance[d]);
                }
                existing.books_received = Boolean(existing.books_received || rec.books_received);
                if (!existing.contact && rec.contact) existing.contact = rec.contact;
                if (!existing.place && rec.place) existing.place = rec.place;
                if (!existing.age && rec.age) existing.age = rec.age;
                if (!existing.facilitator_uuid && rec.facilitator_uuid) existing.facilitator_uuid = rec.facilitator_uuid;
                if (!existing.group_form_number && rec.group_form_number) existing.group_form_number = rec.group_form_number;
                if (rec.updated_at > existing.updated_at) {
                    existing.updated_at = rec.updated_at;
                    existing.updated_by_name = rec.updated_by_name || existing.updated_by_name;
                    existing.updated_by_email = rec.updated_by_email || existing.updated_by_email;
                }
                if (!existing.source_tab.includes(pName)) {
                    existing.source_tab = `${existing.source_tab} + ${pName}`;
                }
            }
        }
    }

    const unifiedRecords = Array.from(masterByUuid.values());
    unifiedRecords.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'facilitator' ? -1 : 1;
        const fa = parseInt(a.type === 'facilitator' ? a.form_number : a.group_form_number, 10) || 99999;
        const fb = parseInt(b.type === 'facilitator' ? b.form_number : b.group_form_number, 10) || 99999;
        if (fa !== fb) return fa - fb;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });

    await fetch(`${baseUrl}/values/${encodeURIComponent(`${MASTER_TAB_NAME}!A2:AD3000`)}:clear`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (unifiedRecords.length > 0) {
        const outRows = unifiedRecords.map(r => recordToRow(r, r.source_tab));
        await fetch(`${baseUrl}/values/${encodeURIComponent(`${MASTER_TAB_NAME}!A2`)}?valueInputOption=RAW`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: outRows })
        });
    }

    return {
        ok: true,
        reconciledAt: new Date().toISOString(),
        profileTabsScanned: profileSheets.length,
        perTabStats,
        totalRawRows,
        duplicatesMerged,
        uniformMasterTotal: unifiedRecords.length,
        facilitatorsCount: unifiedRecords.filter(r => r.type === 'facilitator').length,
        participantsCount: unifiedRecords.filter(r => r.type !== 'facilitator').length,
        records: unifiedRecords
    };
}

/**
 * Generates the isolated Google Sheet tab name for a given Admin/Facilitator profile.
 * Example: "PROFILE_Samukeliso_Mayabane_F1_50"
 */
export function getProfileBufferTabName(profile, user) {
    const rawName =
        profile?.full_name ||
        user?.displayName ||
        (profile?.email || user?.email || 'Admin').split('@')[0];

    const cleanName = String(rawName)
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 32) || 'Admin';

    const start = profile?.form_range_start;
    const end = profile?.form_range_end;
    const rangeSuffix = start && end ? `_F${start}_${end}` : '';

    return `PROFILE_${cleanName}${rangeSuffix}`;
}

/**
 * Reads cached Google Sheets Buffer configuration from localStorage / env
 */
export function getLocalSheetsBufferConfig() {
    const envSheetUrl = import.meta.env.VITE_GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL;
    const envWebAppUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || DEFAULT_GOOGLE_SHEETS_WEBAPP_URL;

    try {
        const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                spreadsheetId: parsed.spreadsheetId || DEFAULT_SPREADSHEET_ID,
                spreadsheetUrl: parsed.spreadsheetUrl || envSheetUrl,
                webAppUrl: parsed.webAppUrl || envWebAppUrl,
                oauth: parsed.oauth || null,
                autoSyncOnSave: parsed.autoSyncOnSave ?? true,
                lastReconciledAt: parsed.lastReconciledAt || null,
                lastReconcileSummary: parsed.lastReconcileSummary || null
            };
        }
    } catch {
        // ignore
    }

    return {
        spreadsheetId: DEFAULT_SPREADSHEET_ID,
        spreadsheetUrl: envSheetUrl,
        webAppUrl: envWebAppUrl,
        oauth: null,
        autoSyncOnSave: true,
        lastReconciledAt: null,
        lastReconcileSummary: null
    };
}

/**
 * Loads the shared Google Sheets Buffer configuration from Firestore so all admins
 * on the hosted Vercel web link automatically share the same Google Sheet & OAuth / Web App URL.
 */
export async function loadSharedSheetsBufferConfig() {
    const local = getLocalSheetsBufferConfig();
    if (!isConfigured || !firestoreDb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return local;
    }

    try {
        const ref = doc(firestoreDb, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_BUFFER_DOC_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            const merged = {
                spreadsheetId: data.spreadsheetId || local.spreadsheetId || DEFAULT_SPREADSHEET_ID,
                spreadsheetUrl: data.spreadsheetUrl || local.spreadsheetUrl || '',
                webAppUrl: data.webAppUrl || local.webAppUrl || '',
                oauth: data.oauth || local.oauth || null,
                autoSyncOnSave: data.autoSyncOnSave ?? local.autoSyncOnSave ?? true,
                lastReconciledAt: data.lastReconciledAt || local.lastReconciledAt || null,
                lastReconcileSummary: data.lastReconcileSummary || local.lastReconcileSummary || null
            };
            try {
                localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
        }
    } catch (err) {
        console.warn('[SheetsBuffer] Could not fetch shared config from Firestore:', err.message);
    }
    return local;
}

/**
 * Saves the Google Sheets Buffer configuration both locally and to Firestore
 * so every admin opening the Vercel app inherits it automatically.
 */
export async function saveSharedSheetsBufferConfig(newConfig) {
    const current = getLocalSheetsBufferConfig();
    const merged = {
        ...current,
        ...newConfig,
        updated_at: new Date().toISOString()
    };

    try {
        localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(merged));
    } catch {
        // ignore
    }

    if (isConfigured && firestoreDb && (typeof navigator === 'undefined' || navigator.onLine)) {
        try {
            const ref = doc(firestoreDb, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_BUFFER_DOC_ID);
            await setDoc(ref, {
                uuid: FIRESTORE_BUFFER_DOC_ID,
                is_system_config: true,
                ...merged
            }, { merge: true });
        } catch (err) {
            console.warn('[SheetsBuffer] Could not persist config to Firestore:', err.message);
        }
    }

    return merged;
}

/**
 * Pushes a specific profile's registrations to their dedicated `PROFILE_<Name>_<Range>` tab
 * on the Google Sheet using the Direct Google Sheets v4 API (or Apps Script Web App fallback).
 */
export async function pushProfileBufferToSheets({
    profile,
    user,
    records = null,
    deletedUuids: explicitDeletedUuids = [],
    autoReconcile = true
} = {}) {
    const config = await loadSharedSheetsBufferConfig();
    const tabName = getProfileBufferTabName(profile, user);
    const activeCampId = getActiveCampaignId() || DEFAULT_CAMPAIGN.uuid;

    let recordsToPush = records;
    let deletedUuids = Array.isArray(explicitDeletedUuids) ? [...explicitDeletedUuids] : [];
    if (!recordsToPush) {
        const allLocal = await db.registrations.toArray();
        const myEmail = (profile?.email || user?.email || '').toLowerCase();
        const myEmailPrefix = myEmail.split('@')[0] || '';
        const myUid = user?.uid || profile?.id || '';
        const myName = (profile?.full_name || user?.displayName || '').trim().toLowerCase();
        const rangeStart = Number(profile?.form_range_start) || 0;
        const rangeEnd = Number(profile?.form_range_end) || 0;

        const belongsToProfile = (r) => {
            const recCamp = r.campaign_id || DEFAULT_CAMPAIGN.uuid;
            if (recCamp !== activeCampId) return false;

            const byEmail = (r.updated_by_email || r.created_by_email || '').toLowerCase();
            const byUid = r.updated_by_uid || r.created_by_uid || '';
            const byName = (r.updated_by_name || r.created_by_name || '').trim().toLowerCase();
            if (
                (myEmail && byEmail === myEmail) ||
                (myUid && byUid === myUid) ||
                (myName && byName === myName) ||
                (myEmailPrefix && (byName === myEmailPrefix || byName === myEmail))
            ) {
                return true;
            }

            if (rangeStart > 0 && rangeEnd >= rangeStart) {
                const fNum = parseInt(r.type === 'facilitator' ? r.form_number : (r.group_form_number || r.form_number), 10);
                if (!isNaN(fNum) && fNum >= rangeStart && fNum <= rangeEnd) {
                    return true;
                }
            }
            return false;
        };

        recordsToPush = [];
        for (const r of allLocal) {
            if (!belongsToProfile(r)) continue;
            if (r.is_deleted) {
                if (r.uuid) deletedUuids.push(r.uuid);
            } else {
                recordsToPush.push(r);
            }
        }
    }

    // 1. Primary path: Direct Google Sheets v4 API (supports full row replacement & instant deletion!)
    const accessToken = await getGoogleSheetsAccessToken(config.oauth);
    if (accessToken) {
        const spreadsheetId = extractSpreadsheetId(config);
        const upsert = await upsertProfileTabDirect(spreadsheetId, accessToken, tabName, recordsToPush, deletedUuids, true);
        let reconcile = null;
        if (autoReconcile) {
            const recRes = await reconcileAllProfileTabsDirect(spreadsheetId, accessToken, deletedUuids);
            reconcile = {
                uniformMasterTotal: recRes.uniformMasterTotal,
                duplicatesMerged: recRes.duplicatesMerged
            };
        }
        return {
            ok: true,
            tabName,
            pushedCount: recordsToPush.length,
            upsert,
            reconcile
        };
    }

    // 2. Fallback path: Google Apps Script Web App
    if (!config.webAppUrl) {
        return {
            ok: false,
            skipped: true,
            reason: 'Google Sheets Web App URL is not configured yet.'
        };
    }

    const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
            action: 'push_profile_buffer',
            tabName,
            autoReconcile,
            replaceTab: true,
            deletedUuids,
            records: recordsToPush
        })
    });

    const result = await response.json();
    if (!result.ok) {
        throw new Error(result.error || 'Failed to push profile buffer to Google Sheets.');
    }

    return {
        ok: true,
        tabName,
        pushedCount: recordsToPush.length,
        upsert: result.upsert,
        reconcile: result.reconcile
    };
}

/**
 * Triggers the Uniform Reconciliation across all `PROFILE_*` tabs in Google Sheets,
 * writes the unified `MASTER_UNIFORM_REGISTER` tab, and reconciles back into local IndexedDB + Firestore!
 */
export async function reconcileSheetsBufferIntoUniformSystem() {
    const config = await loadSharedSheetsBufferConfig();
    const allLocal = await db.registrations.toArray();
    const activeCampId = getActiveCampaignId() || DEFAULT_CAMPAIGN.uuid;
    const activeRecords = allLocal.filter(r => !r.is_deleted && (r.campaign_id || DEFAULT_CAMPAIGN.uuid) === activeCampId);
    const deletedUuids = allLocal.filter(r => r.is_deleted && r.uuid).map(r => r.uuid);

    // Group local records by their creator/updater profile name so each gets its own tab
    const byTab = new Map();
    for (const r of activeRecords) {
        const author = (r.updated_by_name || r.created_by_name || 'Field_Admin')
            .trim()
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 32) || 'Field_Admin';
        const tName = `PROFILE_${author}`;
        if (!byTab.has(tName)) byTab.set(tName, []);
        byTab.get(tName).push(r);
    }

    let result;
    const accessToken = await getGoogleSheetsAccessToken(config.oauth);
    if (accessToken) {
        const spreadsheetId = extractSpreadsheetId(config);
        for (const [tabName, recs] of byTab.entries()) {
            await upsertProfileTabDirect(spreadsheetId, accessToken, tabName, recs, deletedUuids, true);
        }
        result = await reconcileAllProfileTabsDirect(spreadsheetId, accessToken, deletedUuids);
    } else {
        if (!config.webAppUrl) {
            throw new Error('Please configure the Google Sheets Web App URL first.');
        }
        for (const [tabName, recs] of byTab.entries()) {
            await fetch(config.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'push_profile_buffer',
                    tabName,
                    autoReconcile: false,
                    replaceTab: true,
                    deletedUuids,
                    records: recs
                })
            });
        }

        const response = await fetch(config.webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'reconcile' })
        });
        result = await response.json();
        if (!result.ok) {
            throw new Error(result.error || 'Sheet reconciliation failed.');
        }
    }

    // Reconcile unified records back into local Dexie & mark any new/merged rows for Firestore sync
    const remoteUnified = (Array.isArray(result.records) ? result.records : []).filter(
        rem => rem && rem.uuid && !rem.is_deleted && (!rem.campaign_id || rem.campaign_id === activeCampId) && !RETIRED_CAMPAIGN_IDS.has(rem.campaign_id)
    );
    let importedOrUpdated = 0;

    if (remoteUnified.length > 0) {
        const currentLocal = await db.registrations.toArray();
        const localByUuid = new Map();
        currentLocal.forEach(l => {
            if (l.uuid) localByUuid.set(l.uuid, l);
        });

        await db.transaction('rw', db.registrations, async () => {
            for (const rem of remoteUnified) {
                if (!rem.uuid) continue;
                const loc = localByUuid.get(rem.uuid);
                if (loc && loc.is_deleted) continue;
                const remAtt = normalizeAttendance(rem.attendance);

                if (!loc) {
                    await db.registrations.add({
                        ...rem,
                        attendance: remAtt,
                        campaign_id: rem.campaign_id || activeCampId,
                        is_deleted: false,
                        sync_status: 'pending',
                        created_at: rem.updated_at || new Date().toISOString(),
                        updated_at: rem.updated_at || new Date().toISOString()
                    });
                    importedOrUpdated++;
                } else {
                    const locAtt = normalizeAttendance(loc.attendance);
                    const mergedAtt = locAtt.map((v, i) => Boolean(v || remAtt[i]));
                    const attChanged = JSON.stringify(mergedAtt) !== JSON.stringify(locAtt);

                    if (attChanged) {
                        await db.registrations.update(loc.id, {
                            attendance: mergedAtt,
                            books_received: Boolean(loc.books_received || rem.books_received),
                            sync_status: 'pending',
                            updated_at: new Date().toISOString()
                        });
                        importedOrUpdated++;
                    }
                }
            }
        });

        if (importedOrUpdated > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hff-firebase-sync-request'));
            window.dispatchEvent(new CustomEvent('hff-firebase-data-updated'));
        }
    }

    const summary = {
        reconciledAt: result.reconciledAt || new Date().toISOString(),
        profileTabsScanned: result.profileTabsScanned || 0,
        perTabStats: result.perTabStats || [],
        totalRawRows: result.totalRawRows || 0,
        duplicatesMerged: result.duplicatesMerged || 0,
        uniformMasterTotal: result.uniformMasterTotal || 0,
        facilitatorsCount: result.facilitatorsCount || 0,
        participantsCount: result.participantsCount || 0,
        importedOrUpdatedLocally: importedOrUpdated
    };

    await saveSharedSheetsBufferConfig({
        lastReconciledAt: summary.reconciledAt,
        lastReconcileSummary: summary
    });

    return summary;
}

/**
 * Exports a multi-tab Excel (.xlsx) workbook with MASTER_UNIFORM_REGISTER + one tab per Profile
 * so you can also inspect or upload the exact multi-tab structure offline at any time.
 */
export function exportMultiTabBufferWorkbook(registrations = [], profiles = []) {
    const wb = XLSX.utils.book_new();
    const activeRecords = registrations.filter(r => !r.is_deleted);

    const toSheetRow = (r, sourceTab) => {
        const att = Array.isArray(r.attendance) ? r.attendance : Array(TOTAL_CAMPAIGN_DAYS).fill(false);
        const rowObj = {
            'UUID': r.uuid || '',
            'Record Type': r.type || 'participant',
            'Form #': r.form_number || '',
            'Group Form #': r.group_form_number || r.form_number || '',
            'First Name': r.first_name || '',
            'Last Name': r.last_name || '',
            'Gender': r.gender || 'F',
            'Age': r.age ?? '',
            'Contact': r.contact || '',
            'Location': r.place || ''
        };
        let total = 0;
        for (let d = 0; d < TOTAL_CAMPAIGN_DAYS; d++) {
            const p = Boolean(att[d]);
            rowObj[`D${d + 1}`] = p ? 'TRUE' : 'FALSE';
            if (p) total++;
        }
        rowObj['Total Days'] = total;
        rowObj['Books Received'] = r.books_received ? 'TRUE' : 'FALSE';
        rowObj['Entered By'] = r.updated_by_name || r.created_by_name || 'Admin';
        rowObj['Updated At'] = r.updated_at || r.created_at || '';
        rowObj['Source Tab'] = sourceTab;
        return rowObj;
    };

    // 1. Master Uniform Register Tab
    const masterRows = activeRecords.map(r =>
        toSheetRow(r, `PROFILE_${(r.updated_by_name || r.created_by_name || 'Admin').replace(/[^a-zA-Z0-9]+/g, '_')}`)
    );
    const masterWs = XLSX.utils.json_to_sheet(masterRows.length > 0 ? masterRows : [toSheetRow({}, 'MASTER')]);
    XLSX.utils.book_append_sheet(wb, masterWs, 'MASTER_UNIFORM_REGISTER');

    // 2. Per-Profile Buffer Tabs
    const byTab = new Map();
    for (const p of profiles) {
        const tName = getProfileBufferTabName(p, null).substring(0, 31);
        if (!byTab.has(tName)) byTab.set(tName, []);
    }

    for (const r of activeRecords) {
        let matchedTab = null;
        const email = (r.updated_by_email || r.created_by_email || '').toLowerCase();
        const fNum = parseInt(r.type === 'facilitator' ? r.form_number : (r.group_form_number || r.form_number), 10);

        for (const p of profiles) {
            if (email && p.email && p.email.toLowerCase() === email) {
                matchedTab = getProfileBufferTabName(p, null).substring(0, 31);
                break;
            }
            if (!isNaN(fNum) && p.form_range_start && p.form_range_end && fNum >= p.form_range_start && fNum <= p.form_range_end) {
                matchedTab = getProfileBufferTabName(p, null).substring(0, 31);
                break;
            }
        }

        if (!matchedTab) {
            const rawAuthor = (r.updated_by_name || r.created_by_name || 'Unassigned').replace(/[^a-zA-Z0-9]+/g, '_');
            matchedTab = `PROFILE_${rawAuthor}`.substring(0, 31);
        }

        if (!byTab.has(matchedTab)) byTab.set(matchedTab, []);
        byTab.get(matchedTab).push(toSheetRow(r, matchedTab));
    }

    for (const [tabName, rows] of byTab.entries()) {
        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [toSheetRow({}, tabName)]);
        XLSX.utils.book_append_sheet(wb, ws, tabName);
    }

    const fileName = `HFF_Uniform_Register_Buffer_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return fileName;
}
