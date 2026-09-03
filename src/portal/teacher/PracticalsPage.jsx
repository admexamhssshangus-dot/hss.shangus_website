import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, UserCheck, RefreshCw, AlertCircle, 
  CheckCircle2, Printer, ShieldCheck, History, Clock, ArrowUpDown,
  Bookmark, Send, ChevronDown, Check, SlidersHorizontal, Zap, X
} from 'lucide-react';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { getCachedCollection } from '../../services/dbCache';
import { printIndividualAwardRoll } from '../../utils/practicalsPdfGenerator';
import { loadSiteSettings } from '../../utils/settingsLoader';
import {
  getSubjectMarksConfig,
  getAdminPracticalsSettings,
  SUBJECT_CONFIG_DEFS
} from '../../utils/practicalsSettingsManager';
import ModernLoader from '../../components/ModernLoader';

// Comprehensive JKBOSE Subject List mapped for Teacher Evaluation Portal
export const SUBJECT_MAP = SUBJECT_CONFIG_DEFS.map(s => ({
  name: s.name,
  code: s.code,
  defaultMax: 20
}));

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
function isSessionMatch(stSession, targetYearSuffix) {
  if (!stSession) return true;
  const sStr = String(stSession).toLowerCase().trim();
  const tStr = String(targetYearSuffix).toLowerCase().trim();

  // Exact string match
  if (sStr === tStr) return true;

  // Normalize standard session aliases
  const normalize = (val) => {
    let s = String(val || '').toLowerCase().trim();
    if (s === '2026' || s.includes('2025-26') || s.includes('2025-2026')) return '2025-26';
    if (s === '2025' || s.includes('oct-nov') || s.includes('oct/nov') || s.includes('revised') || s === '2024-25' || s === '2024-2025') {
      if (s.includes('mar-apr') || s.includes('mar/apr')) return '2024-25 (mar-apr)';
      return '2024-25 (oct-nov)';
    }
    if (s === '2024' || s.includes('2023-24') || s.includes('2023-2024')) return '2023-24';
    if (s === '2023' || s.includes('2022-23') || s.includes('2022-2023')) return '2022-23';
    return s;
  };

  const sNorm = normalize(sStr);
  const tNorm = normalize(tStr);

  if (sNorm === tNorm) return true;

  // Detect APR/BIAN (Annual Private / Bi-annual) vs Regular
  const aprBianPattern = /\b(apr|bian|biannual|bi-annual|private|annual\s*private)\b/i;
  const sIsAprBian = aprBianPattern.test(sStr);
  const tIsAprBian = aprBianPattern.test(tStr);
  if (sIsAprBian !== tIsAprBian) return false;

  // Detect sub-session qualifiers
  const sIsMarApr = sStr.includes('mar-apr') || sStr.includes('mar/apr');
  const tIsMarApr = tStr.includes('mar-apr') || tStr.includes('mar/apr');
  const sIsOctNov = sStr.includes('oct-nov') || sStr.includes('oct/nov') || sStr.includes('revised');
  const tIsOctNov = tStr.includes('oct-nov') || tStr.includes('oct/nov') || tStr.includes('revised');

  if (sIsMarApr && tIsOctNov) return false;
  if (sIsOctNov && tIsMarApr) return false;

  // Compare END YEARS (the year when exams happen)
  const sEndYear = getSessionEndYear(sStr);
  const tEndYear = getSessionEndYear(tStr);
  if (sEndYear && tEndYear) {
    return sEndYear === tEndYear;
  }

  return sStr.includes(tStr) || tStr.includes(sStr);
}

// Helper: Subject / Stream Matcher
function isSubjectOrStreamMatch(st, targetSubjectCode, targetSubjectName) {
  if (!targetSubjectCode && !targetSubjectName) return true;

  const codeUpper = String(targetSubjectCode || '').toUpperCase().trim();
  const nameUpper = String(targetSubjectName || '').toUpperCase().trim();

  // 1. General English is COMPULSORY for 100% of students in 11th & 12th!
  if (codeUpper === 'EN' || nameUpper.includes('ENGLISH')) return true;

  const rawSubjStr = String(
    extractRawSubjectsString(st) ||
    st.subs ||
    st['Subs'] ||
    st.rawSubjects ||
    st.subjects ||
    st.Subjects ||
    st.subject ||
    st['Stream / Subjects'] ||
    st['Subject Combination'] ||
    st['Selected Subjects'] ||
    ''
  ).toUpperCase();

  const streamStr = String(
    st.stream ||
    st.Stream ||
    st['Stream for Class 11th'] ||
    st['Stream for Class 12th'] ||
    st['Stream Studied in Class 11th'] ||
    st['Stream opted in Class 11th'] ||
    ''
  ).toUpperCase();

  const isScience = streamStr.includes('SCIENCE') || streamStr.includes('MED') || streamStr.includes('SCI') || rawSubjStr.includes('PHYSICS') || rawSubjStr.includes('CHEMISTRY') || /\b(PH|CH)\b/i.test(rawSubjStr);
  const isNonMed = streamStr.includes('NON-MED') || streamStr.includes('NONMED') || streamStr.includes('NON MEDICAL') || (/\b(MATHEMATICS|MATHS|MATH|MA)\b/i.test(rawSubjStr) && !/\b(BIOLOGY|BOTANY|ZOOLOGY|BIO|BO|ZO|BI)\b/i.test(rawSubjStr));
  const isCommerce = streamStr.includes('COMMERCE');
  const isArts = streamStr.includes('ARTS') || streamStr.includes('HUMANITIES');

  // 2. Physics & Chemistry
  if (codeUpper === 'PH' || codeUpper === 'CH') {
    if (isScience || rawSubjStr.includes(codeUpper) || (codeUpper === 'PH' && rawSubjStr.includes('PHYSICS')) || (codeUpper === 'CH' && rawSubjStr.includes('CHEMISTRY'))) return true;
  }

  // 3. Botany, Zoology, Biology
  if (['BO', 'ZO', 'BI'].includes(codeUpper)) {
    if (rawSubjStr.includes('BI') || rawSubjStr.includes('BO') || rawSubjStr.includes('ZO') || rawSubjStr.includes('BIOLOGY') || rawSubjStr.includes('BOTANY') || rawSubjStr.includes('ZOOLOGY')) return true;
    if (isScience && !isNonMed) return true;
  }

  // 4. Mathematics
  if (codeUpper === 'MA') {
    if (rawSubjStr.includes('MA') || rawSubjStr.includes('MATH') || rawSubjStr.includes('MATHEMATICS')) return true;
    if (isScience && isNonMed) return true;
  }

  // 5. Environmental Science
  if (codeUpper === 'ES') {
    if (rawSubjStr.includes('ES') || rawSubjStr.includes('ENV') || rawSubjStr.includes('ENVIRONMENTAL')) return true;
    if (isScience) return true;
  }

  // 6. Physical Education
  if (codeUpper === 'PD') {
    if (rawSubjStr.includes('PD') || rawSubjStr.includes('PHYSICAL EDUCATION') || rawSubjStr.includes('PHYSICAL ED') || rawSubjStr.includes('PHY ED') || rawSubjStr.includes('P.E.') || rawSubjStr.includes('P.ED')) return true;
  }

  // 7. Vocational & Applied Practicals
  if (codeUpper === 'ITE') {
    if (rawSubjStr.includes('ITE') || rawSubjStr.includes('IT & ITES') || rawSubjStr.includes('IT AND ITES') || rawSubjStr.includes('INFORMATION TECHNOLOGY') || rawSubjStr.includes('IT')) return true;
  }
  if (codeUpper === 'HTC') {
    if (rawSubjStr.includes('HTC') || rawSubjStr.includes('HEALTHCARE') || rawSubjStr.includes('HEALTH CARE')) return true;
  }
  if (codeUpper === 'CS') {
    if (rawSubjStr.includes('CS') || rawSubjStr.includes('COMPUTER SCIENCE') || rawSubjStr.includes('COMP SC')) return true;
  }
  if (codeUpper === 'GG') {
    if (rawSubjStr.includes('GG') || rawSubjStr.includes('GEOGRAPHY') || rawSubjStr.includes('GEO')) return true;
  }

  // 8. Humanities / Arts Subjects
  if (codeUpper === 'PS') {
    if (rawSubjStr.includes('PS') || rawSubjStr.includes('POLITICAL SCIENCE') || rawSubjStr.includes('POL SC') || rawSubjStr.includes('POL. SC')) return true;
    if (isArts && !rawSubjStr) return true;
  }
  if (codeUpper === 'ED') {
    if (/\b(ED|EDUCATION)\b/i.test(rawSubjStr) && !/\b(PHYSICAL EDUCATION|PHY ED)\b/i.test(rawSubjStr)) return true;
    if (isArts && !rawSubjStr) return true;
  }
  if (codeUpper === 'HT') {
    if (rawSubjStr.includes('HT') || rawSubjStr.includes('HISTORY') || rawSubjStr.includes('HIST')) return true;
    if (isArts && !rawSubjStr) return true;
  }
  if (codeUpper === 'SO') {
    if (rawSubjStr.includes('SO') || rawSubjStr.includes('SOCIOLOGY') || rawSubjStr.includes('SOC')) return true;
    if (isArts && !rawSubjStr) return true;
  }
  if (codeUpper === 'PY') {
    if (rawSubjStr.includes('PY') || rawSubjStr.includes('PSYCHOLOGY') || rawSubjStr.includes('PSYCH')) return true;
    if (isArts && !rawSubjStr) return true;
  }
  if (codeUpper === 'UR') {
    if (rawSubjStr.includes('UR') || rawSubjStr.includes('URDU')) return true;
    if (isArts && !rawSubjStr) return true;
  }
  if (codeUpper === 'AR') {
    if (rawSubjStr.includes('AR') || rawSubjStr.includes('ARABIC')) return true;
  }
  if (codeUpper === 'PE') {
    if (rawSubjStr.includes('PE') || rawSubjStr.includes('PERSIAN')) return true;
  }
  if (codeUpper === 'KS') {
    if (rawSubjStr.includes('KS') || rawSubjStr.includes('KASHMIRI')) return true;
  }
  if (codeUpper === 'EC') {
    if (rawSubjStr.includes('EC') || rawSubjStr.includes('ECONOMICS') || rawSubjStr.includes('ECO')) return true;
    if ((isArts || isCommerce) && !rawSubjStr) return true;
  }

  // 9. Commerce Subjects
  if (codeUpper === 'AY') {
    if (rawSubjStr.includes('AY') || rawSubjStr.includes('ACCOUNTANCY') || rawSubjStr.includes('ACCOUNTS') || rawSubjStr.includes('ACC')) return true;
    if (isCommerce) return true;
  }
  if (codeUpper === 'BS') {
    if (rawSubjStr.includes('BS') || rawSubjStr.includes('BUSINESS STUDIES') || rawSubjStr.includes('BUSINESS')) return true;
    if (isCommerce) return true;
  }
  if (codeUpper === 'EP') {
    if (rawSubjStr.includes('EP') || rawSubjStr.includes('ENTREPRENEURSHIP')) return true;
    if (isCommerce) return true;
  }

  // Explicit token match in raw string
  if (rawSubjStr) {
    if (codeUpper && (rawSubjStr.includes(codeUpper) || rawSubjStr.split(/[\s,+/()]+/).includes(codeUpper))) return true;
    if (nameUpper && rawSubjStr.includes(nameUpper)) return true;
    return false;
  }

  if (!rawSubjStr && !streamStr) return true;
  return false;
}

// Helper: Extract student class from any potential schema key
function extractStudentClass(st) {
  if (!st) return '';
  const c = String(
    st.class || st.Class || st['Class'] ||
    st['Class for which Admission Sought'] ||
    st['Admission sought for class'] ||
    st['Class Enrolled'] || st.className || ''
  ).trim();
  if (c.includes('12') || c.includes('XII') || c.toLowerCase().includes('twelve')) return '12th';
  if (c.includes('11') || c.includes('XI') || c.toLowerCase().includes('eleven')) return '11th';
  if (c.includes('10') || c.includes('X') || c.toLowerCase().includes('ten')) return '10th';
  if (c.includes('9') || c.includes('IX') || c.toLowerCase().includes('nine')) return '9th';
  return c;
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
    st['Class R. No'] ||
    st.classRollNo ||
    st.rollNo ||
    st['Roll No.'] ||
    st['Roll No'] ||
    st.roll_no ||
    st['RL. NO.'] ||
    st['RL. NO'] ||
    st.assignedRollNo ||
    st.currentRollNo ||
    st.crNo ||
    st.class_roll ||
    st.ClassRoll ||
    st.ClassRollNo ||
    ''
  ).trim();

  if (!roll || roll === '—' || roll === '-' || roll === '0' || roll === 'N/A' || roll.toLowerCase() === 'undefined' || roll.toLowerCase() === 'null') {
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
    st['Board Registration No. (Class 12th)'] ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No.'] ||
    st['Board Registration Number'] ||
    st['Board Reg. No.'] ||
    st['Board Reg. No'] ||
    st['Board Reg No'] ||
    st['Registration No. (allotted by JKBOSE)'] ||
    st['Registration No. (allotted by JKBOSE )'] ||
    st['Registration No. (allotted by JKBOSE  )'] ||
    st['Registration No.'] ||
    st['Registration No'] ||
    st['Registration Number'] ||
    st['Reg. No.'] ||
    st['Reg. No'] ||
    st['Reg No'] ||
    st['RR No.'] ||
    st['R.R NO.'] ||
    st.boardRegNo ||
    st.regNo ||
    st.registrationNo ||
    st.reg_no
  );

  const oldReg = clean(
    st['Board Registration No. (Class 10th)'] ||
    st['Board Registration No. (Class 9th)'] ||
    st['DIET Registration No.'] ||
    st['Old Registration No.'] ||
    st['Old Reg. No.'] ||
    st['Old Reg No'] ||
    st.oldRegNo ||
    st.prevRegNo
  );

  // Dynamic fallback for custom headers
  let dynamicReg = '';
  if (!newReg && !oldReg && typeof st === 'object') {
    for (const key of Object.keys(st)) {
      const kLower = key.toLowerCase();
      if ((kLower.includes('reg') && (kLower.includes('no') || kLower.includes('num') || kLower.includes('#'))) || kLower.includes('registration')) {
        if (kLower.includes('date') || kLower.includes('status') || kLower.includes('fee') || kLower.includes('deadline')) continue;
        const val = clean(st[key]);
        if (val && !/^(yes|no|true|false)$/i.test(val)) {
          dynamicReg = val;
          break;
        }
      }
    }
  }

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

  return newReg || oldReg || dynamicReg || '';
}

// Helper: Extract Exam Roll Badges (Exam R.No. (Current) + Exam R.no. (Prev.))
// Helper: Extract Current Class Exam Roll Number ONLY (returns '' if not assigned)
function getExamRoll(st, selectedClass) {
  if (!st) return '';

  const getCleanVal = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val).trim();
    if (str === 'undefined' || str === 'null' || str === '—' || str === '-' || str === '#N/A' || str === 'N/A' || str === 'NA') return '';
    return str;
  };

  const clsStr = String(selectedClass || st.className || st.Class || st.class || '').toLowerCase();
  const is12th = clsStr.includes('12');
  const is11th = clsStr.includes('11');
  const is10th = clsStr.includes('10');

  let roll = '';

  if (is12th) {
    roll = getCleanVal(
      st['12th Exam Roll'] ||
      st['Exam Roll Number of Class 12th'] ||
      st['12th Board Roll'] ||
      st['Class 12th Exam Roll'] ||
      st['12th Roll']
    );
  } else if (is11th) {
    roll = getCleanVal(
      st['11th Exam Roll'] ||
      st['Exam Roll Number of Class 11th'] ||
      st['11th Board Roll'] ||
      st['Class 11th Exam Roll'] ||
      st['11th Roll']
    );
  } else if (is10th) {
    roll = getCleanVal(
      st['10th Exam Roll'] ||
      st['Exam Roll Number of Class 10th'] ||
      st['10th Board Roll'] ||
      st['Class 10th Exam Roll'] ||
      st['10th Roll']
    );
  }

  if (!roll) {
    roll = getCleanVal(
      st['Exam R.No. (Current)'] ||
      st['Exam Roll'] ||
      st['Exam Roll No'] ||
      st['Exam Roll No.'] ||
      st['Exam Roll Number'] ||
      st['Board Roll'] ||
      st['Board Roll No'] ||
      st['Board Roll No.'] ||
      st['Board Roll Number'] ||
      st['Current Exam Roll'] ||
      st.examRoll ||
      st.examRollNo ||
      st.boardRoll ||
      st.boardRollNo ||
      st.currentExamRoll
    );
  }

  return roll;
}

// Helper: Extract Student Subjects across all schemas
function extractRawSubjectsString(rec) {
  if (!rec) return '';

  // 1. Check multi-subject array or string fields, or Subs header from masterRegisters
  const subjectArrayOrStr = 
    rec['Subs'] ||
    rec['subs'] ||
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
    rec['subjectCombination'];

  if (Array.isArray(subjectArrayOrStr) && subjectArrayOrStr.length > 0) {
    const cleaned = subjectArrayOrStr.filter(s => s && String(s).trim() !== '—').map(s => String(s).trim());
    if (cleaned.length > 0) return cleaned.join(', ');
  }

  if (typeof subjectArrayOrStr === 'string' && subjectArrayOrStr.trim() && subjectArrayOrStr.trim() !== '—') {
    return subjectArrayOrStr.trim();
  }

  // 2. Next check Subjects1..Subjects6 columns from masterRegisters
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

  // 3. Fallback to single subject fields
  const fallback = rec['subjects'] || rec['Subject'] || rec['subject'];
  if (fallback && String(fallback).trim() && String(fallback).trim() !== '—') {
    return String(fallback).trim();
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

  // Infer stream from subject tokens if streamCode was not explicit
  if (!streamCode && subjectsStr) {
    if (/\b(PS|ED|HT|SO|UR|AR|PE|KS|PY)\b/i.test(subjectsStr)) {
      streamCode = 'H';
    } else if (/\b(AY|BS|EP)\b/i.test(subjectsStr)) {
      streamCode = 'G';
    } else if (/\b(PH|CH|BI|BO|ZO)\b/i.test(subjectsStr)) {
      streamCode = 'S';
    }
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

// Helper: Render subject list with current filter subject highlighted in bold red text
function renderSubjectsWithHighlight(subjectsStr, currentSubjObj) {
  if (!subjectsStr || subjectsStr === 'N/A') return <span>N/A</span>;

  const targetCode = String(currentSubjObj?.code || '').toLowerCase().trim();
  const targetName = String(currentSubjObj?.name || '').toLowerCase().trim();

  // Split by comma
  const parts = String(subjectsStr).split(/,\s*/);

  return parts.map((part, i) => {
    // Extract clean code token without stream suffix (e.g. "PD (S)" -> "pd", "PH" -> "ph")
    const pClean = part.replace(/\s*\([A-Z]\)\s*$/i, '').trim().toLowerCase();

    let isTarget = false;

    // 1. Biology / Botany / Zoology equivalence
    if (['bi', 'bo', 'zo'].includes(targetCode) || ['biology', 'botany', 'zoology'].some(b => targetName.includes(b))) {
      if (['bi', 'bo', 'zo', 'biology', 'botany', 'zoology'].includes(pClean)) {
        isTarget = true;
      }
    }
    // 2. Physical Education (PD) vs Physics (PH) — strict exact code match
    else if (targetCode === 'pd' || targetName.includes('physical education')) {
      if (pClean === 'pd' || pClean === 'physical education') isTarget = true;
    }
    else if (targetCode === 'ph' || targetName.includes('physics')) {
      if (pClean === 'ph' || pClean === 'physics') isTarget = true;
    }
    // 3. General English (EN) vs Environmental Science (ES)
    else if (targetCode === 'en' || targetName.includes('english')) {
      if (pClean === 'en' || pClean === 'english') isTarget = true;
    }
    else if (targetCode === 'es' || targetName.includes('environmental')) {
      if (pClean === 'es' || pClean === 'env' || pClean === 'environmental science') isTarget = true;
    }
    // 4. Political Science (PS)
    else if (targetCode === 'ps' || targetName.includes('political')) {
      if (pClean === 'ps' || pClean === 'political science') isTarget = true;
    }
    // 5. Computer Science (CS)
    else if (targetCode === 'cs' || targetName.includes('computer')) {
      if (pClean === 'cs' || pClean === 'computer science') isTarget = true;
    }
    // 6. Chemistry (CH)
    else if (targetCode === 'ch' || targetName.includes('chemistry')) {
      if (pClean === 'ch' || pClean === 'chemistry') isTarget = true;
    }
    // 7. IT / ITE
    else if (targetCode === 'ite' || targetCode === 'it' || targetName.includes('information tech')) {
      if (pClean === 'ite' || pClean === 'it' || pClean.includes('ite')) isTarget = true;
    }
    // 8. General fallback — exact code match or long name match
    else if (targetCode && pClean === targetCode) {
      isTarget = true;
    } else if (targetName && pClean.length > 3 && targetName.includes(pClean)) {
      isTarget = true;
    }

    return (
      <React.Fragment key={i}>
        {i > 0 && ', '}
        <span className={isTarget ? 'text-rose-600 dark:text-rose-400 font-black bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/30' : ''}>
          {part}
        </span>
      </React.Fragment>
    );
  });
}

// Helper: Precise Subject Matcher
function isSubjectMatch(student, targetSubjectCode) {
  if (!targetSubjectCode) return true;

  const targetObj = SUBJECT_MAP.find(s => s.code === targetSubjectCode || s.name.toLowerCase() === targetSubjectCode.toLowerCase());
  const code = targetObj ? targetObj.code : targetSubjectCode;
  const name = targetObj ? targetObj.name : targetSubjectCode;

  return isSubjectOrStreamMatch(student, code, name);
}

// Custom Subject Dropdown (prevents native Chrome select popovers from shooting up to header)
function CustomSubjectSelect({ selectedSubject, setSelectedSubject, subjectMap, currentSubjectObj, getSubjectMax, subjectMaxMarks, minPassMarks }) {
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
        Subject ({currentSubjectObj.code}) • {subjectMaxMarks}M (Pass: {minPassMarks}M)
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2 py-1.5 rounded-lg text-xs font-bold border flex items-center justify-between gap-1 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <span className="truncate">{selectedItem.name} ({selectedItem.code}) - {subjectMaxMarks}M</span>
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
              const sMax = getSubjectMax ? getSubjectMax(s.code) : s.defaultMax;
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
                  <span className="truncate">{s.name} ({s.code}) - {sMax}M</span>
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

const CURRENT_SESSION = '2025-26';

export default function PracticalsPage() {
  // Filter States
  const [selectedClass, setSelectedClass] = useState('11th');
  const [practicalType, setPracticalType] = useState('Internal Assessment');
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [yearSuffix, setYearSuffix] = useState(CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION]);
  const [sortBy, setSortBy] = useState('rollAsc'); // 'rollAsc' | 'rollDesc' | 'nameAsc' | 'formAsc'
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(true);
  const [practicalsSettings, setPracticalsSettings] = useState(null);

  useEffect(() => {
    loadSiteSettings().then(cfg => {
      if (cfg && cfg.practicalsSubmissionOpen !== undefined) {
        setIsSubmissionOpen(Boolean(cfg.practicalsSubmissionOpen));
      }
    }).catch(() => {});

    getAdminPracticalsSettings().then(cfg => {
      if (cfg) setPracticalsSettings(cfg);
    }).catch(() => {});
  }, []);

  // Roster & Marks State
  const [loading, setLoading] = useState(false);
  const [studentMarks, setStudentMarks] = useState([]);
  const [masterRosterCache, setMasterRosterCache] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [showFailOnly, setShowFailOnly] = useState(false);

  // Bulk Fill & Multi-Select State
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [quickFillMark, setQuickFillMark] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);

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
        const sessionsSet = new Set(['2025-26', '2024-25 (Oct-Nov)']);

        // Helper: Normalize old/ambiguous yearSuffix values from practicalsData into canonical keys
        const normalizeSessionKey = (yr) => {
          if (!yr) return null;
          const s = String(yr).trim().toLowerCase();

          // Reject evaluation types or invalid session strings
          if (['internal', 'external', 'term end', 'practical', 'all', 'na', 'n/a', 'undefined', 'null'].includes(s)) {
            return null;
          }

          if (s === '2026' || s.includes('2025-26') || s.includes('2026')) return '2025-26';
          if (s === '2025' || s.includes('oct-nov') || s.includes('revised') || s.includes('2024-25-oct-nov')) return '2024-25 (Oct-Nov)';
          if (s.includes('mar-apr') || s === '2024-25') return '2024-25 (Mar-Apr)';
          if (s === '2024' || s.includes('2023-24')) return '2023-24';
          if (s === '2023' || s.includes('2022-23')) return '2022-23';

          if (/^20\d\d/.test(s)) return String(yr).trim();
          return null;
        };

        const snap = await getDocs(collection(db, 'practicalsData')).catch(() => null);
        if (snap && !snap.empty) {
          snap.docs.forEach(d => {
            const data = d.data();
            const rawYr = data.yearSuffix || data.Session || data.session;
            const canonical = normalizeSessionKey(rawYr);
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
  const evalTypeNorm = String(practicalType || '').toLowerCase().includes('ext') ? 'external' : 'internal';
  const currentMarksConfig = getSubjectMarksConfig(practicalsSettings, selectedClass, evalTypeNorm, currentSubjectObj.code);
  const subjectMaxMarks = currentMarksConfig.max;
  const minPassMarks = currentMarksConfig.min;

  const getSubjectMax = useCallback((code) => {
    return getSubjectMarksConfig(practicalsSettings, selectedClass, evalTypeNorm, code).max;
  }, [practicalsSettings, selectedClass, evalTypeNorm]);

  // Fetch Roster strictly for confirmed students with assigned class roll numbers
  const fetchPracticalData = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const targetSubjCode = currentSubjectObj.code;
      const targetSubjName = currentSubjectObj.name;
      const docId = `${clsNorm}_${selectedSubject}_${practicalType}_${yearSuffix}`;

      // 1. Fetch collections concurrently in parallel for high performance
      let savedMarksMap = {};
      let masterDocs = [];
      let admDocs = [];
      try {
        const [rawDocs, masterRes, admRes] = await Promise.all([
          getCachedCollection('practicalsData', false, 15 * 60 * 1000).catch(() => []),
          getCachedCollection('masterRegisters', false, 15 * 60 * 1000).catch(() => []),
          getCachedCollection('admissions', false, 15 * 60 * 1000).catch(() => [])
        ]);

        masterDocs = Array.isArray(masterRes) ? masterRes : [];
        admDocs = Array.isArray(admRes) ? admRes : [];

        const docItems = Array.isArray(rawDocs) ? rawDocs : (rawDocs?.docs ? rawDocs.docs.map(d => ({ id: d.id, ...d.data() })) : []);
        docItems.forEach(data => {
          const dId = data.id || data.docId || '';

          // Class Match
          const docClass = String(data.className || data.Class || dId).toLowerCase();
          const matchClass = docClass.includes(clsNorm.toLowerCase()) || dId.toLowerCase().includes(clsNorm.toLowerCase());
          if (!matchClass && dId !== docId) return;

          // Year Match — normalize old yearSuffix keys before comparing
          const normalizeYr = (y) => {
            const s = String(y || '').trim();
            if (s === '2026') return '2025-26';
            if (s === '2025') return '2024-25 (Oct-Nov)';
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
          const matchYr = (docYrNorm === targetNorm) || dId === docId || (targetNorm === '2025-26' && (docYr === '2026' || docYrNorm === '2025-26'));
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

        // A. Primary Database Source: masterRegisters
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

        // B. Secondary Database Source: admissions
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
              rawSubjects: extractRawSubjectsString(st) || st.subjects || '',
              subjects: st['Subs'] || extractRawSubjectsString(st) || st.subjects || st['Subjects'] || st['Stream / Subjects'] || selectedSubject,
              subjectsAbbr: getAbbreviatedSubjects(st) || selectedSubject,
              examRollNo: getExamRoll(st, selectedClass)
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
              subjects: richSt['Subs'] || extractRawSubjectsString(richSt) || richSt.subjects || richSt['Subjects'] || richSt['Stream / Subjects'] || rec.subjects || selectedSubject,
              subjectsAbbr: getAbbreviatedSubjects(richSt) || getAbbreviatedSubjects(rec) || selectedSubject,
              stream: richSt.stream || richSt['Stream'] || richSt['Stream for Class 11th'] || rec.stream || '',
              examRollNo: getExamRoll({ ...richSt, boardRoll: rBoard || richSt.boardRollNo, boardRollNo: rBoard || richSt.boardRollNo }, selectedClass),
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

      // Filter by Subject Matcher & Strict Class Roll Check, and enrich with computed fields
      const subjectFiltered = uniqueStudents
        .filter(st => {
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
        })
        .map(st => {
          // Persist enriched fields into each student object for later formatting
          const rawStr = extractRawSubjectsString(st);
          const rawSubjects = Array.isArray(rawStr) ? rawStr.join(', ') : String(rawStr);
          return {
            ...st,
            _rawSubjects: rawSubjects,
            _subjectsAbbr: getAbbreviatedSubjects(st),
            _examRollNo: getExamRoll(st, selectedClass)
          };
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
          const examRollVal = st._examRollNo || getExamRoll(st, selectedClass);
          const subsAbbr = st._subjectsAbbr || getAbbreviatedSubjects(st);
          const rawSubjFull = st._rawSubjects || (() => { const r = extractRawSubjectsString(st); return Array.isArray(r) ? r.join(', ') : String(r); })();
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
            examRollNo: examRollVal,
            subjectsAbbr: subsAbbr,
            rawSubjects: rawSubjFull,
            formNo: (st.formNo && String(st.formNo) !== String(roll) && String(st.formNo).length > 3)
              ? st.formNo
              : (st['Form No.'] || st['Form No'] || st['Form Number'] || st.form_no || ''),
            regNo: getRegNo(st) || st.regNo || '',
            practicalMarks: draft.practicalMarks ?? saved.practicalMarks ?? '',
            vivaMarks: draft.vivaMarks ?? saved.vivaMarks ?? '',
          };
        });

      setDraftSavedAt(localDraftSavedTime || null);
      setStudentMarks(formatted);
      setSelectedKeys(new Set());
    } catch (err) {
      console.error('Failed to fetch practical roster:', err);
      setStudentMarks([]);
      setSelectedKeys(new Set());
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
      if (!auth.currentUser) {
        if (!auth.currentUser) throw new Error('Authenticated teacher session required.');
      }
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
          examRollNo: s.examRollNo,
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
    if (!studentMarks || studentMarks.length === 0) {
      setAlert({ type: 'error', text: 'No student records available to print.' });
      return;
    }

    const recordsForPrint = studentMarks.map((st, i) => ({
      sno: i + 1,
      classRollNo: st.classRollNo || st.rollNo || '—',
      rollNo: st.rollNo || st.formNo || '—',
      examRollNo: st.rollNo || st.formNo || '—',
      name: st.name || st.studentName || '—',
      practicalMarks: st.practicalMarks || '—',
      vivaMarks: st.vivaMarks || '—',
      totalMarks: (st.practicalMarks && st.practicalMarks.toUpperCase() === 'AB') ? 'AB' : (st.totalMarks || st.practicalMarks || '—')
    }));

    const isExternal = practicalType.toLowerCase().includes('external');
    const sessionStr = `Annual Regular ${yearSuffix}`;

    printIndividualAwardRoll({
      subjectCode: currentSubjectObj.code,
      subjectName: currentSubjectObj.name,
      className: selectedClass,
      session: sessionStr,
      records: recordsForPrint,
      isExternal,
      maxMarks: subjectMaxMarks,
      minMarks: minPassMarks
    });
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

  // ── Multi-Select & Bulk Fill Calculations ──
  const getStudentKey = useCallback((st) => {
    return String(st.rollNo || st.formNo || st.regNo || st.name);
  }, []);

  const emptyCount = useMemo(() => {
    return displayedStudents.filter(s => s.practicalMarks === '' || s.practicalMarks === undefined || s.practicalMarks === null).length;
  }, [displayedStudents]);

  const isAllSelected = useMemo(() => {
    return displayedStudents.length > 0 && displayedStudents.every(s => selectedKeys.has(getStudentKey(s)));
  }, [displayedStudents, selectedKeys, getStudentKey]);

  const isSomeSelected = useMemo(() => {
    return displayedStudents.some(s => selectedKeys.has(getStudentKey(s))) && !isAllSelected;
  }, [displayedStudents, selectedKeys, isAllSelected, getStudentKey]);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        displayedStudents.forEach(s => next.delete(getStudentKey(s)));
        return next;
      });
    } else {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        displayedStudents.forEach(s => next.add(getStudentKey(s)));
        return next;
      });
    }
  }, [isAllSelected, displayedStudents, getStudentKey]);

  const handleSelectEmptyOnly = useCallback(() => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      displayedStudents.forEach(s => {
        const isEmpty = s.practicalMarks === '' || s.practicalMarks === undefined || s.practicalMarks === null;
        if (isEmpty) {
          next.add(getStudentKey(s));
        } else {
          next.delete(getStudentKey(s));
        }
      });
      return next;
    });
  }, [displayedStudents, getStudentKey]);

  const handleToggleRow = useCallback((key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleApplyQuickFill = useCallback((targetScope = 'selected', customVal = null) => {
    const rawVal = String(customVal !== null ? customVal : quickFillMark).trim().toUpperCase();

    if (targetScope !== 'clear') {
      if (!rawVal) {
        setAlert({ type: 'error', text: 'Please enter a marks value (e.g. 10 or A) to fill.' });
        return;
      }
      if (rawVal !== 'A' && rawVal !== 'AB' && rawVal !== 'ABSENT') {
        const num = Number(rawVal);
        if (isNaN(num) || num < 0 || num > subjectMaxMarks) {
          setAlert({ 
            type: 'error', 
            text: `Invalid marks "${rawVal}". Must be between 0 and ${subjectMaxMarks}, or "A" for Absent.` 
          });
          return;
        }
      }
    }

    const targetKeySet = new Set(selectedKeys);
    const displayedKeySet = new Set(displayedStudents.map(d => getStudentKey(d)));
    let updatedCount = 0;

    setStudentMarks(prev => {
      return prev.map(st => {
        const key = getStudentKey(st);
        let shouldUpdate = false;

        if (targetScope === 'selected') {
          shouldUpdate = targetKeySet.has(key);
        } else if (targetScope === 'empty') {
          const inDisplay = displayedKeySet.has(key);
          const isEmpty = st.practicalMarks === '' || st.practicalMarks === undefined || st.practicalMarks === null;
          shouldUpdate = inDisplay && isEmpty;
        } else if (targetScope === 'all') {
          shouldUpdate = displayedKeySet.has(key);
        } else if (targetScope === 'clear') {
          shouldUpdate = targetKeySet.size > 0 
            ? targetKeySet.has(key) 
            : displayedKeySet.has(key);
        }

        if (shouldUpdate) {
          updatedCount++;
          return {
            ...st,
            practicalMarks: targetScope === 'clear' ? '' : rawVal
          };
        }
        return st;
      });
    });

    if (targetScope === 'clear') {
      if (updatedCount > 0) {
        setAlert({ type: 'info', text: `Cleared practical marks for ${updatedCount} student(s).` });
      } else {
        setAlert({ type: 'info', text: 'No marks to clear (all selected/displayed cells are already empty).' });
      }
    } else {
      if (updatedCount > 0) {
        setAlert({ 
          type: 'success', 
          text: `⚡ Successfully filled mark "${rawVal}" for ${updatedCount} student(s)!` 
        });
      } else {
        setAlert({ 
          type: 'info', 
          text: 'No students matched the selected fill scope.' 
        });
      }
    }
  }, [quickFillMark, subjectMaxMarks, selectedKeys, displayedStudents, getStudentKey]);

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
          {/* Title Header — Ultra-Compact */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/15 border border-indigo-600/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <UserCheck size={16} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                  Practical Evaluation Portal
                </h1>
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  {selectedClass} Class • {currentSubjectObj.name} ({currentSubjectObj.code})
                </div>
              </div>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <ShieldCheck size={10} /> LAB EVALUATION
            </div>
          </div>

          {/* Alert Notification */}
          {!isSubmissionOpen && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-extrabold flex items-center gap-2 text-xs">
              <ShieldCheck size={16} className="text-amber-600 shrink-0" />
              <span>Practical Award Submissions are currently <strong>CLOSED</strong> by Administration. Marks entry is view-only.</span>
            </div>
          )}

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

          {/* Sleek Integrated Filter Control & Toolbar Bar */}
          <div className="rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-2 space-y-2">
            {/* Single Summary Bar + Expand Toggle + Count + Sort (all one row) */}
            <div className="flex items-center gap-1.5">
              {/* Filters toggle — grows to fill available space */}
              <button
                type="button"
                onClick={() => setShowFilterSettings(!showFilterSettings)}
                className="flex-1 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-black bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <SlidersHorizontal size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate text-[10.5px]">
                    {selectedClass} • {currentSubjectObj.name} ({currentSubjectObj.code}) • {practicalType.split(' ')[0]} ({subjectMaxMarks}M | Pass: {minPassMarks}M) • {yearSuffix}
                  </span>
                </div>
                <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0 flex items-center gap-0.5">
                  Filters <ChevronDown size={11} className={`transition-transform duration-200 ${showFilterSettings ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {/* Student count + sort inline */}
              <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] font-extrabold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                <span className="text-indigo-600 dark:text-indigo-400 font-black">{displayedStudents.length}</span>
                <span>Stu.</span>
                {showFailOnly && <span className="text-rose-600">(Fail)</span>}
              </div>

              {/* Sort */}
              <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                <ArrowUpDown size={10} className="text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-1.5 py-1 rounded-md border text-[10px] font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="rollAsc">Roll ↑</option>
                  <option value="rollDesc">Roll ↓</option>
                  <option value="nameAsc">Name A-Z</option>
                  <option value="formAsc">Form No.</option>
                </select>
              </div>

              {/* Quick Fill + Fail filter + Print */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQuickFill(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg font-black text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                    showQuickFill
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  }`}
                  title="Quick Bulk Fill: Fill marks for all, empty, or selected students in one go"
                >
                  <Zap size={13} className={showQuickFill ? 'text-white' : 'text-amber-500'} />
                  <span>Quick Fill</span>
                  {selectedKeys.size > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[9.5px] font-black">
                      {selectedKeys.size}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowFailOnly(!showFailOnly)}
                  className={`px-2 py-1.5 rounded-lg font-black text-xs border transition-all cursor-pointer ${
                    showFailOnly
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {showFailOnly ? 'All' : '📋 Fail'}
                </button>

                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-2.5 py-1.5 rounded-lg font-black text-xs bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-600 shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Printer size={13} /> <span className="hidden sm:inline">Print</span>
                </button>
              </div>
            </div>

            {/* Expandable Filter Inputs Panel */}
            {showFilterSettings && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
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
                  getSubjectMax={getSubjectMax}
                  subjectMaxMarks={subjectMaxMarks}
                  minPassMarks={minPassMarks}
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
                      if (yr === '2025-26' || yr === '2026') label = '2025-26 (Reg. 2026)';
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
            )}

            {/* Quick Bulk Fill Deck Panel */}
            {showQuickFill && (
              <div className="p-2.5 sm:p-3 rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 dark:from-amber-950/40 dark:to-indigo-950/30 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Zap size={14} className="text-amber-500" />
                      <span>Bulk Fill Marks:</span>
                    </span>

                    {/* Marks Input Field */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={quickFillMark}
                        onChange={(e) => setQuickFillMark(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (selectedKeys.size > 0) handleApplyQuickFill('selected');
                            else if (emptyCount > 0) handleApplyQuickFill('empty');
                            else handleApplyQuickFill('all');
                          }
                        }}
                        placeholder={`0-${subjectMaxMarks} / A`}
                        className="w-20 px-2 py-1 rounded-lg border text-xs font-black text-center uppercase bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        maxLength={4}
                      />

                      {/* Quick preset chips based on subjectMaxMarks */}
                      <div className="flex items-center gap-1">
                        {[
                          String(subjectMaxMarks), 
                          String(Math.max(0, subjectMaxMarks - 1)), 
                          String(Math.max(0, subjectMaxMarks - 2)), 
                          'A'
                        ].filter((v, i, a) => a.indexOf(v) === i).map(chipVal => (
                          <button
                            key={chipVal}
                            type="button"
                            onClick={() => setQuickFillMark(chipVal)}
                            className={`px-2 py-1 rounded-md text-[11px] font-black border transition-colors cursor-pointer ${
                              quickFillMark === chipVal
                                ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            title={`Set mark to ${chipVal}`}
                          >
                            {chipVal === 'A' ? 'Abs' : chipVal}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Execution Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Fill Empty Cells (Instant answer to user's 90 students question!) */}
                    <button
                      type="button"
                      onClick={() => handleApplyQuickFill('empty')}
                      disabled={emptyCount === 0 || !quickFillMark.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        emptyCount > 0 && quickFillMark.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Fill all students who currently have empty marks (preserves already-entered marks)"
                    >
                      <Zap size={13} />
                      <span>Fill Empty</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-700 text-white text-[9.5px] font-black">
                        {emptyCount}
                      </span>
                    </button>

                    {/* Fill Selected */}
                    <button
                      type="button"
                      onClick={() => handleApplyQuickFill('selected')}
                      disabled={selectedKeys.size === 0 || !quickFillMark.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        selectedKeys.size > 0 && quickFillMark.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Fill mark into currently selected checkboxes"
                    >
                      <Check size={13} />
                      <span>Fill Selected</span>
                      {selectedKeys.size > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-indigo-700 text-white text-[9.5px] font-black">
                          {selectedKeys.size}
                        </span>
                      )}
                    </button>

                    {/* Fill All */}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Fill mark "${quickFillMark}" for ALL ${displayedStudents.length} students in this evaluation roster?`)) {
                          handleApplyQuickFill('all');
                        }
                      }}
                      disabled={displayedStudents.length === 0 || !quickFillMark.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        displayedStudents.length > 0 && quickFillMark.trim()
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Fill mark for every student in the current view"
                    >
                      <Zap size={13} />
                      <span>Fill All ({displayedStudents.length})</span>
                    </button>

                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetLabel = selectedKeys.size > 0 ? `${selectedKeys.size} selected` : `all ${displayedStudents.length}`;
                        if (window.confirm(`Are you sure you want to clear practical marks for ${targetLabel} students?`)) {
                          handleApplyQuickFill('clear');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors flex items-center gap-1"
                      title="Clear marks"
                    >
                      <X size={13} />
                      <span>Clear {selectedKeys.size > 0 ? `(${selectedKeys.size})` : 'All'}</span>
                    </button>
                  </div>
                </div>

                {/* Selection Helper Shortcuts Row */}
                <div className="flex items-center justify-between text-[10.5px] text-slate-600 dark:text-slate-400 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Fast Select:</span>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                    >
                      {isAllSelected ? 'Deselect All' : `All (${displayedStudents.length})`}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleSelectEmptyOnly}
                      className="text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline cursor-pointer"
                    >
                      Empty Only ({emptyCount})
                    </button>
                    {selectedKeys.size > 0 && (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedKeys(new Set())}
                          className="text-rose-600 dark:text-rose-400 font-extrabold hover:underline cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      </>
                    )}
                  </div>
                  <div className="font-bold text-slate-500 dark:text-slate-400">
                    {selectedKeys.size > 0 ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedKeys.size} of {displayedStudents.length} selected</span>
                    ) : (
                      <span>{emptyCount} empty cells remaining</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile-only student count + sort (shown below filter bar on small screens) */}
          <div className="sm:hidden flex items-center justify-between gap-1.5 px-1 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
            <div className="font-extrabold flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                onChange={handleToggleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                title={isAllSelected ? "Deselect all" : "Select all"}
              />
              <div>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">{displayedStudents.length}</span> Students
                {showFailOnly && <span className="ml-1 text-rose-600">(Fail)</span>}
              </div>
            </div>
            <div className="flex items-center gap-0.5 font-bold">
              <ArrowUpDown size={10} />
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
          </div>

          {/* Student Roster Marks Entry Table - Ultra Compact */}
          {loading ? (
            <ModernLoader
              moduleKey="practicals"
              text="Loading Practicals Roster..."
              subtext="Fetching candidate records and evaluation rolls..."
              className="py-10"
            />
          ) : displayedStudents.length > 0 ? (
            <>
              {/* ── MOBILE CARDS (hidden on sm+) — True Mobile-First Ergonomic Layout ── */}
              <div className="sm:hidden space-y-2">
                {displayedStudents.map((st, idx) => {
                  const isAbsent = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
                  const valToConvert = isAbsent ? 'A' : (st.practicalMarks !== '' ? st.practicalMarks : '');
                  const inWords = valToConvert ? numberToWords(valToConvert) : '';
                  const originalIdx = studentMarks.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);
                  const allSubjs = st.subjectsAbbr || st.rawSubjects || st.subjects || 'N/A';
                  const key = getStudentKey(st);
                  const isSelected = selectedKeys.has(key);

                  return (
                    <div 
                      key={idx} 
                      className={`rounded-2xl border p-3 transition-all shadow-xs space-y-2 ${
                        isSelected
                          ? 'border-indigo-400/80 bg-indigo-50/40 dark:border-indigo-600/80 dark:bg-indigo-950/30'
                          : isAbsent 
                          ? 'border-amber-400/50 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-950/20' 
                          : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Row 1: Checkbox, Student S.No, Class Roll, Name & Marks Input Target */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(key)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                          <span className="w-5.5 h-5.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-extrabold text-[10px] flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0" title="Serial Number">
                            #{idx + 1}
                          </span>
                          <span className="min-w-6 h-5.5 px-1.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-mono font-black text-[11px] flex items-center justify-center border border-indigo-500/20 shrink-0" title={`Class Roll: ${st.rollNo}`}>
                            {st.rollNo}
                          </span>
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {st.name}
                          </span>
                        </div>

                        {/* Marks Input + Quick Absent Toggle */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="text"
                            placeholder={`0-${subjectMaxMarks}/A`}
                            value={st.practicalMarks}
                            onChange={(e) => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', e.target.value)}
                            className={`w-20 px-2 py-1 rounded-xl border text-xs font-black h-7.5 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-wide transition-all shadow-2xs ${
                              isAbsent
                                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-black'
                                : st.practicalMarks !== ''
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', isAbsent ? '' : 'A')}
                            className={`px-2 h-7.5 rounded-xl font-mono text-[10.5px] font-black border transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                              isAbsent
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 border-slate-200 dark:border-slate-700'
                            }`}
                            title="Toggle Absent"
                          >
                            AB
                          </button>
                        </div>
                      </div>

                      {/* Row 2: In-Words Award Feedback (Shown when marks entered) */}
                      {inWords && (
                        <div className="flex items-center justify-end">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 text-[9.5px] font-black">
                            Award: {inWords} {(!isNaN(parseInt(valToConvert, 10)) && parseInt(valToConvert, 10) > 0) ? 'Only' : ''}
                          </span>
                        </div>
                      )}

                      {/* Row 3: Metadata Badges (Wraps naturally on any screen size) */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[9.5px] font-semibold pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        {st.formNo && (
                          <span className="px-1.5 py-0.5 rounded-md font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Form #{st.formNo}
                          </span>
                        )}
                        {st.regNo && (
                          <span className="px-1.5 py-0.5 rounded-md font-mono bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800/60">
                            Reg: {st.regNo}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded-md font-mono font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                          Exam Roll: {st.examRollNo || '—'}
                        </span>
                      </div>

                      {/* Row 4: Subject Combination */}
                      <div className="text-[9.5px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-teal-800 dark:text-teal-200 bg-teal-500/15 px-1.5 py-0.5 rounded-md border border-teal-500/30">
                          Subs:
                        </span>
                        <div className="flex-1 min-w-0">
                          {renderSubjectsWithHighlight(allSubjs, currentSubjectObj)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP TABLE (hidden on mobile) — Ultra Compact ── */}
              <div className="hidden sm:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-black uppercase text-[9.5px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-1.5 px-2 w-14 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                            onChange={handleToggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            title={isAllSelected ? "Deselect all" : "Select all"}
                          />
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-black">#</span>
                        </div>
                      </th>
                      <th className="py-1.5 px-2.5 w-16 cursor-pointer hover:text-indigo-600" onClick={() => setSortBy(sortBy === 'rollAsc' ? 'rollDesc' : 'rollAsc')}>
                        Roll {sortBy.startsWith('roll') ? (sortBy === 'rollAsc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="py-1.5 px-2.5 cursor-pointer hover:text-indigo-600" onClick={() => setSortBy(sortBy === 'nameAsc' ? 'rollAsc' : 'nameAsc')}>
                        Student Details & Subjects Offered {sortBy === 'nameAsc' ? '↑' : ''}
                      </th>
                      <th className="py-1.5 px-2 text-center w-64">Marks Obt. ({subjectMaxMarks}M) & In Words</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                    {displayedStudents.map((st, idx) => {
                      const isAbsent = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
                      const valToConvert = isAbsent ? 'A' : (st.practicalMarks !== '' ? st.practicalMarks : '');
                      const inWords = valToConvert ? numberToWords(valToConvert) : '';
                      const originalIdx = studentMarks.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);
                      const allSubjs = st.subjectsAbbr || st.rawSubjects || st.subjects || 'N/A';
                      const key = getStudentKey(st);
                      const isSelected = selectedKeys.has(key);

                      return (
                        <tr 
                          key={idx} 
                          className={`hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors ${
                            isSelected 
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40' 
                              : isAbsent 
                              ? 'bg-amber-500/5' 
                              : ''
                          }`}
                        >
                          <td className="py-1 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRow(key)}
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="font-mono font-black text-slate-400 text-[11px]">#{idx + 1}</span>
                            </div>
                          </td>
                          <td className="py-1 px-2.5 font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">{st.rollNo}</td>
                          <td className="py-1 px-2.5 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">{st.name}</span>
                              {st.formNo && String(st.formNo) !== String(st.rollNo) && String(st.formNo).length > 3 && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 text-[9px]">Form #{st.formNo}</span>
                              )}
                              {st.regNo && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20 text-[9px]">Reg #{st.regNo}</span>
                              )}
                              <span className="px-1.5 py-0.2 rounded font-mono font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px]">
                                Exam Roll: {st.examRollNo || '-'}
                              </span>
                            </div>
                            {/* All Subjects List Badge */}
                            <div className="text-[9.5px] font-bold text-teal-700 dark:text-teal-300 leading-tight">
                              <span className="font-mono font-black text-teal-800 dark:text-teal-200 bg-teal-500/15 px-1 py-0.2 rounded border border-teal-500/30 mr-1">Subs:</span>
                              {renderSubjectsWithHighlight(allSubjs, currentSubjectObj)}
                            </div>
                          </td>
                          <td className="py-1 px-2">
                            <div className="flex items-center gap-1.5 justify-center">
                              <input
                                type="text"
                                placeholder={`0-${subjectMaxMarks} / A`}
                                value={st.practicalMarks}
                                onChange={(e) => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', e.target.value)}
                                className="w-20 px-2 py-0.5 rounded-lg border text-xs font-black h-7 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 uppercase text-center"
                              />
                              {inWords ? (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black whitespace-nowrap">
                                  {inWords} {(!isNaN(parseInt(valToConvert, 10)) && parseInt(valToConvert, 10) > 0) ? 'Only' : ''}
                                </span>
                              ) : (
                                <span className="text-[9.5px] text-slate-400 font-semibold italic">Enter mark</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Floating Sticky Action Bar when Rows are Selected */}
              {selectedKeys.size > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white p-2.5 sm:p-3 rounded-2xl shadow-2xl border border-indigo-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xs text-white shrink-0">
                      ✓
                    </span>
                    <div className="text-xs">
                      <span className="font-extrabold text-white">{selectedKeys.size}</span>
                      <span className="text-slate-300 ml-1">of {displayedStudents.length} selected</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <input
                      type="text"
                      value={quickFillMark}
                      onChange={(e) => setQuickFillMark(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyQuickFill('selected');
                        }
                      }}
                      placeholder={`0-${subjectMaxMarks}/A`}
                      className="w-20 px-2 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-black text-xs text-center focus:ring-2 focus:ring-indigo-500 uppercase tracking-wide"
                      maxLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyQuickFill('selected')}
                      disabled={!quickFillMark.trim()}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        quickFillMark.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Apply mark to all selected students (Press Enter)"
                    >
                      <Zap size={13} />
                      <span>Apply to {selectedKeys.size} Selected</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedKeys(new Set())}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
                      title="Clear selection"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
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
              <ModernLoader
                moduleKey="practicals"
                text="Fetching Historical Submissions..."
                subtext="Retrieving previous practical assessment records..."
                className="py-6"
              />
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
