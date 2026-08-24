/**
 * practicalsCsvManager.js
 * Comprehensive Excel & Spreadsheet Import / Export / Template Management for Practicals Portal
 * Govt. Higher Secondary School Shangus
 */

import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';
import { findStudentMarkRecord } from './practicalsPdfGenerator';

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
 * Export Consolidated Awards Workbook with Sheet 1 (Forwarding Letter) + Sheet 2 (Awards Matrix)
 */
export function exportConsolidatedAwardsToExcel({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  isExternal = false,
  selectedSubjectCodes = null,
  printDetails = null
}) {
  if (!students || students.length === 0) return false;

  const hseText = className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)';
  const evalTypeText = isExternal ? 'External' : 'Internal Assessment';
  const isClass12 = String(className).toLowerCase().includes('12');
  const clsTarget = isClass12 ? '12' : '11';

  const defaultSubDefs = [
    { code: 'EN', name: 'General English', keywords: ['english', 'gen eng', 'en'] },
    { code: 'PH', name: 'Physics', keywords: ['physics', 'ph'] },
    { code: 'CH', name: 'Chemistry', keywords: ['chemistry', 'ch'] },
    { code: 'BO', name: 'Botany', keywords: ['botany', 'bo', 'biology'] },
    { code: 'ZO', name: 'Zoology', keywords: ['zoology', 'zo', 'biology'] },
    { code: 'BI', name: 'Biology (Botany & Zoology)', keywords: ['biology', 'bi', 'botany', 'zoology'] },
    { code: 'MA', name: 'Mathematics', keywords: ['mathematics', 'math', 'maths', 'ma'] },
    { code: 'UR', name: 'Urdu', keywords: ['urdu', 'ur'] },
    { code: 'ED', name: 'Education', keywords: ['education', 'ed'] },
    { code: 'HT', name: 'History', keywords: ['history', 'ht'] },
    { code: 'PS', name: 'Political Science', keywords: ['political science', 'pol sc', 'ps'] },
    { code: 'EC', name: 'Economics', keywords: ['economics', 'ec'] },
    { code: 'ES', name: 'Environmental Science', keywords: ['environmental science', 'evs', 'es'] },
    { code: 'PD', name: 'Physical Education', keywords: ['physical education', 'phy edu', 'pd'] },
    { code: 'HTC', name: 'Healthcare', keywords: ['healthcare', 'health care', 'htc'] },
    { code: 'ITE', name: 'IT and ITES', keywords: ['it and ites', 'it&ites', 'ite', 'information technology'] }
  ];

  const activeSubs = defaultSubDefs.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  // ──────── SHEET 1: FORWARDING COVER LETTER ────────
  const gistCounts = activeSubs.map((sub, idx) => {
    let count = 0;
    if (sub.code === 'EN') {
      count = students.length;
    } else {
      students.forEach(st => {
        const stStream = String(st.stream || st.Stream || '').toLowerCase();
        const multiSubCols = [
          st['Subjects1'], st['Subjects2'], st['Subjects3'], st['Subjects4'], st['Subjects5'], st['Subject6'],
          st['Subject1'], st['Subject2'], st['Subject3'], st['Subject4'], st['Subject5'],
          st['subject1'], st['subject2'], st['subject3'], st['subject4'], st['subject5'], st['subject6']
        ].filter(Boolean).join(', ');

        const stSubs = String(
          st['Subs'] ||
          st['subs'] ||
          (isClass12 ? (st['Subjects to be taken in Class 12th'] || st['Subjects Studied in Class 11th'] || st['Subjects in Class 11th']) : '') ||
          multiSubCols ||
          st['Subjects to be taken in Class 11th'] ||
          st['Subjects Studied in Class 11th'] ||
          st['Subjects'] ||
          st['Subject Combination'] ||
          st['streamSubjects'] ||
          st.subjects ||
          ''
        ).toLowerCase();

        const isScience = stStream.includes('science') || stStream.includes('med') || stStream.includes('sci') || stSubs.includes('physics') || stSubs.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubs);
        const isNonMed = stStream.includes('non-med') || stStream.includes('nonmed') || (/\b(mathematics|maths|math|ma)\b/i.test(stSubs) && !/\b(biology|botany|zoology|bio|bo|zo|bi)\b/i.test(stSubs));

        let hasSub = false;
        if (sub.code === 'PH' || sub.code === 'CH') {
          if (isScience || stSubs.includes('physics') || stSubs.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubs)) hasSub = true;
        } else if (sub.code === 'BO' || sub.code === 'ZO' || sub.code === 'BI') {
          if (stSubs.includes('botany') || stSubs.includes('zoology') || stSubs.includes('biology') || /\b(bo|zo|bi)\b/i.test(stSubs)) hasSub = true;
          else if (isScience && !isNonMed) hasSub = true;
        } else if (sub.code === 'MA') {
          if (stSubs.includes('mathematics') || stSubs.includes('math') || /\bma\b/i.test(stSubs) || (isScience && isNonMed)) hasSub = true;
        } else {
          hasSub = sub.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(stSubs) || stSubs.includes(kw));
        }

        if (!hasSub && submissions && submissions.length > 0) {
          const rNo = String(st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || '').trim();
          const subDoc = submissions.find(s => {
            const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
            if (!matchClass) return false;
            const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
            return codeStr === sub.code || codeStr.includes(sub.code);
          });
          if (subDoc && subDoc.records && rNo) {
            const hasRec = subDoc.records.some(r => String(r.classRollNo || r.classRoll || r.rollNo || '').trim() === rNo);
            if (hasRec) hasSub = true;
          }
        }

        if (hasSub) count++;
      });

      if (count === 0 && submissions && submissions.length > 0) {
        const subDoc = submissions.find(s => {
          const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
          if (!matchClass) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
          return codeStr === sub.code || codeStr.includes(sub.code);
        });
        if (subDoc && subDoc.records) count = subDoc.records.length;
      }
    }
    return { sno: idx + 1, name: sub.name, code: sub.code, count };
  }).filter(g => g.count > 0);

  const inchargeName = printDetails?.inchargeName || (className === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar');
  const inchargeCpis = printDetails?.inchargeCpis || (className === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017');
  const inchargeMobile = printDetails?.inchargeMobile || (className === '12th' ? '9596165142' : '7006537425');

  const letterRows = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG'],
    ['OFFICIAL FORWARDING LETTER FOR PRACTICAL AWARDS'],
    [],
    ['The Assistant Secretary,'],
    ['Sub Office Anantnag.'],
    [],
    [`Subject: Submission of ${evalTypeText} Practical Awards of ${hseText} Session ${session}.`],
    [],
    ['Sir,'],
    [`Apropos to the subject captioned above kindly find enclosed herewith the ${evalTypeText.toLowerCase()} practical awards pertaining to ${hseText} Examination, session ${session}, for the favour of further necessary action at your end please.`],
    [`Furthermore, this is certified that the ${evalTypeText.toLowerCase()} tests/examinations for all the examinees of the institution have been conducted by the institution and none among the on-roll candidates have been skipped during the preparation of award rolls.`],
    [],
    ['SUMMARY OF EXAMINEES (SUBJECT-WISE GIST)'],
    ['S.No.', 'Subject Title', 'Subject Code', 'No. of Students'],
    ...gistCounts.map(g => [g.sno, g.name, g.code, g.count]),
    [],
    ['Total Enrolled Candidates in Roster:', students.length],
    [],
    [],
    ['', '', 'Principal'],
    ['', '', 'Govt. Higher Secondary School Shangus']
  ];

  const wsLetter = XLSX.utils.aoa_to_sheet(letterRows);
  wsLetter['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 18 }, { wch: 20 }];

  // ──────── SHEET 2: CONSOLIDATED AWARDS MATRIX ────────
  const matrixHeaders = [
    'S.No.',
    'Class Roll No.',
    'Exam Roll No.',
    'Board Reg. No.',
    'Student Name',
    "Father's Name",
    'Stream',
    ...activeSubs.map(s => `${s.name} (${s.code})`),
    'Hash Total'
  ];

  const matrixDataRows = students.map((st, idx) => {
    const classRoll = String(st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || (idx + 1)).trim();
    const examRoll = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || classRoll).trim();
    const rawReg = st['Board Registration Number'] || st['Board Reg. No.'] || st.boardRegNo || st.regNo || '';
    const regNo = cleanRegistrationNumber(rawReg) || '—';
    const name = String(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—').trim();
    const father = String(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '—').trim();
    const stream = String(st.stream || st.Stream || 'Science').trim();

    let rowHash = 0;

    const marksCols = activeSubs.map(sub => {
      let isEnrolled = false;
      const stStream = stream.toLowerCase();
      const multiSubCols = [
        st['Subjects1'], st['Subjects2'], st['Subjects3'], st['Subjects4'], st['Subjects5'], st['Subject6'],
        st['Subject1'], st['Subject2'], st['Subject3'], st['Subject4'], st['Subject5'],
        st['subject1'], st['subject2'], st['subject3'], st['subject4'], st['subject5'], st['subject6']
      ].filter(Boolean).join(', ');

      const stSubs = String(
        st['Subs'] ||
        st['subs'] ||
        (isClass12 ? (st['Subjects to be taken in Class 12th'] || st['Subjects Studied in Class 11th'] || st['Subjects in Class 11th']) : '') ||
        multiSubCols ||
        st['Subjects to be taken in Class 11th'] ||
        st['Subjects Studied in Class 11th'] ||
        st['Subjects'] ||
        st['Subject Combination'] ||
        st['streamSubjects'] ||
        st.subjects ||
        ''
      ).toLowerCase();

      if (sub.code === 'EN') isEnrolled = true;
      else if (sub.code === 'PH' || sub.code === 'CH') {
        isEnrolled = stStream.includes('science') || stSubs.includes('physics') || stSubs.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubs);
      } else if (sub.code === 'BO' || sub.code === 'ZO') {
        isEnrolled = stSubs.includes('botany') || stSubs.includes('zoology') || stSubs.includes('biology') || /\b(bo|zo|bi)\b/i.test(stSubs);
      } else {
        isEnrolled = sub.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(stSubs) || stSubs.includes(kw));
      }

      if (sub.code === 'BI') {
        const boDoc = submissions.find(s => String(s.className || s.class || '').toLowerCase().includes(clsTarget) && (isExternal ? s.practicalType === 'external' : s.practicalType !== 'external') && String(s.subjectCode || '').toUpperCase().includes('BO'));
        const zoDoc = submissions.find(s => String(s.className || s.class || '').toLowerCase().includes(clsTarget) && (isExternal ? s.practicalType === 'external' : s.practicalType !== 'external') && String(s.subjectCode || '').toUpperCase().includes('ZO'));
        const boRec = findStudentMarkRecord(boDoc, st);
        const zoRec = findStudentMarkRecord(zoDoc, st);
        const boVal = parseInt(boRec?.totalMarks ?? boRec?.practicalMarks ?? '', 10);
        const zoVal = parseInt(zoRec?.totalMarks ?? zoRec?.practicalMarks ?? '', 10);
        if (!isNaN(boVal) || !isNaN(zoVal)) {
          const biTot = (isNaN(boVal) ? 0 : boVal) + (isNaN(zoVal) ? 0 : zoVal);
          rowHash += biTot;
          return biTot;
        }
      }

      const subDoc = submissions.find(s => {
        const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
        if (!matchClass) return false;
        const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
        const targetType = isExternal ? 'external' : 'internal';
        if (sType !== targetType) return false;
        const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        return codeStr === sub.code || codeStr.includes(sub.code);
      });

      let foundMark = null;
      if (subDoc && subDoc.records) {
        const rec = findStudentMarkRecord(subDoc, st);
        if (rec) {
          const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
          const num = parseInt(rawMark, 10);
          if (!isNaN(num)) {
            rowHash += num;
            foundMark = num;
          } else if (rawMark.toUpperCase() === 'AB') {
            foundMark = 'AB';
          }
        }
      }

      if (foundMark !== null) return foundMark;
      return isEnrolled ? '—' : 'x';
    });

    return [
      idx + 1,
      classRoll,
      examRoll,
      regNo,
      name,
      father,
      stream,
      ...marksCols,
      rowHash > 0 ? rowHash : '—'
    ];
  });

  const matrixAoa = [
    ['GOVT. HIGHER SECONDARY SCHOOL SHANGUS, ANANTNAG'],
    [`RECORD OF ${evalTypeText.toUpperCase()} PRACTICAL AWARDS ROLL — ${hseText}`],
    [`Session & Year: ${session} | Institution Code: 201006 | Contact: 9682641216`],
    [],
    matrixHeaders,
    ...matrixDataRows,
    [],
    ['Certificate: "Certified that the relevant data in respect of the above candidates who are appearing in Higher Secondary Examination is correct in all respects to the best of my knowledge."'],
    [],
    [`Signature of Incharge: ${inchargeName} (CPIS: ${inchargeCpis}, Mobile: ${inchargeMobile})`, '', '', '', '', '', '', 'Signature of Head of Institution (with Seal)']
  ];

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixAoa);
  wsMatrix['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 14 }, // Class Roll
    { wch: 16 }, // Exam Roll
    { wch: 22 }, // Reg No
    { wch: 26 }, // Name
    { wch: 24 }, // Father
    { wch: 16 }, // Stream
    ...activeSubs.map(() => ({ wch: 14 })),
    { wch: 14 }  // Hash Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsLetter, 'Forwarding_Letter');
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Awards_Matrix');

  const cleanSess = String(session).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Consolidated_Awards_${className}_${evalTypeText.replace(/\s+/g, '_')}_${cleanSess}.xlsx`;

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFileBlob(blob, filename);
  return true;
}

/**
 * Export Consolidated Awards to Word (.doc) with identical layout to Print Preview
 */
export function exportConsolidatedAwardsToWord({
  className = '11th',
  session = 'Annual Regular 2025',
  students = [],
  submissions = [],
  isExternal = false,
  selectedSubjectCodes = null,
  printDetails = null
}) {
  if (!students || students.length === 0) return false;

  const hseText = className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)';
  const evalTypeText = isExternal ? 'External Practical' : 'Internal Assessment';
  const isClass12 = String(className).toLowerCase().includes('12');
  const clsTarget = isClass12 ? '12' : '11';

  const defaultSubDefs = [
    { code: 'EN', name: 'General English', keywords: ['english', 'gen eng', 'en'] },
    { code: 'PH', name: 'Physics', keywords: ['physics', 'ph'] },
    { code: 'CH', name: 'Chemistry', keywords: ['chemistry', 'ch'] },
    { code: 'BO', name: 'Botany', keywords: ['botany', 'bo', 'biology'] },
    { code: 'ZO', name: 'Zoology', keywords: ['zoology', 'zo', 'biology'] },
    { code: 'BI', name: 'Biology (Botany & Zoology)', keywords: ['biology', 'bi', 'botany', 'zoology'] },
    { code: 'MA', name: 'Mathematics', keywords: ['mathematics', 'math', 'maths', 'ma'] },
    { code: 'UR', name: 'Urdu', keywords: ['urdu', 'ur'] },
    { code: 'ED', name: 'Education', keywords: ['education', 'ed'] },
    { code: 'HT', name: 'History', keywords: ['history', 'ht'] },
    { code: 'PS', name: 'Political Science', keywords: ['political science', 'pol sc', 'ps'] },
    { code: 'EC', name: 'Economics', keywords: ['economics', 'ec'] },
    { code: 'ES', name: 'Environmental Science', keywords: ['environmental science', 'evs', 'es'] },
    { code: 'PD', name: 'Physical Education', keywords: ['physical education', 'phy edu', 'pd'] },
    { code: 'HTC', name: 'Healthcare', keywords: ['healthcare', 'health care', 'htc'] },
    { code: 'ITE', name: 'IT and ITES', keywords: ['it and ites', 'it&ites', 'ite', 'information technology'] }
  ];

  const activeSubs = defaultSubDefs.filter(s => {
    if (!selectedSubjectCodes || !Array.isArray(selectedSubjectCodes) || selectedSubjectCodes.length === 0) return true;
    return selectedSubjectCodes.includes(s.code);
  });

  // Calculate Gist for Page 1 Cover Letter
  const gistList = activeSubs.map((sub, idx) => {
    let count = 0;
    if (sub.code === 'EN') {
      count = students.length;
    } else {
      students.forEach(st => {
        const clsName = String(className).toLowerCase();
        const stStream = String(st.stream || st.Stream || st['Stream'] || '').toLowerCase();
        const multiSubCols = [
          st['Subjects1'], st['Subjects2'], st['Subjects3'], st['Subjects4'], st['Subjects5'], st['Subject6'],
          st['Subject1'], st['Subject2'], st['Subject3'], st['Subject4'], st['Subject5'],
          st['subject1'], st['subject2'], st['subject3'], st['subject4'], st['subject5'], st['subject6']
        ].filter(Boolean).join(', ');

        const stSubs = String(
          st['Subs'] ||
          st['subs'] ||
          (clsName.includes('12') ? (st['Subjects to be taken in Class 12th'] || st['Subjects Studied in Class 11th'] || st['Subjects in Class 11th']) : '') ||
          multiSubCols ||
          st['Subjects to be taken in Class 11th'] ||
          st['Subjects Studied in Class 11th'] ||
          st['Subjects'] ||
          st['Subject Combination'] ||
          st['streamSubjects'] ||
          st.subjects ||
          ''
        ).toLowerCase();

        const isScience = stStream.includes('science') || stStream.includes('med') || stStream.includes('sci') || stSubs.includes('physics') || stSubs.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubs);
        const isNonMed = stStream.includes('non-med') || stStream.includes('nonmed') || (/\b(mathematics|maths|math|ma)\b/i.test(stSubs) && !/\b(biology|botany|zoology|bio|bo|zo|bi)\b/i.test(stSubs));

        let hasSub = false;
        if (sub.code === 'PH' || sub.code === 'CH') {
          if (isScience || stSubs.includes('physics') || stSubs.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubs)) hasSub = true;
        } else if (sub.code === 'BO' || sub.code === 'ZO' || sub.code === 'BI') {
          if (stSubs.includes('botany') || stSubs.includes('zoology') || stSubs.includes('biology') || /\b(bo|zo|bi)\b/i.test(stSubs)) hasSub = true;
          else if (isScience && !isNonMed) hasSub = true;
        } else if (sub.code === 'MA') {
          if (stSubs.includes('mathematics') || stSubs.includes('math') || /\bma\b/i.test(stSubs) || (isScience && isNonMed)) hasSub = true;
        } else {
          hasSub = sub.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(stSubs) || stSubs.includes(kw));
        }

        if (!hasSub && submissions && submissions.length > 0) {
          const rNo = String(st['Class Roll No'] || st['Class R.No.'] || st.classRollNo || st.rollNo || st.roll || '').trim();
          const subDoc = submissions.find(s => {
            const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
            if (!matchClass) return false;
            const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
            return codeStr === sub.code || codeStr.includes(sub.code);
          });
          if (subDoc && subDoc.records && rNo) {
            const hasRec = subDoc.records.some(r => String(r.classRollNo || r.classRoll || r.rollNo || r.roll || '').trim() === rNo);
            if (hasRec) hasSub = true;
          }
        }

        if (hasSub) count++;
      });

      if (count === 0 && submissions && submissions.length > 0) {
        const subDoc = submissions.find(s => {
          const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
          if (!matchClass) return false;
          const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
          return codeStr === sub.code || codeStr.includes(sub.code);
        });
        if (subDoc && subDoc.records) count = subDoc.records.length;
      }
    }
    return { sno: idx + 1, code: sub.code, name: sub.name, count };
  }).filter(g => g.count > 0);

  // Incharge Details
  const inchargeName = printDetails?.inchargeName || (className === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar');
  const inchargeCpis = printDetails?.inchargeCpis || (className === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017');
  const inchargeMobile = printDetails?.inchargeMobile || (className === '12th' ? '9596165142' : '7006537425');
  const partText = className === '11th' ? 'Part-I (class 11th)' : 'Part-II (class 12th)';
  const testType = isExternal ? 'Practical Examination' : 'Internal Assessment';

  // Build matrix student rows
  const matrixRowsHtml = students.map((st, idx) => {
    const rollNo = String(st['Class Roll No'] || st.rollNo || st.classRollNo || st['Class R.No.'] || (idx + 1)).trim();
    const examRoll = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || rollNo).trim();
    const stSubsStr = String(
      st['Subs'] ||
      st['subs'] ||
      (isClass12 ? st['Subjects to be taken in Class 12th'] : st['Subjects to be taken in Class 11th']) ||
      st['Subjects'] ||
      st['Subject Combination'] ||
      st.subjects ||
      ''
    ).toLowerCase();
    const stStream = String(
      st['Stream'] ||
      st['stream'] ||
      (isClass12 ? st['Stream for Class 12th'] : st['Stream for Class 11th']) ||
      ''
    ).toLowerCase();

    let rowHashTotal = 0;

    const cellHtmls = activeSubs.map(sub => {
      let isEnrolled = false;
      if (sub.code === 'EN') isEnrolled = true;
      else if (sub.code === 'PH' || sub.code === 'CH') {
        isEnrolled = stStream.includes('science') || stSubsStr.includes('physics') || stSubsStr.includes('chemistry') || /\b(ph|ch)\b/i.test(stSubsStr);
      } else if (sub.code === 'BO' || sub.code === 'ZO') {
        isEnrolled = stSubsStr.includes('botany') || stSubsStr.includes('zoology') || stSubsStr.includes('biology') || /\b(bo|zo|bi)\b/i.test(stSubsStr);
      } else {
        isEnrolled = sub.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(stSubsStr) || stSubsStr.includes(kw));
      }

      if (sub.code === 'BI') {
        const boDoc = submissions.find(s => String(s.className || s.class || '').toLowerCase().includes(clsTarget) && (isExternal ? s.practicalType === 'external' : s.practicalType !== 'external') && String(s.subjectCode || '').toUpperCase().includes('BO'));
        const zoDoc = submissions.find(s => String(s.className || s.class || '').toLowerCase().includes(clsTarget) && (isExternal ? s.practicalType === 'external' : s.practicalType !== 'external') && String(s.subjectCode || '').toUpperCase().includes('ZO'));
        const boRec = findStudentMarkRecord(boDoc, st);
        const zoRec = findStudentMarkRecord(zoDoc, st);
        const boVal = parseInt(boRec?.totalMarks ?? boRec?.practicalMarks ?? '', 10);
        const zoVal = parseInt(zoRec?.totalMarks ?? zoRec?.practicalMarks ?? '', 10);
        if (!isNaN(boVal) || !isNaN(zoVal)) {
          const biTot = (isNaN(boVal) ? 0 : boVal) + (isNaN(zoVal) ? 0 : zoVal);
          rowHashTotal += biTot;
          return `<td style="color: #1e40af; font-weight: bold; text-align: center;">${biTot}</td>`;
        }
      }

      const subDoc = submissions.find(s => {
        const matchClass = String(s.className || s.Class || s.class || '').toLowerCase().includes(clsTarget);
        if (!matchClass) return false;
        const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
        const targetType = isExternal ? 'external' : 'internal';
        if (sType !== targetType) return false;
        const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
        return codeStr === sub.code || codeStr.includes(sub.code);
      });

      const rec = findStudentMarkRecord(subDoc, st);
      if (rec) {
        const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
        const numVal = parseInt(rawMark, 10);
        if (!isNaN(numVal)) {
          rowHashTotal += numVal;
          return `<td style="color: #1e40af; font-weight: bold; text-align: center;">${numVal}</td>`;
        } else if (rawMark.toUpperCase() === 'AB') {
          return `<td style="color: #dc2626; font-weight: bold; text-align: center;">AB</td>`;
        }
      }

      if (isEnrolled) return `<td style="color: #1e40af; font-weight: bold; text-align: center;">—</td>`;
      return `<td style="color: #94a3b8; text-align: center;">x</td>`;
    }).join('');

    const isEven = idx % 2 === 1;
    const rowBg = isEven ? '#f1f5f9' : '#ffffff';

    return `
      <tr style="background-color: ${rowBg};">
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center; font-weight: bold;">${examRoll}</td>
        ${cellHtmls}
        <td style="text-align: center; font-weight: bold; background-color: ${isEven ? '#cbd5e1' : '#e2e8f0'};">${rowHashTotal > 0 ? rowHashTotal : '—'}</td>
      </tr>
    `;
  }).join('');

  const wordHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Consolidated Practical Awards — Govt HSS Shangus</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page { size: A4 portrait; margin: 1.2cm 1.2cm 1.2cm 1.2cm; }
          body { font-family: 'Calibri', 'Times New Roman', serif; font-size: 10pt; color: #0f172a; line-height: 1.35; }
          .page-break { page-break-after: always; mso-special-character: line-break; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; }
          th, td { border: 1px solid #475569; padding: 4px 3px; font-size: 8.5pt; vertical-align: middle; }
          th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; text-transform: uppercase; }
          .gist-table th { background-color: #1e293b; color: #ffffff; }
          .matrix-table th { background-color: #1e293b; color: #ffffff; }
          .sub-head th { background-color: #334155; color: #ffffff; }
          h1 { font-size: 13.5pt; font-weight: bold; text-align: center; margin: 0 0 4px 0; text-transform: uppercase; color: #0f172a; }
          h2 { font-size: 10.5pt; font-weight: bold; text-align: center; margin: 0 0 4px 0; color: #1e293b; }
          p { margin: 4px 0; }
        </style>
      </head>
      <body>
        <!-- PAGE 1: FORWARDING COVER LETTER -->
        <div style="padding: 10px 15px;">
          <p style="font-size: 11pt; font-weight: bold; margin-bottom: 18px;">
            The Assistant Secretary,<br>
            Sub Office Anantnag.
          </p>

          <p style="font-size: 11pt; font-weight: bold; text-decoration: underline; margin: 16px 0;">
            Subject: Submission of ${evalTypeText} Practical Awards of ${hseText} Session ${session}.
          </p>

          <p style="font-size: 10.5pt; font-weight: bold;">Sir,</p>

          <p style="font-size: 10.5pt; text-align: justify; text-indent: 25px; margin: 12px 0;">
            Apropos to the subject captioned above kindly find enclosed herewith the ${evalTypeText.toLowerCase()} practical awards (in triplicate) pertaining to <strong>${hseText} Examination, session ${session}</strong>, for the favour of further necessary action at your end please.
          </p>

          <p style="font-size: 10.5pt; text-align: justify; text-indent: 25px; margin: 12px 0;">
            Furthermore, this is <strong>certified</strong> that the ${evalTypeText.toLowerCase()} tests/examinations for all the examinees of the institution, who are going to appear in the said examination, had been conducted by the institution and <strong>none among the on-roll candidates have been skipped</strong> during the preparation of award rolls. The summary of the examinees with subject wise gist is as follows:
          </p>

          <table class="gist-table" style="width: 85%; margin: 16px auto;">
            <thead>
              <tr>
                <th style="width: 15%;">S.No.</th>
                <th style="width: 55%; text-align: left; padding-left: 10px;">Subject</th>
                <th style="width: 30%;">No. of Students</th>
              </tr>
            </thead>
            <tbody>
              ${gistList.map(g => `
                <tr>
                  <td style="text-align: center;">${g.sno}</td>
                  <td style="padding-left: 10px;">${g.name} (${g.code})</td>
                  <td style="text-align: center; font-weight: bold;">${g.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 50px; text-align: right; font-weight: bold; font-size: 11pt; padding-right: 20px;">
            Principal<br>
            Govt. Higher Secondary School Shangus
          </div>
        </div>

        <div class="page-break"></div>

        <!-- PAGE 2+: CONSOLIDATED MARKS GRID MATRIX -->
        <div>
          <h1>Govt. Higher Secondary School Shangus, Anantnag</h1>
          <h2>Record of ${evalTypeText} Practical Awards Roll for the ${hseText} Examination</h2>
          <p style="text-align: center; font-weight: bold; font-size: 9.5pt;">Session & Year: <strong>${session}</strong> &nbsp;|&nbsp; Institution Contact: <strong>9682641216</strong></p>
          <div style="display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; margin: 8px 0;">
            <span>No.: ____________________</span>
            <span style="float: right;">Date: ____________________</span>
          </div>

          <table class="matrix-table">
            <thead>
              <tr>
                <th style="width: 5%;">S.No.</th>
                <th style="width: 15%;">Exam Roll No.</th>
                <th colspan="${activeSubs.length}">SUBJECTS</th>
                <th style="width: 10%;">Hash Total</th>
              </tr>
              <tr class="sub-head">
                <th></th>
                <th></th>
                ${activeSubs.map(s => `<th>${s.code}</th>`).join('')}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${matrixRowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 25px; font-size: 9.5pt; line-height: 1.4;">
            <div style="text-align: center; font-weight: bold; font-size: 11pt; margin-bottom: 6px;">Certificate</div>
            <p style="text-align: justify; margin: 0 0 16px 0;">
              "Certified that the relevant data of ${testType} in respect of the above candidates who are appearing in Higher Secondary Examination ${partText} from this Institution is correct in all respects to the best of my knowledge and no further amendment or modifications in the above data shall be indicated or requested by the undersigned affecting the declared result of any candidate whatsoever"
            </p>

            <table style="width: 100%; border: none; margin-top: 25px;">
              <tr style="border: none;">
                <td style="width: 50%; border: none; text-align: left; font-size: 9pt;">
                  Signature of Incharge: __________________<br>
                  Name: <strong>${inchargeName}</strong><br>
                  CPIS: <strong>${inchargeCpis}</strong><br>
                  Mobile: <strong>${inchargeMobile}</strong>
                </td>
                <td style="width: 50%; border: none; text-align: right; vertical-align: top; font-size: 9.5pt;">
                  <strong>Signature of Head of Institution</strong><br>
                  (with Official Seal)
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword;charset=utf-8' });
  const filename = `Consolidated_Awards_${className}_${evalTypeText.replace(/\s+/g, '_')}_${String(session).replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
  downloadFileBlob(blob, filename);
  return true;
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
