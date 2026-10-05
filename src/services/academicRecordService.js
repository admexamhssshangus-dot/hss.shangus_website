import { staffCallable } from './staffCommand';
import { auth } from './firebase';

export async function saveAcademicRecord(type, docId, payload) {
  if (!auth.currentUser) {
    throw new Error('Authenticated staff session required. Please sign in again.');
  }
  try {
    const res = await staffCallable('submitAcademicRecord')({ type, docId, payload });
    return res.data;
  } catch (callableErr) {
    // Academic awards must never bypass the server-side access, roster, marks,
    // and submission-window checks. PracticalsPage persists a local draft before
    // calling this function, so an unavailable service cannot discard teacher work.
    console.error('Secure academic save rejected:', callableErr?.message || callableErr);
    throw new Error(callableErr?.message || 'The secure academic-save service is unavailable. Your local draft is still available; please retry shortly.');
  }
}

export async function deleteAcademicRecord(type, docId) {
  if (!auth.currentUser) {
    throw new Error('Authenticated staff session required. Please sign in again.');
  }
  try {
    const res = await staffCallable('submitAcademicRecord')({ type, docId, action: 'delete' });
    return res.data;
  } catch (callableErr) {
    console.error('Secure academic deletion rejected:', callableErr?.message || callableErr);
    throw new Error(callableErr?.message || 'The secure academic-save service is unavailable. No academic record was deleted.');
  }
}
