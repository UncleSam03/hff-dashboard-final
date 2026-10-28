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

// Helpers
function normalizePhone(raw) {
    if (!raw) return '';
    // Strip everything non-digit
    let digits = String(raw).replace(/\D/g, '');
    // Strip leading 267 if 11 digits (267 7xxxxxxx)
    if (digits.length === 11 && digits.startsWith('267')) {
        digits = digits.slice(3);
    }
    // If multiple numbers separated, take the first 8-digit or return array
    return digits;
}

function extractPhones(raw) {
    if (!raw) return [];
    const str = String(raw);
    const parts = str.split(/[/,;&\s+]+/);
    const res = [];
    for (const p of parts) {
        let d = p.replace(/\D/g, '');
        if (d.length === 11 && d.startsWith('267')) d = d.slice(3);
        if (d.length === 8) res.push(d);
        else if (d.length === 7) res.push(d); // some older landlines
    }
    return res;
}

function tokenizeName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1);
}

function cleanStr(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function analyzeDuplicates() {
    console.log("Fetching all registrations from Firestore...");
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    console.log(`Retrieved ${snap.docs.length} total registration documents from Firestore.`);

    const records = [];
    for (const doc of snap.docs) {
        const d = doc.data();
        if (d.is_deleted) continue;
        records.push({
            id: doc.id,
            uuid: d.uuid || doc.id,
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
            campaign_id: d.campaign_id || '',
            facilitator_uuid: d.facilitator_uuid || '',
            created_at: d.created_at || '',
            updated_at: d.updated_at || '',
            attendance: d.attendance || [],
            created_by_name: d.created_by_name || ''
        });
    }

    console.log(`Active (non-deleted) records: ${records.length}`);

    // 1. Phone-based grouping (exact phone match, excluding dummy/blank)
    const phoneMap = new Map();
    for (const r of records) {
        for (const p of r.phones) {
            // Ignore generic or invalid placeholder numbers
            if (p === '00000000' || p === '12345678') continue;
            if (!phoneMap.has(p)) phoneMap.set(p, []);
            phoneMap.get(p).push(r);
        }
    }

    const phoneDuplicates = [];
    for (const [phone, group] of phoneMap.entries()) {
        // Remove duplicate entries of the same record uuid if extracted multiple times
        const uniqueRecs = Array.from(new Map(group.map(r => [r.uuid, r])).values());
        if (uniqueRecs.length > 1) {
            phoneDuplicates.push({ phone, records: uniqueRecs });
        }
    }

    // 2. Name-based analysis (Middle name addition / omission)
    // We compare records that share the same last name AND where one's first name tokens are a subset of the other's
    // OR where tokens overlap >= 2 words (e.g. "Tumisang Mogomotsi" vs "Tumisang Molefe Mogomotsi")
    const nameClusters = [];
    const visitedUuids = new Set();

    for (let i = 0; i < records.length; i++) {
        const a = records[i];
        if (visitedUuids.has(a.uuid)) continue;
        const aTokens = tokenizeName(a.full_name);
        if (aTokens.length === 0) continue;

        const cluster = [a];

        for (let j = i + 1; j < records.length; j++) {
            const b = records[j];
            if (visitedUuids.has(b.uuid)) continue;
            const bTokens = tokenizeName(b.full_name);
            if (bTokens.length === 0) continue;

            // Check token intersection
            const commonTokens = aTokens.filter(t => bTokens.includes(t));
            
            // Check matching signals
            const samePhone = a.phones.some(p => b.phones.includes(p));
            const sameAge = (a.age && b.age && Math.abs(parseInt(a.age) - parseInt(b.age)) <= 1);
            const samePlace = cleanStr(a.place) && cleanStr(b.place) && (cleanStr(a.place).includes(cleanStr(b.place)) || cleanStr(b.place).includes(cleanStr(a.place)));
            const sameForm = (a.form_number && b.form_number && a.form_number === b.form_number) ||
                             (a.group_form_number && b.group_form_number && a.group_form_number === b.group_form_number);

            let isMatch = false;
            let reason = '';

            // Signal 1: Identical phone and at least 1 common name token
            if (samePhone && commonTokens.length >= 1) {
                isMatch = true;
                reason = `Same Phone (${a.phones.find(p => b.phones.includes(p))}) + Name overlap (${commonTokens.join(', ')})`;
            }
            // Signal 2: Middle name addition/omission (subset tokens, length >= 2)
            else if (commonTokens.length >= 2) {
                const isSubset = aTokens.every(t => bTokens.includes(t)) || bTokens.every(t => aTokens.includes(t));
                if (isSubset) {
                    if (samePhone || sameAge || samePlace || sameForm || a.gender === b.gender) {
                        isMatch = true;
                        reason = `Name Token Subset (${commonTokens.join(', ')}) + Corroboration`;
                    }
                } else if (commonTokens.length >= 2 && (samePhone || (sameAge && samePlace))) {
                    isMatch = true;
                    reason = `Strong Name Overlap (${commonTokens.join(', ')}) + Phone/Age/Place`;
                }
            }
            // Signal 3: Exact same first & last name, but different phone or missing phone
            else if (cleanStr(a.first_name) === cleanStr(b.first_name) && cleanStr(a.last_name) === cleanStr(b.last_name) && cleanStr(a.first_name).length > 2) {
                if (samePhone || (a.age && b.age && a.age === b.age) || sameForm) {
                    isMatch = true;
                    reason = `Exact Name Match + Corroboration (Age: ${a.age || 'N/A'}/${b.age || 'N/A'}, Phone: ${a.contact || 'N/A'}/${b.contact || 'N/A'})`;
                }
            }

            if (isMatch) {
                cluster.push({ ...b, matchReason: reason });
            }
        }

        if (cluster.length > 1) {
            for (const r of cluster) visitedUuids.add(r.uuid);
            nameClusters.push(cluster);
        }
    }

    console.log("\n=======================================================");
    console.log("             DUPLICATE ANALYSIS REPORT                 ");
    console.log("=======================================================\n");

    console.log(`Total Active Records Scanned: ${records.length}`);
    console.log(`Phone-based Duplicate Groups: ${phoneDuplicates.length}`);
    console.log(`Comprehensive Suspected Duplicate Clusters: ${nameClusters.length}`);

    let totalRedundant = 0;
    nameClusters.forEach(c => {
        totalRedundant += (c.length - 1);
    });
    console.log(`Total Excess/Redundant Duplicate Records in Clusters: ${totalRedundant}`);

    // Categorize Clusters
    const facDuplicates = [];
    const partDuplicates = [];
    const crossTypeDuplicates = [];

    nameClusters.forEach(cluster => {
        const types = new Set(cluster.map(r => r.type));
        if (types.has('facilitator') && types.has('participant')) {
            crossTypeDuplicates.push(cluster);
        } else if (types.has('facilitator')) {
            facDuplicates.push(cluster);
        } else {
            partDuplicates.push(cluster);
        }
    });

    console.log(`\nBreakdown by Type:`);
    console.log(` - Facilitator Duplicates (Facilitator vs Facilitator): ${facDuplicates.length} clusters`);
    console.log(` - Participant Duplicates (Participant vs Participant): ${partDuplicates.length} clusters`);
    console.log(` - Cross-Role Duplicates (Registered as both Facilitator and Participant): ${crossTypeDuplicates.length} clusters`);

    console.log("\n-------------------------------------------------------");
    console.log("1. FACILITATOR VS FACILITATOR DUPLICATES (Middle name / Phone):");
    console.log("-------------------------------------------------------");
    facDuplicates.forEach((cl, idx) => {
        console.log(`\n[Cluster F-${idx + 1}] (${cl.length} records):`);
        cl.forEach(r => {
            console.log(`  * UUID: ${r.uuid} | Name: "${r.full_name}" | Phone: "${r.contact}" | Age: ${r.age || '-'} | Form: ${r.form_number || '-'} | Place: "${r.place || '-'}"`);
        });
    });

    console.log("\n-------------------------------------------------------");
    console.log("2. CROSS-ROLE DUPLICATES (Facilitator ALSO registered as Participant):");
    console.log("-------------------------------------------------------");
    crossTypeDuplicates.forEach((cl, idx) => {
        console.log(`\n[Cluster X-${idx + 1}] (${cl.length} records):`);
        cl.forEach(r => {
            console.log(`  * [${r.type.toUpperCase()}] UUID: ${r.uuid} | Name: "${r.full_name}" | Phone: "${r.contact}" | Age: ${r.age || '-'} | Form: ${r.form_number || r.group_form_number || '-'} | Place: "${r.place || '-'}"`);
        });
    });

    console.log("\n-------------------------------------------------------");
    console.log("3. PARTICIPANT VS PARTICIPANT DUPLICATES (Same person in groups):");
    console.log("-------------------------------------------------------");
    partDuplicates.forEach((cl, idx) => {
        console.log(`\n[Cluster P-${idx + 1}] (${cl.length} records):`);
        cl.forEach(r => {
            console.log(`  * UUID: ${r.uuid} | Name: "${r.full_name}" | Phone: "${r.contact}" | Age: ${r.age || '-'} | Group Form: ${r.group_form_number || '-'} | Place: "${r.place || '-'}"`);
        });
    });
}

analyzeDuplicates().catch(err => {
    console.error("Analysis failed:", err);
});
