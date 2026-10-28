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

async function checkFacs() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const facs = [];
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'facilitator' && !data.is_deleted) {
            facs.push({
                uuid: data.uuid || d.id,
                name: (data.first_name + ' ' + data.last_name).trim(),
                contact: data.contact || '',
                form: data.form_number || '',
                age: data.age || '',
                created_by: data.created_by_name || ''
            });
        }
    });

    console.log('Total active facilitators:', facs.length);
    const phoneMap = {};
    for (const f of facs) {
        const cleanP = f.contact.replace(/\D/g, '').slice(-8);
        if (cleanP.length >= 7) {
            if (!phoneMap[cleanP]) phoneMap[cleanP] = [];
            phoneMap[cleanP].push(f);
        }
    }

    const multiPhone = Object.entries(phoneMap).filter(([p, list]) => list.length > 1);
    console.log('Facilitators sharing phone number:', multiPhone.length);
    for (const [p, list] of multiPhone) {
        console.log(`\nPhone: ${p}`);
        list.forEach(f => console.log(`   - "${f.name}" | Form: ${f.form || 'None'} | Age: ${f.age || 'N/A'} | CreatedBy: ${f.created_by} | UUID: ${f.uuid}`));
    }
}
checkFacs();
