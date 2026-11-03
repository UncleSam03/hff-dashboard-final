process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GOOGLE_SHEETS_WEBAPP_URL = process.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

async function main() {
    console.log("=== FIX REGISTER 34: INSERT KENEILWE JONG & VERIFY ===");
    
    // Warmup connection
    for (let i = 1; i <= 5; i++) {
        try {
            console.log(`Warmup Firestore connection attempt ${i}...`);
            const snap = await getDocs(collection(db, 'registrations'));
            if (snap.docs.length > 50) {
                console.log(`Connection ready (${snap.docs.length} docs).`);
                break;
            }
        } catch (e) {
            console.warn(`Warmup attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    const facUuid = 'a0640f37-1938-4b70-a180-ed91e97d6036';
    const now = new Date().toISOString();

    // 1. Keneilwe Jong record
    const jongDoc = {
        uuid: 'part-34-03-jong-74288614',
        campaign_id: 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22',
        type: 'participant',
        group_form_number: '34',
        group_id: facUuid,
        facilitator_uuid: facUuid,
        row_number: 3,
        first_name: 'Keneilwe',
        last_name: 'Jong',
        gender: 'F',
        age: 35,
        contact: '74288614',
        education_level: 'Senior',
        marital_status: 'Married',
        organisation: '',
        affiliation: '',
        occupation: 'Employed',
        place: 'Boseja',
        books_received: true,
        attendance: [false, false, true, true, true, false, false, false, false, false, false, false],
        created_by_name: 'Samukeliso Mayabane',
        created_by_email: 'samukeliso.mayabane@thehealthyfamilies.net',
        created_by_uid: 'E7bGBQslPsafBPovmFoYHiLqxQZ2',
        is_deleted: false,
        created_at: now,
        updated_at: now
    };

    console.log("Writing part-34-03-jong-74288614 to Firestore...");
    await setDoc(doc(db, 'registrations', jongDoc.uuid), jongDoc);

    console.log("Updating part-34-02-68d6c2 facilitator linking...");
    await updateDoc(doc(db, 'registrations', 'part-34-02-68d6c2'), {
        facilitator_uuid: facUuid,
        group_id: facUuid,
        updated_at: now
    });

    console.log("Updating facilitator Monicah Modise counts...");
    await updateDoc(doc(db, 'registrations', facUuid), {
        participants_count: 4,
        books_distributed: 4,
        updated_at: now
    });

    // Verify read-back from server
    console.log("Verifying read-back from Firestore...");
    for (let i = 1; i <= 5; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const check = await getDoc(doc(db, 'registrations', jongDoc.uuid));
        if (check.exists()) {
            console.log(`[✓] Confirmed in Firestore: ${check.id} -> ${check.data().first_name} ${check.data().last_name}`);
            break;
        }
    }

    // Push to Google Sheets Web App buffer
    console.log("Pushing to Google Sheets Web App...");
    try {
        const payload = {
            action: 'push_profile_buffer',
            tabName: 'PROFILE_Samukeliso_Mayabane',
            records: [jongDoc]
        };
        const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resJson = await resp.json();
        console.log("Google Sheets response:", JSON.stringify(resJson));
    } catch (e) {
        console.warn("Sheets push error:", e.message);
    }

    console.log("Done!");
    process.exit(0);
}

main().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
