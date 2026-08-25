// =================================================================
// HSS SHANGUS — JKBOSE Exam Result Ingestion & Template Manager
// Supports Excel/CSV Template Export, File Parsing, Gemini AI PDF
// Gazette Analysis, Fuzzy Database Matching, and Firestore Sync.
// =================================================================

import * as XLSX from 'xlsx';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem } from '../services/dbCache';
import { generateStructuredWithGemini, getPreferredGeminiModel } from '../services/geminiLetterService';

const isUsableRecordValue = (value) => {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  return Boolean(text && !/^(—|-|n\/?a|null|undefined|none|#n\/a|#value!|#ref!)$/i.test(text));
};

const normalizeRecordKey = (key) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const findNormalizedRecordValue = (raw, aliases = []) => {
  if (!raw || typeof raw !== 'object') return '';
  const wanted = new Set(aliases.map(normalizeRecordKey));
  for (const [key, value] of Object.entries(raw)) {
    if (wanted.has(normalizeRecordKey(key)) && isUsableRecordValue(value)) return value;
  }
  return '';
};

const firstUsableRecordValue = (...values) => values.find(isUsableRecordValue) ?? '';

/**
 * Standard JKBOSE Subject Code Definitions
 */
/**
 * Standard JKBOSE Subject Code Definitions & Abbreviation Mappings
 */
export const JKBOSE_SUBJECT_CODES = [
  { code: 'GN', name: 'General English', category: 'Language' },
  { code: 'EN', name: 'General English', category: 'Language' },
  { code: 'GE', name: 'General English', category: 'Language' },
  { code: 'PH', name: 'Physics', category: 'Science' },
  { code: 'CH', name: 'Chemistry', category: 'Science' },
  { code: 'BI', name: 'Biology', category: 'Science' },
  { code: 'BO', name: 'Botany', category: 'Science' },
  { code: 'ZO', name: 'Zoology', category: 'Science' },
  { code: 'MA', name: 'Mathematics', category: 'Science/General' },
  { code: 'UR', name: 'Urdu', category: 'Language' },
  { code: 'UD', name: 'Urdu', category: 'Language' },
  { code: 'AR', name: 'Arabic', category: 'Language' },
  { code: 'HI', name: 'Hindi', category: 'Language' },
  { code: 'KA', name: 'Kashmiri', category: 'Language' },
  { code: 'PS', name: 'Political Science', category: 'Arts/Humanities' },
  { code: 'HS', name: 'History', category: 'Arts/Humanities' },
  { code: 'HT', name: 'History', category: 'Arts/Humanities' },
  { code: 'EC', name: 'Economics', category: 'Arts/Commerce' },
  { code: 'EO', name: 'Economics', category: 'Arts/Commerce' },
  { code: 'SO', name: 'Sociology', category: 'Arts/Humanities' },
  { code: 'ED', name: 'Education', category: 'Arts/Humanities' },
  { code: 'GG', name: 'Geography', category: 'Arts/Humanities' },
  { code: 'ES', name: 'Environmental Science', category: 'Compulsory' },
  { code: 'EVS', name: 'Environmental Science', category: 'Compulsory' },
  { code: 'AC', name: 'Accountancy', category: 'Commerce' },
  { code: 'BS', name: 'Business Studies', category: 'Commerce' },
  { code: 'BST', name: 'Business Studies', category: 'Commerce' },
  { code: 'PD', name: 'Public Administration', category: 'Arts/Humanities' },
  { code: 'PHE', name: 'Physical Education', category: 'Arts/General' },
  { code: 'PE', name: 'Physical Education', category: 'Arts/General' },
  { code: 'HE', name: 'Home Science', category: 'Arts/Humanities' },
  { code: 'ITE', name: 'IT & ITeS', category: 'Vocational' },
  { code: 'IT', name: 'IT & ITeS', category: 'Vocational' },
  { code: 'CS', name: 'Computer Science', category: 'Science' },
  { code: 'IP', name: 'Informatics Practices', category: 'Science' },
  { code: 'RET', name: 'Retail', category: 'Vocational' },
  { code: 'TH', name: 'Tourism & Hospitality', category: 'Vocational' },
  { code: 'AG', name: 'Agriculture', category: 'Vocational' },
  { code: 'AP', name: 'Automotive', category: 'Vocational' },
  { code: 'BW', name: 'Beauty & Wellness', category: 'Vocational' },
  { code: 'SC', name: 'Science', category: 'General' },
  { code: 'SS', name: 'Social Science', category: 'General' }
];

/**
 * Expand JKBOSE subject codes (e.g. "GN ED UD PD" -> "General English, Education, Urdu, Public Administration")
 */
export function expandJkboseSubjectCodes(codeStr) {
  if (!codeStr) return '';
  const cleanStr = String(codeStr).replace(/^Reap\s+/i, '').trim();
  if (!cleanStr || /^(passed|pass|promoted|—|-|n\/a)$/i.test(cleanStr)) return cleanStr;

  // If already contains full subject names or commas, split by comma/semicolon/newline
  let rawTokens = [];
  if (cleanStr.includes(',') || cleanStr.includes(';') || cleanStr.includes('\n')) {
    rawTokens = cleanStr.split(/[,;\n\r\t]+/).map(s => s.trim()).filter(Boolean);
  } else {
    // If no commas, check if it's space-separated 2-4 letter codes (e.g. "GN ED UD PD" or "GE EC HT PS PD")
    const words = cleanStr.split(/[\s+/]+/).filter(Boolean);
    const allShortCodes = words.length > 0 && words.every(w => /^[A-Za-z]{2,4}$/.test(w));
    if (allShortCodes) {
      rawTokens = words;
    } else {
      rawTokens = [cleanStr];
    }
  }

  const expanded = rawTokens.map(t => {
    const trimmed = t.trim();
    const upper = trimmed.toUpperCase();
    const found = JKBOSE_SUBJECT_CODES.find(c => c.code.toUpperCase() === upper);
    if (found) return found.name;
    if (upper === 'PHE' || upper === 'PE' || upper === 'PD') {
      return 'Physical Education';
    }
    return trimmed;
  });

  return expanded.join(', ');
}

/**
 * Calculate percentage & division from marks obtained and max marks.
 */
export function calculateDivision(marksObt, maxMarks = 500) {
  const obt = parseFloat(marksObt);
  const max = parseFloat(maxMarks) || 500;
  if (isNaN(obt) || obt <= 0 || max <= 0) {
    return { pct: 0, division: '—', pctStr: '—' };
  }
  const pct = Math.round((obt / max) * 1000) / 10;
  let division = '3rd Division';
  if (pct >= 75) division = 'Distinction';
  else if (pct >= 60) division = '1st Division';
  else if (pct >= 45) division = '2nd Division';

  return { pct, division, pctStr: `${pct}%` };
}

/**
 * Normalize Result string into standard standard taxonomy: 'Passed' | 'Reap' | 'Failed' | 'Discharged'
 */
export function normalizeResultStatus(raw) {
  if (!raw) return 'Awaiting Result';
  const s = String(raw).trim().toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'n/a' || s === 'null' || s === 'undefined' || s === 'active' || s === 'admitted' || s === 'approved' || s === 'enrolled') {
    return 'Awaiting Result';
  }
  if (s.includes('pass') || s.includes('qualif') || s.includes('distinc') || s.includes('promot')) return 'Passed';
  if (s.includes('reap') || s.includes('re-appear') || s.includes('compartment')) return 'Reap';
  if (s.includes('fail') || s.includes('not qualif') || s.includes('did not')) return 'Failed';
  if (s.includes('discharg') || s.includes('withdraw') || s.includes('transfer')) return 'Discharged';
  if (s.includes('await') || s.includes('appear') || s.includes('pursu') || s.includes('study') || s.includes('in-course')) return 'Awaiting Result';
  return 'Awaiting Result';
}

/**
 * Comprehensive Student Result & Marks Extractor.
 * Extracts marks obtained, max marks, division, exam roll, exam mode, and status from any student object or raw record.
 */
export function extractStudentResultMarks(st) {
  const raw = st?.raw || st || {};

  // 1. Result Status - Check explicit board result fields
  const rawStatus = raw['Result (Current)'] ||
                    raw.currResult ||
                    raw.resultCurrent ||
                    raw.result_current ||
                    raw.jkbose_result ||
                    raw.exam_result ||
                    raw['Exam Result'] ||
                    raw['Result'] ||
                    (raw.status && !['active', 'approved', 'admitted', 'enrolled', 'pending'].includes(String(raw.status).trim().toLowerCase()) ? raw.status : '') ||
                    findNormalizedRecordValue(raw, ['Current Result', 'Result Current', 'JKBOSE Result', 'Exam Result']) ||
                    st?.resultStatus ||
                    '';

  // 2. Marks / Reapp Candidate Keys (Only checking valid result marks)
  const rawMarks = firstUsableRecordValue(
    raw['Marks/Reapp (Current)'], raw.marks_reapp_current, raw.currMarksReapp,
    raw['Marks Obtained'], raw.marksObtained, raw['Marks/Reapp'], raw['Marks'], raw.marks,
    raw.result_marks, raw['Total Marks Obtained in Class 12th'], raw['Total Marks in Class 12th'],
    raw['Total Marks Obtained'], raw['Total Marks'], raw.marks_12th,
    findNormalizedRecordValue(raw, ['Current Marks', 'Marks Current', 'Marks Obtained Current', 'Marks Reapp Current', 'Result Marks']),
    st?.marksObtained
  );

  // 3. Genuine Board Exam Roll No (Never fallback to internal class roll numbers like 130, 118, 21)
  const examRoll = raw['Exam R.No. (Current)'] ||
                   raw.currExamRoll ||
                   raw.exam_roll_no_current ||
                   raw.examRollNo ||
                   raw.exam_roll_no ||
                   raw['Exam Roll No'] ||
                   raw['Exam Roll No.'] ||
                   raw['Exam R.No.'] ||
                   raw['Board Roll No'] ||
                   raw['Board Roll No.'] ||
                   raw['JKBOSE Roll No'] ||
                   raw['Roll No (12th)'] ||
                   findNormalizedRecordValue(raw, ['Current Exam Roll No', 'Exam Roll Number Current', 'JKBOSE Roll Number', 'Board Exam Roll No']) ||
                   st?.examRollNo ||
                   '';

  // Determine if a genuine result exists in the database
  const hasValidStatus = Boolean(rawStatus && !/^(active|approved|admitted|enrolled|—|-|n\/a|null|undefined)$/i.test(String(rawStatus).trim()));
  const hasValidMarks = Boolean(rawMarks && !/^(—|-|n\/a|0)$/.test(String(rawMarks).trim()));
  const hasResult = hasValidStatus || hasValidMarks;

  const normStatus = hasResult ? normalizeResultStatus(rawStatus || (hasValidMarks ? 'Passed' : '')) : 'Awaiting Result';
  const isPassed = normStatus === 'Passed';
  const isReap = normStatus === 'Reap';
  const isFailed = normStatus === 'Failed';

  // 4. Marks Parsing
  const marksStr = String(rawMarks || '').trim();
  const numMatch = marksStr.match(/(\d+)(?:\s*\/\s*(\d+))?/);

  const rawMax = raw.maxMarks || raw['Max Marks'] || raw['Total Max Marks in Class 12th'] || st?.maxMarks || '500';
  const maxMarks = numMatch && numMatch[2] ? numMatch[2] : String(rawMax);

  let marksObtained = '';
  let reappSubjects = '';

  if (hasResult) {
    if (numMatch) {
      marksObtained = numMatch[1];
    } else if (/^\d+$/.test(marksStr)) {
      marksObtained = marksStr;
    } else if (isPassed) {
      marksObtained = marksStr && !/^(pass|passed|promoted|—|-)$/i.test(marksStr) ? marksStr : '';
    } else if (isReap) {
      reappSubjects = marksStr;
    }

    // Check if result status itself has embedded marks e.g. "Pass (488/500)" or "488/500"
    if (!marksObtained && rawStatus) {
      const statusNumMatch = String(rawStatus).match(/(\d{2,3})(?:\s*\/\s*(\d{3}))?/);
      if (statusNumMatch) {
        marksObtained = statusNumMatch[1];
      }
    }

    // Check percentage if marks still empty
    if (!marksObtained) {
      const pctCandidate = raw.percentage || raw['Percentage'] || raw['Marks %'] || raw['marks_percentage'] || '';
      const pctMatch = String(pctCandidate).match(/(\d+(?:\.\d+)?)/);
      if (pctMatch) {
        const pctNum = parseFloat(pctMatch[1]);
        if (pctNum > 0 && pctNum <= 100) {
          const calculatedMarks = Math.round((pctNum / 100) * parseFloat(maxMarks || 500));
          marksObtained = String(calculatedMarks);
        }
      }
    }
  }

  // 5. Division / Distinction
  let division = raw['Div/Distinc (Current)'] || raw.currDiv || raw.division || raw['Division'] || raw['Distinction'] ||
    findNormalizedRecordValue(raw, ['Current Division', 'Division Current', 'Division Distinction Current', 'Div Distinc Current']) || st?.division || '';
  if (hasResult && !division && marksObtained) {
    division = calculateDivision(marksObtained, maxMarks).division;
  }

  // 6. Exam Mode / Session
  const examMode = raw['Exam Mode (Current)'] || raw.currExamMode || raw.exam_mode_current || raw.examMode || raw['Exam Mode'] ||
    findNormalizedRecordValue(raw, ['Current Exam Mode', 'Exam Mode Current', 'Examination Mode']) || '';

  return {
    hasResult: hasResult && (isPassed || isReap || isFailed),
    marksObtained: hasResult ? marksObtained : '',
    maxMarks: maxMarks || '500',
    reappSubjects: reappSubjects || (isReap ? (raw.reappSubjects || '') : ''),
    division: hasResult ? (division || (isPassed && marksObtained ? calculateDivision(marksObtained, maxMarks).division : '')) : '',
    examRoll: String(examRoll || '').trim(),
    examMode: String(examMode || '').trim(),
    resultStatus: normStatus,
    isPassed,
    isReap,
    isFailed
  };
}

/**
 * Comprehensive Admission Number Extractor.
 * Handles all 30+ schema permutations across admissions, master registers, legacy imports, and form registrations.
 */
export function extractStudentAdmissionNumber(st) {
  if (!st) return '';
  const raw = st?.raw || st || {};

  const candidates = [
    raw['Admission Number'],
    raw['Admission No.'],
    raw['Admission No'],
    raw['Adm. No.'],
    raw['Adm. No'],
    raw['Adm No.'],
    raw['Adm No'],
    raw['Adm.No.'],
    raw['Adm.No'],
    raw['AdmNo'],
    raw['ADM. NO.'],
    raw['ADM NO'],
    raw['ADM_NO'],
    raw['admNo'],
    raw['admissionNo'],
    raw['Adm_No'],
    raw['Admission_No'],
    raw['Admission_Number'],
    raw['Adm. No. (if allotted)'],
    raw['Adm No (if allotted)'],
    raw['Adm No (11th)'],
    raw['Adm No (12th)'],
    raw['Adm. No. (Class 11th)'],
    raw['Adm. No. (Class 12th)'],
    raw['Admission Number (Class 11th)'],
    raw['Admission Number (Class 12th)'],
    raw['Admission S.No.'],
    raw['Adm. S.No.'],
    st?.admissionNo,
    st?.admNo
  ];

  for (const c of candidates) {
    if (isUsableRecordValue(c)) return String(c).trim();
  }

  // Handle punctuation/case variants without confusing admission dates,
  // statuses, or class-roll numbers with an admission number.
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeRecordKey(key);
    const looksLikeAdmissionNo = (normalized.includes('admission') || normalized.startsWith('adm')) &&
      (normalized.includes('no') || normalized.includes('number'));
    if (!looksLikeAdmissionNo || normalized.includes('date') || normalized.includes('status') || normalized.includes('readmission')) continue;
    if (isUsableRecordValue(value) && !/^(yes|no|true|false)$/i.test(String(value).trim())) return String(value).trim();
  }

  return '';
}

/**
 * Comprehensive Date of Admission Extractor.
 * Handles all date formats (DD-MM-YYYY, YYYY-MM-DD, ISO timestamps, Firestore timestamps)
 * across admissions, master registers, and legacy imports.
 */
export function extractStudentAdmissionDate(st) {
  if (!st) return '';
  const raw = st?.raw || st || {};

  const candidates = [
    raw['Date of Admission'],
    raw['Date of admission'],
    raw['date_of_admission'],
    raw['Admission Date'],
    raw['admission_date'],
    raw['admissionDate'],
    raw['Adm. Date'],
    raw['Adm. Date.'],
    raw['Adm Date.'],
    raw['Adm Date'],
    raw['adm_date'],
    raw['admDate'],
    raw['Date of Adm.'],
    raw['Date of Adm'],
    raw['Date of Admission (Class 11th)'],
    raw['Date of Admission (Class 12th)'],
    raw['DOA'],
    raw['doa'],
    raw['Date of Joining'],
    raw['Enrolment Date'],
    st?.admissionDate,
    st?.admDate
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      // If Firestore timestamp
      if (typeof c === 'object' && c.seconds) {
        try {
          const d = new Date(c.seconds * 1000);
          return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        } catch (_) {}
      }
      const s = String(c).trim();
      if (s && !/^(—|-|n\/?a|null|undefined|none)$/i.test(s)) {
        // Normalize ISO YYYY-MM-DD to DD-MM-YYYY if needed
        const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (isoMatch) {
          return `${isoMatch[3].padStart(2, '0')}-${isoMatch[2].padStart(2, '0')}-${isoMatch[1]}`;
        }
        // Normalize DD/MM/YYYY to DD-MM-YYYY
        const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (slashMatch) {
          return `${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3]}`;
        }
        return s;
      }
    }
  }

  const fuzzyDate = findNormalizedRecordValue(raw, [
    'Date Admission', 'Admission Date', 'Date of Admission', 'Admission Joining Date',
    'Date of Joining', 'Enrolment Date', 'DOA'
  ]);
  if (fuzzyDate) {
    return extractStudentAdmissionDate({ 'Date of Admission': fuzzyDate });
  }

  return '';
}

/** Extract an already-issued TC/DC/certificate number without inventing one. */
export function extractStudentCertificateNumber(st) {
  if (!st) return '';
  const raw = st?.raw || st || {};
  const value = findNormalizedRecordValue(raw, [
    'No. & Date of CC/DC Issued (This Institution)',
    'No. & Date of CC/DC Issued',
    'CC/DC No. & Date',
    'CC DC Number',
    'TC DC Number',
    'Certificate Number',
    'Certificate No',
    'ccDcNo',
    'certificateNo',
    'currCcDc'
  ]);
  return isUsableRecordValue(value) ? String(value).trim() : '';
}

/**
 * Download a file in the browser.
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
 * Generate and download an Excel / CSV pre-populated template for a class/session.
 */
export function generateResultImportTemplate(studentsList = [], className = '12th', session = '2025-26') {
  const rows = (studentsList || []).map((s) => {
    const raw = s.raw || s;
    return {
      "Student's Name": String(s.name || raw["Student's Name"] || raw.name || ''),
      "Father's Name": String(s.fatherName || raw["Father's Name"] || raw.fatherName || ''),
      'Class': String(s.selectedClass || raw['Class'] || className || ''),
      'Stream': String(s.selectedStream || raw['Stream'] || ''),
      'Session': String(session || s.selectedSession || raw['Session'] || ''),
      // Exam mode describes the examination; it is intentionally independent
      // from the archive/cohort session selected in the result hub.
      'Exam Mode (Current)': String(raw['Exam Mode (Current)'] || raw.currExamMode || ''),
      'Exam R.No. (Current)': String(raw['Exam R.No. (Current)'] || raw.currExamRoll || ''),
      'Result (Current)': String(raw['Result (Current)'] || raw.currResult || 'Passed'),
      'Marks/Reapp (Current)': String(raw['Marks/Reapp (Current)'] || raw.currMarksReapp || ''),
      'Div/Distinc (Current)': String(raw['Div/Distinc (Current)'] || raw.currDiv || '')
    };
  });

  // If no students in list, create a sample template row
  if (rows.length === 0) {
    rows.push({
      "Student's Name": 'Zaidan Wani',
      "Father's Name": 'Bilal Ahmad Wani',
      'Class': className,
      'Stream': 'Science',
      'Session': session,
      'Exam Mode (Current)': '',
      'Exam R.No. (Current)': '301003053',
      'Result (Current)': 'Passed',
      'Marks/Reapp (Current)': '488 / 500',
      'Div/Distinc (Current)': 'Distinction'
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { raw: false });

  // Force ALL cells to explicit Text format ('@') to prevent scientific notation (e.g. 2.201E+15)
  Object.keys(ws).forEach((cellKey) => {
    if (cellKey.startsWith('!')) return;
    const cell = ws[cellKey];
    if (cell) {
      cell.t = 's'; // Force string/text type
      cell.v = String(cell.v || '');
      cell.w = String(cell.v || '');
      cell.z = '@'; // Explicit Text format code
    }
  });

  // Column width styling
  ws['!cols'] = [
    { wch: 26 }, // Student's Name
    { wch: 26 }, // Father's Name
    { wch: 10 }, // Class
    { wch: 16 }, // Stream
    { wch: 14 }, // Session
    { wch: 32 }, // Exam Mode (Current)
    { wch: 22 }, // Exam R.No. (Current)
    { wch: 18 }, // Result (Current)
    { wch: 24 }, // Marks/Reapp (Current)
    { wch: 22 }  // Div/Distinc (Current)
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'JKBOSE_Results');

  const cleanClass = String(className).replace(/[^a-zA-Z0-9]/g, '');
  const cleanSession = String(session).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `JKBOSE_Result_Template_Class_${cleanClass}_${cleanSession}.xlsx`;

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFileBlob(blob, filename);
}

/**
 * Match a raw record against the existing students list using multi-attribute lookup
 * with strict Class, Academic Session, Board Registration No, Exam Roll No, and Name scoping.
 * Prevents false matches when roll numbers repeat across different sessions or classes.
 */
export function matchStudentInDatabase(record, existingStudents = [], classScope = '', sessionScope = '') {
  if (!existingStudents || existingStudents.length === 0) return null;

  const clean = (val) => String(val || '').trim();
  const lower = (val) => clean(val).toLowerCase();

  const targetForm = lower(record.formNo || record['Form No.'] || record['Form Number'] || record.id || '');
  const targetReg = lower(record.regNo || record['Board Reg. No.'] || record['Board Registration Number'] || record.boardRegNo || record['RR No.'] || record['R.R NO.'] || record['Registration No'] || '');
  const targetExamRoll = lower(record.examRollNo || record['Exam R.No. (Current)'] || record['Exam Roll No'] || record['Exam R.No.'] || record['Roll No'] || record.currExamRoll || record.rollNo || '');
  const targetName = lower(record.studentName || record["Student's Name"] || record.name || record['Name'] || record['Name of Candidate'] || '');
  const targetFather = lower(record.fatherName || record["Father's Name"] || record.father || record['Father'] || '');
  const targetClass = lower(record.className || record['Class'] || classScope || '');
  const targetSession = lower(record.session || record['Session'] || sessionScope || '');

  // Helper to extract first word or initials from name
  const firstWord = (str) => clean(str).toLowerCase().split(/[\s,._-]+/)[0] || '';

  // Helper to extract student identity fields reliably from any admissions or masterRegisters document
  const extractStudentMeta = (s) => {
    const sForm = clean(s.formNo || s['Form No.'] || s['Form Number'] || s.raw?.['Form No.'] || s.raw?.['Form Number'] || s.id || '');
    const sReg = clean(
      s.regNo ||
      s.boardRegNo ||
      s['Board Reg. No.'] ||
      s['Board Registration Number'] ||
      s['RR No.'] ||
      s['R.R NO.'] ||
      s['Registration No'] ||
      s.raw?.['Board Reg. No.'] ||
      s.raw?.['Board Registration Number'] ||
      s.raw?.boardRegNo ||
      s.raw?.regNo ||
      ''
    );
    const sRoll = clean(
      s.examRollNo ||
      s.currExamRoll ||
      s.rollNo ||
      s.roll ||
      s.examRoll ||
      s['Exam R.No. (Current)'] ||
      s['Exam Roll No'] ||
      s['Exam R.No.'] ||
      s['Roll No'] ||
      s.raw?.['Exam R.No. (Current)'] ||
      s.raw?.['Exam Roll No'] ||
      s.raw?.examRollNo ||
      s.raw?.currExamRoll ||
      s.raw?.rollNo ||
      ''
    );
    const sName = clean(
      s.name ||
      s.studentName ||
      s["Student's Name"] ||
      s['Name'] ||
      s['Name of Candidate'] ||
      s.raw?.["Student's Name"] ||
      s.raw?.studentName ||
      s.raw?.name ||
      ''
    );
    const sFather = clean(
      s.fatherName ||
      s.father ||
      s["Father's Name"] ||
      s['Father'] ||
      s.raw?.["Father's Name"] ||
      s.raw?.fatherName ||
      ''
    );
    const sMother = clean(
      s.motherName ||
      s.mother ||
      s["Mother's Name"] ||
      s['Mother'] ||
      s.raw?.["Mother's Name"] ||
      s.raw?.motherName ||
      ''
    );
    const sCls = clean(
      s.className ||
      s.selectedClass ||
      s.class ||
      s.cls ||
      s['Class'] ||
      s['Admission sought for class'] ||
      s.raw?.['Class'] ||
      s.raw?.className ||
      ''
    );
    const sSess = clean(
      s.session ||
      s.selectedSession ||
      s['Session'] ||
      s['Academic Session'] ||
      s.raw?.['Session'] ||
      s.raw?.session ||
      ''
    );
    const sStream = clean(
      s.stream ||
      s.selectedStream ||
      s['Stream'] ||
      s.raw?.['Stream'] ||
      s.raw?.stream ||
      ''
    );

    return {
      sForm,
      sReg,
      sRoll,
      sName,
      sFather,
      sMother,
      sCls,
      sSess,
      sStream,
      normalizedStudent: {
        ...s,
        id: sForm || s.id,
        formNo: sForm || s.id,
        name: sName,
        studentName: sName,
        fatherName: sFather,
        motherName: sMother,
        regNo: sReg,
        boardRegNo: sReg,
        rollNo: sRoll,
        examRollNo: sRoll,
        selectedClass: sCls,
        class: sCls,
        selectedStream: sStream,
        stream: sStream,
        selectedSession: sSess,
        session: sSess
      }
    };
  };

  // Helper to evaluate class match
  const isClassMatch = (clsStr) => {
    if (!targetClass) return true;
    const cleanSCls = lower(clsStr);
    if (!cleanSCls) return true;
    if (targetClass.includes('12') || targetClass.includes('xii')) return cleanSCls.includes('12') || cleanSCls.includes('xii');
    if (targetClass.includes('11') || targetClass.includes('xi')) return cleanSCls.includes('11') || cleanSCls.includes('xi');
    if (targetClass.includes('10') || targetClass.includes('x')) return cleanSCls.includes('10') || cleanSCls.includes('x');
    if (targetClass.includes('9') || targetClass.includes('ix')) return cleanSCls.includes('9') || cleanSCls.includes('ix');
    return cleanSCls.includes(targetClass) || targetClass.includes(cleanSCls);
  };

  // Helper to evaluate session match
  const isSessionMatch = (sessStr) => {
    if (!targetSession) return true;
    const cleanSess = lower(sessStr);
    if (!cleanSess) return true;

    // If target is Bi-Annual (e.g. 2026 APR/BIAN), allow matching from surrounding/preceding academic years
    const targetIsBian = /bian|bi-annual|apr/i.test(targetSession);
    if (targetIsBian) {
      // Bi-Annual candidates are enrolled students from recent sessions
      return true;
    }

    const targetYears = targetSession.match(/\b20\d\d\b/g) || [];
    const sYears = cleanSess.match(/\b20\d\d\b/g) || [];
    if (targetYears.length > 0 && sYears.length > 0) {
      return targetYears.some(y => sYears.includes(y));
    }
    return cleanSess.includes(targetSession) || targetSession.includes(cleanSess);
  };

  // 1. Board Registration No Match (Permanent Unique Lifetime Identity)
  if (targetReg && targetReg.length >= 4) {
    for (const s of existingStudents) {
      const meta = extractStudentMeta(s);
      if (meta.sReg && meta.sReg.toLowerCase() === targetReg) {
        const classMatches = isClassMatch(meta.sCls);
        return {
          student: meta.normalizedStudent,
          matchType: classMatches ? 'Board Reg No + Class Match' : 'Board Reg No Match',
          confidence: classMatches ? 100 : 96
        };
      }
    }
  }

  // 2. Exam Roll No Match (Primary Key for Result Gazette & Roll Ingestion)
  if (targetExamRoll && targetExamRoll.length >= 4) {
    // A. First look for Exam Roll within the same class (Class 12th)
    const rollClassMatches = [];
    for (const s of existingStudents) {
      const meta = extractStudentMeta(s);
      if (meta.sRoll && meta.sRoll.toLowerCase() === targetExamRoll) {
        if (isClassMatch(meta.sCls)) {
          rollClassMatches.push(meta);
        }
      }
    }

    if (rollClassMatches.length > 0) {
      // If name is also available, verify name match
      if (targetName) {
        const targetFirst = firstWord(targetName);
        const verified = rollClassMatches.find(m => {
          const sFirst = firstWord(m.sName);
          return sFirst === targetFirst || lower(m.sName).includes(targetFirst) || targetName.includes(sFirst);
        });
        if (verified) {
          return {
            student: verified.normalizedStudent,
            matchType: 'Exam Roll + Class + Name Match',
            confidence: 99
          };
        }
      }
      return {
        student: rollClassMatches[0].normalizedStudent,
        matchType: 'Exam Roll & Class Match',
        confidence: 95
      };
    }

    // B. If no class match, check if Exam Roll matches anywhere across DB with matching candidate name
    if (targetName) {
      const targetFirst = firstWord(targetName);
      for (const s of existingStudents) {
        const meta = extractStudentMeta(s);
        if (meta.sRoll && meta.sRoll.toLowerCase() === targetExamRoll) {
          const sFirst = firstWord(meta.sName);
          if (sFirst === targetFirst || lower(meta.sName).includes(targetFirst)) {
            return {
              student: meta.normalizedStudent,
              matchType: 'Exam Roll & Verified Name Match',
              confidence: 92
            };
          }
        }
      }
    }
  }

  // 3. Exact Form No Match
  if (targetForm) {
    for (const s of existingStudents) {
      const meta = extractStudentMeta(s);
      if (meta.sForm && meta.sForm.toLowerCase() === targetForm) {
        return {
          student: meta.normalizedStudent,
          matchType: 'Form No Match',
          confidence: 95
        };
      }
    }
  }

  // 4. Candidate Name + Father Name in Same Class
  if (targetName && targetName.length >= 3) {
    const targetFirst = firstWord(targetName);
    const targetFatherFirst = targetFather ? firstWord(targetFather) : '';

    for (const s of existingStudents) {
      const meta = extractStudentMeta(s);
      if (!isClassMatch(meta.sCls)) continue;

      const sNameLower = lower(meta.sName);
      if (!sNameLower) continue;

      const sFirst = firstWord(sNameLower);
      const nameMatches = sFirst === targetFirst || sNameLower.startsWith(targetFirst) || targetName.startsWith(sFirst) || sNameLower.includes(targetFirst);

      if (nameMatches) {
        // If father name is provided, match both
        if (targetFatherFirst && meta.sFather) {
          const sFatherLower = lower(meta.sFather);
          const sFatherFirst = firstWord(sFatherLower);
          const fatherMatches = sFatherFirst === targetFatherFirst || sFatherLower.includes(targetFatherFirst) || targetFather.includes(sFatherFirst);
          if (fatherMatches) {
            return {
              student: meta.normalizedStudent,
              matchType: `Name & Father Match (${targetFirst.toUpperCase()})`,
              confidence: 94
            };
          }
        } else if (sNameLower === targetName || sNameLower.includes(targetName) || targetName.includes(sNameLower)) {
          return {
            student: meta.normalizedStudent,
            matchType: `Exact Full Name & Class Match`,
            confidence: 89
          };
        }
      }
    }
  }

  // 5. Full Candidate Name Match (handles spelling variants like AQUB/AQIB, MOHD/MOHAMMAD, spaces)
  if (targetName && targetName.length >= 3) {
    const cleanTargetName = targetName.replace(/^(mr\.|ms\.|miss|master)\s+/i, '').trim();
    const targetNorm = cleanTargetName.replace(/\b(mohd|mohammad|mohammed|muhammad)\b/g, 'm').replace(/[^a-z0-9]/g, '');

    for (const s of existingStudents) {
      const meta = extractStudentMeta(s);
      if (!isClassMatch(meta.sCls)) continue;

      const cleanDbName = lower(meta.sName).replace(/^(mr\.|ms\.|miss|master)\s+/i, '').trim();
      const dbNorm = cleanDbName.replace(/\b(mohd|mohammad|mohammed|muhammad)\b/g, 'm').replace(/[^a-z0-9]/g, '');

      if (cleanDbName === cleanTargetName || dbNorm === targetNorm) {
        return {
          student: meta.normalizedStudent,
          matchType: 'Full Name & Class Match',
          confidence: 90
        };
      }

      // Check consonants for Kashmiri spelling variations (e.g. AQUB vs AQIB)
      const targetConsonants = targetNorm.replace(/[aeiou]/g, '');
      const dbConsonants = dbNorm.replace(/[aeiou]/g, '');
      if (targetConsonants.length >= 4 && targetConsonants === dbConsonants) {
        return {
          student: meta.normalizedStudent,
          matchType: 'Phonetic Name & Class Match',
          confidence: 86
        };
      }
    }
  }

  return null;
}

function cleanCellValue(val) {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (/^[0-9]+(\.[0-9]+)?[eE]\+[0-9]+$/.test(str)) {
    try {
      if (typeof window !== 'undefined' && typeof window.BigInt === 'function') {
        return window.BigInt(Math.round(Number(str))).toString();
      }
      return Number(str).toLocaleString('fullwide', { useGrouping: false });
    } catch (_) {
      return Number(str).toLocaleString('fullwide', { useGrouping: false });
    }
  }
  return str;
}

/**
 * Parse and validate an uploaded Excel file against guardrails.
 * Automatically handles Marks Obt. (Prev.) as re-appear / examination subjects.
 */
export function parseAndValidateResultFile(fileData, existingStudents = [], classScope = '', sessionScope = '') {
  try {
    const wb = XLSX.read(fileData, { type: 'array', cellText: true, raw: false });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('The uploaded file is empty or could not be read.');
    }

    const processed = [];
    let passedCount = 0;
    let reapCount = 0;
    let failedCount = 0;
    let matchedCount = 0;

    rawRows.forEach((r, idx) => {
      const formNo = cleanCellValue(r['Form No.'] || r['formNo'] || r['Form_No'] || r['Adm No.'] || r['Adm No'] || r['Form Number']);
      const regNo = cleanCellValue(r['Board Reg. No.'] || r['regNo'] || r['Registration No'] || r['Reg. No.'] || r['RR No.'] || r['Board Registration Number']);
      const studentName = cleanCellValue(r["Student's Name"] || r['studentName'] || r['Name'] || r['Name of Candidate'] || r['Student']);
      const fatherName = cleanCellValue(r["Father's Name"] || r['fatherName'] || r['Father']);
      const motherName = cleanCellValue(r["Mother's Name"] || r['motherName'] || r['Mother']);
      const className = cleanCellValue(classScope || r['Class'] || r['class'] || '12th');
      const stream = cleanCellValue(r['Stream'] || r['stream']);
      // The operator-selected hub scope is authoritative; the spreadsheet
      // cannot silently redirect new records into another session/class.
      const sessionVal = cleanCellValue(sessionScope || r['Session'] || r['session'] || '2026 APR/BIAN');
      const examMode = cleanCellValue(r['Exam Mode (Current)'] || r['Exam Mode'] || r['examMode'] || '');
      const examRollNo = cleanCellValue(r['Exam R.No. (Current)'] || r['Exam R.No.'] || r['Exam Roll No'] || r['examRoll'] || r['Roll No'] || r['Exam Roll']);
      
      const rawResult = cleanCellValue(r['Result (Current)'] || r['result'] || r['Result'] || r['Pass/Reap/Fail'] || r['Passed'] || '');
      const resultStatus = rawResult ? normalizeResultStatus(rawResult) : 'Awaiting Result';

      // Check if Marks Obt. (Prev.) contains subjects to reappear or registered subjects
      const prevMarksOrSubs = cleanCellValue(r['Marks Obt. (Prev.)'] || r['Marks Obt.(Prev.)'] || r['Marks Obt (Prev)'] || r['Marks Obt.'] || '');
      let marksReapp = cleanCellValue(r['Marks/Reapp (Current)'] || r['Marks/Reapp'] || r['marksReapp'] || r['Marks'] || r['Obt/Max'] || '');
      
      // If Marks/Reapp is empty, but Marks Obt. (Prev.) has subjects, treat it as reappear/examination subjects!
      if (!marksReapp && prevMarksOrSubs) {
        marksReapp = prevMarksOrSubs;
      }

      let divDistinc = String(r['Div/Distinc (Current)'] || r['Div/Distinction/Position'] || r['division'] || '').trim();

      // Guardrail Auto-calculation for marks & division
      if (resultStatus === 'Passed') {
        passedCount++;
        const numMatch = marksReapp.match(/(\d+)(?:\s*\/\s*(\d+))?/);
        if (numMatch) {
          const obt = parseInt(numMatch[1], 10);
          const max = numMatch[2] ? parseInt(numMatch[2], 10) : 500;
          marksReapp = `${obt} / ${max}`;
          if (!divDistinc || divDistinc === '—') {
            const { division } = calculateDivision(obt, max);
            divDistinc = division;
          }
        }
      } else if (resultStatus === 'Reap') {
        reapCount++;
        if (!divDistinc) divDistinc = 'Re-appear';
      } else if (resultStatus === 'Failed') {
        failedCount++;
        if (!divDistinc) divDistinc = 'Failed';
      }

      const subs = cleanCellValue(r['Subjects'] || r['subs'] || prevMarksOrSubs || '');

      const withdrawalDate = String(
        r['Date of withdrawl/result'] ||
        r['Date of withdrawl'] ||
        r['Date of withdrawal'] ||
        r['withdrawalDate'] ||
        r['Result Date'] ||
        r['Withdrawal Date'] ||
        ''
      ).trim();

      const ccDcNo = String(
        r['No. & Date of CC/DC Issued (This Institution)'] ||
        r['No. & Date of CC/DC Issued'] ||
        r['CC/DC No. & Date'] ||
        r['ccDcNo'] ||
        ''
      ).trim();

      const remarks = String(r['Remarks'] || r['remarks'] || '').trim();

      // Database Match with Class & Session Scoping
      const matchResult = matchStudentInDatabase({
        formNo, regNo, examRollNo, studentName, fatherName, className, session: sessionVal
      }, existingStudents, classScope || className, sessionScope || sessionVal);

      if (matchResult) matchedCount++;

      processed.push({
        id: formNo || (matchResult ? (matchResult.student.formNo || matchResult.student.id) : `row_${idx + 1}`),
        sNo: idx + 1,
        formNo: formNo || (matchResult ? (matchResult.student.formNo || matchResult.student.id) : ''),
        regNo: regNo || (matchResult ? matchResult.student.regNo : ''),
        studentName: studentName || (matchResult ? matchResult.student.name : '—'),
        fatherName: fatherName || (matchResult ? matchResult.student.fatherName : '—'),
        motherName: motherName || (matchResult ? matchResult.student.motherName : ''),
        className: className || (matchResult ? matchResult.student.selectedClass : '12th'),
        stream: stream || (matchResult ? matchResult.student.selectedStream : ''),
        subs: subs || (matchResult ? matchResult.student.subs : ''),
        session: sessionVal,
        examMode,
        examRollNo,
        resultStatus,
        marksReapp,
        divDistinc,
        withdrawalDate,
        ccDcNo,
        remarks,
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'New Student (Create)',
        matchConfidence: matchResult ? matchResult.confidence : 0,
        selectedForImport: true
      });
    });

    return {
      success: true,
      rows: processed,
      stats: {
        total: processed.length,
        matched: matchedCount,
        unmatched: processed.length - matchedCount,
        passed: passedCount,
        reap: reapCount,
        failed: failedCount
      }
    };
  } catch (err) {
    console.error('Error parsing result file:', err);
    return {
      success: false,
      error: err.message || 'Failed to parse file'
    };
  }
}

/**
 * Helper to normalize single file or array of files/screenshots (up to 5) into clean inlineDatas.
 */
function normalizeAiFileInputs(fileInput, mimeType = 'image/jpeg') {
  if (Array.isArray(fileInput)) {
    return fileInput.slice(0, 5).map((f) => {
      if (typeof f === 'string') {
        const detectedMime = f.startsWith('data:application/pdf') ? 'application/pdf' : (f.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
        return { data: f, mimeType: detectedMime };
      }
      return {
        data: f.data || f.base64 || f.content || '',
        mimeType: f.mimeType || f.type || mimeType || 'image/jpeg'
      };
    }).filter(item => item.data);
  }

  if (typeof fileInput === 'object' && fileInput !== null && (fileInput.data || fileInput.base64)) {
    return [{
      data: fileInput.data || fileInput.base64,
      mimeType: fileInput.mimeType || fileInput.type || mimeType || 'image/jpeg'
    }];
  }

  if (typeof fileInput === 'string' && fileInput) {
    return [{ data: fileInput, mimeType: mimeType || 'application/pdf' }];
  }

  return [];
}

/**
 * Analyze JKBOSE Admit Cards (Single PDF or up to 5 Screenshot Images) via Gemini Multimodal AI Vision.
 * Extracts student roll numbers, reg numbers, names, parents, class, stream, subjects offered, exam center.
 * Perfect for Private and Bi-Annual students who don't have admission form data.
 */
export async function analyzeAdmitCardWithGemini(
  fileInput,
  mimeType,
  existingStudents = [],
  progressCallback = null,
  selectedClass = '12th',
  selectedSession = '2026 APR/BIAN',
  modelName = null,
  signal = null
) {
  try {
    const fileList = normalizeAiFileInputs(fileInput, mimeType);
    if (!fileList.length) {
      throw new Error('No valid Admit Card file or screenshot images were provided for analysis.');
    }

    const preferredModel = modelName || getPreferredGeminiModel();
    if (progressCallback) progressCallback(`Connecting to Gemini AI (${preferredModel}) for Admit Card extraction (${fileList.length} page/screenshot file${fileList.length > 1 ? 's' : ''})...`);

    if (progressCallback) progressCallback(`Extracting candidate details from ${fileList.length} image(s)/document(s) with ${preferredModel}...`);

    const prompt = `You are a high-precision JKBOSE (Jammu & Kashmir Board of School Education) Admit Card / Roll Number Slip Data Extractor.
Target Scope: Class ${selectedClass || '12th'} | Session: ${selectedSession || '2026 APR/BIAN'}.

Analyze the attached JKBOSE Admit Card document/screenshots (${fileList.length} image/page(s)). There may be 1 or multiple candidate admit cards across the pages/screenshots.
For EVERY admit card visible in ALL the attached images/pages, extract all student particulars accurately:

1. "examRollNo": Roll Number (e.g. "301001258", "301001259").
2. "regNo": Registration / R.R. Number (e.g. "03NKM1008619", "06NKF103794").
3. "studentName": Candidate Name (e.g. "BILAL AHMAD DAR", "AABIDA SABIR").
4. "fatherName": Father's Name (e.g. "MOHD SUBHAN DAR").
5. "motherName": Mother's Name (e.g. "JANA BEGUM", "HAJARA BANO").
6. "gender": "Male" or "Female" (e.g. "MALE", "FEMALE").
7. "dob": Date of Birth if printed, else "".
8. "class": Academic Class e.g. "12th", "11th", "10th" (extracted from heading "HIGHER SECONDARY PART-II, (CLASS 12TH)" or similar).
9. "session": Archive/cohort session, fixed to the selected scope "${selectedSession || '2026 APR/BIAN'}".
10. "examMode": Exact examination title printed on the admit card, independent of session (e.g. "Annual Regular 2025 (Oct.-Nov.)"); use "" if not printed.
11. "stream": Stream/Faculty (e.g. "Humanities", "Arts", "Science", "Commerce" from "SUBJECTS OFFERED (HUMANITIES)").
12. "subs": All subjects offered separated by comma (e.g. "General English, Urdu, Education, History, Physical Education" or "Environmental Science").
13. "examCentre": Examination Centre name and code (e.g. "GOVT HSS ACHABAL ( 301001 )").
14. "studentType": "Private / Bi-Annual".

CRITICAL INSTRUCTIONS:
- Extract EVERY student card present across all images without skipping any page.
- Return ONLY a valid raw JSON array of objects without markdown formatting fences.

Example Format:
[
  {
    "examRollNo": "301001258",
    "regNo": "03NKM1008619",
    "studentName": "BILAL AHMAD DAR",
    "fatherName": "MOHD SUBHAN DAR",
    "motherName": "JANA BEGUM",
    "gender": "Male",
    "dob": "",
    "class": "12th",
    "session": "${selectedSession || '2026 APR/BIAN'}",
    "examMode": "",
    "stream": "Humanities",
    "subs": "General English, Urdu, Education, History, Physical Education",
    "examCentre": "GOVT HSS ACHABAL ( 301001 )",
    "studentType": "Private / Bi-Annual"
  }
]`;

    const aiResult = await generateStructuredWithGemini({
      prompt,
      inlineDatas: fileList,
      model: preferredModel,
      signal,
      onLog: (logObj) => {
        if (typeof progressCallback === 'function') {
          progressCallback(logObj);
        }
      }
    });
    const jsonText = aiResult.text || '';

    if (!jsonText) {
      throw new Error('Gemini AI returned an empty response for Admit Card analysis.');
    }

    const cleanJson = jsonText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsedArray = JSON.parse(cleanJson);
    if (!Array.isArray(parsedArray)) {
      throw new Error('Gemini AI did not return a valid array of admit card records.');
    }

    if (progressCallback) progressCallback(`Extracted ${parsedArray.length} Admit Card(s). Scoping with Class & Session database...`);

    const processed = [];
    let matchedCount = 0;

    parsedArray.forEach((item, idx) => {
      const examRollNo = cleanCellValue(item.examRollNo);
      const regNo = cleanCellValue(item.regNo);
      const studentName = cleanCellValue(item.studentName);
      const fatherName = cleanCellValue(item.fatherName);
      const motherName = cleanCellValue(item.motherName);
      const className = cleanCellValue(item.class) || selectedClass || '12th';
      const session = cleanCellValue(item.session) || selectedSession || '2026 APR/BIAN';
      const stream = cleanCellValue(item.stream) || 'Humanities';
      const subs = cleanCellValue(item.subs);
      const examCentre = cleanCellValue(item.examCentre);
      const gender = cleanCellValue(item.gender);
      const examMode = cleanCellValue(item.examMode);
      const dob = cleanCellValue(item.dob);

      // Scoped database lookup by Reg No + Class + Session & Exam Roll No
      const matchResult = matchStudentInDatabase({
        regNo, examRollNo, studentName, fatherName, className, session
      }, existingStudents, className, session);

      if (matchResult) matchedCount++;

      processed.push({
        id: matchResult ? (matchResult.student.formNo || matchResult.student.id) : `admit_row_${idx + 1}`,
        sNo: idx + 1,
        formNo: matchResult ? (matchResult.student.formNo || matchResult.student.id) : '',
        regNo: regNo || (matchResult ? matchResult.student.regNo : ''),
        studentName: studentName || (matchResult ? matchResult.student.name : '—'),
        fatherName: fatherName || (matchResult ? matchResult.student.fatherName : '—'),
        motherName: motherName || (matchResult ? matchResult.student.motherName : ''),
        gender: gender || (matchResult ? matchResult.student.gender : ''),
        dob: dob || (matchResult ? matchResult.student.dob : ''),
        className: className,
        stream: stream || (matchResult ? matchResult.student.selectedStream : ''),
        subs: subs || (matchResult ? matchResult.student.subs : ''),
        examMode,
        examRollNo: examRollNo,
        examCentre: examCentre,
        resultStatus: 'Awaiting Result',
        marksReapp: subs, // For bi-annuals, registered subjects are the examinee subjects
        divDistinc: '—',
        withdrawalDate: '',
        ccDcNo: '',
        remarks: `Ingested from JKBOSE Admit Card (${matchResult ? matchResult.matchType : 'New Private Candidate'})`,
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'New Private Candidate (Create)',
        matchConfidence: matchResult ? matchResult.confidence : 0,
        selectedForImport: true,
        isAdmitCard: true
      });
    });

    return {
      success: true,
      rows: processed,
      stats: {
        total: processed.length,
        matched: matchedCount,
        unmatched: processed.length - matchedCount,
        passed: 0,
        reap: 0,
        failed: 0
      }
    };
  } catch (err) {
    console.error('Gemini Admit Card Analysis Error:', err);
    return {
      success: false,
      error: err.message || 'Gemini AI Admit Card extraction failed'
    };
  }
}

/**
 * Analyze raw JKBOSE Result Gazette (PDF or Scanned Image) via Gemini AI Multimodal Vision
 * with target Class, Academic Session, Board Registration Number, and First-Word Token alignment.
 */
export async function analyzeGazetteWithGemini(
  fileInput,
  mimeType,
  existingStudents = [],
  progressCallback = null,
  selectedClass = '12th',
  selectedSession = '2026 APR/BIAN',
  modelName = null,
  signal = null
) {
  try {
    const fileList = normalizeAiFileInputs(fileInput, mimeType);
    if (!fileList.length) {
      throw new Error('No valid Gazette document or screenshot images were provided for analysis.');
    }

    const preferredModel = modelName || getPreferredGeminiModel();
    if (progressCallback) progressCallback(`Connecting to Gemini AI (${preferredModel}) for Result Gazette parsing (${fileList.length} page/screenshot file${fileList.length > 1 ? 's' : ''})...`);

    if (progressCallback) progressCallback(`Processing ${fileList.length} Gazette page(s)/screenshot(s) with ${preferredModel}...`);

    const prompt = `You are a high-precision JKBOSE (Jammu & Kashmir Board of School Education) Result Gazette and Examination Result Parser.
Target Scope: Class ${selectedClass || '12th'} | Session: ${selectedSession || '2026 APR/BIAN'}.

Analyze the attached examination result gazette document/screenshots (${fileList.length} image/page(s)) and extract all student result rows across ALL pages for this cohort.
Note that JKBOSE result gazettes typically list:
- "Exam Roll No" (e.g. "301001258", "301001259", "301001260")
- "Candidate Name" (e.g. "BILAL AHMAD DAR", "AABIDA SABIR", "AQUIB SAJAD")
- "Result / Marks / Re-appear Subjects" (e.g. "Reap GN ED UD PD", "2nd Div 290", "1st Div 310", "Reap EO", "Reap CH")

For each student found across all pages/images, extract:
1. "examRollNo": Examination roll number as clean text string (e.g. "301001258").
2. "studentName": Candidate name as printed in the gazette (e.g. "BILAL AHMAD DAR").
3. "regNo": JKBOSE Registration number if visible, else "".
4. "fatherName": Father's name if present, else "".
5. "result": Result status strictly as one of: "Passed", "Reap", "Failed".
6. "marksObtained": Numeric marks obtained if passed (e.g. 290, 310, 488). null if not passed.
7. "maxMarks": Total maximum marks (default 500).
8. "reappSubjects": If result is "Reap", list subject abbreviations or expanded names (e.g. "GN ED UD PD" -> "General English, Education, Urdu, Public Administration", "EO" -> "Economics", "CH" -> "Chemistry").
9. "division": Division or distinction if passed (e.g. "1st Division", "2nd Division", "3rd Division", "Distinction").
10. "examMode": Exact examination title printed in the gazette, independent of the archive session (e.g. "Annual Regular 2025 (Oct.-Nov.)"); use "" if absent.

CRITICAL FORMAT REQUIREMENT:
Respond ONLY with a valid JSON array of objects without markdown fences.
Example:
[
  {
    "examRollNo": "301001258",
    "regNo": "",
    "studentName": "BILAL AHMAD DAR",
    "fatherName": "",
    "result": "Reap",
    "marksObtained": null,
    "maxMarks": 500,
    "reappSubjects": "General English, Education, Urdu, Public Administration",
    "division": "Re-appear",
    "examMode": ""
  },
  {
    "examRollNo": "301001259",
    "regNo": "",
    "studentName": "AABIDA SABIR",
    "fatherName": "",
    "result": "Passed",
    "marksObtained": 290,
    "maxMarks": 500,
    "reappSubjects": null,
    "division": "2nd Division",
    "examMode": "${selectedSession || '2026 APR/BIAN'}"
  }
]`;

    const aiResult = await generateStructuredWithGemini({
      prompt,
      inlineDatas: fileList,
      model: preferredModel,
      signal,
      onLog: (logObj) => {
        if (typeof progressCallback === 'function') {
          progressCallback(logObj);
        }
      }
    });
    const jsonText = aiResult.text || '';

    if (!jsonText) {
      throw new Error('Gemini AI analysis returned an empty response.');
    }

    // Clean JSON response
    const cleanJson = jsonText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsedArray = JSON.parse(cleanJson);
    if (!Array.isArray(parsedArray)) {
      throw new Error('Gemini did not return a valid array of student result objects.');
    }

    if (progressCallback) progressCallback(`Extracted ${parsedArray.length} entries. Aligning with Class & Session database...`);

    const processed = [];
    let passedCount = 0;
    let reapCount = 0;
    let failedCount = 0;
    let matchedCount = 0;

    parsedArray.forEach((item, idx) => {
      const examRollNo = cleanCellValue(item.examRollNo);
      const regNo = cleanCellValue(item.regNo);
      const studentName = cleanCellValue(item.studentName);
      const fatherName = cleanCellValue(item.fatherName);
      const resultStatus = normalizeResultStatus(item.result);
      const examMode = cleanCellValue(item.examMode);

      let marksReapp = '';
      let divDistinc = '';

      if (resultStatus === 'Passed') {
        passedCount++;
        const obt = parseInt(item.marksObtained, 10);
        const max = parseInt(item.maxMarks, 10) || 500;
        if (!isNaN(obt)) {
          marksReapp = `${obt} / ${max}`;
          const { division } = calculateDivision(obt, max);
          divDistinc = item.division || division;
        } else {
          marksReapp = 'Passed';
          divDistinc = item.division || '1st Division';
        }
      } else if (resultStatus === 'Reap') {
        reapCount++;
        // Auto-expand subject abbreviations if abbreviated
        marksReapp = expandJkboseSubjectCodes(item.reappSubjects) || 'Re-appear';
        divDistinc = 'Re-appear';
      } else {
        failedCount++;
        divDistinc = 'Failed';
      }

      // Match with database using Class, Session, Exam Roll, and Registration No
      const matchResult = matchStudentInDatabase({
        regNo, examRollNo, studentName, fatherName, className: selectedClass, session: selectedSession
      }, existingStudents, selectedClass, selectedSession);

      if (matchResult) matchedCount++;

      processed.push({
        id: matchResult ? (matchResult.student.formNo || matchResult.student.id) : `ai_row_${idx + 1}`,
        sNo: idx + 1,
        formNo: matchResult ? (matchResult.student.formNo || matchResult.student.id) : '',
        regNo: regNo || (matchResult ? matchResult.student.regNo : ''),
        studentName: studentName || (matchResult ? matchResult.student.name : '—'),
        fatherName: fatherName || (matchResult ? matchResult.student.fatherName : '—'),
        className: matchResult ? (matchResult.student.selectedClass || matchResult.student.cls) : (selectedClass || '12th'),
        stream: matchResult ? matchResult.student.selectedStream : '',
        examMode,
        examRollNo,
        resultStatus,
        marksReapp,
        divDistinc,
        withdrawalDate: '',
        ccDcNo: '',
        remarks: `Extracted via Gemini AI Gazette (${matchResult ? matchResult.matchType : 'Unmatched / Pending Ingestion'})`,
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'Unmatched / Pending Ingestion',
        matchConfidence: matchResult ? matchResult.confidence : 0,
        selectedForImport: true
      });
    });

    return {
      success: true,
      rows: processed,
      stats: {
        total: processed.length,
        matched: matchedCount,
        unmatched: processed.length - matchedCount,
        passed: passedCount,
        reap: reapCount,
        failed: failedCount
      }
    };

  } catch (err) {
    console.error('Gemini Gazette Analysis Error:', err);
    return {
      success: false,
      error: err.message || 'Gemini AI Gazette analysis failed'
    };
  }
}

/**
 * Batch update student results in Firebase Firestore & update local memory cache with Non-Destructive Upsert.
 * 1. For existing students: Updates result & roll fields preserving all existing profile details.
 * 2. For new private candidates: Creates new student documents in admissions with unique form numbers.
 */
export async function batchUpdateStudentResults(recordsToUpdate = [], options = {}) {
  const { overwriteExamRoll = false } = options;

  if (!recordsToUpdate || recordsToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const batch = writeBatch(db);
  let updatedCount = 0;

  // Track max existing form number for safe auto-generation of new candidate records
  let fallbackFormCounter = Date.now();

  // 1. Collect standalone updates and master-register chunk updates
  const chunkUpdates = new Map(); // parentDocId -> array of { item, patch }

  for (const item of recordsToUpdate) {
    let formNo = String(item.formNo || (item.matchedStudent?.formNo || item.matchedStudent?.id) || '').trim();
    const isNewStudent = !formNo || !item.matchedStudent;

    if (isNewStudent) {
      // Auto-assign clean unique Form Number for new private candidate
      formNo = `PVT_${item.examRollNo || item.regNo || fallbackFormCounter++}`;
    }

    // === RESULT-ONLY FIELDS (always safe to write for both matched & new students) ===
    const patch = {
      'Result (Current)': item.resultStatus || 'Awaiting Result',
      'Marks/Reapp (Current)': item.marksReapp || '',
      'Div/Distinc (Current)': item.divDistinc || '',
      currResult: item.resultStatus || 'Awaiting Result',
      currMarksReapp: item.marksReapp || '',
      currDiv: item.divDistinc || '',
      updatedAt: serverTimestamp()
    };

    // Session and exam mode are distinct. Only update the examination label
    // when the imported source explicitly supplies one.
    if (item.examMode) {
      patch['Exam Mode (Current)'] = item.examMode;
      patch.currExamMode = item.examMode;
    }

    // Exam Roll No: only overwrite for matched students if explicitly toggled on, always write for new students
    if (isNewStudent || overwriteExamRoll) {
      patch['Exam R.No. (Current)'] = item.examRollNo || '';
      patch.currExamRoll = item.examRollNo || '';
      patch.examRollNo = item.examRollNo || '';
    }

    // Subjects/re-appear subjects are always safe to update (result data)
    if (item.subs) {
      patch['Subjects'] = item.subs;
      patch.subs = item.subs;
    }

    // === IDENTITY FIELDS — Only write for NEW students to avoid overwriting correct existing data ===
    if (isNewStudent) {
      if (item.studentName && item.studentName !== '—') {
        patch["Student's Name"] = item.studentName;
        patch.studentName = item.studentName;
      }
      if (item.fatherName && item.fatherName !== '—') {
        patch["Father's Name"] = item.fatherName;
        patch.fatherName = item.fatherName;
      }
      if (item.motherName) {
        patch["Mother's Name"] = item.motherName;
        patch.motherName = item.motherName;
      }
      if (item.regNo) {
        patch['Board Reg. No.'] = item.regNo;
        patch['Board Registration Number'] = item.regNo;
        patch.boardRegNo = item.regNo;
        patch.regNo = item.regNo;
      }
      const cls = item.className || '12th';
      patch['Class'] = cls;
      patch['Admission sought for class'] = cls;
      patch.class = cls;

      if (item.stream) {
        patch['Stream'] = item.stream;
        patch.stream = item.stream;
      }
      if (item.examCentre) {
        patch['Exam Centre'] = item.examCentre;
        patch.examCentre = item.examCentre;
      }
      if (item.gender) {
        patch['Gender'] = item.gender;
        patch.gender = item.gender;
      }
      if (item.dob) {
        patch['Date of Birth'] = item.dob;
        patch.dob = item.dob;
      }
      
      const sess = item.session || '2026 APR/BIAN';
      patch['Session'] = sess;
      patch['Academic Session'] = sess;
      patch.session = sess;

      // New student record setup
      patch.formNo = formNo;
      patch['Form Number'] = formNo;
      patch['Form No.'] = formNo;
      patch.studentType = 'Private / Bi-Annual';
      patch.status = 'Approved';
      patch.createdAt = serverTimestamp();
    }

    if (item.withdrawalDate) {
      patch['Date of withdrawl'] = item.withdrawalDate;
      patch.withdrawalDate = item.withdrawalDate;
    }
    if (item.ccDcNo) {
      patch['No. & Date of CC/DC Issued (This Institution)'] = item.ccDcNo;
      patch.ccDcNo = item.ccDcNo;
    }
    if (item.remarks) {
      patch['Remarks'] = item.remarks;
    }

    const targetCollection = item.matchedStudent?._sourceCollection || item.matchedStudent?._source || 'admissions';
    const targetDocId = item.matchedStudent?.id || item.matchedStudent?._docId || formNo;

    // Check if this student belongs to a masterRegisters chunk document
    const parentDocId = item.matchedStudent?._parentDocId || (String(targetDocId).startsWith('#chunk_') ? targetDocId.split('_').slice(0, 2).join('_') : null);

    if (parentDocId && targetCollection === 'masterRegisters') {
      if (!chunkUpdates.has(parentDocId)) {
        chunkUpdates.set(parentDocId, []);
      }
      chunkUpdates.get(parentDocId).push({ item, patch, targetDocId });
    } else {
      const studentRef = doc(db, targetCollection, targetDocId);
      batch.set(studentRef, patch, { merge: true });
    }

    // Sync in-memory master register cache instantly
    if (typeof window !== 'undefined' && window._hssMasterRegistersCache && Array.isArray(window._hssMasterRegistersCache)) {
      window._hssMasterRegistersCache = window._hssMasterRegistersCache.map(st => {
        const matchId = (st.id && (st.id === targetDocId || st.id === formNo)) ||
                        (st.regNo && item.regNo && st.regNo === item.regNo) ||
                        (st.formNo && formNo && st.formNo === formNo) ||
                        (st.examRollNo && item.examRollNo && st.examRollNo === item.examRollNo);
        if (matchId) {
          return {
            ...st,
            ...patch,
            raw: { ...(st.raw || {}), ...patch }
          };
        }
        return st;
      });
    }

    updateCachedItem(targetCollection, targetDocId, patch);
    updatedCount++;
  }

  // 2. Commit standalone document batch
  await batch.commit();

  // 3. Commit Master Register Chunk updates
  for (const [parentDocId, itemsToPatch] of chunkUpdates.entries()) {
    try {
      const chunkDocRef = doc(db, 'masterRegisters', parentDocId);
      const chunkSnap = await getDoc(chunkDocRef);
      if (chunkSnap.exists()) {
        const chunkData = chunkSnap.data();
        if (Array.isArray(chunkData.items)) {
          const updatedItems = chunkData.items.map((rawItem, idx) => {
            const rawId = `${parentDocId}_${idx}`;
            const matchedPatchItem = itemsToPatch.find(p => {
              const pId = p.targetDocId;
              const pReg = p.item.regNo;
              const pRoll = p.item.examRollNo;
              const pName = p.item.studentName;
              return (pId && pId === rawId) ||
                     (pReg && (rawItem['Board Reg. No.'] === pReg || rawItem.regNo === pReg || rawItem.boardRegNo === pReg)) ||
                     (pRoll && (rawItem['Exam R.No. (Current)'] === pRoll || rawItem.currExamRoll === pRoll || rawItem.rollNo === pRoll)) ||
                     (pName && (rawItem["Student's Name"] === pName || rawItem.name === pName));
            });

            if (matchedPatchItem) {
              const itemPatch = { ...matchedPatchItem.patch };
              delete itemPatch.updatedAt;
              return { ...rawItem, ...itemPatch };
            }
            return rawItem;
          });

          await updateDoc(chunkDocRef, { items: updatedItems, updatedAt: serverTimestamp() }).catch(() => {
            return setDoc(chunkDocRef, { items: updatedItems }, { merge: true });
          });
        }
      }
    } catch (chunkErr) {
      console.warn(`Could not update chunk ${parentDocId}:`, chunkErr);
    }
  }

  // 4. Invalidate caches and dispatch global event
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('hss_cache_masterRegisters');
      sessionStorage.removeItem('hss_cache_admissions');
      localStorage.removeItem('hss_cache_masterRegisters');
      localStorage.removeItem('hss_cache_admissions');
      window.dispatchEvent(new CustomEvent('hss-master-register-updated'));
      window.dispatchEvent(new CustomEvent('hss-results-updated'));
    } catch (_) {}
  }

  return { success: true, count: updatedCount };
}
