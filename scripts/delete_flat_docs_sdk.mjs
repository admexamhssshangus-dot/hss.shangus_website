import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';

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

const docsToDelete = [
  '250218', '250429', '2604', '3189', '3209', '3215', '3259', '3261',
  '3264', '3266', '3273', '3280', '3300', '3338', '3428', '3454',
  '3464', '3479', '3483'
];

async function deleteAllFlatDocs() {
  console.log(`🗑️ Deleting ${docsToDelete.length} flat docs from masterRegisters via Firebase SDK...\n`);

  let deleted = 0;
  let notFound = 0;

  for (const docId of docsToDelete) {
    try {
      const docRef = doc(db, 'masterRegisters', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await deleteDoc(docRef);
        deleted++;
        console.log(`  ✅ Deleted "${docId}" (had ${Object.keys(snap.data()).length} fields)`);
      } else {
        notFound++;
        console.log(`  ⏭️ "${docId}" not found`);
      }
    } catch (e) {
      console.error(`  ❌ "${docId}": ${e.message}`);
    }
  }

  console.log(`\n🎉 Done! Deleted: ${deleted}, Not Found: ${notFound}, Total: ${docsToDelete.length}`);
}

deleteAllFlatDocs().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
