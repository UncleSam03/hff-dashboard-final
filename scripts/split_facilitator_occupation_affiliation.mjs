process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { splitOccupationAndAffiliation } from '../src/lib/utils.js';

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);

async function getDocsWithRetry(maxAttempts = 6) {
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            console.log(`Fetching from Firestore (attempt ${i}/${maxAttempts})...`);
            const snap = await getDocs(collection(db, 'registrations'));
            if (snap.docs.length > 50) {
                console.log(`Successfully retrieved ${snap.docs.length} documents from Firestore.`);
                return snap;
            }
            console.log(`Received ${snap.docs.length} docs (waiting for online sync)...`);
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise((r) => setTimeout(r, 3500));
    }
    return await getDocs(collection(db, 'registrations'));
}

async function runMigration() {
    console.log('=== Fetching registrations from Cloud Firestore ===');
    const snap = await getDocsWithRetry(6);
    console.log(`Total documents fetched: ${snap.size}`);

    const updates = [];
    const reversedExamples = [];
    const splitExamples = [];
    const compoundKept = [];

    for (const d of snap.docs) {
        const data = d.data();
        if (data.is_deleted) continue;

        const rawOcc = String(data.occupation || '').trim();
        if (!rawOcc) continue;

        const split = splitOccupationAndAffiliation(rawOcc, data.affiliation || '', data.meeting_place || '');

        const occChanged = split.occupation !== rawOcc;
        const affChanged = split.affiliation !== String(data.affiliation || '').trim();
        const meetChanged = Boolean(split.meeting_place && split.meeting_place !== String(data.meeting_place || '').trim());

        if (split.wasSplit || occChanged || affChanged || meetChanged) {
            const payload = {
                occupation: split.occupation,
                affiliation: split.affiliation,
                updated_at: new Date().toISOString(),
            };
            if (split.wasSplit && !data.raw_occupation_before_split) {
                payload.raw_occupation_before_split = rawOcc;
            }
            if (split.meeting_place) {
                payload.meeting_place = split.meeting_place;
            }

            updates.push({
                docId: d.id,
                type: data.type || 'participant',
                name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                form_number: data.form_number || data.group_form_number || '',
                beforeOcc: rawOcc,
                beforeAff: data.affiliation || '',
                afterOcc: split.occupation,
                afterAff: split.affiliation,
                afterMeet: split.meeting_place || '',
                wasSplit: split.wasSplit,
                wasReversed: split.wasReversed,
                payload,
            });

            if (split.wasReversed) {
                reversedExamples.push(updates[updates.length - 1]);
            } else if (split.wasSplit) {
                splitExamples.push(updates[updates.length - 1]);
            }
        } else if (/[-–—]/.test(rawOcc)) {
            compoundKept.push({
                type: data.type,
                name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                occupation: rawOcc,
            });
        }
    }

    console.log(`\nFound ${updates.length} records to update in Firestore:`);
    console.log(`  - Standard "Occupation - Affiliation" splits: ${splitExamples.length}`);
    console.log(`  - Reversed "Affiliation - Occupation" normalized: ${reversedExamples.length}`);
    console.log(`  - Compound hyphenated occupations kept intact (e.g. Self-Employed): ${compoundKept.length}`);

    if (reversedExamples.length > 0) {
        console.log('\n--- Reversed "Affiliation - Occupation" Normalized ---');
        for (const r of reversedExamples) {
            console.log(`  [${r.type}] ${r.name} (Form #${r.form_number || 'N/A'}): "${r.beforeOcc}" -> Occupation: "${r.afterOcc}" | Affiliation: "${r.afterAff}"`);
        }
    }

    console.log('\n--- Sample Standard Splits (first 25) ---');
    for (const r of splitExamples.slice(0, 25)) {
        const meetNote = r.afterMeet ? ` | Meeting Place preserved: "${r.afterMeet}"` : '';
        console.log(`  [${r.type}] ${r.name} (Form #${r.form_number || 'N/A'}): "${r.beforeOcc}" -> Occupation: "${r.afterOcc}" | Affiliation: "${r.afterAff}"${meetNote}`);
    }

    // Commit in Firestore batches of 400
    const BATCH_SIZE = 400;
    let committed = 0;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const u of chunk) {
            batch.update(doc(db, 'registrations', u.docId), u.payload);
        }
        await batch.commit();
        committed += chunk.length;
        console.log(`Committed ${committed} / ${updates.length} updates to Cloud Firestore...`);
    }

    try {
        const cfgSnap = await getDoc(doc(db, 'system_config', 'hff_sheets_buffer_config'));
        if (cfgSnap.exists()) {
            const cfg = cfgSnap.data();
            console.log('\nShared Sheets Buffer Config found in Firestore:', {
                spreadsheetId: cfg.spreadsheetId,
                hasOAuth: Boolean(cfg.oauth?.refreshToken),
                webAppUrl: cfg.webAppUrl,
            });
        } else {
            console.log('\nNo system_config/hff_sheets_buffer_config doc found in Firestore.');
        }
    } catch (e) {
        console.warn('Could not read system_config:', e.message);
    }

    console.log('\n=== Firestore Migration Complete! ===');
    process.exit(0);
}

runMigration().catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
});
