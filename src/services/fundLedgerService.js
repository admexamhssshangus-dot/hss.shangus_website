import { staffCallable } from './staffCommand';
import { db, auth } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export async function mutateFundDistribution(action, record) {
  try {
    const res = await staffCallable('mutateFundDistribution')({ action, id: record.id, record });
    return res.data;
  } catch (callableErr) {
    console.warn('mutateFundDistribution callable unavailable, using direct Firestore on Spark plan:', callableErr?.message || callableErr);
    if (!auth.currentUser) {
      throw new Error('Authenticated administrator session required.');
    }
    const docRef = doc(db, 'fund_distributions', record.id);
    if (action === 'delete') {
      await deleteDoc(docRef);
      return { success: true, id: record.id };
    }
    const cleanRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, cleanRecord, { merge: action === 'update' });
    return { success: true, record: cleanRecord };
  }
}
