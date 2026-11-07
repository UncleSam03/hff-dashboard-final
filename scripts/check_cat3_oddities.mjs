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

async function checkOddities() {
    const snap = await getDocs(collection(firestoreDb, 'registrations'));
    const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() })).filter(d => !d.is_deleted);

    console.log("--- Marital Status == 'F' ---");
    docs.filter(d => d.marital_status === 'F').forEach(d => {
        console.log(`Form: ${d.group_form_number || d.form_number}, Name: ${d.first_name} ${d.last_name}, Gender: ${d.gender}, Marital: ${d.marital_status}, Edu: ${d.education}`);
    });

    console.log("\n--- Marital Status == 'C' ---");
    docs.filter(d => d.marital_status === 'C').forEach(d => {
        console.log(`Form: ${d.group_form_number || d.form_number}, Name: ${d.first_name} ${d.last_name}, Gender: ${d.gender}, Marital: ${d.marital_status}, Edu: ${d.education}`);
    });

    process.exit(0);
}

checkOddities().catch(err => {
    console.error(err);
    process.exit(1);
});
