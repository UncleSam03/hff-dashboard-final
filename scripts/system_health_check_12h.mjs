import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
const db = getFirestore(app);

function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
}

function cleanPhone(s) {
    const d = String(s || '').replace(/\D/g, '');
    return d.length >= 7 ? d.slice(-8) : '';
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const v0 = new Int32Array(b.length + 1);
    const v1 = new Int32Array(b.length + 1);
    for (let i = 0; i <= b.length; i++) v0[i] = i;
    for (let i = 0; i < a.length; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < b.length; j++) {
            const cost = a[i] === b[j] ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
    }
    return v1[b.length];
}

async function getDocsWithRetry(maxAttempts = 5) {
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            const snap = await getDocs(collection(db, 'registrations'));
            if (snap.docs.length > 50) {
                return snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        } catch (e) {
            console.warn(`Attempt ${i} failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2500));
    }
    const snap = await getDocs(collection(db, 'registrations'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function runHealthCheck() {
    console.log("==================================================================");
    console.log(" HFF DASHBOARD 12-HOUR SYSTEM HEALTH & DUPLICATE AUDIT");
    console.log("==================================================================\n");

    const allDocs = await getDocsWithRetry(5);
    const active = allDocs.filter(x => !x.is_deleted && x.type);

    const recs = active.map(x => {
        const fn = String(x.first_name || '').trim();
        const ln = String(x.last_name || x.surname || '').trim();
        const fnTokens = fn.split(/\s+/).map(norm).filter(Boolean);
        const lnTokens = ln.split(/\s+/).map(norm).filter(Boolean);
        const fnFirst = fnTokens[0] || '';
        const lnLast = lnTokens[lnTokens.length - 1] || norm(ln);
        const firstLastNorm = fnFirst + lnLast;
        const phone = cleanPhone(x.contact);
        const group = String(x.form_number || x.group_form_number || '').trim();
        return {
            id: x.id,
            type: x.type,
            fn,
            ln,
            full: (fn + ' ' + ln).trim(),
            fnFirst,
            lnLast,
            firstLastNorm,
            phone,
            group,
            age: x.age || '',
            gender: x.gender || '',
            place: x.place || x.venue || ''
        };
    });

    const facs = recs.filter(r => r.type === 'facilitator');
    const parts = recs.filter(r => r.type === 'participant');

    // 1. Detect remaining near-duplicates
    const duplicatePairs = [];
    for (let i = 0; i < recs.length; i++) {
        for (let j = i + 1; j < recs.length; j++) {
            const a = recs[i], b = recs[j];
            if (a.firstLastNorm.length < 7 || b.firstLastNorm.length < 7) continue;
            const dFL = levenshtein(a.firstLastNorm, b.firstLastNorm);
            const samePhone = a.phone && b.phone && a.phone === b.phone && a.phone !== '5777251';
            const sameGrp = a.group && b.group && a.group === b.group;

            if (
                (samePhone && dFL <= 3) ||
                (sameGrp && dFL <= 2) ||
                (dFL === 0) ||
                (dFL === 1 && ((a.age && b.age && String(a.age) === String(b.age)) || samePhone))
            ) {
                duplicatePairs.push({ a, b, dFL, samePhone, sameGrp });
            }
        }
    }

    // 2. Detect missing critical fields
    const ungroupedParts = parts.filter(p => !p.group);
    const missingPhoneParts = parts.filter(p => !p.phone);
    const missingAgeParts = parts.filter(p => !p.age);
    const unassignedFacs = facs.filter(f => !f.group);
    const missingPhoneFacs = facs.filter(f => !f.phone);

    console.log(`Total Active Records: ${active.length} (${facs.length} Facilitators, ${parts.length} Participants)`);
    console.log(`Remaining Flagged Near-Duplicate Pairs: ${duplicatePairs.length}`);
    console.log(`Missing Field Summary:`);
    console.log(` - Unassigned Facilitators (no form_number): ${unassignedFacs.length}`);
    console.log(` - Facilitators missing phone number: ${missingPhoneFacs.length}`);
    console.log(` - Ungrouped Participants (no group_form_number): ${ungroupedParts.length}`);
    console.log(` - Participants missing phone number: ${missingPhoneParts.length}`);
    console.log(` - Participants missing age: ${missingAgeParts.length}\n`);

    console.log("--- REMAINING FLAGGED DUPLICATE PAIRS ---");
    for (const pair of duplicatePairs) {
        console.log(
            ` • [${pair.a.type.toUpperCase().slice(0, 3)}-${pair.b.type.toUpperCase().slice(0, 3)}] ` +
            `${pair.a.full} (Grp: ${pair.a.group || 'none'}, Tel: ${pair.a.phone || 'none'}, Age: ${pair.a.age || '-'}) <--> ` +
            `${pair.b.full} (Grp: ${pair.b.group || 'none'}, Tel: ${pair.b.phone || 'none'}, Age: ${pair.b.age || '-'}) | d=${pair.dFL}`
        );
    }

    if (ungroupedParts.length > 0) {
        console.log("\n--- UNGROUPED PARTICIPANTS (MISSING group_form_number) ---");
        for (const up of ungroupedParts) {
            console.log(` • ${up.full} | Tel: ${up.phone || 'none'} | Age: ${up.age || '-'} | Place: ${up.place || '-'} | ID: ${up.id}`);
        }
    }

    // Sync live summary row to NOTES_DUPLICATES_TRACKER tab on Google Drive
    try {
        const now = new Date().toISOString();
        await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'push_profile_buffer',
                tabName: 'NOTES_DUPLICATES_TRACKER',
                records: [{
                    uuid: 'AUDIT-HEARTBEAT-LATEST',
                    campaign_id: `Active: ${active.length} (${facs.length}F / ${parts.length}P)`,
                    type: '12H-SYSTEM-CHECK',
                    form_number: `DupPairs: ${duplicatePairs.length}`,
                    group_form_number: 'PENDING',
                    first_name: `Ungrouped Parts: ${ungroupedParts.length}`,
                    last_name: `Unassigned Facs: ${unassignedFacs.length}`,
                    contact: `MissingTel: ${missingPhoneParts.length}P/${missingPhoneFacs.length}F`,
                    place: `MissingAge: ${missingAgeParts.length}P`,
                    occupation: 'Automated 12-hour system health check',
                    affiliation: 'PENDING',
                    created_by_name: 'Antigravity 12h Cron',
                    updated_at: now
                }],
                replaceTab: false,
                autoReconcile: false
            })
        });
        console.log("\nSynced 12-hour audit heartbeat to NOTES_DUPLICATES_TRACKER on Google Drive.");
    } catch (e) {
        console.warn("Google Drive tracker sync notice:", e.message);
    }

    process.exit(0);
}

runHealthCheck().catch(err => {
    console.error(err);
    process.exit(1);
});
