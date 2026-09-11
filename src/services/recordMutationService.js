import { collection, doc, getDoc, getDocs, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { invalidateCache } from './dbCache';
import { recordLocator, locateNestedRecord, recordIdentity } from '../utils/recordIdentity';

const present = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function captureFields(record, patch) {
  return Object.fromEntries(Object.keys(patch).map(key => [key, present(record, key) ? { exists: true, value: record[key] } : { exists: false }]));
}
export function restoreFields(current, before, after) {
  const restored = { ...current };
  for (const [key, value] of Object.entries(after)) {
    if (!equal(current[key], value)) throw new Error(`Rollback conflict in "${key}". A later edit must be reviewed first.`);
    if (before[key]?.exists) restored[key] = before[key].value;
    else delete restored[key];
  }
  return restored;
}
export async function beginMutationJob(fileName, totalCount, reasonCategory = 'Field update') {
  const reference = doc(collection(db, 'csvImportBatches'));
  const timestamp = new Date().toISOString();
  await setDoc(reference, { batchId: reference.id, fileName, totalCount, reasonCategory,
    kind: 'field-update-v2', status: 'running', timestamp,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
  return reference.id;
}
export async function applyRecordPatch(student, patch, { jobId, entryId = '0' } = {}) {
  const locator = recordLocator(student);
  const reference = doc(db, locator.collection, locator.documentId);
  // An entry is committed in the SAME transaction as the edit. Even interrupted
  // jobs keep a complete before-image for each successful row.
  const effectiveJob = jobId || await beginMutationJob('Quick Edit', 1);
  const entry = doc(db, 'csvImportBatches', effectiveJob, 'entries', String(entryId));
  await runTransaction(db, async tx => {
    const [snapshot, prior] = await Promise.all([tx.get(reference), tx.get(entry)]);
    if (prior.exists()) return; // retry of the same row is idempotent
    if (!snapshot.exists()) throw new Error('The source student was deleted. Refresh before editing.');
    const data = snapshot.data();
    const nested = locator.nested ? locateNestedRecord(data, locator) : null;
    const current = nested ? nested.record : data;
    const preview = { ...(student.raw || {}), ...student };
    for (const key of Object.keys(patch)) {
      if (['updatedAt', 'lastBoardSyncAt', 'boardSyncSource', 'lastEditedBy'].includes(key)) continue;
      if (present(preview, key) && !equal(preview[key], current[key])) {
        throw new Error(`"${key}" changed since the preview. Refresh before overwriting.`);
      }
    }
    const after = { ...patch };
    const before = captureFields(current, after);
    const updated = { ...current, ...after };
    if (nested) {
      const records = [...nested.records]; records[nested.index] = updated;
      tx.update(reference, { [nested.arrayKey]: records, updatedAt: serverTimestamp() });
    } else tx.set(reference, updated);
    tx.set(entry, { locator: { ...locator, arrayKey: nested?.arrayKey || '',
      identity: locator.nested ? recordIdentity({ Session: data.session || data.Session, Class: data.class || data.Class, ...updated }) : locator.identity },
      before, after, status: 'applied', createdAt: serverTimestamp() });
  });
  invalidateCache(locator.collection);
  return effectiveJob;
}
export async function completeMutationJob(jobId) {
  await setDoc(doc(db, 'csvImportBatches', jobId), { status: 'completed', completedAt: serverTimestamp() }, { merge: true });
}
export async function createRecordWithRollback(documentId, data, { jobId, entryId }) {
  const reference = doc(db, 'admissions', documentId);
  const entry = doc(db, 'csvImportBatches', jobId, 'entries', String(entryId));
  await runTransaction(db, async tx => {
    const [existing, prior] = await Promise.all([tx.get(reference), tx.get(entry)]);
    if (prior.exists()) return;
    if (existing.exists()) throw new Error('This candidate already exists. Refresh and match the existing record.');
    tx.set(reference, data);
    tx.set(entry, { kind: 'created', locator: { collection: 'admissions', documentId, nested: false },
      before: {}, after: data, status: 'applied', createdAt: serverTimestamp() });
  });
  invalidateCache('admissions');
}
export async function rollbackMutationJob(jobId) {
  const job = await getDoc(doc(db, 'csvImportBatches', jobId));
  if (!job.exists() || job.data().kind !== 'field-update-v2') {
    throw new Error('This legacy batch has no durable before-images. Automatic rollback is unavailable; no students were deleted.');
  }
  if (Date.parse(job.data().expiresAt) < Date.now()) throw new Error('This rollback snapshot has expired.');
  const entries = await getDocs(collection(db, 'csvImportBatches', jobId, 'entries'));
  for (const item of entries.docs) {
    await runTransaction(db, async tx => {
      const entry = await tx.get(item.ref);
      const change = entry.data();
      if (change.status === 'restored') return;
      const reference = doc(db, change.locator.collection, change.locator.documentId);
      const snapshot = await tx.get(reference);
      if (!snapshot.exists()) throw new Error('Rollback stopped: the target was deleted.');
      const data = snapshot.data();
      if (change.kind === 'created') {
        if (!equal(data, change.after)) throw new Error('Rollback stopped: this new student has since been edited. Review the later changes first.');
        tx.delete(reference);
        tx.update(item.ref, { status: 'restored', restoredAt: serverTimestamp() });
        return;
      }
      const nested = change.locator.nested ? locateNestedRecord(data, change.locator) : null;
      const restored = restoreFields(nested ? nested.record : data, change.before, change.after);
      if (nested) {
        const records = [...nested.records]; records[nested.index] = restored;
        tx.update(reference, { [nested.arrayKey]: records, updatedAt: serverTimestamp() });
      } else tx.set(reference, restored);
      tx.update(item.ref, { status: 'restored', restoredAt: serverTimestamp() });
    });
  }
  await setDoc(job.ref, { status: 'restored', restoredAt: serverTimestamp() }, { merge: true });
  invalidateCache('admissions'); invalidateCache('masterRegisters');
  return true;
}
