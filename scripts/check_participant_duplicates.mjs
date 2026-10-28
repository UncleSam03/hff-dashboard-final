import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

function cleanStr(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
}

function extractPhones(raw) {
    if (!raw) return [];
    const str = String(raw);
    const parts = str.split(/[/,;&\s+]+/);
    const res = [];
    for (const p of parts) {
        let d = p.replace(/\D/g, '');
        if (d.length === 11 && d.startsWith('267')) d = d.slice(3);
        if (d.length >= 7 && d.length <= 8) res.push(d);
    }
    return res;
}

async function checkParticipants() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const parts = [];
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'participant' && !data.is_deleted) {
            parts.push({
                uuid: data.uuid || d.id,
                name: (data.first_name + ' ' + data.last_name).trim(),
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                contact: data.contact || '',
                phones: extractPhones(data.contact),
                form: data.group_form_number || data.form_number || '',
                age: data.age ? parseInt(data.age, 10) : null,
                gender: data.gender || '',
                place: data.place || '',
                created_by: data.created_by_name || ''
            });
        }
    });

    console.log(`Total active participants: ${parts.length}`);

    // Check by exact name match
    const nameMap = {};
    for (const p of parts) {
        const key = cleanStr(p.name);
        if (key.length > 3) {
            if (!nameMap[key]) nameMap[key] = [];
            nameMap[key].push(p);
        }
    }

    const multiNames = Object.entries(nameMap).filter(([k, list]) => list.length > 1);
    console.log(`Exact Name Matches across participants: ${multiNames.length}`);
    multiNames.forEach(([name, list]) => {
        console.log(`\nExact Name: "${name}" (${list.length} records):`);
        list.forEach(p => {
            console.log(`   - Form: ${p.form} | Age: ${p.age} | Phone: ${p.contact} | Place: ${p.place} | UUID: ${p.uuid}`);
        });
    });

    // Check by Phone number (excluding prison 5777251)
    const phoneMap = {};
    for (const p of parts) {
        for (const ph of p.phones) {
            if (ph === '5777251') continue; // Prison landline shared by all inmates
            if (!phoneMap[ph]) phoneMap[ph] = [];
            phoneMap[ph].push(p);
        }
    }

    const multiPhones = Object.entries(phoneMap).filter(([ph, list]) => list.length > 1);
    console.log(`\nShared Mobile Phones across participants (excluding prison): ${multiPhones.length}`);
    multiPhones.forEach(([ph, list]) => {
        console.log(`\nPhone: ${ph} (${list.length} records):`);
        list.forEach(p => {
            console.log(`   - "${p.name}" | Form: ${p.form} | Age: ${p.age} | Place: ${p.place} | UUID: ${p.uuid}`);
        });
    });
}

checkParticipants();
