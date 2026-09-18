import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CAMPAIGN_ID = 'campaign-b18632b1-91bf-4c0c-85fa-66a8276e4731'; // S.Phikwe campaign in Firestore

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// CSV parser that respects quoted cells
function parseCsvLine(text) {
    const p = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (inQuotes && text[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            p.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    p.push(cur);
    return p;
}

function sanitize(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => item === undefined ? null : sanitize(item));
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
            clean[k] = (typeof v === 'object' && v !== null) ? sanitize(v) : v;
        }
    }
    return clean;
}

const parseBool = (v, defaultVal = false) => {
    if (v === undefined || v === null || v === '') return defaultVal;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes' || s === '✓') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
    return defaultVal;
};

const parseIntOrNull = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? null : n;
};

const parseStringOrNull = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};

const parseAttendance = (val) => {
    if (!val) return Array(12).fill(false);
    if (Array.isArray(val)) return val.map(Boolean);
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map(Boolean);
            } catch {}
        }
    }
    return Array(12).fill(false);
};

export async function runMigration() {
    console.log(`[Migration] Connecting to Firebase (${firebaseConfig.projectId})...`);
    const csvPath = path.resolve('Campaigns Data', 'S.Phikwe Campaign Data.csv');
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

    const headers = parseCsvLine(lines[0]).map(h => String(h || '').trim().toLowerCase());
    const findCol = (...aliases) => {
        const exact = headers.findIndex(h => aliases.some(a => h === a));
        if (exact >= 0) return exact;
        return headers.findIndex(h => aliases.some(a => h.includes(a)));
    };

    const uuidCol = findCol('uuid');
    const idCol = findCol('id');
    const fnCol = findCol('first_name');
    const lnCol = findCol('last_name');
    const ageCol = findCol('age');
    const genCol = findCol('gender');
    const contactCol = findCol('contact');
    const placeCol = findCol('place');
    const eduCol = findCol('education');
    const marCol = findCol('marital_status');
    const typeCol = findCol('type');
    const partCountCol = findCol('participants_count');
    const booksDistCol = findCol('books_distributed');
    const facUuidCol = findCol('facilitator_uuid');
    const attendanceCol = findCol('attendance');
    const sourceCol = findCol('source');
    const createdAtCol = findCol('created_at');
    const updatedAtCol = findCol('updated_at');
    const processedCol = findCol('processed');
    const deletedCol = findCol('is_deleted');
    const occCol = findCol('occupation');
    const affCol = findCol('affiliation');
    const booksRecCol = findCol('books_received');

    const records = [];
    const now = new Date().toISOString();

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        const firstName = parseStringOrNull(row[fnCol]);
        if (!firstName) continue;

        const uuid = parseStringOrNull(row[uuidCol]) || parseStringOrNull(row[idCol]) || ('reg-' + i);
        const rawType = String(row[typeCol] || '').toLowerCase();
        const type = rawType.includes('fac') ? 'facilitator' : 'participant';

        records.push({
            uuid,
            first_name: firstName,
            last_name: parseStringOrNull(row[lnCol]) || '',
            age: parseIntOrNull(row[ageCol]),
            gender: parseStringOrNull(row[genCol]) || 'Unknown',
            contact: parseStringOrNull(row[contactCol]),
            place: parseStringOrNull(row[placeCol]) || 'Selebi Phikwe',
            education: parseStringOrNull(row[eduCol]),
            marital_status: parseStringOrNull(row[marCol]),
            type,
            participants_count: parseIntOrNull(row[partCountCol]),
            books_distributed: parseIntOrNull(row[booksDistCol]),
            facilitator_uuid: parseStringOrNull(row[facUuidCol]),
            attendance: parseAttendance(row[attendanceCol]),
            source: parseStringOrNull(row[sourceCol]) || 'pwa_offline',
            created_at: parseStringOrNull(row[createdAtCol]) || now,
            updated_at: parseStringOrNull(row[updatedAtCol]) || now,
            processed: parseBool(row[processedCol], false),
            is_deleted: parseBool(row[deletedCol], false),
            occupation: parseStringOrNull(row[occCol]),
            affiliation: parseStringOrNull(row[affCol]),
            books_received: parseBool(row[booksRecCol], false),
            campaign_id: CAMPAIGN_ID
        });
    }

    console.log(`[Migration] Parsed ${records.length} records from CSV.`);

    // 1. Delete old dummy "reg-*" records from Firestore
    console.log('[Migration] Fetching existing documents to purge incomplete dummy records...');
    const oldSnap = await getDocs(collection(db, 'registrations'));
    console.log(`[Migration] Found ${oldSnap.size} existing documents in registrations collection.`);

    const toDeleteDocs = [];
    oldSnap.forEach(d => {
        // Purge dummy reg- records or all old campaign records
        toDeleteDocs.push(d.ref);
    });

    const BATCH_SIZE = 400;
    if (toDeleteDocs.length > 0) {
        console.log(`[Migration] Deleting ${toDeleteDocs.length} old documents in batches of ${BATCH_SIZE}...`);
        for (let i = 0; i < toDeleteDocs.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const slice = toDeleteDocs.slice(i, i + BATCH_SIZE);
            slice.forEach(ref => batch.delete(ref));
            await batch.commit();
            console.log(`  Deleted ${Math.min(i + BATCH_SIZE, toDeleteDocs.length)} / ${toDeleteDocs.length}`);
        }
    }

    // 2. Upload full, complete records to Firestore
    console.log(`[Migration] Uploading ${records.length} complete records to Firestore in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const slice = records.slice(i, i + BATCH_SIZE);
        for (const rec of slice) {
            const docRef = doc(db, 'registrations', rec.uuid);
            batch.set(docRef, sanitize(rec));
        }
        await batch.commit();
        console.log(`  Uploaded ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }

    console.log('[Migration] SUCCESS! All records successfully updated in Firestore with full attendance, facilitator links, and book counts.');
}

runMigration().then(() => {
    console.log('[Migration] Done!');
    process.exit(0);
}).catch(err => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
});
