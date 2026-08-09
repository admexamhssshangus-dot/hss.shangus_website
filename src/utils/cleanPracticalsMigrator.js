import { db } from '../services/firebase';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { CLEAN_PRACTICALS_SEED_DATA } from '../data/cleanPracticalsSeedData';

export async function syncCleanPracticalsToFirestore() {
  try {
    console.log('Deleting earlier practicalsData from Firestore...');
    const snap = await getDocs(collection(db, 'practicalsData'));
    for (const dSnap of snap.docs) {
      await deleteDoc(doc(db, 'practicalsData', dSnap.id)).catch(() => {});
    }

    console.log(`Writing ${CLEAN_PRACTICALS_SEED_DATA.length} clean practical documents afresh...`);
    for (const item of CLEAN_PRACTICALS_SEED_DATA) {
      const docId = item.id;
      await setDoc(doc(db, 'practicalsData', docId), item);
    }

    console.log('Clean practicals migration complete.');
    return { success: true, count: CLEAN_PRACTICALS_SEED_DATA.length };
  } catch (err) {
    console.error('Practicals migration error:', err);
    return { success: false, error: err.message };
  }
}
