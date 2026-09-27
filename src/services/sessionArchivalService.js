import { 
  collection, doc, getDocs, query, where, orderBy, documentId, limit, 
  startAfter, writeBatch, serverTimestamp, setDoc, deleteDoc 
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
// Authoritative 29-field harvest mapping for deduplication & legacy enrichment
export const HARVESTABLE_FIELD_MAPPING = [
  {
    targetKey: 'photo_id',
    canonicalKey: 'Photo ID',
    aliases: [
      'photo_id', 'photoId', 'Student Photo', 'Student Photograph', 'Student Photo URL',
      'photoUrl', 'photo', 'Photo', 'studentPhoto', 'photoData'
    ]
  },
  {
    targetKey: 'Admission No',
    canonicalKey: 'Admission No',
    aliases: ['Admission No', 'admissionNo', 'admNo', 'Adm. No.', 'Adm No', 'Adm No.', 'admissionNumber', 'Old Admission No.', 'Old Adm. No.']
  },
  {
    targetKey: 'Adm. Date',
    canonicalKey: 'Adm. Date',
    aliases: ['Adm. Date', 'admissionDate', 'admDate', 'Admission Date', 'Adm Date']
  },
  {
    targetKey: 'Board Registration Number',
    canonicalKey: 'Board Registration Number',
    aliases: [
      'Board Registration Number', 'Board Registration No. (Class 11th)', 'Board Registration No. (Class 10th)',
      'Board Registration No. (Class 9th)', 'Board Registration No. (Class 8th)',
      'Board Registration No.', 'Board Reg. No.', 'Registration No. (allotted by JKBOSE)',
      'DIET Registration No.', 'boardRegNo', 'regNo', 'REG. NO.', 'Registration No.'
    ]
  },
  {
    targetKey: "Father's/Guardian's Name (as per school records)",
    canonicalKey: "Father's Name",
    aliases: [
      "Father's/Guardian's Name (as per school records)", "Father's Name (as per school records)",
      "Father's Name", "Father's/Guardian's Name", "Parent's Name", 'fatherName', 'parentName', 'parentage'
    ]
  },
  {
    targetKey: "Mother's Name (as per school records)",
    canonicalKey: "Mother's Name",
    aliases: [
      "Mother's Name (as per school records)", "Mother's Name", 'Mother Name', 'motherName', 'Mother'
    ]
  },
  {
    targetKey: 'DoB (as per school records)',
    canonicalKey: 'DoB (figures)',
    aliases: [
      'DoB (as per school records)', 'DoB (figures)', 'DoB (in figures)', 'Date of Birth',
      'Date of Birth (as per school records)', 'dob', 'DoB', 'dateOfBirth'
    ]
  },
  {
    targetKey: 'DoB in words',
    canonicalKey: 'DoB in words',
    aliases: ['DoB in words', 'dobWords', 'DoB (words)', 'DoB (in words)', 'dateOfBirthInWords']
  },
  {
    targetKey: 'Stream for Class 11th',
    canonicalKey: 'Stream',
    aliases: [
      'Stream for Class 11th', 'Stream opted in Class 11th', 'Stream & Subjects for Class 12th',
      'Stream', 'stream', 'faculty', 'Academic Stream'
    ]
  },
  {
    targetKey: 'PEN No',
    canonicalKey: 'PEN No',
    aliases: ['PEN number (given by UDISE portal)', 'PEN No', 'PEN No.', 'Permanent Education Number (PEN)', 'penNo', 'pen', 'APAAR ID', 'apaarId']
  },
  {
    targetKey: 'Aadhar No.',
    canonicalKey: 'Aadhaar Number',
    aliases: ['Aadhar No.', 'Aadhaar Number', 'Aadhaar No.', 'Aadhaar Number (12 Digits)', 'aadhaar', 'aadhar', 'aadhaarNo']
  },
  {
    targetKey: "Father's Aadhar No.",
    canonicalKey: "Father's Aadhaar No.",
    aliases: ["Father's Aadhar No.", "Father's Aadhaar No.", "Father's Aadhaar Number", 'fatherAadhaar']
  },
  {
    targetKey: 'Gender',
    canonicalKey: 'Gender',
    aliases: ['Gender', 'gender', 'Sex', 'sex']
  },
  {
    targetKey: 'Social category',
    canonicalKey: 'Category',
    aliases: ['Social category', 'Category', 'Cat._JKBOSE', 'Social Category', 'category']
  },
  {
    targetKey: 'Mobile No. (with working WhatsApp)',
    canonicalKey: 'Mobile No.',
    aliases: ['Mobile No. (with working WhatsApp)', 'Mobile No.', 'Mobile Number', "Student's Contact", 'mobile']
  },
  {
    targetKey: "Parent's Mobile No. (must be working)",
    canonicalKey: "Parent's Contact",
    aliases: ["Parent's Mobile No. (must be working)", "Parent's Contact", 'Alternate Mobile No.', 'parentContact']
  },
  {
    targetKey: 'Email Address',
    canonicalKey: 'Email',
    aliases: ['Email Address', 'Email', 'email']
  },
  {
    targetKey: 'Name of your village',
    canonicalKey: 'Permanent Address',
    aliases: ['Name of your village', 'Village/Town', 'Permanent Address', 'residence', 'address', 'village']
  },
  {
    targetKey: 'Tehsil',
    canonicalKey: 'Tehsil',
    aliases: ['Tehsil', 'tehsil']
  },
  {
    targetKey: 'District',
    canonicalKey: 'District',
    aliases: ['District', 'district']
  },
  {
    targetKey: 'PIN code',
    canonicalKey: 'PIN code',
    aliases: ['PIN code', 'Pin Code', 'Pincode', 'pincode']
  },
  {
    targetKey: 'Name of the Institution last attended',
    canonicalKey: 'Previous School',
    aliases: ['Name of the Institution last attended', 'Previous School', 'Name of Previous School (Class 10th)', 'Name of Previous School (Class 11th)', 'Name of Previous School (Class 8th)', 'prevSchool']
  },
  {
    targetKey: 'Roll No. (Class 10th)',
    canonicalKey: 'Exam R.No. (Prev.)',
    aliases: ['Roll No. (Class 10th)', 'Exam Roll Number of Class 10th', 'Exam Roll Number of Class 11th', 'Exam R.No. (Prev.)', 'prevExamRollNo', 'prevRollNo']
  },
  {
    targetKey: 'Marks Obtained (Class 10th)',
    canonicalKey: 'Marks Obt. (Prev.)',
    aliases: ['Marks Obtained (Class 10th)', 'Total Marks Obtained in Class 10th', 'Total Marks Obtained in Class 11th', 'Marks Obt. (Prev.)', 'prevMarksObt', 'prevMarks']
  },
  {
    targetKey: 'Total Max. Marks in Class 10th',
    canonicalKey: 'Max. Marks (Prev.)',
    aliases: ['Total Max. Marks in Class 10th', 'Total Max. Marks in Class 11th', 'Max Marks (Class 10th)', 'Max. Marks (Prev.)', 'prevMaxMarks']
  },
  {
    targetKey: 'Percentage (Class 10th)',
    canonicalKey: '%age (Prev.)',
    aliases: ['Percentage (Class 10th)', '%age (Prev.)', 'prevPercentage']
  },
  {
    targetKey: 'Previous Result / Marks',
    canonicalKey: 'Div/Distinc (Prev.)',
    aliases: ['Previous Result / Marks', 'Div/Distinc (Prev.)', 'prevDivision']
  },
  {
    targetKey: 'Bank Account No.',
    canonicalKey: 'Bank Account No.',
    aliases: ['Bank Account No.', 'Bank Account No', 'bankAccount', 'accountNo']
  },
  {
    targetKey: 'Name of Bank',
    canonicalKey: 'Bank Name',
    aliases: ['Name of Bank', 'Bank Name', 'bankName']
  },
  {
    targetKey: 'IFSC code',
    canonicalKey: 'IFSC Code',
    aliases: ['IFSC code', 'IFSC Code', 'ifsc']
  }
];

/**
 * Phase 1 Step 1: Scan for Duplicates & Preview Harvestable Fields.
 * 100% READ-ONLY: Scans masterRegisters and verified catalog without modifying anything in Firestore.
 */
export async function scanSessionDuplicates({ session = '2025-26', onProgress = null } = {}) {
  const normTargetSession = session.trim();
  onProgress?.(5, 'Loading active admissions records for session ' + normTargetSession + '...');

  const admissionsList = await loadSessionAdmissions(normTargetSession);
  if (admissionsList.length === 0) {
    throw new Error(`No active admissions records found for session ${normTargetSession}.`);
  }

  // Build index of admissions by Form Number
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
  const chunkUpdates = []; // { docId, remainingItems, shouldDelete, originalData }
  const flatDocsToDelete = []; // docId[]

  onProgress?.(30, `Scanning ${masterSnap.size} master registers documents for duplicates...`);

  for (const docSnap of masterSnap.docs) {
    const dData = docSnap.data();
    if (!dData || dData.Status === 'Deleted' || dData.status === 'Deleted' || dData._deleted === true) {
      continue;
    }

    const targetPrefix = normTargetSession.split('-')[0];

    // 1. Chunk documents with items: []
    const chunkItems = dData.items || dData.students || dData.records || dData.data;
    if (Array.isArray(chunkItems) && chunkItems.length > 0) {
      const docSession = String(dData.Session || dData.session || dData['Academic Session'] || docSnap.id.split('_')[1] || '').trim();
      let chunkModified = false;
      const remainingItems = [];

      for (const item of chunkItems) {
        if (!item || typeof item !== 'object') continue;
        const itemSession = String(item.Session || item.session || item['Academic Session'] || docSession).trim();

        // Check if item belongs to target session (e.g. 2025-26 or 2026-27)
        const isTargetSession = itemSession === normTargetSession || (targetPrefix && itemSession.startsWith(targetPrefix));

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
            const studentFieldGains = [];

            for (const fieldDef of HARVESTABLE_FIELD_MAPPING) {
              const primaryKey = fieldDef.targetKey;
              // Find first non-empty value in master record
              let masterVal = '';
              for (const k of fieldDef.aliases) {
                if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '' && String(item[k]).trim() !== '—') {
                  masterVal = String(item[k]).trim();
                  break;
                }
              }

              // Check if admissions record already has this value
              let admVal = '';
              for (const k of fieldDef.aliases) {
                if (matchedAdm[k] !== undefined && matchedAdm[k] !== null && String(matchedAdm[k]).trim() !== '' && String(matchedAdm[k]).trim() !== '—') {
                  admVal = String(matchedAdm[k]).trim();
                  break;
                }
              }

              if (masterVal && !admVal && !currentPatch[primaryKey]) {
                currentPatch[primaryKey] = masterVal;
                // Also write canonical alias if applicable
                if (fieldDef.canonicalKey && fieldDef.canonicalKey !== primaryKey && !currentPatch[fieldDef.canonicalKey]) {
                  currentPatch[fieldDef.canonicalKey] = masterVal;
                }
                fieldsHarvestedCount++;
                studentFieldGains.push({
                  field: fieldDef.canonicalKey || primaryKey,
                  val: masterVal
                });
              }
            }

            if (studentFieldGains.length > 0) {
              admissionsPatches.set(admDocId, currentPatch);
              harvestedDetails.push({
                formNo: itemForm,
                studentName: matchedAdm["Student's Name (as per school records)"] || matchedAdm["Student's Name"] || matchedAdm.studentName || 'Student',
                className: matchedAdm['Admission sought for class'] || matchedAdm.Class || matchedAdm.class || '—',
                rollNo: matchedAdm['Class Roll No'] || matchedAdm.classRollNo || '—',
                fields: studentFieldGains
              });
            }

            purgedCount++;
            continue; // Exclude from remaining items
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
      const isTarget = flatSession === normTargetSession || (targetPrefix && flatSession.startsWith(targetPrefix)) || docSnap.id.includes(normTargetSession);

      if (isTarget) {
        duplicatesFound++;
        const flatForm = normalizeFormNo(dData['Form Number'] || dData['Form No.'] || dData.formNo || dData.id || '');
        const matchedAdm = admByFormNo.get(flatForm);

        if (matchedAdm) {
          matchedCount++;
          const admDocId = matchedAdm._docId || matchedAdm.id;
          const currentPatch = admissionsPatches.get(admDocId) || {};
          const studentFieldGains = [];

          for (const fieldDef of HARVESTABLE_FIELD_MAPPING) {
            const primaryKey = fieldDef.targetKey;
            let masterVal = '';
            for (const k of fieldDef.aliases) {
              if (dData[k] !== undefined && dData[k] !== null && String(dData[k]).trim() !== '' && String(dData[k]).trim() !== '—') {
                masterVal = String(dData[k]).trim();
                break;
              }
            }

            let admVal = '';
            for (const k of fieldDef.aliases) {
              if (matchedAdm[k] !== undefined && matchedAdm[k] !== null && String(matchedAdm[k]).trim() !== '' && String(matchedAdm[k]).trim() !== '—') {
                admVal = String(matchedAdm[k]).trim();
                break;
              }
            }

            if (masterVal && !admVal && !currentPatch[primaryKey]) {
              currentPatch[primaryKey] = masterVal;
              if (fieldDef.canonicalKey && fieldDef.canonicalKey !== primaryKey && !currentPatch[fieldDef.canonicalKey]) {
                currentPatch[fieldDef.canonicalKey] = masterVal;
              }
              fieldsHarvestedCount++;
              studentFieldGains.push({
                field: fieldDef.canonicalKey || primaryKey,
                val: masterVal
              });
            }
          }

          if (studentFieldGains.length > 0) {
            admissionsPatches.set(admDocId, currentPatch);
            harvestedDetails.push({
              formNo: flatForm,
              studentName: matchedAdm["Student's Name (as per school records)"] || matchedAdm["Student's Name"] || matchedAdm.studentName || 'Student',
              className: matchedAdm['Admission sought for class'] || matchedAdm.Class || matchedAdm.class || '—',
              rollNo: matchedAdm['Class Roll No'] || matchedAdm.classRollNo || '—',
              fields: studentFieldGains
            });
          }
        }

        flatDocsToDelete.push(docSnap.id);
        purgedCount++;
      }
    }
  }

  onProgress?.(100, `Scan completed: Found ${duplicatesFound} duplicates, ${fieldsHarvestedCount} harvestable fields.`);

  return {
    targetSession: normTargetSession,
    admissionsCount: admissionsList.length,
    duplicatesFound,
    matchedCount,
    unmatchedCount: duplicatesFound - matchedCount,
    fieldsHarvestedCount,
    admissionsPatchedCount: admissionsPatches.size,
    purgedCount,
    harvestedDetails,
    admissionsPatches,
    chunkUpdates,
    flatDocsToDelete
  };
}

/**
 * Phase 1 Step 2: Execute Reconciliation & Deduplication based on authorized Scan Plan.
 * Applies patches to admissions and safely purges duplicates from masterRegisters.
 */
export async function executeDuplicatesReconciliation({ scanPlan, onProgress = null } = {}) {
  if (!scanPlan) throw new Error('Missing scan plan for reconciliation execution.');

  const {
    targetSession,
    admissionsPatches,
    chunkUpdates,
    flatDocsToDelete,
    purgedCount,
    matchedCount,
    fieldsHarvestedCount,
    harvestedDetails
  } = scanPlan;

  onProgress?.(20, `Writing harvested fields to ${admissionsPatches.size} admissions documents in Firestore...`);

  // Apply patches to admissions in batches of 400
  const patchEntries = admissionsPatches instanceof Map 
    ? [...admissionsPatches.entries()] 
    : Object.entries(admissionsPatches);

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

  onProgress?.(60, `Purging ${purgedCount} duplicates from master registers...`);

  // Purge from masterRegisters chunk documents
  for (const upd of (chunkUpdates || [])) {
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
  for (let i = 0; i < (flatDocsToDelete || []).length; i += 400) {
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
    success: true,
    targetSession,
    matchedCount,
    fieldsHarvestedCount,
    admissionsPatchedCount: patchEntries.length,
    purgedCount,
    harvestedDetails
  };
}

/**
 * Backward-compatible single-call reconciliation.
 */
export async function reconcileAndDeduplicateSession({ session = '2025-26', onProgress = null } = {}) {
  const plan = await scanSessionDuplicates({ session, onProgress });
  return await executeDuplicatesReconciliation({ scanPlan: plan, onProgress });
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
        delete cleaned._masterMatch;
        delete cleaned._masterAdmNo;
        delete cleaned._masterRegNo;
        delete cleaned._masterFatherName;
        delete cleaned._masterMotherName;
        delete cleaned._masterDob;

        // Strip legacy duplicate photo keys, preserving only canonical photo_id
        delete cleaned['Student Photo'];
        delete cleaned.photoUrl;
        delete cleaned.photoId;
        delete cleaned.studentPhoto;
        delete cleaned.passport_photo;

        // Canonical master registers fields
        const sName = student["Student's Name (as per school records)"] || student["Student's Name"] || student.studentName || student.name || '';
        const fName = student["Father's Name"] || student["Father's/Guardian's Name (as per school records)"] || student["Father's/Guardian's Name"] || student.fatherName || '';
        const mName = student["Mother's Name"] || student["Mother's Name (as per school records)"] || student.motherName || '';
        const sDob = student['DoB (figures)'] || student['DoB (as per school records)'] || student['Date of Birth'] || student.dob || '';
        const sReg = student['Board Registration Number'] || student['Board Registration No. (Class 11th)'] || student['Board Registration No. (Class 10th)'] || student['Board Reg. No.'] || student.boardRegNo || student.regNo || '';
        const sAdm = student['Admission No'] || student['Admission No.'] || student['Adm. No.'] || student.admNo || student.admissionNo || '';
        const sRoll = student['Class Roll No'] || student.classRollNo || student.rollNo || '';

        if (sName) cleaned["Student's Name"] = sName;
        if (fName) cleaned["Father's Name"] = fName;
        if (mName) cleaned["Mother's Name"] = mName;
        if (sDob) cleaned["DoB (figures)"] = sDob;
        if (sReg) cleaned["Board Registration Number"] = sReg;
        if (sAdm) cleaned["Admission No"] = sAdm;
        if (sRoll) cleaned["Class Roll No"] = sRoll;

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
