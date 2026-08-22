/**
 * practicalsCsvManager.js
 * Comprehensive Excel & Spreadsheet Import / Export / Template Management for Practicals Portal
 * Govt. Higher Secondary School Shangus
 */

import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';

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

export const EXCEL_COLUMNS = CSV_COLUMNS;

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
 * Trigger file download from Blob
 */
function downloadFileBlob(blob, filename) {
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
 * Generate a standardized blank or sample Excel (.xlsx) template for download.
 * Formats all columns as text ('@') to guarantee 16-digit Reg numbers never convert to scientific notation.
 */
export function generatePracticalsExcelTemplate() {
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

  const aoaData = [EXCEL_COLUMNS, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Force ALL cells to explicit Text format ('@')
  Object.keys(ws).forEach((cellKey) => {
    if (cellKey.startsWith('!')) return;
    const cell = ws[cellKey];
    if (cell) {
      cell.t = 's';
      cell.v = String(cell.v || '');
      cell.w = String(cell.v || '');
      cell.z = '@';
    }
  });

  // Column width styling
  ws['!cols'] = [
    { wch: 10 }, // Class
    { wch: 20 }, // Session
    { wch: 16 }, // Evaluation Type
    { wch: 14 }, // Subject Code
    { wch: 22 }, // Subject Name
    { wch: 22 }, // Teacher Name
    { wch: 26 }, // Teacher Email
    { wch: 26 }, // Board Registration Number
    { wch: 16 }, // Exam Roll No
    { wch: 14 }, // Class Roll No
    { wch: 26 }, // Student Name
    { wch: 26 }, // Father Name
    { wch: 18 }, // Stream
    { wch: 28 }, // Subjects
    { wch: 16 }, // Practical Marks
    { wch: 12 }  // Max Marks
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Practicals_Awards');

  const filename = 'Practicals_Import_Template_HSS_Shangus.xlsx';
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFileBlob(blob, filename);
}

/**
 * Generate CSV template fallback
 */
export function generatePracticalsCsvTemplate() {
  generatePracticalsExcelTemplate();
}

/**
 * Export current active student roster to Excel (.xlsx) prefilled for a given class, session, subject, and evaluation type.
 */
export function exportCurrentRosterToExcel({
  className = '11th',
  session = '2025-26',
  students = [],
  subjectCode = 'BO',
  evaluationType = 'internal',
  teacherName = '',
  teacherEmail = ''
}) {
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

  const aoaData = [EXCEL_COLUMNS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Force ALL cells to explicit Text format ('@')
  Object.keys(ws).forEach((cellKey) => {
    if (cellKey.startsWith('!')) return;
    const cell = ws[cellKey];
    if (cell) {
      cell.t = 's';
      cell.v = String(cell.v || '');
      cell.w = String(cell.v || '');
      cell.z = '@';
    }
  });

  ws['!cols'] = [
    { wch: 10 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 26 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
    { wch: 26 },
    { wch: 26 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student_Roster');

  const cleanSess = String(session).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Roster_${className}_${subjectCode}_${evaluationType}_${cleanSess}.xlsx`;

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFileBlob(blob, filename);
}

/**
 * Alias for backward compatibility
 */
export function exportCurrentRosterToCsv(opts) {
  exportCurrentRosterToExcel(opts);
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
 * Parse and validate practicals spreadsheet (Excel .xlsx / .xls or CSV text)
 * Supporting both Flat row format and Multi-Section Matrix format (e.g. prac_data sheet).
 * Returning grouped Firestore submission documents.
 */
export function parseAndValidatePracticalsSpreadsheet(fileData, isBinary = true) {
  let rawRows = [];
  let sheetNameUsed = '';

  try {
    if (isBinary) {
      const wb = XLSX.read(fileData, { type: 'array', cellText: true, raw: false });
      
      // Auto-detect 'prac_data' or 'practicals' or use first sheet
      const targetSheet = wb.SheetNames.find(n => n.toLowerCase().includes('prac')) || wb.SheetNames[0];
      if (!targetSheet) {
        return { success: false, error: 'Spreadsheet has no valid sheets.' };
      }
      sheetNameUsed = targetSheet;
      const ws = wb.Sheets[targetSheet];
      rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    } else {
      rawRows = parseCsvText(String(fileData || ''));
    }
  } catch (err) {
    return { success: false, error: `Failed to read spreadsheet file: ${err.message}` };
  }

  if (!rawRows || rawRows.length < 2) {
    return { success: false, error: 'File is empty or missing data rows.' };
  }

  // ─────────────────────────────────────────────────────────────
  // 1. AUTO-DETECT MATRIX FORMAT (e.g. prac_data sheet)
  // ─────────────────────────────────────────────────────────────
  const isMatrixFormat = rawRows.some(row => {
    if (!Array.isArray(row)) return false;
    const rowStr = row.slice(0, 8).map(c => String(c || '').toLowerCase()).join(' ');
    return (rowStr.includes('timestamp') && rowStr.includes('teacher')) || 
           (rowStr.includes('email') && rowStr.includes('subject') && rowStr.includes('practicaltype'));
  });

  if (isMatrixFormat) {
    const documentsMap = new Map();
    const errors = [];
    let currentSectionStudents = [];
    let currentHeaderRow = -1;

    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      const rowStr = row.slice(0, 8).map(c => String(c || '').toLowerCase()).join(' ');

      // Detect Section Header Row (contains 'Timestamp' / 'Teacher Name' / 'Class' / 'Subject')
      if ((rowStr.includes('timestamp') && rowStr.includes('teacher')) || (rowStr.includes('email') && rowStr.includes('class') && rowStr.includes('subject'))) {
        currentHeaderRow = r;
        currentSectionStudents = [];

        const regRow = r >= 2 ? rawRows[r - 2] : null;
        const examRow = r >= 1 ? rawRows[r - 1] : null;

        for (let c = 7; c < row.length; c++) {
          const sName = String(row[c] || '').trim();
          const sReg = regRow ? cleanRegistrationNumber(regRow[c]) : '';
          const sExam = examRow ? String(examRow[c] || '').trim() : '';

          if (sName && sName.toLowerCase() !== 'none' && sName.toLowerCase() !== 'student name') {
            currentSectionStudents.push({
              col: c,
              name: sName,
              regNo: sReg || '—',
              examRollNo: sExam || '—'
            });
          }
        }
        continue;
      }

      // If we are under an active section, check if this is a teacher submission row
      if (currentHeaderRow !== -1 && r > currentHeaderRow) {
        const timestamp = String(row[0] || '').trim();
        const email = String(row[1] || '').trim();
        const teacher = String(row[2] || '').trim();
        const clsRaw = String(row[3] || '').trim();
        const subjRaw = String(row[4] || '').trim();
        const ptypeRaw = String(row[5] || '').trim();
        const sessRaw = String(row[6] || '').trim();

        if (clsRaw && subjRaw && (email || teacher)) {
          // If this row itself is another header row, skip
          if (email.toLowerCase().includes('email') || teacher.toLowerCase().includes('teacher')) {
            continue;
          }

          const cls = clsRaw.toLowerCase().includes('12') ? '12th' : '11th';
          const evalType = ptypeRaw.toLowerCase().includes('ext') ? 'external' : 'internal';
          const sess = sessRaw || '2024-25 (Oct-Nov)';

          // Extract Clean Subject Code
          let subCode = 'XX';
          const matchCode = subjRaw.match(/\(([A-Za-z]+)\)/);
          if (matchCode) {
            subCode = matchCode[1].toUpperCase();
          } else {
            const token = subjRaw.split(/[\s,]+/)[0].toUpperCase();
            subCode = VALID_SUBJECT_CODES[token] ? token : (VALID_SUBJECT_CODES[subjRaw.toUpperCase()] ? subjRaw.toUpperCase() : token.substring(0, 3));
          }

          const subName = subjRaw || VALID_SUBJECT_CODES[subCode] || subCode;
          const docId = `${cls}_${subCode}_${evalType}_${sess}`;

          const records = [];
          currentSectionStudents.forEach(st => {
            const mVal = String(row[st.col] || '').trim().toUpperCase();
            if (mVal && mVal !== 'NONE' && mVal !== 'NULL' && mVal !== 'UNDEFINED') {
              records.push({
                sNo: records.length + 1,
                classRollNo: '—',
                examRollNo: st.examRollNo || '—',
                boardRegNo: st.regNo || '—',
                name: st.name,
                studentName: st.name,
                parentName: '—',
                stream: evalType === 'external' ? 'External / Outside' : 'Science',
                practicalMarks: mVal,
                totalMarks: mVal
              });
            }
          });

          if (records.length > 0) {
            documentsMap.set(docId, {
              id: docId,
              className: cls,
              sessionText: sess,
              session: sess,
              practicalType: evalType,
              subjectCode: subCode,
              subjectName: subName,
              teacherName: teacher || 'Faculty Member',
              teacherEmail: email || '',
              timestamp: timestamp || new Date().toLocaleString(),
              records: records
            });
          }
        }
      }
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
          practicalType: d.practicalType
        });
      });
    });

    return {
      success: true,
      mode: 'matrix',
      sheetName: sheetNameUsed,
      totalRows: rawRows.length,
      validRecords: previewRecords.length,
      documentsCount: documents.length,
      documents,
      previewRecords,
      errors
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. STANDARD FLAT ROW FORMAT
  // ─────────────────────────────────────────────────────────────
  const rawHeaders = (rawRows[0] || []).map(h => String(h || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  
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
      error: 'Spreadsheet is missing mandatory header columns. Required: Class, Session, Subject Code, Practical Marks.'
    };
  }

  const documentsMap = new Map();
  const errors = [];
  let totalRows = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0 || (r.length === 1 && !r[0])) continue;
    totalRows++;

    const rowNum = i + 1;
    let clsRaw = String(r[colClass] || '11th').trim();
    let cls = clsRaw.toLowerCase().includes('12') ? '12th' : '11th';

    let sess = String(r[colSession] || '2024-25 (Oct-Nov)').trim();
    let evalType = (colType !== -1 ? String(r[colType] || '') : 'internal').toLowerCase().includes('ext') ? 'external' : 'internal';
    let subCode = String(r[colSubCode] || 'XX').toUpperCase().trim();
    let subName = (colSubName !== -1 ? String(r[colSubName] || '') : '') || VALID_SUBJECT_CODES[subCode] || subCode;

    let teacherName = (colTeacherName !== -1 ? String(r[colTeacherName] || '') : '') || 'Faculty Member';
    let teacherEmail = (colTeacherEmail !== -1 ? String(r[colTeacherEmail] || '') : '') || 'admin@hssshangus.edu';

    let rawReg = colRegNo !== -1 ? r[colRegNo] : '';
    let regNo = cleanRegistrationNumber(rawReg);
    let examRoll = (colExamRoll !== -1 ? String(r[colExamRoll] || '') : '').trim();
    let classRoll = (colClassRoll !== -1 ? String(r[colClassRoll] || '') : '').trim();
    let stName = (colStudentName !== -1 ? String(r[colStudentName] || '') : '').trim();
    let fatherName = (colFatherName !== -1 ? String(r[colFatherName] || '') : '').trim();
    let stream = (colStream !== -1 ? String(r[colStream] || '') : '') || (evalType === 'external' ? 'External / Outside' : 'Science');
    let subjects = (colSubjects !== -1 ? String(r[colSubjects] || '') : '').trim();
    let marksRaw = String(r[colMarks] || '').trim().toUpperCase();
    let maxMarks = parseInt((colMaxMarks !== -1 ? String(r[colMaxMarks] || '10') : '10') || '10', 10) || 10;

    if (!stName && !regNo && !examRoll) {
      errors.push(`Row ${rowNum}: Missing student identity (Name, Reg No, or Exam Roll).`);
      continue;
    }

    if (!marksRaw) {
      errors.push(`Row ${rowNum}: Missing practical marks for "${stName || regNo}".`);
      continue;
    }

    const docId = `${cls}_${subCode}_${evalType}_${sess}`;

    if (!documentsMap.has(docId)) {
      documentsMap.set(docId, {
        id: docId,
        className: cls,
        sessionText: sess,
        session: sess,
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
      studentName: stName,
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
    mode: 'flat',
    totalRows,
    validRecords: previewRecords.length,
    documentsCount: documents.length,
    documents,
    previewRecords,
    errors
  };
}

/**
 * Backward compatibility parser for CSV string
 */
export function parseAndValidatePracticalsCsv(csvText) {
  return parseAndValidatePracticalsSpreadsheet(csvText, false);
}

/**
 * Batch write parsed practical submission documents into Firestore.
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
