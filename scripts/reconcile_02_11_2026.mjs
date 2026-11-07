import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import 'fake-indexeddb/auto';
import db from '../src/lib/dexieDb.js';
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

async function reconcile() {
    console.log("==================================================================");
    console.log(" RECONCILING 02 NOVEMBER 2026 REGISTERS & SYNCING FIRESTORE");
    console.log("==================================================================\n");

    const now = new Date().toISOString();
    const allDocs = await getDocsWithRetry(5);
    const activeDocs = allDocs.filter(d => !d.is_deleted);
    console.log(`Total active docs in Firestore: ${activeDocs.length}\n`);

    const facilitators = activeDocs.filter(d => d.type === 'facilitator');
    const participants = activeDocs.filter(d => d.type === 'participant');

    const docsToUpsert = new Map();
    const docsToDelete = new Set();

    // 1. RECONCILE REGISTER 34: DEDUPLICATE AND UPDATE ATTENDANCE
    console.log("1. Reconciling Register 34...");
    const reg34Parts = participants.filter(p => String(p.group_form_number).trim() === '34');
    console.log(`Found ${reg34Parts.length} active participant docs in Register 34.`);

    // Group by contact
    const byContact34 = {};
    for (const p of reg34Parts) {
        const c = cleanDigits(p.contact);
        if (!byContact34[c]) byContact34[c] = [];
        byContact34[c].push(p);
    }

    // Keep oldest / original for each contact
    for (const [c, list] of Object.entries(byContact34)) {
        if (list.length > 1) {
            console.log(` • Contact ${c} has ${list.length} duplicates. Keeping primary, soft-deleting others.`);
            // Sort by row_number ascending or created_at ascending
            list.sort((a, b) => (a.row_number || 99) - (b.row_number || 99));
            const primary = list[0];
            for (let i = 1; i < list.length; i++) {
                docsToDelete.add(list[i].uuid);
            }
        }
    }

    // Update attendance on primary records of Register 34
    const reg34Att = [
        { contact: '77192272', att: [0, 1, 2, 3, 4], row: 1 }, // One Meritah Magote
        { contact: '77434554', att: [0, 1, 2, 3, 4], row: 2 }, // Odirile Moshe Metswi
        { contact: '74288614', att: [2, 3, 4], row: 3 },       // Keneilwe Jong
        { contact: '77104868', att: [2, 3, 4], row: 4 }        // Tebogo Kefilwe Thebe
    ];

    for (const up of reg34Att) {
        const p8 = cleanDigits(up.contact);
        const p = reg34Parts.find(x => cleanDigits(x.contact) === p8 && !docsToDelete.has(x.uuid));
        if (p) {
            const att = Array(12).fill(false);
            up.att.forEach(d => { att[d] = true; });
            docsToUpsert.set(p.uuid, {
                ...p,
                row_number: up.row,
                attendance: att,
                books_received: true,
                updated_at: now
            });
            console.log(`   + Updated Register 34 Row ${up.row}: ${p.first_name} ${p.last_name}`);
        }
    }

    const fac34 = facilitators.find(f => String(f.form_number).trim() === '34');
    if (fac34) {
        docsToUpsert.set(fac34.uuid, {
            ...fac34,
            participants_count: 4,
            books_distributed: 4,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }

    // 2. RECONCILE REGISTER 106 ATTENDANCE
    console.log("\n2. Reconciling Register 106 Attendance...");
    const reg106Parts = participants.filter(p => String(p.group_form_number).trim() === '106');
    const p2Rows106 = [
        { contact: '76924891', att: [0, 1, 2], row: 13 }, // Otshabeng Mogatsi
        { contact: '75081225', att: [1, 2], row: 14 },    // Thatayone Modimoakwena
        { contact: '78198408', att: [0], row: 15 },       // Kabo Kebekwe
        { contact: '76378770', att: [0, 1, 2], row: 16 }, // Thabang I Makgale
        { contact: '72631574', att: [0, 1, 2], row: 17 }, // Elled Mogotsi
        { contact: '76942904', att: [0, 1, 2], row: 18 }  // Keikelitse Letsohuti
    ];
    for (const up of p2Rows106) {
        const p8 = cleanDigits(up.contact);
        const p = reg106Parts.find(x => cleanDigits(x.contact) === p8);
        if (p) {
            const att = Array(12).fill(false);
            up.att.forEach(d => { att[d] = true; });
            docsToUpsert.set(p.uuid, {
                ...p,
                row_number: up.row,
                attendance: att,
                books_received: true,
                updated_at: now
            });
            console.log(`   + Updated Register 106 Row ${up.row}: ${p.first_name} ${p.last_name}`);
        }
    }
    const fac106 = facilitators.find(f => String(f.form_number).trim() === '106');
    if (fac106) {
        docsToUpsert.set(fac106.uuid, {
            ...fac106,
            participants_count: 18,
            books_distributed: 18,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }

    // 3. RECONCILE REGISTER 123 ATTENDANCE
    console.log("\n3. Reconciling Register 123 Attendance...");
    const reg123Parts = participants.filter(p => String(p.group_form_number).trim() === '123');
    const att123 = [
        { contact: '74786282', att: [0, 1, 2, 3, 4] }, // Etlisa Mapotsane
        { contact: '71211147', att: [0, 1, 2, 3, 4] }, // Lesedi Molefe
        { contact: '75654130', att: [0, 1, 2, 3, 4] }, // Grace Moroke
        { contact: '75629947', att: [0, 1, 2, 4] },    // Karabo F. Seroke
        { contact: '78563708', att: [0, 1, 4] },       // Onkarabile E. Moabi
        { contact: '72638895', att: [0, 1] },          // Prince T. Rathapo
        { contact: '78363709', att: [0, 1, 2, 3, 4] }, // Alex Tlhankane
        { contact: '72978680', altContact: '72978650', att: [0, 1, 2, 3, 4] }, // Proud M. Mapotsane
        { contact: '78324387', altContact: '78324389', att: [0, 1, 2, 3, 4] }, // Magdaline Nkele
        { contact: '72654199', att: [0, 1, 2, 3, 4] }, // Ruthwane Pilane
        { contact: '72635249', att: [0, 1, 2, 3, 4] }, // Eric Tshebele
        { contact: '71694726', att: [0, 1, 3] },       // Bishop Dube
        { contact: '74143881', att: [0, 1, 3] },       // Peter Mangole
        { contact: '74261043', att: [0, 1, 2] },       // Joel Mogaladiware
        { contact: '74004955', att: [0, 1, 2] },       // Masego Ramere
        { contact: '75546052', att: [3] }              // Lesego Modibedi
    ];
    for (const up of att123) {
        const p8 = cleanDigits(up.contact);
        const alt8 = up.altContact ? cleanDigits(up.altContact) : null;
        const p = reg123Parts.find(x => {
            const c = cleanDigits(x.contact);
            return (p8 && c === p8) || (alt8 && c === alt8);
        });
        if (p) {
            const att = Array(12).fill(false);
            up.att.forEach(d => { att[d] = true; });
            docsToUpsert.set(p.uuid, {
                ...p,
                attendance: att,
                books_received: true,
                updated_at: now
            });
            console.log(`   + Updated Register 123 attendance for: ${p.first_name} ${p.last_name}`);
        }
    }
    const fac123 = facilitators.find(f => String(f.form_number).trim() === '123');
    if (fac123) {
        docsToUpsert.set(fac123.uuid, {
            ...fac123,
            participants_count: 16,
            books_distributed: 16,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }

    // 4. RECONCILE REGISTER 157 ATTENDANCE
    console.log("\n4. Reconciling Register 157 Attendance...");
    const reg157Parts = participants.filter(p => String(p.group_form_number).trim() === '157');
    for (const p of reg157Parts) {
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; // 27, 28, 29 Oct
        docsToUpsert.set(p.uuid, {
            ...p,
            attendance: att,
            books_received: true,
            updated_at: now
        });
        console.log(`   + Updated Register 157 (29 Oct added) for: ${p.first_name} ${p.last_name}`);
    }
    const fac157 = facilitators.find(f => String(f.form_number).trim() === '157');
    if (fac157) {
        docsToUpsert.set(fac157.uuid, {
            ...fac157,
            participants_count: 3,
            books_distributed: 3,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }

    // 5. RECONCILE REGISTER 221 ATTENDANCE
    console.log("\n5. Reconciling Register 221 Attendance...");
    const reg221Parts = participants.filter(p => String(p.group_form_number).trim() === '221');
    const att221 = [
        { contact: '76163879', att: [0] },             // Sesame Letlhompha
        { contact: '76286835', att: [0, 1] },          // Makang Kgopole
        { contact: '71449744', att: [0, 1, 2, 3, 4] }, // Kedidimetse Moroka
        { contact: '76022132', att: [0, 1, 2, 3, 4] }, // Patrick David
        { contact: '73843316', att: [0, 1, 3, 4] },    // T. B. Lekgowa
        { contact: '75271035', att: [0, 2] },          // M. Mogotsi
        { contact: '77627477', att: [0, 2, 3] },       // D. V. Kiti
        { contact: '73606838', att: [0, 1, 2, 3] },    // Keitumetse Modise
        { contact: '73863835', att: [0, 1, 2, 3, 4] }, // Onkgopotse Sloma
        { contact: '73601455', att: [0, 1, 2, 3, 4] }, // Lesedi Mpotokwane
        { contact: '74843945', att: [1, 2, 4] },       // Tiny Sitang
        { contact: '75324557', att: [2, 3, 4] }        // Speedwell Bobe
    ];
    for (const up of att221) {
        const p8 = cleanDigits(up.contact);
        const p = reg221Parts.find(x => cleanDigits(x.contact) === p8);
        if (p) {
            const att = Array(12).fill(false);
            up.att.forEach(d => { att[d] = true; });
            docsToUpsert.set(p.uuid, {
                ...p,
                attendance: att,
                books_received: true,
                updated_at: now
            });
            console.log(`   + Updated Register 221 attendance for: ${p.first_name} ${p.last_name}`);
        }
    }
    const fac221 = facilitators.find(f => String(f.form_number).trim() === '221');
    if (fac221) {
        docsToUpsert.set(fac221.uuid, {
            ...fac221,
            participants_count: 12,
            books_distributed: 12,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }

    // 6. RECONCILE AARON SEFAKO (REGISTER AARON_SEFAKO)
    console.log("\n6. Reconciling Register Aaron_Sefako...");
    let aaronFac = facilitators.find(f => cleanDigits(f.contact) === '71782500' || (f.last_name || '').toLowerCase().includes('sefako'));
    if (!aaronFac) {
        const facUuid = `fac-Register_Aaron_Sefako-${crypto.randomUUID().slice(0, 8)}`;
        aaronFac = {
            uuid: facUuid,
            campaign_id: CAMPAIGN_ID,
            type: 'facilitator',
            form_number: 'Register Aaron_Sefako',
            group_name: 'Register Aaron_Sefako',
            first_name: 'Aaron T.',
            last_name: 'Sefako',
            contact: '71782500',
            venue: 'Regional Education Office / Assemblies of God',
            place: 'Regional Education Office / Assemblies of God',
            time: '09:00 AM',
            meeting_time: '09:00 AM',
            second_leader_name: 'Mmusi Lebotse',
            second_leader_contact: '76093471',
            participants_count: 6,
            books_distributed: 6,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL,
            created_by_uid: USER_UID,
            created_at: now,
            updated_at: now,
            is_deleted: false
        };
        docsToUpsert.set(facUuid, aaronFac);
    } else {
        aaronFac = {
            ...aaronFac,
            form_number: 'Register Aaron_Sefako',
            group_name: 'Register Aaron_Sefako',
            venue: 'Regional Education Office / Assemblies of God',
            place: 'Regional Education Office / Assemblies of God',
            time: '09:00 AM',
            meeting_time: '09:00 AM',
            participants_count: 6,
            books_distributed: 6,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        };
        docsToUpsert.set(aaronFac.uuid, aaronFac);
    }

    // Aaron Sefako 6 participants definition
    const aaronParticipantsData = [
        { first_name: 'Matlhodi', last_name: 'Tshwene', gender: 'F', age: 42, contact: '78545476', education: 'Diploma', marital: 'Single', org: 'EDUCATION', occ: 'PRINCIPAL ADMIN', att: [0, 1, 2] },
        { first_name: 'Mosadiotsile', last_name: 'Machete', gender: 'F', age: 55, contact: '71692441', education: 'University', marital: 'Married', org: 'EDUCATION', occ: 'PAEO I', att: [0, 1, 2] },
        { first_name: 'Linda H.', last_name: 'Setshwane', gender: 'F', age: 44, contact: '72120343', education: 'Senior', marital: 'Single', org: 'EDUCATION', occ: 'CLEANER', att: [0, 1, 2] },
        { first_name: 'Sefako', last_name: 'Kedirapile', gender: 'F', age: 54, contact: '71442267', education: 'Vocational', marital: 'Married', org: 'Self', occ: 'Enterpreneur', att: [0, 1, 2] },
        { first_name: 'Galeboe', last_name: 'Motlhware', gender: 'F', age: 28, contact: '75286393', education: 'Senior', marital: 'Single', org: 'EDUCATION', occ: 'IT', att: [0, 1, 2] },
        { first_name: 'Mmakgotha', last_name: 'Motlhware', gender: 'F', age: 38, contact: '74851136', education: 'Senior', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] }
    ];

    for (let i = 0; i < aaronParticipantsData.length; i++) {
        const pData = aaronParticipantsData[i];
        const p8 = cleanDigits(pData.contact);
        let existingP = participants.find(p => (p.group_id === aaronFac.uuid || p.facilitator_uuid === aaronFac.uuid || cleanDigits(p.contact) === p8));

        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true;

        if (existingP) {
            docsToUpsert.set(existingP.uuid, {
                ...existingP,
                group_form_number: 'Register Aaron_Sefako',
                group_id: aaronFac.uuid,
                facilitator_uuid: aaronFac.uuid,
                first_name: pData.first_name,
                last_name: pData.last_name,
                gender: pData.gender,
                age: pData.age,
                education_level: pData.education,
                marital_status: pData.marital,
                organisation: pData.org,
                affiliation: pData.org,
                occupation: pData.occ,
                place: 'Regional Education Office / Assemblies of God',
                books_received: true,
                attendance: att,
                updated_at: now
            });
            console.log(`   + Linked existing participant to Register Aaron_Sefako: ${pData.first_name} ${pData.last_name}`);
        } else {
            const pUuid = `part-Register_Aaron_Sefako-${String(i + 1).padStart(2, '0')}-${crypto.randomUUID().slice(0, 6)}`;
            const newP = {
                uuid: pUuid,
                campaign_id: CAMPAIGN_ID,
                type: 'participant',
                group_form_number: 'Register Aaron_Sefako',
                group_id: aaronFac.uuid,
                facilitator_uuid: aaronFac.uuid,
                row_number: i + 1,
                first_name: pData.first_name,
                last_name: pData.last_name,
                gender: pData.gender,
                age: pData.age,
                contact: pData.contact,
                education_level: pData.education,
                marital_status: pData.marital,
                place: 'Regional Education Office / Assemblies of God',
                organisation: pData.org,
                affiliation: pData.org,
                occupation: pData.occ,
                books_received: true,
                attendance: att,
                created_by_name: USER_NAME,
                created_by_email: USER_EMAIL,
                created_by_uid: USER_UID,
                created_at: now,
                updated_at: now,
                is_deleted: false
            };
            docsToUpsert.set(pUuid, newP);
            console.log(`   + Created participant for Register Aaron_Sefako: ${pData.first_name} ${pData.last_name}`);
        }
    }

    const upsertList = Array.from(docsToUpsert.values());
    console.log(`\n==================================================================`);
    console.log(`RECONCILE SUMMARY:`);
    console.log(` - Upsert Records: ${upsertList.length}`);
    console.log(` - Soft-Delete Records (Duplicates): ${docsToDelete.size}`);
    console.log(`==================================================================\n`);

    // 7. Sync to Dexie IndexedDB
    try {
        console.log("7. Syncing records to local Dexie IndexedDB cache...");
        await db.open();
        for (const item of upsertList) {
            await db.registrations.put(item);
        }
        for (const uuid of docsToDelete) {
            await db.registrations.update(uuid, { is_deleted: true, deleted_at: now });
        }
        console.log(`Dexie IndexedDB synced successfully.`);
    } catch (dexErr) {
        console.warn("Dexie local sync notice (non-fatal):", dexErr.message);
    }

    // 8. Commit to Cloud Firestore in Batches
    console.log("8. Committing batches to Cloud Firestore...");
    const BATCH_SIZE = 400;
    for (let i = 0; i < upsertList.length; i += BATCH_SIZE) {
        const slice = upsertList.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const item of slice) {
            const docRef = doc(firestoreDb, 'registrations', item.uuid);
            const { id: _ignore, docId: _ignore2, ...dataToSync } = item;
            batch.set(docRef, dataToSync, { merge: true });
        }
        await batch.commit();
        console.log(` - Committed upsert batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, upsertList.length)} / ${upsertList.length})`);
    }

    if (docsToDelete.size > 0) {
        const delBatch = writeBatch(firestoreDb);
        for (const uuid of docsToDelete) {
            const docRef = doc(firestoreDb, 'registrations', uuid);
            delBatch.update(docRef, { is_deleted: true, deleted_at: now, deletion_reason: 'Duplicate row removed during 02 Nov handover reconciliation' });
        }
        await delBatch.commit();
        console.log(` - Committed deletion batch (${docsToDelete.size} records soft-deleted).`);
    }

    // 9. Push consolidated profile buffer to Google Sheets Web App
    console.log("\n9. Pushing profile buffer to Google Sheets Web App...");
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
    console.log(" RECONCILIATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
    process.exit(0);
}

reconcile().catch(err => {
    console.error("Reconciliation error:", err);
    process.exit(1);
});
