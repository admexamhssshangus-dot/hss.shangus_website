import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart2, PieChart, Printer, Download, X, Filter, Users, CheckCircle2,
  Sparkles, BookOpen, Layers, ShieldCheck, FileSpreadsheet, ChevronDown,
  CheckSquare, Square, ArrowLeft, FileText, ExternalLink,
  UserX, UserCheck, Search, AlertTriangle, ChevronUp, Check, HelpCircle, RefreshCw
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getCurrentAcademicSession, updateCachedItem } from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';

import { normalizeClassVal, normalizeSessionVal } from './AdvancedReports';
import {
  getAssignedClassRollNumber,
  resolveStudentAdmissionStatus,
  isStudentAdmissionApproved,
  isStudentExamDropped
} from '../../utils/studentApprovalStatus';
import {
  fetchExamineeDropOverrides,
  checkIsStudentDropped,
  persistStudentExamDropStatus,
  getStudentDropLookupKeys
} from '../../services/examineeDropService';
import {
  getStudentDisplayName,
  getStudentFatherName,
  getStudentClass,
  getStudentStream,
  getStudentSession,
  isStudentInSession,
  fetchStudentsForSessionOnDemand
} from '../../utils/studentDataFetcher';
import {
  formatRollNumberSeries,
  buildJkboseSubjectRollData,
  normalizeExamineeClass,
  CANONICAL_SUBJECT_ORDER,
  cleanCentreNoDisplay
} from '../../utils/jkboseRollSeriesFormatter';
import { generateJkboseDocx } from '../../utils/jkboseDocxGenerator';
import { generateJkboseExcel } from '../../utils/jkboseExcelGenerator';
import { printJkboseStatement } from '../../utils/jkbosePdfGenerator';
import { showToast } from '../../components/common/GlobalToast';

const COMMON_DROPPED_REASONS = [
  'Shortage of attendance',
  'Did not register with board',
  'Fee default / unpaid admission',
  'Discontinued / left institution',
  'Failed institutional pre-board',
  'Medical grounds',
  'Other / administrative reason',
];

// ─── Reusable Multi-Select Checkbox Dropdown Component for Analytics Suite ───
function MultiSelectDropdown({ label, options = [], selected = [], onChange, align = 'left', customAllLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selected.length === 0;
  const isNoneSelected = selected.includes('__NONE__');

  const toggleOption = (opt) => {
    let next;
    if (selected.includes('__NONE__')) {
      next = [opt];
    } else if (selected.length === 0) {
      next = options.filter((item) => item !== opt);
    } else if (selected.includes(opt)) {
      next = selected.filter((item) => item !== opt);
    } else {
      next = [...selected, opt];
    }

    if (next.length === 0) {
      next = ['__NONE__'];
    } else if (next.length === options.length) {
      next = [];
    }
    onChange(next);
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const handleDeselectAll = () => {
    onChange(['__NONE__']);
  };

  const displayText = isAllSelected
    ? (customAllLabel || `All ${label}`)
    : isNoneSelected
    ? `No ${label}`
    : selected.length === 1
    ? selected[0]
    : `${label} (${selected.length})`;

  return (
    <div className="relative text-left flex-1 sm:flex-none min-w-[90px] sm:min-w-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1 transition-all cursor-pointer ${
          !isAllSelected
            ? 'bg-amber-600 text-white'
            : 'bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <span className="truncate max-w-[100px] sm:max-w-[140px] text-left">{displayText}</span>
        <ChevronDown size={11} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-48 max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-1.5 space-y-1 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
          <div className="flex items-center justify-between px-1 py-0.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black gap-1">
            <span className="text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate flex-1">{label}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-black cursor-pointer"
              >
                All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-1 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-[9px] font-black cursor-pointer"
              >
                None
              </button>
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-0.5 py-0.5 custom-scrollbar">
            {options.map((opt, idx) => {
              const checked = isAllSelected || (selected.includes(opt) && !isNoneSelected);
              return (
                <button
                  key={`${opt}_${idx}`}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  ) : (
                    <Square size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 min-w-0">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const CANONICAL_ACADEMIC_SESSIONS = [
  '2025-26', '2024-25 (Oct-Nov)', '2024-25 (Mar-Apr)', '2024-25', '2023-24', '2022-23', '2021-22',
  '2020-21', '2019-20', '2018-19', '2017-18', '2016-17',
  '2015-16', '2014-15', '2013-14', '2012-13', '2011-12',
  '2010-11', '2009-10', '2008-09', '2007-08', '2006-07'
];

export default function AnalyticsSuiteModal({
  isOpen = true,
  onClose,
  isPage = false,
  initialMode = 'enrollment',
  students = [],
  allStudents = [],
  historicalRecords = [],
  allKnownSessions = [],
  isLoadingHistory = false,
  user,
  onNavigateTab,
  onDataUpdated
}) {
  // Filter States matching the user's reference layout
  const [analysisMode, setAnalysisMode] = useState(initialMode || 'enrollment'); // Default: 'enrollment' (Class Enrollment Summary)

  useEffect(() => {
    if (initialMode) {
      setAnalysisMode(initialMode);
    }
  }, [initialMode]);
  const [selectedSessions, setSelectedSessions] = useState([]); // Default: All sessions
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedGenders, setSelectedGenders] = useState([]);
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(['Approved']); // Default: Approved

  // Dropped Examinees Drawer & Management State
  const [isDroppedDrawerOpen, setIsDroppedDrawerOpen] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState('all'); // 'all' | 'active' | 'dropped'
  const [drawerClass, setDrawerClass] = useState('10th'); // '10th' | '11th' | '12th' | 'all'
  const [drawerSearch, setDrawerSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [savingStudentId, setSavingStudentId] = useState(null);

  // Drop Reason Prompt Modal State
  const [pendingDropStudent, setPendingDropStudent] = useState(null);
  const [isBulkDropPending, setIsBulkDropPending] = useState(false);
  const [dropReason, setDropReason] = useState(COMMON_DROPPED_REASONS[0]);
  const [customDropReason, setCustomDropReason] = useState('');

  // JKBOSE Subject Return Statement Custom Parameters & Configurations
  const [jkboseSelectedClass, setJkboseSelectedClass] = useState('12th'); // '12th' | '11th' | '10th' | 'all'
  const [jkboseInstitutionName, setJkboseInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [jkboseExamName, setJkboseExamName] = useState('ANNUAL REGULAR 2026');
  const [jkboseCentreNo, setJkboseCentreNo] = useState('');
  const [isJkboseCentreManuallyEdited, setIsJkboseCentreManuallyEdited] = useState(false);
  const [jkboseRollType, setJkboseRollType] = useState('auto'); // 'auto' | 'board' | 'class'

  // Expandable Subject Rows in Table
  const [expandedSubject, setExpandedSubject] = useState(null);

  // Persistent cloud-synced overrides map for instantaneous UI updates when dropping / restoring
  const [droppedOverrides, setDroppedOverrides] = useState(() => new Map());

  // On-demand session hydration
  const [onDemandStudents, setOnDemandStudents] = useState([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Dynamic fallback seed data for offline / instantaneous historical analytics
  const [internalSeedRecords, setInternalSeedRecords] = useState([]);
  const [isLoadingSeed, setIsLoadingSeed] = useState(false);

  // Sync persistent drop overrides from Firestore on mount
  useEffect(() => {
    let isMounted = true;
    fetchExamineeDropOverrides().then((overridesMap) => {
      if (isMounted && overridesMap) {
        setDroppedOverrides(overridesMap);
      }
    }).catch((err) => {
      console.warn('[AnalyticsSuite] Drop overrides fetch note:', err);
    });
    return () => { isMounted = false; };
  }, []);

  // Fetch student records on-demand whenever the session filter changes
  useEffect(() => {
    if (!isOpen && !isPage) return;
    const sessionsToFetch = selectedSessions.length > 0 ? selectedSessions : [getCurrentAcademicSession()];
    let isCancelled = false;
    setIsLoadingSession(true);

    Promise.all(sessionsToFetch.map((ses) => fetchStudentsForSessionOnDemand(ses)))
      .then((arrays) => {
        if (!isCancelled) {
          const flat = arrays.flat();
          setOnDemandStudents(flat);
        }
      })
      .catch((err) => console.warn('[AnalyticsSuite] Session fetch note:', err))
      .finally(() => {
        if (!isCancelled) setIsLoadingSession(false);
      });

    return () => { isCancelled = true; };
  }, [selectedSessions, isOpen, isPage]);

  useEffect(() => {
    if (!isOpen && !isPage) return;

    // Check if historical data is already supplied via props or global window cache
    const hasHistoryInProps = (historicalRecords && historicalRecords.length > 0) || (students && students.length > 1000);
    const hasWindowCache = typeof window !== 'undefined' && Array.isArray(window._hssMasterRegistersCache) && window._hssMasterRegistersCache.length > 0;

    // High performance optimization: Only fetch Firestore master records if user is explicitly inspecting legacy cohorts (<2018)
    const isLegacyInspection = selectedSessions.some(ses => {
      const year = parseInt(String(ses).match(/\d{4}/)?.[0] || '2026', 10);
      return year < 2018;
    });

    if (isLegacyInspection && !hasHistoryInProps && !hasWindowCache && internalSeedRecords.length === 0) {
      setIsLoadingSeed(true);
      import('../../services/dbCache')
        .then((dbCache) => dbCache.getMasterRegistersScoped({ forceAll: true }))
        .then((docs) => {
          if (Array.isArray(docs) && docs.length > 0) {
            setInternalSeedRecords(docs);
          }
        })
        .catch((err) => {
          console.warn('[AnalyticsSuite] Master register fallback note:', err);
        })
        .finally(() => {
          setIsLoadingSeed(false);
        });
    }
  }, [isOpen, isPage, historicalRecords, students, internalSeedRecords.length, selectedSessions]);

  // Combine live active admissions + allStudents + onDemand + historical registers + seed fallback
  const combinedRawStudents = useMemo(() => {
    const list = [];
    const indexMap = new Map();

    const addOrMerge = (item, isCurrent = false) => {
      if (!item) return;
      const docId = String(item.id || item._id || item.docId || '').trim();
      const formNo = String(item.formNo || item['Form No'] || item['Form Number'] || item['Form No.'] || item.fNo || '').trim();
      const sName = getStudentDisplayName(item).trim().toLowerCase();
      const fName = getStudentFatherName(item).trim().toLowerCase();
      const sClass = normalizeClassVal(getStudentClass(item) || item.class || item.Class || item['Admission sought for class']);
      const sSess = normalizeSessionVal(getStudentSession(item) || item.session || item.Session);
      const roll = getAssignedClassRollNumber(item);

      const keys = [];
      if (docId) keys.push(`id_${docId.toLowerCase()}`);
      if (formNo && formNo !== '—' && formNo !== '0') keys.push(`fno_${sSess}_${sClass}_${formNo.toLowerCase()}`);
      if (roll) keys.push(`roll_${sSess}_${sClass}_${String(roll).toLowerCase()}`);
      if (sName && sName !== 'student' && fName && fName !== '—') {
        keys.push(`name_${sSess}_${sClass}_${sName}_${fName}`);
      }

      let existingIdx = -1;
      for (const k of keys) {
        if (indexMap.has(k)) {
          existingIdx = indexMap.get(k);
          break;
        }
      }

      const overrideUpdates = (docId && droppedOverrides.has(docId)) ? droppedOverrides.get(docId) : {};
      const isDropped = checkIsStudentDropped(item, droppedOverrides);
      const enrichedItem = {
        ...item,
        ...overrideUpdates,
        ...(isDropped ? { isExamDropped: true, examStatus: 'dropped' } : {}),
        _isCurrentScope: isCurrent ? true : item._isCurrentScope,
      };

      if (existingIdx !== -1) {
        const existing = list[existingIdx];
        const existingHasRoll = Boolean(getAssignedClassRollNumber(existing));
        const newHasRoll = Boolean(roll);

        // If existing record was unassigned/draft and incoming has an assigned roll number, upgrade it!
        const merged = {
          ...item,
          ...existing,
          ...overrideUpdates,
          ...(isDropped ? { isExamDropped: true, examStatus: 'dropped' } : {}),
          ...(newHasRoll && !existingHasRoll ? {
            classRollNo: roll,
            rollNo: roll,
            status: resolveStudentAdmissionStatus(enrichedItem),
            Status: resolveStudentAdmissionStatus(enrichedItem)
          } : {}),
          _isCurrentScope: existing._isCurrentScope || enrichedItem._isCurrentScope,
        };
        list[existingIdx] = merged;
        keys.forEach(k => indexMap.set(k, existingIdx));
      } else {
        const newIdx = list.length;
        list.push(enrichedItem);
        keys.forEach(k => indexMap.set(k, newIdx));
      }
    };

    if (Array.isArray(students) && students.length > 0) {
      students.forEach(s => addOrMerge(s, true));
    }
    if (Array.isArray(allStudents) && allStudents.length > 0) {
      allStudents.forEach(s => addOrMerge(s, true));
    }
    if (Array.isArray(onDemandStudents) && onDemandStudents.length > 0) {
      onDemandStudents.forEach(s => addOrMerge(s, false));
    }
    if (Array.isArray(historicalRecords) && historicalRecords.length > 0) {
      historicalRecords.forEach(s => addOrMerge(s, false));
    }

    if (list.length > 0) return list;

    // Check window cache
    if (typeof window !== 'undefined' && Array.isArray(window._hssMasterRegistersCache) && window._hssMasterRegistersCache.length > 0) {
      window._hssMasterRegistersCache.forEach(s => addOrMerge(s, false));
      if (list.length > 0) return list;
    }

    // Fallback master seed
    if (Array.isArray(internalSeedRecords) && internalSeedRecords.length > 0) {
      return internalSeedRecords;
    }

    return list;
  }, [allStudents, students, onDemandStudents, historicalRecords, internalSeedRecords, droppedOverrides]);

  // Batch Report Generation States
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [selectedBatchModes, setSelectedBatchModes] = useState([
    'enrollment',
    'jkbose_subject_rolls',
    'roll_stmt',
    'stream_gender',
    'subject'
  ]);

  const REPORT_MODES = [
    { id: 'enrollment', label: 'Class Enrollment Summary' },
    { id: 'jkbose_subject_rolls', label: 'JKBOSE Subject-wise Roll Number Statement' },
    { id: 'roll_stmt', label: 'Roll Statement (Roll Stmt)' },
    { id: 'stream_gender', label: 'Stream & Gender Breakdown' },
    { id: 'subject', label: 'Subject-wise Analysis' },
  ];

  const hasSetInitialSession = useRef(false);

  // Dynamic Column Visibility based on active filter selections
  const isAllStatusesSelected = selectedStatuses.length === 0;
  const isNoneStatusesSelected = selectedStatuses.includes('__NONE__');
  const showApprovedCol = !isNoneStatusesSelected && (isAllStatusesSelected || selectedStatuses.includes('Approved'));
  const showSubmittedCol = !isNoneStatusesSelected && (isAllStatusesSelected || selectedStatuses.includes('Submitted'));
  const showDraftCol = !isNoneStatusesSelected && (isAllStatusesSelected || selectedStatuses.includes('Draft'));

  const isAllGendersSelected = selectedGenders.length === 0;
  const isNoneGendersSelected = selectedGenders.includes('__NONE__');
  const showMaleCol = !isNoneGendersSelected && (isAllGendersSelected || selectedGenders.some(g => String(g).toLowerCase().startsWith('m')));
  const showFemaleCol = !isNoneGendersSelected && (isAllGendersSelected || selectedGenders.some(g => String(g).toLowerCase().startsWith('f')));

  const enrollmentColsCount = 2 + (showApprovedCol ? 1 : 0) + (showSubmittedCol ? 1 : 0) + (showDraftCol ? 1 : 0) + (showMaleCol ? 1 : 0) + (showFemaleCol ? 1 : 0) + 1;
  const rollStmtColsCount = 3 + (showMaleCol ? 1 : 0) + (showFemaleCol ? 1 : 0) + 2;
  const streamGenderColsCount = 2 + (showMaleCol ? 1 : 0) + (showFemaleCol ? 1 : 0) + 2;
  const subjectColsCount = 3 + (showMaleCol ? 1 : 0) + (showFemaleCol ? 1 : 0) + 2;

  // Helper to format class display cleanly without duplicate "Class Class"
  const formatClassDisplay = (cls) => {
    if (!cls) return 'Class N/A';
    const str = String(cls).trim();
    if (/^class\b/i.test(str)) {
      return str.replace(/^class\s*/i, 'Class ');
    }
    return `Class ${str}`;
  };

  // Direct Browser Print via Hidden Iframe (Directly triggers native print settings dialog with ZERO double popups)
  const printViaHiddenIframe = (htmlContent) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print trigger error:', e);
      } finally {
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          } catch (_) {}
        }, 3000);
      }
    }, 350);
  };

  // Helper to extract assigned Class Roll No cell value across all possible database keys
  const getAssignedRollNo = (s) => {
    return getAssignedClassRollNumber(s);
  };

  // Helper to test if a field value is a valid unique identifier (excluding placeholders like '0', '1', 'n/a', 'none')
  const isValidUniqueVal = (val) => {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return (
      str !== '' &&
      str !== '0' &&
      str !== '—' &&
      str !== '-' &&
      str !== 'n/a' &&
      str !== 'na' &&
      str !== 'none' &&
      str !== 'nil' &&
      str !== 'null' &&
      str !== 'undefined' &&
      str !== 'unknown'
    );
  };

  // Deduplicate raw students list to prevent counting duplicate records from currentAdmissions + masterRecords
  const deduplicatedStudents = useMemo(() => {
    if (!Array.isArray(combinedRawStudents) || combinedRawStudents.length === 0) return [];
    const map = new Map();

    // Helper: detect bogus/dummy reg numbers (e.g. 2301000000000000 or 230101e15)
    const isValidRegNoA = (reg) => {
      if (!reg || reg.length < 6) return false;
      if (/[eE]/.test(reg)) return false; // reject scientific notation
      if (/0{5,}$/.test(reg)) return false; // ends in 5+ zeros
      const zeros = (reg.match(/0/g) || []).length;
      if (zeros / reg.length >= 0.75) return false; // 75%+ zeros = dummy
      return true;
    };

    // Sort: active current scope first, then directly-approved (has roll no), then newest form number
    const sorted = [...combinedRawStudents].sort((x, y) => {
      const xCurrent = x._isCurrentScope === true ? 1 : 0;
      const yCurrent = y._isCurrentScope === true ? 1 : 0;
      if (xCurrent !== yCurrent) return yCurrent - xCurrent;

      const hasRollX = isValidUniqueVal(getAssignedRollNo(x));
      const hasRollY = isValidUniqueVal(getAssignedRollNo(y));
      if (hasRollX && !hasRollY) return -1;
      if (!hasRollX && hasRollY) return 1;
      const fA = parseInt(String(x.formNo || x['Form No'] || x['Form Number'] || x.fNo || '0').replace(/\D/g, ''), 10) || 0;
      const fB = parseInt(String(y.formNo || y['Form No'] || y['Form Number'] || y.fNo || '0').replace(/\D/g, ''), 10) || 0;
      return fB - fA;
    });

    const seenCurrentSessionKeys = new Set();
    const seenRollScopeKeys = new Set();

    sorted.forEach((s, idx) => {
      const roll = getAssignedRollNo(s);
      const hasValidRoll = isValidUniqueVal(roll);
      const formNo = String(s['Form No'] || s['Form Number'] || s['Form No.'] || s.formNo || s['F.NO.'] || s.fNo || '').trim();
      const regNoRaw = String(s['Board Registration Number'] || s['Board Registration No. (Class 11th)'] || s['Board Registration No. (Class 10th)'] || s['Board Registration No. (Class 9th)'] || s['DIET Registration No.'] || s['DIET/Board Reg. No.'] || s['DIET Reg. No.'] || s['Board Reg. No.'] || s.boardRegNo || s.regNo || s['Registration No. (allotted by JKBOSE)'] || s['Registration No. (allotted by DIET)'] || s['REG. NO.'] || '').trim();
      const regNo = isValidRegNoA(regNoRaw.replace(/[^a-z0-9]/gi, '').toLowerCase()) ? regNoRaw : '';
      const sClass = normalizeClassVal(s.class || s.Class || s['Class'] || s['Admission sought for class']);
      const sSession = normalizeSessionVal(s.Session || s.session || s['Session']);
      const docId = String(s.id || s._id || s.docId || '').trim();

      const sName = String(s['Candidate Name'] || s.name || s.studentName || s["Student's Name (as per school records)"] || s["Student's Name"] || s['STUDENT\'S NAME'] || s.Name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const fName = String(s['Father Name'] || s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s['FATHER\'S NAME'] || s.FatherName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      const scope = `${sSession}_${sClass}`;

      // Invariant: A student with an assigned Class Roll Number is authoritative within their class and session.
      // Distinct examinees with different roll numbers (e.g. Roll 67 vs Roll 97) must NEVER suppress one another!
      if (hasValidRoll) {
        const rollKey = `roll_${scope}_${roll}`;
        if (seenRollScopeKeys.has(rollKey)) {
          return; // Duplicate entry for the same roll number in the same session and class
        }
        seenRollScopeKeys.add(rollKey);
      } else {
        // Only for unassigned / draft / pending records, check for duplicate formNo, regNo, or identical full name + full father name
        if (sSession.includes('2025-26') && !s._isCurrentScope) {
          if (regNo && seenCurrentSessionKeys.has(`reg_${scope}_${regNo}`)) return;
          if (formNo && isValidUniqueVal(formNo) && seenCurrentSessionKeys.has(`fno_${scope}_${formNo}`)) return;
          if (sName && fName && seenCurrentSessionKeys.has(`name_${scope}_${sName}_${fName}`)) return;
        }
      }

      if (regNo) seenCurrentSessionKeys.add(`reg_${scope}_${regNo}`);
      if (formNo && isValidUniqueVal(formNo)) seenCurrentSessionKeys.add(`fno_${scope}_${formNo}`);
      if (sName && fName) seenCurrentSessionKeys.add(`name_${scope}_${sName}_${fName}`);

      const primaryKey = `item_${docId || (hasValidRoll ? `roll_${scope}_${roll}` : '') || formNo || regNo || sName || Math.random()}_${idx}`;
      map.set(primaryKey, s);
    });

    return Array.from(map.values());
  }, [combinedRawStudents]);

  // Helper to determine effective status (Approved = Class Roll No assigned in student roll no cell)
  const getEffectiveStatus = (s) => {
    return resolveStudentAdmissionStatus(s);
  };

  // Helper to resolve accurate Student Enrolled Stream (Science, Humanities, Commerce, General)
  const resolveStream = (s) => {
    let stm = String(s.stream || s.Stream || s['Stream'] || '').trim();
    const cls = String(s.class || s.Class || s['Class'] || s['Admission sought for class'] || '').trim().toLowerCase();

    // 9th / 10th grade general class
    if (cls.includes('9') || cls.includes('10')) {
      return 'General';
    }

    // Explicit stream property check (Medical / Non-Medical -> Science, Arts / Humanities -> Humanities, Commerce -> Commerce)
    if (stm && stm.toLowerCase() !== 'general' && stm.toLowerCase() !== 'n/a' && stm.toLowerCase() !== '—' && stm.toLowerCase() !== 'null') {
      const lower = stm.toLowerCase();
      if (lower.includes('med') || lower.includes('non') || lower.includes('sci')) return 'Science';
      if (lower.includes('art') || lower.includes('hum')) return 'Humanities';
      if (lower.includes('com')) return 'Commerce';
    }

    // For 11th & 12th grade: Infer stream from subjects with word-boundary precision
    const norm = (String(s.subjects || s['Subjects'] || s.subject_combination || s.Subject || s.subs || '') + ' ' + String(s.Subjects1 || '') + ' ' + String(s.Subjects2 || '') + ' ' + String(s.Subjects3 || '') + ' ' + String(s.Subjects4 || '') + ' ' + String(s.Subjects5 || '')).toLowerCase();

    // Physics check (avoid Geography / Philosophy)
    const hasPhysics = /\b(physics|phys)\b/i.test(norm) || /(^|[\s,/\-])ph([\s,/\-]|$)/i.test(norm);
    // Chemistry check (avoid Psychology)
    const hasChemistry = /\b(chemistry|chem)\b/i.test(norm) || /(^|[\s,/\-])ch([\s,/\-]|$)/i.test(norm);
    // Biology / Botany / Zoology check (avoid Arabic, etc.)
    const hasBio = /\b(biology|botany|zoology|bio|bot|zoo)\b/i.test(norm) || /(^|[\s,/\-])(bi|bo|zo)([\s,/\-]|$)/i.test(norm);

    if (hasPhysics || hasChemistry || hasBio) return 'Science';

    const hasCommerce = /\b(commerce|accountancy|business studies|account)\b/i.test(norm) || /(^|[\s,/\-])(cm|bs|ac)([\s,/\-]|$)/i.test(norm);
    if (hasCommerce) return 'Commerce';

    // Default 11th/12th stream is Humanities
    return 'Humanities';
  };

  // Helper to determine accurate subject stream classification (Humanities, Science, Commerce, Science / Humanities)
  const resolveSubjectStream = (subName, studentStream = 'Humanities') => {
    const norm = String(subName || '').toLowerCase().trim();

    // 1. Definite Humanities Subjects
    if (
      norm === 'ps' ||
      norm.includes('political') ||
      norm === 'ht' ||
      norm.includes('history') ||
      norm === 'ed' ||
      norm.includes('education') ||
      norm === 'so' ||
      norm.includes('sociology') ||
      norm === 'ec' ||
      norm.includes('economics') ||
      norm === 'ur' ||
      norm.includes('urdu') ||
      norm === 'ar' ||
      norm.includes('arabic') ||
      norm === 'pr' ||
      norm.includes('persian') ||
      norm === 'ks' ||
      norm.includes('kashmiri') ||
      norm === 'py' ||
      norm.includes('psychology')
    ) {
      return 'Humanities';
    }

    // 2. Definite Science Subjects
    if (
      norm === 'ph' ||
      norm.includes('physics') ||
      norm === 'ch' ||
      norm.includes('chemistry') ||
      norm === 'bi' ||
      norm.includes('biology') ||
      norm === 'bo' ||
      norm.includes('botany') ||
      norm === 'zo' ||
      norm.includes('zoology')
    ) {
      return 'Science';
    }

    // 3. Definite Commerce Subjects
    if (
      norm.includes('accountancy') ||
      norm.includes('business studies') ||
      norm.includes('entrepreneurship') ||
      norm.includes('commerce')
    ) {
      return 'Commerce';
    }

    // 4. Common / Flexible Electives (Offered across both Science & Humanities)
    if (
      norm.includes('english') ||
      norm.includes('physical education') ||
      norm.includes('math') ||
      /\b(it|ites|it and ites|information technology)\b/i.test(norm) ||
      norm.includes('healthcare') ||
      norm === 'htc' ||
      norm === 'h.t.c' ||
      norm.includes('health') ||
      norm.includes('environmental') ||
      norm === 'es' ||
      norm === 'e.s' ||
      norm === 'evs'
    ) {
      return 'Science / Humanities';
    }

    return studentStream || 'Humanities';
  };

  // Helper to normalize subject codes and abbreviations
  const normalizeSubjectName = (name, studentClass = '') => {
    if (!name) return '';
    const str = String(name).trim();
    if (!str || /^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(str)) return '';
    const upper = str.toUpperCase();
    const is9or10 = String(studentClass).toLowerCase().includes('9') || String(studentClass).toLowerCase().includes('10');

    // 9th and 10th Subjects (Science is a subject here, not a stream!)
    if (is9or10) {
      if (upper === 'EN' || upper === 'ENG' || upper === 'ENGLISH') return 'English';
      if (upper === 'SST' || upper === 'SS' || upper.includes('SOCIAL')) return 'Social Studies';
      if (upper === 'MATH' || upper === 'MATHS' || upper === 'MATHEMATICS' || upper === 'MA') return 'Mathematics';
      if (upper === 'SCI' || upper === 'SCIENCE') return 'Science';
      if (upper === 'UR' || upper === 'URDU') return 'Urdu';
    }

    // 11th and 12th Subjects (General English is abbreviation GE, EN, ENG)
    if (upper === 'GE' || upper === 'EN' || upper === 'ENG' || upper === 'GEN ENG' || upper === 'ENGLISH' || upper.includes('GENERAL ENG')) {
      return 'General English';
    }
    if (upper === 'PD' || upper === 'P.D' || upper === 'PED' || upper === 'PE' || upper.includes('PHYSICAL ED')) {
      return 'Physical Education';
    }
    if (upper === 'PH' || upper === 'PHY' || upper === 'PHYS' || upper === 'PHYSICS') {
      return 'Physics';
    }
    if (upper === 'PS' || upper === 'POL' || upper === 'POL. SC' || upper === 'POLITICAL SC' || upper.includes('POLITICAL SCI')) {
      return 'Political Science';
    }
    if (upper === 'CH' || upper === 'CHEM' || upper === 'CHEMISTRY') {
      return 'Chemistry';
    }
    if (upper === 'BI' || upper === 'BIO' || upper === 'BIOLOGY') {
      return 'Biology';
    }
    if (upper === 'BO' || upper === 'BOT' || upper === 'BOTANY') {
      return 'Botany';
    }
    if (upper === 'ZO' || upper === 'ZOO' || upper === 'ZOOLOGY') {
      return 'Zoology';
    }
    if (upper === 'MA' || upper === 'MATH' || upper === 'MATHS' || upper === 'MATHEMATICS') {
      return 'Mathematics';
    }
    if (upper === 'ED' || upper === 'EDU' || upper === 'EDUC' || upper === 'EDUCATION') {
      return 'Education';
    }
    if (upper === 'SO' || upper === 'SOC' || upper === 'SOCI' || upper === 'SOCIOLOGY') {
      return 'Sociology';
    }
    if (upper === 'HT' || upper === 'HIST' || upper === 'HISTORY') {
      return 'History';
    }
    if (upper === 'EC' || upper === 'ECO' || upper === 'ECON' || upper === 'ECONOMICS') {
      return 'Economics';
    }
    if (upper === 'UR' || upper === 'URDU') {
      return 'Urdu';
    }
    // Environmental Science & ES Consolidation
    if (
      upper === 'ES' ||
      upper === 'E.S' ||
      upper === 'E.S.' ||
      upper === 'EVS' ||
      upper === 'E.V.S' ||
      upper === 'ENV' ||
      upper === 'ENV.' ||
      upper === 'ENV SC' ||
      upper === 'ENV. SC' ||
      upper === 'ENV SCIENCE' ||
      upper === 'ENVIRONMENTAL SCIENCE' ||
      upper.includes('ENVIRON')
    ) {
      return 'Environmental Science';
    }
    // Healthcare & HTC Consolidation
    if (
      upper === 'HTC' ||
      upper === 'H.T.C' ||
      upper === 'H.T.C.' ||
      upper === 'HC' ||
      upper === 'HEALTHCARE' ||
      upper === 'HEALTH CARE' ||
      upper.includes('HEALTHCARE') ||
      upper.includes('HEALTH CARE')
    ) {
      return 'Healthcare';
    }
    if (upper === 'PR' || upper === 'PERS' || upper === 'PERSIAN') {
      return 'Persian';
    }
    if (upper === 'AR' || upper === 'ARAB' || upper === 'ARABIC') {
      return 'Arabic';
    }
    if (upper === 'KS' || upper === 'KSH' || upper === 'KASHMIRI') {
      return 'Kashmiri';
    }
    if (upper === 'CS' || upper === 'COMP' || upper === 'IP' || upper.includes('COMPUTER')) {
      return 'Computer Science';
    }
    if (upper === 'CM' || upper === 'COMM' || upper === 'COMMERCE') {
      return 'Commerce';
    }
    if (upper === 'AC' || upper === 'ACC' || upper === 'ACCOUNTANCY') {
      return 'Accountancy';
    }
    if (upper === 'BM' || upper === 'BUS MATH' || upper.includes('BUSINESS MATH')) {
      return 'Business Mathematics';
    }

    // IT and ITES Consolidation (One unified subject)
    if (
      upper === 'IT' ||
      upper === 'ITES' ||
      upper === 'ITE' ||
      upper === 'IT & ITES' ||
      upper === 'IT AND ITES' ||
      upper === 'IT/ITES' ||
      upper === 'IT & ITES.' ||
      upper === 'IT AND ITES.' ||
      upper === 'INFORMATION TECHNOLOGY' ||
      upper === 'INFORMATION TECHNOLOGY & ITES' ||
      upper === 'INFORMATION TECHNOLOGY AND ITES' ||
      upper.includes('IT & ITES') ||
      upper.includes('IT AND ITES') ||
      upper.includes('IT/ITES') ||
      upper.includes('IT & ITES')
    ) {
      return 'IT and ITES';
    }

    return str;
  };

  // Robust helper to extract & normalize array of subjects from any student record format (string/array, +, &, comma, slash, etc.)
  const extractSubjectList = (s) => {
    const stClass = s.class || s.Class || s['Class'] || s['Admission sought for class'] || '';
    const raw = s.subjects || s['Subjects'] || s.subject_combination || s['Subject Combination'] || s.Subject || s.subs || s.Subs || '';
    let parts = [];

    if (Array.isArray(raw)) {
      parts = raw;
    } else if (typeof raw === 'string' && raw.trim() && !/^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(raw.trim())) {
      // Protect "IT and ITES", "IT & ITES", "IT/ITES", etc. so symbols (+, &, /) do not fragment it into two separate subjects
      const protectedRaw = raw
        .replace(/\bIT\s*(?:&|and|\/|\+)\s*ITe?S\b/gi, '###IT_AND_ITES###')
        .replace(/\bITeS\b/gi, '###IT_AND_ITES###');
      parts = protectedRaw.split(/[,•\n/+&]+/).map((p) => p.replace(/###IT_AND_ITES###/g, 'IT and ITES'));
    }

    // Support individual subject fields: Subjects1..Subject6 / subjects1..subjects6
    if (parts.length === 0) {
      const indiv = [
        s.Subjects1, s.Subjects2, s.Subjects3, s.Subjects4, s.Subjects5, s.Subject6,
        s.subjects1, s.subjects2, s.subjects3, s.subjects4, s.subjects5, s.subjects6
      ].filter(Boolean);
      if (indiv.length > 0) {
        parts = indiv;
      }
    }

    const list = [];
    parts.forEach((p) => {
      const clean = String(p).trim();
      if (clean && !/^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(clean) && clean.length > 1) {
        const norm = normalizeSubjectName(clean, stClass);
        if (norm && !/^(?:-|—|–|none|nil|na|n\/a|null|undefined)$/i.test(norm) && norm.length > 1) {
          // Deduplicate so a student who has both IT and ITES in the raw record is counted only once for "IT and ITES"
          if (!list.includes(norm)) {
            list.push(norm);
          }
        }
      }
    });

    // Ensure General English (or English) is listed first
    list.sort((a, b) => {
      if (a === 'General English' || a === 'GE') return -1;
      if (b === 'General English' || b === 'GE') return 1;
      if (a === 'English') return -1;
      if (b === 'English') return 1;
      return 0;
    });

    return list;
  };

  // Extract unique Sessions dynamically from database (Regular sessions first, BIAN sessions after)
  const availableSessions = useMemo(() => {
    const set = new Set();
    deduplicatedStudents.forEach((s) => {
      const ses = s.Session || s.session || s['Session'];
      if (ses && String(ses).trim() && String(ses).trim() !== '—') set.add(String(ses).trim());
    });
    if (Array.isArray(allKnownSessions)) {
      allKnownSessions.forEach((ses) => {
        if (ses && String(ses).trim() && String(ses).trim() !== '—') set.add(String(ses).trim());
      });
    }
    CANONICAL_ACADEMIC_SESSIONS.forEach((ses) => {
      set.add(ses);
    });
    const list = Array.from(set);

    // Sort: Regular annual sessions first (e.g. 2025-26, 2024-25), Bi-Annual (BIAN) sessions after
    list.sort((a, b) => {
      const aIsBian = /bian|bi-annual|apr/i.test(a);
      const bIsBian = /bian|bi-annual|apr/i.test(b);

      if (aIsBian && !bIsBian) return 1;
      if (!aIsBian && bIsBian) return -1;

      const numA = parseInt(String(a).match(/\d{4}/)?.[0] || '0', 10);
      const numB = parseInt(String(b).match(/\d{4}/)?.[0] || '0', 10);
      if (numA !== numB) return numB - numA;

      return b.localeCompare(a, undefined, { numeric: true });
    });

    return list.length > 0 ? list : ['2025-26', '2024-25'];
  }, [deduplicatedStudents, allKnownSessions]);

  // Sync default session selection to the most recent REGULAR session upon opening modal
  // Reset ref when modal closes so it re-applies on every new open
  useEffect(() => {
    if (!isOpen) {
      hasSetInitialSession.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && availableSessions.length > 0 && !hasSetInitialSession.current) {
      const regularSession = availableSessions.find(
        (ses) => !/bian|bi-annual|apr/i.test(ses)
      ) || availableSessions[0];

      setSelectedSessions([regularSession]);
      hasSetInitialSession.current = true;
    }
  }, [isOpen, availableSessions]);

  // Extract unique Classes dynamically from database
  const availableClasses = useMemo(() => {
    const set = new Set();
    deduplicatedStudents.forEach((s) => {
      const cls = s.class || s.Class || s['Class'] || s['Admission sought for class'];
      if (cls && String(cls).trim() && String(cls).trim() !== '—') {
        let str = String(cls).trim();
        if (!str.toLowerCase().startsWith('class')) str = `Class ${str}`;
        set.add(str);
      }
    });
    const list = Array.from(set);
    list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return list.length > 0 ? list : ['Class 9th', 'Class 10th', 'Class 11th', 'Class 12th'];
  }, [deduplicatedStudents]);

  // Extract unique Genders dynamically from database
  const availableGenders = useMemo(() => {
    const set = new Set();
    deduplicatedStudents.forEach((s) => {
      const gen = s.gender || s.Gender || s['Gender'];
      if (gen && String(gen).trim() && String(gen).trim() !== '—') set.add(String(gen).trim());
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ['Male', 'Female'];
  }, [deduplicatedStudents]);

  // Extract unique Streams dynamically from database
  const availableStreams = useMemo(() => {
    const set = new Set();
    deduplicatedStudents.forEach((s) => {
      const stm = resolveStream(s);
      if (stm && String(stm).trim() && String(stm).trim() !== '—') set.add(String(stm).trim());
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ['Science', 'Humanities', 'Commerce', 'General'];
  }, [deduplicatedStudents]);

  // Extract unique Subjects dynamically from database
  const availableSubjects = useMemo(() => {
    const set = new Set();
    deduplicatedStudents.forEach((s) => {
      const subjs = extractSubjectList(s);
      subjs.forEach((sub) => set.add(sub));
    });
    const list = Array.from(set);
    list.sort((a, b) => {
      if (a === 'General English' || a === 'GE') return -1;
      if (b === 'General English' || b === 'GE') return 1;
      if (a === 'English') return -1;
      if (b === 'English') return 1;
      return a.localeCompare(b);
    });
    return list;
  }, [deduplicatedStudents]);

  // Filtered Students Array
  const filteredStudents = useMemo(() => {
    return deduplicatedStudents.filter((s) => {
      // 0. Status Filter (Default: Approved / Roll Assigned)
      const effStatus = getEffectiveStatus(s);
      const isDropped = checkIsStudentDropped(s, droppedOverrides) || isStudentExamDropped(s);
      const hasRoll = Boolean(getAssignedClassRollNumber(s));
      if (selectedStatuses.length > 0 && !selectedStatuses.includes('__NONE__')) {
        const matchesStatus = selectedStatuses.some((st) => {
          if (st === 'Approved' || st.includes('Approved')) return effStatus === 'Approved' || (isDropped && hasRoll);
          if (st === 'Submitted' || st.includes('Submitted')) return effStatus === 'Submitted';
          if (st === 'Draft' || st.includes('Draft')) return effStatus === 'Draft';
          if (st === 'Rejected' || st.includes('Rejected')) return effStatus === 'Rejected';
          if (st === 'Dropped' || st.includes('Dropped')) return effStatus === 'Dropped' || isDropped;
          return effStatus.toLowerCase() === st.toLowerCase();
        });
        if (!matchesStatus) return false;
      }

      // 1. Session Filter (Normalized EN-DASH / HYPHEN matching & flexible prefix matching)
      const rawSes = String(s.Session || s.session || s['Session'] || '2025-26').trim();
      const normSes = normalizeSessionVal(rawSes).replace(/–/g, '-').replace(/—/g, '-').toLowerCase();
      if (selectedSessions.length > 0 && !selectedSessions.includes('__NONE__')) {
        const matchesSes = selectedSessions.some((sel) => {
          const normSel = normalizeSessionVal(sel).trim().replace(/–/g, '-').replace(/—/g, '-').toLowerCase();
          if (normSes === normSel) return true;
          if (normSel === '2024-25' && normSes.startsWith('2024-25')) return true;
          if (normSes === '2024-25' && normSel.startsWith('2024-25')) return true;
          return false;
        });
        if (!matchesSes) return false;
      }

      // 2. Class Filter (Normalized digit matching)
      const rawCls = String(s.class || s.Class || s['Class'] || s['Admission sought for class'] || '').trim();
      const normCls = rawCls.toLowerCase().replace(/class/gi, '').trim();
      if (selectedClasses.length > 0 && !selectedClasses.includes('__NONE__')) {
        const matchesCls = selectedClasses.some((sel) => {
          const normSel = String(sel).toLowerCase().replace(/class/gi, '').trim();
          if (normCls === normSel) return true;
          const d1 = normCls.match(/\d+/)?.[0];
          const d2 = normSel.match(/\d+/)?.[0];
          return !!(d1 && d2 && d1 === d2);
        });
        if (!matchesCls) return false;
      }

      // 3. Gender Filter
      const gen = String(s.gender || s.Gender || s['Gender'] || '').trim().toLowerCase();
      if (selectedGenders.length > 0 && !selectedGenders.includes('__NONE__')) {
        const matchesGen = selectedGenders.some((sel) => {
          if (sel.toLowerCase() === 'male') return gen.startsWith('m');
          if (sel.toLowerCase() === 'female') return gen.startsWith('f');
          return gen.includes(sel.toLowerCase());
        });
        if (!matchesGen) return false;
      }

      // 4. Stream Filter
      const stm = resolveStream(s).toLowerCase();
      if (selectedStreams.length > 0 && !selectedStreams.includes('__NONE__')) {
        const matchesStm = selectedStreams.some((sel) => {
          const targetStm = sel.toLowerCase();
          return stm.includes(targetStm) || targetStm.includes(stm);
        });
        if (!matchesStm) return false;
      }

      // 5. Subject Filter
      if (selectedSubjects.length > 0 && !selectedSubjects.includes('__NONE__')) {
        const studentSubjs = extractSubjectList(s).map((sub) => sub.toLowerCase());
        const matchesSubj = selectedSubjects.some((sel) => {
          const selNorm = sel.toLowerCase();
          return studentSubjs.some((sub) => sub === selNorm || sub.includes(selNorm) || selNorm.includes(sub));
        });
        if (!matchesSubj) return false;
      }

      return true;
    });
  }, [deduplicatedStudents, selectedStatuses, selectedSessions, selectedClasses, selectedGenders, selectedStreams, selectedSubjects]);

  // Aggregated Statistical Computations
  const stats = useMemo(() => {
    let maleCount = 0;
    let femaleCount = 0;
    let otherGenderCount = 0;
    let approvedCount = 0;
    let submittedCount = 0;
    let draftCount = 0;
    let regCount = 0;
    const subjectMap = {};
    const streamMap = {};
    const rollStmtMap = {};
    const classMap = {};

    filteredStudents.forEach((s) => {
      const gen = String(s.gender || s.Gender || s['Gender'] || '').trim().toLowerCase();
      const isMale = gen.startsWith('m');
      const isFemale = gen.startsWith('f');
      if (isMale) maleCount++;
      else if (isFemale) femaleCount++;
      else otherGenderCount++;

      let rawCls = String(s.class || s.Class || s['Class'] || s['Admission sought for class'] || '').trim();
      if (!rawCls || rawCls === '—') rawCls = 'Class N/A';
      else if (!rawCls.toLowerCase().startsWith('class')) rawCls = `Class ${rawCls}`;
      const stClass = rawCls;
      const stStream = resolveStream(s);
      const stStatus = getEffectiveStatus(s);

      if (stStatus === 'Approved') approvedCount++;
      else if (stStatus === 'Submitted') submittedCount++;
      else if (stStatus === 'Draft') draftCount++;

      // Subject Aggregation
      const subList = extractSubjectList(s);
      subList.forEach((subName) => {
        const resolvedSubjStream = resolveSubjectStream(subName, stStream);

        if (!subjectMap[subName]) {
          subjectMap[subName] = { name: subName, total: 0, male: 0, female: 0, stream: resolvedSubjStream };
        }
        subjectMap[subName].total++;
        if (isMale) subjectMap[subName].male++;
        if (isFemale) subjectMap[subName].female++;
      });

      // Stream & Class Breakdown Aggregation
      const classStreamKey = `${stClass} (${stStream})`;
      if (!streamMap[classStreamKey]) {
        streamMap[classStreamKey] = {
          name: classStreamKey,
          className: stClass,
          streamName: stStream,
          total: 0,
          male: 0,
          female: 0
        };
      }
      streamMap[classStreamKey].total++;
      if (isMale) streamMap[classStreamKey].male++;
      if (isFemale) streamMap[classStreamKey].female++;

      // Class Enrollment Aggregation
      if (!classMap[stClass]) {
        classMap[stClass] = { className: stClass, total: 0, approved: 0, submitted: 0, draft: 0, rejected: 0, male: 0, female: 0 };
      }
      classMap[stClass].total++;
      if (isMale) classMap[stClass].male++;
      if (isFemale) classMap[stClass].female++;
      if (stStatus === 'Approved') classMap[stClass].approved++;
      else if (stStatus === 'Submitted') classMap[stClass].submitted++;
      else if (stStatus === 'Draft') classMap[stClass].draft++;
      else if (stStatus === 'Rejected') classMap[stClass].rejected++;

      // Roll Statement Aggregation
      const rollKey = `${stClass} (${stStream})`;
      if (!rollStmtMap[rollKey]) {
        rollStmtMap[rollKey] = {
          key: rollKey,
          className: stClass,
          stream: stStream,
          total: 0,
          male: 0,
          female: 0,
          regCount: 0,
          rolls: []
        };
      }
      rollStmtMap[rollKey].total++;
      if (isMale) rollStmtMap[rollKey].male++;
      if (isFemale) rollStmtMap[rollKey].female++;
      const regNo = s['Board Registration Number'] || s['Board Reg. No.'] || s['Board Reg No'] || s.boardRegNo || s.regNo || s['REG. NO.'] || s['Registration No.'];
      if (regNo) {
        rollStmtMap[rollKey].regCount++;
        regCount++;
      }

      // Comprehensive roll number extraction across all field name variations
      const rawRoll = String(
        s?.classRollNo ||
        s?.['Class Roll No'] ||
        s?.['Class Roll No.'] ||
        s?.['RL. NO.'] ||
        s?.['RL. NO'] ||
        s?.['Class R.No.'] ||
        s?.['Class R.No'] ||
        s?.rollNo ||
        s?.['Roll No.'] ||
        s?.['Roll No'] ||
        s?.roll_no ||
        s?.roll ||
        ''
      ).trim();

      const match = rawRoll.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (!isNaN(parsed) && parsed > 0) {
          rollStmtMap[rollKey].rolls.push(parsed);
        }
      }
    });

    const totalStudents = filteredStudents.length;
    const sortedSubjects = Object.values(subjectMap).sort((a, b) => b.total - a.total);
    const sortedStreams = Object.values(streamMap).sort((a, b) => {
      const clsCompare = String(a.className).localeCompare(String(b.className), undefined, { numeric: true });
      if (clsCompare !== 0) return clsCompare;
      return b.total - a.total;
    });
    const sortedClasses = Object.values(classMap).sort((a, b) => a.className.localeCompare(b.className));
    const sortedRollStmts = Object.values(rollStmtMap).map((r) => {
      const uniqueRolls = Array.from(new Set(r.rolls)).sort((a, b) => a - b);
      r.rolls = uniqueRolls;
      const minRoll = uniqueRolls.length > 0 ? uniqueRolls[0] : '-';
      const maxRoll = uniqueRolls.length > 0 ? uniqueRolls[uniqueRolls.length - 1] : '-';
      r.rollRange = uniqueRolls.length > 0 ? `${minRoll} - ${maxRoll}` : 'Not Assigned';
      return r;
    });

    const topSubject = sortedSubjects.length > 0 ? sortedSubjects[0].name : 'N/A';

    return {
      totalStudents,
      maleCount,
      femaleCount,
      otherGenderCount,
      approvedCount,
      submittedCount,
      draftCount,
      regCount,
      sortedSubjects,
      sortedStreams,
      sortedClasses,
      sortedRollStmts,
      topSubject,
    };
  }, [filteredStudents]);

  // Group roll statement items by class for combined class figures
  const classGroupedRollStmts = useMemo(() => {
    const groups = {};
    let runningIdx = 1;
    stats.sortedRollStmts.forEach((item) => {
      const cls = item.className || 'Unknown';
      if (!groups[cls]) {
        groups[cls] = {
          className: cls,
          items: [],
          total: 0,
          male: 0,
          female: 0,
          regCount: 0
        };
      }
      item.globalIdx = runningIdx++;
      groups[cls].items.push(item);
      groups[cls].total += item.total;
      groups[cls].male += item.male;
      groups[cls].female += item.female;
      groups[cls].regCount += item.regCount;
    });

    return Object.values(groups).sort((a, b) => a.className.localeCompare(b.className));
  }, [stats.sortedRollStmts]);

  // Effective Class for JKBOSE Return Statement
  const effectiveJkboseClass = useMemo(() => {
    if (selectedClasses.length === 1 && !selectedClasses.includes('All')) {
      return normalizeExamineeClass(selectedClasses[0]);
    }
    return jkboseSelectedClass;
  }, [selectedClasses, jkboseSelectedClass]);

  // Sync jkboseSelectedClass when selectedClasses is modified via filter dropdown
  useEffect(() => {
    if (selectedClasses.length === 1 && !selectedClasses.includes('All')) {
      const norm = normalizeExamineeClass(selectedClasses[0]);
      if (['10th', '11th', '12th'].includes(norm)) {
        setJkboseSelectedClass(norm);
      }
    } else if (selectedClasses.length === 0) {
      setJkboseSelectedClass('all');
    }
  }, [selectedClasses]);

  // Effective Session String for JKBOSE Return Statement
  const effectiveJkboseSession = useMemo(() => {
    if (selectedSessions.length === 1) return `Session ${selectedSessions[0]}`;
    if (selectedSessions.length > 1) return `Sessions ${selectedSessions.join(', ')}`;
    return 'Session 2025-26';
  }, [selectedSessions]);

  // JKBOSE Subject Roll Return Dataset (Official Sub-Office Format)
  const jkboseRollData = useMemo(() => {
    return buildJkboseSubjectRollData(filteredStudents, {
      selectedClass: effectiveJkboseClass,
      rollType: jkboseRollType,
      centreNo: jkboseCentreNo,
      dropOverrides: droppedOverrides,
    });
  }, [filteredStudents, effectiveJkboseClass, jkboseRollType, jkboseCentreNo, droppedOverrides]);

  // Active Class Data for Live Statement Preview
  const activeClassData = useMemo(() => {
    if (!jkboseRollData || !jkboseRollData.classWiseData) return null;
    if (effectiveJkboseClass === 'all') {
      return {
        label: 'ALL CLASSES (SSE & HSE)',
        centreNo: jkboseRollData.detectedCentreNo,
      };
    }
    return jkboseRollData.classWiseData[effectiveJkboseClass] || null;
  }, [jkboseRollData, effectiveJkboseClass]);

  // Auto-detect & synchronize Centre Number when jkboseRollData updates
  useEffect(() => {
    if (!isJkboseCentreManuallyEdited) {
      const detected = jkboseRollData?.detectedCentreNo || activeClassData?.centreNo || '';
      if (detected) {
        setJkboseCentreNo(cleanCentreNoDisplay(detected));
      }
    }
  }, [jkboseRollData?.detectedCentreNo, activeClassData?.centreNo, isJkboseCentreManuallyEdited]);

  const jkboseKpis = useMemo(() => {
    let approved = 0;
    let dropped = 0;
    let active = 0;
    if (!jkboseRollData || !jkboseRollData.classWiseData) {
      return { approved: 0, dropped: 0, active: 0 };
    }
    const classes = jkboseRollData.activeClasses || Object.keys(jkboseRollData.classWiseData);
    classes.forEach((cls) => {
      const data = jkboseRollData.classWiseData[cls];
      if (data && data.kpis) {
        approved += data.kpis.totalApproved || 0;
        dropped += data.kpis.totalDropped || 0;
        active += data.kpis.activeExaminees || 0;
      }
    });
    return { approved, dropped, active };
  }, [jkboseRollData]);

  const jkboseSubjectRows = useMemo(() => {
    if (!jkboseRollData || !jkboseRollData.classWiseData) return [];
    const rows = [];
    let idx = 1;
    (jkboseRollData.activeClasses || []).forEach((cls) => {
      const clsData = jkboseRollData.classWiseData[cls];
      if (clsData && Array.isArray(clsData.subjects)) {
        clsData.subjects.forEach((sub) => {
          rows.push({
            globalIdx: idx++,
            className: cls,
            classLabel: clsData.label,
            ...sub,
          });
        });
      }
    });
    return rows;
  }, [jkboseRollData]);

  // Dynamic drawer counts for tab badges
  const drawerCounts = useMemo(() => {
    let all = 0;
    let active = 0;
    let dropped = 0;
    deduplicatedStudents.forEach((s) => {
      const normClass = normalizeExamineeClass(getStudentClass(s) || s.class || s.Class || '');
      const activeClassFilter = drawerClass !== 'all' ? drawerClass : (selectedClasses.length === 1 && !selectedClasses.includes('All') ? normalizeExamineeClass(selectedClasses[0]) : 'all');
      if (activeClassFilter !== 'all' && normClass !== activeClassFilter) return;

      const hasRoll = Boolean(getAssignedClassRollNumber(s));
      const isApproved = isStudentAdmissionApproved(s);
      const isDropped = checkIsStudentDropped(s, droppedOverrides) || isStudentExamDropped(s);

      if (!isApproved && !hasRoll && !isDropped) return;

      all++;
      if (isDropped) dropped++;
      else active++;
    });
    return { all, active, dropped };
  }, [deduplicatedStudents, drawerClass, selectedClasses, droppedOverrides]);

  // Filter students for the Dropped Examinees Drawer
  const drawerStudents = useMemo(() => {
    return deduplicatedStudents.filter((s) => {
      const normClass = normalizeExamineeClass(getStudentClass(s) || s.class || s.Class || '');
      const activeClassFilter = drawerClass !== 'all' ? drawerClass : (selectedClasses.length === 1 && !selectedClasses.includes('All') ? normalizeExamineeClass(selectedClasses[0]) : 'all');
      if (activeClassFilter !== 'all' && normClass !== activeClassFilter) return false;

      const hasRoll = Boolean(getAssignedClassRollNumber(s));
      const isApproved = isStudentAdmissionApproved(s);
      const isDropped = checkIsStudentDropped(s, droppedOverrides) || isStudentExamDropped(s);

      // Must be an admitted/roll-assigned or approved student, or already marked as dropped
      if (!isApproved && !hasRoll && !isDropped) return false;

      if (drawerFilter === 'active' && isDropped) return false;
      if (drawerFilter === 'dropped' && !isDropped) return false;

      if (drawerSearch.trim()) {
        const q = drawerSearch.trim().toLowerCase();
        const name = getStudentDisplayName(s).toLowerCase();
        const roll = String(getAssignedClassRollNumber(s) || s.rollNo || s.classRollNo || '').toLowerCase();
        const reg = String(s['Board Registration Number'] || s['Board Reg. No.'] || s.boardRegNo || s.regNo || '').toLowerCase();
        const father = getStudentFatherName(s).toLowerCase();
        if (!name.includes(q) && !roll.includes(q) && !reg.includes(q) && !father.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [deduplicatedStudents, selectedClasses, drawerClass, drawerFilter, drawerSearch, droppedOverrides]);

  // Mark a student as dropped or active in Firestore with resilient cross-collection persistence
  const handleToggleExamDropped = async (student, shouldDrop, reasonText = '') => {
    const docId = student.id || student._id || student.docId || 'target';
    setSavingStudentId(docId);
    try {
      const res = await persistStudentExamDropStatus(
        student,
        shouldDrop,
        reasonText,
        user?.email || 'admin'
      );

      // Instantaneous UI update with all student keys
      setDroppedOverrides((prev) => {
        const next = new Map(prev);
        res.keys.forEach((k) => next.set(k, res.updatedStudent));
        if (docId) next.set(docId, res.updatedStudent);
        return next;
      });

      if (onDataUpdated) {
        onDataUpdated(res.updatedStudent);
      }

      logAdminActivity({
        action: shouldDrop ? 'EXAMINEE_DROPPED' : 'EXAMINEE_RESTORED',
        details: `${shouldDrop ? 'Marked as dropped from exam' : 'Restored to exam return'}: ${getStudentDisplayName(student)} (${reasonText || ''})`,
        adminEmail: user?.email || 'admin',
      });

      showToast(
        shouldDrop
          ? `🚫 ${getStudentDisplayName(student)} marked as dropped from examination.`
          : `✅ ${getStudentDisplayName(student)} restored to active examinee return.`,
        'success'
      );
    } catch (err) {
      console.error('Error updating examinee drop status:', err);
      showToast('Failed to update student exam status in database.', 'error');
    } finally {
      setSavingStudentId(null);
      setPendingDropStudent(null);
    }
  };

  const handleBulkExamStatus = async (shouldDrop, reasonText = '') => {
    if (selectedStudentIds.size === 0) {
      setIsBulkDropPending(false);
      return;
    }

    if (shouldDrop && !reasonText) {
      setIsBulkDropPending(true);
      return;
    }

    setSavingStudentId('bulk');
    try {
      const allCandidates = [
        ...(deduplicatedStudents || []),
        ...(students || []),
        ...(allStudents || []),
        ...(onDemandStudents || [])
      ];

      const targets = [];
      const seenIds = new Set();
      for (const rawId of selectedStudentIds) {
        if (!rawId || seenIds.has(rawId)) continue;
        seenIds.add(rawId);
        const match = allCandidates.find((s) => (s.id || s._id || s.docId || s._docId) === rawId);
        if (match) {
          targets.push(match);
        } else {
          targets.push({ id: rawId, docId: rawId });
        }
      }

      if (targets.length === 0) {
        setIsBulkDropPending(false);
        return;
      }

      let updatedCount = 0;
      const allKeysUpdated = [];
      for (const st of targets) {
        try {
          const res = await persistStudentExamDropStatus(
            st,
            shouldDrop,
            reasonText,
            user?.email || 'admin'
          );
          allKeysUpdated.push(...res.keys);
          if (st.id) allKeysUpdated.push(st.id);
          if (onDataUpdated) onDataUpdated(res.updatedStudent);
          updatedCount++;
        } catch (e) {
          console.error('Bulk update error for student:', st, e);
        }
      }

      if (updatedCount > 0) {
        setDroppedOverrides((prev) => {
          const next = new Map(prev);
          allKeysUpdated.forEach((k) => {
            next.set(k, { isExamDropped: shouldDrop, examStatus: shouldDrop ? 'dropped' : 'active' });
          });
          return next;
        });

        logAdminActivity({
          action: shouldDrop ? 'EXAMINEES_BULK_DROPPED' : 'EXAMINEES_BULK_RESTORED',
          details: `${shouldDrop ? 'Bulk marked dropped' : 'Bulk restored'} ${updatedCount} examinees (${reasonText || ''})`,
          adminEmail: user?.email || 'admin',
        });

        showToast(
          shouldDrop
            ? `🚫 ${updatedCount} examinee(s) marked as dropped from examination.`
            : `✅ ${updatedCount} examinee(s) restored to active exam return.`,
          'success'
        );
      }

      setSelectedStudentIds(new Set());
      setIsBulkDropPending(false);
      setCustomDropReason('');
      setDropReason(COMMON_DROPPED_REASONS[0]);
    } finally {
      setSavingStudentId(null);
      setIsBulkDropPending(false);
    }
  };

  // Handle Clean PDF Export (Direct Browser Print via Hidden Iframe)
  const handlePrintPDF = () => {
    if (analysisMode === 'jkbose_subject_rolls') {
      try {
        const resolvedCentre = cleanCentreNoDisplay(
          jkboseCentreNo || jkboseRollData?.detectedCentreNo || activeClassData?.centreNo || ''
        );
        printJkboseStatement({
          classWiseData: jkboseRollData?.classWiseData || {},
          selectedClass: effectiveJkboseClass,
          institutionName: jkboseInstitutionName,
          examName: jkboseExamName,
          centreNo: resolvedCentre,
          session: effectiveJkboseSession,
        });
      } catch (err) {
        console.error('Print dispatch failed:', err);
        showToast('Print dispatch failed: ' + (err.message || err), 'error');
      }
      return;
    }

    const reportTitle =
      analysisMode === 'subject'
        ? 'Subject-wise Enrollment Analysis Report'
        : analysisMode === 'stream_gender'
        ? 'Stream & Gender Strength Breakdown Report'
        : analysisMode === 'roll_stmt'
        ? 'Official Class Roll Statement & Candidate Summary'
        : 'Class-wise Admission & Enrollment Summary';

    let tableHeadersHtml = '';
    let tableRowsHtml = '';

    if (analysisMode === 'subject') {
      tableHeadersHtml = `
        <th>#</th>
        <th>Subject Name</th>
        <th>Stream</th>
        <th>Male (M)</th>
        <th>Female (F)</th>
        <th>Total Enrolled</th>
        <th>% Class Share</th>
      `;
      tableRowsHtml = stats.sortedSubjects
        .map((sub, idx) => {
          const share = stats.totalStudents > 0 ? ((sub.total / stats.totalStudents) * 100).toFixed(1) : 0;
          return `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${sub.name}</strong></td>
              <td>${sub.stream}</td>
              <td>${sub.male}</td>
              <td>${sub.female}</td>
              <td><strong>${sub.total}</strong></td>
              <td>${share}%</td>
            </tr>
          `;
        })
        .join('');
    } else if (analysisMode === 'stream_gender') {
      tableHeadersHtml = `
        <th>#</th>
        <th>Stream Category</th>
        <th>Male Candidates</th>
        <th>Female Candidates</th>
        <th>Total Strength</th>
        <th>Gender Split (M / F)</th>
      `;
      tableRowsHtml = stats.sortedStreams
        .map((stm, idx) => {
          const mPct = stm.total > 0 ? ((stm.male / stm.total) * 100).toFixed(1) : 0;
          const fPct = stm.total > 0 ? ((stm.female / stm.total) * 100).toFixed(1) : 0;
          return `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${stm.name}</strong></td>
              <td>${stm.male}</td>
              <td>${stm.female}</td>
              <td><strong>${stm.total}</strong></td>
              <td>${mPct}% M / ${fPct}% F</td>
            </tr>
          `;
        })
        .join('');
    } else if (analysisMode === 'roll_stmt') {
      tableHeadersHtml = `
        <th>#</th>
        <th>Class & Stream Bracket</th>
        <th>Assigned Roll Range</th>
        <th>Male (M)</th>
        <th>Female (F)</th>
        <th>Board Reg. Count</th>
        <th>Total Strength</th>
      `;
      tableRowsHtml = classGroupedRollStmts
        .map((grp) => {
          const itemRows = grp.items.map((r) => `
            <tr>
              <td>${r.globalIdx}</td>
              <td><strong>${r.key}</strong></td>
              <td>${r.rollRange}</td>
              <td>${r.male}</td>
              <td>${r.female}</td>
              <td>${r.regCount}</td>
              <td><strong>${r.total}</strong></td>
            </tr>
          `).join('');

          const subtotalRow = grp.items.length > 1 ? `
            <tr style="background:#e0e7ff; font-weight:bold; border-top:1.5px solid #4338ca; border-bottom:1.5px solid #4338ca;">
              <td>∑</td>
              <td><strong>COMBINED ${grp.className.toUpperCase()} CLASS TOTAL</strong></td>
              <td>All Streams Combined</td>
              <td>${grp.male}</td>
              <td>${grp.female}</td>
              <td>${grp.regCount}</td>
              <td><strong>${grp.total}</strong></td>
            </tr>
          ` : '';

          return itemRows + subtotalRow;
        })
        .join('');
    } else {
      tableHeadersHtml = `
        <th>#</th>
        <th>Class</th>
        <th>Approved</th>
        <th>Submitted</th>
        <th>Draft</th>
        <th>Male</th>
        <th>Female</th>
        <th>Total Enrolled</th>
      `;
      tableRowsHtml = stats.sortedClasses
        .map((c, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${formatClassDisplay(c.className)}</strong></td>
            <td>${c.approved}</td>
            <td>${c.submitted}</td>
            <td>${c.draft}</td>
            <td>${c.male}</td>
            <td>${c.female}</td>
            <td><strong>${c.total}</strong></td>
          </tr>
        `)
        .join('');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>HSS Shangus - Analytical Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1e293b; background: #ffffff; }
          .header { text-align: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
          .header h2 { margin: 4px 0 0 0; font-size: 13px; font-weight: bold; color: #475569; }
          .header p { margin: 2px 0 0 0; font-size: 11px; color: #64748b; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between; flex-wrap: wrap; }
          .meta-item { margin-bottom: 4px; }
          .meta-item strong { color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: bold; text-transform: uppercase; font-size: 10px; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          .total-row { background: #f1f5f9 !important; font-weight: bold; }
          .total-row td { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; color: #0f172a; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 10px; }
          .sig-box { text-align: center; width: 30%; border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 11px; font-weight: bold; color: #475569; }
          @media print {
            body { padding: 10px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Government Higher Secondary School Shangus</h1>
          <h2>Official Examination & Admission Analytics Cell</h2>
          <p>${reportTitle}</p>
        </div>

        <div class="meta-box">
          <div>
            <div class="meta-item"><strong>Session:</strong> ${selectedSessions.length === 0 ? 'All Sessions' : selectedSessions.join(', ')}</div>
            <div class="meta-item"><strong>Class:</strong> ${selectedClasses.length === 0 ? 'All Classes' : selectedClasses.join(', ')}</div>
            <div class="meta-item"><strong>Stream:</strong> ${selectedStreams.length === 0 ? 'All Streams' : selectedStreams.join(', ')}</div>
          </div>
          <div>
            <div class="meta-item"><strong>Gender Filter:</strong> ${selectedGenders.length === 0 ? 'All Genders' : selectedGenders.join(', ')}</div>
            <div class="meta-item"><strong>Subject Filter:</strong> ${selectedSubjects.length === 0 ? 'All Subjects' : selectedSubjects.join(', ')}</div>
            <div class="meta-item"><strong>Generated On:</strong> ${new Date().toLocaleString()}</div>
          </div>
          <div>
            <div class="meta-item"><strong>Total Records:</strong> ${stats.totalStudents}</div>
            <div class="meta-item"><strong>Male Strength:</strong> ${stats.maleCount}</div>
            <div class="meta-item"><strong>Female Strength:</strong> ${stats.femaleCount}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>${tableHeadersHtml}</tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            <tr class="total-row">
              <td colspan="3">SUMMARY TOTALS</td>
              <td>${stats.maleCount}</td>
              <td>${stats.femaleCount}</td>
              <td>${stats.totalStudents}</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">Prepared By<br><span style="font-size:9px;font-weight:normal;">Exam Cell Computer Operator</span></div>
          <div class="sig-box">Verified By<br><span style="font-size:9px;font-weight:normal;">Admission Committee Incharge</span></div>
          <div class="sig-box">Approved By<br><span style="font-size:9px;font-weight:normal;">Principal HSS Shangus</span></div>
        </div>
      </body>
      </html>
    `;

    printViaHiddenIframe(htmlContent);
  };

  // Handle Word Export for JKBOSE Statement
  const handleExportDocx = async () => {
    try {
      showToast('Generating Word (.docx) document...', 'info');
      const resolvedCentre = cleanCentreNoDisplay(
        jkboseCentreNo || jkboseRollData?.detectedCentreNo || activeClassData?.centreNo || ''
      );
      await generateJkboseDocx({
        classWiseData: jkboseRollData?.classWiseData || {},
        selectedClass: effectiveJkboseClass,
        institutionName: jkboseInstitutionName,
        examName: jkboseExamName,
        centreNo: resolvedCentre,
        session: effectiveJkboseSession,
      });
      showToast('Word (.docx) return statement downloaded successfully!', 'success');
    } catch (err) {
      console.error('Word (.docx) export failed:', err);
      showToast('Word (.docx) export failed: ' + (err.message || err), 'error');
    }
  };

  // Handle Clean Excel / CSV Export
  const handleExportExcel = () => {
    if (analysisMode === 'jkbose_subject_rolls') {
      try {
        showToast('Generating Excel (.xlsx) workbook...', 'info');
        const resolvedCentre = cleanCentreNoDisplay(
          jkboseCentreNo || jkboseRollData?.detectedCentreNo || activeClassData?.centreNo || ''
        );
        generateJkboseExcel({
          classWiseData: jkboseRollData?.classWiseData || {},
          selectedClass: effectiveJkboseClass,
          institutionName: jkboseInstitutionName,
          examName: jkboseExamName,
          centreNo: resolvedCentre,
          session: effectiveJkboseSession,
        });
        showToast('Excel (.xlsx) return statement downloaded successfully!', 'success');
      } catch (err) {
        console.error('Excel export failed:', err);
        showToast('Excel export failed: ' + (err.message || err), 'error');
      }
      return;
    }

    let csvRows = [];
    const sesStr = selectedSessions.length === 0 ? 'All' : selectedSessions.join(';');
    const clsStr = selectedClasses.length === 0 ? 'All' : selectedClasses.join(';');
    const stmStr = selectedStreams.length === 0 ? 'All' : selectedStreams.join(';');
    const genStr = selectedGenders.length === 0 ? 'All' : selectedGenders.join(';');

    // Header metadata
    csvRows.push(['GOVT HIGHER SECONDARY SCHOOL SHANGUS - ANALYTICAL REPORT']);
    csvRows.push([`Analysis Mode: ${analysisMode}`, `Session: ${sesStr}`, `Class: ${clsStr}`, `Stream: ${stmStr}`, `Gender: ${genStr}`, `Generated: ${new Date().toLocaleString()}`]);
    csvRows.push([]); // blank separator

    if (analysisMode === 'subject') {
      csvRows.push(['S.No', 'Subject Name', 'Stream', 'Male Candidates', 'Female Candidates', 'Total Enrolled', 'Class Share (%)']);
      stats.sortedSubjects.forEach((sub, idx) => {
        const share = stats.totalStudents > 0 ? ((sub.total / stats.totalStudents) * 100).toFixed(1) : '0';
        csvRows.push([idx + 1, `"${sub.name}"`, `"${sub.stream}"`, sub.male, sub.female, sub.total, `${share}%`]);
      });
    } else if (analysisMode === 'stream_gender') {
      csvRows.push(['S.No', 'Stream Category', 'Male Candidates', 'Female Candidates', 'Total Strength', 'Male Share (%)', 'Female Share (%)']);
      stats.sortedStreams.forEach((stm, idx) => {
        const mPct = stm.total > 0 ? ((stm.male / stm.total) * 100).toFixed(1) : '0';
        const fPct = stm.total > 0 ? ((stm.female / stm.total) * 100).toFixed(1) : '0';
        csvRows.push([idx + 1, `"${stm.name}"`, stm.male, stm.female, stm.total, `${mPct}%`, `${fPct}%`]);
      });
    } else if (analysisMode === 'roll_stmt') {
      csvRows.push(['S.No', 'Class & Stream Bracket', 'Assigned Roll Range', 'Male Candidates', 'Female Candidates', 'Board Reg Count', 'Total Strength']);
      classGroupedRollStmts.forEach((grp) => {
        grp.items.forEach((r) => {
          csvRows.push([r.globalIdx, `"${r.key}"`, `"${r.rollRange}"`, r.male, r.female, r.regCount, r.total]);
        });
        if (grp.items.length > 1) {
          csvRows.push(['∑', `"COMBINED ${grp.className.toUpperCase()} CLASS TOTAL"`, '"All Streams Combined"', grp.male, grp.female, grp.regCount, grp.total]);
        }
      });
    } else {
      csvRows.push(['S.No', 'Class', 'Approved', 'Submitted', 'Draft', 'Male', 'Female', 'Total Enrolled']);
      stats.sortedClasses.forEach((c, idx) => {
        csvRows.push([idx + 1, formatClassDisplay(c.className), c.approved, c.submitted, c.draft, c.male, c.female, c.total]);
      });
    }
    // Totals row
    csvRows.push([]);
    csvRows.push(['SUMMARY TOTALS', '', '', stats.maleCount, stats.femaleCount, stats.totalStudents, '100%']);

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSS_Shangus_Analytical_${analysisMode}_${sesStr}_${clsStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch PDF Print Generator (Multi-Report Packet via Hidden Iframe)
  const handleBatchPDFPrint = () => {

    const modeTitles = {
      enrollment: 'Class-wise Admission & Enrollment Summary',
      jkbose_subject_rolls: 'JKBOSE Official Subject-wise Roll Number Statement (Sub-Office Return)',
      roll_stmt: 'Official Class Roll Statement & Candidate Summary',
      stream_gender: 'Stream & Gender Strength Breakdown Report',
      subject: 'Subject-wise Enrollment Analysis Report',
    };

    let reportPagesHtml = selectedBatchModes
      .map((mode, pageIdx) => {
        let title = modeTitles[mode] || 'Analytical Report';
        let headersHtml = '';
        let rowsHtml = '';
        let footerHtml = '';

        if (mode === 'enrollment') {
          headersHtml = `
            <th>#</th>
            <th>Class Bracket</th>
            <th>Approved</th>
            <th>Submitted</th>
            <th>Draft</th>
            <th>Male (M)</th>
            <th>Female (F)</th>
            <th>Total Strength</th>
          `;
          rowsHtml = stats.sortedClasses
            .map((c, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${formatClassDisplay(c.className)}</strong></td>
                <td style="color:#059669;">${c.approved}</td>
                <td style="color:#d97706;">${c.submitted}</td>
                <td style="color:#64748b;">${c.draft}</td>
                <td style="color:#2563eb;">${c.male}</td>
                <td style="color:#e11d48;">${c.female}</td>
                <td><strong>${c.total}</strong></td>
              </tr>
            `)
            .join('');

          footerHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
              <td colspan="2">SUMMARY TOTALS</td>
              <td style="color:#059669;">${stats.approvedCount}</td>
              <td style="color:#d97706;">${stats.submittedCount}</td>
              <td style="color:#64748b;">${stats.draftCount}</td>
              <td style="color:#2563eb;">${stats.maleCount}</td>
              <td style="color:#e11d48;">${stats.femaleCount}</td>
              <td>${stats.totalStudents}</td>
            </tr>
          `;
        } else if (mode === 'roll_stmt') {
          headersHtml = `
            <th>#</th>
            <th>Class & Stream Bracket</th>
            <th>Assigned Roll Range</th>
            <th>Male (M)</th>
            <th>Female (F)</th>
            <th>Board Reg. Count</th>
            <th>Total Candidates</th>
          `;
          rowsHtml = classGroupedRollStmts
            .map((grp) => {
              const itemRows = grp.items
                .map((r) => `
                  <tr>
                    <td>${r.globalIdx}</td>
                    <td><strong>${formatClassDisplay(r.className)} (${r.stream})</strong></td>
                    <td style="color:#d97706; font-weight:bold;">${r.rollRange}</td>
                    <td style="color:#2563eb;">${r.male}</td>
                    <td style="color:#e11d48;">${r.female}</td>
                    <td>${r.regCount}</td>
                    <td><strong>${r.total}</strong></td>
                  </tr>
                `)
                .join('');

              const subtotalRow = `
                <tr style="background:#f1f5f9; font-weight:bold;">
                  <td style="color:#4f46e5;">&Sigma;</td>
                  <td style="color:#4f46e5;">COMBINED ${formatClassDisplay(grp.className).toUpperCase()} TOTAL (${grp.items.length} ${grp.items.length === 1 ? 'STREAM' : 'STREAMS'})</td>
                  <td style="color:#4f46e5;">All Streams Combined</td>
                  <td style="color:#2563eb;">${grp.male}</td>
                  <td style="color:#e11d48;">${grp.female}</td>
                  <td style="color:#4f46e5;">${grp.regCount}</td>
                  <td style="color:#4f46e5;">${grp.total}</td>
                </tr>
              `;
              return itemRows + subtotalRow;
            })
            .join('');

          footerHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
              <td colspan="3">SUMMARY TOTALS</td>
              <td style="color:#2563eb;">${stats.maleCount}</td>
              <td style="color:#e11d48;">${stats.femaleCount}</td>
              <td>${stats.regCount}</td>
              <td>${stats.totalStudents}</td>
            </tr>
          `;
        } else if (mode === 'stream_gender') {
          headersHtml = `
            <th>#</th>
            <th>Stream Category</th>
            <th>Male Candidates</th>
            <th>Female Candidates</th>
            <th>Total Strength</th>
            <th>Gender Split (M / F)</th>
          `;
          rowsHtml = stats.sortedStreams
            .map((stm, idx) => {
              const mPct = stm.total > 0 ? ((stm.male / stm.total) * 100).toFixed(1) : 0;
              const fPct = stm.total > 0 ? ((stm.female / stm.total) * 100).toFixed(1) : 0;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${stm.name}</strong></td>
                  <td>${stm.male}</td>
                  <td>${stm.female}</td>
                  <td><strong>${stm.total}</strong></td>
                  <td>${mPct}% M / ${fPct}% F</td>
                </tr>
              `;
            })
            .join('');

          footerHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
              <td colspan="2">SUMMARY TOTALS</td>
              <td style="color:#2563eb;">${stats.maleCount}</td>
              <td style="color:#e11d48;">${stats.femaleCount}</td>
              <td>${stats.totalStudents}</td>
              <td>100%</td>
            </tr>
          `;
        } else if (mode === 'subject') {
          headersHtml = `
            <th>#</th>
            <th>Subject Name</th>
            <th>Dominant Stream</th>
            <th>Male (M)</th>
            <th>Female (F)</th>
            <th>Total Enrolled</th>
            <th>% Class Share</th>
          `;
          rowsHtml = stats.sortedSubjects
            .map((sub, idx) => {
              const share = stats.totalStudents > 0 ? ((sub.total / stats.totalStudents) * 100).toFixed(1) : 0;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${sub.name}</strong></td>
                  <td>${sub.stream}</td>
                  <td>${sub.male}</td>
                  <td>${sub.female}</td>
                  <td><strong>${sub.total}</strong></td>
                  <td>${share}%</td>
                </tr>
              `;
            })
            .join('');

          footerHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
              <td colspan="3">SUMMARY TOTALS</td>
              <td style="color:#2563eb;">${stats.maleCount}</td>
              <td style="color:#e11d48;">${stats.femaleCount}</td>
              <td>${stats.totalStudents}</td>
              <td>100%</td>
            </tr>
          `;
        } else if (mode === 'jkbose_subject_rolls') {
          headersHtml = `
            <th style="width:35px; text-align:center;">#</th>
            <th>Subject Name</th>
            <th style="width:70px; text-align:center;">Class</th>
            <th>Roll Number Series (Range Compressed with "TO" and ",")</th>
            <th style="width:80px; text-align:center;">Total Examinees</th>
          `;
          rowsHtml = jkboseSubjectRows
            .map((r) => `
              <tr>
                <td style="text-align:center;">${r.globalIdx}</td>
                <td><strong>${r.subject}</strong></td>
                <td style="text-align:center;">${formatClassDisplay(r.className)}</td>
                <td style="font-family:monospace; font-size:10px; font-weight:bold; color:#1e1b4b;">${r.rollNumbersSeries || 'No examinees'}</td>
                <td style="text-align:center; font-weight:bold;">${r.candidateCount}</td>
              </tr>
            `)
            .join('');

          footerHtml = `
            <tr style="background:#f8fafc; font-weight:bold;">
              <td colspan="4">TOTAL UNIQUE SUBJECT RETURNS (${jkboseSubjectRows.length} SUBJECTS)</td>
              <td style="text-align:center; color:#4f46e5; font-size:13px;">${jkboseSubjectRows.reduce((sum, r) => sum + (r.candidateCount || 0), 0)}</td>
            </tr>
          `;
        }

        const isLastPage = pageIdx === selectedBatchModes.length - 1;

        return `
          <div class="report-page" style="${!isLastPage ? 'page-break-after: always;' : ''}">
            <div class="header">
              <h1>GOVT. HIGHER SECONDARY SCHOOL SHANGUS</h1>
              <h2>OFFICIAL ANALYTICS & STATISTICAL REPORTS PACKET</h2>
              <div class="subtitle">${title}</div>
            </div>

            <div class="meta">
              <div><strong>Selected Session(s):</strong> ${selectedSessions.length > 0 ? selectedSessions.join(', ') : 'All Sessions'}</div>
              <div><strong>Form Status:</strong> ${selectedStatuses.length > 0 ? selectedStatuses.join(', ') : 'All Statuses'}</div>
              <div><strong>Total Enrolled:</strong> ${stats.totalStudents} (Male: ${stats.maleCount}, Female: ${stats.femaleCount})</div>
              <div><strong>Generated On:</strong> ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString()}</div>
            </div>

            <table>
              <thead><tr>${headersHtml}</tr></thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>${footerHtml}</tfoot>
            </table>
          </div>
        `;
      })
      .join('');

    const packetHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>BHSS Shangus - Batch Reports Packet</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { margin: 0; font-size: 20px; color: #0f172a; letter-spacing: 0.5px; }
            .header h2 { margin: 4px 0 0 0; font-size: 14px; color: #0284c7; font-weight: 600; }
            .header .subtitle { margin-top: 6px; font-size: 13px; font-weight: bold; color: #334155; text-transform: uppercase; }
            .meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; background: #f8fafc; padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; font-weight: bold; color: #334155; }
            .sig-box { border-top: 1px solid #94a3b8; width: 180px; padding-top: 5px; }
            @media print {
              body { margin: 0; }
              .report-page { page-break-after: always; }
              .report-page:last-child { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          ${reportPagesHtml}
          <div class="footer" style="margin-top: 40px;">
            <div class="sig-box">Dealing Assistant / Convenor</div>
            <div class="sig-box">Verified by Admission Committee</div>
            <div class="sig-box">Principal, BHSS Shangus</div>
          </div>
        </body>
      </html>
    `;

    printViaHiddenIframe(packetHtml);
  };

  // Batch Excel Export Generator
  const handleBatchExcelExport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'GOVT HIGHER SECONDARY SCHOOL SHANGUS - BATCH STATISTICAL REPORTS PACKET\n';
    csvContent += `Generated On: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}\n`;
    csvContent += `Selected Sessions: ${selectedSessions.length > 0 ? selectedSessions.join(';') : 'All Sessions'}\n\n`;

    selectedBatchModes.forEach((mode) => {
      if (mode === 'enrollment') {
        csvContent += '--- CLASS ENROLLMENT SUMMARY ---\n';
        csvContent += '#,Class Bracket,Approved,Submitted,Draft,Male (M),Female (F),Total Strength\n';
        stats.sortedClasses.forEach((c, idx) => {
          csvContent += `"${idx + 1}","${formatClassDisplay(c.className)}","${c.approved}","${c.submitted}","${c.draft}","${c.male}","${c.female}","${c.total}"\n`;
        });
        csvContent += `SUMMARY TOTALS,All Classes,"${stats.approvedCount}","${stats.submittedCount}","${stats.draftCount}","${stats.maleCount}","${stats.femaleCount}","${stats.totalStudents}"\n\n`;
      } else if (mode === 'roll_stmt') {
        csvContent += '--- CLASS ROLL STATEMENT & CANDIDATE SUMMARY ---\n';
        csvContent += '#,Class & Stream Bracket,Assigned Roll Range,Male (M),Female (F),Board Reg. Count,Total Candidates\n';
        classGroupedRollStmts.forEach((grp) => {
          grp.items.forEach((r) => {
            csvContent += `"${r.globalIdx}","${formatClassDisplay(r.className)} (${r.stream})","${r.rollRange}","${r.male}","${r.female}","${r.regCount}","${r.total}"\n`;
          });
          csvContent += `COMBINED TOTAL,${formatClassDisplay(grp.className)} (${grp.items.length} STREAMS),All Streams Combined,"${grp.male}","${grp.female}","${grp.regCount}","${grp.total}"\n`;
        });
        csvContent += `SUMMARY TOTALS,All Streams Combined,Total Enrolled,"${stats.maleCount}","${stats.femaleCount}","${stats.regCount}","${stats.totalStudents}"\n\n`;
      } else if (mode === 'stream_gender') {
        csvContent += '--- STREAM & GENDER STRENGTH BREAKDOWN ---\n';
        csvContent += '#,Stream Category,Male Candidates,Female Candidates,Total Strength,Gender Split (M / F)\n';
        stats.sortedStreams.forEach((stm, idx) => {
          const mPct = stm.total > 0 ? ((stm.male / stm.total) * 100).toFixed(1) : 0;
          const fPct = stm.total > 0 ? ((stm.female / stm.total) * 100).toFixed(1) : 0;
          csvContent += `"${idx + 1}","${stm.name}","${stm.male}","${stm.female}","${stm.total}","${mPct}% M / ${fPct}% F"\n`;
        });
        csvContent += `SUMMARY TOTALS,All Streams,"${stats.maleCount}","${stats.femaleCount}","${stats.totalStudents}",100%\n\n`;
      } else if (mode === 'subject') {
        csvContent += '--- SUBJECT-WISE ENROLLMENT ANALYSIS ---\n';
        csvContent += '#,Subject Name,Dominant Stream,Male (M),Female (F),Total Enrolled,% Class Share\n';
        stats.sortedSubjects.forEach((sub, idx) => {
          const share = stats.totalStudents > 0 ? ((sub.total / stats.totalStudents) * 100).toFixed(1) : 0;
          csvContent += `"${idx + 1}","${sub.name}","${sub.stream}","${sub.male}","${sub.female}","${sub.total}","${share}%"\n`;
        });
        csvContent += `SUMMARY TOTALS,All Subjects,"${stats.maleCount}","${stats.femaleCount}","${stats.totalStudents}",100%\n\n`;
      } else if (mode === 'jkbose_subject_rolls') {
        csvContent += '--- JKBOSE SUBJECT-WISE ROLL NUMBER RETURN STATEMENT ---\n';
        csvContent += '#,Subject Name,Class,Compressed Roll Number Series,Total Candidates\n';
        jkboseSubjectRows.forEach((r) => {
          csvContent += `"${r.globalIdx}","${r.subject}","${formatClassDisplay(r.className)}","${(r.rollNumbersSeries || '').replace(/"/g, '""')}","${r.candidateCount}"\n`;
        });
        const totalCandidates = jkboseSubjectRows.reduce((sum, r) => sum + (r.candidateCount || 0), 0);
        csvContent += `TOTAL UNIQUE MAPPINGS,All Subjects,${jkboseSubjectRows.length} Subjects,"-","${totalCandidates}"\n\n`;
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BHSS_Shangus_Batch_Reports_Packet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className={isPage
      ? "bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl w-full p-2 sm:p-3.5 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-1.5 sm:space-y-2.5 flex flex-col"
      : "bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl max-w-6xl w-full p-2 sm:p-4 shadow-xl border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2.5 h-[98vh] sm:h-auto max-h-[98vh] sm:max-h-[92vh] flex flex-col overflow-hidden"
    }>
        {/* Top Title Bar: Single Row on All Devices */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 sm:pb-2.5 gap-2 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-base font-black flex items-center gap-1.5 text-slate-900 dark:text-white truncate">
              <BarChart2 size={16} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span className="truncate">Analytics & Statistical Reports Suite</span>
              {(isLoadingHistory || isLoadingSeed) && (
                <span className="text-[10px] text-amber-500 font-bold animate-pulse hidden sm:inline-block">
                  • Loading archive...
                </span>
              )}
            </h2>
            <p className="hidden sm:block text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Enrollment analysis, subject counts, and gender breakdown across current & past academic sessions (2006–2026).
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center gap-1.5">
              {/* Batch Auto-Generate Button & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
                  title="Auto-generate and download multiple report types at once"
                >
                  <Sparkles size={13} />
                  <span>Batch Auto-Generate</span>
                  <ChevronDown size={11} className={`transition-transform ${showBatchMenu ? 'rotate-180' : ''}`} />
                </button>

                {showBatchMenu && (
                  <div className="absolute right-0 mt-1.5 w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-[100000] p-2.5 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Select Reports</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBatchModes.length === REPORT_MODES.length) setSelectedBatchModes([]);
                          else setSelectedBatchModes(REPORT_MODES.map((m) => m.id));
                        }}
                        className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        {selectedBatchModes.length === REPORT_MODES.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {REPORT_MODES.map((mode) => (
                        <label
                          key={mode.id}
                          className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs text-slate-700 dark:text-slate-200 font-medium transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBatchModes.includes(mode.id)}
                            onChange={() => {
                              if (selectedBatchModes.includes(mode.id)) {
                                setSelectedBatchModes(selectedBatchModes.filter((id) => id !== mode.id));
                              } else {
                                setSelectedBatchModes([...selectedBatchModes, mode.id]);
                              }
                            }}
                            className="w-3.5 h-3.5 text-amber-600 rounded cursor-pointer"
                          />
                          <span>{mode.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleBatchPDFPrint();
                          setShowBatchMenu(false);
                        }}
                        disabled={selectedBatchModes.length === 0}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                      >
                        <Printer size={12} />
                        <span>Batch PDF Packet ({selectedBatchModes.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleBatchExcelExport();
                          setShowBatchMenu(false);
                        }}
                        disabled={selectedBatchModes.length === 0}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                      >
                        <FileSpreadsheet size={12} />
                        <span>Batch Excel File ({selectedBatchModes.length})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {analysisMode === 'jkbose_subject_rolls' && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsDroppedDrawerOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg font-bold text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                    title="Manage dropped examinees to exclude them from the JKBOSE statement"
                  >
                    <UserX size={13} />
                    <span>Manage Dropped ({jkboseKpis.dropped})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDocx}
                    className="px-2.5 py-1.5 rounded-lg font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                    title="Export official statement in Microsoft Word (.docx)"
                  >
                    <FileText size={13} />
                    <span>Word (.docx)</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handlePrintPDF}
                className="px-2.5 py-1.5 rounded-lg font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Printer size={13} />
                <span>Print PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-2.5 py-1.5 rounded-lg font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <FileSpreadsheet size={13} />
                <span>Export Excel</span>
              </button>
            </div>

            {/* Pinned Close Button: shown only in Modal mode (in Full Page mode, dashboard header bar has authoritative back button) */}
            {!isPage && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                aria-label="Close"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Action Bar: Compact 3-Button Row */}
        <div className="flex sm:hidden items-center gap-1 flex-shrink-0">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => setShowBatchMenu(!showBatchMenu)}
              className="w-full py-1 px-1.5 rounded-lg font-bold text-[11px] text-white bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
            >
              <Sparkles size={11} />
              <span>Batch Auto</span>
              <ChevronDown size={10} className={`transition-transform ${showBatchMenu ? 'rotate-180' : ''}`} />
            </button>

            {showBatchMenu && (
              <div className="absolute left-0 mt-1 w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-[100000] p-2 space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Reports to Generate</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBatchModes.length === REPORT_MODES.length) setSelectedBatchModes([]);
                      else setSelectedBatchModes(REPORT_MODES.map((m) => m.id));
                    }}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    {selectedBatchModes.length === REPORT_MODES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {REPORT_MODES.map((mode) => (
                    <label
                      key={mode.id}
                      className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-[11px] text-slate-700 dark:text-slate-200 font-medium transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatchModes.includes(mode.id)}
                        onChange={() => {
                          if (selectedBatchModes.includes(mode.id)) {
                            setSelectedBatchModes(selectedBatchModes.filter((id) => id !== mode.id));
                          } else {
                            setSelectedBatchModes([...selectedBatchModes, mode.id]);
                          }
                        }}
                        className="w-3.5 h-3.5 text-amber-600 rounded cursor-pointer"
                      />
                      <span className="truncate">{mode.label}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleBatchPDFPrint();
                      setShowBatchMenu(false);
                    }}
                    disabled={selectedBatchModes.length === 0}
                    className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Printer size={11} />
                    <span>PDF Packet ({selectedBatchModes.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleBatchExcelExport();
                      setShowBatchMenu(false);
                    }}
                    disabled={selectedBatchModes.length === 0}
                    className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet size={11} />
                    <span>Excel File ({selectedBatchModes.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {analysisMode === 'jkbose_subject_rolls' && (
            <button
              type="button"
              onClick={handleExportDocx}
              className="flex-1 py-1 px-1.5 rounded-lg font-bold text-[11px] text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
            >
              <FileText size={11} />
              <span>Word</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintPDF}
            className="flex-1 py-1 px-1.5 rounded-lg font-bold text-[11px] text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <Printer size={11} />
            <span>Print PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex-1 py-1 px-1.5 rounded-lg font-bold text-[11px] text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <FileSpreadsheet size={11} />
            <span>Export Excel</span>
          </button>
        </div>

        {/* 6-Filter Interactive Toolbar: Compact & Mobile-First */}
        <div className="bg-slate-50 dark:bg-slate-950 p-1 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex-shrink-0">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5">
            {/* 1. Report Mode Selector */}
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value)}
              className="col-span-2 sm:col-span-1 py-1 px-2 rounded-lg text-[11px] sm:text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="enrollment">Class Enrollment Summary</option>
              <option value="jkbose_subject_rolls">JKBOSE Subject-wise Roll Number Statement</option>
              <option value="subject">Subject-wise Analysis</option>
              <option value="stream_gender">Stream & Gender Breakdown</option>
              <option value="roll_stmt">Roll Statement (Roll Stmt)</option>
            </select>

            {/* Dropdown Filters */}
            <MultiSelectDropdown
              label="Status"
              customAllLabel="All Statuses"
              options={['Approved', 'Submitted', 'Draft', 'Rejected']}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
            />

            <MultiSelectDropdown
              label="Sessions"
              options={availableSessions}
              selected={selectedSessions}
              onChange={setSelectedSessions}
            />

            <MultiSelectDropdown
              label="Classes"
              options={availableClasses}
              selected={selectedClasses}
              onChange={setSelectedClasses}
            />

            <MultiSelectDropdown
              label="Genders"
              options={availableGenders}
              selected={selectedGenders}
              onChange={setSelectedGenders}
            />

            <MultiSelectDropdown
              label="Streams"
              options={availableStreams}
              selected={selectedStreams}
              onChange={setSelectedStreams}
            />

            <MultiSelectDropdown
              label="Subjects"
              options={availableSubjects}
              selected={selectedSubjects}
              onChange={setSelectedSubjects}
            />
          </div>
        </div>

        {/* JKBOSE Subject Roll Return Parameters & Class Selection Controls */}
        {analysisMode === 'jkbose_subject_rolls' && (
          <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 shadow-xs space-y-2.5 flex-shrink-0 animate-fadeIn">
            {/* Class Selection Tabs & Manage Dropped Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                  Select Class:
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {[
                    { id: '12th', label: 'Class 12th (HSE-II)' },
                    { id: '11th', label: 'Class 11th (HSE-I)' },
                    { id: '10th', label: 'Class 10th (SSE)' },
                    { id: 'all', label: 'All Classes (Classwise)' },
                  ].map((tab) => {
                    const isSelected = effectiveJkboseClass === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setJkboseSelectedClass(tab.id);
                          setExpandedSubject(null);
                          if (tab.id === 'all') {
                            setSelectedClasses([]);
                          } else {
                            setSelectedClasses([`Class ${tab.id}`]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dropped Examinees Trigger Button */}
              <button
                type="button"
                onClick={() => setIsDroppedDrawerOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <UserX size={14} />
                <span>Manage Dropped Examinees ({jkboseKpis.dropped})</span>
              </button>
            </div>

            {/* 5 Customizable Return Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-0.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                  Institution Name
                </label>
                <input
                  type="text"
                  value={jkboseInstitutionName}
                  onChange={(e) => setJkboseInstitutionName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                  Examination
                </label>
                <input
                  type="text"
                  value={jkboseExamName}
                  onChange={(e) => setJkboseExamName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5 flex items-center justify-between">
                  <span>Centre Number</span>
                  {jkboseRollData?.detectedCentreNo && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold lowercase">
                      auto-detected
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={jkboseCentreNo}
                  placeholder={jkboseRollData?.detectedCentreNo ? cleanCentreNoDisplay(jkboseRollData.detectedCentreNo) : 'e.g. 301003, 301004'}
                  onChange={(e) => {
                    setJkboseCentreNo(e.target.value);
                    setIsJkboseCentreManuallyEdited(true);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5 flex items-center justify-between">
                  <span>Session</span>
                  {(isLoadingHistory || isLoadingSeed || isLoadingSession) && (
                    <span className="text-[9px] text-amber-500 animate-pulse font-bold">Syncing…</span>
                  )}
                </label>
                <select
                  value={selectedSessions[0] || '2025-26'}
                  onChange={(e) => {
                    const newSes = e.target.value;
                    setSelectedSessions([newSes]);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  {availableSessions.map((ses) => (
                    <option key={ses} value={ses}>Session {ses}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                  Roll No Source
                </label>
                <select
                  value={jkboseRollType}
                  onChange={(e) => setJkboseRollType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="auto">Auto (Board Exam Roll &gt; Class Roll)</option>
                  <option value="board">Board Exam Roll No strictly</option>
                  <option value="class">Assigned Class Roll No strictly</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Executive Summary Stat Cards: Ultra-Compact & Responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 flex-shrink-0">
          <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {analysisMode === 'jkbose_subject_rolls' ? 'Approved in Filter' : 'Total Enrolled'}
            </span>
            <div className="text-xs sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1">
              <Users size={12} className="text-indigo-600 flex-shrink-0" />
              <span>{analysisMode === 'jkbose_subject_rolls' ? jkboseKpis.approved : stats.totalStudents}</span>
            </div>
          </div>

          <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              {analysisMode === 'jkbose_subject_rolls' ? 'Active in Return' : 'Male Strength'}
            </span>
            <div className="text-xs sm:text-base font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              {analysisMode === 'jkbose_subject_rolls' ? (
                <span>{jkboseKpis.active}</span>
              ) : (
                <>
                  <span className="text-sky-600">{stats.maleCount}</span>
                  <span className="text-[9px] sm:text-[10px] font-normal text-slate-500">
                    ({stats.totalStudents > 0 ? ((stats.maleCount / stats.totalStudents) * 100).toFixed(0) : 0}%)
                  </span>
                </>
              )}
            </div>
          </div>

          <div
            onClick={analysisMode === 'jkbose_subject_rolls' ? () => setIsDroppedDrawerOpen(true) : undefined}
            className={`p-1 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-all ${
              analysisMode === 'jkbose_subject_rolls' ? 'cursor-pointer hover:border-rose-400 hover:bg-rose-50/40 dark:hover:bg-rose-950/30' : ''
            }`}
            title={analysisMode === 'jkbose_subject_rolls' ? 'Click to open Dropped Examinees Manager' : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {analysisMode === 'jkbose_subject_rolls' ? 'Dropped from Exam' : 'Female Strength'}
              </span>
              {analysisMode === 'jkbose_subject_rolls' && (
                <span className="text-[9px] font-bold text-rose-500 underline hidden sm:inline">Manage</span>
              )}
            </div>
            <div className="text-xs sm:text-base font-black text-rose-600 flex items-center gap-1">
              {analysisMode === 'jkbose_subject_rolls' ? (
                <span>{jkboseKpis.dropped}</span>
              ) : (
                <>
                  <span>{stats.femaleCount}</span>
                  <span className="text-[9px] sm:text-[10px] font-normal text-slate-500">
                    ({stats.totalStudents > 0 ? ((stats.femaleCount / stats.totalStudents) * 100).toFixed(0) : 0}%)
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              {analysisMode === 'jkbose_subject_rolls' ? 'Subject Returns' : 'Top Subject'}
            </span>
            <div className="text-[11px] sm:text-xs font-black text-amber-600 dark:text-amber-400 truncate" title={analysisMode === 'jkbose_subject_rolls' ? `${jkboseSubjectRows.length} canonical mappings` : stats.topSubject}>
              {analysisMode === 'jkbose_subject_rolls' ? `${jkboseSubjectRows.length} Mappings` : stats.topSubject}
            </div>
          </div>
        </div>

        {/* Main Analytics Data Table View: Scrollable & Compact */}
        <div className={isPage
          ? "overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 custom-scrollbar max-h-[650px] min-h-[400px]"
          : "overflow-auto flex-1 min-h-0 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 custom-scrollbar"
        }>
          {/* Paper Header Preview for JKBOSE Return */}
          {analysisMode === 'jkbose_subject_rolls' && (
            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-center space-y-1">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white uppercase">
                {jkboseInstitutionName}
              </h3>
              <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                SUBJECT-WISE ROLL NUMBER RETURN STATEMENT FOR EXAMINEES
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 pt-0.5 flex items-center justify-center gap-2.5 flex-wrap">
                <span>
                  <strong>EXAMINATION:</strong> {activeClassData ? activeClassData.label : 'CLASS'} — {jkboseExamName} ({effectiveJkboseSession})
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 text-[11px]">
                  {cleanCentreNoDisplay(jkboseCentreNo || jkboseRollData?.detectedCentreNo || activeClassData?.centreNo || '') || 'Centre: Pending'}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-500 italic pt-0.5">
                Continuous roll series are separated by <strong>"TO"</strong> & single Roll Numbers by <strong>Comma</strong>. Click any subject row to inspect enrolled student names.
              </div>
            </div>
          )}

          <table className={`w-full text-left text-[10.5px] sm:text-xs font-medium border-collapse ${
            analysisMode === 'jkbose_subject_rolls' ? 'min-w-[960px]' : 'min-w-[780px]'
          }`}>
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black uppercase text-[9.5px] sm:text-[10.5px] border-b border-slate-200 dark:border-slate-700 z-10">
              {analysisMode === 'jkbose_subject_rolls' && (
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200">
                  <th className="py-2.5 px-3 w-14 min-w-[56px] text-center whitespace-nowrap">S.No</th>
                  <th className="py-2.5 px-4 w-60 min-w-[220px] whitespace-nowrap">Subject</th>
                  <th className="py-2.5 px-3 w-32 min-w-[110px] text-center whitespace-nowrap">Class</th>
                  <th className="py-2.5 px-4 min-w-[460px] whitespace-nowrap">Roll Numbers ( separate continuous series by "TO" & single Roll No's by "Comma" )</th>
                  <th className="py-2.5 px-3 w-32 min-w-[110px] text-center whitespace-nowrap">Total Candidates</th>
                </tr>
              )}

              {analysisMode === 'subject' && (
                <tr>
                  <th className="py-2 px-3 w-14 min-w-[56px] text-center whitespace-nowrap">#</th>
                  <th className="py-2 px-4 w-60 min-w-[200px] whitespace-nowrap">Subject Name</th>
                  <th className="py-2 px-3 w-44 min-w-[140px] whitespace-nowrap">Stream</th>
                  {showMaleCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Male (M)</th>}
                  {showFemaleCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Female (F)</th>}
                  <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Enrolled</th>
                  <th className="py-2 px-4 w-28 min-w-[90px] text-right whitespace-nowrap">% Share</th>
                </tr>
              )}

              {analysisMode === 'stream_gender' && (
                <tr>
                  <th className="py-2 px-3 w-14 min-w-[56px] text-center whitespace-nowrap">#</th>
                  <th className="py-2 px-4 min-w-[240px] whitespace-nowrap">Stream Bracket</th>
                  {showMaleCol && <th className="py-2 px-3 w-32 min-w-[100px] text-center whitespace-nowrap">Male</th>}
                  {showFemaleCol && <th className="py-2 px-3 w-32 min-w-[100px] text-center whitespace-nowrap">Female</th>}
                  <th className="py-2 px-3 w-36 min-w-[110px] text-center whitespace-nowrap">Total Strength</th>
                  <th className="py-2 px-4 w-44 min-w-[130px] text-right whitespace-nowrap">Gender Split (M / F)</th>
                </tr>
              )}

              {analysisMode === 'roll_stmt' && (
                <tr>
                  <th className="py-2 px-3 w-14 min-w-[56px] text-center whitespace-nowrap">#</th>
                  <th className="py-2 px-4 min-w-[220px] whitespace-nowrap">Class & Stream</th>
                  <th className="py-2 px-3 min-w-[160px] whitespace-nowrap">Roll Range</th>
                  {showMaleCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Male (M)</th>}
                  {showFemaleCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Female (F)</th>}
                  <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Reg. Count</th>
                  <th className="py-2 px-4 w-28 min-w-[90px] text-right whitespace-nowrap">Total</th>
                </tr>
              )}

              {analysisMode === 'enrollment' && (
                <tr>
                  <th className="py-2 px-3 w-14 min-w-[56px] text-center whitespace-nowrap">#</th>
                  <th className="py-2 px-4 min-w-[180px] whitespace-nowrap">Class</th>
                  {showApprovedCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Approved</th>}
                  {showSubmittedCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Submitted</th>}
                  {showDraftCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Draft</th>}
                  {showMaleCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Male (M)</th>}
                  {showFemaleCol && <th className="py-2 px-3 w-28 min-w-[90px] text-center whitespace-nowrap">Female (F)</th>}
                  <th className="py-2 px-4 w-28 min-w-[90px] text-right whitespace-nowrap">Total</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {analysisMode === 'jkbose_subject_rolls' && (
                jkboseSubjectRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic font-medium">
                      No approved examinee data found for {effectiveJkboseClass === 'all' ? 'the selected classes' : `Class ${effectiveJkboseClass}`}.
                    </td>
                  </tr>
                ) : (
                  jkboseSubjectRows.map((r, idx) => {
                    const isExpanded = expandedSubject === `${r.className}_${r.subject}`;
                    return (
                      <React.Fragment key={`${r.className}_${r.subject}`}>
                        <tr
                          onClick={() => setExpandedSubject(isExpanded ? null : `${r.className}_${r.subject}`)}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-900/30'
                          }`}
                          title="Click to view/hide examinee roll numbers list"
                        >
                          <td className="py-2.5 px-3 text-center text-slate-500 font-bold text-xs whitespace-nowrap">{r.globalIdx}</td>
                          <td className="py-2.5 px-4 font-black text-slate-900 dark:text-white text-xs whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <span>{r.subject}</span>
                              <span className="text-slate-400">
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 inline-block">
                              {formatClassDisplay(r.className)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-[11.5px]">
                            {r.rollNumbersSeries ? (
                              r.rollNumbersSeries.split(/(TO|, )/g).map((part, pIdx) => {
                                if (part === 'TO') {
                                  return (
                                    <strong key={pIdx} className="text-indigo-600 dark:text-indigo-400 font-black px-1 underline decoration-indigo-400">
                                      TO
                                    </strong>
                                  );
                                }
                                return <span key={pIdx}>{part}</span>;
                              })
                            ) : (
                              <span className="text-slate-400 font-normal italic">No examinees</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-full font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {r.candidateCount}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && Array.isArray(r.rawRollNumbers) && r.rawRollNumbers.length > 0 && (
                          <tr className="bg-slate-50/80 dark:bg-slate-950/60">
                            <td colSpan={5} className="p-3 sm:p-4 border-y border-indigo-100 dark:border-indigo-900/40">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                  <span>Enrolled Examinees in {r.subject} ({r.candidateCount} candidates):</span>
                                  <span className="text-[10px] text-slate-400 font-normal">Click row to collapse</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 custom-scrollbar">
                                  {r.rawRollNumbers.map((rollNum, rollIdx) => (
                                    <span
                                      key={rollIdx}
                                      className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                    >
                                      #{rollNum}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )
              )}

              {analysisMode === 'subject' &&
                stats.sortedSubjects.map((sub, idx) => {
                  const share = stats.totalStudents > 0 ? ((sub.total / stats.totalStudents) * 100).toFixed(1) : '0';
                  return (
                    <tr key={sub.name} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{sub.name}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[9.5px]">
                          {sub.stream}
                        </span>
                      </td>
                      {showMaleCol && <td className="py-2 px-3 text-center text-sky-600 font-bold whitespace-nowrap">{sub.male}</td>}
                      {showFemaleCol && <td className="py-2 px-3 text-center text-rose-600 font-bold whitespace-nowrap">{sub.female}</td>}
                      <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap">{sub.total}</td>
                      <td className="py-2 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{share}%</td>
                    </tr>
                  );
                })}

              {analysisMode === 'stream_gender' &&
                stats.sortedStreams.map((stm, idx) => {
                  const mPct = stm.total > 0 ? ((stm.male / stm.total) * 100).toFixed(1) : '0';
                  const fPct = stm.total > 0 ? ((stm.female / stm.total) * 100).toFixed(1) : '0';
                  return (
                    <tr key={stm.name} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono whitespace-nowrap">{idx + 1}</td>
                      <td className="py-2 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{stm.name}</td>
                      {showMaleCol && <td className="py-2 px-3 text-center text-sky-600 font-bold whitespace-nowrap">{stm.male}</td>}
                      {showFemaleCol && <td className="py-2 px-3 text-center text-rose-600 font-bold whitespace-nowrap">{stm.female}</td>}
                      <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap">{stm.total}</td>
                      <td className="py-2 px-4 text-right font-bold text-[10px] sm:text-xs whitespace-nowrap">
                        <span className="text-sky-600">{mPct}% M</span> / <span className="text-rose-600">{fPct}% F</span>
                      </td>
                    </tr>
                  );
                })}

              {analysisMode === 'roll_stmt' &&
                classGroupedRollStmts.map((grp) => (
                  <React.Fragment key={`grp_${grp.className}`}>
                    {grp.items.map((r) => (
                      <tr key={r.key} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono whitespace-nowrap">{r.globalIdx}</td>
                        <td className="py-2 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">{r.key}</td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{r.rollRange}</td>
                        {showMaleCol && <td className="py-2 px-3 text-center text-sky-600 font-bold whitespace-nowrap">{r.male}</td>}
                        {showFemaleCol && <td className="py-2 px-3 text-center text-rose-600 font-bold whitespace-nowrap">{r.female}</td>}
                        <td className="py-2 px-3 text-center font-medium whitespace-nowrap">{r.regCount}</td>
                        <td className="py-2 px-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{r.total}</td>
                      </tr>
                    ))}

                    {/* Combined Class Subtotal Row */}
                    {grp.items.length > 1 && (
                      <tr className="bg-indigo-50/80 dark:bg-indigo-950/40 font-bold text-indigo-950 dark:text-indigo-200 border-t border-b border-indigo-200 dark:border-indigo-800">
                        <td className="py-1 px-1.5 text-center text-indigo-600 font-mono text-[10px]">∑</td>
                        <td className="py-1 px-1.5 uppercase text-[10px] text-indigo-900 dark:text-indigo-300">
                          Combined {grp.className} ({grp.items.length} Streams)
                        </td>
                        <td className="py-1 px-1.5 text-indigo-600 dark:text-indigo-400 text-[10px]">All Streams Combined</td>
                        {showMaleCol && <td className="py-1 px-1.5 text-center text-sky-700 dark:text-sky-400 font-bold">{grp.male}</td>}
                        {showFemaleCol && <td className="py-1 px-1.5 text-center text-rose-700 dark:text-rose-400 font-bold">{grp.female}</td>}
                        <td className="py-1 px-1.5 text-center font-bold">{grp.regCount}</td>
                        <td className="py-1 px-1.5 text-right font-black text-indigo-900 dark:text-indigo-200">{grp.total}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

              {analysisMode === 'enrollment' &&
                stats.sortedClasses.map((c, idx) => (
                  <tr key={c.className} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 font-bold text-slate-900 dark:text-white">{formatClassDisplay(c.className)}</td>
                    {showApprovedCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-emerald-600 font-bold">{c.approved}</td>}
                    {showSubmittedCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-amber-600 font-bold">{c.submitted}</td>}
                    {showDraftCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-slate-500 font-bold">{c.draft}</td>}
                    {showMaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-sky-600 font-bold">{c.male}</td>}
                    {showFemaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-rose-600 font-bold">{c.female}</td>}
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-right font-bold text-slate-900 dark:text-white">{c.total}</td>
                  </tr>
                ))}

              {stats.totalStudents === 0 && (
                <tr>
                  <td colSpan={
                    analysisMode === 'jkbose_subject_rolls' ? 5 :
                    analysisMode === 'enrollment' ? enrollmentColsCount :
                    analysisMode === 'roll_stmt' ? rollStmtColsCount :
                    analysisMode === 'stream_gender' ? streamGenderColsCount : subjectColsCount
                  } className="p-6 text-center text-slate-500 font-bold text-xs">
                    No student records match the active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>

            {stats.totalStudents > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 shadow-xs z-10">
                {analysisMode === 'jkbose_subject_rolls' && (
                  <tr>
                    <td colSpan="4" className="py-2.5 px-3.5 sm:py-3 sm:px-4 text-right uppercase font-black text-slate-700 dark:text-slate-300">
                      TOTAL UNIQUE EXAMINEES IN RETURN:
                    </td>
                    <td className="py-2.5 px-3 sm:py-3 sm:px-3 text-center font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {jkboseKpis.active}
                    </td>
                  </tr>
                )}

                {analysisMode === 'enrollment' && (
                  <tr>
                    <td colSpan="2" className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 uppercase">Totals</td>
                    {showApprovedCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-emerald-600 font-bold">{stats.approvedCount}</td>}
                    {showSubmittedCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-amber-600 font-bold">{stats.submittedCount}</td>}
                    {showDraftCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-slate-500 font-bold">{stats.draftCount}</td>}
                    {showMaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-sky-600 font-bold">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-rose-600 font-bold">{stats.femaleCount}</td>}
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-right font-black text-slate-900 dark:text-white">{stats.totalStudents}</td>
                  </tr>
                )}

                {analysisMode === 'subject' && (
                  <tr>
                    <td colSpan="3" className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 uppercase">Totals</td>
                    {showMaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-sky-600 font-bold">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-rose-600 font-bold">{stats.femaleCount}</td>}
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center font-black">{stats.totalStudents}</td>
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-right font-black">100%</td>
                  </tr>
                )}

                {analysisMode === 'stream_gender' && (
                  <tr>
                    <td colSpan="2" className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 uppercase">Totals</td>
                    {showMaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-sky-600 font-bold">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-rose-600 font-bold">{stats.femaleCount}</td>}
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center font-black">{stats.totalStudents}</td>
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-right font-black">100%</td>
                  </tr>
                )}

                {analysisMode === 'roll_stmt' && (
                  <tr>
                    <td colSpan="3" className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 uppercase">Totals</td>
                    {showMaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-sky-600 font-bold">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center text-rose-600 font-bold">{stats.femaleCount}</td>}
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-center font-black">{stats.regCount}</td>
                    <td className="py-1 px-1.5 sm:py-1.5 sm:px-2.5 text-right font-black text-slate-900 dark:text-white">{stats.totalStudents}</td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>

          {/* Paper Footer with Signatory Block Preview for JKBOSE Return */}
          {analysisMode === 'jkbose_subject_rolls' && (
            <div className="p-4 sm:p-5 bg-slate-50/40 dark:bg-slate-950/20 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <div className="font-bold">Verified from Institutional Enrollment Register.</div>
                <div>Date of Return: <strong>{new Date().toLocaleDateString('en-GB')}</strong></div>
              </div>
              <div className="text-left sm:text-right space-y-1 text-xs">
                <div className="font-black text-slate-900 dark:text-white">Principal / Head of Institution</div>
                <div className="font-semibold text-slate-600 dark:text-slate-400">{jkboseInstitutionName}</div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* DROPPED EXAMINEES MANAGEMENT DRAWER (SLIDE-OVER MODAL)                     */}
        {/* ========================================================================= */}
        {isDroppedDrawerOpen && createPortal(
          <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <UserX size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Examinee Dropped Manager
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Label students who dropped out so they are excluded from JKBOSE returns.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDroppedDrawerOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Filter & Search Bar with Class Selector */}
              <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                {/* Dedicated Class Selector Bar for Dropper Manager Window */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                  {[
                    { id: '10th', label: 'Class 10th (SSE)' },
                    { id: '11th', label: 'Class 11th (HSE-I)' },
                    { id: '12th', label: 'Class 12th (HSE-II)' },
                    { id: 'all', label: 'All Classes' },
                  ].map((c) => {
                    const isSel = drawerClass === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDrawerClass(c.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          isSel
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder="Search examinee by name, roll no, reg no, or father name..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    {drawerSearch && (
                      <button
                        type="button"
                        onClick={() => setDrawerSearch('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={selectedSessions[0] || '2025-26'}
                      onChange={(e) => {
                        const newSes = e.target.value;
                        setSelectedSessions([newSes]);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                      title="Switch Session for Examinee Dropped Manager"
                    >
                      {availableSessions.map((ses) => (
                        <option key={ses} value={ses}>Session {ses}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                      {[
                        { id: 'all', label: `All (${drawerCounts.all})` },
                        { id: 'active', label: `Active (${drawerCounts.active})` },
                        { id: 'dropped', label: `Dropped (${drawerCounts.dropped})` },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setDrawerFilter(f.id)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            drawerFilter === f.id
                              ? 'bg-amber-600 text-white shadow-2xs font-black'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bulk Action Controls */}
                {selectedStudentIds.size > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-800 dark:text-amber-200">
                      {selectedStudentIds.size} student(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingStudentId === 'bulk'}
                        onClick={() => setIsBulkDropPending(true)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        Mark Dropped
                      </button>
                      <button
                        type="button"
                        disabled={savingStudentId === 'bulk'}
                        onClick={() => handleBulkExamStatus(false)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
                      >
                        {savingStudentId === 'bulk' && <RefreshCw size={11} className="animate-spin" />}
                        <span>Restore to Exam</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingStudentId === 'bulk'}
                        onClick={() => setSelectedStudentIds(new Set())}
                        className="text-slate-500 hover:underline cursor-pointer disabled:opacity-40"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Students List in Drawer */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar">
                {drawerStudents.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 italic text-xs">
                    No matching examinees found in {drawerClass !== 'all' ? `Class ${drawerClass}` : 'selected filter'}.
                  </div>
                ) : (
                  drawerStudents.map((st) => {
                    const sId = st.id || st._id || st.docId;
                    const isDropped = checkIsStudentDropped(st, droppedOverrides) || isStudentExamDropped(st);
                    const isSaving = savingStudentId === sId;
                    const rollNo = getAssignedClassRollNumber(st) || st.rollNo || st.classRollNo;
                    const currExamRoll = st.currExamRollNo || st.examRollNo || st['Exam Roll No'] || st['Examination Roll No'] || '';
                    const regNo = st['Board Registration Number'] || st['Board Reg. No.'] || st.boardRegNo || st.regNo || '';
                    const formNo = st.formNo || st['Form No.'] || st['Form No'] || '';
                    const stClass = getStudentClass(st) || st.class || 'N/A';
                    const stStream = getStudentStream(st) || st.stream || 'General';
                    const isSelected = selectedStudentIds.has(sId);

                    return (
                      <div
                        key={sId}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isDropped
                            ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/80 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = new Set(selectedStudentIds);
                              if (e.target.checked) next.add(sId);
                              else next.delete(sId);
                              setSelectedStudentIds(next);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {getStudentDisplayName(st)}
                              </span>
                              {isDropped ? (
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                                  <AlertTriangle size={10} />
                                  <span>🚫 DROPPED FROM EXAM</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                                  <Check size={10} />
                                  <span>✅ ACTIVE IN EXAM</span>
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Class Roll: {rollNo || 'Pending'}
                              </span>
                              {currExamRoll && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                                  Exam Roll: {currExamRoll}
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-500 truncate flex flex-wrap items-center gap-2 mt-1">
                              <span>Parentage: <strong className="font-semibold text-slate-700 dark:text-slate-300">{getStudentFatherName(st)}</strong></span>
                              <span>•</span>
                              <span>Class: <strong className="font-semibold text-slate-700 dark:text-slate-300">{stClass}</strong> ({stStream})</span>
                              {regNo && (
                                <>
                                  <span>•</span>
                                  <span>Reg: <span className="font-mono">{regNo}</span></span>
                                </>
                              )}
                              {formNo && (
                                <>
                                  <span>•</span>
                                  <span>Form #{formNo}</span>
                                </>
                              )}
                            </div>
                            {isDropped && (
                              <div className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} className="shrink-0" />
                                <span>Reason: {st.examDroppedReason || 'Administrative exclusion from JKBOSE returns'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Toggle */}
                        <div className="shrink-0">
                          {isDropped ? (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleToggleExamDropped(st, false)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              title="Restore this examinee back to the active JKBOSE examination statement"
                            >
                              <UserCheck size={13} />
                              <span>Restore to Exam</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => setPendingDropStudent(st)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              title="Mark this examinee as dropped from JKBOSE return statement"
                            >
                              <UserX size={13} />
                              <span>Mark Dropped</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">
                  Showing <strong className="text-slate-900 dark:text-white font-bold">{drawerStudents.length}</strong> examinee(s)
                </span>
                <button
                  type="button"
                  onClick={() => setIsDroppedDrawerOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ========================================================================= */}
        {/* DROPPED REASON PROMPT MODAL                                               */}
        {/* ========================================================================= */}
        {(pendingDropStudent || isBulkDropPending) && createPortal(
          <div className="fixed inset-0 z-[100010] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scaleUp">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isBulkDropPending ? `Drop ${selectedStudentIds.size} Examinees` : 'Drop Examinee from Return'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isBulkDropPending
                      ? 'All selected students will be marked as dropped and excluded from the JKBOSE statement.'
                      : `Excluding ${getStudentDisplayName(pendingDropStudent)} from official examination statement.`}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Reason for Dropping:
                  </label>
                  <select
                    value={dropReason}
                    onChange={(e) => setDropReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                  >
                    {COMMON_DROPPED_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Custom Notes / Administrative Remarks (Optional):
                  </label>
                  <textarea
                    value={customDropReason}
                    onChange={(e) => setCustomDropReason(e.target.value)}
                    placeholder="Additional order number, circular, or reason details..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setPendingDropStudent(null);
                    setIsBulkDropPending(false);
                    setCustomDropReason('');
                  }}
                  disabled={savingStudentId === 'bulk'}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingStudentId === 'bulk'}
                  onClick={async () => {
                    const reason = customDropReason.trim()
                      ? `${dropReason} (${customDropReason.trim()})`
                      : dropReason;
                    if (isBulkDropPending) {
                      await handleBulkExamStatus(true, reason);
                    } else if (pendingDropStudent) {
                      await handleToggleExamDropped(pendingDropStudent, true, reason);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {savingStudentId === 'bulk' && <RefreshCw size={12} className="animate-spin" />}
                  <span>{savingStudentId === 'bulk' ? 'Excluding...' : 'Confirm Drop from Exam'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
  );

  if (isPage) {
    return (
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 p-1 sm:p-2.5 space-y-2 animate-fadeIn">
        {modalContent}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-1 sm:p-4 animate-fadeIn">
      {modalContent}
    </div>,
    document.body
  );
}
