import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);

async function check() {
    const snap = await getDocs(collection(db, 'registrations'));
    const all = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);
    console.log('Total active docs:', all.length);
    
    const targets = ['203', '175', '143', '60', '207', '163', '61'];
    for (const t of targets) {
        const facs = all.filter(d => d.type === 'facilitator' && (d.form_number === t || d.group_form_number === t));
        const parts = all.filter(d => d.type === 'participant' && (d.form_number === t || d.group_form_number === t));
        console.log(`Register ${t}: ${facs.length} facs, ${parts.length} parts`);
        facs.forEach(f => console.log(`  Fac: ${f.first_name} ${f.last_name} (${f.contact}) uuid=${f.uuid} place=${f.place}`));
        if (parts.length > 0) {
            console.log(`  Sample parts (${parts.length}): ${parts.slice(0, 5).map(p => p.first_name + ' ' + p.last_name + ' (' + p.contact + ')').join(', ')}`);
        }
    }

    const phones = ['76312544', '76431562', '74704731', '75854127', '71533031', '71479820'];
    console.log('\nChecking facilitators by phone:');
    for (const ph of phones) {
        const matches = all.filter(d => String(d.contact || '').includes(ph));
        matches.forEach(m => console.log(`  Match ${ph}: ${m.type} ${m.first_name} ${m.last_name} form=${m.form_number || m.group_form_number} uuid=${m.uuid}`));
    }
    process.exit(0);
}
check();
