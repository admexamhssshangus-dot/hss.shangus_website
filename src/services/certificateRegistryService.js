import { doc, getDoc, setDoc, writeBatch, collection, addDoc, serverTimestamp, getDocs, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { updateCachedItem } from './dbCache';
import * as XLSX from 'xlsx';

const REGISTRY_DOC_PATH = 'systemSettings';
const REGISTRY_DOC_ID = 'certificateRegistry';
const CERTIFICATE_LOCK_COLLECTION = 'certificateNumberLocks';
const DEFAULT_INITIAL_CERT_NO = 1367;

export function normalizeCertificateIssueDate(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const toIsoIfValid = (year, month, day) => {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const candidate = new Date(Date.UTC(y, m - 1, d));
    if (candidate.getUTCFullYear() !== y || candidate.getUTCMonth() !== m - 1 || candidate.getUTCDate() !== d) return fallback;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return toIsoIfValid(isoMatch[1], isoMatch[2], isoMatch[3]);
  const dayFirstMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirstMatch) return toIsoIfValid(dayFirstMatch[3], dayFirstMatch[2], dayFirstMatch[1]);
  return fallback;
}

export function validateCertificateAssignments(issuedStudents = []) {
  const serials = issuedStudents.map(item => extractCertificateSerial(item?.certNo));
  if (serials.some(serial => !serial)) {
    throw new Error('Every certificate assignment must have a valid positive serial number.');
  }
  const unique = new Set(serials);
  if (unique.size !== serials.length) {
    throw new Error('Duplicate certificate serial numbers were found in this assignment batch.');
  }
  return serials.map(Number);
}

/** Return the official numeric serial from stored values such as
 * "1368 (26-08-2026)", "875; 03-08-2024", "1050", or "HSS/SHG/TC-DC/1368/2026". */
export function extractCertificateSerial(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text || /^(—|-|n\/?a|null|undefined|none|0|reap|fail|failed|pass|passed|awaiting|awaiting result|in-course)$/i.test(text)) return '';

  if (/^\d{1,6}$/.test(text)) {
    const n = parseInt(text, 10);
    return n > 0 ? String(n) : '';
  }

  let stripped = text.replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ' ');
  stripped = stripped.replace(/[/(](?:19|20)\d{2}[/)]?/g, ' ');

  const match = stripped.match(/(?:^|\D)(\d{1,6})(?=\D|$)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num > 0) return String(num);
  }

  const allNums = Array.from(text.matchAll(/\b(\d{1,6})\b/g)).map(m => parseInt(m[1], 10)).filter(n => n > 0);
  if (allNums.length === 1) {
    return String(allNums[0]);
  }
  if (allNums.length > 1) {
    const nonYear = allNums.find(n => n < 1900 || n > 2099);
    if (nonYear) return String(nonYear);
    return String(allNums[0]);
  }

  return '';
}

const normalizeIdentityKey = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const isSessionMatch = (s1, s2) => {
  if (!s1 || !s2) return true;
  const n1 = normalizeIdentityKey(s1);
  const n2 = normalizeIdentityKey(s2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
};

const isClassMatch = (c1, c2) => {
  if (!c1 || !c2) return true;
  const n1 = normalizeIdentityKey(c1);
  const n2 = normalizeIdentityKey(c2);
  if (n1 === n2) return true;
  for (const grade of ['12', '11', '10', '9']) {
    if (n1.includes(grade) && n2.includes(grade)) return true;
    if (n1.includes(grade) !== n2.includes(grade)) return false;
  }
  return true;
};

const isDuplicateIssue = item => String(item?.issueKind || '').toLowerCase() === 'duplicate';

const buildCertificateIssuePatch = (existingData, assignment, effectiveDate) => {
  const existingHistory = Array.isArray(existingData?.certificateIssueHistory)
    ? existingData.certificateIssueHistory.filter(entry => entry && typeof entry === 'object')
    : [];
  const previousSerial = extractCertificateSerial(
    assignment.previousCertificateNo || existingData?.ccDcNo || existingData?.certificateNo || existingData?.['No. & Date of CC/DC Issued (This Institution)']
  );
  const nextSerial = extractCertificateSerial(assignment.certNo);
  const history = [...existingHistory];
  if (previousSerial && !history.some(entry => extractCertificateSerial(entry.certificateNo) === previousSerial)) {
    history.push({
      certificateNo: previousSerial,
      issueDate: existingData?.dischargeIssueDate || '',
      issueKind: existingData?.lastCertificateIssueKind || 'Original'
    });
  }
  if (!history.some(entry => extractCertificateSerial(entry.certificateNo) === nextSerial)) {
    history.push({
      certificateNo: nextSerial,
      issueDate: effectiveDate,
      issueKind: isDuplicateIssue(assignment) ? 'Duplicate' : 'Original',
      duplicateOfCertificateNo: isDuplicateIssue(assignment) ? previousSerial : ''
    });
  }
  return {
    ...assignment.patch,
    dischargeCertStatus: isDuplicateIssue(assignment) ? 'Issued (Duplicate)' : 'Issued',
    lastCertificateIssueKind: isDuplicateIssue(assignment) ? 'Duplicate' : 'Original',
    duplicateOfCertificateNo: isDuplicateIssue(assignment) ? previousSerial : '',
    certificateIssueHistory: history
  };
};

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

    // Registry recovery is rare, but it must scan all possible sources. A
    // limited unordered sample can miss the true maximum and create duplicates.
    const [admSnap, masterSnap] = await Promise.all([
      getDocs(collection(db, 'admissions')),
      getDocs(collection(db, 'masterRegisters'))
    ]);
    let maxFound = DEFAULT_INITIAL_CERT_NO;

    [admSnap, masterSnap].forEach(snapshot => {
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const records = ['items', 'students', 'records', 'data']
          .map(key => data[key])
          .find(Array.isArray) || [data];
        records.forEach(record => {
          const rawCert = record.ccDcNo || record.certificateNo || record['No. & Date of CC/DC Issued (This Institution)'];
          const serial = extractCertificateSerial(rawCert);
          if (serial) {
            const val = parseInt(serial, 10);
            if (val > maxFound && val < 999999) maxFound = val;
          }
        });
      });
    });

    return maxFound;
  } catch (err) {
    console.error('Error fetching certificate registry from Firestore:', err);
    throw new Error('Certificate registry could not be verified. No certificate number was assigned.');
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

  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const normalizedRequestedDate = normalizeCertificateIssueDate(issueDate);
  if (issueDate && !normalizedRequestedDate) {
    throw new Error('Issue date must be a valid YYYY-MM-DD or DD-MM-YYYY date.');
  }
  const effectiveDate = normalizedRequestedDate || localToday;
  const serials = validateCertificateAssignments(issuedStudents);
  const verifiedLastIssued = await fetchLastIssuedCertificateNumber();
  const cacheUpdates = [];
  const maxCertInBatch = Math.max(...serials);
  const minCertInBatch = Math.min(...serials);
  const masterGroups = new Map();
  const admissionAssignments = [];
  const lockAssignments = [];
  const targetKeys = new Set();

  issuedStudents.forEach(item => {
    const raw = item.student?.raw || item.raw || item.student || item || {};
    const formNo = String(item.formNo || raw.formNo || raw['Form No.'] || raw['Form Number'] || '').trim();
    const regNo = String(item.student?.regNo || raw.regNo || raw.boardRegNo || raw['Board Registration Number'] || raw['Board Reg. No.'] || '').trim();
    const regKey = normalizeIdentityKey(regNo);
    if (!regKey) {
      throw new Error('Every TC/CC certificate must be locked to a valid registration number. No certificate numbers were assigned.');
    }
    const session = String(item.student?.session || item.session || raw.session || raw.Session || raw['Session'] || '').trim();
    const className = String(item.student?.className || item.className || item.class || raw.class || raw.Class || raw['Class'] || raw.selectedClass || '').trim();
    const certNo = extractCertificateSerial(item.certNo);
    const issueKind = isDuplicateIssue(item) ? 'Duplicate' : 'Original';
    const previousCertificateNo = extractCertificateSerial(item.previousCertificateNo);
    if (issueKind === 'Duplicate' && !previousCertificateNo) {
      throw new Error('A duplicate TC/CC requires the previously locked certificate number.');
    }
    const patch = {
      ccDcNo: certNo,
      certificateNo: certNo,
      'No. & Date of CC/DC Issued (This Institution)': `${certNo} (${effectiveDate})`,
      dischargeIssuedAt: serverTimestamp(),
      dischargeIssueDate: effectiveDate,
      dischargeCertStatus: 'Issued'
    };
    const parentDocId = raw._parentDocId || item.student?._parentDocId || '';
    const sourceCollection = raw._srcCollection || raw._source || item.student?.sourceCollection || (parentDocId ? 'masterRegisters' : 'admissions');
    const studentDocId = String(raw._docId || raw.docId || raw.id || '').trim() ||
      (formNo ? (formNo.startsWith('adm_') ? formNo : `adm_${formNo}`) : regNo);

    if (sourceCollection === 'masterRegisters' && parentDocId) {
      if (!masterGroups.has(parentDocId)) masterGroups.set(parentDocId, []);
      masterGroups.get(parentDocId).push({ formNo, regNo, regKey, session, className, certNo, issueKind, previousCertificateNo, patch });
    } else if (studentDocId) {
      admissionAssignments.push({ studentDocId, regNo, regKey, session, className, certNo, issueKind, previousCertificateNo, patch });
    } else {
      throw new Error('A selected student has no source document or form number. No certificate numbers were assigned.');
    }
    lockAssignments.push({ certNo, regNo, regKey, session, className, issueKind, previousCertificateNo, studentDocId, parentDocId });
  });

  admissionAssignments.forEach(({ studentDocId }) => {
    const targetKey = `admissions/${studentDocId}`;
    if (targetKeys.has(targetKey)) throw new Error('The same student was included more than once in the certificate batch.');
    targetKeys.add(targetKey);
  });
  masterGroups.forEach((assignments, parentDocId) => {
    assignments.forEach(item => {
      const identity = normalizeIdentityKey(item.regNo) || normalizeIdentityKey(item.formNo);
      const targetKey = `masterRegisters/${parentDocId}/${identity}/${normalizeIdentityKey(item.session)}/${normalizeIdentityKey(item.className)}`;
      if (!identity) throw new Error('An archived student has no registration or form number. No certificate numbers were assigned.');
      if (targetKeys.has(targetKey)) throw new Error('The same archived student was included more than once in the certificate batch.');
      targetKeys.add(targetKey);
    });
  });

  // Reserve the serial range and stamp every student in one transaction. This
  // prevents overlapping issuers and avoids half-issued certificates when a
  // later student write fails.
  const regRef = doc(db, REGISTRY_DOC_PATH, REGISTRY_DOC_ID);
  await runTransaction(db, async transaction => {
    const registrySnapshot = await transaction.get(regRef);
    const admissionSnapshots = await Promise.all(admissionAssignments.map(async assignment => ({
      ...assignment,
      ref: doc(db, 'admissions', assignment.studentDocId),
      snapshot: await transaction.get(doc(db, 'admissions', assignment.studentDocId))
    })));
    const masterSnapshots = await Promise.all(Array.from(masterGroups.keys()).map(async parentDocId => ({
      parentDocId,
      ref: doc(db, 'masterRegisters', String(parentDocId)),
      snapshot: await transaction.get(doc(db, 'masterRegisters', String(parentDocId)))
    })));
    const lockSnapshots = await Promise.all(lockAssignments.map(async assignment => {
      const ref = doc(db, CERTIFICATE_LOCK_COLLECTION, assignment.certNo);
      return { ...assignment, ref, snapshot: await transaction.get(ref) };
    }));
    const previousLockSnapshots = await Promise.all(lockAssignments
      .filter(assignment => assignment.issueKind === 'Duplicate' && assignment.previousCertificateNo)
      .map(async assignment => {
        const ref = doc(db, CERTIFICATE_LOCK_COLLECTION, assignment.previousCertificateNo);
        return { ...assignment, ref, snapshot: await transaction.get(ref) };
      }));
    const currentLast = registrySnapshot.exists()
      ? (parseInt(registrySnapshot.data()?.lastIssuedCertNo, 10) || DEFAULT_INITIAL_CERT_NO)
      : verifiedLastIssued;
    if (minCertInBatch <= currentLast) {
      throw new Error(`Certificate serial conflict: the registry is already at ${currentLast}. Refresh and assign from ${currentLast + 1}.`);
    }
    lockSnapshots.forEach(({ certNo, snapshot }) => {
      if (snapshot.exists()) {
        const owner = snapshot.data()?.regNo || snapshot.data()?.regKey || 'another registration number';
        throw new Error(`Certificate #${certNo} is already locked to ${owner}.`);
      }
    });
    previousLockSnapshots.forEach(({ previousCertificateNo, regKey, snapshot }) => {
      if (snapshot.exists() && snapshot.data()?.regKey !== regKey) {
        const owner = snapshot.data()?.regNo || snapshot.data()?.regKey || 'another registration number';
        throw new Error(`Previous certificate #${previousCertificateNo} is locked to ${owner}, not this registration number.`);
      }
    });

    cacheUpdates.length = 0;
    admissionSnapshots.forEach((assignment) => {
      const { studentDocId, ref, snapshot } = assignment;
      if (!snapshot.exists()) {
        throw new Error(`Student record ${studentDocId} was not found. No certificate numbers were assigned.`);
      }
      const existingSerial = extractCertificateSerial(snapshot.data()?.ccDcNo || snapshot.data()?.certificateNo || snapshot.data()?.['No. & Date of CC/DC Issued (This Institution)']);
      if (existingSerial && !isDuplicateIssue(assignment)) {
        throw new Error(`Student record ${studentDocId} already has certificate #${existingSerial}. Refresh before issuing again.`);
      }
      if (existingSerial && existingSerial !== assignment.previousCertificateNo) {
        throw new Error(`Student record ${studentDocId} now has certificate #${existingSerial}; duplicate issuance expected #${assignment.previousCertificateNo}. Refresh first.`);
      }
      const finalPatch = buildCertificateIssuePatch(snapshot.data(), assignment, effectiveDate);
      transaction.set(ref, finalPatch, { merge: true });
      cacheUpdates.push(['admissions', studentDocId, finalPatch]);
    });

    masterSnapshots.forEach(({ parentDocId, ref, snapshot }) => {
      if (!snapshot.exists()) throw new Error(`Master-register chunk ${parentDocId} was not found.`);
      const parentData = snapshot.data();
      const arrayKey = ['items', 'students', 'records', 'data'].find(key => Array.isArray(parentData[key]));
      if (!arrayKey) throw new Error(`Master-register chunk ${parentDocId} has no student array.`);
      const assignments = masterGroups.get(parentDocId);
      const matchedAssignments = new Set();
      const updatedRecords = parentData[arrayKey].map(record => {
        const recordForm = normalizeIdentityKey(record.formNo || record['Form No.'] || record['Form Number']);
        const recordReg = normalizeIdentityKey(record.regNo || record.boardRegNo || record['Board Registration Number'] || record['Board Reg. No.']);
        const recordSession = record.session || record.Session || record['Session'] || parentData.session || '';
        const recordClass = record.class || record.Class || record['Class'] || record.selectedClass || parentData.selectedClass || '';
        const assignmentIndex = assignments.findIndex((item, index) => {
          if (matchedAssignments.has(index)) return false;
          const regMatches = item.regNo && normalizeIdentityKey(item.regNo) === recordReg;
          const formMatches = item.formNo && normalizeIdentityKey(item.formNo) === recordForm;
          return (regMatches || formMatches) && isSessionMatch(item.session, recordSession) && isClassMatch(item.className, recordClass);
        });
        if (assignmentIndex < 0) return record;
        const existingSerial = extractCertificateSerial(record.ccDcNo || record.certificateNo || record['No. & Date of CC/DC Issued (This Institution)']);
        const assignment = assignments[assignmentIndex];
        if (existingSerial && !isDuplicateIssue(assignment)) {
          throw new Error(`An archived student already has certificate #${existingSerial}. Refresh before issuing again.`);
        }
        if (existingSerial && existingSerial !== assignment.previousCertificateNo) {
          throw new Error(`An archived student now has certificate #${existingSerial}; duplicate issuance expected #${assignment.previousCertificateNo}. Refresh first.`);
        }
        matchedAssignments.add(assignmentIndex);
        const itemPatch = buildCertificateIssuePatch(record, assignment, effectiveDate);
        delete itemPatch.dischargeIssuedAt;
        return { ...record, ...itemPatch, dischargeIssuedAt: effectiveDate };
      });
      if (matchedAssignments.size !== assignments.length) {
        throw new Error(`One or more students were not found in master-register chunk ${parentDocId}. No certificate numbers were assigned.`);
      }
      transaction.set(ref, { [arrayKey]: updatedRecords, updatedAt: serverTimestamp() }, { merge: true });
      cacheUpdates.push(['masterRegisters', String(parentDocId), { [arrayKey]: updatedRecords }]);
    });

    lockSnapshots.forEach(({ certNo, regNo, regKey, session, className, issueKind, previousCertificateNo, studentDocId, parentDocId, ref }) => {
      transaction.set(ref, {
        certificateNo: certNo,
        regNo,
        regKey,
        status: 'Active',
        issueKind,
        previousCertificateNo: previousCertificateNo || '',
        session,
        className,
        sourceDocument: parentDocId ? `masterRegisters/${parentDocId}` : `admissions/${studentDocId}`,
        issueDate: effectiveDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    previousLockSnapshots.forEach(({ previousCertificateNo, regNo, regKey, session, className, studentDocId, parentDocId, ref, snapshot }) => {
      if (snapshot.exists()) return;
      transaction.set(ref, {
        certificateNo: previousCertificateNo,
        regNo,
        regKey,
        status: 'Active',
        issueKind: 'Original',
        previousCertificateNo: '',
        session,
        className,
        sourceDocument: parentDocId ? `masterRegisters/${parentDocId}` : `admissions/${studentDocId}`,
        issueDate: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    transaction.set(regRef, {
      lastIssuedCertNo: maxCertInBatch,
      lastIssuedDate: effectiveDate,
      lastBatchCount: issuedStudents.length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
  cacheUpdates.forEach(([collectionName, documentId, patch]) => {
    updateCachedItem(collectionName, documentId, patch);
  });

  // Non-blocking audit record in documentHistory
  try {
    await addDoc(collection(db, 'documentHistory'), {
      documentType: 'Discharge / Transfer Certificate (TC/DC)',
      batchSize: issuedStudents.length,
      startCertNo: minCertInBatch,
      endCertNo: maxCertInBatch,
      issueDate: effectiveDate,
      issuedAt: serverTimestamp(),
      studentIds: issuedStudents.map(s => s.formNo || s.id),
      assignments: issuedStudents.map(item => ({
        certificateNo: extractCertificateSerial(item.certNo),
        regNo: item.student?.regNo || item.regNo || '',
        issueKind: isDuplicateIssue(item) ? 'Duplicate' : 'Original',
        previousCertificateNo: extractCertificateSerial(item.previousCertificateNo)
      }))
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

/**
 * Revoke issued certificate assignments for one or more students.
 * Registry serials remain retired so an official number is never reused.
 * Clears ccDcNo, certificateNo, 'No. & Date of CC/DC Issued (This Institution)', dischargeCertStatus, etc.
 * Supports both admissions and chunked masterRegisters records.
 */
export async function revokeCertificateNumberBatch(studentsToRevoke = []) {
  if (!studentsToRevoke || studentsToRevoke.length === 0) {
    return { success: true, count: 0 };
  }

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

  const masterGroups = new Map();
  const revokedCerts = [];

  studentsToRevoke.forEach(item => {
    const raw = item.student?.raw || item.raw || item.student || item || {};
    const formNo = String(item.formNo || item.id || raw.formNo || raw['Form No.'] || raw['Form Number'] || '').trim();
    const regNo = String(item.student?.regNo || raw.regNo || raw.boardRegNo || raw['Board Registration Number'] || raw['Board Reg. No.'] || '').trim();
    const session = String(item.student?.session || item.session || raw.session || raw.Session || raw['Session'] || '').trim();
    const className = String(item.student?.className || item.className || item.class || raw.class || raw.Class || raw['Class'] || raw.selectedClass || '').trim();
    const certNo = String(item.certNo || item.certificateNo || raw.ccDcNo || raw.certificateNo || '').trim();
    if (certNo) revokedCerts.push(certNo);

    const patch = {
      ccDcNo: '',
      certificateNo: '',
      'No. & Date of CC/DC Issued (This Institution)': '',
      dischargeCertStatus: 'Revoked',
      dischargeIssueDate: '',
      dischargeRevokedAt: serverTimestamp()
    };

    const parentDocId = raw._parentDocId || item.student?._parentDocId || '';
    const sourceCollection = raw._srcCollection || raw._source || item.student?.sourceCollection || (parentDocId ? 'masterRegisters' : 'admissions');
    const studentDocId = String(raw._docId || raw.docId || raw.id || '').trim() ||
      (formNo ? (formNo.startsWith('adm_') ? formNo : `adm_${formNo}`) : regNo);

    if (sourceCollection === 'masterRegisters' && parentDocId) {
      if (!masterGroups.has(parentDocId)) masterGroups.set(parentDocId, []);
      masterGroups.get(parentDocId).push({ formNo, regNo, session, className, patch });
    } else if (studentDocId) {
      const studentRef = doc(db, sourceCollection === 'masterRegisters' ? 'masterRegisters' : 'admissions', studentDocId);
      queueSet(studentRef, patch, { merge: true });
      cacheUpdates.push([sourceCollection === 'masterRegisters' ? 'masterRegisters' : 'admissions', studentDocId, patch]);
    }

    const serial = extractCertificateSerial(certNo);
    const regKey = normalizeIdentityKey(regNo);
    if (serial && regKey) {
      queueSet(doc(db, CERTIFICATE_LOCK_COLLECTION, serial), {
        certificateNo: serial,
        regNo,
        regKey,
        status: 'Revoked',
        session,
        className,
        sourceDocument: parentDocId ? `masterRegisters/${parentDocId}` : `admissions/${studentDocId}`,
        updatedAt: serverTimestamp(),
        revokedAt: serverTimestamp()
      }, { merge: true });
    }
  });

  // Handle masterRegisters chunks using regNo/formNo along with session and class
  for (const [parentDocId, assignments] of masterGroups.entries()) {
    const parentRef = doc(db, 'masterRegisters', String(parentDocId));
    const parentSnap = await getDoc(parentRef);
    if (!parentSnap.exists()) continue;
    const parentData = parentSnap.data();
    const arrayKey = ['items', 'students', 'records', 'data'].find(key => Array.isArray(parentData[key]));
    if (!arrayKey) continue;
    const updatedRecords = parentData[arrayKey].map(record => {
      const recordForm = normalizeIdentityKey(record.formNo || record['Form No.'] || record['Form Number']);
      const recordReg = normalizeIdentityKey(record.regNo || record.boardRegNo || record['Board Registration Number'] || record['Board Reg. No.']);
      const recordSession = record.session || record.Session || record['Session'] || parentData.session || '';
      const recordClass = record.class || record.Class || record['Class'] || record.selectedClass || parentData.selectedClass || '';

      const assignment = assignments.find(item => {
        const regMatches = item.regNo && normalizeIdentityKey(item.regNo) === recordReg;
        const formMatches = item.formNo && normalizeIdentityKey(item.formNo) === recordForm;
        if (!regMatches && !formMatches) return false;
        if (!isSessionMatch(item.session, recordSession)) return false;
        if (!isClassMatch(item.className, recordClass)) return false;
        return true;
      });
      if (!assignment) return record;
      const itemPatch = { ...assignment.patch };
      delete itemPatch.dischargeRevokedAt;
      return { ...record, ...itemPatch, dischargeRevokedAt: new Date().toISOString() };
    });
    queueSet(parentRef, { [arrayKey]: updatedRecords, updatedAt: serverTimestamp() }, { merge: true });
    cacheUpdates.push(['masterRegisters', String(parentDocId), { [arrayKey]: updatedRecords }]);
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
      documentType: 'Discharge / Transfer Certificate (TC/DC) Revocation',
      actionType: 'Revoked',
      batchSize: studentsToRevoke.length,
      revokedCertificates: revokedCerts,
      revokedAt: serverTimestamp(),
      studentIds: studentsToRevoke.map(s => s.formNo || s.id || s.regNo)
    });
  } catch (auditErr) {
    console.warn('Audit history revocation logging note:', auditErr);
  }

  return {
    success: true,
    count: studentsToRevoke.length,
    revokedCertificates: revokedCerts
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
  const session = String(student?.session || raw.session || raw.Session || raw['Session'] || '').trim();
  const className = String(student?.className || student?.class || raw.class || raw.Class || raw['Class'] || raw.selectedClass || '').trim();
  const sourceCollection = raw._srcCollection || raw._source || student?.sourceCollection || 'admissions';
  const parentDocId = raw._parentDocId || student?._parentDocId || '';

  if (sourceCollection === 'masterRegisters' && parentDocId) {
    const parentRef = doc(db, 'masterRegisters', String(parentDocId));
    const parentSnap = await getDoc(parentRef);
    if (!parentSnap.exists()) throw new Error(`Master-register chunk ${parentDocId} was not found.`);
    const parentData = parentSnap.data();
    const arrayKey = ['items', 'students', 'records', 'data'].find(key => Array.isArray(parentData[key]));
    if (!arrayKey) throw new Error(`Master-register chunk ${parentDocId} has no student array.`);
    let matched = false;
    const updatedRecords = parentData[arrayKey].map(record => {
      const recordForm = normalizeIdentityKey(record.formNo || record['Form No.'] || record['Form Number']);
      const recordReg = normalizeIdentityKey(record.regNo || record.boardRegNo || record['Board Registration Number'] || record['Board Reg. No.']);
      const recordSession = record.session || record.Session || record['Session'] || parentData.session || '';
      const recordClass = record.class || record.Class || record['Class'] || record.selectedClass || parentData.selectedClass || '';

      const regMatches = regNo && normalizeIdentityKey(regNo) === recordReg;
      const formMatches = formNo && normalizeIdentityKey(formNo) === recordForm;
      if (!regMatches && !formMatches) return record;
      if (!isSessionMatch(session, recordSession)) return record;
      if (!isClassMatch(className, recordClass)) return record;

      matched = true;
      const itemPatch = { ...patch };
      delete itemPatch.updatedAt;
      return { ...record, ...itemPatch };
    });
    if (!matched) throw new Error('Student was not found in the source master-register chunk.');
    await setDoc(parentRef, { [arrayKey]: updatedRecords, updatedAt: serverTimestamp() }, { merge: true });
    updateCachedItem('masterRegisters', String(parentDocId), { [arrayKey]: updatedRecords });
  } else {
    const docId = raw._docId || raw.docId || raw.id || student?._docId || student?.docId || student?.id || formNo || regNo;
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
