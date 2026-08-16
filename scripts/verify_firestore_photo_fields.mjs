import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDhVgqXBo93FGXAm9YrG8x40Oa9pApu0bo",
  authDomain: "hsssdb.firebaseapp.com",
  projectId: "hsssdb",
  storageBucket: "hsssdb.firebasestorage.app",
  messagingSenderId: "894258649787",
  appId: "1:894258649787:web:8e1f77202b304f48f2279e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyFields() {
  console.log('🔍 Checking actual Firestore documents for photo fields...\n');

  const q = query(collection(db, 'admissions'), limit(10));
  const snap = await getDocs(q);

  let dupCount = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasPhotoId = 'photoId' in data;
    const hasPhoto_id = 'photo_id' in data;
    const hasStudentPhoto = 'Student Photo' in data;

    console.log(`Doc: ${docSnap.id}`);
    console.log(`  - photoId present: ${hasPhotoId}`);
    console.log(`  - photo_id present: ${hasPhoto_id}`);
    console.log(`  - Student Photo present: ${hasStudentPhoto}`);

    if (hasPhoto_id && (hasPhotoId || hasStudentPhoto)) {
      dupCount++;
    }
  }

  console.log(`\nSample check (10 docs): ${dupCount} docs still have duplicate photo fields.`);
}

verifyFields().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
