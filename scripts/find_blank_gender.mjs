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

async function findBlankGender() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);
    const blanks = docs.filter(d => !d.gender || d.gender.trim() === '');
    console.log(`Blanks count: ${blanks.length}`);
    blanks.forEach(d => {
        console.log(`Form: ${d.group_form_number || d.form_number}, Name: ${d.first_name} ${d.last_name}, Type: ${d.type}`);
    });
    process.exit(0);
}

findBlankGender().catch(console.error);
