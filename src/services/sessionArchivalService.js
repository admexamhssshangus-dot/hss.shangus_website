import { collection, doc, getDocs, query, where, orderBy, documentId, limit, startAfter, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { sessionKey, recordIdentity } from '../utils/recordIdentity';
import { resolveStudentAdmissionStatus } from '../utils/studentApprovalStatus';

export async function loadSessionAdmissions(session) {
  if (!/^20\d{2}-\d{2}$/.test(session)) throw new Error('Select a valid academic session.');
  const records = new Map();
  for (const field of ['sessionCanonical', 'Session', 'session', 'Academic Session']) {
    let cursor = null;
    do {
      const constraints = [where(field, '==', session), orderBy(documentId()), limit(250)];
      if (cursor) constraints.push(startAfter(cursor));
      const page = await getDocs(query(collection(db, 'admissions'), ...constraints));
      page.docs.forEach(snap => {
        const data = snap.data();
        if (recordIdentity(data).session === sessionKey(session)) records.set(snap.id, { ...data, id: snap.id, _docId: snap.id });
      });
      cursor = page.size === 250 ? page.docs[page.docs.length - 1] : null;
    } while (cursor);
  }
  return [...records.values()];
}

export async function archiveSessionRecords(records, { session, newSession, purgeDrafts, purgeRejected, onProgress }) {
  if (session === newSession || !/^20\d{2}-\d{2}$/.test(newSession)) throw new Error('Choose a different valid new session.');
  const jobRef = doc(db, 'archivalJobs', session);
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const sourceId = record._docId || record.id;
    const sourceRef = doc(db, 'admissions', sourceId);
    // A stable destination per physical source makes retries safe and never
    // replaces older archive arrays when another cohort is archived later.
    const archiveRef = doc(db, 'masterRegisters', `archive_${session}_${sourceId}`);
    const trashRef = doc(db, 'archivalTrash', `archive_${session}_${sourceId}`);
    await runTransaction(db, async tx => {
      const [source, archive, trash, job] = await Promise.all([tx.get(sourceRef), tx.get(archiveRef), tx.get(trashRef), tx.get(jobRef)]);
      if (job.exists() && job.data().newSession !== newSession) throw new Error('Resume this session using its original destination session.');
      if (!source.exists()) {
        if (archive.exists() || trash.exists()) return;
        throw new Error(`Admission ${sourceId} disappeared before archival. Refresh the preview.`);
      }
      const current = source.data();
      if (current._archivedTo === archiveRef.path && archive.exists()) return;
      if (current._archivedTo === trashRef.path && trash.exists()) return;
      if (recordIdentity(current).session !== sessionKey(session)) throw new Error('A record moved to a different session. Refresh the preview.');
      const status = resolveStudentAdmissionStatus(current);
      if (status !== resolveStudentAdmissionStatus(record)) throw new Error('An admission status changed after the preview. Refresh first.');
      const approved = status === 'Approved';
      if (!approved && !(status === 'Rejected' ? purgeRejected : purgeDrafts)) return;
      if (archive.exists() || trash.exists()) throw new Error('This source ID already has an archive. Review it before moving a recreated admission.');
      tx.set(approved ? archiveRef : trashRef, { ...current, sourceApplicationId: sourceId,
        archivalJobId: session, archivedAt: serverTimestamp() });
      // Preserve issued-document locators without retaining a second copy of
      // student data or leaving this record in active-session queries.
      tx.set(sourceRef, { _archivedTo: (approved ? archiveRef : trashRef).path,
        _deleted: true, Status: 'Archived', archivalJobId: session });
      tx.set(jobRef, { session, newSession, status: 'running', updatedAt: serverTimestamp() }, { merge: true });
    });
    onProgress?.(index + 1, records.length);
  }
  // Recheck the cohort before rollover; newly submitted/approved records must
  // be reviewed instead of silently left behind under a new active session.
  const remaining = await loadSessionAdmissions(session);
  if (remaining.some(record => resolveStudentAdmissionStatus(record) === 'Approved' ||
    (resolveStudentAdmissionStatus(record) === 'Rejected' ? purgeRejected : purgeDrafts))) {
    throw new Error('More admissions arrived during archival. Refresh and resume before switching the active session.');
  }
  await runTransaction(db, async tx => {
    const settingsRef = doc(db, 'site', 'settings');
    const settings = await tx.get(settingsRef);
    const active = settings.data()?.session;
    if (active && active !== session && active !== newSession) throw new Error('The active session changed. Review settings before rollover.');
    tx.set(settingsRef, { session: newSession, lastArchivedSession: session, lastArchivalDate: new Date().toISOString() }, { merge: true });
    tx.set(jobRef, { session, newSession, status: 'completed', completedAt: serverTimestamp() }, { merge: true });
  });
}
