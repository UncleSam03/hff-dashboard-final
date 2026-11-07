import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function findCat3Blanks() {
    const auditData = JSON.parse(fs.readFileSync('scripts/group_audit_enriched.json', 'utf8'));
    const cat3Forms = new Set(auditData.filter(g => g.category === 3).map(g => g.formNumber.toUpperCase()));

    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    const cat3Participants = docs.filter(d => {
        const fn = (d.group_form_number || d.form_number || '').trim().toUpperCase();
        return cat3Forms.has(fn) && (d.type || '').toLowerCase() !== 'facilitator';
    });

    const blankMarital = cat3Participants.filter(p => !p.marital_status || p.marital_status.trim() === '' || p.marital_status === '-' || p.marital_status === '—');
    const blankEducation = cat3Participants.filter(p => !p.education || p.education.trim() === '' || p.education === '-' || p.education === '—');
    const shorthandGender = cat3Participants.filter(p => p.gender === 'M' || p.gender === 'F');

    console.log(`Cat 3 Total Participants: ${cat3Participants.length}`);
    console.log(`Blank Marital Status: ${blankMarital.length}`);
    console.log(`Blank Education: ${blankEducation.length}`);
    console.log(`Shorthand Gender (M/F): ${shorthandGender.length}`);

    // Group blank counts by formNumber
    const formStats = {};
    for (const p of cat3Participants) {
        const fn = (p.group_form_number || p.form_number || '').trim().toUpperCase();
        if (!formStats[fn]) {
            formStats[fn] = { total: 0, blankMarital: 0, blankEdu: 0, rawMarital: 0, rawEdu: 0, rawGender: 0 };
        }
        formStats[fn].total++;
        if (!p.marital_status || p.marital_status.trim() === '') formStats[fn].blankMarital++;
        else if (['S', 'M', 'D', 'W', 'C', 'F'].includes(p.marital_status.trim().toUpperCase())) formStats[fn].rawMarital++;

        if (!p.education || p.education.trim() === '') formStats[fn].blankEdu++;
        else if (['J', 'S', 'U', 'T', 'P'].includes(p.education.trim().toUpperCase())) formStats[fn].rawEdu++;

        if (p.gender === 'M' || p.gender === 'F') formStats[fn].rawGender++;
    }

    fs.writeFileSync('scripts/cat3_blanks_stats.json', JSON.stringify({
        summary: {
            totalParticipants: cat3Participants.length,
            blankMarital: blankMarital.length,
            blankEducation: blankEducation.length,
            shorthandGender: shorthandGender.length
        },
        formStats,
        blankMaritalRecords: blankMarital.map(p => ({
            docId: p.docId,
            uuid: p.uuid,
            form: p.group_form_number || p.form_number,
            name: `${p.first_name} ${p.last_name}`,
            contact: p.contact,
            education: p.education
        })),
        blankEduRecords: blankEducation.map(p => ({
            docId: p.docId,
            uuid: p.uuid,
            form: p.group_form_number || p.form_number,
            name: `${p.first_name} ${p.last_name}`,
            contact: p.contact,
            marital: p.marital_status
        }))
    }, null, 2));

    console.log("Saved detailed blank stats to scripts/cat3_blanks_stats.json");
    process.exit(0);
}

findCat3Blanks().catch(err => {
    console.error(err);
    process.exit(1);
});
