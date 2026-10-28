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

// Check if two names are likely the same person with middle name addition/omission
function isNameVariation(nameA, nameB) {
    const cleanA = cleanStr(nameA);
    const cleanB = cleanStr(nameB);
    if (!cleanA || !cleanB) return false;
    if (cleanA === cleanB) return true;

    const tokensA = tokenize(cleanA);
    const tokensB = tokenize(cleanB);
    if (tokensA.length === 0 || tokensB.length === 0) return false;

    // Last tokens match (same surname)
    const surnameA = tokensA[tokensA.length - 1];
    const surnameB = tokensB[tokensB.length - 1];
    const sameSurname = surnameA === surnameB && surnameA.length > 2;

    // Tokens intersection
    const intersection = tokensA.filter(t => tokensB.includes(t));

    // If one name is a subset of the other (e.g. "tebogo modisagae" inside "tebogo esther modisagae")
    const isSubset = tokensA.every(t => tokensB.includes(t)) || tokensB.every(t => tokensA.includes(t));
    if (isSubset && intersection.length >= 2) return true;

    // If same surname and first name matches (e.g. "kefilwe shaimus koitsiwe" vs "kefilwe koitsiwe")
    if (sameSurname && tokensA[0] === tokensB[0]) return true;

    // Check single initial (e.g. "proud m mapotsane" vs "mothusi mapotsane" -> initial 'm' matches 'mothusi')
    if (sameSurname) {
        for (const tA of tokensA) {
            for (const tB of tokensB) {
                if (tA.length === 1 && tB.startsWith(tA)) return true;
                if (tB.length === 1 && tA.startsWith(tB)) return true;
            }
        }
    }

    return false;
}

async function runDetailedAudit() {
    console.log("Fetching all registrations...");
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const records = [];

    snap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.is_deleted) return;
        records.push({
            id: docSnap.id,
            uuid: d.uuid || docSnap.id,
            first_name: d.first_name || '',
            last_name: d.last_name || '',
            full_name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
            contact: d.contact || '',
            phones: extractPhones(d.contact),
            age: d.age ? parseInt(d.age, 10) : null,
            gender: d.gender || '',
            type: d.type || 'participant',
            form_number: d.form_number || '',
            group_form_number: d.group_form_number || '',
            place: d.place || '',
            teaching_group: d.teaching_group || false,
            created_by_name: d.created_by_name || '',
            attendance: d.attendance || [],
            books_received: d.books_received || false,
            facilitator_uuid: d.facilitator_uuid || ''
        });
    });

    console.log(`Active records scanned: ${records.length}`);

    // Categorization buckets
    const trueDuplicates = []; // Definite duplicate records of the same person
    const suspectedDuplicates = []; // High probability duplicates (needs review)
    const sharedPhoneLegitimate = []; // Family / Prison shared phones (not duplicates)

    const processedPairs = new Set();
    const clusterMap = new Map();

    // Compare all pairs
    for (let i = 0; i < records.length; i++) {
        const a = records[i];
        for (let j = i + 1; j < records.length; j++) {
            const b = records[j];
            const pairKey = [a.uuid, b.uuid].sort().join('|');
            if (processedPairs.has(pairKey)) continue;

            const commonPhones = a.phones.filter(p => b.phones.includes(p));
            const hasCommonPhone = commonPhones.length > 0;
            const isPrisonLandline = commonPhones.includes('5777251');
            const nameVar = isNameVariation(a.full_name, b.full_name);
            const exactName = cleanStr(a.full_name) === cleanStr(b.full_name) && cleanStr(a.full_name).length > 3;
            const sameAge = a.age && b.age && a.age === b.age;
            const closeAge = a.age && b.age && Math.abs(a.age - b.age) <= 2;
            const samePlace = a.place && b.place && (cleanStr(a.place).includes(cleanStr(b.place)) || cleanStr(b.place).includes(cleanStr(a.place)));
            const sameForm = (a.form_number && b.form_number && a.form_number === b.form_number) ||
                             (a.group_form_number && b.group_form_number && a.group_form_number === b.group_form_number);

            // Case 1: Prison landline with different names -> Legitimate co-inmates, NOT duplicates
            if (isPrisonLandline && !nameVar && !exactName) {
                processedPairs.add(pairKey);
                continue;
            }

            // Case 2: Shared mobile phone with clearly different first names and different ages (> 5 years diff) -> Family member (parent/child)
            if (hasCommonPhone && !nameVar && !exactName && a.age && b.age && Math.abs(a.age - b.age) >= 5) {
                sharedPhoneLegitimate.push({ a, b, phone: commonPhones[0], reason: `Family shared phone (Age ${a.age} vs ${b.age})` });
                processedPairs.add(pairKey);
                continue;
            }

            // Case 3: DEFINITE DUPLICATE:
            // - Exact name + (same phone OR same age OR same form)
            // - Name variation (middle name added/omitted) + same phone
            // - Name variation + same age + same form/place
            if ((exactName && (hasCommonPhone || sameAge || sameForm)) ||
                (nameVar && hasCommonPhone) ||
                (nameVar && sameAge && (sameForm || samePlace))) {
                
                trueDuplicates.push({
                    a,
                    b,
                    commonPhone: commonPhones[0] || 'N/A',
                    reason: nameVar && !exactName ? 'Middle name added/omitted' : (exactName ? 'Exact name duplicate' : 'Strong attribute match')
                });
                processedPairs.add(pairKey);
                continue;
            }

            // Case 4: SUSPECTED DUPLICATE:
            // - Same phone + same age + same gender (even if names differ, e.g. English vs Setswana nickname)
            if (hasCommonPhone && sameAge && a.gender === b.gender && !isPrisonLandline) {
                suspectedDuplicates.push({
                    a,
                    b,
                    commonPhone: commonPhones[0],
                    reason: `Same Phone + Same Age (${a.age}) + Same Gender (${a.gender}) [Names: "${a.full_name}" vs "${b.full_name}"]`
                });
                processedPairs.add(pairKey);
                continue;
            }

            // Case 5: Exact name match across different forms without phone
            if (exactName && closeAge && (samePlace || sameForm)) {
                suspectedDuplicates.push({
                    a,
                    b,
                    commonPhone: 'N/A',
                    reason: `Exact Name ("${a.full_name}") + Close Age (${a.age} vs ${b.age})`
                });
                processedPairs.add(pairKey);
                continue;
            }
        }
    }

    console.log("\n=======================================================");
    console.log("            AUDIT CLASSIFICATION RESULTS               ");
    console.log("=======================================================");
    console.log(`1. Definite True Duplicate Pairs (Same Person): ${trueDuplicates.length}`);
    console.log(`2. Suspected Duplicate Pairs (Needs Review): ${suspectedDuplicates.length}`);
    console.log(`3. Legitimate Shared Contacts (e.g. Mother & Child): ${sharedPhoneLegitimate.length}`);

    console.log("\n>>> DETAILS: DEFINITE TRUE DUPLICATES (SAME PERSON) <<<");
    trueDuplicates.forEach((item, idx) => {
        console.log(`\n[Definite #${idx + 1}] Reason: ${item.reason}`);
        console.log(`   Record 1: [${item.a.type.toUpperCase()}] "${item.a.full_name}" | Phone: "${item.a.contact}" | Age: ${item.a.age || '-'} | Form: ${item.a.form_number || item.a.group_form_number || '-'} | UUID: ${item.a.uuid}`);
        console.log(`   Record 2: [${item.b.type.toUpperCase()}] "${item.b.full_name}" | Phone: "${item.b.contact}" | Age: ${item.b.age || '-'} | Form: ${item.b.form_number || item.b.group_form_number || '-'} | UUID: ${item.b.uuid}`);
    });

    console.log("\n>>> DETAILS: SUSPECTED DUPLICATES (HIGH PROBABILITY) <<<");
    suspectedDuplicates.forEach((item, idx) => {
        console.log(`\n[Suspected #${idx + 1}] Reason: ${item.reason}`);
        console.log(`   Record 1: [${item.a.type.toUpperCase()}] "${item.a.full_name}" | Phone: "${item.a.contact}" | Age: ${item.a.age || '-'} | Form: ${item.a.form_number || item.a.group_form_number || '-'} | UUID: ${item.a.uuid}`);
        console.log(`   Record 2: [${item.b.type.toUpperCase()}] "${item.b.full_name}" | Phone: "${item.b.contact}" | Age: ${item.b.age || '-'} | Form: ${item.b.form_number || item.b.group_form_number || '-'} | UUID: ${item.b.uuid}`);
    });

    console.log("\n>>> DETAILS: LEGITIMATE SHARED PHONE CONTACTS (NOT DUPLICATES) <<<");
    sharedPhoneLegitimate.forEach((item, idx) => {
        console.log(`   * Phone ${item.phone}: "${item.a.full_name}" (Age ${item.a.age}) & "${item.b.full_name}" (Age ${item.b.age}) - [${item.reason}]`);
    });
}

runDetailedAudit().catch(console.error);
