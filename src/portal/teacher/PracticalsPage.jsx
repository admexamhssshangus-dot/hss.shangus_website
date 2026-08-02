import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useOutletContext } from 'react-router-dom';
import { 
  ArrowLeft, UserCheck, Save, RefreshCw, AlertCircle, 
  CheckCircle2, Printer, ShieldCheck, History, Clock, ArrowUpDown,
  Bookmark, Send, AlertTriangle, FileCheck, ChevronDown, Check
} from 'lucide-react';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import appsScriptApi from '../../services/appsScriptApi';
import ConfirmModal from '../components/ConfirmModal';
import { getCachedCollection } from '../../services/dbCache';

// Subject Name to Code mapping (from legacy system)
const SUBJECT_MAP = [
  { name: 'General English', code: 'EN', defaultMax: 20 },
  { name: 'Physics', code: 'PH', defaultMax: 10 },
  { name: 'Chemistry', code: 'CH', defaultMax: 10 },
  { name: 'Biology', code: 'BI', defaultMax: 20 },
  { name: 'Botany', code: 'BO', defaultMax: 5 },
  { name: 'Zoology', code: 'ZO', defaultMax: 5 },
  { name: 'Environmental Science', code: 'ES', defaultMax: 10 },
  { name: 'Physical Education', code: 'PD', defaultMax: 15 },
  { name: 'IT And ITES', code: 'ITE', defaultMax: 50 },
  { name: 'Healthcare', code: 'HTC', defaultMax: 50 },
  { name: 'Computer Science', code: 'CS', defaultMax: 30 },
  { name: 'Geography', code: 'GG', defaultMax: 20 },
  { name: 'Mathematics', code: 'MA', defaultMax: 20 },
  { name: 'Urdu', code: 'UR', defaultMax: 20 },
  { name: 'Education', code: 'ED', defaultMax: 20 },
  { name: 'History', code: 'HT', defaultMax: 20 },
  { name: 'Political Science', code: 'PS', defaultMax: 20 },
  { name: 'Economics', code: 'EC', defaultMax: 20 },
  { name: 'Sociology', code: 'SO', defaultMax: 20 },
  { name: 'Psychology', code: 'PY', defaultMax: 20 },
  { name: 'Accountancy', code: 'AY', defaultMax: 20 },
  { name: 'Business Studies', code: 'BS', defaultMax: 20 },
  { name: 'Entrepreneurship', code: 'EP', defaultMax: 20 },
  { name: 'Arabic', code: 'AR', defaultMax: 20 },
  { name: 'Persian', code: 'PE', defaultMax: 20 },
];

// Helper for Admission Number Formatting (handles numbers & sanitizes Excel formula errors)
const cleanAdmNoVal = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return String(val);
  }
  const str = String(val).trim();
  if (
    !str ||
    /^(#N\/A|#VALUE!|#REF!|#N\/A!|#NAME\?|#NULL!|#NUM!|#DIV\/0!|N\/A|NA|—|-|null|undefined|nan|none)$/i.test(str)
  ) {
    return '';
  }
  return str;
};

const extractRawAdmNo = (rec) => {
  if (!rec) return '';
  const candidates = [
    rec['admNo'],
    rec['Adm. No.'],
    rec['Adm No.'],
    rec['Adm No'],
    rec['Adm. No'],
    rec['Adm.No.'],
    rec['Adm.No'],
    rec['AdmNo'],
    rec['adm_no'],
    rec['ADM. NO.'],
    rec['ADM NO'],
    rec['ADM_NO'],
    rec['Admission No.'],
    rec['Admission No'],
    rec['Admission Number'],
    rec['Adm. Number'],
    rec['Adm. #'],
    rec['Adm #'],
    rec['Adm_No'],
    rec['adm_number'],
    rec['Admission_No'],
    rec['Admission_Number'],
    rec['Adm. No. (if allotted)'],
    rec['Adm No (if allotted)']
  ];

  for (const c of candidates) {
    const cleaned = cleanAdmNoVal(c);
    if (cleaned) return cleaned;
  }

  for (const key of Object.keys(rec)) {
    const kLower = key.toLowerCase();
    if (
      (kLower.includes('adm') && (kLower.includes('no') || kLower.includes('number') || kLower.includes('#'))) ||
      kLower.includes('admission')
    ) {
      if (kLower.includes('readmission') || kLower.includes('status') || kLower.includes('type') || kLower.includes('date')) continue;
      const cleaned = cleanAdmNoVal(rec[key]);
      if (cleaned && !/^(yes|no|true|false)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return '';
};

// Helper: Strict class matching (e.g. '11th', '11th Class', 'Class 11', '11')
function isClassMatch(stClass, targetClass) {
  if (!stClass || !targetClass) return false;
  const c1 = String(stClass).toLowerCase().replace(/class/gi, '').trim();
  const c2 = String(targetClass).toLowerCase().replace(/class/gi, '').trim();
  if (c1 === c2) return true;
  const d1 = c1.match(/\d+/)?.[0];
  const d2 = c2.match(/\d+/)?.[0];
  return !!(d1 && d2 && d1 === d2);
}

// Helper: Extract the END YEAR from a session string.
// Academic sessions are formatted as "YYYY-YY" (e.g. "2024-25" → end year 2025, "2025-26" → end year 2026).
// yearSuffix from practicals is always the end year when exams happen.
function getSessionEndYear(sessionStr) {
  const s = String(sessionStr || '').trim();
  // Match range format: YYYY-YY (e.g., 2024-25, 2025-26)
  const rangeMatch = s.match(/\b(20\d\d)-(\d\d)\b/);
  if (rangeMatch) {
    return '20' + rangeMatch[2]; // "2024-25" → "2025", "2025-26" → "2026"
  }
  // Match standalone 4-digit year (e.g., "2026", "2025 APR/BIAN")
  const yearMatch = s.match(/\b(20\d\d)\b/);
  if (yearMatch) {
    return yearMatch[1]; // "2026" → "2026"
  }
  return '';
}

// Helper: Session matching using end-year comparison & sub-session checks
// IMPORTANT: '2024-25 (Mar-Apr)' and '2024-25 (Oct-Nov)' are TWO DIFFERENT regular sessions in the same year.
// IMPORTANT: '2026' (Regular) and '2026 APR/BIAN' (Annual Private/Bi-annual) are DIFFERENT sessions.
// STRICT RULE: If the TARGET specifies a sub-qualifier (Mar-Apr or Oct-Nov), the student record must
// ALSO carry that qualifier — plain "2024-25" with no qualifier is AMBIGUOUS and must NOT match either.
function isSessionMatch(stSession, targetYearSuffix) {
  if (!stSession) return true;
  const sStr = String(stSession).toLowerCase().trim();
  const tStr = String(targetYearSuffix).toLowerCase().trim();

  // Exact string match
  if (sStr === tStr) return true;

  // Detect APR/BIAN (Annual Private / Bi-annual) vs Regular
  const aprBianPattern = /\b(apr|bian|biannual|bi-annual|private|annual\s*private)\b/i;
  const sIsAprBian = aprBianPattern.test(sStr);
  const tIsAprBian = aprBianPattern.test(tStr);

  // If one is APR/BIAN and the other is Regular, they are DIFFERENT sessions
  if (sIsAprBian !== tIsAprBian) return false;

  // Detect sub-session qualifiers
  const sIsMarApr = sStr.includes('mar-apr') || sStr.includes('mar/apr');
  const tIsMarApr = tStr.includes('mar-apr') || tStr.includes('mar/apr');
  const sIsOctNov = sStr.includes('oct-nov') || sStr.includes('oct/nov') || sStr.includes('revised');
  const tIsOctNov = tStr.includes('oct-nov') || tStr.includes('oct/nov') || tStr.includes('revised');

  // Cross-qualifier mismatch: always reject
  if (sIsMarApr && tIsOctNov) return false;
  if (sIsOctNov && tIsMarApr) return false;

  // STRICT: if target has a sub-qualifier (Mar-Apr OR Oct-Nov), student record must also carry it.
  // A plain "2024-25" without any qualifier is ambiguous and must NOT match a qualified target.
  if ((tIsMarApr || tIsOctNov) && !sIsMarApr && !sIsOctNov) return false;

  // Compare END YEARS (the year when exams happen)
  const sEndYear = getSessionEndYear(sStr);
  const tEndYear = getSessionEndYear(tStr);

  if (sEndYear && tEndYear) {
    return sEndYear === tEndYear;
  }

  // Fallback: if no year could be extracted, try substring match
  return sStr.includes(tStr) || tStr.includes(sStr);
}

// Helper: Subject / Stream Matcher
function isSubjectOrStreamMatch(st, targetSubjectCode, targetSubjectName) {
  if (!targetSubjectCode && !targetSubjectName) return true;
  
  const rawSubjStr = String(
    st.subjects ||
    st.Subjects ||
    st.subject ||
    st['Stream / Subjects'] ||
    st['Subject Combination'] ||
    st['Selected Subjects'] ||
    st.rawSubjects ||
    ''
  ).toUpperCase();

  const streamStr = String(
    st.stream ||
    st.Stream ||
    st['Stream for Class 11th'] ||
    st['Stream for Class 12th'] ||
    ''
  ).toUpperCase();

  const codeUpper = String(targetSubjectCode || '').toUpperCase();
  const nameUpper = String(targetSubjectName || '').toUpperCase();

  if (rawSubjStr) {
    if (codeUpper && (rawSubjStr.includes(codeUpper) || rawSubjStr.split(/[\s,+/]+/).includes(codeUpper))) return true;
    if (nameUpper && rawSubjStr.includes(nameUpper)) return true;
    if ((codeUpper === 'BO' || codeUpper === 'ZO') && (rawSubjStr.includes('BI') || rawSubjStr.includes('BIOLOGY') || rawSubjStr.includes('BOTANY') || rawSubjStr.includes('ZOOLOGY'))) return true;
    if (codeUpper === 'BI' && (rawSubjStr.includes('BI') || rawSubjStr.includes('BIOLOGY') || rawSubjStr.includes('BOTANY') || rawSubjStr.includes('ZOOLOGY'))) return true;
  }

  if (streamStr) {
    if (['PH', 'CH', 'BI', 'BO', 'ZO', 'CS', 'ITE', 'PD'].includes(codeUpper)) {
      if (streamStr.includes('SCIENCE') || streamStr.includes('MEDICAL') || streamStr.includes('NON-MEDICAL') || streamStr.includes('NON MEDICAL')) return true;
    }
    if (['HT', 'PS', 'ED', 'SO', 'EC', 'PY', 'UR', 'AR', 'PE'].includes(codeUpper)) {
      if (streamStr.includes('ARTS') || streamStr.includes('HUMANITIES')) return true;
    }
    if (['AY', 'BS', 'EP'].includes(codeUpper)) {
      if (streamStr.includes('COMMERCE')) return true;
    }
  }

  if (['EN', 'ES'].includes(codeUpper)) return true;
  if (!rawSubjStr && !streamStr) return true;

  return false;
}

// Helper: Extract student class from any potential schema key
function extractStudentClass(st) {
  if (!st) return '';
  return (
    st.class || st.Class || st['Class'] ||
    st['Class for which Admission Sought'] ||
    st['Admission sought for class'] ||
    st['Class Enrolled'] || st.className || ''
  );
}

// Helper: Check if student has assigned Class Roll No
function hasAssignedClassRoll(st) {
  if (!st) return false;
  const roll = String(
    st['Class Roll No'] ||
    st['Class Roll No.'] ||
    st['Class R.No.'] ||
    st['Class R.No'] ||
    st['Class R. No.'] ||
    st.classRollNo ||
    st.rollNo ||
    st['Roll No.'] ||
    st['Roll No'] ||
    st.roll_no ||
    ''
  ).trim();

  if (!roll || roll === '—' || roll === 'N/A' || roll.toLowerCase() === 'undefined' || roll.toLowerCase() === 'null') {
    return false;
  }
  return true;
}

// Helper: Extract Student Name from any potential schema key
function getStudentName(st) {
  if (!st) return 'Student';
  const nameStr = (
    st["Student's Name (as per school records)"] ||
    st["Student's Name"] ||
    st['Student Name'] ||
    st['Name of Candidate'] ||
    st['Candidate Name'] ||
    st['Full Name'] ||
    st['Name'] ||
    st['Account Name'] ||
    st['User Name'] ||
    st.studentName ||
    st.name ||
    st.Name ||
    ''
  );
  if (nameStr && String(nameStr).trim() !== '') return String(nameStr).trim();
  if (st.email) return String(st.email).split('@')[0];
  if (st.formNo || st['Form No.']) return `Student #${st.formNo || st['Form No.']}`;
  return 'Student';
}

// Helper: Extract Registration Number (Dual Reg No format: NewRegNo (OldRegNo))
function getRegNo(st) {
  if (!st) return '';

  const clean = (val) => {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    if (!s || /^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s)) return '';

    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
      try {
        const num = Number(s);
        if (!isNaN(num) && num > 0 && typeof window !== 'undefined' && typeof window.BigInt === 'function') {
          s = window.BigInt(Math.round(num)).toString();
        }
      } catch (_) {}
    }

    return s.replace(/\.0+$/, '');
  };

  const newReg = clean(
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 12th)'] ||
    st['Board Registration No.'] ||
    st['Board Registration Number'] ||
    st['Board Reg. No.'] ||
    st['Board Reg. No'] ||
    st['Board Reg No'] ||
    st['Reg. No.'] ||
    st['Reg. No'] ||
    st['Reg No'] ||
    st['Registration No'] ||
    st['Registration Number'] ||
    st.boardRegNo ||
    st.regNo ||
    st.registrationNo ||
    st.reg_no
  );

  const oldReg = clean(
    st['Board Registration No. (Class 10th)'] ||
    st['Board Registration No. (Class 9th)'] ||
    st['Old Registration No.'] ||
    st['Old Reg. No.'] ||
    st['Old Reg No'] ||
    st.oldRegNo ||
    st.prevRegNo
  );

  // If a single reg field contains multiple reg numbers (e.g. "REG1 / REG2" or "REG1, REG2")
  if (newReg) {
    const parts = newReg.split(/[/,;\s]+/).filter(p => p.length > 3 && !/^(N\/A|#N\/A|—|-)$/i.test(p));
    if (parts.length >= 2 && parts[0] !== parts[1]) {
      return `${parts[0]} (${parts[1]})`;
    }
  }

  // If both new and older reg numbers exist, format as: NewRegNo (OldRegNo)
  if (newReg && oldReg && newReg !== oldReg) {
    return `${newReg} (${oldReg})`;
  }

  return newReg || oldReg || '';
}

// Helper: Extract Exam Roll Badges (Exam R.No. (Current) + Exam R.no. (Prev.))
function getExamRollBadges(st, selectedClass) {
  if (!st) return [{ label: 'Exam R.No. (Current)', value: '—', isCurrent: true }];

  const badges = [];
  const clsNorm = String(selectedClass || st.className || st.Class || st.class || '').toLowerCase();
  const is12th = clsNorm.includes('12');

  const rawBoard = String(
    st.boardRoll ||
    st.boardRollNo ||
    st['Board Roll No'] ||
    st['Board Roll No.'] ||
    st['Exam Roll No'] ||
    st['Exam Roll No.'] ||
    st.examRollNo ||
    ''
  ).trim();

  // 1. Current Exam Roll (for 12th class, rawBoard is 12th Roll; for 11th class, current 11th roll if set)
  const currentRoll = String(
    st['Exam R.No. (Current)'] ||
    st['Current Exam Roll'] ||
    st['12th Exam Roll'] ||
    st['Exam Roll Number of Class 12th'] ||
    st.currentExamRoll ||
    (is12th ? rawBoard : '')
  ).trim();

  // 2. Previous Exam Roll (for 11th class, rawBoard is 10th Roll; for 12th class, 11th Roll if recorded)
  const prevRoll = String(
    st['Exam R.no. (Prev.)'] ||
    st['Previous Exam Roll'] ||
    st['10th Exam Roll'] ||
    st['Exam Roll Number of Class 10th'] ||
    st['11th Exam Roll'] ||
    st['Exam Roll Number of Class 11th'] ||
    st.prevExamRoll ||
    st.roll10 ||
    st.roll11 ||
    (!is12th ? rawBoard : '')
  ).trim();

  // Add Exam R.No. (Current) badge
  badges.push({
    label: 'Exam R.No. (Current)',
    value: currentRoll || '—',
    isCurrent: true
  });

  // Add Exam R.no. (Prev.) badge if available and distinct
  if (prevRoll && prevRoll !== currentRoll) {
    badges.push({
      label: 'Exam R.no. (Prev.)',
      value: prevRoll,
      isPrev: true
    });
  }

  return badges;
}

// Helper: Extract Student Subjects across all schemas
function extractRawSubjectsString(rec) {
  if (!rec) return '';
  const subjectArrayOrStr = 
    rec['Subjects to be taken in Class 11th'] ||
    rec['Subjects to be taken in Class 12th'] ||
    rec['Subjects to be taken in Class 10th'] ||
    rec['Subjects to be taken in Class 9th'] ||
    rec['Subjects to be taken in Class 8th'] ||
    rec['Subjects Studied in Class 11th'] ||
    rec['Subjects Studied in Class 9th'] ||
    rec['Subjects Studied in Class 8th'] ||
    rec['Stream & Subjects for Class 12th'] ||
    rec['Subjects Studied in Class 10th'] ||
    rec['Subject Combination'] ||
    rec['Subjects Opted'] ||
    rec['Elective Subjects'] ||
    rec['selectedSubjects'] ||
    rec['Subjects'] ||
    rec['subjects'] ||
    rec['subjectCombination'] ||
    rec['Subject'] ||
    rec['subject'] ||
    rec['Subs'] ||
    rec['subs'];

  if (Array.isArray(subjectArrayOrStr) && subjectArrayOrStr.length > 0) {
    const cleaned = subjectArrayOrStr.filter(s => s && String(s).trim() !== '—').map(s => String(s).trim());
    if (cleaned.length > 0) return cleaned.join(', ');
  }

  if (typeof subjectArrayOrStr === 'string' && subjectArrayOrStr.trim() && subjectArrayOrStr.trim() !== '—') {
    return subjectArrayOrStr.trim();
  }

  const subjList = [];
  const subjKeys = [
    'Subjects1', 'Subjects2', 'Subjects3', 'Subjects4', 'Subjects5', 'Subjects6', 'Subject6',
    'subject1', 'subject2', 'subject3', 'subject4', 'subject5', 'subject6'
  ];

  subjKeys.forEach(k => {
    const val = rec[k];
    if (val && typeof val === 'string' && val.trim() && val.trim() !== '—' && !subjList.includes(val.trim())) {
      subjList.push(val.trim());
    }
  });

  if (subjList.length > 0) {
    return subjList.join(', ');
  }
  return '';
}

// Helper: Mandatory Abbreviate Subject Combinations with Stream Code (S = Science, H = Humanities, G = General)
function getAbbreviatedSubjects(st) {
  if (!st) return 'EN, PH, CH, BI (S)';

  // Extract Stream
  const streamRaw = String(
    st['Stream for Class 11th'] ||
    st['Stream opted in Class 11th'] ||
    st['Stream'] ||
    st.stream ||
    ''
  ).trim();

  let streamCode = '';
  if (streamRaw.toLowerCase().includes('science') || streamRaw.toLowerCase().includes('med')) {
    streamCode = 'S';
  } else if (streamRaw.toLowerCase().includes('arts') || streamRaw.toLowerCase().includes('humanities')) {
    streamCode = 'H';
  } else if (streamRaw.toLowerCase().includes('commerce') || streamRaw.toLowerCase().includes('general')) {
    streamCode = 'G';
  }

  // Extract Raw Subjects
  const subjRaw = extractRawSubjectsString(st);
  let rawStr = subjRaw.trim();

  let subjectsStr = '';
  if (rawStr) {
    subjectsStr = rawStr
      // ── Longest/multi-word first to prevent partial overlaps ──
      .replace(/General English/gi, 'EN')
      .replace(/Physical Education/gi, 'PD')      // BEFORE 'Physics' and 'Education'
      .replace(/Environmental Science/gi, 'ES')   // BEFORE 'Science'
      .replace(/Political Science/gi, 'PS')        // BEFORE 'Science'
      .replace(/Computer Science/gi, 'CS')         // BEFORE 'Science'
      .replace(/Business Studies/gi, 'BS')
      .replace(/Entrepreneurship/gi, 'EP')
      .replace(/Accountancy/gi, 'AY')
      .replace(/Sociology/gi, 'SO')
      .replace(/Psychology/gi, 'PY')
      .replace(/Healthcare/gi, 'HTC')
      .replace(/IT And ITES|IT\s*&\s*ITES/gi, 'ITE')
      .replace(/Mathematics/gi, 'MA')
      .replace(/Geography/gi, 'GG')
      .replace(/Economics/gi, 'EC')
      .replace(/Chemistry/gi, 'CH')               // BEFORE 'History'
      .replace(/History/gi, 'HT')
      .replace(/Physics/gi, 'PH')                 // After 'Physical Education'
      .replace(/Botany/gi, 'BO')
      .replace(/Zoology/gi, 'ZO')
      .replace(/Biology/gi, 'BI')                 // After Botany/Zoology
      .replace(/Education/gi, 'ED')               // After 'Physical Education'
      .replace(/Persian/gi, 'PE')
      .replace(/Arabic/gi, 'AR')
      .replace(/Urdu/gi, 'UR');
  }

  if (!subjectsStr || ['science', 'arts', 'commerce', 'humanities', 'medical', 'general'].includes(subjectsStr.toLowerCase())) {
    if (streamCode === 'S') subjectsStr = 'EN, PH, CH, BI';
    else if (streamCode === 'H') subjectsStr = 'EN, UR, ED, PS';
    else if (streamCode === 'G') subjectsStr = 'EN, AY, BS, EC';
    else subjectsStr = 'EN, PH, CH, BI';
  }

  return streamCode ? `${subjectsStr} (${streamCode})` : subjectsStr;
}

// Helper: Convert numbers to words
function numberToWords(numStr) {
  const value = String(numStr || '').trim().toUpperCase();
  if (value === '' || value === 'A' || value === 'AB' || value === 'ABSENT') {
    return value === 'A' || value === 'AB' || value === 'ABSENT' ? 'ABSENT' : 'N/A';
  }
  let number = parseInt(value, 10);
  if (isNaN(number)) return value;
  if (number === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  let words = '';
  if (number >= 100) { words += ones[Math.floor(number / 100)] + ' Hundred '; number %= 100; }
  if (number > 0) {
    if (words !== '') words += 'and ';
    if (number < 20) words += ones[number];
    else { words += tens[Math.floor(number / 10)]; if (number % 10 > 0) { words += '-' + ones[number % 10]; } }
  }
  return words.trim();
}

function getMinPassMarks(maxMarks) {
  const m = parseInt(maxMarks, 10) || 30;
  return Math.ceil(0.36 * m);
}

// Helper: Precise Subject Matcher — exact token + word-boundary match only, no stream-level fallback
function isSubjectMatch(student, targetSubjectCode) {
  if (!targetSubjectCode) return true;

  const targetObj = SUBJECT_MAP.find(s => s.code === targetSubjectCode || s.name.toLowerCase() === targetSubjectCode.toLowerCase());
  const code = targetObj ? targetObj.code.toLowerCase() : targetSubjectCode.toLowerCase();
  const name = targetObj ? targetObj.name.toLowerCase() : targetSubjectCode.toLowerCase();

  const abbr = String(student.subjectsAbbr || '').toLowerCase();
  const raw = String(student.rawSubjects || '').toLowerCase();

  // 1. Biology / Botany / Zoology equivalence — ONLY by explicit token, not stream
  if (['bi', 'bo', 'zo'].includes(code)) {
    const abbrTokens = abbr.split(/[\s,()]+/).filter(Boolean);
    if (abbrTokens.includes('bi') || abbrTokens.includes('bo') || abbrTokens.includes('zo')) return true;
    if (raw) {
      if (/\b(biology|botany|zoology)\b/i.test(raw)) return true;
    }
    // Only use stream fallback if student has NO subject data at all
    if (!raw && !abbr.replace(/[\s,()\.]/g, '')) return true;
    return false;
  }

  // 2. Exact token match in abbreviated string
  const abbrTokens = abbr.split(/[\s,()]+/).filter(Boolean);
  if (abbrTokens.includes(code)) return true;

  // 3. Word-boundary match in raw subjects.
  //    Negative lookbehind: 'Education' (ED) won't match inside 'Physical Education' (PD),
  //    'Science' won't match inside 'Computer/Political/Environmental Science', etc.
  if (raw) {
    const COMPOUND_EXCLUSIONS = {
      education: 'physical\\s+',
      science:   'computer\\s+|political\\s+|environmental\\s+',
      studies:   'business\\s+',
    };
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lookbehind = COMPOUND_EXCLUSIONS[name.toLowerCase()];
    const nameRegex = lookbehind
      ? new RegExp(`(?<!(?:${lookbehind}))\\b${escapedName}\\b`, 'i')
      : new RegExp(`\\b${escapedName}\\b`, 'i');
    if (nameRegex.test(raw)) return true;
  }

  // 4. Only include if truly no subject data (can't determine)
  if (!raw && !abbr.replace(/[\s,()\.]/g, '')) return true;

  return false;
}

// Custom Subject Dropdown (prevents native Chrome select popovers from shooting up to header)
function CustomSubjectSelect({ selectedSubject, setSelectedSubject, subjectMap, currentSubjectObj }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = subjectMap.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedItem = subjectMap.find(s => s.name === selectedSubject) || subjectMap[0];

  return (
    <div className="space-y-0.5 relative" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-700 dark:text-slate-300">
        Subject ({currentSubjectObj.code})
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border flex items-center justify-between gap-1 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <span className="truncate">{selectedItem.name} ({selectedItem.code}) - {selectedItem.defaultMax}M</span>
        <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[999] rounded-xl border shadow-2xl p-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-1 min-w-[230px] max-h-60 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          <input
            type="text"
            placeholder="Search subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1 rounded-lg text-[11px] font-bold border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none text-slate-900 dark:text-white"
            autoFocus
          />
          <div className="overflow-y-auto max-h-48 space-y-0.5 pr-0.5 no-scrollbar">
            {filtered.map((s) => {
              const isSelected = s.name === selectedSubject;
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setSelectedSubject(s.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{s.name} ({s.code}) - {s.defaultMax}M</span>
                  {isSelected && <Check size={12} className="shrink-0 ml-1" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-2 text-center text-[11px] text-slate-400 font-semibold">No subjects found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const CURRENT_SESSION = '2026';

export default function PracticalsPage() {
  const { user, onLogout } = useOutletContext();
  const navigate = useNavigate();

  // Filter States
  const [selectedClass, setSelectedClass] = useState('11th');
  const [practicalType, setPracticalType] = useState('Internal Assessment');
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [yearSuffix, setYearSuffix] = useState(CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION]);
  const [sortBy, setSortBy] = useState('rollAsc'); // 'rollAsc' | 'rollDesc' | 'nameAsc' | 'formAsc'

  // Roster & Marks State
  const [loading, setLoading] = useState(false);
  const [studentMarks, setStudentMarks] = useState([]);
  const [masterRosterCache, setMasterRosterCache] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showFailOnly, setShowFailOnly] = useState(false);

  // Submissions History Drawer State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Draft & Final Submission Validation States
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationData, setValidationData] = useState({
    totalCount: 0,
    completedCount: 0,
    incompleteCount: 0,
    absentCount: 0,
    incompleteList: []
  });



  // Detect past session years from masterRegisters and practicalsData records
  useEffect(() => {
    const detectPastSessions = async () => {
      try {
        // Canonical sessions always present (matches exact session values stored in Firestore/Excel)
        const sessionsSet = new Set(['2026', '2024-25 (Mar-Apr)', '2024-25 (Oct-Nov)']);

        // Helper: Normalize old/ambiguous yearSuffix values from practicalsData into canonical keys
        const normalizeSessionKey = (yr) => {
          const s = String(yr || '').trim();
          if (!s) return null;
          // Old standalone year keys that mapped to academic sessions
          if (s === '2025') return '2024-25 (Mar-Apr)'; // old Mar-Apr key
          if (s === '2024') return '2023-24';
          if (s === '2023') return '2022-23';
          if (s === '2022') return '2021-22';
          // Revised → Oct-Nov
          if (s === '2024-25 (revised)') return '2024-25 (Oct-Nov)';
          if (s === '2023-24 (revised)') return '2023-24 (Oct-Nov)';
          // Already canonical or APR/BIAN — keep as-is
          return s;
        };

        const snap = await getDocs(collection(db, 'practicalsData')).catch(() => null);
        if (snap && !snap.empty) {
          snap.docs.forEach(d => {
            const data = d.data();
            const yr = data.yearSuffix || data.Session || data.session || d.id.split('_').pop();
            const canonical = normalizeSessionKey(yr);
            if (canonical) sessionsSet.add(canonical);
          });
        }
        setAvailableSessions(Array.from(sessionsSet).sort((a, b) => b.localeCompare(a)));
      } catch (e) {
        console.warn('Session detection note:', e);
      }
    };
    detectPastSessions();
  }, []);

  const currentSubjectObj = SUBJECT_MAP.find(s => s.name === selectedSubject) || SUBJECT_MAP[1];
  const subjectMaxMarks = currentSubjectObj.defaultMax;
  const minPassMarks = getMinPassMarks(subjectMaxMarks);

  // Fetch Roster strictly for confirmed students with assigned class roll numbers
  const fetchPracticalData = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const targetSubjCode = currentSubjectObj.code;
      const targetSubjName = currentSubjectObj.name;
      const docId = `${clsNorm}_${selectedSubject}_${practicalType}_${yearSuffix}`;

      // 1. Fetch saved practical marks (supporting both docId format & legacy doc_1, doc_12, etc.)
      let savedMarksMap = {};
      try {
        const rawDocs = await getCachedCollection('practicalsData', false, 15 * 60 * 1000).catch(() => []);
        const docItems = Array.isArray(rawDocs) ? rawDocs : (rawDocs?.docs ? rawDocs.docs.map(d => ({ id: d.id, ...d.data() })) : []);
        docItems.forEach(data => {
          const dId = data.id || data.docId || '';

          // Class Match
          const docClass = String(data.className || data.Class || dId).toLowerCase();
          const matchClass = docClass.includes(clsNorm.toLowerCase()) || dId.toLowerCase().includes(clsNorm.toLowerCase());
          if (!matchClass && dId !== docId) return;

          // Year Match — normalize old yearSuffix keys before comparing
          // Old key "2025" = canonical "2024-25 (Mar-Apr)", "2024" = "2023-24", etc.
          const normalizeYr = (y) => {
            const s = String(y || '').trim();
            if (s === '2025') return '2024-25 (Mar-Apr)';
            if (s === '2024') return '2023-24';
            if (s === '2023') return '2022-23';
            if (s === '2022') return '2021-22';
            if (s === '2024-25 (revised)') return '2024-25 (Oct-Nov)';
            if (s === '2023-24 (revised)') return '2023-24 (Oct-Nov)';
            return s;
          };
          const docYr = String(data.yearSuffix || data.Session || data.session || dId.split('_').pop() || '').trim();
          const docYrNorm = normalizeYr(docYr);
          const targetNorm = normalizeYr(String(yearSuffix).trim());
          const matchYr = (docYrNorm === targetNorm) || dId === docId || (yearSuffix === CURRENT_SESSION && (docYr === '2026' || docYrNorm === '2026'));
          if (!matchYr) return;

          // Subject Match (supporting codes, full names, and Botany/Zoology/Biology splits)
          const docSubj = String(data.subjectName || data.Subject || data.subjectCode || data.subject || '').toUpperCase();
          const matchSubj = docSubj.includes(targetSubjCode.toUpperCase()) || 
                            docSubj.includes(targetSubjName.toUpperCase()) ||
                            (targetSubjCode === 'BO' && (docSubj.includes('BOTANY') || docSubj.includes('BO') || docSubj.includes('BI'))) ||
                            (targetSubjCode === 'ZO' && (docSubj.includes('ZOOLOGY') || docSubj.includes('ZO') || docSubj.includes('BI'))) ||
                            (targetSubjCode === 'BI' && (docSubj.includes('BIOLOGY') || docSubj.includes('BOTANY') || docSubj.includes('ZOOLOGY'))) ||
                            dId === docId;
          
          if (!matchSubj && dId !== docId) return;

          // Parse records array if present
          if (Array.isArray(data.records)) {
            data.records.forEach(r => {
              const rRoll = String(r.rollNo || r.classRollNo || '').trim();
              const rBoard = String(r.boardRollNo || r.boardRoll || '').trim();
              const rForm = String(r.formNo || '').trim();
              const rName = String(r.name || r.studentName || '').toLowerCase().trim();

              const recObj = {
                rollNo: rRoll || rBoard,
                classRollNo: rRoll || rBoard,
                boardRoll: rBoard,
                boardRollNo: rBoard,
                name: r.name || r.studentName,
                studentName: r.name || r.studentName,
                parentName: r.parentName || '',
                formNo: rForm || rRoll,
                practicalMarks: r.practicalMarks,
                vivaMarks: r.vivaMarks || '',
                totalMarks: r.totalMarks || r.practicalMarks
              };

              if (rRoll) savedMarksMap[rRoll] = recObj;
              if (rBoard) savedMarksMap[rBoard] = recObj;
              if (rForm) savedMarksMap[rForm] = recObj;
              if (rName) savedMarksMap[rName] = recObj;
            });
          }

          // Parse legacy flat stringified keys e.g. "1/201003044. Aarizoo Kawsar (Kawsar Ahmad Itoo)": 3
          Object.keys(data).forEach(k => {
            const match = k.match(/^(?:(\d+)\/)?(\d+)\.\s*(.+?)(?:\s*\((.+)\))?$/);
            if (match) {
              const serialNo = match[1] ? match[1].trim() : '';
              const boardRoll = match[2].trim();
              const studentName = match[3].trim();
              const parentName = match[4] ? match[4].trim() : '';
              const val = data[k];

              const recObj = {
                rollNo: serialNo || boardRoll,
                boardRoll: boardRoll,
                name: studentName,
                parentName: parentName,
                practicalMarks: val,
                totalMarks: val,
                vivaMarks: ''
              };

              if (serialNo) savedMarksMap[serialNo] = recObj;
              if (boardRoll) savedMarksMap[boardRoll] = recObj;
              if (studentName) savedMarksMap[studentName.toLowerCase()] = recObj;
            }
          });
        });
      } catch (e) {
        console.warn('Practicals read note:', e);
      }

      const cacheKey = `${selectedClass}_${yearSuffix}_${selectedSubject}_${practicalType}`;
      let uniqueStudents = masterRosterCache[cacheKey];

      if (!uniqueStudents || uniqueStudents.length === 0) {
        let allCandidates = [];

        // A. Primary Database Source: masterRegisters (The main student register database containing thousands of rows)
        try {
          const masterDocs = await getCachedCollection('masterRegisters').catch(() => []);
          if (Array.isArray(masterDocs)) {
            masterDocs.forEach(d => {
              const items = d.items || d.data || d.records;
              const docSession = d.Session || d.session || d.groupKey?.split('_')[0] || d.id?.split('_')[0] || '';
              const docClass = d.class || d.Class || d.groupKey?.split('_')[1] || '';

              if (Array.isArray(items)) {
                items.forEach(it => {
                  allCandidates.push({
                    ...it,
                    session: it.Session || it.session || docSession,
                    class: it.class || it.Class || it['Class'] || docClass
                  });
                });
              } else {
                allCandidates.push({
                  ...d,
                  session: d.Session || d.session || docSession,
                  class: d.class || d.Class || d['Class'] || docClass
                });
              }
            });
          }
        } catch (mErr) {
          console.warn('masterRegisters lookup note:', mErr);
        }

        // B. Secondary Database Source: admissions (Active admissions collection)
        try {
          const admDocs = await getCachedCollection('admissions').catch(() => []);
          if (Array.isArray(admDocs)) {
            admDocs.forEach(d => {
              const items = d.items || d.students || d.records;
              const docSession = d.Session || d.session || CURRENT_SESSION;
              const docClass = d.class || d.Class || d['Admission sought for class'] || '';

              if (Array.isArray(items)) {
                items.forEach(it => {
                  allCandidates.push({
                    ...it,
                    session: it.Session || it.session || docSession,
                    class: it.class || it.Class || it['Class'] || docClass
                  });
                });
              } else {
                allCandidates.push({
                  ...d,
                  session: d.Session || d.session || docSession,
                  class: d.class || d.Class || docClass
                });
              }
            });
          }
        } catch (admErr) {
          console.warn('Admissions lookup note:', admErr);
        }

        // C. Build Rich Index Maps for Hierarchical Matching
        const richByReg   = new Map();
        const richByForm  = new Map();
        const richByRoll  = new Map();
        const richByBoard = new Map();
        const richByAdm   = new Map();
        const richByName  = new Map();


        const indexRichItem = (it) => {
          if (!it) return;

          const itClass = extractStudentClass(it);
          const isMatchCls = isClassMatch(itClass, selectedClass);

          const setIfBetter = (map, key, item) => {
            if (!key || key === '—' || key === 'N/A' || key === '#N/A') return;
            const existing = map.get(key);
            if (!existing) {
              map.set(key, item);
            } else {
              const existingCls = extractStudentClass(existing);
              const existingMatches = isClassMatch(existingCls, selectedClass);
              if (!existingMatches && isMatchCls) {
                map.set(key, item); // Prioritize matching class record!
              }
            }
          };

          // 1. Reg No
          const rReg = getRegNo(it);
          if (rReg) {
            setIfBetter(richByReg, rReg, it);
            rReg.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean).forEach(rg => setIfBetter(richByReg, rg, it));
          }

          // 2. Form No
          const rForm = String(it.formNo || it['Form No.'] || it['Form Number'] || it.FormNo || '').trim();
          setIfBetter(richByForm, rForm, it);

          // 3. Class Roll No
          const rRoll = String(it.classRollNo || it.rollNo || it['Class Roll No'] || it['Roll No'] || '').trim();
          setIfBetter(richByRoll, rRoll, it);

          // 4. Board Exam Roll
          const boardKeys = [
            it['12th Exam Roll'], it['11th Exam Roll'], it['10th Exam Roll'],
            it['Exam Roll Number of Class 12th'], it['Exam Roll Number of Class 11th'], it['Exam Roll Number of Class 10th'],
            it['Exam R.No. (Current)'], it['Exam R.no. (Prev.)'],
            it.boardRoll, it.boardRollNo, it['Board Roll No'], it['Board Roll No.'],
            it['Exam Roll No'], it['Exam Roll No.']
          ];
          boardKeys.forEach(bk => {
            if (bk) {
              const sBk = String(bk).trim();
              setIfBetter(richByBoard, sBk, it);
            }
          });

          // 5. Adm No
          const rAdm = extractRawAdmNo(it);
          setIfBetter(richByAdm, rAdm, it);

          // 6. Student Name
          const rName = getStudentName(it).toLowerCase().trim();
          if (rName && rName !== 'student') setIfBetter(richByName, rName, it);
        };

        allCandidates.forEach(it => indexRichItem(it));

        let allDiscoveredStudents = [];

        // Method 1: Filter candidates from masterRegisters & admissions by Class + Session + Subject + Assigned Class Roll No
        allCandidates.forEach(st => {
          const stClass = extractStudentClass(st);
          const stSession = st.session || st.Session || st['Academic Session'];

          if (
            hasAssignedClassRoll(st) &&
            isClassMatch(stClass, selectedClass) &&
            isSessionMatch(stSession, yearSuffix) &&
            isSubjectOrStreamMatch(st, targetSubjCode, targetSubjName)
          ) {
            allDiscoveredStudents.push({
              ...st,
              studentName: getStudentName(st),
              formNo: st.formNo || st['Form No.'] || st['Form Number'] || '',
              classRollNo: st.classRollNo || st.rollNo || st['Class Roll No'] || '',
              admNo: extractRawAdmNo(st),
              regNo: getRegNo(st),
              subjects: st.subjects || st['Subjects'] || st['Stream / Subjects'] || selectedSubject,
              examRollBadges: getExamRollBadges(st, selectedClass)
            });
          }
        });

        // Method 2: Overlay pre-submitted marks from savedMarksMap (if teacher has submitted marks)
        if (Object.keys(savedMarksMap).length > 0) {
          const seenMarksKeys = new Set();
          Object.values(savedMarksMap).forEach((rec, idx) => {
            const uKey = String(rec.boardRoll || rec.rollNo || rec.name || idx + 1).toLowerCase().trim();
            if (seenMarksKeys.has(uKey)) return;
            seenMarksKeys.add(uKey);

            const rRoll  = String(rec.classRollNo || rec.rollNo || idx + 1).trim();
            const rName  = String(rec.name || rec.studentName || '').toLowerCase().trim();
            const rBoard = String(rec.boardRoll || rec.boardRollNo || '').trim();
            const rForm  = String(rec.formNo || rec.formNumber || '').trim();
            const rReg   = getRegNo(rec);
            const rAdm   = extractRawAdmNo(rec);

            let richSt = null;
            if (rReg) richSt = richByReg.get(rReg);
            if (!richSt && rReg) {
              const regs = rReg.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
              for (const rg of regs) { richSt = richByReg.get(rg); if (richSt) break; }
            }
            if (!richSt && rForm) richSt = richByForm.get(rForm);
            if (!richSt && rRoll) richSt = richByRoll.get(rRoll);
            if (!richSt && rBoard) richSt = richByBoard.get(rBoard);
            if (!richSt && rAdm) richSt = richByAdm.get(rAdm);
            if (!richSt && rName && rName !== 'student') richSt = richByName.get(rName);
            if (!richSt) richSt = {};

            // CRITICAL: Validate resolved student has assigned class roll AND belongs to selected class + session
            if (!hasAssignedClassRoll(richSt) && !hasAssignedClassRoll(rec)) {
              return; // Skip students without an assigned class roll number
            }

            const resolvedClass = extractStudentClass(richSt) || rec.class || rec.className || rec.Class || '';
            const resolvedSession = richSt.session || richSt.Session || richSt['Academic Session'] || rec.session || rec.Session || rec.yearSuffix || '';

            if (resolvedClass && !isClassMatch(resolvedClass, selectedClass)) {
              return; // Skip records from a different class
            }
            if (resolvedSession && !isSessionMatch(resolvedSession, yearSuffix)) {
              return; // Skip records from a different session
            }

            const resolvedName = getStudentName(richSt);
            const finalName = (resolvedName && resolvedName !== 'Student') ? resolvedName : (rec.name && rec.name !== 'Student' ? rec.name : (rec.studentName || `Student`));

            allDiscoveredStudents.push({
              id: rec.boardRoll || rec.rollNo || richSt.id || `saved_${idx}`,
              ...richSt,
              classRollNo: richSt.classRollNo || richSt['Class Roll No'] || richSt['Class R.No.'] || richSt['Class R.No'] || rec.classRollNo || rec.rollNo,
              rollNo: richSt.classRollNo || richSt['Class Roll No'] || richSt['Class R.No.'] || richSt['Class R.No'] || rec.classRollNo || rec.rollNo,
              studentName: finalName,
              parentName: rec.parentName || richSt.parentName || richSt["Father's Name"] || richSt['Father Name'] || '',
              boardRollNo: rBoard || richSt.boardRollNo || richSt['Board Roll No'] || '',
              formNo: richSt.formNo || richSt['Form No.'] || richSt['Form Number'] || rec.formNo || '',
              admNo: extractRawAdmNo(richSt) || extractRawAdmNo(rec),
              regNo: getRegNo(richSt) || getRegNo(rec),
              subjects: richSt.subjects || richSt['Subjects'] || richSt['Stream / Subjects'] || rec.subjects || selectedSubject,
              subjectsAbbr: getAbbreviatedSubjects(richSt) || getAbbreviatedSubjects(rec) || selectedSubject,
              stream: richSt.stream || richSt['Stream'] || richSt['Stream for Class 11th'] || rec.stream || '',
              examRollBadges: getExamRollBadges({ ...richSt, boardRoll: rBoard || richSt.boardRollNo, boardRollNo: rBoard || richSt.boardRollNo }, selectedClass),
              practicalMarks: rec.practicalMarks,
              vivaMarks: rec.vivaMarks,
              totalMarks: rec.totalMarks
            });
          });
        }

        // De-duplicate student records using composite keys to prevent cross-class/cross-session collisions
        // PRIMARY KEY: Class Roll No (session-specific) scoped by class + session
        // FALLBACK: Reg No / Form No scoped by session end-year
        const uniqueMap = new Map();
        allDiscoveredStudents.forEach(st => {
          if (!hasAssignedClassRoll(st)) return; // Strictly check class roll first!

          const stCls = extractStudentClass(st) || selectedClass;
          const clsDigits = String(stCls).replace(/\D/g, '') || String(selectedClass).replace(/\D/g, '');

          // Session scope to prevent collisions across years
          const sesScope = getSessionEndYear(String(st.session || st.Session || yearSuffix || '')) || yearSuffix;

          // Class Roll No is best dedup key — assigned per-session per-class
          const rollKey = String(
            st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st['Class R.No'] ||
            st['Class R. No.'] || st.classRollNo || st.rollNo || ''
          ).trim();

          let key;
          if (rollKey) {
            key = `${clsDigits}_${sesScope}_roll_${rollKey.toLowerCase()}`;
          } else {
            const regId = getRegNo(st) || st.formNo || st['Form No.'] || '';
            key = regId
              ? `${clsDigits}_${sesScope}_reg_${regId.toLowerCase().trim()}`
              : `${clsDigits}_${sesScope}_name_${getStudentName(st).toLowerCase().trim()}`;
          }

          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, st);
          }
        });

        uniqueStudents = Array.from(uniqueMap.values());
        if (uniqueStudents.length > 0) {
          setMasterRosterCache(prev => ({ ...prev, [cacheKey]: uniqueStudents }));
        }
      }

      // Filter by Subject Matcher & Strict Class Roll Check
      const subjectFiltered = uniqueStudents.filter(st => {
        // STRICT CHECK FIRST: Must have assigned Class Roll No
        if (!hasAssignedClassRoll(st)) return false;

        // Always enforce class match regardless of session
        const stCls = extractStudentClass(st);
        if (stCls && !isClassMatch(stCls, selectedClass)) return false;

        // Skip granular subject filtering for historical records (marks already submitted)
        if (st.isHistorical) return true;

        const rawStr = extractRawSubjectsString(st);
        const rawSubjects = Array.isArray(rawStr) ? rawStr.join(', ') : String(rawStr);
        const enrichedSt = {
          ...st,
          rawSubjects,
          subjectsAbbr: getAbbreviatedSubjects(st)
        };
        return isSubjectMatch(enrichedSt, selectedSubject);
      });

      // Check local storage draft
      const clsNormKey = String(selectedClass).replace(/class/i, '').trim();
      const draftKey = `draft_prac_${clsNormKey}_${selectedSubject}_${practicalType}_${yearSuffix}`;
      let draftMap = {};
      let localDraftSavedTime = null;
      try {
        const localDraftRaw = localStorage.getItem(draftKey);
        if (localDraftRaw) {
          const parsed = JSON.parse(localDraftRaw);
          if (parsed && parsed.marksMap) {
            draftMap = parsed.marksMap;
            localDraftSavedTime = parsed.savedAt;
          }
        }
      } catch (dErr) {
        console.warn('Local draft read error:', dErr);
      }

      // Format final student practical roster — STRICT CLASS ROLL FIRST
      const formatted = subjectFiltered
        .filter(st => hasAssignedClassRoll(st))
        .map((st) => {
          const roll = String(
            st['Class Roll No'] ||
            st['Class Roll No.'] ||
            st['Class R.No.'] ||
            st['Class R.No'] ||
            st['Class R. No.'] ||
            st.classRollNo ||
            st.rollNo ||
            st['Roll No.'] ||
            st['Roll No'] ||
            st.roll_no ||
            ''
          ).trim();

          const name = getStudentName(st);
          const regNo = getRegNo(st);
          const examRollBadgesList = getExamRollBadges(st, selectedClass);
          const subsAbbr = getAbbreviatedSubjects(st);
          const rawSubjFull = extractRawSubjectsString(st);
          const key = roll || st.formNo || st.id;
          const saved = savedMarksMap[String(key).trim()] || 
                        savedMarksMap[String(st.formNo || '').trim()] || 
                        savedMarksMap[String(st.id || '').trim()] || 
                        savedMarksMap[String(name || '').toLowerCase().trim()] || 
                        {};
          const draft = draftMap[key] || {};

          return {
            rollNo: roll,
            name: name,
            regNo: regNo,
            examRollBadges: examRollBadgesList,
            subjectsAbbr: subsAbbr,
            rawSubjects: Array.isArray(rawSubjFull) ? rawSubjFull.join(', ') : String(rawSubjFull),
            formNo: (st.formNo && String(st.formNo) !== String(roll) && String(st.formNo).length > 3)
              ? st.formNo
              : (st['Form No.'] || st['Form No'] || st['Form Number'] || st.form_no || ''),
            admNo: extractRawAdmNo(st),
            practicalMarks: draft.practicalMarks ?? saved.practicalMarks ?? '',
            vivaMarks: draft.vivaMarks ?? saved.vivaMarks ?? '',
          };
        });

      setDraftSavedAt(localDraftSavedTime || null);
      setStudentMarks(formatted);
    } catch (err) {
      console.error('Failed to fetch practical roster:', err);
      setStudentMarks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject, practicalType, yearSuffix, masterRosterCache]);

  useEffect(() => {
    fetchPracticalData();
  }, [fetchPracticalData]);

  // Fetch Past Submission History
  const fetchSubmissionHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const snap = await getDocs(collection(db, 'practicalsData'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        setSubmissionHistory(list);
      } else {
        setSubmissionHistory([]);
      }
    } catch (e) {
      console.error('Failed to load practicals history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);



  // Handle Mark Change — full range 0 to subjectMaxMarks allowed
  const handleMarkChange = (index, field, val) => {
    const rawVal = val.trim().toUpperCase();
    if (rawVal !== '' && rawVal !== 'A' && rawVal !== 'AB' && rawVal !== 'ABSENT') {
      const num = Number(rawVal);
      // Allow full range 0 to max (not split 70/30)
      if (isNaN(num) || num < 0 || num > subjectMaxMarks) {
        return;
      }
    }

    setStudentMarks((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: rawVal,
      };
      return updated;
    });
  };

  // 1. Save Evaluation Draft (LocalStorage + State)
  const handleSaveDraft = () => {
    if (!studentMarks || studentMarks.length === 0) {
      setAlert({ type: 'error', text: 'No student roster available to save as draft.' });
      return;
    }
    try {
      const clsNormKey = String(selectedClass).replace(/class/i, '').trim();
      const draftKey = `draft_prac_${clsNormKey}_${selectedSubject}_${practicalType}_${yearSuffix}`;
      const marksMap = {};
      studentMarks.forEach(st => {
        const key = st.rollNo || st.formNo;
        marksMap[key] = {
          practicalMarks: st.practicalMarks,
          vivaMarks: st.vivaMarks
        };
      });

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const draftPayload = {
        className: selectedClass,
        subject: selectedSubject,
        practicalType,
        yearSuffix,
        savedAt: timeStr,
        marksMap
      };
      localStorage.setItem(draftKey, JSON.stringify(draftPayload));
      setDraftSavedAt(timeStr);
      setAlert({
        type: 'success',
        text: `Draft saved locally at ${timeStr}! You can safely return anytime before final submission.`
      });
    } catch (err) {
      console.error('Save draft error:', err);
      setAlert({ type: 'error', text: 'Failed to save draft locally.' });
    }
  };

  // 2. Data Validation & Initiate Final Submit
  const handleInitiateFinalSubmit = () => {
    if (!studentMarks || studentMarks.length === 0) {
      setAlert({ type: 'error', text: 'No student roster available for final submission.' });
      return;
    }

    let completed = 0;
    let absent = 0;
    let incomplete = 0;
    const incompleteList = [];

    studentMarks.forEach(st => {
      const isAbsent = st.practicalMarks === 'A' || st.vivaMarks === 'A' || st.practicalMarks === 'AB' || st.vivaMarks === 'AB';
      const isFilled = st.practicalMarks !== '' || st.vivaMarks !== '';

      if (isAbsent) {
        absent++;
        completed++;
      } else if (isFilled) {
        completed++;
      } else {
        incomplete++;
        incompleteList.push(st);
      }
    });

    setValidationData({
      totalCount: studentMarks.length,
      completedCount: completed,
      incompleteCount: incomplete,
      absentCount: absent,
      incompleteList
    });
    setShowValidationModal(true);
  };

  // 3. Execute Final Submission to Firestore
  const executeFinalSubmit = async (autoMarkAbsentForUnfilled = false) => {
    setSaving(true);
    setShowValidationModal(false);
    setAlert(null);
    try {
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const docId = `${clsNorm}_${selectedSubject}_${practicalType}_${yearSuffix}`;

      const records = studentMarks.map((s) => {
        let pMarks = s.practicalMarks;
        let vMarks = s.vivaMarks;

        if (autoMarkAbsentForUnfilled && pMarks === '' && vMarks === '') {
          pMarks = 'AB';
          vMarks = 'AB';
        }

        const isAbsent = pMarks === 'A' || vMarks === 'A' || pMarks === 'AB' || vMarks === 'AB';
        const pVal = isNaN(Number(pMarks)) ? 0 : Number(pMarks);
        const vVal = isNaN(Number(vMarks)) ? 0 : Number(vMarks);
        const total = isAbsent ? 'AB' : (pVal + vVal);

        return {
          rollNo: s.rollNo,
          name: s.name,
          formNo: s.formNo,
          regNo: s.regNo,
          examRollBadges: s.examRollBadges,
          practicalMarks: pMarks,
          vivaMarks: vMarks,
          totalMarks: total,
          marksInWords: numberToWords(total),
        };
      });

      await setDoc(doc(db, 'practicalsData', docId), {
        docId,
        className: selectedClass,
        subject: selectedSubject,
        subjectCode: currentSubjectObj.code,
        practicalType,
        yearSuffix,
        records,
        status: 'submitted',
        isDraft: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Clear local draft after successful final submission
      const clsNormKey = String(selectedClass).replace(/class/i, '').trim();
      const draftKey = `draft_prac_${clsNormKey}_${selectedSubject}_${practicalType}_${yearSuffix}`;
      localStorage.removeItem(draftKey);
      setDraftSavedAt(null);

      try {
        await addDoc(collection(db, 'activityLogs'), {
          activityType: 'practical_final_submission',
          className: selectedClass,
          subject: selectedSubject,
          practicalType,
          yearSuffix,
          recordsCount: records.length,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Activity log note:', logErr);
      }

      setAlert({
        type: 'success',
        text: `Final evaluation award list submitted & locked for ${selectedSubject} (${selectedClass}).`,
      });
    } catch (err) {
      console.error('Final submit error:', err);
      setAlert({ type: 'error', text: 'Failed to complete final practical submission.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Dynamic Multi-Column Sorting
  const sortedStudents = [...studentMarks].sort((a, b) => {
    if (sortBy === 'rollAsc') {
      const rA = parseInt(a.rollNo, 10) || 0;
      const rB = parseInt(b.rollNo, 10) || 0;
      return rA - rB;
    }
    if (sortBy === 'rollDesc') {
      const rA = parseInt(a.rollNo, 10) || 0;
      const rB = parseInt(b.rollNo, 10) || 0;
      return rB - rA;
    }
    if (sortBy === 'nameAsc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'formAsc') {
      const fA = parseInt(a.formNo, 10) || 0;
      const fB = parseInt(b.formNo, 10) || 0;
      return fA - fB;
    }
    return 0;
  });

  const displayedStudents = showFailOnly
    ? sortedStudents.filter((s) => {
        const isAbsent = s.practicalMarks === 'A' || s.vivaMarks === 'A' || s.practicalMarks === 'AB' || s.vivaMarks === 'AB';
        if (isAbsent) return true;
        if (s.practicalMarks === '' || s.vivaMarks === '') return true;
        const total = (Number(s.practicalMarks) || 0) + (Number(s.vivaMarks) || 0);
        return total < minPassMarks;
      })
    : sortedStudents;

  return (
    <div className="w-full min-h-[90vh] py-3 sm:py-4 px-2 sm:px-4 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Practical Evaluation Portal"
        description="Upload practical evaluation & lab marks, and generate official award lists."
        path="/portal/teacher/practicals"
      />

      <div className="max-w-6xl mx-auto space-y-3">
        {/* Header Navigation Bar with Logout */}
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/portal/teacher"
            className="inline-flex items-center gap-1 text-xs font-black hover:underline shrink-0"
            style={{ color: 'var(--teal-accent, #0d9488)' }}
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Back to Teacher Workspace</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setShowHistoryModal(true);
                fetchSubmissionHistory();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <History size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Submission Log</span>
            </button>
          </div>
        </div>

        {/* Main Ultra-Compact Card */}
        <div className="rounded-2xl p-3.5 sm:p-4 border shadow-md space-y-3 bg-white dark:bg-slate-900" style={{ borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {/* Title Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-600/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs flex-shrink-0">
                <UserCheck size={20} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-0.5 border border-indigo-500/20">
                  <ShieldCheck size={10} /> LAB EVALUATION SYSTEM
                </div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  Practical Evaluation Portal
                </h1>
              </div>
            </div>
          </div>

          {/* Alert Notification */}
          {alert && (
            <div className={`p-2.5 rounded-xl text-xs font-bold flex items-start gap-2 animate-fadeIn ${
              alert.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              {alert.type === 'error' ? <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
              <span>{alert.text}</span>
            </div>
          )}

          {/* Compact Filter Controls Bar — 2 cols on mobile, 4 on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <div className="space-y-0.5">
              <label className="text-[10px] font-black text-slate-700 dark:text-slate-300">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="12th">12th Class</option>
                <option value="11th">11th Class</option>
                <option value="10th">10th Class</option>
                <option value="9th">9th Class</option>
              </select>
            </div>

            <CustomSubjectSelect
              selectedSubject={selectedSubject}
              setSelectedSubject={setSelectedSubject}
              subjectMap={SUBJECT_MAP}
              currentSubjectObj={currentSubjectObj}
            />

            <div className="space-y-0.5">
              <label className="text-[10px] font-black text-slate-700 dark:text-slate-300">Eval. Type</label>
              <select
                value={practicalType}
                onChange={(e) => setPracticalType(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="Internal Assessment">Internal</option>
                <option value="External Practical">External</option>
                <option value="Term End Evaluation">Term End</option>
              </select>
            </div>

            <div className="space-y-0.5">
              <label className="text-[10px] font-black text-slate-700 dark:text-slate-300">Session</label>
              <select
                value={yearSuffix}
                onChange={(e) => setYearSuffix(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {availableSessions.map(yr => {
                  let label = yr;
                  if (yr === '2026') label = '2025-26 (Reg. 2026)';
                  else if (yr === '2025 APR/BIAN') label = '2025 (Annual Private/Biannual)';
                  else if (yr === '2026 APR/BIAN') label = '2026 (Annual Private/Biannual)';
                  else if (yr === '2024-25 (Mar-Apr)') label = '2024-25 (Mar-Apr)';
                  else if (yr === '2024-25 (Oct-Nov)') label = '2024-25 (Oct-Nov)';
                  else if (yr === '2024-25 (revised)') label = '2024-25 (Oct-Nov)';
                  else if (yr === '2024-25') label = '2024-25 (Mar-Apr)';
                  else if (yr === '2025') label = '2024-25 (Mar-Apr)';
                  else if (yr === '2024') label = '2023-24 (Reg. 2024)';
                  else if (yr.match(/\d{4}-\d{2}\s*\(Mar-Apr\)/i)) label = yr;
                  else if (yr.match(/\d{4}-\d{2}\s*\(Oct-Nov\)/i)) label = yr;
                  else if (yr.match(/^20\d\d$/)) {
                    const yNum = parseInt(yr, 10);
                    label = `${yNum - 1}-${yr.slice(2)} (Reg. ${yr})`;
                  }
                  return <option key={yr} value={yr}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Table Toolbar — compact on mobile */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 px-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <div className="font-extrabold text-slate-700 dark:text-slate-300 text-[11px]">
              <span className="text-indigo-600 dark:text-indigo-400 font-black">{displayedStudents.length}</span> Students
              {showFailOnly && <span className="ml-1 text-rose-600 font-bold">(Fail &lt;{minPassMarks}M)</span>}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                <ArrowUpDown size={11} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-1.5 py-0.5 rounded-md border text-[10px] font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="rollAsc">Roll ↑</option>
                  <option value="rollDesc">Roll ↓</option>
                  <option value="nameAsc">Name A-Z</option>
                  <option value="formAsc">Form No.</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowFailOnly(!showFailOnly)}
                className={`px-2 py-0.5 rounded-md font-bold text-[10px] border transition-all cursor-pointer ${
                  showFailOnly
                    ? 'bg-rose-500 text-white border-rose-500'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {showFailOnly ? 'All' : '📋 Fail'}
              </button>

              <button
                type="button"
                onClick={handlePrintReport}
                className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20 cursor-pointer flex items-center gap-1"
              >
                <Printer size={11} /> Print
              </button>
            </div>
          </div>

          {/* Student Roster Marks Entry Table - Ultra Compact */}
          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-slate-400">
              <RefreshCw size={18} className="animate-spin mx-auto mb-1.5 text-indigo-600" />
              Loading roster...
            </div>
          ) : displayedStudents.length > 0 ? (
            <>
              {/* ── MOBILE CARD LAYOUT (hidden on sm+) ── */}
              <div className="sm:hidden space-y-2">
                {displayedStudents.map((st, idx) => {
                  const isAbsent = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
                  const totalVal = isAbsent ? 'AB' : (st.practicalMarks !== '' ? st.practicalMarks : '—');
                  const originalIdx = studentMarks.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);
                  const abbrFull = st.subjectsAbbr || '';
                  const streamMatch = abbrFull.match(/\(([SGH])\)$/i);
                  const streamCode = streamMatch ? streamMatch[1].toUpperCase() : '';
                  const subjectsPart = streamCode ? abbrFull.replace(/\s*\([SGH]\)$/i, '').trim() : abbrFull;
                  const streamColors = { S: 'bg-teal-500/15 text-teal-700 border-teal-500/30', H: 'bg-purple-500/15 text-purple-700 border-purple-500/30', G: 'bg-amber-500/15 text-amber-700 border-amber-500/30' };

                  return (
                    <div key={idx} className={`rounded-xl border p-2.5 space-y-2 ${isAbsent ? 'border-amber-400/40 bg-amber-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                      {/* Student info row */}
                      <div className="flex items-start gap-2">
                        <span className="min-w-[28px] h-7 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center border border-indigo-500/20">{st.rollNo}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight truncate">{st.name}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {st.formNo && String(st.formNo) !== String(st.rollNo) && String(st.formNo).length > 3 && (
                              <span className="text-[9px] px-1.5 py-0 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">Form #{st.formNo}</span>
                            )}
                            {st.admNo && (
                              <span className="text-[9px] px-1.5 py-0 rounded font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">Adm #{st.admNo}</span>
                            )}
                            {st.subjectsAbbr && (
                              <span className="text-[9px] px-1.5 py-0 rounded font-mono bg-teal-500/10 text-teal-700 dark:text-teal-400 font-black border border-teal-500/20">
                                Subs: {st.subjectsAbbr}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Total badge */}
                        <span className={`min-w-[36px] text-center text-xs font-black px-1.5 py-1 rounded-lg border ${
                          isAbsent ? 'bg-amber-500/10 text-amber-600 border-amber-400/30' : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        }`}>{totalVal}</span>
                      </div>
                      {/* Marks inputs row */}
                      <div>
                        <div className="text-[9px] font-black text-slate-500 mb-0.5">Marks Obt. (Prac/Assignment&Viva) ({subjectMaxMarks}M)</div>
                        <input
                          type="text"
                          placeholder={`0-${subjectMaxMarks} / A`}
                          value={st.practicalMarks}
                          onChange={(e) => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 uppercase text-center"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP TABLE (hidden on mobile) ── */}
              <div className="hidden sm:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-black uppercase text-[9.5px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-2.5 w-16 cursor-pointer hover:text-indigo-600" onClick={() => setSortBy(sortBy === 'rollAsc' ? 'rollDesc' : 'rollAsc')}>
                        Roll {sortBy.startsWith('roll') ? (sortBy === 'rollAsc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="py-2 px-2.5 cursor-pointer hover:text-indigo-600" onClick={() => setSortBy(sortBy === 'nameAsc' ? 'rollAsc' : 'nameAsc')}>
                        Student Details {sortBy === 'nameAsc' ? '↑' : ''}
                      </th>
                      <th className="py-2 px-2 text-center w-56">Marks Obt. (Prac/Assignment&Viva) ({subjectMaxMarks}M)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                    {displayedStudents.map((st, idx) => {
                      const isAbsent = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
                      const totalVal = isAbsent ? 'ABSENT' : (st.practicalMarks !== '' ? st.practicalMarks : '-');
                      const inWords = numberToWords(totalVal);
                      const originalIdx = studentMarks.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);

                      return (
                        <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors ${isAbsent ? 'bg-amber-500/5' : ''}`}>
                          <td className="py-1.5 px-2.5 font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">{st.rollNo}</td>
                          <td className="py-1.5 px-2.5 space-y-0.5">
                            <div className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">{st.name}</div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[9.5px]">
                              {st.formNo && String(st.formNo) !== String(st.rollNo) && String(st.formNo).length > 3 && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">Form #{st.formNo}</span>
                              )}
                              {st.admNo && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">Adm #{st.admNo}</span>
                              )}
                              {st.regNo && <span className="px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 font-black border border-blue-500/20">Reg: {st.regNo}</span>}
                              {(st.examRollBadges || []).map((b, bIdx) => (
                                <span key={bIdx} className={`px-1.5 py-0.2 rounded font-mono font-black border ${
                                  b.isCurrent ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}>{b.label}: {b.value}</span>
                              ))}
                              {/* Subjects + Stream — exact format matching attendance portal */}
                              {st.subjectsAbbr && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-teal-500/10 text-teal-700 dark:text-teal-400 font-black border border-teal-500/20 text-[9.5px]">
                                  Subs: {st.subjectsAbbr}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="text" placeholder={`0-${subjectMaxMarks} or A`} value={st.practicalMarks}
                              onChange={(e) => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg border text-xs font-bold h-7 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 uppercase text-center" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs font-bold text-slate-400 border rounded-xl border-slate-200 dark:border-slate-800">
              No confirmed registered students with assigned class roll found for {selectedClass}.
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              {draftSavedAt ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-black">
                  <Bookmark size={13} /> Draft auto-saved at {draftSavedAt}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 italic">● Draft will auto-save as you edit</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || studentMarks.length === 0}
                className="px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Bookmark size={14} className="text-amber-500" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleInitiateFinalSubmit}
                disabled={saving || studentMarks.length === 0}
                className="px-5 py-2 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Final Submit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Final Submission Validation & Confirmation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border shadow-2xl space-y-4 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Final Practical Submission Check</h3>
                  <p className="text-[11px] font-bold text-slate-500">{selectedSubject} • {selectedClass} • {practicalType}</p>
                </div>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Validation Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] font-black text-slate-400">TOTAL</div>
                <div className="text-base font-black text-slate-900 dark:text-white">{validationData.totalCount}</div>
              </div>
              <div className="p-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-center">
                <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">COMPLETE</div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{validationData.completedCount}</div>
              </div>
              <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-center">
                <div className="text-[10px] font-black text-amber-600 dark:text-amber-400">ABSENT</div>
                <div className="text-base font-black text-amber-600 dark:text-amber-400">{validationData.absentCount}</div>
              </div>
              <div className={`p-2.5 rounded-xl border text-center ${validationData.incompleteCount > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                <div className="text-[10px] font-black">INCOMPLETE</div>
                <div className="text-base font-black">{validationData.incompleteCount}</div>
              </div>
            </div>

            {/* Incomplete Warning or Complete Banner */}
            {validationData.incompleteCount > 0 ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black">Unentered Student Marks Found ({validationData.incompleteCount})</div>
                    <div className="text-[11px] mt-0.5">Please review the incomplete student list below. You can return to edit or auto-mark unfilled entries as Absent.</div>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs space-y-1">
                  {validationData.incompleteList.map((st, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-indigo-600 text-xs">#{st.rollNo}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{st.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">Empty Marks</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={18} className="shrink-0" />
                <div>
                  <div className="font-black">Roster Evaluation Complete!</div>
                  <div className="text-[11px] mt-0.5">All {validationData.totalCount} students have clean marks or absent classifications. Ready for official board lock.</div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  if (validationData.incompleteCount > 0) {
                    setShowFailOnly(true);
                  }
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                {validationData.incompleteCount > 0 ? 'Return & Edit Entries' : 'Cancel'}
              </button>

              {validationData.incompleteCount > 0 ? (
                <button
                  type="button"
                  onClick={() => executeFinalSubmit(true)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <AlertCircle size={14} /> Submit & Auto-Mark Unfilled as Absent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => executeFinalSubmit(false)}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Confirm & Lock Final Submission
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submission History Drawer/Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-xl space-y-3 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <History className="text-indigo-600 dark:text-indigo-400" size={18} />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">Practicals Submission History Log</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Close
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-6 text-center text-xs font-bold text-slate-400">
                <RefreshCw size={16} className="animate-spin mx-auto mb-1 text-indigo-600" />
                Fetching historical submissions...
              </div>
            ) : submissionHistory.length > 0 ? (
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {submissionHistory.map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                        {item.className} • {item.subject} ({item.practicalType || 'Internal'})
                      </div>
                      <div className="text-[9.5px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} /> {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">• {item.records?.length || 0} Students</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedClass(item.className || '12th');
                        setSelectedSubject(item.subject || 'Physics');
                        if (item.practicalType) setPracticalType(item.practicalType);
                        if (item.yearSuffix) setYearSuffix(item.yearSuffix);
                        setShowHistoryModal(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[9.5px] font-black bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20 cursor-pointer"
                    >
                      Load Record
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs font-bold text-slate-400">
                No past practical submission records found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
