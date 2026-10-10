import { saveAcademicRecord } from '../../services/academicRecordService';
import { saveVersionToBin, archiveSupersededPendingSubmission } from '../../services/practicalsBinService';
import { logTeacherActivity } from '../../services/adminActivityLogger';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, RefreshCw, AlertCircle, 
  CheckCircle2, Printer, ShieldCheck, History, Clock, Search,
  Bookmark, Send, ChevronDown, ChevronRight, Check, SlidersHorizontal, Zap, X, Info, Sparkles, Award,
  AlertTriangle, ShieldAlert, Lock, Unlock, UserCheck, ClipboardCheck, FileText
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, addDoc, doc, getDoc, onSnapshot, query, where, limit } from 'firebase/firestore';
import { getCurrentAcademicSession, invalidateCollectionCache, getMasterRegistersScoped, getAdmissionsBySession } from '../../services/dbCache';
import { printIndividualAwardRoll, printMarksRecordAwardRoll, printAttendanceSheet, printHistoricalSubmission, isSubmissionOwnedByTeacher, sortRecordsForAwardRoll, getRecordExamRoll, getCurrentOfficialExamRoll, isValidExamRollForClass } from '../../utils/practicalsPdfGenerator';
import { loadSiteSettings } from '../../utils/settingsLoader';
import { getAssignedClassRollNumber, isLikelyOfficialExamRollNumber, isStudentExamDropped } from '../../utils/studentApprovalStatus';
import { checkIsStudentDropped } from '../../services/examineeDropService';
import {
  getSubjectMarksConfig,
  getAdminPracticalsSettings,
  getPracticalEvaluationTypes,
  isPracticalEvaluationType,
  isClassPracticalSubmissionEnabled,
  getSubjectOverride,
  SUBJECT_CONFIG_DEFS,
  isTeacherSubjectMatch,
  normalizeSubjectIdentity,
  formatPracticalDocId,
  getTeacherAssignedSubjectsForClass,
  getTeacherClassSubjectPermissions,
  normalizeTeacherClasses,
  isMatchingSubjectCode
} from '../../utils/practicalsSettingsManager';
import ModernLoader from '../../components/ModernLoader';

// Comprehensive JKBOSE Subject List mapped for Teacher Evaluation Portal
export const SUBJECT_MAP = SUBJECT_CONFIG_DEFS.map(s => ({
  name: s.name,
  code: s.code,
  defaultMax: 20
}));

// Authoritative 7 Core Subjects for Secondary Classes (9th & 10th)
export const SECONDARY_7_SUBJECTS = [
  { code: 'EN', name: 'English', defaultMax: 50 },
  { code: 'MA', name: 'Mathematics', defaultMax: 50 },
  { code: 'SC', name: 'Science', defaultMax: 50 },
  { code: 'SS', name: 'Social Studies', defaultMax: 50 },
  { code: 'UR', name: 'Urdu', defaultMax: 50 },
  { code: 'HTC', name: 'Healthcare', defaultMax: 50 },
  { code: 'ITE', name: 'IT and ITES', defaultMax: 50 },
];

// Authoritative Core/Elective Subjects for Higher Secondary Classes (11th & 12th)
export const HIGHER_SECONDARY_15_SUBJECTS = [
  { code: 'EN', name: 'General English', defaultMax: 20 },
  { code: 'PH', name: 'Physics', defaultMax: 20 },
  { code: 'CH', name: 'Chemistry', defaultMax: 20 },
  { code: 'BO', name: 'Botany', defaultMax: 20 },
  { code: 'ZO', name: 'Zoology', defaultMax: 20 },
  { code: 'BI', name: 'Biology', defaultMax: 20 },
  { code: 'MA', name: 'Mathematics', defaultMax: 20 },
  { code: 'ES', name: 'Environmental Science', defaultMax: 20 },
  { code: 'PS', name: 'Political Science', defaultMax: 20 },
  { code: 'HT', name: 'History', defaultMax: 20 },
  { code: 'EC', name: 'Economics', defaultMax: 20 },
  { code: 'ED', name: 'Education', defaultMax: 20 },
  { code: 'UR', name: 'Urdu', defaultMax: 20 },
  { code: 'PD', name: 'Physical Education', defaultMax: 20 },
  { code: 'HTC', name: 'Healthcare', defaultMax: 20 },
  { code: 'ITE', name: 'IT and ITES', defaultMax: 20 },
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

// Compact clean date formatter for evaluation history records
const formatSubmissionDate = (updatedAt, displayDate) => {
  const rawTime = updatedAt || displayDate;
  if (!rawTime) return 'N/A';
  try {
    let d = null;
    if (typeof rawTime?.toDate === 'function') {
      d = rawTime.toDate();
    } else if (rawTime?.seconds) {
      d = new Date(rawTime.seconds * 1000);
    } else if (rawTime instanceof Date) {
      d = rawTime;
    } else {
      d = new Date(rawTime);
    }

    if (d && !isNaN(d.getTime())) {
      const dPart = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const tPart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${dPart}, ${tPart}`;
    }
    return String(displayDate || updatedAt || 'N/A');
  } catch {
    return String(displayDate || updatedAt || 'N/A');
  }
};

export const extractRawAdmNo = (rec) => {
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
export function isClassMatch(stClass, targetClass) {
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
export function getSessionEndYear(sessionStr) {
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
export function isSessionMatch(stSession, targetYearSuffix) {
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
export function isSubjectOrStreamMatch(st, targetSubjectCode, targetSubjectName, targetClass = '') {
  if (!targetSubjectCode && !targetSubjectName) return true;

  const codeUpper = String(targetSubjectCode || '').toUpperCase().trim();
  const nameUpper = String(targetSubjectName || '').toUpperCase().trim();

  // 1. General English is COMPULSORY for 100% of students in 9th, 10th, 11th & 12th!
  if (codeUpper === 'EN' || nameUpper.includes('ENGLISH')) return true;

  const resolvedClass = String(targetClass || extractStudentClass(st) || st?.Class || st?.class || '').trim();
  const clsNorm = resolvedClass.toLowerCase();
  const is12 = clsNorm.includes('12') || clsNorm.includes('xii');
  const is11 = clsNorm.includes('11') || clsNorm.includes('xi');
  const is10 = clsNorm.includes('10') || clsNorm.includes('x');
  const is9 = clsNorm.includes('9') || clsNorm.includes('ix');
  const isSecondary = is9 || is10;

  const vocSubs = [
    st['Vocational Subject'],
    st['vocationalSubject'],
    st['Vocational'],
    st['vocational'],
    st['Vocational Trade'],
    st['Trade'],
    st['Vocational Elective'],
    st['Vocational Sub'],
    st['Vocational Course'],
    st['NSQF Subject'],
    st['nsqfSubject'],
    st['Optional Subject'],
    st['Elective'],
    st['6th Subject'],
    st['Additional Subject'],
    st['6th_Subject']
  ].filter(Boolean).join(' ');

  const SAME_AS_11_RE = /same\s+as\s+(in\s+)?class\s*(11|eleventh)/i;
  const isInvalidPlaceholder = val => !val || SAME_AS_11_RE.test(String(val)) || String(val).trim() === '—';

  let primarySubjStr = '';
  if (is12) {
    const cand12 = st['Subjects to be taken in Class 12th'] || st['Stream & Subjects for Class 12th'] || st['Subjects in Class 12th'];
    if (cand12 && !isInvalidPlaceholder(cand12)) {
      primarySubjStr = Array.isArray(cand12) ? cand12.join(', ') : String(cand12);
    }
  } else if (is11) {
    const cand11 = st['Subjects to be taken in Class 11th'] || st['Subjects in Class 11th'] || st['Subjects Studied in Class 11th'];
    if (cand11 && !isInvalidPlaceholder(cand11)) {
      primarySubjStr = Array.isArray(cand11) ? cand11.join(', ') : String(cand11);
    }
  } else if (is10) {
    const cand10 = st['Subjects to be taken in Class 10th'] || st['Subjects in Class 10th'] || st['Subjects Studied in Class 9th'];
    if (cand10 && !isInvalidPlaceholder(cand10)) {
      primarySubjStr = Array.isArray(cand10) ? cand10.join(', ') : String(cand10);
    }
  } else if (is9) {
    const cand9 = st['Subjects to be taken in Class 9th'] || st['Subjects in Class 9th'];
    if (cand9 && !isInvalidPlaceholder(cand9)) {
      primarySubjStr = Array.isArray(cand9) ? cand9.join(', ') : String(cand9);
    }
  }

  const rawSubjStr = String(
    [
      primarySubjStr || extractRawSubjectsString(st, resolvedClass) || st.rawSubjects || st._rawSubjects || (isSecondary ? null : st['Subs']) || (isSecondary ? null : st.subs) || '',
      vocSubs
    ].filter(Boolean).join(', ')
  ).toUpperCase();

  const streamStr = String(
    st.stream ||
    st.Stream ||
    (is12 ? (st['Stream for Class 12th'] || st['Stream Studied in Class 11th'] || st['Stream for Class 11th']) : (st['Stream for Class 11th'] || st['Stream opted in Class 11th'])) ||
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

  // Secondary School Subjects (Class 9th & 10th Core & Vocational)
  if (isSecondary) {
    if (codeUpper === 'SC' || nameUpper === 'SCIENCE') return true;
    if (codeUpper === 'SS' || nameUpper === 'SOCIAL SCIENCE' || nameUpper === 'SOCIAL STUDIES' || nameUpper === 'SST') return true;
    if (codeUpper === 'MA' || nameUpper.includes('MATH')) return true;
    if (codeUpper === 'UR' || nameUpper.includes('URDU')) {
      if (hasToken('HN') || /\bHINDI\b/i.test(rawSubjStr)) {
        return hasToken('UR') || /\bURDU\b/i.test(rawSubjStr);
      }
      return true;
    }
    if (codeUpper === 'HN' || nameUpper.includes('HINDI')) {
      return hasToken('HN') || /\bHINDI\b/i.test(rawSubjStr);
    }
    if (codeUpper === 'ITE' || codeUpper === 'IT' || codeUpper === 'ITES' || nameUpper.includes('IT & ITES') || nameUpper.includes('IT AND ITES') || nameUpper.includes('INFORMATION TECH')) {
      return hasToken('ITE') || hasToken('IT') || hasToken('ITES') ||
        /\b(IT\s*AND\s*ITES|IT\s*&\s*ITES|IT-ITES|INFORMATION\s*TECHNOLOGY|INFO\s*TECH|VOCATIONAL\s*IT)\b/i.test(rawSubjStr) ||
        /it|ites|info/i.test(vocSubs);
    }
    if (codeUpper === 'HTC' || codeUpper === 'HC' || nameUpper.includes('HEALTHCARE') || nameUpper.includes('HEALTH CARE') || nameUpper.includes('HEALTH')) {
      return hasToken('HTC') || hasToken('HC') ||
        /\b(HEALTHCARE|HEALTH\s*CARE|HEALTH)\b/i.test(rawSubjStr) ||
        /health/i.test(vocSubs);
    }
    // Secondary students NEVER take Higher Secondary subjects
    return false;
  }

  // 2. Physics & Chemistry
  const hasMedicalSubs = hasToken('BI') || hasToken('BO') || hasToken('ZO') || hasToken('BIO') || /\b(BIOLOGY|BOTANY|ZOOLOGY)\b/i.test(rawSubjStr);
  const isScienceStudent = isScienceStrict || hasMedicalSubs;

  if (codeUpper === 'PH' || nameUpper === 'PHYSICS') {
    if (hasToken('PH') || /\bPHYSICS\b/i.test(rawSubjStr)) return true;
    if (isScienceStudent) return true;
    return false;
  }
  if (codeUpper === 'CH' || nameUpper === 'CHEMISTRY') {
    if (hasToken('CH') || /\bCHEMISTRY\b/i.test(rawSubjStr)) return true;
    if (isScienceStudent) return true;
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
  if (codeUpper === 'PD' || codeUpper === 'PHE' || codeUpper === 'PE' || nameUpper.includes('PHYSICAL')) {
    if (hasToken('PD') || hasToken('PHE') || hasToken('PE') || /\b(PHYSICAL\s*EDUCATION|PHYSICAL\s*ED|PHYSICAL|PHY\s*ED|P\.E\.)\b/i.test(rawSubjStr)) return true;
    return false;
  }

  // 7. Vocational & Applied Practicals
  if (codeUpper === 'ITE' || codeUpper === 'IT' || codeUpper === 'ITES' || nameUpper.includes('IT & ITES') || nameUpper.includes('IT AND ITES') || nameUpper.includes('INFORMATION TECH')) {
    if (
      hasToken('ITE') || hasToken('IT') || hasToken('ITES') ||
      /\b(IT\s*AND\s*ITES|IT\s*&\s*ITES|IT-ITES|INFORMATION\s*TECHNOLOGY|INFO\s*TECH|COMPUTER|VOCATIONAL\s*IT)\b/i.test(rawSubjStr) ||
      /it|ites|info/i.test(vocSubs)
    ) return true;
    return false;
  }
  if (codeUpper === 'HTC' || codeUpper === 'HC' || nameUpper.includes('HEALTHCARE') || nameUpper.includes('HEALTH CARE') || nameUpper.includes('HEALTH')) {
    if (
      hasToken('HTC') || hasToken('HC') ||
      /\b(HEALTHCARE|HEALTH\s*CARE|HEALTH)\b/i.test(rawSubjStr) ||
      /health/i.test(vocSubs)
    ) return true;
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
export function extractStudentClass(st) {
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

// Helper: Extract student roll number robustly for practical award rolls
// Supports authoritative class rolls, direct class rolls, serial numbers, roll numbers, and board/exam rolls
export function getPracticalsStudentRoll(st) {
  if (!st || typeof st !== 'object') return '';
  // 1. Authoritative assigned class roll from admissions
  const assigned = getAssignedClassRollNumber(st);
  if (assigned) return String(assigned).trim();

  // 2. Direct class roll properties
  const raw = st.raw || st._rawStudent || st;
  const directRoll = st.classRollNo || raw.classRollNo || st['Class Roll No'] || raw['Class Roll No'] ||
                     st['Class Roll No.'] || raw['Class Roll No.'] || st['Class R.No.'] || raw['Class R.No.'] ||
                     st['Class R. No.'] || raw['Class R. No.'] || st.crNo || raw.crNo;
  if (directRoll && !/^(?:0|n\/?a|na|none|nil|null|undefined|—|-)$/i.test(String(directRoll).trim())) {
    return String(directRoll).trim();
  }

  // 3. Serial number / S.No. from master registers or imports
  const serialNo = st['S.No.'] || raw['S.No.'] || st.sNo || raw.sNo || st.serialNo || raw.serialNo;
  if (serialNo && !/^(?:0|n\/?a|na|none|nil|null|undefined|—|-)$/i.test(String(serialNo).trim())) {
    return String(serialNo).trim();
  }

  // 4. Fallback: Any roll / rollNo / rNo field
  const rollVal = st.rollNo || raw.rollNo || st['Roll No.'] || raw['Roll No.'] ||
                  st['Roll No'] || raw['Roll No'] || st.roll || raw.roll || st.rNo || raw.rNo;
  if (rollVal && !/^(?:0|n\/?a|na|none|nil|null|undefined|—|-)$/i.test(String(rollVal).trim())) {
    return String(rollVal).trim();
  }

  // 5. Board / Exam Roll No (authoritative for 10th/11th/12th examinees)
  const examVal = st.boardRoll || raw.boardRoll || st.boardRollNo || raw.boardRollNo ||
                  st.examRollNo || raw.examRollNo || st.currExamRoll || raw.currExamRoll ||
                  st['Exam R.No. (Current)'] || raw['Exam R.No. (Current)'] ||
                  st['Exam R.No.'] || raw['Exam R.No.'];
  if (examVal && !/^(?:0|n\/?a|na|none|nil|null|undefined|—|-)$/i.test(String(examVal).trim())) {
    return String(examVal).trim();
  }

  return '';
}

// Helper: Check if student has assigned Class Roll No or valid examinee credential
export function hasAssignedClassRoll(st) {
  if (!st || typeof st !== 'object') return false;
  if (getAssignedClassRollNumber(st)) return true;
  if (getPracticalsStudentRoll(st)) return true;
  const raw = st.raw || st._rawStudent || st;
  const bRoll = st.boardRoll || raw.boardRoll || st.boardRollNo || raw.boardRollNo || st.examRollNo || raw.examRollNo || st.currExamRoll || raw.currExamRoll || st['Exam R.No. (Current)'] || raw['Exam R.No. (Current)'];
  if (bRoll && !/^(?:0|n\/?a|na|none|nil|null|undefined|—|-)$/i.test(String(bRoll).trim())) return true;
  const reg = st.regNo || raw.regNo || st.boardRegNo || raw.boardRegNo || st.registrationNo || raw.registrationNo || st['Board Reg. No.'] || raw['Board Reg. No.'] || st.formNo || raw.formNo || st['Form No.'] || raw['Form No.'];
  if (reg && !/^(?:0|n\/?a|na|none|nil|null|undefined|—|-)$/i.test(String(reg).trim())) return true;
  if ((st.practicalMarks !== undefined || st.totalMarks !== undefined || st.isHistorical) && (st.name || st.studentName || raw.name || raw.studentName)) return true;
  return false;
}

// Helper: Extract Student Name from any potential schema key
export function getStudentName(st) {
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
export function getRegNo(st) {
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
    const parts = newReg.split(/[/,;]+/).map(p => p.trim()).filter(p => p.replace(/[^A-Za-z0-9]/g, '').length >= 8 && !/^(N\/A|#N\/A|—|-)$/i.test(p));
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
export function getExamRoll(st, selectedClass) {
  if (!st) return '';
  return getCurrentOfficialExamRoll(st, selectedClass);
}

// Helper: Extract Student Subjects across all schemas
export function extractRawSubjectsString(rec, targetClass = '') {
  if (!rec) return '';

  const cls = String(targetClass || rec['Class'] || rec['class'] || rec['className'] || rec['Admission sought for class'] || '').trim();
  const isSecondary = cls.includes('9') || cls.includes('10');
  const is12 = cls.includes('12');
  const is11 = cls.includes('11');
  const is10 = cls.includes('10');
  const is9 = cls.includes('9');

  const SAME_AS_11_RE = /same\s+as\s+(in\s+)?class\s*(11|eleventh)/i;
  const isInvalidPlaceholder = val => !val || SAME_AS_11_RE.test(String(val)) || String(val).trim() === '—';

  const candidates = [
    is12 ? rec['Subjects to be taken in Class 12th'] : null,
    is12 ? rec['Stream & Subjects for Class 12th'] : null,
    is10 ? (rec['Subjects to be taken in Class 10th'] || rec['Subjects in Class 10th']) : null,
    is9 ? (rec['Subjects to be taken in Class 9th'] || rec['Subjects in Class 9th']) : null,
    is11 ? (rec['Subjects to be taken in Class 11th'] || rec['Subjects in Class 11th']) : null,
    rec['Subjects Studied in Class 11th'],
    rec['Subjects to be taken in Class 11th'],
    rec['selectedSubjects'],
    rec['Subjects Studied in Class 9th'],
    rec['Subjects Studied in Class 8th'],
    rec['Subjects to be taken in Class 10th'],
    rec['Subjects to be taken in Class 9th'],
    rec['Subject Combination'],
    rec['Subjects Opted'],
    rec['Elective Subjects'],
    rec['Subs'],
    rec['subs'],
    rec['Subjects'],
    rec['subjects'],
    rec['subjectCombination']
  ];

  let subjectArrayOrStr = null;
  for (const c of candidates) {
    if (c) {
      if (Array.isArray(c) && c.length > 0) {
        const cleanArr = c.filter(item => !isInvalidPlaceholder(item));
        if (cleanArr.length > 0) {
          subjectArrayOrStr = cleanArr;
          break;
        }
      } else if (typeof c === 'string' && !isInvalidPlaceholder(c)) {
        subjectArrayOrStr = c.trim();
        break;
      }
    }
  }

  let extracted = '';
  if (Array.isArray(subjectArrayOrStr) && subjectArrayOrStr.length > 0) {
    const cleaned = subjectArrayOrStr.filter(s => s && String(s).trim() !== '—').map(s => String(s).trim());
    if (cleaned.length > 0) extracted = cleaned.join(', ');
  } else if (typeof subjectArrayOrStr === 'string' && subjectArrayOrStr.trim() && subjectArrayOrStr.trim() !== '—') {
    extracted = subjectArrayOrStr.trim();
  } else {
    // 2. Next check Subjects1..Subjects6 columns from masterRegisters
    const subjList = [];
    const subjKeys = [
      'Subjects1', 'Subjects2', 'Subjects3', 'Subjects4', 'Subjects5', 'Subjects6', 'Subject6',
      'subject1', 'subject2', 'subject3', 'subject4', 'subject5', 'subject6'
    ];

    subjKeys.forEach(k => {
      const val = rec[k];
      if (val && typeof val === 'string' && !isInvalidPlaceholder(val) && !subjList.includes(val.trim())) {
        subjList.push(val.trim());
      }
    });

    if (subjList.length > 0) {
      extracted = subjList.join(', ');
    } else {
      // 3. Fallback to single subject fields
      const fallback = rec['subjects'] || rec['Subject'] || rec['subject'];
      if (fallback && String(fallback).trim() && !isInvalidPlaceholder(fallback)) {
        extracted = String(fallback).trim();
      }
    }
  }

  // Secondary Class Intelligence:
  if (isSecondary) {
    if (!extracted || ['science', 'arts', 'commerce', 'humanities', 'medical', 'general'].includes(extracted.toLowerCase())) {
      extracted = 'English, Mathematics, Science, Social Studies, Urdu';
    } else {
      const hasLang = /\b(urdu|ur|hindi|hn)\b/i.test(extracted);
      if (!hasLang) {
        extracted = `${extracted}, Urdu`;
      }
    }
  }

  return extracted;
}

// Helper: Mandatory Abbreviate Subject Combinations with Stream Code (S = Science, H = Humanities, G = General)
export function getAbbreviatedSubjects(st, targetClass = '') {
  if (!st) return '';

  const clsRaw = String(
    targetClass ||
    st['Class'] ||
    st['class'] ||
    st['className'] ||
    st['Admission sought for class'] ||
    ''
  ).toLowerCase();
  const isSecondary = clsRaw.includes('9') || clsRaw.includes('10');

  // Extract Stream (Strictly for Higher Secondary 11th & 12th; Secondary has NO streams)
  let streamCode = '';
  if (!isSecondary) {
    const streamRaw = String(
      st['Stream for Class 11th'] ||
      st['Stream opted in Class 11th'] ||
      st['Stream for Class 12th'] ||
      st['Stream'] ||
      st.stream ||
      ''
    ).trim();

    if (streamRaw.toLowerCase().includes('science') || streamRaw.toLowerCase().includes('med')) {
      streamCode = 'S';
    } else if (streamRaw.toLowerCase().includes('arts') || streamRaw.toLowerCase().includes('humanities')) {
      streamCode = 'H';
    } else if (streamRaw.toLowerCase().includes('commerce') || streamRaw.toLowerCase().includes('general')) {
      streamCode = 'G';
    }
  }

  // Extract Raw Subjects
  const subjRaw = extractRawSubjectsString(st, targetClass);
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
      .replace(/IT And ITES|IT\s*&\s*ITES|IT\s+ITES/gi, 'ITE')
      .replace(/Social Studies|Social Science|SST/gi, 'SS')
      .replace(/Mathematics|Maths/gi, 'MA')
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
      .replace(/Urdu/gi, 'UR')
      .replace(/\bHindi\b/gi, 'HN')
      .replace(/\bScience\b/gi, 'SC')
      .replace(/\bEnglish\b/gi, 'EN');
  }

  if (isSecondary) {
    // Canonical Secondary Ordering & Language Guarantee (EN, MA, SC, SS, UR, optional HTC/ITE)
    const tokens = subjectsStr.split(/[\s,]+/).filter(Boolean).map(t => t.toUpperCase());
    const tokenSet = new Set(tokens);

    // In JKBOSE, all 9th and 10th students take Urdu unless Hindi is taken
    if (!tokenSet.has('UR') && !tokenSet.has('HN')) {
      tokenSet.add('UR');
    }

    const secondaryOrder = ['EN', 'MA', 'SC', 'SS', 'UR', 'HTC', 'ITE', 'HN'];
    const ordered = [];
    secondaryOrder.forEach(code => {
      if (tokenSet.has(code)) {
        ordered.push(code);
        tokenSet.delete(code);
      }
    });
    // Append any extra subjects
    tokenSet.forEach(code => ordered.push(code));

    subjectsStr = ordered.length > 0 ? ordered.join(', ') : 'EN, MA, SC, SS, UR';
    streamCode = ''; // Secondary students NEVER have stream code
  } else {
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

    if (streamCode === 'S') {
      const artsOnly = new Set(['ED', 'HT', 'PS', 'SO', 'AR', 'PR', 'SC']);
      const tokens = subjectsStr.split(/[\s,]+/).filter(t => !artsOnly.has(t.toUpperCase()));
      subjectsStr = tokens.join(', ');
    }
  }

  return streamCode ? `${subjectsStr} (${streamCode})` : subjectsStr;
}

// Helper: Convert numbers to words
export function numberToWords(numStr) {
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
export function renderSubjectsWithHighlight(subjectsStr, currentSubjObj) {
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
function isSubjectMatch(student, targetSubjectCode, targetClass = '') {
  if (!targetSubjectCode) return true;

  const targetObj = SUBJECT_MAP.find(s => s.code === targetSubjectCode || s.name.toLowerCase() === targetSubjectCode.toLowerCase());
  const code = targetObj ? targetObj.code : targetSubjectCode;
  const name = targetObj ? targetObj.name : targetSubjectCode;

  return isSubjectOrStreamMatch(student, code, name, targetClass);
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
  teacherAssignedSubjects = [],
  allTeacherSubjects = [],
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

  // Check if a subject is assigned to this teacher (either for this class, across classes, or via registered string)
  const checkIsSubjectAssigned = (subName) => {
    if (!subName) return false;
    if (Array.isArray(teacherAssignedSubjects) && teacherAssignedSubjects.length > 0) {
      if (teacherAssignedSubjects.some(s => isTeacherSubjectMatch(s, subName))) return true;
    }
    if (Array.isArray(allTeacherSubjects) && allTeacherSubjects.length > 0) {
      if (allTeacherSubjects.some(s => isTeacherSubjectMatch(s, subName))) return true;
    }
    if (teacherRegisteredSubject && isTeacherSubjectMatch(teacherRegisteredSubject, subName)) {
      return true;
    }
    return false;
  };

  const hasAnyAssigned = (Array.isArray(teacherAssignedSubjects) && teacherAssignedSubjects.length > 0) ||
    (Array.isArray(allTeacherSubjects) && allTeacherSubjects.length > 0) ||
    Boolean(teacherRegisteredSubject);

  const isCurrentlyCrossSubject = Boolean(hasAnyAssigned && !checkIsSubjectAssigned(selectedSubject));

  const handleSelect = (subName) => {
    const isAssigned = checkIsSubjectAssigned(subName);
    if (hasAnyAssigned && !isAssigned) {
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
          {checkIsSubjectAssigned(selectedItem.name) && (
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
              const isTeacherAssigned = checkIsSubjectAssigned(s.name);

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

const CURRENT_SESSION = getCurrentAcademicSession();

export default function PracticalsPage() {
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const user = outletContext.user || null;

  const [practicalsSettings, setPracticalsSettings] = useState(null);
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(true);

  // Resolve all teacher's officially assigned teaching subjects (supporting multiple subjects and explicit admin permissions)
  const allTeacherAssignedSubjects = useMemo(() => {
    let base = [];
    if (Array.isArray(user?.assignedSubjects) && user.assignedSubjects.length > 0) {
      base = [...user.assignedSubjects];
    } else {
      const rawSubj = user?.subject || user?.teachingSubject || '';
      if (rawSubj) {
        base = String(rawSubj).split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Merge subjects explicitly authorized for this teacher in practicalsSettings.permissions
    const uEmail = String(user?.email || auth.currentUser?.email || '').toLowerCase().trim();
    if (uEmail && practicalsSettings && Array.isArray(practicalsSettings.permissions)) {
      practicalsSettings.permissions.forEach(p => {
        if (String(p?.email || '').toLowerCase().trim() === uEmail) {
          const rawSub = p.subject || p.subjectCode;
          if (rawSub) {
            const norm = normalizeSubjectIdentity(rawSub);
            const subName = norm ? norm.name : rawSub;
            if (subName && !base.some(s => isTeacherSubjectMatch(s, subName))) {
              base.push(subName);
            }
          }
        }
      });
    }

    return base;
  }, [user?.assignedSubjects, user?.subject, user?.teachingSubject, user?.email, practicalsSettings]);

  // Overall teacher registered subject label
  const teacherRegisteredSubject = useMemo(() => {
    if (allTeacherAssignedSubjects.length > 0) {
      return allTeacherAssignedSubjects.join(', ');
    }
    const rawSubj = user?.subject || user?.teachingSubject || '';
    if (!rawSubj) return '';
    const norm = normalizeSubjectIdentity(rawSubj);
    return norm ? norm.name : String(rawSubj).trim();
  }, [allTeacherAssignedSubjects, user?.subject, user?.teachingSubject]);

  // Resolve teacher's officially assigned teaching classes (normalized and deduplicated)
  const teacherAssignedClasses = useMemo(() => {
    const list = Array.isArray(user?.assignedClasses) && user.assignedClasses.length > 0
      ? [...user.assignedClasses]
      : [];
    const uEmail = String(user?.email || auth.currentUser?.email || '').toLowerCase().trim();
    if (uEmail && practicalsSettings && Array.isArray(practicalsSettings.permissions)) {
      practicalsSettings.permissions.forEach(p => {
        if (String(p?.email || '').toLowerCase().trim() === uEmail) {
          const c = p.className || p.class;
          if (c) list.push(c);
        }
      });
    }
    return normalizeTeacherClasses(list);
  }, [user?.assignedClasses, user?.email, practicalsSettings]);

  // Initial class defaulting: location state > first assigned class > '11th'
  const initialClass = useMemo(() => {
    const raw = location.state?.selectedClass || (teacherAssignedClasses.length > 0 ? teacherAssignedClasses[0] : '11th');
    const s = String(raw || '');
    return s.includes('11') ? '11th' : (s.includes('12') ? '12th' : (s.includes('10') ? '10th' : (s.includes('9') ? '9th' : '11th')));
  }, [location.state?.selectedClass, teacherAssignedClasses]);

  // Initial subject defaulting: if navigated from history with state, use that;
  // otherwise, default to the teacher's class-specific assigned subject, then first assigned subject, fallback to Physics.
  const initialSubject = useMemo(() => {
    if (location.state?.selectedSubject) return location.state.selectedSubject;
    const isSecondary = initialClass === '9th' || initialClass === '10th';
    const targetList = isSecondary ? SECONDARY_7_SUBJECTS : HIGHER_SECONDARY_15_SUBJECTS;

    // Check class-specific assigned subjects first (Exact Code Match prioritized!)
    const classAssigned = getTeacherAssignedSubjectsForClass(user, initialClass);
    if (classAssigned && classAssigned.length > 0) {
      for (const s of classAssigned) {
        const sNorm = normalizeSubjectIdentity(s);
        const exactMatch = targetList.find(m => {
          const mNorm = normalizeSubjectIdentity(m.code || m.name);
          return mNorm && sNorm && mNorm.code === sNorm.code;
        });
        if (exactMatch) return exactMatch.name;

        const match = targetList.find(m => isTeacherSubjectMatch(s, m.name) || isTeacherSubjectMatch(s, m.code));
        if (match) return match.name;
      }
    }

    if (allTeacherAssignedSubjects.length > 0) {
      for (const s of allTeacherAssignedSubjects) {
        const sNorm = normalizeSubjectIdentity(s);
        const exactMatch = targetList.find(m => {
          const mNorm = normalizeSubjectIdentity(m.code || m.name);
          return mNorm && sNorm && mNorm.code === sNorm.code;
        });
        if (exactMatch) return exactMatch.name;

        const match = targetList.find(m => isTeacherSubjectMatch(s, m.name) || isTeacherSubjectMatch(s, m.code));
        if (match) return match.name;
      }
    }
    if (teacherRegisteredSubject) {
      const regNorm = normalizeSubjectIdentity(teacherRegisteredSubject);
      const exactMatch = targetList.find(m => {
        const mNorm = normalizeSubjectIdentity(m.code || m.name);
        return mNorm && regNorm && mNorm.code === regNorm.code;
      });
      if (exactMatch) return exactMatch.name;

      const match = targetList.find(s => isTeacherSubjectMatch(teacherRegisteredSubject, s.name));
      if (match) return match.name;
    }
    return targetList[0].name;
  }, [location.state?.selectedSubject, initialClass, user, allTeacherAssignedSubjects, teacherRegisteredSubject]);

  // Filter States
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const userHasSelectedClassRef = useRef(false);
  const initialClassAssignedRef = useRef(Boolean(location.state?.selectedClass));

  const handleClassChange = useCallback((newCls) => {
    userHasSelectedClassRef.current = true;
    setSelectedClass(newCls);
  }, []);

  const isSubmissionOpenForCurrentClass = useMemo(() => {
    return isSubmissionOpen && isClassPracticalSubmissionEnabled(practicalsSettings, selectedClass);
  }, [isSubmissionOpen, practicalsSettings, selectedClass]);

  // Class-specific assigned subjects for the currently selected class
  const teacherClassAssignedSubjects = useMemo(() => {
    const assigned = getTeacherAssignedSubjectsForClass(user, selectedClass, practicalsSettings);
    if (assigned && assigned.length > 0) return assigned;
    // Fallback: filter allTeacherAssignedSubjects against current class curriculum
    const isSecondary = selectedClass === '9th' || selectedClass === '10th' || selectedClass === '9' || selectedClass === '10';
    const targetList = isSecondary ? SECONDARY_7_SUBJECTS : HIGHER_SECONDARY_15_SUBJECTS;
    const matched = allTeacherAssignedSubjects.filter(sub =>
      targetList.some(t => isTeacherSubjectMatch(sub, t.name) || isTeacherSubjectMatch(sub, t.code))
    );
    if (matched.length > 0) return matched;
    return [];
  }, [user, selectedClass, allTeacherAssignedSubjects, practicalsSettings]);

  // Primary subject display string for current class
  const teacherClassRegisteredSubject = useMemo(() => {
    if (teacherClassAssignedSubjects.length > 0) {
      return teacherClassAssignedSubjects.join(', ');
    }
    return teacherRegisteredSubject;
  }, [teacherClassAssignedSubjects, teacherRegisteredSubject]);

  const [practicalType, setPracticalType] = useState(
    (location.state?.practicalType && isPracticalEvaluationType(location.state.practicalType))
      ? location.state.practicalType
      : 'Internal Assessment'
  );
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [yearSuffix, setYearSuffix] = useState(location.state?.yearSuffix || CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION]);
  const [rosterScope, setRosterScope] = useState('stream'); // Default to 'stream' (Subject / Stream Only)

  // Dynamic subject catalog filtered strictly to 7 subjects for Classes 9th & 10th and 16 subjects for Classes 11th & 12th
  const displaySubjectMap = useMemo(() => {
    const isSecondary = selectedClass === '9th' || selectedClass === '10th' || selectedClass === '9' || selectedClass === '10';
    return isSecondary ? SECONDARY_7_SUBJECTS : HIGHER_SECONDARY_15_SUBJECTS;
  }, [selectedClass]);

  // Synchronize subject when switching class levels (e.g. Science for 9th/10th vs Environmental Science for 11th/12th)
  useEffect(() => {
    const isSecondary = selectedClass === '9th' || selectedClass === '10th' || selectedClass === '9' || selectedClass === '10';
    const targetList = isSecondary ? SECONDARY_7_SUBJECTS : HIGHER_SECONDARY_15_SUBJECTS;

    let assignedMatch = null;
    const classAssigned = getTeacherAssignedSubjectsForClass(user, selectedClass);
    if (classAssigned && classAssigned.length > 0) {
      for (const sub of classAssigned) {
        const sNorm = normalizeSubjectIdentity(sub);
        const exactMatch = targetList.find(m => {
          const mNorm = normalizeSubjectIdentity(m.code || m.name);
          return mNorm && sNorm && mNorm.code === sNorm.code;
        });
        if (exactMatch) {
          assignedMatch = exactMatch.name;
          break;
        }
        const match = targetList.find(s => isTeacherSubjectMatch(sub, s.name) || isTeacherSubjectMatch(sub, s.code));
        if (match) {
          assignedMatch = match.name;
          break;
        }
      }
    }
    if (!assignedMatch && allTeacherAssignedSubjects.length > 0) {
      for (const sub of allTeacherAssignedSubjects) {
        const sNorm = normalizeSubjectIdentity(sub);
        const exactMatch = targetList.find(m => {
          const mNorm = normalizeSubjectIdentity(m.code || m.name);
          return mNorm && sNorm && mNorm.code === sNorm.code;
        });
        if (exactMatch) {
          assignedMatch = exactMatch.name;
          break;
        }
        const match = targetList.find(s => isTeacherSubjectMatch(sub, s.name) || isTeacherSubjectMatch(sub, s.code));
        if (match) {
          assignedMatch = match.name;
          break;
        }
      }
    }
    if (!assignedMatch && teacherRegisteredSubject) {
      const regNorm = normalizeSubjectIdentity(teacherRegisteredSubject);
      const exactMatch = targetList.find(m => {
        const mNorm = normalizeSubjectIdentity(m.code || m.name);
        return mNorm && regNorm && mNorm.code === regNorm.code;
      });
      if (exactMatch) {
        assignedMatch = exactMatch.name;
      } else {
        const match = targetList.find(s => isTeacherSubjectMatch(teacherRegisteredSubject, s.name));
        if (match) assignedMatch = match.name;
      }
    }

    const isCurrentInTarget = targetList.some(s => s.name.toLowerCase() === String(selectedSubject || '').toLowerCase());
    if (!isCurrentInTarget || (assignedMatch && !isTeacherSubjectMatch(assignedMatch, selectedSubject))) {
      setSelectedSubject(assignedMatch || (isCurrentInTarget ? selectedSubject : targetList[0].name));
    }
  }, [selectedClass, user, allTeacherAssignedSubjects, teacherRegisteredSubject]);

  // State for Cross-Subject switch confirmation modal & Existing award detection
  const [crossSubjectSwitchModal, setCrossSubjectSwitchModal] = useState({ isOpen: false, targetSubject: '' });
  const [existingAwardInfo, setExistingAwardInfo] = useState({ canonical: null, pending: null });
  const [altSessionAvailable, setAltSessionAvailable] = useState(null);
  const [altSessionCount, setAltSessionCount] = useState(0);

  // Default class to teacher's first assigned class once on initial profile load (if user has not manually selected a class)
  useEffect(() => {
    if (initialClassAssignedRef.current || userHasSelectedClassRef.current) return;
    if (location.state?.selectedClass) {
      initialClassAssignedRef.current = true;
      return;
    }
    if (teacherAssignedClasses.length > 0) {
      const raw = String(teacherAssignedClasses[0] || '');
      const clean = raw.includes('11') ? '11th' : (raw.includes('12') ? '12th' : (raw.includes('10') ? '10th' : (raw.includes('9') ? '9th' : '11th')));
      setSelectedClass(clean);
      initialClassAssignedRef.current = true;
    }
  }, [teacherAssignedClasses, location.state?.selectedClass]);

  // Synchronize filter states if user navigates with state (e.g. from Dashboard Submission History)
  useEffect(() => {
    if (location.state) {
      if (location.state.selectedClass) {
        const raw = String(location.state.selectedClass || '');
        const clean = raw.includes('11') ? '11th' : (raw.includes('12') ? '12th' : (raw.includes('10') ? '10th' : (raw.includes('9') ? '9th' : '11th')));
        setSelectedClass(clean);
      }
      if (location.state.selectedSubject) setSelectedSubject(location.state.selectedSubject);
      if (location.state.practicalType) setPracticalType(location.state.practicalType);
      if (location.state.yearSuffix) setYearSuffix(location.state.yearSuffix);
    }
  }, [location.state]);
  const [sortBy, setSortBy] = useState('rollAsc'); // 'rollAsc' | 'rollDesc' | 'nameAsc' | 'formAsc'
  const [showFilterSettings, setShowFilterSettings] = useState(false);

  useEffect(() => {
    loadSiteSettings().then(cfg => {
      if (cfg && cfg.practicalsSubmissionOpen !== undefined) {
        setIsSubmissionOpen(Boolean(cfg.practicalsSubmissionOpen));
      }
    }).catch(() => {});

    // Initial fetch with cache bypass
    getAdminPracticalsSettings(true).then(cfg => {
      if (cfg) setPracticalsSettings(cfg);
    }).catch(() => {});

    // Real-time Firestore sync on adminPracticalsSettings/config so admin-granted permissions reflect immediately
    const unsub = onSnapshot(doc(db, 'adminPracticalsSettings', 'config'), (snap) => {
      if (snap.exists()) {
        setPracticalsSettings(snap.data());
      }
    }, (err) => {
      console.warn('Real-time practical settings sync note:', err?.message || err);
    });

    // A single-document listener immediately locks the form in every open
    // teacher tab when administration closes practical submissions.
    const unsubSiteSettings = onSnapshot(doc(db, 'site', 'settings'), (snap) => {
      if (snap.exists() && snap.data().practicalsSubmissionOpen !== undefined) {
        setIsSubmissionOpen(Boolean(snap.data().practicalsSubmissionOpen));
      }
    }, (err) => {
      console.warn('Real-time practicals submission lock sync note:', err?.message || err);
    });

    return () => {
      try { unsub(); } catch (_) {}
      try { unsubSiteSettings(); } catch (_) {}
    };
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
  const [showPrintMenu, setShowPrintMenu] = useState(false);
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
    // Strictly restrict to only the current teacher's submissions (including adopted awards from transferred faculty)
    const list = submissionHistory.filter(item => isSubmissionOwnedByTeacher(item, user, auth.currentUser, practicalsSettings));

    if (!historySearch.trim()) return list;
    const q = historySearch.toLowerCase().trim();
    return list.filter(item => {
      const className = String(item.className || '').toLowerCase();
      const subject = String(item.subject || '').toLowerCase();
      const practicalType = String(item.practicalType || '').toLowerCase();
      const displayDate = String(item.displayDate || '').toLowerCase();
      const year = String(item.yearSuffix || '').toLowerCase();
      return className.includes(q) || subject.includes(q) || practicalType.includes(q) || displayDate.includes(q) || year.includes(q);
    });
  }, [submissionHistory, historySearch, user]);

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
    if (!selectedSubject) return false;
    // If no registered subjects at all, not cross-subject
    if (!teacherRegisteredSubject && allTeacherAssignedSubjects.length === 0) return false;

    // 1. Check if selectedSubject matches any subject assigned for THIS specific class
    if (teacherClassAssignedSubjects && teacherClassAssignedSubjects.length > 0) {
      const matchesClassAssigned = teacherClassAssignedSubjects.some(sub => isTeacherSubjectMatch(sub, selectedSubject));
      if (matchesClassAssigned) return false;
    }

    // 2. Check if selectedSubject matches any assigned subject globally for the teacher
    if (allTeacherAssignedSubjects && allTeacherAssignedSubjects.length > 0) {
      const matchesAnyAssigned = allTeacherAssignedSubjects.some(sub => isTeacherSubjectMatch(sub, selectedSubject));
      if (matchesAnyAssigned) return false;
    }

    // 3. Fallback to teacherRegisteredSubject string matching
    if (teacherRegisteredSubject && isTeacherSubjectMatch(teacherRegisteredSubject, selectedSubject)) {
      return false;
    }

    // 4. Check explicit permissions in practicalsSettings.permissions
    const uEmail = String(user?.email || auth.currentUser?.email || '').toLowerCase().trim();
    if (uEmail && practicalsSettings && Array.isArray(practicalsSettings.permissions)) {
      const hasExplicitPerm = practicalsSettings.permissions.some(p => {
        if (!p || String(p.email || '').toLowerCase().trim() !== uEmail) return false;
        const normSub = normalizeSubjectIdentity(p.subject);
        const subMatch = isTeacherSubjectMatch(p.subject, selectedSubject) || (normSub && isTeacherSubjectMatch(normSub.name, selectedSubject));
        const cleanPermCls = String(p.className || p.class || '').toLowerCase().replace(/[^0-9]/g, '');
        const cleanSelCls = String(selectedClass || '').toLowerCase().replace(/[^0-9]/g, '');
        const clsMatch = !cleanPermCls || !cleanSelCls || cleanPermCls === cleanSelCls;
        return subMatch && clsMatch;
      });
      if (hasExplicitPerm) return false;
    }

    return true;
  }, [teacherRegisteredSubject, allTeacherAssignedSubjects, teacherClassAssignedSubjects, selectedSubject, practicalsSettings, selectedClass, user?.email]);

  const isOverwrite = useMemo(() => {
    return Boolean(
      existingAwardInfo?.canonical &&
      Array.isArray(existingAwardInfo.canonical.records) &&
      existingAwardInfo.canonical.records.length > 0
    );
  }, [existingAwardInfo?.canonical]);


  // Do not download historical awards merely to populate a selector. History
  // is fetched only when the teacher opens its drawer.
  useEffect(() => {
    const sessions = new Set(['2025-26', '2024-25 (Oct-Nov)', '2024-25', yearSuffix].filter(Boolean));
    setAvailableSessions([...sessions].sort((a, b) => b.localeCompare(a)));
  }, [yearSuffix]);

  const availableEvalTypes = useMemo(() => {
    return getPracticalEvaluationTypes();
  }, []);

  const activeEvalOption = availableEvalTypes.find(e => e.value === practicalType);
  const isCustomEval = activeEvalOption?.isCustom;
  const currentSubjectObj = displaySubjectMap.find(s => s.name.toLowerCase() === String(selectedSubject || '').toLowerCase() || s.code.toLowerCase() === String(selectedSubject || '').toLowerCase()) ||
    SUBJECT_MAP.find(s => s.name.toLowerCase() === String(selectedSubject || '').toLowerCase() || s.code.toLowerCase() === String(selectedSubject || '').toLowerCase()) ||
    displaySubjectMap[0] ||
    { name: selectedSubject || 'General English', code: 'EN', defaultMax: 20 };
  const currentSubjCode = currentSubjectObj?.code || 'EN';
  const evalTypeNorm = String(practicalType || '').toLowerCase().includes('ext') ? 'external' : 'internal';
  const currentMarksConfig = getSubjectMarksConfig(practicalsSettings, selectedClass, evalTypeNorm, currentSubjCode);
  const customSubjOverride = getSubjectOverride(activeEvalOption?.evalConfig?.subjectOverrides, currentSubjCode, selectedClass);
  const baseEvalMax = customSubjOverride?.maxMarks
    ? Number(customSubjOverride.maxMarks)
    : (isCustomEval && activeEvalOption?.evalConfig?.maxMarks
        ? Number(activeEvalOption.evalConfig.maxMarks)
        : (currentMarksConfig?.max ?? 20));
  const defaultSubjectPaperMax = customSubjOverride?.maxMarks
    ? Number(customSubjOverride.maxMarks)
    : baseEvalMax;
  const subjectMaxMarks = Number(teacherCustomMax) > 0 ? Number(teacherCustomMax) : defaultSubjectPaperMax;
  const minPassMarks = customSubjOverride?.minMarks && !teacherCustomMax
    ? Number(customSubjOverride.minMarks)
    : Math.ceil(subjectMaxMarks * 0.36);

  const getSubjectMax = useCallback((code) => {
    if (code === (currentSubjectObj?.code || 'EN') && Number(teacherCustomMax) > 0) {
      return Number(teacherCustomMax);
    }
    const override = getSubjectOverride(activeEvalOption?.evalConfig?.subjectOverrides, code, selectedClass);
    if (override?.maxMarks) {
      return Number(override.maxMarks);
    }
    if (isCustomEval && activeEvalOption?.evalConfig?.maxMarks) {
      return Number(activeEvalOption.evalConfig.maxMarks);
    }
    return getSubjectMarksConfig(practicalsSettings, selectedClass, evalTypeNorm, code)?.max ?? 20;
  }, [practicalsSettings, selectedClass, evalTypeNorm, isCustomEval, activeEvalOption, currentSubjectObj?.code, teacherCustomMax]);

  // Fetch Roster strictly for confirmed students with assigned class roll numbers
  const fetchPracticalData = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const targetSubjCode = currentSubjectObj.code;
      const targetSubjName = currentSubjectObj.name;
      const cleanSubj = String(selectedSubject || '').trim();
      const cleanSess = String(yearSuffix || '').trim();
      const cleanSessUnderscore = cleanSess.replace(/\s+/g, '_');
      const docId = formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix);
      const pendingDocId = `pending_${docId}`;

      // 1. Fetch cohort admissions/masterRegisters and all candidate practical award documents
      let savedMarksMap = {};
      let masterDocs = [];
      let admDocs = [];
      let foundCanonical = null;
      let foundPending = null;
      let lockedOtherTeacherAward = null;
      let alternateSessionMatch = null;
      let alternateSessionCount = 0;

      try {
        const legacyDocId = clsNorm === '11th'
          ? `11th,12th_${docId.replace(/^11th_/, '')}`
          : '';

        // Build comprehensive candidate document IDs to match canonical, underscore, code-based, and legacy schemes
        const candidateDocIds = new Set([
          docId,
          pendingDocId,
          legacyDocId,
          // Subject Code variants (e.g. 11th_HT_internal_2024-25_(Oct-Nov))
          `${clsNorm}_${targetSubjCode}_internal_${cleanSessUnderscore}`,
          `${clsNorm}_${targetSubjCode}_external_${cleanSessUnderscore}`,
          `${clsNorm}_${targetSubjCode}_internal_${cleanSess}`,
          `${clsNorm}_${targetSubjCode}_external_${cleanSess}`,
          `${clsNorm}_${targetSubjCode}_Internal Assessment_${cleanSess}`,
          `${clsNorm}_${targetSubjCode}_External Practical_${cleanSess}`,
          // Subject Name variants
          `${clsNorm}_${targetSubjName}_internal_${cleanSessUnderscore}`,
          `${clsNorm}_${targetSubjName}_external_${cleanSessUnderscore}`,
          `${clsNorm}_${targetSubjName}_internal_${cleanSess}`,
          `${clsNorm}_${targetSubjName}_external_${cleanSess}`,
          `${clsNorm}_${targetSubjName}_Internal Assessment_${cleanSess}`,
          `${clsNorm}_${targetSubjName}_External Practical_${cleanSess}`,
          `${clsNorm}_${cleanSubj}_Internal Assessment_${cleanSess}`,
          `${clsNorm}_${cleanSubj}_External Practical_${cleanSess}`,
          // Common 2024-25 variants if not current
          `${clsNorm}_${targetSubjCode}_internal_2024-25_(Oct-Nov)`,
          `${clsNorm}_${targetSubjCode}_external_2024-25_(Oct-Nov)`,
          `${clsNorm}_${targetSubjName}_internal_2024-25_(Oct-Nov)`,
          `${clsNorm}_${targetSubjCode}_Internal Assessment_2024-25 (Oct-Nov)`,
          // IT / ITES variants if target is ITE
          ...(targetSubjCode === 'ITE' ? [
            `${clsNorm}_IT_internal_${cleanSessUnderscore}`,
            `${clsNorm}_IT_internal_${cleanSess}`,
            `${clsNorm}_ITES_internal_${cleanSessUnderscore}`,
            `${clsNorm}_ITES_internal_${cleanSess}`,
            `${clsNorm}_IT & ITES_internal_${cleanSessUnderscore}`,
            `${clsNorm}_IT & ITES_internal_${cleanSess}`,
            `${clsNorm}_IT & ITES_Internal Assessment_${cleanSess}`,
            `${clsNorm}_IT_Internal Assessment_${cleanSess}`,
            `${clsNorm}_IT_internal_2024-25_(Oct-Nov)`,
            `${clsNorm}_IT & ITES_internal_2024-25_(Oct-Nov)`
          ] : [])
        ].filter(Boolean));

        [...candidateDocIds].forEach(id => {
          if (!id.startsWith('pending_')) {
            candidateDocIds.add(`pending_${id}`);
          }
        });

        const awardRefs = [...candidateDocIds].map(id => doc(db, 'practicalsData', id));
        const [masterRes, admRes, queryRes, ...awardSnaps] = await Promise.all([
          getMasterRegistersScoped({ session: yearSuffix, className: selectedClass }).catch(() => []),
          getAdmissionsBySession({ session: yearSuffix, className: selectedClass }).catch(() => []),
          getDocs(query(
            collection(db, 'practicalsData'),
            where('className', '==', clsNorm),
            where('subjectCode', '==', targetSubjCode)
          )).catch(() => null),
          ...awardRefs.map(ref => getDoc(ref).catch(() => null))
        ]);

        masterDocs = Array.isArray(masterRes) ? masterRes : [];
        admDocs = Array.isArray(admRes) ? admRes : [];

        const docItemsMap = new Map();
        awardSnaps.forEach(snap => {
          if (snap?.exists()) {
            docItemsMap.set(snap.id, { id: snap.id, ...snap.data() });
          }
        });
        if (queryRes && !queryRes.empty) {
          queryRes.forEach(d => {
            if (!docItemsMap.has(d.id)) {
              docItemsMap.set(d.id, { id: d.id, ...d.data() });
            }
          });
        }
        const docItems = Array.from(docItemsMap.values());

        docItems.forEach(data => {
          const dId = String(data.id || data.docId || '');
          if (dId.startsWith('history_') || dId.startsWith('bin_')) return;

          // Check if this document belongs to another session and has examinees (for 1-click suggestion banner)
          const docSess = String(data.yearSuffix || data.Session || data.session || (dId.includes('_') ? dId.split('_').pop().replace(/_/g, ' ') : '') || '').trim();
          const isDocOwned = isSubmissionOwnedByTeacher(data, user, auth.currentUser, practicalsSettings);
          if (isDocOwned && Array.isArray(data.records) && data.records.length > 0 && !isSessionMatch(docSess, yearSuffix)) {
            if (!alternateSessionMatch) {
              alternateSessionMatch = docSess.includes('Oct-Nov') ? '2024-25 (Oct-Nov)' : (docSess || '2024-25 (Oct-Nov)');
              alternateSessionCount = data.records.length;
            }
          }

          // Class Match
          const docClass = String(data.className || data.Class || dId).toLowerCase();
          const matchClass = docClass.includes(clsNorm.toLowerCase()) || dId.toLowerCase().includes(clsNorm.toLowerCase());
          if (!matchClass) return;

          // Evaluation Type Match — strictly Internal or External Practical
          const docEvalType = String(data.practicalType || data.evaluationType || data.examTitle || dId).toLowerCase().trim();
          if (!isPracticalEvaluationType(docEvalType)) return;
          const targetEvalType = String(practicalType || '').toLowerCase().trim();
          const isInternalTarget = targetEvalType.includes('internal');
          const isInternalDoc = docEvalType.includes('internal');
          const isExternalTarget = targetEvalType.includes('external');
          const isExternalDoc = docEvalType.includes('external');

          const matchEval = (isInternalTarget && isInternalDoc) || 
                            (isExternalTarget && isExternalDoc) || 
                            (docEvalType === targetEvalType) ||
                            dId === docId || dId === pendingDocId;
          if (!matchEval) return;

          // Year Match
          const docYr = String(data.yearSuffix || data.Session || data.session || (dId.includes('_') ? dId.split('_').pop() : '') || '').trim();
          if (!isSessionMatch(docYr, yearSuffix) && dId !== docId && dId !== pendingDocId) return;

          // Subject Match
          const docSubj = String(data.subjectName || data.Subject || data.subjectCode || data.subject || dId || '').toUpperCase();
          const matchSubj = dId === docId || dId === pendingDocId ||
                            isMatchingSubjectCode(docSubj, targetSubjCode) ||
                            docSubj === targetSubjCode.toUpperCase() || 
                            docSubj === targetSubjName.toUpperCase() ||
                            docSubj.includes(targetSubjName.toUpperCase()) ||
                            (targetSubjCode === 'BO' && (docSubj.includes('BOTANY') || docSubj === 'BO')) ||
                            (targetSubjCode === 'ZO' && (docSubj.includes('ZOOLOGY') || docSubj === 'ZO')) ||
                            (targetSubjCode === 'BI' && (docSubj.includes('BIOLOGY') || docSubj === 'BI'));
          if (!matchSubj) return;

          const isApproved = data.status === 'approved' || (data.isPendingApproval === false && data.status !== 'pending_approval' && data.status !== 'rejected' && data.status !== 'draft');
          const canAccessAward = isDocOwned;

          const isPending = dId.startsWith('pending_') || String(data.canonicalDocId || '') === docId || data.status === 'pending_approval' || data.status === 'rejected' || data.status === 'draft' || (data.isDraft === true && data.status !== 'approved');

          if (isPending && !isApproved) {
            if (canAccessAward) {
              foundPending = { id: dId, ...data };
            } else if (!lockedOtherTeacherAward) {
              lockedOtherTeacherAward = {
                id: dId,
                submittedByName: data.submittedByName || data.teacherName || data.submittedBy || 'Another Faculty Member',
                submittedByEmail: data.submittedByEmail || '',
                submittedAt: data.submittedAt || data.updatedAt,
                recordsCount: Array.isArray(data.records) ? data.records.length : 0,
                status: 'pending'
              };
            }
          } else if (Array.isArray(data.records) && data.records.length > 0) {
            if (canAccessAward) {
              const cleanData = { ...data };
              delete cleanData.rejectionReason;
              delete cleanData.rejectedAt;
              delete cleanData.rejectedBy;
              foundCanonical = { id: dId, ...cleanData };
            } else if (!lockedOtherTeacherAward) {
              lockedOtherTeacherAward = {
                id: dId,
                submittedByName: data.submittedByName || data.teacherName || data.submittedBy || 'Another Faculty Member',
                submittedByEmail: data.submittedByEmail || '',
                submittedAt: data.submittedAt || data.updatedAt,
                recordsCount: Array.isArray(data.records) ? data.records.length : 0,
                status: 'approved'
              };
            }
          }

          if (!canAccessAward) {
            if (!lockedOtherTeacherAward) {
              lockedOtherTeacherAward = {
                id: dId,
                submittedByName: data.submittedByName || data.teacherName || data.submittedBy || 'Another Faculty Member',
                submittedByEmail: data.submittedByEmail || '',
                submittedAt: data.submittedAt || data.updatedAt,
                recordsCount: Array.isArray(data.records) ? data.records.length : 0,
                status: data.status || 'submitted'
              };
            }
            return;
          }

          // Parse records array if present
          if (Array.isArray(data.records) && !dId.startsWith('history_')) {
            data.records.forEach(r => {
              if (checkIsStudentDropped(r) || isStudentExamDropped(r)) return;
              const rRoll = getPracticalsStudentRoll(r);
              const legacyRoll = String(r.rollNo || '').trim();
              const rBoard = String(r.examRollNo || r.boardRollNo || r.boardRoll || (isLikelyOfficialExamRollNumber(legacyRoll) ? legacyRoll : '')).trim();
              const rForm = String(r.formNo || '').trim();
              const rName = String(r.name || r.studentName || '').toLowerCase().trim();
              const rReg = String(r.regNo || r.boardRegNo || r.registrationNo || r['Board Reg. No.'] || '').trim();

              const recObj = {
                rollNo: rRoll,
                classRollNo: rRoll,
                boardRoll: rBoard,
                boardRollNo: rBoard,
                regNo: rReg,
                name: r.name || r.studentName,
                studentName: r.name || r.studentName,
                parentName: r.parentName || '',
                formNo: rForm || rRoll,
                practicalMarks: r.practicalMarks !== undefined && r.practicalMarks !== null ? String(r.practicalMarks) : '',
                vivaMarks: r.vivaMarks || '',
                totalMarks: r.totalMarks !== undefined && r.totalMarks !== null ? r.totalMarks : (r.practicalMarks || '')
              };

              if (rRoll) {
                savedMarksMap[rRoll] = recObj;
                const num = parseInt(rRoll, 10);
                if (!isNaN(num)) savedMarksMap[String(num)] = recObj;
              }
              if (rBoard) savedMarksMap[rBoard] = recObj;
              if (rForm) savedMarksMap[rForm] = recObj;
              if (rName) {
                if (!savedMarksMap[rName]) savedMarksMap[rName] = recObj;
                if (rRoll) savedMarksMap[`name_${rRoll}_${rName}`] = recObj;
              }
              if (rReg) {
                const cleanRReg = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                if (cleanRReg.length >= 8) {
                  savedMarksMap['reg_' + cleanRReg] = recObj;
                }
                const dualMatch = rReg.match(/^([^(]+)\s*\(([^)]+)\)$/);
                if (dualMatch) {
                  const r1 = dualMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  const r2 = dualMatch[2].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  if (r1.length >= 8) savedMarksMap['reg_' + r1] = recObj;
                  if (r2.length >= 8) savedMarksMap['reg_' + r2] = recObj;
                }
              }
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
                practicalMarks: val !== undefined && val !== null ? String(val) : '',
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
            if (checkIsStudentDropped(r) || isStudentExamDropped(r)) return;
            const rRoll = getPracticalsStudentRoll(r);
            const legacyRoll = String(r.rollNo || '').trim();
            const rBoard = String(r.examRollNo || r.boardRollNo || r.boardRoll || (isLikelyOfficialExamRollNumber(legacyRoll) ? legacyRoll : '')).trim();
            const rForm = String(r.formNo || '').trim();
            const rName = String(r.name || r.studentName || '').toLowerCase().trim();
            const rReg = String(r.regNo || r.boardRegNo || r.registrationNo || r['Board Reg. No.'] || '').trim();

            const recObj = {
              rollNo: rRoll,
              classRollNo: rRoll,
              boardRoll: rBoard,
              boardRollNo: rBoard,
              regNo: rReg,
              name: r.name || r.studentName,
              studentName: r.name || r.studentName,
              parentName: r.parentName || '',
              formNo: rForm || rRoll,
              practicalMarks: r.practicalMarks !== undefined && r.practicalMarks !== null ? String(r.practicalMarks) : '',
              vivaMarks: r.vivaMarks || '',
              totalMarks: r.totalMarks !== undefined && r.totalMarks !== null ? r.totalMarks : (r.practicalMarks || '')
            };

            if (rRoll) {
              savedMarksMap[rRoll] = recObj;
              const num = parseInt(rRoll, 10);
              if (!isNaN(num)) savedMarksMap[String(num)] = recObj;
            }
            if (rBoard) savedMarksMap[rBoard] = recObj;
            if (rForm) savedMarksMap[rForm] = recObj;
            if (rName) {
              if (!savedMarksMap[rName]) savedMarksMap[rName] = recObj;
              if (rRoll) savedMarksMap[`name_${rRoll}_${rName}`] = recObj;
            }
            if (rReg) {
              const cleanRReg = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (cleanRReg.length >= 8) {
                savedMarksMap['reg_' + cleanRReg] = recObj;
              }
              const dualMatch = rReg.match(/^([^(]+)\s*\(([^)]+)\)$/);
              if (dualMatch) {
                const r1 = dualMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                const r2 = dualMatch[2].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                if (r1.length >= 8) savedMarksMap['reg_' + r1] = recObj;
                if (r2.length >= 8) savedMarksMap['reg_' + r2] = recObj;
              }
            }
          });
        }

        // Accurately resolve custom max marks from active pending/draft or canonical record
        if (foundPending?.maxMarks && Number(foundPending.maxMarks) > 0) {
          setTeacherCustomMax(Number(foundPending.maxMarks));
        } else if (foundCanonical?.maxMarks && Number(foundCanonical.maxMarks) > 0) {
          setTeacherCustomMax(Number(foundCanonical.maxMarks));
        }

        // Set existing award info for UI indicators & safe overwrite workflow
        setExistingAwardInfo({
          canonical: foundCanonical,
          pending: foundPending,
          lockedOtherTeacherAward: lockedOtherTeacherAward
        });
      } catch (e) {
        console.warn('Practicals read note:', e);
      }

      const cacheKey = `${selectedClass}_${yearSuffix}_${selectedSubject}_${practicalType}_${rosterScope}`;
      // Re-evaluate roster when saved marks exist in database to guarantee full sync
      let uniqueStudents = Object.keys(savedMarksMap).length > 0 ? null : masterRosterCacheRef.current[cacheKey];

      if (!uniqueStudents || uniqueStudents.length === 0) {
        let allCandidates = [];
        const isCurrentActiveSession = isSessionMatch(yearSuffix, CURRENT_SESSION) || String(yearSuffix).includes('2025-26');

        const pushMasterCandidates = () => {
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
                    class: it.class || it.Class || it['Class'] || docClass,
                    _source: 'masterRegisters'
                  });
                });
              } else {
                allCandidates.push({
                  ...d,
                  session: d.Session || d.session || docSession,
                  class: d.class || d.Class || d['Class'] || docClass,
                  _source: 'masterRegisters'
                });
              }
            });
          }
        };

        const pushAdmissionCandidates = () => {
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
                    class: it['Admission sought for class'] || it['Class for which Admission Sought'] || it['Class Enrolled'] || it.className || it.class || it.Class || it['Class'] || docClass,
                    _source: 'admissions'
                  });
                });
              } else {
                allCandidates.push({
                  ...d,
                  session: d.Session || d.session || docSession,
                  class: d['Admission sought for class'] || d['Class for which Admission Sought'] || d['Class Enrolled'] || d.className || d.class || d.Class || docClass,
                  _source: 'admissions'
                });
              }
            });
          }
        };

        // For current active session (2025-26), admissions holds the richest and most up-to-date
        // subject choices, streams, and parentage, so it is prioritized first.
        // For historical sessions, masterRegisters acts as the permanent institutional record.
        if (isCurrentActiveSession) {
          pushAdmissionCandidates();
          pushMasterCandidates();
        } else {
          pushMasterCandidates();
          pushAdmissionCandidates();
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
              } else if (isCurrentActiveSession && item._source === 'admissions' && existing._source !== 'admissions') {
                map.set(key, item); // Prioritize admissions for active session!
              }
            }
          };

          // 1. Reg No (Strict Canonical Full Registration Matching)
          const rReg = getRegNo(it);
          if (rReg) {
            const cleanFull = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (cleanFull.length >= 8) {
              setIfBetter(richByReg, cleanFull, it);
            }
            setIfBetter(richByReg, rReg.trim().toUpperCase(), it);
            const dualMatch = rReg.match(/^([^(]+)\s*\(([^)]+)\)$/);
            if (dualMatch) {
              const r1 = dualMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              const r2 = dualMatch[2].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (r1.length >= 8) setIfBetter(richByReg, r1, it);
              if (r2.length >= 8) setIfBetter(richByReg, r2, it);
            }
          }

          // 2. Form No
          const rForm = String(it.formNo || it['Form No.'] || it['Form Number'] || it.FormNo || '').trim();
          setIfBetter(richByForm, rForm, it);

          // 3. Class Roll No (Strictly restrict to matching class to prevent cross-class roll number collisions)
          const rRoll = getPracticalsStudentRoll(it);
          if (isMatchCls && rRoll) {
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
        const isSecondaryClass = selectedClass === '9th' || selectedClass === '10th' || selectedClass === '9' || selectedClass === '10';

        allCandidates.forEach(st => {
          if (checkIsStudentDropped(st) || isStudentExamDropped(st)) return;
          const stClass = extractStudentClass(st);
          const stSession = st.session || st.Session || st['Academic Session'];

          // Filter by allowed student status if specified in assessment config
          if (Array.isArray(evalAllowedStatuses) && evalAllowedStatuses.length > 0) {
            const rawStatus = String(st.status || st.admissionStatus || st['Admission Status'] || st['Status'] || '').toLowerCase().trim();
            const isStatusMatch = evalAllowedStatuses.some(statusFilter => {
              const sf = String(statusFilter).toLowerCase().trim();
              return rawStatus.includes(sf) || (sf === 'approved' && (!rawStatus || rawStatus === 'approved' || rawStatus === 'confirmed' || hasAssignedClassRoll(st)));
            });
            if (!isStatusMatch) return;
          }

          const matchSubjOrAll = rosterScope === 'all_class' || isSubjectOrStreamMatch(st, targetSubjCode, targetSubjName, selectedClass);

          if (
            hasAssignedClassRoll(st) &&
            isClassMatch(stClass, selectedClass) &&
            isSessionMatch(stSession, yearSuffix) &&
            matchSubjOrAll
          ) {
            allDiscoveredStudents.push({
              ...st,
              studentName: getStudentName(st),
              formNo: st.formNo || st['Form No.'] || st['Form Number'] || '',
              classRollNo: getPracticalsStudentRoll(st),
              rollNo: getPracticalsStudentRoll(st),
              admNo: extractRawAdmNo(st),
              regNo: getRegNo(st),
              rawSubjects: extractRawSubjectsString(st, selectedClass) || st.subjects || '',
              subjects: extractRawSubjectsString(st, selectedClass) || st['Subs'] || st.subjects || st['Subjects'] || st['Stream / Subjects'] || selectedSubject,
              subjectsAbbr: getAbbreviatedSubjects(st, selectedClass) || selectedSubject,
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

            const rRoll  = getPracticalsStudentRoll(rec);
            const rName  = String(rec.name || rec.studentName || '').toLowerCase().trim();
            const rBoard = String(rec.boardRoll || rec.boardRollNo || '').trim();
            const rForm  = String(rec.formNo || rec.formNumber || '').trim();
            const rReg   = getRegNo(rec);
            const rAdm   = extractRawAdmNo(rec);

            let richSt = null;
            if (rReg) {
              const cleanRReg = rReg.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              if (cleanRReg.length >= 8) {
                richSt = richByReg.get(cleanRReg);
              }
              if (!richSt) richSt = richByReg.get(rReg.trim().toUpperCase());
              if (!richSt) {
                const dualMatch = rReg.match(/^([^(]+)\s*\(([^)]+)\)$/);
                if (dualMatch) {
                  const r1 = dualMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  const r2 = dualMatch[2].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  richSt = richByReg.get(r1) || richByReg.get(r2);
                }
              }
            }
            if (!richSt && rForm) richSt = richByForm.get(rForm);
            if (!richSt && rRoll) richSt = richByRoll.get(rRoll);
            if (!richSt && rBoard) richSt = richByBoard.get(rBoard);
            if (!richSt && rAdm) richSt = richByAdm.get(rAdm);
            if (!richSt && rName && rName !== 'student') richSt = richByName.get(rName);
            if (!richSt) richSt = {};

            // Validate resolved student has assigned class roll or valid candidate credential
            if (!hasAssignedClassRoll(richSt) && !hasAssignedClassRoll(rec)) {
              return; // Skip records without valid student identifier
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
                return rawStatus.includes(sf) || (sf === 'approved' && (!rawStatus || rawStatus === 'approved' || rawStatus === 'confirmed' || hasAssignedClassRoll(richSt) || hasAssignedClassRoll(rec)));
              });
              if (!isStatusMatch) return;
            }

            // Exclude student if they have changed subjects and are no longer enrolled in this subject (unless rosterScope === 'all_class')
            if (rosterScope !== 'all_class') {
              const hasEnrolledSubjects = (Array.isArray(richSt.subjects) && richSt.subjects.length > 0) ||
                richSt['Subjects to be taken in Class 11th'] || richSt['Subjects to be taken in Class 12th'] ||
                richSt['Subjects Studied in Class 11th'] || richSt['Subs'] || richSt.subs || richSt.rawSubjects;
              if (hasEnrolledSubjects && !isSubjectOrStreamMatch(richSt, targetSubjCode, targetSubjName, selectedClass)) {
                return; // Student was transferred or changed subjects away from this subject
              }
            }

            const resolvedName = getStudentName(richSt);
            const finalName = (resolvedName && resolvedName !== 'Student') ? resolvedName : (rec.name && rec.name !== 'Student' ? rec.name : (rec.studentName || `Student`));
            const finalRoll = rRoll || getPracticalsStudentRoll(richSt) || getPracticalsStudentRoll(rec);

            allDiscoveredStudents.push({
              id: rec.boardRoll || rec.rollNo || richSt.id || `saved_${idx}`,
              ...richSt,
              classRollNo: finalRoll,
              rollNo: finalRoll,
              studentName: finalName,
              parentName: rec.parentName || richSt.parentName || richSt["Father's Name"] || richSt['Father Name'] || '',
              boardRollNo: rBoard || richSt.boardRollNo || richSt['Board Roll No'] || '',
              formNo: richSt.formNo || richSt['Form No.'] || richSt['Form Number'] || rec.formNo || '',
              admNo: extractRawAdmNo(richSt) || extractRawAdmNo(rec),
              regNo: getRegNo(richSt) || getRegNo(rec),
              subjects: extractRawSubjectsString(richSt, selectedClass) || richSt['Subs'] || richSt.subjects || richSt['Subjects'] || richSt['Stream / Subjects'] || rec.subjects || selectedSubject,
              subjectsAbbr: getAbbreviatedSubjects(richSt, selectedClass) || getAbbreviatedSubjects(rec, selectedClass) || selectedSubject,
              stream: richSt.stream || richSt['Stream'] || richSt['Stream for Class 11th'] || rec.stream || '',
              examRollNo: getExamRoll({ ...richSt, boardRoll: rBoard || richSt.boardRollNo, boardRollNo: rBoard || richSt.boardRollNo }, selectedClass),
              practicalMarks: rec.practicalMarks,
              vivaMarks: rec.vivaMarks,
              totalMarks: rec.totalMarks,
              isHistorical: true
            });
          });
        }

        // De-duplicate student records using composite keys to prevent cross-class/cross-session collisions
        const uniqueMap = new Map();
        allDiscoveredStudents.forEach(st => {
          if (!hasAssignedClassRoll(st)) return;

          const stCls = extractStudentClass(st) || selectedClass;
          const clsDigits = String(stCls).replace(/\D/g, '') || String(selectedClass).replace(/\D/g, '');
          const sesScope = getSessionEndYear(String(st.session || st.Session || yearSuffix || '')) || yearSuffix;
          const rollKey = getPracticalsStudentRoll(st);

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
          } else if (key) {
            const existing = uniqueMap.get(key);
            // Non-destructive merge: preserve the richer admissions record as authoritative base,
            // while backfilling any missing identifiers or rolls from masterRegisters so NO data is lost.
            const primary = (existing._source === 'admissions' || (!existing.isHistorical && st.isHistorical)) ? existing : st;
            const secondary = primary === existing ? st : existing;

            const merged = {
              ...secondary,
              ...primary,
              // Explicitly guarantee no vital identifiers from secondary are lost if missing in primary:
              classRollNo: primary.classRollNo || secondary.classRollNo || primary.rollNo || secondary.rollNo || '',
              rollNo: primary.rollNo || secondary.rollNo || primary.classRollNo || secondary.classRollNo || '',
              formNo: primary.formNo || secondary.formNo || '',
              regNo: primary.regNo || secondary.regNo || '',
              boardRegNo: primary.boardRegNo || secondary.boardRegNo || primary.regNo || secondary.regNo || '',
              admNo: primary.admNo || secondary.admNo || '',
              examRollNo: primary.examRollNo || secondary.examRollNo || secondary.boardRollNo || '',
              boardRollNo: primary.boardRollNo || secondary.boardRollNo || primary.examRollNo || secondary.examRollNo || '',
              // Ensure subjects & stream always stay rich from admissions:
              subjects: primary.subjects || secondary.subjects || '',
              rawSubjects: primary.rawSubjects || secondary.rawSubjects || '',
              subjectsAbbr: primary.subjectsAbbr || secondary.subjectsAbbr || '',
              stream: primary.stream || primary.Stream || secondary.stream || secondary.Stream || '',
              // Ensure parentage is preserved:
              parentName: primary.parentName || secondary.parentName || primary["Father's Name"] || secondary["Father's Name"] || '',
              // Preserve marks if present in either:
              practicalMarks: primary.practicalMarks !== undefined ? primary.practicalMarks : secondary.practicalMarks,
              vivaMarks: primary.vivaMarks !== undefined ? primary.vivaMarks : secondary.vivaMarks,
              totalMarks: primary.totalMarks !== undefined ? primary.totalMarks : secondary.totalMarks,
              isHistorical: Boolean(primary.isHistorical && secondary.isHistorical)
            };
            uniqueMap.set(key, merged);
          }
        });

        uniqueStudents = Array.from(uniqueMap.values());
        if (uniqueStudents.length > 0) {
          masterRosterCacheRef.current[cacheKey] = uniqueStudents;
        }
      }

      // Filter by Subject Matcher & Strict Class Roll Check, and enrich with computed fields
      const isSecondaryClass = selectedClass === '9th' || selectedClass === '10th' || selectedClass === '9' || selectedClass === '10';
      const subjectFiltered = uniqueStudents
        .filter(st => {
          if (!hasAssignedClassRoll(st)) return false;

          // Always enforce class match regardless of session
          const stCls = extractStudentClass(st);
          if (stCls && !isClassMatch(stCls, selectedClass)) return false;

          const rawStr = extractRawSubjectsString(st, selectedClass);
          const rawSubjects = Array.isArray(rawStr) ? rawStr.join(', ') : String(rawStr);
          const enrichedSt = {
            ...st,
            rawSubjects,
            subjectsAbbr: getAbbreviatedSubjects(st, selectedClass)
          };
          if (rosterScope !== 'all_class') {
            const isMatch = isSubjectMatch(enrichedSt, selectedSubject, selectedClass);
            if (!isMatch) return false;
          }
          return true;
        })
        .map(st => {
          const rawStr = extractRawSubjectsString(st, selectedClass);
          const rawSubjects = Array.isArray(rawStr) ? rawStr.join(', ') : String(rawStr);
          return {
            ...st,
            _rawSubjects: rawSubjects,
            _subjectsAbbr: getAbbreviatedSubjects(st, selectedClass),
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

      // Format final student practical roster
      const formatted = subjectFiltered
        .filter(st => hasAssignedClassRoll(st))
        .map((st, sIdx) => {
          const roll = getPracticalsStudentRoll(st);

          const name = getStudentName(st);
          const examRollVal = st._examRollNo || getExamRoll(st, selectedClass);
          const subsAbbr = st._subjectsAbbr || getAbbreviatedSubjects(st, selectedClass);
          const rawSubjFull = st._rawSubjects || (() => { const r = extractRawSubjectsString(st, selectedClass); return Array.isArray(r) ? r.join(', ') : String(r); })();
          const key = roll || st.formNo || st.id;
          const rollNumStr = roll && !isNaN(parseInt(roll, 10)) ? String(parseInt(roll, 10)) : '';
          const saved = savedMarksMap[String(key).trim()] || 
                        (rollNumStr ? savedMarksMap[rollNumStr] : null) ||
                        (roll && name ? savedMarksMap[`name_${roll}_${name.toLowerCase().trim()}`] : null) ||
                        savedMarksMap[String(st.formNo || '').trim()] || 
                        savedMarksMap[String(st.id || '').trim()] || 
                        (examRollVal ? savedMarksMap[String(examRollVal).trim()] : null) ||
                        (!roll && savedMarksMap[String(name || '').toLowerCase().trim()]) || 
                        {};
          const draft = draftMap[key] || {};

          const pSaved = (saved.practicalMarks !== undefined && saved.practicalMarks !== null && String(saved.practicalMarks).trim() !== '') ? saved.practicalMarks : undefined;
          const vSaved = (saved.vivaMarks !== undefined && saved.vivaMarks !== null && String(saved.vivaMarks).trim() !== '') ? saved.vivaMarks : undefined;

          const pDraft = (draft.practicalMarks !== undefined && draft.practicalMarks !== null && String(draft.practicalMarks).trim() !== '') ? draft.practicalMarks : undefined;
          const vDraft = (draft.vivaMarks !== undefined && draft.vivaMarks !== null && String(draft.vivaMarks).trim() !== '') ? draft.vivaMarks : undefined;

          // If a local draft exists (savedAt is recorded), the teacher's draft edits take precedence over database marks
          const hasLocalDraft = Boolean(localDraftSavedTime && (pDraft !== undefined || vDraft !== undefined));
          const pMarkVal = (hasLocalDraft && pDraft !== undefined)
            ? pDraft
            : (pSaved !== undefined ? pSaved : (pDraft !== undefined ? pDraft : ''));
          const vMarkVal = (hasLocalDraft && vDraft !== undefined)
            ? vDraft
            : (vSaved !== undefined ? vSaved : (vDraft !== undefined ? vDraft : ''));

          const studentFormNo = (st.formNo && String(st.formNo) !== String(roll) && String(st.formNo).length > 3)
            ? st.formNo
            : (st['Form No.'] || st['Form No'] || st['Form Number'] || st.form_no || '');
          const studentRegNo = getRegNo(st) || st.regNo || '';
          const uniqueId = st.id || `prac_${roll || 'noroll'}_${studentFormNo || 'noform'}_${sIdx}`;

          return {
            ...st,
            raw: st,
            _rawStudent: st,
            _uid: uniqueId,
            id: st.id || uniqueId,
            rollNo: roll,
            classRollNo: roll,
            name: name,
            studentName: name,
            "Student's Name": name,
            "Student's Name (as per school records)": name,
            examRollNo: examRollVal,
            subjectsAbbr: subsAbbr,
            rawSubjects: rawSubjFull,
            formNo: studentFormNo,
            regNo: studentRegNo,
            boardRegNo: studentRegNo,
            className: selectedClass,
            class: selectedClass,
            stream: st.stream || st.Stream || st.rawStream || st['Stream'] || '',
            session: yearSuffix || st.session || '',
            isApproved: true,
            practicalMarks: pMarkVal,
            vivaMarks: vMarkVal,
          };
        });

      if (formatted.length === 0 && alternateSessionMatch) {
        setAltSessionAvailable(alternateSessionMatch);
        setAltSessionCount(alternateSessionCount);
      } else {
        setAltSessionAvailable(null);
        setAltSessionCount(0);
      }

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
  }, [selectedClass, selectedSubject, practicalType, yearSuffix, rosterScope]);

  useEffect(() => {
    fetchPracticalData();
  }, [fetchPracticalData]);

  // Real-time Targeted Firestore Sync for Current Evaluation Award (Pending & Canonical)
  // Strictly listens ONLY to the 2 active document IDs (docId & pendingDocId) to stay well under Spark 50k read limits
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !practicalType) return;
    const docId = formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix);
    const pendingDocId = `pending_${docId}`;

    let unsubPending = () => {};
    let unsubCanonical = () => {};

    // 1. Targeted listener on pending staging document
    unsubPending = onSnapshot(doc(db, 'practicalsData', pendingDocId), (pendingSnap) => {
      if (pendingSnap.exists()) {
        const pData = { id: pendingSnap.id, ...pendingSnap.data() };
        const isOwned = isSubmissionOwnedByTeacher(pData, user, auth.currentUser, practicalsSettings);
        if (isOwned) {
          setExistingAwardInfo(prev => ({
            ...prev,
            pending: pData,
            lockedOtherTeacherAward: null
          }));
          if (pData.maxMarks && Number(pData.maxMarks) > 0) {
            setTeacherCustomMax(Number(pData.maxMarks));
          }
        } else {
          setExistingAwardInfo(prev => ({
            ...prev,
            pending: null,
            lockedOtherTeacherAward: {
              id: pendingDocId,
              submittedByName: pData.submittedByName || pData.teacherName || 'Another Faculty Member',
              submittedByEmail: pData.submittedByEmail || '',
              submittedAt: pData.submittedAt || pData.updatedAt,
              recordsCount: Array.isArray(pData.records) ? pData.records.length : 0,
              status: pData.status || 'pending'
            }
          }));
        }
      } else {
        // Document deleted (e.g. upon admin approval or deletion)
        setExistingAwardInfo(prev => {
          if (prev.pending?.id === pendingDocId) {
            return { ...prev, pending: null };
          }
          return prev;
        });
      }
    }, (err) => {
      console.warn('Real-time pending practical award sync note:', err?.message || err);
    });

    // 2. Targeted listener on canonical integrated document
    unsubCanonical = onSnapshot(doc(db, 'practicalsData', docId), (canonicalSnap) => {
      if (canonicalSnap.exists()) {
        const cData = { id: canonicalSnap.id, ...canonicalSnap.data() };
        const isOwned = isSubmissionOwnedByTeacher(cData, user, auth.currentUser, practicalsSettings);
        if (isOwned) {
          const cleanData = { ...cData };
          delete cleanData.rejectionReason;
          delete cleanData.rejectedAt;
          delete cleanData.rejectedBy;

          setExistingAwardInfo(prev => ({
            ...prev,
            canonical: cleanData,
            // When canonical document is approved, clear pending status immediately
            pending: (cData.status === 'approved' || cData.isPendingApproval === false) ? null : prev.pending,
            lockedOtherTeacherAward: null
          }));

          if (cData.maxMarks && Number(cData.maxMarks) > 0) {
            setTeacherCustomMax(Number(cData.maxMarks));
          }

          // If approved or updated by admin, sync records into current table
          if (Array.isArray(cData.records) && cData.records.length > 0 && (cData.status === 'approved' || cData.updatedByAdmin)) {
            setStudentMarks(prev => {
              if (!prev || prev.length === 0) return prev;
              const marksMap = new Map();
              cData.records.forEach(r => {
                const rRoll = getPracticalsStudentRoll(r);
                const rForm = String(r.formNo || '').trim();
                const rName = String(r.name || r.studentName || '').toLowerCase().trim();
                const rReg = String(r.regNo || r.boardRegNo || '').trim().toUpperCase();
                const val = {
                  p: r.practicalMarks !== undefined && r.practicalMarks !== null ? String(r.practicalMarks) : '',
                  v: r.vivaMarks || ''
                };
                if (rRoll) marksMap.set(`roll_${rRoll}`, val);
                if (rForm) marksMap.set(`form_${rForm}`, val);
                if (rReg && rReg.length >= 8) marksMap.set(`reg_${rReg}`, val);
                if (rName) marksMap.set(`name_${rName}`, val);
              });

              return prev.map(st => {
                const rRoll = getPracticalsStudentRoll(st);
                const rForm = String(st.formNo || '').trim();
                const rName = String(st.name || st.studentName || '').toLowerCase().trim();
                const rReg = String(st.regNo || '').trim().toUpperCase();

                const m = marksMap.get(`roll_${rRoll}`) || marksMap.get(`form_${rForm}`) || (rReg.length >= 8 ? marksMap.get(`reg_${rReg}`) : null) || marksMap.get(`name_${rName}`);
                if (m) {
                  return {
                    ...st,
                    practicalMarks: m.p,
                    vivaMarks: m.v
                  };
                }
                return st;
              });
            });
          }
        } else {
          setExistingAwardInfo(prev => ({
            ...prev,
            canonical: null,
            lockedOtherTeacherAward: {
              id: docId,
              submittedByName: cData.submittedByName || cData.teacherName || 'Another Faculty Member',
              submittedByEmail: cData.submittedByEmail || '',
              submittedAt: cData.submittedAt || cData.updatedAt,
              recordsCount: Array.isArray(cData.records) ? cData.records.length : 0,
              status: 'approved'
            }
          }));
        }
      } else {
        setExistingAwardInfo(prev => {
          if (prev.canonical?.id === docId) {
            return { ...prev, canonical: null };
          }
          return prev;
        });
      }
    }, (err) => {
      console.warn('Real-time canonical practical award sync note:', err?.message || err);
    });

    return () => {
      try { unsubPending(); } catch (_) {}
      try { unsubCanonical(); } catch (_) {}
    };
  }, [selectedClass, selectedSubject, practicalType, yearSuffix, user]);

  // Dedicated loader for historical / approved submissions: synchronizes state, updates max marks, maps marks directly into the UI, and performs background cache revalidation
  const handleLoadSubmissionRecord = useCallback((item) => {
    if (!item) return;

    // Strict access control: teacher cannot load another active teacher's award
    if (!isSubmissionOwnedByTeacher(item, user, auth.currentUser, practicalsSettings)) {
      triggerNotification({
        type: 'error',
        title: 'Access Restricted',
        badge: 'Restricted',
        text: 'You cannot view or load evaluation awards submitted by other teachers.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    const rawCls = String(item.className || '');
    const cleanCls = rawCls.includes('11') ? '11th' : (rawCls.includes('12') ? '12th' : (rawCls.includes('10') ? '10th' : (rawCls.includes('9') ? '9th' : '11th')));
    const subj = item.subject && item.subject !== 'N/A' ? item.subject : 'Physics';
    const pType = item.practicalType || item.evaluationType || 'Internal Assessment';
    const ySuffix = item.yearSuffix || CURRENT_SESSION;
    const maxM = item.maxMarks ? Number(item.maxMarks) : null;

    setSelectedClass(cleanCls);
    setSelectedSubject(subj);
    setPracticalType(pType);
    setYearSuffix(ySuffix);
    if (maxM && maxM > 0) {
      setTeacherCustomMax(maxM);
    }

    const itemId = String(item.id || item.docId || '');
    const isApprovedItem = item.status === 'approved' || item.isPendingApproval === false;
    const isPending = !isApprovedItem && (itemId.startsWith('pending_') || item.status === 'pending_approval' || item.status === 'draft' || item.status === 'rejected');
    const cleanItem = { ...item };
    if (isApprovedItem) {
      delete cleanItem.rejectionReason;
      delete cleanItem.rejectedAt;
      delete cleanItem.rejectedBy;
    }
    setExistingAwardInfo({
      canonical: isPending ? null : cleanItem,
      pending: isPending ? cleanItem : null,
      lockedOtherTeacherAward: null
    });

    if (Array.isArray(item.records) && item.records.length > 0) {
      const marksByRoll = new Map();
      const marksByForm = new Map();
      const marksByName = new Map();

      item.records.forEach(r => {
        const rRoll = getPracticalsStudentRoll(r);
        const rForm = String(r.formNo || '').trim();
        const rName = String(r.name || r.studentName || '').toLowerCase().trim();
        const mObj = {
          practicalMarks: r.practicalMarks !== undefined && r.practicalMarks !== null ? String(r.practicalMarks) : '',
          vivaMarks: r.vivaMarks !== undefined && r.vivaMarks !== null ? String(r.vivaMarks) : '',
          totalMarks: r.totalMarks !== undefined && r.totalMarks !== null ? r.totalMarks : (r.practicalMarks || '')
        };
        if (rRoll) {
          marksByRoll.set(rRoll, mObj);
          const num = parseInt(rRoll, 10);
          if (!isNaN(num)) marksByRoll.set(String(num), mObj);
        }
        if (rForm) marksByForm.set(rForm, mObj);
        if (rName && !marksByName.has(rName)) marksByName.set(rName, mObj);
        if (rRoll && rName) marksByName.set(`${rRoll}_${rName}`, mObj);
      });

      setStudentMarks(prev => {
        if (Array.isArray(prev) && prev.length > 0) {
          return prev.map(st => {
            const rollKey = getPracticalsStudentRoll(st);
            const formKey = String(st.formNo || '').trim();
            const nameKey = String(st.name || '').toLowerCase().trim();
            const rollKeyNum = rollKey && !isNaN(parseInt(rollKey, 10)) ? String(parseInt(rollKey, 10)) : '';
            const found = marksByRoll.get(rollKey) || 
                          (rollKeyNum ? marksByRoll.get(rollKeyNum) : null) || 
                          (rollKey && nameKey ? marksByName.get(`${rollKey}_${nameKey}`) : null) ||
                          marksByForm.get(formKey) || 
                          (!rollKey && marksByName.get(nameKey));
            if (found) {
              return {
                ...st,
                practicalMarks: found.practicalMarks,
                vivaMarks: found.vivaMarks
              };
            }
            return st;
          });
        }
        return item.records.map((r, rIdx) => {
          const classRollNo = getPracticalsStudentRoll(r);
          const uId = r._uid || r.id || `rec_${classRollNo || 'noroll'}_${r.formNo || 'noform'}_${rIdx}`;
          return {
            _uid: uId,
            id: r.id || uId,
            classRollNo,
            rollNo: classRollNo,
            name: r.name || r.studentName || '',
            examRollNo: r.examRollNo || r.boardRollNo || '',
            subjectsAbbr: r.subjectsAbbr || subj,
            rawSubjects: r.rawSubjects || subj,
            formNo: r.formNo || '',
            regNo: r.regNo || '',
            practicalMarks: r.practicalMarks !== undefined && r.practicalMarks !== null ? String(r.practicalMarks) : '',
            vivaMarks: r.vivaMarks !== undefined && r.vivaMarks !== null ? String(r.vivaMarks) : ''
          };
        });
      });
    }

    setShowHistoryModal(false);

    triggerNotification({
      type: 'success',
      title: 'Evaluation Record Loaded',
      badge: isPending ? 'Draft / Pending' : 'Approved Award',
      text: `Successfully loaded ${item.recordsCount || item.records?.length || 0} student records for ${cleanCls} • ${subj} (${pType}).`,
      primaryButtonText: 'OK'
    });

    setTimeout(() => {
      fetchPracticalData(true);
    }, 50);
  }, [fetchPracticalData, triggerNotification, user]);

  // Synchronize submission if navigated with loadedRecord from Dashboard
  useEffect(() => {
    if (location.state?.loadedRecord) {
      if (!isSubmissionOwnedByTeacher(location.state.loadedRecord, user, auth.currentUser, practicalsSettings)) {
        triggerNotification({
          type: 'error',
          title: 'Access Restricted',
          badge: 'Restricted',
          text: 'You cannot view or load evaluation awards submitted by other teachers.',
          primaryButtonText: 'Dismiss'
        });
        return;
      }
      handleLoadSubmissionRecord(location.state.loadedRecord);
    }
  }, [location.state?.loadedRecord, handleLoadSubmissionRecord, user, triggerNotification]);

  // Fetch Past Submission History across all evaluation types
  const fetchSubmissionHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const teacherEmail = String(auth.currentUser?.email || user?.email || '').trim().toLowerCase();
      if (!teacherEmail) {
        setSubmissionHistory([]);
        return;
      }
      // Current secure records always store submittedByEmail. The second query
      // retains access to historical records created by earlier portal builds.
      const [submittedBySnap, legacyTeacherSnap] = await Promise.all([
        getDocs(query(collection(db, 'practicalsData'), where('submittedByEmail', '==', teacherEmail), limit(150))),
        getDocs(query(collection(db, 'practicalsData'), where('teacherEmail', '==', teacherEmail), limit(150)))
      ]);
      const historyById = new Map();
      [submittedBySnap, legacyTeacherSnap].forEach(snap => {
        snap.docs.forEach(d => historyById.set(d.id, { id: d.id, ...d.data() }));
      });
      const rawDocs = [...historyById.values()];

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

            // Practicals portal strictly holds practical data only (Internal Assessment & External Practical)
            const evalTypeRaw = d.practicalType || d.evaluationType || d.examTitle || d.title || '';
            if (!isPracticalEvaluationType(evalTypeRaw)) return false;

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
              let dateObj = null;
              if (typeof rawTime?.toDate === 'function') {
                dateObj = rawTime.toDate();
              } else if (rawTime?.seconds) {
                dateObj = new Date(rawTime.seconds * 1000);
              } else if (rawTime instanceof Date) {
                dateObj = rawTime;
              } else {
                dateObj = new Date(rawTime);
              }

              if (dateObj && !isNaN(dateObj.getTime())) {
                sortTime = dateObj.getTime();
                displayDate = formatSubmissionDate(dateObj);
              } else {
                displayDate = String(rawTime);
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

        const ownedList = deduped.filter(item => isSubmissionOwnedByTeacher(item, user, auth.currentUser, practicalsSettings));
        setSubmissionHistory(ownedList);
      } else {
        setSubmissionHistory([]);
      }
    } catch (e) {
      console.error('Failed to load submissions history:', e);
      setSubmissionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  // Auto-open Submissions History if navigated from Dashboard link (?view=history or state.openHistory)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'history' || params.get('history') === 'true' || location.state?.openHistory) {
      setShowHistoryModal(true);
      fetchSubmissionHistory();
    }
  }, [location, fetchSubmissionHistory]);

  // Auto-fetch fresh submission records whenever the modal is shown
  useEffect(() => {
    if (showHistoryModal) {
      fetchSubmissionHistory();
    }
  }, [showHistoryModal, fetchSubmissionHistory]);

  // Handle Mark Change — full range 0 to subjectMaxMarks allowed
  const handleMarkChange = (studentOrIdx, field, val) => {
    const rawVal = val.trim().toUpperCase();
    if (rawVal !== '' && rawVal !== 'A' && rawVal !== 'AB' && rawVal !== 'ABS' && rawVal !== 'ABSENT') {
      const num = Number(rawVal);
      // Allow full range 0 to max (not split 70/30)
      if (isNaN(num) || num < 0 || num > subjectMaxMarks) {
        return;
      }
    }

    setStudentMarks((prev) => {
      let targetIdx = -1;
      if (typeof studentOrIdx === 'number') {
        targetIdx = studentOrIdx;
      } else if (studentOrIdx && typeof studentOrIdx === 'object') {
        // 0. Direct object reference equality (instant, 100% collision-proof)
        targetIdx = prev.indexOf(studentOrIdx);

        const targetUid = studentOrIdx._uid || studentOrIdx.id;
        const targetRoll = studentOrIdx.rollNo !== undefined && studentOrIdx.rollNo !== null ? String(studentOrIdx.rollNo).trim() : '';
        const targetName = (studentOrIdx.name || studentOrIdx.studentName || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const targetReg = studentOrIdx.registrationNumber || studentOrIdx.regNo || studentOrIdx.registration_no || '';
        const cleanReg = targetReg ? String(targetReg).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        const isPlaceholderReg = !cleanReg || cleanReg.length < 4 || /^(na|nil|none|pending|null)$/.test(cleanReg);
        const targetForm = studentOrIdx.formNo ? String(studentOrIdx.formNo).trim() : '';
        const isPlaceholderForm = !targetForm || targetForm.length < 3 || /^(0|na|nil|null|-)$/i.test(targetForm);

        // 1. Primary check: Exact unique identifier (_uid or id) with string coercion
        if (targetIdx < 0 && targetUid !== undefined && targetUid !== null) {
          const targetUidStr = String(targetUid).trim();
          targetIdx = prev.findIndex(s => {
            const sUid = s._uid !== undefined && s._uid !== null ? String(s._uid).trim() : '';
            const sId = s.id !== undefined && s.id !== null ? String(s.id).trim() : '';
            return (sUid && sUid === targetUidStr) || (sId && sId === targetUidStr);
          });
        }

        // 2. Strict Roll Number matching (PRIORITIZED FOR NAMESAKES)
        if (targetIdx < 0 && targetRoll) {
          targetIdx = prev.findIndex(s => {
            const sRoll = s.rollNo !== undefined && s.rollNo !== null ? String(s.rollNo).trim() : '';
            if (!sRoll) return false;
            const rollMatches = sRoll === targetRoll || parseInt(sRoll, 10) === parseInt(targetRoll, 10);
            if (!rollMatches) return false;

            const sName = (s.name || s.studentName || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!targetName || !sName) return true;
            return sName === targetName || sName.includes(targetName) || targetName.includes(sName);
          });
        }

        // 3. Verified Board Registration Number matching
        if (targetIdx < 0 && !isPlaceholderReg) {
          targetIdx = prev.findIndex(s => {
            const sReg = s.registrationNumber || s.regNo || s.registration_no || '';
            const sClean = sReg ? String(sReg).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
            if (sClean && sClean.length >= 4 && sClean === cleanReg) {
              const sRoll = s.rollNo !== undefined && s.rollNo !== null ? String(s.rollNo).trim() : '';
              if (!targetRoll || !sRoll || targetRoll === sRoll || parseInt(targetRoll, 10) === parseInt(sRoll, 10)) return true;
            }
            return false;
          });
        }

        // 4. Form Number matching
        if (targetIdx < 0 && !isPlaceholderForm) {
          targetIdx = prev.findIndex(s => {
            const sForm = s.formNo ? String(s.formNo).trim() : '';
            if (sForm && sForm === targetForm) {
              const sRoll = s.rollNo !== undefined && s.rollNo !== null ? String(s.rollNo).trim() : '';
              if (!targetRoll || !sRoll || targetRoll === sRoll || parseInt(targetRoll, 10) === parseInt(sRoll, 10)) return true;
            }
            return false;
          });
        }

        // 5. Exact Student Name match ONLY IF NO ROLL NUMBER WAS SPECIFIED (avoids namesake hijacking!)
        if (targetIdx < 0 && targetName && !targetRoll) {
          targetIdx = prev.findIndex(s => {
            const sName = (s.name || s.studentName || '').toLowerCase().replace(/\s+/g, ' ').trim();
            return sName && targetName === sName;
          });
        }
      }

      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const updated = [...prev];
      const curRec = updated[targetIdx];
      const isExplicitAbs = rawVal === 'A' || rawVal === 'AB' || rawVal === 'ABS' || rawVal === 'ABSENT';
      const isNumeric = rawVal !== '' && !isExplicitAbs && !isNaN(Number(rawVal));

      let newV = curRec.vivaMarks;
      let newP = curRec.practicalMarks;

      if (field === 'practicalMarks') {
        newP = isExplicitAbs ? 'AB' : rawVal;
        if (isExplicitAbs) {
          newV = 'AB';
        } else if (isNumeric) {
          if (newV === 'AB' || newV === 'A' || newV === 'ABS' || newV === 'ABSENT') {
            newV = '';
          }
        }
      } else if (field === 'vivaMarks') {
        newV = isExplicitAbs ? 'AB' : rawVal;
        if (isExplicitAbs) {
          newP = 'AB';
        }
      }

      updated[targetIdx] = {
        ...curRec,
        practicalMarks: newP,
        vivaMarks: newV,
      };
      return updated;
    });
  };

  // Seamless Keyboard Navigation between student marks inputs (Next / Enter / Tab / Arrows)
  const handleInputKeyDown = (e, currentIndex, mode = 'mobile') => {
    const isNext = e.key === 'Enter' || e.keyCode === 13 || e.which === 13 || (e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown';
    const isPrev = (e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp';

    if (isNext) {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (nextIndex < displayedStudents.length) {
        const nextId = `practical-mark-input-${mode}-${nextIndex}`;
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          try {
            nextEl.select();
          } catch (_) {}
          try {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (_) {
            nextEl.scrollIntoView();
          }
          setTimeout(() => {
            try {
              nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (_) {}
          }, 60);
        }
      } else {
        // Last student in roster: dismiss virtual keyboard smoothly
        e.target?.blur();
      }
    } else if (isPrev) {
      e.preventDefault();
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        const prevId = `practical-mark-input-${mode}-${prevIndex}`;
        const prevEl = document.getElementById(prevId);
        if (prevEl) {
          prevEl.focus();
          try {
            prevEl.select();
          } catch (_) {}
          try {
            prevEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (_) {
            prevEl.scrollIntoView();
          }
          setTimeout(() => {
            try {
              prevEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (_) {}
          }, 60);
        }
      }
    }
  };

  // 1. Save Evaluation Draft (Cloud Database + LocalStorage fallback)
  const handleSaveDraft = async () => {
    if (user?.active === false || user?.deactivated === true) {
      triggerNotification({
        type: 'error',
        title: 'Account Deactivated',
        badge: 'Transferred / Inactive',
        text: 'This staff account has been deactivated or transferred. Submitting or editing evaluation records is restricted. Please contact administration.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (existingAwardInfo?.lockedOtherTeacherAward) {
      triggerNotification({
        type: 'error',
        title: 'Draft Restricted',
        badge: 'Restricted',
        text: 'You cannot edit or save drafts for this award as it was submitted by another faculty member.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

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
    if (!isSubmissionOpen || !isClassPracticalSubmissionEnabled(practicalsSettings, selectedClass)) {
      triggerNotification({
        type: 'error',
        title: 'Submissions Locked',
        badge: 'Locked',
        text: `Practical and internal marks submission is currently closed for Class ${selectedClass} by administration.`,
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

      const docId = formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix);
      const pendingDocId = `pending_${docId}`;

      // Archive previous version to Bin if an official or pending record already exists
      if (existingAwardInfo?.canonical && Array.isArray(existingAwardInfo.canonical.records) && existingAwardInfo.canonical.records.length > 0) {
        saveVersionToBin(docId, existingAwardInfo.canonical, 'teacher_draft_update', {
          name: user?.name || auth.currentUser?.displayName,
          email: auth.currentUser?.email
        }).catch(() => {});
      }

      const records = studentMarks
        .filter(s => !checkIsStudentDropped(s) && !isStudentExamDropped(s))
        .map((s) => {
        const pRaw = String(s.practicalMarks !== undefined && s.practicalMarks !== null ? s.practicalMarks : '').trim().toUpperCase();
        const vRaw = String(s.vivaMarks !== undefined && s.vivaMarks !== null ? s.vivaMarks : '').trim().toUpperCase();

        const pIsNum = !isNaN(Number(pRaw)) && pRaw !== '';
        const vIsNum = !isNaN(Number(vRaw)) && vRaw !== '';
        const pIsAbs = pRaw === 'A' || pRaw === 'AB' || pRaw === 'ABS' || pRaw === 'ABSENT';
        const vIsAbs = vRaw === 'A' || vRaw === 'AB' || vRaw === 'ABS' || vRaw === 'ABSENT';

        let pMarks = '';
        let vMarks = '';
        let totalMarks = '';

        if (pIsNum || vIsNum) {
          let pVal = pIsNum ? Number(pRaw) : 0;
          let vVal = (vIsNum && !vIsAbs) ? Number(vRaw) : 0;
          if (pVal < 0) pVal = 0;
          if (pVal > subjectMaxMarks) pVal = subjectMaxMarks;
          if (vVal < 0) vVal = 0;
          if (vVal > subjectMaxMarks) vVal = subjectMaxMarks;
          pMarks = pIsNum ? String(pVal) : '';
          vMarks = vIsNum ? String(vVal) : '';
          totalMarks = Math.min(subjectMaxMarks, pVal + vVal);
        } else if (pIsAbs || vIsAbs) {
          pMarks = 'AB';
          vMarks = 'AB';
          totalMarks = 'AB';
        }

        return {
          classRollNo: getPracticalsStudentRoll(s),
          rollNo: getPracticalsStudentRoll(s),
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
        teacherRegisteredSubject: teacherClassRegisteredSubject || teacherRegisteredSubject || '',
        isCrossSubject,
        isOverwrite,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveAcademicRecord('practicalsData', pendingDocId, submissionPayload);
      invalidateCollectionCache('practicalsData');
      logTeacherActivity({
        actionType: 'update',
        actionTitle: `Saved Evaluation Draft: ${selectedSubject} (${selectedClass})`,
        details: `Saved ${practicalType} draft for ${selectedClass} - ${selectedSubject} with ${submissionPayload.records?.length || 0} candidate entries.`,
        subject: selectedSubject,
        className: selectedClass,
        targetId: pendingDocId,
        metadata: { practicalType, session: yearSuffix, isDraft: true }
      });
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
    if (user?.active === false || user?.deactivated === true) {
      triggerNotification({
        type: 'error',
        title: 'Account Deactivated',
        badge: 'Transferred / Inactive',
        text: 'This staff account has been deactivated or transferred. Submitting or editing evaluation records is restricted. Please contact administration.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (!isSubmissionOpen || !isClassPracticalSubmissionEnabled(practicalsSettings, selectedClass)) {
      triggerNotification({
        type: 'error',
        title: 'Submissions Locked',
        badge: 'Locked',
        text: `Practical and internal marks submission is currently closed for Class ${selectedClass} by administration.`,
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (existingAwardInfo?.lockedOtherTeacherAward) {
      triggerNotification({
        type: 'error',
        title: 'Submission Restricted',
        badge: 'Restricted',
        text: 'You cannot submit an evaluation award for this class and subject as it was submitted by another faculty member.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

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
      const hasNumeric = (!isNaN(Number(st.practicalMarks)) && String(st.practicalMarks).trim() !== '') || (!isNaN(Number(st.vivaMarks)) && String(st.vivaMarks).trim() !== '');
      const isAbsent = !hasNumeric && (st.practicalMarks === 'A' || st.vivaMarks === 'A' || st.practicalMarks === 'AB' || st.vivaMarks === 'AB');
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

  // Helper: Inline resolve an incomplete student directly from inside the Validation Modal
  const handleModalResolveMark = (targetStudent, val) => {
    const rawVal = String(val !== undefined && val !== null ? val : '').trim().toUpperCase();
    
    // 1. Update canonical studentMarks state
    handleMarkChange(targetStudent, 'practicalMarks', rawVal);

    // 2. Dynamically recalculate validationData so modal updates immediately in real-time
    setValidationData(prev => {
      if (!prev) return prev;
      const targetRoll = String(targetStudent.rollNo || '').trim();
      const targetUid = targetStudent._uid || targetStudent.id;
      
      const nextList = prev.incompleteList.map(st => {
        const sRoll = String(st.rollNo || '').trim();
        const sUid = st._uid || st.id;
        const isMatch = (targetUid && sUid && String(targetUid).trim() === String(sUid).trim()) || 
                        (targetRoll && sRoll && (targetRoll === sRoll || parseInt(targetRoll, 10) === parseInt(sRoll, 10)));
        if (isMatch) {
          const isAbs = rawVal === 'A' || rawVal === 'AB' || rawVal === 'ABS' || rawVal === 'ABSENT';
          return {
            ...st,
            practicalMarks: isAbs ? 'AB' : rawVal,
            vivaMarks: isAbs ? 'AB' : st.vivaMarks
          };
        }
        return st;
      });

      const remainingIncomplete = nextList.filter(st => {
        const p = String(st.practicalMarks !== undefined && st.practicalMarks !== null ? st.practicalMarks : '').trim();
        const v = String(st.vivaMarks !== undefined && st.vivaMarks !== null ? st.vivaMarks : '').trim();
        return p === '' && v === '';
      });

      const totalCount = prev.totalCount;
      const incompleteCount = remainingIncomplete.length;
      const completedCount = totalCount - incompleteCount;

      let currentAbsent = 0;
      nextList.forEach(st => {
        const p = String(st.practicalMarks || '').trim().toUpperCase();
        const v = String(st.vivaMarks || '').trim().toUpperCase();
        if (p === 'A' || p === 'AB' || p === 'ABS' || p === 'ABSENT' || v === 'A' || v === 'AB' || v === 'ABS' || v === 'ABSENT') {
          currentAbsent++;
        }
      });

      return {
        ...prev,
        incompleteList: remainingIncomplete,
        incompleteCount,
        completedCount,
        absentCount: currentAbsent
      };
    });
  };

  // Helper: Mark all remaining incomplete students in the modal as Absent with one click
  const handleModalMarkAllAbsent = () => {
    if (!validationData?.incompleteList || validationData.incompleteList.length === 0) return;
    
    validationData.incompleteList.forEach(st => {
      handleMarkChange(st, 'practicalMarks', 'AB');
    });

    setValidationData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        incompleteList: [],
        incompleteCount: 0,
        completedCount: prev.totalCount,
        absentCount: prev.absentCount + prev.incompleteCount
      };
    });
  };

  // 3. Execute Final Submission to Firestore
  const executeFinalSubmit = async (autoMarkAbsentForUnfilled = true) => {
    if (user?.active === false || user?.deactivated === true) {
      triggerNotification({
        type: 'error',
        title: 'Account Deactivated',
        badge: 'Transferred / Inactive',
        text: 'This staff account has been deactivated or transferred. Submitting or editing evaluation records is restricted. Please contact administration.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (!isSubmissionOpen || !isClassPracticalSubmissionEnabled(practicalsSettings, selectedClass)) {
      triggerNotification({
        type: 'error',
        title: 'Submissions Locked',
        badge: 'Locked',
        text: `Practical and internal marks submission is currently closed for Class ${selectedClass} by administration.`,
        primaryButtonText: 'Dismiss'
      });
      return;
    }
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

      const records = studentMarks
        .filter(s => !checkIsStudentDropped(s) && !isStudentExamDropped(s))
        .map((s) => {
        let pMarks = String(s.practicalMarks !== undefined && s.practicalMarks !== null ? s.practicalMarks : '').trim().toUpperCase();
        let vMarks = String(s.vivaMarks !== undefined && s.vivaMarks !== null ? s.vivaMarks : '').trim().toUpperCase();

        // If requested, auto-mark unfilled students as Absent (AB), otherwise keep them blank/pending
        if (pMarks === '' && vMarks === '') {
          if (autoMarkAbsentForUnfilled) {
            pMarks = 'AB';
            vMarks = 'AB';
          }
        }

        const pIsNum = !isNaN(Number(pMarks)) && pMarks !== '';
        const vIsNum = !isNaN(Number(vMarks)) && vMarks !== '';
        const pIsAbs = pMarks === 'A' || pMarks === 'AB' || pMarks === 'ABS' || pMarks === 'ABSENT';
        const vIsAbs = vMarks === 'A' || vMarks === 'AB' || vMarks === 'ABS' || vMarks === 'ABSENT';

        let finalP = pMarks;
        let finalV = vMarks;
        let total = '';

        if (pIsNum || vIsNum) {
          let pVal = pIsNum ? Number(pMarks) : 0;
          let vVal = (vIsNum && !vIsAbs) ? Number(vMarks) : 0;
          if (pVal < 0) pVal = 0;
          if (pVal > subjectMaxMarks) pVal = subjectMaxMarks;
          if (vVal < 0) vVal = 0;
          if (vVal > subjectMaxMarks) vVal = subjectMaxMarks;
          finalP = pIsNum ? String(pVal) : '';
          finalV = vIsNum ? String(vVal) : '';
          total = Math.min(subjectMaxMarks, pVal + vVal);
        } else if (pIsAbs || vIsAbs) {
          finalP = 'AB';
          finalV = 'AB';
          total = 'AB';
        }

        return {
          classRollNo: getPracticalsStudentRoll(s),
          rollNo: getPracticalsStudentRoll(s),
          name: String(s.name || '').trim().slice(0, 120),
          formNo: String(s.formNo || '').trim().slice(0, 50),
          regNo: String(s.regNo || s.boardRegNo || '').trim().slice(0, 50),
          examRollNo: String(s.examRollNo || '').trim().slice(0, 50),
          practicalMarks: finalP,
          vivaMarks: finalV,
          totalMarks: total,
          marksInWords: total === 'AB' ? 'Absent' : (total === '' ? '' : numberToWords(total)),
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
        teacherRegisteredSubject: teacherClassRegisteredSubject || teacherRegisteredSubject || '',
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

      // 1. If teacher submits another overwrite request while a prior pending submission was already awaiting admin approval,
      // automatically move the prior unapproved submission into the Recycle Bin for reference & auditing to guarantee data consistency.
      let previousPending = existingAwardInfo?.pending;
      if (!previousPending) {
        try {
          const livePendingSnap = await getDoc(doc(db, 'practicalsData', pendingDocId));
          if (livePendingSnap.exists()) {
            previousPending = { id: livePendingSnap.id, ...livePendingSnap.data() };
          }
        } catch (_) {}
      }

      if (previousPending && Array.isArray(previousPending.records) && previousPending.records.length > 0) {
        await archiveSupersededPendingSubmission(previousPending, {
          name: user?.name || auth.currentUser?.displayName,
          email: auth.currentUser?.email
        }, docId).catch((e) => console.warn('Archiving superseded pending practical error:', e));
      }

      // 2. Also archive canonical approved record in Version Bin if resubmitting/overwriting
      if (existingAwardInfo?.canonical && Array.isArray(existingAwardInfo.canonical.records) && existingAwardInfo.canonical.records.length > 0) {
        await saveVersionToBin(docId, existingAwardInfo.canonical, 'teacher_resubmission', {
          name: user?.name || auth.currentUser?.displayName,
          email: auth.currentUser?.email
        }).catch(() => {});
      }

      await saveAcademicRecord('practicalsData', pendingDocId, submissionPayload);
      invalidateCollectionCache('practicalsData');
      logTeacherActivity({
        actionType: 'submit',
        actionTitle: `Submitted Evaluation Award: ${selectedSubject} (${selectedClass})`,
        details: `Teacher ${user?.name || auth.currentUser?.displayName || 'Faculty'} submitted ${practicalType} award for ${selectedClass} - ${selectedSubject} (${submissionPayload.records?.length || 0} candidates).`,
        subject: selectedSubject,
        className: selectedClass,
        targetId: pendingDocId,
        metadata: {
          practicalType,
          session: yearSuffix,
          recordsCount: submissionPayload.records?.length || 0,
          maxMarks: submissionPayload.maxMarks,
          minMarks: submissionPayload.minMarks
        }
      });
      setExistingAwardInfo(prev => ({ ...prev, pending: submissionPayload }));

      // Update studentMarks in state so the table immediately displays 'AB' for any previously unfilled students if opted
      if (autoMarkAbsentForUnfilled) {
        setStudentMarks(prev => prev.map(st => {
          const p = String(st.practicalMarks !== undefined && st.practicalMarks !== null ? st.practicalMarks : '').trim().toUpperCase();
          const v = String(st.vivaMarks !== undefined && st.vivaMarks !== null ? st.vivaMarks : '').trim().toUpperCase();
          if (p === '' && v === '') {
            return { ...st, practicalMarks: 'AB', vivaMarks: 'AB' };
          }
          return st;
        }));
      }

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
          fetchSubmissionHistory();
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
    if (existingAwardInfo?.lockedOtherTeacherAward) {
      triggerNotification({
        type: 'error',
        title: 'Print Restricted',
        badge: 'Restricted',
        text: 'You cannot print evaluation awards submitted by other faculty members.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

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

    const sortedStudentMarks = sortedStudents && sortedStudents.length > 0 ? sortedStudents : sortRecordsForAwardRoll(studentMarks);
    const recordsForPrint = sortedStudentMarks.map((st, i) => {
      const cleanExam = getRecordExamRoll(st);
      return {
        ...st,
        sno: i + 1,
        classRollNo: getPracticalsStudentRoll(st),
        rollNo: cleanExam || getPracticalsStudentRoll(st),
        examRollNo: cleanExam,
        centreNo: st.centreNo || '',
        name: st.name || st.studentName || '',
        practicalMarks: st.practicalMarks || '—',
        vivaMarks: st.vivaMarks || '—',
        totalMarks: (st.practicalMarks && st.practicalMarks.toUpperCase() === 'AB') ? 'AB' : (st.totalMarks || st.practicalMarks || '—')
      };
    });

    const isExternal = practicalType.toLowerCase().includes('external');
    const isBiAnnual = /\b(oct|nov|bian|private|bi-annual|mar-apr)\b/i.test(yearSuffix);
    const sessionStr = isBiAnnual
      ? `Annual Private / Bi-Annual (${yearSuffix})`
      : (yearSuffix.toLowerCase().includes('annual') ? yearSuffix : `Annual Regular ${yearSuffix}`);

    const subCode = currentSubjectObj?.code || 'EN';
    const subName = currentSubjectObj?.name || selectedSubject || 'General English';

    const success = printIndividualAwardRoll({
      subjectCode: subCode,
      subjectName: subName,
      className: selectedClass,
      session: sessionStr,
      records: recordsForPrint,
      isExternal,
      evaluationType: practicalType,
      practicalType,
      examTitle: activeEvalOption?.title || activeEvalOption?.label || practicalType,
      maxMarks: subjectMaxMarks,
      minMarks: minPassMarks,
      preserveOrder: true
    });

    if (success === false) {
      triggerNotification({
        type: 'error',
        title: 'Print Failed',
        badge: 'Error',
        text: 'Unable to open print preview for Official Award Roll.',
        primaryButtonText: 'Dismiss'
      });
    }
  };

  const handlePrintBlankMarksRecord = () => {
    if (existingAwardInfo?.lockedOtherTeacherAward) {
      triggerNotification({
        type: 'error',
        title: 'Print Restricted',
        badge: 'Restricted',
        text: 'You cannot print evaluation awards submitted by other faculty members.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (!studentMarks || studentMarks.length === 0) {
      triggerNotification({
        type: 'error',
        title: 'Cannot Print Blank Marks Record',
        badge: 'Empty Award List',
        text: 'No student records available to print.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    const isExternal = practicalType.toLowerCase().includes('external');
    const isBiAnnual = /\b(oct|nov|bian|private|bi-annual|mar-apr)\b/i.test(yearSuffix);
    const sessionStr = isBiAnnual
      ? `Annual Private / Bi-Annual (${yearSuffix})`
      : (yearSuffix.toLowerCase().includes('annual') ? yearSuffix : `Annual Regular ${yearSuffix}`);

    const subCode = currentSubjectObj?.code || 'EN';
    const subName = currentSubjectObj?.name || selectedSubject || 'General English';

    const success = printMarksRecordAwardRoll({
      className: selectedClass,
      session: sessionStr,
      students: sortedStudents && sortedStudents.length > 0 ? sortedStudents : studentMarks,
      isExternal,
      evaluationType: practicalType,
      practicalType,
      subjectCode: subCode,
      subjectName: subName,
      printDetails: { settings: practicalsSettings },
      preserveOrder: true
    });

    if (success === false) {
      triggerNotification({
        type: 'error',
        title: 'Print Failed',
        badge: 'Error',
        text: 'Unable to open print preview for Blank Marks Record.',
        primaryButtonText: 'Dismiss'
      });
    }
  };

  const handlePrintBlankAwardRoll = () => {
    if (existingAwardInfo?.lockedOtherTeacherAward) {
      triggerNotification({
        type: 'error',
        title: 'Print Restricted',
        badge: 'Restricted',
        text: 'You cannot print evaluation awards submitted by other faculty members.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (!studentMarks || studentMarks.length === 0) {
      triggerNotification({
        type: 'error',
        title: 'Cannot Print Blank Award Roll',
        badge: 'Empty Award List',
        text: 'No student records available to print.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    const sortedStudentMarks = sortedStudents && sortedStudents.length > 0 ? sortedStudents : sortRecordsForAwardRoll(studentMarks);
    const recordsForPrint = sortedStudentMarks.map((st, i) => {
      const cleanExam = getRecordExamRoll(st);
      return {
        ...st,
        sno: i + 1,
        classRollNo: getPracticalsStudentRoll(st),
        rollNo: cleanExam || getPracticalsStudentRoll(st),
        examRollNo: cleanExam,
        centreNo: st.centreNo || '',
        name: st.name || st.studentName || '',
        practicalMarks: '',
        vivaMarks: '',
        totalMarks: '',
        marks: ''
      };
    });

    const isExternal = practicalType.toLowerCase().includes('external');
    const isBiAnnual = /\b(oct|nov|bian|private|bi-annual|mar-apr)\b/i.test(yearSuffix);
    const sessionStr = isBiAnnual
      ? `Annual Private / Bi-Annual (${yearSuffix})`
      : (yearSuffix.toLowerCase().includes('annual') ? yearSuffix : `Annual Regular ${yearSuffix}`);

    const subCode = currentSubjectObj?.code || 'EN';
    const subName = currentSubjectObj?.name || selectedSubject || 'General English';

    const success = printIndividualAwardRoll({
      subjectCode: subCode,
      subjectName: subName,
      className: selectedClass,
      session: sessionStr,
      records: recordsForPrint,
      isExternal,
      evaluationType: practicalType,
      practicalType,
      examTitle: activeEvalOption?.title || activeEvalOption?.label || practicalType,
      maxMarks: subjectMaxMarks,
      minMarks: minPassMarks,
      isBlank: true,
      isBlankAwardRoll: true,
      preserveOrder: true
    });

    if (success === false) {
      triggerNotification({
        type: 'error',
        title: 'Print Failed',
        badge: 'Error',
        text: 'Unable to open print preview for Blank Award Roll.',
        primaryButtonText: 'Dismiss'
      });
    }
  };

  const handlePrintAttendanceSheet = () => {
    if (existingAwardInfo?.lockedOtherTeacherAward) {
      triggerNotification({
        type: 'error',
        title: 'Print Restricted',
        badge: 'Restricted',
        text: 'You cannot print attendance sheets for awards submitted by other faculty members.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    if (!studentMarks || studentMarks.length === 0) {
      triggerNotification({
        type: 'error',
        title: 'Cannot Print Attendance Sheet',
        badge: 'Empty Student List',
        text: 'No student records available to print.',
        primaryButtonText: 'Dismiss'
      });
      return;
    }

    const isExternal = practicalType.toLowerCase().includes('external');
    const isBiAnnual = /\b(oct|nov|bian|private|bi-annual|mar-apr)\b/i.test(yearSuffix);
    const sessionStr = isBiAnnual
      ? `Annual Private / Bi-Annual (${yearSuffix})`
      : (yearSuffix.toLowerCase().includes('annual') ? yearSuffix : `Annual Regular ${yearSuffix}`);

    const subCode = currentSubjectObj?.code || 'EN';
    const subName = currentSubjectObj?.name || selectedSubject || 'General English';

    const success = printAttendanceSheet({
      className: selectedClass,
      session: sessionStr,
      students: sortedStudents && sortedStudents.length > 0 ? sortedStudents : studentMarks,
      isExternal,
      evaluationType: practicalType,
      practicalType,
      subjectCode: subCode,
      subjectName: subName,
      preserveOrder: true
    });

    if (success === false) {
      triggerNotification({
        type: 'error',
        title: 'Print Failed',
        badge: 'Error',
        text: 'Unable to open print preview for Attendance Sheet.',
        primaryButtonText: 'Dismiss'
      });
    }
  };

  // Dynamic Multi-Column Sorting
  const sortedStudents = [...studentMarks].sort((a, b) => {
    if (sortBy === 'examAsc') {
      const eA = getRecordExamRoll(a);
      const eB = getRecordExamRoll(b);
      if (eA && eB) {
        const cmp = eA.localeCompare(eB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      if (eA && !eB) return -1;
      if (!eA && eB) return 1;
      const rA = parseInt(a.rollNo, 10) || 0;
      const rB = parseInt(b.rollNo, 10) || 0;
      return rA - rB;
    }
    if (sortBy === 'examDesc') {
      const eA = getRecordExamRoll(a);
      const eB = getRecordExamRoll(b);
      if (eA && eB) {
        const cmp = eB.localeCompare(eA, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      if (eA && !eB) return 1;
      if (!eA && eB) return -1;
      const rA = parseInt(a.rollNo, 10) || 0;
      const rB = parseInt(b.rollNo, 10) || 0;
      return rB - rA;
    }
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
      return (a.name || a.studentName || '').localeCompare(b.name || b.studentName || '');
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
        const hasNumeric = (!isNaN(Number(s.practicalMarks)) && String(s.practicalMarks).trim() !== '') || (!isNaN(Number(s.vivaMarks)) && String(s.vivaMarks).trim() !== '');
        const isAbsent = !hasNumeric && (s.practicalMarks === 'A' || s.vivaMarks === 'A' || s.practicalMarks === 'AB' || s.vivaMarks === 'AB');
        if (isAbsent) return true;
        if (s.practicalMarks === '' && s.vivaMarks === '') return true;
        const total = (Number(s.practicalMarks) || 0) + (Number(s.vivaMarks) || 0);
        return total < minPassMarks;
      })
    : sortedStudents;

  // ── Multi-Select & Bulk Fill Calculations ──
  const getStudentKey = useCallback((st) => {
    return String(st._uid || st.id || (st.rollNo ? `roll_${st.rollNo}` : '') || st.formNo || st.regNo || st.name);
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
    if (!isSubmissionOpen || !isSubmissionOpenForCurrentClass) {
      triggerNotification({
        type: 'error',
        title: 'Submissions Locked',
        badge: 'Admin Lock',
        text: `Practical and internal marks submission is currently closed for Class ${selectedClass} across all sessions by administration.`,
        primaryButtonText: 'Dismiss'
      });
      return;
    }

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
                  {selectedClass} • {currentSubjectObj?.name || selectedSubject} ({currentSubjectObj?.code || 'EN'})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {teacherClassRegisteredSubject && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20" title={`Your officially assigned teaching subject for ${selectedClass} is ${teacherClassRegisteredSubject}`}>
                  <Award size={11} className="text-emerald-600" />
                  <span className="hidden xs:inline">Assigned:</span> {teacherClassRegisteredSubject}
                </span>
              )}
              {(!isSubmissionOpen || !isSubmissionOpenForCurrentClass) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20" title={`Practical marks submission for Class ${selectedClass} is closed by administration.`}>
                  <Lock size={10} className="text-rose-600 dark:text-rose-400" />
                  <span>SUBMISSIONS LOCKED</span>
                </span>
              ) : (
                <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck size={10} /> LAB EVALUATION
                </div>
              )}
            </div>
          </div>

          {/* Alert Notification */}
          {(!isSubmissionOpen || !isSubmissionOpenForCurrentClass) && (
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 font-extrabold flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/25 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                  <ShieldAlert size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-black text-amber-950 dark:text-amber-100 text-xs sm:text-[13px] flex items-center gap-1.5 flex-wrap">
                    <span>Practical Submissions for Class {selectedClass} are Currently Closed</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-600/20 text-amber-900 dark:text-amber-300 text-[9.5px] uppercase font-mono font-black">Admin Lock</span>
                  </div>
                  <p className="text-[11px] font-medium text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-snug">
                    Marks entry and online submissions for <strong>Class {selectedClass}</strong> have been locked by administration. Student rosters are available for viewing and offline physical award printouts, but marks cannot be submitted online until authorized.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/30 text-[10.5px] font-black uppercase shrink-0">
                <Lock size={12} /> View-Only Mode
              </span>
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
                    You are officially registered for <strong>{teacherClassRegisteredSubject || teacherRegisteredSubject}</strong>, but are currently evaluating <strong>{selectedSubject}</strong>. You may submit awards, but this submission will be flagged as a Cross-Subject Award and will require Administrator Approval before final integration.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubject(teacherClassRegisteredSubject || teacherRegisteredSubject)}
                className="shrink-0 px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all cursor-pointer shadow-2xs active:scale-95"
                title={`Switch back to ${teacherClassRegisteredSubject || teacherRegisteredSubject}`}
              >
                Revert to {teacherClassRegisteredSubject || teacherRegisteredSubject}
              </button>
            </div>
          )}

          {/* Faculty Handover Banner (When newly assigned teacher adopts award from transferred teacher) */}
          {(() => {
            const activeDoc = existingAwardInfo?.canonical || existingAwardInfo?.pending;
            const prevEmail = String(activeDoc?.submittedByEmail || activeDoc?.teacherEmail || '').toLowerCase().trim();
            const myEmail = String(user?.email || auth.currentUser?.email || '').toLowerCase().trim();
            const isHandover = Boolean(
              activeDoc && 
              prevEmail && 
              prevEmail !== myEmail && 
              (practicalsSettings?.deactivatedTeachers?.includes(prevEmail) || activeDoc.isTransferredFaculty || activeDoc.handoverFrom)
            );
            if (!isHandover) return null;
            const prevName = activeDoc.submittedByName || activeDoc.teacherName || activeDoc.handoverFrom?.previousTeacherName || 'Previous Faculty';

            return (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-sky-50/90 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200 text-xs shadow-2xs flex items-start sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/60 border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <div className="font-black text-sky-950 dark:text-sky-100 flex items-center gap-1.5 flex-wrap">
                      <span>Faculty Handover Active: Existing Award Record Adopted</span>
                      <span className="px-1.5 py-0.2 bg-sky-200 dark:bg-sky-800 text-sky-900 dark:text-sky-100 rounded text-[9px] uppercase font-black">
                        Successor Mode
                      </span>
                    </div>
                    <div className="text-[11px] text-sky-800 dark:text-sky-300 font-medium">
                      This award roll was previously initiated by <strong>{prevName}</strong> (Transferred/Deactivated). As the appointed faculty member for <strong>{selectedSubject}</strong>, your draft or final submission will adopt and update this single canonical record. <strong>Zero duplicate award rolls will be generated.</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Existing Award / Pending Review Status Banner */}
          {existingAwardInfo?.lockedOtherTeacherAward ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-start gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in duration-200 shadow-xs">
              <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert size={16} />
              </span>
              <div className="text-xs space-y-0.5 flex-1 min-w-0">
                <div className="font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5 flex-wrap">
                  <span>Award Roll Submitted by Another Faculty Member</span>
                  <span className="px-1.5 py-0.2 bg-amber-200 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 rounded text-[9.5px] uppercase font-black">
                    Protected & Locked
                  </span>
                </div>
                <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
                  An official award list for <strong>{selectedClass} • {selectedSubject} ({practicalType})</strong> has already been submitted by <strong>{existingAwardInfo.lockedOtherTeacherAward.submittedByName}</strong> ({existingAwardInfo.lockedOtherTeacherAward.recordsCount} students).
                </p>
                <p className="text-[10.5px] text-amber-700 dark:text-amber-400 font-bold">
                  🔒 Institutional Policy Restriction: Faculty members can only view, manage, and print their own evaluation awards. To request access, revisions, or reassignment for this award, please consult the administrator.
                </p>
              </div>
            </div>
          ) : (existingAwardInfo?.pending?.status === 'rejected' && !existingAwardInfo?.canonical && (
            !existingAwardInfo.pending.practicalType ||
            String(existingAwardInfo.pending.practicalType).toLowerCase().trim() === String(practicalType).toLowerCase().trim() ||
            String(existingAwardInfo.pending.evaluationType).toLowerCase().trim() === String(practicalType).toLowerCase().trim()
          )) ? (
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
                className="practicals-select practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] w-[64px] sm:w-[82px] px-1 rounded-lg border text-[10px] sm:text-[10.5px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
                title="Sort students"
              >
                <option value="rollAsc">Roll ↑</option>
                <option value="rollDesc">Roll ↓</option>
                <option value="examAsc">Exam R.No. ↑</option>
                <option value="examDesc">Exam R.No. ↓</option>
                <option value="nameAsc">A-Z</option>
                <option value="formAsc">Form #</option>
              </select>
            </div>

            {/* Right: Actions Group (Filters, Quick Fill, Print - All Visible & Guaranteed 32px Height) */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Filters Button (Wider, informative with student counts & filter indicators) */}
              <button
                type="button"
                onClick={() => setShowFilterSettings(!showFilterSettings)}
                className={`practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] px-2 sm:px-3 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                  showFilterSettings
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
                title={`Open evaluation filters (${displayedStudents.length} of ${studentMarks.length} students)`}
              >
                <SlidersHorizontal size={13} className={showFilterSettings ? 'text-white' : 'text-indigo-600 dark:text-indigo-400 shrink-0'} />
                <span className="font-extrabold text-[11px]">Filters</span>
                <span className={`px-1.5 py-0.5 rounded-md font-mono text-[9.5px] sm:text-[10px] font-black leading-none flex items-center gap-1 ${
                  showFilterSettings
                    ? 'bg-white/25 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                }`}>
                  <span>
                    {displayedStudents.length}
                    {displayedStudents.length !== studentMarks.length ? `/${studentMarks.length}` : ''}
                  </span>
                  <span className="hidden sm:inline font-sans text-[9px] font-bold opacity-85">Students</span>
                  {showFailOnly && <span className="text-rose-500 font-sans font-black text-[9px]">• Fail</span>}
                </span>
                <ChevronDown size={11} className={`transition-transform duration-200 shrink-0 ${showFilterSettings ? 'rotate-180' : ''}`} />
              </button>

              {/* Quick Fill Button */}
              <button
                type="button"
                onClick={() => setShowQuickFill(!showQuickFill)}
                disabled={Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                className={`practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] px-2 sm:px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 shrink-0 ${
                  Boolean(existingAwardInfo?.lockedOtherTeacherAward)
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                    : showQuickFill
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs cursor-pointer'
                    : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer'
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

              {/* Print Dropdown (Always Visible & Prominent) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrintMenu(!showPrintMenu)}
                  disabled={Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                  className={`practicals-toolbar-item h-8 min-h-[32px] max-h-[32px] w-8 sm:w-auto px-1.5 sm:px-2.5 rounded-lg font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1 active:scale-95 shrink-0 ${
                    Boolean(existingAwardInfo?.lockedOtherTeacherAward)
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60'
                      : showPrintMenu
                      ? 'bg-indigo-700 text-white border border-indigo-700 cursor-pointer'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-600 cursor-pointer'
                  }`}
                  title={Boolean(existingAwardInfo?.lockedOtherTeacherAward) ? "Printing restricted for other teachers' awards" : "Print Evaluation Sheets & Award Rolls"}
                >
                  <Printer size={14} className="shrink-0" />
                  <span className="hidden sm:inline">Print</span>
                  <ChevronDown size={11} className={`hidden sm:inline transition-transform duration-200 shrink-0 ${showPrintMenu ? 'rotate-180' : ''}`} />
                </button>

                {showPrintMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPrintMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-[min(calc(100vw-24px),20rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-2 pt-1 pb-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        Evaluation & Attendance Prints
                      </div>

                      {/* 1. Blank Marks Record Sheets */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrintMenu(false);
                          handlePrintBlankMarksRecord();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left flex items-start gap-2.5 cursor-pointer transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          <Printer size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black text-slate-800 dark:text-slate-100">
                            Print Blank Marks Record Sheets
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold leading-tight mt-0.5">
                            100% Blank Pract Copy, Viva Voce & Total for manual teacher evaluation
                          </div>
                        </div>
                      </button>

                      {/* 2. Blank Award Roll (Official 2-Column JKBOSE) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrintMenu(false);
                          handlePrintBlankAwardRoll();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left flex items-start gap-2.5 cursor-pointer transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          <FileText size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black text-slate-800 dark:text-slate-100">
                            Print Blank Award Roll (Official 2-Column)
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold leading-tight mt-0.5">
                            Official 50/page JKBOSE layout with blank marks for manual entry
                          </div>
                        </div>
                      </button>

                      {/* 3. Attendance Sheet (Candidate Signature) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrintMenu(false);
                          handlePrintAttendanceSheet();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left flex items-start gap-2.5 cursor-pointer transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          <ClipboardCheck size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black text-slate-800 dark:text-slate-100">
                            Print Attendance Sheet
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold leading-tight mt-0.5">
                            Candidate Signature sheet with Exam Roll No
                          </div>
                        </div>
                      </button>

                      <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
                      <div className="px-2 pt-0.5 pb-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        Official Gazette Awards
                      </div>

                      {/* 4. Official Award Roll (With Entered Marks) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrintMenu(false);
                          handlePrintReport();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 text-left flex items-start gap-2.5 cursor-pointer transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          <Award size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black text-slate-800 dark:text-slate-100">
                            Print Official Award Roll (JKBOSE)
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold leading-tight mt-0.5">
                            Official 2-column layout (Figures & Words) with online marks
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Desktop-only Expandable Filter Inputs Panel */}
          {showFilterSettings && (
              <div className="hidden sm:grid grid-cols-6 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                <div className="space-y-0.5">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="practicals-select practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer transition-colors"
                  >
                    <option value="12th">Class 12th {!isClassPracticalSubmissionEnabled(practicalsSettings, '12th') ? ' (Locked)' : ''}</option>
                    <option value="11th">Class 11th {!isClassPracticalSubmissionEnabled(practicalsSettings, '11th') ? ' (Locked)' : ''}</option>
                    <option value="10th">Class 10th {!isClassPracticalSubmissionEnabled(practicalsSettings, '10th') ? ' (Locked)' : ''}</option>
                    <option value="9th">Class 9th {!isClassPracticalSubmissionEnabled(practicalsSettings, '9th') ? ' (Locked)' : ''}</option>
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Roster Scope</label>
                  <select
                    value={rosterScope}
                    onChange={(e) => setRosterScope(e.target.value)}
                    className="practicals-select practicals-control w-full px-2 py-1 rounded-lg text-xs font-semibold h-8.5 border focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer transition-colors font-bold"
                    title="Choose between evaluating all students in this class or only those enrolled in this specific stream/subject"
                  >
                    <option value="stream">Subject / Stream Only</option>
                    <option value="all_class">All Class Students</option>
                  </select>
                </div>

                <CustomSubjectSelect
                  selectedSubject={selectedSubject}
                  setSelectedSubject={setSelectedSubject}
                  subjectMap={displaySubjectMap}
                  currentSubjectObj={currentSubjectObj}
                  getSubjectMax={getSubjectMax}
                  subjectMaxMarks={subjectMaxMarks}
                  minPassMarks={minPassMarks}
                  teacherRegisteredSubject={teacherClassRegisteredSubject}
                  teacherAssignedSubjects={teacherClassAssignedSubjects}
                  allTeacherSubjects={allTeacherAssignedSubjects}
                  onAttemptCrossSubject={(subName) => setCrossSubjectSwitchModal({ isOpen: true, targetSubject: subName })}
                />

                <div className="space-y-0.5">
                  <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">Eval. Type</label>
                  <select
                    value={practicalType}
                    onChange={(e) => {
                      setExistingAwardInfo({ canonical: null, pending: null, lockedOtherTeacherAward: null });
                      setTeacherCustomMax(null);
                      setPracticalType(e.target.value);
                    }}
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

                <div className="col-span-6 px-1 py-0.5 text-[10.5px] text-indigo-800 dark:text-indigo-300 flex items-center justify-between flex-wrap gap-2 font-semibold">
                  <div className="flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-500 shrink-0" />
                    <span>Paper scale is <strong>{subjectMaxMarks} Max Marks</strong>. Scores entered will be automatically normalized to standard <strong>50 Marks</strong> on public scorecards & gazettes.</span>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {rosterScope === 'all_class' ? 'Displaying all enrolled students of class' : 'Filtered to students with matching stream/subject'}
                  </div>
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
                          onChange={(e) => handleClassChange(e.target.value)}
                          className="portal-compact-select w-full border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer"
                        >
                          <option value="12th">Class 12th {!isClassPracticalSubmissionEnabled(practicalsSettings, '12th') ? ' (Locked)' : ''}</option>
                          <option value="11th">Class 11th {!isClassPracticalSubmissionEnabled(practicalsSettings, '11th') ? ' (Locked)' : ''}</option>
                          <option value="10th">Class 10th {!isClassPracticalSubmissionEnabled(practicalsSettings, '10th') ? ' (Locked)' : ''}</option>
                          <option value="9th">Class 9th {!isClassPracticalSubmissionEnabled(practicalsSettings, '9th') ? ' (Locked)' : ''}</option>
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

                    {/* Roster Scope */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Roster Scope</label>
                      <select
                        value={rosterScope}
                        onChange={(e) => setRosterScope(e.target.value)}
                        className="portal-compact-select w-full border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs cursor-pointer font-bold"
                      >
                        <option value="all_class">All Class Students</option>
                        <option value="stream">Subject / Stream Only</option>
                      </select>
                    </div>

                    {/* Subject (Single unified header rendered inside CustomSubjectSelect) */}
                    <div>
                      <CustomSubjectSelect
                        selectedSubject={selectedSubject}
                        setSelectedSubject={setSelectedSubject}
                        subjectMap={displaySubjectMap}
                        currentSubjectObj={currentSubjectObj}
                        getSubjectMax={getSubjectMax}
                        subjectMaxMarks={subjectMaxMarks}
                        minPassMarks={minPassMarks}
                        teacherRegisteredSubject={teacherClassRegisteredSubject}
                        teacherAssignedSubjects={teacherClassAssignedSubjects}
                        allTeacherSubjects={allTeacherAssignedSubjects}
                        onAttemptCrossSubject={(subName) => setCrossSubjectSwitchModal({ isOpen: true, targetSubject: subName })}
                      />
                    </div>

                    {/* Evaluation Type */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Evaluation Type</label>
                      <select
                        value={practicalType}
                        onChange={(e) => {
                          setExistingAwardInfo({ canonical: null, pending: null, lockedOtherTeacherAward: null });
                          setTeacherCustomMax(null);
                          setPracticalType(e.target.value);
                        }}
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || emptyCount === 0 || !quickFillMark.trim()}
                      className={`portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] px-2.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && emptyCount > 0 && quickFillMark.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title={!isSubmissionOpen || !isSubmissionOpenForCurrentClass ? 'Submissions locked for this class' : 'Fill all students who currently have empty marks (preserves already-entered marks)'}
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || selectedKeys.size === 0 || !quickFillMark.trim()}
                      className={`portal-compact-btn !h-7 !min-h-[28px] !max-h-[28px] px-2.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && selectedKeys.size > 0 && quickFillMark.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title={!isSubmissionOpen || !isSubmissionOpenForCurrentClass ? 'Submissions locked for this class' : 'Fill all selected student rows'}
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || displayedStudents.length === 0 || !quickFillMark.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && displayedStudents.length > 0 && quickFillMark.trim()
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                      title={!isSubmissionOpen || !isSubmissionOpenForCurrentClass ? 'Submissions locked for this class' : 'Fill mark for every student in the current view'}
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || displayedStudents.length === 0}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && displayedStudents.length > 0
                          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800 cursor-pointer active:scale-95'
                          : 'text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60'
                      }`}
                      title={!isSubmissionOpen || !isSubmissionOpenForCurrentClass ? 'Submissions locked for this class' : 'Clear marks'}
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || emptyCount === 0 || !quickFillMark.trim()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && emptyCount > 0 && quickFillMark.trim()
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || selectedKeys.size === 0 || !quickFillMark.trim()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && selectedKeys.size > 0 && quickFillMark.trim()
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || displayedStudents.length === 0 || !quickFillMark.trim()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && displayedStudents.length > 0 && quickFillMark.trim()
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
                      disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || displayedStudents.length === 0}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                        isSubmissionOpen && isSubmissionOpenForCurrentClass && displayedStudents.length > 0
                          ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border-rose-200 dark:border-rose-800 cursor-pointer active:scale-98'
                          : 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                      }`}
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
              {/* Active Filter Banner when filtering failing/incomplete students */}
              {showFailOnly && (
                <div className="mb-2 p-2 sm:p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2 text-xs shadow-2xs animate-fadeIn">
                  <div className="flex items-center gap-1.5 font-bold min-w-0">
                    <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <span className="truncate">Showing incomplete, failing, or absent entries only ({displayedStudents.length} candidates)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFailOnly(false)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] cursor-pointer shrink-0 shadow-2xs active:scale-95 transition-all"
                  >
                    Show All Students
                  </button>
                </div>
              )}

              {/* ── MOBILE CARDS (hidden on sm+) — High-Density Standard Roster Layout ── */}
              <div className="sm:hidden space-y-1.5">
                {displayedStudents.map((st, idx) => {
                  const isAbsent = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
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
                            id={`practical-mark-input-mobile-${idx}`}
                            data-student-idx={idx}
                            type="text"
                            inputMode="text"
                            enterKeyHint={idx === displayedStudents.length - 1 ? 'done' : 'next'}
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck="false"
                            placeholder={`0-${subjectMaxMarks}`}
                            value={st.practicalMarks}
                            disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                            onFocus={(e) => {
                              try {
                                e.target.select();
                              } catch (_) {}
                            }}
                            onChange={(e) => handleMarkChange(st, 'practicalMarks', e.target.value)}
                            onKeyDown={(e) => handleInputKeyDown(e, idx, 'mobile')}
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
                            disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                            onClick={() => handleMarkChange(st, 'practicalMarks', isAbsent ? '' : 'AB')}
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
                        {st.regNo && <span>R:{st.regNo} • </span>}
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
                                id={`practical-mark-input-desktop-${idx}`}
                                data-student-idx={idx}
                                type="text"
                                enterKeyHint={idx === displayedStudents.length - 1 ? 'done' : 'next'}
                                placeholder={`0-${subjectMaxMarks} / A`}
                                value={st.practicalMarks}
                                disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                                onFocus={(e) => {
                                  try {
                                    e.target.select();
                                  } catch (_) {}
                                }}
                                onChange={(e) => handleMarkChange(st, 'practicalMarks', e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, idx, 'desktop')}
                                className={`w-20 px-2 py-0 rounded-md border text-[11px] font-black h-6 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase text-center leading-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isAbsent
                                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold'
                                    : st.practicalMarks !== ''
                                    ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold'
                                    : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                }`}
                              />
                              <button
                                type="button"
                                disabled={!isSubmissionOpen || !isSubmissionOpenForCurrentClass || Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                                onClick={() => handleMarkChange(st, 'practicalMarks', isAbsent ? '' : 'AB')}
                                className={`h-6 px-1.5 rounded-md font-mono text-[10px] font-black border transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 leading-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isAbsent
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-amber-600 dark:hover:text-amber-400 border-slate-200 dark:border-slate-700'
                                }`}
                                title="Toggle Absent (AB)"
                              >
                                AB
                              </button>
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
            <div className="p-8 sm:p-10 text-center text-xs border rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-1">
                <History size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Examinees Found in Selected Session
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                No confirmed registered students with assigned rolls found for <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedClass} • {selectedSubject}</span> in session <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{yearSuffix}</span>.
              </p>

              {altSessionAvailable && (
                <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-xl w-full text-left shadow-xs animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-amber-950 dark:text-amber-100">
                        Historical Practical Roster Detected
                      </div>
                      <div className="text-[11.5px] text-amber-800 dark:text-amber-300 font-medium mt-0.5">
                        Found <strong>{altSessionCount || 'registered'}</strong> students with practical marks in session <span className="font-mono font-bold">{altSessionAvailable}</span>.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setYearSuffix(altSessionAvailable)}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shrink-0 shadow-sm hover:shadow cursor-pointer active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span>Load {altSessionAvailable} Roster</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
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

            {(!isSubmissionOpen || !isSubmissionOpenForCurrentClass) ? (
              <div className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400 flex items-center justify-end gap-1.5 px-1 py-1">
                <Lock size={12} className="shrink-0 text-amber-600" />
                <span>Submissions currently closed for Class {selectedClass}. Actions locked.</span>
              </div>
            ) : null}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || studentMarks.length === 0 || !isSubmissionOpen || !isSubmissionOpenForCurrentClass || Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
                className="flex-1 sm:flex-initial px-3 py-2 sm:py-1 min-h-[40px] sm:min-h-[34px] rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Bookmark size={14} className="text-amber-500 shrink-0" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleInitiateFinalSubmit}
                disabled={saving || studentMarks.length === 0 || !isSubmissionOpen || !isSubmissionOpenForCurrentClass || Boolean(existingAwardInfo?.lockedOtherTeacherAward)}
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
                    Your assigned subject in school records is <strong className="text-indigo-600 dark:text-indigo-400">{teacherClassRegisteredSubject || teacherRegisteredSubject}</strong>, while this award list is for <strong className="text-amber-600 dark:text-amber-400">{selectedSubject}</strong>. Your submission will be staged safely as a pending request and integrated into official database records upon administrative approval.
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
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-black text-xs sm:text-sm">Unentered Student Marks Found ({validationData.incompleteCount})</span>
                      <button
                        type="button"
                        onClick={handleModalMarkAllAbsent}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] shadow-2xs active:scale-95 cursor-pointer transition-all flex items-center gap-1"
                        title="Mark all incomplete students as Absent right now"
                      >
                        <Zap size={12} /> Mark All ({validationData.incompleteCount}) as Absent
                      </button>
                    </div>
                    <div className="text-[10.5px] sm:text-[11.5px] mt-1 text-slate-600 dark:text-slate-300 font-medium">
                      Enter marks directly or tap <strong>AB</strong> for any student below:
                    </div>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs space-y-1.5">
                  {validationData.incompleteList.map((st, idx) => {
                    const isAbs = st.practicalMarks === 'A' || st.practicalMarks === 'AB';
                    return (
                      <div key={st._uid || st.id || idx} className="flex items-center justify-between py-1.5 px-2 gap-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs shrink-0 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            #{st.rollNo}
                          </span>
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[12px] block leading-tight">
                              {st.name}
                            </span>
                            {st.formNo && (
                              <span className="text-[9.5px] text-slate-400 font-mono">F#{st.formNo}</span>
                            )}
                          </div>
                        </div>

                        {/* Inline Marks Input & AB Toggle Button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            id={`validation-modal-mark-input-${idx}`}
                            type="text"
                            inputMode="text"
                            enterKeyHint={idx === validationData.incompleteStudents.length - 1 ? 'done' : 'next'}
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck="false"
                            placeholder={`0-${subjectMaxMarks}`}
                            value={st.practicalMarks || ''}
                            onFocus={(e) => {
                              try {
                                e.target.select();
                              } catch (_) {}
                            }}
                            onChange={(e) => handleModalResolveMark(st, e.target.value)}
                            onKeyDown={(e) => {
                              const isNext = e.key === 'Enter' || e.keyCode === 13 || e.which === 13 || (e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown';
                              const isPrev = (e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp';
                              if (isNext) {
                                e.preventDefault();
                                const nextEl = document.getElementById(`validation-modal-mark-input-${idx + 1}`);
                                if (nextEl) {
                                  nextEl.focus();
                                  try { nextEl.select(); } catch (_) {}
                                  nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                } else {
                                  e.target?.blur();
                                }
                              } else if (isPrev) {
                                e.preventDefault();
                                const prevEl = document.getElementById(`validation-modal-mark-input-${idx - 1}`);
                                if (prevEl) {
                                  prevEl.focus();
                                  try { prevEl.select(); } catch (_) {}
                                  prevEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }
                            }}
                            className="w-16 h-8 text-center text-xs font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleModalResolveMark(st, isAbs ? '' : 'AB')}
                            className={`h-8 px-2.5 rounded-lg text-xs font-black font-mono border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                              isAbs
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-600 border-slate-300 dark:border-slate-700'
                            }`}
                            title="Toggle Absent"
                          >
                            {isAbs ? 'ABSENT' : 'AB'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                <>
                  <button
                    type="button"
                    onClick={() => executeFinalSubmit(false)}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    <CheckCircle2 size={14} /> Submit Entered Marks (Keep Unfilled Pending)
                  </button>
                  <button
                    type="button"
                    onClick={() => executeFinalSubmit(true)}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    <AlertCircle size={14} /> Auto-Mark Unfilled as Absent & Submit
                  </button>
                </>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 border shadow-2xl space-y-3 border-slate-200 dark:border-slate-800 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                  <History size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate m-0">
                    My Practical Submissions Log
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate m-0">
                    Your submitted practical awards <span className="hidden sm:inline">(Internal Assessment &amp; External Practical only)</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Search Filter */}
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by subject, class, or test type..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {loadingHistory ? (
              <ModernLoader
                moduleKey="practicals"
                text="Loading previous submissions…"
                subtext="Please wait."
                className="py-6"
              />
            ) : filteredSubmissions.length > 0 ? (
              <div className="overflow-y-auto space-y-1.5 pr-0.5 flex-1 max-h-[64vh]">
                {filteredSubmissions.map((item, i) => {
                  const itemId = String(item.id || item.docId || '');
                  const isPending = itemId.startsWith('pending_') || item.status === 'pending_approval';
                  const isRejected = item.status === 'rejected';

                  return (
                    <div 
                      key={`${itemId || 'eval'}_${item.className}_${item.subject}_${item.practicalType}_${i}`} 
                      className="p-2 sm:p-2.5 rounded-xl border bg-white dark:bg-slate-950/70 border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col gap-1.5"
                    >
                      {/* Top Row: Class & Subject + Assessment Type + Status Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-black text-xs sm:text-[13px] text-slate-900 dark:text-white truncate">
                            {item.className} • {item.subject}
                          </span>
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                            {item.practicalType || 'Assessment'}
                          </span>
                          {item.isCrossSubject && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                              Cross
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isPending ? (
                            isRejected ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                Revision
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                Pending
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Approved & Live
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Metadata + Compact Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 min-w-0 flex-1 truncate">
                          <Clock size={10.5} className="shrink-0 text-slate-400" />
                          <span className="truncate">{formatSubmissionDate(item.updatedAt, item.displayDate)}</span>
                          <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                            {item.recordsCount || (item.records?.length || 0)} Students
                          </span>
                          {item.yearSuffix && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700 shrink-0 hidden xs:inline">•</span>
                              <span className="shrink-0 hidden xs:inline text-slate-500 dark:text-slate-400">
                                Session {item.yearSuffix}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Direct Print or Save as PDF button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!isSubmissionOwnedByTeacher(item, user, auth.currentUser, practicalsSettings)) {
                                triggerNotification({
                                  type: 'error',
                                  title: 'Access Restricted',
                                  badge: 'Restricted',
                                  text: 'You cannot print or view awards submitted by other teachers.',
                                  primaryButtonText: 'Dismiss'
                                });
                                return;
                              }
                              const ok = printHistoricalSubmission(item);
                              if (!ok) {
                                triggerNotification({
                                  type: 'warning',
                                  title: 'No Records Found',
                                  text: 'This submission does not contain any student records to print.',
                                  primaryButtonText: 'Dismiss'
                                });
                              }
                            }}
                            className="h-6 px-2 rounded-md text-[10px] font-bold bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Print or Save/Download PDF of Official Award Roll"
                          >
                            <Printer size={11} className="text-indigo-600 dark:text-indigo-400" />
                            <span>PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!isSubmissionOwnedByTeacher(item, user, auth.currentUser, practicalsSettings)) {
                                triggerNotification({
                                  type: 'error',
                                  title: 'Access Restricted',
                                  badge: 'Restricted',
                                  text: 'You cannot view or load evaluation awards submitted by other teachers.',
                                  primaryButtonText: 'Dismiss'
                                });
                                return;
                              }
                              handleLoadSubmissionRecord(item);
                            }}
                            className="h-6 px-2.5 rounded-md text-[10px] font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Load this evaluation record"
                          >
                            <span>Load</span>
                            <ArrowRight size={10} className="stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
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
                  You are registered under <strong className="text-indigo-600 dark:text-indigo-400">{teacherClassRegisteredSubject || teacherRegisteredSubject || 'your assigned subjects'}</strong>, but you are switching to enter awards for <strong className="text-amber-600 dark:text-amber-400">{crossSubjectSwitchModal.targetSubject} ({selectedClass})</strong>.
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
                Cancel & Keep {teacherClassRegisteredSubject || teacherRegisteredSubject || 'Assigned Subject'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject(crossSubjectSwitchModal.targetSubject);
                  setCrossSubjectSwitchModal({ isOpen: false, targetSubject: '' });
                }}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 transition-all"
              >
                Continue to {crossSubjectSwitchModal.targetSubject} ({selectedClass})
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
          inverted={false}
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
