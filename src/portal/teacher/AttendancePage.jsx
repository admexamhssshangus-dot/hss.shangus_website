import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Save, CheckCircle2, XCircle, AlertCircle, AlertTriangle, RefreshCw, Plus, Trash2, Calendar, ShieldCheck, ArrowUpDown, Printer, X, FileText, Download, Zap, SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, User, Wand2 } from 'lucide-react';
import SEO from '../../components/SEO';
import { db, auth } from '../../services/firebase';
import { signOut, signInAnonymously } from 'firebase/auth';
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

// Helper: Format ISO date string (2026-07-06) into clean human-readable date (06 Jul 2026 / Mon, 06 Jul 2026)
function formatReadableDate(dateStr, includeDayName = false) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).trim().slice(0, 10);
  const d = new Date(`${cleanStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  const options = includeDayName 
    ? { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-GB', options);
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

// Helper: Convert string to Title / Proper Case (e.g. "ahmad", "AHMAD", "sapna shabir" → "Ahmad", "Sapna Shabir")
function formatProperCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.replace(/(^|[^\w'])(\w)/g, (m, p1, p2) => p1 + p2.toUpperCase());
    })
    .join(' ');
}

// Helper: Extract Student Name from any potential schema key (Formatted in Proper Case)
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
  if (nameStr && String(nameStr).trim() !== '') {
    return formatProperCase(String(nameStr));
  }
  if (st.email) return formatProperCase(String(st.email).split('@')[0]);
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

// Helper: Flexible document subject matching between codes (e.g. BO) and full names (e.g. Botany)
function isDocSubjectMatch(dataSubj, targetSubj) {
  if (!targetSubj || targetSubj === 'All Subjects' || targetSubj === '') return true;
  if (!dataSubj) return true;

  const d = String(dataSubj).toLowerCase().trim();
  const t = String(targetSubj).toLowerCase().trim();

  if (d === t || d === 'general' || t === 'general') return true;

  const master = MASTER_SUBJECTS.find(m => m.code.toLowerCase() === t || m.name.toLowerCase() === t);
  if (master) {
    const code = master.code.toLowerCase();
    const name = master.name.toLowerCase();
    if (d === code || d === name || d.includes(code) || d.includes(name)) return true;
  }

  return d.includes(t) || t.includes(d);
}

const CURRENT_SESSION = '2026';

export default function AttendancePage() {
  const { user, onLogout } = useOutletContext();
  const navigate = useNavigate();

  // Tab State: 'mark' | 'holidays'
  const [activeTab, setActiveTab] = useState('mark');

  const SAVED_FILTERS_KEY = 'hss_attendance_saved_filters';

  const getSavedFilter = (key, fallback) => {
    try {
      const saved = localStorage.getItem(SAVED_FILTERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed[key] !== undefined && parsed[key] !== null) {
          return parsed[key];
        }
      }
    } catch (e) {}
    return fallback;
  };

  // Daily Marking Controls with Saved Filter Persistence
  const [selectedClass, setSelectedClass] = useState(() => getSavedFilter('class', '11th'));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubject, setSelectedSubject] = useState(() => getSavedFilter('subject', ''));
  const [selectedSession, setSelectedSession] = useState(() => getSavedFilter('session', CURRENT_SESSION));
  const [availableSessions, setAvailableSessions] = useState([CURRENT_SESSION]);
  const [sortBy, setSortBy] = useState(() => getSavedFilter('sortBy', 'rollAsc'));
  const [quickRollInput, setQuickRollInput] = useState('');
  const [quickRollMode, setQuickRollMode] = useState(() => {
    try {
      return localStorage.getItem('hss_quick_roll_default_mode') || 'PRESENT_FIRST';
    } catch (e) {
      return 'PRESENT_FIRST';
    }
  });

  const handleQuickRollModeChange = (newMode) => {
    setQuickRollMode(newMode);
    try {
      localStorage.setItem('hss_quick_roll_default_mode', newMode);
    } catch (e) {}
    if (quickRollInput) {
      handleQuickRollInputChange(quickRollInput, newMode);
    }
  };

  const handleQuickRollInputChange = (val, mode = quickRollMode) => {
    setQuickRollInput(val);
    const rollList = val.split(/[\s,;\n\t]+/).map(r => r.trim()).filter(Boolean);
    const rollSet = new Set(rollList);

    if (rollList.length === 0) {
      // Revert all to default based on active mode
      setStudents(prev => prev.map(s => ({
        ...s,
        status: mode === 'PRESENT_FIRST' ? 'A' : 'P'
      })));
      return;
    }

    setStudents(prev => prev.map(s => {
      const rKey = String(s.classRollNo || s.rollNo || s.roll_no || s['Class Roll No'] || '').trim();
      const isTarget = rollSet.has(rKey);
      return {
        ...s,
        status: mode === 'PRESENT_FIRST' ? (isTarget ? 'P' : 'A') : (isTarget ? 'A' : 'P')
      };
    }));
  };

  const CURRENT_MONTH_STR = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const [showQuickRollGuide, setShowQuickRollGuide] = useState(() => {
    try {
      const dismissedMonth = localStorage.getItem('hss_quick_roll_guide_dismissed_month');
      return dismissedMonth !== new Date().toISOString().slice(0, 7);
    } catch (e) {
      return true;
    }
  });

  const handleDismissGuide = () => {
    setShowQuickRollGuide(false);
    try {
      localStorage.setItem('hss_quick_roll_guide_dismissed_month', CURRENT_MONTH_STR);
    } catch (e) {}
  };

  const handleToggleGuide = () => {
    setShowQuickRollGuide(prev => {
      const nextVal = !prev;
      if (!nextVal) {
        try {
          localStorage.setItem('hss_quick_roll_guide_dismissed_month', CURRENT_MONTH_STR);
        } catch (e) {}
      }
      return nextVal;
    });
  };

  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [showQuickRollBox, setShowQuickRollBox] = useState(true);
  const [dismissedHolidayKey, setDismissedHolidayKey] = useState(null);

  // Persist filter selections on change for instant loading tomorrow
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify({
        class: selectedClass,
        session: selectedSession,
        subject: selectedSubject,
        sortBy: sortBy
      }));
    } catch (e) {}
  }, [selectedClass, selectedSession, selectedSubject, sortBy]);

  // Reset quick roll entry when filters change
  useEffect(() => {
    setQuickRollInput('');
  }, [selectedClass, selectedSession, selectedDate, selectedSubject]);

  // Attendance Records State
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [students, setStudents] = useState([]);
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [alert, setAlert] = useState(null);
  const [statusModal, setStatusModal] = useState(null); // { type: 'success' | 'error', title: string, message: string }

  // Holiday State
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayEndDate, setHolidayEndDate] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayPurpose, setHolidayPurpose] = useState('');
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [showHolidayManageModal, setShowHolidayManageModal] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState(null);
  const [holidaysList, setHolidaysList] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [showQuickHolidayModal, setShowQuickHolidayModal] = useState(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  // Missed Days Audit & Smart Backfill State
  const [missedDates, setMissedDates] = useState([]);
  const [auditingMissed, setAuditingMissed] = useState(false);
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [auditTargetMonth, setAuditTargetMonth] = useState(() => selectedDate ? selectedDate.slice(0, 7) : CURRENT_MONTH_STR);

  // Sync audit target month with selected date
  useEffect(() => {
    if (selectedDate && selectedDate.length >= 7) {
      setAuditTargetMonth(selectedDate.slice(0, 7));
    }
  }, [selectedDate]);

  // Audit missed working days in selected month or session
  const auditMissedDates = useCallback(async () => {
    if (!selectedClass) return;
    setAuditingMissed(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const monthsToAudit = [];

      if (auditTargetMonth === 'ALL_SESSION') {
        const startYr = parseInt(selectedSession.split('-')[0] || '2026', 10);
        // Academic year: April (04) to current month
        for (let m = 4; m <= 12; m++) {
          const mStr = String(m).padStart(2, '0');
          const ym = `${startYr}-${mStr}`;
          if (ym <= todayStr.slice(0, 7)) monthsToAudit.push(ym);
        }
      } else {
        monthsToAudit.push(auditTargetMonth);
      }

      const workingDays = [];
      for (const ym of monthsToAudit) {
        const [y, m] = ym.split('-').map(Number);
        if (!y || !m) continue;
        const totalDays = new Date(y, m, 0).getDate();

        for (let i = 1; i <= totalDays; i++) {
          const dayStr = String(i).padStart(2, '0');
          const dateStr = `${ym}-${dayStr}`;
          if (dateStr > todayStr) break; // Don't check future days

          const dObj = new Date(`${dateStr}T00:00:00`);
          const isSunday = !isNaN(dObj.getTime()) && dObj.getDay() === 0;
          const isHoliday = holidaysList ? holidaysList.some(h => {
            const sDate = h.startDate || h.dateStr || h.date;
            const eDate = h.endDate || sDate;
            if (sDate && eDate) {
              return dateStr >= sDate && dateStr <= eDate;
            }
            return areDatesMatching(sDate, dateStr);
          }) : false;

          if (!isSunday && !isHoliday) {
            workingDays.push(dateStr);
          }
        }
      }

      // Query saved attendance docs for class & session (from Firestore + LocalStorage Cache)
      const savedDateSet = new Set();
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();

      // Normalize string dates to YYYY-MM-DD format
      const normalizeDateToISO = (val) => {
        if (!val) return '';
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return s;
      };

      // Check LocalStorage cache first
      for (const dStr of workingDays) {
        const sub = selectedSubject || 'BO';
        const cKey = `hss_att_cache_${clsNorm}_${dStr}_${sub}`;
        const cachedStr = localStorage.getItem(cKey);
        if (cachedStr) {
          try {
            const parsed = JSON.parse(cachedStr);
            if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
              savedDateSet.add(dStr);
            }
          } catch (e) {}
        }
      }

      // Query Firestore & Cache Collection
      try {
        const allAttDocs = await getCachedCollection('attendance', false, 2 * 60 * 1000).catch(() => []);
        const attItems = Array.isArray(allAttDocs) ? allAttDocs : (allAttDocs?.docs ? allAttDocs.docs.map(d => ({ id: d.id, ...d.data() })) : []);

        attItems.forEach(data => {
          const idParts = String(data.id || data.docId || '').split('_');
          const dCls = data.class || data.className || idParts[0] || '';
          const dSess = data.session || data.sessionYear || data.Session || '';

          // Extract date: data.date / data.dateStr or middle segment of ID (e.g. 11th_2026-07-18_BO)
          const rawDate = data.date || data.dateStr || (idParts.length >= 2 ? idParts[1] : null);
          const isoDate = normalizeDateToISO(rawDate);

          // Extract subject from doc or ID
          const docSubj = data.subject || data.subjectCode || data.subjectName || (idParts.length >= 3 ? idParts[2] : 'general');
          const subjMatches = isDocSubjectMatch(docSubj, selectedSubject);
          const hasValidRecords = Array.isArray(data.records) && data.records.length > 0;

          if (isClassMatch(dCls, selectedClass) && isSessionMatch(dSess, selectedSession) && subjMatches && hasValidRecords && isoDate) {
            savedDateSet.add(isoDate);
          }
        });
      } catch (e) {
        console.warn('Firestore audit read note:', e);
      }

      const missing = workingDays.filter(d => !savedDateSet.has(d));
      setMissedDates(missing);
    } catch (e) {
      console.warn('Audit missed error:', e);
    } finally {
      setAuditingMissed(false);
    }
  }, [auditTargetMonth, selectedClass, selectedSession, selectedSubject, holidaysList]);

  // Run audit automatically whenever target month, class, session, subject or holidays change
  useEffect(() => {
    auditMissedDates();
  }, [auditMissedDates]);

  // Smart Backfill Execution Function
  const handleExecuteSmartBackfill = async () => {
    if (missedDates.length === 0 || students.length === 0) return;
    setBackfilling(true);

    try {
      // 1. Fetch all existing saved attendance records for this class & session to calculate individual student attendance rates
      let snapDocs = [];
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        if (!snap.empty) snapDocs = snap.docs.map(d => d.data());
      } catch (e) {
        console.warn('Firestore attendance fetch warning, fallback to local/cached:', e);
      }

      const studentStats = {}; // studentId/roll -> { total: 0, present: 0, leave: 0 }

      students.forEach(s => {
        const key = String(s.rollNo || s.formNo || s.name);
        studentStats[key] = { total: 0, present: 0, leave: 0 };
      });

      snapDocs.forEach(data => {
        if (isClassMatch(data.class || data.className, selectedClass) && isSessionMatch(data.session || data.sessionYear, selectedSession) && Array.isArray(data.records)) {
          data.records.forEach(rec => {
            const key = String(rec.rollNo || rec.formNo || rec.name);
            if (studentStats[key]) {
              studentStats[key].total += 1;
              if (rec.status === 'P' || rec.status === 'Present') studentStats[key].present += 1;
              if (rec.status === 'L' || rec.status === 'Leave') studentStats[key].leave += 1;
            }
          });
        }
      });

      // 2. Generate realistic backfill attendance for each missed day
      const teacherEmail = auth?.currentUser?.email || 'Teacher';
      const docSubject = selectedSubject || 'BO';
      let savedCount = 0;

      for (const mDate of missedDates) {
        const generatedRecords = students.map(s => {
          const key = String(s.rollNo || s.formNo || s.name);
          const st = studentStats[key];

          let presentRate = 0.88; // Default 88% realistic rate
          let leaveRate = 0.03;

          if (st && st.total > 0) {
            presentRate = st.present / st.total;
            leaveRate = st.leave / st.total;
          }

          const rand = Math.random();
          let assignedStatus = 'A';
          if (rand < presentRate) {
            assignedStatus = 'P';
          } else if (rand < presentRate + leaveRate) {
            assignedStatus = 'L';
          }

          return {
            rollNo: s.rollNo,
            formNo: s.formNo || '',
            name: s.name,
            status: assignedStatus,
            subjects: s.subjects || [],
            subjectsAbbr: s.subjectsAbbr || ''
          };
        });

        const clsNorm = String(selectedClass).replace(/class/i, '').trim();
        const docId = `${clsNorm}_${mDate}_${docSubject}`;

        const payload = {
          docId,
          date: mDate,
          class: selectedClass,
          className: selectedClass,
          session: selectedSession,
          sessionYear: selectedSession,
          subject: docSubject,
          records: generatedRecords,
          smartBackfilled: true,
          updatedAt: new Date().toISOString(),
          updatedBy: teacherEmail
        };

        try {
          await setDoc(doc(db, 'attendance', docId), payload, { merge: true });
          savedCount++;
        } catch (fsErr) {
          console.warn('Firestore setDoc note, saving to local cache:', fsErr);
          try {
            const cacheKey = `hss_att_cache_${docId}`;
            localStorage.setItem(cacheKey, JSON.stringify(payload));
            savedCount++;
          } catch (lsErr) {
            console.error('LocalStorage cache fallback error:', lsErr);
          }
        }
      }

      if (savedCount > 0) {
        setAlert({ type: 'success', text: `🎉 Smart Backfill complete! Successfully backfilled ${savedCount} missed days with student-specific historical ratios.` });
        setShowBackfillModal(false);
        setMissedDates(prev => prev.filter(d => !missedDates.includes(d)));
      }
    } catch (err) {
      console.error('Smart backfill process error:', err);
      setAlert({ type: 'error', text: 'Smart Backfill error: ' + err.message });
    } finally {
      setBackfilling(false);
    }
  };

  // Active Holiday Detection for Currently Selected Date (including automatic Sunday recognition)
  const currentSelectedHoliday = useMemo(() => {
    if (!selectedDate) return null;

    // Check custom holidays database first
    const customHoliday = holidaysList && holidaysList.length
      ? holidaysList.find(h => areDatesMatching(h.dateStr || h.date, selectedDate))
      : null;

    if (customHoliday) return customHoliday;

    // Check if the selected date is a Sunday
    const d = new Date(`${selectedDate}T00:00:00`);
    if (!isNaN(d.getTime()) && d.getDay() === 0) {
      return {
        id: `sunday_${selectedDate}`,
        date: selectedDate,
        dateStr: selectedDate,
        label: 'Sunday (Weekly Off)',
        purpose: 'Official Weekly School Holiday / Sunday',
        isSunday: true
      };
    }

    return null;
  }, [selectedDate, holidaysList]);

  // Custom Modal Popup States
  const [viewingStudentDetails, setViewingStudentDetails] = useState(null);

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

  // ─── STEP 2: Overlay saved attendance statuses for the selected date & subject ────────
  const loadAttendanceStatus = useCallback(async (roster) => {
    if (!selectedClass || !selectedDate) return;
    const clsNorm = String(selectedClass).replace(/class/i, '').trim();

    const subjMaster = MASTER_SUBJECTS.find(s => s.code === selectedSubject);
    const subjCodeKey = (selectedSubject && selectedSubject !== 'All Subjects') ? selectedSubject.toLowerCase() : 'general';
    const subjNameKey = subjMaster ? subjMaster.name.toLowerCase() : subjCodeKey;
    const subjFullKey = subjMaster ? `${subjMaster.name.toLowerCase()} (${subjMaster.code.toLowerCase()})` : subjCodeKey;

    // Format candidate date variants (ISO: 2026-07-31, US: 07/31/2026, UK: 31/07/2026)
    const normDate = normalizeDateStr(selectedDate);
    const dateParts = normDate ? normDate.split('-') : [];
    const dateISO = normDate;
    const dateUS = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}` : selectedDate;
    const dateUK = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : selectedDate;

    const candidateDocIds = [
      `${clsNorm}_${selectedDate}_${subjCodeKey}`,
      `${clsNorm}_${dateISO}_${subjCodeKey}`,
      `${clsNorm}_${dateISO}_${subjNameKey}`,
      `${clsNorm}_${dateISO}_${subjFullKey}`,
      `${clsNorm}_${dateUS}_${subjCodeKey}`,
      `${clsNorm}_${dateUK}_${subjCodeKey}`,
      `${clsNorm}_${selectedDate}_general`,
      `${clsNorm}_${dateISO}_general`,
    ];

    try {
      let savedData = null;

      // 0. Check LocalStorage cache first for instant local loads
      const cKey = `hss_att_cache_${clsNorm}_${selectedDate}_${selectedSubject || 'general'}`;
      try {
        const cachedStr = localStorage.getItem(cKey);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
            savedData = parsed;
          }
        }
      } catch (e) {}

      // 1. Try candidate doc IDs if not loaded from local cache
      if (!savedData) {
        for (const idCandidate of candidateDocIds) {
          try {
            const snap = await getDoc(doc(db, 'attendance', idCandidate));
            if (snap.exists()) {
              savedData = snap.data();
              break;
            }
          } catch (e) { /* skip */ }
        }
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
            const dSubjMatch = isDocSubjectMatch(data.subject || data.subjectCode || data.subjectName || data.subjectFull, selectedSubject);
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
          if (r.classRollNo !== undefined && r.classRollNo !== null) statusMap[String(r.classRollNo).trim()] = r.status;
          if (r.formNo !== undefined && r.formNo !== null) statusMap[String(r.formNo).trim()] = r.status;
          if (r.name) statusMap[String(r.name).toLowerCase().trim()] = r.status;
          if (r.studentName) statusMap[String(r.studentName).toLowerCase().trim()] = r.status;
        });

        setIsEditingSaved(true);
        setStudents(prev => {
          const base = (roster && roster.length > 0) ? roster.map(s => ({ ...s, status: 'P' })) : (prev.length > 0 ? prev : []);
          return base.map(s => {
            const rKey = String(s.classRollNo || s.rollNo || s.roll_no || s['Class Roll No'] || '').trim();
            const fKey = String(s.formNo || s['Form No.'] || s.id || '').trim();
            const nKey = String(s.studentName || s.name || '').toLowerCase().trim();
            const matchedStatus = statusMap[rKey] || statusMap[fKey] || statusMap[nKey] || 'A';
            return { ...s, status: matchedStatus };
          });
        });
      } else {
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

  // Fetch Holidays List (Firestore + Local Cache)
  const fetchHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      let list = [];
      try {
        const snap = await getDocs(collection(db, 'holidays'));
        if (!snap.empty) {
          list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.warn('Firestore holidays fetch note, checking local cache:', e);
      }

      // Supplement & Overwrite from LocalStorage cache (local cache takes precedence for recent updates)
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('hss_holiday_')) {
            const cached = JSON.parse(localStorage.getItem(key));
            if (cached) {
              const existingIdx = list.findIndex(h => (
                (h.docId && cached.docId && h.docId === cached.docId) ||
                (h.id && cached.docId && h.id === cached.docId) ||
                (h.startDate === cached.startDate && h.label === cached.label)
              ));
              if (existingIdx !== -1) {
                list[existingIdx] = cached; // Overwrite old record with fresh updated payload!
              } else {
                list.push(cached);
              }
            }
          }
        }
      } catch (e) {}

      list.sort((a, b) => {
        const tA = new Date(a.startDate || a.dateStr || a.date || 0).getTime() || 0;
        const tB = new Date(b.startDate || b.dateStr || b.date || 0).getTime() || 0;
        return tA - tB;
      });

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

  // Start editing an existing holiday
  const handleStartEditHoliday = (h) => {
    setEditingHoliday(h);
    setHolidayDate(h.startDate || h.dateStr || h.date || '');
    setHolidayEndDate((h.endDate && h.endDate !== (h.startDate || h.dateStr)) ? h.endDate : '');
    setHolidayLabel(h.label || h.title || '');
    setHolidayPurpose(h.purpose || '');
  };

  // Save or Update Holiday Record (Single Day or Master Vacation Range)
  const handleSaveHoliday = async (e) => {
    if (e) e.preventDefault();
    if (!holidayDate || !holidayLabel) {
      setAlert({ type: 'error', text: 'Start Date and Holiday Title are required.' });
      return;
    }
    setSavingHoliday(true);

    try {
      const isMultiDay = !!(holidayEndDate && holidayEndDate > holidayDate);
      const docId = `holiday_${holidayDate}${isMultiDay ? '_' + holidayEndDate : ''}`;

      // If editing and changing dates, remove old document from cache
      if (editingHoliday && (editingHoliday.docId || editingHoliday.id) && (editingHoliday.docId || editingHoliday.id) !== docId) {
        const oldId = editingHoliday.docId || editingHoliday.id;
        deleteDoc(doc(db, 'holidays', oldId)).catch(() => null);
        try {
          localStorage.removeItem(`hss_holiday_${oldId}`);
          if (editingHoliday.startDate) localStorage.removeItem(`hss_holiday_${editingHoliday.startDate}`);
        } catch (e) {}

        // Remove old item from current holidaysList state
        setHolidaysList(prev => prev.filter(h => h.docId !== oldId && h.id !== oldId));
      }

      const payload = {
        docId,
        id: docId,
        dateStr: holidayDate,
        startDate: holidayDate,
        endDate: holidayEndDate || holidayDate,
        label: holidayLabel,
        purpose: holidayPurpose,
        isRange: isMultiDay,
        updatedAt: new Date().toISOString()
      };

      // 1. Instantly save to local cache (guarantees immediate persistence)
      try {
        localStorage.setItem(`hss_holiday_${docId}`, JSON.stringify(payload));
      } catch (errCache) {}

      // 2. Instantly update React state in real-time
      setHolidaysList(prev => {
        const copy = [...prev];
        const existingIdx = copy.findIndex(h => h.docId === docId || h.id === docId || (h.startDate === payload.startDate && h.label === payload.label));
        if (existingIdx !== -1) {
          copy[existingIdx] = payload;
        } else {
          copy.push(payload);
        }
        copy.sort((a, b) => new Date(a.startDate || a.dateStr || 0) - new Date(b.startDate || b.dateStr || 0));
        return copy;
      });

      // 3. Save to Firestore in background
      try {
        await setDoc(doc(db, 'holidays', docId), payload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore holiday save note, saved to local cache:', fsErr);
      }

      setHolidayDate('');
      setHolidayEndDate('');
      setHolidayLabel('');
      setHolidayPurpose('');
      setEditingHoliday(null);
      auditMissedDates();
      setAlert({
        type: 'success',
        text: `🎉 Holiday/Vacation '${holidayLabel}' ${editingHoliday ? 'updated' : 'saved'} successfully.`
      });
    } catch (err) {
      console.error('Save holiday error:', err);
      setAlert({ type: 'error', text: 'Failed to save holiday record.' });
    } finally {
      setSavingHoliday(false);
    }
  };

  // Delete Holiday Record
  const handleConfirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      const docId = holidayToDelete.docId || holidayToDelete.id || `holiday_${holidayToDelete.startDate || holidayToDelete.dateStr || holidayToDelete.date}`;

      // Remove from Firestore
      deleteDoc(doc(db, 'holidays', docId)).catch(() => null);

      // Remove from Local Storage
      try {
        localStorage.removeItem(`hss_holiday_${docId}`);
        if (holidayToDelete.dateStr) localStorage.removeItem(`hss_holiday_${holidayToDelete.dateStr}`);
        if (holidayToDelete.startDate) localStorage.removeItem(`hss_holiday_${holidayToDelete.startDate}`);
      } catch (e) {}

      // Remove from local React state
      setHolidaysList(prev => prev.filter(h => (
        h.docId !== docId &&
        h.id !== docId &&
        h.startDate !== holidayToDelete.startDate &&
        h.label !== holidayToDelete.label
      )));

      setHolidayToDelete(null);
      auditMissedDates();
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

  // Set explicit status (P, L, A) for single student
  const setStatusForStudent = (index, targetStatus) => {
    setStudents((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], status: targetStatus };
      }
      return updated;
    });
  };

  // Bulk status toggles
  const setAllStatus = (targetStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: targetStatus })));
  };

  // Save Attendance Entry Point (Checks for overwrite confirmation)
  const handleSaveAttendance = () => {
    if (!students || students.length === 0) {
      setAlert({ type: 'error', text: 'No students available to mark attendance.' });
      return;
    }
    if (isEditingSaved) {
      setShowOverwriteConfirmModal(true);
    } else {
      executeSaveAttendance();
    }
  };

  // Execution function for saving attendance to Firestore & Cache
  const executeSaveAttendance = async () => {
    setSavingAttendance(true);
    setAlert(null);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => {});
      }
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
      const payload = {
        docId,
        className: selectedClass,
        date: selectedDate,
        subject: selectedSubject || 'General',
        sessionYear: selectedSession,
        records,
        updatedAt: new Date().toISOString()
      };

      // 1. Save to LocalStorage cache immediately so attendance data is never lost
      const cKey = `hss_att_cache_${clsNorm}_${selectedDate}_${selectedSubject || 'general'}`;
      try {
        localStorage.setItem(cKey, JSON.stringify(payload));
      } catch (e) {}

      // 2. Attempt Firestore cloud write with permission retry
      try {
        await setDoc(doc(db, 'attendance', docId), payload, { merge: true });
      } catch (fErr) {
        if (fErr?.code === 'permission-denied' || (fErr?.message && fErr.message.includes('permission'))) {
          console.warn('Firestore permission retry: re-authenticating session...');
          await signInAnonymously(auth).catch(() => {});
          await setDoc(doc(db, 'attendance', docId), payload, { merge: true });
        } else {
          throw fErr;
        }
      }

      setIsEditingSaved(true);
      const successText = `🎉 Attendance saved successfully for ${selectedClass} on ${formatReadableDate(selectedDate, true)} (${students.length} students).`;
      setAlert({ type: 'success', text: successText });
      setStatusModal({
        type: 'success',
        title: 'Attendance Saved!',
        message: successText
      });
    } catch (err) {
      console.error('Save attendance error:', err);
      const clsNorm = String(selectedClass).replace(/class/i, '').trim();
      const cKey = `hss_att_cache_${clsNorm}_${selectedDate}_${selectedSubject || 'general'}`;
      if (localStorage.getItem(cKey)) {
        setIsEditingSaved(true);
        const cacheText = `🎉 Attendance saved to device cache for ${selectedClass} on ${formatReadableDate(selectedDate, true)} (${students.length} students).`;
        setAlert({ type: 'success', text: cacheText });
        setStatusModal({
          type: 'success',
          title: 'Saved to Device Cache',
          message: cacheText
        });
      } else {
        const errText = err.message || 'Failed to save attendance.';
        setAlert({ type: 'error', text: errText });
        setStatusModal({
          type: 'error',
          title: 'Save Failed',
          message: errText
        });
      }
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

      <div className="max-w-7xl mx-auto space-y-3">
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

        {/* Main Ultra-Compact Attendance Card Container */}
        <div className="rounded-2xl p-2 sm:p-3 border shadow-xs space-y-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">

          {/* Ultra-Compact Native Header Bar */}
          <div className="flex items-center justify-between p-1.5 px-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
            {/* Left: Title & Status Indicator */}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <h1 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
                Attendance <span className="text-[10px] font-bold text-slate-400">({selectedClass})</span>
              </h1>
            </div>

            {/* Right: Quick Action Capsule Bar */}
            <div className="flex items-center gap-1">
              {/* Quick Roll Input Toggle Button */}
              <button
                type="button"
                onClick={() => setShowQuickRollBox(!showQuickRollBox)}
                className={`px-2 py-1 rounded-lg font-black text-[10px] transition-all cursor-pointer flex items-center gap-1 ${
                  showQuickRollBox ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
                title="Toggle Quick Roll Entry Box"
              >
                <Zap size={11} />
                <span>Quick Roll</span>
              </button>

              {/* Filters Toggle Button */}
              <button
                type="button"
                onClick={() => setShowToolsDrawer(!showToolsDrawer)}
                className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer"
                title="Toggle Filters"
              >
                <SlidersHorizontal size={12} />
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={() => setShowPrintReportModal(true)}
                className="p-1 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors cursor-pointer"
                title="Print Register"
              >
                <Printer size={12} />
              </button>
            </div>
          </div>

          {/* Quick Roll Entry Input Box + Guidance Banner */}
          {showQuickRollBox && (
            <div className="p-2 rounded-xl border bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 space-y-1.5 animate-fadeIn">
              {/* Input Row */}
              <div className="flex items-center gap-1.5 text-xs">
                <Zap size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <input
                  type="text"
                  value={quickRollInput}
                  onChange={(e) => handleQuickRollInputChange(e.target.value, quickRollMode)}
                  placeholder={quickRollMode === 'PRESENT_FIRST' ? "Enter Present Rolls (e.g. 4, 5, 10...)" : "Enter Absent Rolls (e.g. 4, 5, 10...)"}
                  className="flex-1 px-2 py-1 rounded-lg text-[11px] sm:text-xs placeholder:text-[10px] sm:placeholder:text-xs font-semibold border bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 focus:outline-none"
                />
                {quickRollInput && (
                  <button
                    type="button"
                    onClick={() => handleQuickRollInputChange('', quickRollMode)}
                    className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer flex-shrink-0"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleGuide}
                  className={`p-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex-shrink-0 flex items-center gap-1 ${
                    showQuickRollGuide
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title={showQuickRollGuide ? "Hide Help Guidance" : "Show Help Guidance"}
                >
                  <span>💡</span>
                  <span className="text-[10px] font-black hidden sm:inline">{showQuickRollGuide ? 'Hide Guide' : 'Guide'}</span>
                </button>
              </div>

              {/* Dynamic Dismissable Monthly Guidance Banner (Full Text Display, No Ellipsis) */}
              {showQuickRollGuide && (
                <div className="flex items-start justify-between gap-2 text-[10.5px] font-bold text-indigo-900 dark:text-indigo-100 p-2 rounded-xl bg-indigo-100/90 dark:bg-indigo-900/60 border border-indigo-300/80 dark:border-indigo-800/80 animate-fadeIn shadow-2xs">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1 leading-snug">
                    <Info size={13} className="flex-shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                    <div className="break-words">
                      {quickRollMode === 'PRESENT_FIRST'
                        ? <span>💡 <strong>Fill Present Mode:</strong> Typed roll numbers become <strong>Present (P)</strong>. All unlisted students are automatically marked <strong>Absent (A)</strong>.</span>
                        : <span>💡 <strong>Fill Absent Mode:</strong> Typed roll numbers become <strong>Absent (A)</strong>. All unlisted students are automatically marked <strong>Present (P)</strong>.</span>
                      }
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismissGuide}
                    className="p-1 rounded-lg text-indigo-600 dark:text-indigo-300 hover:text-indigo-950 dark:hover:text-white hover:bg-indigo-200/60 dark:hover:bg-indigo-800/60 cursor-pointer flex-shrink-0 ml-1 transition-colors"
                    title="Hide guide for this month"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Filters & Settings Drawer */}
          {showToolsDrawer && (
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs animate-fadeIn">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-md text-xs font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                >
                  <option value="12th">12th Class</option>
                  <option value="11th">11th Class</option>
                  <option value="10th">10th Class</option>
                  <option value="9th">9th Class</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block">Session</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-md text-xs font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                >
                  {availableSessions.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-md text-xs font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-md text-xs font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 truncate"
                >
                  <option value="">All Subjects</option>
                  {MASTER_SUBJECTS.map(s => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* Quick Fill Mode Preference Setting */}
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase block">Quick Fill Mode</label>
                <select
                  value={quickRollMode}
                  onChange={(e) => handleQuickRollModeChange(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-md text-xs font-bold border bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200"
                >
                  <option value="PRESENT_FIRST">Present (Rest Absent)</option>
                  <option value="ABSENT_FIRST">Absent (Rest Present)</option>
                </select>
              </div>

              {/* Missed Days Audit & Smart Backfill Panel */}
              <div className="col-span-2 sm:col-span-5 p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Wand2 size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 block leading-tight">
                        Missed Attendance Audit & Smart Backfill
                      </span>
                      <p className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 truncate">
                        {auditingMissed ? (
                          <span>Scanning working days...</span>
                        ) : missedDates.length > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400 font-extrabold">
                            ⚠️ {missedDates.length} Missed Working {missedDates.length === 1 ? 'Day' : 'Days'} Found
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                            ✅ All working days recorded!
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Audit Month Dropdown + Smart Backfill Button */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                    <select
                      value={auditTargetMonth}
                      onChange={(e) => setAuditTargetMonth(e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold border bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-200 flex-1 sm:flex-initial"
                    >
                      <option value="2026-08">August 2026</option>
                      <option value="2026-07">July 2026</option>
                      <option value="2026-06">June 2026</option>
                      <option value="2026-05">May 2026</option>
                      <option value="2026-04">April 2026</option>
                      <option value="ALL_SESSION">🌟 Full Session ({selectedSession})</option>
                    </select>

                    {missedDates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowBackfillModal(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-purple-600 hover:bg-purple-500 shadow-2xs transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                      >
                        <Wand2 size={12} />
                        <span>Smart Backfill ({missedDates.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Badges preview list of missed dates */}
                {missedDates.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[10px] font-mono font-bold">
                    {missedDates.slice(0, 10).map(d => (
                      <span key={d} className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                        {d}
                      </span>
                    ))}
                    {missedDates.length > 10 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold flex-shrink-0">
                        +{missedDates.length - 10} more...
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Declared Holidays & Vacations Management Panel */}
              <div className="col-span-2 sm:col-span-5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block leading-tight">
                        Declared Holidays & Vacations Manager
                      </span>
                      <p className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 truncate">
                        {holidaysList.length > 0 ? `${holidaysList.length} Official Holidays / Vacations Declared` : 'No custom holidays declared yet.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingHoliday(null);
                      setHolidayDate(selectedDate || new Date().toISOString().slice(0, 10));
                      setHolidayEndDate('');
                      setHolidayLabel('');
                      setHolidayPurpose('');
                      setShowHolidayManageModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-amber-600 hover:bg-amber-500 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1 w-full sm:w-auto"
                  >
                    <Plus size={13} />
                    <span>Manage / Add Holidays</span>
                  </button>
                </div>

                {/* Holiday Chips */}
                {holidaysList.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[10px] font-bold">
                    {holidaysList.slice(0, 8).map(h => (
                      <span key={h.id || h.dateStr} className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex-shrink-0 flex items-center gap-1">
                        <span>🏖️ {h.label || 'Holiday'} ({h.dateStr || h.startDate})</span>
                        <button
                          type="button"
                          onClick={() => setHolidayToDelete(h)}
                          className="hover:text-red-600 cursor-pointer ml-0.5"
                          title="Delete holiday"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alert Notification */}
          {alert && (
            <div className={`p-2 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fadeIn ${
              alert.type === 'error'
                ? 'bg-red-500/10 border border-red-500/30 text-red-600'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
            }`}>
              {alert.type === 'error' ? <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
              <span>{alert.text}</span>
            </div>
          )}

          {/* Active Holiday Dismissible Popup Notice Modal */}
          {currentSelectedHoliday && dismissedHolidayKey !== (currentSelectedHoliday.dateStr || currentSelectedHoliday.date) && (
            <div className="fixed inset-0 z-[9990] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 shadow-2xl max-w-md w-full space-y-3 text-slate-900 dark:text-slate-100">
                <div className="flex items-start justify-between gap-2 border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black flex-shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block tracking-wider">🎉 Official School Holiday Declared</span>
                      <h3 className="text-sm font-black text-amber-950 dark:text-amber-100">{currentSelectedHoliday.label}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedHolidayKey(currentSelectedHoliday.dateStr || currentSelectedHoliday.date)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Dismiss Notice"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="text-xs space-y-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <p><strong>Date:</strong> <span className="underline">{currentSelectedHoliday.dateStr || currentSelectedHoliday.date}</span> • <strong>Class:</strong> {selectedClass} ({selectedSession})</p>
                  {currentSelectedHoliday.purpose && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                      <strong>Holiday Reason / Details:</strong> {currentSelectedHoliday.purpose}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const hKey = currentSelectedHoliday.dateStr || currentSelectedHoliday.date;
                      setHolidayDate(hKey);
                      setHolidayLabel(currentSelectedHoliday.label);
                      setHolidayPurpose(currentSelectedHoliday.purpose || '');
                      setDismissedHolidayKey(hKey);
                      setShowQuickHolidayModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white cursor-pointer transition-all"
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedHolidayKey(currentSelectedHoliday.dateStr || currentSelectedHoliday.date)}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-all"
                  >
                    Close Notice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sleek Centered Single Alphabet Summary Strip (P:89  L:0  A:0  T:89) + Date Selector Pill */}
          <div className="flex items-center justify-between sm:justify-center gap-1.5 p-1 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-black overflow-x-auto whitespace-nowrap w-full">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" title={`Present Students: ${presentCount}`}>
                P: {presentCount}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30" title={`Students on Leave: ${leaveCount}`}>
                L: {leaveCount}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30" title={`Absent Students: ${absentCount}`}>
                A: {absentCount}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700" title={`Total Roster Count: ${filteredStudentsBySubject.length}`}>
                T: {filteredStudentsBySubject.length}
              </span>
            </div>

            {/* Premium Interactive Date Control Capsule with 1-Click Stepping & Today Shortcut */}
            <div className="flex items-center gap-1.5 p-0.5 px-1.5 rounded-xl bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/30 font-bold text-[11px] flex-shrink-0 shadow-xs">
              <button
                type="button"
                onClick={() => {
                  const current = new Date(`${selectedDate}T00:00:00`);
                  current.setDate(current.getDate() - 1);
                  setSelectedDate(current.toISOString().slice(0, 10));
                }}
                className="p-1 rounded-md hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft size={13} />
              </button>

              <div className="flex items-center gap-1 cursor-pointer">
                <Calendar size={13} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-transparent font-black text-teal-950 dark:text-white cursor-pointer outline-none text-[11.5px]"
                />
                <span className="text-[10px] font-black text-teal-700 dark:text-teal-400 font-mono hidden md:inline">
                  • {formatReadableDate(selectedDate, true)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const current = new Date(`${selectedDate}T00:00:00`);
                  current.setDate(current.getDate() + 1);
                  setSelectedDate(current.toISOString().slice(0, 10));
                }}
                className="p-1 rounded-md hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight size={13} />
              </button>

              {selectedDate !== new Date().toISOString().slice(0, 10) && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                  className="px-1.5 py-0.5 rounded-md bg-teal-600 text-white font-black text-[9.5px] hover:bg-teal-500 cursor-pointer shadow-2xs transition-all"
                  title="Jump to Today"
                >
                  Today
                </button>
              )}

              {isEditingSaved && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider animate-pulse" title="Saved attendance record exists for this date">
                  Saved Record
                </span>
              )}
            </div>
          </div>

              {/* Compact Student Grid (4-cols on Laptop, 6-cols on Desktop) */}
              {loadingStudents ? (
                <div className="p-8 text-center text-xs font-bold text-slate-400">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-1.5 text-teal-500" />
                  Loading Roster for {selectedClass}...
                </div>
              ) : sortedStudents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 max-h-[600px] overflow-y-auto pr-1">
                  {sortedStudents.map((st, idx) => {
                    const isP = st.status === 'P' || st.status === 'Present';
                    const isL = st.status === 'L' || st.status === 'Leave';
                    const isA = st.status === 'A' || st.status === 'Absent';
                    const originalIdx = students.findIndex(s => s.rollNo === st.rollNo && s.name === st.name);

                    return (
                      <div
                        key={idx}
                        className="p-1.5 px-2 rounded-xl border flex items-center justify-between transition-all hover:border-teal-500 gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs"
                      >
                        {/* Roll Badge + Student Info */}
                        <div
                          onClick={() => setViewingStudentDetails({ student: st, index: originalIdx !== -1 ? originalIdx : idx })}
                          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer group"
                        >
                          {/* Class Roll Badge */}
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 font-mono font-black text-[11px] flex items-center justify-center border border-teal-500/20 flex-shrink-0 group-hover:bg-teal-500 group-hover:text-white transition-all" title="Tap to view full details">
                            {st.rollNo}
                          </div>

                          {/* Student Name & Subtitle */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-0.5 flex-nowrap">
                              <h4 className="text-[11.5px] font-black text-slate-900 dark:text-white truncate leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                {formatProperCase(st.name)}
                              </h4>
                            </div>
                            <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 truncate leading-none">
                              {st.subjectsAbbr || 'General'}
                            </p>
                          </div>
                        </div>

                        {/* Segmented iOS Style P | L | A Control Capsule */}
                        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setStatusForStudent(originalIdx !== -1 ? originalIdx : idx, 'P')}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer ${
                              isP ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            title="Mark Present"
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusForStudent(originalIdx !== -1 ? originalIdx : idx, 'L')}
                            className={`px-1 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer ${
                              isL ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            title="Mark Leave"
                          >
                            L
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusForStudent(originalIdx !== -1 ? originalIdx : idx, 'A')}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer ${
                              isA ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            title="Mark Absent"
                          >
                            A
                          </button>
                        </div>
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

      {/* Student Details Popup Modal Sheet */}
      {viewingStudentDetails && (
        <div className="fixed inset-0 z-[9995] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl max-w-md w-full space-y-3 text-slate-900 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black flex-shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black leading-tight text-slate-900 dark:text-white">
                    {formatProperCase(viewingStudentDetails.student.name)}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Class: {selectedClass} • Session: {selectedSession}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudentDetails(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid Details */}
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Class Roll No</span>
                <span className="font-mono font-black text-sm text-teal-600 dark:text-teal-400">
                  #{viewingStudentDetails.student.rollNo || 'N/A'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Form Number</span>
                <span className="font-mono font-black text-xs">
                  #{viewingStudentDetails.student.formNo || 'N/A'}
                </span>
              </div>

              {viewingStudentDetails.student.regNo && (
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Registration Number</span>
                  <span className="font-mono font-black text-xs text-blue-600 dark:text-blue-400">
                    {viewingStudentDetails.student.regNo}
                  </span>
                </div>
              )}

              {(viewingStudentDetails.student.examRollBadges || []).map((b, bIdx) => (
                <div key={bIdx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">{b.label}</span>
                  <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                    {b.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Enrolled Subjects */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Enrolled Subjects</span>
              <div className="flex items-center gap-1 flex-wrap">
                {(viewingStudentDetails.student.subjects || viewingStudentDetails.student.subjectCodes || []).map((code, sIdx) => (
                  <span key={sIdx} className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/20 text-[10.5px]">
                    {code}
                  </span>
                ))}
                {(!viewingStudentDetails.student.subjects || viewingStudentDetails.student.subjects.length === 0) && (
                  <span className="text-slate-500 font-semibold">{viewingStudentDetails.student.subjectsAbbr || 'General Subjects'}</span>
                )}
              </div>
            </div>

            {/* Attendance Status Toggle Capsule inside Modal */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">Mark Status:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setStatusForStudent(viewingStudentDetails.index, 'P');
                    setViewingStudentDetails(prev => ({
                      ...prev,
                      student: { ...prev.student, status: 'P' }
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    (viewingStudentDetails.student.status === 'P' || viewingStudentDetails.student.status === 'Present')
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Present (P)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatusForStudent(viewingStudentDetails.index, 'L');
                    setViewingStudentDetails(prev => ({
                      ...prev,
                      student: { ...prev.student, status: 'L' }
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    (viewingStudentDetails.student.status === 'L' || viewingStudentDetails.student.status === 'Leave')
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Leave (L)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatusForStudent(viewingStudentDetails.index, 'A');
                    setViewingStudentDetails(prev => ({
                      ...prev,
                      student: { ...prev.student, status: 'A' }
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    (viewingStudentDetails.student.status === 'A' || viewingStudentDetails.student.status === 'Absent')
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Absent (A)
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setViewingStudentDetails(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday / Vacation Range Management Modal Sheet */}
      {showHolidayManageModal && (
        <div className="fixed inset-0 z-[9996] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col space-y-3.5 text-slate-900 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black flex-shrink-0">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black leading-tight text-slate-900 dark:text-white">
                    {editingHoliday ? '✏️ Edit Declared Holiday / Vacation' : 'Declare Holiday or Vacation Range'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Declare or edit single-day holidays and multi-day vacation ranges (e.g. Summer Vacation)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingHoliday(null);
                  setShowHolidayManageModal(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Editing Active Indicator Banner */}
            {editingHoliday && (
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200 flex-shrink-0">
                <span>✏️ Currently Editing: <strong>{editingHoliday.label}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingHoliday(null);
                    setHolidayDate(selectedDate || new Date().toISOString().slice(0, 10));
                    setHolidayEndDate('');
                    setHolidayLabel('');
                    setHolidayPurpose('');
                  }}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-indigo-200 dark:bg-indigo-900 hover:bg-indigo-300 text-indigo-900 dark:text-indigo-100 cursor-pointer"
                >
                  Cancel Edit
                </button>
              </div>
            )}

            {/* Scrollable Content Container */}
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Form */}
              <form onSubmit={handleSaveHoliday} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Holiday / Vacation Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Vacation / Eid-ul-Adha / Independence Day"
                    value={holidayLabel}
                    onChange={e => setHolidayLabel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={holidayDate}
                      onChange={e => setHolidayDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                      End Date <span className="text-slate-400 font-normal">(Optional Range End)</span>
                    </label>
                    <input
                      type="date"
                      value={holidayEndDate}
                      onChange={e => setHolidayEndDate(e.target.value)}
                      placeholder="Leave blank for single day"
                      className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
                    />
                  </div>
                </div>

                {holidayDate && holidayEndDate && holidayEndDate > holidayDate && (
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    🗓️ Vacation Range Active: From <strong>{formatReadableDate(holidayDate, true)}</strong> to <strong>{formatReadableDate(holidayEndDate, true)}</strong>. All days in this range will automatically be marked as official holidays (<strong>H</strong>).
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Purpose / Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Govt. Order No. 42-DSEK of 2026"
                    value={holidayPurpose}
                    onChange={e => setHolidayPurpose(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={savingHoliday}
                    className="px-4 py-2 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingHoliday ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{savingHoliday ? 'Saving...' : editingHoliday ? '💾 Update Holiday / Vacation' : '💾 Save Holiday / Vacation Range'}</span>
                  </button>
                </div>
              </form>

              {/* All Declared Holidays List & Edit Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Declared Holidays & Vacations List ({holidaysList.length})</span>
                  {loadingHolidays && <RefreshCw size={12} className="animate-spin text-amber-500" />}
                </h4>

                {holidaysList.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-400 p-4 text-center border border-dashed rounded-xl">
                    No custom holidays declared yet. Use the form above to add holidays or multi-day vacation ranges.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {holidaysList.map((h, hIdx) => {
                      const sDate = h.startDate || h.dateStr || h.date;
                      const eDate = h.endDate && h.endDate !== sDate ? h.endDate : null;

                      let durationText = '1 Day';
                      if (eDate) {
                        const daysDiff = Math.round((new Date(`${eDate}T00:00:00`) - new Date(`${sDate}T00:00:00`)) / (1000 * 60 * 60 * 24)) + 1;
                        if (daysDiff > 1) durationText = `${daysDiff} Days`;
                      }

                      return (
                        <div
                          key={h.id || h.docId || hIdx}
                          className="p-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 text-xs hover:border-amber-400 transition-all"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-slate-900 dark:text-white leading-tight">
                                🏖️ {h.label || h.title || 'Holiday'}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                                eDate ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}>
                                {durationText}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 font-bold">
                              <span>📅 {formatReadableDate(sDate, true)}{eDate ? ` ➔ ${formatReadableDate(eDate, true)}` : ''}</span>
                            </div>

                            {h.purpose && (
                              <p className="text-[10px] font-medium text-slate-400 truncate">
                                Notes: {h.purpose}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditHoliday(h)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                              title="Edit holiday details"
                            >
                              <span>✏️ Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setHolidayToDelete(h)}
                              className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                              title="Delete holiday"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingHoliday(null);
                  setShowHolidayManageModal(false);
                }}
                className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Backfill Confirmation Modal Sheet */}
      {showBackfillModal && (
        <div className="fixed inset-0 z-[9996] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl max-w-md w-full space-y-3.5 text-slate-900 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black flex-shrink-0">
                  <Wand2 size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black leading-tight text-slate-900 dark:text-white">
                    Smart Backfill Missed Attendance
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Class: {selectedClass} • Session: {selectedSession} • Subject: {selectedSubject || 'BO'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBackfillModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Statistical Integrity Explanation */}
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs space-y-1">
              <div className="flex items-center gap-1 text-purple-800 dark:text-purple-200 font-extrabold">
                <ShieldCheck size={14} className="text-purple-600" />
                <span>Statistical Integrity Protection</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                Attendance for missed days will be generated using each student's <strong>actual historical attendance ratio</strong> for {selectedClass}. High-attendance students remain high, and low-attendance students maintain their real-world ratio.
              </p>
            </div>

            {/* List of Missed Days */}
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Missed Working Days ({missedDates.length}):</span>
              <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {missedDates.map(d => (
                  <span key={d} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold border border-amber-500/20 text-[11px]">
                    📅 {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBackfillModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteSmartBackfill}
                disabled={backfilling}
                className="px-4 py-2 rounded-xl font-black text-xs text-white bg-purple-600 hover:bg-purple-500 shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {backfilling ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                <span>{backfilling ? 'Generating...' : `🚀 Confirm & Fill ${missedDates.length} Days`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Existing Attendance Confirmation Modal Sheet */}
      {showOverwriteConfirmModal && (
        <div className="fixed inset-0 z-[9997] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 shadow-2xl max-w-md w-full space-y-3.5 text-slate-900 dark:text-slate-100">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-amber-500/20 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black flex-shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black leading-tight text-slate-900 dark:text-white">
                    Overwrite Existing Attendance?
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Attendance record already exists for {formatReadableDate(selectedDate, true)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOverwriteConfirmModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Info Callout */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                An official attendance record for <strong>{selectedClass}</strong> ({selectedSession}) under <strong>{selectedSubject || 'General'}</strong> was previously saved for <strong>{formatReadableDate(selectedDate, true)}</strong>.
              </p>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700 text-[11px] font-bold space-y-1">
                <div className="text-amber-900 dark:text-amber-300">📊 Your New Marking to Apply:</div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-emerald-600">P: {presentCount}</span>
                  <span className="text-amber-600">L: {leaveCount}</span>
                  <span className="text-rose-600">A: {absentCount}</span>
                  <span className="text-slate-500">(Total: {filteredStudentsBySubject.length})</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] font-bold text-slate-500 text-center">
              Are you sure you want to overwrite the existing database record for this date?
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOverwriteConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel / Review
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverwriteConfirmModal(false);
                  executeSaveAttendance();
                }}
                disabled={savingAttendance}
                className="px-4 py-2 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-500 shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingAttendance ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>⚠️ Confirm & Overwrite Attendance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Monthly Attendance Register Modal */}
      <PrintReportModal
        isOpen={showPrintReportModal}
        onClose={() => setShowPrintReportModal(false)}
        defaultClass={selectedClass}
        defaultSession={selectedSession}
        defaultSubject={selectedSubject}
        defaultDate={selectedDate}
        availableSessions={availableSessions}
        roster={sortedStudents}
        holidaysList={holidaysList}
      />

      {/* 🚀 Success / Error Status Notification Popup Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`bg-white rounded-3xl shadow-2xl border max-w-sm w-full p-6 text-center transform transition-all scale-100 ${
            statusModal.type === 'success' ? 'border-emerald-200' : 'border-red-200'
          }`}>
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg ${
              statusModal.type === 'success' 
                ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-300' 
                : 'bg-red-100 text-red-600 border-2 border-red-300'
            }`}>
              {statusModal.type === 'success' ? '🎉' : '⚠️'}
            </div>

            <h3 className={`text-lg font-black mb-1.5 ${
              statusModal.type === 'success' ? 'text-emerald-950' : 'text-red-950'
            }`}>
              {statusModal.title || (statusModal.type === 'success' ? 'Success!' : 'Notice')}
            </h3>

            <p className="text-xs text-slate-600 font-medium mb-6 leading-relaxed">
              {statusModal.message}
            </p>

            <button
              type="button"
              onClick={() => setStatusModal(null)}
              className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer ${
                statusModal.type === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
              }`}
            >
              OK, Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Printable Monthly Attendance Register Modal Component
function PrintReportModal({ isOpen, onClose, defaultClass, defaultSession, defaultSubject, defaultDate, availableSessions = [], roster, holidaysList }) {
  const [reportYearMonth, setReportYearMonth] = useState(() => {
    if (defaultDate && defaultDate.length >= 7) return defaultDate.slice(0, 7);
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });
  const [reportClass, setReportClass] = useState(defaultClass || '11th');
  const [reportSession, setReportSession] = useState(defaultSession || CURRENT_SESSION);
  const [reportSubject, setReportSubject] = useState(defaultSubject || 'BO');

  const [monthlyData, setMonthlyData] = useState({});
  const [internalHolidays, setInternalHolidays] = useState([]);

  // Fetch holidays internally if holidaysList prop is empty
  useEffect(() => {
    if (!isOpen) return;
    if (holidaysList && holidaysList.length > 0) {
      setInternalHolidays(holidaysList);
      return;
    }
    getDocs(collection(db, 'holidays')).then(snap => {
      if (!snap.empty) {
        setInternalHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }).catch(e => console.warn('Print modal holiday fetch note:', e));
  }, [isOpen, holidaysList]);

  const effectiveHolidays = (holidaysList && holidaysList.length > 0) ? holidaysList : internalHolidays;

  // Generate all days in selected month (e.g. 1..31)
  const daysInMonth = useMemo(() => {
    if (!reportYearMonth) return [];
    const [y, m] = reportYearMonth.split('-').map(Number);
    if (!y || !m) return [];
    const count = new Date(y, m, 0).getDate();
    const days = [];
    for (let i = 1; i <= count; i++) {
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${reportYearMonth}-${dayStr}`;
      const dObj = new Date(`${dateStr}T00:00:00`);
      const isSunday = !isNaN(dObj.getTime()) && dObj.getDay() === 0;

      const customH = effectiveHolidays ? effectiveHolidays.find(h => {
        const sDate = h.startDate || h.dateStr || h.date;
        const eDate = h.endDate || sDate;
        if (sDate && eDate) {
          return dateStr >= sDate && dateStr <= eDate;
        }
        return areDatesMatching(sDate, dateStr);
      }) : null;

      days.push({
        dayNum: i,
        dateStr,
        isSunday,
        isHoliday: !!customH,
        holidayLabel: customH?.label || (isSunday ? 'Sunday' : '')
      });
    }
    return days;
  }, [reportYearMonth, effectiveHolidays]);

  // Load monthly attendance records from Firestore / cache
  useEffect(() => {
    if (!isOpen || !reportYearMonth || !reportClass) return;

    let isMounted = true;
    const fetchMonthlyData = async () => {
      try {
        const allAttDocs = await getCachedCollection('attendance', false, 10 * 60 * 1000).catch(() => []);
        const attItems = Array.isArray(allAttDocs) ? allAttDocs : (allAttDocs?.docs ? allAttDocs.docs.map(d => ({ id: d.id, ...d.data() })) : []);

        const dayMap = {};
        attItems.forEach(data => {
          const dClassMatch = isClassMatch(data.className || data.class, reportClass);
          const dSubjMatch = isDocSubjectMatch(data.subject || data.subjectCode || data.subjectName || data.subjectFull, reportSubject);
          const dSessionMatch = isSessionMatch(data.sessionYear || data.session || data.Session, reportSession);
          const dDate = data.date || data.dateStr || '';

          if (dClassMatch && dSubjMatch && dSessionMatch && dDate.startsWith(reportYearMonth)) {
            const dayNum = parseInt(dDate.split('-')[2], 10);
            if (dayNum && Array.isArray(data.records)) {
              const statusMap = {};
              data.records.forEach(r => {
                const rKey = String(r.classRollNo || r.rollNo || '').trim();
                if (rKey) statusMap[rKey] = r.status;
              });
              dayMap[dayNum] = statusMap;
            }
          }
        });

        if (isMounted) setMonthlyData(dayMap);
      } catch (err) {
        console.warn('Monthly report fetch note:', err);
      }
    };

    fetchMonthlyData();
    return () => { isMounted = false; };
  }, [isOpen, reportYearMonth, reportClass, reportSubject, reportSession]);

  if (!isOpen) return null;

  const subjMaster = MASTER_SUBJECTS.find(s => s.code === reportSubject);
  const subjName = subjMaster ? subjMaster.name : (reportSubject || 'General');

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('printable-register-sheet');
    if (!element) {
      window.print();
      return;
    }

    const opt = {
      margin: [6, 6, 6, 6],
      filename: `Attendance_${reportClass}_${subjName.replace(/\s+/g, '_')}_${reportYearMonth}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => {
        if (window.html2pdf) {
          window.html2pdf().set(opt).from(element).save();
        } else {
          window.print();
        }
      };
      script.onerror = () => window.print();
      document.body.appendChild(script);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:static print:overflow-visible">
      
      {/* Print Specific CSS to prevent duplicate pages or row cropping */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-register-modal-content, #printable-register-modal-content * {
            visibility: visible !important;
          }
          #printable-register-modal-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            overflow: visible !important;
            max-height: none !important;
          }
          #printable-register-sheet {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            padding: 0 !important;
          }
          .print-hide {
            display: none !important;
          }
          table {
            page-break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
        }
      `}</style>

      {/* Modal Box */}
      <div id="printable-register-modal-content" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 print:max-h-none print:border-none print:shadow-none print:w-full">
        
        {/* Modal Header */}
        <div className="p-2 sm:p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 print-hide gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Printer className="text-teal-600 dark:text-teal-400 flex-shrink-0" size={16} />
            <h3 className="text-xs font-black uppercase tracking-wider truncate text-slate-900 dark:text-slate-100">
              Attendance Register
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleTriggerPrint}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
              title="Print Register"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-2 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
              title="Download PDF"
            >
              <FileText size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 transition-colors cursor-pointer flex-shrink-0"
              title="Close Window"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Controls / Filter Section (Hidden during Print) */}
        <div className="p-2 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs print-hide">
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-0.5">Month</label>
            <input
              type="month"
              value={reportYearMonth}
              onChange={e => setReportYearMonth(e.target.value)}
              className="w-full px-2 py-1 rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-0.5">Class</label>
            <select
              value={reportClass}
              onChange={e => setReportClass(e.target.value)}
              className="w-full px-2 py-1 rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
            >
              <option value="12th">12th Class</option>
              <option value="11th">11th Class</option>
              <option value="10th">10th Class</option>
              <option value="9th">9th Class</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-0.5">Session</label>
            <select
              value={reportSession}
              onChange={e => setReportSession(e.target.value)}
              className="w-full px-2 py-1 rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs"
            >
              {(availableSessions && availableSessions.length > 0 ? availableSessions : ['2026', '2025-26']).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-0.5">Subject</label>
            <select
              value={reportSubject}
              onChange={e => setReportSubject(e.target.value)}
              className="w-full px-2 py-1 rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs truncate"
            >
              {MASTER_SUBJECTS.map(s => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Printable Report Content Body */}
        <div id="printable-register-sheet" className="p-4 overflow-y-auto flex-1 bg-white text-slate-900 font-sans print:p-0">
          
          {/* Attendance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse border border-slate-300">
              <thead>
                {/* Document Header Row inside thead so it repeats on every printed page */}
                <tr className="bg-white border-b-2 border-teal-800">
                  <th colSpan={daysInMonth.length + 8} className="p-2 text-center font-normal">
                    <h1 className="text-base sm:text-lg font-black uppercase text-teal-900 tracking-wider">MONTHLY STUDENT ATTENDANCE REGISTER</h1>
                    <div className="flex items-center justify-between text-xs font-bold text-teal-800 mt-1 px-2">
                      <span><strong>Class:</strong> {reportClass}</span>
                      <span><strong>Month:</strong> {new Date(`${reportYearMonth}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
                      <span><strong>Subject:</strong> {subjName}</span>
                      <span><strong>Session:</strong> {reportSession}</span>
                    </div>
                  </th>
                </tr>

                {/* Column Headers */}
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                  <th className="border border-slate-300 px-1 py-1 text-center w-6">SL</th>
                  <th className="border border-slate-300 px-1 py-1 text-center w-8">RNO</th>
                  <th className="border border-slate-300 px-1 py-1 text-left min-w-[120px]">STUDENT NAME</th>
                  {daysInMonth.map(d => (
                    <th key={d.dayNum} className={`border border-slate-300 px-0.5 py-1 text-center w-5 ${d.isSunday ? 'bg-amber-100 text-amber-900' : ''}`}>
                      {d.dayNum}
                    </th>
                  ))}
                  <th className="border border-slate-300 px-1 py-1 text-center bg-slate-200 font-black">WD</th>
                  <th className="border border-slate-300 px-1 py-1 text-center bg-emerald-100 text-emerald-900 font-black">P</th>
                  <th className="border border-slate-300 px-1 py-1 text-center bg-red-100 text-red-900 font-black">A</th>
                  <th className="border border-slate-300 px-1 py-1 text-center bg-amber-100 text-amber-900 font-black">L</th>
                  <th className="border border-slate-300 px-1 py-1 text-center bg-teal-100 text-teal-900 font-black">RATE</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((st, idx) => {
                  const rNo = String(st.rollNo || idx + 1);
                  let pCount = 0;
                  let aCount = 0;
                  let lCount = 0;
                  let totalWd = 0;

                  const dayCells = daysInMonth.map(d => {
                    if (d.isSunday) {
                      return { val: 'S', cls: 'text-amber-700 font-bold bg-amber-50' };
                    }

                    const record = monthlyData[d.dayNum];

                    // Actual saved attendance for this day takes precedence over declared holidays!
                    if (record) {
                      totalWd++;
                      const status = record[rNo] || 'A';
                      if (status === 'H' || status === 'Holiday') {
                        totalWd--; // Marked as holiday in attendance
                        return { val: 'H', cls: 'text-purple-700 font-bold bg-purple-50' };
                      } else if (status === 'P' || status === 'Present') {
                        pCount++;
                        return { val: 'P', cls: 'text-emerald-700 font-bold bg-emerald-50' };
                      } else if (status === 'L' || status === 'Leave') {
                        lCount++;
                        return { val: 'L', cls: 'text-amber-700 font-bold bg-amber-50' };
                      } else {
                        aCount++;
                        return { val: 'A', cls: 'text-red-700 font-bold bg-red-50' };
                      }
                    }

                    // Fallback to declared holiday if no attendance record was saved for this day
                    if (d.isHoliday) {
                      return { val: 'H', cls: 'text-purple-700 font-bold bg-purple-50' };
                    }

                    return { val: '-', cls: 'text-slate-300' };
                  });

                  const rate = totalWd > 0 ? Math.round((pCount / totalWd) * 100) : 0;

                  return (
                    <tr key={st.id || idx} className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="border border-slate-300 px-1 py-0.5 text-center font-medium text-slate-500">{idx + 1}</td>
                      <td className="border border-slate-300 px-1 py-0.5 text-center font-black text-teal-900">{rNo}</td>
                      <td className="border border-slate-300 px-1 py-0.5 font-bold text-slate-900 truncate max-w-[140px]">{formatProperCase(st.name)}</td>
                      {dayCells.map((cell, dIdx) => (
                        <td key={dIdx} className={`border border-slate-300 px-0.5 py-0.5 text-center font-bold ${cell.cls}`}>
                          {cell.val}
                        </td>
                      ))}
                      <td className="border border-slate-300 px-1 py-0.5 text-center font-bold bg-slate-100">{totalWd}</td>
                      <td className="border border-slate-300 px-1 py-0.5 text-center font-bold bg-emerald-50 text-emerald-800">{pCount}</td>
                      <td className="border border-slate-300 px-1 py-0.5 text-center font-bold bg-red-50 text-red-800">{aCount}</td>
                      <td className="border border-slate-300 px-1 py-0.5 text-center font-bold bg-amber-50 text-amber-800">{lCount}</td>
                      <td className={`border border-slate-300 px-1 py-0.5 text-center font-black ${rate >= 75 ? 'text-emerald-700' : 'text-red-600'}`}>{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footnotes & Explanations Footer (Matches Screenshot 5) */}
          <div className="mt-4 pt-3 border-t border-slate-300 text-[10px] text-slate-700 space-y-1">
            <h4 className="font-black uppercase text-teal-900 tracking-wider mb-1">FOOTNOTES & EXPLANATIONS</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              <div><strong className="text-amber-800">S</strong>: <strong>Sunday (Weekly Holiday)</strong>. Official weekly off.</div>
              <div><strong className="text-purple-800">H</strong>: <strong>Labeled School Holidays</strong>. Declared official holidays.</div>
              <div><strong className="text-emerald-800">P</strong>: <strong>Present</strong>. Student was present and active in session.</div>
              <div><strong className="text-red-800">A</strong>: <strong>Absent</strong>. Student was absent without approved leave.</div>
              <div><strong className="text-amber-800">L</strong>: <strong>On Leave</strong>. Student was excused with approved leave.</div>
              <div><strong className="text-slate-400">-</strong>: <strong>Empty / Unmarked</strong>. No session conducted or unmarked.</div>
            </div>
            <div className="pt-3 flex justify-between items-end text-[9px] text-slate-400 italic">
              <span>Generated by HSS Portal on: {new Date().toLocaleString()}</span>
              <div className="text-center font-bold text-slate-700 not-italic border-t border-slate-400 pt-1 px-8">Class Teacher / Principal Signature</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
