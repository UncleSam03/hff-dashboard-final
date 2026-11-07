import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

async function checkFacLinking() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    const facilitators = allDocs.filter(d => (d.type || '').toLowerCase() === 'facilitator');
    const participants = allDocs.filter(d => (d.type || '').toLowerCase() !== 'facilitator');

    const facUuidToForm = new Map();
    for (const f of facilitators) {
        const fn = (f.form_number || '').trim().toUpperCase();
        if (fn && f.uuid) {
            facUuidToForm.set(f.uuid, fn);
        }
    }

    let directFormCount = 0;
    let uuidLinkedCount = 0;
    let unlinkedCount = 0;

    for (const p of participants) {
        const rawForm = (p.group_form_number || p.form_number || '').trim().toUpperCase();
        if (rawForm) {
            directFormCount++;
        } else if (p.facilitator_uuid && facUuidToForm.has(p.facilitator_uuid)) {
            uuidLinkedCount++;
        } else {
            unlinkedCount++;
        }
    }

    console.log(`Direct form_number participants: ${directFormCount}`);
    console.log(`UUID-linked participants (missing group_form_number): ${uuidLinkedCount}`);
    console.log(`Unlinked participants: ${unlinkedCount}`);

    process.exit(0);
}

checkFacLinking().catch(err => {
    console.error(err);
    process.exit(1);
});
