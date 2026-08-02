import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Save, CheckCircle2, XCircle, AlertCircle, RefreshCw, Plus, Trash2, Calendar, ShieldCheck, ArrowUpDown } from 'lucide-react';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import appsScriptApi from '../../services/appsScriptApi';
import ConfirmModal from '../components/ConfirmModal';
import { getCachedCollection } from '../../services/dbCache';

// Master List of Official School Subjects with Codes
const MASTER_SUBJECTS = [
  { name: 'General English', code: 'EN' },
  { name: 'Physics', code: 'PH' },
  { name: 'Chemistry', code: 'CH' },
  { name: 'Biology', code: 'BI' },
  { name: 'Botany', code: 'BO' },
  { name: 'Zoology', code: 'ZO' },
  { name: 'Environmental Science', code: 'ES' },
  { name: 'Physical Education', code: 'PD' },
  { name: 'IT And ITES', code: 'ITE' },
  { name: 'Healthcare', code: 'HTC' },
  { name: 'Computer Science', code: 'CS' },
  { name: 'Geography', code: 'GG' },
  { name: 'Mathematics', code: 'MA' },
  { name: 'Urdu', code: 'UR' },
  { name: 'Education', code: 'ED' },
  { name: 'History', code: 'HT' },
  { name: 'Political Science', code: 'PS' },
  { name: 'Economics', code: 'EC' },
  { name: 'Sociology', code: 'SO' },
  { name: 'Psychology', code: 'PY' },
  { name: 'Accountancy', code: 'AY' },
  { name: 'Business Studies', code: 'BS' },
  { name: 'Entrepreneurship', code: 'EP' },
  { name: 'Arabic', code: 'AR' },
  { name: 'Persian', code: 'PE' },
];

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

// Helper: Extract the END YEAR from a session string (e.g. "2024-25" → "2025", "2025-26" → "2026")
function getSessionEndYear(sessionStr) {
  const s = String(sessionStr || '').trim();
  const rangeMatch = s.match(/\b(20\d\d)-(\d\d)\b/);
  if (rangeMatch) return '20' + rangeMatch[2];
  const yearMatch = s.match(/\b(20\d\d)\b/);
  if (yearMatch) return yearMatch[1];
  return '';
}

// Helper: Strict session matching — same logic as PracticalsPage
// STRICT RULE: If target specifies Mar-Apr or Oct-Nov, student record must also carry that qualifier.
function isSessionMatch(stSession, targetYearSuffix) {
  if (!stSession) return true;
  const sStr = String(stSession).toLowerCase().trim();
  const tStr = String(targetYearSuffix).toLowerCase().trim();
  if (sStr === tStr) return true;

  const aprBianPattern = /\b(apr|bian|biannual|bi-annual|private|annual\s*private)\b/i;
  const sIsAprBian = aprBianPattern.test(sStr);
  const tIsAprBian = aprBianPattern.test(tStr);
  if (sIsAprBian !== tIsAprBian) return false;

  const sIsMarApr = sStr.includes('mar-apr') || sStr.includes('mar/apr');
  const tIsMarApr = tStr.includes('mar-apr') || tStr.includes('mar/apr');
  const sIsOctNov = sStr.includes('oct-nov') || sStr.includes('oct/nov') || sStr.includes('revised');
  const tIsOctNov = tStr.includes('oct-nov') || tStr.includes('oct/nov') || tStr.includes('revised');

  if (sIsMarApr && tIsOctNov) return false;
  if (sIsOctNov && tIsMarApr) return false;
  if ((tIsMarApr || tIsOctNov) && !sIsMarApr && !sIsOctNov) return false;

  const sEndYear = getSessionEndYear(sStr);
  const tEndYear = getSessionEndYear(tStr);
  if (sEndYear && tEndYear) return sEndYear === tEndYear;
  return sStr.includes(tStr) || tStr.includes(sStr);
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

// Helper: Extract Registration Number
function getRegNo(st) {
  if (!st) return '';
  return String(
    st['Board Registration Number'] ||
    st['Board Reg. No.'] ||
    st['Board Reg No'] ||
    st['Reg. No.'] ||
    st['Reg No'] ||
    st['Registration No'] ||
    st['Registration Number'] ||
    st.boardRegNo ||
    st.regNo ||
    st.registrationNo ||
    ''
  ).trim();
}

// Helper: Extract Exam Roll Badges (Current empty + Previous Class Roll if available)
function getExamRollBadges(st) {
  if (!st) return [{ label: 'Exam Roll', value: '—', isCurrent: true }];

  const badges = [];

  // 1. Current Session Exam Roll (empty for now until updated later)
  const currentRoll = st['Current Exam Roll'] || st['Exam Roll 2026'] || st.currentExamRoll;
  badges.push({ label: 'Exam Roll', value: currentRoll || '—', isCurrent: true });

  // 2. Previous Exam Roll (Class 10th / Class 11th)
  const roll10 = st['Exam Roll Number of Class 10th'] || st['10th Exam Roll'] || st.roll10;
  const roll11 = st['Exam Roll Number of Class 11th'] || st['11th Exam Roll'] || st.roll11;
  const generalRoll = (
    st['Exam Roll No'] ||
    st['Exam Roll No.'] ||
    st['Board Roll No'] ||
    st['Board Roll No.'] ||
    st.boardRollNo ||
    st.examRollNo
  );

  if (roll10) {
    badges.push({ label: '10th Roll', value: roll10, isPrev: true });
  } else if (roll11) {
    badges.push({ label: '11th Roll', value: roll11, isPrev: true });
  } else if (generalRoll && generalRoll !== currentRoll) {
    badges.push({ label: 'Prev. Roll', value: generalRoll, isPrev: true });
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

  // Extract Raw Subjects from all possible schema keys
  const subjRaw = extractRawSubjectsString(st);
  let rawStr = subjRaw.trim();

  let subjectsStr = '';
  if (rawStr) {
    subjectsStr = rawStr
      // ── Multi-word / longest first to prevent partial overlaps ──
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

  // If subjects string is empty or equal to stream name, fallback to standard stream combination
  if (!subjectsStr || ['science', 'arts', 'commerce', 'humanities', 'medical', 'general'].includes(subjectsStr.toLowerCase())) {
    if (streamCode === 'S') subjectsStr = 'EN, PH, CH, BI';
    else if (streamCode === 'H') subjectsStr = 'EN, UR, ED, PS';
    else if (streamCode === 'G') subjectsStr = 'EN, AY, BS, EC';
    else subjectsStr = 'EN, PH, CH, BI';
  }

  return streamCode ? `${subjectsStr} (${streamCode})` : subjectsStr;
}

// Helper: Precise Subject Matcher with Biology = Botany = Zoology Equivalence
function isSubjectMatch(student, targetSubjectCode) {
  if (!targetSubjectCode) return true; // All Subjects

  const targetObj = MASTER_SUBJECTS.find(s => s.code === targetSubjectCode || s.name.toLowerCase() === targetSubjectCode.toLowerCase());
  const code = targetObj ? targetObj.code.toLowerCase() : targetSubjectCode.toLowerCase();
  const name = targetObj ? targetObj.name.toLowerCase() : targetSubjectCode.toLowerCase();

  const abbr = String(student.subjectsAbbr || '').toLowerCase();
  const raw = String(student.rawSubjects || '').toLowerCase();

  // 1. Biology (BI) / Botany (BO) / Zoology (ZO) Equivalence Rule
  if (['bi', 'bo', 'zo'].includes(code)) {
    const abbrTokens = abbr.split(/[\s,()]+/).filter(Boolean);
    if (abbrTokens.includes('bi') || abbrTokens.includes('bo') || abbrTokens.includes('zo')) return true;
    if (raw.includes('biology') || raw.includes('botany') || raw.includes('zoology')) return true;
    // Only use stream fallback if NO specific subjects recorded at all
    if (!raw && (abbr.includes('(s)') || raw.includes('science') || raw.includes('med'))) return true;
  }

  // 2. Exact Token Match in abbreviated subject string
  //    Tokenise on commas, spaces, parens — ensures 'PD' != 'PS', 'HTC' != anything else
  const abbrTokens = abbr.split(/[\s,()]+/).filter(Boolean);
  if (abbrTokens.includes(code)) return true;

  // 3. Full-name word-boundary match in raw subjects string.
  //    Negative lookbehind ensures 'Education' (ED) doesn't match inside 'Physical Education' (PD),
  //    'Science' doesn't match inside 'Computer/Political/Environmental Science', etc.
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

  // 4. STRICT fallback: only if student has NO subject data at all (truly unknown)
  //    Never assume a whole stream implies a specific subject when subjects ARE recorded.
  if (!raw && !abbr.replace(/[\s,()\.]/g, '')) {
    // Student has absolutely no subject info — can't determine, include them
    return true;
  }

  return false;
}

const CURRENT_SESSION = '2026';

export default function AttendancePage() {
  const { user, onLogout } = useOutletContext();
  const navigate = useNavigate();

  // Tab State: 'mark' | 'holidays'
  const [activeTab, setActiveTab] = useState('mark');

  // Daily Marking Controls
  const [selectedClass, setSelectedClass] = useState('11th');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSession, setSelectedSession] = useState(CURRENT_SESSION);
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION]);
  const [sortBy, setSortBy] = useState('rollAsc'); // 'rollAsc' | 'rollDesc' | 'nameAsc' | 'formAsc'

  // Attendance Records State
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [students, setStudents] = useState([]);
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [alert, setAlert] = useState(null);

  // Holiday State
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayPurpose, setHolidayPurpose] = useState('');
  const [holidaysList, setHolidaysList] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [showQuickHolidayModal, setShowQuickHolidayModal] = useState(false);

  // Active Holiday Detection for Currently Selected Date
  const currentSelectedHoliday = useMemo(() => {
    if (!selectedDate || !holidaysList || !holidaysList.length) return null;
    return holidaysList.find(h => areDatesMatching(h.dateStr || h.date, selectedDate));
  }, [selectedDate, holidaysList]);

  // Custom Modal Popup States
  const [holidayToDelete, setHolidayToDelete] = useState(null);

  // Detect past sessions from saved attendance records
  useEffect(() => {
    const detectPastSessions = async () => {
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        if (!snap.empty) {
          const sessionsSet = new Set([CURRENT_SESSION]);
          snap.docs.forEach(d => {
            const data = d.data();
            const dateStr = data.date || d.id;
            const matchYear = dateStr.match(/20\d\d/)?.[0];
            if (matchYear && matchYear !== CURRENT_SESSION) {
              sessionsSet.add(matchYear);
            }
          });
          setAvailableSessions(Array.from(sessionsSet).sort((a, b) => b.localeCompare(a)));
        }
      } catch (e) {
        console.warn('Session detection note:', e);
      }
    };
    detectPastSessions();
  }, []);

  // ─── ROSTER CACHE KEY ─────────────────────────────────────────────────────
  // Roster is keyed by class+session and stored in sessionStorage.
  // Changing date or subject NEVER re-fetches from Firebase.
  const getRosterCacheKey = (cls, ses) => `hss_roster_${cls}_${ses}`;

  // ─── STEP 1: Fetch & cache the student ROSTER (class+session only) ─────────
  const fetchRoster = useCallback(async (forceRefresh = false) => {
    const cacheKey = getRosterCacheKey(selectedClass, selectedSession);

    // Try sessionStorage first
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Roster hit — just overlay today's attendance statuses
            setStudents(parsed.map(s => ({ ...s, status: 'P' })));
            setLoadingStudents(false);
            return parsed; // return for status overlay
          }
        }
      } catch (e) { /* ignore */ }
    }

    setLoadingStudents(true);
    let allDiscoveredStudents = [];
    const isCurrent = (selectedSession === CURRENT_SESSION);

    try {
      if (isCurrent) {
        // A. Current Session: use shared admissions cache (30-min TTL)
        try {
          const admDocs = await getCachedCollection('admissions', false, 30 * 60 * 1000);
          admDocs.forEach(data => {
            const items = data.items || data.students || data.records;
            if (Array.isArray(items)) {
              items.forEach(it => {
                const stClass = it.class || it.Class || it['Class'] || data.class || data.Class;
                if (isClassMatch(stClass, selectedClass) && hasAssignedClassRoll(it))
                  allDiscoveredStudents.push({ id: it.formNo || it.rollNo || data.id, ...it });
              });
            } else {
              const stClass = data.class || data.Class || data['Class'] || data['Admission sought for class'];
              if (isClassMatch(stClass, selectedClass) && hasAssignedClassRoll(data))
                allDiscoveredStudents.push({ id: data.id, ...data });
            }
          });
        } catch (e) { console.warn('Admissions lookup note:', e); }

        // B. Also pull from masterRegisters for current session (students may be there too)
        try {
          const masterDocs = await getCachedCollection('masterRegisters', false, 30 * 60 * 1000);
          masterDocs.forEach(data => {
            const items = data.items || data.data || data.records;
            const docSession = data.Session || data.session || '';
            if (Array.isArray(items)) {
              items.forEach(it => {
                const stClass = it.class || it.Class || it['Class'] || data.class || data.Class || '';
                const stSes = it.Session || it.session || docSession;
                if (isClassMatch(stClass, selectedClass) && isSessionMatch(stSes, '2025-26') && hasAssignedClassRoll(it))
                  allDiscoveredStudents.push({ id: it.formNo || it.rollNo || data.id, ...it, session: stSes || '2025-26' });
              });
            } else {
              const stClass = data.class || data.Class || '';
              const stSes = data.Session || data.session || '';
              if (isClassMatch(stClass, selectedClass) && isSessionMatch(stSes, '2025-26') && hasAssignedClassRoll(data))
                allDiscoveredStudents.push({ id: data.id, ...data, session: stSes || '2025-26' });
            }
          });
        } catch (e) { console.warn('masterRegisters (current) lookup note:', e); }

        // C. Fallback: users collection
        if (allDiscoveredStudents.length === 0) {
          try {
            const userDocs = await getCachedCollection('users', false, 30 * 60 * 1000);
            userDocs.forEach(data => {
              const r = String(data.role || data.Role || '').toLowerCase();
              const stClass = data.class || data.initialClass || data.Class;
              if (r.includes('student') && isClassMatch(stClass, selectedClass) && hasAssignedClassRoll(data))
                allDiscoveredStudents.push({ id: data.id, ...data });
            });
          } catch (e) { console.warn('Users lookup note:', e); }
        }

        // D. Last-resort: Apps Script API
        if (allDiscoveredStudents.length === 0) {
          try {
            const res = await appsScriptApi.call('getAttendanceStudentList', { className: selectedClass, date: selectedDate, subjectFilter: '' });
            const masterList = Array.isArray(res) ? res : res?.students || [];
            allDiscoveredStudents = masterList.filter(st => hasAssignedClassRoll(st)).map(st => ({
              id: st.formNo || st.rollNo,
              classRollNo: st.rollNo || st['Class Roll No'] || st.roll_no,
              studentName: getStudentName(st),
              formNo: st.formNo || st['Form Number'],
              regNo: getRegNo(st),
              subjects: st.subjects || st['Subjects'] || '',
              examRollBadges: getExamRollBadges(st),
            }));
          } catch (e) { console.warn('Master roster API note:', e); }
        }
      } else {
        // Historical session: masterRegisters — strict isSessionMatch filtering
        try {
          const masterDocs = await getCachedCollection('masterRegisters', false, 30 * 60 * 1000);
          masterDocs.forEach(data => {
            const items = data.items || data.data || data.records;
            const docSession = data.Session || data.session || '';
            if (Array.isArray(items)) {
              items.forEach(it => {
                const stClass = it.class || it.Class || it['Class'] || data.className || data.id;
                const stSes = it.session || it.Session || it.sessionYear || docSession;
                if (isClassMatch(stClass, selectedClass) && isSessionMatch(stSes, selectedSession) && hasAssignedClassRoll(it))
                  allDiscoveredStudents.push({ id: it.formNo || it.rollNo || it['Board Reg. No.'] || data.id, ...it });
              });
            } else {
              const stClass = data.class || data.Class || data.className || data.id;
              const stSes = data.session || data.Session || data.sessionYear || data.id || '';
              if (isClassMatch(stClass, selectedClass) && isSessionMatch(stSes, selectedSession) && hasAssignedClassRoll(data))
                allDiscoveredStudents.push({ id: data.id, ...data });
            }
          });
        } catch (e) { console.warn('MasterRegisters lookup note:', e); }
      }

      // De-duplicate \u2014 session-scoped by class roll number
      const uniqueMap = new Map();
      allDiscoveredStudents.forEach(st => {
        if (!hasAssignedClassRoll(st)) return;
        const stCls = st.class || st.Class || st['Class'] || selectedClass;
        const clsDigits = String(stCls).replace(/\D/g, '') || String(selectedClass).replace(/\D/g, '');
        const sesScope = getSessionEndYear(String(st.session || st.Session || selectedSession || '')) || selectedSession;
        const rollKey = String(st['Class Roll No'] || st['Class Roll No.'] || st['Class R.No.'] || st['Class R.No'] || st.classRollNo || st.rollNo || '').trim();
        const key = rollKey
          ? `${clsDigits}_${sesScope}_${rollKey.toLowerCase()}`
          : `${clsDigits}_${sesScope}_${String(st.formNo || st['Form No.'] || st.id || '').toLowerCase()}`;
        if (key && !uniqueMap.has(key)) uniqueMap.set(key, st);
      });

      // Format roster (without attendance status — overlaid separately)
      const formatted = Array.from(uniqueMap.values()).map((st, idx) => ({
        rollNo: st['Class Roll No'] || st['Class Roll No.'] || st.classRollNo || st.rollNo || st['Roll No'] || `${idx + 1}`,
        name: getStudentName(st),
        regNo: getRegNo(st),
        examRollBadges: getExamRollBadges(st),
        subjectsAbbr: getAbbreviatedSubjects(st),
        rawSubjects: (() => { const r = extractRawSubjectsString(st); return Array.isArray(r) ? r.join(', ') : String(r); })(),
        status: 'P',
        formNo: st.formNo || st['Form No.'] || st.id || '',
      }));

      // Cache the formatted roster in sessionStorage (survives navigation within same tab session)
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(formatted));
      } catch (e) { /* quota exceeded — skip */ }

      setStudents(formatted);
      return formatted;
    } catch (err) {
      console.error('Failed to fetch student roster:', err);
      setStudents([]);
      return [];
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, selectedSession]); // date is NOT a dep — roster doesn't change per date

// Helper: Normalize date string to YYYY-MM-DD for reliable date comparison
function normalizeDateStr(dStr) {
  if (!dStr) return '';
  const str = String(dStr).trim();
  if (!str) return '';
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      y = parts[0]; m = parts[1].padStart(2, '0'); d = parts[2].padStart(2, '0');
    } else if (parts[2].length === 4) {
      y = parts[2];
      const p0 = parseInt(parts[0], 10);
      if (p0 > 12) {
        d = parts[0].padStart(2, '0'); m = parts[1].padStart(2, '0');
      } else {
        m = parts[0].padStart(2, '0'); d = parts[1].padStart(2, '0');
      }
    }
    if (y && m && d) return `${y}-${m}-${d}`;
  }

  return str;
}

function areDatesMatching(d1, d2) {
  if (!d1 || !d2) return false;
  const s1 = String(d1).trim();
  const s2 = String(d2).trim();
  if (s1 === s2) return true;
  const n1 = normalizeDateStr(s1);
  const n2 = normalizeDateStr(s2);
  return !!(n1 && n2 && n1 === n2);
}

  // ─── STEP 2: Overlay saved attendance statuses for the selected date & subject ────────
  const loadAttendanceStatus = useCallback(async (roster) => {
    if (!selectedClass || !selectedDate) return;
    const clsNorm = String(selectedClass).replace(/class/i, '').trim();
    const subjKey = (selectedSubject && selectedSubject !== 'All Subjects') ? selectedSubject : 'general';

    // Format candidate date variants (ISO: 2026-07-31, US: 07/31/2026, UK: 31/07/2026)
    const normDate = normalizeDateStr(selectedDate);
    const dateParts = normDate ? normDate.split('-') : [];
    const dateISO = normDate;
    const dateUS = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}` : selectedDate;
    const dateUK = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : selectedDate;

    const candidateDocIds = [
      `${clsNorm}_${selectedDate}_${subjKey}`,
      `${clsNorm}_${dateISO}_${subjKey}`,
      `${clsNorm}_${dateUS}_${subjKey}`,
      `${clsNorm}_${dateUK}_${subjKey}`,
      `${clsNorm}_${selectedDate}_general`,
      `${clsNorm}_${dateISO}_general`,
      `${clsNorm}_${dateUS}_general`,
      `${clsNorm}_${dateUK}_general`,
    ];

    try {
      let savedData = null;

      // 1. Try candidate doc IDs
      for (const idCandidate of candidateDocIds) {
        try {
          const snap = await getDoc(doc(db, 'attendance', idCandidate));
          if (snap.exists()) {
            savedData = snap.data();
            break;
          }
        } catch (e) { /* skip */ }
      }

      // 2. Fallback to collection scan if direct doc ID lookup missed
      if (!savedData) {
        try {
          const qSnap = await getDocs(collection(db, 'attendance'));
          qSnap.forEach(d => {
            if (savedData) return;
            const data = d.data();
            const dClassMatch = isClassMatch(data.className || data.class, selectedClass);
            const dDateMatch = areDatesMatching(data.date, selectedDate) || areDatesMatching(data.dateStr, selectedDate) || d.id.includes(selectedDate);
            const dSubjMatch = !selectedSubject || selectedSubject === 'All Subjects' || data.subject === selectedSubject || data.subject === 'General';
            if (dClassMatch && dDateMatch && dSubjMatch) {
              savedData = data;
            }
          });
        } catch (qErr) {
          console.warn('Attendance query fallback note:', qErr);
        }
      }

      if (savedData && Array.isArray(savedData.records) && savedData.records.length > 0) {
        const statusMap = {};
        savedData.records.forEach(r => {
          if (r.rollNo !== undefined && r.rollNo !== null) statusMap[String(r.rollNo).trim()] = r.status;
          if (r.formNo !== undefined && r.formNo !== null) statusMap[String(r.formNo).trim()] = r.status;
          if (r.name) statusMap[String(r.name).toLowerCase().trim()] = r.status;
          if (r.studentName) statusMap[String(r.studentName).toLowerCase().trim()] = r.status;
        });

        setIsEditingSaved(true);
        setStudents(prev => {
          // Prefer the explicitly-passed roster (avoids React batching ambiguity with stale prev)
          const base = (roster && roster.length > 0) ? roster.map(s => ({ ...s, status: 'P' })) : (prev.length > 0 ? prev : []);
          return base.map(s => {
            const rKey = String(s.rollNo || '').trim();
            const fKey = String(s.formNo || '').trim();
            const nKey = String(s.name || '').toLowerCase().trim();
            const matchedStatus = statusMap[rKey] || statusMap[fKey] || statusMap[nKey] || 'P';
            return { ...s, status: matchedStatus };
          });
        });
      } else {
        // No saved attendance found for this date — don't reset statuses,
        // they're already defaulted to 'P' by fetchRoster. Just clear the saved flag.
        setIsEditingSaved(false);
      }
    } catch (e) {
      console.warn('Attendance status read note:', e);
    }
  }, [selectedClass, selectedDate, selectedSubject]);

  // ─── STEP 3: Wire up effects ──────────────────────────────────────────────
  // Single consolidated effect: fetch roster (cached or fresh) then overlay attendance.
  // Handles all combinations of class, session, date, subject changes without race conditions.
  useEffect(() => {
    if (activeTab === 'mark') {
      // fetchRoster is memoised on class+session. It returns cached roster instantly
      // (or fetches from Firestore), then we overlay the attendance for the selected date+subject.
      fetchRoster().then(roster => loadAttendanceStatus(roster));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedClass, selectedSession, selectedDate, selectedSubject]);

  // Fetch Holidays List
  const fetchHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const snap = await getDocs(collection(db, 'holidays'));
      let list = [];
      if (!snap.empty) {
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = new Date(a.dateStr || a.date || 0).getTime() || 0;
          const tB = new Date(b.dateStr || b.date || 0).getTime() || 0;
          return tA - tB;
        });
      }
      setHolidaysList(list);
    } catch (err) {
      console.error('Fetch holidays error:', err);
    } finally {
      setLoadingHolidays(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Save Holiday Record
  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    if (!holidayDate || !holidayLabel) {
      setAlert({ type: 'error', text: 'Date and Holiday label are required.' });
      return;
    }
    try {
      const docId = `holiday_${holidayDate}`;
      await setDoc(doc(db, 'holidays', docId), {
        dateStr: holidayDate,
        label: holidayLabel,
        purpose: holidayPurpose,
        createdAt: new Date().toISOString()
      }, { merge: true });

      setHolidayDate('');
      setHolidayLabel('');
      setHolidayPurpose('');
      fetchHolidays();
      setAlert({ type: 'success', text: `Holiday '${holidayLabel}' saved successfully for ${holidayDate}.` });
    } catch (err) {
      console.error('Save holiday error:', err);
      setAlert({ type: 'error', text: 'Failed to save holiday record.' });
    }
  };

  // Delete Holiday Record
  const handleConfirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      const docId = `holiday_${holidayToDelete.dateStr || holidayToDelete.date}`;
      await deleteDoc(doc(db, 'holidays', docId));
      setHolidayToDelete(null);
      fetchHolidays();
      setAlert({ type: 'success', text: 'Holiday record deleted successfully.' });
    } catch (err) {
      console.error('Delete holiday error:', err);
      setAlert({ type: 'error', text: 'Failed to delete holiday record.' });
    }
  };

  // Toggle single student status (P -> L -> A -> P)
  const toggleStudentStatus = (index) => {
    setStudents((prev) => {
      const updated = [...prev];
      const current = updated[index].status;
      const nextStatus = (current === 'P' || current === 'Present')
        ? 'L'
        : (current === 'L' || current === 'Leave')
          ? 'A'
          : 'P';

      updated[index] = {
        ...updated[index],
        status: nextStatus,
      };
      return updated;
    });
  };

  // Bulk status toggles
  const setAllStatus = (targetStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: targetStatus })));
  };

  // Save Attendance Records
  const handleSaveAttendance = async () => {
    if (!students || students.length === 0) {
      setAlert({ type: 'error', text: 'No students available to mark attendance.' });
      return;
    }
    setSavingAttendance(true);
    setAlert(null);
    try {
      const records = students.map((s) => ({
        rollNo: s.rollNo,
        name: s.name,
        formNo: s.formNo,
        regNo: s.regNo,
        examRollBadges: s.examRollBadges,
        status: s.status,
      }));

      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const docId = `${clsNorm}_${selectedDate}_${selectedSubject || 'general'}`;
      await setDoc(doc(db, 'attendance', docId), {
        docId,
        className: selectedClass,
        date: selectedDate,
        subject: selectedSubject || 'General',
        sessionYear: selectedSession,
        records,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setAlert({ type: 'success', text: `Attendance saved successfully for ${selectedClass} (${students.length} students).` });
    } catch (err) {
      console.error('Save attendance error:', err);
      setAlert({ type: 'error', text: err.message || 'Failed to save attendance.' });
    } finally {
      setSavingAttendance(false);
    }
  };

  // Instant Memoized Subject Filtering in 0ms Memory
  const filteredStudentsBySubject = useMemo(() => {
    if (!selectedSubject) return students;
    return students.filter(s => isSubjectMatch(s, selectedSubject));
  }, [students, selectedSubject]);

  // Dynamic Multi-Column Sorting
  const sortedStudents = useMemo(() => {
    return [...filteredStudentsBySubject].sort((a, b) => {
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
  }, [filteredStudentsBySubject, sortBy]);

  const presentCount = filteredStudentsBySubject.filter((s) => s.status === 'P' || s.status === 'Present').length;
  const leaveCount = filteredStudentsBySubject.filter((s) => s.status === 'L' || s.status === 'Leave').length;
  const absentCount = filteredStudentsBySubject.filter((s) => s.status === 'A' || s.status === 'Absent').length;

  return (
    <div className="w-full min-h-[85vh] py-3 sm:py-4 px-2 sm:px-4" style={{ backgroundColor: 'var(--bg-page, #f8fafc)' }}>
      <SEO
        title="Attendance Portal"
        description="Mark daily attendance and manage holidays."
        path="/portal/teacher/attendance"
      />

      <div className="max-w-6xl mx-auto space-y-3">
        {/* Header Navigation Bar with Logout */}
        <div className="flex items-center justify-between">
          <Link
            to="/portal/teacher"
            className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
            style={{ color: 'var(--teal-accent, #0d9488)' }}
          >
            <ArrowLeft size={14} /> Back to Teacher Workspace
          </Link>
        </div>

        {/* Main Ultra-Compact Attendance Card */}
        <div className="rounded-2xl p-3 sm:p-4 border shadow-md space-y-3" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
          {/* Title Header */}
          <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border-ui, #e2e8f0)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 flex-shrink-0">
                <CalendarCheck size={18} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-black bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-0.5 border border-teal-500/20">
                  <ShieldCheck size={10} /> OFFICIAL ATTENDANCE SYSTEM
                </div>
                <h1 className="text-base font-extrabold leading-tight" style={{ color: 'var(--text-main, #0f172a)' }}>
                  Student Attendance Portal
                </h1>
              </div>
            </div>
          </div>

          {/* Alert Notification */}
          {alert && (
            <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fadeIn ${
              alert.type === 'error'
                ? 'bg-red-500/10 border border-red-500/30 text-red-600'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
            }`}>
              {alert.type === 'error' ? <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
              <span>{alert.text}</span>
            </div>
          )}

          {/* Single Row Horizontal Control Bar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2 rounded-xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs">
            {/* Category Tabs */}
            <div className="flex items-center p-0.5 rounded-lg border bg-slate-200/60 dark:bg-slate-900 border-slate-300 dark:border-slate-700 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('mark')}
                className={`py-1 px-2 rounded-md flex items-center gap-1 font-bold transition-all cursor-pointer ${
                  activeTab === 'mark' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:opacity-80'
                }`}
              >
                <CalendarCheck size={12} />
                <span>Mark Attendance</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('holidays')}
                className={`py-1 px-2 rounded-md flex items-center gap-1 font-bold transition-all cursor-pointer ${
                  activeTab === 'holidays' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300 hover:opacity-80'
                }`}
              >
                <Calendar size={12} />
                <span>Holidays</span>
              </button>
            </div>

            {/* Class Filter */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap">Class:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="12th">12th Class</option>
                <option value="11th">11th Class</option>
                <option value="10th">10th Class</option>
                <option value="9th">9th Class</option>
              </select>
            </div>

            {/* Session Year */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap">Session:</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {availableSessions.map(yr => (
                  <option key={yr} value={yr}>
                    {yr === CURRENT_SESSION ? `Annual Reg. ${yr}` : `Session ${yr}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Official School Master Subjects List Dropdown */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 whitespace-nowrap">Subject:</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 max-w-[170px] truncate cursor-pointer"
              >
                <option value="">All Subjects</option>
                {MASTER_SUBJECTS.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Declare / Edit Holiday Button directly from toolbar */}
            <button
              type="button"
              onClick={() => {
                setHolidayDate(selectedDate);
                setHolidayLabel(currentSelectedHoliday?.label || '');
                setHolidayPurpose(currentSelectedHoliday?.purpose || '');
                setShowQuickHolidayModal(true);
              }}
              className={`py-1 px-2.5 rounded-lg flex items-center gap-1 font-extrabold transition-all cursor-pointer shadow-2xs whitespace-nowrap text-xs ${
                currentSelectedHoliday
                  ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              }`}
              title="Declare or Edit Holiday for selected date"
            >
              <Plus size={13} />
              <span>{currentSelectedHoliday ? 'Edit Holiday' : '+ Declare Holiday'}</span>
            </button>
          </div>

          {/* TAB 1: Mark Attendance */}
          {activeTab === 'mark' && (
            <div className="space-y-3">
              {/* Active Holiday Details Banner (Shown directly on the Mark Attendance interface) */}
              {currentSelectedHoliday && (
                <div className="p-3 sm:p-4 rounded-2xl border-2 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-100 shadow-md space-y-2 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md flex-shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          <span>🎉 Official School Holiday Declared</span>
                        </div>
                        <h2 className="text-base font-black leading-tight text-amber-950 dark:text-amber-100 mt-0.5">
                          {currentSelectedHoliday.label}
                        </h2>
                        <p className="text-xs font-bold opacity-90">
                          Date: <span className="underline">{currentSelectedHoliday.dateStr || currentSelectedHoliday.date}</span> • Class: {selectedClass} ({selectedSession})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setHolidayDate(currentSelectedHoliday.dateStr || currentSelectedHoliday.date);
                          setHolidayLabel(currentSelectedHoliday.label);
                          setHolidayPurpose(currentSelectedHoliday.purpose || '');
                          setShowQuickHolidayModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white cursor-pointer transition-all shadow-xs"
                      >
                        Edit Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setHolidayToDelete(currentSelectedHoliday)}
                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-all shadow-xs"
                      >
                        Delete Holiday
                      </button>
                    </div>
                  </div>

                  {currentSelectedHoliday.purpose && (
                    <div className="p-2 px-3 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-amber-500/20 text-xs font-semibold text-amber-900 dark:text-amber-200">
                      <strong>Holiday Reason / Details:</strong> {currentSelectedHoliday.purpose}
                    </div>
                  )}
                </div>
              )}

              {/* Compact Bulk Action & Sorting Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 px-3 rounded-xl border text-xs" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
                <div className="flex items-center gap-2.5 font-extrabold flex-wrap text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400">Present: {presentCount}</span>
                  <span className="text-amber-600 dark:text-amber-400">Leave: {leaveCount}</span>
                  <span className="text-rose-600 dark:text-rose-400">Absent: {absentCount}</span>
                  <span className="text-slate-400">Total: {filteredStudentsBySubject.length}</span>
                  {selectedSubject && (
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                      Filtered: {selectedSubject}
                    </span>
                  )}
                  {isEditingSaved && (
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Saved Record
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                    <ArrowUpDown size={12} />
                    <span>Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-1.5 py-0.5 rounded-md border text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="rollAsc">Class Roll (Asc)</option>
                      <option value="rollDesc">Class Roll (Desc)</option>
                      <option value="nameAsc">Student Name (A-Z)</option>
                      <option value="formAsc">Form Number</option>
                    </select>
                  </div>

                  <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAllStatus('P')}
                      className="px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 cursor-pointer"
                    >
                      All P
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllStatus('L')}
                      className="px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 cursor-pointer"
                    >
                      All L
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllStatus('A')}
                      className="px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 cursor-pointer"
                    >
                      All A
                    </button>
                  </div>
                </div>
              </div>

              {/* Compact Student List */}
              {loadingStudents ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-1.5 text-teal-500" />
                  Loading Roster for {selectedClass}...
                </div>
              ) : sortedStudents.length > 0 ? (
                <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
                  {sortedStudents.map((st, idx) => {
                    const isP = st.status === 'P' || st.status === 'Present';
                    const isL = st.status === 'L' || st.status === 'Leave';
                    const isA = st.status === 'A' || st.status === 'Absent';
                    const originalIdx = students.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleStudentStatus(originalIdx !== -1 ? originalIdx : idx)}
                        className="p-2 px-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer hover:border-teal-500"
                        style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #e2e8f0)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-black text-[10px] flex items-center justify-center border border-amber-500/20 shadow-xs flex-shrink-0" title={`Serial No. ${idx + 1}`}>
                            #{idx + 1}
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 font-mono font-black text-xs flex items-center justify-center border border-teal-500/20 shadow-xs flex-shrink-0" title={`Class Roll No: ${st.rollNo}`}>
                            {st.rollNo}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight">
                              {st.name}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[9.5px]">
                              {st.formNo && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                                  Form #{st.formNo}
                                </span>
                              )}
                              {st.regNo && (
                                <span className="px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 font-black border border-blue-500/20">
                                  Reg: {st.regNo}
                                </span>
                              )}
                              {(st.examRollBadges || []).map((b, bIdx) => (
                                <span
                                  key={bIdx}
                                  className={`px-1.5 py-0.2 rounded font-mono font-black border ${
                                    b.isCurrent
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {b.label}: {b.value}
                                </span>
                              ))}
                              <span className="px-1.5 py-0.2 rounded font-mono bg-teal-500/10 text-teal-700 dark:text-teal-400 font-black border border-teal-500/20">
                                Subs: {st.subjectsAbbr}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`px-3 py-1 rounded-lg font-black text-[11px] flex items-center gap-1 transition-all shadow-xs ${
                            isP
                              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                              : isL
                                ? 'bg-amber-500 text-white shadow-amber-500/20'
                                : 'bg-rose-600 text-white shadow-rose-500/20'
                          }`}
                        >
                          {isP ? (
                            <>
                              <CheckCircle2 size={12} /> PRESENT (P)
                            </>
                          ) : isL ? (
                            <>
                              <AlertCircle size={12} /> ON LEAVE (L)
                            </>
                          ) : (
                            <>
                              <XCircle size={12} /> ABSENT (A)
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs font-bold text-slate-400 border rounded-xl border-slate-200 dark:border-slate-800">
                  {selectedSubject
                    ? `No students found matching subject filter '${selectedSubject}'.`
                    : `No confirmed registered students with assigned class roll found for ${selectedClass}.`}
                </div>
              )}

              {/* Bottom Compact Save Action */}
              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance || students.length === 0}
                  className="px-5 py-2.5 rounded-xl font-black text-xs text-white bg-teal-600 hover:bg-teal-500 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingAttendance ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Attendance</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Holidays Management */}
          {activeTab === 'holidays' && (
            <div className="space-y-4">
              {/* Holidays Header with Refresh */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-500" /> Manage School Holidays
                </span>
                <button
                  type="button"
                  onClick={fetchHolidays}
                  disabled={loadingHolidays}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                  title="Refresh holidays list from database"
                >
                  <RefreshCw size={11} className={loadingHolidays ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <form onSubmit={handleSaveHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold">Holiday Date *</label>
                  <input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold">Holiday Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. Eid-ul-Fitr, Independence Day"
                    value={holidayLabel}
                    onChange={(e) => setHolidayLabel(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-0.5 flex flex-col justify-end">
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg font-extrabold text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Add Holiday
                  </button>
                </div>
              </form>

              {/* Holidays Table */}
              {loadingHolidays ? (
                <div className="p-6 text-center text-xs font-bold text-slate-400">
                  <RefreshCw size={16} className="animate-spin mx-auto mb-1 text-amber-500" />
                  Loading Holiday Records...
                </div>
              ) : holidaysList.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-black text-[10px] uppercase text-slate-500">S.No.</th>
                        <th className="px-3 py-2 font-black text-[10px] uppercase text-slate-500">Date</th>
                        <th className="px-3 py-2 font-black text-[10px] uppercase text-slate-500">Holiday Name</th>
                        <th className="px-3 py-2 font-black text-[10px] uppercase text-slate-500 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {holidaysList.map((h, idx) => (
                        <tr key={h.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                          <td className="px-3 py-2 font-mono font-bold text-amber-600 dark:text-amber-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-black text-indigo-700 dark:text-indigo-400">{h.dateStr || h.date}</td>
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{h.label}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setHolidayToDelete(h)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete Holiday Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs font-bold text-slate-400 border rounded-xl border-slate-200 dark:border-slate-800 space-y-2">
                  <Calendar size={20} className="mx-auto text-slate-300 dark:text-slate-700" />
                  <p>No holiday records found.</p>
                  <button
                    type="button"
                    onClick={fetchHolidays}
                    className="mx-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[11px] font-bold hover:bg-amber-100 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={11} /> Retry Load
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modern Custom Delete Holiday Confirmation Modal */}
      <ConfirmModal
        isOpen={!!holidayToDelete}
        onClose={() => setHolidayToDelete(null)}
        onConfirm={handleConfirmDeleteHoliday}
        title="Delete Holiday Record"
        message={`Are you sure you want to delete the holiday "${holidayToDelete?.label || ''}" on ${holidayToDelete?.dateStr || holidayToDelete?.date}?`}
        confirmText="Delete Holiday"
        cancelText="Cancel"
        type="danger"
      />

      {/* Quick Holiday Modal Dialog */}
      {showQuickHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs font-bold text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Calendar size={18} />
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Declare / Edit School Holiday</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickHolidayModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              await handleSaveHoliday(e);
              setShowQuickHolidayModal(false);
            }} className="space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Holiday Date</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Holiday Name / Occasion</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Republic Day / Summer Break"
                  value={holidayLabel}
                  onChange={(e) => setHolidayLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Reason / Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. School closed by Order of District Magistrate / Gazetted Holiday"
                  value={holidayPurpose}
                  onChange={(e) => setHolidayPurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickHolidayModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-extrabold text-white bg-amber-600 hover:bg-amber-500 shadow-md cursor-pointer"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
