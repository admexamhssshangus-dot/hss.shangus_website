import { saveAcademicRecord } from '../../services/academicRecordService';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, AlertCircle, 
  CheckCircle2, Printer, ShieldCheck, History, Clock, Search,
  Bookmark, Send, ChevronDown, Check, SlidersHorizontal, Zap, X, Info, Sparkles, Award,
  AlertTriangle, ShieldAlert
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { getCachedCollection, invalidateCollectionCache } from '../../services/dbCache';
import { printIndividualAwardRoll } from '../../utils/practicalsPdfGenerator';
import { loadSiteSettings } from '../../utils/settingsLoader';
import {
  getSubjectMarksConfig,
  getAdminPracticalsSettings,
  getEvaluationTypesForTeacher,
  SUBJECT_CONFIG_DEFS,
  isTeacherSubjectMatch,
  normalizeSubjectIdentity,
  formatPracticalDocId
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
    st['Subjects to be taken in Class 11th'] ||
    st['Subjects to be taken in Class 12th'] ||
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

  // Clean stream to avoid Political Science, Home Science, or Computer Science triggering General Science stream
  const cleanStream = streamStr.replace(/\b(POLITICAL\s+SCIENCE|HOME\s+SCIENCE|COMPUTER\s+SCIENCE)\b/gi, '');
  const isScienceStrict = /\b(SCIENCE|MED|MEDICAL|NON-MED|NON-MEDICAL|NONMED)\b/i.test(cleanStream);
  const isNonMed = cleanStream.includes('NON-MED') || cleanStream.includes('NONMED') || cleanStream.includes('NON MEDICAL');
  const isCommerce = /\b(COMMERCE)\b/i.test(streamStr);
  const isArts = /\b(ARTS|HUMANITIES)\b/i.test(streamStr);

  // Helper: check if a standalone code token exists (word boundary match so 'PH' does NOT match 'PHYSICAL EDUCATION')
  const hasToken = (token) => {
    if (!token) return false;
    const regex = new RegExp('(^|[^A-Z0-9])' + token + '(?![A-Z0-9])', 'i');
    return regex.test(rawSubjStr);
  };

  // 2. Physics & Chemistry
  if (codeUpper === 'PH' || nameUpper === 'PHYSICS') {
    if (hasToken('PH') || /\bPHYSICS\b/i.test(rawSubjStr)) return true;
    if (!rawSubjStr && isScienceStrict) return true;
    return false;
  }
  if (codeUpper === 'CH' || nameUpper === 'CHEMISTRY') {
    if (hasToken('CH') || /\bCHEMISTRY\b/i.test(rawSubjStr)) return true;
    if (!rawSubjStr && isScienceStrict) return true;
    return false;
  }

  // 3. Botany, Zoology, Biology
  if (['BO', 'ZO', 'BI', 'BIO'].includes(codeUpper) || nameUpper.includes('BIOLOGY') || nameUpper.includes('BOTANY') || nameUpper.includes('ZOOLOGY')) {
    if (hasToken('BI') || hasToken('BO') || hasToken('ZO') || hasToken('BIO') || /\b(BIOLOGY|BOTANY|ZOOLOGY)\b/i.test(rawSubjStr)) return true;
    if (!rawSubjStr && isScienceStrict && !isNonMed) return true;
    return false;
  }

  // 4. Mathematics
  if (codeUpper === 'MA' || nameUpper.includes('MATH')) {
    if (hasToken('MA') || /\b(MATH|MATHS|MATHEMATICS)\b/i.test(rawSubjStr)) return true;
    if (!rawSubjStr && isScienceStrict && isNonMed) return true;
    return false;
  }

  // 5. Environmental Science
  if (codeUpper === 'ES' || nameUpper.includes('ENVIRONMENTAL')) {
    if (hasToken('ES') || hasToken('EVS') || /\b(ENVIRONMENTAL\s*SCIENCE|ENV\s*SCI|ENVIRONMENTAL)\b/i.test(rawSubjStr)) return true;
    return false;
  }

  // 6. Physical Education
  if (codeUpper === 'PD' || codeUpper === 'PHE' || codeUpper === 'PE' || nameUpper.includes('PHYSICAL ED')) {
    if (hasToken('PD') || hasToken('PHE') || hasToken('PE') || /\b(PHYSICAL\s*EDUCATION|PHYSICAL\s*ED|PHY\s*ED|P\.E\.)\b/i.test(rawSubjStr)) return true;
    return false;
  }

  // 7. Vocational & Applied Practicals
  if (codeUpper === 'ITE' || codeUpper === 'IT' || nameUpper.includes('IT & ITES') || nameUpper.includes('INFORMATION TECH')) {
    if (hasToken('ITE') || hasToken('IT') || /\b(IT\s*AND\s*ITES|IT\s*&\s*ITES|INFORMATION\s*TECHNOLOGY)\b/i.test(rawSubjStr)) return true;
    return false;
  }
  if (codeUpper === 'HTC' || nameUpper.includes('HEALTHCARE') || nameUpper.includes('HEALTH CARE')) {
    if (hasToken('HTC') || /\b(HEALTHCARE|HEALTH\s*CARE)\b/i.test(rawSubjStr)) return true;
    return false;
  }
  if (codeUpper === 'CS' || nameUpper.includes('COMPUTER SCIENCE')) {
    if (hasToken('CS') || /\b(COMPUTER\s*SCIENCE|COMP\s*SC)\b/i.test(rawSubjStr)) return true;
    return false;
  }
  if (codeUpper === 'GG' || nameUpper.includes('GEOGRAPHY')) {
    if (hasToken('GG') || /\b(GEOGRAPHY|GEO)\b/i.test(rawSubjStr)) return true;
    return false;
  }

  // 8. Humanities / Arts Subjects
  if (codeUpper === 'PS' || nameUpper.includes('POLITICAL SCIENCE')) {
    if (hasToken('PS') || /\b(POLITICAL\s*SCIENCE|POL\s*SC|POL\.\s*SC)\b/i.test(rawSubjStr)) return true;
    if (isArts && !rawSubjStr) return true;
    return false;
  }
  if (codeUpper === 'ED' || nameUpper === 'EDUCATION') {
    const cleanSubj = rawSubjStr
      .replace(/\b(NON-MED|NON\s*MED|NON-MEDICAL|MEDICAL|MED)\b/gi, '')
      .replace(/\b(PHYSICAL\s*EDUCATION|PHYSICAL\s*ED|PHY\s*ED|P\.ED|PED|P\.E)\b/gi, '');
    const hasEdToken = /\b(ED|EDU)\b/i.test(cleanSubj);
    if (hasEdToken) return true;
    if (/\bEDUCATION\b/i.test(cleanSubj)) return true;
    if (isArts && !rawSubjStr && !isScienceStrict) return true;
    return false;
  }
  if (codeUpper === 'HT' || nameUpper.includes('HISTORY')) {
    if (hasToken('HT') || /\b(HISTORY|HIST)\b/i.test(rawSubjStr)) return true;
    if (isArts && !rawSubjStr) return true;
    return false;
  }
  if (codeUpper === 'SO' || nameUpper.includes('SOCIOLOGY')) {
    if (hasToken('SO') || /\b(SOCIOLOGY|SOC)\b/i.test(rawSubjStr)) return true;
    if (isArts && !rawSubjStr) return true;
    return false;
  }
  if (codeUpper === 'PY' || nameUpper.includes('PSYCHOLOGY')) {
    if (hasToken('PY') || /\b(PSYCHOLOGY|PSYCH)\b/i.test(rawSubjStr)) return true;
    if (isArts && !rawSubjStr) return true;
    return false;
  }
  if (codeUpper === 'UR' || nameUpper.includes('URDU')) {
    if (hasToken('UR') || /\b(URDU)\b/i.test(rawSubjStr)) return true;
    if (isArts && !rawSubjStr) return true;
    return false;
  }
  if (codeUpper === 'AR' || nameUpper.includes('ARABIC')) {
    if (hasToken('AR') || /\b(ARABIC)\b/i.test(rawSubjStr)) return true;
    return false;
  }
  if (codeUpper === 'PE' || nameUpper.includes('PERSIAN')) {
    if (hasToken('PE') || /\b(PERSIAN)\b/i.test(rawSubjStr)) return true;
    return false;
  }
  if (codeUpper === 'KS' || nameUpper.includes('KASHMIRI')) {
    if (hasToken('KS') || /\b(KASHMIRI)\b/i.test(rawSubjStr)) return true;
    return false;
  }
  if (codeUpper === 'EC' || nameUpper.includes('ECONOMICS')) {
    if (hasToken('EC') || /\b(ECONOMICS|ECO)\b/i.test(rawSubjStr)) return true;
    if ((isArts || isCommerce) && !rawSubjStr) return true;
    return false;
  }

  // 9. Commerce Subjects
  if (codeUpper === 'AY' || nameUpper.includes('ACCOUNTANCY')) {
    if (hasToken('AY') || /\b(ACCOUNTANCY|ACCOUNTS|ACC)\b/i.test(rawSubjStr)) return true;
    if (isCommerce) return true;
    return false;
  }
  if (codeUpper === 'BS' || nameUpper.includes('BUSINESS')) {
    if (hasToken('BS') || /\b(BUSINESS\s*STUDIES|BUSINESS)\b/i.test(rawSubjStr)) return true;
    if (isCommerce) return true;
    return false;
  }
  if (codeUpper === 'EP' || nameUpper.includes('ENTREPRENEURSHIP')) {
    if (hasToken('EP') || /\b(ENTREPRENEURSHIP)\b/i.test(rawSubjStr)) return true;
    if (isCommerce) return true;
    return false;
  }

  // Fallback: standalone token match or full name substring match
  if (rawSubjStr) {
    if (codeUpper && hasToken(codeUpper)) return true;
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
    st['Admission sought for class'] ||
    st['Class for which Admission Sought'] ||
    st['Class Enrolled'] ||
    st.className ||
    st.class || st.Class || st['Class'] || ''
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
function CustomSubjectSelect({ 
  selectedSubject, 
  setSelectedSubject, 
  subjectMap, 
  currentSubjectObj, 
  getSubjectMax, 
  subjectMaxMarks, 
  minPassMarks,
  teacherRegisteredSubject,
  onAttemptCrossSubject
}) {
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
  const isCurrentlyCrossSubject = Boolean(
    teacherRegisteredSubject && !isTeacherSubjectMatch(teacherRegisteredSubject, selectedSubject)
  );

  const handleSelect = (subName) => {
    if (teacherRegisteredSubject && !isTeacherSubjectMatch(teacherRegisteredSubject, subName)) {
      if (onAttemptCrossSubject) {
        onAttemptCrossSubject(subName);
      } else {
        setSelectedSubject(subName);
      }
    } else {
      setSelectedSubject(subName);
    }
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-0.5 relative" ref={containerRef}>
      <div className="flex items-center justify-between gap-1 text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">
        <span className="truncate flex items-center gap-1">
          <span>Subject</span>
          {isCurrentlyCrossSubject && (
            <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold normal-case">
              Cross-Subject
            </span>
          )}
        </span>
        <span className="font-mono text-[9px] text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
          {subjectMaxMarks}M (P:{minPassMarks})
        </span>
      </div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border flex items-center justify-between gap-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer focus:outline-none focus:ring-1 transition-colors ${
          isCurrentlyCrossSubject
            ? 'border-amber-400 dark:border-amber-700/80 focus:ring-amber-500 bg-amber-50/20'
            : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
        }`}
      >
        <span className="truncate flex items-center gap-1">
          <span>{selectedItem.name} ({selectedItem.code})</span>
          {teacherRegisteredSubject && isTeacherSubjectMatch(teacherRegisteredSubject, selectedItem.name) && (
            <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
              (Assigned)
            </span>
          )}
        </span>
        <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[999] rounded-xl border shadow-2xl p-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-1 min-w-[240px] max-h-60 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
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
              const isTeacherAssigned = teacherRegisteredSubject && isTeacherSubjectMatch(teacherRegisteredSubject, s.name);

              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => handleSelect(s.name)}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{s.name} ({s.code}) - {sMax}M</span>
                    {isTeacherAssigned && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-extrabold shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        Assigned
                      </span>
                    )}
                  </span>
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
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const user = outletContext.user || null;

  // Resolve teacher's officially assigned teaching subject
  const teacherRegisteredSubject = useMemo(() => {
    const rawSubj = user?.subject || user?.teachingSubject || '';
    if (!rawSubj) return '';
    const norm = normalizeSubjectIdentity(rawSubj);
    return norm ? norm.name : String(rawSubj).trim();
  }, [user?.subject, user?.teachingSubject]);

  // Initial subject defaulting: if navigated from history with state, use that;
  // otherwise, default to the teacher's registered subject; fallback to Physics.
  const initialSubject = useMemo(() => {
    if (location.state?.selectedSubject) return location.state.selectedSubject;
    if (teacherRegisteredSubject) {
      const match = SUBJECT_MAP.find(s => s.name.toLowerCase() === teacherRegisteredSubject.toLowerCase());
      if (match) return match.name;
    }
    return 'Physics';
  }, [location.state?.selectedSubject, teacherRegisteredSubject]);

  // Resolve teacher's officially assigned teaching classes
  const teacherAssignedClasses = useMemo(() => {
    if (Array.isArray(user?.assignedClasses) && user.assignedClasses.length > 0) {
      return user.assignedClasses;
    }
    return [];
  }, [user?.assignedClasses]);

  // Initial class defaulting: location state > first assigned class > '11th'
  const initialClass = useMemo(() => {
    if (location.state?.selectedClass) return location.state.selectedClass;
    if (teacherAssignedClasses.length > 0) return teacherAssignedClasses[0];
    return '11th';
  }, [location.state?.selectedClass, teacherAssignedClasses]);

  // Filter States
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [practicalType, setPracticalType] = useState(location.state?.practicalType || 'Internal Assessment');
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [yearSuffix, setYearSuffix] = useState(location.state?.yearSuffix || CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION]);

  // State for Cross-Subject switch confirmation modal & Existing award detection
  const [crossSubjectSwitchModal, setCrossSubjectSwitchModal] = useState({ isOpen: false, targetSubject: '' });
  const [existingAwardInfo, setExistingAwardInfo] = useState({ canonical: null, pending: null });

  // Default subject and class to teacher's registered values if not specified in location.state
  useEffect(() => {
    if (!location.state?.selectedSubject && teacherRegisteredSubject) {
      const match = SUBJECT_MAP.find(s => s.name.toLowerCase() === teacherRegisteredSubject.toLowerCase());
      if (match) setSelectedSubject(match.name);
    }
    if (!location.state?.selectedClass && teacherAssignedClasses.length > 0) {
      setSelectedClass(teacherAssignedClasses[0]);
    }
  }, [teacherRegisteredSubject, teacherAssignedClasses, location.state]);

  // Synchronize filter states if user navigates with state (e.g. from Dashboard Submission History)
  useEffect(() => {
    if (location.state) {
      if (location.state.selectedClass) setSelectedClass(location.state.selectedClass);
      if (location.state.selectedSubject) setSelectedSubject(location.state.selectedSubject);
      if (location.state.practicalType) setPracticalType(location.state.practicalType);
      if (location.state.yearSuffix) setYearSuffix(location.state.yearSuffix);
    }
  }, [location.state]);
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
  const masterRosterCacheRef = useRef({});
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState('draft'); // 'draft' | 'final'
  const [alert, setAlert] = useState(null);
  const [popupModal, setPopupModal] = useState(null);
  const [showFailOnly, setShowFailOnly] = useState(false);

  // Bulk Fill & Multi-Select State
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [quickFillMark, setQuickFillMark] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);
  const [teacherCustomMax, setTeacherCustomMax] = useState(null);

  useEffect(() => {
    setTeacherCustomMax(null);
  }, [selectedSubject, practicalType, selectedClass, yearSuffix]);

  // Custom Confirmation Dialog State (replaces ugly native window.confirm)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: null,
  });

  const triggerConfirm = useCallback(({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger', onConfirm }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      type,
      onConfirm,
    });
  }, []);

  // Universal High-Visibility Message / Error / Success Popup Trigger
  const triggerNotification = useCallback((opts) => {
    if (!opts) {
      setPopupModal(null);
      setAlert(null);
      return;
    }
    const type = opts.type || 'info';
    const text = opts.text || opts.message || '';
    const title = opts.title || (
      type === 'success' ? 'Operation Successful' :
      type === 'error' ? 'Notice / Action Required' :
      type === 'warning' ? 'Important Warning' : 'Information'
    );
    setAlert({ type, text });
    setPopupModal({
      isOpen: true,
      type,
      title,
      badge: opts.badge || (
        type === 'success' ? 'Success' :
        type === 'error' ? 'Error' :
        type === 'warning' ? 'Attention' : 'Notice'
      ),
      message: text,
      details: opts.details || null,
      primaryButtonText: opts.primaryButtonText || 'Understood',
      onPrimaryClick: opts.onPrimaryClick || null,
      secondaryButtonText: opts.secondaryButtonText || null,
      onSecondaryClick: opts.onSecondaryClick || null,
    });
  }, []);

  // Submissions History Drawer State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const filteredSubmissions = useMemo(() => {
    if (!historySearch.trim()) return submissionHistory;
    const q = historySearch.toLowerCase().trim();
    return submissionHistory.filter(item => {
      const className = String(item.className || '').toLowerCase();
      const subject = String(item.subject || '').toLowerCase();
      const practicalType = String(item.practicalType || '').toLowerCase();
      const displayDate = String(item.displayDate || '').toLowerCase();
      const year = String(item.yearSuffix || '').toLowerCase();
      return className.includes(q) || subject.includes(q) || practicalType.includes(q) || displayDate.includes(q) || year.includes(q);
    });
  }, [submissionHistory, historySearch]);

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

  const isCrossSubject = useMemo(() => {
    if (!teacherRegisteredSubject) return false;
    return !isTeacherSubjectMatch(teacherRegisteredSubject, selectedSubject);
  }, [teacherRegisteredSubject, selectedSubject]);

  const isOverwrite = useMemo(() => {
    return Boolean(
      existingAwardInfo?.canonical &&
      Array.isArray(existingAwardInfo.canonical.records) &&
      existingAwardInfo.canonical.records.length > 0
    );
  }, [existingAwardInfo?.canonical]);


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

        const cachedPracticals = await getCachedCollection('practicalsData', false, 30 * 60 * 1000).catch(() => []);
        if (Array.isArray(cachedPracticals) && cachedPracticals.length > 0) {
          cachedPracticals.forEach(d => {
            const rawYr = d.yearSuffix || d.Session || d.session;
            const canonical = normalizeSessionKey(rawYr);
            if (canonical) sessionsSet.add(canonical);
          });
        } else {
          const snap = await getDocs(collection(db, 'practicalsData')).catch(() => null);
          if (snap && !snap.empty) {
            snap.docs.forEach(d => {
              const data = d.data();
              const rawYr = data.yearSuffix || data.Session || data.session;
              const canonical = normalizeSessionKey(rawYr);
              if (canonical) sessionsSet.add(canonical);
            });
          }
        }
        setAvailableSessions(Array.from(sessionsSet).sort((a, b) => b.localeCompare(a)));
      } catch (e) {
        console.warn('Session detection note:', e);
      }
    };
    detectPastSessions();
  }, []);

  const availableEvalTypes = useMemo(() => {
    return getEvaluationTypesForTeacher(practicalsSettings, selectedClass, yearSuffix);
  }, [practicalsSettings, selectedClass, yearSuffix]);

  const activeEvalOption = availableEvalTypes.find(e => e.value === practicalType);
  const isCustomEval = activeEvalOption?.isCustom;
  const currentSubjectObj = SUBJECT_MAP.find(s => s.name === selectedSubject) || SUBJECT_MAP[1];
  const evalTypeNorm = String(practicalType || '').toLowerCase().includes('ext') ? 'external' : 'internal';
  const currentMarksConfig = getSubjectMarksConfig(practicalsSettings, selectedClass, evalTypeNorm, currentSubjectObj.code);
  const customSubjOverride = activeEvalOption?.evalConfig?.subjectOverrides?.[currentSubjectObj.code];
  const baseEvalMax = customSubjOverride?.maxMarks
    ? Number(customSubjOverride.maxMarks)
    : (isCustomEval && activeEvalOption?.evalConfig?.maxMarks
        ? Number(activeEvalOption.evalConfig.maxMarks)
        : currentMarksConfig.max);
  const defaultSubjectPaperMax = customSubjOverride?.maxMarks
    ? Number(customSubjOverride.maxMarks)
    : baseEvalMax;
  const subjectMaxMarks = Number(teacherCustomMax) > 0 ? Number(teacherCustomMax) : defaultSubjectPaperMax;
  const minPassMarks = customSubjOverride?.minMarks && !teacherCustomMax
    ? Number(customSubjOverride.minMarks)
    : Math.ceil(subjectMaxMarks * 0.36);

  const getSubjectMax = useCallback((code) => {
    if (code === currentSubjectObj.code && Number(teacherCustomMax) > 0) {
      return Number(teacherCustomMax);
    }
    const override = activeEvalOption?.evalConfig?.subjectOverrides?.[code];
    if (override?.maxMarks) {
      return Number(override.maxMarks);
    }
    if (isCustomEval && activeEvalOption?.evalConfig?.maxMarks) {
      return Number(activeEvalOption.evalConfig.maxMarks);
    }
    return getSubjectMarksConfig(practicalsSettings, selectedClass, evalTypeNorm, code).max;
  }, [practicalsSettings, selectedClass, evalTypeNorm, isCustomEval, activeEvalOption, currentSubjectObj.code, teacherCustomMax]);

  // Fetch Roster strictly for confirmed students with assigned class roll numbers
  const fetchPracticalData = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const targetSubjCode = currentSubjectObj.code;
      const targetSubjName = currentSubjectObj.name;
      const docId = formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix);
      const pendingDocId = `pending_${docId}`;

      // 1. Fetch collections concurrently in parallel for high performance
      let savedMarksMap = {};
      let masterDocs = [];
      let admDocs = [];
      let foundCanonical = null;
      let foundPending = null;

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
          const dId = String(data.id || data.docId || '');

          // Track pending, draft or rejected submission for this exact class, subject, evalType, session
          if (dId === pendingDocId || (String(data.canonicalDocId || '') === docId && (data.status === 'pending_approval' || data.status === 'rejected' || data.status === 'draft' || data.isDraft === true))) {
            foundPending = { id: dId, ...data };
          }
          // Track canonical integrated submission
          if ((dId === docId || (String(data.docId || '') === docId && !dId.startsWith('pending_') && !dId.startsWith('history_'))) && Array.isArray(data.records) && data.records.length > 0) {
            foundCanonical = { id: dId, ...data };
          }

          // Class Match
          const docClass = String(data.className || data.Class || dId).toLowerCase();
          const matchClass = docClass.includes(clsNorm.toLowerCase()) || dId.toLowerCase().includes(clsNorm.toLowerCase());
          if (!matchClass && dId !== docId && dId !== pendingDocId) return;

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
          const docYr = String(data.yearSuffix || data.Session || data.session || (dId.includes('_') ? dId.split('_').pop() : '') || '').trim();
          const docYrNorm = normalizeYr(docYr);
          const targetNorm = normalizeYr(String(yearSuffix).trim());
          const matchYr = (docYrNorm === targetNorm) || dId === docId || dId === pendingDocId || (targetNorm === '2025-26' && (docYr === '2026' || docYrNorm === '2025-26'));
          if (!matchYr) return;

          // Subject Match (supporting codes, full names, and Botany/Zoology/Biology splits)
          const docSubj = String(data.subjectName || data.Subject || data.subjectCode || data.subject || '').toUpperCase();
          const matchSubj = docSubj.includes(targetSubjCode.toUpperCase()) || 
                            docSubj.includes(targetSubjName.toUpperCase()) ||
                            (targetSubjCode === 'BO' && (docSubj.includes('BOTANY') || docSubj.includes('BO') || docSubj.includes('BI'))) ||
                            (targetSubjCode === 'ZO' && (docSubj.includes('ZOOLOGY') || docSubj.includes('ZO') || docSubj.includes('BI'))) ||
                            (targetSubjCode === 'BI' && (docSubj.includes('BIOLOGY') || docSubj.includes('BOTANY') || docSubj.includes('ZOOLOGY'))) ||
                            dId === docId || dId === pendingDocId;
          
          if (!matchSubj && dId !== docId && dId !== pendingDocId) return;

          if (data.maxMarks && Number(data.maxMarks) > 0) {
            setTeacherCustomMax(Number(data.maxMarks));
          }

          // Parse records array if present (skip history backups)
          if (Array.isArray(data.records) && !dId.startsWith('history_')) {
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

        // Ensure pending / draft document records always take priority over older canonical records
        if (foundPending && Array.isArray(foundPending.records)) {
          foundPending.records.forEach(r => {
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
              practicalMarks: r.practicalMarks !== undefined && r.practicalMarks !== null ? r.practicalMarks : '',
              vivaMarks: r.vivaMarks || '',
              totalMarks: r.totalMarks !== undefined && r.totalMarks !== null ? r.totalMarks : (r.practicalMarks || '')
            };

            if (rRoll) savedMarksMap[rRoll] = recObj;
            if (rBoard) savedMarksMap[rBoard] = recObj;
            if (rForm) savedMarksMap[rForm] = recObj;
            if (rName) savedMarksMap[rName] = recObj;
          });
          if (foundPending.maxMarks && Number(foundPending.maxMarks) > 0) {
            setTeacherCustomMax(Number(foundPending.maxMarks));
          }
        }

        // Set existing award info for UI indicators & safe overwrite workflow
        setExistingAwardInfo({
          canonical: foundCanonical,
          pending: foundPending
        });
      } catch (e) {
        console.warn('Practicals read note:', e);
      }

      const cacheKey = `${selectedClass}_${yearSuffix}_${selectedSubject}_${practicalType}`;
      let uniqueStudents = masterRosterCacheRef.current[cacheKey];

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
                  class: it['Admission sought for class'] || it['Class for which Admission Sought'] || it['Class Enrolled'] || it.className || it.class || it.Class || it['Class'] || docClass
                });
              });
            } else {
              allCandidates.push({
                ...d,
                session: d.Session || d.session || docSession,
                class: d['Admission sought for class'] || d['Class for which Admission Sought'] || d['Class Enrolled'] || d.className || d.class || d.Class || docClass
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

          // 3. Class Roll No (Strictly restrict to matching class to prevent cross-class roll number collisions)
          const rRoll = String(it.classRollNo || it.rollNo || it['Class Roll No'] || it['Roll No'] || '').trim();
          if (isMatchCls) {
            setIfBetter(richByRoll, rRoll, it);
          }

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
        const evalAllowedStatuses = activeEvalOption?.evalConfig?.allowedStatuses;
        allCandidates.forEach(st => {
          const stClass = extractStudentClass(st);
          const stSession = st.session || st.Session || st['Academic Session'];

          // Filter by allowed student status if specified in assessment config
          if (Array.isArray(evalAllowedStatuses) && evalAllowedStatuses.length > 0) {
            const rawStatus = String(st.status || st.admissionStatus || st['Admission Status'] || st['Status'] || '').toLowerCase().trim();
            const isStatusMatch = evalAllowedStatuses.some(statusFilter => {
              const sf = String(statusFilter).toLowerCase().trim();
              return rawStatus.includes(sf) || (sf === 'approved' && (!rawStatus || rawStatus === 'approved' || rawStatus === 'confirmed'));
            });
            if (!isStatusMatch) return;
          }

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

            if (Array.isArray(evalAllowedStatuses) && evalAllowedStatuses.length > 0) {
              const rawStatus = String(richSt.status || richSt.admissionStatus || richSt['Admission Status'] || richSt['Status'] || rec.status || '').toLowerCase().trim();
              const isStatusMatch = evalAllowedStatuses.some(statusFilter => {
                const sf = String(statusFilter).toLowerCase().trim();
                return rawStatus.includes(sf) || (sf === 'approved' && (!rawStatus || rawStatus === 'approved' || rawStatus === 'confirmed'));
              });
              if (!isStatusMatch) return;
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
          masterRosterCacheRef.current[cacheKey] = uniqueStudents;
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

          const pMarkVal = draft.practicalMarks !== undefined ? draft.practicalMarks : (saved.practicalMarks !== undefined ? saved.practicalMarks : '');
          const vMarkVal = draft.vivaMarks !== undefined ? draft.vivaMarks : (saved.vivaMarks !== undefined ? saved.vivaMarks : '');

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
            practicalMarks: pMarkVal,
            vivaMarks: vMarkVal,
          };
        });

      if (foundPending?.isDraft === true || foundPending?.status === 'draft') {
        const cloudDraftTime = new Date(foundPending.updatedAt || foundPending.submittedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setDraftSavedAt(cloudDraftTime);
      } else {
        setDraftSavedAt(localDraftSavedTime || null);
      }
      setStudentMarks(formatted);
      setSelectedKeys(new Set());
    } catch (err) {
      console.error('Failed to fetch practical roster:', err);
      setStudentMarks([]);
      setSelectedKeys(new Set());
      triggerNotification({
        type: 'error',
        title: 'Unable to Load Roster',
        badge: 'Connection Error',
        text: 'Failed to retrieve the practical evaluation roster from database. Please check your internet connection.',
        primaryButtonText: 'Dismiss'
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject, practicalType, yearSuffix]);

  useEffect(() => {
    fetchPracticalData();
  }, [fetchPracticalData]);

  // Fetch Past Submission History across all evaluation types
  const fetchSubmissionHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let rawDocs = await getCachedCollection('practicalsData', false, 15 * 60 * 1000);
      if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
        const snap = await getDocs(collection(db, 'practicalsData'));
        if (!snap.empty) {
          rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          rawDocs = [];
        }
      }

      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        const list = rawDocs
          .filter(d => {
            if (!d) return false;
            const rawId = String(d.id || d.docId || '');
            if (rawId.startsWith('history_')) return false;

            const recCount = Array.isArray(d.records) ? d.records.length : (Array.isArray(d.students) ? d.students.length : 0);
            const subj = String(d.subject || d.subjectName || d.subjectCode || '').trim();
            const hasValidSubject = subj.length > 0 && subj.toLowerCase() !== 'n/a' && subj.toLowerCase() !== 'null';

            // Filter out shell/corrupted records that have 0 students or no valid subject
            if (recCount === 0 || !hasValidSubject) return false;
            return true;
          })
          .map(d => {
            const rawId = String(d.id || d.docId || '');
            const evalType = d.practicalType || d.evaluationType || d.examTitle || d.title || 'Assessment';
            
            // Safely resolve timestamp
            let sortTime = 0;
            let displayDate = 'N/A';
            const rawTime = d.updatedAt || d.submittedAt;
            if (rawTime) {
              if (typeof rawTime?.toDate === 'function') {
                const dateObj = rawTime.toDate();
                sortTime = dateObj.getTime();
                displayDate = dateObj.toLocaleString();
              } else if (rawTime?.seconds) {
                const dateObj = new Date(rawTime.seconds * 1000);
                sortTime = dateObj.getTime();
                displayDate = dateObj.toLocaleString();
              } else {
                const dateObj = new Date(rawTime);
                if (!isNaN(dateObj.getTime())) {
                  sortTime = dateObj.getTime();
                  displayDate = dateObj.toLocaleString();
                } else {
                  displayDate = String(rawTime);
                }
              }
            }

            return {
              ...d,
              id: rawId,
              className: d.className || d.class || d.selectedClass || 'N/A',
              subject: d.subject || d.subjectName || d.subjectCode || 'N/A',
              practicalType: evalType,
              evaluationType: evalType,
              yearSuffix: d.yearSuffix || d.sessionCanonical || d.session || '',
              recordsCount: Array.isArray(d.records) ? d.records.length : (Array.isArray(d.students) ? d.students.length : 0),
              displayDate,
              sortTime
            };
          })
          .sort((a, b) => b.sortTime - a.sortTime);

        // Deduplicate duplicate items by unique compound identity
        const seen = new Set();
        const deduped = [];
        for (const item of list) {
          const key = `${item.id}_${item.className}_${item.subject}_${item.practicalType}_${item.yearSuffix}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }

        setSubmissionHistory(deduped);
      } else {
        setSubmissionHistory([]);
      }
    } catch (e) {
      console.error('Failed to load submissions history:', e);
      setSubmissionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Auto-open Submissions History if navigated from Dashboard link (?view=history or state.openHistory)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'history' || params.get('history') === 'true' || location.state?.openHistory) {
      setShowHistoryModal(true);
      fetchSubmissionHistory();
    }
  }, [location, fetchSubmissionHistory]);



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

  // 1. Save Evaluation Draft (Cloud Database + LocalStorage fallback)
  const handleSaveDraft = async () => {
    if (!studentMarks || studentMarks.length === 0) {
      triggerNotification({
        type: 'error',
        title: 'Cannot Save Draft',
        badge: 'Empty Roster',
        text: 'No student roster available to save as draft.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }
    setSavingAction('draft');
    setSaving(true);
    setAlert(null);
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
      const draftPayloadLocal = {
        className: selectedClass,
        subject: selectedSubject,
        practicalType,
        yearSuffix,
        savedAt: timeStr,
        marksMap
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draftPayloadLocal));
      } catch (_) {}

      // Write draft to Firestore database: only students with marks or absent are stored with values;
      // for other students, marks obtained will be empty string.
      const docId = formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix);
      const pendingDocId = `pending_${docId}`;

      const records = studentMarks.map((s) => {
        const pRaw = String(s.practicalMarks !== undefined && s.practicalMarks !== null ? s.practicalMarks : '').trim().toUpperCase();
        const vRaw = String(s.vivaMarks !== undefined && s.vivaMarks !== null ? s.vivaMarks : '').trim().toUpperCase();

        const isAbsent = pRaw === 'A' || vRaw === 'A' || pRaw === 'AB' || vRaw === 'AB';
        const isFilled = pRaw !== '' || vRaw !== '';

        let pMarks = '';
        let vMarks = '';
        let totalMarks = '';

        if (isAbsent) {
          pMarks = 'AB';
          vMarks = 'AB';
          totalMarks = 'AB';
        } else if (isFilled) {
          let pVal = isNaN(Number(pRaw)) ? 0 : Number(pRaw);
          let vVal = isNaN(Number(vRaw)) ? 0 : Number(vRaw);
          if (pVal < 0) pVal = 0;
          if (pVal > subjectMaxMarks) pVal = subjectMaxMarks;
          if (vVal < 0) vVal = 0;
          if (vVal > subjectMaxMarks) vVal = subjectMaxMarks;
          pMarks = pRaw;
          vMarks = vRaw;
          totalMarks = Math.min(subjectMaxMarks, pVal + vVal);
        }

        return {
          rollNo: String(s.rollNo || '').trim(),
          name: String(s.name || '').trim().slice(0, 120),
          formNo: String(s.formNo || '').trim().slice(0, 50),
          regNo: String(s.regNo || s.boardRegNo || '').trim().slice(0, 50),
          examRollNo: String(s.examRollNo || '').trim().slice(0, 50),
          practicalMarks: pMarks,
          vivaMarks: vMarks,
          totalMarks: totalMarks,
          marksInWords: totalMarks === '' ? '' : (totalMarks === 'AB' ? 'Absent' : numberToWords(totalMarks)),
        };
      });

      const submissionPayload = {
        docId: pendingDocId,
        canonicalDocId: docId,
        className: selectedClass,
        subject: selectedSubject,
        subjectCode: currentSubjectObj.code,
        practicalType,
        evaluationType: practicalType,
        yearSuffix,
        records,
        status: 'draft',
        isDraft: true,
        maxMarks: subjectMaxMarks,
        minMarks: minPassMarks,
        submittedByEmail: auth.currentUser?.email || user?.email || '',
        submittedByName: user?.name || auth.currentUser?.displayName || 'Faculty Member',
        teacherRegisteredSubject: teacherRegisteredSubject || '',
        isCrossSubject,
        isOverwrite,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveAcademicRecord('practicalsData', pendingDocId, submissionPayload);
      invalidateCollectionCache('practicalsData');
      setExistingAwardInfo(prev => ({ ...prev, pending: submissionPayload }));
      setDraftSavedAt(timeStr);
      triggerNotification({
        type: 'success',
        title: 'Evaluation Draft Saved!',
        badge: 'Draft in Progress',
        text: `Draft saved to database at ${timeStr}! Entered marks and absent records are safely stored; unfilled entries remain blank for editing.`,
        details: [
          { label: 'Class & Stream', value: selectedClass },
          { label: 'Subject', value: `${selectedSubject} (${currentSubjectObj.code})` },
          { label: 'Evaluation Type', value: practicalType },
          { label: 'Academic Session', value: yearSuffix },
          { label: 'Draft Time', value: timeStr },
          { label: 'Cloud Status', value: 'Saved to Firestore' }
        ],
        primaryButtonText: 'Continue Editing'
      });
    } catch (err) {
      console.error('Save draft error:', err);
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      triggerNotification({
        type: 'warning',
        title: 'Draft Saved Locally',
        badge: 'Local Storage Fallback',
        text: 'Draft saved to local storage (cloud sync pending). You can continue entering marks.',
        primaryButtonText: 'Understood'
      });
    } finally {
      setSaving(false);
    }
  };

  // 2. Data Validation & Initiate Final Submit
  const handleInitiateFinalSubmit = () => {
    if (!studentMarks || studentMarks.length === 0) {
      triggerNotification({
        type: 'error',
        title: 'Cannot Submit Award',
        badge: 'Empty Roster',
        text: 'No student roster available for final submission.',
        primaryButtonText: 'Dismiss'
      });
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
  const executeFinalSubmit = async (autoMarkAbsentForUnfilled = true) => {
    setSavingAction('final');
    setSaving(true);
    setShowValidationModal(false);
    setAlert(null);
    try {
      if (!auth.currentUser) {
        throw new Error('Active authenticated faculty session required to submit practical marks.');
      }
      const docId = formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix);
      const pendingDocId = `pending_${docId}`;

      const records = studentMarks.map((s) => {
        let pMarks = String(s.practicalMarks !== undefined && s.practicalMarks !== null ? s.practicalMarks : '').trim().toUpperCase();
        let vMarks = String(s.vivaMarks !== undefined && s.vivaMarks !== null ? s.vivaMarks : '').trim().toUpperCase();

        // On final submission, any unfilled student MUST be treated as Absent (AB)
        if (pMarks === '' && vMarks === '') {
          pMarks = 'AB';
          vMarks = 'AB';
        }

        const isAbsent = pMarks === 'A' || vMarks === 'A' || pMarks === 'AB' || vMarks === 'AB';
        let pVal = isNaN(Number(pMarks)) ? 0 : Number(pMarks);
        let vVal = isNaN(Number(vMarks)) ? 0 : Number(vMarks);
        if (pVal < 0) pVal = 0;
        if (pVal > subjectMaxMarks) pVal = subjectMaxMarks;
        if (vVal < 0) vVal = 0;
        if (vVal > subjectMaxMarks) vVal = subjectMaxMarks;

        const total = isAbsent ? 'AB' : Math.min(subjectMaxMarks, pVal + vVal);

        return {
          rollNo: String(s.rollNo || '').trim(),
          name: String(s.name || '').trim().slice(0, 120),
          formNo: String(s.formNo || '').trim().slice(0, 50),
          regNo: String(s.regNo || s.boardRegNo || '').trim().slice(0, 50),
          examRollNo: String(s.examRollNo || '').trim().slice(0, 50),
          practicalMarks: isAbsent ? 'AB' : pMarks,
          vivaMarks: isAbsent ? 'AB' : vMarks,
          totalMarks: total,
          marksInWords: isAbsent ? 'Absent' : numberToWords(total),
        };
      });

      const submissionPayload = {
        docId: pendingDocId,
        canonicalDocId: docId,
        className: selectedClass,
        subject: selectedSubject,
        subjectCode: currentSubjectObj.code,
        practicalType,
        evaluationType: practicalType,
        yearSuffix,
        records,
        status: 'pending_approval',
        isDraft: false,
        maxMarks: subjectMaxMarks,
        minMarks: minPassMarks,
        submittedByEmail: auth.currentUser?.email || user?.email || '',
        submittedByName: user?.name || auth.currentUser?.displayName || 'Faculty Member',
        teacherRegisteredSubject: teacherRegisteredSubject || '',
        isCrossSubject,
        isOverwrite,
        previousAwardSummary: existingAwardInfo?.canonical ? {
          submittedByName: existingAwardInfo.canonical.submittedByName || existingAwardInfo.canonical.submittedByEmail || 'Faculty Member',
          submittedAt: existingAwardInfo.canonical.submittedAt || existingAwardInfo.canonical.updatedAt || '',
          recordsCount: existingAwardInfo.canonical.records?.length || 0,
          maxMarks: existingAwardInfo.canonical.maxMarks || subjectMaxMarks,
        } : null,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveAcademicRecord('practicalsData', pendingDocId, submissionPayload);
      invalidateCollectionCache('practicalsData');
      setExistingAwardInfo(prev => ({ ...prev, pending: submissionPayload }));

      // Update studentMarks in state so the table immediately displays 'AB' for any previously unfilled students
      setStudentMarks(prev => prev.map(st => {
        const p = String(st.practicalMarks !== undefined && st.practicalMarks !== null ? st.practicalMarks : '').trim().toUpperCase();
        const v = String(st.vivaMarks !== undefined && st.vivaMarks !== null ? st.vivaMarks : '').trim().toUpperCase();
        if (p === '' && v === '') {
          return { ...st, practicalMarks: 'AB', vivaMarks: 'AB' };
        }
        return st;
      }));

      // Clear local draft after successful final submission
      const clsNormKey = String(selectedClass).replace(/class/i, '').trim();
      const draftKey = `draft_prac_${clsNormKey}_${selectedSubject}_${practicalType}_${yearSuffix}`;
      try {
        localStorage.removeItem(draftKey);
      } catch (_) {}
      setDraftSavedAt(null);

      try {
        await addDoc(collection(db, 'activityLogs'), {
          activityType: isCrossSubject 
            ? 'practical_cross_subject_submission' 
            : (isOverwrite ? 'practical_overwrite_submission' : 'practical_submission'),
          className: selectedClass,
          subject: selectedSubject,
          practicalType,
          yearSuffix,
          recordsCount: records.length,
          isCrossSubject,
          isOverwrite,
          submittedBy: auth.currentUser?.email || '',
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Activity log note:', logErr);
      }

      triggerNotification({
        type: 'success',
        title: 'Evaluation Award List Submitted!',
        badge: 'Staged for Administrator Review & Approval',
        text: isCrossSubject
          ? `✨ Cross-subject evaluation award list submitted for ${selectedSubject} (${selectedClass})! Staged for Administrator review & approval.`
          : isOverwrite
          ? `✨ Overwrite revision submitted for ${selectedSubject} (${selectedClass})! Staged for Administrator review & approval (previous award safely archived).`
          : `✨ Evaluation award list submitted for ${selectedSubject} (${selectedClass})! Staged for Administrator review & approval.`,
        details: [
          { label: 'Class & Stream', value: selectedClass },
          { label: 'Subject', value: `${selectedSubject} (${currentSubjectObj.code})` },
          { label: 'Evaluation Type', value: practicalType },
          { label: 'Academic Session', value: yearSuffix },
          { label: 'Evaluated Roster', value: `${records.length} Students Total` },
          { label: 'Submission Status', value: 'Pending Administrator Approval' }
        ],
        primaryButtonText: 'Return to Roster',
        secondaryButtonText: 'View Submission History',
        onSecondaryClick: () => {
          setShowHistoryModal(true);
        }
      });
    } catch (err) {
      console.error('Final submit error:', err);
      triggerNotification({
        type: 'error',
        title: 'Submission Failed',
        badge: 'Action Required',
        text: err?.message || 'Failed to complete practical award submission. Please check your network and try again.',
        primaryButtonText: 'Close & Retry'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintReport = () => {
    if (!studentMarks || studentMarks.length === 0) {
      triggerNotification({
        type: 'error',
        title: 'Cannot Print Award Roll',
        badge: 'Empty Award List',
        text: 'No student records available to print.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    const recordsForPrint = studentMarks.map((st, i) => ({
      sno: i + 1,
      classRollNo: st.classRollNo || st.rollNo || '—',
      rollNo: st.examRollNo || '—',
      examRollNo: st.examRollNo || '—',
      centreNo: st.centreNo || '',
      name: st.name || st.studentName || '—',
      practicalMarks: st.practicalMarks || '—',
      vivaMarks: st.vivaMarks || '—',
      totalMarks: (st.practicalMarks && st.practicalMarks.toUpperCase() === 'AB') ? 'AB' : (st.totalMarks || st.practicalMarks || '—')
    }));

    const isExternal = practicalType.toLowerCase().includes('external');
    const isBiAnnual = /\b(oct|nov|bian|private|bi-annual|mar-apr)\b/i.test(yearSuffix);
    const sessionStr = isBiAnnual
      ? `Annual Private / Bi-Annual (${yearSuffix})`
      : (yearSuffix.toLowerCase().includes('annual') ? yearSuffix : `Annual Regular ${yearSuffix}`);

    printIndividualAwardRoll({
      subjectCode: currentSubjectObj.code,
      subjectName: currentSubjectObj.name,
      className: selectedClass,
      session: sessionStr,
      records: recordsForPrint,
      isExternal,
      evaluationType: practicalType,
      practicalType,
      examTitle: activeEvalOption?.title || activeEvalOption?.label || practicalType,
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
        triggerNotification({
          type: 'error',
          title: 'Input Value Missing',
          badge: 'Quick Fill',
          text: 'Please enter a marks value (e.g. 10 or A) to fill.',
          primaryButtonText: 'Enter Marks'
        });
        return;
      }
      if (rawVal !== 'A' && rawVal !== 'AB' && rawVal !== 'ABSENT') {
        const num = Number(rawVal);
        if (isNaN(num) || num < 0 || num > subjectMaxMarks) {
          triggerNotification({
            type: 'error',
            title: 'Invalid Marks Value',
            badge: 'Validation Check',
            text: `Invalid marks "${rawVal}". Must be between 0 and ${subjectMaxMarks}, or "A" for Absent.`,
            primaryButtonText: 'Correct Value'
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
        triggerNotification({
          type: 'info',
          title: 'Marks Reset',
          badge: 'Batch Clear',
          text: `Cleared practical marks for ${updatedCount} student(s).`,
          primaryButtonText: 'Understood'
        });
      } else {
        triggerNotification({
          type: 'info',
          title: 'Nothing to Clear',
          badge: 'Roster Notice',
          text: 'No marks to clear (all selected/displayed cells are already empty).',
          primaryButtonText: 'Understood'
        });
      }
    } else {
      if (updatedCount > 0) {
        triggerNotification({
          type: 'success',
          title: 'Marks Filled Successfully',
          badge: 'Batch Fill Complete',
          text: `⚡ Successfully filled mark "${rawVal}" for ${updatedCount} student(s)!`,
          primaryButtonText: 'Continue'
        });
      } else {
        triggerNotification({
          type: 'info',
          title: 'No Matching Students',
          badge: 'Selection Notice',
          text: 'No students matched the selected fill scope.',
          primaryButtonText: 'Understood'
        });
      }
    }
  }, [quickFillMark, subjectMaxMarks, selectedKeys, displayedStudents, getStudentKey, triggerNotification]);

  return (
    <div className="portal-page w-full min-h-[90vh] py-3 sm:py-4 px-2 sm:px-4 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      {/* Top subtle progress bar during asynchronous roster loading */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-teal-500/20 overflow-hidden pointer-events-none">
          <div className="h-full bg-teal-500 w-1/3 animate-pulse rounded-full" />
        </div>
      )}

      <SEO
        title="Practical Evaluation Portal"
        description="Upload practical evaluation & lab marks, and generate official award lists."
        path="/portal/teacher/practicals"
      />

      <div className="max-w-6xl mx-auto space-y-3 pb-24">
        {/* Main Ultra-Compact Card */}
        <div className="rounded-2xl p-2.5 sm:p-4 border shadow-md space-y-2.5 bg-white dark:bg-slate-900" style={{ borderColor: 'var(--border-ui, #cbd5e1)' }}>
          {/* Integrated Header Navigation Bar */}
          <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                to="/portal/teacher"
                className="inline-flex items-center gap-1 text-xs font-black text-teal-700 hover:text-teal-800 dark:text-teal-400 p-1 px-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all shrink-0 active:scale-95"
                title="Back to Teacher Workspace"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </Link>
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                  Practical Evaluation
                </h1>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-black shrink-0 truncate max-w-[130px] sm:max-w-none">
                  {selectedClass} • {currentSubjectObj.name} ({currentSubjectObj.code})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {teacherRegisteredSubject && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20" title={`Your officially assigned teaching subject is ${teacherRegisteredSubject}`}>
                  <Award size={11} className="text-emerald-600" />
                  <span className="hidden xs:inline">Assigned:</span> {teacherRegisteredSubject}
                </span>
              )}
              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <ShieldCheck size={10} /> LAB EVALUATION
              </div>
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
            <div className={`p-3 rounded-2xl text-xs font-extrabold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs border ${
              alert.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : alert.type === 'info'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  alert.type === 'error'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : alert.type === 'info'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {alert.type === 'error' ? (
                    <AlertCircle size={16} />
                  ) : alert.type === 'info' ? (
                    <Info size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </span>
                <span className="leading-snug truncate sm:whitespace-normal">{alert.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Cross-Subject Warning Banner */}
          {isCrossSubject && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start justify-between gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in duration-200 shadow-xs">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle size={16} />
                </span>
                <div className="text-xs space-y-0.5">
                  <div className="font-black flex items-center gap-1.5 flex-wrap">
                    <span>Cross-Subject Mode Active</span>
                    <span className="px-1.5 py-0.2 bg-amber-200 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 rounded text-[9.5px] uppercase font-black tracking-wide">
                      Admin Approval Required
                    </span>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed">
                    You are officially registered for <strong>{teacherRegisteredSubject}</strong>, but are currently evaluating <strong>{selectedSubject}</strong>. You may submit awards, but this submission will be flagged as a Cross-Subject Award and will require Administrator Approval before final integration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubject(teacherRegisteredSubject)}
                className="shrink-0 px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all cursor-pointer shadow-2xs active:scale-95"
                title={`Switch back to ${teacherRegisteredSubject}`}
              >
                Revert to {teacherRegisteredSubject}
              </button>
            </div>
          )}

          {/* Existing Award / Pending Review Status Banner */}
          {existingAwardInfo?.pending?.status === 'rejected' ? (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 flex items-start gap-2.5 text-rose-900 dark:text-rose-200 animate-in fade-in duration-200 shadow-xs">
              <span className="w-7 h-7 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={16} />
              </span>
              <div className="text-xs space-y-0.5 flex-1 min-w-0">
                <div className="font-black text-rose-800 dark:text-rose-300">
                  Revision Requested by Administrator
                </div>
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300/90 leading-relaxed">
                  Administrator Feedback: <span className="italic font-bold">"{existingAwardInfo.pending.rejectionReason || 'Please review and adjust student marks.'}"</span>
                </p>
                <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-medium">
                  Please correct the entries in the roster below and re-submit your revision for approval.
                </p>
              </div>
            </div>
          ) : existingAwardInfo?.pending?.isDraft === true || existingAwardInfo?.pending?.status === 'draft' ? (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 animate-in fade-in duration-200 shadow-xs">
              <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bookmark size={16} />
              </span>
              <div className="text-xs space-y-0.5 flex-1 min-w-0">
                <div className="font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5 flex-wrap">
                  <span>Saved Draft Loaded</span>
                  <span className="px-1.5 py-0.2 bg-amber-200 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 rounded text-[9.5px] uppercase font-black">
                    Draft In Progress
                  </span>
                </div>
                <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
                  An active evaluation draft for <strong>{selectedClass} • {selectedSubject} ({practicalType})</strong> was preloaded from the database. Only students with entered marks or absent are stored; remaining entries are empty so you can continue entering them.
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  You can edit any entries and click <strong>Save Draft</strong> to update progress, or click <strong>Final Submit</strong> when evaluation is finished.
                </p>
              </div>
            </div>
          ) : existingAwardInfo?.pending ? (
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-2.5 text-indigo-900 dark:text-indigo-200 animate-in fade-in duration-200 shadow-xs">
              <span className="w-7 h-7 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock size={16} />
              </span>
              <div className="text-xs space-y-0.5 flex-1 min-w-0">
                <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 flex-wrap">
                  <span>Submission Pending Administrator Approval</span>
                  <span className="px-1.5 py-0.2 bg-indigo-200 dark:bg-indigo-800/80 text-indigo-900 dark:text-indigo-100 rounded text-[9.5px] uppercase font-black">
                    Under Review
                  </span>
                </div>
                <p className="text-[11px] font-medium text-indigo-800 dark:text-indigo-300 leading-relaxed">
                  An award list for <strong>{selectedClass} • {selectedSubject} ({practicalType})</strong> was submitted by <strong>{existingAwardInfo.pending.submittedByName || 'Faculty Member'}</strong> on <strong>{new Date(existingAwardInfo.pending.submittedAt || existingAwardInfo.pending.updatedAt).toLocaleString()}</strong> ({existingAwardInfo.pending.records?.length || 0} students).
                </p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  This submission is awaiting Administrator review. All entries are preloaded below and can be edited and re-submitted or saved as draft at any time.
                </p>
              </div>
            </div>
          ) : existingAwardInfo?.canonical ? (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-slate-800 dark:text-slate-200 animate-in fade-in duration-200 shadow-xs">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={16} />
                </span>
                <div className="text-xs space-y-0.5">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    <span>Award Already Submitted & Integrated</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded text-[9.5px] uppercase font-black">
                      Live in Database
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    An official award list for <strong>{selectedClass} • {selectedSubject} ({practicalType})</strong> is already integrated in the database, submitted by <strong>{existingAwardInfo.canonical.submittedByName || existingAwardInfo.canonical.submittedByEmail || 'Faculty'}</strong> on <strong>{new Date(existingAwardInfo.canonical.submittedAt || existingAwardInfo.canonical.updatedAt).toLocaleDateString()}</strong> ({existingAwardInfo.canonical.records?.length || 0} students).
                  </p>
                  <p className="text-[10.5px] text-amber-700 dark:text-amber-400 font-bold">
                    ⚠️ Notice: Any edits submitted now will stage an <em>Overwrite Revision</em> requiring Administrator Approval. Previous awards will be preserved in the revision history.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Master Control Row: Select-All, Student Count, Sort, Filters, Quick Fill, and Print in ONE Single Row (Guaranteed Print Visible on Mobile) */}
          <div className="flex items-center justify-between gap-1 sm:gap-1.5 pt-0.5">
            {/* Left: Select All Checkbox Pill (Uniform 32px Height) */}
            <label className="practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] px-1.5 sm:px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" title={isAllSelected ? "Deselect all" : "Select all"}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                onChange={handleToggleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
              <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300">All</span>
            </label>

            {/* Middle: Sort Dropdown (Ultra-Compact on Mobile) */}
            <div className="flex items-center gap-0.5 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="practicals-select practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] w-[58px] sm:w-[70px] px-1 rounded-lg border text-[10px] sm:text-[10.5px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
                title="Sort students"
              >
                <option value="rollAsc">Roll ↑</option>
                <option value="rollDesc">Roll ↓</option>
                <option value="nameAsc">A-Z</option>
                <option value="formAsc">Form #</option>
              </select>
            </div>

            {/* Right: Actions Group (Filters, Quick Fill, Print - All Visible & Guaranteed 32px Height) */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Filters Button with Compact Student Count */}
              <button
                type="button"
                onClick={() => setShowFilterSettings(!showFilterSettings)}
                className={`practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] px-1.5 sm:px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                  showFilterSettings
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
                title={`Open evaluation filters (${displayedStudents.length} students)`}
              >
                <SlidersHorizontal size={13} className={showFilterSettings ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'} />
                <span className="hidden sm:inline">Filters</span>
                <span className={`px-1 py-0.2 rounded font-mono text-[9px] sm:text-[9.5px] font-black leading-none ${
                  showFilterSettings
                    ? 'bg-white/25 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                }`}>
                  {displayedStudents.length}{showFailOnly ? 'F' : ''}
                </span>
                <ChevronDown size={11} className={`hidden sm:inline transition-transform duration-200 ${showFilterSettings ? 'rotate-180' : ''}`} />
              </button>

              {/* Quick Fill Button */}
              <button
                type="button"
                onClick={() => setShowQuickFill(prev => !prev)}
                className={`practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] px-2 sm:px-2.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-2xs shrink-0 ${
                  showQuickFill
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
                title="Quick Bulk Fill: Fill marks for all, empty, or selected students in one go"
              >
                <Zap size={13} className={showQuickFill ? 'text-white' : 'text-amber-500'} />
                <span className="hidden sm:inline">Fill</span>
                {selectedKeys.size > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-indigo-600 text-white text-[8px] font-bold">
                    {selectedKeys.size}
                  </span>
                )}
              </button>

              {/* Print Button (Always Visible & Prominent) */}
              <button
                type="button"
                onClick={handlePrintReport}
                className="practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] w-8 sm:w-auto px-1.5 sm:px-2.5 rounded-lg font-bold text-[11px] bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-600 shadow-2xs cursor-pointer flex items-center justify-center gap-1 active:scale-95 shrink-0"
                title="Print Evaluation Roster"
              >
                <Printer size={13} />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Desktop-only Expandable Filter Inputs Panel */}
          {showFilterSettings && (
              <div className="hidden sm:grid grid-cols-5 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                <div className="space-y-0.5">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="practicals-select practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer transition-colors"
                  >
                    <option value="12th">Class 12th</option>
                    <option value="11th">Class 11th</option>
                    <option value="10th">Class 10th</option>
                    <option value="9th">Class 9th</option>
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
                  teacherRegisteredSubject={teacherRegisteredSubject}
                  onAttemptCrossSubject={(subName) => setCrossSubjectSwitchModal({ isOpen: true, targetSubject: subName })}
                />

                <div className="space-y-0.5">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Eval. Type</label>
                  <select
                    value={practicalType}
                    onChange={(e) => setPracticalType(e.target.value)}
                    className="practicals-select practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer transition-colors"
                  >
                    {availableEvalTypes.map(et => (
                      <option key={et.value} value={et.value}>
                        {et.label || et.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Session</label>
                  <select
                    value={yearSuffix}
                    onChange={(e) => setYearSuffix(e.target.value)}
                    className="practicals-select practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer transition-colors"
                  >
                    {availableSessions.map(yr => {
                      let label = yr;
                      if (yr === '2025-26' || yr === '2026') label = '2025–26 (Reg)';
                      else if (yr === '2025 APR/BIAN') label = '2025 (Pvt/Bi-Ann)';
                      else if (yr === '2026 APR/BIAN') label = '2026 (Pvt/Bi-Ann)';
                      else if (yr === '2024-25 (Mar-Apr)') label = '2024–25 (Mar-Apr)';
                      else if (yr === '2024-25 (Oct-Nov)') label = '2024–25 (Oct-Nov)';
                      else if (yr === '2024-25 (revised)') label = '2024–25 (Oct-Nov)';
                      else if (yr === '2024-25') label = '2024–25 (Mar-Apr)';
                      else if (yr === '2025') label = '2024–25 (Mar-Apr)';
                      else if (yr === '2024') label = '2023–24 (Reg)';
                      else if (yr.match(/^20\d\d$/)) {
                        const yNum = parseInt(yr, 10);
                        label = `${yNum - 1}–${yr.slice(2)} (Reg)`;
                      }
                      return <option key={yr} value={yr}>{label}</option>;
                    })}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Paper Scale</label>
                    <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400">Pass {minPassMarks}</span>
                  </div>
                  <select
                    value={subjectMaxMarks}
                    onChange={(e) => setTeacherCustomMax(Number(e.target.value))}
                    className="practicals-select practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer transition-colors font-mono font-bold"
                    title="Paper Maximum Marks: auto-normalized to standard 50M on student scorecard"
                  >
                    {[15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 100].map(m => (
                      <option key={m} value={m}>
                        {m}M Paper (P: {Math.ceil(m * 0.36)})
                      </option>
                    ))}
                    {![15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 100].includes(subjectMaxMarks) && (
                      <option value={subjectMaxMarks}>{subjectMaxMarks}M Paper</option>
                    )}
                  </select>
                </div>

                <div className="col-span-5 px-1 py-0.5 text-[10.5px] text-indigo-800 dark:text-indigo-300 flex items-center gap-1 font-semibold">
                  <Sparkles size={12} className="text-amber-500 shrink-0" />
                  <span>Paper scale is <strong>{subjectMaxMarks} Max Marks</strong>. Scores entered will be automatically normalized to standard <strong>50 Marks</strong> on public scorecards & gazettes.</span>
                </div>
              </div>
            )}

            {/* Mobile Filter Popup Modal / Bottom Sheet */}
            {showFilterSettings && (
              <div className="sm:hidden fixed inset-0 z-[9990] bg-slate-950/60 backdrop-blur-xs flex items-end justify-center p-0 animate-fadeIn">
                <div className="fixed inset-0" onClick={() => setShowFilterSettings(false)} />
                <div className="relative bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl p-3 sm:p-4 shadow-2xl max-w-lg w-full space-y-2.5 z-10 animate-in slide-in-from-bottom duration-200">
                  {/* Native Mobile Pull Handle */}
                  <div className="w-9 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />

                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <SlidersHorizontal size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                            Evaluation Filters
                          </h3>
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[9.5px] font-bold">
                            {displayedStudents.length} Students
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">Select class, session & subject</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilterSettings(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-0.5">
                    {/* Class & Academic Session in 2-Column Responsive Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Class</label>
                        <select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="portal-compact-select w-full border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer"
                        >
                          <option value="12th">Class 12th</option>
                          <option value="11th">Class 11th</option>
                          <option value="10th">Class 10th</option>
                          <option value="9th">Class 9th</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Session</label>
                        <select
                          value={yearSuffix}
                          onChange={(e) => setYearSuffix(e.target.value)}
                          className="portal-compact-select w-full border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer"
                        >
                          {availableSessions.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Subject (Single unified header rendered inside CustomSubjectSelect) */}
                    <div>
                      <CustomSubjectSelect
                        selectedSubject={selectedSubject}
                        setSelectedSubject={setSelectedSubject}
                        subjectMap={SUBJECT_MAP}
                        currentSubjectObj={currentSubjectObj}
                        getSubjectMax={getSubjectMax}
                        subjectMaxMarks={subjectMaxMarks}
                        minPassMarks={minPassMarks}
                        teacherRegisteredSubject={teacherRegisteredSubject}
                        onAttemptCrossSubject={(subName) => setCrossSubjectSwitchModal({ isOpen: true, targetSubject: subName })}
                      />
                    </div>

                    {/* Evaluation Type */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Evaluation Type</label>
                      <select
                        value={practicalType}
                        onChange={(e) => setPracticalType(e.target.value)}
                        className="portal-compact-select w-full border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer"
                      >
                        {availableEvalTypes.map(et => (
                          <option key={et.value} value={et.value}>{et.label || et.value}</option>
                        ))}
                      </select>
                    </div>

                    {/* Paper Scale / Max Marks */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Paper Scale (Max Marks)</label>
                        <span className="text-[9.5px] font-bold text-teal-600 dark:text-teal-400">Passing: {minPassMarks}</span>
                      </div>
                      <select
                        value={subjectMaxMarks}
                        onChange={(e) => setTeacherCustomMax(Number(e.target.value))}
                        className="portal-compact-select w-full border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer font-bold font-mono"
                      >
                        {[15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 100].map(m => (
                          <option key={m} value={m}>
                            {m} Marks Paper (Pass {Math.ceil(m * 0.36)})
                          </option>
                        ))}
                        {![15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 100].includes(subjectMaxMarks) && (
                          <option value={subjectMaxMarks}>{subjectMaxMarks} Marks</option>
                        )}
                      </select>
                      <p className="text-[9.5px] text-indigo-700 dark:text-indigo-300 mt-1 font-semibold flex items-center gap-1">
                        <Sparkles size={11} className="text-amber-500 shrink-0" />
                        <span>Scores will be auto-normalized to standard 50 Marks on scorecards.</span>
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showFailOnly}
                          onChange={(e) => setShowFailOnly(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span>Show failing or absent only</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowFilterSettings(false)}
                      className="w-full py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer shadow-xs active:scale-98"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop-only Quick Bulk Fill Deck Panel */}
            {showQuickFill && (
              <div className="hidden sm:block p-2.5 sm:p-3 rounded-xl border border-amber-300/80 dark:border-amber-700/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 dark:from-amber-950/40 dark:to-indigo-950/30 space-y-2.5 animate-in fade-in duration-150">
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
                        className="portal-compact-input !h-7 !min-h-[28px] !max-h-[28px] w-16 !p-0 border text-xs font-black text-center uppercase bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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
                            className={`portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] px-2 rounded-md text-[11px] font-black border transition-colors cursor-pointer ${
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
                    {/* Fill Empty Cells */}
                    <button
                      type="button"
                      onClick={() => handleApplyQuickFill('empty')}
                      disabled={emptyCount === 0 || !quickFillMark.trim()}
                      className={`portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] px-2.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        emptyCount > 0 && quickFillMark.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Fill all students who currently have empty marks (preserves already-entered marks)"
                    >
                      <Zap size={12} />
                      <span>Fill Empty</span>
                      <span className="px-1 py-0.2 rounded-full bg-emerald-700 text-white text-[9.5px] font-black leading-none">
                        {emptyCount}
                      </span>
                    </button>

                    {/* Fill Selected */}
                    <button
                      type="button"
                      onClick={() => handleApplyQuickFill('selected')}
                      disabled={selectedKeys.size === 0 || !quickFillMark.trim()}
                      className={`portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] px-2.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        selectedKeys.size > 0 && quickFillMark.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Fill all selected student rows"
                    >
                      <Check size={12} />
                      <span>Fill Selected</span>
                      <span className="px-1 py-0.2 rounded-full bg-indigo-700 text-white text-[9.5px] font-black leading-none">
                        {selectedKeys.size}
                      </span>
                    </button>

                    {/* Fill All */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerConfirm({
                          title: 'Fill All Students',
                          message: `Are you sure you want to assign mark "${quickFillMark}" to ALL ${displayedStudents.length} students in this evaluation roster?`,
                          confirmText: `Fill All (${displayedStudents.length})`,
                          cancelText: 'Cancel',
                          type: 'warning',
                          onConfirm: () => {
                            handleApplyQuickFill('all');
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
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
                        triggerConfirm({
                          title: 'Clear Practical Marks',
                          message: `Are you sure you want to clear practical marks for ${targetLabel} students? Any existing entered marks will be emptied.`,
                          confirmText: 'Yes, Clear Marks',
                          cancelText: 'Keep Marks',
                          type: 'danger',
                          onConfirm: () => {
                            handleApplyQuickFill('clear');
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors flex items-center gap-1 active:scale-95"
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

            {/* Mobile Quick Fill Modal / Bottom Sheet Popup */}
            {showQuickFill && (
              <div className="sm:hidden fixed inset-0 z-[9990] bg-slate-950/60 backdrop-blur-xs flex items-end justify-center p-0 animate-fadeIn">
                <div className="fixed inset-0" onClick={() => setShowQuickFill(false)} />
                <div className="relative bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-4 shadow-2xl max-w-lg w-full space-y-3.5 z-10 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Zap size={15} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Quick Bulk Fill
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {emptyCount} empty cells remaining • {displayedStudents.length} total
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickFill(false)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Marks Input & Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Mark to Assign (Max: {subjectMaxMarks})
                      </label>
                      {quickFillMark && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Active: {quickFillMark === 'A' ? 'Absent (A)' : `${quickFillMark} / ${subjectMaxMarks}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={quickFillMark}
                        onChange={(e) => setQuickFillMark(e.target.value.toUpperCase())}
                        placeholder={`0-${subjectMaxMarks} / A`}
                        className="portal-compact-input !h-8 !min-h-[32px] !max-h-[32px] w-20 px-2 rounded-lg border text-xs font-black text-center uppercase bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs !p-0"
                        maxLength={4}
                      />
                      {/* Presets */}
                      <div className="flex-1 grid grid-cols-4 gap-1.5">
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
                            className={`portal-compact-btn !h-8 !min-h-[32px] !max-h-[32px] rounded-lg text-xs font-black border transition-all cursor-pointer text-center active:scale-95 ${
                              quickFillMark === chipVal
                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {chipVal === 'A' ? 'Abs' : chipVal}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fast Selection Shortcuts */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <span>Selection Targets:</span>
                      {selectedKeys.size > 0 ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedKeys.size} selected</span>
                      ) : (
                        <span>None selected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        {isAllSelected ? 'Deselect All' : `Select All (${displayedStudents.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectEmptyOnly}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 shadow-2xs active:scale-95 cursor-pointer"
                      >
                        Select Empty Only ({emptyCount})
                      </button>
                      {selectedKeys.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedKeys(new Set())}
                          className="px-2 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Fill Empty */}
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyQuickFill('empty');
                        setShowQuickFill(false);
                      }}
                      disabled={emptyCount === 0 || !quickFillMark.trim()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 ${
                        emptyCount > 0 && quickFillMark.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Zap size={14} />
                      <span>Fill Empty ({emptyCount})</span>
                    </button>

                    {/* Fill Selected */}
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyQuickFill('selected');
                        setShowQuickFill(false);
                      }}
                      disabled={selectedKeys.size === 0 || !quickFillMark.trim()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 ${
                        selectedKeys.size > 0 && quickFillMark.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Check size={14} />
                      <span>Fill Selected ({selectedKeys.size})</span>
                    </button>

                    {/* Fill All */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickFill(false);
                        triggerConfirm({
                          title: 'Fill All Students',
                          message: `Are you sure you want to assign mark "${quickFillMark}" to ALL ${displayedStudents.length} students in this evaluation roster?`,
                          confirmText: `Fill All (${displayedStudents.length})`,
                          cancelText: 'Cancel',
                          type: 'warning',
                          onConfirm: () => {
                            handleApplyQuickFill('all');
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      disabled={displayedStudents.length === 0 || !quickFillMark.trim()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 ${
                        displayedStudents.length > 0 && quickFillMark.trim()
                          ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Zap size={14} />
                      <span>Fill All ({displayedStudents.length})</span>
                    </button>

                    {/* Clear All / Clear Selected */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickFill(false);
                        const targetLabel = selectedKeys.size > 0 ? `${selectedKeys.size} selected` : `all ${displayedStudents.length}`;
                        triggerConfirm({
                          title: 'Clear Practical Marks',
                          message: `Are you sure you want to clear practical marks for ${targetLabel} students? Any existing entered marks will be emptied.`,
                          confirmText: 'Yes, Clear Marks',
                          cancelText: 'Keep Marks',
                          type: 'danger',
                          onConfirm: () => {
                            handleApplyQuickFill('clear');
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1 active:scale-98 cursor-pointer"
                    >
                      <X size={14} />
                      <span>Clear {selectedKeys.size > 0 ? `(${selectedKeys.size})` : 'All'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}


          {/* Student Roster Marks Entry Table - Ultra Compact */}
          {loading ? (
            <ModernLoader
              moduleKey="practicals"
              text={`Loading ${selectedSubject} Roster (${selectedClass})…`}
              subtext={`Connecting to official database & preloading ${selectedSubject} records for ${yearSuffix}…`}
              className="py-14"
            />
          ) : displayedStudents.length > 0 ? (
            <>
              {/* ── MOBILE CARDS (hidden on sm+) — High-Density Standard Roster Layout ── */}
              <div className="sm:hidden space-y-1.5">
                {displayedStudents.map((st, idx) => {
                  const isAbsent = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
                  const originalIdx = studentMarks.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);
                  const allSubjs = st.subjectsAbbr || st.rawSubjects || st.subjects || 'N/A';
                  const key = getStudentKey(st);
                  const isSelected = selectedKeys.has(key);

                  return (
                    <div 
                      key={idx} 
                      className={`rounded-xl border py-1.5 px-2 transition-all shadow-2xs space-y-0.5 ${
                        isSelected
                          ? 'border-indigo-400/80 bg-indigo-50/40 dark:border-indigo-600/80 dark:bg-indigo-950/30'
                          : isAbsent 
                          ? 'border-amber-400/50 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-950/20' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Row 1: Checkbox, Roll Badge, Student Name & Compact Marks Input */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(key)}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                          <span className="w-5.5 h-5.5 rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] flex items-center justify-center border border-indigo-500/20 shrink-0" title={`Class Roll: ${st.rollNo}`}>
                            {st.rollNo}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate min-w-0 flex-1">
                            {st.name || st.studentName || 'Student'}
                          </span>
                        </div>

                        {/* Marks Input + Quick Absent Toggle (Strictly Matching Dimensions: 44px x 24px) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={`0-${subjectMaxMarks}`}
                            value={st.practicalMarks}
                            onChange={(e) => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', e.target.value)}
                            className={`practicals-marks-input rounded-md border text-[11px] font-bold text-center leading-none focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase transition-all placeholder:text-slate-400 placeholder:text-[9.5px] placeholder:font-normal shrink-0 ${
                              isAbsent
                                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold'
                                : st.practicalMarks !== ''
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold'
                                : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleMarkChange(originalIdx !== -1 ? originalIdx : idx, 'practicalMarks', isAbsent ? '' : 'A')}
                            className={`practicals-ab-btn rounded-md font-mono text-[10.5px] font-black border transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 leading-none ${
                              isAbsent
                                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-amber-600 dark:hover:text-amber-400 border-slate-200 dark:border-slate-700'
                            }`}
                            title="Toggle Absent"
                          >
                            AB
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Streamlined Single-Line Continuous Metadata (Ellipsis without character collision) */}
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium truncate pt-0.5 border-t border-slate-100 dark:border-slate-800/80 leading-normal">
                        {st.formNo && <span>F#{st.formNo} • </span>}
                        {st.regNo && <span>R:{st.regNo.slice(-6)} • </span>}
                        {st.examRollNo && <span>E:{st.examRollNo} • </span>}
                        <span className="text-teal-700 dark:text-teal-400 font-sans font-medium">{allSubjs}</span>
                      </p>
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
                                className="w-20 px-2 py-0 rounded-md border text-[11px] font-black h-5.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 uppercase text-center leading-none"
                              />
                              {inWords ? (
                                <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9.5px] font-black whitespace-nowrap">
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
                <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 px-3 py-2 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-700 backdrop-blur-md flex items-center justify-between gap-2 animate-in slide-in-from-bottom-3 duration-200">
                  <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-xs leading-none flex items-center gap-1 shrink-0 shadow-2xs">
                      ✓ {selectedKeys.size}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate hidden xs:inline">
                      of {displayedStudents.length} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
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
                      className="portal-compact-input !h-7 !min-h-[28px] !max-h-[28px] w-16 !text-xs font-black text-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase tracking-wide !p-0 shadow-2xs"
                      maxLength={4}
                      aria-label="Bulk fill marks for selected students"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyQuickFill('selected')}
                      disabled={!quickFillMark.trim()}
                      className={`portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] px-2.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 shrink-0 ${
                        quickFillMark.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      }`}
                      title="Apply mark to all selected students (Press Enter)"
                    >
                      <Zap size={12} className={quickFillMark.trim() ? "text-amber-300" : "text-slate-400 dark:text-slate-500"} />
                      <span>Apply ({selectedKeys.size})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedKeys(new Set())}
                      className="portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] !w-7 !min-w-[28px] p-0 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                      title="Clear selection"
                    >
                      <X size={14} />
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

          {/* Bottom Action Footer (Sticky on Mobile, Clean on Desktop) */}
          <div className="sticky bottom-2 z-20 p-2 sm:p-0 rounded-xl bg-white/95 dark:bg-slate-900/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border border-slate-200 dark:border-slate-800 sm:border-0 shadow-md sm:shadow-none flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between sm:justify-start gap-1.5 text-xs font-bold text-slate-500 px-1 sm:px-0">
              {draftSavedAt ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10.5px] font-bold">
                  <Bookmark size={12} /> Auto-saved {draftSavedAt}
                </span>
              ) : (
                <span className="text-[10.5px] text-slate-400 italic">● Draft auto-saves on change</span>
              )}
              <span className="sm:hidden text-[10.5px] font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">
                {displayedStudents.length} Students
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || studentMarks.length === 0}
                className="flex-1 sm:flex-initial px-3 py-2 sm:py-1 min-h-[40px] sm:min-h-[34px] rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Bookmark size={14} className="text-amber-500 shrink-0" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleInitiateFinalSubmit}
                disabled={saving || studentMarks.length === 0}
                className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1 min-h-[40px] sm:min-h-[34px] rounded-xl font-black text-xs text-white shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isOverwrite
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : isCrossSubject
                    ? 'bg-indigo-600 hover:bg-indigo-500 ring-1 ring-amber-400'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {saving ? <RefreshCw size={14} className="animate-spin shrink-0" /> : <Send size={14} className="shrink-0" />}
                <span>
                  {isOverwrite
                    ? 'Submit Revision'
                    : isCrossSubject
                    ? 'Submit Cross-Subject Award'
                    : 'Final Submit'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Final Submission Validation & Confirmation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border shadow-2xl space-y-3.5 sm:space-y-4 border-slate-200 dark:border-slate-800 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">Final Practical Submission Check</h3>
                  <p className="text-[10.5px] sm:text-[11px] font-bold text-slate-500 truncate">{selectedSubject} • {selectedClass} • {practicalType}</p>
                </div>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Warning Callouts for Cross-Subject or Overwrite Staging */}
            {isCrossSubject && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 min-w-0">
                  <div className="font-black flex items-center gap-1.5 flex-wrap">
                    <span>Cross-Subject Award Submission</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold uppercase">
                      Admin Approval Required
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                    Your assigned subject in school records is <strong className="text-indigo-600 dark:text-indigo-400">{teacherRegisteredSubject}</strong>, while this award list is for <strong className="text-amber-600 dark:text-amber-400">{selectedSubject}</strong>. Your submission will be staged safely as a pending request and integrated into official database records upon administrative approval.
                  </p>
                </div>
              </div>
            )}

            {isOverwrite && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="space-y-1 min-w-0">
                  <div className="font-black flex items-center gap-1.5 flex-wrap">
                    <span>Award Overwrite Warning (Zero-Loss Archive)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 font-extrabold uppercase">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                    An official award record is already integrated for <strong>{selectedSubject} ({selectedClass})</strong>, submitted by <span className="font-bold text-slate-900 dark:text-white">{existingAwardInfo?.canonical?.submittedBy || 'Faculty'}</span>. Submitting now will stage an overwrite revision. The active live record will remain intact until an administrator reviews and approves this revision, at which point the previous record will be automatically preserved in history archives.
                  </p>
                </div>
              </div>
            )}

            {/* Validation Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 sm:p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[9.5px] sm:text-[10px] font-black text-slate-400">TOTAL</div>
                <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{validationData.totalCount}</div>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-center">
                <div className="text-[9.5px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400">COMPLETE</div>
                <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">{validationData.completedCount}</div>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-center">
                <div className="text-[9.5px] sm:text-[10px] font-black text-amber-600 dark:text-amber-400">ABSENT</div>
                <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">{validationData.absentCount}</div>
              </div>
              <div className={`p-2 sm:p-2.5 rounded-xl border text-center ${validationData.incompleteCount > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                <div className="text-[9.5px] sm:text-[10px] font-black">INCOMPLETE</div>
                <div className="text-sm sm:text-base font-black">{validationData.incompleteCount}</div>
              </div>
            </div>

            {/* Incomplete Warning or Complete Banner */}
            {validationData.incompleteCount > 0 ? (
              <div className="space-y-2">
                <div className="p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black">Unentered Student Marks Found ({validationData.incompleteCount})</div>
                    <div className="text-[10.5px] sm:text-[11px] mt-0.5">Please review the incomplete student list below. You can return to edit or auto-mark unfilled entries as Absent.</div>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs space-y-1">
                  {validationData.incompleteList.map((st, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-black text-indigo-600 text-xs shrink-0">#{st.rollNo}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11.5px]">{st.name}</span>
                      </div>
                      <span className="text-[9.5px] sm:text-[10px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shrink-0">Empty Marks</span>
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
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  if (validationData.incompleteCount > 0) {
                    setShowFailOnly(true);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 cursor-pointer active:scale-98 transition-all flex items-center justify-center"
              >
                {validationData.incompleteCount > 0 ? 'Return & Edit Entries' : 'Cancel'}
              </button>

              {validationData.incompleteCount > 0 ? (
                <button
                  type="button"
                  onClick={() => executeFinalSubmit(true)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                >
                  <AlertCircle size={14} /> Submit & Auto-Mark Unfilled as Absent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => executeFinalSubmit(false)}
                  className={`w-full sm:w-auto px-5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-black text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all ${
                    isOverwrite ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {isOverwrite
                    ? 'Confirm Overwrite Revision'
                    : isCrossSubject
                    ? 'Confirm Cross-Subject Submission'
                    : 'Confirm & Lock Final Submission'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submission History Drawer/Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border shadow-xl space-y-3 border-slate-200 dark:border-slate-800 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <History className="text-indigo-600 dark:text-indigo-400 shrink-0" size={18} />
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">Assessment & Evaluation Submissions Log</h3>
                  <p className="text-[10px] text-slate-400 font-medium">All evaluations (Pre-Board, Practicals, Term End & Unit Tests)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Search Filter */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by subject, class, or test type (e.g. Physics, 11th, Pre-Board)..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            {loadingHistory ? (
              <ModernLoader
                moduleKey="practicals"
                text="Loading previous submissions…"
                subtext="Please wait."
                className="py-6"
              />
            ) : filteredSubmissions.length > 0 ? (
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {filteredSubmissions.map((item, i) => {
                  const itemId = String(item.id || item.docId || '');
                  const isPending = itemId.startsWith('pending_') || item.status === 'pending_approval';
                  const isRejected = item.status === 'rejected';

                  return (
                    <div 
                      key={`${itemId || 'eval'}_${item.className}_${item.subject}_${item.practicalType}_${i}`} 
                      className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {item.className} • {item.subject}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            {item.practicalType || 'Assessment'}
                          </span>
                          {isPending ? (
                            isRejected ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                                Revision Requested
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                Pending Approval
                              </span>
                            )
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Approved & Live
                            </span>
                          )}
                          {item.isCrossSubject && (
                            <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                              Cross-Subject
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Clock size={10} className="shrink-0" />
                          <span>{item.displayDate || (item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A')}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">• {item.recordsCount || (item.records?.length || 0)} Students</span>
                          {item.yearSuffix && (
                            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">• Session {item.yearSuffix}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClass(item.className && item.className !== 'N/A' ? item.className : '12th');
                          setSelectedSubject(item.subject && item.subject !== 'N/A' ? item.subject : 'Physics');
                          if (item.practicalType) setPracticalType(item.practicalType);
                          if (item.yearSuffix) setYearSuffix(item.yearSuffix);
                          setShowHistoryModal(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/20 cursor-pointer shrink-0 active:scale-95 transition-all"
                      >
                        Load Record
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs font-bold text-slate-400">
                {historySearch ? 'No matching submissions found for this search.' : 'No past evaluation submission records found.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cross-Subject Switch Warning Modal */}
      {crossSubjectSwitchModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-amber-300 dark:border-amber-700/60 shadow-2xl space-y-3.5 sm:space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Cross-Subject Award Submission
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  You are registered under <strong className="text-indigo-600 dark:text-indigo-400">{teacherRegisteredSubject}</strong>, but you are switching to enter awards for <strong className="text-amber-600 dark:text-amber-400">{crossSubjectSwitchModal.targetSubject}</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] sm:text-[11.5px] text-amber-900 dark:text-amber-200 space-y-1 leading-relaxed">
              <div className="font-extrabold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <ShieldAlert size={14} className="shrink-0" />
                Administrative Approval Required
              </div>
              <div>
                You are permitted to submit this award list, but it will be submitted in <strong>Cross-Subject Staging Mode</strong> and will require review and approval from the administrator before final integration into the school database.
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCrossSubjectSwitchModal({ isOpen: false, targetSubject: '' })}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer active:scale-98 transition-all flex items-center justify-center"
              >
                Cancel & Keep {teacherRegisteredSubject}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject(crossSubjectSwitchModal.targetSubject);
                  setCrossSubjectSwitchModal({ isOpen: false, targetSubject: '' });
                }}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all"
              >
                Continue to {crossSubjectSwitchModal.targetSubject}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom High-Quality Confirmation Modal (replaces browser confirm) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
      />

      {/* High-Tech Fullscreen Loading Screen for Saving Draft / Submitting */}
      {saving && (
        <ModernLoader
          moduleKey="practicals"
          title="Govt. Higher Secondary School Shangus"
          badge={savingAction === 'draft' ? 'Cloud Draft Sync' : 'Official Submission'}
          text={savingAction === 'draft' ? 'Saving Draft to Database...' : 'Submitting Practical Award List...'}
          subtext={
            savingAction === 'draft'
              ? `Preserving entered scores and syncing ${selectedSubject} (${selectedClass}) records…`
              : `Auto-marking unfilled entries as Absent and staging ${selectedSubject} (${selectedClass}) for Administrator approval…`
          }
          fullScreen={true}
          inverted={true}
        />
      )}

      {/* Universal Message / Error / Success Popup Modal */}
      {popupModal && popupModal.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
          onClick={() => {
            if (popupModal.onClose) popupModal.onClose();
            setPopupModal(null);
          }}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-3 sm:space-y-4 relative text-center animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                if (popupModal.onClose) popupModal.onClose();
                setPopupModal(null);
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Close"
            >
              <X size={18} />
            </button>

            {/* Status Icon with glow */}
            <div className="flex justify-center pt-1 sm:pt-2">
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md relative ${
                popupModal.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : popupModal.type === 'error'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : popupModal.type === 'warning'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
              }`}>
                {popupModal.type === 'success' ? (
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 animate-in zoom-in duration-300" />
                ) : popupModal.type === 'error' ? (
                  <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 animate-in zoom-in duration-300" />
                ) : popupModal.type === 'warning' ? (
                  <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 animate-in zoom-in duration-300" />
                ) : (
                  <Info className="w-7 h-7 sm:w-8 sm:h-8 animate-in zoom-in duration-300" />
                )}
              </div>
            </div>

            {/* Badge & Title */}
            <div className="space-y-1">
              {popupModal.badge && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider mb-1" style={{
                  backgroundColor: popupModal.type === 'success' ? 'rgba(16, 185, 129, 0.12)' :
                                   popupModal.type === 'error' ? 'rgba(244, 63, 94, 0.12)' :
                                   popupModal.type === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                  color: popupModal.type === 'success' ? '#059669' :
                         popupModal.type === 'error' ? '#e11d48' :
                         popupModal.type === 'warning' ? '#d97706' : '#4f46e5'
                }}>
                  {popupModal.badge}
                </div>
              )}
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug px-2">
                {popupModal.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm mx-auto px-1">
                {popupModal.message}
              </p>
            </div>

            {/* Details Box if provided */}
            {Array.isArray(popupModal.details) && popupModal.details.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-800 text-left space-y-1 text-xs">
                {popupModal.details.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium text-[10.5px] sm:text-[11px] shrink-0">{item.label}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] sm:text-[11.5px] text-right truncate min-w-0 flex-1">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center gap-2">
              {popupModal.secondaryButtonText && (
                <button
                  type="button"
                  onClick={() => {
                    if (popupModal.onSecondaryClick) popupModal.onSecondaryClick();
                    setPopupModal(null);
                  }}
                  className="w-full sm:flex-1 py-2.5 sm:py-2 px-3 sm:px-4 min-h-[42px] sm:min-h-[38px] rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center"
                >
                  {popupModal.secondaryButtonText}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (popupModal.onPrimaryClick) popupModal.onPrimaryClick();
                  setPopupModal(null);
                }}
                className={`w-full sm:flex-1 py-2.5 sm:py-2 px-3 sm:px-4 min-h-[42px] sm:min-h-[38px] rounded-xl text-xs font-black text-white shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center ${
                  popupModal.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : popupModal.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {popupModal.primaryButtonText || 'Understood'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
