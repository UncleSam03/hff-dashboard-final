import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
const db = getFirestore(app);

async function inspectTargetRecords() {
    const targetUuids = [
        // Cluster 1
        '193eacb5-8010-44c8-835e-9fd1a25045c7', // Tebogo Esther Modisagae (Facilitator)
        '022a52bc-1e4a-4c28-890c-8db129f735c0', // Tebogo Modisagae (Participant)
        // Cluster 2
        '4bb15bdc-20c0-4fd6-9b52-8d2568ce2f85', // Kefilwe Shaimus Koitsiwe
        '9cc7a9b7-d0dd-4a00-b512-c0ab312f18d0', // Kefilwe Koitsiwe
        // Cluster 3
        '80303b8f-2132-45c0-965b-f4717692c526', // Serufe Masilo (Form 63)
        'e4563835-83dd-47a3-af41-3f99ce3c4f5e', // Serufe Masilo (Form 132)
        // Cluster 4
        '1044a9a9-2110-4f31-85f3-f0f037382a0f', // Rrapula moloi
        'a0ecbaa3-b897-4875-8c4f-d47ed304d8ca', // Ben Moloi
        // Cluster 5
        'dd5437a1-2350-4e89-920a-82b244784bd3', // Mothusi Mapotsane
        'f57a8a01-9fcf-4321-b2ba-2f3473f603e7', // Proud M Mapotsane
        // Cluster 6
        '6ad71cd4-153b-4d68-b061-5c32f4c48e9d', // Onkarabile Nnuku Makole (Facilitator)
        '82f50370-d693-4dc6-8575-c768af57f6cc', // Onkabile Nkwane (Participant, Form 136)
    ];

    console.log("Fetching target records...");
    const snap = await getDocs(collection(db, 'registrations'));
    const all = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

    console.log("\n=== INSPECTION OF TARGET RECORDS ===");
    for (const uuid of targetUuids) {
        const r = all.find(x => (x.uuid || x.docId) === uuid);
        if (r) {
            console.log(`\nUUID: ${uuid} | Type: ${r.type}`);
            console.log(`  Name: "${r.first_name}" "${r.last_name}"`);
            console.log(`  Contact: "${r.contact}" | Age: ${r.age} | Form: "${r.form_number || r.group_form_number}"`);
            console.log(`  Facilitator UUID: "${r.facilitator_uuid}"`);
            console.log(`  TeachingGroup: ${r.teaching_group} | BooksDist: ${r.books_distributed} | PartCount: ${r.participants_count}`);
            console.log(`  Created: ${r.created_at} | CreatedBy: ${r.created_by_name}`);
            console.log(`  Attendance:`, JSON.stringify(r.attendance));
        } else {
            console.log(`\nUUID: ${uuid} NOT FOUND`);
        }
    }

    // Look up facilitators for Form 63, Form 132, Form 136
    console.log("\n=== FACILITATOR LOOKUPS ===");
    
    // Form 63
    const fac63 = all.filter(x => x.type === 'facilitator' && !x.is_deleted && (x.form_number === '63' || x.contact?.includes('76193699')));
    console.log("\nFacilitator(s) for Form 63:");
    fac63.forEach(f => console.log(`  - "${f.first_name} ${f.last_name}" | Phone: ${f.contact} | Form: ${f.form_number} | UUID: ${f.uuid}`));

    // Form 132
    const fac132 = all.filter(x => x.type === 'facilitator' && !x.is_deleted && x.form_number === '132');
    console.log("\nFacilitator(s) for Form 132 (Register 132):");
    fac132.forEach(f => console.log(`  - "${f.first_name} ${f.last_name}" | Phone: ${f.contact} | Form: ${f.form_number} | Place: ${f.place} | UUID: ${f.uuid}`));

    // Also find participants on 132 to see their facilitator_uuid
    const parts132 = all.filter(x => x.type === 'participant' && !x.is_deleted && x.group_form_number === '132');
    if (parts132.length > 0) {
        console.log(`  Sample participant on 132 links to facilitator_uuid: ${parts132[0].facilitator_uuid}`);
        const linkedFac = all.find(x => x.uuid === parts132[0].facilitator_uuid);
        if (linkedFac) {
            console.log(`  Linked Facilitator: "${linkedFac.first_name} ${linkedFac.last_name}" | Phone: ${linkedFac.contact} | UUID: ${linkedFac.uuid}`);
        }
    }

    // Form 136 (for Cluster 6 Record B)
    const recB_136 = all.find(x => (x.uuid || x.docId) === '82f50370-d693-4dc6-8575-c768af57f6cc');
    console.log("\nFacilitator for Record B on Form 136:");
    if (recB_136) {
        console.log(`  Record B facilitator_uuid: ${recB_136.facilitator_uuid}`);
        const fac136 = all.find(x => x.uuid === recB_136.facilitator_uuid);
        if (fac136) {
            console.log(`  Facilitator Name: "${fac136.first_name} ${fac136.last_name}" | Phone: ${fac136.contact} | Form: ${fac136.form_number} | UUID: ${fac136.uuid}`);
        } else {
            const fac136ByForm = all.filter(x => x.type === 'facilitator' && !x.is_deleted && x.form_number === '136');
            console.log(`  Facilitator by Form 136:`, fac136ByForm.map(f => `${f.first_name} ${f.last_name} (${f.contact})`));
        }
    }
}

inspectTargetRecords().catch(console.error);
