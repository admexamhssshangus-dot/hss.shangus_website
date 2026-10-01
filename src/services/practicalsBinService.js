import { db, auth } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { invalidateCollectionCache } from './dbCache';
import { logAdminActivity } from './adminActivityLogger';
import { sanitizeForFirestore } from '../utils/firestoreSanitizer';

const BIN_COLLECTION = 'practicalsBin';
const MAX_VERSIONS_PER_DOC = 3;

/**
 * Saves a snapshot of an existing practical evaluation document into the Version Bin.
 * Automatically keeps only the last 3 versions for that canonical document, pruning older ones.
 *
 * @param {string} canonicalDocId - The primary identifier (e.g. 11th_Botany_Pre-Board Test_2025-26)
 * @param {object} documentData - The complete award roll data to preserve
 * @param {string} reason - Reason for version archiving ('teacher_resubmission', 'overwrite_revision', 'manual_backup')
 * @param {object} userMeta - Information about who is making the change { name, email }
 * @returns {Promise<string|null>} - The new bin version ID or null if skipped
 */
export async function saveVersionToBin(canonicalDocId, documentData, reason = 'resubmission', userMeta = {}) {
  if (!canonicalDocId || !documentData) return null;
  const records = Array.isArray(documentData.records) ? documentData.records : [];
  if (records.length === 0) return null;

  try {
    const timestamp = Date.now();
    const binDocId = `bin_${canonicalDocId}_${timestamp}`;
    const currentUser = auth.currentUser;
    const authorName = userMeta.name || currentUser?.displayName || documentData.submittedByName || 'Faculty';
    const authorEmail = userMeta.email || currentUser?.email || documentData.submittedByEmail || '';

    const binPayload = {
      id: binDocId,
      canonicalDocId,
      versionTimestamp: new Date().toISOString(),
      createdAt: timestamp,
      archivedAt: new Date().toISOString(),
      archivedReason: reason,
      archivedBy: authorName,
      archivedByEmail: authorEmail,
      className: documentData.className || documentData.Class || '',
      subject: documentData.subject || documentData.subjectName || '',
      subjectCode: documentData.subjectCode || '',
      practicalType: documentData.practicalType || documentData.evaluationType || 'Internal',
      yearSuffix: documentData.yearSuffix || documentData.session || '',
      maxMarks: documentData.maxMarks || 50,
      minMarks: documentData.minMarks || 18,
      recordsCount: records.length,
      records: records,
      originalStatus: documentData.status || 'approved',
      lastIntegratedAt: documentData.lastIntegratedAt || documentData.updatedAt || new Date().toISOString(),
    };

    // 1. Write the new version snapshot into the bin
    await setDoc(doc(db, BIN_COLLECTION, binDocId), sanitizeForFirestore(binPayload));

    // 2. Fetch all existing versions for this document to enforce the 3-version limit
    await pruneOldVersions(canonicalDocId);

    return binDocId;
  } catch (err) {
    console.warn(`[practicalsBin] Failed to archive version for ${canonicalDocId}:`, err);
    return null;
  }
}

/**
 * Enforces the last-3-versions policy by removing any versions beyond the 3 newest.
 */
async function pruneOldVersions(canonicalDocId) {
  try {
    const binRef = collection(db, BIN_COLLECTION);
    const q = query(binRef, where('canonicalDocId', '==', canonicalDocId));
    const snap = await getDocs(q);

    if (snap.docs.length <= MAX_VERSIONS_PER_DOC) return;

    // Sort descending by creation timestamp
    const allVersions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allVersions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Delete versions beyond the top 3
    const versionsToDelete = allVersions.slice(MAX_VERSIONS_PER_DOC);
    for (const v of versionsToDelete) {
      await deleteDoc(doc(db, BIN_COLLECTION, v.id)).catch(() => {});
    }
  } catch (pruneErr) {
    console.warn('[practicalsBin] Error during version pruning:', pruneErr);
  }
}

/**
 * Retrieves the available historical versions in the bin for a given canonical document.
 * Returns up to the last 3 versions, ordered newest to oldest.
 *
 * @param {string} canonicalDocId
 * @returns {Promise<Array>}
 */
export async function getVersionsForDoc(canonicalDocId) {
  if (!canonicalDocId) return [];
  try {
    const binRef = collection(db, BIN_COLLECTION);
    const q = query(binRef, where('canonicalDocId', '==', canonicalDocId));
    const snap = await getDocs(q);

    const versions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    versions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return versions.slice(0, MAX_VERSIONS_PER_DOC);
  } catch (err) {
    console.warn(`[practicalsBin] Failed to fetch versions for ${canonicalDocId}:`, err);
    return [];
  }
}

/**
 * Restores a selected version from the bin into the active practicalsData collection.
 * Before overwriting, it automatically preserves the current active record as a safety backup.
 *
 * @param {string} binDocId - The ID of the bin snapshot to restore
 * @param {string} canonicalDocId - The target canonical practical document ID
 * @param {object} adminUser - Admin performing the restoration
 * @returns {Promise<object>}
 */
export async function restoreVersionFromBin(binDocId, canonicalDocId, adminUser = {}) {
  if (!binDocId || !canonicalDocId) {
    throw new Error('Missing bin version ID or canonical document ID.');
  }

  // 1. Fetch the bin snapshot
  const binSnap = await getDoc(doc(db, BIN_COLLECTION, binDocId));
  if (!binSnap.exists()) {
    throw new Error('The selected historical version was not found in the bin.');
  }
  const versionData = binSnap.data();

  // 2. Fetch current active document (if any) and save a safety snapshot into the bin
  const activeDocRef = doc(db, 'practicalsData', canonicalDocId);
  const activeSnap = await getDoc(activeDocRef);
  if (activeSnap.exists()) {
    const activeData = activeSnap.data();
    if (activeData && Array.isArray(activeData.records) && activeData.records.length > 0) {
      await saveVersionToBin(
        canonicalDocId,
        activeData,
        'pre_restore_safety_backup',
        adminUser
      );
    }
  }

  // 3. Assemble restored active document
  const restoredPayload = {
    id: canonicalDocId,
    canonicalDocId,
    className: versionData.className,
    subject: versionData.subject,
    subjectCode: versionData.subjectCode,
    subjectName: versionData.subject,
    practicalType: versionData.practicalType,
    evaluationType: versionData.practicalType,
    yearSuffix: versionData.yearSuffix,
    records: versionData.records,
    maxMarks: versionData.maxMarks,
    minMarks: versionData.minMarks,
    status: 'approved',
    isDraft: false,
    isPendingApproval: false,
    submittedByName: versionData.archivedBy || 'Faculty',
    submittedByEmail: versionData.archivedByEmail || '',
    restoredFromBinId: binDocId,
    restoredAt: new Date().toISOString(),
    restoredBy: adminUser.name || adminUser.email || 'Administrator',
    approvedAt: new Date().toISOString(),
    approvedBy: adminUser.email || 'Administrator',
    updatedAt: new Date().toISOString(),
    lastIntegratedAt: new Date().toISOString()
  };

  // 4. Overwrite active document in practicalsData
  await setDoc(activeDocRef, sanitizeForFirestore(restoredPayload));

  // 5. Invalidate practicals cache so all pages reflect restored state immediately
  invalidateCollectionCache('practicalsData');

  // 6. Log admin activity
  logAdminActivity({
    actionType: 'restore',
    actionTitle: 'Restored Practical Award Version from Bin',
    details: `Restored ${versionData.subject} (${versionData.className}) version from ${new Date(versionData.createdAt).toLocaleString()} with ${versionData.records?.length || 0} student records.`,
    affectedId: canonicalDocId
  });

  return restoredPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Practicals Submission Recycle Bin
// Separate from the version-history bin above. This handles admin soft-deletion
// of entire pending/approved submission documents so teachers can re-submit.
// Collection: 'practicalsRecycleBin'
// ─────────────────────────────────────────────────────────────────────────────

const SUBMISSION_BIN_COLLECTION = 'practicalsRecycleBin';
/** How many days before a recycled submission is auto-expirable (UI hint only; no TTL enforced here) */
const SUBMISSION_BIN_RETENTION_DAYS = 90;

/**
 * Moves a practicalsData document into the practicalsRecycleBin.
 * The original document is then deleted from practicalsData so the
 * teacher's submission slot becomes empty again.
 *
 * @param {object} submissionDoc - The full submission document object (must have .id)
 * @param {object} deletedByMeta - { name, email } of the admin performing the deletion
 * @returns {Promise<string>} - The recycled document ID in practicalsRecycleBin
 */
export async function moveSubmissionToRecycleBin(submissionDoc, deletedByMeta = {}) {
  if (!submissionDoc || !submissionDoc.id) {
    throw new Error('Invalid submission document: missing ID.');
  }

  const currentUser = auth.currentUser;
  const adminName = deletedByMeta.name || currentUser?.displayName || 'Administrator';
  const adminEmail = deletedByMeta.email || currentUser?.email || '';
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + SUBMISSION_BIN_RETENTION_DAYS);

  const binDocId = `pbin_${submissionDoc.id}_${Date.now()}`;

  const binPayload = sanitizeForFirestore({
    binDocId,
    originalDocId: submissionDoc.id,
    originalCollection: 'practicalsData',
    // Preserve core identifiers for display
    subject: submissionDoc.subject || submissionDoc.subjectName || '',
    subjectCode: submissionDoc.subjectCode || '',
    className: submissionDoc.className || submissionDoc.class || '',
    practicalType: submissionDoc.practicalType || submissionDoc.evaluationType || '',
    yearSuffix: submissionDoc.yearSuffix || submissionDoc.session || '',
    submittedBy: submissionDoc.submittedBy || submissionDoc.submittedByName || '',
    submittedByEmail: submissionDoc.submittedByEmail || submissionDoc.teacherEmail || '',
    recordsCount: Array.isArray(submissionDoc.records) ? submissionDoc.records.length : 0,
    originalStatus: submissionDoc.status || 'pending',
    isPendingApproval: Boolean(submissionDoc.isPendingApproval || submissionDoc.status === 'pending_approval'),
    // Preserve the full submission payload for restoration
    submissionData: submissionDoc,
    // Audit trail
    deletedAt: now.toISOString(),
    deletedBy: adminName,
    deletedByEmail: adminEmail,
    expiresAt: expiresAt.toISOString(),
    retentionDays: SUBMISSION_BIN_RETENTION_DAYS,
    restorable: true,
  });

  // 1. Write to recycle bin
  await setDoc(doc(db, SUBMISSION_BIN_COLLECTION, binDocId), binPayload);

  // 2. Delete from active practicalsData so the slot is free
  await deleteDoc(doc(db, 'practicalsData', submissionDoc.id));

  // 3. Invalidate cache
  invalidateCollectionCache('practicalsData');

  return binDocId;
}

/**
 * Returns all items currently in the practicalsRecycleBin, ordered newest first.
 * @returns {Promise<Array>}
 */
export async function getPracticalsRecycleBinItems() {
  try {
    const snap = await getDocs(
      query(collection(db, SUBMISSION_BIN_COLLECTION), orderBy('deletedAt', 'desc'), limit(200))
    );
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (err) {
    // Fallback if composite index not yet built
    try {
      const snap2 = await getDocs(collection(db, SUBMISSION_BIN_COLLECTION));
      const items = snap2.docs.map(d => ({ ...d.data(), id: d.id }));
      items.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
      return items;
    } catch (e2) {
      console.warn('[practicalsBin] Failed to fetch recycle bin items:', e2);
      return [];
    }
  }
}

/**
 * Restores a soft-deleted submission from the recycle bin back into practicalsData.
 * @param {string} binDocId - The ID in practicalsRecycleBin
 * @param {object} restoredByMeta - { name, email } of the admin restoring
 * @returns {Promise<object>} - The restored submission document
 */
export async function restoreSubmissionFromBin(binDocId, restoredByMeta = {}) {
  if (!binDocId) throw new Error('Missing recycle bin document ID.');

  const currentUser = auth.currentUser;
  const adminName = restoredByMeta.name || currentUser?.displayName || 'Administrator';
  const adminEmail = restoredByMeta.email || currentUser?.email || '';

  // 1. Fetch the bin document
  const binSnap = await getDoc(doc(db, SUBMISSION_BIN_COLLECTION, binDocId));
  if (!binSnap.exists()) {
    throw new Error('Submission not found in recycle bin.');
  }
  const binData = binSnap.data();
  const originalDoc = binData.submissionData;
  const originalDocId = binData.originalDocId;

  if (!originalDoc || !originalDocId) {
    throw new Error('Recycle bin item is missing original submission data.');
  }

  // 2. Check for conflict — if a document already exists at that ID
  const existingSnap = await getDoc(doc(db, 'practicalsData', originalDocId));
  if (existingSnap.exists()) {
    throw new Error(
      `Cannot restore: A submission with ID "${originalDocId}" already exists in practicalsData. ` +
      'The teacher may have already resubmitted. Please review before restoring.'
    );
  }

  // 3. Restore the document back to practicalsData
  const restoredPayload = sanitizeForFirestore({
    ...originalDoc,
    restoredFromBin: true,
    restoredFromBinId: binDocId,
    restoredAt: new Date().toISOString(),
    restoredBy: adminName,
    restoredByEmail: adminEmail,
  });

  await setDoc(doc(db, 'practicalsData', originalDocId), restoredPayload);

  // 4. Mark the bin item as restored (don't purge it yet — leave an audit trail)
  await setDoc(doc(db, SUBMISSION_BIN_COLLECTION, binDocId), sanitizeForFirestore({
    ...binData,
    restorable: false,
    wasRestored: true,
    restoredAt: new Date().toISOString(),
    restoredBy: adminName,
    restoredByEmail: adminEmail,
  }));

  // 5. Invalidate cache
  invalidateCollectionCache('practicalsData');

  return restoredPayload;
}

/**
 * Permanently and irreversibly purges a submission from the recycle bin.
 * @param {string} binDocId - The ID in practicalsRecycleBin
 * @returns {Promise<void>}
 */
export async function purgeSubmissionFromBin(binDocId) {
  if (!binDocId) throw new Error('Missing recycle bin document ID.');
  await deleteDoc(doc(db, SUBMISSION_BIN_COLLECTION, binDocId));
}
