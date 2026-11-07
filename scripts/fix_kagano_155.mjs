import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';

const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);

const CAMPAIGN_ID = 'campaign-b016fdbd-9dda-4ec3-a316-9e1027d52e22';
const USER_UID = 'E7bGBQslPsafBPovmFoYHiLqxQZ2';
const USER_NAME = 'Samukeliso Mayabane';
const USER_EMAIL = 'samukeliso.mayabane@thehealthyfamilies.net';

async function fixKaganoAndMooketsi() {
    const now = new Date().toISOString();

    // 1. Restore Fire Officer Mooketsi in Register 175
    const mooketsiRef = doc(db, 'registrations', '2c55f6fc-d360-492a-9cf0-af2c61e2fa7c');
    await updateDoc(mooketsiRef, {
        first_name: 'Mooketsi',
        last_name: '',
        age: null,
        education: '',
        occupation: 'Fire',
        affiliation: 'Fire',
        contact: '75777333',
        place: 'FIRE',
        form_number: '175',
        group_form_number: '175',
        facilitator_uuid: 'b7bb8d0a-cb5b-4908-9fad-acbded04b5d7',
        attendance: [false, true, true, true, true, true, true, false, true, false, false, false],
        books_received: true,
        updated_at: now,
        updated_by_uid: USER_UID,
        updated_by_name: USER_NAME,
        updated_by_email: USER_EMAIL
    });
    console.log('Restored Fire Officer Mooketsi in Register 175');

    // 2. Add Kagano Mooketsi as 9th participant in Register 155 under Maduo Modise
    const kaganoUuid = crypto.randomUUID();
    const kaganoRef = doc(db, 'registrations', kaganoUuid);
    const kaganoData = {
        uuid: kaganoUuid,
        type: 'participant',
        first_name: 'Kagano',
        last_name: 'Mooketsi',
        contact: '74727301',
        gender: 'M',
        age: 21,
        education: 'College/University',
        marital_status: 'Single',
        occupation: 'Student',
        affiliation: 'Makakatlela',
        books_received: true,
        group_form_number: '155',
        form_number: '155',
        place: 'Salon + Spaza Shop Makakatlela',
        facilitator_uuid: '9f401aec-372a-48af-9ba9-062bf91635cd',
        attendance: [true, false, false, false, false, false, false, false, false, false, false, false],
        submission_source: 'paper_batch_entry',
        campaign_id: CAMPAIGN_ID,
        is_daily_core: false,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        created_by_uid: USER_UID,
        created_by_name: USER_NAME,
        created_by_email: USER_EMAIL,
        created_by_role: 'admin',
        updated_by_uid: USER_UID,
        updated_by_name: USER_NAME,
        updated_by_email: USER_EMAIL,
        updated_by_role: 'admin'
    };
    await setDoc(kaganoRef, kaganoData);
    console.log(`Added Kagano Mooketsi (uuid: ${kaganoUuid}) to Register 155 under Maduo Modise!`);

    process.exit(0);
}

fixKaganoAndMooketsi().catch(e => {
    console.error(e);
    process.exit(1);
});
