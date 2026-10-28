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

function tokenize(name) {
    return cleanStr(name).split(' ').filter(t => t.length > 1);
}

async function deepFacilitatorScan() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const facs = [];
    const parts = [];

    snap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.is_deleted) return;
        const rec = {
            id: docSnap.id,
            uuid: d.uuid || docSnap.id,
            first_name: d.first_name || '',
            last_name: d.last_name || '',
            full_name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
            contact: d.contact || '',
            phones: extractPhones(d.contact),
            age: d.age || null,
            gender: d.gender || '',
            type: d.type || 'participant',
            form_number: d.form_number || '',
            group_form_number: d.group_form_number || '',
            place: d.place || '',
            teaching_group: d.teaching_group || false,
            participants_count: d.participants_count || 0,
            books_distributed: d.books_distributed || 0,
            facilitator_uuid: d.facilitator_uuid || '',
            created_at: d.created_at || '',
            updated_at: d.updated_at || '',
            created_by_name: d.created_by_name || ''
        };
        if (rec.type === 'facilitator') facs.push(rec);
        else parts.push(rec);
    });

    console.log(`Total Facilitators: ${facs.length}`);
    console.log(`Total Participants: ${parts.length}`);

    // Scan Facilitators for duplicates
    const facDuplicates = [];
    const checked = new Set();

    for (let i = 0; i < facs.length; i++) {
        const a = facs[i];
        if (checked.has(a.uuid)) continue;
        const aTokens = tokenize(a.full_name);
        const cluster = [a];

        for (let j = i + 1; j < facs.length; j++) {
            const b = facs[j];
            if (checked.has(b.uuid)) continue;
            const bTokens = tokenize(b.full_name);

            const phoneMatch = a.phones.some(p => b.phones.includes(p));
            const commonTokens = aTokens.filter(t => bTokens.includes(t));
            const sameLastName = cleanStr(a.last_name) === cleanStr(b.last_name) && cleanStr(a.last_name).length > 2;
            const sameAge = a.age && b.age && Math.abs(parseInt(a.age) - parseInt(b.age)) <= 2;
            const samePlace = a.place && b.place && (cleanStr(a.place).includes(cleanStr(b.place)) || cleanStr(b.place).includes(cleanStr(a.place)));
            const sameForm = a.form_number && b.form_number && a.form_number === b.form_number;

            let isDupe = false;
            let reason = '';

            // 1. Same phone number
            if (phoneMatch) {
                isDupe = true;
                reason = `Matching Phone (${a.phones.find(p => b.phones.includes(p))})`;
                if (commonTokens.length > 0) reason += ` + Name tokens overlap (${commonTokens.join(', ')})`;
            }
            // 2. Middle name addition/omission with same last name
            else if (sameLastName && commonTokens.length >= 2) {
                isDupe = true;
                reason = `Middle Name difference (${a.full_name} vs ${b.full_name})`;
            }
            // 3. Same last name + same age + same place
            else if (sameLastName && sameAge && (samePlace || sameForm)) {
                isDupe = true;
                reason = `Same Last Name (${a.last_name}) + Same Age (${a.age}) + Place/Form`;
            }
            // 4. Same form number
            else if (sameForm && (commonTokens.length >= 1 || sameLastName)) {
                isDupe = true;
                reason = `Same Form Number (${a.form_number})`;
            }

            if (isDupe) {
                cluster.push({ ...b, reason });
            }
        }

        if (cluster.length > 1) {
            cluster.forEach(r => checked.add(r.uuid));
            facDuplicates.push(cluster);
        }
    }

    console.log(`\nFound ${facDuplicates.length} suspected Facilitator duplicate clusters:`);
    facDuplicates.forEach((cl, idx) => {
        console.log(`\n--- Facilitator Cluster #${idx + 1} (${cl.length} records) ---`);
        cl.forEach(r => {
            console.log(`  UUID: ${r.uuid}`);
            console.log(`    Name: "${r.full_name}" | Contact: "${r.contact}" | Age: ${r.age || 'N/A'}`);
            console.log(`    Form #: "${r.form_number || 'N/A'}" | Place: "${r.place || 'N/A'}"`);
            console.log(`    Teaching: ${r.teaching_group} | Books: ${r.books_distributed} | PartCount: ${r.participants_count}`);
            console.log(`    CreatedBy: "${r.created_by_name || 'N/A'}" | Reason: ${r.reason || 'Primary record'}`);
        });
    });

    // Also check: Did any of the registers 51-201 match a facilitator who already had a different name?
    // Let's check LEBOGANG MAKGALA and BOJELO MMAKGAGO
    console.log("\nChecking specific newly created facilitators from Regs 51-201:");
    const lebogangs = facs.filter(f => cleanStr(f.full_name).includes('makgala') || cleanStr(f.contact).includes('72288015') || f.form_number === '106');
    console.log(`Lebogang Makgala matches:`, lebogangs.map(l => ({ name: l.full_name, phone: l.contact, form: l.form_number, uuid: l.uuid })));

    const bojelos = facs.filter(f => cleanStr(f.full_name).includes('mmakgago') || cleanStr(f.contact).includes('76150158') || f.form_number === '121');
    console.log(`Bojelo Mmakgago matches:`, bojelos.map(b => ({ name: b.full_name, phone: b.contact, form: b.form_number, uuid: b.uuid })));
}

deepFacilitatorScan().catch(console.error);
