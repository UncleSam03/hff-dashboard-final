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

function cleanDigits(s) {
    return String(s || '').replace(/\D/g, '').slice(-8);
}

// Levenshtein distance
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function tokenize(name) {
    return cleanStr(name).split(' ').filter(t => t.length > 1);
}

async function findTypoAndFuzzyDuplicates() {
    console.log("Fetching all active registrations from Firestore...");
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const records = [];

    snap.docs.forEach(d => {
        const data = d.data();
        if (d.is_deleted) return;
        records.push({
            id: d.id,
            uuid: data.uuid || d.id,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            contact: data.contact || '',
            phone8: cleanDigits(data.contact),
            age: data.age || '',
            gender: data.gender || '',
            type: data.type || 'participant',
            form_number: data.form_number || '',
            group_form_number: data.group_form_number || '',
            place: data.place || '',
            meeting_time: data.meeting_time || '',
            teaching_group: data.teaching_group || false,
            created_at: data.created_at || '',
            created_by_name: data.created_by_name || '',
            participants_count: data.participants_count || 0,
            books_distributed: data.books_distributed || 0
        });
    });

    console.log(`Total active records: ${records.length}`);
    const facs = records.filter(r => r.type === 'facilitator');
    console.log(`Total active facilitators: ${facs.length}`);

    const fuzzyDuplicates = [];
    const paired = new Set();

    for (let i = 0; i < facs.length; i++) {
        const a = facs[i];
        for (let j = i + 1; j < facs.length; j++) {
            const b = facs[j];
            const pairKey = [a.uuid, b.uuid].sort().join('|');
            if (paired.has(pairKey)) continue;

            const aPhone = a.phone8;
            const bPhone = b.phone8;
            const phoneDist = (aPhone.length >= 7 && bPhone.length >= 7) ? levenshtein(aPhone, bPhone) : 99;

            const aTokens = tokenize(a.full_name);
            const bTokens = tokenize(b.full_name);
            const aLast = cleanStr(a.last_name);
            const bLast = cleanStr(b.last_name);
            const aFirst = cleanStr(a.first_name);
            const bFirst = cleanStr(b.first_name);

            const lastDist = levenshtein(aLast, bLast);
            const firstDist = levenshtein(aFirst, bFirst);

            // Check if first names share tokens or middle names
            const commonTokens = aTokens.filter(t => bTokens.includes(t));
            const hasCommonFirst = aTokens.some(t => bTokens.includes(t) && t !== aLast && t !== bLast);

            let isMatch = false;
            let reason = [];

            // Pattern 1: Same first name (or token) + 1-digit phone typo + surname fuzzy match (<= 2 edits, e.g. Makgala vs Makgale)
            if (hasCommonFirst && lastDist <= 2 && phoneDist <= 2) {
                isMatch = true;
                reason.push(`1-digit phone diff (${aPhone} vs ${bPhone}) + Surname fuzzy match (${aLast} vs ${bLast})`);
            }
            // Pattern 2: 1-digit phone typo (dist <= 1) + Common name token
            else if (phoneDist <= 1 && commonTokens.length >= 1) {
                isMatch = true;
                reason.push(`1-digit phone typo (${aPhone} vs ${bPhone}) + Name token match (${commonTokens.join(', ')})`);
            }
            // Pattern 3: Same phone + Surname typo (dist <= 2)
            else if (phoneDist === 0 && lastDist <= 2) {
                isMatch = true;
                reason.push(`Exact phone match + Surname typo (${aLast} vs ${bLast})`);
            }
            // Pattern 4: Same form number + Name similarity
            else if (a.form_number && b.form_number && a.form_number === b.form_number) {
                isMatch = true;
                reason.push(`Same Form Number (#${a.form_number})`);
            }
            // Pattern 5: Surname fuzzy (<= 1 edit) + First name fuzzy (<= 1 edit) + Same place/village
            else if (lastDist <= 1 && firstDist <= 1 && aFirst.length > 3 && (cleanStr(a.place).includes('mochudi') || cleanStr(b.place).includes('mochudi'))) {
                isMatch = true;
                reason.push(`Fuzzy First & Last name match (${a.full_name} vs ${b.full_name})`);
            }
            // Pattern 6: First name contains second + Surname fuzzy <= 1 (e.g. Lebogang vs Lebogang Doreen) + phone dist <= 2
            else if ((aTokens[0] === bTokens[0]) && lastDist <= 2 && (phoneDist <= 3 || !aPhone || !bPhone)) {
                isMatch = true;
                reason.push(`First Name Match + Surname Variant (${aLast} vs ${bLast}) + Phone Near-Match (${aPhone || 'N/A'} vs ${bPhone || 'N/A'})`);
            }

            if (isMatch) {
                paired.add(pairKey);
                fuzzyDuplicates.push({
                    a,
                    b,
                    reason: reason.join('; ')
                });
            }
        }
    }

    console.log(`\n===============================================================`);
    console.log(`  DETECTED FUZZY / TYPO FACILITATOR DUPLICATE CLUSTERS: ${fuzzyDuplicates.length}`);
    console.log(`===============================================================\n`);

    fuzzyDuplicates.forEach((d, idx) => {
        console.log(`[Typo Cluster #${idx + 1}] Reason: ${d.reason}`);
        console.log(`   Card 1: "${d.a.full_name}" | Phone: "${d.a.contact}" | Age: ${d.a.age || '??'} | Form: #${d.a.form_number || '-'} | Place: "${d.a.place || '-'}" | CreatedBy: ${d.a.created_by_name} | Created: ${d.a.created_at} | UUID: ${d.a.uuid}`);
        console.log(`   Card 2: "${d.b.full_name}" | Phone: "${d.b.contact}" | Age: ${d.b.age || '??'} | Form: #${d.b.form_number || '-'} | Place: "${d.b.place || '-'}" | CreatedBy: ${d.b.created_by_name} | Created: ${d.b.created_at} | UUID: ${d.b.uuid}`);
        console.log('');
    });

    // Also check participants for same typo patterns
    console.log("\n--- Checking Participants for 1-Digit Phone Typos or Near-Matches ---");
    const parts = records.filter(r => r.type === 'participant');
    const partFuzzy = [];
    const partPairs = new Set();

    for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
            const b = parts[j];
            if (a.phone8 === '5777251' && b.phone8 === '5777251') continue;
            const pKey = [a.uuid, b.uuid].sort().join('|');
            if (partPairs.has(pKey)) continue;

            const phoneDist = (a.phone8.length >= 7 && b.phone8.length >= 7) ? levenshtein(a.phone8, b.phone8) : 99;
            const lastDist = levenshtein(cleanStr(a.last_name), cleanStr(b.last_name));
            const firstDist = levenshtein(cleanStr(a.first_name), cleanStr(b.first_name));

            if (phoneDist <= 1 && lastDist <= 1 && firstDist <= 2) {
                partPairs.add(pKey);
                partFuzzy.push({ a, b, reason: `Phone dist: ${phoneDist}, Name dist: ${firstDist}+${lastDist}` });
            }
        }
    }
    console.log(`Found ${partFuzzy.length} participant fuzzy typo duplicates.`);
    partFuzzy.forEach((p, idx) => {
        console.log(`   P-${idx + 1}: "${p.a.full_name}" (${p.a.contact}, Form ${p.a.group_form_number}) vs "${p.b.full_name}" (${p.b.contact}, Form ${p.b.group_form_number})`);
    });
}

findTypoAndFuzzyDuplicates().catch(console.error);
