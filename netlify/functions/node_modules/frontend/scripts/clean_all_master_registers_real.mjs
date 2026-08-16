import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';

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

async function cleanMasterRegistersReal() {
  console.log('🚀 Fetching ALL masterRegisters documents from Firestore...');
  
  const snap = await getDocs(collection(db, 'masterRegisters'));
  console.log(`Fetched ${snap.docs.length} total masterRegisters part documents.\n`);

  let cleanedDocs = 0;
  let totalSavedBytes = 0;

  for (let i = 0; i < snap.docs.length; i++) {
    const docSnap = snap.docs[i];
    const docId = docSnap.id;
    const data = docSnap.data();

    // Check if doc has duplicate photoId or Student Photo
    const hasPhoto_id = 'photo_id' in data && !!data.photo_id;
    const hasPhotoId = 'photoId' in data && !!data.photoId;
    const hasStudentPhoto = 'Student Photo' in data && !!data['Student Photo'];

    const updates = {};
    let savedInThisDoc = 0;

    if (hasPhoto_id) {
      if (hasPhotoId) {
        updates.photoId = deleteField();
        savedInThisDoc += Buffer.byteLength(String(data.photoId), 'utf8');
      }
      if (hasStudentPhoto) {
        updates['Student Photo'] = deleteField();
        savedInThisDoc += Buffer.byteLength(String(data['Student Photo']), 'utf8');
      }
    } else if (hasPhotoId && !hasPhoto_id) {
      // Standardize photoId to photo_id
      updates.photo_id = data.photoId;
      updates.photoId = deleteField();
      if (hasStudentPhoto) updates['Student Photo'] = deleteField();
    }

    if (Object.keys(updates).length > 0) {
      cleanedDocs++;
      totalSavedBytes += savedInThisDoc;
      console.log(`🔥 [${i + 1}/${snap.docs.length}] Cleaning "${docId}": Purging duplicate fields (Saved ${(savedInThisDoc / 1024).toFixed(1)} KB)...`);
      try {
        await updateDoc(doc(db, 'masterRegisters', docId), updates);
      } catch (err) {
        console.error(`❌ Error updating "${docId}":`, err.message);
      }
    }
  }

  const totalSavedMB = (totalSavedBytes / (1024 * 1024)).toFixed(3);
  console.log(`\n======================================================`);
  console.log(`🎉 masterRegisters DEEP CLEANUP COMPLETE!`);
  console.log(` Total Part Documents Scanned: ${snap.docs.length}`);
  console.log(` Part Documents Cleaned: ${cleanedDocs}`);
  console.log(` Real Storage Saved in masterRegisters: ${totalSavedMB} MB`);
  console.log(`======================================================\n`);
}

cleanMasterRegistersReal().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
