import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function inspectThree() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    for (const fNum of ['59', '123', '182']) {
        console.log(`\n================ Form ${fNum} ================`);
        const parts = allDocs.filter(d => {
            const raw = (d.group_form_number || d.form_number || '').trim().toUpperCase();
            return raw === fNum && (d.type || '').toLowerCase() !== 'facilitator';
        });
        console.log(`Participants count: ${parts.length}`);
        parts.forEach((p, idx) => {
            console.log(`  [${idx+1}] ${p.first_name} ${p.last_name} | Gen: '${p.gender}' | Mar: '${p.marital_status}' | Edu: '${p.education}' | Ph: '${p.contact}' | Aff: '${p.affiliation}'`);
        });
    }

    process.exit(0);
}

inspectThree().catch(console.error);
