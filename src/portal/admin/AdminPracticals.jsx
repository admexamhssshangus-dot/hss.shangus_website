import { getStaffDirectory, updateStaffPhone } from '../../services/staffDirectoryService';
import { deleteAcademicRecord } from '../../services/academicRecordService';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Settings, ClipboardCheck, Printer, RefreshCw, CheckCircle2, AlertCircle,
  Award, AlertTriangle, X, Sliders, Users, Mail, Phone, MessageCircle, Edit2, Edit3, Check, Search,
  Download, Upload, FileSpreadsheet, FileText, Trash2, Eye, Save, Shield, ShieldAlert,
  ChevronDown, ChevronUp, ChevronRight, BookOpen, SlidersHorizontal, Filter, Layers, Plus, Minus, RotateCcw, Sparkles,
  History, Archive
} from 'lucide-react';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { staffCallable } from '../../services/staffCommand';
import ModernLoader from '../../components/ModernLoader';
import { getCachedCollection, invalidateCollectionCache } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { showToast } from '../../components/common/GlobalToast';
import { saveVersionToBin, getVersionsForDoc, restoreVersionFromBin, moveSubmissionToRecycleBin } from '../../services/practicalsBinService';
import PracticalsRecycleBinModal from './PracticalsRecycleBinModal';
import { sanitizeForFirestore } from '../../utils/firestoreSanitizer';
import {
  printIndividualAwardRoll,
  printIndividualWorkSheet,
  printConsolidatedAwardRoll,
  printAllIndividualAwardRolls,
  printAttendanceSheet,
  printMarksRecordAwardRoll,
  printFailList,
  PRACTICAL_SUBJECT_DEFS,
  getCurrentOfficialExamRoll,
  isValidExamRollForClass
} from '../../utils/practicalsPdfGenerator';
import {
  generatePracticalsExcelTemplate,
  generatePracticalsCsvTemplate,
  exportCurrentRosterToExcel,
  exportCurrentRosterToCsv,
  exportConsolidatedAwardsToExcel,
  exportConsolidatedAwardsToWord,
  parseAndValidatePracticalsSpreadsheet,
  importPracticalsCsvToFirestore,
  cleanRegistrationNumber,
  VALID_SUBJECT_CODES
} from '../../utils/practicalsCsvManager';
import { toTitleCase } from '../../utils/textFormatting';
import { isStudentExamDropped } from '../../utils/studentApprovalStatus';
import {
  SUBJECT_CONFIG_DEFS,
  DEFAULT_PRACTICAL_MARKS_CONFIG,
  getSubjectMarksConfig,
  getActiveSchoolEvaluations,
  isPracticalEvaluationType,
  getSubjectDisplayName,
  isMatchingSubjectCode
} from '../../utils/practicalsSettingsManager';

export const CODES = SUBJECT_CONFIG_DEFS.map(s => s.code);
export const NAMES = SUBJECT_CONFIG_DEFS.reduce((acc, s) => {
  acc[s.code] = s.name;
  return acc;
}, {});

export const DEFAULT_MX11 = Object.fromEntries(
  Object.entries(DEFAULT_PRACTICAL_MARKS_CONFIG['11th'].internal).map(([k, v]) => [k, v.max])
);
export const DEFAULT_MX12 = Object.fromEntries(
  Object.entries(DEFAULT_PRACTICAL_MARKS_CONFIG['12th'].internal).map(([k, v]) => [k, v.max])
);
export const DEFAULT_MX10 = Object.fromEntries(
  Object.entries(DEFAULT_PRACTICAL_MARKS_CONFIG['10th']?.internal || {}).map(([k, v]) => [k, v.max])
);

export const DEFAULT_EXCLUDED_TEACHERS = [
  'teacher@hssshangus.in',
  'teacher@test.com',
  'smuzaffera@gmail.com',
  'sameerganie5899445@gmail.com',
  'mwani@gmail.com',
  'bilalhcut@gmail.com',
  'e.educational.24@gmail.com'
];

export const formatClassDisplay = (rawCls, doc = null) => {
  const str = String(rawCls || '').trim();
  if (str === '11th,12th' || str === '11th, 12th' || str === '12th,11th') {
    if (doc?.id && String(doc.id).startsWith('12th_')) return '12th';
    return '11th';
  }
  return str || 'Class';
};

export const isClassMatch = (stc, trc) => {
  if (!stc) return false;
  const s = String(stc).toLowerCase().trim();
  const t = String(trc || '').toLowerCase().replace('th', '').trim();
  return (
    s.includes(t) ||
    s.includes(String(trc).toLowerCase()) ||
    (t === '10' && (/\bx\b/i.test(s) || s.includes('ten'))) ||
    (t === '11' && (s.includes('xi') || s.includes('eleven'))) ||
    (t === '12' && (s.includes('xii') || s.includes('twelve')))
  );
};

export const getRollNo = (st) => {
  if (!st) return '';
  const keys = [
    'Class Roll No', 'Class Roll No.', 'classRollNo', 'Class Roll', 'Class R.No.', 'Class R.No', 'Class R. No.',
    'rollNo', 'RollNo', 'Roll No', 'Roll No.', 'roll_no', 'roll', 'ClassRoll', 'ClassRollNo', 'class_roll_no',
    'RollNumber', 'Roll_No', 'classRoll', 'crNo', 'class_roll', 'assignedRollNo', 'currentRollNo',
    'Class Roll No (Class 12th)', 'Class Roll No (Class 11th)', 'Class Roll No (Class 10th)', 'Class Roll No.', 'Roll_Number'
  ];
  for (const k of keys) {
    if (st[k] !== undefined && st[k] !== null) {
      const val = String(st[k]).trim();
      if (val && val !== '—' && val !== '-' && val !== 'N/A' && val !== 'null' && val !== 'undefined') {
        if (!/^\d{8,}$/.test(val)) return val;
      }
    }
  }
  return '';
};

export function getStudentSession(st) {
  if (!st) return '';
  const keys = ['Session', 'session', 'Academic Session', 'sessionYear', 'yearSuffix', 'Session/Year', 'Annual Year', 'Exam Year', 'Year', 'examYear'];
  for (const k of keys) {
    if (st[k] !== undefined && st[k] !== null) {
      const v = String(st[k]).trim();
      if (v && v !== '—' && v !== '-' && v !== 'N/A') return v;
    }
  }
  if (st._source === 'masterRegisters') return '2024-25 (Oct-Nov)';
  return '';
}

export function getStudentSubjectsStr(st, cls) {
  if (!st) return '';
  const clsStr = String(cls || st.Class || st.class || '').toLowerCase();
  const is12 = clsStr.includes('12');
  const is10 = clsStr.includes('10');
  const is11 = clsStr.includes('11') || (!is12 && !is10);
  const is9 = clsStr.includes('9');

  const isSameAs11 = val => val && /same\s+as\s+(in\s+)?class\s*(11|eleventh)/i.test(String(val));

  const multiSubCols = [
    st['Subjects1'], st['Subjects2'], st['Subjects3'], st['Subjects4'], st['Subjects5'], st['Subject6'],
    st['Subject1'], st['Subject2'], st['Subject3'], st['Subject4'], st['Subject5'],
    st['subject1'], st['subject2'], st['subject3'], st['subject4'], st['subject5'], st['subject6']
  ].filter(val => val && !isSameAs11(val)).join(', ');

  const arraySubs = Array.isArray(st.selectedSubjects) ? st.selectedSubjects.filter(val => !isSameAs11(val)).join(', ') : (
    Array.isArray(st.subjects) ? st.subjects.map(s => typeof s === 'string' ? s : s?.name || s?.code).filter(val => val && !isSameAs11(val)).join(', ') : ''
  );

  // Class-specific subject fields ALWAYS take authoritative precedence over generic/legacy Subs
  let classSpecificSubs = '';
  if (is11) {
    classSpecificSubs = st['Subjects to be taken in Class 11th'] || st['Subjects in Class 11th'] || st['Subjects Studied in Class 11th'] || '';
  } else if (is12) {
    const cands12 = [
      st['Subjects to be taken in Class 12th'],
      st['Stream & Subjects for Class 12th'],
      st['Subjects in Class 12th'],
      st['Subjects Studied in Class 11th'],
      st['Subjects to be taken in Class 11th'],
      st['Subjects in Class 11th']
    ];
    let bestCand = '';
    for (const c of cands12) {
      if (c && !isSameAs11(c) && String(c).trim() && String(c).trim() !== '—') {
        const strVal = String(c).trim();
        const itemCount = strVal.split(/[,;/]/).filter(x => x.trim().length > 0).length;
        if (itemCount >= 3) {
          bestCand = strVal;
          break;
        }
        if (!bestCand || itemCount > bestCand.split(/[,;/]/).filter(x => x.trim().length > 0).length) {
          bestCand = strVal;
        }
      }
    }
    classSpecificSubs = bestCand;
  } else if (is10) {
    classSpecificSubs = st['Subjects to be taken in Class 10th'] || st['Subjects in Class 10th'] || st['Subjects Studied in Class 9th'] || '';
  } else if (is9) {
    classSpecificSubs = st['Subjects to be taken in Class 9th'] || st['Subjects in Class 9th'] || '';
  }

  const rawCandidate = classSpecificSubs ||
    arraySubs ||
    (!isSameAs11(st['Subs']) ? st['Subs'] : null) ||
    (!isSameAs11(st['subs']) ? st['subs'] : null) ||
    (!isSameAs11(st['Subjects']) ? st['Subjects'] : null) ||
    st['Subject Combination'] ||
    st['streamSubjects'] ||
    multiSubCols ||
    (!isSameAs11(st.subjects) ? st.subjects : null) ||
    '';

  return String(rawCandidate);
}

export function getStudentStreamStr(st, cls = '') {
  if (!st) return 'Science';
  const c = String(cls || st.Class || st.class || '').toLowerCase();
  if (c.includes('9') || c.includes('10')) return 'General';

  // 1. Explicit Stream property
  const explicit = String(
    st['Stream for Class 12th'] ||
    st['Stream (Class 12th)'] ||
    st['Stream in Class 12th'] ||
    st['Stream for Class 11th'] ||
    st['Stream (Class 11th)'] ||
    st['Stream in Class 11th'] ||
    st['Stream Studied in Class 11th'] ||
    st['Stream'] ||
    st['stream'] ||
    st['Selected Stream'] ||
    st['Stream (Applied)'] ||
    st['Stream for Admission'] ||
    ''
  ).trim();

  if (explicit && !/^(N\/A|#N\/A|—|-|null|undefined|general)$/i.test(explicit)) {
    const lower = explicit.toLowerCase();
    if (lower.includes('med') || lower.includes('non') || lower.includes('sci')) return 'Science';
    if (lower.includes('art') || lower.includes('hum')) return 'Humanities';
    if (lower.includes('com')) return 'Commerce';
  }

  // 2. Infer Stream from Subjects with precision
  const norm = (
    String(st.subjects || st['Subjects'] || st.Subs || st['Subs'] || st.subject_combination || st.Subject || st.subs || '') + ' ' +
    String(st.Subjects1 || '') + ' ' + String(st.Subjects2 || '') + ' ' + String(st.Subjects3 || '') + ' ' + String(st.Subjects4 || '') + ' ' + String(st.Subjects5 || '') + ' ' +
    String(st['Subjects to be taken in Class 11th'] || '') + ' ' + String(st['Subjects to be taken in Class 12th'] || '') + ' ' +
    String(st['Subjects Studied in Class 11th'] || '')
  ).toLowerCase();

  const hasPhysics = /\b(physics|phys)\b/i.test(norm) || /(^|[\s,/\-])ph([\s,/\-]|$)/i.test(norm);
  const hasChemistry = /\b(chemistry|chem)\b/i.test(norm) || /(^|[\s,/\-])ch([\s,/\-]|$)/i.test(norm);
  const hasBio = /\b(biology|botany|zoology|bio|bot|zoo)\b/i.test(norm) || /(^|[\s,/\-])(bi|bo|zo)([\s,/\-]|$)/i.test(norm);

  if (hasPhysics || hasChemistry || hasBio) return 'Science';

  const hasCommerce = /\b(commerce|accountancy|business studies|account)\b/i.test(norm) || /(^|[\s,/\-])(cm|bs|ac)([\s,/\-]|$)/i.test(norm);
  if (hasCommerce) return 'Commerce';

  const hasArts = /\b(political|history|education|sociology|urdu|arabic|persian|psychology)\b/i.test(norm) || /(^|[\s,/\-])(ps|ht|ed|so|ur|ar|pe|py)\b/i.test(norm);
  if (hasArts) return 'Humanities';

  return 'Humanities';
}

export function isStudentEnrolledInSubject(st, subCode, cls) {
  if (!st || !subCode) return false;

  const code = subCode.toUpperCase().trim();
  const c = String(cls || st?.Class || st?.class || st?.['Admission sought for class'] || '').toLowerCase();
  const isSecondary = c.includes('9') || c.includes('10');

  // Secondary School (Class 9th & 10th) Authoritative Enrollment:
  if (isSecondary) {
    // 1. Core 5 Compulsory Subjects belong to EVERY Class 10th / 9th student:
    if (['EN', 'MA', 'SC', 'SS', 'UR'].includes(code)) {
      return true;
    }
    // 2. Vocational Elective (HTC or ITE):
    const subStr = getStudentSubjectsStr(st, cls).toUpperCase().trim();
    if (code === 'HTC') {
      return /\b(HTC|HC|HEALTH|HEALTHCARE|HEALTH\s*CARE)\b/i.test(subStr) || (st.vocationalSubject && /health/i.test(st.vocationalSubject));
    }
    if (code === 'ITE') {
      return /\b(ITE|IT|ITES|IT\s*&\s*ITES|INFORMATION\s*TECHNOLOGY|TECH|COMPUTER)\b/i.test(subStr) || (st.vocationalSubject && /it|ites|info/i.test(st.vocationalSubject));
    }
    // Any other 11th/12th higher secondary subjects (PH, CH, BO, ZO, ED, HT, PS, ES, PD, EC) do NOT belong to 10th
    return false;
  }

  // Higher Secondary (11th & 12th) Authoritative Enrollment:
  // 1. General English is COMPULSORY for 100% of Higher Secondary students across all streams
  if (code === 'EN') return true;

  const subStr = getStudentSubjectsStr(st, cls).toUpperCase().trim();
  const streamStr = getStudentStreamStr(st, cls).toLowerCase();

  const hasMedicalSubs = /\b(BO|BOT|BOTANY|ZO|ZOO|ZOOLOGY|BI|BIO|BIOLOGY)\b/i.test(subStr);
  const isScience = streamStr.includes('science') || streamStr.includes('med') || streamStr.includes('sci') || hasMedicalSubs;

  // Strict Stream Guard: Science students NEVER take Arts-only subjects or Secondary 'SC'
  if (isScience && ['ED', 'HT', 'PS', 'SO', 'AR', 'PR', 'SC'].includes(code)) {
    return false;
  }

  // 2. Compulsory Science Foundation: All Science students take Physics and Chemistry
  if ((code === 'PH' || code === 'CH') && isScience) {
    return true;
  }

  // 3. Medical Stream Biology Foundation: Botany and Zoology
  if ((code === 'BO' || code === 'ZO' || code === 'BI') && hasMedicalSubs) {
    return true;
  }
  if ((code === 'BO' || code === 'ZO' || code === 'BI') && streamStr.includes('med') && !streamStr.includes('non')) {
    return true;
  }

  // 4. Direct Subject Match in Student's Enrolled Subjects String
  if (subStr && subStr.length > 1) {
    if (code === 'BI') {
      if (/\b(BI|BIO|BIOLOGY)\b/i.test(subStr) || (/\b(BO|BOT|BOTANY)\b/i.test(subStr) && /\b(ZO|ZOO|ZOOLOGY)\b/i.test(subStr))) return true;
    } else if (code === 'BO') {
      if (/\b(BO|BOT|BOTANY)\b/i.test(subStr) || /\b(BI|BIO|BIOLOGY)\b/i.test(subStr)) return true;
    } else if (code === 'ZO') {
      if (/\b(ZO|ZOO|ZOOLOGY)\b/i.test(subStr) || /\b(BI|BIO|BIOLOGY)\b/i.test(subStr)) return true;
    } else if (code === 'MA') {
      if (/\b(MA|MATH|MATHS|MATHEMATICS)\b/i.test(subStr)) return true;
    } else if (code === 'PS') {
      if (/\b(PS|POL|POLITICAL|POL\s*SC|POLITICAL\s*SCIENCE)\b/i.test(subStr)) return true;
    } else if (code === 'ED') {
      const cleanSubj = subStr
        .replace(/\b(NON-MED|NON\s*MED|NON-MEDICAL|MEDICAL|MED)\b/gi, '')
        .replace(/\b(STUDIED|APPLIED)\b/gi, '')
        .replace(/\b(PHYSICAL\s*EDUCATION|PHYSICAL\s*ED|PHY\s*ED|P\.ED|PED|P\.E|PD|PE)\b/gi, '');
      if (/\b(ED|EDU|EDUCATION)\b/i.test(cleanSubj)) return true;
    } else if (code === 'HT') {
      const cleanSubj = subStr.replace(/\b(HTC|HC|HEALTHCARE|HEALTH\s*CARE|HEALTH)\b/gi, '');
      if (/\b(HT|HIST|HISTORY)\b/i.test(cleanSubj)) return true;
    } else if (code === 'UR') {
      if (/\b(UR|URDU)\b/i.test(subStr)) return true;
    } else if (code === 'EC') {
      if (/\b(EC|ECO|ECONOMICS)\b/i.test(subStr)) return true;
    } else if (code === 'ES') {
      if (/\b(ES|EVS|ENVIRONMENTAL|ENVIR|ENVIRONMENTAL\s*SCIENCE)\b/i.test(subStr)) return true;
    } else if (code === 'PD') {
      if (/\b(PD|PED|P\.ED|PHYSICAL\s*EDUCATION|PHY\s*ED|PHYSICAL|P\.E)\b/gi.test(subStr)) return true;
    } else if (code === 'HTC') {
      if (/\b(HTC|HC|HEALTH|HEALTHCARE|HEALTH\s*CARE)\b/i.test(subStr)) return true;
    } else if (code === 'ITE') {
      if (/\b(ITE|IT|ITES|IT\s*&\s*ITES|INFORMATION\s*TECHNOLOGY|TECH|COMPUTER)\b/i.test(subStr)) return true;
    } else if (code === 'EN') {
      if (/\b(EN|GE|GEN\s*ENG|GENERAL\s*ENGLISH|ENGLISH)\b/i.test(subStr)) return true;
    } else if (code === 'PH') {
      if (/\b(PH|PHY|PHYSICS)\b/i.test(subStr)) return true;
    } else if (code === 'CH') {
      if (/\b(CH|CHEM|CHEMISTRY)\b/i.test(subStr)) return true;
    } else if (code === 'SC') {
      if (/\b(SC|SCI|SCIENCE)\b/i.test(subStr) && !/\b(SOCIAL|POLITICAL|ENVIRONMENTAL)\b/i.test(subStr)) return true;
    } else if (code === 'SS') {
      if (/\b(SS|SST|SOC|SOCIAL\s*SCIENCE|SOCIAL\s*STUDIES)\b/i.test(subStr)) return true;
    } else {
      if (new RegExp(`\\b${code}\\b`, 'i').test(subStr)) return true;
      const name = NAMES[code];
      if (name && subStr.includes(name.toUpperCase())) return true;
    }
  }

  // 5. Stream-based Core Enrollment Rules (for unconfigured or incomplete subject records)
  const isMedical = streamStr.includes('med') || hasMedicalSubs;
  const isNonMedical = streamStr.includes('non-med') || streamStr.includes('nonmed') || /\b(MA|MATH|MATHS|MATHEMATICS)\b/i.test(subStr);
  const isArts = streamStr.includes('arts') || streamStr.includes('humanities');
  const isCommerce = streamStr.includes('commerce');

  if (isScience) {
    if (['EN', 'PH', 'CH'].includes(code)) return true;
    if (['BO', 'ZO', 'BI'].includes(code) && (isMedical || !isNonMedical)) return true;
    if (code === 'MA' && isNonMedical) return true;
  } else if (isArts) {
    if (['EN'].includes(code)) return true;
  } else if (isCommerce) {
    if (['EN', 'EC'].includes(code)) return true;
  } else {
    if (['EN'].includes(code)) return true;
  }

  return false;
}


export function normalizePracticalSession(sess) {
  if (!sess) return '2025-26';
  const str = String(sess).toLowerCase().trim();

  if (str === 'all') return 'all';

  // 1. Current / Live 2025-26 Session
  if (
    str.includes('2025-26') ||
    str.includes('2025–26') ||
    str.includes('2025-2026') ||
    str.includes('2026') ||
    str.includes('current') ||
    str.includes('live')
  ) {
    return '2025-26';
  }

  // 2. Previous 2024-25 Session (Oct-Nov)
  if (
    str.includes('2024-25') ||
    str.includes('2024–25') ||
    str.includes('2024-2025') ||
    str.includes('2024') ||
    str.includes('2025') ||
    str.includes('oct') ||
    str.includes('nov') ||
    str.includes('previous')
  ) {
    return '2024-25 (Oct-Nov)';
  }

  // 3. Historical 2023-24 Session
  if (str.includes('2023-24') || str.includes('2023')) {
    return '2023-24';
  }

  return sess;
}

export const isSessionMatch = (rawSess, targetFilter) => {
  if (!rawSess || !targetFilter || targetFilter === 'all') return true;
  const sNorm = normalizePracticalSession(rawSess);
  const tNorm = normalizePracticalSession(targetFilter);

  if (tNorm === 'all' || sNorm === 'all') return true;
  if (tNorm === '2025-26') {
    return sNorm === '2025-26';
  }
  if (tNorm === '2024-25 (Oct-Nov)' || tNorm === '2024-25') {
    return sNorm === '2024-25 (Oct-Nov)';
  }
  if (tNorm === '2023-24') {
    return sNorm === '2023-24';
  }

  const s = String(sNorm).toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = String(tNorm).toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === t || s.includes(t) || t.includes(s);
};

export const checkStudentApprovalState = (st) => {
  const isDropped = isStudentExamDropped(st);

  const rollVal = getRollNo(st);
  const hasRoll = Boolean(
    rollVal &&
    rollVal !== '—' &&
    rollVal !== '-' &&
    rollVal !== 'N/A' &&
    rollVal !== 'null' &&
    rollVal !== 'undefined' &&
    rollVal !== '0'
  );

  const statusStr = String(st.Status || st.status || st['Admission Status'] || st.admissionStatus || '').toLowerCase();
  const isRejected = isDropped || statusStr.includes('reject') || statusStr.includes('cancel') || st.isRejected === true;

  const stSess = String(st.Session || st.session || st.academicSession || '');
  const isCurrentSession = !stSess || stSess.includes('2025-26');
  // For the current academic session (2025-26), only students with an authentic assigned Class Roll Number are approved
  const isExplicitApproved = statusStr.includes('approv') || statusStr.includes('admit') || statusStr.includes('complet') || statusStr.includes('active') || st.isApproved === true || st._source === 'masterRegisters';
  const isApproved = !isRejected && !isDropped && (hasRoll || (!isCurrentSession && isExplicitApproved));
  const isPending = !isApproved && !isRejected && !isDropped;

  return { isApproved, isRejected, isPending, isDropped, hasRoll };
};

const normalizeStudentFields = (st, source = 'masterRegisters') => {
  const sNo = st['S. No.'] || st['S.No.'] || st['S.No'] || st['sNo'] || st['Serial No'] || '';
  const formNo = st['Form No.'] || st['Form No'] || st['formNo'] || st['Application No'] || '';
  const studentName = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '';
  const fatherName = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '';
  const stream = getStudentStreamStr(st) || 'Humanities';
  const subjects10 = st['Subjects to be taken in Class 10th'] || st['Subjects in Class 10th'] || '';
  const subjects11 = st['Subjects to be taken in Class 11th'] || st['Subjects'] || st['Subs'] || '';
  const subjects12 = st['Subjects to be taken in Class 12th'] || st['Subjects'] || st['Subs'] || '';

  let session = getStudentSession(st);
  if (!session) {
    session = source === 'masterRegisters' ? '2024-25 (Oct-Nov)' : '2025-26';
  }
  session = normalizePracticalSession(session);

  let classRoll = String(
    st['Class Roll No'] ||
    st['Class Roll No.'] ||
    st.classRollNo ||
    st['Class Roll'] ||
    st.rollNo ||
    st.RollNo ||
    st.roll_no ||
    st['Roll No'] ||
    st['Roll No.'] ||
    st.ClassRoll ||
    ''
  ).trim();

  let examRoll = getCurrentOfficialExamRoll(st);
  if (!examRoll) {
    examRoll = String(
      st['Exam R.No. (Current)'] ||
      st.examRollNo ||
      st['Exam Roll No'] ||
      st['Exam Roll No.'] ||
      st.examRoll ||
      ''
    ).trim();
  }

  const boardReg = cleanRegistrationNumber(
    st['Board Registration Number'] ||
    st['Board Reg. No.'] ||
    st.boardRegNo ||
    st.regNo ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 10th)'] ||
    st['Board Registration No. (Class 9th)'] ||
    st['DIET Registration No.'] ||
    st['DIET/Board Reg. No.'] ||
    st['DIET Reg. No.'] ||
    st['Registration No. (allotted by JKBOSE)'] ||
    st['Registration No. (allotted by DIET)'] ||
    ''
  );

  // If classRoll contains an 8-digit Exam Roll number (e.g. 201002085)
  if (/^\d{7,9}$/.test(classRoll)) {
    if (!examRoll || examRoll === '—') {
      examRoll = classRoll;
    }
    const fallbackSNo = String(st.sNo || st['S. No.'] || st['S.No.'] || st['S.No'] || '').trim();
    classRoll = fallbackSNo && !/^\d{7,}$/.test(fallbackSNo) ? fallbackSNo : '—';
  }

  return {
    ...st,
    _source: source,
    'S. No.': sNo,
    'Form No.': formNo,
    'Class Roll No': classRoll || '—',
    'Exam R.No. (Current)': examRoll || '—',
    'Board Registration Number': boardReg || '—',
    "Student's Name (as per school records)": studentName,
    "Father's/Guardian's Name (as per school records)": fatherName,
    'Stream': stream,
    'Stream for Class 11th': stream,
    'Stream for Class 12th': stream,
    'Subjects to be taken in Class 10th': subjects10,
    'Subjects to be taken in Class 11th': subjects11,
    'Subjects to be taken in Class 12th': subjects12,
    'Subjects': st['Subjects'] || st['Subs'] || subjects11,
    'Subs': st['Subs'] || st['Subjects'] || subjects11,
    Session: session,
    session: session,
  };
};

function PracticalsLoader() {
  return (
    <ModernLoader
      moduleKey="practicals"
      text="Loading practical records…"
      subtext="Please wait."
    />
  );
}

let memoryPracticalsData = null;
let memoryPracticalsSettings = null;
let memoryPracticalsTs = 0;

export const parsePracticalsSnap = (snap) => {
  if (!snap || !Array.isArray(snap.docs)) return { canonicalSubmissions: [], pendingSubmissions: [] };
  const allSubmissions = snap.docs
    .map(d => {
      const data = d.data();
      const cleanRecs = (data.records || []).filter(r => {
        if (!r || typeof r !== 'object') return false;
        const name = String(r.name || r.studentName || '').toLowerCase().trim();
        if (!name || name.includes('studentname') || name.includes('fathername')) return false;
        return true;
      });
      const canonicalSession = normalizePracticalSession(data.sessionCanonical || data.yearSuffix || data.sessionText || data.session || '');
      
      // Unify practicals history of e.educational.24@gmail.com (admin) into socialshiftz@gmail.com (teacher)
      let tEmail = String(data.teacherEmail || data.submittedByEmail || data.email || '').toLowerCase().trim();
      let subByEmail = String(data.submittedByEmail || data.teacherEmail || '').toLowerCase().trim();
      if (tEmail.includes('e.educational')) tEmail = 'socialshiftz@gmail.com';
      if (subByEmail.includes('e.educational')) subByEmail = 'socialshiftz@gmail.com';
      const tName = (tEmail === 'socialshiftz@gmail.com' || subByEmail === 'socialshiftz@gmail.com')
        ? 'Sheikh Gulfam'
        : (data.teacherName || data.submittedByName || 'Faculty Member');

      return {
        id: d.id,
        ...data,
        teacherEmail: tEmail || data.teacherEmail,
        submittedByEmail: subByEmail || data.submittedByEmail,
        teacherName: tName,
        submittedByName: tName,
        sessionText: canonicalSession,
        session: canonicalSession,
        records: cleanRecs
      };
    })
    .filter(sub => !sub.id.startsWith('history_') && sub.records && sub.records.length > 0);

  // Practicals portal strictly holds practical data only (Internal Assessment & External Practical)
  const practicalSubmissions = allSubmissions.filter(sub =>
    isPracticalEvaluationType(sub.practicalType || sub.evaluationType || sub.examTitle || sub.title)
  );

  const canonicalSubmissions = practicalSubmissions.filter(sub => !sub.id.startsWith('pending_') && sub.status !== 'pending_approval');
  const pendingSubmissions = practicalSubmissions.filter(sub => sub.id.startsWith('pending_') || sub.status === 'pending_approval');

  return { canonicalSubmissions, pendingSubmissions };
};

export const invalidatePracticalsCache = () => {
  memoryPracticalsData = null;
  memoryPracticalsSettings = null;
  memoryPracticalsTs = 0;
  invalidateCollectionCache('practicalsData');
  invalidateCollectionCache('adminPracticalsSettings');
};

// ─────────────────────────────────────────────────────────────
// MAIN ADMIN PRACTICALS PORTAL COMPONENT
// ─────────────────────────────────────────────────────────────
function AdminPracticals() {
  const getInitialPracticalsTab = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSubTab = searchParams.get('subtab');
      if (urlSubTab && ['class10', 'class11', 'class12', 'teachers', 'settings'].includes(urlSubTab)) return urlSubTab;
      const saved = sessionStorage.getItem('hss_admin_practicals_tab');
      if (saved && ['class10', 'class11', 'class12', 'teachers', 'settings'].includes(saved)) return saved;
    } catch (_) {}
    return 'class11';
  };

  const [tab, setTabState] = useState(getInitialPracticalsTab);

  const setTab = useCallback((newTab) => {
    setTabState(newTab);
    try {
      sessionStorage.setItem('hss_admin_practicals_tab', newTab);
      const url = new URL(window.location.href);
      if (newTab === 'class11') {
        url.searchParams.delete('subtab');
      } else {
        url.searchParams.set('subtab', newTab);
      }
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  const [submissions, setSubmissions] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [rejectReasonModal, setRejectReasonModal] = useState({ isOpen: false, pendingDoc: null, reason: '' });
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [settings, setSettings] = useState({
    evaluationMarksConfig: DEFAULT_PRACTICAL_MARKS_CONFIG,
    maxMarks10: DEFAULT_MX10,
    maxMarks11: DEFAULT_MX11,
    maxMarks12: DEFAULT_MX12,
    nonPractical10: '',
    nonPractical11: '',
    nonPractical12: '',
    currentYearSuffix: '26',
    absentMarker: 'A',
    currentPracticalType: 'internal',
    permissions: [],
    printDetails: {
      '10th': {
        sessionText: 'Annual Regular 2026',
        instName: 'Govt. Higher Secondary School Shangus',
        inchargeName: 'Mr. Majid Hassan Najar',
        inchargeCpis: 'SHGEDU00220017',
        inchargeMobile: '7006537425'
      },
      '11th': {
        sessionText: 'Annual Regular 2026',
        instName: 'Govt. Higher Secondary School Shangus',
        inchargeName: 'Mr. Majid Hassan Najar',
        inchargeCpis: 'SHGEDU00220017',
        inchargeMobile: '7006537425'
      },
      '12th': {
        sessionText: 'Annual Regular 2026',
        instName: 'Govt. Higher Secondary School Shangus',
        inchargeName: 'Mr. Bilal Ahmad Khandy',
        inchargeCpis: 'KGLEDU00120015',
        inchargeMobile: '9596165142'
      }
    }
  });

  // Modal States
  const [selSub, setSelSub] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const excelMenuRef = useRef(null);

  // Close Excel menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (excelMenuRef.current && !excelMenuRef.current.contains(e.target)) {
        setShowExcelMenu(false);
      }
    };
    if (showExcelMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showExcelMenu]);

  // Settings tab form states
  const [grantEmail, setGrantEmail] = useState('');
  const [grantClass, setGrantClass] = useState('11th');
  const [grantSubject, setGrantSubject] = useState('PH');
  const [emailSt, setEmailSt] = useState({});

  // Custom Confirmation Modal State
  const [generalConfirmModal, setGeneralConfirmModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    badgeText: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmBtnStyle: 'danger',
    icon: AlertCircle,
    children: null,
    onConfirm: () => {}
  });

  // Practicals Submission Recycle Bin Modal
  const [showPracticalsRecycleBin, setShowPracticalsRecycleBin] = useState(false);

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    if (force) {
      memoryPracticalsData = null;
      memoryPracticalsSettings = null;
      memoryPracticalsTs = 0;
      invalidateCollectionCache('practicalsData');
      invalidateCollectionCache('adminPracticalsSettings');
    }
    try {
      const isFresh = !force && memoryPracticalsData && (Date.now() - memoryPracticalsTs < 3 * 60 * 1000);

      const fetchPracticals = isFresh
        ? Promise.resolve(memoryPracticalsData)
        : getDocs(collection(db, 'practicalsData')).then(snap => {
            memoryPracticalsData = snap;
            memoryPracticalsTs = Date.now();
            return snap;
          }).catch(err => {
            console.warn('practicalsData fetch note:', err?.message || err);
            return { docs: [], empty: true };
          });

      const fetchSettings = (!force && memoryPracticalsSettings)
        ? Promise.resolve(memoryPracticalsSettings)
        : getDocs(collection(db, 'adminPracticalsSettings')).then(snap => {
            memoryPracticalsSettings = snap;
            return snap;
          }).catch(err => {
            console.warn('adminPracticalsSettings fetch note:', err?.message || err);
            return { docs: [], empty: true };
          });

      const [ssRaw, setDocSnap, ts, admissionsData, masterRegistersData] = await Promise.all([
        fetchPracticals,
        fetchSettings,
        getStaffDirectory().catch(err => {
          console.warn('getStaffDirectory error handled:', err?.message || err);
          return { docs: [], empty: true, forEach: () => {} };
        }),
        getCachedCollection('admissions', force, 30 * 60 * 1000).catch(err => {
          console.warn('admissions fetch note:', err?.message || err);
          return [];
        }),
        getCachedCollection('masterRegisters', force, 30 * 60 * 1000).catch(err => {
          console.warn('masterRegisters fetch note:', err?.message || err);
          return [];
        })
      ]);

      const savedSettings = !setDocSnap.empty ? setDocSnap.docs.find(x => x.id === 'config')?.data() : null;
      if (savedSettings) {
        setSettings(p => ({
          ...p,
          ...savedSettings,
          evaluationMarksConfig: savedSettings.evaluationMarksConfig || savedSettings.evaluationSettings || savedSettings.marksConfig || p.evaluationMarksConfig || DEFAULT_PRACTICAL_MARKS_CONFIG
        }));
      }

      const studentsMap = new Map();
      const indexByReg = new Map();
      const indexByForm = new Map();
      const indexByRoll = new Map();
      const indexByName = new Map();
      const indexByExam = new Map();

      const cleanStr = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

      const extractCleanClass = (st) => {
        const c = String(
          st['Class'] ||
          st['class'] ||
          st['Admission sought for class'] ||
          st['Class for Admission'] ||
          st['className'] ||
          st['admittedClass'] ||
          ''
        ).trim();
        if (c.includes('12') || c.includes('XII') || c.toLowerCase().includes('twelve')) return '12th';
        if (c.includes('11') || c.includes('XI') || c.toLowerCase().includes('eleven')) return '11th';
        if (c.includes('10') || c.includes('X') || c.toLowerCase().includes('ten')) return '10th';
        if (c.includes('9') || c.includes('IX') || c.toLowerCase().includes('nine')) return '9th';

        const exam = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || st['Class Roll No'] || '').trim();
        if (/^3\d{7,8}/.test(exam)) return '12th';
        if (/^2\d{7,8}/.test(exam)) return '11th';
        return '11th';
      };

      const cleanCls = (st) => extractCleanClass(st).replace(/[^0-9]/g, '');
      const cleanSess = (st) => {
        const sess = getStudentSession(st);
        return normalizePracticalSession(sess);
      };

      const addOrMergeStudent = (rawSt, source) => {
        const st = normalizeStudentFields(rawSt, source);
        const name = cleanStr(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name);
        const father = cleanStr(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName);
        const reg = cleanRegistrationNumber(st['Board Registration Number'] || st.regNo || '');
        const form = String(st['Form No.'] || '').trim();
        const roll = String(getRollNo(st) || '').trim();
        const cls = cleanCls(st);
        const canonicalCls = extractCleanClass(st);
        st.Class = canonicalCls;
        st.class = canonicalCls;

        const exam = String(getCurrentOfficialExamRoll(st, canonicalCls) || st['Exam R.No. (Current)'] || st.examRollNo || '').trim().toUpperCase();

        // STRICT GUARD: Skip empty / ghost rows
        if (!name && !father && (!roll || roll === '—') && (!exam || exam === '—') && (!reg || reg === '—')) {
          return;
        }

        const sess = cleanSess(st);
        st.Session = sess;
        st.session = sess;

        let existingId = null;
        if (reg && reg !== '—' && reg !== 'N/A' && indexByReg.has(`reg_${reg}_cls_${cls}_sess_${sess}`)) {
          existingId = indexByReg.get(`reg_${reg}_cls_${cls}_sess_${sess}`);
        } else if (exam && exam !== '—' && exam !== 'N/A' && indexByExam.has(`exam_${exam}_cls_${cls}_sess_${sess}`)) {
          existingId = indexByExam.get(`exam_${exam}_cls_${cls}_sess_${sess}`);
        } else if (form && form !== '—' && form !== 'N/A' && indexByForm.has(`cls_${cls}_sess_${sess}_form_${form}`)) {
          existingId = indexByForm.get(`cls_${cls}_sess_${sess}_form_${form}`);
        } else if (roll && roll !== '—' && roll !== 'N/A' && !/^\d{8,}$/.test(roll) && indexByRoll.has(`cls_${cls}_sess_${sess}_roll_${roll}`)) {
          existingId = indexByRoll.get(`cls_${cls}_sess_${sess}_roll_${roll}`);
        } else if (name && father && indexByName.has(`cls_${cls}_sess_${sess}_name_${name}_${father}`)) {
          existingId = indexByName.get(`cls_${cls}_sess_${sess}_name_${name}_${father}`);
        }

        if (existingId && studentsMap.has(existingId)) {
          const existing = studentsMap.get(existingId);

          const isLiveAdmission = source === 'admissions' || st._source === 'admissions';

          const stStream = getStudentStreamStr(st, canonicalCls);
          const existingStream = getStudentStreamStr(existing, canonicalCls);
          const finalStream = (isLiveAdmission && stStream) ? stStream : (existingStream || stStream || 'Science');

          const stSubs = getStudentSubjectsStr(st, canonicalCls);
          const existingSubs = getStudentSubjectsStr(existing, canonicalCls);
          const finalSubs = (isLiveAdmission && stSubs) ? stSubs : (stSubs || existingSubs || '');

          const finalRoll = getRollNo(st) || getRollNo(existing) || '—';
          const stOfficialExam = getCurrentOfficialExamRoll(st, canonicalCls);
          const existingOfficialExam = getCurrentOfficialExamRoll(existing, canonicalCls);
          const finalExam = stOfficialExam || existingOfficialExam || (isValidExamRollForClass(exam, canonicalCls) ? exam : (existing['Exam R.No. (Current)'] || existing.examRollNo || '—'));
          const finalReg = (reg && reg !== '—' && reg !== 'N/A') ? reg : (existing['Board Registration Number'] || existing.regNo || '—');

          // Session priority: prefer '2025-26' if present in either existing or new record
          const finalSess = (sess === '2025-26' || existing.session === '2025-26' || existing.Session === '2025-26')
            ? '2025-26'
            : (sess || existing.Session || existing.session || '2024-25 (Oct-Nov)');

          const isDropped = Boolean(
            st.isExamDropped ||
            existing.isExamDropped ||
            st.examDropped ||
            existing.examDropped ||
            isStudentExamDropped(st) ||
            isStudentExamDropped(existing)
          );

          const merged = {
            ...existing,
            ...st,
            Class: canonicalCls,
            class: canonicalCls,
            Session: finalSess,
            session: finalSess,
            Stream: finalStream,
            stream: finalStream,
            'Stream for Class 12th': finalStream,
            'Stream for Class 11th': finalStream,
            Subjects: finalSubs,
            Subs: finalSubs,
            subjects: finalSubs,
            'Subjects to be taken in Class 11th': (canonicalCls.includes('11') && finalSubs) ? finalSubs : (st['Subjects to be taken in Class 11th'] || existing['Subjects to be taken in Class 11th'] || ''),
            'Subjects to be taken in Class 12th': (canonicalCls.includes('12') && finalSubs) ? finalSubs : (st['Subjects to be taken in Class 12th'] || existing['Subjects to be taken in Class 12th'] || ''),
            'Class Roll No': finalRoll,
            classRollNo: finalRoll,
            'Exam R.No. (Current)': finalExam,
            examRollNo: finalExam,
            'Board Registration Number': finalReg,
            boardRegNo: finalReg,
            isExamDropped: isDropped,
            examStatus: isDropped ? 'dropped' : (st.examStatus || existing.examStatus || 'active'),
            _source: isLiveAdmission ? 'admissions' : (existing._source || source),
          };
          studentsMap.set(existingId, merged);
        } else {
          const newId = `st_${cls}_${sess}_${reg || exam || form || roll || name}_${Math.random()}`;
          studentsMap.set(newId, st);
          if (reg && reg !== '—' && reg !== 'N/A') indexByReg.set(`reg_${reg}_cls_${cls}_sess_${sess}`, newId);
          if (exam && exam !== '—' && exam !== 'N/A') indexByExam.set(`exam_${exam}_cls_${cls}_sess_${sess}`, newId);
          if (form && form !== '—' && form !== 'N/A') indexByForm.set(`cls_${cls}_sess_${sess}_form_${form}`, newId);
          if (roll && roll !== '—' && roll !== 'N/A' && !/^\d{8,}$/.test(roll)) indexByRoll.set(`cls_${cls}_sess_${sess}_roll_${roll}`, newId);
          if (name && father) indexByName.set(`cls_${cls}_sess_${sess}_name_${name}_${father}`, newId);
        }
      };

      const { canonicalSubmissions, pendingSubmissions } = parsePracticalsSnap(ssRaw);

      setSubmissions(canonicalSubmissions);
      setPendingApprovals(pendingSubmissions);

      // 1. Ingest Master Registers (Canonical School Historical Registers across Sessions)
      (masterRegistersData || []).forEach(d => {
        const items = d.items || d.students || d.records || d.data;
        const groupKey = d.groupKey || '';
        let docSession = d.Session || d.session || d['Academic Session'] || '';
        if (!docSession) {
          if (groupKey && /\d{4}/.test(groupKey)) docSession = groupKey.split('_')[0];
          else if (d.id && /\d{4}/.test(d.id)) docSession = d.id.replace(/^part_/, '').split('_')[0];
          else docSession = '2024-25 (Oct-Nov)';
        }
        if (!/\d{4}/.test(docSession)) {
          docSession = '2024-25 (Oct-Nov)';
        }
        const canonicalDocSess = normalizePracticalSession(docSession);
        const docClass = d.class || d.Class || d.className || (groupKey ? groupKey.split('_')[1] : '') || '';

        if (Array.isArray(items)) {
          items.forEach(it => {
            if (!it || typeof it !== 'object') return;
            const itemSess = it.Session || it.session || it['Academic Session'] || canonicalDocSess;
            addOrMergeStudent({
              ...it,
              session: normalizePracticalSession(itemSess),
              Session: normalizePracticalSession(itemSess),
              class: it.class || it.Class || it['Class'] || docClass,
              _source: 'masterRegisters'
            }, 'masterRegisters');
          });
        } else if (d.StudentName || d["Student's Name"] || d.name) {
          addOrMergeStudent({
            ...d,
            session: canonicalDocSess,
            Session: canonicalDocSess,
            class: docClass || d.class || d.Class,
            _source: 'masterRegisters'
          }, 'masterRegisters');
        }
      });

      // 2. Ingest Active Student Admissions (Current Live Intake 2025-26 & Registered Students)
      (admissionsData || []).forEach(st => {
        const approval = checkStudentApprovalState(st);
        if (!approval.isApproved) return;
        const sess = getStudentSession(st) || '2025-26';
        addOrMergeStudent({
          ...st,
          session: sess,
          Session: sess,
          _source: 'admissions'
        }, 'admissions');
      });

      // 3. Enrich existing students with Exam Rolls and Registration Numbers from Practical Submissions (NO duplicate student injections)
      canonicalSubmissions.forEach(sub => {
        const subCls = sub.className || (String(sub.id).startsWith('12') ? '12th' : '11th');
        const subSess = normalizePracticalSession(sub.sessionText || sub.session || '2024-25 (Oct-Nov)');

        (sub.records || []).forEach(r => {
          const rawReg = cleanRegistrationNumber(r.boardRegNo || r.regNo || r['Board Reg. No.'] || '');
          const rawExam = String(r.examRollNo || (/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || '').trim();
          const rName = cleanStr(r.name || r.studentName);
          const rFather = cleanStr(r.parentage || r.parentName || r.fatherName);

          const clsNum = subCls.replace(/[^0-9]/g, '');
          let existingId = null;
          if (rawReg && indexByReg.has(`reg_${rawReg}_cls_${clsNum}_sess_${subSess}`)) {
            existingId = indexByReg.get(`reg_${rawReg}_cls_${clsNum}_sess_${subSess}`);
          } else if (rawExam && indexByExam.has(`exam_${rawExam}_cls_${clsNum}_sess_${subSess}`)) {
            existingId = indexByExam.get(`exam_${rawExam}_cls_${clsNum}_sess_${subSess}`);
          } else if (rName && rFather && indexByName.has(`cls_${clsNum}_sess_${subSess}_name_${rName}_${rFather}`)) {
            existingId = indexByName.get(`cls_${clsNum}_sess_${subSess}_name_${rName}_${rFather}`);
          }

          if (existingId && studentsMap.has(existingId)) {
            const existing = studentsMap.get(existingId);
            const currentOfficialExam = getCurrentOfficialExamRoll(existing, subCls);
            const shouldAdoptSubmissionExam = !currentOfficialExam && isValidExamRollForClass(rawExam, subCls);
            const finalExamRoll = currentOfficialExam || (shouldAdoptSubmissionExam ? rawExam : (existing['Exam R.No. (Current)'] || existing.examRollNo || '—'));

            studentsMap.set(existingId, {
              ...existing,
              'Exam R.No. (Current)': finalExamRoll,
              examRollNo: finalExamRoll,
              'Board Registration Number': (rawReg && rawReg !== '—') ? rawReg : (existing['Board Registration Number'] || existing.regNo || '—'),
              boardRegNo: (rawReg && rawReg !== '—') ? rawReg : (existing.boardRegNo || existing['Board Registration Number'] || '—'),
            });
          }
        });
      });

      // 4. Offline / Quota Fallback Seed: If live collections returned no students for the current session
      if (studentsMap.size === 0) {
        try {
          const verifiedModule = await import('../../data/verifiedStudentsCatalog.json');
          const verifiedList = verifiedModule.default || verifiedModule;
          if (Array.isArray(verifiedList) && verifiedList.length > 0) {
            verifiedList.forEach(st => {
              const approval = checkStudentApprovalState(st);
              if (!approval.isApproved) return;
              addOrMergeStudent({
                ...st,
                class: st.className || st.class,
                Class: st.className || st.Class,
                session: st.session || '2025-26',
                Session: st.session || '2025-26',
                _source: 'verifiedCatalog'
              }, 'verifiedCatalog');
            });
          }
        } catch (_) {}
      }

      const allStudentList = Array.from(studentsMap.values());

      // Helper to safely extract registration number from any known alias
      const extractReg = (s) => cleanRegistrationNumber(
        s['Board Registration Number'] ||
        s['Board Reg. No.'] ||
        s['Board Reg No'] ||
        s['Board Registration No. (Class 11th)'] ||
        s['Board Registration No. (Class 9th)'] ||
        s['Board Registration No.'] ||
        s.boardRegNo ||
        s.regNo ||
        s['Registration No'] ||
        s['Reg No'] ||
        s['Reg. No.'] ||
        ''
      );

      // Index Class 11th (and 9th) records by Registration Number & Name+Father Name
      const class11ByReg = new Map();
      const class11ByName = new Map();

      allStudentList.forEach(st => {
        const cls = String(st.Class || st.class || '');
        if (cls.includes('11') || cls.includes('XI') || cls.includes('9') || cls.includes('IX')) {
          const reg = extractReg(st);
          const name = cleanStr(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name);
          const father = cleanStr(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName);
          const stream = getStudentStreamStr(st, '11th');
          const subjects = getStudentSubjectsStr(st, '11th');

          if (stream || subjects) {
            if (reg && reg !== '—' && reg !== 'N/A') class11ByReg.set(reg, { stream, subjects, st });
            if (name && father) class11ByName.set(`${name}_${father}`, { stream, subjects, st });
          }
        }
      });

      const isPlaceholderSubs = (sub) => {
        if (!sub) return true;
        const s = String(sub).trim();
        if (!s || s === '—' || s === 'N/A') return true;
        return /^(same\s*as|general\s*english|science|medical|non-medical|arts|humanities|commerce|—|-|null|undefined)$/i.test(s);
      };

      // Enrich Class 12th (and 10th) records using previous class data if stream/subjects are missing
      const enrichedStudents = allStudentList.map(st => {
        const cls = String(st.Class || st.class || '');
        if (cls.includes('12') || cls.includes('XII') || cls.includes('10') || cls.includes('X')) {
          const reg = extractReg(st);
          const name = cleanStr(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name);
          const father = cleanStr(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName);

          const curStream = getStudentStreamStr(st, '12th');
          const curSubjects = getStudentSubjectsStr(st, '12th');

          const prevMatch = (reg && class11ByReg.get(reg)) || (name && father && class11ByName.get(`${name}_${father}`));

          let finalStream = curStream;
          let finalSubjects = curSubjects;

          if (prevMatch) {
            if (!finalStream || finalStream === 'General' || isPlaceholderSubs(finalStream)) {
              if (prevMatch.stream) finalStream = prevMatch.stream;
            }
            if (isPlaceholderSubs(finalSubjects)) {
              finalSubjects = prevMatch.subjects;
            }
          }

          // If subjects or stream indicate Medical/Science, enforce Science stream only if student was not already authentic Arts/Humanities
          if (finalSubjects && (!curStream || curStream === 'General' || isPlaceholderSubs(curStream))) {
            const normSubs = finalSubjects.toUpperCase();
            if (normSubs.includes('BOTANY') || normSubs.includes('ZOOLOGY') || normSubs.includes('BIOLOGY') || normSubs.includes('PHYSICS') || normSubs.includes('CHEMISTRY')) {
              finalStream = 'Science';
            }
          }

          if (finalStream || finalSubjects) {
            return {
              ...st,
              Stream: finalStream || st.Stream,
              stream: finalStream || st.stream,
              'Stream for Class 12th': finalStream || st['Stream for Class 12th'],
              'Stream Studied in Class 11th': finalStream || st['Stream Studied in Class 11th'],
              'Stream for Class 11th': finalStream || st['Stream for Class 11th'],
              Subjects: finalSubjects || st.Subjects,
              Subs: finalSubjects || st.Subs,
              'Subjects Studied in Class 11th': finalSubjects || st['Subjects Studied in Class 11th'],
              'Subjects to be taken in Class 12th': finalSubjects || st['Subjects to be taken in Class 12th'],
            };
          }
        }
        return st;
      });

      setStudents(enrichedStudents);

      const rawExclusions = (savedSettings && Array.isArray(savedSettings.excludedTeacherEmails)) ? savedSettings.excludedTeacherEmails : DEFAULT_EXCLUDED_TEACHERS;
      const excludedSet = new Set(rawExclusions.map(e => String(e).toLowerCase().trim()));

      setTeachers(
        (ts?.docs || [])
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => {
            const email = String(u.email || '').toLowerCase().trim();
            if (excludedSet.has(email) || email.includes('e.educational')) return false;
            const r = String(u.role || '').toLowerCase();
            return r === 'teacher' || r === 'faculty' || r === 'examiner' || r === 'staff';
          })
      );
    } catch (e) {
      console.error(e);
      showAlert('error', 'Failed to load practicals data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExcludeTeacher = (teacher) => {
    const tEmail = String(teacher.email || '').toLowerCase().trim();
    if (!tEmail) return;
    setGeneralConfirmModal({
      isOpen: true,
      title: 'Remove Faculty Member?',
      subtitle: `Are you sure you want to remove ${teacher.name || tEmail} from the Practical Portal faculty list?`,
      badgeText: 'Faculty Account',
      confirmText: 'Remove Faculty',
      cancelText: 'Cancel',
      confirmBtnStyle: 'danger',
      icon: Trash2,
      onConfirm: async () => {
        setGeneralConfirmModal(p => ({ ...p, isOpen: false }));
        const currentEx = Array.isArray(settings.excludedTeacherEmails) ? settings.excludedTeacherEmails : DEFAULT_EXCLUDED_TEACHERS;
        const updated = Array.from(new Set([...currentEx, tEmail]));
        const newSettings = { ...settings, excludedTeacherEmails: updated };
        await saveSettingsDoc('Faculty Exclusions', newSettings);
        setTeachers(prev => prev.filter(t => String(t.email || '').toLowerCase().trim() !== tEmail));
      }
    });
  };

  useEffect(() => {
    loadData();

    // 1. Real-time Firestore sync on practicalsData so submissions by faculty reflect immediately
    const unsubPracticals = onSnapshot(collection(db, 'practicalsData'), (snap) => {
      if (!snap || snap.empty === undefined) return;
      memoryPracticalsData = snap;
      memoryPracticalsTs = Date.now();
      const { canonicalSubmissions, pendingSubmissions } = parsePracticalsSnap(snap);
      setSubmissions(canonicalSubmissions);
      setPendingApprovals(pendingSubmissions);
    }, (err) => {
      console.warn('Real-time practicalsData listener error:', err?.message || err);
    });

    // 2. Real-time Firestore sync on adminPracticalsSettings/config so permissions reflect immediately
    const unsubSettings = onSnapshot(doc(db, 'adminPracticalsSettings', 'config'), (snap) => {
      if (!snap || !snap.exists()) return;
      const data = snap.data();
      memoryPracticalsSettings = { docs: [{ id: 'config', data: () => data }], empty: false };
      setSettings(prev => ({
        ...prev,
        ...data,
        evaluationMarksConfig: data.evaluationMarksConfig || data.evaluationSettings || data.marksConfig || prev.evaluationMarksConfig || DEFAULT_PRACTICAL_MARKS_CONFIG
      }));
    }, (err) => {
      console.warn('Real-time adminPracticalsSettings listener error:', err?.message || err);
    });

    let debounceTimer = null;
    const handleUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData(false);
      }, 350);
    };

    const handleResultsUpdate = () => {
      invalidatePracticalsCache();
      handleUpdate();
    };

    window.addEventListener('hss-student-updated', handleUpdate);
    window.addEventListener('hss-results-updated', handleResultsUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      try { unsubPracticals(); } catch (_) {}
      try { unsubSettings(); } catch (_) {}
      window.removeEventListener('hss-student-updated', handleUpdate);
      window.removeEventListener('hss-results-updated', handleResultsUpdate);
    };
  }, [loadData]);

  const saveSettingsDoc = async (keyName, updatedSettings) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'adminPracticalsSettings', 'config'), sanitizeForFirestore(updatedSettings), { merge: true });
      try {
        localStorage.setItem('hss_admin_practicals_settings', JSON.stringify(updatedSettings));
      } catch (_) {}
      invalidateCollectionCache('adminPracticalsSettings');
      memoryPracticalsSettings = null;
      setSettings(updatedSettings);
      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Practical Settings',
        details: `Saved practical settings: ${keyName}`,
        metadata: { keyName }
      });
      showAlert('success', `${keyName} saved successfully to cloud database.`);
      return true;
    } catch (e) {
      console.error('Save settings error:', e);
      showAlert('error', `Failed to save ${keyName}.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubmission = (subId, subDoc) => {
    if (!subId) return;
    const label = subDoc
      ? `${subDoc.subject || 'Subject'} (${subDoc.className || 'Class'}) — ${subDoc.practicalType || subDoc.evaluationType || 'Submission'}`
      : `"${subId}"`;
    const teacher = subDoc?.submittedBy || subDoc?.submittedByName || 'the teacher';

    setGeneralConfirmModal({
      isOpen: true,
      title: 'Move Submission to Recycle Bin?',
      subtitle: `This will soft-delete the award submission ${label} by ${teacher} and move it to the Practicals Recycle Bin. The teacher's slot will be freed so they can submit afresh.`,
      badgeText: 'Soft Delete — Recoverable',
      confirmText: 'Move to Recycle Bin',
      cancelText: 'Cancel',
      confirmBtnStyle: 'danger',
      icon: Trash2,
      onConfirm: async () => {
        setGeneralConfirmModal(p => ({ ...p, isOpen: false }));
        try {
          const currentUser = auth.currentUser;
          const docToDelete = subDoc || { id: subId };

          // Close inspected submission modal if open
          setSelSub(null);

          await moveSubmissionToRecycleBin(docToDelete, {
            name: currentUser?.displayName || 'Administrator',
            email: currentUser?.email || ''
          });

          invalidateCollectionCache('practicalsData');
          invalidatePracticalsCache();

          // Immediately remove matching records from local states
          const cleanSubId = String(subId || '').replace(/^pending_/, '');
          const targetCls = String(docToDelete.className || docToDelete.Class || docToDelete.class || '').replace(/[^0-9]/g, '');
          const targetSub = String(docToDelete.subjectCode || docToDelete.subject || docToDelete.subjectName || '').toUpperCase();
          const targetType = String(docToDelete.practicalType || docToDelete.evaluationType || 'internal').toLowerCase();

          const isMatchForDeletion = (s) => {
            if (!s) return false;
            const sId = String(s.id || '');
            const sClean = sId.replace(/^pending_/, '');
            if (sId === subId || sId === docToDelete.id || sClean === cleanSubId) return true;
            if (s.targetDocId && (s.targetDocId === subId || s.targetDocId === cleanSubId)) return true;
            if (s.canonicalDocId && (s.canonicalDocId === subId || s.canonicalDocId === cleanSubId)) return true;
            if (targetCls && targetSub) {
              const sCls = String(s.className || s.Class || s.class || '').replace(/[^0-9]/g, '');
              const sSub = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
              const sType = String(s.practicalType || s.evaluationType || 'internal').toLowerCase();
              if (sCls === targetCls && (sSub === targetSub || sSub.includes(targetSub) || targetSub.includes(sSub))) {
                if (sType === targetType || sType.includes(targetType) || targetType.includes(sType)) {
                  return true;
                }
              }
            }
            return false;
          };

          setSubmissions(prev => prev.filter(s => !isMatchForDeletion(s)));
          setPendingApprovals(prev => prev.filter(p => !isMatchForDeletion(p)));

          // Immediately force-reload live ground truth from Firestore
          await loadData(true);

          logAdminActivity({
            actionType: 'delete',
            actionTitle: 'Moved Practical Submission to Recycle Bin',
            details: `Moved award submission ${label} (by ${teacher}) to Practicals Recycle Bin — teacher slot freed for re-submission`,
            metadata: { subId, label, teacher }
          });
          showAlert('success', `Submission moved to Recycle Bin. ${teacher} can now submit afresh.`);
        } catch (e) {
          console.error(e);
          showAlert('error', `Failed to delete submission: ${e.message || e}`);
        }
      }
    });
  };

  const handleApproveSubmission = (pendingDoc) => {
    if (!pendingDoc) return;
    const targetDocId = pendingDoc.targetDocId || pendingDoc.id.replace(/^pending_/, '');
    const subjectName = pendingDoc.subject || 'Subject';
    const className = pendingDoc.className || 'Class';
    const submittedBy = pendingDoc.submittedBy || 'Teacher';

    setGeneralConfirmModal({
      isOpen: true,
      title: 'Approve & Integrate Awards into DB?',
      subtitle: `Approve award submission for ${subjectName} (${className}) submitted by ${submittedBy} (${pendingDoc.records?.length || 0} students). If an existing award roll is already live, it will be automatically archived into historical backups before updating.`,
      badgeText: 'Approval & Integration',
      confirmText: 'Approve & Integrate',
      cancelText: 'Cancel',
      confirmBtnStyle: 'success',
      icon: CheckCircle2,
      onConfirm: async () => {
        setGeneralConfirmModal(p => ({ ...p, isOpen: false }));
        setSaving(true);
        try {
          // 1. Check if canonical doc exists in practicalsData
          const canonicalRef = doc(db, 'practicalsData', targetDocId);
          const canonicalSnap = await getDoc(canonicalRef);

          if (canonicalSnap.exists()) {
            const canonicalData = canonicalSnap.data();
            if (canonicalData && Array.isArray(canonicalData.records) && canonicalData.records.length > 0) {
              // Archive previous canonical doc into practicalsBin with zero loss (maintaining last 3 versions)
              await saveVersionToBin(targetDocId, canonicalData, 'admin_approved_overwrite', {
                name: auth.currentUser?.displayName || 'Administrator',
                email: auth.currentUser?.email
              }).catch(() => {});
            }
          }

          // 2. Prepare clean canonical document (sanitized to remove any undefined or rejection fields)
          const { id: _ignoreId, ...pendingData } = pendingDoc;
          delete pendingData.rejectionReason;
          delete pendingData.rejectedAt;
          delete pendingData.rejectedBy;

          const canonicalSession = normalizePracticalSession(
            pendingData.sessionCanonical || pendingData.sessionText || pendingData.session || pendingData.Session || pendingData.yearSuffix || '2025-26'
          );

          const canonicalRecord = sanitizeForFirestore({
            ...pendingData,
            id: targetDocId,
            docId: targetDocId,
            session: canonicalSession,
            sessionText: canonicalSession,
            sessionCanonical: canonicalSession,
            status: 'approved',
            isDraft: false,
            isPendingApproval: false,
            approvedAt: new Date().toISOString(),
            approvedBy: auth.currentUser?.email || 'Administrator',
            lastIntegratedAt: new Date().toISOString(),
            updatedByAdmin: Boolean(pendingData.updatedByAdmin)
          });

          // 3. Write canonical document
          await setDoc(canonicalRef, canonicalRecord);

          // 4. Remove pending staging document
          await deleteDoc(doc(db, 'practicalsData', pendingDoc.id));

          // 5. Invalidate practicalsData cache so changes reflect instantly
          invalidateCollectionCache('practicalsData');
          invalidatePracticalsCache();

          // 6. Update local states
          setPendingApprovals(prev => prev.filter(p => p.id !== pendingDoc.id));
          setSubmissions(prev => {
            const filtered = prev.filter(s => s.id !== targetDocId);
            return [canonicalRecord, ...filtered];
          });

          // 7. Re-enrich student roster and synchronize state from database
          await loadData(true);

          logAdminActivity({
            actionType: 'approve',
            actionTitle: 'Approved Practical Award Submission',
            details: `Approved and integrated ${subjectName} (${className}) submitted by ${submittedBy} (${canonicalRecord.records?.length || 0} students)`,
            metadata: { targetDocId, pendingId: pendingDoc.id, submittedBy }
          });

          showAlert('success', `Awards for ${subjectName} (${className}) approved and successfully integrated into live database!`);
        } catch (err) {
          console.error('Error approving submission:', err);
          showAlert('error', `Failed to approve submission: ${err.message || err}`);
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleRejectSubmission = (pendingDoc, reason = '') => {
    if (!pendingDoc) return;
    const subjectName = pendingDoc.subject || 'Subject';
    const className = pendingDoc.className || 'Class';

    setSaving(true);
    (async () => {
      try {
        await setDoc(doc(db, 'practicalsData', pendingDoc.id), sanitizeForFirestore({
          status: 'rejected',
          rejectionReason: reason || 'Please review and re-verify awards list.',
          rejectedAt: new Date().toISOString(),
          rejectedBy: auth.currentUser?.email || 'Administrator'
        }), { merge: true });

        invalidateCollectionCache('practicalsData');
        invalidatePracticalsCache();

        setPendingApprovals(prev => prev.map(p => {
          if (p.id === pendingDoc.id) {
            return {
              ...p,
              status: 'rejected',
              rejectionReason: reason || 'Please review and re-verify awards list.'
            };
          }
          return p;
        }));

        logAdminActivity({
          actionType: 'reject',
          actionTitle: 'Rejected / Requested Revision for Awards',
          details: `Requested revision for ${subjectName} (${className}) submitted by ${pendingDoc.submittedBy || 'Teacher'}: "${reason || 'No reason specified'}"`,
          metadata: { pendingId: pendingDoc.id, reason }
        });

        showAlert('success', `Revision requested from teacher for ${subjectName} (${className}).`);
      } catch (err) {
        console.error('Error rejecting submission:', err);
        showAlert('error', `Failed to reject submission: ${err.message || err}`);
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleSaveSubmissionDirect = async (submissionDoc, updatedRecords) => {
    if (!submissionDoc || !Array.isArray(updatedRecords)) return;
    setSaving(true);
    try {
      const docId = submissionDoc.id;
      const isPending = String(docId).startsWith('pending_') || submissionDoc.status === 'pending_approval' || submissionDoc.isPendingApproval;
      const docRef = doc(db, 'practicalsData', docId);

      const adminEmail = auth.currentUser?.email || 'Administrator';
      const nowIso = new Date().toISOString();

      const updatedPayload = sanitizeForFirestore({
        ...submissionDoc,
        records: updatedRecords,
        updatedByAdmin: true,
        updatedBy: adminEmail,
        updatedAt: nowIso,
        lastEditedBy: `Admin (${adminEmail})`
      });

      await setDoc(docRef, updatedPayload, { merge: true });

      // Invalidate both collection and in-memory caches
      invalidateCollectionCache('practicalsData');
      invalidatePracticalsCache();

      // Update local state
      if (isPending) {
        setPendingApprovals(prev => prev.map(p => p.id === docId ? updatedPayload : p));
      } else {
        setSubmissions(prev => prev.map(s => s.id === docId ? updatedPayload : s));
      }
      setSelSub(updatedPayload);

      logAdminActivity({
        actionType: 'admin_submission_edit',
        actionTitle: `Admin Edited Marks for ${submissionDoc.subjectName || submissionDoc.subject || 'Practical'} (${submissionDoc.className || submissionDoc.class || ''})`,
        details: `Administrator updated student marks directly in ${isPending ? 'pending submission' : 'approved award'} (${updatedRecords.length} student records).`,
        metadata: { docId, isPending }
      });

      showAlert('success', `Student marks updated successfully in ${isPending ? 'pending submission' : 'award roll'}!`);
    } catch (err) {
      console.error('Failed to save direct admin edit:', err);
      showAlert('error', `Failed to save changes: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const grantPerm = async (e) => {
    e.preventDefault();
    if (!grantEmail.trim()) { showAlert('error', 'Teacher email required.'); return; }
    const np = { email: grantEmail.trim().toLowerCase(), className: grantClass, subject: grantSubject, grantedAt: new Date().toLocaleDateString() };
    const upd = [...(settings.permissions || []), np];
    const newSt = { ...settings, permissions: upd };
    await saveSettingsDoc('Permissions', newSt);
    setGrantEmail('');
  };

  const revokePerm = (idx) => {
    const p = (settings.permissions || [])[idx];
    if (!p) return;
    setGeneralConfirmModal({
      isOpen: true,
      title: 'Revoke Teacher Permission?',
      subtitle: `Are you sure you want to revoke evaluation access for ${p.email} (Class ${p.className} • ${getSubjectDisplayName(p.subject, p.className) || p.subject})?`,
      badgeText: 'Revoke Access',
      confirmText: 'Revoke Permission',
      cancelText: 'Cancel',
      confirmBtnStyle: 'danger',
      icon: ShieldAlert,
      onConfirm: async () => {
        setGeneralConfirmModal(p => ({ ...p, isOpen: false }));
        const upd = [...(settings.permissions || [])];
        upd.splice(idx, 1);
        const newSt = { ...settings, permissions: upd };
        await saveSettingsDoc('Permission Revoked', newSt);
      }
    });
  };

  const getPD = (cls) => settings.printDetails?.[cls] || {};

  const handleSaveTeacherPhone = async (teacher, newPhone) => {
    if (!teacher) return false;
    let cleanPhone = String(newPhone || '').replace(/\D/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit Indian mobile number.', 'warning');
      return false;
    }

    try {
      const payload = {
        phone: cleanPhone,
        mobile: cleanPhone,
        phoneNumber: cleanPhone,
        whatsapp: cleanPhone,
        updatedAt: new Date().toISOString()
      };

      const tEmail = String(teacher.email || '').toLowerCase().trim();
      await updateStaffPhone(teacher.uid || teacher.id, cleanPhone);

      setTeachers(prev => prev.map(t => {
        if (t.id === teacher.id || (tEmail && String(t.email || '').toLowerCase().trim() === tEmail)) {
          return { ...t, ...payload };
        }
        return t;
      }));

      showAlert('success', `Mobile number ${cleanPhone ? `(${cleanPhone}) ` : ''}saved to Firebase for ${teacher.name || teacher.displayName || 'Faculty'}.`);
      return cleanPhone;
    } catch (e) {
      console.error('Error saving teacher phone to Firebase:', e);
      showAlert('error', 'Failed to save mobile number to Firebase.');
      return false;
    }
  };

  const handleWhatsAppShare = async (teacher, customText) => {
    if (!teacher) return;
    let phone = teacher.phone || teacher.mobile || teacher.phoneNumber || teacher.whatsapp;
    let cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }

    if (!cleanPhone || cleanPhone.length !== 10) {
      const input = prompt(`Enter 10-digit WhatsApp Mobile Number for ${teacher.name || teacher.displayName || 'Faculty Member'} (will be saved to database):`, cleanPhone || '');
      if (!input) return;
      const saved = await handleSaveTeacherPhone(teacher, input);
      if (!saved) return;
      cleanPhone = saved;
    }

    const targetPhone = `91${cleanPhone}`;
    const defaultText = `Assalamu Alaikum / Greetings ${teacher.name || teacher.displayName || 'Sir/Madam'},\n\nKindly check the practical awards and evaluations assigned to you on the HSS Shangus Portal.\n\nPortal: https://hssshangus.edu.in`;
    const text = customText || defaultText;
    const waUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleEmailShare = (teacher, customSubject, customBody) => {
    if (!teacher) return;
    const email = teacher.email;
    if (!email) {
      const input = prompt(`Enter Email Address for ${teacher.name || teacher.displayName || 'Faculty Member'}:`);
      if (!input) return;
      teacher.email = input.trim();
    }
    const subject = customSubject || `Practicals & Awards Notice: HSS Shangus`;
    const body = customBody || `Dear ${teacher.name || teacher.displayName || 'Faculty Member'},\n\nKindly review and complete the practical awards and evaluations assigned to you on the HSS Shangus Portal.\n\nPortal Link: https://hssshangus.edu.in\n\nRegards,\nExamination & Practical Cell\nGovt. Higher Secondary School Shangus`;
    const mailtoUrl = `mailto:${teacher.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const sendEmail = async (row, cls) => {
    if (!row.teacherEmail) { showAlert('error', 'No email address found for this teacher.'); return; }
    const k = cls + '_' + row.subjectCode;
    setEmailSt(p => ({ ...p, [k]: 'sending' }));
    try {
      const sendPracticalsEmail = staffCallable('sendPracticalsEmail');
      await sendPracticalsEmail({
        to: row.teacherEmail,
        subject: `Assessment Submission Report: ${row.subjectName} (${cls})`,
        htmlBody: `<h3>Assessment Submission: ${row.subjectName} (${cls})</h3><p>Evaluated: ${row.completed}, Absent: ${row.absent}, Pending: ${row.pending}</p>`
      });
      setEmailSt(p => ({ ...p, [k]: 'sent' }));
      showAlert('success', 'Email report sent.');
    } catch (e) {
      console.error(e);
      setEmailSt(p => ({ ...p, [k]: '' }));
      showAlert('error', 'Failed to send email.');
    }
  };

  if (loading) return <PracticalsLoader />;

  const Tb = ({ id, label, icon, onClick }) => (
    <button onClick={onClick} className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ' + (tab === id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700')}>
      {icon}<span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Sleek Header & Grouped Action Ribbon */}
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs flex-shrink-0">
              <Sliders size={16} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">Practicals & Awards Admin</h1>
              <p className="text-[10px] sm:text-[10.5px] font-semibold text-slate-500">Evaluations, Excel imports/exports, prints & permissions.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-start xl:justify-end gap-2 w-full xl:w-auto relative">
            {/* Scrollable Tabs Group on small viewports */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              {/* Class Switcher Segmented Control */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setTab('class10')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    tab === 'class10'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Award size={12} className="shrink-0" />
                  <span className="sm:hidden">10th</span>
                  <span className="hidden sm:inline">Class 10th</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('class11')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    tab === 'class11'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Award size={12} className="shrink-0" />
                  <span className="sm:hidden">11th</span>
                  <span className="hidden sm:inline">Class 11th</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('class12')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    tab === 'class12'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Award size={12} className="shrink-0" />
                  <span className="sm:hidden">12th</span>
                  <span className="hidden sm:inline">Class 12th</span>
                </button>
              </div>

              {/* Sub-Views Tabs */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setTab('faculty_submissions')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    tab === 'faculty_submissions' || tab === 'submissions' || tab === 'teachers'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users size={13} className="shrink-0" />
                  <span className="md:hidden">Faculty ({submissions.length + (pendingApprovals?.length || 0)})</span>
                  <span className="hidden md:inline">Faculty & Submissions ({submissions.length + (pendingApprovals?.length || 0)})</span>
                  {pendingApprovals.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-amber-500 text-white animate-pulse" title={`${pendingApprovals.length} pending approval`}>
                      {pendingApprovals.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('settings')}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    tab === 'settings'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Settings size={12} className="shrink-0" />
                  <span className="md:hidden">Settings</span>
                  <span className="hidden md:inline">Settings & Permissions</span>
                </button>
              </div>
            </div>

            {/* Excel Quick Actions Group (Unified Template & Import) & Recycle Bin */}
            <div className="flex items-center gap-1.5 pl-0 sm:pl-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-1 sm:pt-0 shrink-0 relative z-40">
              <div className="relative shrink-0" ref={excelMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowExcelMenu(prev => !prev)}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs shrink-0"
                >
                  <FileSpreadsheet size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Excel</span>
                  <ChevronDown size={11} className={`transition-transform duration-150 ${showExcelMenu ? 'rotate-180' : ''}`} />
                </button>

                {showExcelMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-[9999] animate-in fade-in zoom-in-95 duration-100 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelMenu(false);
                        setShowImportModal(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Upload size={13} className="text-indigo-600 shrink-0" />
                      <div>
                        <div className="text-[11.5px] font-black">Import Excel / CSV Marks</div>
                        <div className="text-[9.5px] text-slate-400 font-semibold">Upload completed spreadsheet with awards</div>
                      </div>
                    </button>

                    <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelMenu(false);
                        generatePracticalsExcelTemplate();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download size={13} className="text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-[11.5px] font-black">Download Excel Template (.xlsx)</div>
                        <div className="text-[9.5px] text-slate-400 font-semibold">Standard blanks with instructions & subject codes</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelMenu(false);
                        generatePracticalsCsvTemplate();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Download size={13} className="text-slate-500 shrink-0" />
                      <div>
                        <div className="text-[11.5px] font-black">Download CSV Template (.csv)</div>
                        <div className="text-[9.5px] text-slate-400 font-semibold">Lightweight comma-separated format</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowPracticalsRecycleBin(true)}
                className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer border border-violet-200 dark:border-violet-800 shadow-2xs shrink-0"
                title="Open Practicals Submission Recycle Bin"
              >
                <Archive size={12} />
                <span className="hidden sm:inline">Recycle Bin</span>
                <span className="sm:hidden">Bin</span>
              </button>
            </div>
          </div>
        </div>


        {alertMsg && (
          <div className={'p-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs ' + (alertMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100')}>
            {alertMsg.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {alertMsg.text}
          </div>
        )}

        {/* Content Area */}
        <div className="min-h-[500px] space-y-3">
          {tab === 'class10' && (
            <AwardsSummaryView
              cls="10th"
              students={students}
              submissions={submissions}
              pendingApprovals={pendingApprovals}
              getPD={getPD}
              settings={settings}
              onOpenImportModal={() => setShowImportModal(true)}
            />
          )}

          {tab === 'class11' && (
            <AwardsSummaryView
              cls="11th"
              students={students}
              submissions={submissions}
              pendingApprovals={pendingApprovals}
              getPD={getPD}
              settings={settings}
              onOpenImportModal={() => setShowImportModal(true)}
            />
          )}

          {tab === 'class12' && (
            <AwardsSummaryView
              cls="12th"
              students={students}
              submissions={submissions}
              pendingApprovals={pendingApprovals}
              getPD={getPD}
              settings={settings}
              onOpenImportModal={() => setShowImportModal(true)}
            />
          )}

          {(tab === 'faculty_submissions' || tab === 'submissions' || tab === 'teachers') && (
            <FacultySubmissionsView
              teachers={teachers}
              submissions={submissions}
              setSubmissions={setSubmissions}
              pendingApprovals={pendingApprovals}
              onApproveSubmission={handleApproveSubmission}
              onRejectSubmission={(pendingDoc) => setRejectReasonModal({ isOpen: true, pendingDoc, reason: '' })}
              sendEmail={sendEmail}
              emailSt={emailSt}
              handleWhatsAppShare={handleWhatsAppShare}
              handleEmailShare={handleEmailShare}
              handleSaveTeacherPhone={handleSaveTeacherPhone}
              setSelSub={setSelSub}
              handleDeleteSubmission={handleDeleteSubmission}
              settings={settings}
              handleExcludeTeacher={handleExcludeTeacher}
            />
          )}

          {tab === 'settings' && (
            <SettingsPermissionsView
              settings={settings}
              setSettings={setSettings}
              saveSettingsDoc={saveSettingsDoc}
              saving={saving}
              grantEmail={grantEmail}
              setGrantEmail={setGrantEmail}
              grantClass={grantClass}
              setGrantClass={setGrantClass}
              grantSubject={grantSubject}
              setGrantSubject={setGrantSubject}
              grantPerm={grantPerm}
              revokePerm={revokePerm}
              teachers={teachers}
            />
          )}
        </div>

        {/* Selected Submission Records Modal */}
        {selSub && (
          <SelectedSubmissionModal
            selSub={selSub}
            submissions={submissions}
            onClose={() => setSelSub(null)}
            absentMarker={settings.absentMarker}
            allStudents={students}
            onApprove={handleApproveSubmission}
            onReject={(doc) => setRejectReasonModal({ isOpen: true, pendingDoc: doc, reason: '' })}
            onSaveDirect={handleSaveSubmissionDirect}
            onDelete={(subId, subDoc) => {
              setSelSub(null);
              handleDeleteSubmission(subId, subDoc);
            }}
          />
        )}

        {/* Reject / Request Revision Modal */}
        {rejectReasonModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-rose-500" />
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Request Revision / Reject Submission</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectReasonModal({ isOpen: false, pendingDoc: null, reason: '' })}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                Provide instructions or feedback to <strong>{rejectReasonModal.pendingDoc?.submittedBy || 'Teacher'}</strong> explaining what needs revision in the award list for <strong>{rejectReasonModal.pendingDoc?.subject} ({rejectReasonModal.pendingDoc?.className})</strong>:
              </div>

              <textarea
                rows={3}
                value={rejectReasonModal.reason}
                onChange={(e) => setRejectReasonModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Please re-check roll numbers 21-25 or verify marks against official attendance."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectReasonModal({ isOpen: false, pendingDoc: null, reason: '' })}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRejectSubmission(rejectReasonModal.pendingDoc, rejectReasonModal.reason);
                    setRejectReasonModal({ isOpen: false, pendingDoc: null, reason: '' });
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  Send Revision Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Excel / CSV Import Modal */}
        {showImportModal && (
          <CsvImportModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              setShowImportModal(false);
              loadData(true);
              showAlert('success', 'Practical awards imported successfully to cloud database.');
            }}
          />
        )}

        {/* General Admin Action Confirmation Modal */}
        <ConfirmationModal
          isOpen={generalConfirmModal.isOpen}
          onClose={() => setGeneralConfirmModal(p => ({ ...p, isOpen: false }))}
          onConfirm={generalConfirmModal.onConfirm}
          title={generalConfirmModal.title}
          subtitle={generalConfirmModal.subtitle}
          badgeText={generalConfirmModal.badgeText}
          confirmText={generalConfirmModal.confirmText}
          cancelText={generalConfirmModal.cancelText}
          confirmBtnStyle={generalConfirmModal.confirmBtnStyle}
          icon={generalConfirmModal.icon}
          loading={saving}
        >
          {generalConfirmModal.children}
        </ConfirmationModal>

        {/* Practicals Submission Recycle Bin Modal */}
        <PracticalsRecycleBinModal
          isOpen={showPracticalsRecycleBin}
          onClose={() => setShowPracticalsRecycleBin(false)}
          onRestoreSuccess={() => { loadData(true); }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AWARDS SUMMARY COMPONENT (WITH INTERNAL/EXTERNAL & BO/ZO TOGGLES)
// ─────────────────────────────────────────────────────────────
function AwardsSummaryView({ cls, students, submissions, pendingApprovals = [], getPD, settings, onOpenImportModal }) {
  const [bioMode, setBioMode] = useState('separate'); // 'separate' (BO & ZO) | 'combined' (BI)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('approved');
  const [selectedRolls, setSelectedRolls] = useState(new Set());
  const [sortField, setSortField] = useState('roll');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showOptsModal, setShowOptsModal] = useState(false);
  const [showFilterTray, setShowFilterTray] = useState(false);
  const [showSubjectsDropdown, setShowSubjectsDropdown] = useState(false);
  const [showAwardsMenu, setShowAwardsMenu] = useState(false);
  const subjectsDropdownRef = useRef(null);
  const awardsMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (subjectsDropdownRef.current && !subjectsDropdownRef.current.contains(e.target)) {
        setShowSubjectsDropdown(false);
      }
      if (awardsMenuRef.current && !awardsMenuRef.current.contains(e.target)) {
        setShowAwardsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [localPrintOpts, setLocalPrintOpts] = useState(() => {
    const pd = getPD(cls);
    return {
      sessionText: pd.sessionText || 'Annual Regular 2026',
      instName: pd.instName || 'Govt. Higher Secondary School Shangus',
      inchargeName: pd.inchargeName || (cls === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar'),
      inchargeCpis: pd.inchargeCpis || (cls === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017'),
      inchargeMobile: pd.inchargeMobile || (cls === '12th' ? '9596165142' : '7006537425'),
      practicalType: settings.currentPracticalType || 'internal',
      absentMarker: settings.absentMarker || 'AB'
    };
  });

  // Keep localPrintOpts synchronized when settings or class change
  useEffect(() => {
    const pd = getPD(cls);
    setLocalPrintOpts(prev => ({
      ...prev,
      sessionText: pd.sessionText || prev.sessionText,
      instName: pd.instName || prev.instName,
      inchargeName: pd.inchargeName || (cls === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar'),
      inchargeCpis: pd.inchargeCpis || (cls === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017'),
      inchargeMobile: pd.inchargeMobile || (cls === '12th' ? '9596165142' : '7006537425'),
      practicalType: settings.currentPracticalType || prev.practicalType,
      absentMarker: settings.absentMarker || prev.absentMarker
    }));
  }, [settings, cls, getPD]);

  // Calculate visible codes based on class and bioMode
  const activeCodesList = useMemo(() => {
    if (String(cls || '').includes('10')) {
      return ['EN', 'MA', 'SC', 'SS', 'UR', 'HTC', 'ITE'];
    }
    if (bioMode === 'separate') {
      return ['EN', 'PH', 'CH', 'BO', 'ZO', 'MA', 'UR', 'ED', 'HT', 'PS', 'EC', 'ES', 'PD', 'HTC', 'ITE'];
    }
    return ['EN', 'PH', 'CH', 'BI', 'MA', 'UR', 'ED', 'HT', 'PS', 'EC', 'ES', 'PD', 'HTC', 'ITE'];
  }, [cls, bioMode]);

  // Helper to compute default checked subjects based on Evaluation Type & Non-Practical Settings
  const getDefaultCheckedCodes = useCallback(() => {
    const isExternal = localPrintOpts.practicalType === 'external';

    // 1. External practicals (only Laboratory Science subjects have external practicals)
    if (isExternal) {
      return bioMode === 'separate' ? ['PH', 'CH', 'BO', 'ZO'] : ['PH', 'CH', 'BI'];
    }

    // 2. Internal practicals: automatically uncheck configured non-practical subjects (e.g. HTC, ITE)
    const is10 = String(cls || '').includes('10');
    const is12 = String(cls || '').includes('12');
    const nonPracticalConfig = String(
      (is10 ? settings.nonPractical10 : is12 ? settings.nonPractical12 : settings.nonPractical11) || settings.nonPractical || 'HTC,ITE'
    ).toUpperCase();

    const excludedCodes = new Set(
      nonPracticalConfig.split(/[\s,+/]+/).map(s => s.trim()).filter(Boolean)
    );

    return activeCodesList.filter(code => !excludedCodes.has(code));
  }, [cls, localPrintOpts.practicalType, bioMode, settings.nonPractical10, settings.nonPractical11, settings.nonPractical12, settings.nonPractical, activeCodesList]);

  const [selectedSubCodes, setSelectedSubCodes] = useState(() => getDefaultCheckedCodes());

  useEffect(() => {
    setSelectedSubCodes(getDefaultCheckedCodes());
  }, [getDefaultCheckedCodes]);

  // Set of subject codes that actually have live submitted awards with student marks strictly matching current class & session
  const subjectsWithSubmissions = useMemo(() => {
    const clsTarget = String(cls || '').replace(/[^0-9]/g, '');
    const targetType = String(localPrintOpts.practicalType || 'internal').toLowerCase();
    const targetNorm = targetType.includes('ext') ? 'external' : 'internal';
    const targetSess = normalizePracticalSession(localPrintOpts.sessionText || selectedSession);
    const set = new Set();
    (submissions || []).forEach(s => {
      if (!s || s.isDeleted || s.status === 'deleted') return;
      const sCls = String(s.className || s.Class || s.class || '').replace(/[^0-9]/g, '');
      if (clsTarget && sCls && sCls !== clsTarget) return;

      if (targetSess && targetSess !== 'all') {
        const subSess = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '');
        if (subSess && subSess !== 'all' && !isSessionMatch(subSess, targetSess)) return;
      }

      const sType = String(s.practicalType || s.PracticalType || s.evaluationType || s.evalType || 'internal').toLowerCase();
      const sNorm = sType.includes('ext') ? 'external' : 'internal';
      if (sNorm !== targetNorm) return;

      const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
      activeCodesList.forEach(code => {
        if (isMatchingSubjectCode(codeStr, code)) {
          if (Array.isArray(s.records) && s.records.some(r => {
            const m = String(r.totalMarks ?? r.practicalMarks ?? '').trim();
            return m !== '' && m !== '—' && m !== '-';
          })) {
            set.add(code);
          }
        }
      });
    });
    return set;
  }, [cls, localPrintOpts.practicalType, localPrintOpts.sessionText, selectedSession, submissions, activeCodesList]);

  // Total students enrolled in this class and session regardless of approval status (dropped students excluded)
  const totalClassStudents = useMemo(() => {
    return students.filter(st => {
      const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
      if (!classMatch) return false;

      if (isStudentExamDropped(st)) return false;

      const { isApproved, isRejected, isDropped } = checkStudentApprovalState(st);
      if (isRejected || isDropped || !isApproved) return false;

      if (selectedSession !== 'all') {
        const sess = getStudentSession(st);
        const matchesSess = isSessionMatch(sess, selectedSession);
        if (!matchesSess) return false;
      }
      return true;
    });
  }, [students, cls, selectedSession]);

  const approvedCount = useMemo(() => {
    return totalClassStudents.filter(st => checkStudentApprovalState(st).isApproved).length;
  }, [totalClassStudents]);

  const pendingCount = totalClassStudents.length - approvedCount;

  const droppedCount = useMemo(() => {
    return students.filter(st => {
      const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
      if (!classMatch) return false;
      if (selectedSession !== 'all') {
        const sess = getStudentSession(st);
        if (!isSessionMatch(sess, selectedSession)) return false;
      }
      return isStudentExamDropped(st);
    }).length;
  }, [students, cls, selectedSession]);

  const cSts = useMemo(() => {
    return totalClassStudents.filter(st => {
      if (isStudentExamDropped(st)) return false;
      const { isApproved } = checkStudentApprovalState(st);
      if (selectedStatusFilter === 'approved' && !isApproved) return false;
      if (selectedStatusFilter === 'pending' && isApproved) return false;
      return true;
    });
  }, [totalClassStudents, selectedStatusFilter]);

  useEffect(() => {
    if (cSts.length > 0) {
      const initialRolls = new Set(cSts.map((st, i) => getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + i}`));
      setSelectedRolls(initialRolls);
    } else {
      setSelectedRolls(new Set());
    }
  }, [cSts.length, selectedSession, selectedStatusFilter]);

  const filteredStudents = cSts.filter(st => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = String(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').toLowerCase();
    const father = String(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '').toLowerCase();
    const mother = String(st["Mother's Name (as per school records)"] || st["Mother's Name"] || st.motherName || st.mother || '').toLowerCase();
    const roll = String(getRollNo(st) || '').toLowerCase();
    const exam = String(getCurrentOfficialExamRoll(st, cls) || st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || '').toLowerCase();
    const reg = String(st['Board Registration Number'] || st['Board Reg. No.'] || st.boardRegNo || st.regNo || '').toLowerCase();
    const stream = String(st.stream || st.Stream || '').toLowerCase();
    return name.includes(term) || father.includes(term) || mother.includes(term) || roll.includes(term) || exam.includes(term) || reg.includes(term) || stream.includes(term);
  });

  // Helper to find student record mark for a subject code
  const getSubjectMarkForStudent = (st, subCode, effectiveSess) => {
    const targetType = String(localPrintOpts.practicalType || 'internal').toLowerCase();
    const targetNorm = targetType.includes('ext') ? 'external' : 'internal';
    const stSess = normalizePracticalSession(getStudentSession(st));
    const querySess = normalizePracticalSession(effectiveSess);

    // If subCode is BI and we are in combined mode, sum BO and ZO
    if (subCode === 'BI') {
      const boMark = getSubjectMarkForStudent(st, 'BO', effectiveSess);
      const zoMark = getSubjectMarkForStudent(st, 'ZO', effectiveSess);
      if (boMark === null && zoMark === null) return null;
      if (boMark === 'AB' && zoMark === 'AB') return 'AB';
      const boVal = typeof boMark === 'number' ? boMark : 0;
      const zoVal = typeof zoMark === 'number' ? zoMark : 0;
      return boVal + zoVal;
    }

    const subDoc = submissions.find(s => {
      const matchClass = isClassMatch(s.className || s.Class || s.class, cls);
      if (!matchClass) return false;

      const sType = String(s.practicalType || s.PracticalType || s.evaluationType || s.evalType || 'internal').toLowerCase();
      const sNorm = sType.includes('ext') ? 'external' : 'internal';
      if (sNorm !== targetNorm) return false;

      const subSess = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '');
      if (querySess && querySess !== 'all' && subSess && !isSessionMatch(subSess, querySess)) return false;

      const codeStr = String(s.subjectCode || s.subject || s.Subject || s.id || '').toUpperCase();
      return isMatchingSubjectCode(codeStr, subCode);
    });

    if (!subDoc || !subDoc.records) return null;

    const stBoardReg = cleanRegistrationNumber(
      st['Board Reg. No.'] || st['Board Registration Number'] || st.boardRegNo ||
      st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || st.regNo || ''
    ).toUpperCase();
    const stExam = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || st['Exam Roll Number'] || '').trim().toUpperCase();
    const stClassRoll = String(
      st['Class R.No.'] || st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st.rollNo || st.RollNo || st.roll_no || ''
    ).trim();
    const stForm = String(st.admissionNo || st.formNo || st['Admission Form No.'] || st['Form No.'] || '').trim();
    const stName = toTitleCase(
      st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || ''
    ).trim().toLowerCase();
    const stFather = toTitleCase(
      st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || st.parentage || ''
    ).trim().toLowerCase();

    const rec = subDoc.records.find(r => {
      const rBoardReg = cleanRegistrationNumber(r.boardRegNo || r['Board Reg. No.'] || r.regNo || '').toUpperCase();
      const rExam = String(r.examRollNo || (/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || '').trim().toUpperCase();
      const rClassRoll = String(r.classRollNo || r.classRoll || r['Class Roll No'] || r.rollNo || r.roll || r.sNo || '').trim();
      const rForm = String(r.formNo || r.admissionNo || r['Form No.'] || '').trim();
      const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();
      const rFather = toTitleCase(r.parentName || r.parentage || r.fatherName || '').trim().toLowerCase();

      // Primary Match 1: Board Registration Number (Exact)
      if (stBoardReg && rBoardReg && stBoardReg === rBoardReg && stBoardReg.length >= 5) return true;

      // Primary Match 2: Exam Roll No (Exact match when valid and not placeholder)
      if (stExam && rExam && stExam !== '—' && stExam !== 'NA' && stExam !== 'N/A' && stExam === rExam) return true;

      // Match 3: Admission Form No
      if (stForm && rForm && stForm === rForm) return true;

      // Match 4: Class Roll No (Exact match when valid, not placeholder)
      if (stClassRoll && rClassRoll && stClassRoll !== '—' && stClassRoll !== '-' && !/^\d{8,}$/.test(stClassRoll) && !/^\d{8,}$/.test(rClassRoll) && stClassRoll === rClassRoll) {
        if (!stName || !rName || stName === rName || stName.includes(rName) || rName.includes(stName)) return true;
      }

      // Match 5: Student Full Name + Father Name (when length > 3)
      if (stName && rName && stName.length > 3 && (stName === rName || stName.replace(/\s+/g, '') === rName.replace(/\s+/g, ''))) {
        if (!stFather || !rFather || stFather === rFather || stFather.includes(rFather) || rFather.includes(stFather)) {
          return true;
        }
      }

      return false;
    });

    if (!rec) return null;

    const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
    if (rawMark.toUpperCase() === 'AB' || rawMark.toUpperCase() === 'A' || rawMark.toUpperCase() === 'ABSENT') return 'AB';
    const num = parseInt(rawMark, 10);
    return !isNaN(num) ? num : null;
  };

  const getStudentHashTotal = (st) => {
    const stSess = normalizePracticalSession(getStudentSession(st));
    const effectiveSess = selectedSession !== 'all' ? selectedSession : (stSess || '2025-26');
    let total = 0;

    activeSubjects.forEach(subCode => {
      const mark = getSubjectMarkForStudent(st, subCode, effectiveSess);
      if (typeof mark === 'number') {
        total += mark;
      }
    });

    return total > 0 ? total : '—';
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let aVal = '';
      let bVal = '';

      if (sortField === 'roll') {
        const aRoll = getRollNo(a);
        const bRoll = getRollNo(b);
        const aR = parseInt(aRoll, 10);
        const bR = parseInt(bRoll, 10);
        const aHas = Boolean(aRoll && aRoll !== '—' && aRoll !== '-' && !isNaN(aR) && aR > 0);
        const bHas = Boolean(bRoll && bRoll !== '—' && bRoll !== '-' && !isNaN(bR) && bR > 0);

        if (aHas && bHas) {
          return sortDirection === 'asc' ? aR - bR : bR - aR;
        }
        if (aHas && !bHas) return -1; // Students with assigned roll always come first
        if (!aHas && bHas) return 1;  // Unassigned students go to the bottom

        aVal = String(a['Exam R.No. (Current)'] || a["Student's Name (as per school records)"] || a.studentName || a.name || '').toLowerCase();
        bVal = String(b['Exam R.No. (Current)'] || b["Student's Name (as per school records)"] || b.studentName || b.name || '').toLowerCase();
      } else if (sortField === 'examRoll') {
        aVal = String(getCurrentOfficialExamRoll(a, cls) || a['Exam R.No. (Current)'] || a.examRollNo || '').toLowerCase();
        bVal = String(getCurrentOfficialExamRoll(b, cls) || b['Exam R.No. (Current)'] || b.examRollNo || '').toLowerCase();
      } else if (sortField === 'regNo') {
        aVal = String(a['Board Registration Number'] || a['Board Reg. No.'] || a.boardRegNo || a.regNo || '').toLowerCase();
        bVal = String(b['Board Registration Number'] || b['Board Reg. No.'] || b.boardRegNo || b.regNo || '').toLowerCase();
      } else if (sortField === 'name') {
        aVal = String(a["Student's Name (as per school records)"] || a["Student's Name"] || a.studentName || a.name || '').toLowerCase();
        bVal = String(b["Student's Name (as per school records)"] || b["Student's Name"] || b.studentName || b.name || '').toLowerCase();
      } else if (sortField === 'father') {
        aVal = String(a["Father's/Guardian's Name (as per school records)"] || a["Father's Name"] || a.fatherName || '').toLowerCase();
        bVal = String(b["Father's/Guardian's Name (as per school records)"] || b["Father's Name"] || b.fatherName || '').toLowerCase();
      } else if (sortField === 'stream') {
        aVal = String(a.stream || a.Stream || '').toLowerCase();
        bVal = String(b.stream || b.Stream || '').toLowerCase();
      } else if (sortField === 'hashTotal') {
        const aT = typeof getStudentHashTotal(a) === 'number' ? getStudentHashTotal(a) : -1;
        const bT = typeof getStudentHashTotal(b) === 'number' ? getStudentHashTotal(b) : -1;
        return sortDirection === 'asc' ? aT - bT : bT - aT;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredStudents, sortField, sortDirection, selectedSession, localPrintOpts.practicalType, bioMode]);

  const selectedStudentsList = selectedRolls.size > 0
    ? sortedStudents.filter(st => {
      const roll = getRollNo(st);
      const uniqueKey = roll && roll !== '—' ? roll : (st['Board Registration Number'] || st.examRollNo || st.id);
      return selectedRolls.has(uniqueKey) || (roll && roll !== '—' && selectedRolls.has(roll));
    })
    : sortedStudents;

  const toggleSubject = (code) => {
    if (selectedSubCodes.includes(code)) setSelectedSubCodes(selectedSubCodes.filter(c => c !== code));
    else setSelectedSubCodes([...selectedSubCodes, code]);
  };

  const toggleAllStudents = () => {
    if (selectedRolls.size === sortedStudents.length) setSelectedRolls(new Set());
    else setSelectedRolls(new Set(sortedStudents.map((st, i) => {
      const roll = getRollNo(st);
      return roll && roll !== '—' ? roll : (st['Board Registration Number'] || st.examRollNo || st.id || `st_${i}`);
    })));
  };

  const toggleStudentRoll = (stKey) => {
    const next = new Set(selectedRolls);
    if (next.has(stKey)) next.delete(stKey); else next.add(stKey);
    setSelectedRolls(next);
  };

  const availablePracticalSessions = useMemo(() => {
    const list = [
      { id: '2025-26', label: 'Session 2025–26 (Current)' },
      { id: '2024-25', label: 'Session 2024–25 (Oct-Nov)' }
    ];
    const extraSessions = new Set();
    submissions.forEach(s => {
      const sess = normalizePracticalSession(s.sessionText || s.session);
      if (sess !== '2025-26' && sess !== '2024-25' && sess !== '2024-25 (Oct-Nov)') {
        if (sess) extraSessions.add(sess);
      }
    });
    extraSessions.forEach(sess => {
      const is24 = sess === '2024-25';
      list.push({ id: sess, label: is24 ? 'Session 2024–25 (Oct-Nov)' : `Session ${sess}` });
    });
    if (list.length > 1) {
      list.unshift({ id: 'all', label: 'All Sessions (Show All Students)' });
    }
    return list;
  }, [submissions]);

  const activeSubjects = activeCodesList.filter(c => selectedSubCodes.includes(c));
  const [exportSubjectTarget, setExportSubjectTarget] = useState('all');

  // If user has filtered table to exactly 1 subject in toolbar, align export target
  useEffect(() => {
    if (activeSubjects.length === 1) {
      setExportSubjectTarget(activeSubjects[0]);
    }
  }, [activeSubjects]);

  return (
    <div className="space-y-2.5 animate-in fade-in duration-300">
      {/* Unified Compact Control Panel Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-2xs space-y-2 relative">
        {/* UNIFIED SINGLE-ROW TOOLBAR (ALL CONTROLS GROUPED ON SAME ROW) */}
        <div className="space-y-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 relative z-30">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
            {/* Left: Class Badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Class {cls}
              </h2>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[10.5px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <strong className="text-indigo-600 dark:text-indigo-400">{selectedStudentsList.length}</strong>/{cSts.length} <span className="hidden xs:inline">Sts</span>
                {droppedCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-bold ml-1" title={`${droppedCount} student(s) in dropped category (${cSts.length + droppedCount} total enrolled)`}>
                    ({droppedCount} dropped)
                  </span>
                )}
                {pendingCount > 0 && selectedStatusFilter === 'approved' && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold ml-1">
                    ({pendingCount}<span className="hidden sm:inline"> unassigned</span>)
                  </span>
                )}
                {' • '}
                <strong className="text-emerald-600">{activeSubjects.length}</strong> Subs
              </span>
            </div>

            {/* Center: Search Input */}
            <div className="relative flex-1 min-w-[130px] sm:min-w-[170px] max-w-full sm:max-w-xs md:max-w-sm order-last sm:order-none w-full sm:w-auto">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search students, roll, reg, father..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-6 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 shadow-2xs transition-all placeholder:text-[10.5px] sm:placeholder:text-[11px] placeholder:font-semibold"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Right: ALL CONTROLS GROUPED ON THE SAME ROW */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* 1. Subjects Multi-Select Dropdown */}
              <div className="relative shrink-0" ref={subjectsDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAwardsMenu(false);
                    setShowSubjectsDropdown(prev => !prev);
                  }}
                  className="px-2 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-black cursor-pointer flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 shadow-2xs transition-all shrink-0"
                  title={`Practical Subjects (${selectedSubCodes.length} active)`}
                >
                  <BookOpen size={11} />
                  <span className="hidden sm:inline">Subjects</span>
                  <span>({selectedSubCodes.length})</span>
                  <ChevronDown size={10} className={`transition-transform duration-200 ${showSubjectsDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showSubjectsDropdown && (
                  <div className="absolute right-0 mt-1.5 w-[min(calc(100vw-20px),16rem)] max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500">
                      <span className="flex items-center gap-1"><BookOpen size={11} /> Practical Subjects</span>
                      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            const liveCodes = activeCodesList.filter(c => subjectsWithSubmissions.has(c));
                            setSelectedSubCodes(liveCodes.length > 0 ? liveCodes : activeCodesList);
                          }}
                          className="hover:underline cursor-pointer text-emerald-600 dark:text-emerald-400"
                          title="Select only subjects with active submitted awards"
                        >
                          Live Only ({subjectsWithSubmissions.size})
                        </button>
                        <span>•</span>
                        <button type="button" onClick={() => setSelectedSubCodes(activeCodesList)} className="hover:underline cursor-pointer">All</button>
                        <span>•</span>
                        <button type="button" onClick={() => setSelectedSubCodes([])} className="hover:underline cursor-pointer">Clear</button>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 divide-y divide-slate-50 dark:divide-slate-800/40">
                      {activeCodesList.map((code, idx) => {
                        const isChecked = selectedSubCodes.includes(code);
                        const hasLive = subjectsWithSubmissions.has(code);
                        return (
                          <label
                            key={code}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                              isChecked
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSubject(code)}
                                className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer shrink-0"
                              />
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-4 text-right shrink-0">{idx + 1}.</span>
                              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-[10.5px] w-7 shrink-0">{code}</span>
                              <span className="text-[11px] truncate max-w-[105px]">{getSubjectDisplayName(code, cls)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasLive ? (
                                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                  Live
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-semibold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                  Empty
                                </span>
                              )}
                              {isChecked && <Check size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Collapsible Filters Toggle Button */}
              <button
                type="button"
                onClick={() => setShowFilterTray(prev => !prev)}
                className={`px-2 py-1 rounded-xl text-[11px] font-black cursor-pointer flex items-center gap-1 border shadow-2xs transition-all shrink-0 ${
                  showFilterTray || selectedStatusFilter !== 'approved' || selectedSession !== '2025-26' || localPrintOpts.practicalType === 'external'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100 dark:shadow-none'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title="Evaluation type & view filters"
              >
                <Filter size={11} />
                <span className="hidden sm:inline">Filters</span>
                <ChevronDown size={10} className={`transition-transform duration-200 ${showFilterTray ? 'rotate-180' : ''}`} />
              </button>

              {/* 3. Unified Print / Export Awards Dropdown Menu */}
              <div className="relative shrink-0" ref={awardsMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectsDropdown(false);
                    setShowAwardsMenu(prev => !prev);
                  }}
                  className="px-2 sm:px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs transition-all"
                  title="Print and Export Options"
                >
                  <Printer size={12} />
                  <span>Awards / Export</span>
                  <ChevronDown size={11} className={`transition-transform duration-200 ${showAwardsMenu ? 'rotate-180' : ''}`} />
                </button>

                {showAwardsMenu && (
                  <div className="absolute right-0 mt-1.5 w-[min(calc(100vw-20px),22rem)] max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150 text-xs">
                    
                    {/* Header & Target Subject Control */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Target Subject Control
                        </span>
                        <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 truncate max-w-[170px]">
                          {exportSubjectTarget === 'all'
                            ? `All Active Subjects (${activeSubjects.length})`
                            : `${getSubjectDisplayName(exportSubjectTarget, cls)} (${exportSubjectTarget})`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExportSubjectTarget('all')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer text-center transition-all ${
                            exportSubjectTarget === 'all'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          All Subjects ({activeSubjects.length})
                        </button>

                        <select
                          value={exportSubjectTarget === 'all' ? '' : exportSubjectTarget}
                          onChange={(e) => setExportSubjectTarget(e.target.value)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all bg-white dark:bg-slate-900 border ${
                            exportSubjectTarget !== 'all'
                              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <option value="" disabled>Particular Subject...</option>
                          {activeSubjects.map(code => {
                            const hasLive = subjectsWithSubmissions.has(code);
                            return (
                              <option key={code} value={code}>
                                {code} - {getSubjectDisplayName(code, cls)} {hasLive ? '●' : '(No Award)'}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Pre-Board notice — consolidated awards not applicable */}
                    {/pre.?board/i.test(localPrintOpts.practicalType) && (
                      <div className="mx-0.5 my-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                        <span className="text-amber-500 shrink-0 mt-0.5">ⓘ</span>
                        <span>Pre-Board consolidated awards are managed via the School Based Assessment Suite.</span>
                      </div>
                    )}

                    {/* SECTION 1: PRINT EVALUATION & ATTENDANCE */}
                    <div className="space-y-1">
                      <div className="px-1.5 pt-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        Evaluation & Attendance Prints
                      </div>

                      {/* 1. Marks Record Award Roll (Pract Copy / Assignment, Viva Voce, Total) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                          const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                          if (!listToPrint || listToPrint.length === 0) {
                            showToast(`No student records available to print for Class ${cls}.`, 'warning');
                            return;
                          }
                          const isSingle = exportSubjectTarget !== 'all';
                          const targetCode = isSingle ? exportSubjectTarget : '';
                          const targetName = isSingle ? (getSubjectDisplayName(targetCode, cls) || targetCode) : '';
                          printMarksRecordAwardRoll({
                            className: cls,
                            session: localPrintOpts.sessionText,
                            students: listToPrint,
                            submissions,
                            isExternal: localPrintOpts.practicalType === 'external',
                            evaluationType: localPrintOpts.practicalType,
                            subjectCode: targetCode,
                            subjectName: targetName,
                            selectedSubjectCodes: !isSingle ? activeSubjects : null,
                            printDetails: localPrintOpts
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Printer size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black truncate">
                            {exportSubjectTarget === 'all'
                              ? `Print Marks Record Award Rolls (All ${activeSubjects.length} Subs)`
                              : `Print Marks Record — ${getSubjectDisplayName(exportSubjectTarget, cls)}`}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Pract Copy / Assignment, Viva Voce & Total columns
                          </div>
                        </div>
                      </button>

                      {/* 2. Attendance Sheet (Candidate Signature) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                          const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                          if (!listToPrint || listToPrint.length === 0) {
                            showToast(`No student records available to print for Class ${cls}.`, 'warning');
                            return;
                          }
                          const isSingle = exportSubjectTarget !== 'all';
                          const targetCode = isSingle ? exportSubjectTarget : '';
                          const targetName = isSingle ? (getSubjectDisplayName(targetCode, cls) || targetCode) : '';
                          printAttendanceSheet({
                            className: cls,
                            session: localPrintOpts.sessionText,
                            students: listToPrint,
                            isExternal: localPrintOpts.practicalType === 'external',
                            evaluationType: localPrintOpts.practicalType,
                            subjectCode: targetCode,
                            subjectName: targetName,
                            selectedSubjectCodes: !isSingle ? activeSubjects : null
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <ClipboardCheck size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black truncate">
                            {exportSubjectTarget === 'all'
                              ? `Print Attendance Sheets (All ${activeSubjects.length} Subs)`
                              : `Print Attendance Sheet — ${getSubjectDisplayName(exportSubjectTarget, cls)}`}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Candidate Signature sheet with Exam Roll No
                          </div>
                        </div>
                      </button>

                      {/* 3. Official 2-Column Subject Award Rolls (Figures & Words) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                          const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                          if (!listToPrint || listToPrint.length === 0) {
                            showToast(`No student records available to print for Class ${cls}.`, 'warning');
                            return;
                          }
                          const isSingle = exportSubjectTarget !== 'all';
                          const targetCodes = isSingle ? [exportSubjectTarget] : activeSubjects;
                          printAllIndividualAwardRolls({
                            className: cls,
                            session: localPrintOpts.sessionText,
                            students: listToPrint,
                            submissions,
                            isExternal: localPrintOpts.practicalType === 'external',
                            evaluationType: localPrintOpts.practicalType,
                            selectedSubjectCodes: targetCodes,
                            printDetails: { ...localPrintOpts, settings }
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <FileText size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black truncate">
                            {exportSubjectTarget === 'all'
                              ? `Print 2-Column Award Rolls (All ${activeSubjects.length} Subs)`
                              : `Print 2-Column Award Roll — ${getSubjectDisplayName(exportSubjectTarget, cls)}`}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Official 50/page JKBOSE layout (Figures & Words)
                          </div>
                        </div>
                      </button>

                      {/* 4. Print Fail / Absent Defaulters List */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                          const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                          if (!listToPrint || listToPrint.length === 0) {
                            showToast(`No student records available to print for Class ${cls}.`, 'warning');
                            return;
                          }
                          const isSingle = exportSubjectTarget !== 'all';
                          const targetCodes = isSingle ? [exportSubjectTarget] : activeSubjects;
                          printFailList({
                            className: cls,
                            session: localPrintOpts.sessionText,
                            students: listToPrint,
                            submissions,
                            pendingSubmissions: pendingApprovals,
                            selectedSubjectCodes: targetCodes,
                            isExternal: localPrintOpts.practicalType === 'external',
                            evaluationType: localPrintOpts.practicalType,
                            printDetails: { ...localPrintOpts, settings }
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                          <AlertTriangle size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black text-rose-700 dark:text-rose-400 truncate">
                            {exportSubjectTarget === 'all'
                              ? `Print Fail / Absent List (All ${activeSubjects.length} Subs)`
                              : `Print Fail / Absent List — ${getSubjectDisplayName(exportSubjectTarget, cls)}`}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Summary of students failed or absent in practicals
                          </div>
                        </div>
                      </button>

                      {/* 5. Consolidated Awards Matrix & Forwarding Letter — not for Pre-Board */}
                      {!/pre.?board/i.test(localPrintOpts.practicalType) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAwardsMenu(false);
                            const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                            const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                            if (!listToPrint || listToPrint.length === 0) {
                              showToast(`No student records available to print for Class ${cls}.`, 'warning');
                              return;
                            }
                            const isSingle = exportSubjectTarget !== 'all';
                            const targetCodes = isSingle
                              ? [exportSubjectTarget]
                              : (subjectsWithSubmissions.size > 0 ? activeSubjects.filter(c => subjectsWithSubmissions.has(c)) : activeSubjects);
                            printConsolidatedAwardRoll({
                              className: cls,
                              session: localPrintOpts.sessionText,
                              students: listToPrint,
                              submissions,
                              isExternal: localPrintOpts.practicalType === 'external',
                              evaluationType: localPrintOpts.practicalType,
                              selectedSubjectCodes: targetCodes,
                              printDetails: localPrintOpts
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                            <Award size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] font-black truncate">
                              Print Consolidated Cover Letter & Matrix
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                              Forwarding letter + subject hash totals matrix
                            </div>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* SECTION 2: EXCEL & WORD EXPORTS */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <div className="px-1.5 pt-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        Export Spreadsheets & Docs
                      </div>

                      {!/pre.?board/i.test(localPrintOpts.practicalType) && (<>
                        {/* Export Consolidated Excel */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAwardsMenu(false);
                            const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                            const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                            if (!listToPrint || listToPrint.length === 0) {
                              showToast(`No student records available to export for Class ${cls}.`, 'warning');
                              return;
                            }
                            const isSingle = exportSubjectTarget !== 'all';
                            const targetCodes = isSingle
                              ? [exportSubjectTarget]
                              : (subjectsWithSubmissions.size > 0 ? activeSubjects.filter(c => subjectsWithSubmissions.has(c)) : activeSubjects);
                            exportConsolidatedAwardsToExcel({
                              className: cls,
                              session: localPrintOpts.sessionText,
                              students: listToPrint,
                              submissions,
                              isExternal: localPrintOpts.practicalType === 'external',
                              evaluationType: localPrintOpts.practicalType,
                              selectedSubjectCodes: targetCodes,
                              printDetails: localPrintOpts
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <FileSpreadsheet size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] font-black text-emerald-700 dark:text-emerald-400 truncate">
                              Export Consolidated Excel (.xlsx)
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                              Sheet 1 (Cover Letter) + Sheet 2 (Awards Matrix)
                            </div>
                          </div>
                        </button>

                        {/* Export Official Word Doc */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAwardsMenu(false);
                            const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                            const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                            if (!listToPrint || listToPrint.length === 0) {
                              showToast(`No student records available to export for Class ${cls}.`, 'warning');
                              return;
                            }
                            const isSingle = exportSubjectTarget !== 'all';
                            const targetCodes = isSingle
                              ? [exportSubjectTarget]
                              : (subjectsWithSubmissions.size > 0 ? activeSubjects.filter(c => subjectsWithSubmissions.has(c)) : activeSubjects);
                            exportConsolidatedAwardsToWord({
                              className: cls,
                              session: localPrintOpts.sessionText,
                              students: listToPrint,
                              submissions,
                              isExternal: localPrintOpts.practicalType === 'external',
                              evaluationType: localPrintOpts.practicalType,
                              selectedSubjectCodes: targetCodes,
                              printDetails: localPrintOpts
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                            <FileText size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] font-black text-sky-700 dark:text-sky-300 truncate">
                              Export Official Word Doc (.docx)
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                              Native Word (.docx) with official styling
                            </div>
                          </div>
                        </button>
                      </>)}

                      {/* Export Blank Teacher Roster */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          const rawList = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                          const listToPrint = (rawList || []).filter(st => !isStudentExamDropped(st) && checkStudentApprovalState(st).isApproved);
                          const subToRoster = exportSubjectTarget !== 'all' ? exportSubjectTarget : (activeSubjects[0] || 'BO');
                          exportCurrentRosterToExcel({
                            className: cls,
                            session: localPrintOpts.sessionText,
                            students: listToPrint,
                            subjectCode: subToRoster,
                            evaluationType: localPrintOpts.practicalType
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <Download size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold truncate">
                            {exportSubjectTarget !== 'all'
                              ? `Export Blank Roster (.xlsx) — ${getSubjectDisplayName(exportSubjectTarget, cls)}`
                              : 'Export Blank Teacher Roster (.xlsx)'}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Prefilled student list for offline marks entry
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* SECTION 3: SPREADSHEET IMPORT & BLANK TEMPLATES */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <div className="px-1.5 pt-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                        Spreadsheet Import & Blank Templates
                      </div>

                      {/* Import Excel / CSV Marks */}
                      {onOpenImportModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAwardsMenu(false);
                            onOpenImportModal();
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Upload size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] font-black text-indigo-700 dark:text-indigo-400 truncate">
                              Import Excel / CSV Marks
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                              Upload completed spreadsheet into database
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Download Official Blank Template */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          generatePracticalsExcelTemplate();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Download size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-black text-emerald-700 dark:text-emerald-400 truncate">
                            Download Excel Template (.xlsx)
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Standard blanks with instructions & subject codes
                          </div>
                        </div>
                      </button>

                      {/* Download Blank CSV Template */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAwardsMenu(false);
                          generatePracticalsCsvTemplate();
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <Download size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold truncate">
                            Download CSV Template (.csv)
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                            Lightweight comma-separated format
                          </div>
                        </div>
                      </button>
                    </div>

                  </div>
                )}
              </div>

              {/* 5. Settings Button */}
              <button
                type="button"
                onClick={() => setShowOptsModal(true)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer flex items-center border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                title="Print layout & in-charge options"
              >
                <Settings size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* COLLAPSIBLE FILTER TRAY (HIDDEN BY DEFAULT) */}
        {showFilterTray && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex flex-wrap items-center gap-2">
              {/* Group 1: Evaluation Mode */}
              <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setLocalPrintOpts(p => ({ ...p, practicalType: 'internal' }))}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                    localPrintOpts.practicalType === 'internal'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Internal
                </button>
                <button
                  type="button"
                  onClick={() => setLocalPrintOpts(p => ({ ...p, practicalType: 'external' }))}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                    localPrintOpts.practicalType === 'external'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  External
                </button>
              </div>

              {/* Group 2: Biology Split / Combine */}
              <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setBioMode('separate')}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                    bioMode === 'separate'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Show Botany (BO) and Zoology (ZO) in separate columns"
                >
                  BO & ZO
                </button>
                <button
                  type="button"
                  onClick={() => setBioMode('combined')}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                    bioMode === 'combined'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Combine Botany and Zoology into single Biology (BI) column"
                >
                  BI Combined
                </button>
              </div>

              {/* Group 3: Session & Status Dropdowns */}
              <select
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
                className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-black outline-none cursor-pointer shadow-2xs"
              >
                {availablePracticalSessions.map(sess => (
                  <option key={sess.id} value={sess.id}>
                    {sess.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={e => setSelectedStatusFilter(e.target.value)}
                className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-black outline-none cursor-pointer shadow-2xs"
              >
                <option value="all">All Students ({totalClassStudents.length})</option>
                <option value="approved">Approved & Roll Only ({approvedCount})</option>
                <option value="pending">Pending Roll ({pendingCount})</option>
              </select>
            </div>

            {/* Select All Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer font-black text-slate-700 dark:text-slate-300 text-xs select-none pl-1">
              <input
                type="checkbox"
                checked={selectedRolls.size === sortedStudents.length && sortedStudents.length > 0}
                onChange={toggleAllStudents}
                className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
              />
              <span>Select All ({sortedStudents.length})</span>
            </label>
          </div>
        )}
      </div>

      {/* Data Grid Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs overflow-x-auto">
        <table className="w-full min-w-[950px] text-left text-[11px] border-collapse">
          <thead className="bg-sky-50 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 border-b border-sky-100 dark:border-slate-800">
            <tr>
              <th className="py-2 px-2 text-center">#</th>
              <th className="py-2 px-2 text-center">
                <input type="checkbox" checked={selectedRolls.size === sortedStudents.length && sortedStudents.length > 0} onChange={toggleAllStudents} className="w-3 h-3 text-indigo-600 cursor-pointer" />
              </th>
              <th onClick={() => handleSort('roll')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none text-center whitespace-nowrap">
                CLASS ROLL {sortField === 'roll' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('examRoll')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none text-center whitespace-nowrap">
                EXAM ROLL {sortField === 'examRoll' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('regNo')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none whitespace-nowrap">
                REG NO. {sortField === 'regNo' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('name')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none whitespace-nowrap">
                STUDENT NAME {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('father')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none min-w-[150px] whitespace-nowrap">
                PARENTS' NAME {sortField === 'father' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('stream')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none whitespace-nowrap">
                STREAM {sortField === 'stream' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {activeSubjects.map(code => <th key={code} className="py-2 px-1 text-center whitespace-nowrap">{code}</th>)}
              <th onClick={() => handleSort('hashTotal')} className="py-2 px-2 text-center font-black cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none whitespace-nowrap">
                HASH TOTAL {sortField === 'hashTotal' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold bg-white dark:bg-slate-900">
            {sortedStudents.map((st, idx) => {
              const rollNo = getRollNo(st) || '—';
              const rawName = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
              const rawFather = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '—';
              const rawMother = st["Mother's Name (as per school records)"] || st["Mother's Name"] || st.motherName || st.mother || '';
              const name = toTitleCase(rawName);
              const father = toTitleCase(rawFather);
              const mother = rawMother ? toTitleCase(rawMother) : '';
              const streamRaw = getStudentStreamStr(st, cls);
              const streamDisplay = streamRaw ? toTitleCase(streamRaw) : 'Science';
              const streamLower = streamRaw.toLowerCase();
              const rawExam = getCurrentOfficialExamRoll(st, cls) || String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || st['Exam Roll Number'] || '').trim();
              // Always show official current exam roll if available (board issues rolls well before the exam)
              const examRoll = (rawExam && rawExam !== '—' && rawExam !== 'NA' && rawExam !== 'N/A') ? rawExam : '—';
              
              const rawReg = st['Board Registration Number'] || st['Board Reg. No.'] || st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || st.boardRegNo || st.regNo || '';
              const cleanReg = cleanRegistrationNumber(rawReg);
              const regNo = cleanReg && cleanReg.length >= 5 ? cleanReg : '—';

              const uniqueKey = rollNo !== '—' ? rollNo : (cleanReg || st.examRollNo || st.id || `st_${idx}`);
              const isSelected = selectedRolls.has(uniqueKey) || (rollNo !== '—' && selectedRolls.has(rollNo));
              const stSess = getStudentSession(st);
              const effectiveSess = selectedSession !== 'all' ? selectedSession : (stSess || '2025-26');
              let rowHashTotal = 0;

              return (
                <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors ${!isSelected ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/30' : ''}`}>
                  <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="py-1.5 px-2 text-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleStudentRoll(uniqueKey)} className="w-3 h-3 text-indigo-600 cursor-pointer" />
                  </td>
                  <td className="py-1.5 px-2 font-mono font-black text-indigo-600 dark:text-indigo-400 text-center text-[11px] whitespace-nowrap">{rollNo}</td>
                  <td className="py-1.5 px-2 font-mono text-slate-700 dark:text-slate-300 text-center text-[10px] font-bold whitespace-nowrap">{examRoll}</td>
                  <td className="py-1.5 px-2 font-mono text-[10px] text-slate-600 dark:text-slate-300 select-all whitespace-nowrap">
                    {regNo !== '—' ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[9.5px] font-bold">
                        {regNo}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px]">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{name}</td>
                  <td className="py-1.5 px-2 min-w-[140px]">
                    <div className="font-bold text-slate-800 dark:text-slate-200 leading-tight" title={father !== '—' ? `Father: ${father}` : ''}>
                      {father}
                    </div>
                    {mother && (
                      <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5" title={`Mother: ${mother}`}>
                        {mother}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      (streamLower.includes('science') || streamLower.includes('med') || streamLower.includes('sci')) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20' :
                      streamLower.includes('commerce') ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20' :
                      'bg-purple-50 text-purple-700 dark:bg-purple-900/20'
                    }`}>{streamDisplay}</span>
                  </td>
                  {activeSubjects.map(subCode => {
                    const isEnrolled = isStudentEnrolledInSubject(st, subCode, cls);
                    const mark = getSubjectMarkForStudent(st, subCode, effectiveSess);

                    if (typeof mark === 'number') {
                      rowHashTotal += mark;
                      return <td key={subCode} className="py-1.5 px-1 text-center font-black text-blue-700 dark:text-blue-400 text-[11px]">{mark}</td>;
                    } else if (mark === 'AB') {
                      return <td key={subCode} className="py-1.5 px-1 text-center font-bold text-rose-500 text-[11px]">AB</td>;
                    }

                    if (!isEnrolled) return <td key={subCode} className="py-1.5 px-1 text-center text-slate-300 dark:text-slate-700 text-[10px]">x</td>;
                    return <td key={subCode} className="py-1.5 px-1 text-center text-slate-400 font-bold text-[11px]">—</td>;
                  })}
                  <td className="py-1.5 px-2 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 whitespace-nowrap">{rowHashTotal > 0 ? rowHashTotal : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Options Modal */}
      {showOptsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5"><Settings size={16} className="text-sky-600" /> Print & Award Options</h3>
              <button onClick={() => setShowOptsModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-400"><X size={16} /></button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Academic Session Text</label>
              <input type="text" value={localPrintOpts.sessionText} onChange={e => setLocalPrintOpts({ ...localPrintOpts, sessionText: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Evaluation Type</label>
                <select value={localPrintOpts.practicalType} onChange={e => setLocalPrintOpts({ ...localPrintOpts, practicalType: e.target.value })} className="w-full px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold">
                  <option value="internal">Internal Assessment</option>
                  <option value="external">External Practical</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Absent Marker</label>
                <input type="text" value={localPrintOpts.absentMarker} onChange={e => setLocalPrintOpts({ ...localPrintOpts, absentMarker: e.target.value })} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Incharge Name</label>
              <input type="text" value={localPrintOpts.inchargeName || ''} onChange={e => setLocalPrintOpts({ ...localPrintOpts, inchargeName: e.target.value })} placeholder="e.g. Mr. Majid Hassan Najar" className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Incharge CPIS</label>
                <input type="text" value={localPrintOpts.inchargeCpis || ''} onChange={e => setLocalPrintOpts({ ...localPrintOpts, inchargeCpis: e.target.value })} placeholder="e.g. SHGEDU00220017" className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Incharge Mobile</label>
                <input type="tel" maxLength={10} value={localPrintOpts.inchargeMobile || ''} onChange={e => setLocalPrintOpts({ ...localPrintOpts, inchargeMobile: e.target.value.replace(/\D/g, '') })} placeholder="10-digit mobile" className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button onClick={() => setShowOptsModal(false)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CSV IMPORT MODAL COMPONENT (WITH PARSER & BATCH WRITE)
// ─────────────────────────────────────────────────────────────
function CsvImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedResult, setParsedResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [previewTab, setPreviewTab] = useState('students'); // 'students' | 'chunks'
  const [previewSearch, setPreviewSearch] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrorMsg(null);
    setParsedResult(null);

    setParsing(true);
    const fileName = (f.name || '').toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileData = event.target?.result;
        const res = parseAndValidatePracticalsSpreadsheet(fileData, isExcel);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to parse spreadsheet file.');
        } else {
          setParsedResult(res);
        }
      } catch (err) {
        setErrorMsg('Error reading spreadsheet file: ' + err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
      setParsing(false);
    };

    if (isExcel) {
      reader.readAsArrayBuffer(f);
    } else {
      reader.readAsText(f);
    }
  };

  const handleStartImport = async () => {
    if (!parsedResult || !parsedResult.documents || parsedResult.documents.length === 0) return;
    setImporting(true);
    setProgress(0);

    const res = await importPracticalsCsvToFirestore(parsedResult.documents, (pct) => {
      setProgress(pct);
    });

    setImporting(false);
    if (res.success) {
      onSuccess();
    } else {
      setErrorMsg(res.error || 'Failed to import documents to cloud database.');
    }
  };

  // Filter preview records by search keyword
  const filteredPreviewRecords = useMemo(() => {
    if (!parsedResult || !parsedResult.previewRecords) return [];
    if (!previewSearch.trim()) return parsedResult.previewRecords;
    const q = previewSearch.toLowerCase().trim();
    return parsedResult.previewRecords.filter(r =>
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.parentName || '').toLowerCase().includes(q) ||
      String(r.boardRegNo || '').toLowerCase().includes(q) ||
      String(r.examRollNo || '').toLowerCase().includes(q) ||
      String(r.classRollNo || '').toLowerCase().includes(q) ||
      String(r.subjectCode || '').toLowerCase().includes(q)
    );
  }, [parsedResult, previewSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] space-y-3">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Import Practicals Data & Awards</h3>
              <p className="text-[11px] font-semibold text-slate-500">Upload completed Excel spreadsheet (.xlsx/.xls) or CSV. Preserves 16-digit Board Reg No and overwrites matching session awards.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* File Drop / Select Area */}
        {!parsedResult && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 sm:p-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
            <FileSpreadsheet size={42} className="mx-auto text-indigo-500 opacity-80 animate-pulse" />
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200">Choose an Excel Spreadsheet (.xlsx / .xls) or CSV File</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Supports Internal and External evaluations. 16-digit Board Registration numbers are automatically cleaned and preserved as exact text strings.</p>
            </div>
            <label className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all">
              <span>{parsing ? 'Reading Spreadsheet File...' : 'Browse & Select Excel / CSV File'}</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={parsing} className="hidden" />
            </label>
            <div className="pt-2 flex items-center justify-center gap-3 text-xs text-slate-500">
              <span>Need the standard template?</span>
              <button
                type="button"
                onClick={() => generatePracticalsExcelTemplate()}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download size={13} /> Download Excel Template (.xlsx)
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {/* Parsing Summary & Full Interactive Preview */}
        {parsedResult && (
          <div className="space-y-2.5 flex-1 overflow-hidden flex flex-col">
            {/* Top Overview Cards & Overwrite Alert */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase">Total Rows</p>
                <p className="text-base font-black text-slate-900 dark:text-white">{parsedResult.totalRows}</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <p className="text-[10px] font-black uppercase">Valid Awards</p>
                <p className="text-base font-black">{parsedResult.validRecords}</p>
              </div>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                <p className="text-[10px] font-black uppercase">Subject Chunks</p>
                <p className="text-base font-black">{parsedResult.documentsCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300">
                <p className="text-[10px] font-black uppercase">Warnings</p>
                <p className="text-base font-black">{parsedResult.errors?.length || 0}</p>
              </div>
            </div>

            {/* Overwrite Banner */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Overwrite Policy:</strong> Importing will overwrite previously existing marks in Firestore for the matching Class, Session, Subject, and Evaluation Type.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-black shrink-0 uppercase tracking-wider">
                Full Overwrite
              </span>
            </div>

            {/* Preview Navigation Tabs & Filter */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewTab('students')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    previewTab === 'students'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Student Awards Preview ({parsedResult.validRecords})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('chunks')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    previewTab === 'chunks'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Firestore Subject Chunks ({parsedResult.documentsCount})
                </button>
              </div>

              {previewTab === 'students' && (
                <input
                  type="text"
                  placeholder="Filter preview by name, 16-digit reg, roll..."
                  value={previewSearch}
                  onChange={e => setPreviewSearch(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none w-64 focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Tab 1: Student Awards Table Preview */}
            {previewTab === 'students' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex-1 overflow-x-auto shadow-2xs">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-2 text-center">#</th>
                        <th className="py-2 px-2">CLASS / SESS</th>
                        <th className="py-2 px-2">SUB</th>
                        <th className="py-2 px-2">BOARD REG NO (16-DIGIT)</th>
                        <th className="py-2 px-2">EXAM ROLL</th>
                        <th className="py-2 px-2">CLASS ROLL</th>
                        <th className="py-2 px-2">STUDENT NAME</th>
                        <th className="py-2 px-2">FATHER NAME</th>
                        <th className="py-2 px-2 text-center">MARKS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                      {filteredPreviewRecords.slice(0, 150).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-2 text-center font-mono text-[10px] text-slate-400">{i + 1}</td>
                          <td className="py-1.5 px-2">
                            <span className="font-bold text-indigo-600">{r.className}</span>
                            <span className="text-[9px] block text-slate-400">{r.sessionText}</span>
                          </td>
                          <td className="py-1.5 px-2">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                              {r.subjectCode}
                            </span>
                          </td>
                          <td className="py-1.5 px-2">
                            <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-all">
                              {r.boardRegNo || '—'}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 font-mono text-[10.5px]">{r.examRollNo || '—'}</td>
                          <td className="py-1.5 px-2 font-mono text-[10.5px]">{r.classRollNo || '—'}</td>
                          <td className="py-1.5 px-2 font-bold text-slate-900 dark:text-white">{r.name}</td>
                          <td className="py-1.5 px-2 text-slate-500">{r.parentName || '—'}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs">
                              {r.practicalMarks} / {r.maxMarks || 10}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPreviewRecords.length > 150 && (
                    <div className="p-2 text-center text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-900">
                      Showing first 150 of {filteredPreviewRecords.length} records. All records will be committed upon confirmation.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Firestore Subject Chunks Breakdown */}
            {previewTab === 'chunks' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex-1 overflow-y-auto max-h-64 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800">
                {parsedResult.documents.map((d, i) => (
                  <div key={i} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-indigo-600 text-xs">{d.className}</span>
                        <span className="font-black text-slate-900 dark:text-white">{d.subjectName} ({d.subjectCode})</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase">
                          {d.practicalType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">• Session: {d.sessionText}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 font-semibold">
                        Document ID: <code className="font-mono text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded">{d.id}</code> • Examiner: {d.teacherName} ({d.teacherEmail})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black text-xs">
                        {d.records.length} Student Awards
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings list if any */}
            {parsedResult.errors && parsedResult.errors.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 text-[11px] font-semibold space-y-1">
                <p className="font-bold flex items-center gap-1"><AlertTriangle size={12} /> {parsedResult.errors.length} Row Warnings:</p>
                <div className="max-h-20 overflow-y-auto text-[10px] font-mono">
                  {parsedResult.errors.map((err, i) => <div key={i}>• {err}</div>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar during Import */}
        {importing && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-xs font-bold text-slate-600">
              <span>Writing and overwriting documents in Firestore...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {parsedResult ? (
            <button
              onClick={() => { setParsedResult(null); setFile(null); }}
              disabled={importing}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Choose Different File
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={importing} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
            {parsedResult && (
              <button
                onClick={handleStartImport}
                disabled={importing}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> {importing ? 'Overwriting & Importing...' : 'Confirm & Overwrite Database'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SELECTED SUBMISSION RECORDS MODAL
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// SELECTED SUBMISSION RECORDS MODAL (MINIMAL-COMPACT & RESPONSIVE)
// ─────────────────────────────────────────────────────────────
function SelectedSubmissionModal({ selSub, submissions = [], onClose, absentMarker, allStudents = [], onApprove, onReject, onSaveDirect, onDelete }) {
  const [modalSearch, setModalSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState('all'); // 'all' | 'changed_only' | 'absent_only'
  const [fetchedCanonicalDoc, setFetchedCanonicalDoc] = useState(null);
  const [binVersions, setBinVersions] = useState([]);
  const [comparisonSource, setComparisonSource] = useState('auto'); // 'auto' | 'live' | 'bin_<id>'
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableRecords, setEditableRecords] = useState(() => Array.isArray(selSub?.records) ? [...selSub.records] : []);
  const [editedIndices, setEditedIndices] = useState(new Set());
  const [isSavingDirect, setIsSavingDirect] = useState(false);

  useEffect(() => {
    if (selSub && Array.isArray(selSub.records)) {
      setEditableRecords([...selSub.records]);
      setEditedIndices(new Set());
    }
  }, [selSub]);

  const subjectMaxMarks = Number(selSub?.maxMarks) || 50;

  const handleInlineMarkChange = (origIdx, field, val) => {
    const rawVal = val.trim().toUpperCase();
    if (rawVal !== '' && rawVal !== 'A' && rawVal !== 'AB' && rawVal !== 'ABS' && rawVal !== 'ABSENT') {
      const num = Number(rawVal);
      if (isNaN(num) || num < 0 || num > subjectMaxMarks) {
        return;
      }
    }

    setEditableRecords(prev => {
      const copy = [...prev];
      const cur = copy[origIdx];
      if (!cur) return prev;
      const updated = { ...cur, [field]: rawVal };

      const pStr = field === 'practicalMarks' ? rawVal : (cur.practicalMarks || '');
      const vStr = field === 'vivaMarks' ? rawVal : (cur.vivaMarks || '');
      const pIsNum = !isNaN(Number(pStr)) && pStr !== '';
      const vIsNum = !isNaN(Number(vStr)) && vStr !== '';
      const isExplicitAbs = rawVal === 'A' || rawVal === 'AB' || rawVal === 'ABS' || rawVal === 'ABSENT';

      if (isExplicitAbs) {
        updated.practicalMarks = 'AB';
        updated.vivaMarks = 'AB';
        updated.totalMarks = 'AB';
      } else if (pIsNum || vIsNum) {
        // If entering a numeric mark, clear any phantom lingering 'AB' from vivaMarks
        if (field === 'practicalMarks' && (/^(A|AB|ABS|ABSENT)$/i.test(cur.vivaMarks) || !cur.vivaMarks)) {
          updated.vivaMarks = '';
        }
        const pNum = pIsNum ? Number(pStr) : 0;
        const vNum = (vIsNum && !/^(A|AB|ABS|ABSENT)$/i.test(updated.vivaMarks)) ? Number(updated.vivaMarks) : 0;
        updated.totalMarks = String(Math.min(subjectMaxMarks, pNum + vNum));
      } else {
        updated.totalMarks = pStr || '';
      }
      updated.updatedByAdmin = true;
      copy[origIdx] = updated;
      return copy;
    });
    setEditedIndices(prev => new Set(prev).add(origIdx));
  };

  // Determine target canonical document ID for live comparison
  const targetDocId = useMemo(() => {
    if (!selSub) return '';
    return selSub.targetDocId || selSub.canonicalDocId || String(selSub.id || '').replace(/^pending_/, '');
  }, [selSub]);

  // Try matching live canonical document from active submissions or fetched document
  const liveCanonicalDoc = useMemo(() => {
    if (!targetDocId) return null;
    return (submissions || []).find(s => s.id === targetDocId) || fetchedCanonicalDoc;
  }, [submissions, targetDocId, fetchedCanonicalDoc]);

  // Fetch canonical doc from Firestore if not present in memory
  useEffect(() => {
    let isMounted = true;
    if (!liveCanonicalDoc && targetDocId && (selSub?.isOverwrite || String(selSub?.id || '').startsWith('pending_') || selSub?.status === 'pending_approval')) {
      getDoc(doc(db, 'practicalsData', targetDocId))
        .then(snap => {
          if (isMounted && snap.exists()) {
            setFetchedCanonicalDoc({ id: snap.id, ...snap.data() });
          }
        })
        .catch(err => console.warn('Could not load canonical doc for comparison:', err));
    }
    return () => { isMounted = false; };
  }, [targetDocId, liveCanonicalDoc, selSub]);

  // Load prior versions from Version Bin for accurate historical diff comparison
  useEffect(() => {
    let isMounted = true;
    if (targetDocId && (selSub?.isOverwrite || String(selSub?.id || '').startsWith('pending_') || selSub?.status === 'pending_approval')) {
      getVersionsForDoc(targetDocId)
        .then(versions => {
          if (isMounted && Array.isArray(versions)) {
            setBinVersions(versions);
          }
        })
        .catch(err => console.warn('[SelectedSubmissionModal] Failed to load bin versions:', err));
    }
    return () => { isMounted = false; };
  }, [targetDocId, selSub]);

  const records = editableRecords;
  const canonicalSession = normalizePracticalSession(selSub?.sessionText || selSub?.session || selSub?.Session || '2024-25 (Oct-Nov)');
  const rawEvalType = selSub?.evaluationType || selSub?.evalType || selSub?.examTitle || selSub?.practicalType || selSub?.assessmentType || selSub?.type || '';
  const evaluationType = rawEvalType ? toTitleCase(rawEvalType) : 'Internal';

  // Smart baseline resolution: accurately pick the comparison baseline (Live DB vs Prior Archive)
  const baselineDoc = useMemo(() => {
    if (comparisonSource === 'live') {
      return liveCanonicalDoc;
    }
    if (comparisonSource && comparisonSource.startsWith('bin_')) {
      const match = binVersions.find(v => v.id === comparisonSource);
      if (match) return match;
    }

    // Auto mode:
    // 1. Check if liveCanonicalDoc has diffs vs current records
    if (liveCanonicalDoc && Array.isArray(liveCanonicalDoc.records) && liveCanonicalDoc.records.length > 0) {
      const hasLiveDiff = records.some((r, i) => {
        const c = liveCanonicalDoc.records[i];
        if (!c) return false;
        const cP = String(c.practicalMarks ?? '').trim().toUpperCase();
        const rP = String(r.practicalMarks ?? '').trim().toUpperCase();
        const cT = String(c.totalMarks ?? '').trim().toUpperCase();
        const rT = String(r.totalMarks ?? '').trim().toUpperCase();
        return (cP !== rP && (cP !== '' || rP !== '')) || (cT !== rT && (cT !== '' || rT !== ''));
      });
      if (hasLiveDiff) {
        return liveCanonicalDoc;
      }
    }

    // 2. If live has 0 diffs and this is an overwrite revision, inspect Version Bin for prior marks
    if (binVersions.length > 0) {
      const versionWithDiff = binVersions.find(v => {
        const vRecs = Array.isArray(v.records) ? v.records : (Array.isArray(v.data?.records) ? v.data.records : []);
        return records.some((r, i) => {
          const b = vRecs[i];
          if (!b) return false;
          const bP = String(b.practicalMarks ?? '').trim().toUpperCase();
          const rP = String(r.practicalMarks ?? '').trim().toUpperCase();
          const bT = String(b.totalMarks ?? '').trim().toUpperCase();
          const rT = String(r.totalMarks ?? '').trim().toUpperCase();
          return (bP !== rP && (bP !== '' || rP !== '')) || (bT !== rT && (bT !== '' || rT !== ''));
        });
      });
      if (versionWithDiff) return versionWithDiff;
      return binVersions[0];
    }

    return liveCanonicalDoc;
  }, [comparisonSource, liveCanonicalDoc, binVersions, records]);

  // Clean label describing the active comparison baseline
  const baselineLabel = useMemo(() => {
    if (!baselineDoc) return 'No baseline found';
    if (baselineDoc === liveCanonicalDoc) {
      return `Live DB (${liveCanonicalDoc.records?.length || 0} recs)`;
    }
    const dateStr = baselineDoc.archivedAt || baselineDoc.versionTimestamp || baselineDoc.createdAt;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Archive';
    const recCount = baselineDoc.recordsCount || baselineDoc.records?.length || baselineDoc.data?.records?.length || 0;
    return `Prior Archive (${formattedDate} • ${recCount} recs)`;
  }, [baselineDoc, liveCanonicalDoc]);

  // Robust field extractors
  const getCleanReg = useCallback((r) => cleanRegistrationNumber(
    r.boardRegNo || r.regNo || r['Board Reg. No.'] || r['Board Registration Number'] || r.boardRegistrationNumber || ''
  ), []);
  const getCleanExam = useCallback((r) => String(
    r.examRollNo || r.examRoll || r['Exam Roll No'] || (/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || ''
  ).trim().toUpperCase(), []);
  const getCleanForm = useCallback((r) => String(
    r.formNo || r.fNo || r['Form No'] || r.admissionNo || ''
  ).trim().toLowerCase(), []);
  const getCleanClassRoll = useCallback((r) => String(
    r.classRollNo || r.classRoll || (r.rollNo && !/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || ''
  ).trim(), []);
  const getCleanName = useCallback((r) => toTitleCase(
    r.name || r.studentName || r["Student's Name"] || ''
  ).trim().toLowerCase(), []);
  const getCleanFather = useCallback((r) => toTitleCase(
    r.parentage || r.parentName || r.fatherName || r["Father's Name"] || ''
  ).trim().toLowerCase(), []);

  // Multi-key indexed map of baseline records for infallible student resolution
  const oldRecordsMap = useMemo(() => {
    const map = new Map();
    const baseRecs = baselineDoc ? (Array.isArray(baselineDoc.records) ? baselineDoc.records : (Array.isArray(baselineDoc.data?.records) ? baselineDoc.data.records : [])) : [];
    baseRecs.forEach((r, idx) => {
      if (!r) return;
      const reg = getCleanReg(r);
      const exam = getCleanExam(r);
      const form = getCleanForm(r);
      const roll = getCleanClassRoll(r);
      const name = getCleanName(r);
      const father = getCleanFather(r);

      if (reg && reg.length >= 8) map.set(`reg_${reg}`, r);
      if (exam && exam !== '—' && exam !== 'NA' && exam.length >= 5) map.set(`exam_${exam}`, r);
      if (roll && roll !== '—' && roll !== 'N/A') map.set(`roll_${roll}`, r);
      if (roll && name) map.set(`roll_${roll}_${name}`, r);
      if (form && form !== '—' && form !== 'na') map.set(`form_${form}`, r);
      if (name && father) map.set(`name_${name}_${father}`, r);
      else if (name) map.set(`name_${name}`, r);
      map.set(`idx_${idx}`, r);
    });
    return map;
  }, [baselineDoc, getCleanReg, getCleanExam, getCleanForm, getCleanClassRoll, getCleanName, getCleanFather]);

  // Build high-performance lookup maps from all database students
  const studentByReg = useMemo(() => {
    const m = new Map();
    (allStudents || []).forEach(st => {
      const reg = cleanRegistrationNumber(st['Board Registration Number'] || st['Board Reg. No.'] || st.boardRegNo || st.regNo || '');
      if (reg && reg.length >= 8) m.set(reg, st);
    });
    return m;
  }, [allStudents]);

  const studentByExam = useMemo(() => {
    const m = new Map();
    (allStudents || []).forEach(st => {
      const exam = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || '').trim().toUpperCase();
      if (exam && exam !== '—' && exam !== 'NA' && exam.length >= 5) m.set(exam, st);
    });
    return m;
  }, [allStudents]);

  const studentByRoll = useMemo(() => {
    const m = new Map();
    (allStudents || []).forEach(st => {
      const roll = getRollNo(st);
      if (roll && roll !== '—' && roll !== 'N/A') m.set(String(roll).trim(), st);
    });
    return m;
  }, [allStudents]);

  const studentByName = useMemo(() => {
    const m = new Map();
    (allStudents || []).forEach(st => {
      const name = toTitleCase(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '').trim().toLowerCase();
      const father = toTitleCase(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '').trim().toLowerCase();
      if (name && father) m.set(`${name}_${father}`, st);
      else if (name) m.set(name, st);
    });
    return m;
  }, [allStudents]);

  // Enriched records with diff annotations against baseline
  const enrichedRecords = useMemo(() => {
    const normalizeMark = (m) => {
      if (m === null || m === undefined || m === '' || m === '—') return '—';
      const s = String(m).trim().toUpperCase();
      if (s === 'AB' || s === 'A' || s === 'ABS' || s === 'ABSENT') return 'AB';
      const num = Number(s);
      if (!isNaN(num)) return String(num);
      return s;
    };

    const normalizeViva = (v, prac) => {
      if (v === null || v === undefined || v === '' || v === '—' || String(v).trim() === '0') return '—';
      const s = String(v).trim().toUpperCase();
      if (s === 'AB' || s === 'A' || s === 'ABS' || s === 'ABSENT') {
        if (prac && !isNaN(Number(prac)) && Number(prac) > 0) return '—';
        return 'AB';
      }
      const num = Number(s);
      if (!isNaN(num)) return num === 0 ? '—' : String(num);
      return s;
    };

    return records.map((r, i) => {
      const reg = getCleanReg(r);
      const exam = getCleanExam(r);
      const roll = getCleanClassRoll(r);
      const form = getCleanForm(r);
      const name = getCleanName(r);
      const father = getCleanFather(r);

      let oldRec = (reg && oldRecordsMap.get(`reg_${reg}`)) ||
                   (exam && oldRecordsMap.get(`exam_${exam}`)) ||
                   (roll && name && oldRecordsMap.get(`roll_${roll}_${name}`)) ||
                   (roll && oldRecordsMap.get(`roll_${roll}`)) ||
                   (form && oldRecordsMap.get(`form_${form}`)) ||
                   (name && father && oldRecordsMap.get(`name_${name}_${father}`)) ||
                   (name && oldRecordsMap.get(`name_${name}`)) ||
                   null;

      if (!oldRec && oldRecordsMap.has(`idx_${i}`)) {
        const cand = oldRecordsMap.get(`idx_${i}`);
        const cRoll = getCleanClassRoll(cand);
        const cName = getCleanName(cand);
        if ((roll && cRoll && roll === cRoll) || (name && cName && (name.includes(cName) || cName.includes(name)))) {
          oldRec = cand;
        }
      }

      if (!oldRec) {
        return {
          ...r,
          originalIndex: i,
          hasDiff: false,
          isNewStudent: Boolean(baselineDoc && (baselineDoc.records?.length > 0 || baselineDoc.data?.records?.length > 0)),
          diff: null
        };
      }

      const oldPrac = normalizeMark(oldRec.practicalMarks);
      const newPrac = normalizeMark(r.practicalMarks);
      const oldViva = normalizeViva(oldRec.vivaMarks, oldRec.practicalMarks);
      const newViva = normalizeViva(r.vivaMarks, r.practicalMarks);
      const oldTot = normalizeMark(oldRec.totalMarks ?? oldRec.practicalMarks);
      const newTot = normalizeMark(r.totalMarks ?? r.practicalMarks);

      const pracChanged = oldPrac !== newPrac;
      const vivaChanged = oldViva !== newViva;
      const totalChanged = oldTot !== newTot;
      const hasDiff = pracChanged || totalChanged || (vivaChanged && (oldViva !== '—' || newViva !== '—'));

      return {
        ...r,
        originalIndex: i,
        hasDiff,
        isNewStudent: false,
        diff: hasDiff ? {
          oldPrac,
          newPrac,
          pracChanged,
          oldViva,
          newViva,
          vivaChanged,
          oldTot,
          newTot,
          totalChanged
        } : null
      };
    });
  }, [records, oldRecordsMap, baselineDoc, getCleanReg, getCleanExam, getCleanClassRoll, getCleanForm, getCleanName, getCleanFather]);

  const diffSummary = useMemo(() => {
    let changed = 0;
    let newStudents = 0;
    let absents = 0;
    enrichedRecords.forEach(r => {
      if (r.hasDiff) changed++;
      if (r.isNewStudent) newStudents++;
      const v = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase();
      if (v === 'AB' || v === 'A' || v === 'ABS' || v === (absentMarker || 'AB')) absents++;
    });
    return {
      changed,
      newStudents,
      absents,
      hasBaseline: Boolean(baselineDoc && (baselineDoc.records?.length > 0 || baselineDoc.data?.records?.length > 0))
    };
  }, [enrichedRecords, baselineDoc, absentMarker]);

  if (!selSub) return null;

  const filteredRecords = enrichedRecords.filter(r => {
    if (diffFilter === 'changed_only' && !r.hasDiff && !r.isNewStudent) {
      return false;
    }
    if (diffFilter === 'absent_only') {
      const v = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase();
      if (v !== 'AB' && v !== 'A' && v !== 'ABS' && v !== (absentMarker || 'AB')) return false;
    }
    if (!modalSearch.trim()) return true;
    const q = modalSearch.toLowerCase().trim();
    const name = String(r.name || r.studentName || '').toLowerCase();
    const father = String(r.parentage || r.parentName || r.fatherName || '').toLowerCase();
    const roll = String(r.classRollNo || r.rollNo || r.examRollNo || '').toLowerCase();
    const reg = String(r.boardRegNo || r.regNo || '').toLowerCase();
    return name.includes(q) || father.includes(q) || roll.includes(q) || reg.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[96vh] overflow-hidden">
        
        {/* Compact Header */}
        <div className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-2.5 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                Class {formatClassDisplay(selSub.className || selSub.Class, selSub)} — {selSub.subjectName || selSub.Subject || getSubjectDisplayName(selSub.subjectCode, selSub.className || selSub.Class) || selSub.subjectCode}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200/90 dark:border-indigo-800/80">
                {canonicalSession}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-200/90 dark:border-emerald-800/80">
                {evaluationType}
              </span>
              {selSub.isCrossSubject && (
                <span className="px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold text-[9.5px] border border-purple-200/90 dark:border-purple-800/80">
                  Cross-Subject
                </span>
              )}
              {selSub.isOverwrite && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black text-[10px] border border-rose-200/90 dark:border-rose-800/80 flex items-center gap-1">
                  <History size={10} /> Overwrite Revision
                </span>
              )}
              {diffSummary.changed > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 font-black text-[10px] border border-amber-300 dark:border-amber-700 flex items-center gap-1 shadow-2xs">
                  <Sparkles size={11} className="text-amber-600 dark:text-amber-400" />
                  {diffSummary.changed} {diffSummary.changed === 1 ? 'Mark Updated' : 'Marks Updated'}
                </span>
              ) : (
                selSub.isOverwrite && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium text-[9.5px] border border-slate-200 dark:border-slate-700">
                    No Marks Changed vs Baseline
                  </span>
                )
              )}
            </div>

            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Submitted by: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selSub.teacherName || selSub['Teacher Name'] || selSub.teacherEmail || 'Faculty'}</strong></span>
              <span>•</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{records.length} Student Records</span>
              <span>•</span>
              {/* Baseline Source Switcher */}
              <div className="inline-flex items-center gap-1">
                <span className="text-slate-400 text-[10px]">Baseline:</span>
                <select
                  value={comparisonSource}
                  onChange={(e) => setComparisonSource(e.target.value)}
                  className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  title="Select baseline document for diff comparison"
                >
                  <option value="auto">Auto ({baselineLabel})</option>
                  {liveCanonicalDoc && (
                    <option value="live">Live Database ({liveCanonicalDoc.records?.length || 0} recs)</option>
                  )}
                  {binVersions.map((bv, idx) => {
                    const dStr = bv.archivedAt || bv.versionTimestamp || bv.createdAt;
                    const fDate = dStr ? new Date(dStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Archive';
                    const recLen = bv.recordsCount || bv.records?.length || bv.data?.records?.length || 0;
                    return (
                      <option key={bv.id} value={bv.id}>
                        Archive #{idx + 1}: {fDate} ({recLen} recs)
                      </option>
                    );
                  })}
                </select>
              </div>
              {selSub.timestamp && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[10px] text-slate-400">{selSub.timestamp}</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons Top Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditMode(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer border ${
                isEditMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-2xs'
              }`}
            >
              <Edit3 size={12} />
              <span>{isEditMode ? 'Done' : 'Admin Edit'}</span>
              {editedIndices.size > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-mono text-[9px] font-black">
                  {editedIndices.size}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                const subRecords = records.map((r, i) => {
                  const cleanReg = cleanRegistrationNumber(r.boardRegNo || r.regNo || r['Board Reg. No.'] || '');
                  const cleanExam = String(r.examRollNo || (/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || '').trim().toUpperCase();
                  const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();
                  const rFather = toTitleCase(r.parentage || r.parentName || r.fatherName || '').trim().toLowerCase();
                  const dbSt = (cleanReg && studentByReg.get(cleanReg)) ||
                               (cleanExam && studentByExam.get(cleanExam)) ||
                               (rName && rFather && studentByName.get(`${rName}_${rFather}`)) ||
                               (rName && studentByName.get(rName));

                  const classRoll = r.classRollNo || r.classRoll || (r.rollNo && !/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || (dbSt ? getRollNo(dbSt) : '') || '—';
                  const examRoll = cleanExam || (dbSt ? (dbSt['Exam R.No. (Current)'] || dbSt.examRollNo) : '') || '—';

                  const cleanExamVal = (examRoll && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(String(examRoll).trim())) ? String(examRoll).trim() : '';
                  const cleanClassVal = (classRoll && !/^(N\/A|#N\/A|—|-|null|undefined)$/i.test(String(classRoll).trim())) ? String(classRoll).trim() : '';

                  return {
                    sno: i + 1,
                    classRollNo: cleanClassVal,
                    examRollNo: cleanExamVal,
                    rollNo: cleanExamVal || cleanClassVal,
                    name: r.name || r.studentName || '—',
                    practicalMarks: r.practicalMarks ?? '—',
                    vivaMarks: r.vivaMarks ?? '—',
                    totalMarks: (r.practicalMarks && String(r.practicalMarks).toUpperCase() === 'AB') ? 'AB' : (r.totalMarks ?? r.practicalMarks ?? '—')
                  };
                });

                printIndividualAwardRoll({
                  subjectCode: selSub.subjectCode || selSub.subject,
                  subjectName: selSub.subjectName || selSub.Subject || getSubjectDisplayName(selSub.subjectCode, selSub.className || selSub.Class) || selSub.subjectCode,
                  className: formatClassDisplay(selSub.className || selSub.Class, selSub),
                  session: canonicalSession,
                  records: subRecords,
                  isExternal: String(selSub.practicalType || selSub.evaluationType || '').toLowerCase().includes('ext'),
                  evaluationType: selSub.evaluationType || selSub.practicalType || selSub.evalType || selSub.examTitle || 'Internal Assessment',
                  practicalType: selSub.practicalType || selSub.evaluationType || selSub.evalType || 'Internal Assessment',
                  examTitle: selSub.examTitle || selSub.evaluationType || selSub.practicalType || 'Internal Assessment',
                  maxMarks: selSub.maxMarks || 20,
                  minMarks: selSub.minMarks || 7
                });
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
            >
              <Printer size={12} />
              <span>Print Award Roll</span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(selSub.id, selSub)}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 shadow-2xs"
                title="Move this submission to the Practicals Recycle Bin"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Admin Inline Edit Notification Banner */}
        {isEditMode && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 px-3 py-1.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Admin Editing Mode:</strong> You can edit student marks directly in the table.
                {editedIndices.size > 0 && ` (${editedIndices.size} modified)`}
              </span>
            </div>
            {onSaveDirect && editedIndices.size > 0 && (
              <button
                type="button"
                disabled={isSavingDirect}
                onClick={async () => {
                  setIsSavingDirect(true);
                  try {
                    await onSaveDirect(selSub, editableRecords);
                    setEditedIndices(new Set());
                  } finally {
                    setIsSavingDirect(false);
                  }
                }}
                className="px-2.5 py-0.5 rounded text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Save size={11} />
                <span>{isSavingDirect ? 'Saving...' : 'Save Edits to DB'}</span>
              </button>
            )}
          </div>
        )}

        {/* Minimal-Compact Filter & Search Strip */}
        <div className="px-3.5 py-1.5 bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-48 sm:w-64">
              <input
                type="text"
                placeholder="Search roll, reg, student or father..."
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Quick Filter Pill Toggle */}
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDiffFilter('all')}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                  diffFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All ({records.length})
              </button>
              {diffSummary.changed > 0 && (
                <button
                  type="button"
                  onClick={() => setDiffFilter('changed_only')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all flex items-center gap-1 ${
                    diffFilter === 'changed_only'
                      ? 'bg-amber-500 text-white shadow-2xs font-black'
                      : 'text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-200 animate-ping inline-block" />
                  <span>Only Changed ({diffSummary.changed})</span>
                </button>
              )}
              {diffSummary.absents > 0 && (
                <button
                  type="button"
                  onClick={() => setDiffFilter('absent_only')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    diffFilter === 'absent_only'
                      ? 'bg-rose-500 text-white shadow-2xs font-black'
                      : 'text-rose-600 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/50'
                  }`}
                >
                  Absent ({diffSummary.absents})
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
            {diffSummary.changed > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <Sparkles size={11} /> {diffSummary.changed} student{diffSummary.changed === 1 ? '' : 's'} modified
              </span>
            )}
            <span>
              Showing {filteredRecords.length} of {records.length}
            </span>
          </div>
        </div>

        {/* Dense Minimal-Compact Responsive Table */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 min-h-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-xs text-[10px] uppercase font-bold tracking-wider text-slate-500 sticky top-0 shadow-xs z-10">
              <tr>
                <th className="py-2 px-2 text-center w-8">#</th>
                <th className="py-2 px-2 text-center w-12">Roll</th>
                <th className="py-2 px-2 text-center w-16">Exam Roll</th>
                <th className="py-2 px-2.5 w-36 whitespace-nowrap">Board Reg. No.</th>
                <th className="py-2 px-2.5 min-w-[150px]">Student Name</th>
                <th className="py-2 px-2.5 min-w-[140px]">Father / Parentage</th>
                <th className="py-2 px-2 text-center w-16">Stream</th>
                <th className="py-2 px-2 text-center w-28 whitespace-nowrap">Marks (Prac / Viva)</th>
                <th className="py-2 px-3 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300">
              {filteredRecords.map((r, i) => {
                const v = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase();
                const isAbs = v === (absentMarker || 'AB') || v === 'A' || v === 'ABS';
                
                const cleanReg = getCleanReg(r);
                const cleanExam = getCleanExam(r);
                const rName = getCleanName(r);
                const rFather = getCleanFather(r);
                const rRoll = getCleanClassRoll(r);

                // Cross-reference with database students
                const dbSt = (cleanReg && studentByReg.get(cleanReg)) ||
                             (cleanExam && studentByExam.get(cleanExam)) ||
                             (rRoll && studentByRoll.get(rRoll)) ||
                             (rName && rFather && studentByName.get(`${rName}_${rFather}`)) ||
                             (rName && studentByName.get(rName));

                const studentName = toTitleCase(r.name || r.studentName || (dbSt && (dbSt["Student's Name (as per school records)"] || dbSt["Student's Name"] || dbSt.studentName)) || '—');
                const parent = toTitleCase(r.parentage || r.parentName || r.fatherName || (dbSt && (dbSt["Father's/Guardian's Name (as per school records)"] || dbSt["Father's Name"] || dbSt.fatherName)) || '—');
                const classRoll = rRoll || (dbSt ? getRollNo(dbSt) : '') || '—';
                const examRoll = cleanExam || (dbSt ? (dbSt['Exam R.No. (Current)'] || dbSt.examRollNo) : '') || '—';
                const boardReg = cleanReg || (dbSt ? (dbSt['Board Registration Number'] || dbSt.regNo) : '') || '—';
                const streamVal = r.stream || (dbSt ? (getStudentStreamStr(dbSt, selSub.className || selSub.Class) || dbSt.Stream || dbSt.stream) : '') || '';

                const rowBgClass = r.hasDiff
                  ? 'bg-amber-50/50 dark:bg-amber-950/25 border-l-3 border-l-amber-500'
                  : (isAbs ? 'bg-rose-50/30 dark:bg-rose-950/15' : '');

                return (
                  <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${rowBgClass}`}>
                    <td className="py-1.5 px-2 text-center font-mono text-[10px] text-slate-400">{r.sNo || i + 1}</td>
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{classRoll}</td>
                    <td className="py-1.5 px-2 text-center font-mono text-slate-600 dark:text-slate-400 text-xs">{examRoll}</td>
                    <td className="py-1.5 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap tracking-tight">{boardReg}</td>
                    <td className="py-1.5 px-2.5 font-bold text-slate-900 dark:text-slate-100 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate max-w-[180px]">{studentName}</span>
                        {r.hasDiff && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 shadow-2xs uppercase tracking-tight">
                            Updated
                          </span>
                        )}
                        {r.isNewStudent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                            New
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[160px]">{parent}</td>
                    <td className="py-1.5 px-2 text-center">
                      {streamVal ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {toTitleCase(streamVal)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>

                    {/* Marks (Prac / Viva) with Inline Old vs New Diff or Inline Admin Editing */}
                    <td className="py-1.5 px-2 text-center font-mono text-xs">
                      {isEditMode ? (
                        <div className="inline-flex items-center justify-center gap-1">
                          <input
                            type="text"
                            value={r.practicalMarks ?? ''}
                            placeholder={`0-${subjectMaxMarks}`}
                            onChange={(e) => handleInlineMarkChange(r.originalIndex, 'practicalMarks', e.target.value)}
                            className={`w-14 px-1 py-0.5 rounded border text-center font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500 uppercase ${
                              editedIndices.has(r.originalIndex)
                                ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleInlineMarkChange(r.originalIndex, 'practicalMarks', (r.practicalMarks === 'AB' || r.practicalMarks === 'A') ? '' : 'AB')}
                            className={`px-1 py-0.5 rounded font-mono text-[9.5px] font-black border transition-all cursor-pointer ${
                              (r.practicalMarks === 'AB' || r.practicalMarks === 'A')
                                ? 'bg-rose-500 text-white border-rose-600'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-amber-600'
                            }`}
                            title="Toggle Absent"
                          >
                            AB
                          </button>
                        </div>
                      ) : r.hasDiff && (r.diff.pracChanged || r.diff.vivaChanged) ? (
                        <div className="inline-flex items-center justify-center gap-1.5 leading-tight">
                          <span className="line-through text-slate-400 text-[10px]">
                            {r.diff.oldPrac}{r.diff.oldViva !== '—' ? ` / ${r.diff.oldViva}` : ''}
                          </span>
                          <span className="text-amber-500 font-bold text-[10px]">➔</span>
                          <span className="font-black text-amber-700 dark:text-amber-300 text-xs">
                            {r.practicalMarks ?? '—'}{r.vivaMarks ? ` / ${r.vivaMarks}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span>{r.practicalMarks ?? '—'}{r.vivaMarks ? ` / ${r.vivaMarks}` : ''}</span>
                      )}
                    </td>

                    {/* Total Marks with Inline Old vs New Diff or Live Recalculated Score */}
                    <td className={'py-1.5 px-3 text-right font-black font-mono text-xs ' + (isAbs ? 'text-rose-600' : 'text-emerald-600')}>
                      {isEditMode ? (
                        <span>
                          {r.totalMarks ?? r.practicalMarks ?? '—'}
                        </span>
                      ) : r.hasDiff && r.diff.totalChanged ? (
                        <div className="inline-flex items-center justify-end gap-1.5 leading-tight">
                          <span className="line-through text-slate-400 font-semibold text-[10px]">
                            {r.diff.oldTot}
                          </span>
                          <span className="text-amber-500 font-bold text-[10px]">➔</span>
                          <span className={'font-black ' + (isAbs ? 'text-rose-600' : 'text-emerald-600')}>
                            {r.totalMarks ?? r.practicalMarks ?? '—'}
                          </span>
                        </div>
                      ) : (
                        <span>{r.totalMarks ?? r.practicalMarks ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold text-xs">
                    {diffFilter === 'changed_only'
                      ? 'No marks changes detected vs the active comparison baseline.'
                      : (diffFilter === 'absent_only' ? 'No absent students in this submission.' : 'No records found matching search.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Footer */}
        {(String(selSub?.id || '').startsWith('pending_') || selSub.status === 'pending_approval' || selSub.isPendingApproval) ? (
          <div className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert size={15} className="shrink-0" />
              <span>Pending Administrator Verification & Approval</span>
              {diffSummary.changed > 0 && (
                <span className="hidden sm:inline text-slate-400 text-[11px] font-normal">
                  ({diffSummary.changed} student marks modified in this revision)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end flex-wrap">
              {onSaveDirect && editedIndices.size > 0 && (
                <button
                  type="button"
                  disabled={isSavingDirect}
                  onClick={async () => {
                    setIsSavingDirect(true);
                    try {
                      await onSaveDirect(selSub, editableRecords);
                      setEditedIndices(new Set());
                    } finally {
                      setIsSavingDirect(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <Save size={12} />
                  <span>{isSavingDirect ? 'Saving...' : `Save ${editedIndices.size} Edits`}</span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(selSub.id, selSub)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                  title="Move this submission to the Practicals Recycle Bin"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onReject) onReject(selSub);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 cursor-pointer"
              >
                Request Revision / Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onApprove) {
                    onApprove({
                      ...selSub,
                      records: editableRecords,
                      updatedByAdmin: editedIndices.size > 0 ? true : Boolean(selSub.updatedByAdmin)
                    });
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 size={13} />
                <span>{editedIndices.size > 0 ? `Approve with ${editedIndices.size} Edits & Integrate` : 'Approve & Integrate into DB'}</span>
              </button>
            </div>
          </div>
        ) : (
          editedIndices.size > 0 && onSaveDirect && (
            <div className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                You have {editedIndices.size} unsaved mark edit{editedIndices.size === 1 ? '' : 's'}.
              </span>
              <button
                type="button"
                disabled={isSavingDirect}
                onClick={async () => {
                  setIsSavingDirect(true);
                  try {
                    await onSaveDirect(selSub, editableRecords);
                    setEditedIndices(new Set());
                  } finally {
                    setIsSavingDirect(false);
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <Save size={13} />
                <span>{isSavingDirect ? 'Saving...' : `Save ${editedIndices.size} Edits to Live Database`}</span>
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMBINED FACULTY & SUBMISSIONS VIEW COMPONENT
// ─────────────────────────────────────────────────────────────
function FacultySubmissionsView({
  teachers,
  submissions,
  setSubmissions,
  pendingApprovals = [],
  onApproveSubmission,
  onRejectSubmission,
  sendEmail,
  emailSt,
  handleWhatsAppShare,
  handleEmailShare,
  handleSaveTeacherPhone,
  setSelSub,
  handleDeleteSubmission,
  settings,
  handleExcludeTeacher
}) {
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [phoneInputVal, setPhoneInputVal] = useState('');
  const [savingPhoneId, setSavingPhoneId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('combined'); // 'combined' | 'documents'
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'approved'
  const [expandedFacultyIds, setExpandedFacultyIds] = useState(new Set());

  // Version Bin State
  const [binModalDoc, setBinModalDoc] = useState(null);
  const [binVersions, setBinVersions] = useState([]);
  const [loadingBinVersions, setLoadingBinVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [restoringVersionId, setRestoringVersionId] = useState(null);

  const handleOpenVersionBin = async (docObj) => {
    setBinModalDoc(docObj);
    setLoadingBinVersions(true);
    setPreviewVersion(null);
    try {
      const docId = docObj.canonicalDocId || docObj.id;
      const list = await getVersionsForDoc(docId);
      setBinVersions(list);
    } catch (err) {
      console.warn('Failed to load versions from bin:', err);
      setBinVersions([]);
    } finally {
      setLoadingBinVersions(false);
    }
  };

  const handleRestoreVersion = async (versionObj) => {
    if (!binModalDoc || !versionObj) return;
    const docId = binModalDoc.canonicalDocId || binModalDoc.id;
    if (!window.confirm(`Restore award version from ${new Date(versionObj.createdAt).toLocaleString()} (${versionObj.recordsCount || 0} students)? The current active record will be automatically backed up into the bin before restoring.`)) {
      return;
    }
    setRestoringVersionId(versionObj.id);
    try {
      const restored = await restoreVersionFromBin(versionObj.id, docId, {
        name: auth.currentUser?.displayName || 'Administrator',
        email: auth.currentUser?.email
      });
      if (setSubmissions) {
        setSubmissions(prev => {
          const filtered = prev.filter(s => s.id !== docId);
          return [restored, ...filtered];
        });
      }
      setBinModalDoc(null);
      showToast('Award Roll successfully restored from bin into live database!', 'success');
    } catch (err) {
      console.error('Failed to restore version:', err);
      showToast(err.message || 'Restoration failed.', 'error');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const excludedSet = useMemo(() => {
    const list = Array.isArray(settings?.excludedTeacherEmails) ? settings.excludedTeacherEmails : DEFAULT_EXCLUDED_TEACHERS;
    return new Set(list.map(e => String(e).toLowerCase().trim()));
  }, [settings?.excludedTeacherEmails]);

  // Unified list of all submissions: approved canonical awards + pending approval queue
  const allDocs = useMemo(() => {
    const pendingWithMeta = (pendingApprovals || []).map(p => ({
      ...p,
      isPending: true,
      statusBadge: p.status === 'rejected' ? 'rejected' : 'pending_approval'
    }));
    const approvedWithMeta = (submissions || []).map(s => ({
      ...s,
      isPending: false,
      statusBadge: 'approved'
    }));
    return [...pendingWithMeta, ...approvedWithMeta];
  }, [submissions, pendingApprovals]);

  // Robust matching helper to associate submissions with teachers by Email OR normalized Name
  const normalizeCleanName = useCallback((val) => {
    return String(val || '')
      .toLowerCase()
      .replace(/^(dr|mr|mrs|ms|prof|dr\.|mr\.|mrs\.|ms\.|prof\.)\s+/i, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const isDocMatchingTeacher = useCallback((docItem, t) => {
    if (!docItem || !t) return false;
    let dEmail = String(docItem.teacherEmail || docItem.submittedByEmail || docItem.Email || docItem.email || '').toLowerCase().trim();
    if (dEmail.includes('e.educational')) {
      dEmail = 'socialshiftz@gmail.com';
    }
    const tEmail = String(t.email || t.id || '').toLowerCase().trim();
    if (tEmail.includes('e.educational')) return false; // Pure admin account never claims teacher docs

    if (dEmail && tEmail && dEmail === tEmail) return true;

    const dName = normalizeCleanName(docItem.teacherName || docItem.submittedByName || docItem.submittedBy || docItem['Teacher Name'] || docItem.author);
    const tName = normalizeCleanName(t.name || t.displayName);
    if (dName && tName) {
      if (dName === tName) return true;
      if (dName.length >= 4 && tName.length >= 4) {
        if (dName.includes(tName) || tName.includes(dName)) return true;
      }
    }
    return false;
  }, [normalizeCleanName]);

  // Filter and unify faculty members with their submissions (including pending approvals)
  const facultyMembers = useMemo(() => {
    const mapByTeacher = new Map();
    const matchedDocIds = new Set();

    teachers.forEach(t => {
      const tEmail = String(t.email || '').toLowerCase().trim();
      if (excludedSet.has(tEmail) || tEmail.includes('e.educational')) return;

      const r = String(t.role || '').toLowerCase().trim();
      const isPureAdmin = (r === 'admin' || r === 'administrator' || r === 'principal' || r === 'superadmin');

      const teacherSubs = allDocs.filter(d => {
        if (isDocMatchingTeacher(d, t)) {
          matchedDocIds.add(d.id);
          return true;
        }
        return false;
      });

      // Exclude pure admin accounts that do not have any practical submissions
      if (isPureAdmin && teacherSubs.length === 0) return;

      const key = tEmail || `teacher_${t.name || t.displayName || Math.random()}`;
      mapByTeacher.set(key, {
        ...t,
        id: t.id || key,
        role: isPureAdmin ? 'Examiner' : (t.role || 'Teacher'),
        submissionsList: teacherSubs,
        pendingCount: teacherSubs.filter(s => s.isPending).length,
        approvedCount: teacherSubs.filter(s => !s.isPending).length
      });
    });

    // Also include any teacher or evaluator from submissions who wasn't in teachers
    allDocs.forEach(d => {
      if (matchedDocIds.has(d.id)) return;
      let dEmail = String(d.teacherEmail || d.submittedByEmail || d.Email || d.email || '').toLowerCase().trim();
      if (dEmail.includes('e.educational')) dEmail = 'socialshiftz@gmail.com';
      if (dEmail && (excludedSet.has(dEmail) || dEmail.includes('e.educational'))) return;

      const sName = d.teacherName || d.submittedByName || d.submittedBy || d['Teacher Name'] || 'Other Evaluator';
      const key = dEmail || `evaluator_${sName.toLowerCase().replace(/\s+/g, '_')}`;

      if (!mapByTeacher.has(key)) {
        mapByTeacher.set(key, {
          id: key,
          email: dEmail || '—',
          name: sName,
          displayName: sName,
          role: 'Teacher / Evaluator',
          submissionsList: [d],
          pendingCount: d.isPending ? 1 : 0,
          approvedCount: d.isPending ? 0 : 1,
          isExternalEvaluator: true
        });
      } else {
        const prev = mapByTeacher.get(key);
        if (!prev.submissionsList.some(x => x.id === d.id)) {
          prev.submissionsList.push(d);
          if (d.isPending) prev.pendingCount = (prev.pendingCount || 0) + 1;
          else prev.approvedCount = (prev.approvedCount || 0) + 1;
        }
      }
    });

    let list = Array.from(mapByTeacher.values());

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => {
        const name = String(t.name || t.displayName || '').toLowerCase();
        const email = String(t.email || '').toLowerCase();
        const phone = String(t.phone || t.mobile || t.phoneNumber || t.whatsapp || '');
        const role = String(t.role || '').toLowerCase();
        const subsMatch = (t.submissionsList || []).some(s => {
          const subj = String(s.subjectName || s.subjectCode || s.subject || s.Subject || '').toLowerCase();
          const cls = String(s.className || s.Class || '').toLowerCase();
          const id = String(s.id || '').toLowerCase();
          return subj.includes(q) || cls.includes(q) || id.includes(q);
        });
        return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q) || subsMatch;
      });
    }

    // Class filter
    if (filterClass !== 'all') {
      list = list.filter(t => {
        return (t.submissionsList || []).some(s => {
          const cls = String(s.className || s.Class || s.id || '').toLowerCase();
          return cls.includes(filterClass.toLowerCase());
        });
      });
    }

    // Subject filter
    if (filterSubject !== 'all') {
      list = list.filter(t => {
        return (t.submissionsList || []).some(s => {
          const subj = String(s.subjectCode || s.subject || s.Subject || s.subjectName || s.id || '').toUpperCase();
          return isMatchingSubjectCode(subj, filterSubject);
        });
      });
    }

    // Status filter
    if (filterStatus === 'pending') {
      list = list.filter(t => (t.pendingCount || 0) > 0);
    } else if (filterStatus === 'approved') {
      list = list.filter(t => (t.approvedCount || 0) > 0);
    }

    // Sort: teachers with pending submissions first, then by submissions count descending, then by name
    list.sort((a, b) => {
      const aPend = a.pendingCount || 0;
      const bPend = b.pendingCount || 0;
      if (aPend !== bPend) return bPend - aPend;
      const aSubs = (a.submissionsList || []).length;
      const bSubs = (b.submissionsList || []).length;
      if (aSubs !== bSubs) return bSubs - aSubs;
      return String(a.name || a.displayName || '').localeCompare(String(b.name || b.displayName || ''));
    });

    return list;
  }, [teachers, allDocs, searchQuery, excludedSet, isDocMatchingTeacher, filterClass, filterSubject, filterStatus]);

  // Master Document Audit Log list (now includes BOTH approved and pending documents!)
  const filteredDocs = useMemo(() => {
    return allDocs.filter(s => {
      const cls = String(s.className || s.Class || s.id || '').toLowerCase();
      const subj = String(s.subjectName || s.Subject || s.subjectCode || s.subject || s.id || '').toUpperCase();
      if (filterClass !== 'all' && !cls.includes(filterClass.toLowerCase())) return false;
      if (filterSubject !== 'all' && !isMatchingSubjectCode(subj, filterSubject)) return false;
      if (filterStatus === 'pending' && !s.isPending) return false;
      if (filterStatus === 'approved' && s.isPending) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const id = String(s.id || '').toLowerCase();
        const teacher = String(s.teacherName || s.submittedByName || s.submittedBy || s['Teacher Name'] || s.teacherEmail || '').toLowerCase();
        return id.includes(q) || teacher.includes(q) || subj.toLowerCase().includes(q) || cls.includes(q);
      }
      return true;
    });
  }, [allDocs, filterClass, filterSubject, filterStatus, searchQuery]);

  const toggleExpandFaculty = (id) => {
    setExpandedFacultyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedFacultyIds.size === facultyMembers.length) {
      setExpandedFacultyIds(new Set());
    } else {
      setExpandedFacultyIds(new Set(facultyMembers.map(f => f.id)));
    }
  };

  const startEditPhone = (t) => {
    setEditingPhoneId(t.id || t.email);
    const existing = t.phone || t.mobile || t.phoneNumber || t.whatsapp || '';
    setPhoneInputVal(existing);
  };

  const cancelEditPhone = () => {
    setEditingPhoneId(null);
    setPhoneInputVal('');
  };

  const savePhone = async (t) => {
    setSavingPhoneId(t.id || t.email);
    const ok = await handleSaveTeacherPhone(t, phoneInputVal);
    setSavingPhoneId(null);
    if (ok !== false) {
      setEditingPhoneId(null);
      setPhoneInputVal('');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-3 sm:p-4 space-y-4">
      {/* PENDING AWARD APPROVALS TRAY */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 sm:p-4 space-y-3 shadow-xs animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-800/60 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                  Pending Award Approvals ({pendingApprovals.length})
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-amber-500 text-white animate-pulse">
                    Action Required
                  </span>
                </h4>
                <p className="text-[11px] font-semibold text-amber-800/80 dark:text-amber-300/80">
                  Submissions requiring admin verification due to cross-subject submissions or award list revisions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingApprovals.map((pendingDoc) => {
              const isRejected = pendingDoc.status === 'rejected';
              return (
                <div
                  key={pendingDoc.id}
                  className={`p-3 rounded-xl border bg-white dark:bg-slate-900 flex flex-col justify-between gap-2.5 shadow-xs ${
                    isRejected
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30'
                      : 'border-amber-200 dark:border-amber-800/70 hover:border-amber-400 transition-colors'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                        {pendingDoc.subject} • {formatClassDisplay(pendingDoc.className, pendingDoc)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {pendingDoc.isCrossSubject && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            Cross-Subject
                          </span>
                        )}
                        {pendingDoc.isOverwrite && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                            Overwrite
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div>
                        Submitted by: <strong className="text-slate-900 dark:text-white">{pendingDoc.submittedBy || pendingDoc.submittedByName || 'Faculty'}</strong>
                      </div>
                      {pendingDoc.teacherRegisteredSubject && pendingDoc.isCrossSubject && (
                        <div className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">
                          Assigned Subject: <strong>{pendingDoc.teacherRegisteredSubject}</strong>
                        </div>
                      )}
                      <div className="text-[10.5px] text-slate-400 flex items-center gap-2">
                        <span>{pendingDoc.records?.length || 0} Students</span>
                        <span>•</span>
                        <span>{pendingDoc.submittedAt ? new Date(pendingDoc.submittedAt).toLocaleDateString() : 'Recent'}</span>
                      </div>
                    </div>

                    {isRejected && (
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[10px] text-rose-700 dark:text-rose-300 font-bold">
                        Revision Requested: {pendingDoc.rejectionReason || 'Under review'}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelSub(pendingDoc)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1"
                    >
                      <Eye size={12} /> Inspect
                    </button>
                    <div className="flex items-center gap-1">
                      {handleDeleteSubmission && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSubmission(pendingDoc.id, pendingDoc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRejectSubmission && onRejectSubmission(pendingDoc)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 cursor-pointer"
                        title="Request revision or reject"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => onApproveSubmission && onApproveSubmission(pendingDoc)}
                        className="px-3 py-1 rounded-lg text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                        title="Integrate into official database"
                      >
                        <CheckCircle2 size={12} /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STAT SUMMARY BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-2xs border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1.5 whitespace-nowrap">
            <Users size={13} /> {facultyMembers.length} Evaluators
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 text-xs font-black text-slate-700 dark:text-slate-300 shadow-2xs border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 whitespace-nowrap">
            <FileSpreadsheet size={13} className="text-emerald-500" /> {allDocs.length} <span className="hidden sm:inline">Total </span>Docs
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 whitespace-nowrap">
            <CheckCircle2 size={13} /> {submissions.length} Approved & Live
          </span>
          {pendingApprovals.length > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5 animate-pulse whitespace-nowrap">
              <AlertTriangle size={13} /> {pendingApprovals.length} Pending Approval
            </span>
          )}
        </div>

        {viewMode === 'combined' && facultyMembers.length > 0 && (
          <button
            type="button"
            onClick={toggleExpandAll}
            className="w-full sm:w-auto px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 text-xs font-bold cursor-pointer flex items-center justify-center sm:justify-start gap-1 transition-all shadow-2xs shrink-0 whitespace-nowrap"
          >
            {expandedFacultyIds.size === facultyMembers.length ? (
              <>
                <ChevronUp size={13} /> Collapse All Drawers
              </>
            ) : (
              <>
                <ChevronDown size={13} /> Expand All Drawers ({facultyMembers.length})
              </>
            )}
          </button>
        )}
      </div>

      {/* TOOLBAR CONTROLS: VIEW MODE, FILTERS & SEARCH */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        {/* View Mode Segmented Pill */}
        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('combined')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              viewMode === 'combined'
                ? 'bg-indigo-600 text-white shadow-2xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users size={13} className="shrink-0" />
            <span className="hidden sm:inline">Combined Faculty Roster</span>
            <span className="sm:hidden">Faculty Roster</span>
            <span>({facultyMembers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('documents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              viewMode === 'documents'
                ? 'bg-indigo-600 text-white shadow-2xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText size={13} className="shrink-0" />
            <span className="hidden sm:inline">Master Document Audit</span>
            <span className="sm:hidden">Document Audit</span>
            <span>({allDocs.length})</span>
          </button>
        </div>

        {/* Filters Tray: Class, Subject, Status & Search */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            <option value="all">All Classes</option>
            <option value="10th">Class 10th</option>
            <option value="11th">Class 11th</option>
            <option value="12th">Class 12th</option>
          </select>

          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs max-w-none sm:max-w-[160px] truncate"
          >
            <option value="all">All Subjects</option>
            {CODES.map(c => <option key={c} value={c}>{getSubjectDisplayName(c, filterClass)} ({c})</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Approval Only</option>
            <option value="approved">Approved Only</option>
          </select>

          <div className="relative col-span-2 sm:w-56 w-full">
            <input
              type="text"
              placeholder="Search faculty, subject, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: COMBINED FACULTY ROSTER (WITH EXPANDABLE DOCUMENT AUDIT DRAWER PER TEACHER) */}
      {viewMode === 'combined' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
          <table className="w-full min-w-[960px] text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
              <tr>
                <th className="py-2.5 px-3 text-center w-10 whitespace-nowrap">#</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Faculty / Evaluator</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Mobile / WhatsApp</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Role</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Practical Submissions (Internal & External)</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Audit Drawer</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
              {facultyMembers.map((t, idx) => {
                const phone = String(t.phone || t.mobile || t.phoneNumber || t.whatsapp || '').trim();
                const isEditingThis = editingPhoneId === (t.id || t.email);
                const isExpanded = expandedFacultyIds.has(t.id);

                // Group this teacher's submissions by (Class + Subject)
                const groupedMap = {};
                (t.submissionsList || []).forEach(s => {
                  const sCls = formatClassDisplay(s.className || s.Class || (String(s.id).startsWith('12') ? '12th' : '11th'), s);
                  const sCode = String(s.subjectCode || s.subject || s.Subject || 'SUB').toUpperCase();
                  const sName = s.subjectName || s.Subject || getSubjectDisplayName(sCode, sCls) || sCode;
                  const key = `${sCls}_${sCode}`;
                  if (!groupedMap[key]) {
                    groupedMap[key] = { cls: sCls, code: sCode, name: sName, internal: null, external: null, all: [] };
                  }
                  const pType = String(s.practicalType || s.PracticalType || '').toLowerCase();
                  if (pType.includes('ext')) {
                    groupedMap[key].external = s;
                  } else {
                    groupedMap[key].internal = s;
                  }
                  groupedMap[key].all.push(s);
                });
                const subjectGroups = Object.values(groupedMap);

                return (
                  <React.Fragment key={`tch_${t.id || t.email || idx}_${idx}`}>
                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${t.pendingCount > 0 ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''}`}>
                      <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
                              <span>{toTitleCase(t.name || t.displayName || 'Faculty Member')}</span>
                              {t.pendingCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-extrabold uppercase animate-pulse">
                                  {t.pendingCount} Pending
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-500 text-[10.5px]">
                              {t.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="tel"
                              maxLength={10}
                              placeholder="10-digit mobile"
                              value={phoneInputVal}
                              onChange={e => setPhoneInputVal(e.target.value.replace(/\D/g, ''))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') savePhone(t);
                                if (e.key === 'Escape') cancelEditPhone();
                              }}
                              autoFocus
                              className="w-28 px-2 py-0.5 rounded-lg border border-indigo-400 bg-white dark:bg-slate-950 font-mono text-xs font-bold outline-none shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() => savePhone(t)}
                              disabled={savingPhoneId === (t.id || t.email)}
                              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-2xs"
                              title="Save mobile to Firebase"
                            >
                              <Check size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditPhone}
                              className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-600 cursor-pointer"
                              title="Cancel"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {phone ? (
                              <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1">
                                <span className="text-slate-400 text-[10px]">+91</span> {phone}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No mobile</span>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditPhone(t)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit & Save mobile to Firebase"
                            >
                              <Edit2 size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase whitespace-nowrap inline-block">
                          {t.role || 'Teacher'}
                        </span>
                      </td>

                      {/* Practical Submissions Summary Badges */}
                      <td className="py-3 px-3">
                        {subjectGroups.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {subjectGroups.map((g, gIdx) => {
                              const intCount = g.internal ? (Array.isArray(g.internal.records) ? g.internal.records.length : Object.keys(g.internal).filter(k => k.match(/^\d+\//)).length) : 0;
                              const extCount = g.external ? (Array.isArray(g.external.records) ? g.external.records.length : Object.keys(g.external).filter(k => k.match(/^\d+\//)).length) : 0;
                              const isIntPending = g.internal?.isPending;
                              const isExtPending = g.external?.isPending;
                              const cleanName = String(g.name || '').replace(new RegExp(`\\s*\\(${g.code}\\)`, 'gi'), '').trim();

                              return (
                                <div key={gIdx} className="flex items-center gap-2 flex-wrap bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                                  <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                    {g.cls} • {cleanName || g.name} ({g.code}):
                                  </span>

                                  {/* Internal Submission Badge */}
                                  {g.internal ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        onClick={() => setSelSub(g.internal)}
                                        className={`px-2.5 py-0.5 rounded-lg font-mono font-bold text-[11px] cursor-pointer border inline-flex items-center gap-1 shadow-2xs ${
                                          isIntPending
                                            ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                        }`}
                                        title={isIntPending ? 'Pending Approval — Click to Inspect' : 'Inspect Internal Practical Awards'}
                                      >
                                        <Eye size={10} /> {isIntPending ? '⚡ Pending: ' : ''}Internal ({intCount})
                                      </button>
                                      <button
                                        onClick={() => handleOpenVersionBin(g.internal)}
                                        className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Inspect Historical Versions in Bin"
                                      >
                                        <History size={10} />
                                      </button>
                                      {isIntPending && onApproveSubmission && (
                                        <button
                                          onClick={() => onApproveSubmission(g.internal)}
                                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                                          title="Approve this submission"
                                        >
                                          <CheckCircle2 size={11} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteSubmission(g.internal.id, g.internal)}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Move to Recycle Bin"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">No Internal</span>
                                  )}

                                  <span className="text-slate-300 dark:text-slate-700">•</span>

                                  {/* External Submission Badge */}
                                  {g.external ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        onClick={() => setSelSub(g.external)}
                                        className={`px-2.5 py-0.5 rounded-lg font-mono font-bold text-[11px] cursor-pointer border inline-flex items-center gap-1 shadow-2xs ${
                                          isExtPending
                                            ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                        }`}
                                        title={isExtPending ? 'Pending Approval — Click to Inspect' : 'Inspect External Practical Awards'}
                                      >
                                        <Eye size={10} /> {isExtPending ? '⚡ Pending: ' : ''}External ({extCount})
                                      </button>
                                      <button
                                        onClick={() => handleOpenVersionBin(g.external)}
                                        className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Inspect Historical Versions in Bin"
                                      >
                                        <History size={10} />
                                      </button>
                                      {isExtPending && onApproveSubmission && (
                                        <button
                                          onClick={() => onApproveSubmission(g.external)}
                                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                                          title="Approve this submission"
                                        >
                                          <CheckCircle2 size={11} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteSubmission(g.external.id, g.external)}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Move to Recycle Bin"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">No External</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="font-mono text-slate-400 text-[11px] italic">0 submissions (Pending)</span>
                        )}
                      </td>

                      {/* Expandable Audit Drawer Toggle */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleExpandFaculty(t.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 border transition-all ${
                            isExpanded
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                          title="Expand/Collapse Document Audit Drawer for this teacher"
                        >
                          <FileText size={11} />
                          <span>{t.submissionsList.length} docs</span>
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </td>

                      {/* Teacher Actions: Email, WhatsApp, Exclude */}
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleEmailShare(t)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="Send email notice"
                        >
                          <Mail size={11} /> Email
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(t)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-all ${
                            phone
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                          title={phone ? `Open WhatsApp chat with ${phone}` : 'Add mobile and open WhatsApp'}
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                        <button
                          onClick={() => handleExcludeTeacher && handleExcludeTeacher(t)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Remove/Hide from Practicals Portal"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDABLE INLINE DOCUMENT AUDIT DRAWER FOR THIS FACULTY MEMBER */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-900/60">
                        <td colSpan={7} className="p-3 sm:p-4 border-b border-indigo-100 dark:border-indigo-950/60">
                          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 space-y-3 shadow-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                <FileSpreadsheet size={13} className="text-indigo-500" />
                                Submissions by {toTitleCase(t.name || t.displayName)} ({t.submissionsList.length} total)
                              </span>
                              <span className="text-[10.5px] font-semibold text-slate-400">
                                {t.approvedCount || 0} Live Integrated • {t.pendingCount || 0} Pending
                              </span>
                            </div>

                            {t.submissionsList.length === 0 ? (
                              <div className="py-4 text-center text-slate-400 text-xs italic">
                                No practical submissions recorded for this faculty member yet.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                                <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[9.5px] uppercase font-black text-slate-400">
                                      <th className="py-2 px-2.5 whitespace-nowrap">Document ID</th>
                                      <th className="py-2 px-2.5 whitespace-nowrap">Class & Subject</th>
                                      <th className="py-2 px-2.5 whitespace-nowrap">Session & Type</th>
                                      <th className="py-2 px-2.5 text-center whitespace-nowrap">Records</th>
                                      <th className="py-2 px-2.5 text-center whitespace-nowrap">Status</th>
                                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                                    {t.submissionsList.map((doc, dIdx) => {
                                      const recCount = Array.isArray(doc.records) ? doc.records.length : Object.keys(doc).filter(k => k.match(/^\d+\//)).length;
                                      const sessStr = normalizePracticalSession(doc.sessionText || doc.session || doc.Session || doc.yearSuffix || '2025-26');
                                      return (
                                        <tr key={`doc_${doc.id}_${dIdx}`} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${doc.isPending ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}>
                                          <td className="py-2 px-2.5 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 max-w-[160px] truncate" title={doc.id}>{doc.id}</td>
                                          <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                            {formatClassDisplay(doc.className || doc.Class, doc)} • {doc.subjectName || doc.Subject || getSubjectDisplayName(doc.subjectCode, doc.className || doc.Class) || doc.subjectCode}
                                          </td>
                                          <td className="py-2 px-2.5 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap inline-block">
                                              {sessStr} • {toTitleCase(doc.practicalType || 'Internal')}
                                            </span>
                                          </td>
                                          <td className="py-2 px-2.5 text-center font-mono font-bold text-emerald-600 whitespace-nowrap">{recCount}</td>
                                          <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                            {doc.isPending ? (
                                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9.5px] font-black uppercase tracking-wider animate-pulse whitespace-nowrap inline-block">
                                                Pending Approval
                                              </span>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap inline-block">
                                                Approved
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-2.5 text-right space-x-1.5 whitespace-nowrap">
                                            <button
                                              onClick={() => setSelSub(doc)}
                                              className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10.5px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                            >
                                              <Eye size={11} /> View Awards
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenVersionBin(doc)}
                                              className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10.5px] font-bold cursor-pointer inline-flex items-center gap-1 border border-amber-200 dark:border-amber-800 shadow-2xs"
                                              title="View previous versions in Bin"
                                            >
                                              <History size={11} /> Bin
                                            </button>
                                            {doc.isPending && onApproveSubmission && (
                                              <button
                                                type="button"
                                                onClick={() => onApproveSubmission(doc)}
                                                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-black cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                                title="Approve & integrate into live database"
                                              >
                                                <CheckCircle2 size={11} /> Approve
                                              </button>
                                            )}
                                            {doc.isPending && onRejectSubmission && (
                                              <button
                                                type="button"
                                                onClick={() => onRejectSubmission(doc)}
                                                className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10.5px] font-bold cursor-pointer inline-flex items-center gap-1 border border-rose-200 dark:border-rose-900 shadow-2xs"
                                                title="Request revision"
                                              >
                                                Reject
                                              </button>
                                            )}
                                            <button
                                              onClick={() => handleDeleteSubmission(doc.id, doc)}
                                              className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10.5px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                              title="Move to Practicals Recycle Bin"
                                            >
                                              <Trash2 size={11} /> Delete
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {facultyMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                    No faculty members found matching selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: MASTER DOCUMENT AUDIT LOG (ALL SUBMISSIONS INCLUDING PENDING) */}
      {viewMode === 'documents' && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
            <table className="w-full min-w-[960px] text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10 whitespace-nowrap">#</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Document ID / Title</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Class & Subject</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Session & Type</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Submitted By</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Records</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                {filteredDocs.map((s, idx) => {
                  const recCount = Array.isArray(s.records) ? s.records.length : Object.keys(s).filter(k => k.match(/^\d+\//)).length;
                  const sessStr = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '2025-26');
                  return (
                    <tr
                      key={`pract_row_${s.id || idx}_${idx}`}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        s.isPending ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px] whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 max-w-[220px] truncate" title={s.id}>{s.id}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatClassDisplay(s.className || s.Class, s)} • {s.subjectName || s.Subject || getSubjectDisplayName(s.subjectCode, s.className || s.Class) || s.subjectCode || 'Subject'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap inline-block">
                          {sessStr} • {toTitleCase(s.practicalType || 'Internal')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{s.teacherName || s.submittedByName || s.submittedBy || s['Teacher Name'] || 'Teacher'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{s.teacherEmail || s.submittedByEmail || s.Email || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 whitespace-nowrap">{recCount}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {s.isPending ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9.5px] font-black uppercase tracking-wider animate-pulse whitespace-nowrap inline-block">
                            Pending Approval
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap inline-block">
                            Approved
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setSelSub(s)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye size={12} /> View Awards
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenVersionBin(s)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 border border-amber-200 dark:border-amber-800 shadow-2xs"
                          title="View previous versions in Bin"
                        >
                          <History size={12} /> Bin
                        </button>
                        {s.isPending && onApproveSubmission && (
                          <button
                            type="button"
                            onClick={() => onApproveSubmission(s)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Approve & integrate into live database"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                        {s.isPending && onRejectSubmission && (
                          <button
                            type="button"
                            onClick={() => onRejectSubmission(s)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 border border-rose-200 dark:border-rose-900 shadow-2xs"
                            title="Request revision"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSubmission(s.id, s)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="Move to Practicals Recycle Bin"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                      No submissions found matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* VERSION BIN MODAL (LAST 3 VERSIONS) */}
      {binModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="text-amber-500" size={20} />
                    Version Bin & History
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-black text-[11px] border border-amber-200 dark:border-amber-800">
                    Last 3 Versions
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {binModalDoc.subject || binModalDoc.Subject} • Class {formatClassDisplay(binModalDoc.className || binModalDoc.Class, binModalDoc)} ({binModalDoc.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setBinModalDoc(null); setPreviewVersion(null); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingBinVersions ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-amber-500" />
                  <span className="text-xs font-bold">Loading archived versions from bin...</span>
                </div>
              ) : binVersions.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
                    <History size={24} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Prior Versions in Bin</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Whenever a faculty member re-submits marks or an overwrite is approved for this award roll, up to the last 3 versions will be automatically preserved here for disaster recovery.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500">
                    If an update or submission overwrote marks incorrectly, you can take out (restore) any of the prior versions below back into the live portal:
                  </p>
                  {binVersions.map((v, vIdx) => {
                    const isPreviewingThis = previewVersion?.id === v.id;
                    const isRestoring = restoringVersionId === v.id;
                    return (
                      <div
                        key={v.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono font-black text-[10.5px]">
                                Version #{binVersions.length - vIdx}
                              </span>
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {new Date(v.createdAt).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} at {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                              <span>Archived by: <strong className="text-slate-700 dark:text-slate-300">{v.archivedBy || 'Faculty'}</strong></span>
                              <span>•</span>
                              <span className="font-mono font-bold text-emerald-600">{v.recordsCount || v.records?.length || 0} Students</span>
                              {v.archivedReason && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400 capitalize">{String(v.archivedReason).replace(/_/g, ' ')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewVersion(isPreviewingThis ? null : v)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Eye size={12} /> {isPreviewingThis ? 'Hide Records' : 'Preview Records'}
                            </button>
                            <button
                              type="button"
                              disabled={isRestoring}
                              onClick={() => handleRestoreVersion(v)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-98 disabled:opacity-50"
                            >
                              {isRestoring ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                              <span>Restore Version</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Student Records Preview */}
                        {isPreviewingThis && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 animate-in fade-in duration-150">
                            <div className="p-2 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              <span>Showing {v.records?.length || 0} student marks in this version</span>
                              <span>Max: {v.maxMarks || 50}M</span>
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                  <tr>
                                    <th className="p-2 text-center w-8">#</th>
                                    <th className="p-2">Roll</th>
                                    <th className="p-2">Student Name</th>
                                    <th className="p-2 text-center">Marks</th>
                                    <th className="p-2 text-center">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-[11px]">
                                  {(v.records || []).map((r, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                      <td className="p-2 text-center font-mono text-slate-400">{rIdx + 1}</td>
                                      <td className="p-2 font-mono font-bold text-indigo-600">{r.rollNo || r.classRollNo || '—'}</td>
                                      <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{r.name || r.studentName || '—'}</td>
                                      <td className="p-2 text-center font-mono">{r.practicalMarks ?? '—'}</td>
                                      <td className="p-2 text-center font-mono font-bold text-emerald-600">{r.totalMarks ?? r.practicalMarks ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Safe Recovery: Restoring automatically archives the current state as a new safety version.
              </span>
              <button
                type="button"
                onClick={() => { setBinModalDoc(null); setPreviewVersion(null); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CUSTOM EXECUTIVE CONFIRMATION MODAL POPUP
// ─────────────────────────────────────────────────────────────
function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  badgeText,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmBtnStyle = 'indigo', // 'danger' | 'success' | 'indigo'
  icon: Icon = AlertCircle,
  children,
  loading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0"
        onClick={loading ? undefined : onClose}
      />
      <div 
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-5 sm:p-6 text-left transform animate-in zoom-in-95 duration-200"
      >
        {/* Decorative Top Gradient Accent */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
          confirmBtnStyle === 'danger'
            ? 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-600'
            : confirmBtnStyle === 'success'
            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600'
            : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600'
        }`} />

        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
            confirmBtnStyle === 'danger'
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
              : confirmBtnStyle === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60'
          }`}>
            <Icon size={24} strokeWidth={2.3} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {title}
              </h3>
              {badgeText && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {badgeText}
                </span>
              )}
            </div>

            {subtitle && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {children && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            {children}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-black text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              confirmBtnStyle === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                : confirmBtnStyle === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
            }`}
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUBJECT MARKS & EVALUATION CRITERIA SETTINGS CARD
// ─────────────────────────────────────────────────────────────
function SubjectMarksSettingsCard({ settings, setSettings, saveSettingsDoc, saving }) {
  const [activeClassTab, setActiveClassTab] = useState('11th');
  const [activeTypeTab, setActiveTypeTab] = useState('internal');
  const [searchQuery, setSearchQuery] = useState('');
  const [streamFilter, setStreamFilter] = useState('all');
  const [marksSaved, setMarksSaved] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const evalMarksConfig = settings.evaluationMarksConfig || DEFAULT_PRACTICAL_MARKS_CONFIG;
  const currentClassConfig = evalMarksConfig[activeClassTab] || DEFAULT_PRACTICAL_MARKS_CONFIG[activeClassTab];
  const currentTypeConfig = currentClassConfig[activeTypeTab] || DEFAULT_PRACTICAL_MARKS_CONFIG[activeClassTab][activeTypeTab];

  const handleUpdateMarks = (code, field, val) => {
    const rawVal = typeof val === 'string' ? val.trim() : String(val);
    const num = rawVal === '' ? '' : parseInt(rawVal, 10);

    setSettings(prev => {
      const cfg = JSON.parse(JSON.stringify(prev.evaluationMarksConfig || DEFAULT_PRACTICAL_MARKS_CONFIG));
      if (!cfg[activeClassTab]) cfg[activeClassTab] = {};
      if (!cfg[activeClassTab][activeTypeTab]) cfg[activeClassTab][activeTypeTab] = {};

      const defaultSub = DEFAULT_PRACTICAL_MARKS_CONFIG[activeClassTab]?.[activeTypeTab]?.[code] || { max: 20, min: 7 };
      const currentSub = { ...(cfg[activeClassTab][activeTypeTab][code] || defaultSub) };

      if (field === 'max') {
        const newMax = num === '' ? '' : Math.max(1, isNaN(num) ? 0 : num);
        currentSub.max = newMax;
        if (typeof newMax === 'number' && newMax > 0) {
          if (!currentSub.min || currentSub.min > newMax) {
            currentSub.min = Math.ceil(0.36 * newMax);
          }
        }
      } else if (field === 'min') {
        currentSub.min = num === '' ? '' : Math.max(0, isNaN(num) ? 0 : num);
      }

      cfg[activeClassTab][activeTypeTab][code] = currentSub;

      // Keep legacy maps in sync
      const legacyMax10 = { ...(prev.maxMarks10 || DEFAULT_MX10) };
      const legacyMax11 = { ...(prev.maxMarks11 || DEFAULT_MX11) };
      const legacyMax12 = { ...(prev.maxMarks12 || DEFAULT_MX12) };
      if (activeClassTab === '10th' && activeTypeTab === 'internal' && typeof currentSub.max === 'number') {
        legacyMax10[code] = currentSub.max;
      }
      if (activeClassTab === '11th' && activeTypeTab === 'internal' && typeof currentSub.max === 'number') {
        legacyMax11[code] = currentSub.max;
      }
      if (activeClassTab === '12th' && activeTypeTab === 'internal' && typeof currentSub.max === 'number') {
        legacyMax12[code] = currentSub.max;
      }

      return {
        ...prev,
        evaluationMarksConfig: cfg,
        maxMarks10: legacyMax10,
        maxMarks11: legacyMax11,
        maxMarks12: legacyMax12
      };
    });
  };

  const adjustMarks = (code, field, delta) => {
    const defaultSub = DEFAULT_PRACTICAL_MARKS_CONFIG[activeClassTab]?.[activeTypeTab]?.[code] || { max: 20, min: 7 };
    const currentSub = currentTypeConfig?.[code] || defaultSub;
    const currentVal = Number(currentSub[field] ?? (field === 'max' ? defaultSub.max : defaultSub.min));
    const nextVal = Math.max(field === 'min' ? 0 : 1, currentVal + delta);
    handleUpdateMarks(code, field, nextVal);
  };

  const handleSaveMarks = async () => {
    const ok = await saveSettingsDoc('Subject Marks Configuration', settings);
    if (ok) {
      setMarksSaved(true);
      setTimeout(() => setMarksSaved(false), 3000);
    }
  };

  const handleConfirmResetDefaults = async () => {
    setIsResetModalOpen(false);
    const defaultCfg = JSON.parse(JSON.stringify(DEFAULT_PRACTICAL_MARKS_CONFIG));
    const updatedSettings = {
      ...settings,
      evaluationMarksConfig: defaultCfg,
      maxMarks10: { ...DEFAULT_MX10 },
      maxMarks11: { ...DEFAULT_MX11 },
      maxMarks12: { ...DEFAULT_MX12 }
    };
    setSettings(updatedSettings);
    await saveSettingsDoc('Official JKBOSE Marks Reset', updatedSettings);
    setMarksSaved(true);
    setTimeout(() => setMarksSaved(false), 3000);
  };

  const streamCounts = useMemo(() => {
    return {
      all: SUBJECT_CONFIG_DEFS.length,
      lab: SUBJECT_CONFIG_DEFS.filter(s => s.isLab).length,
      science: SUBJECT_CONFIG_DEFS.filter(s => s.stream.toLowerCase().includes('science')).length,
      vocational: SUBJECT_CONFIG_DEFS.filter(s => s.stream.toLowerCase().includes('vocational')).length,
      humanities: SUBJECT_CONFIG_DEFS.filter(s => s.stream.toLowerCase().includes('humanities')).length,
      commerce: SUBJECT_CONFIG_DEFS.filter(s => s.stream.toLowerCase().includes('commerce')).length,
    };
  }, []);

  const filteredSubjects = SUBJECT_CONFIG_DEFS.filter(sub => {
    if (streamFilter === 'science' && !sub.stream.toLowerCase().includes('science')) return false;
    if (streamFilter === 'humanities' && !sub.stream.toLowerCase().includes('humanities')) return false;
    if (streamFilter === 'commerce' && !sub.stream.toLowerCase().includes('commerce')) return false;
    if (streamFilter === 'vocational' && !sub.stream.toLowerCase().includes('vocational')) return false;
    if (streamFilter === 'lab' && !sub.isLab) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q) || sub.stream.toLowerCase().includes(q);
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3.5 shadow-2xs space-y-2">
      {/* Ultra-Compact Unified Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Class + Evaluation Type + Stream Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Class Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {['10th', '11th', '12th'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveClassTab(c)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeClassTab === c
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Class {c}
              </button>
            ))}
          </div>

          {/* Type Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTypeTab('internal')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTypeTab === 'internal'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Internal Assessment
            </button>
            <button
              type="button"
              onClick={() => setActiveTypeTab('external')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTypeTab === 'external'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              External Practical
            </button>
          </div>

          {/* Stream Filter Dropdown */}
          <select
            value={streamFilter}
            onChange={e => setStreamFilter(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
          >
            <option value="all">All Subjects ({streamCounts.all})</option>
            <option value="lab">Lab Practicals ({streamCounts.lab})</option>
            <option value="science">Science ({streamCounts.science})</option>
            <option value="vocational">Vocational ({streamCounts.vocational})</option>
            <option value="humanities">Humanities ({streamCounts.humanities})</option>
            <option value="commerce">Commerce ({streamCounts.commerce})</option>
          </select>
        </div>

        {/* Right: Search + Reset + Save */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-32 sm:w-44 pl-7 pr-6 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all flex items-center gap-1"
            title="Reset to official JKBOSE standard defaults"
          >
            <RotateCcw size={11} />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={saving}
            className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
              marksSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
            }`}
          >
            {marksSaved ? <Check size={12} /> : <Save size={12} />}
            <span>{marksSaved ? 'Saved' : saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Subject Marks Minimal High-Density Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
        <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[620px] text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[9.5px] font-black sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 tracking-wider">
              <tr>
                <th className="py-2 px-2.5 w-10 text-center text-slate-400 whitespace-nowrap">#</th>
                <th className="py-2 px-3 whitespace-nowrap">Subject & Stream</th>
                <th className="py-2 px-3 text-center w-36 whitespace-nowrap">Max Marks</th>
                <th className="py-2 px-3 text-center w-36 whitespace-nowrap">Pass Marks</th>
                <th className="py-2 px-3 text-center w-36 hidden sm:table-cell whitespace-nowrap">Pass Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {filteredSubjects.map((sub, idx) => {
                const defaultSub = DEFAULT_PRACTICAL_MARKS_CONFIG[activeClassTab]?.[activeTypeTab]?.[sub.code] || { max: 20, min: 7 };
                const subConfig = currentTypeConfig?.[sub.code] || defaultSub;
                const maxVal = subConfig.max !== undefined && subConfig.max !== null ? subConfig.max : defaultSub.max;
                const minVal = subConfig.min !== undefined && subConfig.min !== null ? subConfig.min : (defaultSub.min || Math.ceil(0.36 * Number(maxVal || 20)));
                const numMax = Number(maxVal) || 20;
                const numMin = Number(minVal) || 7;
                const passRatio = numMax > 0 ? Math.round((numMin / numMax) * 100) : 36;

                return (
                  <tr key={`${sub.code}_${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-1.5 px-2.5 text-center font-mono text-[11px] text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{getSubjectDisplayName(sub.code, activeClassTab)}</span>
                        <span className="px-1.5 py-0.2 rounded font-mono font-black text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                          {sub.code}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                          {sub.stream}
                        </span>
                        {sub.isLab && (
                          <span className="px-1 py-0.2 rounded text-[8.5px] font-black uppercase tracking-tight bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Lab
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Max Marks Stepper */}
                    <td className="py-1.5 px-3 text-center">
                      <div className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
                        <button
                          type="button"
                          onClick={() => adjustMarks(sub.code, 'max', -1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black cursor-pointer shadow-2xs"
                        >
                          <Minus size={9} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={maxVal}
                          onChange={e => handleUpdateMarks(sub.code, 'max', e.target.value)}
                          className="w-9 py-0 bg-transparent text-center font-mono font-black text-xs text-indigo-600 dark:text-indigo-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => adjustMarks(sub.code, 'max', 1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black cursor-pointer shadow-2xs"
                        >
                          <Plus size={9} />
                        </button>
                      </div>
                    </td>
                    {/* Min / Pass Marks Stepper */}
                    <td className="py-1.5 px-3 text-center">
                      <div className="inline-flex items-center gap-0.5 bg-slate-50 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
                        <button
                          type="button"
                          onClick={() => adjustMarks(sub.code, 'min', -1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black cursor-pointer shadow-2xs"
                        >
                          <Minus size={9} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={numMax}
                          value={minVal}
                          onChange={e => handleUpdateMarks(sub.code, 'min', e.target.value)}
                          className="w-9 py-0 bg-transparent text-center font-mono font-black text-xs text-emerald-600 dark:text-emerald-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => adjustMarks(sub.code, 'min', 1)}
                          className="w-5 h-5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black cursor-pointer shadow-2xs"
                        >
                          <Plus size={9} />
                        </button>
                      </div>
                    </td>
                    {/* Visual Pass Ratio */}
                    <td className="py-1.5 px-3 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">{passRatio}%</span>
                        <span className="font-mono text-[10px] text-slate-400">({minVal}/{maxVal})</span>
                        <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              passRatio >= 33 && passRatio <= 40
                                ? 'bg-emerald-500'
                                : passRatio > 40
                                ? 'bg-amber-500'
                                : 'bg-cyan-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, passRatio))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSubjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-bold text-xs">
                    No subjects match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official JKBOSE Reset Confirmation Modal */}
      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmResetDefaults}
        title="Reset to Official JKBOSE Scheme?"
        subtitle="This will restore official Board maximum marks and passing criteria across all 61 subjects for Class 10th, 11th, and 12th."
        badgeText="2024-25 Board Scheme"
        confirmText="Reset & Save Defaults"
        confirmBtnStyle="indigo"
        icon={RotateCcw}
        loading={saving}
      >
        <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-2 text-[11.5px]">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" /> Key Board Regulations to be Applied:
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 font-medium pl-1">
            <li><strong>Lab Science Practicals (Physics, Chem, Bio, etc.):</strong> External = <strong>20 Max (Min 7)</strong>, Internal = <strong>10 Max (Min 4)</strong></li>
            <li><strong>Mathematics, Humanities & Languages:</strong> Project Work / IA = <strong>20 Max (Min 7)</strong></li>
            <li><strong>Commerce Skill (Accountancy, Entrepreneurship, Sociology):</strong> External = <strong>15 Max (Min 5)</strong>, IA = <strong>5 Max (Min 2)</strong></li>
            <li><strong>Physical Education:</strong> Class 11th (10 IA / 20 Ext) | Class 12th (15 IA / 25 Ext)</li>
          </ul>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
          * Changes will immediately sync to the cloud database and update all evaluation award rolls.
        </p>
      </ConfirmationModal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REDESIGNED SETTINGS & PERMISSIONS MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
function SettingsPermissionsView({
  settings,
  setSettings,
  saveSettingsDoc,
  saving,
  grantEmail,
  setGrantEmail,
  grantClass,
  setGrantClass,
  grantSubject,
  setGrantSubject,
  grantPerm,
  revokePerm,
  teachers
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('marks'); // 'marks' | 'permissions' | 'system'
  const [sysSaved, setSysSaved] = useState(false);
  const [printSaved, setPrintSaved] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  const handleSaveSys = async () => {
    const ok = await saveSettingsDoc('Global Configuration', settings);
    if (ok) {
      setSysSaved(true);
      setTimeout(() => setSysSaved(false), 3000);
    }
  };

  const handleSavePrint = async () => {
    const ok = await saveSettingsDoc('Print Defaults', settings);
    if (ok) {
      setPrintSaved(true);
      setTimeout(() => setPrintSaved(false), 3000);
    }
  };

  const activePermissions = settings.permissions || [];
  const filteredPermissions = activePermissions.filter(p => {
    if (!permSearch.trim()) return true;
    const q = permSearch.toLowerCase().trim();
    const email = String(p.email || '').toLowerCase();
    const cls = String(p.className || '').toLowerCase();
    const subj = String(p.subject || '').toLowerCase();
    const subjName = String(NAMES[p.subject] || '').toLowerCase();
    return email.includes(q) || cls.includes(q) || subj.includes(q) || subjName.includes(q);
  });

  return (
    <div className="space-y-2.5">
      {/* Top Compact Sub-Tabs Ribbon */}
      <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('marks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSettingsTab === 'marks'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Award size={13} />
            <span>Subject Marks Matrix</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeSettingsTab === 'marks' ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {SUBJECT_CONFIG_DEFS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSettingsTab('permissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSettingsTab === 'permissions'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Shield size={13} />
            <span>Teacher Permissions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeSettingsTab === 'permissions' ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {activePermissions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSettingsTab('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSettingsTab === 'system'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Settings size={13} />
            <span>System & Print Defaults</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: DEDICATED FULL-WIDTH SUBJECT MARKS MATRIX */}
      {activeSettingsTab === 'marks' && (
        <SubjectMarksSettingsCard
          settings={settings}
          setSettings={setSettings}
          saveSettingsDoc={saveSettingsDoc}
          saving={saving}
        />
      )}

      {/* VIEW 2: DEDICATED TEACHER PERMISSIONS MANAGEMENT */}
      {activeSettingsTab === 'permissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Grant Permission Form Card (lg:col-span-5) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                  <Shield size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    Grant Evaluation Permission
                  </h3>
                  <p className="text-[10.5px] font-semibold text-slate-500">
                    Authorize a faculty member for specific class and subject marks entry.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={grantPerm} className="space-y-3 text-xs">
              <div>
                <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Teacher Email Address
                </label>
                <input
                  type="email"
                  list="faculty-email-suggestions"
                  placeholder="e.g. teacher@hssshangus.in"
                  value={grantEmail}
                  onChange={e => setGrantEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  required
                />
                <datalist id="faculty-email-suggestions">
                  {(teachers || []).map(t => (
                    <option key={t.id || t.email} value={t.email}>{t.name ? `${t.name} (${t.email})` : t.email}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                    Target Class
                  </label>
                  <select
                    value={grantClass}
                    onChange={e => setGrantClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs text-slate-900 dark:text-white cursor-pointer shadow-2xs focus:outline-none"
                  >
                    <option value="10th">Class 10th</option>
                    <option value="11th">Class 11th</option>
                    <option value="12th">Class 12th</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                    Evaluation Subject
                  </label>
                  <select
                    value={grantSubject}
                    onChange={e => setGrantSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs text-slate-900 dark:text-white cursor-pointer shadow-2xs focus:outline-none truncate"
                  >
                    {CODES.map(c => (
                      <option key={c} value={c}>
                        {getSubjectDisplayName(c, grantClass)} ({c})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Shield size={14} /> Grant Evaluation Permission
              </button>
            </form>
          </div>

          {/* Active Permissions List Card (lg:col-span-7) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Active Teacher Permissions ({activePermissions.length})
                </h3>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Current faculty members authorized for online marks entry.
                </p>
              </div>

              <div className="relative w-44">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter permissions..."
                  value={permSearch}
                  onChange={e => setPermSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs pr-1">
              {filteredPermissions.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 dark:text-white truncate text-xs">{p.email}</div>
                    <div className="text-[10.5px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-black text-[10px]">
                        Class {p.className}
                      </span>
                      <span>•</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{getSubjectDisplayName(p.subject, p.className)} ({p.subject})</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokePerm(idx)}
                    className="px-2.5 py-1 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-600 font-black text-[11px] cursor-pointer transition-all border border-rose-200 dark:border-rose-800/60"
                  >
                    Revoke
                  </button>
                </div>
              ))}
              {filteredPermissions.length === 0 && (
                <div className="py-12 text-slate-400 text-center font-bold text-xs">
                  {activePermissions.length === 0
                    ? 'No active teacher evaluation permissions granted yet.'
                    : 'No permissions match your search filter.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: GLOBAL CONFIGURATION & OFFICIAL PRINT DEFAULTS */}
      {activeSettingsTab === 'system' && (
        <div className="space-y-4">
          {/* Card 1: Global System Configuration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                  <Settings size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    Global System Configuration
                  </h3>
                  <p className="text-[10.5px] font-semibold text-slate-500">
                    System evaluation parameters, absent codes, and rules.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveSys}
                disabled={saving}
                className={`w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  sysSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {sysSaved ? <Check size={13} /> : <Save size={13} />} {sysSaved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Active Academic Session
                </label>
                <input
                  type="text"
                  value={settings.currentAcademicSession || '2025-26'}
                  onChange={e => setSettings({ ...settings, currentAcademicSession: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  placeholder="2025-26"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Default Evaluation Type
                </label>
                <select
                  value={settings.defaultEvaluationType || 'internal'}
                  onChange={e => setSettings({ ...settings, defaultEvaluationType: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs cursor-pointer focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                >
                  <option value="internal">Internal Assessment</option>
                  <option value="external">External / Outside Assessment</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Absent Candidate Symbol
                </label>
                <input
                  type="text"
                  value={settings.absentMarker || 'AB'}
                  onChange={e => setSettings({ ...settings, absentMarker: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  placeholder="AB"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Class 10th Non-Practical Subjects
                </label>
                <input
                  type="text"
                  value={settings.nonPractical10 || ''}
                  onChange={e => setSettings({ ...settings, nonPractical10: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  placeholder="Codes (e.g. HTC, ITE)"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Class 11th Non-Practical Subjects
                </label>
                <input
                  type="text"
                  value={settings.nonPractical11 || ''}
                  onChange={e => setSettings({ ...settings, nonPractical11: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  placeholder="Codes (e.g. HTC, ITE)"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                  Class 12th Non-Practical Subjects
                </label>
                <input
                  type="text"
                  value={settings.nonPractical12 || ''}
                  onChange={e => setSettings({ ...settings, nonPractical12: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  placeholder="Codes (e.g. HTC, ITE)"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Official Document Print Headers */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
                  <Printer size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    Print Document Defaults & Official Headers
                  </h3>
                  <p className="text-[10.5px] font-semibold text-slate-500">
                    Header information stamped on generated award rolls and sheets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSavePrint}
                disabled={saving}
                className={`w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  printSaved ? 'bg-indigo-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {printSaved ? <Check size={13} /> : <Save size={13} />} {printSaved ? 'Saved!' : saving ? 'Saving...' : 'Save Print Headers'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-xs">
              {['10th', '11th', '12th'].map(c => (
                <div key={c} className="p-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                    <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                      <Award size={14} className="text-indigo-500" /> Class {c} Print Headers
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-[10px]">
                      Official Scheme
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Institution Name</label>
                      <input
                        type="text"
                        placeholder="Institution Name"
                        value={settings.printDetails?.[c]?.instName || 'Govt. Higher Secondary School Shangus'}
                        onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], instName: e.target.value } } }))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Session Text</label>
                        <input
                          type="text"
                          placeholder="Session (e.g. 2025-26)"
                          value={settings.printDetails?.[c]?.sessionText || '2025-26'}
                          onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], sessionText: e.target.value } } }))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Incharge Name</label>
                        <input
                          type="text"
                          placeholder="Incharge Name"
                          value={settings.printDetails?.[c]?.inchargeName || (c === '12th' ? 'Mr. Bilal Ahmad Khandy' : 'Mr. Majid Hassan Najar')}
                          onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeName: e.target.value } } }))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Incharge CPIS</label>
                        <input
                          type="text"
                          placeholder="CPIS Code"
                          value={settings.printDetails?.[c]?.inchargeCpis || (c === '12th' ? 'KGLEDU00120015' : 'SHGEDU00220017')}
                          onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeCpis: e.target.value } } }))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Incharge Mobile</label>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="10-digit mobile"
                          value={settings.printDetails?.[c]?.inchargeMobile || (c === '12th' ? '9596165142' : '7006537425')}
                          onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeMobile: e.target.value.replace(/\D/g, '') } } }))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(AdminPracticals);
