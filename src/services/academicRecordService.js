import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
export async function saveAcademicRecord(type, docId, payload) {
  return (await httpsCallable(functions, 'submitAcademicRecord')({ type, docId, payload })).data;
}
export async function deleteAcademicRecord(type, docId) {
  return (await httpsCallable(functions, 'submitAcademicRecord')({ type, docId, action: 'delete' })).data;
}
