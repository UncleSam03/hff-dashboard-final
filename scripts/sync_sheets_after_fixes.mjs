import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fetch from 'node-fetch';
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
const db = getFirestore(app);
const GOOGLE_SHEETS_WEBAPP_URL = process.env.VITE_GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwlGd2cUB0mRJkn5h6cz3wD1GzRLaXGAQwV6A3kooXVbeSosZ237TO0rdonXzPhq1ZtGg/exec';

async function syncSheets() {
    console.log("Fetching all active registrations from Firestore for Samukeliso Mayabane...");
    const snap = await getDocs(collection(db, 'registrations'));
    const records = [];

    snap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.is_deleted) return;
        if (d.created_by_name === 'Samukeliso Mayabane' || d.created_by_email?.includes('samukeliso')) {
            records.push({
                ...d,
                uuid: d.uuid || docSnap.id
            });
        }
    });

    console.log(`Found ${records.length} active records under Samukeliso Mayabane.`);

    const payload = {
        action: 'push_profile_buffer',
        tabName: 'PROFILE_Samukeliso_Mayabane',
        records: records,
        replaceTab: true,
        autoReconcile: true
    };

    const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const resJson = await resp.json();
    console.log("Google Sheets response:", JSON.stringify(resJson, null, 2));
}

syncSheets().catch(console.error);
