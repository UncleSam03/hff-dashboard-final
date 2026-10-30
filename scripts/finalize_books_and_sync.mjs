process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import 'fake-indexeddb/auto';
import db from '../src/lib/dexieDb.js';

const CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22';
const USER_NAME = 'Samukeliso Mayabane';
const GOOGLE_SHEETS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

const firebaseConfig = {
    apiKey: 'AIzaSyDw5rLdG76c128jD5hH0u5qgGgGgGgGgG',
    authDomain: 'hff-impact-dashboard.firebaseapp.com',
    projectId: 'hff-impact-dashboard'
};
const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

async function finalize() {
    console.log("==================================================================");
    console.log(" FINALIZING BOOKS RECEIVED & FACILITATOR AGGREGATIONS");
    console.log("==================================================================\n");

    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

    const facilitators = allDocs.filter(d => d.type === 'facilitator' && !d.is_deleted);
    const participants = allDocs.filter(d => d.type === 'participant' && !d.is_deleted);

    console.log(`Active Facilitators: ${facilitators.length}, Active Participants: ${participants.length}`);

    const now = new Date().toISOString();
    const docsToUpdate = new Map();

    // 1. Ensure books_received: true on ALL active participants
    let booksFixed = 0;
    participants.forEach(p => {
        if (p.books_received !== true) {
            docsToUpdate.set(p.uuid, {
                ...p,
                books_received: true,
                updated_at: now
            });
            booksFixed++;
        }
    });
    console.log(`Setting books_received = true on ${booksFixed} participants.`);

    // 2. Count active participants per facilitator UUID and form number
    const countByFacUuid = {};
    const countByForm = {};
    participants.forEach(p => {
        if (p.facilitator_uuid) {
            countByFacUuid[p.facilitator_uuid] = (countByFacUuid[p.facilitator_uuid] || 0) + 1;
        }
        if (p.group_form_number) {
            const fClean = String(p.group_form_number).trim().toUpperCase();
            countByForm[fClean] = (countByForm[fClean] || 0) + 1;
        }
    });

    // 3. Recalculate each facilitator
    let facsUpdated = 0;
    facilitators.forEach(f => {
        const byUuid = countByFacUuid[f.uuid] || 0;
        const fClean = f.form_number ? String(f.form_number).trim().toUpperCase() : '';
        const byForm = fClean ? (countByForm[fClean] || 0) : 0;

        // byUuid is exact; fallback to byForm if byUuid is 0
        const exactCount = byUuid > 0 ? byUuid : byForm;

        const needsUpdate = f.participants_count !== exactCount ||
                            f.books_distributed !== exactCount ||
                            f.books_received !== true ||
                            f.teaching_group !== true ||
                            f.is_daily_core !== true;

        if (needsUpdate) {
            docsToUpdate.set(f.uuid, {
                ...f,
                participants_count: exactCount,
                books_distributed: exactCount,
                books_received: true,
                teaching_group: true,
                is_daily_core: true,
                updated_at: now
            });
            facsUpdated++;
        }
    });
    console.log(`Recalculated and updated ${facsUpdated} facilitators.`);
    console.log(`Total documents to write: ${docsToUpdate.size}`);

    // 4. Batch commit to Firestore
    const updateList = Array.from(docsToUpdate.values());
    const BATCH_SIZE = 400;
    for (let i = 0; i < updateList.length; i += BATCH_SIZE) {
        const slice = updateList.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const item of slice) {
            const docRef = doc(firestoreDb, 'registrations', item.uuid);
            const { id: _ignore, docId: _ignore2, ...data } = item;
            batch.set(docRef, data, { merge: true });
        }
        await batch.commit();
        console.log(` - Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, updateList.length)} / ${updateList.length})`);
    }

    // 5. Sync to Dexie
    try {
        await db.registrations.bulkPut(updateList);
        console.log(` - Synced ${updateList.length} updated records to Dexie IndexedDB.`);
    } catch (err) {
        console.warn(` - Dexie note: ${err.message}`);
    }

    // 6. Push to Sheets
    console.log("\nPushing updated consolidated buffer to Google Sheets Web App...");
    const freshSnap = await getDocs(collection(firestoreDb, 'registrations'));
    const freshDocs = freshSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
    const sheetsBuffer = freshDocs.filter(d => !d.is_deleted && (d.created_by_name === USER_NAME || d.created_by_email?.includes('samukeliso')));

    console.log(`Found ${sheetsBuffer.length} active records under ${USER_NAME} to push to Sheets.`);
    const payload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Samukeliso_Mayabane',
        records: sheetsBuffer,
        replaceTab: true,
        autoReconcile: true
    };

    try {
        const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resJson = await resp.json();
        console.log("Google Sheets Web App response:", JSON.stringify(resJson, null, 2));
    } catch (err) {
        console.warn("Sheets push warning (non-fatal):", err.message);
    }

    console.log("\n==================================================================");
    console.log(" FINALIZATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
}

finalize().catch(err => {
    console.error("Error in finalize:", err);
    process.exit(1);
});
