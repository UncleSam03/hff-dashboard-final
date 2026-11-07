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
            console.log(`Received ${snap.docs.length} docs (waiting for sync)...`);
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3500));
    }
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

import { TRANSCRIBED_GROUPS_07 } from './transcribed_07_11_2026.mjs';

async function execute() {
    console.log("==================================================================");
    console.log(" EXECUTING 07 NOVEMBER 2026 REGISTERS INGESTION & RECONCILIATION");
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
        addedFacilitators: 0,
        attendanceMarksExtended: 0
    };

    function findParticipant(name, phone) {
        const c = cleanDigits(phone);
        if (c && c.length >= 7 && c !== '00000000') {
            const byPhone = participants.find(p => cleanDigits(p.contact) === c);
            if (byPhone) return byPhone;
        }
        const n = normalizeName(name);
        if (n && n.length > 5) {
            const byName = participants.find(p => {
                const pn = normalizeName(`${p.first_name || ''} ${p.last_name || ''}`);
                return pn === n || (n.length > 8 && (pn.includes(n) || n.includes(pn)));
            });
            if (byName) return byName;
        }
        return null;
    }

    for (const grp of TRANSCRIBED_GROUPS_07) {
        console.log(`\nProcessing Group: ${grp.group_form_number} (${grp.venue || 'No venue'})`);
        
        let fac = null;
        if (grp.facilitator_uuid) {
            fac = facilitators.find(f => f.uuid === grp.facilitator_uuid);
        }
        if (!fac && grp.facilitator_phone) {
            fac = facilitators.find(f => cleanDigits(f.contact) === cleanDigits(grp.facilitator_phone));
        }
        if (!fac && grp.facilitator_name) {
            fac = facilitators.find(f => normalizeName(`${f.first_name || ''} ${f.last_name || ''}`) === normalizeName(grp.facilitator_name));
        }

        let facUuid = null;

        if (fac) {
            facUuid = fac.uuid;
            console.log(` • Facilitator matched: ${fac.name || fac.first_name + ' ' + fac.last_name} (${fac.uuid})`);
            let facUpdated = false;
            const updatedFac = { ...fac };
            if (!updatedFac.form_number || updatedFac.form_number === 'none' || updatedFac.form_number !== grp.group_form_number) {
                // If Babedi Moraope was 59, update to 60
                // If Barbra Shivuri was 61, update to 207
                updatedFac.form_number = grp.group_form_number;
                updatedFac.group_form_number = grp.group_form_number;
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
            // Create new facilitator (e.g. Maduo Dintle G Modise for Reg 155)
            console.log(` • Creating brand-new facilitator profile: ${grp.facilitator_name} (${grp.group_form_number})`);
            const nameParts = (grp.facilitator_name || '').trim().split(/\s+/);
            const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            facUuid = crypto.randomUUID();

            const newFac = {
                uuid: facUuid,
                type: 'facilitator',
                first_name: firstName,
                last_name: lastName,
                contact: grp.facilitator_phone || '',
                form_number: grp.group_form_number || '',
                group_form_number: grp.group_form_number || '',
                place: grp.venue || 'Mochudi',
                meeting_time: grp.meeting_time || '',
                campaign_id: CAMPAIGN_ID,
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
            docsToUpsert.set(facUuid, newFac);
            facilitators.push(newFac);
            stats.addedFacilitators++;
        }

        for (const p of grp.participants) {
            const existing = findParticipant(p.name, p.contact);
            if (existing) {
                const updatedPart = { ...existing };
                let hasChanges = false;

                // Merge attendance
                const newAtt = Array(12).fill(false);
                for (let i = 0; i < 12; i++) {
                    const exVal = Array.isArray(existing.attendance) ? existing.attendance[i] : false;
                    const pVal = Array.isArray(p.attendance) ? p.attendance[i] : false;
                    newAtt[i] = Boolean(exVal || pVal);
                }

                if (JSON.stringify(newAtt) !== JSON.stringify(existing.attendance)) {
                    updatedPart.attendance = newAtt;
                    hasChanges = true;
                    stats.attendanceMarksExtended++;
                }

                // Update form number if needed (e.g. 61 -> 207)
                if (grp.group_form_number && (!updatedPart.group_form_number || updatedPart.group_form_number === '61' || updatedPart.group_form_number === '59')) {
                    if (updatedPart.group_form_number !== grp.group_form_number) {
                        updatedPart.group_form_number = grp.group_form_number;
                        updatedPart.form_number = grp.group_form_number;
                        hasChanges = true;
                    }
                }

                // Enrich demographics
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
                // Brand new participant
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
                    form_number: grp.group_form_number || '',
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
                participants.push(newPart);
                stats.addedParticipants++;
            }
        }
    }

    console.log("\n=== RECONCILIATION SUMMARY ===");
    console.log(` • Updated Existing Participants: ${stats.updatedParticipants}`);
    console.log(` • Added Brand-New Participants:  ${stats.addedParticipants}`);
    console.log(` • Updated Facilitators:          ${stats.updatedFacilitators}`);
    console.log(` • Added Brand-New Facilitators:   ${stats.addedFacilitators}`);
    console.log(` • Attendance Marks Extended (D9): ${stats.attendanceMarksExtended}`);
    console.log(` • Total Docs to Commit:          ${docsToUpsert.size}\n`);

    // Commit to Firestore in batches
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

    console.log("\n==================================================================");
    console.log(" 07 NOVEMBER RECONCILIATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
    process.exit(0);
}

execute().catch(err => {
    console.error("Execution error:", err);
    process.exit(1);
});
