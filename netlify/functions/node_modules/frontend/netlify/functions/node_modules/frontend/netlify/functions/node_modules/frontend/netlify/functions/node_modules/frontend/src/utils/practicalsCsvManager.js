/**
 * practicalsCsvManager.js
 * Comprehensive CSV Import / Export / Template Management for Practicals Portal
 * Govt. Higher Secondary School Shangus
 */

import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

export const CSV_COLUMNS = [
  'Class',
  'Session',
  'Evaluation Type',
  'Subject Code',
  'Subject Name',
  'Teacher Name',
  'Teacher Email',
  'Board Registration Number',
  'Exam Roll No',
  'Class Roll No',
  'Student Name',
  'Father Name',
  'Stream',
  'Subjects',
  'Practical Marks',
  'Max Marks'
];

export const VALID_SUBJECT_CODES = {
  BO: 'Botany',
  ZO: 'Zoology',
  BI: 'Biology (Botany & Zoology)',
  PH: 'Physics',
  CH: 'Chemistry',
  MA: 'Mathematics',
  UR: 'Urdu',
  ED: 'Education',
  HT: 'History',
  PS: 'Political Science',
  EC: 'Economics',
  ES: 'Environmental Science',
  PD: 'Physical Education',
  HTC: 'Healthcare',
  ITE: 'IT and ITES',
  EN: 'General English'
};

/**
 * Helper to clean and preserve 16-digit (or any length) Registration Numbers as pure text strings.
 * Recovers from scientific notation (e.g. 2.00101E+15) exported by Excel.
 */
export function cleanRegistrationNumber(val) {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  
  // Remove leading/trailing quotes or Excel text formula artifacts (e.g. '2001010001050014 or ="2001010001050014")
  str = str.replace(/^[='"]+/, '').replace(/["']+$/, '').trim();

  // If Excel exported in scientific notation like 2.001010001050014e+15 or 2.00101E+15
  if (/^\d+(\.\d+)?[eE]\+\d+$/i.test(str)) {
    try {
      const parts = str.toLowerCase().split('e+');
      const base = parts[0];
      const exponent = parseInt(parts[1], 10);
      const dotIndex = base.indexOf('.');
      if (dotIndex === -1) {
        str = base + '0'.repeat(exponent);
      } else {
        const decimals = base.substring(dotIndex + 1);
        const integerPart = base.substring(0, dotIndex);
        if (exponent >= decimals.length) {
          str = integerPart + decimals + '0'.repeat(exponent - decimals.length);
        } else {
          str = integerPart + decimals.substring(0, exponent);
        }
      }
    } catch (_) {}
  }
  return str;
}

/**
 * Helper to escape a value for standard CSV formatting.
 */
function escapeCsvCell(val, isTextOnly = false) {
  if (val === undefined || val === null) return '""';
  const str = String(val).trim();
  if (isTextOnly && /^\d{10,}$/.test(str)) {
    // Wrap long numerical strings as explicit text formula so spreadsheet apps never truncate or convert to scientific notation
    return `="${str}"`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generate a standardized blank or sample CSV template for download.
 */
export function generatePracticalsCsvTemplate() {
  const headers = CSV_COLUMNS.map(c => escapeCsvCell(c)).join(',');
  const sampleRows = [
    [
      '11th',
      '2024-25 (Oct-Nov)',
      'internal',
      'BO',
      'Botany',
      'Sheikh Gulfam',
      'socialshiftz@gmail.com',
      '2001010001050014',
      '201003044',
      '1',
      'Aarizoo Kawsar',
      'Kawsar Ahmad Itoo',
      'Science',
      'GE, PH, CH, BI, PD',
      '9',
      '10'
    ],
    [
      '12th',
      '2024-25 (Oct-Nov)',
      'internal',
      'PH',
      'Physics',
      'Sheikh Gulfam',
      'socialshiftz@gmail.com',
      '2001010001050005',
      '301002068',
      '1',
      'Rumysa Bashir',
      'Bashir Ahmad Sofi',
      'Science',
      'GE, PH, CH, BI, PD',
      '10',
      '10'
    ],
    [
      '11th',
      '2024-25 (Oct-Nov)',
      'external',
      'CH',
      'Chemistry',
      'External Examiner',
      'examiner@jkbose.ac.in',
      '2001010001050099',
      '201003099',
      '—',
      'Outside Candidate Example',
      'Parent Name Example',
      'External / Outside',
      'GE, PH, CH',
      '9',
      '10'
    ]
  ];

  const csvBody = [
    headers,
    ...sampleRows.map(row => row.map((cell, idx) => escapeCsvCell(cell, idx === 7 || idx === 8)).join(','))
  ].join('\r\n');
  triggerCsvDownload(csvBody, 'Practicals_Import_Template_HSS_Shangus.csv');
}

/**
 * Export current active student roster prefilled for a given class, session, subject, and evaluation type.
 */
export function exportCurrentRosterToCsv({
  className = '11th',
  session = '2025-26',
  students = [],
  subjectCode = 'BO',
  evaluationType = 'internal',
  teacherName = '',
  teacherEmail = ''
}) {
  const headers = CSV_COLUMNS.map(c => escapeCsvCell(c)).join(',');
  const subName = VALID_SUBJECT_CODES[subjectCode] || subjectCode;

  const rows = students.map((st, idx) => {
    const rawReg = st['Board Registration Number'] || st['Board Reg. No.'] || st.regNo || st.boardRegNo || '';
    const regNo = cleanRegistrationNumber(rawReg);
    const examRoll = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || '').trim();
    const classRoll = String(st['Class Roll No'] || st.classRollNo || st.rollNo || (idx + 1)).trim();
    const name = String(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').trim();
    const father = String(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '').trim();
    const stream = String(st.stream || st.Stream || 'Science').trim();
    const subjects = String(st.subjects || st.Subjects || st.Subs || '').trim();

    return [
      className,
      session,
      evaluationType,
      subjectCode,
      subName,
      teacherName || 'Faculty Member',
      teacherEmail || 'admin@hssshangus.edu',
      regNo,
      examRoll,
      classRoll,
      name,
      father,
      stream,
      subjects,
      '', // Practical marks left blank for teacher entry
      '10' // Default Max marks
    ];
  });

  const csvBody = [
    headers,
    ...rows.map(row => row.map((cell, idx) => escapeCsvCell(cell, idx === 7 || idx === 8)).join(','))
  ].join('\r\n');

  const filename = `Roster_${className}_${subjectCode}_${evaluationType}_${session.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  triggerCsvDownload(csvBody, filename);
}

/**
 * Triggers a browser download for CSV string content.
 */
function triggerCsvDownload(csvString, filename) {
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Standard CSV Line Parser handling quotes, commas, and newlines.
 */
export function parseCsvText(text) {
  const lines = [];
  let row = [];
  let curr = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        curr += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        curr += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(curr.trim());
        curr = '';
      } else if (ch === '\r' || ch === '\n') {
        row.push(curr.trim());
        if (row.some(cell => cell.length > 0)) {
          lines.push(row);
        }
        row = [];
        curr = '';
        if (ch === '\r' && nextCh === '\n') i++;
      } else {
        curr += ch;
      }
    }
  }

  if (curr.length > 0 || row.length > 0) {
    row.push(curr.trim());
    if (row.some(cell => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Parse and validate practicals CSV text, returning grouped Firestore submission documents.
 */
export function parseAndValidatePracticalsCsv(csvText) {
  const rawRows = parseCsvText(csvText);
  if (!rawRows || rawRows.length < 2) {
    return { success: false, error: 'CSV file is empty or missing data rows.' };
  }

  const rawHeaders = rawRows[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  
  // Header matching helper with exact preference and specific primary aliases
  const findColIdx = (primaryAliases, fallbackAliases = []) => {
    let idx = rawHeaders.findIndex(h => primaryAliases.includes(h));
    if (idx !== -1) return idx;
    idx = rawHeaders.findIndex(h => primaryAliases.some(alias => h.includes(alias)));
    if (idx !== -1) return idx;
    idx = rawHeaders.findIndex(h => fallbackAliases.includes(h));
    if (idx !== -1) return idx;
    return rawHeaders.findIndex(h => fallbackAliases.some(alias => h.includes(alias)));
  };

  const colClass = findColIdx(['class', 'classname', 'cls']);
  const colSession = findColIdx(['session', 'academicsession', 'sessiontext', 'sess']);
  const colType = findColIdx(['evaluationtype', 'practicaltype', 'evaltype', 'type']);
  const colSubCode = findColIdx(['subjectcode', 'subcode', 'code']);
  const colSubName = findColIdx(['subjectname', 'subname', 'subjecttitle']);
  const colTeacherName = findColIdx(['teachername', 'facultyname', 'examinername'], ['teacher']);
  const colTeacherEmail = findColIdx(['teacheremail', 'facultyemail'], ['email']);
  const colRegNo = findColIdx(['boardregistrationnumber', 'registrationnumber', 'registrationno', 'regno', 'boardregno', 'boardreg']);
  const colExamRoll = findColIdx(['examrollno', 'examroll', 'examrno', 'boardroll']);
  const colClassRoll = findColIdx(['classrollno', 'classroll', 'classrno'], ['rollno', 'roll']);
  const colStudentName = findColIdx(['studentname', 'candidatename', 'stname', 'student'], ['name']);
  const colFatherName = findColIdx(['fathername', 'parentname', 'parentage', 'guardianname'], ['father']);
  const colStream = findColIdx(['stream', 'selectedstream']);
  const colSubjects = findColIdx(['subjects', 'subs', 'combination']);
  const colMarks = findColIdx(['practicalmarks', 'totalmarks', 'marks', 'mark', 'award']);
  const colMaxMarks = findColIdx(['maxmarks', 'maxmark', 'max']);

  if (colClass === -1 || colSession === -1 || colSubCode === -1 || colMarks === -1) {
    return {
      success: false,
      error: 'CSV is missing mandatory header columns. Required: Class, Session, Subject Code, Practical Marks.'
    };
  }

  const documentsMap = new Map();
  const errors = [];
  let totalRows = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (r.length === 0 || (r.length === 1 && !r[0])) continue;
    totalRows++;

    const rowNum = i + 1;
    let clsRaw = r[colClass] || '11th';
    let cls = clsRaw.toLowerCase().includes('12') ? '12th' : '11th';

    let sess = r[colSession] || '2024-25 (Oct-Nov)';
    let evalType = (colType !== -1 ? r[colType] : 'internal')?.toLowerCase().includes('ext') ? 'external' : 'internal';
    let subCode = (r[colSubCode] || 'XX').toUpperCase().trim();
    let subName = (colSubName !== -1 ? r[colSubName] : '') || VALID_SUBJECT_CODES[subCode] || subCode;

    let teacherName = (colTeacherName !== -1 ? r[colTeacherName] : '') || 'Faculty Member';
    let teacherEmail = (colTeacherEmail !== -1 ? r[colTeacherEmail] : '') || 'admin@hssshangus.edu';

    let rawReg = (colRegNo !== -1 ? r[colRegNo] : '') || '';
    let regNo = cleanRegistrationNumber(rawReg);
    let examRoll = (colExamRoll !== -1 ? r[colExamRoll] : '') || '';
    let classRoll = (colClassRoll !== -1 ? r[colClassRoll] : '') || '';
    let stName = (colStudentName !== -1 ? r[colStudentName] : '') || '';
    let fatherName = (colFatherName !== -1 ? r[colFatherName] : '') || '';
    let stream = (colStream !== -1 ? r[colStream] : '') || (evalType === 'external' ? 'External / Outside' : 'Science');
    let subjects = (colSubjects !== -1 ? r[colSubjects] : '') || '';
    let marksRaw = (r[colMarks] || '').trim().toUpperCase();
    let maxMarks = parseInt((colMaxMarks !== -1 ? r[colMaxMarks] : '10') || '10', 10) || 10;

    if (!stName && !regNo && !examRoll) {
      errors.push(`Row ${rowNum}: Missing student identity (Name, Reg No, or Exam Roll).`);
      continue;
    }

    if (!marksRaw) {
      errors.push(`Row ${rowNum}: Missing practical marks for "${stName || regNo}".`);
      continue;
    }

    // Generate unique Document ID for Class + Subject + EvalType + Session
    const sessSlug = sess.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const docId = `${cls}_${subCode.toLowerCase()}_${evalType}_${sessSlug}`;

    if (!documentsMap.has(docId)) {
      documentsMap.set(docId, {
        id: docId,
        className: cls,
        sessionText: sess,
        practicalType: evalType,
        subjectCode: subCode,
        subjectName: subName,
        teacherName: teacherName,
        teacherEmail: teacherEmail,
        timestamp: new Date().toLocaleString(),
        maxMarks: maxMarks,
        records: []
      });
    }

    const docObj = documentsMap.get(docId);
    docObj.records.push({
      sNo: docObj.records.length + 1,
      classRollNo: classRoll || '—',
      examRollNo: examRoll || '—',
      boardRegNo: regNo || '—',
      name: stName,
      parentName: fatherName,
      stream: stream,
      subjects: subjects,
      practicalMarks: marksRaw,
      totalMarks: marksRaw
    });
  }

  const documents = Array.from(documentsMap.values());
  const previewRecords = [];
  documents.forEach(d => {
    d.records.forEach(r => {
      previewRecords.push({
        ...r,
        className: d.className,
        sessionText: d.sessionText,
        subjectCode: d.subjectCode,
        subjectName: d.subjectName,
        practicalType: d.practicalType,
        maxMarks: d.maxMarks
      });
    });
  });

  return {
    success: true,
    totalRows,
    validRecords: previewRecords.length,
    documentsCount: documents.length,
    documents,
    previewRecords,
    errors
  };
}

/**
 * Batch write parsed CSV practical submission documents into Firestore.
 */
export async function importPracticalsCsvToFirestore(documents, onProgress) {
  if (!documents || documents.length === 0) {
    return { success: false, error: 'No documents to import.' };
  }

  const total = documents.length;
  let completed = 0;

  try {
    for (const docObj of documents) {
      const docRef = doc(db, 'practicalsData', docObj.id);
      const batch = writeBatch(db);
      batch.set(docRef, docObj);
      await batch.commit();

      completed++;
      if (onProgress) {
        onProgress(Math.round((completed / total) * 100));
      }
    }

    return { success: true, count: completed };
  } catch (err) {
    console.error('Firestore batch import error:', err);
    return { success: false, error: err.message };
  }
}
