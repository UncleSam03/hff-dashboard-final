process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyDw5rLdG76c128jD5hH0u5qgGgGgGgGgG',
    authDomain: 'hff-impact-dashboard.firebaseapp.com',
    projectId: 'hff-impact-dashboard'
};
const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

async function verify() {
    console.log("==================================================================");
    console.log(" VERIFYING FIRESTORE DATA INTEGRITY POST 30-OCT HANDOVER");
    console.log("==================================================================\n");

    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

    const facilitators = allDocs.filter(d => d.type === 'facilitator' && !d.is_deleted);
    const participants = allDocs.filter(d => d.type === 'participant' && !d.is_deleted);

    console.log(`Total Active Records: ${allDocs.filter(d => !d.is_deleted).length}`);
    console.log(` - Facilitators: ${facilitators.length}`);
    console.log(` - Participants: ${participants.length}\n`);

    // 1. Verify Part A: Section 4 (22 brand new register groups)
    console.log("--- PART A: SECTION 4 (22 BRAND NEW REGISTER GROUPS) ---");
    const sec4Forms = [
        '80', '87', '103', '110', '114 A', '134', '137 A', '137 B', '138', '161',
        '164', '168', '200', '220 B', '223', '224', '227', '230', '231', '232', '238', '248'
    ];

    let totalSec4Parts = 0;
    sec4Forms.forEach(form => {
        const facs = facilitators.filter(f => String(f.form_number).trim().toUpperCase() === form.toUpperCase());
        const parts = participants.filter(p => String(p.group_form_number).trim().toUpperCase() === form.toUpperCase());
        const booksCount = parts.filter(p => p.books_received === true).length;
        const day4Att = parts.filter(p => p.attendance && p.attendance[3]).length;
        totalSec4Parts += parts.length;

        console.log(`Register ${form.padEnd(7)} | Fac: ${facs.length > 0 ? (facs[0].first_name + ' ' + facs[0].last_name).padEnd(25) : 'MISSING'.padEnd(25)} | Form: ${(facs[0]?.form_number || '').padEnd(6)} | Parts: ${String(parts.length).padStart(2)} | Books: ${String(booksCount).padStart(2)} | Day4 Att: ${day4Att}`);
    });
    console.log(`Total Section 4 Active Participants Imported: ${totalSec4Parts}\n`);

    // 2. Verify Part B: Section 3 (15 Updated Registers)
    console.log("--- PART B: SECTION 3 (15 UPDATED REGISTERS) ---");
    const sec3Forms = [
        { form: '61', expected: 11, label: 'Makakatlela Dam' },
        { form: '68', expected: 20, label: 'Marula A Ratsheole' },
        { form: '75', expected: 12, label: 'Makakatlela Ward' },
        { form: '98', expected: 22, label: 'Kgatleng Brigade' },
        { form: '101', expected: 14, label: 'Morwa Health Post' },
        { form: '104', expected: 14, label: 'BDF' },
        { form: '125', expected: 21, label: 'Linchwe II CJSS' },
        { form: '136', expected: 19, label: 'Boseja North' },
        { form: '153', expected: 11, label: 'Morwa' },
        { form: '175', expected: 23, label: 'Sedibelo CJSS' },
        { form: '179', expected: 12, label: 'Mochudi Clinic 1' },
        { form: '182', expected: 17, label: 'Phaphane Clinic' },
        { form: '185', expected: 17, label: 'Rampedi' },
        { form: '201', expected: 69, label: 'Mochudi State Prison' },
        { form: '220', expected: 11, label: 'Main Land Board' }
    ];

    sec3Forms.forEach(({ form, expected, label }) => {
        const parts = participants.filter(p => String(p.group_form_number).trim() === form);
        const day3Att = parts.filter(p => p.attendance && p.attendance[2]).length;
        const day4Att = parts.filter(p => p.attendance && p.attendance[3]).length;
        console.log(`Register ${form.padEnd(5)} (${label.padEnd(20)}) | Actual: ${String(parts.length).padStart(2)} (Target: ${expected}) | Day 3 (29 Oct): ${String(day3Att).padStart(2)} | Day 4 (30 Oct): ${String(day4Att).padStart(2)}`);
    });

    // Check Form 191 is 0
    const form191 = participants.filter(p => String(p.group_form_number).trim() === '191');
    console.log(`Register 191 (Former inmates, should be 0): ${form191.length} remaining\n`);

    // 3. Verify Part C: Section 2 (Attendance & Re-numbering Updates)
    console.log("--- PART C: SECTION 2 (RE-NUMBERED & ATTENDANCE ONLY) ---");
    const sec2Forms = [
        { form: '59', label: 'Babedi Moraope / Tigers F Club' },
        { form: '190', label: 'Segametsi Setshwane / At home (ex-189 P2)' },
        { form: '202', label: 'Katlego Nkatswang / Kgamanyane School' },
        { form: '222', label: 'Boineelo Ipotseng / Morwa Kgotla (ex-Unnumbered #3)' },
        { form: '225', label: 'Mmapula Rammala / Morema VDC (ex-[Unnumbered #C])' }
    ];

    sec2Forms.forEach(({ form, label }) => {
        const fac = facilitators.find(f => String(f.form_number).trim() === form);
        const parts = participants.filter(p => String(p.group_form_number).trim() === form);
        const day2Att = parts.filter(p => p.attendance && p.attendance[1]).length;
        const day3Att = parts.filter(p => p.attendance && p.attendance[2]).length;
        const day4Att = parts.filter(p => p.attendance && p.attendance[3]).length;
        console.log(`Register ${form.padEnd(5)} | Fac: ${(fac ? fac.first_name + ' ' + fac.last_name : 'NONE').padEnd(25)} | Total: ${String(parts.length).padStart(2)} | Day 2: ${day2Att} | Day 3: ${day3Att} | Day 4: ${day4Att}`);
    });

    // Verify Katso Tshukudu
    const katso = participants.find(p => p.group_form_number === '202' && p.first_name.toLowerCase().includes('katso'));
    console.log(`Register 202 Row 20 Verification: Name is '${katso?.first_name} ${katso?.last_name}', Contact: '${katso?.contact}', Attendance: [${katso?.attendance?.slice(0, 4).join(', ')}]`);

    // 4. Verify Books & Facilitator Aggregations
    console.log("\n--- PART E: BOOKS RECEIVED & FACILITATOR AGGREGATIONS ---");
    const partsWithoutBooks = participants.filter(p => !p.books_received);
    console.log(`Active Participants with books_received = false: ${partsWithoutBooks.length}`);

    // Check facilitator aggregations for Section 4 + Section 3 + Section 2
    const allCheckedForms = [...sec4Forms, '61', '68', '75', '98', '101', '104', '125', '136', '153', '175', '179', '182', '185', '201', '220', '59', '190', '202', '222', '225'];
    let mismatchCount = 0;
    allCheckedForms.forEach(form => {
        const fac = facilitators.find(f => String(f.form_number).trim().toUpperCase() === form.toUpperCase());
        const parts = participants.filter(p => String(p.group_form_number).trim().toUpperCase() === form.toUpperCase());
        if (fac) {
            const facParts = fac.participants_count || 0;
            const facBooks = fac.books_distributed || 0;
            if (facParts !== parts.length || facBooks !== parts.length) {
                console.warn(`Mismatch on Form ${form}: Fac has parts=${facParts}, books=${facBooks}, but actual parts=${parts.length}`);
                mismatchCount++;
            }
        }
    });
    console.log(`Facilitator Aggregation Mismatches across all verified registers: ${mismatchCount}`);

    console.log("\n==================================================================");
    console.log(" VERIFICATION COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
}

verify().catch(err => {
    console.error("Verification error:", err);
    process.exit(1);
});
