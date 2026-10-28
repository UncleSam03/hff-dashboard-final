import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import 'fake-indexeddb/auto';
import db from '../src/lib/dexieDb.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22'; // Mochudi Family Building Campaign
const GOOGLE_SHEETS_WEBAPP_URL = process.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

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

// Helper functions for data cleaning
function cleanPhone(raw) {
    if (!raw) return [];
    return raw.replace(/[^0-9/]/g, '').split('/').map(p => p.trim()).filter(p => p.length >= 7);
}

function normalizeName(name) {
    return String(name || '').toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseAge(val) {
    if (!val) return null;
    const clean = String(val).trim();
    if (clean === '' || clean === '-' || clean.toLowerCase() === 'adult' || clean.toLowerCase() === '[blank]') return null;
    const m = clean.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

function parseGender(val) {
    if (!val) return 'F';
    const s = String(val).trim().toUpperCase();
    return s.startsWith('M') ? 'M' : 'F';
}

function cleanString(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (s === '' || s === '-' || s.toLowerCase() === 'nil' || s.toLowerCase() === 'n/a') return null;
    return s;
}

function parseAttendance(datesStr) {
    const att = Array(12).fill(false);
    if (!datesStr) return att;
    const s = String(datesStr).trim();
    if (s.toLowerCase() === 'none') return att;
    if (s.includes('27 Oct')) att[0] = true;
    if (s.includes('28 Oct')) att[1] = true;
    return att;
}

function sanitizeForFirestore(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => item === undefined ? null : sanitizeForFirestore(item));
    }
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            clean[key] = (typeof value === 'object' && value !== null) ? sanitizeForFirestore(value) : value;
        }
    }
    return clean;
}

async function runImport() {
    console.log('===============================================================');
    console.log(' HFF DASHBOARD: NUMBERED REGISTERS 51-201 DATA IMPORT');
    console.log('===============================================================\n');

    // 1. Read Markdown Handover File
    const mdPath = 'HFF_Numbered_Registers_Handover.md';
    if (!fs.existsSync(mdPath)) {
        throw new Error(`File not found: ${mdPath}`);
    }
    const content = fs.readFileSync(mdPath, 'utf8');
    const lines = content.split(/\r?\n/);

    // 2. Parse Markdown Sections
    const registers = [];
    let currentReg = null;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('### ') && line.includes('REGISTER')) {
            currentReg = {
                header: line.replace('### ', '').trim(),
                meta: {},
                activeRows: [],
                crossedRows: []
            };
            registers.push(currentReg);
            inTable = false;
            continue;
        }
        if (!currentReg) continue;

        if (line.startsWith('- **') && line.includes(':**')) {
            const match = line.match(/- \*\*(.*?):\*\*\s*(.*)/);
            if (match) {
                currentReg.meta[match[1].trim()] = match[2].trim();
            }
        }

        if (line.startsWith('| Row |') || line.startsWith('|Row|')) {
            inTable = true;
            continue;
        }

        if (inTable) {
            if (line.startsWith('|---') || line.startsWith('| :---')) continue;
            if (!line.startsWith('|')) {
                inTable = false;
                continue;
            }
            const cells = line.split('|').map(s => s.trim()).slice(1, -1);
            if (cells.length >= 10) {
                const isCrossed = cells.some(c => c.includes('~~')) || (cells[11] && cells[11].toLowerCase().includes('crossed'));
                if (isCrossed) {
                    currentReg.crossedRows.push(cells);
                } else {
                    currentReg.activeRows.push(cells);
                }
            }
        }
    }

    // Filter registers in scope: 51 <= number <= 201
    const inScope = [];
    for (const r of registers) {
        let regNum = null;
        const regMatch = r.header.match(/REGISTER\s+([0-9]+[A-Za-z]?)/i) || 
                         (r.meta['Register No.'] && r.meta['Register No.'].match(/([0-9]+[A-Za-z]?)/));
        if (regMatch) {
            const num = parseInt(regMatch[1], 10);
            if (num >= 51 && num <= 201) {
                inScope.push({ ...r, regNumber: regMatch[1] });
            }
        }
    }

    console.log(`Parsed ${registers.length} total sections across handover document.`);
    console.log(`Identified ${inScope.length} register sections in scope (Registers 51–201).\n`);

    // 3. Fetch all current Firestore records for Mochudi Campaign
    console.log('Connecting to Firebase Firestore and loading current campaign registrations...');
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allExisting = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.campaign_id === CAMPAIGN_ID || !data.campaign_id) {
            allExisting.push({ id: d.id, ...data });
        }
    });

    const existingFacilitators = allExisting.filter(r => r.type === 'facilitator');
    console.log(`Loaded ${allExisting.length} campaign records (${existingFacilitators.length} facilitators) from Firestore.\n`);

    // 4. Match / Create Facilitators for each register group
    // Known manual alias mappings for phone/name variations in physical register headers
    const manualLeaderOverrides = {
        '71779905': '6dbadb29-4619-45cb-b4eb-e987d603923f', // Tseone B. Lemogo -> Tselane Boikhutso Temeki
        '71770905': '6dbadb29-4619-45cb-b4eb-e987d603923f',
        '72775831': 'c306d7af-6750-4c80-b114-650f0fc79ce6', // Olebogeng Tona -> Olebogeng Moyonda
        '72795831': 'c306d7af-6750-4c80-b114-650f0fc79ce6',
        '71374706': '0a337ef0-ce8f-47ea-bd0e-1dcdffb1c369', // Raymond Baiphethi
        '71430259': '0a337ef0-ce8f-47ea-bd0e-1dcdffb1c369', // Kenewang Ramontsho (attached to Raymond Baiphethi group)
        '74884465': 'c4f550f9-dd12-47ca-86aa-19540eccac1c', // Pulafela Pilane (Reg 53)
    };

    const facilitatorMapByReg = new Map(); // key: regKey -> facilitator object
    const updatedFacilitators = new Map(); // key: uuid -> facilitator object
    const createdFacilitators = new Map(); // key: uuid -> facilitator object

    // Track participant counts per facilitator
    const participantCountPerFacilitator = new Map();

    const now = new Date().toISOString();

    for (const r of inScope) {
        // Unique key for sub-groups sharing register numbers
        let groupKey = r.regNumber;
        if (r.header.includes('Sheet')) {
            groupKey = '201'; // All 5 sheets of 201 share Group Leader Raymond Baiphethi
        } else if (r.header.includes('Group 1')) {
            groupKey = `${r.regNumber}_Grp1`;
        } else if (r.header.includes('Group 2')) {
            groupKey = `${r.regNumber}_Grp2`;
        } else if (r.header.includes('Group 3')) {
            groupKey = `${r.regNumber}_Grp3`;
        } else if (r.header.includes('Set A')) {
            groupKey = `${r.regNumber}_SetA`;
        } else if (r.header.includes('Set B')) {
            groupKey = `${r.regNumber}_SetB`;
        } else if (r.header.includes('174 A')) {
            groupKey = '174A';
        } else if (r.header.includes('174 B')) {
            groupKey = '174B';
        } else if (r.header.includes('183 A')) {
            groupKey = '183A';
        } else if (r.header.includes('183 B')) {
            groupKey = '183B';
        }

        const leaderRaw = r.meta['Group Leader'] || '';
        const phoneMatch = leaderRaw.match(/Cell:\s*`?([0-9\s/]+)`?/i) || leaderRaw.match(/([0-9]{7,8})/);
        const phones = cleanPhone(phoneMatch ? phoneMatch[1] : '');
        const namePart = leaderRaw.split('(')[0].replace(/^Blank\s*/i, '').trim();
        const meetingPlace = r.meta['Meeting Place'] || 'Mochudi';
        const meetingTime = r.meta['Meeting Time'] || '';

        // Check if we already assigned a facilitator for this groupKey
        let facilitator = facilitatorMapByReg.get(groupKey);

        if (!facilitator) {
            // Check manual override by phone
            let overrideUuid = null;
            for (const p of phones) {
                if (manualLeaderOverrides[p]) {
                    overrideUuid = manualLeaderOverrides[p];
                    break;
                }
            }

            let matched = null;
            if (overrideUuid) {
                matched = existingFacilitators.find(f => (f.uuid || f.id) === overrideUuid);
            }

            if (!matched && phones.length > 0) {
                matched = existingFacilitators.find(f => {
                    if (f.contact) {
                        const fPhones = cleanPhone(f.contact);
                        return phones.some(p => fPhones.some(fp => fp.includes(p) || p.includes(fp)));
                    }
                    return false;
                });
            }

            if (!matched && namePart) {
                const normTarget = normalizeName(namePart);
                matched = existingFacilitators.find(f => {
                    const fName = normalizeName((f.first_name || '') + ' ' + (f.last_name || ''));
                    if (fName === normTarget) return true;
                    const targetTokens = normTarget.split(' ').filter(t => t.length > 2);
                    const fTokens = fName.split(' ').filter(t => t.length > 2);
                    const overlap = targetTokens.filter(t => fTokens.includes(t));
                    return overlap.length >= 2;
                });
            }

            if (matched) {
                // Update existing facilitator
                const facUuid = matched.uuid || matched.id;
                const existingForm = matched.form_number ? String(matched.form_number).trim() : '';
                let updatedForm = String(r.regNumber);
                if (existingForm && existingForm !== updatedForm && !existingForm.includes(updatedForm)) {
                    updatedForm = `${existingForm}, ${updatedForm}`;
                }

                facilitator = {
                    ...matched,
                    uuid: facUuid,
                    type: 'facilitator',
                    form_number: updatedForm,
                    teaching_group: true,
                    is_daily_core: true,
                    place: meetingPlace,
                    meeting_time: meetingTime,
                    campaign_id: CAMPAIGN_ID,
                    updated_at: now
                };
                updatedFacilitators.set(facUuid, facilitator);
            } else {
                // Create new facilitator
                const newUuid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));
                const nameTokens = namePart.split(/\s+/);
                const firstName = nameTokens[0] || 'Unknown';
                const lastName = nameTokens.slice(1).join(' ') || '';

                facilitator = {
                    uuid: newUuid,
                    first_name: firstName,
                    last_name: lastName,
                    contact: phones[0] || '',
                    type: 'facilitator',
                    form_number: String(r.regNumber),
                    teaching_group: true,
                    is_daily_core: true,
                    place: meetingPlace,
                    meeting_time: meetingTime,
                    campaign_id: CAMPAIGN_ID,
                    attendance: Array(12).fill(false),
                    books_received: false,
                    books_distributed: 0,
                    participants_count: 0,
                    sync_status: 'synced',
                    created_at: now,
                    updated_at: now,
                    submission_source: 'handover_numbered_registers',
                    created_by_name: 'Administrator'
                };
                createdFacilitators.set(newUuid, facilitator);
            }

            facilitatorMapByReg.set(groupKey, facilitator);
        }

        // Add to active count
        const currentCount = participantCountPerFacilitator.get(facilitator.uuid) || 0;
        participantCountPerFacilitator.set(facilitator.uuid, currentCount + r.activeRows.length);
    }

    // Set books_distributed and participants_count on each facilitator
    for (const [facUuid, count] of participantCountPerFacilitator.entries()) {
        if (updatedFacilitators.has(facUuid)) {
            const f = updatedFacilitators.get(facUuid);
            f.books_distributed = count;
            f.participants_count = count;
        }
        if (createdFacilitators.has(facUuid)) {
            const f = createdFacilitators.get(facUuid);
            f.books_distributed = count;
            f.participants_count = count;
        }
    }

    console.log(`Facilitator processing complete:`);
    console.log(` - Existing facilitators updated with form numbers, place, time: ${updatedFacilitators.size}`);
    console.log(` - New facilitators created: ${createdFacilitators.size}\n`);

    // 5. Parse and generate participant records
    const participantsToAdd = [];
    let totalCrossedSkipped = 0;
    let totalDay1Attendance = 0;
    let totalDay2Attendance = 0;

    for (const r of inScope) {
        let groupKey = r.regNumber;
        if (r.header.includes('Sheet')) {
            groupKey = '201';
        } else if (r.header.includes('Group 1')) {
            groupKey = `${r.regNumber}_Grp1`;
        } else if (r.header.includes('Group 2')) {
            groupKey = `${r.regNumber}_Grp2`;
        } else if (r.header.includes('Group 3')) {
            groupKey = `${r.regNumber}_Grp3`;
        } else if (r.header.includes('Set A')) {
            groupKey = `${r.regNumber}_SetA`;
        } else if (r.header.includes('Set B')) {
            groupKey = `${r.regNumber}_SetB`;
        } else if (r.header.includes('174 A')) {
            groupKey = '174A';
        } else if (r.header.includes('174 B')) {
            groupKey = '174B';
        } else if (r.header.includes('183 A')) {
            groupKey = '183A';
        } else if (r.header.includes('183 B')) {
            groupKey = '183B';
        }

        const facilitator = facilitatorMapByReg.get(groupKey);
        if (!facilitator) {
            console.error(`Missing facilitator for register group ${groupKey}`);
            continue;
        }

        const meetingPlace = r.meta['Meeting Place'] || facilitator.place || 'Mochudi';

        totalCrossedSkipped += r.crossedRows.length;

        for (const cells of r.activeRows) {
            const rawFirst = cells[1] || '';
            const rawLast = cells[2] || '';
            const rawGender = cells[3] || 'F';
            const rawAge = cells[4] || '';
            const rawContact = cells[5] || '';
            const rawEdu = cells[6] || '';
            const rawMarital = cells[7] || '';
            const rawAffil = cells[8] || '';
            const rawOcc = cells[9] || '';
            const rawAtt = cells[10] || 'None';

            const attendance = parseAttendance(rawAtt);
            if (attendance[0]) totalDay1Attendance++;
            if (attendance[1]) totalDay2Attendance++;

            const partUuid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));

            const participant = {
                uuid: partUuid,
                first_name: cleanString(rawFirst) || 'Unknown',
                last_name: cleanString(rawLast) || '',
                gender: parseGender(rawGender),
                age: parseAge(rawAge),
                contact: cleanString(rawContact),
                education: cleanString(rawEdu),
                marital_status: cleanString(rawMarital),
                affiliation: cleanString(rawAffil) || meetingPlace,
                occupation: cleanString(rawOcc),
                place: meetingPlace,
                type: 'participant',
                group_form_number: String(r.regNumber),
                facilitator_uuid: facilitator.uuid,
                books_received: true, // 1 participant = 1 book given
                attendance: attendance,
                campaign_id: CAMPAIGN_ID,
                sync_status: 'synced',
                created_at: now,
                updated_at: now,
                submission_source: 'handover_numbered_registers',
                created_by_name: 'Administrator'
            };

            participantsToAdd.push(participant);
        }
    }

    console.log(`Participant generation complete:`);
    console.log(` - Total active participants created: ${participantsToAdd.length}`);
    console.log(` - Total crossed-out rows skipped: ${totalCrossedSkipped}`);
    console.log(` - Day 1 (27 Oct) attendance marked: ${totalDay1Attendance}`);
    console.log(` - Day 2 (28 Oct) attendance marked: ${totalDay2Attendance}`);
    console.log(` - Total books recorded: ${participantsToAdd.length}\n`);

    // 6. Save in Dexie (IndexedDB) in a Transaction
    console.log('Writing records to Dexie (IndexedDB) in a local transaction...');
    await db.open();

    // Populate Dexie with existing records to ensure local cache parity
    await db.transaction('rw', db.registrations, async () => {
        for (const r of allExisting) {
            const count = await db.registrations.where('uuid').equals(r.uuid || r.id).count();
            if (count === 0) {
                await db.registrations.add(r);
            }
        }
    });

    // Execute transaction updating facilitators and adding participants
    await db.transaction('rw', db.registrations, async () => {
        for (const f of updatedFacilitators.values()) {
            const local = await db.registrations.where('uuid').equals(f.uuid).first();
            if (local) {
                await db.registrations.update(local.id, f);
            } else {
                await db.registrations.add(f);
            }
        }
        for (const f of createdFacilitators.values()) {
            await db.registrations.add(f);
        }
        for (const p of participantsToAdd) {
            await db.registrations.add(p);
        }
    });

    const totalDexieCount = await db.registrations.where('campaign_id').equals(CAMPAIGN_ID).count();
    console.log(`Dexie transaction committed successfully. Total Mochudi registrations in Dexie: ${totalDexieCount}\n`);

    // 7. Commit to Firebase Firestore in Batches
    console.log('Syncing all changes to Firebase Firestore in batches (limit <= 400 docs/batch)...');
    const allFirestoreRecords = [
        ...Array.from(updatedFacilitators.values()),
        ...Array.from(createdFacilitators.values()),
        ...participantsToAdd
    ];

    const BATCH_SIZE = 400;
    for (let i = 0; i < allFirestoreRecords.length; i += BATCH_SIZE) {
        const slice = allFirestoreRecords.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const rec of slice) {
            const docRef = doc(firestoreDb, 'registrations', rec.uuid);
            batch.set(docRef, sanitizeForFirestore(rec), { merge: true });
        }
        await batch.commit();
        console.log(` - Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, allFirestoreRecords.length)} / ${allFirestoreRecords.length} records)`);
    }
    console.log('Firestore sync successfully completed!\n');

    // 8. Push Profile Buffer to Google Sheets Web App
    console.log('Pushing buffer to Google Sheets Web App and triggering automatic reconciliation...');
    const bufferPayload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Registers_51_201',
        records: allFirestoreRecords,
        replaceTab: true,
        autoReconcile: true
    };

    try {
        const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bufferPayload)
        });

        if (resp.ok) {
            const sheetRes = await resp.json();
            console.log('Google Sheets Web App response:', JSON.stringify(sheetRes, null, 2));
        } else {
            console.warn(`Google Sheets Web App HTTP ${resp.status}:`, await resp.text());
        }
    } catch (sheetErr) {
        console.error('Google Sheets buffer push warning (non-fatal):', sheetErr.message);
    }

    console.log('\n===============================================================');
    console.log(' IMPORT COMPLETE SUMMARY');
    console.log('===============================================================');
    console.log(`Registers in Scope:          Registers 51–201 (including Register 53)`);
    console.log(`Total Facilitators Updated:  ${updatedFacilitators.size}`);
    console.log(`Total Facilitators Created:  ${createdFacilitators.size}`);
    console.log(`Total Participants Added:    ${participantsToAdd.length}`);
    console.log(`Total Books Given Recorded:  ${participantsToAdd.length}`);
    console.log(`Day 1 (27 Oct) Attendance:   ${totalDay1Attendance}`);
    console.log(`Day 2 (28 Oct) Attendance:   ${totalDay2Attendance}`);
    console.log(`Crossed-out Rows Skipped:    ${totalCrossedSkipped}`);
    console.log('===============================================================\n');

    process.exit(0);
}

runImport().catch(err => {
    console.error('Fatal error during import:', err);
    process.exit(1);
});
