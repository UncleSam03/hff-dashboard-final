import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

const GOOGLE_SHEETS_WEBAPP_URL = process.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

async function executeFixes() {
    console.log("Beginning execution of duplicate merges and soft deletions...");
    const now = new Date().toISOString();
    const batch = writeBatch(firestoreDb);

    // ==========================================
    // CLUSTER 1:
    // Keep Facilitator: Tebogo Esther Modisagae (193eacb5-8010-44c8-835e-9fd1a25045c7)
    // Remove Participant: Tebogo Modisagae (022a52bc-1e4a-4c28-890c-8db129f735c0)
    // ==========================================
    console.log("\nProcessing Cluster 1...");
    // 1. Soft-delete participant
    const part1Ref = doc(firestoreDb, 'registrations', '022a52bc-1e4a-4c28-890c-8db129f735c0');
    batch.update(part1Ref, {
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
        deletion_reason: 'Merged with facilitator record 193eacb5-8010-44c8-835e-9fd1a25045c7 (duplicate participant self-entry)'
    });

    // 2. Update facilitator stats (Form 63 had 12 participants including herself, now 11 active participants)
    const fac1Ref = doc(firestoreDb, 'registrations', '193eacb5-8010-44c8-835e-9fd1a25045c7');
    batch.update(fac1Ref, {
        participants_count: 11,
        books_distributed: 11,
        updated_at: now
    });

    // ==========================================
    // CLUSTER 2:
    // Kefilwe Shaimus Koitsiwe (4bb15bdc-20c0-4fd6-9b52-8d2568ce2f85) vs Kefilwe Koitsiwe (9cc7a9b7-d0dd-4a00-b512-c0ab312f18d0)
    // Keep Kefilwe Shaimus Koitsiwe (4bb15bdc...) with middle name
    // Remove Kefilwe Koitsiwe (9cc7a9b7...)
    // ==========================================
    console.log("Processing Cluster 2...");
    const part2Ref = doc(firestoreDb, 'registrations', '9cc7a9b7-d0dd-4a00-b512-c0ab312f18d0');
    batch.update(part2Ref, {
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
        deletion_reason: 'Merged into 4bb15bdc-20c0-4fd6-9b52-8d2568ce2f85 (middle name variant)'
    });

    // Update Form 201 facilitator participant count (was 55, now 54)
    const fac201Ref = doc(firestoreDb, 'registrations', '0a337ef0-ce8f-47ea-bd0e-1dcdffb1c369');
    const fac201Snap = await getDoc(fac201Ref);
    if (fac201Snap.exists()) {
        const curCount = fac201Snap.data().participants_count || 55;
        const curBooks = fac201Snap.data().books_distributed || 55;
        batch.update(fac201Ref, {
            participants_count: Math.max(0, curCount - 1),
            books_distributed: Math.max(0, curBooks - 1),
            updated_at: now
        });
    }

    // ==========================================
    // CLUSTER 3:
    // Serufe Masilo in Group 63 (80303b8f-2132-45c0-965b-f4717692c526) vs Group 132 (e4563835-83dd-47a3-af41-3f99ce3c4f5e)
    // Remove Serufe Masilo from group 132 (e4563835...)
    // Keep Serufe Masilo in group 63
    // ==========================================
    console.log("Processing Cluster 3...");
    const part3Ref = doc(firestoreDb, 'registrations', 'e4563835-83dd-47a3-af41-3f99ce3c4f5e');
    batch.update(part3Ref, {
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
        deletion_reason: 'Removed duplicate registration from Group 132; retained in Group 63'
    });

    // Update Form 132 facilitator (Onicah Phalaagae f08da1dc-231d-4740-ad20-4533dd44947b)
    const fac132Ref = doc(firestoreDb, 'registrations', 'f08da1dc-231d-4740-ad20-4533dd44947b');
    const fac132Snap = await getDoc(fac132Ref);
    if (fac132Snap.exists()) {
        const curCount = fac132Snap.data().participants_count || 12;
        const curBooks = fac132Snap.data().books_distributed || 12;
        batch.update(fac132Ref, {
            participants_count: Math.max(0, curCount - 1),
            books_distributed: Math.max(0, curBooks - 1),
            updated_at: now
        });
    }

    // ==========================================
    // CLUSTER 4:
    // Keep name "Ben Moloi" (a0ecbaa3-b897-4875-8c4f-d47ed304d8ca)
    // Merge Rrapula moloi (1044a9a9-2110-4f31-85f3-f0f037382a0f) into Ben Moloi
    // Soft-delete Rrapula moloi
    // ==========================================
    console.log("Processing Cluster 4...");
    const benRef = doc(firestoreDb, 'registrations', 'a0ecbaa3-b897-4875-8c4f-d47ed304d8ca');
    batch.update(benRef, {
        first_name: 'Ben',
        last_name: 'Moloi',
        attendance: [true, true, false, false, false, false, false, false, false, false, false, false],
        teaching_group: true,
        is_daily_core: true,
        books_distributed: 1,
        participants_count: 1,
        updated_at: now
    });

    const rrapulaRef = doc(firestoreDb, 'registrations', '1044a9a9-2110-4f31-85f3-f0f037382a0f');
    batch.update(rrapulaRef, {
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
        deletion_reason: 'Merged into Ben Moloi (a0ecbaa3-b897-4875-8c4f-d47ed304d8ca)'
    });

    // ==========================================
    // CLUSTER 5:
    // Merge Mothusi Mapotsane (dd5437a1-2350-4e89-920a-82b244784bd3)
    // and Proud M Mapotsane (f57a8a01-9fcf-4321-b2ba-2f3473f603e7)
    // Name becomes: Proud Mothusi Mapotsane
    // Keep f57a8a01... as surviving record, soft delete dd5437a1...
    // ==========================================
    console.log("Processing Cluster 5...");
    const proudRef = doc(firestoreDb, 'registrations', 'f57a8a01-9fcf-4321-b2ba-2f3473f603e7');
    batch.update(proudRef, {
        first_name: 'Proud Mothusi',
        last_name: 'Mapotsane',
        attendance: [true, true, false, false, false, false, false, false, false, false, false, false],
        teaching_group: true,
        is_daily_core: true,
        books_distributed: 1,
        participants_count: 1,
        updated_at: now
    });

    const mothusiRef = doc(firestoreDb, 'registrations', 'dd5437a1-2350-4e89-920a-82b244784bd3');
    batch.update(mothusiRef, {
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
        deletion_reason: 'Merged into Proud Mothusi Mapotsane (f57a8a01-9fcf-4321-b2ba-2f3473f603e7)'
    });

    // ==========================================
    // CLUSTER 6:
    // Keep Record A: Facilitator Onkarabile Nnuku Makole (6ad71cd4-153b-4d68-b061-5c32f4c48e9d)
    // Remove Record B: Participant Onkabile Nkwane (82f50370-d693-4dc6-8575-c768af57f6cc) on Form 136
    // Facilitator for Record B: Olebogeng Peolwane (c9a145e2-640f-4583-b1bb-10c8739f7402)
    // ==========================================
    console.log("Processing Cluster 6...");
    const part6Ref = doc(firestoreDb, 'registrations', '82f50370-d693-4dc6-8575-c768af57f6cc');
    batch.update(part6Ref, {
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
        deletion_reason: 'Merged into facilitator record Onkarabile Nnuku Makole (6ad71cd4-153b-4d68-b061-5c32f4c48e9d)'
    });

    // Update Form 136 facilitator (Olebogeng Peolwane c9a145e2-640f-4583-b1bb-10c8739f7402)
    const fac136Ref = doc(firestoreDb, 'registrations', 'c9a145e2-640f-4583-b1bb-10c8739f7402');
    const fac136Snap = await getDoc(fac136Ref);
    if (fac136Snap.exists()) {
        const curCount = fac136Snap.data().participants_count || 12;
        const curBooks = fac136Snap.data().books_distributed || 12;
        batch.update(fac136Ref, {
            participants_count: Math.max(0, curCount - 1),
            books_distributed: Math.max(0, curBooks - 1),
            updated_at: now
        });
    }

    console.log("Committing batch to Firestore...");
    await batch.commit();
    console.log("Successfully committed all merges and deletions to Firebase Firestore!");

    // Now push updates to Google Sheets Web App buffer
    console.log("Pushing synchronization updates to Google Sheets...");
    try {
        const bufferPayload = [
            // Soft-deleted records
            { uuid: '022a52bc-1e4a-4c28-890c-8db129f735c0', is_deleted: true, updated_at: now },
            { uuid: '9cc7a9b7-d0dd-4a00-b512-c0ab312f18d0', is_deleted: true, updated_at: now },
            { uuid: 'e4563835-83dd-47a3-af41-3f99ce3c4f5e', is_deleted: true, updated_at: now },
            { uuid: '1044a9a9-2110-4f31-85f3-f0f037382a0f', is_deleted: true, updated_at: now },
            { uuid: 'dd5437a1-2350-4e89-920a-82b244784bd3', is_deleted: true, updated_at: now },
            { uuid: '82f50370-d693-4dc6-8575-c768af57f6cc', is_deleted: true, updated_at: now },
            // Merged / surviving updated records
            {
                uuid: 'a0ecbaa3-b897-4875-8c4f-d47ed304d8ca',
                first_name: 'Ben',
                last_name: 'Moloi',
                attendance: [true, true, false, false, false, false, false, false, false, false, false, false],
                teaching_group: true,
                is_daily_core: true,
                books_distributed: 1,
                participants_count: 1,
                updated_at: now
            },
            {
                uuid: 'f57a8a01-9fcf-4321-b2ba-2f3473f603e7',
                first_name: 'Proud Mothusi',
                last_name: 'Mapotsane',
                attendance: [true, true, false, false, false, false, false, false, false, false, false, false],
                teaching_group: true,
                is_daily_core: true,
                books_distributed: 1,
                participants_count: 1,
                updated_at: now
            },
            {
                uuid: '193eacb5-8010-44c8-835e-9fd1a25045c7',
                participants_count: 11,
                books_distributed: 11,
                updated_at: now
            }
        ];

        const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'syncProfileBuffer',
                profileName: 'Samukeliso Mayabane',
                records: bufferPayload
            })
        });

        const resJson = await resp.json();
        console.log("Google Sheets sync response:", JSON.stringify(resJson));
    } catch (err) {
        console.warn("Sheets push warning (non-fatal):", err.message);
    }

    console.log("\nALL OPERATIONS COMPLETED SUCCESSFULLY.");
}

executeFixes().catch(console.error);
