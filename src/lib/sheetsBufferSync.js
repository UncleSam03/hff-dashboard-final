import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, isConfigured } from './firebase';
import db from './dexieDb';
import { getActiveCampaignId, DEFAULT_CAMPAIGN } from './campaignManager';
import { normalizeAttendance } from './analytics';
import { TOTAL_CAMPAIGN_DAYS } from './constants';
import * as XLSX from 'xlsx';

const LOCAL_CONFIG_KEY = 'hff_sheets_buffer_config_v1';
const FIRESTORE_SETTINGS_COLLECTION = 'campaigns';
const FIRESTORE_BUFFER_DOC_ID = 'hff_sheets_buffer_config';
export const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1iTQt1eDPPbpTBKIFT5u2vxCPzxj-G2pQeEQNHyzDAbc/edit';
export const DEFAULT_GOOGLE_SHEETS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

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
                spreadsheetUrl: parsed.spreadsheetUrl || envSheetUrl,
                webAppUrl: parsed.webAppUrl || envWebAppUrl,
                autoSyncOnSave: parsed.autoSyncOnSave ?? true,
                lastReconciledAt: parsed.lastReconciledAt || null,
                lastReconcileSummary: parsed.lastReconcileSummary || null
            };
        }
    } catch {
        // ignore
    }

    return {
        spreadsheetUrl: envSheetUrl,
        webAppUrl: envWebAppUrl,
        autoSyncOnSave: true,
        lastReconciledAt: null,
        lastReconcileSummary: null
    };
}

/**
 * Loads the shared Google Sheets Buffer configuration from Firestore so all admins
 * on the hosted Vercel web link automatically share the same Google Sheet & Web App URL.
 */
export async function loadSharedSheetsBufferConfig() {
    const local = getLocalSheetsBufferConfig();
    if (!isConfigured || !firestoreDb || !navigator.onLine) {
        return local;
    }

    try {
        const ref = doc(firestoreDb, FIRESTORE_SETTINGS_COLLECTION, FIRESTORE_BUFFER_DOC_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            const merged = {
                spreadsheetUrl: data.spreadsheetUrl || local.spreadsheetUrl || '',
                webAppUrl: data.webAppUrl || local.webAppUrl || '',
                autoSyncOnSave: data.autoSyncOnSave ?? local.autoSyncOnSave ?? true,
                lastReconciledAt: data.lastReconciledAt || local.lastReconciledAt || null,
                lastReconcileSummary: data.lastReconcileSummary || local.lastReconcileSummary || null
            };
            localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(merged));
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

    if (isConfigured && firestoreDb && navigator.onLine) {
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
 * on the Google Sheet via the Apps Script Web App bridge (works directly from Vercel).
 */
export async function pushProfileBufferToSheets({
    profile,
    user,
    records = null,
    autoReconcile = true
} = {}) {
    const config = await loadSharedSheetsBufferConfig();
    if (!config.webAppUrl) {
        return {
            ok: false,
            skipped: true,
            reason: 'Google Sheets Web App URL is not configured yet.'
        };
    }

    const tabName = getProfileBufferTabName(profile, user);
    const activeCampId = getActiveCampaignId() || DEFAULT_CAMPAIGN.uuid;

    let recordsToPush = records;
    let deletedUuids = [];
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

    // Use text/plain to avoid CORS preflight OPTIONS failure on Google Apps Script Web Apps from Vercel
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
    if (!config.webAppUrl) {
        throw new Error('Please configure the Google Sheets Web App URL first.');
    }

    // 1. First push all local active-campaign records grouped by profile/admin tab so the sheet has everything
    const allLocal = await db.registrations.toArray();
    const activeCampId = getActiveCampaignId() || DEFAULT_CAMPAIGN.uuid;
    const activeRecords = allLocal.filter(r => !r.is_deleted && (r.campaign_id || DEFAULT_CAMPAIGN.uuid) === activeCampId);

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

    for (const [tabName, recs] of byTab.entries()) {
        await fetch(config.webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'push_profile_buffer',
                tabName,
                autoReconcile: false,
                replaceTab: true,
                records: recs
            })
        });
    }

    // 2. Execute server-side reconciliation across all PROFILE_* tabs into MASTER_UNIFORM_REGISTER
    const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'reconcile' })
    });

    const result = await response.json();
    if (!result.ok) {
        throw new Error(result.error || 'Sheet reconciliation failed.');
    }

    // 3. Reconcile unified records back into local Dexie & mark any new/merged rows for Firestore sync
    const remoteUnified = (Array.isArray(result.records) ? result.records : []).filter(
        rem => rem && rem.uuid && !rem.is_deleted && (!rem.campaign_id || rem.campaign_id === activeCampId)
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
        // Match to profile by email/uid or form range
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
