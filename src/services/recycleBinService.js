// =================================================================
// HSS SHANGUS — 90-Day Firestore Recycle Bin & Restoration Service
// =================================================================
// Soft-deletes student records into 'recycleBin' Firestore collection
// with 90-day expiration, and allows full restoration back to original registers.
// =================================================================

import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, runTransaction, writeBatch } from 'firebase/firestore';
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
  if (!['admissions', 'masterRegisters'].includes(originalCollection)) {
    throw new Error(`Recycle-bin moves are not allowed from collection "${originalCollection}".`);
  }

  const formNo = String(recordData['Form Number'] || recordData['Form No.'] || recordData.formNo || '').replace(/^(N\/A|—)$/i, '').trim();
  const rawId = String(recordData._docId || recordData.docId || recordData.id || formNo || `doc_${Date.now()}`).replace(/^(N\/A|—)$/i, '').trim();
  const sanitizedId = rawId.replace(/[/\s]/g, '_').toLowerCase();

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
  const idCandidates = [rawId].filter(cid => cid && cid !== '—' && cid !== 'N/A' && cid !== 'null' && !cid.includes('/'));

  try {
    // 1. Try to atomically archive the payload and remove from admissions
    let archiveCommitted = false;
    try {
      const archiveBatch = writeBatch(db);
      archiveBatch.set(doc(db, RECYCLE_BIN_COLLECTION, trashDocId), trashPayload);
      for (const cid of idCandidates) {
        archiveBatch.delete(doc(db, originalCollection, cid));
      }
      await archiveBatch.commit();
      archiveCommitted = true;
    } catch (batchErr) {
      console.warn('Recycle bin batch failed, executing direct deletion fallback:', batchErr);
    }

    // 2. Direct deletion fallback if batch failed or partially executed
    if (!archiveCommitted) {
      for (const cid of idCandidates) {
        try {
          await deleteDoc(doc(db, originalCollection, cid));
        } catch (delErr) {
          console.warn(`Direct delete failed for ${cid}:`, delErr);
        }
      }
    }

    // 3. A historical record may live inside a master-register chunk rather than
    // as a standalone document. Only inspect chunks when that was the source.
    if (originalCollection === 'masterRegisters') {
      await cleanStudentFromMasterRegistersChunks({ ...recordData, formNo, studentName, boardRegNo, id: rawId }).catch(() => {});
    }

    // 4. Update multi-tier local caches & global window cache
    idCandidates.forEach(cid => {
      updateCachedItem(originalCollection, cid, null);
    });

    if (originalCollection === 'masterRegisters' && window._hssMasterRegistersCache && Array.isArray(window._hssMasterRegistersCache)) {
      window._hssMasterRegistersCache = window._hssMasterRegistersCache.filter(s => {
        const sf = String(s['Form Number'] || s['Form No.'] || s.formNo || s.id || '').trim();
        return sf !== formNo && s.id !== rawId;
      });
    }

    invalidateCache(originalCollection);

    try { sessionStorage.removeItem('hss_reports_cache_v5'); } catch(e) {}
    try { sessionStorage.removeItem('cached_admin_dashboard'); } catch(e) {}

    // 5. Recycle form number if present
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
  const targetForm = String(studentTarget.formNo || studentTarget['Form Number'] || studentTarget['Form No.'] || studentTarget.id || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
  const targetReg = String(studentTarget.boardRegNo || studentTarget['Board Registration Number'] || studentTarget.regNo || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
  const targetId = String(studentTarget.id || studentTarget.docId || '').trim().toLowerCase();
  const targetClass = String(studentTarget.class || studentTarget.Class || studentTarget['Admission sought for class'] || '').trim().toLowerCase();
  const targetSession = String(studentTarget.session || studentTarget.Session || studentTarget['Academic Session'] || '').trim().toLowerCase();

  try {
    const masterSnap = await getDocs(collection(db, 'masterRegisters')).catch(() => null);
    if (!masterSnap || masterSnap.empty) return;

    for (const d of masterSnap.docs) {
      const data = d.data();
      if (Array.isArray(data.items) && data.items.length > 0) {
        let modified = false;
        const remainingItems = data.items.filter(item => {
          if (!item) return false;
          const iForm = String(item.formNo || item['Form Number'] || item['Form No.'] || item.id || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
          const iReg = String(item.boardRegNo || item['Board Registration Number'] || item.regNo || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
          const iId = String(item.id || item.docId || '').trim().toLowerCase();
          const iClass = String(item.class || item.Class || item['Admission sought for class'] || '').trim().toLowerCase();
          const iSession = String(item.session || item.Session || item['Academic Session'] || '').trim().toLowerCase();

          const matchForm = targetForm && targetForm !== '—' && iForm && iForm === targetForm;
          const matchId = targetId && iId && iId === targetId;
          const sameClass = !targetClass || !iClass || targetClass === iClass;
          const sameSession = !targetSession || !iSession || targetSession === iSession;
          const matchReg = targetReg && targetReg !== '—' && iReg && iReg === targetReg && sameClass && sameSession;

          if (matchForm || matchReg || matchId) {
            modified = true;
            return false;
          }
          return true;
        });

        if (modified) {
          await setDoc(doc(db, 'masterRegisters', d.id), { ...data, items: remainingItems }, { merge: true }).catch(() => {});
        }
      } else {
        const dForm = String(data.formNo || data['Form Number'] || '').replace(/^(N\/A|—)$/i, '').trim().toLowerCase();
        const dId = String(d.id || data.id || data.docId || '').trim().toLowerCase();
        if ((targetForm && dForm === targetForm) || (targetId && dId === targetId)) {
          await deleteDoc(doc(db, 'masterRegisters', d.id)).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('cleanStudentFromMasterRegistersChunks warning:', err);
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

    // Every archive is an independent restore target. Never hide entries merely
    // because names or form numbers resemble another archived record.
    rawItems.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
    return rawItems;
  } catch (err) {
    console.warn('getRecycleBinItems warning:', err);
    return [];
  }
}

const RESTORABLE_COLLECTIONS = new Set(['admissions', 'masterRegisters']);

function getRestoreIdentity(record = {}) {
  const clean = value => String(value || '').replace(/^'/, '').trim().toLowerCase();
  return {
    formNo: clean(record.formNo || record['Form Number'] || record['Form No.']),
    regNo: clean(record.boardRegNo || record['Board Registration Number'] || record['Board Registration No.'] || record.regNo),
    className: clean(record.class || record.Class || record['Admission sought for class']),
    session: clean(record.session || record.Session || record['Academic Session'])
  };
}

function isSameRestoreIdentity(existing, archived) {
  const a = getRestoreIdentity(existing);
  const b = getRestoreIdentity(archived);
  if (a.formNo && b.formNo) return a.formNo === b.formNo;
  if (a.regNo && b.regNo) {
    const sameClass = !a.className || !b.className || a.className === b.className;
    const sameSession = !a.session || !b.session || a.session === b.session;
    return a.regNo === b.regNo && sameClass && sameSession;
  }
  return false;
}

function buildRestoreEntry(trashDocId, trashData) {
  const originalCollection = String(trashData.originalCollection || 'admissions').trim();
  if (!RESTORABLE_COLLECTIONS.has(originalCollection)) {
    throw new Error(`Restore is not allowed for collection "${originalCollection}".`);
  }

  const targetDocId = String(trashData.originalDocId || trashData.sanitizedDocId || '').trim();
  if (!targetDocId || targetDocId.includes('/')) {
    throw new Error(`Recycle record ${trashDocId} has an invalid original document ID.`);
  }

  const studentPayload = trashData.data || trashData.originalData || trashData.record;
  if (!studentPayload || typeof studentPayload !== 'object' || Array.isArray(studentPayload)) {
    throw new Error(`Recycle record ${trashDocId} has no restorable student payload.`);
  }

  const originalStatus = String(studentPayload.Status || studentPayload.status || '').trim();
  const restoredStatus = !originalStatus || originalStatus.toLowerCase() === 'deleted' ? 'Submitted' : originalStatus;
  const restoredAt = new Date().toISOString();
  const restoredPayload = {
    ...studentPayload,
    Status: restoredStatus,
    status: restoredStatus,
    restoredAt,
    updatedAt: restoredAt
  };
  delete restoredPayload._deleted;
  delete restoredPayload._deletedAt;
  delete restoredPayload._deletedBy;

  return { trashDocId, trashData, originalCollection, targetDocId, restoredPayload };
}

/**
 * Atomically restore one or more recycle-bin records. Existing matching active
 * records are never overwritten; their stale recycle wrappers are only removed
 * after identity verification. Any conflict aborts the entire selection.
 */
export async function restoreMultipleFromRecycleBin(trashDocIds = []) {
  const uniqueIds = Array.from(new Set((trashDocIds || []).filter(Boolean).map(String)));
  if (uniqueIds.length === 0) throw new Error('Select at least one recycle-bin record to restore.');
  if (uniqueIds.length > 150) throw new Error('Restore at most 150 records in one operation.');

  const transactionResult = await runTransaction(db, async transaction => {
    const trashRefs = uniqueIds.map(id => doc(db, RECYCLE_BIN_COLLECTION, id));
    const trashSnaps = [];
    for (const ref of trashRefs) trashSnaps.push(await transaction.get(ref));

    const entries = trashSnaps.map((snap, index) => {
      if (!snap.exists()) throw new Error(`Recycle record ${uniqueIds[index]} no longer exists.`);
      return buildRestoreEntry(uniqueIds[index], snap.data());
    });

    const targetMap = new Map();
    entries.forEach(entry => {
      const collections = entry.originalCollection === 'masterRegisters'
        ? ['masterRegisters', 'admissions']
        : [entry.originalCollection];
      collections.forEach(collectionName => {
        const pathKey = `${collectionName}/${entry.targetDocId}`;
        if (targetMap.has(pathKey)) throw new Error(`Multiple selected archives target ${pathKey}. Restore them separately.`);
        targetMap.set(pathKey, { entry, collectionName, ref: doc(db, collectionName, entry.targetDocId) });
      });
    });

    const targets = Array.from(targetMap.values());
    const targetSnaps = [];
    for (const target of targets) targetSnaps.push(await transaction.get(target.ref));

    targets.forEach((target, index) => {
      const existingSnap = targetSnaps[index];
      if (existingSnap.exists() && !isSameRestoreIdentity(existingSnap.data(), target.entry.restoredPayload)) {
        throw new Error(`Restore conflict at ${target.collectionName}/${target.entry.targetDocId}; the active record is different.`);
      }
    });

    targets.forEach((target, index) => {
      if (!targetSnaps[index].exists()) transaction.set(target.ref, target.entry.restoredPayload);
    });
    entries.forEach((entry, index) => transaction.delete(trashRefs[index]));

    return entries.map(entry => ({
      originalCollection: entry.originalCollection,
      targetDocId: entry.targetDocId,
      studentName: entry.trashData.studentName || 'Student',
      formNo: entry.trashData.formNo || '—',
      payload: entry.restoredPayload
    }));
  });

  transactionResult.forEach(result => {
    updateCachedItem(result.originalCollection, result.targetDocId, result.payload);
    if (result.originalCollection === 'masterRegisters') updateCachedItem('admissions', result.targetDocId, result.payload);
  });
  invalidateCache('admissions');
  invalidateCache('masterRegisters');

  return { success: true, restoredCount: transactionResult.length, records: transactionResult };
}

export async function restoreFromRecycleBin(trashDocId) {
  const result = await restoreMultipleFromRecycleBin([trashDocId]);
  const restored = result.records[0];
  return { success: true, ...restored };
}

/**
 * Permanently remove only the selected recycle-bin wrapper. The active
 * admissions and historical registers are never scanned or modified here.
 */
export async function purgeFromRecycleBin(trashDocId) {
  if (!trashDocId) throw new Error('Recycle-bin document ID is required.');
  const trashRef = doc(db, RECYCLE_BIN_COLLECTION, String(trashDocId));
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(trashRef);
    if (!snap.exists()) throw new Error('Recycle-bin record no longer exists.');
    transaction.delete(trashRef);
  });
  return true;
}

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
