import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
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

console.log(`Connecting to Firebase project: ${firebaseConfig.projectId}...`);

try {
    const campaignsSnap = await getDocs(collection(db, 'campaigns'));
    console.log(`Campaigns in Firestore: ${campaignsSnap.size}`);
    campaignsSnap.forEach(d => console.log(' Campaign:', d.id, d.data().name));

    const regQ = query(collection(db, 'registrations'), limit(3));
    const regSnap = await getDocs(regQ);
    console.log(`\nSample registrations in Firestore (fetched ${regSnap.size}):`);
    regSnap.forEach(d => {
        const data = d.data();
        console.log({
            id: d.id,
            uuid: data.uuid,
            name: `${data.first_name} ${data.last_name}`,
            type: data.type,
            attendance: data.attendance,
            books_received: data.books_received,
            campaign_id: data.campaign_id,
            fieldsCount: Object.keys(data).length
        });
    });

    const totalRegSnap = await getDocs(collection(db, 'registrations'));
    console.log(`\nTotal registrations in Firestore: ${totalRegSnap.size}`);

} catch (err) {
    console.error('Firestore check error:', err);
}
process.exit(0);
