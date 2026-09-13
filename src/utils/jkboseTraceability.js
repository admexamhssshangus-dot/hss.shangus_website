import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { applyRecordPatch } from '../services/recordMutationService';

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
const normalizeKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Checks if a particular column or sub-property was changed as per JKBOSE data.
 * Supports:
 *  1. Student document's direct `jkboseUpdatedFields` and `jkboseFieldUpdates`
 *  2. In-memory `batchTraceabilityMap` hydrated from recent `csvImportBatches` (covers updates run in the past hours)
 *  3. Fallback to `lastBoardSyncAt` indicators
 *
 * @param {Object} student - Student record object
 * @param {string} colKey - Column key (e.g., 'studentName', 'dob', 'fatherName', 'subs')
 * @param {string|null} subKey - Optional specific sub-field (e.g., 'father', 'mother', 'aadhaar', 'pen')
 * @param {Object|null} batchTraceabilityMap - Map from loadRecentJkboseBatchTraceability()
 * @returns {Object|null} - Status object { isUpdated, source, timestamp, oldValue, newValue, label } or null
 */
export function getJkboseFieldStatus(student, colKey, subKey = null, batchTraceabilityMap = null) {
  if (!student) return null;

  const targetLookupKeys = subKey
    ? (JKBOSE_FIELD_MAPPING[subKey] || [subKey])
    : (JKBOSE_FIELD_MAPPING[colKey] || [colKey]);

  const normTargetSet = new Set(targetLookupKeys.map(normalizeKey));

  // 1. Direct explicit fields array & detailed updates object on student document
  const updatedList = Array.isArray(student.jkboseUpdatedFields)
    ? student.jkboseUpdatedFields
    : (Array.isArray(student.jkbose_updated_fields) ? student.jkbose_updated_fields : null);

  const fieldUpdates = (student.jkboseFieldUpdates && typeof student.jkboseFieldUpdates === 'object')
    ? student.jkboseFieldUpdates
    : null;

  if (updatedList && updatedList.length > 0) {
    for (const rawField of updatedList) {
      if (normTargetSet.has(normalizeKey(rawField))) {
        const detail = fieldUpdates?.[rawField] ||
          Object.values(fieldUpdates || {}).find(v => normalizeKey(v?.key || v?.label) === normalizeKey(rawField));

        return {
          isUpdated: true,
          key: rawField,
          source: detail?.source || student.jkboseSyncSource || student.boardSyncSource || 'JKBOSE Board Sync',
          timestamp: detail?.updatedAt || student.jkboseLastSyncedAt || student.lastBoardSyncAt || '',
          oldValue: detail?.oldValue,
          newValue: detail?.newValue,
          label: detail?.label || colKey
        };
      }
    }
  }

  if (fieldUpdates) {
    for (const [k, detail] of Object.entries(fieldUpdates)) {
      if (normTargetSet.has(normalizeKey(k)) || normTargetSet.has(normalizeKey(detail?.label))) {
        return {
          isUpdated: true,
          key: k,
          source: detail?.source || student.jkboseSyncSource || student.boardSyncSource || 'JKBOSE Board Sync',
          timestamp: detail?.updatedAt || student.jkboseLastSyncedAt || student.lastBoardSyncAt || '',
          oldValue: detail?.oldValue,
          newValue: detail?.newValue,
          label: detail?.label || colKey
        };
      }
    }
  }

  // 2. Check batchTraceabilityMap from recent csvImportBatches (covers updates done in past hour)
  if (batchTraceabilityMap && typeof batchTraceabilityMap === 'object') {
    const candidateIds = [
      student.id,
      student.docId,
      student._docId,
      student.formNo,
      student['Form Number'],
      student.boardRegNo,
      student.regNo,
      student['Board Registration Number'],
      student.classRollNo,
      student.rollNo,
      student['Class Roll No']
    ].filter(Boolean).map(String);

    for (const candId of candidateIds) {
      const match = batchTraceabilityMap[candId];
      if (match && match.fields) {
        for (const field of match.fields) {
          if (normTargetSet.has(normalizeKey(field))) {
            const detail = match.details?.[field];
            return {
              isUpdated: true,
              key: field,
              source: match.source || 'JKBOSE Board Sync',
              timestamp: match.timestamp || '',
              oldValue: detail?.oldValue,
              newValue: detail?.newValue,
              label: detail?.label || colKey
            };
          }
        }
      }
    }
  }

  // 3. Fallback: if student has recent board sync timestamp & boardSyncFields is present
  if (student.lastBoardSyncAt && Array.isArray(student.boardSyncFields)) {
    for (const f of student.boardSyncFields) {
      if (normTargetSet.has(normalizeKey(f))) {
        return {
          isUpdated: true,
          key: f,
          source: student.boardSyncSource || 'JKBOSE Board Sync',
          timestamp: student.lastBoardSyncAt || '',
          label: colKey
        };
      }
    }
  }

  return null;
}

/**
 * Hydrates recent JKBOSE batch traceability from Firestore `csvImportBatches`.
 * This enables full retro-traceability for bulk overwrites executed within the past hours,
 * extracting exact before-and-after differences per candidate.
 *
 * @returns {Promise<Object>} Map of candidate identifier -> { fields: Set, details: {}, source, timestamp }
 */
export async function loadRecentJkboseBatchTraceability() {
  try {
    const q = query(
      collection(db, 'csvImportBatches'),
      orderBy('timestamp', 'desc'),
      limit(15)
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

    for (const job of relevantJobs) {
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
    }

    return traceabilityMap;
  } catch (err) {
    console.warn('Error hydrating recent JKBOSE batch traceability:', err);
    return {};
  }
}

/**
 * Background utility to backfill `jkboseUpdatedFields` and `jkboseFieldUpdates`
 * directly onto student Firestore documents if they were part of a recent batch
 * but do not yet have the persistent tag.
 *
 * @param {Array} studentsList - Array of student records
 * @param {Object} batchMap - Traceability map from loadRecentJkboseBatchTraceability
 */
export async function backfillRecentJkboseBatchTraceability(studentsList, batchMap) {
  if (!Array.isArray(studentsList) || !batchMap || Object.keys(batchMap).length === 0) return;

  const toBackfill = [];

  for (const st of studentsList) {
    if (st.jkboseUpdatedFields && st.jkboseUpdatedFields.length > 0) continue;

    const candidateIds = [
      st.id,
      st.docId,
      st._docId,
      st.formNo,
      st.boardRegNo,
      st.regNo,
      st.classRollNo
    ].filter(Boolean).map(String);

    for (const candId of candidateIds) {
      const match = batchMap[candId];
      if (match && match.fields && match.fields.size > 0) {
        toBackfill.push({
          student: st,
          fields: Array.from(match.fields),
          details: match.details,
          source: match.source,
          timestamp: match.timestamp
        });
        break;
      }
    }
  }

  if (toBackfill.length === 0) return;

  console.log(`[Traceability] Found ${toBackfill.length} recent candidates to backfill JKBOSE metadata.`);

  // Process quietly in background
  for (const item of toBackfill) {
    try {
      const patch = {
        jkboseUpdatedFields: item.fields,
        jkboseFieldUpdates: item.details || {},
        jkboseLastSyncedAt: item.timestamp || new Date().toISOString(),
        jkboseSyncSource: item.source || 'JKBOSE Board Overwrite',
        lastBoardSyncAt: item.timestamp || new Date().toISOString(),
        boardSyncSource: item.source || 'JKBOSE Board Overwrite'
      };
      await applyRecordPatch(item.student, patch, { force: true });
    } catch (err) {
      console.warn(`[Traceability] Silent backfill skipped for ${item.student?.studentName || item.student?.id}:`, err?.message);
    }
  }
}
