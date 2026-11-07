import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22';
const USER_UID = 'E7bGBQslPsafBPovmFoYHiLqxQZ2';
const USER_NAME = 'Samukeliso Mayabane';
const USER_EMAIL = 'samukeliso.mayabane@thehealthyfamilies.net';
const GOOGLE_SHEETS_WEBAPP_URL = process.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

function cleanDigits(s) {
    return String(s || '').replace(/\D/g, '').slice(-8);
}

function normalizeName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
}

async function getDocsWithRetry(maxAttempts = 5) {
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            console.log(`Fetching from Firestore (attempt ${i}/${maxAttempts})...`);
            const snap = await getDocs(collection(firestoreDb, 'registrations'));
            if (snap.docs.length > 50) {
                console.log(`Successfully retrieved ${snap.docs.length} documents from Firestore.`);
                return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
            }
            console.log(`Received ${snap.docs.length} docs (waiting for online sync)...`);
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3500));
    }
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

// Full transcription dataset for all 22 groups in 06 November batch
// Days 1 to 9 correspond to indices 0..8
// 0: 27 Oct, 1: 28 Oct, 2: 29 Oct, 3: 30 Oct, 4: 2 Nov, 5: 3 Nov, 6: 4 Nov, 7: 5 Nov, 8: 6 Nov
import { TRANSCRIBED_GROUPS } from './transcribed_06_11_2026.mjs';

async function execute() {
    console.log("==================================================================");
    console.log(" EXECUTING 06 NOVEMBER 2026 REGISTERS INGESTION & RECONCILIATION");
    console.log("==================================================================\n");

    const now = new Date().toISOString();
    const allDocs = await getDocsWithRetry(5);
    const activeDocs = allDocs.filter(d => !d.is_deleted);
    console.log(`Total active docs in Firestore: ${activeDocs.length}\n`);

    const facilitators = activeDocs.filter(d => d.type === 'facilitator');
    const participants = activeDocs.filter(d => d.type === 'participant');

    const docsToUpsert = new Map();
    const stats = {
        updatedParticipants: 0,
        addedParticipants: 0,
        updatedFacilitators: 0,
        attendanceMarksExtended: 0
    };

    // Helper to find existing participant
    function findParticipant(name, phone) {
        const c = cleanDigits(phone);
        if (c && c.length >= 7) {
            const byPhone = participants.find(p => cleanDigits(p.contact) === c);
            if (byPhone) return byPhone;
        }
        const n = normalizeName(name);
        if (n && n.length > 5) {
            const byName = participants.find(p => normalizeName(`${p.first_name || ''} ${p.last_name || ''}`) === n);
            if (byName) return byName;
        }
        return null;
    }

    // Process each group
    for (const grp of TRANSCRIBED_GROUPS) {
        console.log(`\nProcessing Group: ${grp.group_form_number} (${grp.venue || 'No venue'})`);
        
        // Match or find facilitator
        let fac = facilitators.find(f => f.uuid === grp.facilitator_uuid) ||
                  facilitators.find(f => cleanDigits(f.contact) === cleanDigits(grp.facilitator_phone)) ||
                  facilitators.find(f => normalizeName(`${f.first_name || ''} ${f.last_name || ''}`) === normalizeName(grp.facilitator_name));

        if (fac) {
            console.log(` • Facilitator matched: ${fac.name || fac.first_name + ' ' + fac.last_name} (${fac.uuid})`);
            // Update facilitator group_form_number if needed
            let facUpdated = false;
            const updatedFac = { ...fac };
            if (!updatedFac.group_form_number || updatedFac.group_form_number === 'none' || (grp.group_form_number && !grp.group_form_number.includes('Register') && updatedFac.group_form_number === '1')) {
                updatedFac.group_form_number = grp.group_form_number;
                updatedFac.form_number = grp.group_form_number;
                facUpdated = true;
            }
            if (grp.venue && (!updatedFac.place || updatedFac.place === 'Mochudi')) {
                updatedFac.place = grp.venue;
                facUpdated = true;
            }
            if (grp.meeting_time && !updatedFac.meeting_time) {
                updatedFac.meeting_time = grp.meeting_time;
                facUpdated = true;
            }
            if (facUpdated) {
                updatedFac.updated_at = now;
                updatedFac.updated_by_uid = USER_UID;
                updatedFac.updated_by_name = USER_NAME;
                updatedFac.updated_by_email = USER_EMAIL;
                docsToUpsert.set(updatedFac.uuid, updatedFac);
                stats.updatedFacilitators++;
            }
        } else {
            console.warn(` ⚠️ Facilitator NOT matched for group ${grp.group_form_number} (${grp.facilitator_name})`);
        }

        const facUuid = fac ? fac.uuid : null;

        for (const p of grp.participants) {
            const existing = findParticipant(p.name, p.contact);
            if (existing) {
                // Update attendance & demographics
                const updatedPart = { ...existing };
                let hasChanges = false;

                // Merge attendance: keep true if either has true
                const newAtt = Array(12).fill(false);
                for (let i = 0; i < 12; i++) {
                    const exVal = Array.isArray(existing.attendance) ? existing.attendance[i] : false;
                    const pVal = Array.isArray(p.attendance) ? p.attendance[i] : false;
                    newAtt[i] = Boolean(exVal || pVal);
                }

                // Check if attendance changed
                const attChanged = JSON.stringify(newAtt) !== JSON.stringify(existing.attendance);
                if (attChanged) {
                    updatedPart.attendance = newAtt;
                    hasChanges = true;
                    stats.attendanceMarksExtended++;
                }

                // Reconcile group_form_number
                if (grp.group_form_number && (!updatedPart.group_form_number || updatedPart.group_form_number === '1' || updatedPart.group_form_number === '6')) {
                    if (updatedPart.group_form_number !== grp.group_form_number) {
                        updatedPart.group_form_number = grp.group_form_number;
                        hasChanges = true;
                    }
                }

                // Enrich missing demographics
                if (!updatedPart.gender && p.gender) { updatedPart.gender = p.gender; hasChanges = true; }
                if ((!updatedPart.age || updatedPart.age === 0) && p.age) { updatedPart.age = p.age; hasChanges = true; }
                if (!updatedPart.education && p.education) { updatedPart.education = p.education; hasChanges = true; }
                if (!updatedPart.marital_status && p.marital_status) { updatedPart.marital_status = p.marital_status; hasChanges = true; }
                if (!updatedPart.occupation && p.occupation) { updatedPart.occupation = p.occupation; hasChanges = true; }
                if (!updatedPart.affiliation && p.affiliation) { updatedPart.affiliation = p.affiliation; hasChanges = true; }
                if (p.books_received && !updatedPart.books_received) { updatedPart.books_received = true; hasChanges = true; }
                if (facUuid && !updatedPart.facilitator_uuid) { updatedPart.facilitator_uuid = facUuid; hasChanges = true; }

                if (hasChanges) {
                    updatedPart.updated_at = now;
                    updatedPart.updated_by_uid = USER_UID;
                    updatedPart.updated_by_name = USER_NAME;
                    updatedPart.updated_by_email = USER_EMAIL;
                    docsToUpsert.set(updatedPart.uuid, updatedPart);
                    stats.updatedParticipants++;
                }
            } else {
                // New participant
                const nameParts = p.name.trim().split(/\s+/);
                const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

                const newUuid = crypto.randomUUID();
                const attArray = Array(12).fill(false);
                if (Array.isArray(p.attendance)) {
                    for (let i = 0; i < 12; i++) {
                        attArray[i] = Boolean(p.attendance[i]);
                    }
                }

                const newPart = {
                    uuid: newUuid,
                    type: 'participant',
                    first_name: firstName,
                    last_name: lastName,
                    contact: p.contact || '',
                    gender: p.gender || '',
                    age: Number(p.age) || null,
                    education: p.education || '',
                    marital_status: p.marital_status || '',
                    occupation: p.occupation || '',
                    affiliation: p.affiliation || '',
                    books_received: Boolean(p.books_received),
                    group_form_number: grp.group_form_number || '',
                    place: grp.venue || 'Mochudi',
                    facilitator_uuid: facUuid,
                    attendance: attArray,
                    submission_source: 'paper_batch_entry',
                    campaign_id: CAMPAIGN_ID,
                    is_daily_core: false,
                    is_deleted: false,
                    created_at: now,
                    updated_at: now,
                    created_by_uid: USER_UID,
                    created_by_name: USER_NAME,
                    created_by_email: USER_EMAIL,
                    created_by_role: 'admin',
                    updated_by_uid: USER_UID,
                    updated_by_name: USER_NAME,
                    updated_by_email: USER_EMAIL,
                    updated_by_role: 'admin'
                };

                docsToUpsert.set(newUuid, newPart);
                stats.addedParticipants++;
            }
        }
    }

    console.log("\n=== RECONCILIATION SUMMARY ===");
    console.log(` • Updated Participants: ${stats.updatedParticipants}`);
    console.log(` • Added New Participants: ${stats.addedParticipants}`);
    console.log(` • Updated Facilitators: ${stats.updatedFacilitators}`);
    console.log(` • Attendance Marks Extended: ${stats.attendanceMarksExtended}`);
    console.log(` • Total Docs to Commit to Firestore: ${docsToUpsert.size}\n`);

    // Commit to Firestore in batches of 450
    const upsertList = Array.from(docsToUpsert.values());
    const BATCH_SIZE = 450;
    for (let i = 0; i < upsertList.length; i += BATCH_SIZE) {
        const slice = upsertList.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const item of slice) {
            const docRef = doc(firestoreDb, 'registrations', item.uuid);
            const { id: _ignore, docId: _ignore2, ...dataToSync } = item;
            batch.set(docRef, dataToSync, { merge: true });
        }
        await batch.commit();
        console.log(` - Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, upsertList.length)} / ${upsertList.length})`);
    }

    // Push consolidated profile buffer to Google Sheets Web App
    console.log("\nPushing profile buffer to Google Sheets Web App...");
    const freshDocs = (await getDocsWithRetry(3)).filter(d => !d.is_deleted && (d.created_by_name === USER_NAME || d.created_by_email?.includes('samukeliso')));

    const payload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Samukeliso_Mayabane',
        records: freshDocs,
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
        console.warn("Sheets push notice (non-fatal):", err.message);
    }

    console.log("\n==================================================================");
    console.log(" 06 NOVEMBER RECONCILIATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
    process.exit(0);
}

execute().catch(err => {
    console.error("Execution error:", err);
    process.exit(1);
});
