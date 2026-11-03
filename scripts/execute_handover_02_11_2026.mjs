import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import 'fake-indexeddb/auto';
import db from '../src/lib/dexieDb.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Ensure TLS bypass for corporate certificate proxy if needed
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
    return String(str).replace(/~~/g, '').replace(/\*/g, '').trim();
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

function parseEducation(ed) {
    if (!ed) return 'Other';
    const s = clean(ed).toLowerCase();
    if (s.includes('prim') || s.includes('std') || s.includes('psle') || s === 'p') return 'Primary';
    if (s.includes('jun') || s.includes('form 1') || s.includes('form 2') || s.includes('form 3') || s.includes('jc') || s === 'j') return 'Junior';
    if (s.includes('sen') || s.includes('form 4') || s.includes('form 5') || s.includes('bgcse') || s.includes('igcse') || s === 's') return 'Senior';
    if (s.includes('voc') || s.includes('brigade') || s.includes('apprentice') || s.includes('cert') || s.includes('trade')) return 'Vocational';
    if (s.includes('dip') || s.includes('deg') || s.includes('uni') || s.includes('tertiary') || s.includes('coll') || s.includes('ba') || s.includes('bsc') || s.includes('bed') || s.includes('mpa') || s === 'u') return 'University';
    return 'Other';
}

function parseMarital(m) {
    if (!m) return 'Single';
    const s = clean(m).toLowerCase();
    if (s.startsWith('m')) return 'Married';
    if (s.startsWith('c') || s.includes('cohab')) return 'Cohabiting';
    if (s.startsWith('w') || s.includes('widow')) return 'Widowed';
    if (s.startsWith('d') || s.includes('divorc')) return 'Divorced';
    return 'Single';
}

// Resilient Firestore query with retries
async function getDocsWithRetry(maxAttempts = 5) {
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            console.log(`Fetching from Firestore (attempt ${i}/${maxAttempts})...`);
            const snap = await getDocs(collection(firestoreDb, 'registrations'));
            if (snap.docs.length > 50) {
                console.log(`Successfully retrieved ${snap.docs.length} documents from Firestore.`);
                return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
            }
            console.log(`Received ${snap.docs.length} docs (waiting for online sync)...`);
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3500));
    }
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
}

// ============================================================================
// DATA DEFINITIONS: 02 NOVEMBER 2026 HANDOVER
// ============================================================================

// 1. Category A: Brand-New Numbered Registers (5 Groups | 66 Participants)
const catA_groups = [
    {
        formNumber: '2',
        facilitatorName: 'Ikakanyeng Letuba',
        facilitatorPhone: '72757315',
        secondLeaderName: '',
        secondLeaderPhone: '',
        venue: 'Glen Valley Camp 112 P',
        time: '20:00',
        booksGiven: 22,
        participants: [
            { first_name: 'Othusitse', last_name: 'Kgosimore', gender: 'M', age: 27, contact: '74119026', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Tiato', last_name: 'Goboyatau', gender: 'F', age: 22, contact: '72525005', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Gape', last_name: 'Gawina', gender: 'M', age: 22, contact: '76356790', education: 'S', marital: 'C', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Lesego', last_name: 'Leontse', gender: 'M', age: 22, contact: '78317843', education: 'S', marital: 'C', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Lindiwe', last_name: 'Xamodamo', gender: 'F', age: 23, contact: '77358359', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Oratile', last_name: 'Kokwe', gender: 'M', age: 25, contact: '75456192', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Leoleditse', last_name: 'Rantshese', gender: 'M', age: 24, contact: '76091558', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Kealeboga', last_name: 'Dikeleko', gender: 'M', age: 24, contact: '77099705', education: 'S', marital: 'C', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Mooketsi', last_name: 'Magwaza', gender: 'M', age: 26, contact: '71588321', education: 'S', marital: 'C', org: 'BDF', occ: 'SOLDIER', att: [0, 1, 2] },
            { first_name: 'Motshabi', last_name: 'Motsamai', gender: 'M', age: 24, contact: '78733289', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [1, 2] },
            { first_name: 'Austin', last_name: 'James', gender: 'M', age: 25, contact: '74757125', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [1, 2] },
            { first_name: 'Mocketsi', last_name: 'Khupe', gender: 'M', age: 24, contact: '75471939', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [1, 2] },
            { first_name: 'Kabelo', last_name: 'Tladinyane', gender: 'M', age: 26, contact: '77669792', education: 'U', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Motsisi', last_name: 'Goitsiwang', gender: 'M', age: 21, contact: '75056281', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Kgakgang', last_name: 'Gaboitshwarelwe', gender: 'M', age: 22, contact: '72982785', education: 'U', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Oris', last_name: 'Malebogo', gender: 'M', age: 24, contact: '77704642', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Mosimanegape', last_name: 'Judge', gender: 'M', age: 34, contact: '76009603', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Bakgonne', last_name: 'Sebetlela', gender: 'M', age: 34, contact: '77181234', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Muhlutshwa', last_name: 'Mudongo', gender: 'M', age: 34, contact: '74890812', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Lefatshe', last_name: 'Motshegwe', gender: 'M', age: 34, contact: '75748139', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Goitseone', last_name: 'Mangwe', gender: 'F', age: 24, contact: '76337267', education: 'U', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] },
            { first_name: 'Mmoloki', last_name: 'Setlhoka', gender: 'M', age: 37, contact: '76155934', education: 'S', marital: 'S', org: 'BDF', occ: 'SOLDIER', att: [0, 1] }
        ]
    },
    {
        formNumber: '97',
        facilitatorName: 'Lindah Mokalane',
        facilitatorPhone: '71722019',
        secondLeaderName: '',
        secondLeaderPhone: '',
        venue: 'Farm Car Wash, Tuck Shop',
        time: '',
        booksGiven: 12,
        participants: [
            { first_name: 'Nancy', last_name: 'Bakerek', gender: 'F', age: 34, contact: '76624186', education: 'JC', marital: 'S', org: 'FARM', occ: 'LABOUR', att: [1, 2, 3, 4, 5] },
            { first_name: 'Godiraone', last_name: 'Tsheole', gender: 'F', age: 37, contact: '71865919', education: 'JC', marital: 'S', org: 'FARM', occ: 'LABOUR', att: [1, 2, 3, 4, 5] },
            { first_name: 'Abel Philes', last_name: 'Toteng', gender: 'M', age: 48, contact: '74176808', education: 'TERTIARY', marital: 'S', org: 'HUMAN SETTLEMENT', occ: 'OFFICER', att: [1, 2, 3, 4, 5] },
            { first_name: 'Thato Agnes', last_name: 'Molefe', gender: 'F', age: 33, contact: '77054042', education: 'TERTIARY', marital: 'S', org: 'SELF EMPLOYED', occ: 'SELF EMPLOYED', att: [1, 2, 3, 4, 5] },
            { first_name: 'Ogolotswe', last_name: 'Ntlhakane', gender: 'M', age: 52, contact: '72313310', education: 'JC', marital: 'S', org: 'SELF EMPLOYED', occ: 'SELF EMPLOYED', att: [1, 2, 3, 4, 5] },
            { first_name: 'Tshepiso', last_name: 'Magaga', gender: 'F', age: 38, contact: '73155605', education: 'BGCSE', marital: 'S', org: 'SELF EMPLOYED', occ: 'SELF EMPLOYED', att: [1, 2, 3, 4, 5] },
            { first_name: 'Tumelo', last_name: 'Balopi', gender: 'M', age: 32, contact: '72591701', education: 'JC', marital: 'S', org: 'FARM', occ: 'LABOUR', att: [1, 2, 3, 4, 5] },
            { first_name: 'Leungo', last_name: 'Tane', gender: 'F', age: 20, contact: '75021684', education: 'JC', marital: 'S', org: 'UNEMPLOYED', occ: 'N/A', att: [1, 2, 3, 4, 5] },
            { first_name: 'Ofentse', last_name: 'Mokgatla', gender: 'M', age: 23, contact: '72390317', education: 'BGCSE', marital: 'S', org: 'UNEMPLOYED', occ: 'N/A', att: [1, 2, 3, 4, 5] },
            { first_name: 'Orene M.', last_name: 'Ramotswetla', gender: 'F', age: 46, contact: '72301180', education: 'TERTIARY', marital: 'S', org: 'SELF EMPLOYED', occ: 'SELF EMPLOYED', att: [1, 2, 3, 4, 5] },
            { first_name: 'Margaret', last_name: 'Ramotswetla', gender: 'F', age: 60, contact: '75381350', education: 'TERTIARY', marital: 'RET', org: 'RETIRED', occ: 'RETIRED', att: [1, 2, 3, 4, 5] },
            { first_name: 'Nthabiseng', last_name: 'Ramotswetla', gender: 'F', age: 23, contact: '74840529', education: 'JC', marital: 'S', org: 'UNEMPLOYED', occ: 'UNEMPLOYED', att: [1, 2, 3, 4, 5] }
        ]
    },
    {
        formNumber: '133',
        facilitatorName: 'Makuku Moagi',
        facilitatorPhone: '76002659',
        secondLeaderName: 'Kgomotso Pheto',
        secondLeaderPhone: '71116970',
        venue: 'Supplies Kgatleng DC',
        time: '12:45',
        booksGiven: 22,
        participants: [
            { first_name: 'Boitumelo T.', last_name: 'Roberts', gender: 'F', age: 58, contact: '71846097', education: 'Junior', marital: 'Widow', org: 'Local Government / Kgatleng DC', occ: 'P.O. II', att: [0] },
            { first_name: 'Gaena M.', last_name: 'Montlhati', gender: 'F', age: 51, contact: '71858522', education: 'College / Senior', marital: 'Single', org: 'Local Government / Kgatleng DC', occ: 'P.O. I', att: [0] },
            { first_name: 'Kedidimetse', last_name: 'Badisa', gender: 'F', age: 59, contact: '74498118', education: 'Senior', marital: 'Divorce', org: 'Kgatleng DC Finance', occ: 'SPA', att: [0] },
            { first_name: 'Moiseopiso', last_name: 'Thomenyana', gender: 'F', age: 42, contact: '74283850', education: 'Senior', marital: 'Single', org: 'Kgatleng District Council', occ: 'P.A', att: [0] },
            { first_name: 'Lebang M.', last_name: 'Keagakwa', gender: 'F', age: 51, contact: '73383957', education: 'College / Senior', marital: 'Married', org: 'Kgatleng D. Council', occ: 'SPA English', att: [0] },
            { first_name: 'Tumisang', last_name: 'Moagi', gender: 'M', age: 37, contact: '74227556', education: 'Senior', marital: 'Single', org: 'K.D.C', occ: 'Labourer', att: [0] },
            { first_name: 'Julia', last_name: 'Gaborone', gender: 'F', age: 42, contact: '71913165', education: 'University', marital: 'Single', org: 'Kgatleng District Council', occ: 'P.O. I', att: [0] },
            { first_name: 'Mpho Masoso', last_name: 'Tladi', gender: 'F', age: 47, contact: '72233513', education: 'Senior', marital: 'Single', org: 'Security', occ: '—', att: [0] },
            { first_name: 'Letlhogonolo', last_name: 'Ntwaagae', gender: 'M', age: 46, contact: '76513419', education: 'Tertiary', marital: 'Married', org: 'Kgatleng D. Council', occ: 'SPA', att: [0] },
            { first_name: 'Mmoni', last_name: 'Molefe', gender: 'F', age: 38, contact: '72414383', education: 'Senior', marital: 'Single', org: 'Security', occ: '—', att: [0] },
            { first_name: 'M. K.', last_name: 'Gaotlhobogwe', gender: 'F', age: 53, contact: '73062857', education: 'Tertiary', marital: 'Married', org: 'KDC', occ: 'PPO I', att: [0] },
            { first_name: 'T. M.', last_name: 'Mokgatla', gender: 'M', age: 40, contact: '72845523', education: 'Tertiary', marital: 'Single', org: 'KDC', occ: 'PPO II', att: [0] },
            { first_name: 'Omphile S', last_name: 'Kenamogetse', gender: 'M', age: 35, contact: '78057326', education: 'Form 3', marital: 'Single', org: 'PROCUREMENT', occ: 'Setswana', att: [0, 1] },
            { first_name: 'Dintsi', last_name: 'Kefilwe', gender: 'F', age: 37, contact: '74539418', education: 'Form 5', marital: 'Single', org: 'PROCUREMENT', occ: 'English SPA', att: [0, 1] },
            { first_name: 'Lesego', last_name: 'Letsatsi', gender: 'M', age: 49, contact: '71798241', education: 'Form 5', marital: 'Single', org: 'PROCUREMENT', occ: 'English SPA', att: [0, 1] },
            { first_name: 'Keitumetse', last_name: 'Pheto', gender: 'F', age: 35, contact: '72398058', education: 'Form 5', marital: 'Single', org: 'NONE', occ: 'NONE', att: [0, 1] },
            { first_name: 'Mmantlo', last_name: 'Motshwane', gender: 'F', age: 41, contact: '72281959', education: 'Form 5', marital: 'Single', org: 'NONE', occ: 'English', att: [0, 1] },
            { first_name: 'Edger', last_name: 'Motshwane', gender: 'M', age: 28, contact: '78194605', education: 'Form 5', marital: 'Single', org: 'NONE', occ: 'English', att: [0, 1] },
            { first_name: 'Boemo', last_name: 'Motshwane', gender: 'F', age: 25, contact: '72309805', education: 'Form 5', marital: 'Single', org: 'NONE', occ: 'Setswana', att: [0, 1] },
            { first_name: 'Gaisang', last_name: 'Mompati', gender: 'F', age: 61, contact: '72535713', education: 'Form 3', marital: 'Widow', org: 'NONE', occ: 'Setswana', att: [0, 1] },
            { first_name: 'Maidi', last_name: 'Maidi', gender: 'M', age: 48, contact: '77929712', education: 'Form 5', marital: 'Married', org: 'NONE', occ: 'English', att: [0, 1] },
            { first_name: 'Canny', last_name: 'Pheto', gender: 'F', age: 32, contact: '77089052', education: 'Form 5', marital: 'Single', org: 'NONE', occ: 'English', att: [0, 1] }
        ]
    },
    {
        formNumber: '140',
        facilitatorName: 'Nelly Kaosimatae',
        facilitatorPhone: '71601838',
        secondLeaderName: 'Losika Mmolana',
        secondLeaderPhone: '72493180',
        venue: 'Library',
        time: '',
        booksGiven: 7,
        participants: [
            { first_name: 'Ignitious', last_name: 'Gaealediwe', gender: 'M', age: 23, contact: '78159615', education: 'JC', marital: 'S', org: 'LIBRARY', occ: 'TSP', att: [] },
            { first_name: 'Calvin', last_name: 'Gare', gender: 'M', age: 28, contact: '71510183', education: 'BGCSE', marital: 'S', org: 'LIBRARY', occ: 'TSP', att: [] },
            { first_name: 'Lebogang', last_name: 'Onneile', gender: 'F', age: 38, contact: '72791992', education: 'Tertiary', marital: 'M', org: 'LIBRARY', occ: 'CLEANER', att: [] },
            { first_name: 'Tshegofatso', last_name: 'Setlhowetsi', gender: 'M', age: 41, contact: '76035342', education: 'Tertiary', marital: 'M', org: 'LIBRARY', occ: 'LIBRARIAN', att: [] },
            { first_name: 'Oarabile', last_name: 'Tlhowetsi', gender: 'M', age: null, contact: '75914851', education: 'Tertiary', marital: 'S', org: 'LIBRARY', occ: 'INTERN', att: [] },
            { first_name: 'Kgamanyane', last_name: 'Kenna', gender: 'F', age: 52, contact: '75014123', education: 'Tertiary', marital: 'S', org: 'LIBRARY', occ: 'LIBRARY OFFICER', att: [] },
            { first_name: 'Koapa', last_name: 'Kgotso', gender: 'F', age: null, contact: '75195271', education: 'BGCSE', marital: 'M', org: 'LIBRARY', occ: 'LIBRARY CLERK', att: [] }
        ]
    },
    {
        formNumber: '247',
        facilitatorName: 'Boome Ellen Ntswetswe',
        facilitatorPhone: '74265960',
        secondLeaderName: '',
        secondLeaderPhone: '',
        venue: '',
        time: '',
        booksGiven: 3,
        participants: [
            { first_name: 'Onalethata', last_name: 'Gobololo', gender: 'F', age: 16, contact: '71212207', education: 'BGCSE', marital: 'Single', org: 'Student', occ: '—', att: [] },
            { first_name: 'Onalerona', last_name: 'Gobololo', gender: 'F', age: 45, contact: '71454844', education: 'JC', marital: 'Single', org: 'Business', occ: '—', att: [] },
            { first_name: 'Solomon', last_name: 'Tsheko', gender: 'M', age: 48, contact: '72443406', education: 'JC', marital: 'Single', org: '—', occ: '—', att: [] }
        ]
    }
];

// 2. Category B: Existing Registers Updated (+10 New Rows + Register 123 Missing Rows + Attendance)
const catB_updates = {
    // REGISTER 34
    '34': {
        newParticipants: [
            { first_name: 'Keneilwe', last_name: 'Jong', gender: 'F', age: 35, contact: '74288614', education: 'S', marital: 'Married', org: '—', occ: 'Employed', att: [2, 3, 4] },
            { first_name: 'Tebogo Kefilwe', last_name: 'Thebe', gender: 'F', age: 36, contact: '77104868', education: 'S', marital: 'Single', org: '—', occ: 'Unemployed', att: [2, 3, 4] }
        ],
        attendanceUpdates: [
            { contact: '77192272', att: [0, 1, 2, 3, 4] }, // One Meritah Magote
            { contact: '77434554', att: [0, 1, 2, 3, 4] }  // Odirile Moshe Metswi
        ]
    },
    // REGISTER 106 (Page 2 companion)
    '106': {
        newParticipants: [
            { first_name: 'Otshabeng', last_name: 'Mogatsi', gender: 'M', age: 24, contact: '76924891', education: 'JC', marital: 'Single', org: 'Boseja Behind IPCC', occ: '—', att: [0, 1, 2] },
            { first_name: 'Thatayone', last_name: 'Modimoakwena', gender: 'M', age: 29, contact: '75081225', education: 'JC', marital: 'Single', org: 'Boseja Behind IPCC', occ: '—', att: [1, 2] },
            { first_name: 'Kabo', last_name: 'Kebekwe', gender: 'M', age: 24, contact: '78198408', education: 'JC', marital: 'Single', org: 'Boseja Behind IPCC', occ: '—', att: [0] },
            { first_name: 'Thabang I', last_name: 'Makgale', gender: 'F', age: 38, contact: '76378770', education: 'JC', marital: 'Single', org: 'Boseja Behind IPCC', occ: '—', att: [0, 1, 2] },
            { first_name: 'Elled', last_name: 'Mogotsi', gender: 'F', age: 39, contact: '72631574', education: 'BGCSE', marital: 'Single', org: 'Boseja Behind IPCC', occ: '—', att: [0, 1, 2] },
            { first_name: 'Keikelitse', last_name: 'Letsohuti', gender: 'F', age: 45, contact: '76942904', education: 'JC', marital: 'Single', org: 'Boseja Behind IPCC', occ: '—', att: [0, 1, 2] }
        ]
    },
    // REGISTER 123 (Attendance update across 16 rows + 5 missing rows)
    '123': {
        newParticipants: [
            { first_name: 'Etlisa', last_name: 'Mapotsane', gender: 'F', age: 57, contact: '74786282', education: 'Form 2', marital: 'Single', org: 'Kgotla', occ: 'Police Volunteer', att: [0, 1, 2, 3, 4] },
            { first_name: 'Lesedi', last_name: 'Molefe', gender: 'F', age: 51, contact: '71211147', education: 'Form 2', marital: 'Married', org: 'Kgotla', occ: 'P.V', att: [0, 1, 2, 3, 4] },
            { first_name: 'Grace', last_name: 'Moroke', gender: 'F', age: 37, contact: '75654130', education: 'Form 5', marital: 'Single', org: 'Kgotla', occ: 'P.V', att: [0, 1, 2, 3, 4] },
            { first_name: 'Ruthwane', last_name: 'Pilane', gender: 'M', age: 27, contact: '72654199', education: 'Form 5', marital: 'Single', org: 'Kgotla', occ: 'P.V', att: [0, 1, 2, 3, 4] },
            { first_name: 'Lesego', last_name: 'Modibedi', gender: 'F', age: 61, contact: '75546052', education: 'Std 7', marital: 'Married', org: 'Kgotla', occ: 'Ikageng', att: [3] }
        ],
        attendanceUpdates: [
            { contact: '74786282', att: [0, 1, 2, 3, 4] }, // Etlisa Mapotsane
            { contact: '71211147', att: [0, 1, 2, 3, 4] }, // Lesedi Molefe
            { contact: '75654130', att: [0, 1, 2, 3, 4] }, // Grace Moroke
            { contact: '75629947', att: [0, 1, 2, 4] },    // Karabo F. Seroke
            { contact: '78563708', att: [0, 1, 4] },       // Onkarabile E. Moabi
            { contact: '72638895', att: [0, 1] },          // Prince T. Rathapo
            { contact: '78363709', att: [0, 1, 2, 3, 4] }, // Alex Tlhankane
            { contact: '72978680', altContact: '72978650', att: [0, 1, 2, 3, 4] }, // Proud M. Mapotsane
            { contact: '78324387', altContact: '78324389', att: [0, 1, 2, 3, 4] }, // Magdaline Nkele
            { contact: '72654199', att: [0, 1, 2, 3, 4] }, // Ruthwane Pilane
            { contact: '72635249', att: [0, 1, 2, 3, 4] }, // Eric Tshebele
            { contact: '71694726', att: [0, 1, 3] },       // Bishop Dube
            { contact: '74143881', att: [0, 1, 3] },       // Peter Mangole
            { contact: '74261043', att: [0, 1, 2] },       // Joel Mogaladiware
            { contact: '74004955', att: [0, 1, 2] },       // Masego Ramere
            { contact: '75546052', att: [3] }              // Lesego Modibedi
        ]
    },
    // REGISTER 157 (Attendance 29 Oct tick added)
    '157': {
        attendanceUpdates: [
            { contact: '74021080', att: [0, 1, 2] }, // Sarah D Ntshole
            { contact: '74132893', att: [0, 1, 2] }, // Olerato Madisa
            { contact: '71777058', att: [0, 1, 2] }  // Katlego Ntshole
        ]
    },
    // REGISTER 221 (+1 new row + attendance through 2 Nov)
    '221': {
        newParticipants: [
            { first_name: 'Speedwell', last_name: 'Bobe', gender: 'M', age: 42, contact: '75324557', education: 'University', marital: 'Married', org: 'Records Management', occ: 'Records Manager', att: [2, 3, 4] }
        ],
        attendanceUpdates: [
            { contact: '76163879', att: [0] },             // Sesame Letlhompha
            { contact: '76286835', att: [0, 1] },          // Makang Kgopole
            { contact: '71449744', att: [0, 1, 2, 3, 4] }, // Kedidimetse Moroka
            { contact: '76022132', att: [0, 1, 2, 3, 4] }, // Patrick David
            { contact: '73843316', att: [0, 1, 3, 4] },    // T. B. Lekgowa
            { contact: '75271035', att: [0, 2] },          // M. Mogotsi
            { contact: '77627477', att: [0, 2, 3] },       // D. V. Kiti
            { contact: '73606838', att: [0, 1, 2, 3] },    // Keitumetse Modise
            { contact: '73863835', att: [0, 1, 2, 3, 4] }, // Onkgopotse Sloma
            { contact: '73601455', att: [0, 1, 2, 3, 4] }, // Lesedi Mpotokwane
            { contact: '74843945', att: [1, 2, 4] }        // Tiny Sitang
        ]
    }
};

// 3. Category C: Unnumbered Registers Applying New Facilitator Naming (`Register Firstname_Lastname`)
const catC_groups = [
    {
        formNumber: 'Register Lesego_Moutswi',
        facilitatorName: 'Lesego Moutswi',
        facilitatorPhone: '71859385',
        secondLeaderName: '',
        secondLeaderPhone: '',
        venue: 'Malotwane (Sunday)',
        time: 'Sunday',
        booksGiven: 36,
        participants: [
            { first_name: 'Mpei Mabel', last_name: 'Kgetlwe', gender: 'F', age: 64, contact: '71776295', education: 'U', marital: 'D', org: 'CTW', occ: 'Pensioner', bookType: 'English', att: [] },
            { first_name: 'Chilume', last_name: 'Marape', gender: 'M', age: 70, contact: '71732816', education: 'U', marital: 'M', org: 'CTW', occ: 'Pensioner', bookType: 'English', att: [] },
            { first_name: 'Itseng Idah Pinkie', last_name: 'Marape', gender: 'F', age: 55, contact: '71632782', education: 'U', marital: 'M', org: 'CTW', occ: 'Teacher', bookType: 'Setswana', att: [] },
            { first_name: 'Mary', last_name: 'Tlhase', gender: 'F', age: 60, contact: '71870107', education: 'U', marital: 'M', org: 'CTW', occ: 'Pensioner', bookType: 'English', att: [] },
            { first_name: 'Molatlhegi', last_name: 'Tlhase', gender: 'M', age: 66, contact: '71256549', education: 'S', marital: 'M', org: 'CTW', occ: 'Pensioner', bookType: 'Setswana', att: [] },
            { first_name: 'Mmagolori', last_name: 'Tlhase', gender: 'M', age: 30, contact: '75458577', education: 'S', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Lesego', last_name: 'Gwegwetti', gender: 'F', age: 49, contact: '74598459', education: 'U', marital: 'M', org: 'CTW', occ: 'House Wife', bookType: 'English', att: [] },
            { first_name: 'Monicah', last_name: 'Phiri', gender: 'F', age: 63, contact: '71850974', education: 'U', marital: 'S', org: 'CTW', occ: 'P/Nurse', bookType: 'English', att: [] },
            { first_name: 'Botlhale', last_name: 'Sergopi', gender: 'F', age: 44, contact: '71690856', education: 'S', marital: 'M', org: 'CTW', occ: 'Self Employed', bookType: 'English', att: [] },
            { first_name: 'Gobuiwang', last_name: 'Masike', gender: 'F', age: 47, contact: '77945820', education: 'J', marital: 'M', org: 'CTW', occ: 'Self Employed', bookType: 'Setswana', att: [] },
            { first_name: 'Boitungelo', last_name: 'Meswele', gender: 'F', age: 38, contact: '74883556', education: 'J', marital: 'C', org: 'CTW', occ: 'Self Employed', bookType: 'Setswana', att: [] },
            { first_name: 'Gift', last_name: 'Phiri', gender: 'F', age: 19, contact: '78533876', education: 'U', marital: 'S', org: 'CTW', occ: 'Student', bookType: 'English', att: [] },
            { first_name: 'Tumisang A', last_name: 'Phiri', gender: 'M', age: 15, contact: '78888661', education: 'J', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Angel M', last_name: 'Phiri', gender: 'F', age: 11, contact: '', education: 'P', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Yaone', last_name: 'Phiri', gender: 'M', age: 16, contact: '78032026', education: 'J', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Sophie', last_name: 'Moswetsi', gender: 'F', age: 53, contact: '72457030', education: 'S', marital: 'S', org: 'CTW', occ: 'Security Office', bookType: 'English', att: [] },
            { first_name: 'Esther R.', last_name: 'Phiri', gender: 'F', age: 65, contact: '74401268', education: 'P', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'Setswana', att: [] },
            { first_name: 'Metsi M.', last_name: 'Phiri', gender: 'F', age: 71, contact: '74674766', education: 'P', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'Setswana', att: [] },
            { first_name: 'Elizabeth M.', last_name: 'Phiri', gender: 'F', age: 76, contact: '72386514', education: 'P', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'Setswana', att: [] },
            { first_name: 'Katlego A.', last_name: 'Phiri', gender: 'F', age: 34, contact: '71558757', education: 'S', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Elisa', last_name: 'Oaetotse', gender: 'M', age: null, contact: '75455296', education: 'P', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'Setswana', att: [] },
            { first_name: 'Omaatlha', last_name: 'Marape', gender: 'M', age: 28, contact: '74896270', education: 'U', marital: 'S', org: 'CTW', occ: 'Cloud Engineer', bookType: 'English', att: [] },
            { first_name: 'Mabaka', last_name: 'Tshukudu', gender: 'F', age: 43, contact: '76693577', education: 'S', marital: 'M', org: 'CTW', occ: 'House Keeper', bookType: 'English', att: [] },
            { first_name: 'Neo O.', last_name: 'Modibedi', gender: 'F', age: 40, contact: '71919689', education: 'S', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Esther T.', last_name: 'Moliwe', gender: 'F', age: 77, contact: '71905203', education: 'P', marital: 'M', org: 'CTW', occ: 'N/A', bookType: 'Both', att: [] },
            { first_name: 'Boago', last_name: 'Masike', gender: 'F', age: 22, contact: '72600845', education: 'U', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Labona', last_name: 'Sergopi', gender: 'M', age: 24, contact: '74529686', education: 'U', marital: 'S', org: 'CTW', occ: 'N/A', bookType: 'English', att: [] },
            { first_name: 'Tshephiso', last_name: 'Tlhase', gender: 'F', age: 35, contact: '73687740', education: 'U', marital: 'S', org: 'CTW', occ: 'Stock Controller', bookType: 'English', att: [] },
            { first_name: 'Akanyang R', last_name: 'Rootshabe', gender: 'F', age: 45, contact: '71282903', education: 'U', marital: 'D', org: 'CTW', occ: 'Retail Sales Assistant', bookType: 'English', att: [] },
            { first_name: 'Labone', last_name: 'Rootshabe', gender: 'F', age: 23, contact: '71844127', education: 'U', marital: 'S', org: 'CTW', occ: '—', bookType: 'English', att: [] },
            { first_name: 'Boitumelo', last_name: 'Charalisa', gender: 'F', age: 37, contact: '76752157', education: 'U', marital: 'S', org: 'CTW', occ: '—', bookType: 'English', att: [] },
            { first_name: 'Akanyang', last_name: 'Charalisa', gender: 'F', age: 34, contact: '71149044', education: 'U', marital: 'S', org: 'CTW', occ: '—', bookType: 'English', att: [] },
            { first_name: 'Itumeleng Mercy', last_name: 'Ontiretse', gender: 'F', age: 35, contact: '75649633', education: 'U', marital: 'S', org: 'CTW', occ: '—', bookType: 'English', att: [] },
            { first_name: 'Molebatse', last_name: 'Mokgwatheng', gender: 'M', age: 38, contact: '72198858', education: 'U', marital: 'S', org: 'CTW', occ: '—', bookType: 'English', att: [] },
            { first_name: 'Simon', last_name: 'Batleng', gender: 'M', age: 47, contact: '77654976', education: 'U', marital: 'M', org: 'CTW', occ: '—', bookType: 'English', att: [] },
            { first_name: 'Obamgi', last_name: 'Batleng', gender: 'F', age: 36, contact: '74721078', education: 'U', marital: 'M', org: 'CTW', occ: '—', bookType: 'English', att: [] }
        ]
    },
    {
        formNumber: 'Register Masego_Mokgadi',
        facilitatorName: 'Masego G. Mokgadi',
        facilitatorPhone: '72790099',
        secondLeaderName: '',
        secondLeaderPhone: '',
        venue: 'Morema',
        time: '17:00 HRS',
        booksGiven: 12,
        participants: [
            { first_name: 'Leungo', last_name: 'Masupu', gender: 'F', age: 20, contact: '75634757', education: 'BGCSE', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Motlatsi', last_name: 'Iseng', gender: 'F', age: 48, contact: '74857489', education: 'JC', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Gaone', last_name: 'Segobye', gender: 'F', age: 35, contact: '75336330', education: 'TERTIARY', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Mable', last_name: 'Tebekwe', gender: 'F', age: 51, contact: '76783592', education: 'JC', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Ntebo', last_name: 'Molefe', gender: 'F', age: 47, contact: '76736974', education: 'PSLE', marital: 'Married', org: 'SELF EMPLOYED', occ: '—', att: [0, 1, 2] },
            { first_name: 'Priscilla', last_name: 'Dikeme', gender: 'F', age: 54, contact: '72561359', education: 'JC', marital: 'Married', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Irene', last_name: 'Mogomotsi', gender: 'F', age: 47, contact: '72798337', education: 'Tertiary', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Pelonomi', last_name: 'Kwapa', gender: 'F', age: 34, contact: '74076274', education: 'Tertiary', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Seanokeng', last_name: 'Kgodungwe', gender: 'F', age: 45, contact: '76779319', education: 'JC', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Kefilwe', last_name: 'Radiphofo', gender: 'F', age: 27, contact: '72450708', education: 'JC', marital: 'Single', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Makoteng', last_name: 'Mokgadi', gender: 'F', age: 65, contact: '74308073', education: 'PSLE', marital: 'Married', org: '—', occ: '—', att: [0, 1, 2] },
            { first_name: 'Tebogo', last_name: 'Mokgadi', gender: 'F', age: 51, contact: '71765724', education: 'JC', marital: 'Single', org: 'SELF EMPLOYED', occ: '—', att: [0, 1, 2] }
        ]
    },
    {
        formNumber: 'Register Mmamothobi_Lesotho',
        facilitatorName: 'Mmamothobi Lesotho',
        facilitatorPhone: '71284693',
        secondLeaderName: 'Kato David Mongalechwane',
        secondLeaderPhone: '71641996',
        venue: 'Mochudi Old Mall Near Spar',
        time: '11:30 HRS',
        booksGiven: 22,
        participants: [
            { first_name: 'Joban', last_name: 'Masike', gender: 'M', age: 41, contact: '76978379', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Joel', last_name: 'Masege', gender: 'M', age: 44, contact: '71625408', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Pono', last_name: 'Mabibi', gender: 'M', age: 45, contact: '72955825', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Molotsi', last_name: 'Tshwane', gender: 'M', age: 46, contact: '72239812', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Mothibedi', last_name: 'Mogau', gender: 'M', age: 38, contact: '71766236', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Thapelo', last_name: 'Tlhaso', gender: 'M', age: 27, contact: '71732799', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Banana', last_name: 'Kepaletswe', gender: 'M', age: 57, contact: '71747704', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Enock', last_name: 'Modise', gender: 'M', age: 37, contact: '76332265', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Thuto', last_name: 'Moje', gender: 'M', age: 26, contact: '74362935', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Tefo', last_name: 'Tlhakane', gender: 'M', age: 27, contact: '72443615', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Tumi', last_name: 'Molefi', gender: 'M', age: 25, contact: '75153641', education: '—', marital: '—', org: 'TAXI OD', occ: '—', att: [0] },
            { first_name: 'Thapelo', last_name: 'Gare', gender: 'M', age: 43, contact: '71149886', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Joshua', last_name: 'Ngwai', gender: 'M', age: 33, contact: '75482315', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Richard', last_name: 'Modise', gender: 'M', age: 39, contact: '78374881', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Thabiso', last_name: 'Motshega', gender: 'M', age: 54, contact: '75919510', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Tshepiso', last_name: 'Theko', gender: 'M', age: 33, contact: '72950229', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Kgomotso', last_name: 'Moeng', gender: 'M', age: 37, contact: '71485645', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Mogakolodi', last_name: 'Mabibe', gender: 'M', age: 26, contact: '74915500', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Daniel', last_name: 'Masege', gender: 'M', age: 28, contact: '75297230', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Otsile', last_name: 'Ramotswetla', gender: 'M', age: 54, contact: '77670970', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Molosi', last_name: 'Montsho', gender: 'M', age: 72, contact: '71725994', education: '—', marital: '—', org: '—', occ: '—', att: [0] },
            { first_name: 'Kabelo', last_name: 'Moremi', gender: 'M', age: 53, contact: '76180920', education: '—', marital: '—', org: '—', occ: '—', att: [0] }
        ]
    },
    {
        formNumber: 'Register Kerunne_Kgwatalala',
        facilitatorName: 'Kerunne Kgwatalala',
        facilitatorPhone: '71710391',
        secondLeaderName: 'Kelebogile P. Mokgadi',
        secondLeaderPhone: '75710024',
        venue: 'Regional Education Office',
        time: '15:00',
        booksGiven: 12,
        participants: [
            { first_name: 'Wisani', last_name: 'Nginya', gender: 'M', age: 58, contact: '74470979', education: 'TRADE C', marital: 'S', org: 'KREO', occ: 'CARPENTRY', att: [0, 1] },
            { first_name: 'Rasilwane', last_name: 'Tabolane', gender: 'M', age: 46, contact: '72538987', education: 'Degree', marital: 'S', org: 'KREO', occ: 'ADMIN', att: [0, 1] },
            { first_name: 'Bando', last_name: 'Kgabo', gender: 'F', age: 37, contact: '73071983', education: 'Degree', marital: 'M', org: 'KREO', occ: 'PAO', att: [0, 1] },
            { first_name: 'Jampie M.', last_name: 'Matswe', gender: 'F', age: 55, contact: '71972519', education: 'BA', marital: 'S', org: 'KREO', occ: 'PAO', att: [0, 1] },
            { first_name: 'Gaone', last_name: 'Dikgole', gender: 'F', age: 50, contact: '71562444', education: 'HNDABS', marital: 'M', org: 'KREO', occ: 'P/BURSAR', att: [0, 1] },
            { first_name: 'Tlotlo', last_name: 'Mokgadi', gender: 'F', age: 31, contact: '71205351', education: 'Student', marital: 'S', org: '—', occ: '—', att: [0, 1] },
            { first_name: 'Moses', last_name: 'Kgwatalala', gender: 'M', age: 61, contact: '71803430', education: 'BSc', marital: 'M', org: 'Phang T', occ: 'Land Surveyor', att: [0, 1] },
            { first_name: 'Segomotso', last_name: 'Kgwatalala', gender: 'F', age: 30, contact: '71781450', education: 'DEGREE', marital: 'S', org: 'Mochudi Brigades', occ: 'MARKETING', att: [0, 1] },
            { first_name: 'Candy', last_name: 'Maligela', gender: 'F', age: 50, contact: '72205629', education: 'BA', marital: 'M', org: 'REO', occ: 'REO', att: [0] },
            { first_name: 'Kelly', last_name: 'Nnoka', gender: 'F', age: 52, contact: '71431422', education: 'BEd', marital: 'M', org: 'REGIONAL EDU OFFICE', occ: 'PEO', att: [0, 1] },
            { first_name: 'Reagile', last_name: 'Kgwatalala', gender: 'F', age: 20, contact: '72704403', education: 'Student', marital: 'S', org: '—', occ: '—', att: [0, 1] },
            { first_name: 'Onneile', last_name: 'Kgwatalala', gender: 'F', age: 22, contact: '71710391', education: 'Student', marital: 'S', org: '—', occ: '—', att: [0, 1] }
        ]
    },
    {
        formNumber: 'Register Segale_Mokotedi',
        facilitatorName: 'Segale Windy Mokotedi',
        facilitatorPhone: '71829724',
        secondLeaderName: 'Monicah Modise',
        secondLeaderPhone: '72905503',
        venue: 'Boseja South - Plot 8649',
        time: '17:00',
        booksGiven: 16,
        participants: [
            { first_name: 'Olebile', last_name: 'Motswasele', gender: 'F', age: 42, contact: '72378723', education: 'J.C.', marital: 'S', org: '—', occ: 'Self Employed', att: [0, 1] },
            { first_name: 'Gomolemo', last_name: 'Mothebe', gender: 'F', age: 29, contact: '71674232', education: 'J.C', marital: 'S', org: '—', occ: 'Self Employed', att: [0, 1] },
            { first_name: 'Samuel', last_name: 'Sekgopi', gender: 'M', age: 31, contact: '75928612', education: 'JC', marital: 'S', org: '—', occ: 'Self Employed', att: [] },
            { first_name: 'Malebo', last_name: 'Dube', gender: 'F', age: 53, contact: '75360054', education: 'JC', marital: 'W', org: '—', occ: 'Maid', att: [0, 1] },
            { first_name: 'Lorato', last_name: 'Dube', gender: 'F', age: 22, contact: '', education: 'BGCSE', marital: 'S', org: '—', occ: 'Not employed', att: [] },
            { first_name: 'Letlhogonolo', last_name: 'Masula', gender: 'M', age: 30, contact: '78078704', education: 'BGCSE', marital: 'S', org: '—', occ: 'Farmer', att: [0, 1] },
            { first_name: 'Mose Phiri', last_name: 'Letsatsi', gender: 'M', age: 56, contact: '72167127', education: 'Std 4', marital: 'M', org: '—', occ: 'Farmer', att: [0, 1] },
            { first_name: 'Njabe', last_name: 'Ramoeng', gender: 'M', age: 68, contact: '76439444', education: 'N/A', marital: 'M', org: '—', occ: 'Farmer / Bricklayer', att: [0, 1] },
            { first_name: 'Julia', last_name: 'Ramoeng', gender: 'F', age: 54, contact: '72398393', education: 'PSLE', marital: 'M', org: '—', occ: 'Self employed / Tuckshop', att: [] },
            { first_name: 'Tlotlo', last_name: 'Setlhodi', gender: 'F', age: 41, contact: '74747890', education: 'JC', marital: 'S', org: '—', occ: 'Not employed', att: [] },
            { first_name: 'Lesego', last_name: 'Lephogole', gender: 'F', age: 36, contact: '75202525', education: 'BGCSE', marital: 'S', org: '—', occ: 'Teacher Aid', att: [0, 1] },
            { first_name: 'Mothusi', last_name: 'Morokotso', gender: 'M', age: 48, contact: '72403790', education: 'JC', marital: 'S', org: '—', occ: 'Security Guard', att: [0, 1] },
            { first_name: 'Calvin', last_name: 'Mokotedi', gender: 'M', age: 51, contact: '72542343', education: 'BGCSE', marital: 'M', org: '—', occ: 'Self employed', att: [] },
            { first_name: 'Bonolo', last_name: 'Mokotedi', gender: 'F', age: 49, contact: '72164400', education: 'BGCSE', marital: 'M', org: '—', occ: 'Pensioner', att: [] },
            { first_name: 'Modiegi', last_name: 'Lephogole', gender: 'F', age: 43, contact: '77662006', education: 'BGCSE', marital: 'S', org: '—', occ: 'House maid', att: [0, 1] },
            { first_name: 'Ishmael', last_name: 'Moeng', gender: 'M', age: 48, contact: '71204900', education: 'J.C.', marital: 'S', org: '—', occ: 'Self employed', att: [0, 1] }
        ]
    }
];

// Renamings / cleanup map
const unnumberedRenames = [
    { original: 'Unnumbered Group #2', facilitator: 'Mmamothobi Lesotho', contact: '71284693', newForm: 'Register Mmamothobi_Lesotho', place: 'Mochudi Old Mall Near Spar' },
    { original: '[Unnumbered New #D]', facilitator: 'Kerunne Kgwatalala', contact: '71710391', newForm: 'Register Kerunne_Kgwatalala', place: 'Regional Education Office' },
    { original: '[Unnumbered New #E]', facilitator: 'Aaron T. Sefako', contact: '71782500', newForm: 'Register Aaron_Sefako', place: 'Regional Education Office / Assemblies of God' },
    { original: '[Unnumbered New #F]', facilitator: 'Segale Windy Mokotedi', contact: '71829724', newForm: 'Register Segale_Mokotedi', place: 'Boseja South - Plot 8649' },
    { original: '[Unnumbered New #A]', facilitator: 'Masego G. Mokgadi', contact: '72790099', newForm: 'Register Masego_Mokgadi', place: 'Morema' },
    { original: 'Christ Temple of Worship', facilitator: 'Lesego Moutswi', contact: '71859385', newForm: 'Register Lesego_Moutswi', place: 'Malotwane' }
];

// ============================================================================
// PIPELINE EXECUTION
// ============================================================================

async function runHandover() {
    console.log("==================================================================");
    console.log(" EXECUTING 02 NOVEMBER 2026 REGISTER HANDOVER & SYSTEM SYNC");
    console.log("==================================================================\n");

    const now = new Date().toISOString();

    // 1. Fetch current database state from Cloud Firestore
    console.log("1. Fetching current registrations from Firestore with retry...");
    const allDocs = await getDocsWithRetry(5);
    console.log(`Retrieved ${allDocs.length} total registration documents from Firestore.`);

    const facilitators = allDocs.filter(d => d.type === 'facilitator' && !d.is_deleted);
    const participants = allDocs.filter(d => d.type === 'participant' && !d.is_deleted);
    console.log(`Active Facilitators: ${facilitators.length}, Active Participants: ${participants.length}\n`);

    const docsToUpsert = new Map();

    // 2. Process Renaming of Any Existing Unnumbered Records
    console.log("2. Processing unnumbered register renamings and cleanup...");
    for (const rename of unnumberedRenames) {
        // Find facilitator (do NOT match Masego's Register 224!)
        const matchedFacs = facilitators.filter(f => {
            const fForm = String(f.form_number || '').trim();
            const fContact = cleanDigits(f.contact);
            if (fForm === '224') return false; // Guard Masego's official 224 group
            return fForm === rename.original || (rename.contact && fContact === cleanDigits(rename.contact));
        });

        for (const fac of matchedFacs) {
            console.log(` • Updating Facilitator [${fac.first_name} ${fac.last_name}] form_number: '${fac.form_number}' -> '${rename.newForm}'`);
            docsToUpsert.set(fac.uuid, {
                ...fac,
                form_number: rename.newForm,
                group_name: rename.newForm,
                venue: rename.place || fac.venue,
                place: rename.place || fac.venue,
                teaching_group: true,
                is_daily_core: true,
                books_received: true,
                updated_at: now
            });
        }

        const matchedParts = participants.filter(p => {
            const pGroup = String(p.group_form_number || '').trim();
            return pGroup === rename.original;
        });

        for (const part of matchedParts) {
            docsToUpsert.set(part.uuid, {
                ...part,
                group_form_number: rename.newForm,
                place: rename.place || part.place || '',
                books_received: true,
                updated_at: now
            });
        }
        if (matchedParts.length > 0) {
            console.log(` • Updated ${matchedParts.length} participants from group '${rename.original}' to '${rename.newForm}'`);
        }
    }

    // Special handling for Aaron T. Sefako's 6 participants
    const aaronFac = facilitators.find(f => cleanDigits(f.contact) === '71782500');
    if (aaronFac) {
        const aaronParts = participants.filter(p => p.group_id === aaronFac.uuid || p.facilitator_uuid === aaronFac.uuid);
        for (const p of aaronParts) {
            docsToUpsert.set(p.uuid, {
                ...p,
                group_form_number: 'Register Aaron_Sefako',
                group_id: aaronFac.uuid,
                facilitator_uuid: aaronFac.uuid,
                place: 'Regional Education Office / Assemblies of God',
                books_received: true,
                attendance: [true, true, true, false, false, false, false, false, false, false, false, false],
                updated_at: now
            });
        }
        docsToUpsert.set(aaronFac.uuid, {
            ...aaronFac,
            form_number: 'Register Aaron_Sefako',
            group_name: 'Register Aaron_Sefako',
            venue: 'Regional Education Office / Assemblies of God',
            place: 'Regional Education Office / Assemblies of God',
            time: '09:00 AM',
            meeting_time: '09:00 AM',
            participants_count: 6,
            books_distributed: 6,
            books_received: true,
            teaching_group: true,
            is_daily_core: true,
            updated_at: now
        });
        console.log(` • Updated ${aaronParts.length} participants for Register Aaron_Sefako`);
    }

    // 3. Process Category A: 5 Brand-New Numbered Registers
    console.log("\n3. Processing Category A: 5 Brand-New Numbered Registers...");
    for (const group of catA_groups) {
        console.log(` • Register ${group.formNumber} (${group.venue}) - Leader: ${group.facilitatorName}`);

        // Find or create facilitator
        let fac = facilitators.find(f => String(f.form_number).trim() === group.formNumber || cleanDigits(f.contact) === cleanDigits(group.facilitatorPhone));
        if (!fac) {
            const facUuid = `fac-${group.formNumber}-${crypto.randomUUID().slice(0, 8)}`;
            const nameParts = group.facilitatorName.split(' ');
            fac = {
                uuid: facUuid,
                campaign_id: CAMPAIGN_ID,
                type: 'facilitator',
                form_number: group.formNumber,
                group_name: group.formNumber,
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                contact: group.facilitatorPhone,
                venue: group.venue,
                place: group.venue,
                time: group.time,
                meeting_time: group.time,
                second_leader_name: group.secondLeaderName,
                second_leader_contact: group.secondLeaderPhone,
                participants_count: group.participants.length,
                books_distributed: group.booksGiven,
                books_received: true,
                teaching_group: true,
                is_daily_core: true,
                created_by_name: USER_NAME,
                created_by_email: USER_EMAIL,
                created_by_uid: USER_UID,
                created_at: now,
                updated_at: now,
                is_deleted: false
            };
            docsToUpsert.set(fac.uuid, fac);
        } else {
            docsToUpsert.set(fac.uuid, {
                ...fac,
                form_number: group.formNumber,
                group_name: group.formNumber,
                venue: group.venue || fac.venue,
                place: group.venue || fac.place || fac.venue,
                time: group.time || fac.time,
                meeting_time: group.time || fac.time,
                second_leader_name: group.secondLeaderName || fac.second_leader_name,
                second_leader_contact: group.secondLeaderPhone || fac.second_leader_contact,
                participants_count: group.participants.length,
                books_distributed: group.booksGiven,
                books_received: true,
                teaching_group: true,
                is_daily_core: true,
                updated_at: now
            });
        }

        // Add participants
        for (let i = 0; i < group.participants.length; i++) {
            const pData = group.participants[i];
            const attArray = Array(12).fill(false);
            if (pData.att) {
                pData.att.forEach(dayIdx => { if (dayIdx < 12) attArray[dayIdx] = true; });
            }

            const pUuid = `part-${group.formNumber}-${String(i + 1).padStart(2, '0')}-${crypto.randomUUID().slice(0, 6)}`;
            const partDoc = {
                uuid: pUuid,
                campaign_id: CAMPAIGN_ID,
                type: 'participant',
                group_form_number: group.formNumber,
                group_id: fac.uuid,
                facilitator_uuid: fac.uuid,
                row_number: i + 1,
                first_name: pData.first_name,
                last_name: pData.last_name,
                gender: parseGender(pData.gender),
                age: parseAge(pData.age),
                contact: pData.contact,
                education_level: parseEducation(pData.education),
                marital_status: parseMarital(pData.marital),
                place: group.venue,
                organisation: pData.org || '',
                affiliation: pData.org || '',
                occupation: pData.occ || '',
                books_received: true,
                attendance: attArray,
                created_by_name: USER_NAME,
                created_by_email: USER_EMAIL,
                created_by_uid: USER_UID,
                created_at: now,
                updated_at: now,
                is_deleted: false
            };
            docsToUpsert.set(pUuid, partDoc);
        }
        console.log(`   + Added ${group.participants.length} participants for Register ${group.formNumber}`);
    }

    // 4. Process Category B: Existing Registers Updated (+10 New Rows + Reg 123 + Attendance)
    console.log("\n4. Processing Category B: Existing Registers Updated...");
    for (const [formNum, updateData] of Object.entries(catB_updates)) {
        console.log(` • Updating Register ${formNum}...`);

        const fac = facilitators.find(f => String(f.form_number).trim() === formNum);
        const existingParts = participants.filter(p => String(p.group_form_number).trim() === formNum);

        // Add new participant rows
        if (updateData.newParticipants) {
            let nextRow = existingParts.length + 1;

            for (const pData of updateData.newParticipants) {
                const p8 = cleanDigits(pData.contact);
                // Check if already in existingParts to avoid duplicate
                const alreadyExists = existingParts.find(p => p8 && cleanDigits(p.contact) === p8);
                if (alreadyExists) continue;

                const attArray = Array(12).fill(false);
                if (pData.att) {
                    pData.att.forEach(dayIdx => { if (dayIdx < 12) attArray[dayIdx] = true; });
                }

                const pUuid = `part-${formNum}-${String(nextRow).padStart(2, '0')}-${crypto.randomUUID().slice(0, 6)}`;
                const partDoc = {
                    uuid: pUuid,
                    campaign_id: CAMPAIGN_ID,
                    type: 'participant',
                    group_form_number: formNum,
                    group_id: fac?.uuid || '',
                    facilitator_uuid: fac?.uuid || '',
                    row_number: nextRow,
                    first_name: pData.first_name,
                    last_name: pData.last_name,
                    gender: parseGender(pData.gender),
                    age: parseAge(pData.age),
                    contact: pData.contact,
                    education_level: parseEducation(pData.education),
                    marital_status: parseMarital(pData.marital),
                    place: fac?.venue || fac?.place || '',
                    organisation: pData.org || '',
                    affiliation: pData.org || '',
                    occupation: pData.occ || '',
                    books_received: true,
                    attendance: attArray,
                    created_by_name: USER_NAME,
                    created_by_email: USER_EMAIL,
                    created_by_uid: USER_UID,
                    created_at: now,
                    updated_at: now,
                    is_deleted: false
                };
                docsToUpsert.set(pUuid, partDoc);
                console.log(`   + Added row ${nextRow}: ${pData.first_name} ${pData.last_name} (${pData.contact})`);
                nextRow++;
            }

            if (fac) {
                const totalCount = nextRow - 1;
                docsToUpsert.set(fac.uuid, {
                    ...fac,
                    participants_count: totalCount,
                    books_distributed: totalCount,
                    books_received: true,
                    teaching_group: true,
                    is_daily_core: true,
                    updated_at: now
                });
            }
        }

        // Apply attendance updates
        if (updateData.attendanceUpdates) {
            let updatedCount = 0;
            // Re-fetch all current participants including newly added for this group
            const groupParts = [...existingParts, ...Array.from(docsToUpsert.values()).filter(d => d.type === 'participant' && String(d.group_form_number).trim() === formNum)];

            for (const attUp of updateData.attendanceUpdates) {
                const p8 = cleanDigits(attUp.contact);
                const alt8 = attUp.altContact ? cleanDigits(attUp.altContact) : null;
                const part = groupParts.find(p => {
                    const c = cleanDigits(p.contact);
                    return (p8 && c === p8) || (alt8 && c === alt8);
                });
                if (part) {
                    const currentAtt = Array.isArray(part.attendance) ? [...part.attendance] : Array(12).fill(false);
                    attUp.att.forEach(dayIdx => { if (dayIdx < 12) currentAtt[dayIdx] = true; });
                    docsToUpsert.set(part.uuid, {
                        ...part,
                        attendance: currentAtt,
                        books_received: true,
                        updated_at: now
                    });
                    updatedCount++;
                }
            }
            console.log(`   + Updated attendance for ${updatedCount} participants in Register ${formNum}`);
        }
    }

    // 5. Process Category C: Unnumbered Registers with Facilitator Naming
    console.log("\n5. Processing Category C: Unnumbered Registers with Facilitator Naming...");
    for (const group of catC_groups) {
        console.log(` • Group ${group.formNumber} (${group.venue}) - Leader: ${group.facilitatorName}`);

        // Find or create facilitator (ensure Masego 224 is NOT matched)
        let fac = facilitators.find(f => {
            if (group.formNumber === 'Register Masego_Mokgadi' && String(f.form_number).trim() === '224') return false;
            return String(f.form_number).trim() === group.formNumber || cleanDigits(f.contact) === cleanDigits(group.facilitatorPhone);
        });

        if (!fac) {
            const facUuid = `fac-${group.formNumber.replace(/[^a-zA-Z0-9]/g, '_')}-${crypto.randomUUID().slice(0, 8)}`;
            const nameParts = group.facilitatorName.split(' ');
            fac = {
                uuid: facUuid,
                campaign_id: CAMPAIGN_ID,
                type: 'facilitator',
                form_number: group.formNumber,
                group_name: group.formNumber,
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                contact: group.facilitatorPhone,
                venue: group.venue,
                place: group.venue,
                time: group.time,
                meeting_time: group.time,
                second_leader_name: group.secondLeaderName,
                second_leader_contact: group.secondLeaderPhone,
                participants_count: group.participants.length,
                books_distributed: group.booksGiven,
                books_received: true,
                teaching_group: true,
                is_daily_core: true,
                created_by_name: USER_NAME,
                created_by_email: USER_EMAIL,
                created_by_uid: USER_UID,
                created_at: now,
                updated_at: now,
                is_deleted: false
            };
            docsToUpsert.set(fac.uuid, fac);
        } else {
            docsToUpsert.set(fac.uuid, {
                ...fac,
                form_number: group.formNumber,
                group_name: group.formNumber,
                participants_count: group.participants.length,
                books_distributed: group.booksGiven,
                books_received: true,
                teaching_group: true,
                is_daily_core: true,
                venue: group.venue || fac.venue,
                place: group.venue || fac.place || fac.venue,
                time: group.time || fac.time,
                meeting_time: group.time || fac.time,
                updated_at: now
            });
        }

        // Add or update participants
        for (let i = 0; i < group.participants.length; i++) {
            const pData = group.participants[i];
            const attArray = Array(12).fill(false);
            if (pData.att) {
                pData.att.forEach(dayIdx => { if (dayIdx < 12) attArray[dayIdx] = true; });
            }

            const p8 = cleanDigits(pData.contact);
            let part = participants.find(p => {
                const gForm = String(p.group_form_number || '').trim();
                return (gForm === group.formNumber || gForm === '[Unnumbered New #A]' || gForm === 'Unnumbered Group #2' || gForm === '[Unnumbered New #D]' || gForm === '[Unnumbered New #F]') && (p8 && cleanDigits(p.contact) === p8);
            });

            if (!part) {
                const pUuid = `part-${group.formNumber.replace(/[^a-zA-Z0-9]/g, '_')}-${String(i + 1).padStart(2, '0')}-${crypto.randomUUID().slice(0, 6)}`;
                part = {
                    uuid: pUuid,
                    campaign_id: CAMPAIGN_ID,
                    type: 'participant',
                    group_form_number: group.formNumber,
                    group_id: fac.uuid,
                    facilitator_uuid: fac.uuid,
                    row_number: i + 1,
                    first_name: pData.first_name,
                    last_name: pData.last_name,
                    gender: parseGender(pData.gender),
                    age: parseAge(pData.age),
                    contact: pData.contact,
                    education_level: parseEducation(pData.education),
                    marital_status: parseMarital(pData.marital),
                    place: group.venue,
                    organisation: pData.org || '',
                    affiliation: pData.org || '',
                    occupation: pData.occ || '',
                    books_received: true,
                    attendance: attArray,
                    created_by_name: USER_NAME,
                    created_by_email: USER_EMAIL,
                    created_by_uid: USER_UID,
                    created_at: now,
                    updated_at: now,
                    is_deleted: false
                };
            } else {
                part = {
                    ...part,
                    group_form_number: group.formNumber,
                    group_id: fac.uuid,
                    facilitator_uuid: fac.uuid,
                    first_name: pData.first_name,
                    last_name: pData.last_name,
                    place: group.venue,
                    attendance: attArray,
                    books_received: true,
                    updated_at: now
                };
            }
            docsToUpsert.set(part.uuid, part);
        }
        console.log(`   + Synchronized ${group.participants.length} participants for ${group.formNumber}`);
    }

    const upsertList = Array.from(docsToUpsert.values());
    console.log(`\n==================================================================`);
    console.log(`TOTAL RECORDS PREPARED FOR UPSERT: ${upsertList.length}`);
    console.log(`==================================================================\n`);

    // 6. Sync to local Dexie IndexedDB
    try {
        console.log("6. Syncing records to local Dexie IndexedDB cache...");
        await db.open();
        for (const item of upsertList) {
            await db.registrations.put(item);
        }
        console.log(`Successfully synced ${upsertList.length} records into Dexie IndexedDB.`);
    } catch (dexErr) {
        console.warn("Dexie local sync notice (non-fatal):", dexErr.message);
    }

    // 7. Commit Batch to Cloud Firestore
    console.log("7. Committing batches to Cloud Firestore...");
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
        console.log(` - Committed Firestore upsert batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, upsertList.length)} / ${upsertList.length})`);
    }

    // 8. Push consolidated buffer to Google Sheets Web App
    console.log("\n8. Pushing profile buffer to Google Sheets Web App...");
    const payload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Samukeliso_Mayabane',
        records: upsertList,
        replaceTab: false,
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
        console.warn("Sheets push notice (non-fatal):", err.message);
    }

    console.log("\n==================================================================");
    console.log(" 02 NOVEMBER 2026 HANDOVER PIPELINE COMPLETED SUCCESSFULLY!");
    console.log("==================================================================");
    process.exit(0);
}

runHandover().catch(err => {
    console.error("Handover pipeline error:", err);
    process.exit(1);
});
