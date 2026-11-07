import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

const ids = [
    '012d2072-9260-4c37-9dec-e22ad7b6f73e',
    '0e92ac7d-c5c0-4233-8bc5-20a4d849c8f1',
    '196c92cf-849b-4c3e-b80e-a35dcbdfa432',
    '1eed9cef-5a09-4fc2-971b-a61055db4823',
    '2fbc9699-3280-4fd7-8045-8ac1c9995572',
    '367c71b2-8aed-4edc-ab78-06485a14ad64',
    '451575eb-cc5b-47e4-81e8-9067b4feb93a',
    '4ba402df-a602-41b3-9eed-bc3e9f1d88aa',
    '4bd9abe5-9999-4904-b9c3-b472a98fcc14',
    '5fee3bff-4990-4d9d-ada5-4eef968ef3c0',
    '614bc0d2-6939-49de-bdcc-5730b74e37e1',
    '737a798b-ac26-4d51-9e8b-175c5e835771',
    '9b128554-c5a4-4226-910c-2ca9f5ef76be',
    'dc8b3933-7022-47fa-b854-fd6a370ad831'
];

async function check182() {
    for (const id of ids) {
        const snap = await getDoc(doc(firestoreDb, 'registrations', id));
        if (snap.exists()) {
            const d = snap.data();
            console.log(`${d.first_name} ${d.last_name}: edu='${d.education}', marital='${d.marital_status}', gender='${d.gender}'`);
        }
    }
    process.exit(0);
}

check182().catch(console.error);
