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

function clean(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function checkSamukelisoFacs() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allFacs = [];

    snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'facilitator' && !data.is_deleted) {
            allFacs.push({
                uuid: data.uuid || d.id,
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                full_name: (data.first_name + ' ' + data.last_name).trim(),
                contact: data.contact || '',
                phone8: (data.contact || '').replace(/\D/g, '').slice(-8),
                form_number: data.form_number || '',
                place: data.place || '',
                age: data.age || '',
                created_by_name: data.created_by_name || '',
                created_at: data.created_at || '',
                participants_count: data.participants_count || 0
            });
        }
    });

    console.log(`Total active facilitators in DB: ${allFacs.length}`);

    // Check facilitators with a form_number (active group leaders)
    const leadersWithForm = allFacs.filter(f => f.form_number && f.form_number !== 'N/A' && f.form_number !== '');
    console.log(`Facilitators with assigned form_number: ${leadersWithForm.length}`);

    // Check if any facilitator with a form_number matches ANOTHER facilitator without a form_number or with a different form_number
    console.log("\n--- Checking for Duplicate Facilitators across the entire 386 facilitators ---");
    const foundDupes = [];

    for (let i = 0; i < allFacs.length; i++) {
        const a = allFacs[i];
        for (let j = i + 1; j < allFacs.length; j++) {
            const b = allFacs[j];
            const samePhone = a.phone8 && b.phone8 && a.phone8.length >= 7 && a.phone8 === b.phone8;
            const cleanA = clean(a.full_name);
            const cleanB = clean(b.full_name);
            const wordsA = cleanA.split(' ');
            const wordsB = cleanB.split(' ');
            const commonWords = wordsA.filter(w => wordsB.includes(w) && w.length > 2);
            const sameSurname = wordsA[wordsA.length - 1] === wordsB[wordsB.length - 1] && wordsA[wordsA.length - 1].length > 2;

            let isDupe = false;
            let note = '';

            if (samePhone) {
                isDupe = true;
                note = `Identical Phone (${a.phone8})`;
            } else if (sameSurname && commonWords.length >= 2) {
                isDupe = true;
                note = `Same Surname (${wordsA[wordsA.length - 1]}) + First/Middle name match (${commonWords.join(', ')})`;
            } else if (cleanA === cleanB && cleanA.length > 4) {
                isDupe = true;
                note = `Identical Name ("${cleanA}")`;
            }

            if (isDupe) {
                foundDupes.push({ a, b, note });
            }
        }
    }

    console.log(`Total Facilitator duplicate pairs found: ${foundDupes.length}`);
    foundDupes.forEach((d, idx) => {
        console.log(`\n[Pair #${idx + 1}] ${d.note}:`);
        console.log(`  1: "${d.a.full_name}" | Phone: "${d.a.contact}" | Age: ${d.a.age} | Form: ${d.a.form_number || '-'} | CreatedBy: ${d.a.created_by_name} | UUID: ${d.a.uuid}`);
        console.log(`  2: "${d.b.full_name}" | Phone: "${d.b.contact}" | Age: ${d.b.age} | Form: ${d.b.form_number || '-'} | CreatedBy: ${d.b.created_by_name} | UUID: ${d.b.uuid}`);
    });
}

checkSamukelisoFacs().catch(console.error);
