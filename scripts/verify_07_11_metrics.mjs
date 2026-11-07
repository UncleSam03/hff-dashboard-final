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

async function verify() {
    const snap = await getDocs(collection(db, 'registrations'));
    const all = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);
    console.log(`Total active records in Firestore: ${all.length}`);

    const targetRegisters = ['203', '175', '143', '60', '207', '163', '155'];

    for (const regNum of targetRegisters) {
        console.log(`\n==================================================`);
        console.log(`REGISTER ${regNum}:`);
        console.log(`==================================================`);

        const facs = all.filter(d => d.type === 'facilitator' && (d.form_number === regNum || d.group_form_number === regNum));
        const parts = all.filter(d => d.type === 'participant' && (d.form_number === regNum || d.group_form_number === regNum));

        console.log(`Facilitator count: ${facs.length}`);
        facs.forEach(f => {
            console.log(`  Facilitator: ${f.first_name} ${f.last_name} | Contact: ${f.contact} | Place: ${f.place} | UUID: ${f.uuid}`);
        });

        console.log(`Participant count: ${parts.length}`);

        // Attendance stats
        let totalDaysSum = 0;
        let attendedParticipants = 0;
        parts.forEach(p => {
            const att = Array.isArray(p.attendance) ? p.attendance : [];
            const daysAttended = att.filter(Boolean).length;
            totalDaysSum += daysAttended;
            if (daysAttended > 0) attendedParticipants++;
        });

        const avgDays = parts.length > 0 ? (totalDaysSum / parts.length).toFixed(2) : 0;
        console.log(`Total participant days attended sum: ${totalDaysSum}`);
        console.log(`Average days attended per participant: ${avgDays}`);

        parts.forEach((p, idx) => {
            const att = Array.isArray(p.attendance) ? p.attendance : [];
            const daysAttended = att.filter(Boolean).length;
            const marksStr = att.slice(0, 9).map(v => v ? '1' : '0').join('');
            console.log(`  [${idx + 1}] ${p.first_name} ${p.last_name} | Age: ${p.age} | Contact: ${p.contact} | Occ: ${p.occupation} | Aff: ${p.affiliation} | Days: ${daysAttended} (D1-D9: ${marksStr})`);
        });
    }

    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
