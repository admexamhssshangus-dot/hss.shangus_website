import { doc, getDoc, setDoc, writeBatch, collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';
import { updateCachedItem } from './dbCache';
import * as XLSX from 'xlsx';

const REGISTRY_DOC_PATH = 'systemSettings';
const REGISTRY_DOC_ID = 'certificateRegistry';
const DEFAULT_INITIAL_CERT_NO = 1367;

/** Return the official numeric serial from stored values such as
 * "1368 (26-08-2026)" or "HSS/SHG/TC-DC/1368/2026". */
export function extractCertificateSerial(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text || /^(—|-|n\/?a|null|undefined)$/i.test(text)) return '';
  const match = text.match(/(?:^|\D)(\d{3,6})(?=\D|$)/);
  return match ? String(parseInt(match[1], 10)) : '';
}

/**
 * Fetch current highest issued Certificate Number from Firestore
 */
export async function fetchLastIssuedCertificateNumber() {
  try {
    const regRef = doc(db, REGISTRY_DOC_PATH, REGISTRY_DOC_ID);
    const snap = await getDoc(regRef);

    if (snap.exists()) {
      const data = snap.data();
      const lastNo = parseInt(data.lastIssuedCertNo, 10);
      if (!isNaN(lastNo) && lastNo > 0) {
        return lastNo;
      }
    }

    // Fallback: Scan existing admissions for maximum certificate number
    const admSnap = await getDocs(query(collection(db, 'admissions'), limit(200)));
    let maxFound = DEFAULT_INITIAL_CERT_NO;

    admSnap.forEach(docSnap => {
      const d = docSnap.data();
      const rawCert = d.ccDcNo || d.certificateNo || d['No. & Date of CC/DC Issued (This Institution)'];
      if (rawCert) {
        const serial = extractCertificateSerial(rawCert);
        if (serial) {
          const val = parseInt(serial, 10);
          if (val > maxFound && val < 999999) {
            maxFound = val;
          }
        }
      }
    });

    return maxFound;
  } catch (err) {
    console.warn('Error fetching certificate registry from Firestore:', err);
    return DEFAULT_INITIAL_CERT_NO;
  }
}

/**
 * Persistently commit issued certificate numbers to Firestore
 * Updates systemSettings/certificateRegistry, stamps each student's admissions doc,
 * and appends an entry to documentHistory.
 */
export async function commitIssuedCertificateBatch(issuedStudents = [], issueDate = '') {
  if (!issuedStudents || issuedStudents.length === 0) {
    return { success: true, count: 0 };
  }

  const effectiveDate = issueDate || new Date().toISOString().slice(0, 10);
  const batches = [writeBatch(db)];
  let currentBatch = batches[0];
  let currentBatchSize = 0;
  const cacheUpdates = [];
  const queueSet = (reference, data, options) => {
    if (currentBatchSize >= 450) {
      currentBatch = writeBatch(db);
      batches.push(currentBatch);
      currentBatchSize = 0;
    }
    currentBatch.set(reference, data, options);
    currentBatchSize += 1;
  };
  let maxCertInBatch = 0;
  const masterGroups = new Map();

  issuedStudents.forEach(item => {
    const certNum = parseInt(item.certNo, 10);
    if (!isNaN(certNum) && certNum > maxCertInBatch) {
      maxCertInBatch = certNum;
    }

    const raw = item.student?.raw || item.raw || item.student || item || {};
    const formNo = String(item.formNo || item.id || raw.formNo || raw['Form No.'] || raw['Form Number'] || '').trim();
    const regNo = String(item.student?.regNo || raw.regNo || raw.boardRegNo || raw['Board Registration Number'] || raw['Board Reg. No.'] || '').trim();
    const patch = {
      ccDcNo: String(item.certNo),
      certificateNo: String(item.certNo),
      'No. & Date of CC/DC Issued (This Institution)': `${item.certNo} (${effectiveDate})`,
      dischargeIssuedAt: serverTimestamp(),
      dischargeIssueDate: effectiveDate,
      dischargeCertStatus: 'Issued'
    };
    const parentDocId = raw._parentDocId || item.student?._parentDocId || '';
    const sourceCollection = raw._srcCollection || raw._source || item.student?.sourceCollection || 'admissions';

    if (sourceCollection === 'masterRegisters' && parentDocId) {
      if (!masterGroups.has(parentDocId)) masterGroups.set(parentDocId, []);
      masterGroups.get(parentDocId).push({ formNo, regNo, patch });
    } else if (formNo || regNo) {
      const studentRef = doc(db, sourceCollection === 'masterRegisters' ? 'masterRegisters' : 'admissions', formNo || regNo);
      queueSet(studentRef, patch, { merge: true });
      cacheUpdates.push([sourceCollection === 'masterRegisters' ? 'masterRegisters' : 'admissions', formNo || regNo, patch]);
    }
  });

  // Archived students are packed inside master-register chunk documents. Patch
  // the matching array item instead of creating a misleading admissions record.
  for (const [parentDocId, assignments] of masterGroups.entries()) {
    const parentRef = doc(db, 'masterRegisters', String(parentDocId));
    const parentSnap = await getDoc(parentRef);
    if (!parentSnap.exists()) throw new Error(`Master-register chunk ${parentDocId} was not found.`);
    const parentData = parentSnap.data();
    const arrayKey = ['items', 'students', 'records', 'data'].find(key => Array.isArray(parentData[key]));
    if (!arrayKey) throw new Error(`Master-register chunk ${parentDocId} has no student array.`);
    const normalize = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const updatedRecords = parentData[arrayKey].map(record => {
      const recordForm = normalize(record.formNo || record['Form No.'] || record['Form Number']);
      const recordReg = normalize(record.regNo || record.boardRegNo || record['Board Registration Number'] || record['Board Reg. No.']);
      const assignment = assignments.find(item =>
        (item.regNo && normalize(item.regNo) === recordReg) ||
        (item.formNo && normalize(item.formNo) === recordForm)
      );
      if (!assignment) return record;
      const itemPatch = { ...assignment.patch };
      delete itemPatch.dischargeIssuedAt;
      return { ...record, ...itemPatch, dischargeIssuedAt: effectiveDate };
    });
    queueSet(parentRef, { [arrayKey]: updatedRecords, updatedAt: serverTimestamp() }, { merge: true });
    cacheUpdates.push(['masterRegisters', String(parentDocId), { [arrayKey]: updatedRecords }]);
  }

  // Update registry doc
  if (maxCertInBatch > 0) {
    const regRef = doc(db, REGISTRY_DOC_PATH, REGISTRY_DOC_ID);
    queueSet(regRef, {
      lastIssuedCertNo: maxCertInBatch,
      lastIssuedDate: effectiveDate,
      lastBatchCount: issuedStudents.length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  for (const pendingBatch of batches) {
    await pendingBatch.commit();
  }
  cacheUpdates.forEach(([collectionName, documentId, patch]) => {
    updateCachedItem(collectionName, documentId, patch);
  });

  // Non-blocking audit record in documentHistory
  try {
    await addDoc(collection(db, 'documentHistory'), {
      documentType: 'Discharge / Transfer Certificate (TC/DC)',
      batchSize: issuedStudents.length,
      startCertNo: issuedStudents[0]?.certNo || '',
      endCertNo: issuedStudents[issuedStudents.length - 1]?.certNo || '',
      issueDate: effectiveDate,
      issuedAt: serverTimestamp(),
      studentIds: issuedStudents.map(s => s.formNo || s.id)
    });
  } catch (auditErr) {
    console.warn('Audit history logging note:', auditErr);
  }

  return {
    success: true,
    count: issuedStudents.length,
    lastIssuedCertNo: maxCertInBatch
  };
}

/** Permanently update certificate identity fields in the student's actual
 * admissions document or packed master-register source row. */
export async function persistCertificateStudentFields(student, values = {}) {
  const raw = student?.raw || student || {};
  const usable = value => value !== undefined && value !== null && String(value).trim() !== '';
  const patch = {};
  const setAliases = (value, aliases) => {
    if (!usable(value)) return;
    aliases.forEach(alias => { patch[alias] = String(value).trim(); });
  };

  setAliases(values.studentName, ["Student's Name", 'studentName', 'name']);
  setAliases(values.fatherName, ["Father's Name", 'fatherName', 'father']);
  setAliases(values.motherName, ["Mother's Name", 'motherName', 'mother']);
  setAliases(values.regNo, ['Board Registration Number', 'Board Reg. No.', 'regNo', 'boardRegNo']);
  setAliases(values.admNo, ['Admission Number', 'Admission No.', 'Adm. No.', 'admissionNo', 'admNo']);
  setAliases(values.admDate, ['Date of Admission', 'Admission Date', 'admissionDate', 'admDate']);
  setAliases(values.dob, ['Date of Birth', 'DOB', 'dob']);
  setAliases(values.gender, ['Gender', 'gender']);
  setAliases(values.village, ['Village/Town', 'Village', 'village']);
  setAliases(values.examRollNo, ['Exam R.No. (Current)', 'currExamRoll', 'examRollNo']);
  setAliases(values.examMode, ['Exam Mode (Current)', 'currExamMode', 'examMode']);
  setAliases(values.resultStatus, ['Result (Current)', 'currResult']);
  if (usable(values.marksObtained)) {
    const marksText = `${String(values.marksObtained).trim()} / ${String(values.maxMarks || '500').trim()}`;
    setAliases(marksText, ['Marks/Reapp (Current)', 'currMarksReapp']);
  } else if (usable(values.reappSubjects)) {
    setAliases(values.reappSubjects, ['Marks/Reapp (Current)', 'currMarksReapp', 'reappSubjects']);
  }
  setAliases(values.division, ['Div/Distinc (Current)', 'currDiv', 'division']);
  patch.updatedAt = serverTimestamp();

  const formNo = String(student?.formNo || raw.formNo || raw['Form No.'] || raw['Form Number'] || '').trim();
  const regNo = String(values.regNo || student?.regNo || raw.regNo || raw.boardRegNo || raw['Board Registration Number'] || '').trim();
  const sourceCollection = raw._srcCollection || raw._source || student?.sourceCollection || 'admissions';
  const parentDocId = raw._parentDocId || student?._parentDocId || '';

  if (sourceCollection === 'masterRegisters' && parentDocId) {
    const parentRef = doc(db, 'masterRegisters', String(parentDocId));
    const parentSnap = await getDoc(parentRef);
    if (!parentSnap.exists()) throw new Error(`Master-register chunk ${parentDocId} was not found.`);
    const parentData = parentSnap.data();
    const arrayKey = ['items', 'students', 'records', 'data'].find(key => Array.isArray(parentData[key]));
    if (!arrayKey) throw new Error(`Master-register chunk ${parentDocId} has no student array.`);
    const normalize = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    let matched = false;
    const updatedRecords = parentData[arrayKey].map(record => {
      const recordForm = normalize(record.formNo || record['Form No.'] || record['Form Number']);
      const recordReg = normalize(record.regNo || record.boardRegNo || record['Board Registration Number'] || record['Board Reg. No.']);
      if (!((regNo && normalize(regNo) === recordReg) || (formNo && normalize(formNo) === recordForm))) return record;
      matched = true;
      const itemPatch = { ...patch };
      delete itemPatch.updatedAt;
      return { ...record, ...itemPatch };
    });
    if (!matched) throw new Error('Student was not found in the source master-register chunk.');
    await setDoc(parentRef, { [arrayKey]: updatedRecords, updatedAt: serverTimestamp() }, { merge: true });
    updateCachedItem('masterRegisters', String(parentDocId), { [arrayKey]: updatedRecords });
  } else {
    const docId = formNo || student?.id || regNo;
    if (!docId) throw new Error('Missing Form No. or Registration No. for permanent update.');
    const collectionName = sourceCollection === 'masterRegisters' ? 'masterRegisters' : 'admissions';
    await setDoc(doc(db, collectionName, String(docId)), patch, { merge: true });
    updateCachedItem(collectionName, String(docId), patch);
  }

  return { ...student, ...patch, raw: { ...raw, ...patch } };
}

/**
 * Generate and download official Excel (.xlsx) registry of issued certificates
 */
export function exportCertificateRegistryXlsx(issuedStudents = [], filename = 'TC_DC_Discharge_Certificate_Registry.xlsx') {
  if (!issuedStudents || issuedStudents.length === 0) {
    alert('No student records selected for Excel export.');
    return;
  }

  const exportRows = issuedStudents.map((st, idx) => ({
    'S.No.': idx + 1,
    'Certificate No.': st.certNo ? `#${st.certNo}` : '—',
    'Admission No.': st.admNo || '—',
    'Board Reg. No.': st.regNo || '—',
    'Exam Roll No.': st.examRollNo || '—',
    'Student Name': st.studentName || '—',
    "Father's Name": st.fatherName || '—',
    "Mother's Name": st.motherName || '—',
    'Gender': st.gender || '—',
    'Class': st.className || '12th',
    'Stream': st.stream || '—',
    'Session': st.session || '—',
    'Exam Result Status': st.resultStatus || '—',
    'Marks Obtained': st.marksObtained ? `${st.marksObtained} / ${st.maxMarks || 500}` : '—',
    'Division': st.division || '—',
    'Date of Admission': st.admDate || '—',
    'Withdrawal / Result Date': st.withdrawalDate || '—',
    'Date of Issue': st.issueDate || new Date().toISOString().slice(0, 10)
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Column width auto-fitting
  const colWidths = [
    { wch: 6 },  // S.No
    { wch: 16 }, // Cert No
    { wch: 14 }, // Adm No
    { wch: 22 }, // Reg No
    { wch: 15 }, // Exam Roll
    { wch: 24 }, // Name
    { wch: 24 }, // Father
    { wch: 20 }, // Mother
    { wch: 8 },  // Gender
    { wch: 8 },  // Class
    { wch: 14 }, // Stream
    { wch: 14 }, // Session
    { wch: 16 }, // Result Status
    { wch: 16 }, // Marks
    { wch: 14 }, // Division
    { wch: 16 }, // Adm Date
    { wch: 20 }, // Withdrawal Date
    { wch: 14 }  // Issue Date
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TC-DC Registry');
  XLSX.writeFile(workbook, filename);
}
