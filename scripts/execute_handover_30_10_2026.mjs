import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import 'fake-indexeddb/auto';
import db from '../src/lib/dexieDb.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

// Data cleaning and parsing helpers
function clean(str) {
    if (!str) return '';
    return str.replace(/~~/g, '').replace(/\*/g, '').trim();
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
    if (!s || s === '-' || s === '—' || s.toLowerCase() === 'nil' || s.toLowerCase() === 'none' || s.toLowerCase() === 'adult') return null;
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
    console.log(" STARTING 30 OCTOBER 2026 HANDOVER IMPORT & UPDATE PIPELINE");
    console.log("==================================================================\n");

    const now = new Date().toISOString();

    // 1. Fetch current database state from Cloud Firestore
    console.log("1. Fetching current registrations from Firestore...");
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const allDocs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    console.log(`Retrieved ${allDocs.length} total registration documents from Firestore.`);

    const facilitators = allDocs.filter(d => d.type === 'facilitator' && !d.is_deleted);
    const participants = allDocs.filter(d => d.type === 'participant' && !d.is_deleted);
    console.log(`Active Facilitators: ${facilitators.length}, Active Participants: ${participants.length}\n`);

    const docsToUpsert = new Map();
    const docsToDelete = new Set();

    const assignedFacUuids = new Set();

    // Helper to find facilitator
    function findFacilitator(formNum, phone, name) {
        const formClean = String(formNum || '').replace(/\D/g, '');
        const p8 = cleanDigits(phone);
        const nameTokens = cleanStr(name).split(' ').filter(t => t.length > 2);

        // 1. Exact phone match (8 digits) - most reliable
        if (p8 && p8.length >= 7) {
            const byPhone = facilitators.find(f => cleanDigits(f.contact) === p8);
            if (byPhone) return byPhone;
        }

        // 2. Exact form number match
        if (formClean) {
            const byForm = facilitators.find(f => String(f.form_number || '').replace(/\D/g, '') === formClean);
            if (byForm) return byForm;
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

    function matchOrCreateFacilitator(regNum, phone, name, secondPhone, secondName) {
        const formClean = String(regNum || '').replace(/\D/g, '');
        const p8 = cleanDigits(phone);
        const secP8 = cleanDigits(secondPhone);
        const nameTokens = cleanStr(name).split(' ').filter(t => t.length > 2);

        // 1. Check if a facilitator already exists with the EXACT form number
        let matched = facilitators.find(f => {
            if (f.form_number && String(f.form_number).trim().toUpperCase() === String(regNum).trim().toUpperCase()) return true;
            if (formClean && String(f.form_number || '').replace(/\D/g, '') === formClean && !String(f.form_number || '').includes(',')) return true;
            return false;
        });

        // 2. Check if an unassigned facilitator (empty/null form_number) matches primary or secondary phone
        if (!matched && p8 && p8.length >= 7) {
            matched = facilitators.find(f => !assignedFacUuids.has(f.uuid) && (!f.form_number || f.form_number === '' || f.form_number === 'null') && cleanDigits(f.contact) === p8);
        }
        if (!matched && secP8 && secP8.length >= 7) {
            matched = facilitators.find(f => !assignedFacUuids.has(f.uuid) && (!f.form_number || f.form_number === '' || f.form_number === 'null') && cleanDigits(f.contact) === secP8);
        }

        // 3. Check if an unassigned facilitator matches name
        if (!matched && nameTokens.length >= 2) {
            matched = facilitators.find(f => {
                if (assignedFacUuids.has(f.uuid)) return false;
                if (f.form_number && f.form_number !== '' && f.form_number !== 'null') return false;
                const fNameTokens = cleanStr(`${f.first_name || ''} ${f.last_name || ''}`).split(' ');
                const overlap = nameTokens.filter(t => fNameTokens.includes(t));
                return overlap.length >= 2;
            });
        }

        if (matched) {
            assignedFacUuids.add(matched.uuid);
            return matched;
        }

        return null;
    }

    // 2. Read and parse handover file
    console.log("2. Reading 30 October 2026 Handover file...");
    const mdPath = 'c:/Users/samuk/Documents/Registers/HFF_Registers_30-10-2026_Handover.md';
    const text = fs.readFileSync(mdPath, 'utf8');
    const lines = text.split(/\r?\n/);

    // ==================================================================
    // STEP 1: PARSE AND IMPORT SECTION 4 (CATEGORY C: 22 BRAND-NEW REGISTERS)
    // ==================================================================
    console.log("\n3. Parsing Section 4: Category C (22 Brand-New Register Groups)...");
    let sec4Idx = lines.findIndex(l => l.includes('4.2 Detailed Participant'));

    const sec4Regs = [];
    let currentReg = null;

    for (let i = sec4Idx; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#### ')) {
            const m = line.match(/####\s+\d+\.\s+`?REGISTER\s+([^`\(\n]+)`?/i);
            if (m) {
                let regNum = m[1].trim();
                // Clean regNum (e.g. "220 (Sub-Group B — BDF Recreation Hall)" -> "220 B", "114 A" -> "114 A")
                if (regNum.includes('220')) regNum = '220 B';
                if (regNum.includes('200')) regNum = '200';
                if (regNum.includes('238')) regNum = '238';
                currentReg = {
                    formNumber: regNum,
                    rawHeader: m[1].trim(),
                    leader: '',
                    cell: '',
                    secondLeader: '',
                    secondCell: '',
                    place: '',
                    time: '',
                    participants: []
                };
                sec4Regs.push(currentReg);
            }
        }
        if (currentReg) {
            if (line.includes('**Group Leader:**')) {
                const mLeader = line.match(/\*\*Group Leader:\*\*\s*`?([^`|\(\n]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)\n]+)`?\))?/i);
                if (mLeader) {
                    currentReg.leader = mLeader[1].trim();
                    if (mLeader[2]) currentReg.cell = mLeader[2].trim();
                }
            }
            if (line.includes('**Second Leader:**')) {
                const mSec = line.match(/\*\*Second Leader:\*\*\s*`?([^`|\(\n]+)`?(?:\s*\((?:Cell:\s*)?`?([^`\)\n]+)`?\))?/i);
                if (mSec && !mSec[1].toLowerCase().includes('none') && !mSec[1].includes('—')) {
                    currentReg.secondLeader = mSec[1].trim();
                    if (mSec[2]) currentReg.secondCell = mSec[2].trim();
                }
            }
            if (line.includes('**Meeting Place:**')) {
                const mPlace = line.match(/\*\*Meeting Place:\*\*\s*`?([^`|\(\n]+)`?(?:\s*\(`?([^`\)\n]+)`?\))?/i);
                if (mPlace) {
                    currentReg.place = mPlace[1].trim();
                    if (mPlace[2]) currentReg.time = mPlace[2].trim();
                }
            }
            if (line.includes('**Meeting Time:**')) {
                const mTime = line.match(/\*\*Meeting Time:\*\*\s*`?([^`\n]+)`?/i);
                if (mTime) {
                    currentReg.time = mTime[1].trim();
                }
            }
            if (line.trim().startsWith('|') && !line.includes('First Name') && !line.includes(':---') && !line.includes('Register / Form No.')) {
                const cells = line.split('|').map(c => c.trim());
                if (cells.length >= 12 && cells[1] && cells[2]) {
                    const rowStr = cells[1];
                    const isCrossed = line.includes('Crossed out') || line.includes('~~') || (currentReg.formNumber === '238' && rowStr.includes('12'));
                    if (!isCrossed) {
                        currentReg.participants.push({
                            row: rowStr,
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

    console.log(`Parsed ${sec4Regs.length} Brand-New Section 4 Register Groups.`);
    let totalSec4Participants = 0;

    for (const reg of sec4Regs) {
        console.log(` - Ingesting REGISTER ${reg.formNumber} (${reg.leader} | ${reg.place} | ${reg.participants.length} participants)...`);
        let fac = matchOrCreateFacilitator(reg.formNumber, reg.cell, reg.leader, reg.secondCell, reg.secondLeader);
        const facUuid = fac ? fac.uuid : crypto.randomUUID();
        assignedFacUuids.add(facUuid);
        const leaderNameParts = reg.leader.trim().split(/\s+/);
        const facFirstName = leaderNameParts.slice(0, -1).join(' ') || leaderNameParts[0] || `Facilitator ${reg.formNumber}`;
        const facLastName = leaderNameParts.length > 1 ? leaderNameParts[leaderNameParts.length - 1] : '';

        const facRecord = {
            id: fac?.id || undefined,
            uuid: facUuid,
            type: 'facilitator',
            first_name: fac?.first_name || facFirstName,
            last_name: fac?.last_name || facLastName,
            contact: reg.cell || fac?.contact || '',
            form_number: String(reg.formNumber),
            place: reg.place || fac?.place || 'Mochudi',
            meeting_time: reg.time || fac?.meeting_time || '',
            teaching_group: true,
            is_daily_core: true,
            second_leader_name: reg.secondLeader || fac?.second_leader_name || '',
            second_leader_contact: reg.secondCell || fac?.second_leader_contact || '',
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
            participants_count: reg.participants.length,
            books_distributed: reg.participants.length,
            books_received: true
        };
        docsToUpsert.set(facUuid, facRecord);

        // Add participants
        for (const p of reg.participants) {
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
                place: reg.place || 'Mochudi',
                group_form_number: String(reg.formNumber),
                facilitator_uuid: facUuid,
                campaign_id: CAMPAIGN_ID,
                created_by_uid: USER_UID,
                created_by_name: USER_NAME,
                created_by_email: USER_EMAIL,
                created_by_role: 'master_admin',
                submission_source: 'admin_person_list',
                created_at: now,
                updated_at: now,
                sync_status: 'synced',
                is_deleted: false,
                books_received: true,
                attendance: p.attendance
            };
            docsToUpsert.set(pUuid, pRecord);
            totalSec4Participants++;
        }
    }
    console.log(`Part A Complete: Ingested ${totalSec4Participants} active participants across 22 new groups.`);

    // ==================================================================
    // STEP 2: PARSE AND IMPORT SECTION 3 (CATEGORY B: 15 UPDATED REGISTERS)
    // ==================================================================
    console.log("\n4. Parsing Section 3: Category B (15 Updated Registers +74 New Rows)...");

    // Table 1: REGISTER 61 (ex-Unnumbered New #B / 207)
    console.log(" - Processing REGISTER 61 (Makakatlela Dam)...");
    const barbraFac = findFacilitator('61', '77772798', 'Barbra Shivuri') ||
                      findFacilitator('', '75087403', 'Barbra Shivuri') ||
                      allDocs.find(d => d.uuid === 'a439e718-e618-47d9-b2d8-f4737953845b');
    const barbraUuid = barbraFac ? barbraFac.uuid : crypto.randomUUID();
    docsToUpsert.set(barbraUuid, {
        ...(barbraFac || {}),
        uuid: barbraUuid,
        type: 'facilitator',
        first_name: barbraFac?.first_name || 'Barbra',
        last_name: barbraFac?.last_name || 'Shivuri',
        contact: '77772798',
        form_number: '61',
        place: 'MAKAKATLELA DAM',
        meeting_time: '11:50 am hrs',
        second_leader_name: 'Daphne Chelane',
        second_leader_contact: '71533031',
        teaching_group: true,
        is_daily_core: true,
        books_received: true,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false,
        campaign_id: CAMPAIGN_ID
    });

    const reg61Participants = [
        { first_name: 'Mogomotsi', last_name: 'Madisa', gender: 'M', age: 55, contact: '74726769', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Mmantukana', last_name: 'Mongale', gender: 'M', age: 42, contact: '77896483', education: 'BGCSE', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Banyanabotlhe', last_name: 'Mmale', gender: 'F', age: 30, contact: '71831662 / 77896483', education: 'BGCSE', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Sarah', last_name: 'Kobang', gender: 'F', age: 39, contact: '75266572', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Leago', last_name: 'Gaborekwe', gender: 'F', age: 18, contact: '72540834', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Koketso', last_name: 'Masupu', gender: 'F', age: 19, contact: '77487139', education: 'BGCSE', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Phoro', last_name: 'Gaborekwe', gender: 'F', age: 47, contact: '74007447', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Khutsafalo', last_name: 'Lekwape', gender: 'F', age: 62, contact: '75008510', education: 'BGCSE', marital_status: 'M', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Mirriam', last_name: 'Sebatata', gender: 'F', age: 64, contact: '74733823', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        // +2 New Rows on P2:
        { first_name: 'Keitumetse C.', last_name: 'Shivuri', gender: 'F', age: 22, contact: '72394054', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Osadi', last_name: 'Gouwe', gender: 'F', age: 24, contact: '78573873', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' }
    ];

    reg61Participants.forEach(p => {
        const existing = allDocs.find(d => d.type === 'participant' && !d.is_deleted && cleanStr(d.first_name) === cleanStr(p.first_name) && cleanStr(d.last_name) === cleanStr(p.last_name));
        const pUuid = existing ? existing.uuid : crypto.randomUUID();
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(pUuid, {
            ...(existing || {}),
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
            place: 'MAKAKATLELA DAM',
            group_form_number: '61',
            facilitator_uuid: barbraUuid,
            attendance: att,
            books_received: true,
            updated_at: now,
            created_at: existing?.created_at || now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existing?.created_by_uid || USER_UID,
            created_by_name: existing?.created_by_name || USER_NAME,
            created_by_email: existing?.created_by_email || USER_EMAIL
        });
    });

    // Table 2: REGISTER 68 (+11 new rows on P1, update existing 15 rows)
    console.log(" - Processing REGISTER 68 (Popie Lesego Pheto)...");
    const fac68 = allDocs.find(d => d.uuid === '3231001f-d354-4e2f-99dd-52d5730da43a');
    const fac68Uuid = fac68 ? fac68.uuid : crypto.randomUUID();
    // Update existing rows
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '68').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    // +11 new rows on P1
    const reg68New = [
        { first_name: 'Marvellous', last_name: 'Hokonya', gender: 'F', age: null, contact: '76913781', education: 'JC', marital_status: 'M', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Kago', last_name: 'Letsholo', gender: 'F', age: 36, contact: '78303244', education: 'Form 5', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Kefilwe B.', last_name: 'Letsholo', gender: 'F', age: 28, contact: '72431783', education: 'Form 5', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Tebogo', last_name: 'Phofedi', gender: 'M', age: 41, contact: '76091310', education: 'JC', marital_status: 'S', affiliation: 'SECURITY SYSTEMS', occupation: 'SECURITY' },
        { first_name: 'Motlalepula', last_name: 'Tsheole', gender: 'M', age: 63, contact: '', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Happy', last_name: 'Tsheole', gender: 'F', age: 35, contact: '74457945', education: 'Tertiary', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Tiego L.', last_name: 'Phofedi', gender: 'F', age: null, contact: '74203199', education: '', marital_status: 'S', affiliation: '', occupation: 'Receptionist' },
        { first_name: 'Enock O.', last_name: 'Lekwape', gender: 'M', age: null, contact: '78020820', education: 'Form 5', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' },
        { first_name: 'Keitumetse N.', last_name: 'Lekwape', gender: 'F', age: null, contact: '78752032', education: 'Form 5', marital_status: 'S', affiliation: 'Government', occupation: 'Cleaner' },
        { first_name: 'Tebogo', last_name: 'Molokwane', gender: 'F', age: 19, contact: '78723120', education: 'Form 5', marital_status: 'S', affiliation: 'Ikageng', occupation: 'Ikageng' },
        { first_name: 'Lefa', last_name: 'Sekwati', gender: 'F', age: 30, contact: '72436645', education: 'JC', marital_status: 'S', affiliation: 'N/A', occupation: 'N/A' }
    ];
    reg68New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        att[2] = true; att[3] = true; // 29, 30 Oct
        docsToUpsert.set(pUuid, {
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
            place: 'MARULA A RATSHEOLE',
            group_form_number: '68',
            facilitator_uuid: fac68Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 3: REGISTER 75 (+3 new rows on P2, update existing rows)
    console.log(" - Processing REGISTER 75 (Seanokeng Selala)...");
    const fac75 = allDocs.find(d => d.uuid === 'c9cddb94-a0db-42e2-9078-53a130729ade');
    const fac75Uuid = fac75 ? fac75.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '75').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg75New = [
        { first_name: 'Refilwe', last_name: 'Dichabe', gender: 'F', age: 26, contact: '75744209', education: 'JC', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED', attDays: [2, 3] }, // 29, 30 Oct
        { first_name: 'Gakenkope', last_name: 'Bandi', gender: 'F', age: 35, contact: '78486928', education: 'JC', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED', attDays: [1, 2, 3] }, // 28, 29, 30 Oct
        { first_name: 'Kereng', last_name: 'Molebatsi', gender: 'F', age: 39, contact: '71214838', education: 'JC', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED', attDays: [2, 3] } // 29, 30 Oct
    ];
    reg75New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'Ntshinoge, Next to Kagiso Bar',
            group_form_number: '75',
            facilitator_uuid: fac75Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 4: REGISTER 98 (Page 1 of 2: +12 new rows)
    console.log(" - Processing REGISTER 98 (Aletah Kotsedi)...");
    const fac98 = allDocs.find(d => d.uuid === 'ba653f4e-9b49-4cf7-acf2-5b42881e554d');
    const fac98Uuid = fac98 ? fac98.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '98').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true; att[1] = true; att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg98New = [
        { first_name: 'Boipelo', last_name: 'Pirie', gender: 'F', age: 51, contact: '75668277', education: 'JC', marital_status: 'Single', affiliation: 'Police Volunteer', occupation: '' },
        { first_name: 'Afitlhile', last_name: 'Tjiveri', gender: 'F', age: 37, contact: '77952344', education: 'JC', marital_status: 'Single', affiliation: 'Police Volunteer', occupation: '' },
        { first_name: 'Elizabeth', last_name: 'Kemoeng', gender: 'F', age: 41, contact: '72484893', education: 'JC', marital_status: 'Single', affiliation: 'Police Volunteer', occupation: '' },
        { first_name: 'Meriam', last_name: 'Outukile', gender: 'F', age: 47, contact: '76943461', education: 'JC', marital_status: 'Single', affiliation: 'Security', occupation: '' },
        { first_name: 'Lebogang', last_name: 'Mubu', gender: 'F', age: 36, contact: '76186560', education: 'BCC', marital_status: 'Single', affiliation: 'Ass. C. Bailiff', occupation: '' },
        { first_name: 'Dorcas', last_name: 'Keaikitse', gender: 'F', age: 58, contact: '72438347', education: 'BGCSE', marital_status: 'SINGLE', affiliation: 'ASS CLERK', occupation: '' },
        { first_name: 'Motlatsi', last_name: 'Nketsang', gender: 'M', age: 40, contact: '72505824', education: 'BSc', marital_status: 'SINGLE', affiliation: 'BPS', occupation: '' },
        { first_name: 'Ednah', last_name: 'Kgopole', gender: 'F', age: 40, contact: '71646330', education: 'BGCSE', marital_status: 'SINGLE', affiliation: 'BPS', occupation: '' },
        { first_name: 'B.', last_name: 'Montshojang', gender: 'M', age: 55, contact: '75664315', education: 'Cambridge', marital_status: 'Married', affiliation: 'BPS', occupation: '' },
        { first_name: 'Tshegofatso', last_name: 'Sepitse', gender: 'F', age: 31, contact: '71981316', education: 'BGCSE', marital_status: 'SINGLE', affiliation: 'BPS', occupation: '' },
        { first_name: 'Pauline', last_name: 'Dallie', gender: 'F', age: 30, contact: '77732614', education: 'BGCSE', marital_status: 'SINGLE', affiliation: 'BPS', occupation: '' },
        { first_name: 'Baile', last_name: 'Ratiro', gender: 'F', age: 49, contact: '74538308', education: 'JC', marital_status: 'MARRIED', affiliation: 'POLICE VOLUNTEER', occupation: '' }
    ];
    reg98New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(pUuid, {
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
            place: 'PILANE KGOTLA',
            group_form_number: '98',
            facilitator_uuid: fac98Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 5: REGISTER 101 (+8 new rows on P2, update existing P1)
    console.log(" - Processing REGISTER 101 (Ronicah Motshegwe)...");
    const fac101 = allDocs.find(d => d.uuid === 'f9f5f1ef-9594-492e-be77-0fbf780b29e5');
    const fac101Uuid = fac101 ? fac101.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '101').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[2] = true; att[3] = true; // 29, 30 Oct
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg101New = [
        { first_name: 'Kabo', last_name: 'Molefe', gender: 'M', age: 37, contact: '72391013', education: 'S', marital_status: 'S', affiliation: '', occupation: 'Driver', attDays: [0, 1] },
        { first_name: 'Bakang', last_name: 'Mosiare', gender: 'F', age: 45, contact: '71867777', education: 'S', marital_status: 'S', affiliation: '', occupation: 'Ikageng', attDays: [0, 1] },
        { first_name: 'Goitsemodimo', last_name: 'Mogotsi', gender: 'F', age: 34, contact: '76088943', education: 'S', marital_status: 'S', affiliation: '', occupation: 'Ikageng', attDays: [0, 1] },
        { first_name: 'Lesego', last_name: 'Molefe', gender: 'F', age: 46, contact: '76029402', education: 'J', marital_status: 'S', affiliation: '', occupation: 'Ikageng', attDays: [0, 1] },
        { first_name: 'Nkomeng', last_name: 'Mogotsi', gender: 'F', age: 56, contact: '71463536', education: 'J', marital_status: 'S', affiliation: '', occupation: 'Ikageng', attDays: [0, 1] },
        { first_name: 'Tsholofelo', last_name: 'Mangadi', gender: 'F', age: 40, contact: '74776187', education: 'J', marital_status: 'S', affiliation: '', occupation: 'N/N', attDays: [0, 1, 2, 3] },
        { first_name: 'Farouk', last_name: 'Magale', gender: 'M', age: 32, contact: '75149796', education: 'U', marital_status: 'S', affiliation: '', occupation: 'X', attDays: [0, 1, 2, 3] },
        { first_name: 'Mokalane', last_name: 'Nkwe', gender: 'M', age: 50, contact: '71447262', education: 'U', marital_status: 'M', affiliation: '', occupation: 'S/E', attDays: [0, 2, 3] }
    ];
    reg101New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'Boseja South / Home',
            group_form_number: '101',
            facilitator_uuid: fac101Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 6: REGISTER 104 (+3 new rows on P2, update existing)
    console.log(" - Processing REGISTER 104 (Josephine Mathibe)...");
    const fac104 = allDocs.find(d => d.uuid === '981ccf59-d7bf-493d-bfa9-0c95abc1e9ec');
    const fac104Uuid = fac104 ? fac104.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '104').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg104New = [
        { first_name: 'Gabosekwe', last_name: 'Mathibe', gender: 'M', age: 52, contact: '', education: '', marital_status: '', affiliation: '', occupation: '', attDays: [2, 3] },
        { first_name: 'Esther', last_name: 'Kotsedi', gender: 'F', age: null, contact: '', education: '', marital_status: '', affiliation: '', occupation: '', attDays: [2, 3] },
        { first_name: 'Nnene', last_name: 'Tsele', gender: 'F', age: 59, contact: '71742150', education: '', marital_status: 'Single', affiliation: 'Boseja ward', occupation: '', attDays: [] }
    ];
    reg104New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'Boseja',
            group_form_number: '104',
            facilitator_uuid: fac104Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 7: REGISTER 125 (+3 new rows on P2, update attendance)
    console.log(" - Processing REGISTER 125 (Kefilwe Moseki)...");
    const fac125 = allDocs.find(d => d.uuid === '6a95963c-3789-43d0-b8a1-32adbd18b777');
    const fac125Uuid = fac125 ? fac125.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '125').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[1] = true; att[2] = true; att[3] = true; // 28, 29, 30 Oct
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg125New = [
        { first_name: 'Kiddo', last_name: 'Marumo', gender: 'F', age: 58, contact: '72992276', education: 'T', marital_status: '', affiliation: '', occupation: '' },
        { first_name: 'Orapeleng', last_name: 'Oakile', gender: 'F', age: 47, contact: '77851713', education: 'T', marital_status: '', affiliation: '', occupation: '' },
        { first_name: 'Katso', last_name: 'Matlaone', gender: 'F', age: 39, contact: '77611871', education: 'P', marital_status: '', affiliation: '', occupation: '' }
    ];
    reg125New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; att[3] = true;
        docsToUpsert.set(pUuid, {
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
            place: 'EDUCATION CENTRE',
            group_form_number: '125',
            facilitator_uuid: fac125Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 8: REGISTER 136 (-1 crossed out, +7 new rows on P2, update attendance)
    console.log(" - Processing REGISTER 136 (Olebogeng Fedwane)...");
    const fac136 = allDocs.find(d => d.uuid === 'c9a145e2-640f-4583-b1bb-10c8739f7402');
    const fac136Uuid = fac136 ? fac136.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '136').forEach(p => {
        if (cleanStr(p.first_name).includes('onkarabile') && cleanStr(p.last_name).includes('nkwane')) {
            docsToDelete.add(p.uuid);
            console.log("   - Soft-deleting crossed-out Row 5: Onkarabile Nkwane (OUT OF LINE)");
        } else {
            const att = [...(p.attendance || Array(12).fill(false))];
            att[2] = true; att[3] = true;
            docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
        }
    });
    const reg136New = [
        { first_name: 'Itireleng', last_name: 'Jankie', gender: 'F', age: 37, contact: '74274766', education: 'JCE', marital_status: 'S', affiliation: 'Makgophana', occupation: 'NIL', attDays: [0, 1, 2, 3] },
        { first_name: 'Onneile', last_name: 'Moabi', gender: 'F', age: 20, contact: '78364482', education: 'JCE', marital_status: 'S', affiliation: 'Makgophana', occupation: 'NIL', attDays: [0, 1, 2, 3] },
        { first_name: 'Senewa', last_name: 'Tau', gender: 'F', age: 26, contact: '', education: 'BGCSE', marital_status: 'S', affiliation: 'Makgophana', occupation: 'NIL', attDays: [0, 1, 2, 3] },
        { first_name: 'Obed', last_name: 'Sekitla', gender: 'M', age: 37, contact: '75575770', education: 'JCE', marital_status: 'S', affiliation: 'Makgophana', occupation: 'NIL', attDays: [2, 3] },
        { first_name: 'Polokwe', last_name: 'Peduane', gender: 'M', age: 24, contact: '72763171', education: '', marital_status: '', affiliation: '', occupation: '', attDays: [2, 3] },
        { first_name: 'Rankae', last_name: 'Palai', gender: 'M', age: 49, contact: '72150105', education: '', marital_status: 'M', affiliation: 'Makgophana', occupation: 'NIL', attDays: [2, 3] },
        { first_name: 'Bagone', last_name: 'Pheto', gender: 'M', age: 49, contact: '74796389', education: '', marital_status: 'S', affiliation: 'Makgophana', occupation: 'NIL', attDays: [2, 3] }
    ];
    reg136New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'Makgophana Clinic',
            group_form_number: '136',
            facilitator_uuid: fac136Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 9: REGISTER 153 (+5 new rows on P2, update existing)
    console.log(" - Processing REGISTER 153 (Tebogo Moeng)...");
    const fac153 = allDocs.find(d => d.uuid === 'dc3ccc63-c066-4fd9-8aaa-26b160188a0d');
    const fac153Uuid = fac153 ? fac153.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '153').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg153New = [
        { first_name: 'Gaone', last_name: 'Kgosiemang', gender: 'F', age: 44, contact: '76960336', education: 'DIPLOMA', marital_status: 'M', affiliation: 'KGAFELA', occupation: 'TEACHER', attDays: [0, 1, 2, 3] },
        { first_name: 'Ruth', last_name: 'Maele', gender: 'F', age: 30, contact: '74631810', education: 'DEGREE', marital_status: 'S', affiliation: 'KGAFELA', occupation: 'TEACHER', attDays: [0, 1, 2, 3] },
        { first_name: 'Malebogo', last_name: 'Obatile', gender: 'F', age: 27, contact: '76083539', education: 'DEGREE', marital_status: 'S', affiliation: 'KGAFELA', occupation: 'TEACHER', attDays: [0, 1, 2, 3] },
        { first_name: 'Gorataone', last_name: 'Raphage', gender: 'F', age: 32, contact: '74181007', education: 'DEGREE', marital_status: 'S', affiliation: 'KGAFELA', occupation: 'TEACHER', attDays: [] },
        { first_name: 'Bernard', last_name: 'Chabwe', gender: 'M', age: 39, contact: '71585116', education: 'DIPLOMA', marital_status: 'M', affiliation: 'KGAFELA', occupation: 'TEACHER', attDays: [0, 1, 2, 3] }
    ];
    reg153New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'KGAFELA P.S',
            group_form_number: '153',
            facilitator_uuid: fac153Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 10: REGISTER 175 (+4 active new rows on P1, update P2)
    console.log(" - Processing REGISTER 175 (Emmanuel Katlego Ketsitlile)...");
    const fac175 = allDocs.find(d => d.uuid === 'b7bb8d0a-cb5b-4908-9fad-acbded04b5d7');
    const fac175Uuid = fac175 ? fac175.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '175').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true; att[1] = true; att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg175New = [
        { first_name: 'Tsholofelo', last_name: 'Moatshe', gender: 'F', age: 28, contact: '73911735', education: 'TERTIARY', marital_status: 'SINGLE', affiliation: 'FIRE', occupation: 'FIRE OFFICER' },
        { first_name: 'Kabo', last_name: 'Beleme', gender: 'M', age: 22, contact: '77493393', education: 'TERTIARY', marital_status: 'SINGLE', affiliation: 'FIRE', occupation: 'INTERN' },
        { first_name: 'Amantle', last_name: 'Segwatlha', gender: 'F', age: 22, contact: '76422492', education: 'TERTIARY', marital_status: 'SINGLE', affiliation: 'FIRE', occupation: 'INTERN' },
        { first_name: 'Nature', last_name: 'Malome', gender: 'F', age: 28, contact: '71841422', education: 'TERTIARY', marital_status: 'SINGLE', affiliation: 'FIRE', occupation: 'INTERN' }
    ];
    reg175New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; att[3] = true;
        docsToUpsert.set(pUuid, {
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
            place: 'FIRE',
            group_form_number: '175',
            facilitator_uuid: fac175Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 11: REGISTER 179 (+3 new rows on P1, update attendance)
    console.log(" - Processing REGISTER 179 (Kgomotso Dintsi)...");
    const fac179 = allDocs.find(d => d.uuid === '87ac36f9-db92-4636-b145-3d99f1bb88a0');
    const fac179Uuid = fac179 ? fac179.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '179').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg179New = [
        { first_name: 'Kago', last_name: 'Dintsi', gender: 'F', age: 21, contact: '72706583', education: 'JCE', marital_status: 'Single', affiliation: '', occupation: 'AGENT', attDays: [1, 2, 3] },
        { first_name: 'Mmonye B.', last_name: 'Tlhase', gender: 'F', age: 46, contact: '71861129', education: 'JCE', marital_status: 'MARRIED', affiliation: '', occupation: 'PHA', attDays: [2, 3] },
        { first_name: 'Keitumetse', last_name: 'Morolong', gender: 'F', age: null, contact: '', education: '', marital_status: '', affiliation: '', occupation: '', attDays: [] }
    ];
    reg179New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'MOCHUDI MALL',
            group_form_number: '179',
            facilitator_uuid: fac179Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 12: REGISTER 182 (+4 new rows across P1 & P2, update attendance)
    console.log(" - Processing REGISTER 182 (Tseone B. Lemogo)...");
    const fac182 = allDocs.find(d => d.uuid === '6dbadb29-4619-45cb-b4eb-e987d603923f');
    const fac182Uuid = fac182 ? fac182.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '182').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[1] = true; att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg182New = [
        { first_name: 'Mphoentle', last_name: 'Seleke', gender: 'F', age: 30, contact: '72334463', education: '', marital_status: 'S', affiliation: '', occupation: '', attDays: [] },
        { first_name: 'Kobo', last_name: 'Grodise', gender: 'M', age: 37, contact: '76394215', education: '', marital_status: 'S', affiliation: '', occupation: '', attDays: [3] },
        { first_name: 'Bekithemba', last_name: 'Mpofu', gender: 'M', age: 37, contact: '78457363', education: '4Z', marital_status: 'S', affiliation: 'Selfemployed', occupation: 'Selfemployed', attDays: [1, 2, 3] },
        { first_name: 'Patricia', last_name: 'Semane', gender: 'F', age: 22, contact: '78578313', education: 'JCE', marital_status: 'S', affiliation: '', occupation: '', attDays: [1, 2, 3] }
    ];
    reg182New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'PLOT 10226 PHAPHANE',
            group_form_number: '182',
            facilitator_uuid: fac182Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 13: REGISTER 185 (+3 new rows on Sub 2, update attendance)
    console.log(" - Processing REGISTER 185 (Kagiso Moitoi)...");
    const fac185 = allDocs.find(d => d.uuid === '84623fcf-a3bf-41c5-bd3c-f48f3c6a13e9');
    const fac185Uuid = fac185 ? fac185.uuid : crypto.randomUUID();
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '185').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[2] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });
    const reg185New = [
        { first_name: 'Lefika', last_name: 'Seme', gender: 'F', age: 23, contact: '75055189', education: 'BGCSE', marital_status: 'S', affiliation: 'Regional Edu Off', occupation: 'IT Intern', attDays: [0, 1] },
        { first_name: 'Boniface', last_name: 'Moduo', gender: 'M', age: 46, contact: '72441002', education: 'BSc', marital_status: 'M', affiliation: 'Regional Edu Off', occupation: 'Chief Edu Officer', attDays: [2] },
        { first_name: 'Ofentse', last_name: 'Rampele', gender: 'F', age: 53, contact: '71775600', education: 'Masters Counseling', marital_status: 'M', affiliation: 'Regional Edu Off', occupation: 'CEO', attDays: [2] }
    ];
    reg185New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
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
            place: 'Education Regional Office',
            group_form_number: '185',
            facilitator_uuid: fac185Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 14: REGISTER 201 Sheet 6 (Transfer 4 from 191 + 5 new inmates)
    console.log(" - Processing REGISTER 201 Sheet 6 (Mochudi State Prison)...");
    const fac201 = allDocs.find(d => d.uuid === '0a337ef0-ce8f-47ea-bd0e-1dcdffb1c369');
    const fac201Uuid = fac201 ? fac201.uuid : crypto.randomUUID();
    // Transfer 4 from 191 to 201
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '191').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[1] = true; att[2] = true; att[3] = true; // 28, 29, 30 Oct
        docsToUpsert.set(p.uuid, {
            ...p,
            group_form_number: '201',
            facilitator_uuid: fac201Uuid,
            attendance: att,
            books_received: true,
            updated_at: now
        });
        console.log(`   - Re-linked inmate ${p.first_name} ${p.last_name} from Form 191 to Form 201.`);
    });
    // Add 5 new inmates
    const reg201New = [
        { first_name: 'Boago Boka', last_name: 'Keakile', gender: 'M', age: 43, contact: '5777251', education: 'J', marital_status: 'S', affiliation: 'Mochudi Prison', occupation: 'Inmate' },
        { first_name: 'Clark', last_name: 'Dilampi', gender: 'M', age: 66, contact: '5777251', education: 'P', marital_status: 'M', affiliation: 'Mochudi Prison', occupation: 'Inmate' },
        { first_name: 'Onest', last_name: 'Sedikwe', gender: 'M', age: 27, contact: '5777251', education: 'P', marital_status: 'S', affiliation: 'Mochudi Prison', occupation: 'Inmate' },
        { first_name: 'Rafoka', last_name: 'Medupe', gender: 'M', age: 44, contact: '5777251', education: 'J', marital_status: 'S', affiliation: 'Mochudi Prison', occupation: 'Inmate' },
        { first_name: 'Motshwarakgole', last_name: 'Garebone', gender: 'M', age: 33, contact: '5777251', education: 'U', marital_status: 'S', affiliation: 'Mochudi Prison', occupation: 'Inmate' }
    ];
    reg201New.forEach(p => {
        const pUuid = crypto.randomUUID();
        const att = Array(12).fill(false);
        att[2] = true; att[3] = true; // 29, 30 Oct
        docsToUpsert.set(pUuid, {
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
            place: 'Mochudi State Prison',
            group_form_number: '201',
            facilitator_uuid: fac201Uuid,
            attendance: att,
            books_received: true,
            created_at: now,
            updated_at: now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: USER_UID,
            created_by_name: USER_NAME,
            created_by_email: USER_EMAIL
        });
    });

    // Table 15: REGISTER 220 (Main Land Board: Rows 1-10 + Row 11 Remmonye Kgomo)
    console.log(" - Processing REGISTER 220 (Main Land Board)...");
    const fac220 = allDocs.find(d => d.uuid === '16fe091e-5a2a-4c98-9768-9c62fc1103df') ||
                   findFacilitator('220', '76263830', 'Onneile Makwatse');
    const fac220Uuid = fac220 ? fac220.uuid : crypto.randomUUID();
    docsToUpsert.set(fac220Uuid, {
        ...(fac220 || {}),
        uuid: fac220Uuid,
        type: 'facilitator',
        first_name: fac220?.first_name || 'Onneile',
        last_name: fac220?.last_name || 'Makwatse',
        contact: '76263830',
        form_number: '220',
        place: 'Main Land Board',
        meeting_time: '15:00',
        teaching_group: true,
        is_daily_core: true,
        books_received: true,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false,
        campaign_id: CAMPAIGN_ID
    });

    const reg220All = [
        { first_name: 'Kate', last_name: 'Thomas', gender: 'F', age: 46, contact: '72713344', education: 'Diploma', marital_status: 'Single', affiliation: 'Kgatleng Land Board', occupation: 'Principal Accounts Officer', attDays: [0] },
        { first_name: 'Lesego', last_name: 'Mosite', gender: 'F', age: 25, contact: '78278126', education: 'Degree', marital_status: 'Single', affiliation: 'Kgatleng Land Board', occupation: 'Estate Intern', attDays: [0, 1, 2, 3] },
        { first_name: 'Precious', last_name: 'Mokgwati', gender: 'F', age: 40, contact: '72528096', education: 'Diploma', marital_status: 'Married', affiliation: 'Kgatleng Land Board', occupation: 'Estate Intern', attDays: [0, 1, 2, 3] },
        { first_name: 'Unami', last_name: 'Sedze', gender: 'F', age: 34, contact: '76276944', education: 'Degree', marital_status: 'Single', affiliation: 'Kgatleng Land Board', occupation: 'Ass EO', attDays: [0, 1, 2, 3] },
        { first_name: 'Onalenna', last_name: 'Mokgatlhe', gender: 'F', age: 47, contact: '71826375', education: 'Degree', marital_status: 'Married', affiliation: 'Kgatleng Land Board', occupation: 'Principal TO', attDays: [0, 1] },
        { first_name: 'Montshetsi', last_name: 'Mokane', gender: 'M', age: 41, contact: '72277960', education: 'Master', marital_status: 'Single', affiliation: 'Kgatleng Land Board', occupation: 'Snr Accountant', attDays: [0, 1, 2, 3] },
        { first_name: 'Keentseng', last_name: 'Morake', gender: 'F', age: 36, contact: '77170613', education: 'JC', marital_status: 'Single', affiliation: 'Kgatleng Land Board', occupation: 'Cleaner', attDays: [0] },
        { first_name: 'Gomolemo', last_name: 'Tlou', gender: 'M', age: 36, contact: '71328450', education: 'Degree', marital_status: 'Single', affiliation: 'Kgatleng Land Board', occupation: 'Land Surveyor', attDays: [0, 1] },
        { first_name: 'Vincent', last_name: 'Jansen', gender: 'M', age: 40, contact: '73407329', education: 'U', marital_status: 'Married', affiliation: 'Kgatleng Land Board', occupation: 'SLBO', attDays: [0] },
        { first_name: 'Olebile', last_name: 'Tshotlego', gender: 'F', age: 56, contact: '73030725', education: 'U', marital_status: 'Married', affiliation: 'Kgatleng Land Board', occupation: 'Accountant', attDays: [0] },
        // Row 11:
        { first_name: 'Remmonye', last_name: 'Kgomo', gender: 'F', age: null, contact: '77059608', education: 'U', marital_status: 'S', affiliation: 'Kgatleng Land Board', occupation: 'Accountant', attDays: [0, 1, 2, 3] }
    ];
    reg220All.forEach(p => {
        const existing = allDocs.find(d => d.type === 'participant' && !d.is_deleted && cleanStr(d.first_name) === cleanStr(p.first_name) && cleanStr(d.last_name) === cleanStr(p.last_name));
        const pUuid = existing ? existing.uuid : crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
            ...(existing || {}),
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
            place: 'Main Land Board',
            group_form_number: '220',
            facilitator_uuid: fac220Uuid,
            attendance: att,
            books_received: true,
            updated_at: now,
            created_at: existing?.created_at || now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existing?.created_by_uid || USER_UID,
            created_by_name: existing?.created_by_name || USER_NAME,
            created_by_email: existing?.created_by_email || USER_EMAIL
        });
    });

    // ==================================================================
    // STEP 3: SECTION 2 (CATEGORY A: ATTENDANCE-ONLY & RE-NUMBERING)
    // ==================================================================
    console.log("\n5. Applying Section 2: Category A Updates (59, 189->190, 201 S1-5, 202, 222, 225)...");

    // 1. REGISTER 59
    console.log(" - Updating REGISTER 59 attendance (28, 29, 30 Oct)...");
    const fac59 = allDocs.find(d => d.uuid === 'dd782552-1227-4096-aeae-69f2c0249339');
    if (fac59) {
        docsToUpsert.set(fac59.uuid, {
            ...fac59,
            form_number: '59',
            place: 'Tigers F Club',
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '59').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true; att[1] = true; att[2] = true; att[3] = true;
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });

    // 2. REGISTER 189 P2 -> REGISTER 190 P1
    console.log(" - Re-numbering REGISTER 189 P2 to REGISTER 190 P1 (Segametsi Setshwane)...");
    const fac189 = allDocs.find(d => d.uuid === '023a6aba-2e6a-446f-9f7f-b36687ac88fa');
    if (fac189) {
        docsToUpsert.set(fac189.uuid, {
            ...fac189,
            form_number: '190',
            place: 'At home',
            meeting_time: '20:00',
            second_leader_name: 'Mmamokola Gouwe',
            second_leader_contact: '72509327',
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
    }
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && (d.group_form_number === '189' || d.facilitator_uuid === '023a6aba-2e6a-446f-9f7f-b36687ac88fa')).forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(p.uuid, {
            ...p,
            group_form_number: '190',
            facilitator_uuid: fac189 ? fac189.uuid : p.facilitator_uuid,
            attendance: att,
            books_received: true,
            updated_at: now
        });
    });

    // 3. REGISTER 201 Sheets 1-5 (56 active inmates)
    console.log(" - Updating REGISTER 201 Sheets 1-5 attendance (29, 30 Oct)...");
    allDocs.filter(d => d.type === 'participant' && !d.is_deleted && d.group_form_number === '201').forEach(p => {
        const att = [...(p.attendance || Array(12).fill(false))];
        att[2] = true; att[3] = true; // 29, 30 Oct
        docsToUpsert.set(p.uuid, { ...p, attendance: att, books_received: true, updated_at: now });
    });

    // 4. REGISTER 202 (Kgamanyane School, Katlego Nkatswang)
    console.log(" - Processing REGISTER 202 (Katlego Nkatswang)...");
    const fac202 = allDocs.find(d => d.uuid === 'f36a5969-22ec-4096-88a9-62bf720e19a0');
    const fac202Uuid = fac202 ? fac202.uuid : crypto.randomUUID();
    docsToUpsert.set(fac202Uuid, {
        ...(fac202 || {}),
        uuid: fac202Uuid,
        type: 'facilitator',
        first_name: fac202?.first_name || 'Katlego',
        last_name: fac202?.last_name || 'Nkatswang',
        contact: '78247743',
        form_number: '202',
        place: 'Kgamanyane School',
        meeting_time: '14:00',
        second_leader_name: 'Botho Lindi Phiri',
        second_leader_contact: '76616081',
        teaching_group: true,
        is_daily_core: true,
        books_received: true,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false,
        campaign_id: CAMPAIGN_ID
    });

    const reg202Participants = [
        { first_name: 'Kalabetso', last_name: 'Makola', gender: 'F', age: 13, contact: '72503578', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Gofiwa', last_name: 'Kago', gender: 'F', age: 13, contact: '77890588', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Thato', last_name: 'Mogotlhwane', gender: 'F', age: 14, contact: '78021276', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Boineelo', last_name: 'Masire', gender: 'F', age: 14, contact: '76449624', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Kitso', last_name: 'Moeng', gender: 'F', age: 14, contact: '78888674', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Tumelo', last_name: 'Sebeke', gender: 'M', age: 14, contact: '71213219', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Sanikelo', last_name: 'Zitha', gender: 'M', age: 15, contact: '77762240', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Katso', last_name: 'Tshukudu', gender: 'M', age: 15, contact: '74341993', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Atang', last_name: 'Gare', gender: 'M', age: 13, contact: '76763165', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Andy', last_name: 'Ratladi', gender: 'M', age: 15, contact: '77729260', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Albert', last_name: 'Modise', gender: 'M', age: 15, contact: '', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' },
        { first_name: 'Tumelo', last_name: 'Mooketsi', gender: 'F', age: 14, contact: '72321670', education: 'Form 1', marital_status: 'Single', affiliation: 'Kgamanyane', occupation: 'Student' }
    ];
    reg202Participants.forEach(p => {
        const existing = allDocs.find(d => d.type === 'participant' && !d.is_deleted && cleanStr(d.first_name) === cleanStr(p.first_name) && cleanStr(d.last_name) === cleanStr(p.last_name));
        const pUuid = existing ? existing.uuid : crypto.randomUUID();
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(pUuid, {
            ...(existing || {}),
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
            place: 'Kgamanyane School',
            group_form_number: '202',
            facilitator_uuid: fac202Uuid,
            attendance: att,
            books_received: true,
            updated_at: now,
            created_at: existing?.created_at || now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existing?.created_by_uid || USER_UID,
            created_by_name: existing?.created_by_name || USER_NAME,
            created_by_email: existing?.created_by_email || USER_EMAIL
        });
    });

    // 5. REGISTER 222 (ex-Unnumbered Group #3 — Boineelo Ipotseng)
    console.log(" - Processing REGISTER 222 (Boineelo Ipotseng)...");
    const fac222 = allDocs.find(d => d.uuid === '93ab3f04-c8a6-4154-9970-4a2b17b0ae78');
    const fac222Uuid = fac222 ? fac222.uuid : crypto.randomUUID();
    docsToUpsert.set(fac222Uuid, {
        ...(fac222 || {}),
        uuid: fac222Uuid,
        type: 'facilitator',
        first_name: fac222?.first_name || 'Boineelo',
        last_name: fac222?.last_name || 'Ipotseng',
        contact: '75570423',
        form_number: '222',
        place: 'Morwa Kgotla',
        meeting_time: '11:45 hrs',
        teaching_group: true,
        is_daily_core: true,
        books_received: true,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false,
        campaign_id: CAMPAIGN_ID
    });

    const reg222Participants = [
        { first_name: 'Eric', last_name: 'Ntshole', gender: 'M', age: 60, contact: '71744088', education: 'S', marital_status: 'M', affiliation: 'Tribal', occupation: 'Kgosi', attDays: [0, 1, 2, 3] },
        { first_name: 'Kgetse', last_name: 'Ntshole', gender: 'M', age: 78, contact: '71429379', education: 'J', marital_status: 'D', affiliation: 'Tribal', occupation: 'Kgosana', attDays: [0, 1, 2, 3] },
        { first_name: 'Barongwa', last_name: 'Setlhabi', gender: 'M', age: 48, contact: '71726676', education: 'J', marital_status: 'S', affiliation: 'Tribal', occupation: 'Kgosana', attDays: [0, 1, 2, 3] },
        { first_name: 'Thabiso', last_name: 'Motsu', gender: 'M', age: 58, contact: '71520245', education: 'J', marital_status: 'M', affiliation: 'Tribal', occupation: 'Kgosana', attDays: [0, 2, 3] }, // X on 28 Oct
        { first_name: 'Thabiso', last_name: 'Tladi', gender: 'M', age: 64, contact: '76645955', education: 'J', marital_status: 'M', affiliation: 'Tribal', occupation: 'Kgosana', attDays: [0, 1, 2, 3] },
        { first_name: 'Lebotse', last_name: 'Kwapa', gender: 'M', age: 67, contact: '73868137', education: 'J', marital_status: 'S', affiliation: 'Tribal', occupation: 'Kgosana', attDays: [0, 2, 3] }, // X on 28 Oct
        { first_name: 'Pamela', last_name: 'Ntshole', gender: 'F', age: 35, contact: '74677810', education: 'S', marital_status: 'C', affiliation: 'Police', occupation: 'Police Officer', attDays: [0, 1, 2, 3] },
        { first_name: 'Boitumelo', last_name: 'Baatweng', gender: 'F', age: 28, contact: '77725111', education: 'S', marital_status: 'M', affiliation: 'Police', occupation: 'Police Officer', attDays: [0, 1, 2, 3] },
        { first_name: 'Dimpho', last_name: 'Moamogodi', gender: 'F', age: 39, contact: '77636577', education: 'S', marital_status: 'C', affiliation: 'Tribal', occupation: 'Cleaner', attDays: [0, 1, 2, 3] },
        { first_name: 'Masiti', last_name: 'Makgopa', gender: 'F', age: 41, contact: '73701464', education: 'T', marital_status: 'M', affiliation: 'Tribal', occupation: 'Court Bailiff', attDays: [0, 1, 2, 3] },
        { first_name: 'Onica', last_name: 'Kwapa', gender: 'F', age: 31, contact: '75228262', education: 'S', marital_status: 'C', affiliation: 'Police', occupation: 'Police Officer', attDays: [0, 1, 2, 3] }
    ];
    reg222Participants.forEach(p => {
        const existing = allDocs.find(d => d.type === 'participant' && !d.is_deleted && cleanStr(d.first_name) === cleanStr(p.first_name) && cleanStr(d.last_name) === cleanStr(p.last_name));
        const pUuid = existing ? existing.uuid : crypto.randomUUID();
        const att = Array(12).fill(false);
        p.attDays.forEach(d => att[d] = true);
        docsToUpsert.set(pUuid, {
            ...(existing || {}),
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
            place: 'Morwa Kgotla',
            group_form_number: '222',
            facilitator_uuid: fac222Uuid,
            attendance: att,
            books_received: true,
            updated_at: now,
            created_at: existing?.created_at || now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existing?.created_by_uid || USER_UID,
            created_by_name: existing?.created_by_name || USER_NAME,
            created_by_email: existing?.created_by_email || USER_EMAIL
        });
    });

    // 6. REGISTER 225 (ex-[Unnumbered New #C] — Mmapula Rammala)
    console.log(" - Processing REGISTER 225 (Mmapula Rammala)...");
    const fac225 = allDocs.find(d => d.uuid === 'b86b85ac-722e-4efa-95d1-9a894d850d04');
    const fac225Uuid = fac225 ? fac225.uuid : crypto.randomUUID();
    docsToUpsert.set(fac225Uuid, {
        ...(fac225 || {}),
        uuid: fac225Uuid,
        type: 'facilitator',
        first_name: fac225?.first_name || 'Mmapula',
        last_name: fac225?.last_name || 'Rammala',
        contact: '72569127',
        form_number: '225',
        place: 'MOREMA WARD VDC OFFICE',
        meeting_time: '17:00 hrs',
        teaching_group: true,
        is_daily_core: true,
        books_received: true,
        updated_at: now,
        sync_status: 'synced',
        is_deleted: false,
        campaign_id: CAMPAIGN_ID
    });

    const reg225Participants = [
        { first_name: 'Phemelo', last_name: 'Pilane', gender: 'M', age: 51, contact: '76035392', education: 'J', marital_status: 'S', affiliation: '', occupation: 'SELF EMPLOYED' },
        { first_name: 'Dineo', last_name: 'Rammala', gender: 'F', age: 34, contact: '74874910', education: 'S', marital_status: 'S', affiliation: 'MOHE', occupation: 'PROCUMENT' },
        { first_name: 'Tomeletso', last_name: 'Rapoo', gender: 'F', age: null, contact: '76536987', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Anitah', last_name: 'Mpetane', gender: 'F', age: null, contact: '76536987', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Othusitse', last_name: 'Moitlamo', gender: 'F', age: null, contact: '75477805', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Dorah M.', last_name: 'Mooketsi', gender: 'F', age: null, contact: '71375205', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Patience', last_name: 'Rusoto', gender: 'F', age: null, contact: '77194980', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Kabelo', last_name: 'Segobye', gender: 'M', age: null, contact: '76774563', education: 'S', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Serapelo', last_name: 'Rammala', gender: 'F', age: null, contact: '72268251', education: 'J', marital_status: 'S', affiliation: '', occupation: 'MOTSWEDI REH. C' },
        { first_name: 'Katlego P.', last_name: 'Rammala', gender: 'F', age: null, contact: '74685548', education: 'U', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Dira', last_name: 'Kgetse', gender: 'M', age: null, contact: '72963234', education: '', marital_status: 'S', affiliation: '', occupation: 'MOTSWEDI REH. C' },
        { first_name: 'Kelebogile', last_name: 'Moatlhodi', gender: 'F', age: null, contact: '75967292', education: 'S', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Onneile', last_name: 'Letsatsi', gender: 'F', age: 30, contact: '76362464', education: 'S', marital_status: 'S', affiliation: '', occupation: 'SELFEMPLOYED' },
        { first_name: 'Harold', last_name: 'Molapi', gender: 'M', age: 32, contact: '76552862', education: 'J', marital_status: 'S', affiliation: '', occupation: 'SELFEMPLOYED' },
        { first_name: 'Masego', last_name: 'Mooketsi', gender: 'F', age: null, contact: '71883378', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Omphile', last_name: 'Ratladi', gender: 'M', age: 37, contact: '77870544', education: 'J', marital_status: 'S', affiliation: '', occupation: 'SELFEMPLOYED' },
        { first_name: 'Alfred', last_name: 'Phiri', gender: 'M', age: null, contact: '74886980', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' },
        { first_name: 'Salome', last_name: 'Dire', gender: 'F', age: 37, contact: '74652474', education: 'J', marital_status: 'S', affiliation: '', occupation: 'UNEMPLOYED' }
    ];
    reg225Participants.forEach(p => {
        const existing = allDocs.find(d => d.type === 'participant' && !d.is_deleted && cleanStr(d.first_name) === cleanStr(p.first_name) && cleanStr(d.last_name) === cleanStr(p.last_name));
        const pUuid = existing ? existing.uuid : crypto.randomUUID();
        const att = Array(12).fill(false);
        att[0] = true; att[1] = true; att[2] = true; att[3] = true; // 27, 28, 29, 30 Oct
        docsToUpsert.set(pUuid, {
            ...(existing || {}),
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
            place: 'MOREMA WARD VDC OFFICE',
            group_form_number: '225',
            facilitator_uuid: fac225Uuid,
            attendance: att,
            books_received: true,
            updated_at: now,
            created_at: existing?.created_at || now,
            sync_status: 'synced',
            is_deleted: false,
            campaign_id: CAMPAIGN_ID,
            created_by_uid: existing?.created_by_uid || USER_UID,
            created_by_name: existing?.created_by_name || USER_NAME,
            created_by_email: existing?.created_by_email || USER_EMAIL
        });
    });

    // ==================================================================
    // STEP 4: RECALCULATE FACILITATOR AGGREGATIONS
    // ==================================================================
    console.log("\n6. Recalculating books_distributed and participants_count for all facilitators...");
    // Build active participant counts per facilitator UUID and form number
    const activePartsByFacUuid = {};
    const activePartsByForm = {};

    // Count in allDocs (excluding deleted)
    for (const d of allDocs) {
        if (d.type === 'participant' && !d.is_deleted && !docsToDelete.has(d.uuid)) {
            // If docsToUpsert has updated version, use docsToUpsert's facilitator_uuid
            const updated = docsToUpsert.get(d.uuid);
            const facId = updated ? updated.facilitator_uuid : d.facilitator_uuid;
            const formId = updated ? updated.group_form_number : d.group_form_number;
            if (facId) activePartsByFacUuid[facId] = (activePartsByFacUuid[facId] || 0) + 1;
            if (formId) activePartsByForm[String(formId)] = (activePartsByForm[String(formId)] || 0) + 1;
        }
    }
    // Count brand new participants in docsToUpsert (not in allDocs)
    for (const [uuid, d] of docsToUpsert.entries()) {
        if (d.type === 'participant' && !d.is_deleted && !allDocs.some(od => od.uuid === uuid)) {
            const facId = d.facilitator_uuid;
            const formId = d.group_form_number;
            if (facId) activePartsByFacUuid[facId] = (activePartsByFacUuid[facId] || 0) + 1;
            if (formId) activePartsByForm[String(formId)] = (activePartsByForm[String(formId)] || 0) + 1;
        }
    }

    // Update all facilitators in docsToUpsert
    for (const [uuid, d] of docsToUpsert.entries()) {
        if (d.type === 'facilitator') {
            const byUuidCount = activePartsByFacUuid[uuid] || 0;
            const byFormCount = d.form_number ? (activePartsByForm[String(d.form_number)] || 0) : 0;
            const count = byUuidCount > 0 ? byUuidCount : byFormCount;
            d.participants_count = count;
            d.books_distributed = count;
            d.books_received = true;
            d.teaching_group = true;
            d.is_daily_core = true;
            d.updated_at = now;
        }
    }

    // Also update any other facilitators in allDocs whose participants count changed
    for (const f of facilitators) {
        if (!docsToUpsert.has(f.uuid)) {
            const byUuidCount = activePartsByFacUuid[f.uuid] || 0;
            const byFormCount = f.form_number ? (activePartsByForm[String(f.form_number)] || 0) : 0;
            const count = byUuidCount > 0 ? byUuidCount : byFormCount;
            if (count > 0 && (f.participants_count !== count || f.books_distributed !== count)) {
                docsToUpsert.set(f.uuid, {
                    ...f,
                    participants_count: count,
                    books_distributed: count,
                    books_received: true,
                    teaching_group: true,
                    is_daily_core: true,
                    updated_at: now
                });
            }
        }
    }

    console.log(`Summary of Operations:`);
    console.log(` - Upsert Records (Facilitators & Participants): ${docsToUpsert.size}`);
    console.log(` - Soft-Delete Records (Crossed-Out): ${docsToDelete.size}`);

    // ==================================================================
    // STEP 5: SYNC TO LOCAL DEXIE DB (via fake-indexeddb)
    // ==================================================================
    console.log("\n7. Syncing records to local Dexie IndexedDB (db.registrations)...");
    const upsertList = Array.from(docsToUpsert.values());
    try {
        await db.registrations.bulkPut(upsertList);
        console.log(` - Synced ${upsertList.length} records into Dexie db.registrations.`);
    } catch (err) {
        console.warn(` - Dexie local sync note: ${err.message}`);
    }

    // ==================================================================
    // STEP 6: COMMIT TO CLOUD FIRESTORE IN BATCHES
    // ==================================================================
    console.log("\n8. Committing all records to Cloud Firestore in batches...");
    const BATCH_SIZE = 400;

    for (let i = 0; i < upsertList.length; i += BATCH_SIZE) {
        const slice = upsertList.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const item of slice) {
            const docRef = doc(firestoreDb, 'registrations', item.uuid);
            const { id: _ignore, docId: _ignore2, ...dataToSync } = item;
            batch.set(docRef, dataToSync, { merge: true });
        }
        await batch.commit();
        console.log(` - Committed upsert batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, upsertList.length)} / ${upsertList.length})`);
    }

    // Soft-deletions
    if (docsToDelete.size > 0) {
        const delBatch = writeBatch(firestoreDb);
        for (const uuid of docsToDelete) {
            const docRef = doc(firestoreDb, 'registrations', uuid);
            delBatch.update(docRef, {
                is_deleted: true,
                deleted_at: now,
                updated_at: now,
                deletion_reason: 'Crossed-out on physical register (30 Oct 2026 handover)'
            });
        }
        await delBatch.commit();
        console.log(` - Committed deletion batch (${docsToDelete.size} records soft-deleted).`);
    }

    console.log("Cloud Firestore sync committed successfully!\n");

    // ==================================================================
    // STEP 7: PUSH BUFFER TO GOOGLE SHEETS WEB APP
    // ==================================================================
    console.log("9. Pushing consolidated profile buffer to Google Sheets Web App...");
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
    console.log(" 30 OCTOBER 2026 HANDOVER IMPORT & UPDATE PIPELINE COMPLETED!");
    console.log("==================================================================");
}

runHandover().catch(err => {
    console.error("Pipeline failed with error:", err);
    process.exit(1);
});
