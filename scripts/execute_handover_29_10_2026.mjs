import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22'; // Mochudi Family Building Campaign
const USER_UID = 'E7bGBQslPsafBPovmFoYHiLqxQZ2';
const USER_NAME = 'Samukeliso Mayabane';
const USER_EMAIL = 'samukeliso.mayabane@thehealthyfamilies.net';
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

// Data parsing helpers
function clean(str) {
    if (!str) return '';
    return str.replace(/~~/g, '').trim();
}

function cleanDigits(s) {
    return String(s || '').replace(/\D/g, '').slice(-8);
}

function cleanStr(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
}

function parseAge(val) {
    if (!val) return null;
    const s = clean(val);
    if (!s || s === '-' || s === '—' || s.toLowerCase() === 'nil' || s.toLowerCase() === 'none') return null;
    const m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

function parseGender(val) {
    if (!val) return 'F';
    const s = clean(val).toUpperCase();
    return s.startsWith('M') ? 'M' : 'F';
}

function parseAttendance(val) {
    const att = Array(12).fill(false);
    if (!val) return att;
    const s = clean(val).toLowerCase();
    if (s.includes('27 oct') || s.includes('27')) att[0] = true;
    if (s.includes('28 oct') || s.includes('28')) att[1] = true;
    if (s.includes('29 oct') || s.includes('29')) att[2] = true;
    if (s.includes('30 oct') || s.includes('30')) att[3] = true;
    return att;
}

async function runHandover() {
    console.log("==================================================================");
    console.log(" STARTING 29 OCTOBER 2026 HANDOVER IMPORT & UPDATE PIPELINE");
    console.log("==================================================================\n");

    const now = new Date().toISOString();

    // 1. Fetch current database state
    console.log("1. Fetching all registrations from Firestore...");
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    console.log(`Retrieved ${allDocs.length} total registration documents from Firestore.`);

    const facilitators = allDocs.filter(d => d.type === 'facilitator' && !d.is_deleted);
    const participants = allDocs.filter(d => d.type === 'participant' && !d.is_deleted);
    console.log(`Active Facilitators: ${facilitators.length}, Active Participants: ${participants.length}\n`);

    // Helper to find facilitator
    function findFacilitator(formNum, phone, name) {
        const formClean = String(formNum || '').replace(/\D/g, '');
        const p8 = cleanDigits(phone);
        const nameTokens = cleanStr(name).split(' ').filter(t => t.length > 2);

        // 1. Exact form number match
        if (formClean) {
            const byForm = facilitators.find(f => String(f.form_number || '').replace(/\D/g, '') === formClean);
            if (byForm) return byForm;
        }

        // 2. Exact phone match (8 digits)
        if (p8 && p8.length >= 7) {
            const byPhone = facilitators.find(f => cleanDigits(f.contact) === p8);
            if (byPhone) return byPhone;
        }

        // 3. Name tokens match
        if (nameTokens.length >= 2) {
            const byName = facilitators.find(f => {
                const fNameTokens = cleanStr(`${f.first_name || ''} ${f.last_name || ''}`).split(' ');
                const matches = nameTokens.filter(t => fNameTokens.includes(t));
                return matches.length >= 2;
            });
            if (byName) return byName;
        }

        return null;
    }

    const docsToUpsert = new Map();
    const docsToDelete = new Set();

    // ==================================================================
    // STEP 0: PRE-MERGES (Lebogang, Bojelo, Daphney)
    // ==================================================================
    console.log("2. Executing duplicate pre-merges (Lebogang, Bojelo, Daphney)...");

    // Lebogang
    const leboMaster = allDocs.find(d => (d.uuid || d.docId) === '3ccca050-ff74-4b21-af42-cde4140f6415');
    const leboDupe = allDocs.find(d => (d.uuid || d.docId) === '00b5d86f-ff93-446c-9e6e-1859b789ee38');
    if (leboMaster && leboDupe) {
        docsToUpsert.set(leboMaster.uuid, {
            ...leboMaster,
            form_number: '106',
            place: 'BOSEJA BEHIND IPCC',
            meeting_time: '17:00 - 18:30',
            teaching_group: true,
            is_daily_core: true,
            participants_count: 12,
            books_distributed: 12,
            updated_at: now
        });
        docsToDelete.add(leboDupe.uuid);
        // Re-link participants
        allDocs.filter(d => d.group_form_number === '106' || d.facilitator_uuid === leboDupe.uuid).forEach(p => {
            docsToUpsert.set(p.uuid, {
                ...p,
                facilitator_uuid: leboMaster.uuid,
                updated_at: now
            });
        });
        console.log(" - Merged Lebogang Doreen Makgale and re-linked Form 106 participants.");
    }

    // Bojelo
    const bojeloMaster = allDocs.find(d => (d.uuid || d.docId) === '2140e009-87d9-47ed-85a0-b48d7d4dd1d1');
    const bojeloDupe = allDocs.find(d => (d.uuid || d.docId) === '76fd9f34-33fd-4838-a50b-b8c24b7af80d');
    if (bojeloMaster && bojeloDupe) {
        docsToDelete.add(bojeloDupe.uuid);
        console.log(" - Soft-deleted redundant Mmakgabo Bojelo onboarding record.");
    }

    // Daphney
    const daphneyMaster = allDocs.find(d => (d.uuid || d.docId) === 'bd82b66d-765a-42cf-b3a8-d13128224ede');
    const daphneyDupe = allDocs.find(d => (d.uuid || d.docId) === '26d677e8-efe6-4033-a23b-4dc0d957a71d');
    if (daphneyMaster && daphneyDupe) {
        docsToDelete.add(daphneyDupe.uuid);
        console.log(" - Soft-deleted duplicate Daphney chabuya record.");
    }

    // ==================================================================
    // STEP 1: PARSE HANDOVER FILE
    // ==================================================================
    console.log("\n3. Parsing handover document c:/Users/samuk/Documents/Registers/HFF_Registers_51_to_200s_Handover_29-10-2026.md...");
    const mdPath = 'c:/Users/samuk/Documents/Registers/HFF_Registers_51_to_200s_Handover_29-10-2026.md';
    const text = fs.readFileSync(mdPath, 'utf8');
    const lines = text.split('\n');

    let sec2Start = -1;
    let sec3Start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## 2. Part A')) sec2Start = i;
        if (lines[i].startsWith('## 3. Part B')) sec3Start = i;
    }

    // --- Parse Part A ---
    const partARegisters = {};
    let currentReg = null;

    for (let i = sec2Start; i < sec3Start; i++) {
        const line = lines[i];
        if (line.includes('REGISTER ')) {
            const m = line.match(/REGISTER\s+(\d+[A-Za-z]?)/i);
            if (m && line.startsWith('####')) {
                currentReg = m[1].toUpperCase();
                if (!partARegisters[currentReg]) {
                    partARegisters[currentReg] = {
                        formNumber: currentReg,
                        leader: '',
                        cell: '',
                        secondLeader: '',
                        secondCell: '',
                        place: '',
                        time: '',
                        participants: []
                    };
                }
            }
        }

        if (currentReg && partARegisters[currentReg]) {
            if (line.includes('**Group Leader:**')) {
                const mLeader = line.match(/\*\*Group Leader:\*\*\s*`?([^`|\(]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)]+)`?\))?/i);
                if (mLeader) {
                    partARegisters[currentReg].leader = mLeader[1].trim();
                    if (mLeader[2]) partARegisters[currentReg].cell = mLeader[2].trim();
                }
            }
            if (line.includes('**Second Leader:**')) {
                const mSec = line.match(/\*\*Second Leader:\*\*\s*`?([^`|\(]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)]+)`?\))?/i);
                if (mSec && !mSec[1].toLowerCase().includes('none') && !mSec[1].includes('—')) {
                    partARegisters[currentReg].secondLeader = mSec[1].trim();
                    if (mSec[2]) partARegisters[currentReg].secondCell = mSec[2].trim();
                }
            }
            if (line.includes('**Meeting Place:**')) {
                const mPlace = line.match(/\*\*Meeting Place:\*\*\s*`?([^`|\(]+)`?(?:\s*\(`?([^`\)]+)`?\))?/i);
                if (mPlace) {
                    partARegisters[currentReg].place = mPlace[1].trim();
                    if (mPlace[2]) partARegisters[currentReg].time = mPlace[2].trim();
                }
            }
            if (line.includes('**Meeting Time:**')) {
                const mTime = line.match(/\*\*Meeting Time:\*\*\s*`?([^`\n]+)`?/i);
                if (mTime) {
                    partARegisters[currentReg].time = mTime[1].trim();
                }
            }

            // Table rows
            if (line.trim().startsWith('|') && !line.includes('First Name') && !line.includes(':---') && !line.includes('Register / Form No.')) {
                const cells = line.split('|').map(c => c.trim());
                if (cells.length >= 12 && /^\d+/.test(cells[1])) {
                    if (cells[2].includes('~~') || line.includes('crossed out') || line.includes('STRUCK THROUGH')) {
                        // skip crossed out
                    } else {
                        partARegisters[currentReg].participants.push({
                            row: cells[1],
                            first_name: clean(cells[2]),
                            last_name: clean(cells[3]) === '—' || clean(cells[3]) === '-' ? '' : clean(cells[3]),
                            gender: parseGender(cells[4]),
                            age: parseAge(cells[5]),
                            contact: clean(cells[6]) === '—' || clean(cells[6]) === '-' ? '' : clean(cells[6]),
                            education: clean(cells[7]) === '—' || clean(cells[7]) === '-' ? '' : clean(cells[7]),
                            marital_status: clean(cells[8]) === '—' || clean(cells[8]) === '-' ? '' : clean(cells[8]),
                            affiliation: clean(cells[9]) === '—' || clean(cells[9]) === '-' ? '' : clean(cells[9]),
                            occupation: clean(cells[10]) === '—' || clean(cells[10]) === '-' ? '' : clean(cells[10]),
                            attendance: parseAttendance(cells[11])
                        });
                    }
                }
            }
        }
    }

    console.log(`Parsed ${Object.keys(partARegisters).length} Part A Register Groups.`);

    // ==================================================================
    // STEP 2: IMPORT PART A REGISTERS
    // ==================================================================
    console.log("\n4. Ingesting Part A Brand-New Registers (57–221)...");
    let totalPartANewParticipants = 0;

    for (const [formNum, regData] of Object.entries(partARegisters)) {
        // Find or create facilitator
        let fac = findFacilitator(formNum, regData.cell, regData.leader);
        const facUuid = fac ? fac.uuid : crypto.randomUUID();

        const leaderNameParts = regData.leader.trim().split(/\s+/);
        const facFirstName = leaderNameParts.slice(0, -1).join(' ') || leaderNameParts[0];
        const facLastName = leaderNameParts.length > 1 ? leaderNameParts[leaderNameParts.length - 1] : '';

        const facRecord = {
            id: fac?.id || undefined,
            uuid: facUuid,
            type: 'facilitator',
            first_name: fac?.first_name || facFirstName,
            last_name: fac?.last_name || facLastName,
            contact: regData.cell || fac?.contact || '',
            form_number: String(formNum),
            place: regData.place || fac?.place || 'Mochudi',
            meeting_time: regData.time || fac?.meeting_time || '',
            teaching_group: true,
            is_daily_core: true,
            second_leader_name: regData.secondLeader || fac?.second_leader_name || '',
            second_leader_contact: regData.secondCell || fac?.second_leader_contact || '',
            campaign_id: CAMPAIGN_ID,
            created_by_uid: fac?.created_by_uid || USER_UID,
            created_by_name: fac?.created_by_name || USER_NAME,
            created_by_email: fac?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: fac?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            participants_count: regData.participants.length,
            books_distributed: regData.participants.length
        };
        docsToUpsert.set(facUuid, facRecord);

        // Add participants
        for (const p of regData.participants) {
            const pUuid = crypto.randomUUID();
            const pRecord = {
                uuid: pUuid,
                type: 'participant',
                first_name: p.first_name,
                last_name: p.last_name,
                gender: p.gender,
                age: p.age,
                contact: p.contact,
                education: p.education,
                marital_status: p.marital_status,
                affiliation: p.affiliation,
                occupation: p.occupation,
                place: regData.place || 'Mochudi',
                group_form_number: String(formNum),
                facilitator_uuid: facUuid,
                books_received: true,
                attendance: p.attendance,
                campaign_id: CAMPAIGN_ID,
                created_by_uid: USER_UID,
                created_by_name: USER_NAME,
                created_by_email: USER_EMAIL,
                updated_by_uid: USER_UID,
                updated_by_name: USER_NAME,
                updated_by_email: USER_EMAIL,
                created_at: now,
                updated_at: now,
                sync_status: 'synced',
                is_deleted: false
            };
            docsToUpsert.set(pUuid, pRecord);
            totalPartANewParticipants++;
        }
        console.log(` - Form ${formNum}: Facilitator ${facRecord.first_name} ${facRecord.last_name} (${facUuid.slice(0, 8)}) with ${regData.participants.length} participants.`);
    }
    console.log(`Part A Ingestion Complete: ${totalPartANewParticipants} active participants created across ${Object.keys(partARegisters).length} register groups.\n`);

    // ==================================================================
    // STEP 3: APPLY PART B UPDATES TO EXISTING REGISTERS (53–220)
    // ==================================================================
    console.log("5. Ingesting Part B Updates, New Pages, Crossed-Out Removals & Attendance...");

    // Helper to find participant in active list
    function findParticipant(formNum, firstName, lastName, contact) {
        const cleanFn = cleanStr(firstName);
        const cleanLn = cleanStr(lastName);
        const p8 = cleanDigits(contact);

        return allDocs.find(d => {
            if (d.type !== 'participant' || d.is_deleted) return false;
            const gf = String(d.group_form_number || d.form_number || '').replace(/\D/g, '');
            if (gf !== String(formNum).replace(/\D/g, '')) return false;

            const fn = cleanStr(d.first_name);
            const ln = cleanStr(d.last_name);
            const ph = cleanDigits(d.contact);

            if (p8 && ph && p8.length >= 7 && p8 === ph) return true;
            if (cleanFn && cleanLn && fn === cleanFn && ln === cleanLn) return true;
            if (cleanFn && fn === cleanFn) return true;
            return false;
        });
    }

    // --- B1: REGISTER 129 -> REGISTER 128 ---
    console.log(" - Applying REGISTER 129 -> 128 (Wildlife Office)...");
    const fac128 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && (d.form_number === '129' || d.form_number === '128' || cleanDigits(d.contact) === '77326267'));
    const fac128Uuid = fac128 ? fac128.uuid : crypto.randomUUID();
    docsToUpsert.set(fac128Uuid, {
        ...(fac128 || {}),
        uuid: fac128Uuid,
        type: 'facilitator',
        first_name: 'Boago',
        last_name: 'Letshoo',
        contact: '77326267',
        form_number: '128',
        place: 'Wildlife Office',
        meeting_time: '14:00',
        second_leader_name: 'Wabo Venda',
        second_leader_contact: '74406246',
        teaching_group: true,
        is_daily_core: true,
        participants_count: 19,
        books_distributed: 19,
        campaign_id: CAMPAIGN_ID,
        updated_at: now
    });

    // Update existing 129 participants to 128 and add rows 12-19
    const reg128Rows = [
        { row: 1, first: 'Buang S', last: 'Rakhudu', gender: 'M', age: 51, contact: '72290783', edu: 'JC', mar: 'S', aff: 'Wildlife', occ: 'APO', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 2, first: 'Modiane T', last: 'Peolwane', gender: 'F', age: 47, contact: '74282037', edu: 'JC', mar: 'S', aff: 'Wildlife', occ: 'cleaner', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 3, first: 'Lethabo P', last: 'Moatlhodi', gender: 'F', age: 28, contact: '75097972', edu: 'BGCSE', mar: 'S', aff: 'Wildlife', occ: 'Attachment', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 4, first: 'Kopo', last: 'Montgomeri', gender: 'M', age: 40, contact: '75850417', edu: 'MED', mar: 'S', aff: 'Wildlife', occ: 'Lecture 1', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 5, first: 'Kelebogile', last: 'Mlangeni', gender: 'F', age: 55, contact: '71585331', edu: 'PSLE', mar: 'S', aff: 'Wildlife', occ: 'Messenger', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 6, first: 'Ofentse', last: 'Gotswakgosi', gender: 'F', age: 57, contact: '72504696', edu: 'University', mar: 'M', aff: 'Wildlife', occ: 'SWW', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 7, first: 'Banabotlhe N', last: 'Kobe', gender: 'F', age: 54, contact: '74386515', edu: 'University', mar: 'M', aff: 'Wildlife', occ: 'SWW', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 8, first: 'Swaratlhe S', last: 'Setshwane', gender: 'M', age: 47, contact: '77973266', edu: 'Certificate', mar: 'M', aff: 'Wildlife', occ: 'SWR II', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 9, first: 'Thabang K', last: 'Mokgatlhane', gender: 'F', age: 46, contact: '71784707', edu: 'JC', mar: 'M', aff: 'Wildlife', occ: 'cleaner', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 10, first: 'Mmoloki', last: 'Sentsho', gender: 'M', age: 37, contact: '76337469', edu: 'JC', mar: 'S', aff: 'Wildlife', occ: 'Groundsman', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 11, first: 'Oarabile L', last: 'Machobane', gender: 'M', age: 31, contact: '72892504', edu: 'JC', mar: 'S', aff: 'Wildlife', occ: 'Groundsman', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 12, first: 'Tebogo', last: 'Baoki', gender: 'F', age: 41, contact: '74124554', edu: 'University', mar: 'S', aff: 'Wildlife', occ: 'SWO', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 13, first: 'Lesego', last: 'Kgopa', gender: 'M', age: 52, contact: '72595171', edu: 'College', mar: 'M', aff: 'Wildlife', occ: 'SWR II', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 14, first: 'Rapelang', last: '', gender: 'F', age: 42, contact: '72535553', edu: 'University', mar: 'M', aff: 'Wildlife', occ: 'AAO', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 15, first: 'Wametsi', last: 'Obonetse', gender: 'F', age: 38, contact: '72222939', edu: 'University', mar: 'S', aff: 'Wildlife', occ: 'Wildlife Officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 16, first: 'Mooketsi', last: 'Ramonogana', gender: 'M', age: 54, contact: '77088216', edu: 'JC', mar: 'S', aff: 'Wildlife', occ: 'Nightwatchman', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 17, first: 'Kabo', last: 'Molepolole', gender: 'M', age: 47, contact: '71560076', edu: 'College', mar: 'M', aff: 'Wildlife', occ: 'SWR II', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 18, first: 'Karabo', last: 'Matane', gender: 'M', age: 40, contact: '72279234', edu: 'College', mar: 'S', aff: 'Wildlife', occ: 'SWR II', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { row: 19, first: 'Steve', last: 'Ditau', gender: 'M', age: 46, contact: '72870316', edu: 'College', mar: 'M', aff: 'Wildlife', occ: 'WO I', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
    ];

    for (const r of reg128Rows) {
        const existingP = findParticipant('129', r.first, r.last, r.contact) || findParticipant('128', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'Wildlife Office',
            group_form_number: '128',
            facilitator_uuid: fac128Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B2: REGISTER 53 ---
    console.log(" - Ingesting REGISTER 53 (Pulafela Pilane)...");
    const fac53 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && (d.form_number === '53' || cleanDigits(d.contact) === '74884465'));
    const fac53Uuid = fac53 ? fac53.uuid : crypto.randomUUID();
    docsToUpsert.set(fac53Uuid, {
        ...(fac53 || {}),
        uuid: fac53Uuid,
        type: 'facilitator',
        first_name: 'Pulafela',
        last_name: 'Pilane',
        contact: '74884465',
        form_number: '53',
        place: 'Pulafela Home (Mabodisa)',
        meeting_time: '16:00 - 16:45',
        teaching_group: true,
        is_daily_core: true,
        participants_count: 8,
        books_distributed: 8,
        campaign_id: CAMPAIGN_ID,
        updated_at: now
    });

    const reg53Rows = [
        { first: 'Thuto Desmond', last: 'Tlhase', gender: 'M', age: 23, contact: '72282521', edu: 'BGCSE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Agang Theko K.', last: 'Motlotle', gender: 'M', age: 26, contact: '72667253', edu: 'BGCSE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Ame Alicia', last: 'Tlhase', gender: 'F', age: 18, contact: '72732407', edu: 'BGCSE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Onalenna', last: 'Tlhase', gender: 'F', age: 43, contact: '72638098', edu: 'JCE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Lucy Baboloki', last: 'Buisanyang', gender: 'F', age: 44, contact: '76025656', edu: 'JCE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Tsholofelo', last: 'Rakereng', gender: 'F', age: 30, contact: '71852660', edu: 'JCE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Boitumelo Sophie', last: 'Modikwa', gender: 'F', age: 41, contact: '76230682', edu: 'JCE', mar: 'Married', occ: 'Unemployed', att: [true, false, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Tebo Calsiers', last: 'Tlhase', gender: 'M', age: 25, contact: '78094286', edu: 'BGCSE', mar: 'Single', occ: 'Unemployed', att: [true, true, false, false, false, false, false, false, false, false, false, false] }
    ];

    for (const r of reg53Rows) {
        const existingP = findParticipant('53', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: '',
            occupation: r.occ,
            place: 'Pulafela Home (Mabodisa)',
            group_form_number: '53',
            facilitator_uuid: fac53Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B3: REGISTER 54 (+Rows 12-14, Attendance) ---
    console.log(" - Updating REGISTER 54...");
    const fac54 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '54');
    const fac54Uuid = fac54 ? fac54.uuid : crypto.randomUUID();
    docsToUpsert.set(fac54Uuid, {
        ...(fac54 || {}),
        uuid: fac54Uuid,
        form_number: '54',
        second_leader_name: 'Matlhogonolo Letsebe',
        second_leader_contact: '76994577',
        participants_count: 14,
        books_distributed: 14,
        updated_at: now
    });
    // Attendance on existing rows 1-4, 8-11:
    const parts54 = allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '54');
    parts54.forEach((p, idx) => {
        // Rows 5 (Sekgabo Modise), 6 (Bofelo Motshegwe), 7 (Tshepiso Linchwe) stay Day 1 only
        const name = cleanStr(p.first_name);
        const newAtt = [...(p.attendance || Array(12).fill(false))];
        if (name.includes('sekgabo') || name.includes('bofelo') || name.includes('tshepiso')) {
            newAtt[0] = true;
            newAtt[1] = false;
        } else {
            newAtt[0] = true;
            newAtt[1] = true;
        }
        docsToUpsert.set(p.uuid, { ...p, attendance: newAtt, updated_at: now });
    });
    // Add Rows 12-14
    const new54Rows = [
        { first: 'Matlhogonolo', last: 'Letsebe', gender: 'F', age: 30, contact: '76994577', edu: 'BGCSE', mar: 'S', aff: 'unemployed', occ: '', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Mariam', last: 'Matenga', gender: 'F', age: 35, contact: '73640129', edu: 'BGCSE', mar: 'SINGLE', aff: 'NIL', occ: 'UNEMPLOYED', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Samuel', last: 'Mokonyane', gender: 'M', age: 63, contact: '71255302', edu: 'STD 7', mar: 'SINGLE', aff: '', occ: 'UNEMPLOYED', att: [false, true, false, false, false, false, false, false, false, false, false, false] }
    ];
    for (const r of new54Rows) {
        const existingP = findParticipant('54', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'Lone home Mabodisa',
            group_form_number: '54',
            facilitator_uuid: fac54Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B4: REGISTER 63 (Attendance Day 2 on all rows) ---
    console.log(" - Updating REGISTER 63 attendance...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '63').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B5: REGISTER 72 (+Rows 13-15) ---
    console.log(" - Updating REGISTER 72 (+Rows 13-15)...");
    const fac72 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '72');
    const fac72Uuid = fac72 ? fac72.uuid : crypto.randomUUID();
    docsToUpsert.set(fac72Uuid, {
        ...(fac72 || {}),
        uuid: fac72Uuid,
        form_number: '72',
        participants_count: 15,
        books_distributed: 15,
        updated_at: now
    });
    const new72Rows = [
        { first: 'Theo Carlisters', last: 'Seleke', gender: 'M', age: 23, contact: '72931410', edu: 'Tertiary', mar: 'S', aff: 'VDC', occ: '', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Tebogo', last: 'Kotsedi', gender: 'M', age: 20, contact: '77972796', edu: 'BGCSE', mar: 'S', aff: 'Ikageng', occ: '', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Katlego Brigdet', last: 'Lebekwe', gender: 'F', age: 20, contact: '72521707', edu: 'BGCSE', mar: 'S', aff: 'Ikageng', occ: '', att: [false, true, false, false, false, false, false, false, false, false, false, false] }
    ];
    for (const r of new72Rows) {
        const existingP = findParticipant('72', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'VDC Offices Moganetsi Kgotla',
            group_form_number: '72',
            facilitator_uuid: fac72Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B6: REGISTER 73 (Remove Row 8 Bokang Kgaupe, Add Row 11 Mmathapelo Tsele, Attendance) ---
    console.log(" - Updating REGISTER 73 (remove Row 8, add Row 11)...");
    const bokang73 = allDocs.find(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '73' && (cleanStr(d.first_name).includes('bokang') || cleanDigits(d.contact) === '76492796'));
    if (bokang73) docsToDelete.add(bokang73.uuid);

    const fac73 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '73');
    const fac73Uuid = fac73 ? fac73.uuid : crypto.randomUUID();
    docsToUpsert.set(fac73Uuid, {
        ...(fac73 || {}),
        uuid: fac73Uuid,
        form_number: '73',
        participants_count: 10,
        books_distributed: 10,
        updated_at: now
    });
    // Attendance on existing 73 rows
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '73' && d.uuid !== bokang73?.uuid).forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        const name = cleanStr(p.first_name);
        if (name.includes('bontle')) {
            att[0] = true;
            att[1] = false;
        } else {
            att[0] = true;
            att[1] = true;
        }
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    // Add Row 11
    const p73_11 = findParticipant('73', 'Mmathapelo', 'Tsele', '71505097');
    const p73_11Uuid = p73_11 ? p73_11.uuid : crypto.randomUUID();
    docsToUpsert.set(p73_11Uuid, {
        ...(p73_11 || {}),
        uuid: p73_11Uuid,
        type: 'participant',
        first_name: 'Mmathapelo',
        last_name: 'Tsele',
        gender: 'F',
        age: 40,
        contact: '71505097',
        education: 'BGCSE',
        marital_status: 'S',
        affiliation: 'N/A',
        occupation: 'KDC',
        place: 'Masiana Kgotla',
        group_form_number: '73',
        facilitator_uuid: fac73Uuid,
        books_received: true,
        attendance: [true, true, false, false, false, false, false, false, false, false, false, false],
        campaign_id: CAMPAIGN_ID,
        created_by_uid: p73_11?.created_by_uid || USER_UID,
        created_by_name: p73_11?.created_by_name || USER_NAME,
        created_by_email: p73_11?.created_by_email || USER_EMAIL,
        updated_by_uid: USER_UID,
        updated_by_name: USER_NAME,
        updated_by_email: USER_EMAIL,
        created_at: p73_11?.created_at || now,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false
    });

    // --- B7: REGISTER 85 (Attendance + Row 1 occupation) ---
    console.log(" - Updating REGISTER 85...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '85').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        const occ = cleanStr(p.first_name).includes('mmamasedinyane') ? 'Cluster' : (p.occupation || '');
        docsToUpsert.set(p.uuid, { ...p, attendance: att, occupation: occ, updated_at: now });
    });

    // --- B8: REGISTER 104 (+Rows 13-16) ---
    console.log(" - Updating REGISTER 104 (+Rows 13-16)...");
    const fac104 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '104');
    const fac104Uuid = fac104 ? fac104.uuid : crypto.randomUUID();
    docsToUpsert.set(fac104Uuid, {
        ...(fac104 || {}),
        uuid: fac104Uuid,
        form_number: '104',
        participants_count: 16,
        books_distributed: 16,
        updated_at: now
    });
    const new104Rows = [
        { first: 'Ofentse', last: 'Motshegare', gender: 'M', age: 20, contact: '77905097', edu: 'BGCSE', mar: 'Single', aff: 'Boseja Ward', occ: '', att: Array(12).fill(false) },
        { first: 'Abel', last: 'Mathibe', gender: 'M', age: 23, contact: '77474014', edu: 'BGCSE', mar: 'Single', aff: 'Boseja Ward', occ: '', att: Array(12).fill(false) },
        { first: 'Gakenkope', last: 'Mathibe', gender: 'F', age: 43, contact: '71292239', edu: 'JC', mar: 'M', aff: 'Boseja Ward', occ: '', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Josephine', last: 'Moeketsi', gender: 'F', age: 74, contact: '71582222', edu: 'BGCSE', mar: 'Single', aff: 'Boseja Ward', occ: '', att: Array(12).fill(false) }
    ];
    for (const r of new104Rows) {
        const existingP = findParticipant('104', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'Boseja',
            group_form_number: '104',
            facilitator_uuid: fac104Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B9: REGISTER 108 (Attendance) ---
    console.log(" - Updating REGISTER 108 attendance...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '108').forEach(p => {
        const fn = cleanStr(p.first_name);
        const att = [...(p.attendance || Array(12).fill(false))];
        // Rows 1, 3, 4, 6, 7, 8 now 27, 28 Oct; Rows 2 & 9 stay 27 Oct; Row 5 None
        if (fn.includes('laura') || fn.includes('matlhogonolo')) {
            att[0] = true;
            att[1] = false;
        } else if (fn.includes('masego')) {
            // Row 5 stays none
            att[0] = false;
            att[1] = false;
        } else {
            att[0] = true;
            att[1] = true;
        }
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B10: REGISTER 116 (Attendance) ---
    console.log(" - Updating REGISTER 116 attendance...");
    // 14 of 19 rows marked 28 Oct
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '116').forEach(p => {
        const fn = cleanStr(p.first_name);
        const att = [...(p.attendance || Array(12).fill(false))];
        // Rows 2, 10, 13, 14, 17 stay 27 Oct only
        if (fn.includes('onkamile') || fn.includes('abigail') || fn.includes('amogelang') || fn.includes('tshepang') || fn.includes('lesego')) {
            att[0] = true;
            att[1] = false;
        } else {
            att[0] = true;
            att[1] = true;
        }
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B11: REGISTER 121 (Attendance + Affiliation + Occupation) ---
    console.log(" - Updating REGISTER 121 (attendance, IKAGENG, CLEANING)...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '121').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, {
            ...p,
            attendance: att,
            affiliation: 'IKAGENG',
            occupation: 'CLEANING',
            updated_at: now
        });
    });

    // --- B12: REGISTER 132 (+Rows 6-10, Attendance, Time) ---
    console.log(" - Updating REGISTER 132...");
    const fac132 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '132');
    const fac132Uuid = fac132 ? fac132.uuid : crypto.randomUUID();
    docsToUpsert.set(fac132Uuid, {
        ...(fac132 || {}),
        uuid: fac132Uuid,
        form_number: '132',
        meeting_time: '14:00 HRS',
        participants_count: 10,
        books_distributed: 10,
        updated_at: now
    });
    // Rows 1-5 attendance
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '132').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    // Add Rows 6-10
    const new132Rows = [
        { first: 'Tlhaka', last: 'Letsholo', gender: 'F', age: 57, contact: '71716729', edu: 'Edu Degree', mar: 'M', aff: 'Lecturer', occ: 'Lecturer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Magdeline', last: 'Masilo', gender: 'F', age: 60, contact: '', edu: 'Junior Certificate', mar: 'S', aff: '', occ: "Supply's Office", att: Array(12).fill(false) },
        { first: 'Seitlhedi', last: 'Phiri', gender: 'F', age: 68, contact: '74312474', edu: 'STD 7', mar: 'M', aff: 'unemployed', occ: 'Farmer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Boikhutso', last: 'Masire', gender: 'F', age: 58, contact: '74654366', edu: 'Form 3', mar: 'S', aff: 'unemployed', occ: 'Farmer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Mankobi', last: 'Ramosai', gender: 'F', age: 74, contact: '75260407', edu: 'Std 7', mar: 'Widow', aff: 'unemployed', occ: 'Farmer', att: [false, true, false, false, false, false, false, false, false, false, false, false] }
    ];
    for (const r of new132Rows) {
        const existingP = findParticipant('132', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'MAKGOPHANA',
            group_form_number: '132',
            facilitator_uuid: fac132Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B13: REGISTER 136 (Attendance) ---
    console.log(" - Updating REGISTER 136 attendance...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '136').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B14: REGISTER 143 (Grps 1, 2, 3 - Attendance on all 37 rows) ---
    console.log(" - Updating REGISTER 143 attendance on all 37 rows...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && (d.group_form_number === '143' || d.form_number === '143')).forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B15: REGISTER 159 (Attendance on all 12 rows) ---
    console.log(" - Updating REGISTER 159 attendance on all 12 rows...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '159').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B16: REGISTER 172 (Sets A & B - Add Row 16 Set B, Attendance on all 32 rows) ---
    console.log(" - Updating REGISTER 172 Sets A & B...");
    const fac172 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '172');
    const fac172Uuid = fac172 ? fac172.uuid : crypto.randomUUID();
    docsToUpsert.set(fac172Uuid, {
        ...(fac172 || {}),
        uuid: fac172Uuid,
        form_number: '172',
        participants_count: 32,
        books_distributed: 32,
        updated_at: now
    });
    // Attendance on existing rows
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '172').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    // Add Row 16 Set B
    const p172_16 = findParticipant('172', 'Amantle', 'Ditlole', '77809070');
    const p172_16Uuid = p172_16 ? p172_16.uuid : crypto.randomUUID();
    docsToUpsert.set(p172_16Uuid, {
        ...(p172_16 || {}),
        uuid: p172_16Uuid,
        type: 'participant',
        first_name: 'Amantle',
        last_name: 'Ditlole',
        gender: 'F',
        age: 27,
        contact: '77809070',
        education: 'JC',
        marital_status: 'Single',
        affiliation: 'Rankoa P. Sch Malolwane',
        occupation: 'TSP',
        place: 'Kgotla / School',
        group_form_number: '172',
        facilitator_uuid: fac172Uuid,
        books_received: true,
        attendance: [true, true, false, false, false, false, false, false, false, false, false, false],
        campaign_id: CAMPAIGN_ID,
        created_by_uid: p172_16?.created_by_uid || USER_UID,
        created_by_name: p172_16?.created_by_name || USER_NAME,
        created_by_email: p172_16?.created_by_email || USER_EMAIL,
        updated_by_uid: USER_UID,
        updated_by_name: USER_NAME,
        updated_by_email: USER_EMAIL,
        created_at: p172_16?.created_at || now,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false
    });

    // --- B17: REGISTER 182 (+Row 10, Attendance on Rows 1-9) ---
    console.log(" - Updating REGISTER 182...");
    const fac182 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '182');
    const fac182Uuid = fac182 ? fac182.uuid : crypto.randomUUID();
    docsToUpsert.set(fac182Uuid, {
        ...(fac182 || {}),
        uuid: fac182Uuid,
        form_number: '182',
        participants_count: 10,
        books_distributed: 10,
        updated_at: now
    });
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '182').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    const p182_10 = findParticipant('182', 'Meshack', 'Musonda', '73325514');
    const p182_10Uuid = p182_10 ? p182_10.uuid : crypto.randomUUID();
    docsToUpsert.set(p182_10Uuid, {
        ...(p182_10 || {}),
        uuid: p182_10Uuid,
        type: 'participant',
        first_name: 'Meshack',
        last_name: 'Musonda',
        gender: 'M',
        age: 26,
        contact: '73325514',
        education: '',
        marital_status: 'M',
        affiliation: '',
        occupation: '',
        place: 'Plot 10226 Phaphane',
        group_form_number: '182',
        facilitator_uuid: fac182Uuid,
        books_received: true,
        attendance: [false, true, false, false, false, false, false, false, false, false, false, false],
        campaign_id: CAMPAIGN_ID,
        created_by_uid: p182_10?.created_by_uid || USER_UID,
        created_by_name: p182_10?.created_by_name || USER_NAME,
        created_by_email: p182_10?.created_by_email || USER_EMAIL,
        updated_by_uid: USER_UID,
        updated_by_name: USER_NAME,
        updated_by_email: USER_EMAIL,
        created_at: p182_10?.created_at || now,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false
    });

    // --- B18: REGISTER 183 A (+Row 12, Attendance on Rows 1-11) ---
    console.log(" - Updating REGISTER 183 A...");
    const fac183 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && (d.form_number === '183 A' || d.form_number === '183' || cleanDigits(d.contact) === '76934521'));
    const fac183Uuid = fac183 ? fac183.uuid : crypto.randomUUID();
    docsToUpsert.set(fac183Uuid, {
        ...(fac183 || {}),
        uuid: fac183Uuid,
        form_number: '183 A',
        second_leader_name: 'Thato Mogotsi',
        second_leader_contact: '78156864',
        participants_count: 12,
        books_distributed: 12,
        updated_at: now
    });
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && (d.group_form_number === '183 A' || d.group_form_number === '183')).forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    const p183_12 = findParticipant('183 A', 'Katlego', 'Seabelo', '77567924') || findParticipant('183', 'Katlego', 'Seabelo', '77567924');
    const p183_12Uuid = p183_12 ? p183_12.uuid : crypto.randomUUID();
    docsToUpsert.set(p183_12Uuid, {
        ...(p183_12 || {}),
        uuid: p183_12Uuid,
        type: 'participant',
        first_name: 'Katlego',
        last_name: 'Seabelo',
        gender: 'M',
        age: 36,
        contact: '77567924',
        education: 'Form 3',
        marital_status: 'Single',
        affiliation: 'Self employed',
        occupation: 'Self employed',
        place: 'Seingwaeng P. School',
        group_form_number: '183 A',
        facilitator_uuid: fac183Uuid,
        books_received: true,
        attendance: [false, true, false, false, false, false, false, false, false, false, false, false],
        campaign_id: CAMPAIGN_ID,
        created_by_uid: p183_12?.created_by_uid || USER_UID,
        created_by_name: p183_12?.created_by_name || USER_NAME,
        created_by_email: p183_12?.created_by_email || USER_EMAIL,
        updated_by_uid: USER_UID,
        updated_by_name: USER_NAME,
        updated_by_email: USER_EMAIL,
        created_at: p183_12?.created_at || now,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false
    });

    // --- B19: REGISTER 185 (+3 Rows 15:30 sub-group, Attendance on Rows 1-13) ---
    console.log(" - Updating REGISTER 185...");
    const fac185 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '185');
    const fac185Uuid = fac185 ? fac185.uuid : crypto.randomUUID();
    docsToUpsert.set(fac185Uuid, {
        ...(fac185 || {}),
        uuid: fac185Uuid,
        form_number: '185',
        second_leader_name: 'Kabo Maxala',
        second_leader_contact: '72958870',
        participants_count: 16,
        books_distributed: 16,
        updated_at: now
    });
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '185').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    const new185Rows = [
        { first: 'Annah', last: 'Olebile', gender: 'F', age: 55, contact: '72541294', edu: 'BA HRM', mar: 'S', aff: 'Regional Edu Off', occ: 'Chief Admin Officer', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Thamana', last: 'Segotlong', gender: 'F', age: 55, contact: '73716924', edu: 'BA HRM', mar: 'S', aff: 'Regional Edu Off', occ: 'Principal Admin', att: [true, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Doreen', last: 'Gouwe', gender: 'F', age: 46, contact: '71600703', edu: 'BA Ed', mar: 'D', aff: 'Regional Edu Off', occ: 'Adult Educator', att: [true, true, false, false, false, false, false, false, false, false, false, false] }
    ];
    for (const r of new185Rows) {
        const existingP = findParticipant('185', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'Education Centre',
            group_form_number: '185',
            facilitator_uuid: fac185Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B20: REGISTER 196 (+Rows 1-5 on New P1, Attendance on P2) ---
    console.log(" - Updating REGISTER 196 (+Rows 1-5)...");
    const fac196 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '196');
    const fac196Uuid = fac196 ? fac196.uuid : crypto.randomUUID();
    docsToUpsert.set(fac196Uuid, {
        ...(fac196 || {}),
        uuid: fac196Uuid,
        form_number: '196',
        participants_count: 16,
        books_distributed: 16,
        updated_at: now
    });
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '196').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });
    const new196Rows = [
        { first: 'Kamogelo', last: 'Isalaile', gender: 'F', age: 44, contact: '72809174', edu: 'DIPLOMA IN LAW', mar: 'SINGLE', aff: 'POLICE', occ: 'POLICE OFFICER', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Oarabile', last: 'Kgotla', gender: 'F', age: 41, contact: '71770786', edu: 'BGCSE', mar: 'Single', aff: 'Police', occ: 'Police Officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Boitumelo Mpho', last: 'Ramantsi', gender: 'F', age: 44, contact: '75607228', edu: 'Degree in Criminology', mar: 'Single', aff: 'Police', occ: 'Police Officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Steve L.', last: 'David', gender: 'M', age: 40, contact: '72657448', edu: 'DEGREE', mar: 'SINGLE', aff: 'Police', occ: 'POLICE OFFICER', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'L. C.', last: 'Tuelo', gender: 'F', age: 54, contact: '73174599', edu: 'BGCSE', mar: 'MARRIED', aff: 'Police', occ: 'Police Officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] }
    ];
    for (const r of new196Rows) {
        const existingP = findParticipant('196', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'Mmathubudukwane Police Station',
            group_form_number: '196',
            facilitator_uuid: fac196Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B21: REGISTER 197 (+Rows 20-22, Attendance, Marital Status) ---
    console.log(" - Updating REGISTER 197 (+Rows 20-22)...");
    const fac197 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '197');
    const fac197Uuid = fac197 ? fac197.uuid : crypto.randomUUID();
    docsToUpsert.set(fac197Uuid, {
        ...(fac197 || {}),
        uuid: fac197Uuid,
        form_number: '197',
        participants_count: 10,
        books_distributed: 10,
        updated_at: now
    });
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '197').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        let mar = p.marital_status;
        if (cleanStr(p.first_name).includes('tshepo')) mar = 'S';
        if (cleanStr(p.first_name).includes('kgalale')) mar = 'M';
        docsToUpsert.set(p.uuid, { ...p, attendance: att, marital_status: mar, updated_at: now });
    });
    const new197Rows = [
        { first: 'Thadzisani', last: 'Matoma', gender: 'F', age: 45, contact: '72737073', edu: 'BGCSE', mar: '', aff: 'Police', occ: 'Police officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Bakang', last: 'Semetsamere', gender: 'M', age: 29, contact: '75132694', edu: '', mar: 'S', aff: 'Police Officer', occ: 'Police Officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] },
        { first: 'Mompati', last: 'Moreetsi', gender: 'M', age: 42, contact: '', edu: 'BGCSE', mar: 'S', aff: 'Police', occ: 'Police Officer', att: [false, true, false, false, false, false, false, false, false, false, false, false] }
    ];
    for (const r of new197Rows) {
        const existingP = findParticipant('197', r.first, r.last, r.contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: r.first,
            last_name: r.last,
            gender: r.gender,
            age: r.age,
            contact: r.contact,
            education: r.edu,
            marital_status: r.mar,
            affiliation: r.aff,
            occupation: r.occ,
            place: 'Mmathubudukwane',
            group_form_number: '197',
            facilitator_uuid: fac197Uuid,
            books_received: true,
            attendance: r.att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B22: REGISTER 201 (Mochudi State Prison — Sheets 1-5 Complete Updated Table) ---
    console.log(" - Updating REGISTER 201 (Sheets 1-5, removing 4 struck-through, adding 5 new)...");
    const fac201 = allDocs.find(d => d.type === 'facilitator' && !d.is_deleted && d.form_number === '201');
    const fac201Uuid = fac201 ? fac201.uuid : crypto.randomUUID();
    docsToUpsert.set(fac201Uuid, {
        ...(fac201 || {}),
        uuid: fac201Uuid,
        form_number: '201',
        participants_count: 56,
        books_distributed: 56,
        updated_at: now
    });

    // Remove the 4 struck-through rows from Reg 201
    const pStruck1 = allDocs.find(d => d.group_form_number === '201' && cleanStr(d.first_name).includes('tomeletso') && cleanStr(d.last_name).includes('lengwadibe') && d.created_at?.includes('21:25'));
    const pStruck2 = allDocs.find(d => d.group_form_number === '201' && cleanStr(d.first_name).includes('kabelo') && cleanStr(d.last_name).includes('thibogang'));
    const pStruck3 = allDocs.find(d => d.group_form_number === '201' && cleanStr(d.first_name).includes('kefilwe') && cleanStr(d.last_name).includes('koitsiwe') && !cleanStr(d.first_name).includes('shaimus'));
    const pStruck4 = allDocs.find(d => d.group_form_number === '201' && cleanStr(d.first_name).includes('oteng') && cleanStr(d.last_name).includes('kgabangwe'));

    [pStruck1, pStruck2, pStruck3, pStruck4].filter(Boolean).forEach(p => {
        docsToDelete.add(p.uuid);
    });

    // Parse all Table N rows from lines 795 to 854
    for (let i = 794; i < 854; i++) {
        const line = lines[i];
        if (!line || !line.trim().startsWith('|')) continue;
        const cells = line.split('|').map(c => c.trim());
        if (cells.length < 12) continue;
        if (line.includes('STRUCK THROUGH') || line.includes('~~')) continue;

        const first = clean(cells[2]);
        const last = clean(cells[3]) === '—' || clean(cells[3]) === '-' ? '' : clean(cells[3]);
        const gender = parseGender(cells[4]);
        const age = parseAge(cells[5]);
        const contact = clean(cells[6]);
        const edu = clean(cells[7]) === '—' || clean(cells[7]) === '-' ? '' : clean(cells[7]);
        const mar = clean(cells[8]) === '—' || clean(cells[8]) === '-' ? '' : clean(cells[8]);
        const aff = clean(cells[9]) === '—' || clean(cells[9]) === '-' ? '' : clean(cells[9]);
        const occ = clean(cells[10]) === '—' || clean(cells[10]) === '-' ? '' : clean(cells[10]);
        const att = parseAttendance(cells[11]);

        // Find existing or create
        const existingP = findParticipant('201', first, last, contact);
        const pUuid = existingP ? existingP.uuid : crypto.randomUUID();
        docsToUpsert.set(pUuid, {
            ...(existingP || {}),
            uuid: pUuid,
            type: 'participant',
            first_name: first,
            last_name: last,
            gender: gender,
            age: age,
            contact: contact || '5777251',
            education: edu,
            marital_status: mar,
            affiliation: aff || 'Mochudi Prison',
            occupation: occ || 'Inmate',
            place: 'Mochudi State Prison',
            group_form_number: '201',
            facilitator_uuid: fac201Uuid,
            books_received: true,
            attendance: att,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existingP?.created_by_uid || USER_UID,
            created_by_name: existingP?.created_by_name || USER_NAME,
            created_by_email: existingP?.created_by_email || USER_EMAIL,
            updated_by_uid: USER_UID,
            updated_by_name: USER_NAME,
            updated_by_email: USER_EMAIL,
            created_at: existingP?.created_at || now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false
        });
    }

    // --- B23: REGISTER 202 (Attendance) ---
    console.log(" - Updating REGISTER 202 attendance...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '202').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true;
        att[1] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // --- B24: REGISTER 220 (Attendance) ---
    console.log(" - Updating REGISTER 220 attendance...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '220').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        const fn = cleanStr(p.first_name);
        // Rows 2, 3, 4, 5, 6, 8 now 27, 28 Oct; Rows 1, 7, 9, 10 stay 27 Oct only
        if (fn.includes('lerato') || fn.includes('boingotlo') || fn.includes('masego') || fn.includes('kgomotso')) {
            att[0] = true;
            att[1] = false;
        } else {
            att[0] = true;
            att[1] = true;
        }
        docsToUpsert.set(p.uuid, { ...p, attendance: att, updated_at: now });
    });

    // ==================================================================
    // STEP 4: RECALCULATE ALL FACILITATOR BOOKS & PARTICIPANT COUNTS
    // ==================================================================
    console.log("\n6. Recalculating active participant counts and books distributed for all facilitators...");
    const participantCountByFac = {};
    for (const [uuid, rec] of docsToUpsert.entries()) {
        if (rec.type === 'participant' && !rec.is_deleted && !docsToDelete.has(uuid)) {
            const facId = rec.facilitator_uuid;
            if (facId) {
                participantCountByFac[facId] = (participantCountByFac[facId] || 0) + 1;
            }
        }
    }
    // Also count unchanged participants in allDocs
    for (const p of participants) {
        if (!docsToUpsert.has(p.uuid) && !docsToDelete.has(p.uuid)) {
            const facId = p.facilitator_uuid;
            if (facId) {
                participantCountByFac[facId] = (participantCountByFac[facId] || 0) + 1;
            }
        }
    }

    // Update facilitator records
    for (const [facUuid, count] of Object.entries(participantCountByFac)) {
        let facRec = docsToUpsert.get(facUuid) || allDocs.find(d => (d.uuid || d.docId) === facUuid);
        if (facRec && facRec.type === 'facilitator') {
            docsToUpsert.set(facUuid, {
                ...facRec,
                participants_count: count,
                books_distributed: count,
                teaching_group: true,
                is_daily_core: true,
                updated_at: now
            });
        }
    }

    console.log(`Summary of queued database writes:`);
    console.log(` - Upsert Records (Facilitators & Participants): ${docsToUpsert.size}`);
    console.log(` - Soft-Delete Records (Crossed-Out & Duplicates): ${docsToDelete.size}`);

    // ==================================================================
    // STEP 5: COMMIT TO FIRESTORE IN BATCHES
    // ==================================================================
    console.log("\n7. Committing all updates to Cloud Firestore in batches...");
    const upsertList = Array.from(docsToUpsert.values());
    const deleteList = Array.from(docsToDelete);

    const BATCH_SIZE = 400;

    // Write Upserts
    for (let i = 0; i < upsertList.length; i += BATCH_SIZE) {
        const slice = upsertList.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const item of slice) {
            const docRef = doc(firestoreDb, 'registrations', item.uuid);
            const { id: _ignore, ...dataToSync } = item;
            batch.set(docRef, dataToSync, { merge: true });
        }
        await batch.commit();
        console.log(` - Committed upsert batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, upsertList.length)} / ${upsertList.length})`);
    }

    // Write Deletions
    if (deleteList.length > 0) {
        const delBatch = writeBatch(firestoreDb);
        for (const uuid of deleteList) {
            const docRef = doc(firestoreDb, 'registrations', uuid);
            delBatch.update(docRef, {
                is_deleted: true,
                deleted_at: now,
                updated_at: now,
                deletion_reason: 'Crossed-out on physical register / Merged duplicate'
            });
        }
        await delBatch.commit();
        console.log(` - Committed deletion batch (${deleteList.length} records soft-deleted).`);
    }

    console.log("Cloud Firestore sync completed successfully!\n");

    // ==================================================================
    // STEP 6: PUSH BUFFER TO GOOGLE SHEETS WEB APP
    // ==================================================================
    console.log("8. Pushing consolidated profile buffer to Google Sheets Web App...");
    // Fetch fresh active records stamped under Samukeliso Mayabane
    const freshSnap = await getDocs(collection(firestoreDb, 'registrations'));
    const freshDocs = freshSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
    const sheetsBuffer = freshDocs.filter(d => !d.is_deleted && (d.created_by_name === USER_NAME || d.created_by_email?.includes('samukeliso')));

    console.log(`Found ${sheetsBuffer.length} active records under ${USER_NAME} to push to Sheets.`);

    const payload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Samukeliso_Mayabane',
        records: sheetsBuffer,
        replaceTab: true,
        autoReconcile: true
    };

    try {
        const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resJson = await resp.json();
        console.log("Google Sheets Web App response:", JSON.stringify(resJson, null, 2));
    } catch (err) {
        console.warn("Sheets push warning (non-fatal):", err.message);
    }

    console.log("\n==================================================================");
    console.log(" 29 OCTOBER 2026 HANDOVER IMPORT & UPDATE PIPELINE COMPLETED!");
    console.log("==================================================================");
}

runHandover().catch(console.error);
