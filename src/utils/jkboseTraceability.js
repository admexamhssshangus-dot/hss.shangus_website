import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Mapping of Dashboard column keys and sub-elements to known database and overwrite keys.
 */
export const JKBOSE_FIELD_MAPPING = {
  studentName: [
    'studentName',
    'name',
    "Student's Name",
    "Student's Name (as per school records)",
    'Student Name',
    'candidatename',
    'Candidate Name'
  ],
  fatherName: [
    'fatherName',
    "Father's Name",
    "Father's/Guardian's Name (as per school records)",
    "Father's/Guardian's Name",
    "Parent's Name",
    'parentName',
    'parentage'
  ],
  motherName: [
    'motherName',
    "Mother's Name",
    "Mother's Name (as per school records)",
    'Mother Name',
    'Mother'
  ],
  dob: [
    'dob',
    'DoB',
    'DoB (figures)',
    'DoB (as per school records)',
    'dateOfBirth'
  ],
  dobWords: [
    'dobWords',
    'DoB (words)',
    'dateOfBirthInWords'
  ],
  gender: [
    'gender',
    'Gender',
    'Sex',
    'sex'
  ],
  category: [
    'category',
    'Cat._JKBOSE',
    'Category',
    'Social Category',
    'Social category'
  ],
  stream: [
    'stream',
    'Stream',
    'Stream for Class 11th',
    'Stream opted in Class 11th',
    'Stream & Subjects for Class 12th',
    'faculty'
  ],
  subs: [
    'subjects',
    'Subjects',
    'selectedSubjects',
    'subs',
    'Subs',
    'Subjects Offered',
    'stream',
    'Stream',
    'subjects1',
    'subjects2',
    'subjects3',
    'subjects4',
    'subjects5',
    'subjects6',
    'Subjects to be taken in Class 12th',
    'Subjects to be taken in Class 11th',
    'Subjects to be taken in Class 10th',
    'Subjects to be taken in Class 9th',
    'Subjects Studied in Class 10th',
    'Subjects Studied in Class 9th'
  ],
  subjects1: ['subjects1', 'Subjects1', 'subject1', 'Subject 1'],
  subjects2: ['subjects2', 'Subjects2', 'subject2', 'Subject 2'],
  subjects3: ['subjects3', 'Subjects3', 'subject3', 'Subject 3'],
  subjects4: ['subjects4', 'Subjects4', 'subject4', 'Subject 4'],
  subjects5: ['subjects5', 'Subjects5', 'subject5', 'Subject 5'],
  subjects6: ['subjects6', 'Subjects6', 'subject6', 'Subject 6', 'Subject6'],
  classRollNo: [
    'classRollNo',
    'rollNo',
    'Class Roll No',
    'Class Roll No.',
    'RL. NO.',
    'RL. NO',
    'Class R.No.',
    'Class R.No'
  ],
  admNo: [
    'admNo',
    'admissionNo',
    'Admission No.',
    'Adm. No.',
    'Admission No'
  ],
  boardRegNo: [
    'boardRegNo',
    'regNo',
    'Board Registration Number',
    'Board Reg. No.',
    'Board Registration No. (Class 11th)',
    'Board Registration No. (Class 10th)',
    'Registration No. (allotted by JKBOSE)',
    'REG. NO.'
  ],
  currExamRollNo: [
    'boardRollNo',
    'currExamRollNo',
    'examRollNo',
    'Exam R.No. (Current)',
    'Exam R. No. (Current)',
    'Board Roll Number',
    'Board Roll No.'
  ],
  currResult: [
    'result',
    'currResult',
    'boardResult',
    'Result (Current)',
    'Board Result',
    'Result'
  ],
  currMarksReapp: [
    'marks',
    'currMarksReapp',
    'totalMarks',
    'Marks/Reapp (Current)',
    'Marks Obtained',
    'Marks'
  ],
  prevExamRollNo: [
    'prevExamRollNo',
    'Exam R.No. (Prev.)',
    'Exam R.no. (Prev.)',
    'Roll No. (Class 10th)'
  ],
  prevMarksObt: [
    'prevMarks',
    'prevMarksObt',
    'Marks Obt. (Prev.)',
    '10th/11th Marks',
    'Marks Obtained (Class 10th)'
  ],
  prevMaxMarks: [
    'prevMaxMarks',
    'Max. Marks (Prev.)',
    'Max Marks (Class 10th)'
  ],
  prevPercentage: [
    'prevPercentage',
    '%age (Prev.)',
    'Percentage (Class 10th)'
  ],
  prevDivision: [
    'prevDivision',
    'Div/Distinc (Prev.)'
  ],
  aadhar: [
    'aadhaarNo',
    'penNo',
    'Aadhaar Number (12 Digits)',
    'Aadhaar Number',
    'Permanent Education Number (PEN)',
    'pen',
    'penNo',
    'PEN No',
    'PEN No.',
    'aadhaar',
    'aadhar'
  ],
  aadhaarNo: [
    'aadhaarNo',
    'Aadhaar Number (12 Digits)',
    'Aadhaar Number',
    'Aadhaar No',
    'aadhaar',
    'aadhar'
  ],
  penNo: [
    'penNo',
    'Permanent Education Number (PEN)',
    'PEN No',
    'PEN No.',
    'pen'
  ],
  fatherAadhar: [
    'fatherAadhar',
    "Father's Aadhar No.",
    "Father's Aadhaar No."
  ],
  apaarId: [
    'apaarId',
    'APAAR ID',
    'apaar'
  ],
  mobile: [
    'phone',
    'mobileNo',
    'Mobile No.',
    'Mobile Number',
    'Mobile No. (with working WhatsApp)',
    'mobile'
  ],
  parentContact: [
    'parentMobile',
    'parentContact',
    "Parent's Contact",
    "Parent's Mobile No.",
    "Parent's Mobile No. (must be working)"
  ],
  village: [
    'address',
    'village',
    'Name of your village',
    'Permanent Address',
    'Village / Town',
    'Village/Town'
  ],
  pinCode: ['pinCode', 'PIN code', 'Pin Code'],
  district: ['district', 'District'],
  tehsil: ['tehsil', 'Tehsil'],
  block: ['block', 'Block'],
  bankAccount: ['bankAccount', 'Bank Account Number', 'Bank Account No.', 'bankAccountNo'],
  bankName: ['bankName', 'Name of the Bank', 'Bank Name']
};

/**
 * Normalizes a field string for loose comparison (lowercased, alphanumeric only).
 */
export const normalizeKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Static Precomputed Maps (Calculated once at module load - zero runtime overhead)
 */
const NORMALIZED_FIELD_MAP = {};
const REVERSE_LOOKUP_MAP = {};

Object.entries(JKBOSE_FIELD_MAPPING).forEach(([colKey, aliases]) => {
  const normAliases = aliases.map(normalizeKey);
  NORMALIZED_FIELD_MAP[colKey] = new Set(normAliases);
  normAliases.forEach(alias => {
    if (!REVERSE_LOOKUP_MAP[alias]) {
      REVERSE_LOOKUP_MAP[alias] = colKey;
    }
  });
  REVERSE_LOOKUP_MAP[normalizeKey(colKey)] = colKey;
});

/**
 * Fast O(1) Student JKBOSE Status Map Generator.
 * Computes all changed fields for a student in a single pass.
 * Returns null if the student has no JKBOSE updates (0 cost for unaffected students).
 *
 * @param {Object} student
 * @param {Object|null} batchTraceabilityMap
 * @returns {Object|null} Map of { [colKey]: statusObj, [subKey]: statusObj }
 */
export function computeStudentJkboseStatusMap(student, batchTraceabilityMap = null) {
  if (!student) return null;

  const hasDirectFields = (Array.isArray(student.jkboseUpdatedFields) && student.jkboseUpdatedFields.length > 0) ||
    (Array.isArray(student.jkbose_updated_fields) && student.jkbose_updated_fields.length > 0);
  const hasDirectUpdates = student.jkboseFieldUpdates && typeof student.jkboseFieldUpdates === 'object' && Object.keys(student.jkboseFieldUpdates).length > 0;
  const hasRecentSync = Boolean(student.lastBoardSyncAt);

  let batchMatch = null;
  if (batchTraceabilityMap && typeof batchTraceabilityMap === 'object') {
    const ids = [
      student.id,
      student.docId,
      student._docId,
      student.formNo,
      student.boardRegNo,
      student.regNo,
      student.classRollNo
    ].filter(Boolean);

    for (const id of ids) {
      if (batchTraceabilityMap[id]) {
        batchMatch = batchTraceabilityMap[id];
        break;
      }
    }
  }

  // Instant fast-exit: If student has no board sync indicators, zero work needed
  if (!hasDirectFields && !hasDirectUpdates && !hasRecentSync && !batchMatch) {
    return null;
  }

  const statusMap = {};

  // 1. Ingest from batch traceability (covers updates done in past hours)
  if (batchMatch && batchMatch.fields) {
    const src = batchMatch.source || 'JKBOSE Board Overwrite';
    const ts = batchMatch.timestamp || '';
    batchMatch.fields.forEach(f => {
      const detail = batchMatch.details?.[f];
      const statusObj = {
        isUpdated: true,
        key: f,
        source: src,
        timestamp: ts,
        oldValue: detail?.oldValue,
        newValue: detail?.newValue,
        label: detail?.label || f
      };
      statusMap[f] = statusObj;
      const canonicalCol = REVERSE_LOOKUP_MAP[normalizeKey(f)];
      if (canonicalCol) {
        statusMap[canonicalCol] = statusObj;
      }
    });
  }

  // 2. Direct fields & updates on document (authoritative, overrides batch)
  const fieldsList = student.jkboseUpdatedFields || student.jkbose_updated_fields || [];
  const fieldUpdates = student.jkboseFieldUpdates || {};
  const directSrc = student.jkboseSyncSource || student.boardSyncSource || 'JKBOSE Board Overwrite';
  const directTs = student.jkboseLastSyncedAt || student.lastBoardSyncAt || '';

  if (Array.isArray(fieldsList)) {
    fieldsList.forEach(f => {
      const detail = fieldUpdates[f];
      const statusObj = {
        isUpdated: true,
        key: f,
        source: detail?.source || directSrc,
        timestamp: detail?.updatedAt || directTs,
        oldValue: detail?.oldValue,
        newValue: detail?.newValue,
        label: detail?.label || f
      };
      statusMap[f] = statusObj;
      const canonicalCol = REVERSE_LOOKUP_MAP[normalizeKey(f)];
      if (canonicalCol) {
        statusMap[canonicalCol] = statusObj;
      }
    });
  }

  if (fieldUpdates && typeof fieldUpdates === 'object') {
    Object.entries(fieldUpdates).forEach(([k, detail]) => {
      const statusObj = {
        isUpdated: true,
        key: k,
        source: detail?.source || directSrc,
        timestamp: detail?.updatedAt || directTs,
        oldValue: detail?.oldValue,
        newValue: detail?.newValue,
        label: detail?.label || k
      };
      statusMap[k] = statusObj;
      const canonicalCol = REVERSE_LOOKUP_MAP[normalizeKey(k)];
      if (canonicalCol) {
        statusMap[canonicalCol] = statusObj;
      }
    });
  }

  // 3. Fallback: if student has boardSyncFields list
  if (Array.isArray(student.boardSyncFields)) {
    student.boardSyncFields.forEach(f => {
      const statusObj = {
        isUpdated: true,
        key: f,
        source: student.boardSyncSource || directSrc,
        timestamp: student.lastBoardSyncAt || directTs,
        label: f
      };
      statusMap[f] = statusObj;
      const canonicalCol = REVERSE_LOOKUP_MAP[normalizeKey(f)];
      if (canonicalCol) {
        statusMap[canonicalCol] = statusObj;
      }
    });
  }

  return Object.keys(statusMap).length > 0 ? statusMap : null;
}

/**
 * Checks if a particular column or sub-property was changed as per JKBOSE data.
 * Optimized with fast-path lookup if student._jkboseStatusMap is precomputed.
 *
 * @param {Object} student - Student record object
 * @param {string} colKey - Column key (e.g., 'studentName', 'dob', 'fatherName', 'subs')
 * @param {string|null} subKey - Optional specific sub-field (e.g., 'fatherName', 'motherName', 'aadhaarNo', 'penNo')
 * @param {Object|null} batchTraceabilityMap - Map from loadRecentJkboseBatchTraceability()
 * @returns {Object|null} - Status object { isUpdated, source, timestamp, oldValue, newValue, label } or null
 */
export function getJkboseFieldStatus(student, colKey, subKey = null, batchTraceabilityMap = null) {
  if (!student) return null;

  // Fast Path 1: Check precomputed status map on student (O(1) instant lookup)
  if (student._jkboseStatusMap) {
    if (subKey) {
      return student._jkboseStatusMap[subKey] || null;
    }
    if (colKey) {
      return student._jkboseStatusMap[colKey] || null;
    }
    return null;
  }

  // Fast Path 2: On-demand single-student compute
  const map = computeStudentJkboseStatusMap(student, batchTraceabilityMap);
  if (!map) return null;

  if (subKey) return map[subKey] || null;
  if (colKey) return map[colKey] || null;
  return null;
}

// In-memory memory cache for batch traceability (expires after 15 mins or on manual refresh)
let _cachedTraceabilityMap = null;
let _lastTraceabilityFetch = 0;
const TRACEABILITY_CACHE_TTL = 15 * 60 * 1000;

/**
 * Hydrates recent JKBOSE batch traceability from Firestore `csvImportBatches`.
 * Cached in-memory so subsequent calls take 0ms and never lag the UI.
 *
 * @param {boolean} forceRefresh - If true, ignores cache and re-queries Firestore
 * @returns {Promise<Object>} Map of candidate identifier -> { fields: Set, details: {}, source, timestamp }
 */
export async function loadRecentJkboseBatchTraceability(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cachedTraceabilityMap && (now - _lastTraceabilityFetch < TRACEABILITY_CACHE_TTL)) {
    return _cachedTraceabilityMap;
  }

  try {
    const q = query(
      collection(db, 'csvImportBatches'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    const traceabilityMap = {};
    const relevantJobs = [];

    snap.forEach(d => {
      const b = d.data();
      const jobName = String(b.fileName || '').toLowerCase();
      const jobReason = String(b.reasonCategory || '').toLowerCase();
      const isBoardRelated = (
        jobName.includes('board') ||
        jobName.includes('jkbose') ||
        jobName.includes('overwrite') ||
        jobName.includes('result') ||
        jobName.includes('10th') ||
        jobName.includes('11th') ||
        jobName.includes('12th') ||
        jobReason.includes('board') ||
        jobReason.includes('verification') ||
        b.kind === 'field-update-v2'
      );

      if (isBoardRelated) {
        relevantJobs.push({ id: d.id, ...b });
      }
    });

    // Limit to the most recent 3 board batches to keep network lightning-fast
    const topJobs = relevantJobs.slice(0, 3);

    await Promise.all(topJobs.map(async (job) => {
      try {
        const entriesSnap = await getDocs(collection(db, 'csvImportBatches', job.id, 'entries'));
        entriesSnap.forEach(eDoc => {
          const entry = eDoc.data();
          const changedFields = new Set();
          const details = {};

          if (entry.after) {
            for (const [k, newVal] of Object.entries(entry.after)) {
              if ([
                'updatedAt', 'lastBoardSyncAt', 'boardSyncSource',
                'lastEditedBy', 'jkboseUpdatedFields', 'jkboseLastSyncedAt',
                'jkboseSyncSource', 'jkboseFieldUpdates'
              ].includes(k)) continue;

              const beforeField = entry.before?.[k];
              const oldVal = beforeField?.value;
              const exists = beforeField?.exists;

              const cleanOld = String(oldVal ?? '').trim();
              const cleanNew = String(newVal ?? '').trim();

              if (!exists || cleanOld !== cleanNew) {
                changedFields.add(k);
                details[k] = {
                  oldValue: cleanOld,
                  newValue: cleanNew,
                  label: k
                };
              }
            }
          }

          if (changedFields.size > 0) {
            const identifiers = [
              entry.locator?.documentId,
              entry.locator?.identity?.form,
              entry.locator?.identity?.reg,
              entry.locator?.identity?.roll
            ].filter(Boolean).map(String);

            identifiers.forEach(id => {
              if (!traceabilityMap[id]) {
                traceabilityMap[id] = {
                  source: job.fileName || 'JKBOSE Board Overwrite',
                  timestamp: job.timestamp || '',
                  fields: new Set(),
                  details: {}
                };
              }
              changedFields.forEach(f => traceabilityMap[id].fields.add(f));
              Object.assign(traceabilityMap[id].details, details);
            });
          }
        });
      } catch (entryErr) {
        console.warn(`Could not read entries for batch ${job.id}:`, entryErr);
      }
    }));

    _cachedTraceabilityMap = traceabilityMap;
    _lastTraceabilityFetch = now;
    return traceabilityMap;
  } catch (err) {
    console.warn('Error hydrating recent JKBOSE batch traceability:', err);
    return _cachedTraceabilityMap || {};
  }
}
