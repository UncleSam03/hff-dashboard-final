import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
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

// Rule mappings
const GENDER_MAP = {
    'M': 'Male',
    'F': 'Female',
    'male': 'Male',
    'female': 'Female'
};

function sanitizeMarital(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    if (s.toLowerCase().includes('wrote') || s === '—' || s === '-' || s === 'N/A') return '';
    s = s.replace(/[^\x20-\x7E]/g, '').trim();
    const clean = s.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (clean === 'S' || clean === 'SINGLE' || clean === 'SINGLES') return 'Single';
    if (clean === 'M' || clean === 'MARRIED' || clean === 'MARRIEDM') return 'Married';
    if (clean === 'D' || clean === 'DIVORCED') return 'Divorced';
    if (clean === 'W' || clean === 'WIDOW' || clean === 'WIDOWED') return 'Widowed';
    if (clean === 'C' || clean === 'COHABITING') return 'Cohabiting';
    return '';
}

function sanitizeEdu(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    if (s.toUpperCase() === 'NIL' || s.toUpperCase() === 'NONE' || s === '—' || s === '-' || s === 'N/A') return '';
    s = s.replace(/[^\x20-\x7E]/g, '').trim();
    const clean = s.toUpperCase();
    if (clean === 'J') return 'Junior Secondary';
    if (clean === 'S') return 'Senior Secondary';
    if (clean === 'U' || clean === 'T') return 'Tertiary';
    if (clean === 'P') return 'Primary';
    return s;
}

// Build lookup map from markdown handover files
function loadHandoverParticipantData() {
    const regDir = 'C:/Users/samuk/Documents/Registers';
    const mdFiles = [
        'HFF_Numbered_Registers_Handover.md',
        'HFF_Registers_30-10-2026_Handover.md',
        'HFF_Registers_51_to_200s_Handover_29-10-2026.md'
    ];

    const lookup = new Map();

    for (const f of mdFiles) {
        const fullPath = path.join(regDir, f);
        if (!fs.existsSync(fullPath)) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        let currentReg = '';

        for (const line of lines) {
            const regMatch = line.match(/REGISTER\s+([0-9]+[A-Z]?(?:\s+[A-Z])?)/i);
            if (regMatch && (line.includes('####') || line.includes('###') || line.includes('**REGISTER') || line.includes('| REGISTER'))) {
                currentReg = regMatch[1].trim().toUpperCase();
            }

            if (line.includes('|') && currentReg) {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 9) {
                    const fn = parts[2] || '';
                    const ln = parts[3] || '';
                    const gender = parts[4] || '';
                    const age = parts[5] || '';
                    const contact = parts[6] || '';
                    const edu = parts[7] || '';
                    const marital = parts[8] || '';

                    if (fn && fn !== 'First Name' && !fn.startsWith(':') && !fn.startsWith('---')) {
                        const cleanFn = fn.replace(/[^\w]/g, '').toLowerCase();
                        const cleanLn = ln.replace(/[^\w]/g, '').toLowerCase();
                        const cleanContact = contact.replace(/[^\d]/g, '');

                        const record = {
                            form: currentReg,
                            firstName: fn,
                            lastName: ln,
                            gender,
                            age,
                            contact,
                            education: edu,
                            maritalStatus: marital
                        };

                        if (cleanFn && cleanLn) {
                            lookup.set(`${currentReg}_${cleanFn}_${cleanLn}`, record);
                        }
                        if (cleanContact && cleanContact.length >= 7) {
                            lookup.set(`${currentReg}_${cleanContact}`, record);
                        }
                    }
                }
            }
        }
    }
    return lookup;
}

async function simulateCat3Fixes() {
    console.log("Loading Cat 3 forms and handover lookup...");
    const auditData = JSON.parse(fs.readFileSync('scripts/group_audit_enriched.json', 'utf8'));
    const cat3Forms = new Set(auditData.filter(g => g.category === 3).map(g => g.formNumber.toUpperCase()));
    const handoverLookup = loadHandoverParticipantData();

    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    const cat3Docs = allDocs.filter(d => {
        const fn = (d.group_form_number || d.form_number || '').trim().toUpperCase();
        return cat3Forms.has(fn) && (d.type || '').toLowerCase() !== 'facilitator';
    });

    const plannedUpdates = [];
    let genderFixedCount = 0;
    let maritalFixedCount = 0;
    let maritalClearedCount = 0;
    let eduFixedCount = 0;
    let recoveredFromHandoverCount = 0;

    for (const doc of cat3Docs) {
        const formNum = (doc.group_form_number || doc.form_number || '').trim().toUpperCase();
        const docId = doc.docId;
        const changes = {};

        // 1. Gender standardization
        const rawGender = String(doc.gender || '').trim();
        if (GENDER_MAP[rawGender]) {
            const newGender = GENDER_MAP[rawGender];
            if (newGender !== rawGender) {
                changes.gender = { from: rawGender, to: newGender };
                genderFixedCount++;
            }
        }

        // 2. Marital Status standardization
        let rawMarital = String(doc.marital_status || '').trim();
        
        // Q2 Option B: Form 183 with 'F' in marital status -> clear / Unspecified
        if (formNum === '183' && rawMarital === 'F') {
            changes.marital_status = { from: rawMarital, to: '' };
            maritalClearedCount++;
        } else {
            const newMarital = sanitizeMarital(rawMarital);
            if (newMarital && newMarital !== rawMarital) {
                changes.marital_status = { from: rawMarital, to: newMarital };
                maritalFixedCount++;
            } else if (!rawMarital || rawMarital === '-' || rawMarital === '—') {
                // Check handover lookup (Q4 Option A)
                const cleanFn = String(doc.first_name || '').replace(/[^\w]/g, '').toLowerCase();
                const cleanLn = String(doc.last_name || '').replace(/[^\w]/g, '').toLowerCase();
                const cleanCt = String(doc.contact || '').replace(/[^\d]/g, '');

                const match = handoverLookup.get(`${formNum}_${cleanFn}_${cleanLn}`) || handoverLookup.get(`${formNum}_${cleanCt}`);
                if (match && match.maritalStatus) {
                    const recovered = sanitizeMarital(match.maritalStatus);
                    if (recovered) {
                        changes.marital_status = { from: rawMarital || '[BLANK]', to: recovered, source: 'handover_photo' };
                        recoveredFromHandoverCount++;
                    }
                }
            }
        }

        // 3. Education standardization (Q3 Option A: expand J, S, U, T, P; preserve specific credentials)
        let rawEdu = String(doc.education || '').trim();
        const newEdu = sanitizeEdu(rawEdu);
        if (newEdu && newEdu !== rawEdu) {
            changes.education = { from: rawEdu, to: newEdu };
            eduFixedCount++;
        } else if (!rawEdu || rawEdu === '-' || rawEdu === '—') {
            // Check handover lookup (Q4 Option A)
            const cleanFn = String(doc.first_name || '').replace(/[^\w]/g, '').toLowerCase();
            const cleanLn = String(doc.last_name || '').replace(/[^\w]/g, '').toLowerCase();
            const cleanCt = String(doc.contact || '').replace(/[^\d]/g, '');

            const match = handoverLookup.get(`${formNum}_${cleanFn}_${cleanLn}`) || handoverLookup.get(`${formNum}_${cleanCt}`);
            if (match && match.education) {
                const recovered = sanitizeEdu(match.education);
                if (recovered) {
                    changes.education = { from: rawEdu || '[BLANK]', to: recovered, source: 'handover_photo' };
                    recoveredFromHandoverCount++;
                }
            }
        }

        if (Object.keys(changes).length > 0) {
            plannedUpdates.push({
                docId,
                formNumber: formNum,
                name: `${doc.first_name || ''} ${doc.last_name || ''}`.trim(),
                changes
            });
        }
    }

    console.log("\n=== UPDATED DRY RUN / SIMULATION SUMMARY ===");
    console.log(`Total Participants Checked: ${cat3Docs.length}`);
    console.log(`Records to Update: ${plannedUpdates.length}`);
    console.log(`Gender expansions (M -> Male, F -> Female): ${genderFixedCount}`);
    console.log(`Marital status expansions (S/M/D/W/C): ${maritalFixedCount}`);
    console.log(`Form 183 'F' in marital status cleared: ${maritalClearedCount}`);
    console.log(`Education shorthand expansions (J/S/U/T/P): ${eduFixedCount}`);
    console.log(`Fields recovered from physical register photo notes: ${recoveredFromHandoverCount}`);

    fs.writeFileSync('scripts/cat3_planned_updates.json', JSON.stringify({
        summary: {
            totalParticipants: cat3Docs.length,
            recordsToUpdate: plannedUpdates.length,
            genderFixedCount,
            maritalFixedCount,
            maritalClearedCount,
            eduFixedCount,
            recoveredFromHandoverCount
        },
        sampleUpdates: plannedUpdates.slice(0, 20),
        allUpdates: plannedUpdates
    }, null, 2));

    process.exit(0);
}

simulateCat3Fixes().catch(err => {
    console.error(err);
    process.exit(1);
});
