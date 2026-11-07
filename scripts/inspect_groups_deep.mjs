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
    return String(s || '').trim();
}

function cleanForm(f) {
    return String(f || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^0+(?=\d)/, '');
}

async function runAnalysis() {
    console.log("Fetching all registrations from Firestore...");
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    const facilitators = allDocs.filter(d => (d.type || '').toLowerCase() === 'facilitator');
    const participants = allDocs.filter(d => (d.type || '').toLowerCase() !== 'facilitator');

    console.log(`Retrieved ${allDocs.length} active records (${facilitators.length} facilitators, ${participants.length} participants)`);

    // Grouping by physical register / Form Number
    // A group is defined by its Register / Form Number (e.g. 1, 2, 6, 45, 51, 104, 114 A, 220 B, etc.)
    const groupsMap = new Map();

    // Index facilitators by form number
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
                // Keep the one with most details
                if (!groupsMap.get(key).facilitator.place && f.place) {
                    groupsMap.get(key).facilitator = f;
                }
            }
        }
    }

    // Index participants by form number or facilitator UUID
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
            if (!found) {
                if (formKey) {
                    groupsMap.set(formKey, {
                        formNumber: rawForm,
                        facilitator: null,
                        facilitators: [],
                        participants: [p]
                    });
                }
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

    console.log(`Total numbered groups identified: ${groupsMap.size}`);

    // Sort groups numerically
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
        const numA = parseInt(a.formNumber.replace(/\D/g, ''), 10) || 99999;
        const numB = parseInt(b.formNumber.replace(/\D/g, ''), 10) || 99999;
        if (numA !== numB) return numA - numB;
        return a.formNumber.localeCompare(b.formNumber);
    });

    console.log("\nAnalyzing fields for each group...");

    // Diagnostic categorization:
    // Category 1: Fine, all fields filled, standard expanded values, no missing names/phones/affiliations
    // Category 2: Missing fields from physical registers (empty phone, empty affiliation, initial-only first name, missing age/gender)
    // Category 3: System shorthand codes (Marital status = 'S', 'M', 'D', 'W'; Education = 'J', 'S', 'U', 'T', 'P'; Gender = 'M', 'F' raw)
    
    const cat1 = [];
    const cat2 = [];
    const cat3 = [];

    const isInitialOnly = (name) => {
        if (!name) return true;
        const s = cleanStr(name);
        return /^[A-Z]\.?$/i.test(s) || /^[A-Z]\.\s*[A-Z]?\.?$/i.test(s) || s.length === 1;
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

    for (const grp of sortedGroups) {
        const f = grp.facilitator;
        const parts = grp.participants;

        const facName = f ? `${f.first_name || ''} ${f.last_name || ''}`.trim() : 'Unassigned';
        const facPhone = f?.contact || 'Missing';
        const facPlace = f?.place || 'Missing';
        const facTime = f?.meeting_time || 'Not Specified';

        const issuesCat2 = []; // Missing fields from register
        const issuesCat3 = []; // Shorthand codes not expanded

        // Check facilitator info
        if (!f) {
            issuesCat2.push("No facilitator profile assigned to form");
        } else {
            if (!f.contact) issuesCat2.push("Facilitator phone missing");
            if (!f.place) issuesCat2.push("Meeting place missing");
            if (!f.meeting_time) issuesCat2.push("Meeting time missing");
            if (isInitialOnly(f.first_name)) issuesCat2.push(`Facilitator first name is initial ("${f.first_name}")`);
        }

        if (parts.length === 0) {
            issuesCat2.push("No digitized participants linked");
        }

        let countInitialNames = 0;
        let countMissingPhones = 0;
        let countMissingGender = 0;
        let countMissingAge = 0;
        let countMissingAffiliation = 0;
        let countMissingOccupation = 0;
        let countMissingEducation = 0;
        let countMissingMarital = 0;

        let countRawMarital = 0;
        let countRawEducation = 0;

        for (const p of parts) {
            // Check initial first name
            if (isInitialOnly(p.first_name) || p.first_name.endsWith('.')) {
                countInitialNames++;
            }
            if (!p.contact || p.contact === '—' || p.contact === '-') {
                countMissingPhones++;
            }
            if (!p.gender) {
                countMissingGender++;
            }
            if (!p.age) {
                countMissingAge++;
            }
            if (!p.affiliation || p.affiliation === '—' || p.affiliation === '-' || p.affiliation.toLowerCase() === 'n/a' || p.affiliation.toLowerCase() === 'nil') {
                countMissingAffiliation++;
            }
            if (!p.occupation || p.occupation === '—' || p.occupation === '-' || p.occupation.toLowerCase() === 'n/a' || p.occupation.toLowerCase() === 'nil') {
                countMissingOccupation++;
            }
            if (!p.education || p.education === '—' || p.education === '-') {
                countMissingEducation++;
            }
            if (!p.marital_status || p.marital_status === '—' || p.marital_status === '-') {
                countMissingMarital++;
            }

            // Category 3 checks
            if (isRawMaritalCode(p.marital_status)) {
                countRawMarital++;
            }
            if (isRawEducationCode(p.education)) {
                countRawEducation++;
            }
        }

        if (countInitialNames > 0) issuesCat2.push(`${countInitialNames} participants with initial first names`);
        if (countMissingPhones > 0) issuesCat2.push(`${countMissingPhones} participants missing phone numbers`);
        if (countMissingGender > 0) issuesCat2.push(`${countMissingGender} participants missing gender`);
        if (countMissingAge > 0) issuesCat2.push(`${countMissingAge} participants missing age`);
        if (countMissingAffiliation > 0) issuesCat2.push(`${countMissingAffiliation} participants missing affiliation`);
        if (countMissingOccupation > 0) issuesCat2.push(`${countMissingOccupation} participants missing occupation`);
        if (countMissingEducation > 0) issuesCat2.push(`${countMissingEducation} participants missing education`);
        if (countMissingMarital > 0) issuesCat2.push(`${countMissingMarital} participants missing marital status`);

        if (countRawMarital > 0) issuesCat3.push(`${countRawMarital} participants with raw marital status codes (e.g. 'S', 'M')`);
        if (countRawEducation > 0) issuesCat3.push(`${countRawEducation} participants with raw education codes (e.g. 'J', 'S', 'U')`);

        const grpSummary = {
            formNumber: grp.formNumber,
            facilitatorName: facName,
            contact: facPhone,
            meetingPlace: facPlace,
            meetingTime: facTime,
            participantCount: parts.length,
            issuesCat2,
            issuesCat3
        };

        // Decision logic:
        // Category 1: Clean, no issuesCat2 and no issuesCat3
        // Category 3: Has issuesCat3 (raw codes not expanded)
        // Category 2: Has issuesCat2 (missing info from paper registers)
        if (issuesCat2.length === 0 && issuesCat3.length === 0) {
            cat1.push(grpSummary);
        } else if (issuesCat3.length > 0) {
            cat3.push(grpSummary);
        } else {
            cat2.push(grpSummary);
        }
    }

    console.log(`\n======================================================`);
    console.log(`                CATEGORIZATION RESULTS                `);
    console.log(`======================================================`);
    console.log(`Total Groups: ${sortedGroups.length}`);
    console.log(`Category 1 (All Fields Complete & Standard): ${cat1.length}`);
    console.log(`Category 2 (Missing Fields on Physical Registers): ${cat2.length}`);
    console.log(`Category 3 (System Raw Shorthand / Not Expanded): ${cat3.length}`);

    console.log(`\n--- CATEGORY 1 SAMPLE (${cat1.length}) ---`);
    cat1.slice(0, 5).forEach(g => console.log(`Form ${g.formNumber}: ${g.facilitatorName} | ${g.contact} | ${g.meetingPlace} | ${g.meetingTime} (${g.participantCount} parts)`));

    console.log(`\n--- CATEGORY 2 SAMPLE (${cat2.length}) ---`);
    cat2.slice(0, 5).forEach(g => console.log(`Form ${g.formNumber}: ${g.facilitatorName} | ${g.contact} | ${g.meetingPlace} | Issues: ${g.issuesCat2.join('; ')}`));

    console.log(`\n--- CATEGORY 3 SAMPLE (${cat3.length}) ---`);
    cat3.slice(0, 5).forEach(g => console.log(`Form ${g.formNumber}: ${g.facilitatorName} | ${g.contact} | ${g.meetingPlace} | Issues: ${g.issuesCat3.join('; ')}`));

    process.exit(0);
}

runAnalysis().catch(e => { console.error(e); process.exit(1); });
