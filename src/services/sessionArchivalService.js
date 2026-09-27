import { 
  collection, doc, getDocs, query, where, orderBy, documentId, limit, 
  startAfter, writeBatch, serverTimestamp, setDoc, deleteDoc, getDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { sessionKey, recordIdentity } from '../utils/recordIdentity';
import { resolveStudentAdmissionStatus } from '../utils/studentApprovalStatus';
import { clearAllMemoryCache, invalidateCache } from './dbCache';

// Helper to sanitize form number for matching
export function normalizeFormNo(val) {
  if (!val) return '';
  return String(val)
    .replace(/^(form|no|f|#|formno|form_no)[:\s_-]*/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Load all admissions for a given academic session.
 */
export async function loadSessionAdmissions(session) {
  if (!/^20\d{2}-\d{2}$/.test(session)) throw new Error('Select a valid academic session (e.g. 2025-26).');
  const records = new Map();
  for (const field of ['sessionCanonical', 'Session', 'session', 'Academic Session']) {
    let cursor = null;
    do {
      const constraints = [where(field, '==', session), orderBy(documentId()), limit(250)];
      if (cursor) constraints.push(startAfter(cursor));
      const page = await getDocs(query(collection(db, 'admissions'), ...constraints));
      page.docs.forEach(snap => {
        const data = snap.data();
        if (recordIdentity(data).session === sessionKey(session) || data.Session === session || data.session === session) {
          records.set(snap.id, { ...data, id: snap.id, _docId: snap.id });
        }
      });
      cursor = page.size === 250 ? page.docs[page.docs.length - 1] : null;
    } while (cursor);
  }
  return [...records.values()];
}

/**
 * Phase 1: Reconcile and Deduplicate 2025-26 Overlap Records.
 * Uses Form Number as the strict matching anchor.
 * 1. Scans masterRegisters for any records belonging to the active session (2025-26).
 * 2. Matches against active admissions documents by Form Number.
 * 3. Harvests any missing non-empty legacy fields into the admissions record.
 * 4. Permanently purges the duplicate entries from masterRegisters chunks/documents.
 */
export async function reconcileAndDeduplicateSession({ session = '2025-26', onProgress = null } = {}) {
  const normTargetSession = session.trim();
  onProgress?.(5, 'Loading active admissions records for session ' + normTargetSession + '...');

  const admissionsList = await loadSessionAdmissions(normTargetSession);
  if (admissionsList.length === 0) {
    throw new Error(`No active admissions records found for session ${normTargetSession}.`);
  }

  // Build index by Form Number
  const admByFormNo = new Map();
  admissionsList.forEach(adm => {
    const rawForm = adm['Form Number'] || adm['Form No.'] || adm.formNo || adm.id || '';
    const norm = normalizeFormNo(rawForm);
    if (norm) {
      admByFormNo.set(norm, adm);
    }
  });

  onProgress?.(15, `Indexed ${admByFormNo.size} admissions by Form Number. Reading master registers...`);

  // Load all masterRegisters documents
  const masterSnap = await getDocs(collection(db, 'masterRegisters'));
  let duplicatesFound = 0;
  let matchedCount = 0;
  let fieldsHarvestedCount = 0;
  let purgedCount = 0;
  const harvestedDetails = [];
  const admissionsPatches = new Map(); // admDocId -> patchObject
  const chunkUpdates = []; // { docId, remainingItems, shouldDelete }
  const flatDocsToDelete = []; // docId[]

  onProgress?.(30, `Scanning ${masterSnap.size} master registers documents for duplicates...`);

  for (const docSnap of masterSnap.docs) {
    const dData = docSnap.data();
    if (!dData || dData.Status === 'Deleted' || dData.status === 'Deleted' || dData._deleted === true) {
      continue;
    }

    // 1. Chunk documents with items: []
    const chunkItems = dData.items || dData.students || dData.records || dData.data;
    if (Array.isArray(chunkItems) && chunkItems.length > 0) {
      const docSession = String(dData.Session || dData.session || dData['Academic Session'] || docSnap.id.split('_')[1] || '').trim();
      let chunkModified = false;
      const remainingItems = [];

      for (const item of chunkItems) {
        if (!item || typeof item !== 'object') continue;
        const itemSession = String(item.Session || item.session || item['Academic Session'] || docSession).trim();

        // Check if item belongs to target session (e.g. 2025-26 or 2025)
        const isTargetSession = itemSession === normTargetSession || itemSession.startsWith('2025');

        if (isTargetSession) {
          duplicatesFound++;
          const itemForm = normalizeFormNo(item['Form Number'] || item['Form No.'] || item.formNo || item.id || '');
          const matchedAdm = admByFormNo.get(itemForm);

          if (matchedAdm) {
            matchedCount++;
            chunkModified = true;
            // Scan for missing fields to harvest into admissions
            const admDocId = matchedAdm._docId || matchedAdm.id;
            const currentPatch = admissionsPatches.get(admDocId) || {};
            let harvestedForThis = 0;

            const fieldsToCheck = [
              ['Admission No', 'admissionNo', 'admNo', 'Adm. No.'],
              ['Adm. Date', 'admissionDate', 'admDate', 'Admission Date'],
              ['PEN No', 'penNo', 'pen', 'PEN No.', 'APAAR ID', 'apaarId'],
              ['DoB in words', 'dobWords', 'DoB (words)', 'DoB (in words)'],
              ['Name of the Institution last attended', 'prevSchool', 'Previous School'],
              ['Roll No. (Class 10th)', 'prevExamRollNo', 'prevRollNo', 'Exam R.No. (Prev.)'],
              ['Marks Obtained (Class 10th)', 'prevMarksObt', 'Marks Obt. (Prev.)'],
              ['Max Marks (Class 10th)', 'prevMaxMarks', 'Max. Marks (Prev.)'],
              ['Percentage (Class 10th)', 'prevPercentage', '%age (Prev.)'],
              ['Previous Result / Marks', 'prevDivision', 'Div/Distinc (Prev.)'],
              ['Bank Account No.', 'bankAccount', 'accountNo'],
              ['Bank Name', 'bankName', 'Name of Bank'],
              ['IFSC Code', 'ifsc', 'IFSC code']
            ];

            fieldsToCheck.forEach(aliasGroup => {
              const primaryKey = aliasGroup[0];
              // Find first non-empty value in master record
              let masterVal = '';
              for (const k of aliasGroup) {
                if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '' && String(item[k]).trim() !== '—') {
                  masterVal = String(item[k]).trim();
                  break;
                }
              }

              // Check if admissions record already has this value
              let admVal = '';
              for (const k of aliasGroup) {
                if (matchedAdm[k] !== undefined && matchedAdm[k] !== null && String(matchedAdm[k]).trim() !== '' && String(matchedAdm[k]).trim() !== '—') {
                  admVal = String(matchedAdm[k]).trim();
                  break;
                }
              }

              if (masterVal && !admVal && !currentPatch[primaryKey]) {
                currentPatch[primaryKey] = masterVal;
                fieldsHarvestedCount++;
                harvestedForThis++;
              }
            });

            if (harvestedForThis > 0) {
              admissionsPatches.set(admDocId, currentPatch);
              harvestedDetails.push({
                formNo: itemForm,
                studentName: matchedAdm["Student's Name (as per school records)"] || matchedAdm.studentName,
                harvestedFields: Object.keys(currentPatch)
              });
            }

            purgedCount++;
            // Exclude from remaining items (purging duplicate from masterRegisters)
            continue;
          }
        }

        remainingItems.push(item);
      }

      if (chunkModified) {
        chunkUpdates.push({
          docId: docSnap.id,
          remainingItems,
          shouldDelete: remainingItems.length === 0,
          originalData: dData
        });
      }
    } else {
      // 2. Flat documents
      const flatSession = String(dData.Session || dData.session || dData['Academic Session'] || '').trim();
      const isTarget = flatSession === normTargetSession || flatSession.startsWith('2025') || docSnap.id.includes(normTargetSession);

      if (isTarget) {
        duplicatesFound++;
        const flatForm = normalizeFormNo(dData['Form Number'] || dData['Form No.'] || dData.formNo || dData.id || '');
        const matchedAdm = admByFormNo.get(flatForm);

        if (matchedAdm) {
          matchedCount++;
          const admDocId = matchedAdm._docId || matchedAdm.id;
          const currentPatch = admissionsPatches.get(admDocId) || {};

          const fieldsToCheck = [
            ['Admission No', 'admissionNo', 'admNo', 'Adm. No.'],
            ['Adm. Date', 'admissionDate', 'admDate', 'Admission Date'],
            ['PEN No', 'penNo', 'pen', 'PEN No.', 'APAAR ID', 'apaarId'],
            ['DoB in words', 'dobWords', 'DoB (words)', 'DoB (in words)']
          ];

          fieldsToCheck.forEach(aliasGroup => {
            const primaryKey = aliasGroup[0];
            let masterVal = '';
            for (const k of aliasGroup) {
              if (dData[k] !== undefined && dData[k] !== null && String(dData[k]).trim() !== '' && String(dData[k]).trim() !== '—') {
                masterVal = String(dData[k]).trim();
                break;
              }
            }

            let admVal = '';
            for (const k of aliasGroup) {
              if (matchedAdm[k] !== undefined && matchedAdm[k] !== null && String(matchedAdm[k]).trim() !== '' && String(matchedAdm[k]).trim() !== '—') {
                admVal = String(matchedAdm[k]).trim();
                break;
              }
            }

            if (masterVal && !admVal && !currentPatch[primaryKey]) {
              currentPatch[primaryKey] = masterVal;
              fieldsHarvestedCount++;
            }
          });

          if (Object.keys(currentPatch).length > 0) {
            admissionsPatches.set(admDocId, currentPatch);
          }
        }

        flatDocsToDelete.push(docSnap.id);
        purgedCount++;
      }
    }
  }

  onProgress?.(60, `Harvested fields for ${admissionsPatches.size} students. Writing updates to admissions...`);

  // Apply patches to admissions in batches of 400
  const patchEntries = [...admissionsPatches.entries()];
  for (let i = 0; i < patchEntries.length; i += 400) {
    const chunk = patchEntries.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach(([admDocId, patch]) => {
      batch.set(doc(db, 'admissions', admDocId), {
        ...patch,
        _reconciledFromMaster: true,
        _reconciledAt: serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  onProgress?.(80, `Purging ${purgedCount} duplicates from master registers...`);

  // Purge from masterRegisters chunk documents
  for (const upd of chunkUpdates) {
    if (upd.shouldDelete) {
      await deleteDoc(doc(db, 'masterRegisters', upd.docId)).catch(() => {});
    } else {
      await setDoc(doc(db, 'masterRegisters', upd.docId), {
        ...upd.originalData,
        items: upd.remainingItems,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
  }

  // Delete flat docs
  for (let i = 0; i < flatDocsToDelete.length; i += 400) {
    const chunk = flatDocsToDelete.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach(dId => {
      batch.delete(doc(db, 'masterRegisters', dId));
    });
    await batch.commit().catch(() => {});
  }

  // Invalidate memory caches
  clearAllMemoryCache();
  invalidateCache('admissions');
  invalidateCache('masterRegisters');

  onProgress?.(100, `Reconciliation completed successfully! Purged ${purgedCount} duplicates.`);

  return {
    duplicatesFound,
    matchedCount,
    fieldsHarvestedCount,
    admissionsPatchedCount: admissionsPatches.size,
    purgedCount,
    harvestedDetails
  };
}

/**
 * Phase 2: Session Rollover Execution.
 * 1. Packages approved records into structured masterRegisters chunks.
 * 2. Wipes admissions collection for the archived session.
 * 3. Updates site/settings.session to newSession.
 * 4. Clears all memory caches.
 */
export async function archiveSessionRecords(records, { session, newSession, onProgress = null } = {}) {
  if (session === newSession || !/^20\d{2}-\d{2}$/.test(newSession)) {
    throw new Error('Please select a valid new academic session (e.g. 2026-27).');
  }

  onProgress?.(10, 'Partitioning approved candidates by class and stream...');

  // 1. Separate approved from unapproved
  const approvedRecords = [];
  const unapprovedRecords = [];

  records.forEach(rec => {
    if (resolveStudentAdmissionStatus(rec) === 'Approved') {
      approvedRecords.push(rec);
    } else {
      unapprovedRecords.push(rec);
    }
  });

  if (approvedRecords.length === 0) {
    throw new Error('No approved records found to migrate to master registers.');
  }

  // 2. Group approved records by (Class, Stream)
  const groups = new Map();
  approvedRecords.forEach(s => {
    const rawClass = String(s['Admission sought for class'] || s.Class || s.class || 'Other').toLowerCase();
    let classKey = 'Class_11th';
    if (rawClass.includes('9')) classKey = 'Class_9th';
    else if (rawClass.includes('10')) classKey = 'Class_10th';
    else if (rawClass.includes('11')) classKey = 'Class_11th';
    else if (rawClass.includes('12')) classKey = 'Class_12th';

    const rawStream = String(s.Stream || s.stream || s['Academic Stream'] || 'General')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    const groupKey = `${session}_${classKey}_${rawStream}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { classKey, stream: rawStream, items: [] });
    }
    groups.get(groupKey).items.push(s);
  });

  onProgress?.(30, `Packing ${approvedRecords.length} approved students into master registers chunks...`);

  // 3. Write structured chunk documents (up to 60 students per chunk)
  let chunkIndex = 1;
  for (const [groupKey, groupData] of groups.entries()) {
    const items = groupData.items;
    const CHUNK_SIZE = 60;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunkItems = items.slice(i, i + CHUNK_SIZE).map((student, itemIdx) => {
        const cleaned = { ...student };
        // Strip internal UI properties
        delete cleaned._docId;
        delete cleaned._source;
        delete cleaned._parentDocId;
        delete cleaned._arrayKey;
        delete cleaned._isHistorical;
        delete cleaned._isMasterRegister;

        // Strip legacy duplicate photo keys, preserving only canonical photo_id
        delete cleaned['Student Photo'];
        delete cleaned.photoUrl;
        delete cleaned.photoId;
        delete cleaned.studentPhoto;
        delete cleaned.passport_photo;

        cleaned.Session = session;
        cleaned.session = session;
        cleaned.archivedAt = new Date().toISOString();
        return cleaned;
      });

      const chunkDocId = `chunk_${session}_${groupData.classKey}_${groupData.stream}_part${String(chunkIndex).padStart(2, '0')}`;
      const chunkDocRef = doc(db, 'masterRegisters', chunkDocId);

      await setDoc(chunkDocRef, {
        session,
        class: groupData.classKey.replace('_', ' '),
        stream: groupData.stream,
        groupKey,
        items: chunkItems,
        count: chunkItems.length,
        archivedAt: new Date().toISOString(),
        archivalJobId: session,
        updatedAt: serverTimestamp()
      }, { merge: true });

      chunkIndex++;
    }
  }

  onProgress?.(65, `Committed ${approvedRecords.length} records to master registers. Wiping admissions collection...`);

  // 4. Wipe all admissions records for this session in batches of 400
  for (let i = 0; i < records.length; i += 400) {
    const batch = writeBatch(db);
    const slice = records.slice(i, i + 400);
    slice.forEach(rec => {
      const docId = rec._docId || rec.id;
      if (docId) {
        batch.delete(doc(db, 'admissions', String(docId)));
      }
    });
    await batch.commit();
  }

  onProgress?.(85, `Advancing active system session pointer to ${newSession}...`);

  // 5. Update site/settings
  const settingsRef = doc(db, 'site', 'settings');
  await setDoc(settingsRef, {
    session: newSession,
    lastArchivedSession: session,
    lastArchivalDate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // 6. Record archival job completion
  const jobRef = doc(db, 'archivalJobs', session);
  await setDoc(jobRef, {
    session,
    newSession,
    status: 'completed',
    approvedArchivedCount: approvedRecords.length,
    unapprovedArchivedCount: unapprovedRecords.length,
    completedAt: serverTimestamp()
  }, { merge: true });

  // 7. Clear all memory and browser caches
  clearAllMemoryCache();
  invalidateCache('admissions');
  invalidateCache('masterRegisters');

  onProgress?.(100, `Session rollover to ${newSession} completed successfully!`);

  return {
    archivedCount: approvedRecords.length,
    unapprovedCount: unapprovedRecords.length,
    archivedSession: session,
    newSession
  };
}
