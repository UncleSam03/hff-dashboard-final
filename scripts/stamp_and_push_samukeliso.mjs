import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import 'fake-indexeddb/auto';
import db from '../src/lib/dexieDb.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22';
const GOOGLE_SHEETS_WEBAPP_URL = process.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

const SAMUKELISO = {
    uid: 'E7bGBQslPsafBPovmFoYHiLqxQZ2',
    name: 'Samukeliso Mayabane',
    email: 'samukeliso.mayabane@thehealthyfamilies.net',
    role: 'master_admin'
};

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
});
const firestoreDb = getFirestore(app);

function sanitizeForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => item === undefined ? null : sanitizeForFirestore(item));
    }
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            clean[key] = (typeof value === 'object' && value !== null) ? sanitizeForFirestore(value) : value;
        }
    }
    return clean;
}

async function run() {
    console.log('Fetching registrations from Firestore...');
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const all = [];
    snap.forEach(d => all.push({ id: d.id, ...d.data() }));

    const now = new Date().toISOString();

    // Find all records from Registers 51-201
    const recordsToUpdate = [];
    for (const r of all) {
        if (r.campaign_id !== CAMPAIGN_ID && r.campaign_id) continue;

        let inRange = false;
        if (r.type === 'participant') {
            const gNum = parseInt(String(r.group_form_number || r.form_number).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(gNum) && gNum >= 51 && gNum <= 201) inRange = true;
        } else if (r.type === 'facilitator') {
            const fNums = String(r.form_number || '').split(',').map(s => parseInt(s.replace(/[^0-9]/g, ''), 10));
            if (fNums.some(n => !isNaN(n) && n >= 51 && n <= 201)) inRange = true;
        }

        if (inRange) {
            recordsToUpdate.push({
                ...r,
                created_by_uid: SAMUKELISO.uid,
                created_by_name: SAMUKELISO.name,
                created_by_email: SAMUKELISO.email,
                created_by_role: SAMUKELISO.role,
                updated_by_uid: SAMUKELISO.uid,
                updated_by_name: SAMUKELISO.name,
                updated_by_email: SAMUKELISO.email,
                updated_at: now
            });
        }
    }

    console.log(`Found ${recordsToUpdate.length} records in Registers 51-201 range to stamp under Samukeliso Mayabane.`);

    // 1. Commit to Firestore
    console.log('Updating Firestore...');
    const BATCH_SIZE = 400;
    for (let i = 0; i < recordsToUpdate.length; i += BATCH_SIZE) {
        const slice = recordsToUpdate.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const rec of slice) {
            const docRef = doc(firestoreDb, 'registrations', rec.uuid || rec.id);
            batch.set(docRef, sanitizeForFirestore(rec), { merge: true });
        }
        await batch.commit();
        console.log(` - Updated batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, recordsToUpdate.length)} / ${recordsToUpdate.length})`);
    }

    // 2. Commit to Dexie
    console.log('Updating Dexie...');
    await db.open();
    await db.transaction('rw', db.registrations, async () => {
        for (const rec of recordsToUpdate) {
            const local = await db.registrations.where('uuid').equals(rec.uuid || rec.id).first();
            if (local) {
                await db.registrations.update(local.id, rec);
            } else {
                await db.registrations.add(rec);
            }
        }
    });
    console.log('Dexie updated successfully.');

    // 3. Push to Google Sheets Buffer: PROFILE_Samukeliso_Mayabane
    console.log('Pushing to Google Sheets tab PROFILE_Samukeliso_Mayabane...');
    const bufferPayload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Samukeliso_Mayabane',
        records: recordsToUpdate,
        replaceTab: false, // merge with any prior records on Samukeliso's profile tab
        autoReconcile: true
    };

    const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bufferPayload)
    });

    if (resp.ok) {
        const res = await resp.json();
        console.log('Google Sheets Web App response:', JSON.stringify(res, null, 2));
    } else {
        console.warn('Google Sheets Web App error:', await resp.text());
    }

    console.log('\nAll 51-201 register records have been stamped under Samukeliso Mayabane and synced to Cloud & Sheets!');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
