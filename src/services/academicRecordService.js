import { staffCallable } from './staffCommand';
import { db, auth } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export async function saveAcademicRecord(type, docId, payload) {
  try {
    const res = await staffCallable('submitAcademicRecord')({ type, docId, payload });
    return res.data;
  } catch (callableErr) {
    console.warn('submitAcademicRecord callable unavailable, using direct Firestore on Spark plan:', callableErr?.message || callableErr);
    if (!auth.currentUser) {
      throw new Error('Authenticated staff session required.');
    }
    const cleanPayload = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, type, docId), cleanPayload, { merge: true });
    return { success: true, docId, record: cleanPayload };
  }
}

export async function deleteAcademicRecord(type, docId) {
  try {
    const res = await staffCallable('submitAcademicRecord')({ type, docId, action: 'delete' });
    return res.data;
  } catch (callableErr) {
    console.warn('deleteAcademicRecord callable unavailable, using direct Firestore on Spark plan:', callableErr?.message || callableErr);
    if (!auth.currentUser) {
      throw new Error('Authenticated staff session required.');
    }
    await deleteDoc(doc(db, type, docId));
    return { success: true, docId };
  }
}
