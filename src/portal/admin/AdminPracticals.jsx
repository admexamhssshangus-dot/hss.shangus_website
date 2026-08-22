import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings, ClipboardCheck, Printer, RefreshCw, CheckCircle2, AlertCircle,
  Award, AlertTriangle, X, Sliders, Users, Mail,
  Download, Upload, FileSpreadsheet, FileText, Trash2, Eye, Save, Shield
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
  printAttendanceSheet,
  printFailList,
  PRACTICAL_SUBJECT_DEFS
} from '../../utils/practicalsPdfGenerator';
import {
  generatePracticalsCsvTemplate,
  exportCurrentRosterToCsv,
  parseAndValidatePracticalsCsv,
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
  const roll = String(
    st['Class Roll No'] ||
    st['Class Roll No.'] ||
    st.classRollNo ||
    st['Class Roll'] ||
    st.rollNo ||
    st.roll_no ||
    st.roll ||
    st['Roll No'] ||
    st['Roll No.'] ||
    st.ClassRoll ||
    ''
  ).trim();
  if (/^\d{8,}$/.test(roll)) return '—';
  return roll;
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

  return String(
    st['Subs'] ||
    st['subs'] ||
    (is12 ? (st['Subjects Studied in Class 11th'] || st['Subjects in Class 11th'] || st['Subjects to be taken in Class 12th']) : '') ||
    (is10 ? (st['Subjects Studied in Class 9th'] || st['Subjects in Class 9th'] || st['Subjects to be taken in Class 10th']) : '') ||
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
  if (!st) return '';
  const clsStr = String(cls || st.Class || st.class || '').toLowerCase();
  const is12 = clsStr.includes('12');

  const s11 = st['Stream Studied in Class 11th'] || st['Stream for Class 11th'] || st['Stream (Class 11th)'] || st['Stream in Class 11th'];
  const s12 = st['Stream for Class 12th'] || st['Stream (Class 12th)'] || st['Stream in Class 12th'];
  const s9 = st['Stream Studied in Class 9th'] || st['Stream for Class 9th'];
  const gen = st['Stream'] || st['stream'] || st['Selected Stream'] || st['Stream (Applied)'] || st['Stream for Admission'];

  let res = is12 ? (s12 || s11 || gen) : (s11 || gen || s12 || s9);
  return String(res || '').toLowerCase().trim();
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
  if (
    str.includes('2024') ||
    str.includes('oct') ||
    str.includes('nov') ||
    str.includes('annual regular 2025') ||
    str.includes('annual 2025') ||
    str.includes('regular 2025')
  ) {
    return '2024-25 (Oct-Nov)';
  }
  if (str.includes('2025-26') || str.includes('2025–26') || str.includes('current')) {
    return '2025-26';
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
  const rollVal = String(
    st['Class Roll No'] ||
    st['Class Roll No.'] ||
    st.classRollNo ||
    st['Class Roll'] ||
    st.rollNo ||
    st.RollNo ||
    st.roll_no ||
    ''
  ).trim();
  const hasRoll = !!(rollVal && rollVal !== '—' && rollVal !== '-' && rollVal !== 'N/A' && rollVal !== 'null' && rollVal !== 'undefined' && rollVal !== '0');

  const statusStr = String(st.Status || st.status || st['Admission Status'] || '').toLowerCase();
  const isRejected = statusStr.includes('reject') || statusStr.includes('cancel') || st.isRejected === true;

  // Once class roll is assigned, the application is approved
  const isApproved = !isRejected && (
    hasRoll ||
    st.isApproved === true ||
    st.Status === 'Approved' ||
    st.status === 'Approved' ||
    statusStr.includes('approved') ||
    statusStr.includes('admitted') ||
    st._source === 'masterRegisters' ||
    st._source === 'practicalsData'
  );

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
  const session = getStudentSession(st) || (source === 'masterRegisters' ? '2024-25 (Oct-Nov)' : '2025-26');
  const classRoll = String(st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st['Class Roll'] || st.rollNo || '').trim();
  const examRoll = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || '').trim();
  const boardReg = String(st['Board Registration Number'] || st['Board Reg. No.'] || st.boardRegNo || st.regNo || '').trim();

  return {
    ...st,
    _source: source,
    'S. No.': sNo,
    'Form No.': formNo,
    'Class Roll No': /^\d{8,}$/.test(classRoll) ? '—' : classRoll,
    'Exam R.No. (Current)': examRoll || (/^\d{8,}$/.test(classRoll) ? classRoll : ''),
    'Board Registration Number': boardReg,
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
        const roll = String(st['Class Roll No'] || '').trim();
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
            'Class Roll No': (!/^\d{8,}$/.test(st['Class Roll No']) ? st['Class Roll No'] : '') || (!/^\d{8,}$/.test(existing['Class Roll No']) ? existing['Class Roll No'] : '') || '—',
            'Exam R.No. (Current)': (exam && exam !== '—' && exam !== 'NA' && exam !== 'N/A') ? exam : (existing['Exam R.No. (Current)'] || existing.examRollNo || '—'),
            'Board Registration Number': (reg && reg !== '—' && reg !== 'N/A') ? reg : (existing['Board Registration Number'] || existing.regNo || '—'),
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

      // 1. Ingest Primary School Student Registers (masterRegisters)
      (masterRegistersData || []).forEach(d => {
        const items = d.items || d.data || d.records;
        const docSession = d.Session || d.session || d.groupKey?.split('_')[0] || d.id?.split('_')[0] || '';
        const docClass = d.class || d.Class || d.groupKey?.split('_')[1] || '';

        if (Array.isArray(items)) {
          items.forEach(it => {
            addOrMergeStudent({
              ...it,
              session: it.Session || it.session || docSession,
              class: it.class || it.Class || it['Class'] || docClass
            }, 'masterRegisters');
          });
        } else {
          addOrMergeStudent({
            ...d,
            session: d.Session || d.session || docSession,
            class: d.class || d.Class || d['Class'] || docClass
          }, 'masterRegisters');
        }
      });

      // 2. Ingest Active Admissions
      (admissionsData || []).forEach(st => addOrMergeStudent(st, 'admissions'));

      // 3. Ingest Practical Submissions
      parsedSubmissions.forEach(sub => {
        const subCls = sub.className || (String(sub.id).startsWith('12') ? '12th' : '11th');
        const subSess = normalizePracticalSession(sub.sessionText || sub.session || '2024-25 (Oct-Nov)');
        const isExternal = sub.practicalType === 'external';

        (sub.records || []).forEach(r => {
          const rawSt = {
            "Student's Name (as per school records)": r.name || r.studentName,
            "Father's/Guardian's Name (as per school records)": r.parentage || r.parentName || r.fatherName,
            'Class Roll No': !isExternal && !/^\d{8,}$/.test(String(r.classRollNo || r.rollNo || '')) ? (r.classRollNo || r.rollNo) : '—',
            'Exam R.No. (Current)': r.examRollNo || (isExternal ? r.rollNo : ''),
            'Board Registration Number': cleanRegistrationNumber(r.boardRegNo || r.regNo || ''),
            'Subjects': r.subjects || '',
            'Subs': r.subjects || '',
            'Class': subCls,
            'class': subCls,
            'Session': subSess,
            'session': subSess,
            'Status': 'Approved',
            'isApproved': true,
            'isExternalCandidate': isExternal,
          };
          if (r.stream) {
            rawSt['Stream'] = r.stream;
          }
          addOrMergeStudent(rawSt, 'practicalsData');
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
              ...prevMatch.st,
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
      setSettings(updatedSettings);
      showAlert('success', `${keyName} saved successfully.`);
    } catch (e) {
      console.error(e);
      showAlert('error', `Failed to save ${keyName}.`);
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

  const handleWhatsAppShare = (phone, text) => {
    let cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      const input = prompt('Enter WhatsApp Mobile Number (10 digits):');
      if (!input) return;
      cleanPhone = String(input).replace(/\D/g, '');
    }
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waUrl = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleEmailShare = (email, subject, bodyText) => {
    let targetEmail = email;
    if (!targetEmail) {
      const input = prompt('Enter Recipient Email Address:');
      if (!input) return;
      targetEmail = input.trim();
    }
    const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
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
              <p className="text-[10px] font-semibold text-slate-500">Evaluations, CSV imports/exports, prints & permissions.</p>
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
                onClick={() => setTab('submissions')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  tab === 'submissions'
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText size={12} /> Submissions Log ({submissions.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('teachers')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  tab === 'teachers'
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users size={12} /> Teachers Roster
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

            {/* CSV Quick Actions Group */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
              <button
                onClick={() => generatePracticalsCsvTemplate()}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                title="Download standardized blank or sample CSV template"
              >
                <Download size={12} /> Template
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                title="Import practical marks from CSV file"
              >
                <Upload size={12} /> Import CSV
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

          {tab === 'submissions' && (
            <SubmissionsLogView
              submissions={submissions}
              setSelSub={setSelSub}
              handleDeleteSubmission={handleDeleteSubmission}
            />
          )}

          {tab === 'teachers' && (
            <TeachersView
              teachers={teachers}
              submissions={submissions}
              sendEmail={sendEmail}
              emailSt={emailSt}
              handleWhatsAppShare={handleWhatsAppShare}
              handleEmailShare={handleEmailShare}
              setSelSub={setSelSub}
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
          />
        )}

        {/* CSV Import Modal */}
        {showImportModal && (
          <CsvImportModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              setShowImportModal(false);
              loadData(true);
              showAlert('success', 'CSV practical records imported successfully.');
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

  const [selectedSubCodes, setSelectedSubCodes] = useState(activeCodesList);

  useEffect(() => {
    setSelectedSubCodes(activeCodesList);
  }, [activeCodesList]);

  const cSts = students.filter(st => {
    const classMatch = isClassMatch(st.class || st.className || st.admittedClass || st['Admission sought for class'], cls);
    if (!classMatch) return false;

    const { isRejected, isApproved, isPending, hasRoll } = checkStudentApprovalState(st);
    if (isRejected) return false;

    if (selectedStatusFilter === 'approved' && !isApproved) return false;
    if (selectedStatusFilter === 'pending' && isApproved) return false;

    if (selectedSession !== 'all') {
      const sess = getStudentSession(st);
      const matchesSess = isSessionMatch(sess, selectedSession);
      if (!matchesSess) return false;
    }
    return true;
  });

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

    const rec = subDoc.records.find(r => {
      const rBoardReg = cleanRegistrationNumber(r.boardRegNo || r['Board Reg. No.'] || '').toUpperCase();
      const rExam = String(r.examRollNo || '').trim().toUpperCase();
      const rClassRoll = String(r.classRollNo || r.classRoll || r['Class Roll No'] || r.sNo || '').trim();
      const rName = toTitleCase(r.name || r.studentName || '').trim().toLowerCase();

      const stBoardReg = cleanRegistrationNumber(
        st['Board Reg. No.'] || st['Board Registration Number'] || st.boardRegNo ||
        st['Board Registration No. (Class 11th)'] || st['Board Registration No. (Class 10th)'] || ''
      ).toUpperCase();
      const stExam = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || '').trim().toUpperCase();
      const stClassRoll = String(
        st['Class R.No.'] || st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st.rollNo || ''
      ).trim();
      const stName = toTitleCase(
        st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || ''
      ).trim().toLowerCase();

      // Primary Key 1: 16-digit Board Registration Number
      if (stBoardReg && rBoardReg && stBoardReg === rBoardReg) return true;

      // Primary Key 2: Exam Roll No (if valid and not placeholder)
      if (stExam && rExam && stExam !== '—' && stExam !== 'NA' && stExam !== 'N/A' && stExam === rExam) return true;

      // Secondary: Class Roll No (STRICT GUARD: Only if student belongs to the SAME session as submission)
      if (stSess === querySess && stClassRoll && rClassRoll && stClassRoll !== '—' && stClassRoll === rClassRoll) return true;

      // Secondary: Student Full Name (STRICT GUARD: Only if student belongs to SAME session and length > 3)
      if (stSess === querySess && stName && rName && stName.length > 3 && stName === rName) return true;

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
        const aR = parseInt(getRollNo(a), 10);
        const bR = parseInt(getRollNo(b), 10);
        if (!isNaN(aR) && !isNaN(bR)) return sortDirection === 'asc' ? aR - bR : bR - aR;
        aVal = getRollNo(a);
        bVal = getRollNo(b);
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
      const roll = getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + cSts.indexOf(st)}`;
      return selectedRolls.has(roll);
    })
    : sortedStudents;

  const toggleSubject = (code) => {
    if (selectedSubCodes.includes(code)) setSelectedSubCodes(selectedSubCodes.filter(c => c !== code));
    else setSelectedSubCodes([...selectedSubCodes, code]);
  };

  const toggleAllStudents = () => {
    if (selectedRolls.size === sortedStudents.length) setSelectedRolls(new Set());
    else setSelectedRolls(new Set(sortedStudents.map((st, i) => getRollNo(st) || st['Board Registration Number'] || st.examRollNo || `20100${2000 + i}`)));
  };

  const toggleStudentRoll = (roll) => {
    const next = new Set(selectedRolls);
    if (next.has(roll)) next.delete(roll); else next.add(roll);
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-2xs space-y-2">
        {/* GROUP 1: Title, Count & Print Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
          {/* Left: Summary Title & Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Class {cls} - Consolidated Awards
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <strong className="text-indigo-600 dark:text-indigo-400">{selectedStudentsList.length}</strong> / {cSts.length} Students • <strong className="text-emerald-600">{activeSubjects.length}</strong> Subs Active
            </span>
          </div>

          {/* Right: Print & Export Actions Group */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => {
                const listToPrint = selectedStudentsList.length > 0 ? selectedStudentsList : sortedStudents;
                if (!listToPrint || listToPrint.length === 0) {
                  alert(`No student records available for Class ${cls}.`);
                  return;
                }
                exportCurrentRosterToCsv({
                  className: cls,
                  session: localPrintOpts.sessionText,
                  students: listToPrint,
                  subjectCode: activeSubjects[0] || 'BO',
                  evaluationType: localPrintOpts.practicalType
                });
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-black cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-2xs"
              title="Export current students table to CSV for offline grading"
            >
              <FileSpreadsheet size={12} /> Export CSV
            </button>
            <button
              onClick={() => {
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
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Printer size={12} /> Print Awards
            </button>
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
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <ClipboardCheck size={12} /> Attendance
            </button>
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
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <AlertTriangle size={12} /> Fail List
            </button>
            <button
              onClick={() => setShowOptsModal(true)}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer flex items-center border border-slate-200 dark:border-slate-700 shadow-2xs"
              title="Print layout & in-charge options"
            >
              <Settings size={12} />
            </button>
          </div>
        </div>

        {/* GROUP 2: Filters, Modes & Toggles Strip */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold">
          {/* Sub-Group: Search Bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[160px] max-w-xs">
            <input
              type="text"
              placeholder="Search student, roll, reg..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>

          {/* Sub-Group: Evaluation Type Segmented */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
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

          {/* Sub-Group: Biology Split/Combine Segmented */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
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

          {/* Sub-Group: Dropdowns */}
          <div className="flex items-center gap-1">
            <select
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
              className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-black outline-none cursor-pointer shadow-2xs"
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
              className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-black outline-none cursor-pointer shadow-2xs"
            >
              <option value="approved">Approved & Roll Only</option>
              <option value="pending">Pending Only</option>
              <option value="all">All Students</option>
            </select>
          </div>

          {/* Sub-Group: Select All Toggle */}
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

        {/* GROUP 3: Compact Subject Badges Strip */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-0.5">Subjects:</span>
            {activeCodesList.map(code => (
              <button
                key={code}
                type="button"
                onClick={() => toggleSubject(code)}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                  selectedSubCodes.includes(code)
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
            <button type="button" onClick={() => setSelectedSubCodes(activeCodesList)} className="hover:underline cursor-pointer">Select All</button>
            <span>•</span>
            <button type="button" onClick={() => setSelectedSubCodes([])} className="hover:underline cursor-pointer">Clear</button>
          </div>
        </div>
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
              const rollNo = String(st['Class Roll No'] || st.rollNo || st.classRollNo || st['Class Roll'] || '—').trim();
              const rawName = st["Student's Name (as per school records)"] || st["Student's Name"] || st.studentName || st.name || '—';
              const rawFather = st["Father's/Guardian's Name (as per school records)"] || st["Father's Name"] || st.fatherName || '—';
              const name = toTitleCase(rawName);
              const father = toTitleCase(rawFather);
              const streamRaw = getStudentStreamStr(st, cls);
              const streamDisplay = streamRaw ? toTitleCase(streamRaw) : 'Science';
              const streamLower = streamRaw.toLowerCase();
              const examRoll = String(st['Exam R.No. (Current)'] || st.examRollNo || st['Exam Roll No'] || st['Exam Roll No.'] || st['Board Registration Number'] || st.boardRegNo || 'NA').trim();
              const isSelected = selectedRolls.has(rollNo);
              const stSess = getStudentSession(st);
              const effectiveSess = selectedSession !== 'all' ? selectedSession : (stSess || '2025-26');
              let rowHashTotal = 0;

              return (
                <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors ${!isSelected ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/30' : ''}`}>
                  <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="py-1.5 px-2 text-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleStudentRoll(rollNo)} className="w-3 h-3 text-indigo-600 cursor-pointer" />
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
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result || '';
        const res = parseAndValidatePracticalsCsv(text);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to parse CSV file.');
        } else {
          setParsedResult(res);
        }
      } catch (err) {
        setErrorMsg('Error reading CSV file: ' + err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
      setParsing(false);
    };
    reader.readAsText(f);
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
              <p className="text-[11px] font-semibold text-slate-500">Upload standardized CSV. Supports 16-digit Board Reg No and overwrites matching session awards.</p>
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
              <p className="text-sm font-black text-slate-800 dark:text-slate-200">Choose a Practicals CSV File to Upload</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Supports Internal and External evaluations. 16-digit Board Registration numbers are automatically cleaned and preserved as exact text strings.</p>
            </div>
            <label className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all">
              <span>{parsing ? 'Parsing CSV File...' : 'Browse & Select CSV File'}</span>
              <input type="file" accept=".csv" onChange={handleFileChange} disabled={parsing} className="hidden" />
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
                <p className="text-[10px] font-black text-slate-400 uppercase">Total CSV Rows</p>
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
// SUBMISSIONS LOG VIEW COMPONENT
// ─────────────────────────────────────────────────────────────
function SubmissionsLogView({ submissions, setSelSub, handleDeleteSubmission }) {
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');

  const filtered = submissions.filter(s => {
    const cls = String(s.className || s.Class || s.id || '').toLowerCase();
    const subj = String(s.subjectName || s.Subject || s.subjectCode || s.subject || '').toUpperCase();
    if (filterClass !== 'all' && !cls.includes(filterClass.toLowerCase())) return false;
    if (filterSubject !== 'all' && !subj.includes(filterSubject.toUpperCase())) return false;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" /> Submissions Log ({submissions.length} Total Documents)
          </h3>
          <p className="text-[11px] font-semibold text-slate-500">Inspect teacher practical award submissions or delete outdated documents.</p>
        </div>
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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
            <tr>
              <th className="py-2.5 px-3">Document ID / Title</th>
              <th className="py-2.5 px-3">Class & Subject</th>
              <th className="py-2.5 px-3">Session & Type</th>
              <th className="py-2.5 px-3">Submitted By</th>
              <th className="py-2.5 px-3 text-center">Records</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
            {filtered.map((s, idx) => {
              const recCount = Array.isArray(s.records) ? s.records.length : Object.keys(s).filter(k => k.match(/^\d+\//)).length;
              return (
                <tr key={`pract_row_${s.id || idx}_${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{s.id}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {s.className || s.Class || 'Class'} • {s.subjectName || s.Subject || NAMES[s.subjectCode] || s.subjectCode || 'Subject'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {s.yearSuffix || s.sessionText || s.Session || '2025-26'} • {s.practicalType || 'Internal'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{s.teacherName || s['Teacher Name'] || 'Teacher'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{s.teacherEmail || s.Email || '-'}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">{recCount}</td>
                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    <button
                      onClick={() => setSelSub(s)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye size={12} /> View Awards
                    </button>
                    <button
                      onClick={() => handleDeleteSubmission(s.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                  No submissions found matching selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SELECTED SUBMISSION RECORDS MODAL
// ─────────────────────────────────────────────────────────────
function SelectedSubmissionModal({ selSub, onClose, absentMarker }) {
  if (!selSub) return null;
  const records = Array.isArray(selSub.records) ? selSub.records : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {selSub.className || selSub.Class} - {selSub.subjectName || selSub.Subject || NAMES[selSub.subjectCode] || selSub.subjectCode}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              Submitted by: <span className="text-indigo-600 font-bold">{selSub.teacherName || selSub['Teacher Name'] || selSub.teacherEmail || 'Teacher'}</span> • {records.length} Student Records
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 text-[10px] uppercase font-black tracking-wider text-slate-500 sticky top-0 shadow-xs">
              <tr>
                <th className="py-2.5 px-4">Roll No</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Father / Parentage</th>
                <th className="py-2.5 px-4 text-center">Marks (Prac / Viva)</th>
                <th className="py-2.5 px-4 text-right">Total Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
              {records.map((r, i) => {
                const v = String(r.totalMarks ?? r.practicalMarks ?? '').toUpperCase();
                const isAbs = v === (absentMarker || 'AB') || v === 'A' || v === 'ABS';
                return (
                  <tr key={i} className={'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ' + (isAbs ? 'bg-rose-50/50 dark:bg-rose-950/20' : '')}>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.rollNo || r.classRollNo || r.boardRoll || '-'}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">{r.name || r.studentName || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-500">{r.parentName || r.fatherName || '-'}</td>
                    <td className="py-2.5 px-4 text-center font-mono">{r.practicalMarks ?? '-'}{r.vivaMarks ? ` / ${r.vivaMarks}` : ''}</td>
                    <td className={'py-2.5 px-4 text-right font-black font-mono ' + (isAbs ? 'text-rose-600' : 'text-emerald-600')}>{r.totalMarks ?? r.practicalMarks ?? '-'}</td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">No individual records found in this document.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TEACHERS VIEW COMPONENT
// ─────────────────────────────────────────────────────────────
function TeachersView({ teachers, submissions, sendEmail, emailSt, handleWhatsAppShare, handleEmailShare, setSelSub }) {
  const facultyMembers = teachers.filter(t => {
    const r = String(t.role || '').toLowerCase();
    return r === 'teacher' || r === 'faculty' || r === 'examiner' || r === 'staff' || r === 'admin';
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-4 space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Users size={16} className="text-indigo-500" /> Faculty & Examiner Roster ({facultyMembers.length})
        </h3>
        <span className="text-[11px] font-bold text-slate-400">
          Click teacher contact buttons or submission counts to inspect awards
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-500">
            <tr>
              <th className="py-2 px-3">Faculty Name</th>
              <th className="py-2 px-3">Email Address</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3 text-center">Submissions</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
            {facultyMembers.map((t, idx) => {
              const tEmail = String(t.email || '').toLowerCase().trim();
              const teacherSubmissions = submissions.filter(s => {
                const em = String(s.teacherEmail || s.Email || s.email || '').toLowerCase().trim();
                return em && em === tEmail;
              });

              return (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{toTitleCase(t.name || t.displayName || 'Faculty Member')}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{t.email}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                      {t.role || 'Teacher'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {teacherSubmissions.length > 0 ? (
                      <button
                        onClick={() => setSelSub(teacherSubmissions[0])}
                        className="px-2.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-mono font-bold text-xs cursor-pointer border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1"
                        title="Click to view submitted award records"
                      >
                        <Eye size={10} /> {teacherSubmissions.length} View
                      </button>
                    ) : (
                      <span className="font-mono text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    <button
                      onClick={() => handleEmailShare(t.email, 'Practicals Update: HSS Shangus', 'Kindly check your practical awards submissions on the portal.')}
                      className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10px] font-bold cursor-pointer"
                    >
                      Email
                    </button>
                    <button
                      onClick={() => handleWhatsAppShare(t.phone || t.mobile, 'Practicals Update: HSS Shangus')}
                      className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold cursor-pointer"
                    >
                      WhatsApp
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  return (
    <div className="space-y-4">
      {/* 1. Subject Permissions Management */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Shield size={16} className="text-indigo-500" /> Teacher Evaluation Permissions
        </h3>
        <form onSubmit={grantPerm} className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="email"
            placeholder="Teacher Email Address..."
            value={grantEmail}
            onChange={e => setGrantEmail(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold flex-1 min-w-[200px]"
          />
          <select value={grantClass} onChange={e => setGrantClass(e.target.value)} className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold">
            <option value="11th">Class 11th</option>
            <option value="12th">Class 12th</option>
          </select>
          <select value={grantSubject} onChange={e => setGrantSubject(e.target.value)} className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold">
            {CODES.map(c => <option key={c} value={c}>{NAMES[c]} ({c})</option>)}
          </select>
          <button type="submit" disabled={saving} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold cursor-pointer shadow-xs">
            Grant Permission
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {(settings.permissions || []).map((p, idx) => (
            <div key={idx} className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{p.email}</span> • <span className="text-indigo-600 font-bold">{p.className}</span> • <span>{NAMES[p.subject] || p.subject}</span>
              </div>
              <button onClick={() => revokePerm(idx)} className="text-rose-600 hover:underline font-bold text-[11px] cursor-pointer">
                Revoke
              </button>
            </div>
          ))}
          {(!settings.permissions || settings.permissions.length === 0) && (
            <div className="py-3 text-slate-400 text-center font-bold">No active teacher permissions granted yet.</div>
          )}
        </div>
      </div>

      {/* 2. Global Configuration */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Settings size={16} className="text-indigo-500" /> Global System Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Default Academic Session</label>
            <input
              type="text"
              value={settings.currentAcademicSession || '2025-26'}
              onChange={e => setSettings({ ...settings, currentAcademicSession: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
              placeholder="2025-26"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Default Evaluation Type</label>
            <select
              value={settings.defaultEvaluationType || 'internal'}
              onChange={e => setSettings({ ...settings, defaultEvaluationType: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
            >
              <option value="internal">Internal Assessment</option>
              <option value="external">External / Outside Assessment</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Global Absent Marker Symbol</label>
            <input
              type="text"
              value={settings.absentMarker || 'AB'}
              onChange={e => setSettings({ ...settings, absentMarker: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
              placeholder="AB"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class 11th Non-Practical Subjects</label>
            <input
              type="text"
              value={settings.nonPractical11 || ''}
              onChange={e => setSettings({ ...settings, nonPractical11: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
              placeholder="Comma separated codes (e.g. EN, MA)"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class 12th Non-Practical Subjects</label>
            <input
              type="text"
              value={settings.nonPractical12 || ''}
              onChange={e => setSettings({ ...settings, nonPractical12: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
              placeholder="Comma separated codes (e.g. EN, MA)"
            />
          </div>
        </div>
        <button
          onClick={() => saveSettingsDoc('Global Configuration', settings)}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <Save size={14} /> Save System Configuration
        </button>
      </div>

      {/* 3. Print Defaults Configuration */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Printer size={16} className="text-emerald-500" /> Print Document Defaults & Headers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {['11th', '12th'].map(c => (
            <div key={c} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-black text-slate-800 dark:text-slate-200 text-xs">Class {c} Print Headers</h4>
              <input
                type="text"
                placeholder="Institution Name"
                value={settings.printDetails?.[c]?.instName || 'Govt. Higher Secondary School Shangus'}
                onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], instName: e.target.value } } }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
              />
              <input
                type="text"
                placeholder="Session Text (e.g. 2025-26)"
                value={settings.printDetails?.[c]?.sessionText || '2025-26'}
                onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], sessionText: e.target.value } } }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
              />
              <input
                type="text"
                placeholder="Principal / Incharge Name"
                value={settings.printDetails?.[c]?.inchargeName || 'Mr. Sheikh Gulfam'}
                onChange={e => setSettings(s => ({ ...s, printDetails: { ...s.printDetails, [c]: { ...s.printDetails?.[c], inchargeName: e.target.value } } }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => saveSettingsDoc('Print Defaults', settings)}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <Save size={14} /> Save Print Defaults
        </button>
      </div>
    </div>
  );
}
