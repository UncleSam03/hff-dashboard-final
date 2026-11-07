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

function cleanStr(s) {
    return String(s || '').trim();
}

const isInitialOnly = (name) => {
    if (!name) return false;
    const s = cleanStr(name);
    // e.g. "S.", "S", "M.", "M", "T. B.", "D. V.", "M. M."
    return /^[A-Z]\.?$/i.test(s) || /^[A-Z]\.\s*[A-Z]?\.?$/i.test(s) || (s.length <= 2 && s.endsWith('.'));
};

const isRawMaritalCode = (m) => {
    if (!m) return false;
    const s = cleanStr(m).toUpperCase();
    return s === 'S' || s === 'M' || s === 'D' || s === 'W' || s === 'C';
};

const isRawEducationCode = (e) => {
    if (!e) return false;
    const s = cleanStr(e).toUpperCase();
    return s === 'J' || s === 'S' || s === 'U' || s === 'T' || s === 'P' || s === 'BCC' || s === '4Z';
};

async function generateFullGroupAudit() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    const facilitators = allDocs.filter(d => (d.type || '').toLowerCase() === 'facilitator');
    const participants = allDocs.filter(d => (d.type || '').toLowerCase() !== 'facilitator');

    const groupsMap = new Map();

    for (const f of facilitators) {
        const rawForm = cleanStr(f.form_number);
        if (rawForm && rawForm !== 'null' && rawForm !== 'undefined') {
            const key = rawForm.toUpperCase();
            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    formNumber: rawForm,
                    facilitator: f,
                    facilitators: [f],
                    participants: []
                });
            } else {
                groupsMap.get(key).facilitators.push(f);
                if ((!groupsMap.get(key).facilitator.place || !groupsMap.get(key).facilitator.meeting_time) && (f.place || f.meeting_time)) {
                    groupsMap.get(key).facilitator = f;
                }
            }
        }
    }

    for (const p of participants) {
        const rawForm = cleanStr(p.group_form_number || p.form_number);
        const formKey = rawForm ? rawForm.toUpperCase() : '';

        if (formKey && groupsMap.has(formKey)) {
            groupsMap.get(formKey).participants.push(p);
        } else if (p.facilitator_uuid) {
            let found = false;
            for (const [key, grp] of groupsMap.entries()) {
                if (grp.facilitators.some(f => f.uuid === p.facilitator_uuid)) {
                    grp.participants.push(p);
                    found = true;
                    break;
                }
            }
            if (!found && formKey) {
                groupsMap.set(formKey, {
                    formNumber: rawForm,
                    facilitator: null,
                    facilitators: [],
                    participants: [p]
                });
            }
        } else if (formKey) {
            groupsMap.set(formKey, {
                formNumber: rawForm,
                facilitator: null,
                facilitators: [],
                participants: [p]
            });
        }
    }

    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
        const numA = parseInt(a.formNumber.replace(/\D/g, ''), 10) || 99999;
        const numB = parseInt(b.formNumber.replace(/\D/g, ''), 10) || 99999;
        if (numA !== numB) return numA - numB;
        return a.formNumber.localeCompare(b.formNumber);
    });

    const evaluatedGroups = [];

    for (const grp of sortedGroups) {
        const f = grp.facilitator;
        const parts = grp.participants;

        const facName = f ? `${f.first_name || ''} ${f.last_name || ''}`.trim() : 'Unassigned Facilitator';
        const facPhone = f?.contact || 'Not provided';
        const facPlace = f?.place || 'Not provided';
        const facTime = f?.meeting_time || 'Not specified';

        let missingPhoneCount = 0;
        let missingGenderCount = 0;
        let missingAgeCount = 0;
        let missingAffiliationCount = 0;
        let missingOccupationCount = 0;
        let initialFirstNameCount = 0;
        let missingFirstNameCount = 0;

        let rawMaritalCount = 0;
        let rawEducationCount = 0;
        let omittedMaritalCount = 0;
        let omittedEducationCount = 0;

        const initialNamesList = [];

        parts.forEach(p => {
            const fn = cleanStr(p.first_name);
            if (!fn) missingFirstNameCount++;
            else if (isInitialOnly(fn)) {
                initialFirstNameCount++;
                initialNamesList.push(`${fn} ${p.last_name || ''}`.trim());
            }

            if (!p.contact || p.contact === '—' || p.contact === '-' || p.contact.toLowerCase() === 'nil') missingPhoneCount++;
            if (!p.gender || p.gender === '—' || p.gender === '-') missingGenderCount++;
            if (!p.age) missingAgeCount++;
            if (!p.affiliation || p.affiliation === '—' || p.affiliation === '-' || p.affiliation.toLowerCase() === 'n/a' || p.affiliation.toLowerCase() === 'nil') missingAffiliationCount++;
            if (!p.occupation || p.occupation === '—' || p.occupation === '-' || p.occupation.toLowerCase() === 'n/a' || p.occupation.toLowerCase() === 'nil') missingOccupationCount++;

            // Category 3 checks
            if (isRawMaritalCode(p.marital_status)) rawMaritalCount++;
            else if (!p.marital_status || p.marital_status === '—' || p.marital_status === '-') omittedMaritalCount++;

            if (isRawEducationCode(p.education)) rawEducationCount++;
            else if (!p.education || p.education === '—' || p.education === '-') omittedEducationCount++;
        });

        // Determine category:
        // Category 1: Fine, all fields filled, standard expanded terms
        // Category 2: Missing fields from physical register (phone, affiliation, initial name, missing age/gender)
        // Category 3: System shorthand codes ('S', 'M', 'J', 'U', etc.) or omitted by system
        let category = 1;
        const reasons = [];

        const hasCat2Issues = missingPhoneCount > 0 || initialFirstNameCount > 0 || missingFirstNameCount > 0 || missingAffiliationCount > 0 || missingGenderCount > 0 || missingAgeCount > 0 || !f?.contact || !f?.place || !f?.meeting_time;
        const hasCat3Issues = rawMaritalCount > 0 || rawEducationCount > 0 || (parts.length > 0 && omittedEducationCount > parts.length * 0.5) || (parts.length > 0 && omittedMaritalCount > parts.length * 0.5);

        if (!hasCat2Issues && !hasCat3Issues) {
            category = 1;
            reasons.push("All fields complete and expanded");
        } else if (hasCat3Issues && !hasCat2Issues) {
            category = 3;
            if (rawMaritalCount > 0) reasons.push(`${rawMaritalCount} marital status shorthand codes (S/M/D/W)`);
            if (rawEducationCount > 0) reasons.push(`${rawEducationCount} education shorthand codes (J/S/U/T/P)`);
            if (omittedEducationCount > 0) reasons.push(`${omittedEducationCount} omitted education fields`);
        } else if (hasCat2Issues && !hasCat3Issues) {
            category = 2;
            if (initialFirstNameCount > 0) reasons.push(`Initials used: ${initialNamesList.slice(0, 3).join(', ')}${initialNamesList.length > 3 ? '...' : ''}`);
            if (missingPhoneCount > 0) reasons.push(`${missingPhoneCount} missing phone numbers`);
            if (missingAffiliationCount > 0) reasons.push(`${missingAffiliationCount} missing affiliation/workplace`);
            if (missingAgeCount > 0) reasons.push(`${missingAgeCount} missing age`);
            if (!f?.meeting_time) reasons.push(`Facilitator meeting time missing`);
        } else {
            // Both issues exist: User asked to categorize.
            // If the dominant problem is raw shorthand codes across the register, classify in Cat 3 with Cat 2 notes, or vice-versa
            category = rawMaritalCount + rawEducationCount > initialFirstNameCount + missingPhoneCount ? 3 : 2;
            if (rawMaritalCount > 0) reasons.push(`${rawMaritalCount} marital codes (S/M/D)`);
            if (rawEducationCount > 0) reasons.push(`${rawEducationCount} education codes (J/S/U)`);
            if (initialFirstNameCount > 0) reasons.push(`Initials: ${initialNamesList.slice(0, 2).join(', ')}`);
            if (missingPhoneCount > 0) reasons.push(`${missingPhoneCount} missing phones`);
            if (missingAffiliationCount > 0) reasons.push(`${missingAffiliationCount} missing affiliations`);
        }

        evaluatedGroups.push({
            formNumber: grp.formNumber,
            facilitatorName: facName,
            contact: facPhone,
            meetingPlace: facPlace,
            meetingTime: facTime,
            participantCount: parts.length,
            category,
            reasons: reasons.join('; '),
            details: {
                missingPhoneCount,
                initialFirstNameCount,
                missingAffiliationCount,
                rawMaritalCount,
                rawEducationCount,
                omittedEducationCount,
                omittedMaritalCount
            }
        });
    }

    fs.writeFileSync('scripts/group_audit_results.json', JSON.stringify(evaluatedGroups, null, 2));
    console.log(`Saved audit results for ${evaluatedGroups.length} groups.`);

    const c1 = evaluatedGroups.filter(g => g.category === 1);
    const c2 = evaluatedGroups.filter(g => g.category === 2);
    const c3 = evaluatedGroups.filter(g => g.category === 3);

    console.log(`Category 1 (Fine / All fields filled): ${c1.length}`);
    console.log(`Category 2 (Missing fields on physical registers): ${c2.length}`);
    console.log(`Category 3 (System shorthand codes / omitted): ${c3.length}`);

    process.exit(0);
}

generateFullGroupAudit().catch(e => { console.error(e); process.exit(1); });
