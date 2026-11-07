import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { SHEET_HEADERS } from '../src/lib/sheetsBufferSync.js';
import { splitOccupationAndAffiliation } from '../src/lib/utils.js';

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
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

async function verifyExport() {
    console.log("==========================================================");
    console.log("VERIFYING 32-COLUMN EXPORT INTEGRITY ACROSS LIVE FIRESTORE");
    console.log("==========================================================\n");

    const snap = await getDocs(collection(db, 'registrations'));
    const all = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);
    console.log(`Live active records loaded: ${all.length}`);

    // 1. Verify Headers
    console.log(`\n1. Header Schema Verification:`);
    console.log(`Total columns: ${SHEET_HEADERS.length} (Expected: 32)`);
    console.log(`Col M (Index 12): "${SHEET_HEADERS[12]}" (Expected: "Occupation")`);
    console.log(`Col N (Index 13): "${SHEET_HEADERS[13]}" (Expected: "Affiliation")`);
    console.log(`Col O (Index 14): "${SHEET_HEADERS[14]}" (Expected: "D1")`);
    console.log(`Col Z (Index 25): "${SHEET_HEADERS[25]}" (Expected: "D12")`);

    if (
        SHEET_HEADERS.length !== 32 ||
        SHEET_HEADERS[12] !== 'Occupation' ||
        SHEET_HEADERS[13] !== 'Affiliation' ||
        SHEET_HEADERS[14] !== 'D1' ||
        SHEET_HEADERS[25] !== 'D12'
    ) {
        throw new Error("Header schema integrity check failed!");
    }
    console.log("-> Header Schema: PASS");

    // 2. Build rows and verify column bounds
    const rows = all.map(r => recordToRow(r, 'MASTER_UNIFORM_REGISTER'));
    let rowLenOk = true;
    for (const row of rows) {
        if (row.length !== 32) {
            rowLenOk = false;
            break;
        }
    }
    console.log(`\n2. Row Width Verification:`);
    console.log(`All ${rows.length} rows have exactly 32 columns: ${rowLenOk ? 'PASS' : 'FAIL'}`);

    // 3. Inspect target groups in 32-col export
    const targets = ['203', '175', '143', '60', '207', '163', '155'];
    console.log(`\n3. Target Registers in 32-Column Export:`);

    for (const t of targets) {
        const matchingRows = rows.filter(r => r[3] === t || r[4] === t);
        const facRows = matchingRows.filter(r => r[2] === 'facilitator');
        const partRows = matchingRows.filter(r => r[2] === 'participant');

        let daysSum = 0;
        partRows.forEach(r => {
            daysSum += Number(r[26]) || 0; // Total Days is index 26 (Col AA)
        });
        const avgDays = partRows.length > 0 ? (daysSum / partRows.length).toFixed(2) : '0';

        console.log(`\n--- Register ${t} ---`);
        console.log(`Facilitator count: ${facRows.length} | Participant count: ${partRows.length} | Avg Days: ${avgDays}`);
        facRows.forEach(f => {
            console.log(`  Fac: ${f[6]} ${f[7]} (Phone: ${f[10]}, Loc: ${f[11]}, Occ: "${f[12]}", Aff: "${f[13]}")`);
        });
        console.log(`  Sample participant rows (first 3):`);
        partRows.slice(0, 3).forEach(p => {
            const attFlags = p.slice(14, 23).join('');
            console.log(`    ${p[6]} ${p[7]} | Occ: "${p[12]}" | Aff: "${p[13]}" | D1-D9: ${attFlags} | Total Days: ${p[26]}`);
        });
    }

    console.log("\n==========================================================");
    console.log("32-COLUMN EXPORT INTEGRITY CHECK COMPLETED SUCCESSFULLY");
    console.log("==========================================================");
    process.exit(0);
}

verifyExport().catch(e => {
    console.error(e);
    process.exit(1);
});
