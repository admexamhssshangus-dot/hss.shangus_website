import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

async function deepCleanMasterRegisterItems() {
  console.log('🚀 Fetching masterRegisters to clean nested items array elements...\n');

  const snap = await getDocs(collection(db, 'masterRegisters'));
  console.log(`Fetched ${snap.docs.length} part documents from masterRegisters.\n`);

  let totalPartDocsCleaned = 0;
  let totalStudentItemsCleaned = 0;
  let totalBytesSaved = 0;

  for (let i = 0; i < snap.docs.length; i++) {
    const docSnap = snap.docs[i];
    const docId = docSnap.id;
    const data = docSnap.data();

    if (!Array.isArray(data.items)) continue;

    let partModified = false;
    let partSavedBytes = 0;
    let partCleanedStudents = 0;

    const cleanedItems = data.items.map(st => {
      if (!st || typeof st !== 'object') return st;

      const pPrimary = st.photo_id || '';
      const pAlt1 = st.photoId || '';
      const pAlt2 = st['Student Photo'] || '';
      const pAlt3 = st.photoUrl || '';
      const mainPhoto = pPrimary || pAlt1 || pAlt2 || pAlt3;

      if (!mainPhoto || typeof mainPhoto !== 'string' || !mainPhoto.startsWith('data:image')) {
        return st;
      }

      const copy = { ...st };
      copy.photo_id = mainPhoto;

      if ('photoId' in copy) {
        partSavedBytes += Buffer.byteLength(String(copy.photoId), 'utf8');
        delete copy.photoId;
        partModified = true;
      }
      if ('Student Photo' in copy) {
        partSavedBytes += Buffer.byteLength(String(copy['Student Photo']), 'utf8');
        delete copy['Student Photo'];
        partModified = true;
      }

      if (partModified) partCleanedStudents++;
      return copy;
    });

    if (partModified) {
      totalPartDocsCleaned++;
      totalStudentItemsCleaned += partCleanedStudents;
      totalBytesSaved += partSavedBytes;

      console.log(`🔥 [${i + 1}/${snap.docs.length}] Cleaned part doc "${docId}": Purged duplicate photo fields from ${partCleanedStudents} student items (Saved ${(partSavedBytes / 1024).toFixed(1)} KB)...`);

      try {
        await updateDoc(doc(db, 'masterRegisters', docId), { items: cleanedItems });
      } catch (err) {
        console.error(`❌ Error updating "${docId}":`, err.message);
      }
    }
  }

  const totalSavedMB = (totalBytesSaved / (1024 * 1024)).toFixed(3);
  console.log(`\n======================================================`);
  console.log(`🎉 DEEP NESTED MASTER REGISTERS CLEANUP COMPLETE!`);
  console.log(` Total Part Docs Scanned: ${snap.docs.length}`);
  console.log(` Part Docs Cleaned: ${totalPartDocsCleaned}`);
  console.log(` Total Student Array Items Cleaned: ${totalStudentItemsCleaned}`);
  console.log(` Total Real Storage Saved in masterRegisters: ${totalSavedMB} MB`);
  console.log(`======================================================\n`);
}

deepCleanMasterRegisterItems().then(() => process.exit(0)).catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
