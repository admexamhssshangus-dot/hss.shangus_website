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
  const batch = writeBatch(db);
  let maxCertInBatch = 0;

  issuedStudents.forEach(item => {
    const certNum = parseInt(item.certNo, 10);
    if (!isNaN(certNum) && certNum > maxCertInBatch) {
      maxCertInBatch = certNum;
    }

    const formNo = String(item.formNo || item.id || item.raw?.formNo || item.raw?.['Form No.'] || '').trim();
    if (formNo) {
      const studentRef = doc(db, 'admissions', formNo);
      const patch = {
        ccDcNo: String(item.certNo),
        certificateNo: String(item.certNo),
        'No. & Date of CC/DC Issued (This Institution)': `${item.certNo} (${effectiveDate})`,
        dischargeIssuedAt: serverTimestamp(),
        dischargeIssueDate: effectiveDate,
        dischargeCertStatus: 'Issued'
      };

      batch.set(studentRef, patch, { merge: true });
      updateCachedItem('admissions', formNo, patch);
    }
  });

  // Update registry doc
  if (maxCertInBatch > 0) {
    const regRef = doc(db, REGISTRY_DOC_PATH, REGISTRY_DOC_ID);
    batch.set(regRef, {
      lastIssuedCertNo: maxCertInBatch,
      lastIssuedDate: effectiveDate,
      lastBatchCount: issuedStudents.length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();

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
