import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Settings, ClipboardCheck, Printer, RefreshCw, CheckCircle2, AlertCircle,
  Award, AlertTriangle, X, Sliders, Users, Mail, Phone, MessageCircle, Edit2, Check, Search,
  Download, Upload, FileSpreadsheet, FileText, Trash2, Eye, Save, Shield,
  ChevronDown, BookOpen, SlidersHorizontal, Filter, Layers
} from 'lucide-react';
import { db, functions } from '../../services/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ModernLoader from '../../components/ModernLoader';
import { getCachedCollection } from '../../services/dbCache';
import {
  printIndividualAwardRoll,
  printIndividualWorkSheet,
  printConsolidatedAwardRoll,
  printAllIndividualAwardRolls,
  printAttendanceSheet,
  printFailList,
  PRACTICAL_SUBJECT_DEFS
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

const CODES = ['EN', 'PH', 'CH', 'MA', 'UR', 'ED', 'HT', 'PS', 'EC', 'ES', 'PD', 'HTC', 'ITE', 'BO', 'ZO', 'BI'];
const NAMES = {
  BO: 'Botany',
  ZO: 'Zoology',
  BI: 'Biology (Botany & Zoology)',
  CH: 'Chemistry',
  EC: 'Economics',
  ED: 'Education',
  ES: 'Environmental Science',
  EN: 'General English',
  HTC: 'Healthcare',
  HT: 'History',
  ITE: 'IT and ITES',
  MA: 'Mathematics',
  PD: 'Physical Education',
  PH: 'Physics',
  PS: 'Political Science',
  UR: 'Urdu'
};

const DEFAULT_MX11 = { BI: 20, BO: 10, ZO: 10, CH: 10, EC: 20, ED: 20, EN: 20, ES: 10, HT: 20, MA: 20, PD: 15, PH: 10, PS: 20, UR: 20, HTC: 50, ITE: 50 };
const DEFAULT_MX12 = { BI: 20, BO: 10, ZO: 10, CH: 10, EC: 20, ED: 20, EN: 20, ES: 10, HT: 20, MA: 20, PD: 15, PH: 10, PS: 20, UR: 20, HTC: 50, ITE: 50 };

export const isClassMatch = (stc, trc) => {
  if (!stc) return false;
  const s = String(stc).toLowerCase().trim();
  const t = String(trc || '').toLowerCase().replace('th', '').trim();
  return (
    s.includes(t) ||
    s.includes(String(trc).toLowerCase()) ||
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
    'Class Roll No (Class 12th)', 'Class Roll No (Class 11th)', 'Class Roll No.', 'Roll_Number'
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

  const multiSubCols = [
    st['Subjects1'], st['Subjects2'], st['Subjects3'], st['Subjects4'], st['Subjects5'], st['Subject6'],
    st['Subject1'], st['Subject2'], st['Subject3'], st['Subject4'], st['Subject5'],
    st['subject1'], st['subject2'], st['subject3'], st['subject4'], st['subject5'], st['subject6']
  ].filter(Boolean).join(', ');

  return String(
    st['Subs'] ||
    st['subs'] ||
    (is12 ? (st['Subjects to be taken in Class 12th'] || st['Subjects Studied in Class 11th'] || st['Subjects in Class 11th']) : '') ||
    (is10 ? (st['Subjects to be taken in Class 10th'] || st['Subjects Studied in Class 9th'] || st['Subjects in Class 9th']) : '') ||
    multiSubCols ||
    st['Subjects Studied in Class 11th'] ||
    st['Subjects to be taken in Class 11th'] ||
    st['Subjects Studied in Class 9th'] ||
    st['Subjects to be taken in Class 9th'] ||
    st['Subjects to be taken in Class 12th'] ||
    st['Subjects to be taken in Class 10th'] ||
    st['Subjects'] ||
    st['Subject Combination'] ||
    st['streamSubjects'] ||
    st.subjects ||
    ''
  );
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

  const code = subCode.toUpperCase();
  const subStr = getStudentSubjectsStr(st, cls).toUpperCase();
  const streamStr = getStudentStreamStr(st, cls);

  // 1. Direct Subject Match in Student's Enrolled Subjects String
  if (subStr && subStr.length > 1) {
    if (code === 'BI') {
      if (subStr.includes('BI') || subStr.includes('BIO') || subStr.includes('BIOLOGY') || subStr.includes('BO') || subStr.includes('ZO')) return true;
    } else if (code === 'BO') {
      if (subStr.includes('BO') || subStr.includes('BOTANY') || subStr.includes('BIOLOGY') || subStr.includes('BI')) return true;
    } else if (code === 'ZO') {
      if (subStr.includes('ZO') || subStr.includes('ZOOLOGY') || subStr.includes('BIOLOGY') || subStr.includes('BI')) return true;
    } else if (code === 'MA') {
      if (subStr.includes('MA') || subStr.includes('MATH') || subStr.includes('MATHEMATICS')) return true;
    } else if (code === 'PS') {
      if (subStr.includes('PS') || subStr.includes('POL') || subStr.includes('POLITICAL')) return true;
    } else if (code === 'ED') {
      if (subStr.includes('ED') || subStr.includes('EDUCATION')) return true;
    } else if (code === 'HT') {
      if (subStr.includes('HT') || subStr.includes('HIST') || subStr.includes('HISTORY')) return true;
    } else if (code === 'UR') {
      if (subStr.includes('UR') || subStr.includes('URDU')) return true;
    } else if (code === 'EC') {
      if (subStr.includes('EC') || subStr.includes('ECONOMICS') || subStr.includes('ECO')) return true;
    } else if (code === 'ES') {
      if (subStr.includes('ES') || subStr.includes('EVS') || subStr.includes('ENVIR') || subStr.includes('ENVIRONMENTAL')) return true;
    } else if (code === 'PD') {
      if (subStr.includes('PD') || subStr.includes('PED') || subStr.includes('PHYSICAL') || subStr.includes('P.E')) return true;
    } else if (code === 'HTC') {
      if (subStr.includes('HTC') || subStr.includes('HEALTH') || subStr.includes('HEALTHCARE')) return true;
    } else if (code === 'ITE') {
      if (subStr.includes('ITE') || subStr.includes('IT') || subStr.includes('INFORMATION') || subStr.includes('TECH')) return true;
    } else {
      if (subStr.includes(code)) return true;
      const name = NAMES[code];
      if (name && subStr.includes(name.toUpperCase())) return true;
    }
  }

  // 2. Stream-based Core Enrollment Rules
  const isScience = streamStr.includes('science') || streamStr.includes('med') || streamStr.includes('sci');
  const isMedical = streamStr.includes('med') || subStr.includes('BOTANY') || subStr.includes('ZOOLOGY') || subStr.includes('BIOLOGY');
  const isNonMedical = streamStr.includes('non-med') || streamStr.includes('nonmed') || subStr.includes('MATH');
  const isArts = streamStr.includes('arts') || streamStr.includes('humanities');
  const isCommerce = streamStr.includes('commerce');

  if (isScience) {
    if (['EN', 'PH', 'CH', 'ES'].includes(code)) return true;
    if (['BO', 'ZO', 'BI'].includes(code) && (isMedical || !isNonMedical)) return true;
    if (code === 'MA' && isNonMedical) return true;
  } else if (isArts) {
    if (['EN', 'ES'].includes(code)) return true;
  } else if (isCommerce) {
    if (['EN', 'ES', 'EC'].includes(code)) return true;
  } else {
    if (['EN', 'ES'].includes(code)) return true;
  }

  return false;
}

export function normalizePracticalSession(sess) {
  if (!sess) return '2025-26';
  const str = String(sess).toLowerCase().trim();

  // 1. Current / Live 2025-26 Session
  if (
    str.includes('2025-26') ||
    str.includes('2025–26') ||
    str.includes('2025-2026') ||
    str === '2026' ||
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
    str === '2025' ||
    str.includes('oct') ||
    str.includes('nov') ||
    str.includes('previous')
  ) {
    return '2024-25 (Oct-Nov)';
  }

  return sess;
}

export const isSessionMatch = (rawSess, targetFilter) => {
  if (!rawSess || !targetFilter || targetFilter === 'all') return true;
  const sNorm = normalizePracticalSession(rawSess);
  const tNorm = normalizePracticalSession(targetFilter);

  if (tNorm === '2025-26') {
    return sNorm === '2025-26';
  }
  if (tNorm === '2024-25 (Oct-Nov)' || tNorm === '2024-25') {
    return sNorm === '2024-25 (Oct-Nov)';
  }

  const s = String(sNorm).toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = String(tNorm).toLowerCase().replace(/[^a-z0-9]/g, '');
  return s === t || s.includes(t) || t.includes(s);
};

export const checkStudentApprovalState = (st) => {
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
  const isRejected = statusStr.includes('reject') || statusStr.includes('cancel') || st.isRejected === true;

  // Once class roll is assigned, the student is approved. Also approved if marked as approved/admitted/completed or from master registers.
  const isExplicitApproved = statusStr.includes('approv') || statusStr.includes('admit') || statusStr.includes('complet') || statusStr.includes('active') || st.isApproved === true || st._source === 'masterRegisters';
  const isApproved = !isRejected && (hasRoll || isExplicitApproved);
  const isPending = !isApproved && !isRejected;

  return { isApproved, isRejected, isPending, hasRoll };
};

const normalizeStudentFields = (st, source = 'masterRegisters') => {
  const sNo = st['S. No.'] || st['S.No.'] || st['S.No'] || st['sNo'] || st['Serial No'] || '';
  const formNo = st['Form No.'] || st['Form No'] || st['formNo'] || st['Application No'] || '';
  const studentName = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '';
  const fatherName = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '';
  const stream = getStudentStreamStr(st) || 'Humanities';
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

  let examRoll = String(
    st['Exam R.No. (Current)'] ||
    st.examRollNo ||
    st['Exam Roll No'] ||
    st['Exam Roll No.'] ||
    st.examRoll ||
    ''
  ).trim();

  const boardReg = cleanRegistrationNumber(
    st['Board Registration Number'] ||
    st['Board Reg. No.'] ||
    st.boardRegNo ||
    st.regNo ||
    st['Board Registration No. (Class 11th)'] ||
    st['Board Registration No. (Class 10th)'] ||
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
      text="Loading Practicals & Awards Database"
      subtext="Fetching evaluation lists & teacher submissions..."
    />
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN ADMIN PRACTICALS PORTAL COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AdminPracticals() {
  const getInitialPracticalsTab = () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSubTab = searchParams.get('subtab');
      if (urlSubTab && ['class11', 'class12', 'teachers', 'settings'].includes(urlSubTab)) return urlSubTab;
      const saved = sessionStorage.getItem('hss_admin_practicals_tab');
      if (saved && ['class11', 'class12', 'teachers', 'settings'].includes(saved)) return saved;
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
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [settings, setSettings] = useState({
    maxMarks11: DEFAULT_MX11,
    maxMarks12: DEFAULT_MX12,
    nonPractical11: '',
    nonPractical12: '',
    currentYearSuffix: '26',
    absentMarker: 'A',
    currentPracticalType: 'internal',
    permissions: [],
    printDetails: {
      '11th': {
        sessionText: 'Annual Regular 2025',
        instName: 'Govt. Higher Secondary School Shangus',
        inchargeName: 'Mr. Sheikh Gulfam',
        inchargeCpis: 'GRZEDU00060041',
        inchargeMobile: '9682547458'
      },
      '12th': {
        sessionText: 'Annual Regular 2025',
        instName: 'Govt. Higher Secondary School Shangus',
        inchargeName: 'Mr. Sheikh Gulfam',
        inchargeCpis: 'GRZEDU00060041',
        inchargeMobile: '9682547458'
      }
    }
  });

  // Modal States
  const [selSub, setSelSub] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Settings tab form states
  const [grantEmail, setGrantEmail] = useState('');
  const [grantClass, setGrantClass] = useState('11th');
  const [grantSubject, setGrantSubject] = useState('PH');
  const [emailSt, setEmailSt] = useState({});

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [ssRaw, setDocSnap, ts, admissionsData, masterRegistersData] = await Promise.all([
        getDocs(collection(db, 'practicalsData')),
        getDocs(collection(db, 'adminPracticalsSettings')),
        getDocs(collection(db, 'users')),
        getCachedCollection('admissions', force, 30 * 60 * 1000),
        getCachedCollection('masterRegisters', force, 30 * 60 * 1000)
      ]);

      if (!setDocSnap.empty) {
        const d = setDocSnap.docs.find(x => x.id === 'config')?.data();
        if (d) setSettings(p => ({ ...p, ...d }));
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
        const exam = String(st['Exam R.No. (Current)'] || st.examRollNo || '').trim().toUpperCase();

        // STRICT GUARD: Skip empty / ghost rows
        if (!name && !father && (!roll || roll === '—') && (!exam || exam === '—') && (!reg || reg === '—')) {
          return;
        }

        const cls = cleanCls(st);
        const canonicalCls = extractCleanClass(st);
        st.Class = canonicalCls;
        st.class = canonicalCls;

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

          const stStream = st['Stream for Class 12th'] || st['Stream for Class 11th'] || st.Stream || st.stream || '';
          const existingStream = existing['Stream for Class 12th'] || existing['Stream for Class 11th'] || existing.Stream || existing.stream || '';

          const isStFallback = !stStream || stStream === 'Science' || stStream === 'Humanities' || stStream === 'External / Outside';
          const isExistingValid = existingStream && existingStream !== 'External / Outside';

          const finalStream = isExistingValid ? existingStream : (stStream || existingStream || 'Science');

          const stSubs = st.Subjects || st.Subs || st.subjects || st['Subjects to be taken in Class 12th'] || st['Subjects to be taken in Class 11th'] || '';
          const existingSubs = existing.Subjects || existing.Subs || existing.subjects || existing['Subjects to be taken in Class 12th'] || existing['Subjects to be taken in Class 11th'] || '';
          const finalSubs = existingSubs || stSubs || '';

          const finalRoll = getRollNo(st) || getRollNo(existing) || '—';
          const finalExam = (exam && exam !== '—' && exam !== 'NA' && exam !== 'N/A') ? exam : (existing['Exam R.No. (Current)'] || existing.examRollNo || '—');
          const finalReg = (reg && reg !== '—' && reg !== 'N/A') ? reg : (existing['Board Registration Number'] || existing.regNo || '—');

          // Session priority: prefer '2025-26' if present in either existing or new record
          const finalSess = (sess === '2025-26' || existing.session === '2025-26' || existing.Session === '2025-26')
            ? '2025-26'
            : (sess || existing.Session || existing.session || '2024-25 (Oct-Nov)');

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
            'Class Roll No': finalRoll,
            classRollNo: finalRoll,
            'Exam R.No. (Current)': finalExam,
            examRollNo: finalExam,
            'Board Registration Number': finalReg,
            boardRegNo: finalReg,
            _source: existing._source || source,
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

      const parsedSubmissions = ssRaw.docs
        .map(d => {
          const data = d.data();
          const cleanRecs = (data.records || []).filter(r => {
            if (!r || typeof r !== 'object') return false;
            const name = String(r.name || r.studentName || '').toLowerCase().trim();
            if (!name || name.includes('studentname') || name.includes('fathername')) return false;
            return true;
          });
          const canonicalSession = normalizePracticalSession(data.sessionText || data.session || '2024-25 (Oct-Nov)');
          return {
            id: d.id,
            ...data,
            sessionText: canonicalSession,
            session: canonicalSession,
            records: cleanRecs
          };
        })
        .filter(sub => sub.records && sub.records.length > 0);

      setSubmissions(parsedSubmissions);

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
        const sess = getStudentSession(st) || '2025-26';
        addOrMergeStudent({
          ...st,
          session: sess,
          Session: sess,
          _source: 'admissions'
        }, 'admissions');
      });

      // 3. Enrich existing students with Exam Rolls and Registration Numbers from Practical Submissions (NO duplicate student injections)
      parsedSubmissions.forEach(sub => {
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
            studentsMap.set(existingId, {
              ...existing,
              'Exam R.No. (Current)': (rawExam && rawExam !== '—') ? rawExam : (existing['Exam R.No. (Current)'] || existing.examRollNo || '—'),
              examRollNo: (rawExam && rawExam !== '—') ? rawExam : (existing.examRollNo || existing['Exam R.No. (Current)'] || '—'),
              'Board Registration Number': (rawReg && rawReg !== '—') ? rawReg : (existing['Board Registration Number'] || existing.regNo || '—'),
              boardRegNo: (rawReg && rawReg !== '—') ? rawReg : (existing.boardRegNo || existing['Board Registration Number'] || '—'),
            });
          }
        });
      });

      const allStudentList = Array.from(studentsMap.values());

      // Index Class 11th (and 9th) records by Registration Number & Name+Father Name
      const class11ByReg = new Map();
      const class11ByName = new Map();

      allStudentList.forEach(st => {
        const cls = String(st.Class || st.class || '');
        if (cls.includes('11') || cls.includes('XI') || cls.includes('9') || cls.includes('IX')) {
          const reg = cleanRegistrationNumber(st['Board Registration Number'] || st.regNo || '');
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

      // Enrich Class 12th (and 10th) records using previous class data if stream/subjects are missing
      const enrichedStudents = allStudentList.map(st => {
        const cls = String(st.Class || st.class || '');
        if (cls.includes('12') || cls.includes('XII') || cls.includes('10') || cls.includes('X')) {
          const reg = cleanRegistrationNumber(st['Board Registration Number'] || st.regNo || '');
          const name = cleanStr(st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name);
          const father = cleanStr(st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName);

          const curStream = getStudentStreamStr(st, '12th');
          const curSubjects = getStudentSubjectsStr(st, '12th');

          const prevMatch = (reg && class11ByReg.get(reg)) || (name && father && class11ByName.get(`${name}_${father}`));

          if (prevMatch) {
            const inheritedStream = prevMatch.stream || curStream;
            const inheritedSubjects = prevMatch.subjects || curSubjects;

            return {
              ...st,
              Stream: st.Stream || inheritedStream,
              stream: st.stream || inheritedStream,
              'Stream for Class 12th': st['Stream for Class 12th'] || inheritedStream,
              'Stream Studied in Class 11th': st['Stream Studied in Class 11th'] || inheritedStream,
              'Stream for Class 11th': st['Stream for Class 11th'] || inheritedStream,
              Subjects: st.Subjects || inheritedSubjects,
              Subs: st.Subs || inheritedSubjects,
              'Subjects Studied in Class 11th': st['Subjects Studied in Class 11th'] || inheritedSubjects,
              'Subjects to be taken in Class 12th': st['Subjects to be taken in Class 12th'] || inheritedSubjects,
            };
          }
        }
        return st;
      });

      setStudents(enrichedStudents);

      setTeachers(
        ts.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => {
            const r = String(u.role || '').toLowerCase();
            return r === 'teacher' || r === 'faculty' || r === 'examiner' || r === 'staff' || r === 'admin';
          })
      );
    } catch (e) {
      console.error(e);
      showAlert('error', 'Failed to load practicals data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSettingsDoc = async (keyName, updatedSettings) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'adminPracticalsSettings', 'config'), updatedSettings, { merge: true });
      try {
        localStorage.setItem('hss_admin_practicals_settings', JSON.stringify(updatedSettings));
      } catch (_) {}
      setSettings(updatedSettings);
      showAlert('success', `${keyName} saved successfully to cloud database.`);
      return true;
    } catch (e) {
      console.error('Save settings error:', e);
      try {
        localStorage.setItem('hss_admin_practicals_settings', JSON.stringify(updatedSettings));
        setSettings(updatedSettings);
        showAlert('success', `${keyName} cached locally.`);
        return true;
      } catch (_) {}
      showAlert('error', `Failed to save ${keyName}.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubmission = async (subId) => {
    if (!subId) return;
    if (!window.confirm(`Are you sure you want to delete submission record "${subId}"?`)) return;
    try {
      await deleteDoc(doc(db, 'practicalsData', subId));
      setSubmissions(prev => prev.filter(s => s.id !== subId));
      showAlert('success', `Submission "${subId}" deleted successfully.`);
    } catch (e) {
      console.error(e);
      showAlert('error', `Failed to delete submission "${subId}".`);
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

  const revokePerm = async (idx) => {
    const upd = [...(settings.permissions || [])];
    upd.splice(idx, 1);
    const newSt = { ...settings, permissions: upd };
    await saveSettingsDoc('Permission Revoked', newSt);
  };

  const getPD = (cls) => settings.printDetails?.[cls] || {};

  const handleSaveTeacherPhone = async (teacher, newPhone) => {
    if (!teacher) return false;
    let cleanPhone = String(newPhone || '').replace(/\D/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit Indian mobile number.');
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

      const docId = teacher.id || teacher.uid || teacher.email;
      if (docId) {
        await setDoc(doc(db, 'users', docId), payload, { merge: true });
      }

      const tEmail = String(teacher.email || '').toLowerCase().trim();
      if (tEmail && tEmail !== docId) {
        try {
          await setDoc(doc(db, 'users', tEmail), payload, { merge: true });
        } catch (_) {}
      }

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
      const sendPracticalsEmail = httpsCallable(functions, 'sendPracticalsEmail');
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
        <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs flex-shrink-0">
              <Sliders size={15} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">Practicals & Awards Admin</h1>
              <p className="text-[10px] font-semibold text-slate-500">Evaluations, Excel imports/exports, prints & permissions.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Class Switcher Segmented Control */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setTab('class11')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  tab === 'class11'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Award size={12} /> Class 11th
              </button>
              <button
                type="button"
                onClick={() => setTab('class12')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  tab === 'class12'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Award size={12} /> Class 12th
              </button>
            </div>

            {/* Sub-Views Tabs */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setTab('faculty_submissions')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tab === 'faculty_submissions' || tab === 'submissions' || tab === 'teachers'
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users size={13} /> Faculty & Submissions ({submissions.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('settings')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  tab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Settings size={12} /> Settings & Permissions
              </button>
            </div>

            {/* Excel Quick Actions Group */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
              <button
                onClick={() => generatePracticalsExcelTemplate()}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                title="Download standardized blank or sample Excel template (.xlsx)"
              >
                <Download size={12} /> Template
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                title="Import practical marks from Excel (.xlsx / .xls) or CSV file"
              >
                <Upload size={12} /> Import Excel
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
          {tab === 'class11' && (
            <AwardsSummaryView
              cls="11th"
              students={students}
              submissions={submissions}
              getPD={getPD}
              settings={settings}
            />
          )}

          {tab === 'class12' && (
            <AwardsSummaryView
              cls="12th"
              students={students}
              submissions={submissions}
              getPD={getPD}
              settings={settings}
            />
          )}

          {(tab === 'faculty_submissions' || tab === 'submissions' || tab === 'teachers') && (
            <FacultySubmissionsView
              teachers={teachers}
              submissions={submissions}
              sendEmail={sendEmail}
              emailSt={emailSt}
              handleWhatsAppShare={handleWhatsAppShare}
              handleEmailShare={handleEmailShare}
              handleSaveTeacherPhone={handleSaveTeacherPhone}
              setSelSub={setSelSub}
              handleDeleteSubmission={handleDeleteSubmission}
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
            />
          )}
        </div>

        {/* Selected Submission Records Modal */}
        {selSub && (
          <SelectedSubmissionModal
            selSub={selSub}
            onClose={() => setSelSub(null)}
            absentMarker={settings.absentMarker}
            allStudents={students}
          />
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AWARDS SUMMARY COMPONENT (WITH INTERNAL/EXTERNAL & BO/ZO TOGGLES)
// ─────────────────────────────────────────────────────────────
function AwardsSummaryView({ cls, students, submissions, getPD, settings }) {
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

  const [localPrintOpts, setLocalPrintOpts] = useState({
    sessionText: getPD(cls).sessionText || 'Annual Regular 2025',
    instName: getPD(cls).instName || 'Govt. Higher Secondary School Shangus',
    inchargeName: getPD(cls).inchargeName || 'Mr. Sheikh Gulfam',
    inchargeCpis: getPD(cls).inchargeCpis || 'GRZEDU00060041',
    inchargeMobile: getPD(cls).inchargeMobile || '9682547458',
    practicalType: settings.currentPracticalType || 'internal',
    absentMarker: settings.absentMarker || 'A'
  });

  // Calculate visible codes based on bioMode
  const activeCodesList = useMemo(() => {
    if (bioMode === 'separate') {
      return ['EN', 'PH', 'CH', 'BO', 'ZO', 'MA', 'UR', 'ED', 'HT', 'PS', 'EC', 'ES', 'PD', 'HTC', 'ITE'];
    }
    return ['EN', 'PH', 'CH', 'BI', 'MA', 'UR', 'ED', 'HT', 'PS', 'EC', 'ES', 'PD', 'HTC', 'ITE'];
  }, [bioMode]);

  // Helper to compute default checked subjects based on Evaluation Type & Non-Practical Settings
  const getDefaultCheckedCodes = useCallback(() => {
    const isExternal = localPrintOpts.practicalType === 'external';

    // 1. External practicals (only Laboratory Science subjects have external practicals)
    if (isExternal) {
      return bioMode === 'separate' ? ['PH', 'CH', 'BO', 'ZO'] : ['PH', 'CH', 'BI'];
    }

    // 2. Internal practicals: automatically uncheck configured non-practical subjects (e.g. HTC, ITE)
    const is12 = String(cls || '').includes('12');
    const nonPracticalConfig = String(
      (is12 ? settings.nonPractical12 : settings.nonPractical11) || settings.nonPractical || 'HTC,ITE'
    ).toUpperCase();

    const excludedCodes = new Set(
      nonPracticalConfig.split(/[\s,+/]+/).map(s => s.trim()).filter(Boolean)
    );

    return activeCodesList.filter(code => !excludedCodes.has(code));
  }, [cls, localPrintOpts.practicalType, bioMode, settings.nonPractical11, settings.nonPractical12, settings.nonPractical, activeCodesList]);

  const [selectedSubCodes, setSelectedSubCodes] = useState(() => getDefaultCheckedCodes());

  useEffect(() => {
    setSelectedSubCodes(getDefaultCheckedCodes());
  }, [getDefaultCheckedCodes]);

  // Total students enrolled in this class and session regardless of approval status
  const totalClassStudents = useMemo(() => {
    return students.filter(st => {
      const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
      if (!classMatch) return false;

      const { isRejected } = checkStudentApprovalState(st);
      if (isRejected) return false;

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

  const cSts = useMemo(() => {
    return totalClassStudents.filter(st => {
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
    const roll = String(getRollNo(st) || st.examRollNo || '').toLowerCase();
    const reg = String(st['Board Registration Number'] || st.boardRegNo || '').toLowerCase();
    return name.includes(term) || father.includes(term) || roll.includes(term) || reg.includes(term);
  });

  // Helper to find student record mark for a subject code
  const getSubjectMarkForStudent = (st, subCode, effectiveSess) => {
    const targetType = String(localPrintOpts.practicalType || 'internal').toLowerCase();
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

      const sType = String(s.practicalType || s.PracticalType || 'internal').toLowerCase();
      if (sType !== targetType) return false;

      const subSess = normalizePracticalSession(s.sessionText || s.session || '');
      if (subSess !== querySess) return false;

      const codeStr = String(s.subjectCode || s.subject || s.Subject || '').toUpperCase();
      return codeStr === subCode || codeStr.includes(subCode) || (NAMES[subCode] && codeStr.includes(NAMES[subCode].toUpperCase()));
    });

    if (!subDoc || !subDoc.records) return null;

    const stBoardReg = cleanRegistrationNumber(
      st['Board Reg. No.'] || st['Board Registration Number'] || st.boardRegNo ||
      st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || ''
    ).toUpperCase();
    const stExam = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || '').trim().toUpperCase();
    const stClassRoll = String(
      st['Class R.No.'] || st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st.rollNo || st.RollNo || st.roll_no || ''
    ).trim();
    const stName = toTitleCase(
      st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || ''
    ).trim().toLowerCase();
    const stFather = toTitleCase(
      st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || ''
    ).trim().toLowerCase();

    const rec = subDoc.records.find(r => {
      const rBoardReg = cleanRegistrationNumber(r.boardRegNo || r['Board Reg. No.'] || r.regNo || '').toUpperCase();
      const rExam = String(r.examRollNo || '').trim().toUpperCase();
      const rClassRoll = String(r.classRollNo || r.classRoll || r['Class Roll No'] || r.sNo || r.rollNo || '').trim();
      const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();
      const rFather = toTitleCase(r.parentName || r.parentage || r.fatherName || '').trim().toLowerCase();

      // Primary Match 1: 16-digit Board Registration Number (Exact)
      if (stBoardReg && rBoardReg && stBoardReg === rBoardReg && stBoardReg.length >= 8) return true;

      // Primary Match 2: Exam Roll No (Exact match when valid and not placeholder)
      if (stExam && rExam && stExam !== '—' && stExam !== 'NA' && stExam !== 'N/A' && stExam === rExam) return true;

      // Match 3: Class Roll No (Exact match when valid, same session and class)
      if (stSess === querySess && stClassRoll && rClassRoll && stClassRoll !== '—' && stClassRoll !== '-' && !/^\d{8,}$/.test(stClassRoll) && !/^\d{8,}$/.test(rClassRoll) && stClassRoll === rClassRoll) return true;

      // Match 4: Student Full Name + Father Name (when length > 3)
      if (stSess === querySess && stName && rName && stName.length > 3 && stName === rName) {
        if (!stFather || !rFather || stFather === rFather || stFather.includes(rFather) || rFather.includes(stFather)) {
          return true;
        }
      }

      return false;
    });

    if (!rec) return null;

    const rawMark = String(rec.totalMarks ?? rec.practicalMarks ?? '').trim();
    if (rawMark.toUpperCase() === 'AB' || rawMark.toUpperCase() === 'A') return 'AB';
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
      } else if (sortField === 'name') {
        aVal = String(a["Student's Name (as per school records)"] || a["Student's Name"] || a.studentName || a.name || '').toLowerCase();
        bVal = String(b["Student's Name (as per school records)"] || b["Student's Name"] || b.studentName || b.name || '').toLowerCase();
      } else if (sortField === 'father') {
        aVal = String(a["Father's/Guardian's Name (as per school records)"] || a["Father's Name"] || a.fatherName || '').toLowerCase();
        bVal = String(b["Father's/Guardian's Name (as per school records)"] || b["Father's Name"] || b.fatherName || '').toLowerCase();
      } else if (sortField === 'stream') {
        aVal = String(a.stream || a.Stream || '').toLowerCase();
        bVal = String(b.stream || b.Stream || '').toLowerCase();
      } else if (sortField === 'examRoll') {
        aVal = String(a['Exam R.No. (Current)'] || a.examRollNo || '').toLowerCase();
        bVal = String(b['Exam R.No. (Current)'] || b.examRollNo || '').toLowerCase();
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

  return (
    <div className="space-y-2.5 animate-in fade-in duration-300">
      {/* Unified Compact Control Panel Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-2xs space-y-2 relative">
        {/* UNIFIED COMPACT TOOLBAR */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 relative z-30">
          {/* Left: Summary Title & Status Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Class {cls}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10.5px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <strong className="text-indigo-600 dark:text-indigo-400">{selectedStudentsList.length}</strong>/{cSts.length} Sts
              {pendingCount > 0 && selectedStatusFilter === 'approved' && (
                <span className="text-amber-600 dark:text-amber-400 font-bold ml-1">({pendingCount} unassigned)</span>
              )}
              {' • '}
              <strong className="text-emerald-600">{activeSubjects.length}</strong> Subs
            </span>
          </div>

          {/* Right: Compact Search, Dropdowns & Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search student name, roll, reg, father..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-36 sm:w-52 md:w-64 pl-7 pr-6 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 shadow-2xs transition-all placeholder:text-[11px] placeholder:font-semibold"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Subjects Multi-Select Dropdown */}
            <div className="relative" ref={subjectsDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowAwardsMenu(false);
                  setShowSubjectsDropdown(prev => !prev);
                }}
                className="px-2 py-0.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-black cursor-pointer flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 shadow-2xs transition-all"
                title="Select subjects to display in practical awards matrix"
              >
                <BookOpen size={11} />
                <span>Subjects ({selectedSubCodes.length})</span>
                <ChevronDown size={10} className={`transition-transform duration-200 ${showSubjectsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSubjectsDropdown && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500">
                    <span className="flex items-center gap-1"><BookOpen size={11} /> Practical Subjects</span>
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                      <button type="button" onClick={() => setSelectedSubCodes(activeCodesList)} className="hover:underline cursor-pointer">All</button>
                      <span>•</span>
                      <button type="button" onClick={() => setSelectedSubCodes([])} className="hover:underline cursor-pointer">Clear</button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 divide-y divide-slate-50 dark:divide-slate-800/40">
                    {activeCodesList.map(code => {
                      const isChecked = selectedSubCodes.includes(code);
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
                              className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                            />
                            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-[10.5px] w-8">{code}</span>
                            <span className="text-[11px] truncate max-w-[130px]">{NAMES[code] || code}</span>
                          </div>
                          {isChecked && <Check size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilterTray(prev => !prev)}
              className={`px-2 py-0.5 rounded-xl text-[11px] font-black cursor-pointer flex items-center gap-1 border shadow-2xs transition-all ${
                showFilterTray || selectedStatusFilter !== 'approved' || selectedSession !== '2025-26' || localPrintOpts.practicalType === 'external'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100 dark:shadow-none'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Toggle filters for evaluation type, session, and student approval status"
            >
              <Filter size={11} />
              <span>Filters</span>
              <ChevronDown size={10} className={`transition-transform duration-200 ${showFilterTray ? 'rotate-180' : ''}`} />
            </button>

            {/* Subtle Divider */}
            <div className="h-4 w-[1px] bg-slate-200 dark:border-slate-700 mx-0.5" />

            {/* Unified Print / Export Awards Dropdown Menu */}
            <div className="relative" ref={awardsMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowSubjectsDropdown(false);
                  setShowAwardsMenu(prev => !prev);
                }}
                className="px-2.5 py-0.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs transition-all"
                title="Print and export practical awards rolls in official formats"
              >
                <Printer size={11} />
                <span>Awards / Export</span>
                <ChevronDown size={10} className={`transition-transform duration-200 ${showAwardsMenu ? 'rotate-180' : ''}`} />
              </button>

              {showAwardsMenu && (
                <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150 text-xs">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    Print & Export Options
                  </div>

                  {/* 1. Print Consolidated Awards Matrix */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAwardsMenu(false);
                      const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                      if (!listToPrint || listToPrint.length === 0) {
                        alert(`No student records available to print for Class ${cls}.`);
                        return;
                      }
                      printConsolidatedAwardRoll({
                        className: cls,
                        session: localPrintOpts.sessionText,
                        students: listToPrint,
                        submissions,
                        isExternal: localPrintOpts.practicalType === 'external',
                        selectedSubjectCodes: activeSubjects,
                        printDetails: localPrintOpts
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Printer size={13} className="text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-[11.5px] font-black">Print Consolidated Awards & Letter</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Forwarding cover letter + subject hash totals matrix</div>
                    </div>
                  </button>

                  {/* 2. Print Individual Subject Award Rolls (2-Col - All Subjects) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAwardsMenu(false);
                      const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                      if (!listToPrint || listToPrint.length === 0) {
                        alert(`No student records available to print for Class ${cls}.`);
                        return;
                      }
                      printAllIndividualAwardRolls({
                        className: cls,
                        session: localPrintOpts.sessionText,
                        students: listToPrint,
                        submissions,
                        isExternal: localPrintOpts.practicalType === 'external',
                        selectedSubjectCodes: activeSubjects,
                        printDetails: localPrintOpts
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText size={13} className="text-blue-600 shrink-0" />
                    <div>
                      <div className="text-[11.5px] font-black">Print Individual Subject Award Rolls</div>
                      <div className="text-[10px] text-slate-400 font-semibold">2-column 50/page official rolls (Figures & Words)</div>
                    </div>
                  </button>

                  <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

                  {/* 3. Export Consolidated Excel */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAwardsMenu(false);
                      const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                      if (!listToPrint || listToPrint.length === 0) {
                        alert(`No student records available to export for Class ${cls}.`);
                        return;
                      }
                      exportConsolidatedAwardsToExcel({
                        className: cls,
                        session: localPrintOpts.sessionText,
                        students: listToPrint,
                        submissions,
                        isExternal: localPrintOpts.practicalType === 'external',
                        selectedSubjectCodes: activeSubjects,
                        printDetails: localPrintOpts
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[11.5px] font-black text-emerald-700 dark:text-emerald-300">Export Consolidated Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Sheet 1 (Cover Letter) + Sheet 2 (Awards Matrix)</div>
                    </div>
                  </button>

                  {/* 4. Export Official Word Doc (.doc) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAwardsMenu(false);
                      const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                      if (!listToPrint || listToPrint.length === 0) {
                        alert(`No student records available to export for Class ${cls}.`);
                        return;
                      }
                      exportConsolidatedAwardsToWord({
                        className: cls,
                        session: localPrintOpts.sessionText,
                        students: listToPrint,
                        submissions,
                        isExternal: localPrintOpts.practicalType === 'external',
                        selectedSubjectCodes: activeSubjects,
                        printDetails: localPrintOpts
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/40 text-left font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText size={13} className="text-sky-600 shrink-0" />
                    <div>
                      <div className="text-[11.5px] font-black text-sky-700 dark:text-sky-300">Export Official Word Doc (.doc)</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Ready for MS Word editing & archiving</div>
                    </div>
                  </button>

                  {/* 5. Export Roster Template (.xlsx) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAwardsMenu(false);
                      const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                      exportCurrentRosterToExcel({
                        className: cls,
                        session: localPrintOpts.sessionText,
                        students: listToPrint,
                        subjectCode: activeSubjects[0] || 'BO',
                        evaluationType: localPrintOpts.practicalType
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download size={13} className="text-slate-500 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold">Export Blank Teacher Roster (.xlsx)</div>
                      <div className="text-[9.5px] text-slate-400 font-semibold">Prefilled student list for offline marks entry</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Attendance Sheet Button */}
            <button
              onClick={() => {
                const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                if (!listToPrint || listToPrint.length === 0) {
                  alert(`No student records available to print for Class ${cls}.`);
                  return;
                }
                printAttendanceSheet({
                  className: cls,
                  session: localPrintOpts.sessionText,
                  students: listToPrint,
                  isExternal: localPrintOpts.practicalType === 'external'
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Print official attendance sheet with 50px signature rows, Reg No, and Class/Exam roll numbers"
            >
              <ClipboardCheck size={11} /> Attendance
            </button>

            {/* Fail List Button */}
            <button
              onClick={() => {
                const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                if (!listToPrint || listToPrint.length === 0) {
                  alert(`No student records available to print for Class ${cls}.`);
                  return;
                }
                printFailList({
                  className: cls,
                  session: localPrintOpts.sessionText,
                  students: listToPrint,
                  submissions,
                  selectedSubjectCodes: activeSubjects,
                  isExternal: localPrintOpts.practicalType === 'external'
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Print list of absent or failing students"
            >
              <AlertTriangle size={11} /> Fail List
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowOptsModal(true)}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer flex items-center border border-slate-200 dark:border-slate-700 shadow-2xs"
              title="Print layout & in-charge options"
            >
              <Settings size={11} />
            </button>
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
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-sky-50 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-700 dark:text-slate-300 border-b border-sky-100">
            <tr>
              <th className="py-2 px-2 text-center">#</th>
              <th className="py-2 px-2 text-center">
                <input type="checkbox" checked={selectedRolls.size === sortedStudents.length && sortedStudents.length > 0} onChange={toggleAllStudents} className="w-3 h-3 text-indigo-600 cursor-pointer" />
              </th>
              <th onClick={() => handleSort('roll')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                CLASS ROLL {sortField === 'roll' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('name')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                STUDENT NAME {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('father')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                FATHER NAME {sortField === 'father' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('stream')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                STREAM {sortField === 'stream' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('examRoll')} className="py-2 px-2 cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                EXAM ROLL {sortField === 'examRoll' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {activeSubjects.map(code => <th key={code} className="py-2 px-1 text-center">{code}</th>)}
              <th onClick={() => handleSort('hashTotal')} className="py-2 px-2 text-center font-black cursor-pointer hover:bg-sky-100 dark:hover:bg-slate-800 select-none">
                HASH TOTAL {sortField === 'hashTotal' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold bg-white dark:bg-slate-900">
            {sortedStudents.map((st, idx) => {
              const rollNo = getRollNo(st) || '—';
              const rawName = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
              const rawFather = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '—';
              const name = toTitleCase(rawName);
              const father = toTitleCase(rawFather);
              const streamRaw = getStudentStreamStr(st, cls);
              const streamDisplay = streamRaw ? toTitleCase(streamRaw) : 'Science';
              const streamLower = streamRaw.toLowerCase();
              const rawExam = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || st['Exam Roll Number'] || '').trim();
              const isCurrSession = normalizePracticalSession(getStudentSession(st)) === '2025-26';
              // For current session 2025-26, board exam roll numbers are not yet issued. Show '—'.
              const examRoll = (!isCurrSession && rawExam && rawExam !== '—' && rawExam !== 'NA' && rawExam !== 'N/A') ? rawExam : '—';
              const uniqueKey = rollNo !== '—' ? rollNo : (st['Board Registration Number'] || st.examRollNo || st.id || `st_${idx}`);
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
                  <td className="py-1.5 px-2 font-mono font-bold text-indigo-600">{rollNo}</td>
                  <td className="py-1.5 px-2 font-bold text-slate-900 dark:text-slate-100">{name}</td>
                  <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">{father}</td>
                  <td className="py-1.5 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      (streamLower.includes('science') || streamLower.includes('med') || streamLower.includes('sci')) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20' :
                      streamLower.includes('commerce') ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20' :
                      'bg-purple-50 text-purple-700 dark:bg-purple-900/20'
                    }`}>{streamDisplay}</span>
                  </td>
                  <td className="py-1.5 px-2 font-mono text-slate-500 text-[10px]">{examRoll}</td>
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
                  <td className="py-1.5 px-2 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950">{rowHashTotal > 0 ? rowHashTotal : '—'}</td>
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
function SelectedSubmissionModal({ selSub, onClose, absentMarker, allStudents = [] }) {
  const [modalSearch, setModalSearch] = useState('');

  // Build high-performance lookup maps from database for full student enrichment (Hooks called unconditionally)
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
      if (exam && exam !== '—' && exam !== 'NA' && exam.length >= 6) m.set(exam, st);
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

  if (!selSub) return null;
  const records = Array.isArray(selSub.records) ? selSub.records : [];
  const canonicalSession = normalizePracticalSession(selSub.sessionText || selSub.session || selSub.Session || '2024-25 (Oct-Nov)');
  const evaluationType = toTitleCase(selSub.practicalType || 'Internal');

  const filteredRecords = records.filter(r => {
    if (!modalSearch.trim()) return true;
    const q = modalSearch.toLowerCase().trim();
    const name = String(r.name || r.studentName || '').toLowerCase();
    const father = String(r.parentage || r.parentName || r.fatherName || '').toLowerCase();
    const roll = String(r.classRollNo || r.rollNo || r.examRollNo || '').toLowerCase();
    const reg = String(r.boardRegNo || r.regNo || '').toLowerCase();
    return name.includes(q) || father.includes(q) || roll.includes(q) || reg.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] space-y-3">
        {/* Header with Title & Detailed Metadata Badges */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Class {selSub.className || selSub.Class} — {selSub.subjectName || selSub.Subject || NAMES[selSub.subjectCode] || selSub.subjectCode}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-black text-[11px] border border-indigo-200 dark:border-indigo-800">
                Session: {canonicalSession}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-[10.5px] border border-emerald-200 dark:border-emerald-800">
                {evaluationType} Practical
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>Submitted by: <strong className="text-slate-800 dark:text-slate-200">{selSub.teacherName || selSub['Teacher Name'] || selSub.teacherEmail || 'Faculty'}</strong> {selSub.teacherEmail && <span className="font-mono text-slate-400">({selSub.teacherEmail})</span>}</span>
              <span>•</span>
              <span className="font-bold text-indigo-600">{records.length} Student Records</span>
              {selSub.timestamp && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[10px] text-slate-400">{selSub.timestamp}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Search Filter Strip */}
        <div className="flex items-center justify-between gap-2">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search roll, reg, student or father..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Showing {filteredRecords.length} of {records.length}
          </span>
        </div>

        {/* Data Table with Full Database Cross-Referencing */}
        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 text-[10px] uppercase font-black tracking-wider text-slate-500 sticky top-0 shadow-xs">
              <tr>
                <th className="py-2.5 px-3 text-center w-10">S.No</th>
                <th className="py-2.5 px-3">Class Roll</th>
                <th className="py-2.5 px-3">Exam Roll</th>
                <th className="py-2.5 px-3">Board Reg. No.</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Father / Parentage</th>
                <th className="py-2.5 px-3">Stream</th>
                <th className="py-2.5 px-3 text-center">Marks (Prac / Viva)</th>
                <th className="py-2.5 px-3 text-right">Total Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
              {filteredRecords.map((r, i) => {
                const v = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase();
                const isAbs = v === (absentMarker || 'AB') || v === 'A' || v === 'ABS';
                
                const cleanReg = cleanRegistrationNumber(r.boardRegNo || r.regNo || r['Board Reg. No.'] || '');
                const cleanExam = String(r.examRollNo || (/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || '').trim().toUpperCase();
                const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();
                const rFather = toTitleCase(r.parentage || r.parentName || r.fatherName || '').trim().toLowerCase();

                // Cross-reference with database students
                const dbSt = (cleanReg && studentByReg.get(cleanReg)) ||
                             (cleanExam && studentByExam.get(cleanExam)) ||
                             (rName && rFather && studentByName.get(`${rName}_${rFather}`)) ||
                             (rName && studentByName.get(rName));

                const studentName = toTitleCase(r.name || r.studentName || (dbSt && (dbSt["Student's Name (as per school records)"] || dbSt["Student's Name"] || dbSt.studentName)) || '—');
                const parent = toTitleCase(r.parentage || r.parentName || r.fatherName || (dbSt && (dbSt["Father's/Guardian's Name (as per school records)"] || dbSt["Father's Name"] || dbSt.fatherName)) || '—');
                const classRoll = r.classRollNo || r.classRoll || (r.rollNo && !/^\d{8,}$/.test(String(r.rollNo)) ? r.rollNo : '') || (dbSt ? getRollNo(dbSt) : '') || '—';
                const examRoll = cleanExam || (dbSt ? (dbSt['Exam R.No. (Current)'] || dbSt.examRollNo) : '') || '—';
                const boardReg = cleanReg || (dbSt ? (dbSt['Board Registration Number'] || dbSt.regNo) : '') || '—';
                const streamVal = r.stream || (dbSt ? (getStudentStreamStr(dbSt, selSub.className || selSub.Class) || dbSt.Stream || dbSt.stream) : '') || '';

                return (
                  <tr key={i} className={'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ' + (isAbs ? 'bg-rose-50/50 dark:bg-rose-950/20' : '')}>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400">{r.sNo || i + 1}</td>
                    <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{classRoll}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{examRoll}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{boardReg}</td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{studentName}</td>
                    <td className="py-2 px-3 text-slate-500">{parent}</td>
                    <td className="py-2 px-3">
                      {streamVal ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {toTitleCase(streamVal)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">{r.practicalMarks ?? '—'}{r.vivaMarks ? ` / ${r.vivaMarks}` : ''}</td>
                    <td className={'py-2 px-3 text-right font-black font-mono ' + (isAbs ? 'text-rose-600' : 'text-emerald-600')}>{r.totalMarks ?? r.practicalMarks ?? '—'}</td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400 font-bold">No individual records found matching search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
  sendEmail,
  emailSt,
  handleWhatsAppShare,
  handleEmailShare,
  handleSaveTeacherPhone,
  setSelSub,
  handleDeleteSubmission
}) {
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [phoneInputVal, setPhoneInputVal] = useState('');
  const [savingPhoneId, setSavingPhoneId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'documents'
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');

  // Filter and unify faculty members (excluding pure admin accounts with 0 submissions)
  const facultyMembers = useMemo(() => {
    const mapByEmail = new Map();

    teachers.forEach(t => {
      const tEmail = String(t.email || '').toLowerCase().trim();
      const r = String(t.role || '').toLowerCase().trim();
      const isPureAdmin = (r === 'admin' || r === 'administrator' || r === 'principal' || r === 'superadmin');

      const teacherSubs = submissions.filter(s => {
        const em = String(s.teacherEmail || s.Email || s.email || '').toLowerCase().trim();
        return em && em === tEmail;
      });

      // Exclude pure admin accounts that do not have any practical submissions
      if (isPureAdmin && teacherSubs.length === 0) return;

      if (tEmail && !mapByEmail.has(tEmail)) {
        mapByEmail.set(tEmail, {
          ...t,
          role: isPureAdmin ? 'Examiner' : (t.role || 'Teacher'),
          submissionsList: teacherSubs
        });
      } else if (tEmail && mapByEmail.has(tEmail)) {
        const prev = mapByEmail.get(tEmail);
        mapByEmail.set(tEmail, {
          ...prev,
          ...t,
          role: prev.role === 'teacher' ? 'Teacher' : (t.role || prev.role || 'Teacher'),
          phone: prev.phone || t.phone || prev.mobile || t.mobile,
          mobile: prev.mobile || t.mobile || prev.phone || t.phone,
          submissionsList: [...prev.submissionsList, ...teacherSubs]
        });
      }
    });

    // Also include any teacher who submitted in submissions collection but wasn't in teachers
    submissions.forEach(s => {
      const sEmail = String(s.teacherEmail || s.Email || s.email || '').toLowerCase().trim();
      const sName = s.teacherName || s['Teacher Name'] || 'Faculty Member';
      if (sEmail && !mapByEmail.has(sEmail)) {
        mapByEmail.set(sEmail, {
          id: sEmail,
          email: sEmail,
          name: sName,
          displayName: sName,
          role: 'Teacher',
          submissionsList: [s]
        });
      }
    });

    let list = Array.from(mapByEmail.values());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => {
        const name = String(t.name || t.displayName || '').toLowerCase();
        const email = String(t.email || '').toLowerCase();
        const phone = String(t.phone || t.mobile || t.phoneNumber || t.whatsapp || '');
        const role = String(t.role || '').toLowerCase();
        const subsMatch = (t.submissionsList || []).some(s => {
          const subj = String(s.subjectName || s.subjectCode || s.subject || '').toLowerCase();
          const cls = String(s.className || s.Class || '').toLowerCase();
          return subj.includes(q) || cls.includes(q);
        });
        return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q) || subsMatch;
      });
    }

    return list;
  }, [teachers, submissions, searchQuery]);

  // Raw documents filtering for the audit mode
  const filteredDocs = useMemo(() => {
    return submissions.filter(s => {
      const cls = String(s.className || s.Class || s.id || '').toLowerCase();
      const subj = String(s.subjectName || s.Subject || s.subjectCode || s.subject || '').toUpperCase();
      if (filterClass !== 'all' && !cls.includes(filterClass.toLowerCase())) return false;
      if (filterSubject !== 'all' && !subj.includes(filterSubject.toUpperCase())) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const id = String(s.id || '').toLowerCase();
        const teacher = String(s.teacherName || s['Teacher Name'] || s.teacherEmail || '').toLowerCase();
        return id.includes(q) || teacher.includes(q) || subj.toLowerCase().includes(q) || cls.includes(q);
      }
      return true;
    });
  }, [submissions, filterClass, filterSubject, searchQuery]);

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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-3 sm:p-4 space-y-3">
      {/* Top Header Strip with Controls & View Mode Toggle */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-indigo-500" /> Faculty & Submissions Management ({facultyMembers.length} Faculty • {submissions.length} Total Submissions)
          </h3>
          <p className="text-[11px] font-semibold text-slate-500">
            Grouped Internal & External practical awards per teacher. Save mobile numbers to Firebase for instant WhatsApp chats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* View Mode Segmented Pill */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-indigo-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              👥 Grouped Faculty View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('documents')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'documents'
                  ? 'bg-indigo-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📄 Document Audit Log ({submissions.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder="Search faculty, subject, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* VIEW 1: GROUPED FACULTY & TWO-SUBMISSIONS IN ONE ROW */}
      {viewMode === 'grouped' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
              <tr>
                <th className="py-2.5 px-3 text-center w-10">#</th>
                <th className="py-2.5 px-3">Faculty / Evaluator</th>
                <th className="py-2.5 px-3">Mobile / WhatsApp Number</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Practical Submissions (Internal & External)</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
              {facultyMembers.map((t, idx) => {
                const phone = String(t.phone || t.mobile || t.phoneNumber || t.whatsapp || '').trim();
                const isEditingThis = editingPhoneId === (t.id || t.email);

                // Group this teacher's submissions by (Class + Subject)
                const groupedMap = {};
                (t.submissionsList || []).forEach(s => {
                  const sCls = s.className || s.Class || (String(s.id).startsWith('12') ? '12th' : '11th');
                  const sCode = String(s.subjectCode || s.subject || s.Subject || 'SUB').toUpperCase();
                  const sName = s.subjectName || s.Subject || NAMES[sCode] || sCode;
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
                  <tr key={`tch_${t.id || t.email || idx}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {toTitleCase(t.name || t.displayName || 'Faculty Member')}
                      </div>
                      <div className="font-mono text-slate-500 text-[10.5px]">
                        {t.email || '—'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
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
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        {t.role || 'Teacher'}
                      </span>
                    </td>
                    {/* COMBINED TWO-SUBMISSIONS IN ONE ROW */}
                    <td className="py-2.5 px-3">
                      {subjectGroups.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {subjectGroups.map((g, gIdx) => {
                            const intCount = g.internal ? (Array.isArray(g.internal.records) ? g.internal.records.length : Object.keys(g.internal).filter(k => k.match(/^\d+\//)).length) : 0;
                            const extCount = g.external ? (Array.isArray(g.external.records) ? g.external.records.length : Object.keys(g.external).filter(k => k.match(/^\d+\//)).length) : 0;

                            return (
                              <div key={gIdx} className="flex items-center gap-2 flex-wrap bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                                <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                                  {g.cls} • {g.name} ({g.code}):
                                </span>

                                {/* Internal Submission Button */}
                                {g.internal ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => setSelSub(g.internal)}
                                      className="px-2.5 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-mono font-bold text-[11px] cursor-pointer border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1 shadow-2xs"
                                      title="Inspect Internal Practical Awards"
                                    >
                                      <Eye size={10} /> Internal ({intCount})
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubmission(g.internal.id)}
                                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                      title="Delete Internal Submission"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No Internal</span>
                                )}

                                <span className="text-slate-300 dark:text-slate-700">•</span>

                                {/* External Submission Button */}
                                {g.external ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => setSelSub(g.external)}
                                      className="px-2.5 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-mono font-bold text-[11px] cursor-pointer border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1 shadow-2xs"
                                      title="Inspect External Practical Awards"
                                    >
                                      <Eye size={10} /> External ({extCount})
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubmission(g.external.id)}
                                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                                      title="Delete External Submission"
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
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
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
                    </td>
                  </tr>
                );
              })}
              {facultyMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                    No faculty members found matching search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: FLAT AUDIT DOCUMENT LOG */}
      {viewMode === 'documents' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
            >
              <option value="all">All Classes</option>
              <option value="11th">Class 11th</option>
              <option value="12th">Class 12th</option>
            </select>
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
            >
              <option value="all">All Subjects</option>
              {CODES.map(c => <option key={c} value={c}>{NAMES[c]} ({c})</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3">Document ID / Title</th>
                  <th className="py-2.5 px-3">Class & Subject</th>
                  <th className="py-2.5 px-3">Session & Type</th>
                  <th className="py-2.5 px-3">Submitted By</th>
                  <th className="py-2.5 px-3 text-center">Records</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                {filteredDocs.map((s, idx) => {
                  const recCount = Array.isArray(s.records) ? s.records.length : Object.keys(s).filter(k => k.match(/^\d+\//)).length;
                  const sessStr = normalizePracticalSession(s.sessionText || s.session || s.Session || s.yearSuffix || '2025-26');
                  return (
                    <tr key={`pract_row_${s.id || idx}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{s.id}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {s.className || s.Class || 'Class'} • {s.subjectName || s.Subject || NAMES[s.subjectCode] || s.subjectCode || 'Subject'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {sessStr} • {toTitleCase(s.practicalType || 'Internal')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{s.teacherName || s['Teacher Name'] || 'Teacher'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{s.teacherEmail || s.Email || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">{recCount}</td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setSelSub(s)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye size={12} /> View Awards
                        </button>
                        <button
                          onClick={() => handleDeleteSubmission(s.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                      No submissions found matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS & PERMISSIONS COMPONENT
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
  revokePerm
}) {
  const [sysSaved, setSysSaved] = useState(false);
  const [printSaved, setPrintSaved] = useState(false);

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
      {/* LEFT COLUMN: Teacher Evaluation Permissions (xl:col-span-5) */}
      <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield size={16} className="text-indigo-500" /> Teacher Permissions
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black border border-indigo-100 dark:border-indigo-800">
            {(settings.permissions || []).length} Active
          </span>
        </div>

        <form onSubmit={grantPerm} className="space-y-2 text-xs">
          <input
            type="email"
            placeholder="Teacher Email Address..."
            value={grantEmail}
            onChange={e => setGrantEmail(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={grantClass}
              onChange={e => setGrantClass(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs cursor-pointer"
            >
              <option value="11th">Class 11th</option>
              <option value="12th">Class 12th</option>
            </select>
            <select
              value={grantSubject}
              onChange={e => setGrantSubject(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs cursor-pointer truncate"
            >
              {CODES.map(c => <option key={c} value={c}>{NAMES[c]} ({c})</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-2xs transition-all flex items-center justify-center gap-1"
          >
            <Shield size={13} /> Grant Evaluation Permission
          </button>
        </form>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs pr-1">
          {(settings.permissions || []).map((p, idx) => (
            <div key={idx} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 dark:text-white truncate text-[11px]">{p.email}</div>
                <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                  <span className="text-indigo-600 font-bold">{p.className}</span> • <span>{NAMES[p.subject] || p.subject}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => revokePerm(idx)}
                className="text-rose-600 hover:text-rose-700 hover:underline font-black text-[10.5px] cursor-pointer shrink-0"
              >
                Revoke
              </button>
            </div>
          ))}
          {(!settings.permissions || settings.permissions.length === 0) && (
            <div className="py-6 text-slate-400 text-center font-bold text-xs">No active teacher permissions granted yet.</div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Global Configuration & Print Defaults (xl:col-span-7) */}
      <div className="xl:col-span-7 space-y-3.5">
        {/* Card 1: Global System Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Settings size={16} className="text-indigo-500" /> Global System Configuration
            </h3>
            <button
              onClick={handleSaveSys}
              disabled={saving}
              className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
                sysSaved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {sysSaved ? <Check size={13} /> : <Save size={13} />} {sysSaved ? 'Saved!' : saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Academic Session</label>
              <input
                type="text"
                value={settings.currentAcademicSession || '2025-26'}
                onChange={e => setSettings({ ...settings, currentAcademicSession: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs"
                placeholder="2025-26"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Evaluation Type</label>
              <select
                value={settings.defaultEvaluationType || 'internal'}
                onChange={e => setSettings({ ...settings, defaultEvaluationType: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs cursor-pointer"
              >
                <option value="internal">Internal Assessment</option>
                <option value="external">External / Outside Assessment</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Absent Symbol</label>
              <input
                type="text"
                value={settings.absentMarker || 'AB'}
                onChange={e => setSettings({ ...settings, absentMarker: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs"
                placeholder="AB"
              />
            </div>
            <div className="sm:col-span-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class 11th Non-Practical Subjects</label>
              <input
                type="text"
                value={settings.nonPractical11 || ''}
                onChange={e => setSettings({ ...settings, nonPractical11: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs"
                placeholder="Codes (e.g. HTC, ITE)"
              />
            </div>
            <div className="sm:col-span-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class 12th Non-Practical Subjects</label>
              <input
                type="text"
                value={settings.nonPractical12 || ''}
                onChange={e => setSettings({ ...settings, nonPractical12: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold outline-none text-xs"
                placeholder="Codes (e.g. HTC, ITE)"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Print Document Defaults & Headers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Printer size={16} className="text-emerald-500" /> Print Document Defaults & Headers
            </h3>
            <button
              onClick={handleSavePrint}
              disabled={saving}
              className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
                printSaved ? 'bg-indigo-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {printSaved ? <Check size={13} /> : <Save size={13} />} {printSaved ? 'Saved!' : saving ? 'Saving...' : 'Save Print Defaults'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {['11th', '12th'].map(c => (
              <div key={c} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                  <Award size={13} className="text-indigo-500" /> Class {c} Print Headers
                </h4>
                <div className="space-y-1.5">
                  <div>
                    <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Institution Name</label>
                    <input
                      type="text"
                      placeholder="Institution Name"
                      value={settings.printDetails?.[c]?.instName || 'Govt. Higher Secondary School Shangus'}
                      onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], instName: e.target.value } } }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Session Text</label>
                      <input
                        type="text"
                        placeholder="Session (e.g. 2025-26)"
                        value={settings.printDetails?.[c]?.sessionText || '2025-26'}
                        onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], sessionText: e.target.value } } }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Incharge Name</label>
                      <input
                        type="text"
                        placeholder="Incharge Name"
                        value={settings.printDetails?.[c]?.inchargeName || 'Mr. Sheikh Gulfam'}
                        onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeName: e.target.value } } }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
