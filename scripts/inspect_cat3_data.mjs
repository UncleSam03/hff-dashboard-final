import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Avoid TLS reject
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

async function inspectCat3() {
    const auditData = JSON.parse(fs.readFileSync('scripts/group_audit_enriched.json', 'utf8'));
    const cat3Forms = new Set(auditData.filter(g => g.category === 3).map(g => g.formNumber.toUpperCase()));

    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    const cat3Participants = docs.filter(d => {
        const fn = (d.group_form_number || d.form_number || '').trim().toUpperCase();
        return cat3Forms.has(fn) && (d.type || '').toLowerCase() !== 'facilitator';
    });

    console.log(`Found ${cat3Participants.length} participants across the 55 Category 3 groups.`);

    const maritalCounts = {};
    const eduCounts = {};
    const genderCounts = {};

    cat3Participants.forEach(p => {
        const m = String(p.marital_status || '').trim();
        maritalCounts[m] = (maritalCounts[m] || 0) + 1;

        const e = String(p.education || '').trim();
        eduCounts[e] = (eduCounts[e] || 0) + 1;

        const g = String(p.gender || '').trim();
        genderCounts[g] = (genderCounts[g] || 0) + 1;
    });

    console.log('\n--- Marital Status Values ---');
    console.log(maritalCounts);

    console.log('\n--- Education Values ---');
    console.log(eduCounts);

    console.log('\n--- Gender Values ---');
    console.log(genderCounts);
}

inspectCat3().catch(console.error);
