process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fetch from 'node-fetch';
import { splitOccupationAndAffiliation } from '../src/lib/utils.js';

const SHEET_HEADERS = [
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
    'Occupation',
    'Affiliation',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12',
    'Total Days',
    'Books Received',
    'Entered By (Profile)',
    'Entered By Email',
    'Updated At (ISO)',
    'Source Tab'
];

const RETIRED_CAMPAIGN_IDS = new Set([
    'campaign-e8d8587a-f452-4d61-bf9c-3b6d60687e19',
    'campaign-e1d93920-a3d4-4b92-b027-3053253a0ece'
]);

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);

function recordToRow(r, sourceTabName) {
    const att = Array.isArray(r.attendance) ? r.attendance : [];
    const days = [];
    let totalDays = 0;
    for (let i = 0; i < 12; i++) {
        const present = Boolean(att[i]);
        days.push(present ? 'TRUE' : 'FALSE');
        if (present) totalDays++;
    }
    const split = splitOccupationAndAffiliation(r.occupation, r.affiliation, r.meeting_place);
    return [
        String(r.uuid || ''),
        String(r.campaign_id || 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22'),
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
        String(split.occupation || '').trim(),
        String(split.affiliation || '').trim(),
        ...days,
        totalDays,
        r.books_received ? 'TRUE' : 'FALSE',
        String(r.updated_by_name || r.created_by_name || ''),
        String(r.updated_by_email || r.created_by_email || ''),
        String(r.updated_at || r.created_at || new Date().toISOString()),
        String(sourceTabName || '')
    ];
}

async function getAccessToken(oauth) {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: oauth.clientId,
            client_secret: oauth.clientSecret,
            refresh_token: oauth.refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error('Failed to refresh OAuth token: ' + JSON.stringify(data));
    return data.access_token;
}

async function syncAllTabs() {
    console.log('Fetching Firestore config and registrations...');
    let cfgSnap = null;
    for (let i = 1; i <= 5; i++) {
        try {
            cfgSnap = await getDoc(doc(db, 'system_config', 'hff_sheets_buffer_config'));
            break;
        } catch (e) {
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
    if (!cfgSnap || !cfgSnap.exists()) throw new Error('Missing hff_sheets_buffer_config in Firestore');
    const cfg = cfgSnap.data();
    const spreadsheetId = cfg.spreadsheetId || '1iTQt1eDPPbpTBKIFT5u2vxCPzxj-G2pQeEQNHyzDAbc';
    const accessToken = await getAccessToken(cfg.oauth);

    const regSnap = await getDocs(collection(db, 'registrations'));
    const activeRecords = [];
    for (const d of regSnap.docs) {
        const r = { uuid: d.id, ...d.data() };
        if (r.is_deleted || RETIRED_CAMPAIGN_IDS.has(r.campaign_id)) continue;
        activeRecords.push(r);
    }
    console.log(`Loaded ${activeRecords.length} active records from Firestore.`);

    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const meta = await fetch(`${baseUrl}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());

    const existingSheets = new Map();
    for (const s of meta.sheets || []) {
        if (s.properties?.title) {
            existingSheets.set(s.properties.title, s.properties);
        }
    }

    // Ensure all tabs have at least 32 columns
    const expandRequests = [];
    for (const [title, props] of existingSheets.entries()) {
        if (title === 'MASTER_UNIFORM_REGISTER' || title.startsWith('PROFILE_')) {
            const currentCols = props.gridProperties?.columnCount || 26;
            if (currentCols < SHEET_HEADERS.length) {
                expandRequests.push({
                    appendDimension: {
                        sheetId: props.sheetId,
                        dimension: 'COLUMNS',
                        length: SHEET_HEADERS.length - currentCols,
                    },
                });
            }
        }
    }
    if (expandRequests.length > 0) {
        await fetch(`${baseUrl}:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: expandRequests }),
        });
        console.log(`Expanded ${expandRequests.length} sheet tabs to 32 columns (A:AF).`);
    }

    // Update existing PROFILE_* tabs by matching UUIDs to Firestore records so Occupation & Affiliation are populated
    const profileTabNames = Array.from(existingSheets.keys()).filter((t) => t.startsWith('PROFILE_'));
    const byUuid = new Map(activeRecords.map((r) => [r.uuid, r]));

    for (const tabName of profileTabNames) {
        // Write 32-column headers A1:AF1
        await fetch(`${baseUrl}/values/${encodeURIComponent(`${tabName}!A1:AF1`)}?valueInputOption=RAW`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [SHEET_HEADERS] }),
        });

        const valResp = await fetch(`${baseUrl}/values/${encodeURIComponent(`${tabName}!A2:AF2000`)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());

        const rawRows = Array.isArray(valResp?.values) ? valResp.values : [];
        if (rawRows.length === 0) continue;

        const updatedRows = [];
        for (const row of rawRows) {
            const uuid = String(row[0] || '').trim();
            const fsRec = byUuid.get(uuid);
            if (fsRec) {
                updatedRows.push(recordToRow(fsRec, tabName));
            }
        }

        await fetch(`${baseUrl}/values/${encodeURIComponent(`${tabName}!A2:AF2000`)}:clear`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (updatedRows.length > 0) {
            await fetch(`${baseUrl}/values/${encodeURIComponent(`${tabName}!A2`)}?valueInputOption=RAW`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: updatedRows }),
            });
        }
        console.log(`Updated ${tabName}: ${updatedRows.length} rows (with Occupation & Affiliation in Cols M & N).`);
    }

    // Write MASTER_UNIFORM_REGISTER with all active records sorted cleanly
    const sortedMaster = [...activeRecords].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'facilitator' ? -1 : 1;
        const fa = parseInt(a.type === 'facilitator' ? a.form_number : a.group_form_number, 10) || 99999;
        const fb = parseInt(b.type === 'facilitator' ? b.form_number : b.group_form_number, 10) || 99999;
        if (fa !== fb) return fa - fb;
        return `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`);
    });

    await fetch(`${baseUrl}/values/${encodeURIComponent(`MASTER_UNIFORM_REGISTER!A1:AF1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [SHEET_HEADERS] }),
    });
    await fetch(`${baseUrl}/values/${encodeURIComponent(`MASTER_UNIFORM_REGISTER!A2:AF3000`)}:clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const masterRows = sortedMaster.map((r) => {
        const author = String(r.updated_by_name || r.created_by_name || 'Admin').replace(/[^a-zA-Z0-9]+/g, '_');
        return recordToRow(r, `PROFILE_${author}`);
    });
    await fetch(`${baseUrl}/values/${encodeURIComponent(`MASTER_UNIFORM_REGISTER!A2`)}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: masterRows }),
    });
    console.log(`Updated MASTER_UNIFORM_REGISTER: ${masterRows.length} rows across 32 columns (A:AF).`);
    process.exit(0);
}

syncAllTabs().catch((err) => {
    console.error('Google Sheets sync error:', err);
    process.exit(1);
});
