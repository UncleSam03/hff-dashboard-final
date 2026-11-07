import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
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

async function executeFixes() {
    console.log("Loading planned updates from scripts/cat3_planned_updates.json...");
    const planned = JSON.parse(fs.readFileSync('scripts/cat3_planned_updates.json', 'utf8'));
    const updates = planned.allUpdates;

    console.log(`Ready to commit fixes for ${updates.length} participant records in Firestore.`);

    const BATCH_SIZE = 350;
    let committedCount = 0;
    const nowIso = new Date().toISOString();

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);

        for (const item of chunk) {
            const docRef = doc(firestoreDb, 'registrations', item.docId);
            const updateFields = {
                updated_at: nowIso,
                audit_cleaned: true
            };

            for (const [field, change] of Object.entries(item.changes)) {
                updateFields[field] = change.to;
            }

            batch.update(docRef, updateFields);
        }

        await batch.commit();
        committedCount += chunk.length;
        console.log(`Committed batch: ${committedCount} / ${updates.length} records updated.`);
    }

    console.log(`\nSUCCESS: Successfully committed all ${committedCount} Category 3 participant fixes to Firestore.`);
    process.exit(0);
}

executeFixes().catch(err => {
    console.error("Error executing fixes:", err);
    process.exit(1);
});
