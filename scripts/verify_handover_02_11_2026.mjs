process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
};
const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

async function getDocsWithRetry(maxAttempts = 5) {
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            console.log(`Connecting to Firestore (attempt ${i}/${maxAttempts})...`);
            const snap = await getDocs(collection(firestoreDb, 'registrations'));
            if (snap.docs.length > 50) {
                console.log(`Successfully retrieved ${snap.docs.length} documents from Firestore.`);
                return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
            }
            console.log(`Received ${snap.docs.length} docs (waiting for online sync)...`);
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3500));
    }
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

async function verify() {
    console.log("==================================================================");
    console.log(" VERIFYING FIRESTORE & DATA INTEGRITY POST 02-NOV HANDOVER");
    console.log("==================================================================\n");

    let allDocs = [];
    try {
        allDocs = await getDocsWithRetry(5);
    } catch (err) {
        console.error("Firestore query error:", err.message);
        return;
    }

    const facilitators = allDocs.filter(d => d.type === 'facilitator' && !d.is_deleted);
    const participants = allDocs.filter(d => d.type === 'participant' && !d.is_deleted);

    console.log(`Total Active Records: ${allDocs.filter(d => !d.is_deleted).length}`);
    console.log(` - Facilitators: ${facilitators.length}`);
    console.log(` - Participants: ${participants.length}\n`);

    // 1. Verify Category A: 5 Brand-New Numbered Registers
    console.log("--- CATEGORY A: 5 BRAND-NEW NUMBERED REGISTERS ---");
    const catAForms = [
        { form: '2', expected: 22, facName: 'Ikakanyeng Letuba', venue: 'Glen Valley Camp 112 P' },
        { form: '97', expected: 12, facName: 'Lindah Mokalane', venue: 'Farm Car Wash, Tuck Shop' },
        { form: '133', expected: 22, facName: 'Makuku Moagi', venue: 'Supplies Kgatleng DC' },
        { form: '140', expected: 7, facName: 'Nelly Kaosimatae', venue: 'Library' },
        { form: '247', expected: 3, facName: 'Boome Ellen Ntswetswe', venue: 'Blank' }
    ];

    let totalCatAParts = 0;
    catAForms.forEach(({ form, expected, facName, venue }) => {
        const facs = facilitators.filter(f => String(f.form_number).trim().toUpperCase() === form.toUpperCase());
        const parts = participants.filter(p => String(p.group_form_number).trim().toUpperCase() === form.toUpperCase());
        const booksCount = parts.filter(p => p.books_received === true).length;
        totalCatAParts += parts.length;

        const facStatus = facs.length > 0 ? `${facs[0].first_name} ${facs[0].last_name}` : 'MISSING';
        const ok = parts.length === expected ? '✓' : `✗ (expected ${expected})`;
        console.log(`[${ok}] Register ${form.padEnd(6)} | Fac: ${facStatus.padEnd(25)} | Parts: ${String(parts.length).padStart(2)} | Books: ${String(booksCount).padStart(2)} | Venue: ${venue}`);
    });
    console.log(`Total Category A Active Participants: ${totalCatAParts} (Expected: 66)\n`);

    // 2. Verify Category B: 5 Existing Registers Updated
    console.log("--- CATEGORY B: 5 EXISTING REGISTERS UPDATED ---");
    const catBForms = [
        { form: '34', expected: 4, label: 'Boseja (+2 rows Jong & Thebe, att to 2 Nov)' },
        { form: '106', expected: 18, label: 'Boseja Behind IPCC (+6 rows on P2)' },
        { form: '123', expected: 16, label: 'Boseja Central Kgotla (Att update to 2 Nov)' },
        { form: '157', expected: 3, label: 'Boseja (Att 29 Oct added)' },
        { form: '221', expected: 12, label: 'Kgatleng Land Board (+1 row Speedwell Bobe)' }
    ];

    catBForms.forEach(({ form, expected, label }) => {
        const parts = participants.filter(p => String(p.group_form_number).trim() === form);

        const day5Att = parts.filter(p => p.attendance && p.attendance[4]).length;
        const ok = parts.length === expected ? '✓' : `✗ (expected ${expected})`;
        console.log(`[${ok}] Register ${form.padEnd(5)} | Parts: ${String(parts.length).padStart(2)} (Target: ${expected}) | Day 5 (2 Nov) Att: ${String(day5Att).padStart(2)} | ${label}`);
    });

    // 3. Verify Category C: Unnumbered Registers Applying 'Register Firstname_Lastname'
    console.log("\n--- CATEGORY C: UNNUMBERED REGISTERS RENAMED & INGESTED ---");
    const unnumberedChecks = [
        { form: 'Register Lesego_Moutswi', expected: 36, fac: 'Lesego Moutswi', venue: 'Malotwane' },
        { form: 'Register Masego_Mokgadi', expected: 12, fac: 'Masego G. Mokgadi', venue: 'Morema' },
        { form: 'Register Mmamothobi_Lesotho', expected: 22, fac: 'Mmamothobi Lesotho', venue: 'Mochudi Old Mall Near Spar' },
        { form: 'Register Kerunne_Kgwatalala', expected: 12, fac: 'Kerunne Kgwatalala', venue: 'Regional Education Office' },
        { form: 'Register Aaron_Sefako', expected: 6, fac: 'Aaron T. Sefako', venue: 'Regional Education Office' },
        { form: 'Register Segale_Mokotedi', expected: 16, fac: 'Segale Windy Mokotedi', venue: 'Boseja South' }
    ];

    unnumberedChecks.forEach(({ form, expected, fac, venue }) => {
        const facs = facilitators.filter(f => String(f.form_number).trim().toLowerCase() === form.toLowerCase());
        const parts = participants.filter(p => String(p.group_form_number).trim().toLowerCase() === form.toLowerCase());
        const ok = parts.length === expected ? '✓' : `✗ (expected ${expected})`;
        console.log(`[${ok}] ${form.padEnd(30)} | Parts: ${String(parts.length).padStart(2)} (Target: ${expected}) | Fac: ${fac} | Venue: ${venue}`);
    });

    // Verify deprecated unnumbered tags are 0
    console.log("\n--- CHECKING DEPRECATED UNNUMBERED LABELS (SHOULD BE 0) ---");
    const oldTags = ['Unnumbered Group #2', '[Unnumbered New #D]', '[Unnumbered New #E]', '[Unnumbered New #F]', '[Unnumbered New #A]', 'Christ Temple of Worship'];
    oldTags.forEach(tag => {
        const found = participants.filter(p => String(p.group_form_number).trim() === tag);
        console.log(` • Old label '${tag}': ${found.length} remaining (Target: 0)`);
    });

    console.log("\n==================================================================");
    console.log(" VERIFICATION COMPLETED");
    console.log("==================================================================");
    process.exit(0);
}

verify().catch(console.error);
