// =================================================================
// HSS SHANGUS — JKBOSE Exam Result Ingestion & Template Manager
// Supports Excel/CSV Template Export, File Parsing, Gemini AI PDF
// Gazette Analysis, Fuzzy Database Matching, and Firestore Sync.
// =================================================================

import * as XLSX from 'xlsx';
import { db } from '../services/firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { updateCachedItem } from '../services/dbCache';
import { fetchCloudGeminiKeys, getPreferredGeminiModel } from '../services/geminiLetterService';

/**
 * Standard JKBOSE Subject Code Definitions
 */
export const JKBOSE_SUBJECT_CODES = [
  { code: 'GN', name: 'General English', category: 'Language' },
  { code: 'PH', name: 'Physics', category: 'Science' },
  { code: 'CH', name: 'Chemistry', category: 'Science' },
  { code: 'BI', name: 'Biology', category: 'Science' },
  { code: 'MA', name: 'Mathematics', category: 'Science/General' },
  { code: 'UR', name: 'Urdu', category: 'Language' },
  { code: 'AR', name: 'Arabic', category: 'Language' },
  { code: 'PS', name: 'Political Science', category: 'Arts/Humanities' },
  { code: 'HS', name: 'History', category: 'Arts/Humanities' },
  { code: 'EC', name: 'Economics', category: 'Arts/Commerce' },
  { code: 'SO', name: 'Sociology', category: 'Arts/Humanities' },
  { code: 'ED', name: 'Education', category: 'Arts/Humanities' },
  { code: 'GG', name: 'Geography', category: 'Arts/Humanities' },
  { code: 'ES', name: 'Environmental Science', category: 'Compulsory' },
  { code: 'AC', name: 'Accountancy', category: 'Commerce' },
  { code: 'BS', name: 'Business Studies', category: 'Commerce' },
  { code: 'PD', name: 'Public Administration', category: 'Arts/Humanities' },
  { code: 'HE', name: 'Home Science', category: 'Arts/Humanities' },
  { code: 'ITE', name: 'IT & ITeS', category: 'Vocational' },
  { code: 'RET', name: 'Retail', category: 'Vocational' },
  { code: 'TH', name: 'Tourism & Hospitality', category: 'Vocational' },
  { code: 'AG', name: 'Agriculture', category: 'Vocational' },
  { code: 'AP', name: 'Automotive', category: 'Vocational' },
  { code: 'BW', name: 'Beauty & Wellness', category: 'Vocational' }
];

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
                    st?.resultStatus ||
                    '';

  // 2. Marks / Reapp Candidate Keys (Only checking valid result marks)
  const rawMarks = raw['Marks/Reapp (Current)'] ??
                   raw.marks_reapp_current ??
                   raw.currMarksReapp ??
                   raw['Marks Obtained'] ??
                   raw.marksObtained ??
                   raw['Marks/Reapp'] ??
                   raw.result_marks ??
                   raw['Total Marks Obtained in Class 12th'] ??
                   raw['Total Marks in Class 12th'] ??
                   raw.marks_12th ??
                   st?.marksObtained ??
                   '';

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
  let division = raw['Div/Distinc (Current)'] || raw.currDiv || raw.division || raw['Division'] || raw['Distinction'] || st?.division || '';
  if (hasResult && !division && marksObtained) {
    division = calculateDivision(marksObtained, maxMarks).division;
  }

  // 6. Exam Mode / Session
  const examMode = raw['Exam Mode (Current)'] || raw.currExamMode || raw.exam_mode_current || raw.examMode || raw['Exam Mode'] || raw['Session'] || st?.session || '';

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
    raw['admNo'],
    raw['admissionNo'],
    raw['Adm_No'],
    raw['Admission / Form No.'],
    raw['Adm / Form No.'],
    raw['Adm No (11th)'],
    raw['Adm No (12th)'],
    raw['Adm. No. (Class 11th)'],
    raw['Adm. No. (Class 12th)'],
    raw['Admission Number (Class 11th)'],
    raw['Admission Number (Class 12th)'],
    raw['Admission S.No.'],
    raw['Adm. S.No.'],
    raw['S.No.'],
    raw['S.No'],
    raw['Serial No'],
    raw['Form Number'],
    raw['Form No.'],
    raw.formNo,
    raw.form_number,
    raw.form_no,
    raw['Roll No.'],
    raw['Class Roll No.'],
    raw['Class Roll No'],
    raw['Roll Number'],
    raw.rollNo,
    st?.admissionNo,
    st?.admNo,
    st?.rollNo,
    st?.formNo,
    raw.id
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const s = String(c).trim();
      if (s && !/^(—|-|n\/?a|null|undefined|none)$/i.test(s)) {
        return s;
      }
    }
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
    raw['Registration Date'],
    raw.regDate,
    raw['Created At'],
    raw.createdAt,
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

  // Smart fallback based on session (e.g. Session 2024-25 -> 01-07-2024, Session 2025-26 -> 01-07-2025)
  const sess = String(raw.session || raw.Session || st?.session || '').trim();
  const sessYearMatch = sess.match(/(20\d{2})/);
  if (sessYearMatch) {
    return `01-07-${sessYearMatch[1]}`;
  }

  return '01-07-2024';
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
      'Session': String(s.selectedSession || raw['Session'] || session || ''),
      'Exam Mode (Current)': String(raw['Exam Mode (Current)'] || raw.currExamMode || 'Annual Regular 2025 (Oct.-Nov.)'),
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
      'Exam Mode (Current)': 'Annual Regular 2025 (Oct.-Nov.)',
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
 * with strict Class, Academic Session, Exam Roll No, and Name First-Word Token scoping.
 */
export function matchStudentInDatabase(record, existingStudents = [], classScope = '', sessionScope = '') {
  if (!existingStudents || existingStudents.length === 0) return null;

  const targetForm = String(record.formNo || record['Form No.'] || '').trim().toLowerCase();
  const targetReg = String(record.regNo || record['Board Reg. No.'] || '').trim().toLowerCase();
  const targetExamRoll = String(record.examRollNo || record['Exam R.No. (Current)'] || '').trim().toLowerCase();
  const targetName = String(record.studentName || record["Student's Name"] || '').trim().toLowerCase();
  const targetFather = String(record.fatherName || record["Father's Name"] || '').trim().toLowerCase();
  const targetClass = String(record.className || record['Class'] || classScope || '').trim().toLowerCase();
  const targetSession = String(record.session || record['Session'] || record.examMode || sessionScope || '').trim().toLowerCase();

  // Helper to extract first word or initials from name
  const firstWord = (str) => String(str || '').trim().toLowerCase().split(/[\s,._-]+/)[0] || '';

  // Helper to evaluate class match
  const isClassMatch = (sCls) => {
    if (!targetClass) return true;
    const cleanSCls = String(sCls || '').toLowerCase();
    return cleanSCls.includes(targetClass) || targetClass.includes(cleanSCls) ||
      (targetClass.includes('12') && cleanSCls.includes('12')) ||
      (targetClass.includes('11') && cleanSCls.includes('11')) ||
      (targetClass.includes('10') && cleanSCls.includes('10'));
  };

  // Helper to evaluate session match
  const isSessionMatch = (sSess) => {
    if (!targetSession) return true;
    const cleanSess = String(sSess || '').toLowerCase();
    const targetYears = targetSession.match(/\b20\d\d\b/g) || [];
    const sYears = cleanSess.match(/\b20\d\d\b/g) || [];
    if (targetYears.length > 0 && sYears.length > 0) {
      return targetYears.some(y => sYears.includes(y));
    }
    return cleanSess.includes(targetSession) || targetSession.includes(cleanSess);
  };

  // 1. Exact Form No Match
  if (targetForm) {
    const found = existingStudents.find(s => {
      const f = String(s.formNo || s.raw?.['Form No.'] || s.raw?.formNo || '').trim().toLowerCase();
      return f && f === targetForm;
    });
    if (found) return { student: found, matchType: 'Form No Match', confidence: 100 };
  }

  // 2. Exact Registration No Match
  if (targetReg && targetReg.length > 5) {
    const found = existingStudents.find(s => {
      const r = String(s.regNo || s.raw?.['Board Reg. No.'] || s.raw?.regNo || '').trim().toLowerCase();
      return r && r === targetReg;
    });
    if (found) return { student: found, matchType: 'Board Reg No Match', confidence: 98 };
  }

  // 3. Exact Exam Roll No Match WITH Class & Session and First-Word Verification
  // (Since roll numbers can repeat across different academic years/sessions, we verify the cohort)
  if (targetExamRoll && targetExamRoll.length >= 4) {
    const scopedMatches = existingStudents.filter(s => {
      const sExamRoll = String(s.raw?.['Exam R.No. (Current)'] || s.currExamRoll || s.raw?.['Exam Roll No'] || '').trim().toLowerCase();
      if (!sExamRoll || sExamRoll !== targetExamRoll) return false;
      const sCls = s.selectedClass || s.cls || s.raw?.['Class'] || '';
      const sSess = s.selectedSession || s.session || s.raw?.['Session'] || s.raw?.['Exam Mode (Current)'] || '';
      return isClassMatch(sCls) && isSessionMatch(sSess);
    });

    if (scopedMatches.length > 0) {
      if (targetName) {
        const targetFirst = firstWord(targetName);
        const nameVerified = scopedMatches.find(s => {
          const sName = String(s.name || s.raw?.["Student's Name"] || '').trim().toLowerCase();
          return firstWord(sName) === targetFirst || sName.includes(targetFirst) || targetFirst.includes(firstWord(sName));
        });
        if (nameVerified) return { student: nameVerified, matchType: 'Exam Roll + Cohort + Name Match', confidence: 95 };
      }
      return { student: scopedMatches[0], matchType: 'Exam Roll & Cohort Match', confidence: 92 };
    }

    // Fallback: Check if exam roll matches across any student, but verify candidate name token
    const generalMatches = existingStudents.filter(s => {
      const sExamRoll = String(s.raw?.['Exam R.No. (Current)'] || s.currExamRoll || s.raw?.['Exam Roll No'] || '').trim().toLowerCase();
      return sExamRoll && sExamRoll === targetExamRoll;
    });

    if (generalMatches.length > 0) {
      if (targetName) {
        const targetFirst = firstWord(targetName);
        const nameVerified = generalMatches.find(s => {
          const sName = String(s.name || s.raw?.["Student's Name"] || '').trim().toLowerCase();
          return firstWord(sName) === targetFirst || sName.includes(targetFirst);
        });
        if (nameVerified) return { student: nameVerified, matchType: 'Exam Roll & Name Match', confidence: 88 };
      }
      if (generalMatches.length === 1) {
        return { student: generalMatches[0], matchType: 'Exam Roll Match (Cross-Session)', confidence: 80 };
      }
    }
  }

  // 4. Candidate Name First Word(s) + Father Name + Class + Session Match
  // (Crucial for newly published gazettes where students do not have Exam Roll No stored in DB yet)
  if (targetName && targetName.length >= 3) {
    const targetFirst = firstWord(targetName);
    const cohortPool = existingStudents.filter(s => {
      const sCls = s.selectedClass || s.cls || s.raw?.['Class'] || '';
      const sSess = s.selectedSession || s.session || s.raw?.['Session'] || '';
      return isClassMatch(sCls) && isSessionMatch(sSess);
    });

    const poolToSearch = cohortPool.length > 0 ? cohortPool : existingStudents;

    const found = poolToSearch.find(s => {
      const n = String(s.name || s.raw?.["Student's Name"] || '').trim().toLowerCase();
      const f = String(s.fatherName || s.raw?.["Father's Name"] || '').trim().toLowerCase();
      if (!n) return false;

      const sFirst = firstWord(n);
      const firstWordMatches = sFirst === targetFirst || n.startsWith(targetFirst) || targetName.startsWith(sFirst);
      
      if (targetFather && f) {
        const fatherFirst = firstWord(targetFather);
        const fatherMatches = f.includes(fatherFirst) || targetFather.includes(firstWord(f));
        return firstWordMatches && fatherMatches;
      }

      return firstWordMatches && (n.includes(targetName) || targetName.includes(n));
    });

    if (found) {
      return {
        student: found,
        matchType: `Name (${targetFirst.toUpperCase()}) & Cohort Match`,
        confidence: 85
      };
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
      const formNo = cleanCellValue(r['Form No.'] || r['formNo'] || r['Form_No'] || r['Adm No.'] || r['Adm No']);
      const regNo = cleanCellValue(r['Board Reg. No.'] || r['regNo'] || r['Registration No'] || r['Reg. No.'] || r['RR No.']);
      const studentName = cleanCellValue(r["Student's Name"] || r['studentName'] || r['Name'] || r['Name of Candidate'] || r['Student']);
      const fatherName = cleanCellValue(r["Father's Name"] || r['fatherName'] || r['Father']);
      const className = cleanCellValue(r['Class'] || r['class'] || classScope);
      const stream = cleanCellValue(r['Stream'] || r['stream']);
      const examMode = cleanCellValue(r['Exam Mode (Current)'] || r['examMode'] || r['Session'] || sessionScope || 'Annual Regular 2025 (Oct.-Nov.)');
      const examRollNo = cleanCellValue(r['Exam R.No. (Current)'] || r['Exam R.No.'] || r['Exam Roll No'] || r['examRoll'] || r['Roll No'] || r['Exam Roll']);
      
      const rawResult = cleanCellValue(r['Result (Current)'] || r['result'] || r['Result'] || r['Pass/Reap/Fail'] || r['Passed'] || 'Passed');
      const resultStatus = normalizeResultStatus(rawResult);

      let marksReapp = cleanCellValue(r['Marks/Reapp (Current)'] || r['Marks/Reapp'] || r['marksReapp'] || r['Marks'] || r['Obt/Max'] || r['Marks Obt.']);
      let divDistinc = String(r['Div/Distinc (Current)'] || r['Div/Distinction/Position'] || r['division'] || '').trim();

      // Guardrail Auto-calculation for marks & division
      if (resultStatus === 'Passed') {
        passedCount++;
        // If marks provided like "488" or "488 / 500"
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
        divDistinc = 'Re-appear';
      } else if (resultStatus === 'Failed') {
        failedCount++;
        divDistinc = 'Failed';
      }

      const withdrawalDate = String(
        r['Date of withdrawl/result'] ||
        r['Date of withdrawl'] ||
        r['Date of withdrawal'] ||
        r['withdrawalDate'] ||
        r['Result Date'] ||
        r['Withdrawal Date'] ||
        r['Date withdrawl'] ||
        ''
      ).trim();

      const ccDcNo = String(
        r['No. & Date of CC/DC Issued (This Institution)'] ||
        r['No. & Date of CC/DC Issued'] ||
        r['CC/DC No. & Date'] ||
        r['ccDcNo'] ||
        r['Certf. No.'] ||
        r['cc/dc s.no.'] ||
        r['Certf No'] ||
        ''
      ).trim();

      const remarks = String(r['Remarks'] || r['remarks'] || '').trim();

      // Database Match with Class & Session Scoping
      const matchResult = matchStudentInDatabase({
        formNo, regNo, examRollNo, studentName, fatherName, className, session: examMode
      }, existingStudents, classScope, sessionScope);

      if (matchResult) matchedCount++;

      processed.push({
        id: formNo || (matchResult ? (matchResult.student.formNo || matchResult.student.id) : `row_${idx + 1}`),
        sNo: idx + 1,
        formNo: formNo || (matchResult ? (matchResult.student.formNo || matchResult.student.id) : ''),
        regNo: regNo || (matchResult ? matchResult.student.regNo : ''),
        studentName: studentName || (matchResult ? matchResult.student.name : '—'),
        fatherName: fatherName || (matchResult ? matchResult.student.fatherName : '—'),
        className: className || (matchResult ? matchResult.student.selectedClass : ''),
        stream: stream || (matchResult ? matchResult.student.selectedStream : ''),
        examMode,
        examRollNo,
        resultStatus,
        marksReapp,
        divDistinc,
        withdrawalDate,
        ccDcNo,
        remarks,
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'Unmatched (New)',
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
 * Analyze raw JKBOSE Result Gazette (PDF or Scanned Image) via Gemini AI Multimodal Vision
 * with target Class, Academic Session, and first-word name token alignment.
 */
export async function analyzeGazetteWithGemini(
  fileBase64,
  mimeType,
  existingStudents = [],
  progressCallback = null,
  selectedClass = '12th',
  selectedSession = '2025-26'
) {
  try {
    if (progressCallback) progressCallback('Fetching Gemini AI API credentials...');
    const keys = await fetchCloudGeminiKeys();
    if (!keys || keys.length === 0) {
      throw new Error('No Gemini API keys found. Please configure a valid Google Gemini API Key in the settings.');
    }

    const preferredModel = getPreferredGeminiModel() || 'gemini-3.7-flash';

    if (progressCallback) progressCallback(`Processing document with ${preferredModel}...`);

    const prompt = `You are a high-precision JKBOSE (Jammu & Kashmir Board of School Education) Result Gazette and Examination Result Parser.
Target Scope: Class ${selectedClass || '12th'} | Session: ${selectedSession || '2025-26'}.

Analyze this attached examination result gazette / document image and extract all student result rows for this cohort.
Note that JKBOSE result gazettes typically list:
- "Exam Roll No" (7 to 9 digits, e.g. "301003053" or "101060027")
- "Candidate Name" (either full name or first words / abbreviations like "ZAIDAN WANI" or "ZAIDAN")
- "Registration Number" (if visible, e.g. "2201000001160003")
- "Result / Marks / Re-appear Subjects" (e.g. "488", "Passed", "Reap GN PH CH", "Discharged")

For each student found in the gazette, extract:
1. "examRollNo": Examination roll number as clean text string.
2. "studentName": Candidate name as printed in the gazette.
3. "regNo": JKBOSE Registration number if visible.
4. "fatherName": Father's name if present.
5. "result": Result status strictly as one of: "Passed", "Reap", "Failed".
6. "marksObtained": Numeric marks obtained if passed (e.g. 488, 392). null if not passed.
7. "maxMarks": Total maximum marks (default 500).
8. "reappSubjects": If result is "Reap", list subject abbreviations separated by space (e.g. "PH CH BI", "GN MH"). null if passed.
9. "division": Division or distinction if passed (e.g. "Distinction", "1st Division", "2nd Division", "3rd Division").
10. "examMode": Examination session title if present (e.g. "Annual Regular ${selectedSession}").

CRITICAL FORMAT REQUIREMENT:
Respond ONLY with a valid JSON array of objects without markdown fences.
Example:
[
  {
    "examRollNo": "301003053",
    "regNo": "2201000001160003",
    "studentName": "ZAIDAN WANI",
    "fatherName": "BILAL AHMAD WANI",
    "result": "Passed",
    "marksObtained": 488,
    "maxMarks": 500,
    "reappSubjects": null,
    "division": "Distinction",
    "examMode": "Annual Regular ${selectedSession}"
  }
]`;

    let lastError = null;
    let jsonText = '';

    // Key rotation pool
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${preferredModel}:generateContent?key=${apiKey}`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: fileBase64.split(',')[1] || fileBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              topP: 0.95,
              maxOutputTokens: 8192
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (jsonText) break; // Success!
      } catch (err) {
        lastError = err;
        console.warn(`Gemini Key #${i + 1} failed:`, err.message);
      }
    }

    if (!jsonText) {
      throw new Error(`Gemini AI analysis failed: ${lastError?.message || 'Empty response'}`);
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

    if (progressCallback) progressCallback(`Extracted ${parsedArray.length} entries. Aligning with Class & Session roster...`);

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
      const examMode = cleanCellValue(item.examMode) || `Annual Regular ${selectedSession}`;

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
        marksReapp = item.reappSubjects || 'Re-appear';
        divDistinc = 'Re-appear';
      } else {
        failedCount++;
        divDistinc = 'Failed';
      }

      // Match with database using Class, Session, Exam Roll, and First-Word Tokens
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
        remarks: `Extracted via Gemini AI (${matchResult ? matchResult.matchType : 'Unmatched'})`,
        matchedStudent: matchResult ? matchResult.student : null,
        matchType: matchResult ? matchResult.matchType : 'Unmatched (New)',
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
 * Batch update student results in Firebase Firestore & update local memory cache.
 */
export async function batchUpdateStudentResults(recordsToUpdate = []) {
  if (!recordsToUpdate || recordsToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const batch = writeBatch(db);
  let updatedCount = 0;

  for (const item of recordsToUpdate) {
    const formNo = String(item.formNo || item.id || '').trim();
    if (!formNo) continue;

    const patch = {
      'Exam Mode (Current)': item.examMode || '',
      'Exam R.No. (Current)': item.examRollNo || '',
      'Result (Current)': item.resultStatus || 'Passed',
      'Marks/Reapp (Current)': item.marksReapp || '',
      'Div/Distinc (Current)': item.divDistinc || '',
      currExamMode: item.examMode || '',
      currExamRoll: item.examRollNo || '',
      currResult: item.resultStatus || 'Passed',
      currMarksReapp: item.marksReapp || '',
      currDiv: item.divDistinc || '',
      updatedAt: serverTimestamp()
    };

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

    const studentRef = doc(db, 'admissions', formNo);
    batch.set(studentRef, patch, { merge: true });

    // Sync localStorage / in-memory cache instantly
    updateCachedItem('admissions', formNo, patch);
    updatedCount++;
  }

  await batch.commit();

  return { success: true, count: updatedCount };
}
