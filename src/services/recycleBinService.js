// =================================================================
// HSS SHANGUS — 90-Day Firestore Recycle Bin & Restoration Service
// =================================================================
// Soft-deletes student records into 'recycleBin' Firestore collection
// with 90-day expiration, and allows full restoration back to original registers.
// =================================================================

import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { updateCachedItem, invalidateCache } from './dbCache';
import { recycleDeletedFormNumber } from './formNumberService';

const RECYCLE_BIN_COLLECTION = 'recycleBin';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Deep-sanitize an object for Firestore: strips functions, undefined values, and internal UI-only keys.
 */
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore).filter(v => v !== undefined);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    // Skip functions, undefined, symbols, and ALL internal UI-only keys starting with _
    if (typeof val === 'function' || typeof val === 'symbol' || val === undefined) continue;
    if (key.startsWith('_')) continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      clean[key] = sanitizeForFirestore(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Soft-delete a student document by moving it into the 'recycleBin' collection.
 */
export async function moveToRecycleBin(recordData, originalCollection = 'admissions', adminEmail = 'Admin') {
  if (!recordData) return false;

  const formNo = String(recordData['Form Number'] || recordData['Form No.'] || recordData.formNo || '').replace(/^(N\/A|—)$/i, '').trim();
  const rawId = String(recordData.docId || recordData._docId || recordData.id || formNo || `doc_${Date.now()}`).replace(/^(N\/A|—)$/i, '').trim();
  const sanitizedId = rawId.replace(/[\/\s]/g, '_').toLowerCase();

  const studentName = recordData["Student's Name (as per school records)"] || recordData["Student's Name"] || recordData.studentName || 'Student';
  const boardRegNo = recordData['Board Registration Number'] || recordData.boardRegNo || recordData.regNo || '';
  const cls = recordData['Class'] || recordData.class || '11th';

  const deletedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NINETY_DAYS_MS).toISOString();

  const trashDocId = `trash_${originalCollection}_${sanitizedId}`;

  // Sanitize recordData to remove functions and non-serializable values
  const cleanRecordData = sanitizeForFirestore(recordData);

  const trashPayload = {
    trashId: trashDocId,
    originalDocId: rawId,
    sanitizedDocId: sanitizedId,
    originalCollection: originalCollection,
    deletedAt,
    deletedBy: adminEmail,
    expiresAt,
    formNo,
    boardRegNo,
    studentName,
    class: cls,
    data: cleanRecordData
  };

  // Only delete the EXACT document IDs belonging to this record.
  // Never guess by form number — that can collide with other real records.
  const idCandidates = Array.from(new Set([
    rawId,
    sanitizedId,
    recordData.id,
    recordData.docId,
    recordData._docId
  ].filter(cid => cid && cid !== '—' && cid !== 'N/A' && cid !== 'null' && !cid.includes('/'))));

  try {
    // 1. Save archive payload to recycleBin Firestore collection
    await setDoc(doc(db, RECYCLE_BIN_COLLECTION, trashDocId), trashPayload);

    // 2. Direct HARD-DELETE candidate IDs from admissions & masterRegisters (No residual soft-deleted docs in Firebase)
    for (const cid of idCandidates) {
      try {
        await deleteDoc(doc(db, 'admissions', cid)).catch(() => {});
      } catch (_) {}
      try {
        await deleteDoc(doc(db, 'masterRegisters', cid)).catch(() => {});
      } catch (_) {}
      updateCachedItem('admissions', cid, null);
      updateCachedItem('masterRegisters', cid, null);
    }

    // 3. Clean from masterRegisters chunk arrays if record originated from or resides in historical registers
    await cleanStudentFromMasterRegistersChunks({ ...recordData, formNo, studentName, boardRegNo, id: rawId }).catch(() => {});

    // 4. Clean any orphaned drafts or duplicate active docs for this student from admissions
    await cleanStudentDraftsFromAdmissions({ ...recordData, formNo, studentName, boardRegNo, id: rawId }).catch(() => {});

    // 5. Update multi-tier local caches & global window cache
    idCandidates.forEach(cid => {
      updateCachedItem('admissions', cid, null);
      updateCachedItem('masterRegisters', cid, null);
    });

    if (window._hssMasterRegistersCache && Array.isArray(window._hssMasterRegistersCache)) {
      window._hssMasterRegistersCache = window._hssMasterRegistersCache.filter(s => {
        const sf = String(s['Form Number'] || s['Form No.'] || s.formNo || s.id || '').trim();
        const sn = String(s.studentName || s["Student's Name"] || '').trim().toLowerCase();
        return sf !== formNo && s.id !== rawId && s.id !== sanitizedId && (sn !== studentName.toLowerCase() || (formNo && formNo !== '—'));
      });
    }

    invalidateCache('admissions');
    invalidateCache('masterRegisters');

    try { sessionStorage.removeItem('hss_reports_cache_v5'); } catch(e) {}
    try { sessionStorage.removeItem('cached_admin_dashboard'); } catch(e) {}

    // 6. Recycle form number if present
    if (formNo && formNo !== '—') {
      await recycleDeletedFormNumber(formNo, recordData, adminEmail).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('moveToRecycleBin error:', err);
    throw err;
  }
}

/**
 * Remove matching student entries from inside masterRegisters chunk documents (items: []).
 */
async function cleanStudentFromMasterRegistersChunks(studentTarget) {
  if (!studentTarget) return;
  const targetName = String(studentTarget.studentName || studentTarget["Student's Name (as per school records)"] || studentTarget["Student's Name"] || '').trim().toLowerCase();
  const targetForm = String(studentTarget.formNo || studentTarget['Form Number'] || studentTarget['Form No.'] || studentTarget.id || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
  const targetReg = String(studentTarget.boardRegNo || studentTarget['Board Registration Number'] || studentTarget.regNo || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
  const targetId = String(studentTarget.id || studentTarget.docId || '').trim().toLowerCase();

  try {
    const masterSnap = await getDocs(collection(db, 'masterRegisters')).catch(() => null);
    if (!masterSnap || masterSnap.empty) return;

    for (const d of masterSnap.docs) {
      const data = d.data();
      if (Array.isArray(data.items) && data.items.length > 0) {
        let modified = false;
        const remainingItems = data.items.filter(item => {
          if (!item) return false;
          const iName = String(item.studentName || item["Student's Name (as per school records)"] || item["Student's Name"] || '').trim().toLowerCase();
          const iForm = String(item.formNo || item['Form Number'] || item['Form No.'] || item.id || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
          const iReg = String(item.boardRegNo || item['Board Registration Number'] || item.regNo || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
          const iId = String(item.id || item.docId || '').trim().toLowerCase();

          const matchForm = targetForm && targetForm !== '—' && iForm && iForm === targetForm;
          const matchReg = targetReg && targetReg !== '—' && iReg && iReg === targetReg;
          const matchId = targetId && iId && iId === targetId;
          const matchName = targetName && targetName.length > 2 && iName && (iName === targetName || (targetForm && iForm === targetForm));

          if (matchForm || matchReg || matchId || matchName) {
            modified = true;
            return false;
          }
          return true;
        });

        if (modified) {
          await setDoc(doc(db, 'masterRegisters', d.id), { ...data, items: remainingItems }, { merge: true }).catch(() => {});
        }
      } else {
        const dName = String(data.studentName || data["Student's Name"] || '').trim().toLowerCase();
        const dForm = String(data.formNo || data['Form Number'] || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
        if ((targetForm && dForm === targetForm) || (targetName && dName === targetName)) {
          await deleteDoc(doc(db, 'masterRegisters', d.id)).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('cleanStudentFromMasterRegistersChunks warning:', err);
  }
}

/**
 * Remove orphaned drafts or residual applications for the target student from admissions.
 */
async function cleanStudentDraftsFromAdmissions(studentTarget) {
  if (!studentTarget) return;
  const targetName = String(studentTarget.studentName || studentTarget["Student's Name (as per school records)"] || studentTarget["Student's Name"] || '').trim().toLowerCase();
  const targetForm = String(studentTarget.formNo || studentTarget['Form Number'] || studentTarget['Form No.'] || studentTarget.id || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
  const targetEmail = String(studentTarget.email || studentTarget['Email Address'] || studentTarget.emailNormalized || '').trim().toLowerCase();
  const targetUid = String(studentTarget.ownerUid || studentTarget.uid || '').trim();

  try {
    const snap = await getDocs(collection(db, 'admissions')).catch(() => null);
    if (!snap || snap.empty) return;

    for (const d of snap.docs) {
      const data = d.data();
      const dName = String(data.studentName || data["Student's Name"] || '').trim().toLowerCase();
      const dForm = String(data.formNo || data['Form Number'] || d.id || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
      const dEmail = String(data.email || data['Email Address'] || data.emailNormalized || '').trim().toLowerCase();
      const dUid = String(data.ownerUid || data.uid || '').trim();

      const matchId = (targetForm && targetForm !== '—' && dForm === targetForm) || d.id === studentTarget.id || d.id === studentTarget.docId;
      const matchUid = targetUid && dUid && targetUid === dUid;
      const matchEmail = targetEmail && dEmail && targetEmail === dEmail;
      const matchName = targetName && targetName.length > 2 && dName === targetName && (matchEmail || matchUid || !dForm || dForm === '—');

      if (matchId || matchUid || matchEmail || matchName) {
        await deleteDoc(doc(db, 'admissions', d.id)).catch(() => {});
        updateCachedItem('admissions', d.id, null);
      }
    }
  } catch (err) {
    console.warn('cleanStudentDraftsFromAdmissions warning:', err);
  }
}

/**
 * Fetch all unexpired records currently residing in the Recycle Bin.
 */
export async function getRecycleBinItems() {
  try {
    const snap = await getDocs(collection(db, RECYCLE_BIN_COLLECTION));
    const now = Date.now();
    const rawItems = [];

    snap.forEach(d => {
      const data = d.data();
      if (data._purged === true || data.status === 'Purged' || data.status === 'Restored') return;
      const expMs = new Date(data.expiresAt || 0).getTime();
      if (!data.expiresAt || expMs > now) {
        rawItems.push({ id: d.id, trashId: d.id, ...data });
      }
    });

    // Deduplicate multiple deleted entries for the same student (by Form Number or Student Name + Class)
    const uniqueMap = new Map();
    rawItems.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

    for (const item of rawItems) {
      const fNo = String(item.formNo || item['Form Number'] || item['Form No.'] || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
      const sName = String(item.studentName || item["Student's Name"] || '').trim().toLowerCase();
      const cls = String(item.class || '').trim().toLowerCase();
      const dedupKey = (fNo && fNo !== '—') ? fNo : `${sName}_${cls}`;

      if (!uniqueMap.has(dedupKey)) {
        uniqueMap.set(dedupKey, item);
      }
    }

    return Array.from(uniqueMap.values());
  } catch (err) {
    console.warn('getRecycleBinItems warning:', err);
    return [];
  }
}

/**
 * Restore a soft-deleted student record back to its original collection.
 */
export async function restoreFromRecycleBin(trashDocId) {
  if (!trashDocId) return false;

  try {
    const trashRef = doc(db, RECYCLE_BIN_COLLECTION, trashDocId);
    const snap = await getDoc(trashRef);
    if (!snap.exists()) {
      throw new Error('Recycle bin record not found or already purged.');
    }

    const trashData = snap.data();
    const originalCollection = trashData.originalCollection || 'admissions';
    const targetDocId = trashData.sanitizedDocId || trashData.originalDocId || `restored_${Date.now()}`;
    const studentPayload = trashData.data || {};

    const updatedPayload = {
      ...studentPayload,
      status: (studentPayload.status === 'Deleted' || studentPayload.Status === 'Deleted') ? 'Approved' : (studentPayload.status || studentPayload.Status || 'Approved'),
      Status: (studentPayload.status === 'Deleted' || studentPayload.Status === 'Deleted') ? 'Approved' : (studentPayload.status || studentPayload.Status || 'Approved'),
      _deleted: false,
      restoredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    delete updatedPayload._deletedAt;
    delete updatedPayload._deletedBy;

    // 1. Re-insert document into original collection
    await setDoc(doc(db, originalCollection, targetDocId), updatedPayload, { merge: true });

    // If restoring a masterRegisters record, also restore active record in admissions
    if (originalCollection === 'masterRegisters') {
      await setDoc(doc(db, 'admissions', targetDocId), updatedPayload, { merge: true }).catch(() => {});
      updateCachedItem('admissions', targetDocId, updatedPayload);
    }

    // 2. Hard delete document from recycleBin collection
    await deleteDoc(trashRef).catch(async () => {
      await setDoc(trashRef, { _purged: true, _restored: true, status: 'Restored' }, { merge: true });
    });

    // 3. Update local cache & invalidate
    updateCachedItem(originalCollection, targetDocId, updatedPayload);
    invalidateCache(originalCollection);
    invalidateCache('admissions');

    return {
      success: true,
      originalCollection,
      studentName: trashData.studentName || 'Student',
      formNo: trashData.formNo || '—'
    };
  } catch (err) {
    console.error('restoreFromRecycleBin error:', err);
    throw err;
  }
}

/**
 * Permanently delete a record from the recycle bin before the 90-day period.
 * Ensures complete end-to-end purging of all related duplicate deletion entries from Firestore and caches.
 */
export async function purgeFromRecycleBin(trashDocId) {
  if (!trashDocId) return false;
  try {
    const trashRef = doc(db, RECYCLE_BIN_COLLECTION, trashDocId);
    const snap = await getDoc(trashRef).catch(() => null);
    const trashData = snap && snap.exists() ? snap.data() : null;

    let targetFormNo = '';
    let targetStudentName = '';

    if (trashData) {
      targetFormNo = String(trashData.formNo || trashData.data?.['Form Number'] || trashData.data?.formNo || '').replace(/^(N\/A|—)$/i, '').trim();
      targetStudentName = String(trashData.studentName || trashData.data?.["Student's Name"] || '').trim();
    }

    // 1. Scan and hard-delete ALL duplicate recycleBin documents for this student
    try {
      const binSnap = await getDocs(collection(db, RECYCLE_BIN_COLLECTION));
      for (const d of binSnap.docs) {
        const bd = d.data();
        const bFNo = String(bd.formNo || bd.data?.['Form Number'] || '').replace(/^(N\/A|—)$/i, '').trim();
        const bName = String(bd.studentName || bd.data?.["Student's Name"] || '').trim();

        const isMatch =
          d.id === trashDocId ||
          (targetFormNo && targetFormNo !== '—' && bFNo === targetFormNo) ||
          (targetStudentName && targetStudentName.length > 2 && bName.toLowerCase() === targetStudentName.toLowerCase());

        if (isMatch) {
          await deleteDoc(doc(db, RECYCLE_BIN_COLLECTION, d.id)).catch(async () => {
            await setDoc(doc(db, RECYCLE_BIN_COLLECTION, d.id), { _purged: true, status: 'Purged' }, { merge: true });
          });
        }
      }
    } catch (_) {}

    // 2. Scan and hard-delete ALL candidate documents in admissions & masterRegisters
    const cleanFNo = targetFormNo ? targetFormNo.replace(/^#/, '').trim() : '';
    const digitsOnly = targetFormNo.replace(/[^0-9]/g, '');

    const idCandidates = Array.from(new Set([
      trashDocId, targetFormNo, cleanFNo, digitsOnly
    ].filter(Boolean)));

    for (const cid of idCandidates) {
      try { await deleteDoc(doc(db, 'admissions', cid)); } catch (_) {}
      try { await deleteDoc(doc(db, 'masterRegisters', cid)); } catch (_) {}
      updateCachedItem('admissions', cid, null);
      updateCachedItem('masterRegisters', cid, null);
    }

    // 3. Clean from masterRegisters chunk arrays if record resides in historical registers
    await cleanStudentFromMasterRegistersChunks({
      studentName: targetStudentName,
      formNo: targetFormNo,
      boardRegNo: trashData?.boardRegNo || trashData?.data?.['Board Registration Number'] || '',
      id: trashData?.originalDocId || trashDocId
    }).catch(() => {});

    // 4. Clean any remaining drafts from admissions
    await cleanStudentDraftsFromAdmissions({
      studentName: targetStudentName,
      formNo: targetFormNo,
      email: trashData?.data?.['Email Address'] || trashData?.data?.email || '',
      ownerUid: trashData?.data?.ownerUid || ''
    }).catch(() => {});

    // 5. Recycle form number for future series if clean form number exists
    if (cleanFNo && cleanFNo !== '—') {
      await recycleDeletedFormNumber(cleanFNo).catch(() => {});
    }

    invalidateCache('admissions');
    invalidateCache('masterRegisters');

    return true;
  } catch (err) {
    console.error('purgeFromRecycleBin error:', err);
    try {
      await setDoc(doc(db, RECYCLE_BIN_COLLECTION, trashDocId), {
        _purged: true,
        status: 'Purged',
        purgedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (e) {
      return false;
    }
  }
}

/**
/**
 * Hard-delete ONLY documents explicitly flagged as deleted (Status === 'Deleted' AND _deleted === true).
 * This is a safe targeted sweep — never touches real admission documents.
 * Only called explicitly via Clean Recycle Bin button or after a targeted purge.
 */
export async function cleanOrphanedSoftDeletedDocs() {
  try {
    const collectionsToClean = ['admissions', 'masterRegisters'];
    let count = 0;

    for (const collName of collectionsToClean) {
      const snap = await getDocs(collection(db, collName)).catch(() => null);
      if (!snap || snap.empty) continue;

      for (const d of snap.docs) {
        const data = d.data();

        // SAFETY: Require BOTH Status === 'Deleted' AND _deleted === true
        // This prevents accidentally deleting real admissions records
        const isExplicitlyDeleted =
          (data.Status === 'Deleted' || data.status === 'Deleted') &&
          data._deleted === true;

        if (isExplicitlyDeleted) {
          try {
            await deleteDoc(doc(db, collName, d.id));
            updateCachedItem(collName, d.id, null);
            count++;
          } catch (err) {
            // Silently skip — permission errors are expected for records not owned by admin
          }
        }
      }
    }

    if (count > 0) {
      invalidateCache('admissions');
      invalidateCache('masterRegisters');
    }

    return count;
  } catch (err) {
    console.warn('cleanOrphanedSoftDeletedDocs error:', err);
    return 0;
  }
}
