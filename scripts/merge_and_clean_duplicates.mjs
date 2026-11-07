import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

async function getDocsWithRetry(maxAttempts = 5) {
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            const snap = await getDocs(collection(firestoreDb, 'registrations'));
            if (snap.docs.length > 50) {
                return new Map(snap.docs.map(d => [d.id, { uuid: d.id, ...d.data() }]));
            }
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2500));
    }
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    return new Map(snap.docs.map(d => [d.id, { uuid: d.id, ...d.data() }]));
}

async function runMergeAndClean() {
    console.log("==================================================================");
    console.log(" EXECUTING SYSTEM-WIDE DUPLICATE MERGE & CLEANUP");
    console.log("==================================================================\n");

    const docs = await getDocsWithRetry(5);
    console.log(`Loaded ${docs.size} total documents from Cloud Firestore.`);
    const now = new Date().toISOString();
    const toUpsert = new Map();

    function markDeleted(id, reason) {
        const existing = docs.get(id);
        if (existing) {
            toUpsert.set(id, {
                ...existing,
                uuid: id,
                is_deleted: true,
                deleted_reason: reason,
                updated_at: now
            });
            console.log(` [DELETE] ${id} (${existing.first_name || ''} ${existing.last_name || existing.surname || ''}) — ${reason}`);
        }
    }

    function updateRecord(id, patch, note) {
        const existing = docs.get(id) || { uuid: id };
        const updated = {
            ...existing,
            ...patch,
            uuid: id,
            is_deleted: false,
            updated_at: now
        };
        toUpsert.set(id, updated);
        console.log(` [MERGE/KEEP] ${id} (${updated.first_name || ''} ${updated.last_name || updated.surname || ''}) — ${note}`);
    }

    // ------------------------------------------------------------------------
    // 1. CATEGORY 1: FACILITATOR vs FACILITATOR MERGES
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Merging Facilitator vs. Facilitator Duplicates ---");

    // 1A. Nelly Kgosiemang (3e2e56bd-6587-4841-a91a-eb070305ca61) <-- Nelly Kaosimatae (fac-140-dc05154e)
    const nellyKeepId = '3e2e56bd-6587-4841-a91a-eb070305ca61';
    const nellyDropId = 'fac-140-dc05154e';
    updateRecord(nellyKeepId, {
        first_name: 'Nelly',
        last_name: 'Kgosiemang',
        surname: 'Kgosiemang',
        contact: '71601838',
        form_number: '140',
        group_name: '140',
        venue: 'Library',
        place: 'Library',
        second_leader_name: 'Losika Mmolana',
        second_leader_contact: '72493180',
        participants_count: 7,
        books_distributed: 7,
        books_received: true,
        teaching_group: true,
        is_daily_core: true
    }, "Merged Form 140 into original facilitator Nelly Kgosiemang");
    markDeleted(nellyDropId, "Merged duplicate facilitator into 3e2e56bd-6587-4841-a91a-eb070305ca61");
    for (const [id, d] of docs.entries()) {
        if (!d.is_deleted && d.type === 'participant' && String(d.group_form_number).trim() === '140') {
            toUpsert.set(id, { ...d, group_id: nellyKeepId, facilitator_uuid: nellyKeepId, updated_at: now });
        }
    }

    // 1B. Segale Windy Mokotedi (d72925f1-075c-469c-81c4-0f0b535cd581) <-- fac-Register_Segale_Mokotedi-8f517c35
    const segaleKeepId = 'd72925f1-075c-469c-81c4-0f0b535cd581';
    const segaleDropId = 'fac-Register_Segale_Mokotedi-8f517c35';
    updateRecord(segaleKeepId, {
        first_name: 'Segale Windy',
        last_name: 'Mokotedi',
        surname: 'Mokotedi',
        contact: '71829724',
        form_number: 'Register Segale_Mokotedi',
        group_name: 'Register Segale_Mokotedi',
        venue: 'Boseja South - Plot 8649',
        place: 'Boseja South - Plot 8649',
        time: '17:00',
        meeting_time: '17:00',
        second_leader_name: 'Monicah Modise',
        second_leader_contact: '72905503',
        participants_count: 16,
        books_distributed: 16,
        books_received: true,
        teaching_group: true,
        is_daily_core: true
    }, "Merged Register Segale_Mokotedi into original facilitator & fixed phone 11829724 -> 71829724");
    markDeleted(segaleDropId, "Merged duplicate facilitator into d72925f1-075c-469c-81c4-0f0b535cd581");
    for (const [id, d] of docs.entries()) {
        if (!d.is_deleted && d.type === 'participant' && String(d.group_form_number).trim() === 'Register Segale_Mokotedi') {
            toUpsert.set(id, { ...d, group_id: segaleKeepId, facilitator_uuid: segaleKeepId, updated_at: now });
        }
    }

    // 1C. Lindah Mokalane (9de45527-c01b-46ae-97d4-9674cf18a59b) <-- fac-97-6aa22fb3
    const lindahKeepId = '9de45527-c01b-46ae-97d4-9674cf18a59b';
    const lindahDropId = 'fac-97-6aa22fb3';
    updateRecord(lindahKeepId, {
        first_name: 'Lindah',
        last_name: 'Mokalane',
        surname: 'Mokalane',
        contact: '71722019',
        form_number: '97',
        group_name: '97',
        venue: 'Farm Car Wash, Tuck Shop',
        place: 'Farm Car Wash, Tuck Shop',
        participants_count: 14,
        books_distributed: 13,
        books_received: true,
        teaching_group: true,
        is_daily_core: true
    }, "Merged Form 97 into original facilitator Lindah Mokalane");
    markDeleted(lindahDropId, "Merged duplicate facilitator into 9de45527-c01b-46ae-97d4-9674cf18a59b");
    for (const [id, d] of docs.entries()) {
        if (!d.is_deleted && d.type === 'participant' && String(d.group_form_number).trim() === '97') {
            toUpsert.set(id, { ...d, group_id: lindahKeepId, facilitator_uuid: lindahKeepId, updated_at: now });
        }
    }

    // 1D. Katlego Pusoetsile (0c8a7956-498d-4ab6-9825-0964f1eb97b8) <-- Katlego Lawrence Pusoetsile (be977aa4-81d2-4082-b222-a4c82c53c4a1)
    updateRecord('0c8a7956-498d-4ab6-9825-0964f1eb97b8', {
        first_name: 'Katlego Lawrence',
        last_name: 'Pusoetsile',
        surname: 'Pusoetsile',
        form_number: '80'
    }, "Merged middle name Lawrence from unassigned duplicate facilitator");
    markDeleted('be977aa4-81d2-4082-b222-a4c82c53c4a1', "Merged unassigned duplicate facilitator into Form 80 Katlego Pusoetsile");

    // ------------------------------------------------------------------------
    // 2. CATEGORY 2: SAME-GROUP PARTICIPANT DUPLICATES
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Cleaning Same-Group Participant Duplicates ---");
    // Reg 188: Florah Gare vs Florah Gape (409)
    markDeleted('409', "Same-group 1-letter typo duplicate of Florah Gare (aa6dd26c-7307-491b-aa66-861fdcbbe1b2) in Reg 188");
    // Reg 1: M. Majepe (8e64a94c-5e9d-4ed2-80a5-4a48802f9001) vs Majere (5e7a2ac1-b83f-479d-a486-50d272f32cab)
    markDeleted('5e7a2ac1-b83f-479d-a486-50d272f32cab', "Same-group 1-letter typo duplicate of M. Majepe (8e64a94c-5e9d-4ed2-80a5-4a48802f9001) in Reg 1");
    // Reg 1: Montle Onkabetse (6b7c3afa-bd2e-4441-90ae-4c25712c3d21) vs M. Onkabetse (ba0055c4-77f4-4769-b5f5-6c4539fa4efd)
    markDeleted('ba0055c4-77f4-4769-b5f5-6c4539fa4efd', "Same-group initial duplicate of Montle Onkabetse (6b7c3afa-bd2e-4441-90ae-4c25712c3d21) in Reg 1");

    // ------------------------------------------------------------------------
    // 3. CATEGORY 3: UNGROUPED vs GROUPED PARTICIPANT DUPLICATES
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Cleaning Ungrouped (Grp: none) vs. Grouped Participant Typos ---");
    markDeleted('1b166d11-5667-4b26-be6e-fa0a6ffde8ca', "Ungrouped 1-letter typo (Sefako Kedihapile) of Sefako Kedirapile in Register Aaron_Sefako");
    markDeleted('1d1ca22f-52f1-4fed-9e73-2360f18f9d67', "Ungrouped 1-letter typo (Baone Phiri) of Yaone Phiri in Register Lesego_Moutswi");
    markDeleted('79bcef90-b202-464c-af14-d23a78df82c9', "Ungrouped 1-letter typo (Makgotha Motlhware) of Mmakgotha Motlhware in Register Aaron_Sefako");
    markDeleted('247', "Ungrouped missing-digit phone duplicate of Maatla Segotso (4d5c4d14-fd0e-4d7e-ab9a-ef6cdc295af2) in Reg 143");

    // ------------------------------------------------------------------------
    // 4. CATEGORY 5: FACILITATOR vs PARTICIPANT SELF-DUPLICATES & TYPOS
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Cleaning Facilitator vs. Participant Self-Duplicates & Spelling Typos ---");
    // Reg 138: Mpho Ramatlotlodi (part) vs Mpho Ramatotodi (fac)
    markDeleted('09e0b53d-f44d-4445-8610-6e3b821a8f9c', "Self-registered participant duplicate of Facilitator Mpho Ramatotodi in Reg 138");
    updateRecord('8c34274a-3266-457a-98d3-bbde352ec42f', {
        first_name: 'Mpho',
        last_name: 'Ramatlotlodi',
        surname: 'Ramatlotlodi'
    }, "Standardized surname spelling to Ramatlotlodi on Reg 138 Facilitator");

    // Reg 75: Tebogo Seipati Phefo (part) vs Fac
    markDeleted('df2d53dc-cde3-48d6-935e-a2d9f89a1d19', "Self-registered participant duplicate of Facilitator Tebogo Seipati Phefo in Reg 75");

    // Reg 63: Tebogo Modisagae (ungrouped part) vs Fac Tebogo Esther Modisagae
    markDeleted('e9ecde92-6b63-4c1a-98e1-c19ad7baac7e', "Ungrouped participant duplicate of Facilitator Tebogo Esther Modisagae in Reg 63");

    // Reg 80: Molebimang Otsholetseng (unassigned fac) vs Molidiemang Otsheletseng (part in Reg 80)
    markDeleted('fd8dde8f-3865-4e22-ae92-76027de64922', "Unassigned facilitator duplicate of participant Molebimang Otsholetseng in Reg 80");
    updateRecord('4f22982f-8c9d-441d-8fde-36db8fb1a24d', {
        first_name: 'Molebimang',
        last_name: 'Otsholetseng',
        surname: 'Otsholetseng'
    }, "Corrected spelling from Molidiemang Otsheletseng -> Molebimang Otsholetseng in Reg 80");

    // Reg 125: Kabo Maxala (unassigned fac) vs Kabo Maxala (part in Reg 125)
    markDeleted('93f36ab3-9580-4465-832f-bcb50e18c870', "Unassigned facilitator duplicate of participant Kabo Maxala in Reg 125");

    // Reg 123: Fix spelling of Etlisa Mapotsane -> Elisa Mapotsane and Ruthwane Pilane -> Kutlwano Pilane
    updateRecord('part-123-01-8b4ebe', {
        first_name: 'Elisa',
        last_name: 'Mapotsane',
        surname: 'Mapotsane'
    }, "Fixed 1-letter typo Etlisa -> Elisa Mapotsane in Reg 123 Row 1");

    updateRecord('part-123-04-bd0362', {
        first_name: 'Kutlwano',
        last_name: 'Pilane',
        surname: 'Pilane'
    }, "Fixed OCR name typo Ruthwane -> Kutlwano Pilane in Reg 123 Row 4");

    const upsertList = Array.from(toUpsert.values());
    console.log(`\nPrepared ${upsertList.length} records to commit.`);

    // Commit to Cloud Firestore
    const batch = writeBatch(firestoreDb);
    for (const item of upsertList) {
        const { id: _i1, docId: _i2, ...cleanData } = item;
        batch.set(doc(firestoreDb, 'registrations', item.uuid), cleanData, { merge: true });
    }
    await batch.commit();
    console.log(`Committed ${upsertList.length} records to Cloud Firestore.`);

    // Sync to Google Sheets Web App
    try {
        const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'push_profile_buffer',
                tabName: 'PROFILE_Samukeliso_Mayabane',
                records: upsertList,
                replaceTab: false,
                autoReconcile: true
            })
        });
        console.log("Google Sheets Web App response:", await resp.text());
    } catch (e) {
        console.warn("Google Sheets push warning:", e.message);
    }

    console.log("\n==================================================================");
    console.log(" MERGE & CLEANUP COMPLETED SUCCESSFULLY");
    console.log("==================================================================");
    process.exit(0);
}

runMergeAndClean().catch(err => {
    console.error(err);
    process.exit(1);
});
