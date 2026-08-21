import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BookOpen, FileSpreadsheet, CreditCard, Calendar, Printer,
  RefreshCw, Check, Search, ZoomIn, ZoomOut,
  Plus, Trash2, FileCheck, Sliders, Loader2, Columns, LayoutGrid,
  UserCheck, UserX, AlertCircle, X, Edit3, UserPlus, ChevronRight,
  Filter, Eye, ChevronDown, Sparkles, SlidersHorizontal, Save, RotateCcw, Move, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../services/firebase';
import { doc, writeBatch, collection, getDocs, getDoc, query, where, setDoc } from 'firebase/firestore';
import {
  updateCachedItem,
  getCachedCollectionSync,
  getCachedCollection,
  preloadStudentPhotosCache,
  fetchStudentPhotoOnDemand
} from '../../services/dbCache';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { getStudentPhotoUrl } from '../../utils/imageCompressor';

const SCHOOL_NAME = 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS';
const SCHOOL_SUBTITLE = 'Nurturing Minds, Shaping Futures • District Anantnag';

export const DEFAULT_ROW_HEIGHT = 44; // Standard row height in px

export const DEFAULT_COLUMN_WIDTHS = {
  // PART 1
  sno: 26,
  photo: 40,
  rollNo: 34,
  formNo: 48,
  onlineStatus: 48,
  admDate: 48,
  admNo: 56,
  class: 32,
  boardReg: 96,
  name: 112,
  father: 90,
  mother: 90,
  dobFigures: 56,
  dobWords: 96,
  gender: 36,
  village: 64,
  block: 54,
  tehsil: 54,
  district: 54,
  mobile: 66,
  parentMobile: 66,

  // PART 2
  p2_stream: 48,
  p2_subs: 96,
  p2_aadhar: 80,
  p2_cat: 32,
  p2_socio: 32,
  p2_blood: 32,
  p2_account: 80,
  p2_ifsc: 64,
  p2_prevSchool: 86,
  p2_prevRoll: 48,
  p2_prevResult: 48,
  p2_pen: 64,
  p2_prevCC: 72,
  p2_withdrawal: 56,
  p2_issuedCC: 64,
  p2_receipt: 128,
  p2_remarks: 80,

  // SENTUP
  st_sno: 40,
  st_rollNo: 40,
  st_photo: 40,
  st_boardReg: 96,
  st_name: 128,
  st_parentage: 128,
  st_dob: 64,
  st_subs: 64,
  st_boardRoll: 64,
  st_result: 48,
  st_admitReceipt: 56,
  st_marksReceipt: 144
};

// Draggable Table Column Header Component
function ResizableTh({
  colKey,
  width,
  onResize,
  rowSpan,
  colSpan,
  className = '',
  children,
  minWidth = 20,
  ...rest
}) {
  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width || 60;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(minWidth, Math.round(startW + delta));
      if (onResize && colKey) {
        onResize(colKey, newWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const styleObj = width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : undefined;

  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      style={styleObj}
      className={`relative group/th select-none ${className}`}
      {...rest}
    >
      {children}
      {colKey && onResize && (
        <div
          onMouseDown={onMouseDown}
          onClick={(e) => e.stopPropagation()}
          className="no-print absolute top-0 right-0 w-2.5 h-full cursor-col-resize opacity-0 group-hover/th:opacity-100 hover:opacity-100 hover:bg-amber-500 bg-indigo-400/40 transition-all z-30 flex items-center justify-center"
          title="Click & Drag to resize column width"
        >
          <div className="w-[1.5px] h-3 bg-white rounded-full opacity-80" />
        </div>
      )}
    </th>
  );
}

// Convert date (DD-MM-YYYY or YYYY-MM-DD) to formal English words
export function formatDateToWords(dateStr) {
  if (!dateStr) return '—';
  try {
    let clean = String(dateStr).trim();
    let day = 0, month = 0, year = 0;
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    } else if (clean.includes('/')) {
      const parts = clean.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) return clean;

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = months[month - 1] || '';

    const ones = [
      "", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
      "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
      "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth", "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth", "Twenty-Ninth", "Thirtieth", "Thirty-First"
    ];

    const yOnes = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const yTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function yearToWords(y) {
      if (y >= 2000 && y <= 2099) {
        const rem = y % 2000;
        if (rem === 0) return "Two Thousand";
        if (rem < 20) return "Two Thousand " + yOnes[rem];
        return "Two Thousand " + yTens[Math.floor(rem / 10)] + (rem % 10 > 0 ? " " + yOnes[rem % 10] : "");
      }
      if (y >= 1900 && y <= 1999) {
        const rem = y % 1900;
        let w = "Nineteen Hundred";
        if (rem > 0) {
          if (rem < 20) w += " " + yOnes[rem];
          else w += " " + yTens[Math.floor(rem / 10)] + (rem % 10 > 0 ? " " + yOnes[rem % 10] : "");
        }
        return w;
      }
      return String(y);
    }

    const dayWord = ones[day] || String(day);
    const yWord = yearToWords(year);
    return `${dayWord} of ${monthName} ${yWord}`;
  } catch (e) {
    return String(dateStr);
  }
}

// Clean helper values
function cleanStr(val) {
  if (!val || val === '—' || val === 'N/A' || val === 'undefined' || val === 'null' || val === '-') return '';
  return String(val).trim();
}

// Check if student has been assigned a Class Roll Number
export function hasAssignedClassRollNo(s) {
  const roll = cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no || s['Roll No'] || s['Roll No.']);
  return roll !== '' && roll !== '—' && roll !== '-' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined' && roll !== '0';
}

// Business status evaluation: Approved strictly means those assigned a Class Roll Number
function resolveEffectiveStatus(s) {
  if (hasAssignedClassRollNo(s)) return 'Approved';

  const rawStat = cleanStr(s.status || s.Status || s.admissionStatus || s['Status'] || s['Admission Status'] || '').toLowerCase();
  if (rawStat.includes('reject') || rawStat.includes('rejt')) return 'Rejected';
  if (rawStat.includes('draft')) return 'Draft';
  if (rawStat.includes('provis')) return 'Provisional';
  return 'Submitted';
}

function matchesClassVal(selectedClasses, classVal) {
  if (!selectedClasses || selectedClasses === 'ALL') return true;
  const strVal = String(classVal ?? '').trim().toLowerCase();
  const cleanVal = strVal.replace(/class/gi, '').trim();
  const targetClean = String(selectedClasses).toLowerCase().replace(/class/gi, '').trim();
  if (cleanVal === targetClean) return true;
  const d1 = targetClean.match(/\d+/)?.[0];
  const d2 = cleanVal.match(/\d+/)?.[0];
  return !!(d1 && d2 && d1 === d2);
}

function formatBoardRegSplit(val) {
  const s = cleanStr(val);
  if (!s) return '—';
  if (s.length > 12) {
    return (
      <div className="leading-tight text-center font-mono">
        <span className="font-extrabold">{s.substring(0, 12)}</span>
        <br />
        <span className="font-bold text-slate-600 dark:text-slate-400">{s.substring(12)}</span>
      </div>
    );
  }
  return <span className="font-bold font-mono">{s}</span>;
}

export default function AdmissionRegisterSuite({
  students: propStudents,
  allHistory: propAllHistory,
  onClose: propOnClose,
  onDataUpdated,
  user: propUser,
  initialTab = 'adm_register'
}) {
  const navigate = useNavigate();
  const outletCtx = useOutletContext?.() || {};
  const user = propUser || outletCtx?.user;
  const onClose = propOnClose || (() => navigate('/portal/admin'));

  // Main Suite Tab: 'adm_register' | 'sentup' | 'assign_ids' | 'assign_dates'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sub-view Tab for Admission Register: 'all' | 'cover' | 'spreads' | 'summary' | 'notes'
  const [registerViewSection, setRegisterViewSection] = useState('all');

  // Spread Layout Mode on Screen: 'side_by_side' (Book View) | 'stacked'
  const [spreadLayoutMode, setSpreadLayoutMode] = useState('side_by_side');

  // Print & Layout Configuration (DEFAULT: 0.3 INCH DYNAMIC MARGINS ON LEGAL LANDSCAPE)
  const [printMargin, setPrintMargin] = useState(0.3); // 0.3 inch default
  const [showMarginControls, setShowMarginControls] = useState(false);

  // Global Filter States
  const [selectedSession, setSelectedSession] = useState('2025-26');
  const [selectedStatus, setSelectedStatus] = useState('Approved'); // 'Approved' (Default) | 'Submitted' | 'Provisional' | 'ALL'
  const [selectedAdmissionType, setSelectedAdmissionType] = useState('ALL'); // 'ALL' | 'fresh' | 'readmission'
  const [selectedClass, setSelectedClass] = useState('11th'); // DEFAULT: Class 11th
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [toast, setToast] = useState(null);

  // Popover Dropdown States for Consolidated Toolbar
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const [showViewPopover, setShowViewPopover] = useState(false);
  const filtersPopoverRef = useRef(null);
  const viewPopoverRef = useRef(null);

  // ─── DYNAMIC COLUMN WIDTHS & ROW HEIGHT STATE (FIREBASE-PRESERVED) ───
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [isLayoutModified, setIsLayoutModified] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  // Load layout from Firebase on mount
  useEffect(() => {
    const loadFirebaseLayout = async () => {
      try {
        const snap = await getDoc(doc(db, 'system_settings', 'admission_register_layout'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.columnWidths && typeof data.columnWidths === 'object') {
            setColumnWidths(prev => ({ ...prev, ...data.columnWidths }));
          }
          if (data.rowHeight && typeof data.rowHeight === 'number') {
            setRowHeight(data.rowHeight);
          }
          if (data.printMargin && typeof data.printMargin === 'number') {
            setPrintMargin(data.printMargin);
          }
        }
      } catch (err) {
        console.warn('Could not load saved register layout from Firebase:', err);
      }
    };
    loadFirebaseLayout();
  }, []);

  const handleColumnResize = (colKey, newWidth) => {
    setColumnWidths(prev => ({
      ...prev,
      [colKey]: newWidth
    }));
    setIsLayoutModified(true);
  };

  const handleRowHeightChange = (newHeight) => {
    setRowHeight(newHeight);
    setIsLayoutModified(true);
  };

  const handleSaveLayoutToFirebase = async () => {
    try {
      setSavingLayout(true);
      const layoutPayload = {
        columnWidths,
        rowHeight,
        printMargin,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'system_settings', 'admission_register_layout'), layoutPayload, { merge: true });
      setIsLayoutModified(false);
      setToast({
        title: 'Layout Preserved to Firebase!',
        desc: 'Custom column widths and row height saved as institution default.',
        type: 'success'
      });
      logAdminActivity('UPDATE_REGISTER_LAYOUT', `Saved custom admission register column widths & row height (${rowHeight}px) to Firebase default.`);
    } catch (err) {
      console.error('Failed to save layout to Firebase:', err);
      setToast({
        title: 'Save Failed',
        desc: err.message || 'Could not save layout to Firebase.',
        type: 'error'
      });
    } finally {
      setSavingLayout(false);
    }
  };

  const handleResetLayoutToOriginal = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    setRowHeight(DEFAULT_ROW_HEIGHT);
    setIsLayoutModified(false);
    setToast({
      title: 'Reset to Factory Defaults',
      desc: 'Table column widths and row heights restored to original factory format.',
      type: 'info'
    });
  };

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSession !== '2025-26') count++;
    if (selectedStatus !== 'Approved') count++;
    if (selectedAdmissionType !== 'ALL') count++;
    if (selectedStream !== 'ALL') count++;
    return count;
  }, [selectedSession, selectedStatus, selectedAdmissionType, selectedStream]);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (filtersPopoverRef.current && !filtersPopoverRef.current.contains(e.target)) {
        setShowFiltersPopover(false);
      }
      if (viewPopoverRef.current && !viewPopoverRef.current.contains(e.target)) {
        setShowViewPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Readmission Management Modal State (Universal Candidate Search & Class Mapper)
  const [readmissionModalStudent, setReadmissionModalStudent] = useState(null);
  const [isUniversalModalOpen, setIsUniversalModalOpen] = useState(false);
  const [searchCandidateQuery, setSearchCandidateQuery] = useState('');
  const [reAdmFormState, setReAdmFormState] = useState({
    isReAdm: true,
    targetSession: '2025-26',
    targetClass: '11th',
    targetStream: 'General',
    assignedAdmNo: '',
    oldAdmNo: '',
    prevSchoolOrClass: '',
    reason: 'Gap in Studies / Re-enrolled'
  });
  const [savingReAdm, setSavingReAdm] = useState(false);

  // Loading States for Session Data
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // In-memory Session Storage Cache for instantaneous tab switching
  const sessionCacheRef = useRef({});

  // Clean Print Mode Body Attachment
  useEffect(() => {
    document.body.classList.add('admission-register-print-mode');
    document.body.classList.add('clean-print-mode');
    return () => {
      document.body.classList.remove('admission-register-print-mode');
      document.body.classList.remove('clean-print-mode');
    };
  }, []);

  // Centralized Loaded Datasets (admissions + master registers)
  const [dataset, setDataset] = useState(() => {
    if (Array.isArray(propStudents) && propStudents.length > 0) return propStudents;
    const cached = getCachedCollectionSync('admissions');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  const [historyDataset, setHistoryDataset] = useState(() => {
    if (Array.isArray(propAllHistory) && propAllHistory.length > 0) return propAllHistory;
    const cached = getCachedCollectionSync('masterRegisters');
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
  });

  // Calculate Next Available Sequential Admission Number
  const nextSequentialAdmNo = useMemo(() => {
    let max = 5000;
    (dataset || []).forEach(s => {
      const rawNo = cleanStr(s.admNo || s['Adm. No.'] || s['Admission No.']);
      const num = parseInt(rawNo, 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return String(max + 1);
  }, [dataset]);

  // Index All Historical & Current Students Across Database for Universal Candidate Search
  const allAvailableDatabaseStudents = useMemo(() => {
    const map = new Map();
    // 1. Current dataset (admissions)
    (dataset || []).forEach((s, idx) => {
      const id = cleanStr(s.id || s.docId || s.formNo || `adm_${idx}`);
      if (!map.has(id)) {
        map.set(id, {
          raw: s,
          id,
          name: cleanStr(s.studentName || s["Student's Name (as per school records)"] || s['Student Name'] || s.name),
          father: cleanStr(s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s.father),
          class: cleanStr(s.class || s.Class || s['Admission sought for class'] || '11th'),
          session: cleanStr(s.session || s.Session || s['Academic Session'] || selectedSession),
          stream: cleanStr(s.stream || s.Stream || 'General'),
          rollNo: cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no),
          admNo: cleanStr(s.admNo || s['Adm. No.'] || s['Admission No.'] || s.admissionNumber),
          oldAdmNo: cleanStr(s['Old Admission No.'] || s['Old Adm. No.'] || s.oldAdmNo || s['old_adm_no']),
          boardReg: cleanStr(s.boardRegNo || s['Board Registration Number'] || s.boardReg || s['Board Reg. No.']),
          dob: cleanStr(s.dob || s['DoB (as per school records)'] || s['Date of Birth']),
          mobile: cleanStr(s.mobile || s['Mobile No. (with working WhatsApp)'] || s['Student Mobile']),
          isReadmission: String(s.readmission || s['Re-admission'] || s.isReadmission || '').toLowerCase() === 'yes' || s.readmission === true || s.isReadmission === true
        });
      }
    });
    // 2. Master registers history
    (historyDataset || []).forEach(h => {
      const pSess = cleanStr(h.session || h.Session || h['Academic Session'] || '');
      const chunk = h.items || h.students || h.records || h.data;
      if (Array.isArray(chunk)) {
        chunk.forEach((item, i) => {
          const id = cleanStr(item.id || item['Form Number'] || `${h.id}_${i}`);
          if (!map.has(id)) {
            map.set(id, {
              raw: item,
              id,
              name: cleanStr(item.studentName || item["Student's Name (as per school records)"] || item['Student Name'] || item.name),
              father: cleanStr(item.fatherName || item["Father's/Guardian's Name (as per school records)"] || item["Father's Name"] || item.father),
              class: cleanStr(item.class || item.Class || '10th'),
              session: cleanStr(item.session || item.Session || pSess || 'Past Session'),
              stream: cleanStr(item.stream || item.Stream || 'General'),
              rollNo: cleanStr(item.classRollNo || item['Class Roll No'] || item.rollNo || item.RollNo),
              admNo: cleanStr(item.admNo || item['Adm. No.'] || item['Admission No.']),
              oldAdmNo: cleanStr(item['Old Admission No.'] || item.oldAdmNo),
              boardReg: cleanStr(item.boardRegNo || item['Board Registration Number'] || item.boardReg),
              dob: cleanStr(item.dob || item['Date of Birth']),
              mobile: cleanStr(item.mobile || item['Mobile No.']),
              isReadmission: String(item.readmission || item['Re-admission'] || item.isReadmission || '').toLowerCase() === 'yes' || item.readmission === true
            });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [dataset, historyDataset, selectedSession]);

  // Candidates Search Results
  const candidateSearchResults = useMemo(() => {
    if (!searchCandidateQuery.trim()) return allAvailableDatabaseStudents.slice(0, 15);
    const q = searchCandidateQuery.toLowerCase().trim();
    return allAvailableDatabaseStudents.filter(s => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.father.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q) ||
        s.admNo.toLowerCase().includes(q) ||
        s.oldAdmNo.toLowerCase().includes(q) ||
        s.boardReg.toLowerCase().includes(q) ||
        s.class.toLowerCase().includes(q)
      );
    }).slice(0, 20);
  }, [allAvailableDatabaseStudents, searchCandidateQuery]);

  // 1. DYNAMICALLY FETCH ALL SESSIONS AVAILABLE IN DATABASE
  const [availableSessions, setAvailableSessions] = useState(['2025-26', '2024-25', '2023-24', '2022-23']);

  useEffect(() => {
    const sessionsFound = new Set(['2025-26', '2024-25', '2023-24', '2022-23']);
    (dataset || []).forEach(s => {
      const sess = cleanStr(s.session || s.Session || s['Academic Session']);
      if (sess) sessionsFound.add(sess);
    });
    (historyDataset || []).forEach(h => {
      const sess = cleanStr(h.session || h.Session || h['Academic Session']);
      if (sess) sessionsFound.add(sess);
      if (Array.isArray(h.items || h.students)) {
        (h.items || h.students).forEach(item => {
          const sItem = cleanStr(item.session || item.Session || item['Academic Session']);
          if (sItem) sessionsFound.add(sItem);
        });
      }
    });
    getDocs(collection(db, 'academicSessions')).then(snap => {
      snap.docs.forEach(d => {
        const sessName = cleanStr(d.data()?.name || d.data()?.session || d.id);
        if (sessName) sessionsFound.add(sessName);
      });
      setAvailableSessions(Array.from(sessionsFound).sort().reverse());
    }).catch(() => {
      setAvailableSessions(Array.from(sessionsFound).sort().reverse());
    });
  }, [dataset, historyDataset]);

  // 2. ON-DEMAND SESSION DATA FETCHER (Loads particular session dynamically from DB)
  useEffect(() => {
    if (!selectedSession) return;

    if (sessionCacheRef.current[selectedSession]) {
      setDataset(sessionCacheRef.current[selectedSession]);
      return;
    }

    if (selectedSession === '2025-26' && Array.isArray(propStudents) && propStudents.length > 0) {
      sessionCacheRef.current['2025-26'] = propStudents;
      setDataset(propStudents);
      return;
    }

    let isCancelled = false;
    setIsLoadingSession(true);

    const loadSessionData = async () => {
      try {
        let loadedRecords = [];

        const qSnap = await getDocs(query(collection(db, 'admissions'), where('session', '==', selectedSession)));
        if (!qSnap.empty) {
          loadedRecords = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (loadedRecords.length === 0) {
          const masterList = await getCachedCollection('masterRegisters');
          const flat = [];
          (masterList || []).forEach(docItem => {
            if (!docItem) return;
            const chunk = docItem.items || docItem.students || docItem.records || docItem.data;
            const pSess = cleanStr(docItem.session || docItem.Session || docItem['Academic Session'] || '');
            if (Array.isArray(chunk)) {
              chunk.forEach((item, i) => {
                const iSess = cleanStr(item.session || item.Session || item['Academic Session'] || pSess);
                if (iSess === selectedSession || selectedSession === 'ALL') {
                  flat.push({
                    ...item,
                    id: item.id || item['Form Number'] || `${docItem.id}_${i}`,
                    session: iSess,
                    Session: iSess
                  });
                }
              });
            } else if (pSess === selectedSession || selectedSession === 'ALL') {
              flat.push({ ...docItem, session: pSess, Session: pSess });
            }
          });
          loadedRecords = flat;
        }

        if (loadedRecords.length === 0 && selectedSession === '2025-26') {
          const admSnap = await getDocs(collection(db, 'admissions'));
          loadedRecords = admSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (!isCancelled) {
          sessionCacheRef.current[selectedSession] = loadedRecords;
          setDataset(loadedRecords);
        }
      } catch (err) {
        console.error(`Error loading session ${selectedSession}:`, err);
      } finally {
        if (!isCancelled) setIsLoadingSession(false);
      }
    };

    loadSessionData();

    return () => { isCancelled = true; };
  }, [selectedSession, propStudents]);

  // 3. REACTIVE ON-DEMAND PHOTO RESOLUTION MAP
  const [photosMap, setPhotosMap] = useState(() => {
    return typeof window !== 'undefined' && window._hss_central_photo_map
      ? { ...window._hss_central_photo_map }
      : {};
  });

  useEffect(() => {
    try {
      preloadStudentPhotosCache();
    } catch (_) {}
  }, []);

  // Normalized Student Object Mapper with Re-admission Parsing
  const normalizedStudents = useMemo(() => {
    const list = [];
    (dataset || []).forEach((s, idx) => {
      if (!s) return;
      const name = cleanStr(s.studentName || s["Student's Name (as per school records)"] || s['Student Name'] || s.name);
      const father = cleanStr(s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s["Father's Name"] || s.father);
      const rollNo = cleanStr(s.classRollNo || s['Class Roll No'] || s.rollNo || s.RollNo || s.roll_no);
      const admNo = cleanStr(s.admNo || s['Adm. No.'] || s['Admission No.'] || s.admissionNumber);
      const formNo = cleanStr(s.formNo || s['Form Number'] || s['Form No.'] || s.FormNo);
      const boardReg = cleanStr(s.boardRegNo || s['Board Registration Number'] || s.boardReg || s['Board Reg. No.']);

      // CRITICAL: Reject phantom/empty ghost database rows that have zero identifying student information
      if (!name && !father && !rollNo && !admNo && !formNo && !boardReg) return;

      const cls = cleanStr(s.class || s.Class || s['Admission sought for class'] || '11th');
      const sess = cleanStr(s.session || s.Session || s['Academic Session'] || selectedSession);
      const mother = cleanStr(s.motherName || s["Mother's Name (as per school records)"] || s["Mother's Name"] || s.mother);
      const dob = cleanStr(s.dob || s['DoB (as per school records)'] || s['Date of Birth']);
      const gender = cleanStr(s.gender || s.Gender || 'Male');
      const stream = cleanStr(s.stream || s.Stream || 'General');
      const subs = cleanStr(s.subs || s.subjects || s.Subjects || s['Subjects Chosen'] || '');
      const aadhar = cleanStr(s.aadhar || s['Aadhar No.'] || s.aadhaar || s['Aadhaar No.']);
      const village = cleanStr(s.village || s['Name of your village'] || s['Village/Town']);
      const block = cleanStr(s.block || s.Block || s['Block/Zone'] || 'Shangus');
      const tehsil = cleanStr(s.tehsil || s.Tehsil || 'Shangus');
      const district = cleanStr(s.district || s.District || 'Anantnag');
      const mobile = cleanStr(s.mobile || s['Mobile No. (with working WhatsApp)'] || s['Student Mobile']);
      const parentMobile = cleanStr(s.parentContact || s["Father's Mobile No."] || s['Parent Mobile']);
      const category = cleanStr(s.category || s['Cat._JKBOSE'] || s['Social Category'] || 'OM');
      const socioEcon = cleanStr(s.socioEconomic || s['Socio-Economic Category'] || 'AAY/BPL');
      const blood = cleanStr(s.blood || s['Blood Group'] || s.bloodGroup || '—');
      const account = cleanStr(s.bankAccount || s['Bank Account No.'] || s.accountNo);
      const ifsc = cleanStr(s.ifsc || s['IFSC code'] || s.ifscCode);
      const pen = cleanStr(s.penNo || s['PEN No.'] || s.pen || 'NA');
      const prevSchool = cleanStr(s.prevSchool || s['Previous School'] || s['Name of Previous School']);
      const prevRoll = cleanStr(s.prevExamRollNo || s['Previous Exam Roll No'] || s.examRoll10th);
      const prevMarks = cleanStr(s.marksObt || s['Marks Obtained'] || s.marksObt10th);
      const maxMarks = cleanStr(s.maxMarks || s['Max Marks'] || '500');
      const prevResult = prevMarks ? `${prevMarks} / ${maxMarks}` : '—';
      const admDate = cleanStr(s.admDate || s['Adm. Date'] || s.admissionDate || s.submittedAt?.slice(0, 10) || '');
      const onlineStatus = cleanStr(s.onlineSubmDate || s.submittedAt?.slice(0, 10) || 'Submitted');
      const status = resolveEffectiveStatus(s);

      // Re-admission Identification
      const isReadmission =
        String(s.readmission || s['readmission'] || s['Re-admission'] || s['Re-Admission'] || s.isReadmission || s['Are you seeking Re-admission?'] || s.reAdmissionStatus || '').toLowerCase() === 'yes' ||
        s.readmission === true ||
        s.isReadmission === true;

      const oldAdmNo = cleanStr(s['Old Admission No.'] || s['Old Adm. No.'] || s.oldAdmNo || s['old_adm_no'] || s['Previous Adm. No.'] || s['Prev Adm No']);

      // Formatted Adm No: e.g. 5480 (4312) for readmission
      const displayAdmNo = (isReadmission && oldAdmNo && oldAdmNo !== admNo)
        ? `${admNo || '—'} (${oldAdmNo})`
        : (admNo || '—');
      
      const docId = cleanStr(s.id || s.docId || (formNo ? `form_${formNo}` : `adm_${idx}`));
      const directPhoto = getStudentPhotoUrl(s, '');

      list.push({
        raw: s,
        id: docId,
        sno: list.length + 1,
        formNo,
        admNo,
        oldAdmNo,
        displayAdmNo,
        isReadmission,
        rollNo,
        boardReg,
        name: name || 'Student Record',
        father,
        mother,
        dobFigures: dob,
        dobWords: formatDateToWords(dob),
        gender,
        class: cls,
        session: sess,
        stream,
        subs,
        aadhar,
        village,
        block,
        tehsil,
        district,
        mobile,
        parentMobile,
        category,
        socioEcon,
        blood,
        account,
        ifsc,
        pen,
        prevSchool,
        prevRoll,
        prevResult,
        admDate,
        onlineStatus,
        status,
        directPhoto,
        prevCC: isReadmission ? 'Re-admitted (Gap)' : (prevSchool.toLowerCase().includes('shangus') ? 'Internal (HSS Shangus)' : 'Vide TC/CC'),
        withdrawal: '—',
        remarks: isReadmission ? `Re-admission (Gap)${oldAdmNo ? ` • Prev Adm: ${oldAdmNo}` : ''}` : cleanStr(s.remarks || s.Remarks || '')
      });
    });
    return list;
  }, [dataset, selectedSession]);

  // 4. DYNAMIC CLASSES TAILORED STRICTLY TO LOADED SESSION DATA
  const availableClasses = useMemo(() => {
    const set = new Set();
    normalizedStudents.forEach(s => {
      const cls = cleanStr(s.class);
      if (cls) {
        if (cls.includes('12')) set.add('12th');
        else if (cls.includes('11')) set.add('11th');
        else if (cls.includes('10')) set.add('10th');
        else if (cls.includes('9')) set.add('9th');
        else set.add(cls);
      }
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['11th', '12th', '10th', '9th'];
  }, [normalizedStudents]);

  // 5. DYNAMIC STREAMS TAILORED STRICTLY TO LOADED SESSION DATA
  const availableStreams = useMemo(() => {
    const set = new Set();
    normalizedStudents.forEach(s => {
      const str = cleanStr(s.stream);
      if (str && str !== '—') set.add(str);
    });
    return Array.from(set).sort();
  }, [normalizedStudents]);

  // Dynamic Status Counts (Approved, Submitted, Provisional, All)
  const statusCounts = useMemo(() => {
    let approved = 0, submitted = 0, provisional = 0, readmissions = 0, fresh = 0;
    normalizedStudents.forEach(s => {
      if (selectedClass !== 'ALL' && !matchesClassVal(selectedClass, s.class)) return;
      if (s.status === 'Approved') approved++;
      if (s.status === 'Submitted') submitted++;
      if (s.status === 'Provisional') provisional++;
      if (s.isReadmission) readmissions++;
      else fresh++;
    });
    return { approved, submitted, provisional, readmissions, fresh, total: normalizedStudents.length };
  }, [normalizedStudents, selectedClass]);

  // Filtered Students for Current View with Readmission Sorting Rule (Re-admissions placed at end of class register)
  const filteredStudents = useMemo(() => {
    const rawFiltered = normalizedStudents.filter(s => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Approved') {
          if (s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Submitted') {
          if (s.status !== 'Submitted' && s.status !== 'Approved') return false;
        } else if (selectedStatus === 'Provisional') {
          if (s.status !== 'Provisional') return false;
        } else if (s.status !== selectedStatus) {
          return false;
        }
      }

      // 2. Admission Type Filter (Fresh vs Re-admission)
      if (selectedAdmissionType === 'fresh' && s.isReadmission) return false;
      if (selectedAdmissionType === 'readmission' && !s.isReadmission) return false;

      // 3. Class Filter
      if (selectedClass !== 'ALL') {
        if (!matchesClassVal(selectedClass, s.class)) return false;
      }

      // 4. Stream Filter
      if (selectedStream !== 'ALL') {
        if (s.stream !== selectedStream) return false;
      }

      // 5. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.father.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.admNo.toLowerCase().includes(q) ||
          s.oldAdmNo.toLowerCase().includes(q) ||
          s.formNo.toLowerCase().includes(q) ||
          s.boardReg.toLowerCase().includes(q) ||
          s.mobile.includes(q)
        );
      }
      return true;
    });

    // STRICT REGISTER ORDERING:
    // 1. Group by Class (9th, 10th, 11th, 12th)
    // 2. Fresh Admissions FIRST (sorted by Class Roll No / Name)
    // 3. Re-admissions PLACED AT THE END OF EACH CLASS REGISTER!
    const sorted = rawFiltered.sort((a, b) => {
      const cA = parseInt(a.class, 10) || 0;
      const cB = parseInt(b.class, 10) || 0;
      if (cA !== cB) return cA - cB;

      // Fresh First (0), Re-admission at end (1)
      const isReA = a.isReadmission ? 1 : 0;
      const isReB = b.isReadmission ? 1 : 0;
      if (isReA !== isReB) return isReA - isReB;

      const rA = parseInt(a.rollNo, 10) || 0;
      const rB = parseInt(b.rollNo, 10) || 0;
      if (rA !== rB && rA > 0 && rB > 0) return rA - rB;

      return a.name.localeCompare(b.name);
    });

    // Re-index continuous S.No.
    return sorted.map((st, i) => ({ ...st, sno: i + 1 }));
  }, [normalizedStudents, selectedStatus, selectedAdmissionType, selectedClass, selectedStream, searchQuery]);

  // ASYNC PHOTO FETCHING FOR VISIBLE FILTERED STUDENTS
  useEffect(() => {
    if (!filteredStudents || filteredStudents.length === 0) return;
    let isMounted = true;

    const toFetch = filteredStudents.filter(st => {
      const existing = photosMap[st.id] || photosMap[st.formNo] || photosMap[st.boardReg] || st.directPhoto;
      return !existing || existing === '/logo.png';
    });

    if (toFetch.length === 0) return;

    const chunkArray = (arr, size) => {
      const res = [];
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
      return res;
    };

    const batches = chunkArray(toFetch, 15);

    (async () => {
      for (const batch of batches) {
        if (!isMounted) break;
        const results = await Promise.all(
          batch.map(async (st) => {
            try {
              const url = await fetchStudentPhotoOnDemand(st.raw || st);
              return { id: st.id, formNo: st.formNo, boardReg: st.boardReg, url };
            } catch (_) {
              return null;
            }
          })
        );

        if (isMounted) {
          setPhotosMap(prev => {
            const next = { ...prev };
            results.forEach(r => {
              if (r && r.url) {
                if (r.id) next[r.id] = r.url;
                if (r.formNo) next[r.formNo] = r.url;
                if (r.boardReg) next[r.boardReg] = r.url;
              }
            });
            return next;
          });
        }
      }
    })();

    return () => { isMounted = false; };
  }, [filteredStudents]);

  const getResolvedStudentPhoto = (s) => {
    return (
      photosMap[s.id] ||
      photosMap[s.formNo] ||
      photosMap[s.boardReg] ||
      s.directPhoto ||
      getStudentPhotoUrl(s.raw || s, '') ||
      ''
    );
  };

  // Open Universal Readmission Modal (Candidate Search Mode)
  const handleOpenUniversalReadmissionModal = () => {
    setReadmissionModalStudent(null);
    setIsUniversalModalOpen(true);
    setSearchCandidateQuery('');
    setReAdmFormState({
      isReAdm: true,
      targetSession: selectedSession || '2025-26',
      targetClass: selectedClass !== 'ALL' ? selectedClass : '11th',
      targetStream: selectedStream !== 'ALL' ? selectedStream : 'General',
      assignedAdmNo: nextSequentialAdmNo,
      oldAdmNo: '',
      prevSchoolOrClass: '',
      reason: 'Gap in Studies / Re-enrolled'
    });
  };

  // Select Candidate for Readmission from Search Results
  const handleSelectCandidateForReadmission = (candidate) => {
    setReadmissionModalStudent(candidate);
    setIsUniversalModalOpen(false);

    // Smartly determine target register class:
    // If student was in 10th (or 10th sentup/board), default target register class is 9th (or 10th);
    // If student was in 12th (or 12th sentup/board), default target register class is 11th (or 12th);
    const prevCls = candidate.class || '10th';
    let defaultTargetCls = '11th';
    if (prevCls.includes('10') || prevCls.includes('9')) {
      defaultTargetCls = '9th';
    } else if (prevCls.includes('12') || prevCls.includes('11')) {
      defaultTargetCls = '11th';
    }

    setReAdmFormState({
      isReAdm: true,
      targetSession: selectedSession || '2025-26',
      targetClass: defaultTargetCls,
      targetStream: candidate.stream || (selectedStream !== 'ALL' ? selectedStream : 'General'),
      assignedAdmNo: candidate.admNo || nextSequentialAdmNo,
      oldAdmNo: candidate.oldAdmNo || candidate.admNo || '',
      prevSchoolOrClass: `HSS Shangus (Class ${prevCls}, ${candidate.session || 'Past Session'})`,
      reason: 'Gap in Studies / Re-enrolled'
    });
  };

  // Open Readmission Modal from a specific row in the table
  const handleOpenReadmissionModal = (student) => {
    setReadmissionModalStudent(student);
    setIsUniversalModalOpen(false);
    setReAdmFormState({
      isReAdm: !student.isReadmission,
      targetSession: student.session || selectedSession || '2025-26',
      targetClass: student.class || '11th',
      targetStream: student.stream || 'General',
      assignedAdmNo: student.admNo || nextSequentialAdmNo,
      oldAdmNo: student.oldAdmNo || (student.isReadmission ? '' : student.admNo) || '',
      prevSchoolOrClass: `HSS Shangus (Class ${student.class || '11th'})`,
      reason: student.isReadmission ? 'Fresh Admission' : 'Gap in Studies / Re-enrolled'
    });
  };

  // Save Readmission Status to Firestore & Local Cache
  const handleSaveReadmission = async () => {
    if (!readmissionModalStudent) return;
    setSavingReAdm(true);
    try {
      const isRe = reAdmFormState.isReAdm;
      const targetSess = reAdmFormState.targetSession || selectedSession;
      const targetCls = reAdmFormState.targetClass || readmissionModalStudent.class || '11th';
      const targetStr = reAdmFormState.targetStream || readmissionModalStudent.stream || 'General';
      const assignedAdm = cleanStr(reAdmFormState.assignedAdmNo || readmissionModalStudent.admNo || nextSequentialAdmNo);
      const oldAdm = cleanStr(reAdmFormState.oldAdmNo);
      const reasonText = cleanStr(reAdmFormState.reason) || 'Gap in Studies / Re-enrolled';

      // Doc ID determination
      const docId = readmissionModalStudent.id && !readmissionModalStudent.id.startsWith('adm_') && !readmissionModalStudent.id.includes('_')
        ? readmissionModalStudent.id
        : (readmissionModalStudent.formNo ? `form_${readmissionModalStudent.formNo}` : `adm_${Date.now()}`);

      const docRef = doc(db, 'admissions', docId);
      const baseData = readmissionModalStudent.raw || {};

      const updates = {
        ...baseData,
        id: docId,
        studentName: readmissionModalStudent.name || baseData.studentName || '',
        fatherName: readmissionModalStudent.father || baseData.fatherName || '',
        session: targetSess,
        Session: targetSess,
        'Academic Session': targetSess,
        class: targetCls,
        Class: targetCls,
        'Admission sought for class': targetCls,
        stream: targetStr,
        Stream: targetStr,
        admNo: assignedAdm,
        'Adm. No.': assignedAdm,
        'Admission No.': assignedAdm,
        readmission: isRe ? 'Yes' : 'No',
        'Re-admission': isRe ? 'Yes' : 'No',
        isReadmission: isRe,
        oldAdmNo: isRe ? oldAdm : '',
        'Old Admission No.': isRe ? oldAdm : '',
        remarks: isRe ? `Re-admission (${reasonText})${oldAdm ? ` • Prev Adm: ${oldAdm}` : ''}` : cleanStr(baseData.remarks || ''),
        updatedAt: new Date().toISOString(),
        lastEditedBy: `Admin (${user?.email || 'Readmission Tool'})`
      };

      await setDoc(docRef, updates, { merge: true });
      updateCachedItem('admissions', docId, updates);

      // Update local dataset state
      setDataset(prev => {
        const exists = prev.some(item => item.id === docId || (readmissionModalStudent.formNo && item.formNo === readmissionModalStudent.formNo));
        if (exists) {
          return prev.map(item => (item.id === docId || (readmissionModalStudent.formNo && item.formNo === readmissionModalStudent.formNo)) ? { ...item, ...updates } : item);
        }
        if (targetSess === selectedSession) {
          return [updates, ...prev];
        }
        return prev;
      });

      await logAdminActivity({
        actionType: 'student_readmission_update',
        actionTitle: `Configured Re-admission: ${readmissionModalStudent.name} (${targetCls})`,
        details: `${readmissionModalStudent.name} mapped to Class ${targetCls} Session ${targetSess} as ${isRe ? `Re-admission (Adm No: ${assignedAdm || '—'}, Old Adm: ${oldAdm || 'N/A'})` : 'Fresh'}.`,
        metadata: { studentId: docId, targetClass: targetCls, targetSession: targetSess, isReadmission: isRe, oldAdmNo: oldAdm }
      });

      setToast({
        message: `✨ ${readmissionModalStudent.name} mapped to Class ${targetCls} (${targetSess}) as ${isRe ? 'Re-admission' : 'Fresh'}!`,
        type: 'success'
      });
      setReadmissionModalStudent(null);
      setIsUniversalModalOpen(false);
      setSearchCandidateQuery('');
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Error saving readmission:', err);
      setToast({ message: `❌ Failed to update readmission: ${err.message}`, type: 'error' });
    } finally {
      setSavingReAdm(false);
    }
  };

  // 10 Students Per Page Chunks for Legal Print Layout
  const STUDENTS_PER_PAGE = 10;
  const pageChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < filteredStudents.length; i += STUDENTS_PER_PAGE) {
      chunks.push(filteredStudents.slice(i, i + STUDENTS_PER_PAGE));
    }
    return chunks;
  }, [filteredStudents]);

  // Consolidated Summary Breakdown Stats
  const summaryStats = useMemo(() => {
    const map = {};
    filteredStudents.forEach(s => {
      const c = s.class || '11th';
      const str = s.stream || 'General';
      if (!map[c]) map[c] = {};
      if (!map[c][str]) map[c][str] = { male: 0, female: 0, total: 0, reAdm: 0 };
      const isFemale = s.gender.toLowerCase().startsWith('f');
      if (isFemale) map[c][str].female++;
      else map[c][str].male++;
      if (s.isReadmission) map[c][str].reAdm++;
      map[c][str].total++;
    });
    return map;
  }, [filteredStudents]);

  // Total Counts
  const overallSummaryTotals = useMemo(() => {
    let m = 0, f = 0, tot = 0, re = 0;
    filteredStudents.forEach(s => {
      const isFemale = s.gender.toLowerCase().startsWith('f');
      if (isFemale) f++;
      else m++;
      if (s.isReadmission) re++;
      tot++;
    });
    return { male: m, female: f, grandTotal: tot, totalReAdm: re };
  }, [filteredStudents]);

  // Editable Register Notes Page State
  const [registerNotes, setRegisterNotes] = useState([
    {
      id: 1,
      text: "Details of columns with Yellow background in their header have been copied/adapted from students' response (Online Admission Form); remaining details have been verified."
    },
    {
      id: 2,
      text: "The students with the comment 'internal student of HSS Shangus' under the 'Admtd. Vide DC/CC' column are those who studied their Class 10th at Govt Hr Sec School Shangus (010061). They appeared in the Class 10th annual regular examination 2025 (march session), conducted by JKBOSE, through this same school. Their admission to Class 11th was granted based on the mark sheets provided by the school. For further verification, please refer to the Class 9th/10th admission records."
    },
    {
      id: 3,
      text: "Abbreviations of Subjects used: BI (Biology), CH (Chemistry), EC (Economics), ED (Education), EN (General English), ES (Environmental Science), HT (History), HTC (Healthcare), ITE (IT & ITES), MA (Mathematics), PD (Physical Education), PH (Physics), PS (Political Science), and UR (Urdu)."
    },
    {
      id: 4,
      text: "Fresh admission numbers have been assigned to students re-joining after an academic gap or those readmitted due to non-appearance in prior exams. To facilitate historical tracking, the student's previous admission number is recorded in brackets immediately below the new number in the 'Adm. No.' column [e.g., 5265 (5071)]."
    }
  ]);

  const handleAddNote = () => {
    const newId = registerNotes.length > 0 ? Math.max(...registerNotes.map(n => n.id)) + 1 : 1;
    setRegisterNotes([...registerNotes, { id: newId, text: 'New verification note or institutional remark...' }]);
  };

  const handleRemoveNote = (id) => {
    setRegisterNotes(registerNotes.filter(n => n.id !== id));
  };

  const handleUpdateNote = (id, newText) => {
    setRegisterNotes(registerNotes.map(n => n.id === id ? { ...n, text: newText } : n));
  };

  // -------------------------------------------------------------
  // ASSIGN IDs ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignStartId, setAssignStartId] = useState('5476');
  const [assigningIds, setAssigningIds] = useState(false);
  const [assignClasses, setAssignClasses] = useState(['9th', '11th']);
  const [assignSessionFilter, setAssignSessionFilter] = useState('2025-26');
  const [onlyMissingAdmNo, setOnlyMissingAdmNo] = useState(true);
  const [assignStrategies, setAssignStrategies] = useState({});

  const calculatedNextAdmNo = useMemo(() => {
    let maxId = 5000;
    normalizedStudents.forEach(s => {
      const num = parseInt(s.admNo, 10);
      if (!isNaN(num) && num > maxId && num < 99999) {
        maxId = num;
      }
    });
    return String(maxId + 1);
  }, [normalizedStudents]);

  useEffect(() => {
    if (calculatedNextAdmNo && (!assignStartId || assignStartId === '5476')) {
      setAssignStartId(calculatedNextAdmNo);
    }
  }, [calculatedNextAdmNo]);

  const candidateAssignStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (assignSessionFilter !== 'ALL' && st.session !== assignSessionFilter) return false;
      if (assignClasses.length > 0) {
        const match = assignClasses.some(c => matchesClassVal(c, st.class));
        if (!match) return false;
      }
      if (onlyMissingAdmNo) {
        if (st.admNo && st.admNo !== '—' && st.admNo !== 'N/A') return false;
      }
      return true;
    });
  }, [normalizedStudents, assignSessionFilter, assignClasses, onlyMissingAdmNo]);

  const candidateIdPreviewList = useMemo(() => {
    let seqCounter = parseInt(assignStartId, 10) || 5476;
    return candidateAssignStudents.map(st => {
      const reg = st.boardReg;
      let prevInfo = null;
      if (reg && reg.length > 5) {
        const histMatch = (historyDataset || []).find(h => {
          const hReg = cleanStr(h.boardRegNo || h['Board Registration Number']);
          const hAdm = cleanStr(h.admNo || h['Adm. No.']);
          return hReg === reg && hAdm && h.id !== st.id;
        });
        if (histMatch) {
          prevInfo = {
            admNo: cleanStr(histMatch.admNo || histMatch['Adm. No.']),
            class: cleanStr(histMatch.class || histMatch.Class || '10th'),
            session: cleanStr(histMatch.session || histMatch.Session || '')
          };
        }
      }

      const userStrat = assignStrategies[st.id];
      const strat = userStrat || (prevInfo ? 'inherit_prev' : 'assign_new');

      let proposed = '—';
      if (strat === 'assign_new') {
        proposed = String(seqCounter);
        seqCounter++;
      } else if (strat === 'inherit_prev' && prevInfo) {
        proposed = prevInfo.admNo;
      } else if (strat === 'skip') {
        proposed = st.admNo || '—';
      }

      return {
        student: st,
        currentAdm: st.admNo,
        prevInfo,
        strat,
        proposed
      };
    });
  }, [candidateAssignStudents, assignStartId, assignStrategies, historyDataset]);

  const handleRunAssignIds = async () => {
    if (candidateIdPreviewList.length === 0) {
      setToast({ message: '⚠️ No eligible students selected for assignment.', type: 'error' });
      return;
    }

    setAssigningIds(true);
    let count = 0;
    try {
      const batch = writeBatch(db);
      const todayDate = new Date().toISOString().split('T')[0];

      for (const item of candidateIdPreviewList) {
        const { student, proposed, strat } = item;
        if (!proposed || proposed === '—' || strat === 'skip') continue;

        const docRef = doc(db, 'admissions', student.id);
        const payload = {
          'Adm. No.': proposed,
          admNo: proposed,
          'Adm. Date': student.admDate || todayDate,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Assign IDs'})`
        };
        batch.set(docRef, payload, { merge: true });
        updateCachedItem('admissions', student.id, payload);
        count++;
      }

      await batch.commit();

      await logAdminActivity({
        actionType: 'batch_id_assign',
        actionTitle: 'Bulk Assigned Admission Numbers',
        details: `Assigned admission numbers to ${count} students in session ${assignSessionFilter}.`,
        metadata: { count, session: assignSessionFilter }
      });

      setToast({ message: `✨ Successfully assigned Admission Numbers to ${count} students!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign IDs batch error:', err);
      setToast({ message: `❌ Error assigning IDs: ${err.message}`, type: 'error' });
    } finally {
      setAssigningIds(false);
    }
  };

  // -------------------------------------------------------------
  // ASSIGN DATES ENGINE STATE & LOGIC
  // -------------------------------------------------------------
  const [assignDateValue, setAssignDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [assignDateField, setAssignDateField] = useState('admDate');
  const [assignDateSession, setAssignDateSession] = useState('2025-26');
  const [assignDateClass, setAssignDateClass] = useState('ALL');
  const [assigningDates, setAssigningDates] = useState(false);

  const dateTargetStudents = useMemo(() => {
    return normalizedStudents.filter(st => {
      if (assignDateSession !== 'ALL' && st.session !== assignDateSession) return false;
      if (assignDateClass !== 'ALL' && !matchesClassVal(assignDateClass, st.class)) return false;
      return true;
    });
  }, [normalizedStudents, assignDateSession, assignDateClass]);

  const handleRunAssignDates = async () => {
    if (dateTargetStudents.length === 0) {
      setToast({ message: '⚠️ No students match the selected session and class scope.', type: 'error' });
      return;
    }
    setAssigningDates(true);
    try {
      const batch = writeBatch(db);
      const fieldKey = assignDateField === 'admDate' ? 'Adm. Date' : 'Online Subm. Date';
      const aliasKey = assignDateField === 'admDate' ? 'admDate' : 'onlineSubmDate';

      for (const st of dateTargetStudents) {
        const docRef = doc(db, 'admissions', st.id);
        const payload = {
          [fieldKey]: assignDateValue,
          [aliasKey]: assignDateValue,
          updatedAt: new Date().toISOString(),
          lastEditedBy: `Admin (${user?.email || 'Assign Dates'})`
        };
        batch.set(docRef, payload, { merge: true });
        updateCachedItem('admissions', st.id, payload);
      }

      await batch.commit();

      await logAdminActivity({
        actionType: 'batch_date_assign',
        actionTitle: `Bulk Assigned ${assignDateField === 'admDate' ? 'Admission Date' : 'Submission Date'}`,
        details: `Assigned date ${assignDateValue} to ${dateTargetStudents.length} students.`,
        metadata: { date: assignDateValue, count: dateTargetStudents.length }
      });

      setToast({ message: `✨ Applied date (${assignDateValue}) to ${dateTargetStudents.length} records!`, type: 'success' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Assign Dates error:', err);
      setToast({ message: `❌ Failed to assign dates: ${err.message}`, type: 'error' });
    } finally {
      setAssigningDates(false);
    }
  };

  // Native Excel (.xlsx) Export for Admission Register and Sentup
  const handleExportExcel = () => {
    if (filteredStudents.length === 0) return;

    if (activeTab === 'adm_register') {
      const headers = [
        'S.No.', 'Class Roll No.', 'Form No.', 'Status', 'Admission Type', 'Online Subm.', 'Adm. Date', 'Adm. No.', 'Old Adm. No.', 'Class', 'Board Reg. No.',
        "Student's Name", "Father's Name", "Mother's Name", 'DOB (Figures)', 'DOB (Words)', 'Gender',
        'Village/Town', 'Block', 'Tehsil', 'District', 'Student Mobile', 'Parent Mobile',
        'Stream', 'Chosen Subjects', 'Aadhaar No.', 'Social Category', 'Socio-Economic Category', 'Blood Group',
        'Bank Account No.', 'IFSC Code', 'PEN (UDISE)', 'Previous School', 'Prev Roll No', 'Prev Result',
        'Admtd. Vide DC/CC', 'Withdrawal Date', 'Remarks'
      ];

      const rows = filteredStudents.map(s => [
        s.sno,
        s.rollNo || '',
        s.formNo || '',
        s.status || '',
        s.isReadmission ? 'Re-admission' : 'Fresh',
        s.onlineStatus || '',
        s.admDate || '',
        s.admNo || '',
        s.oldAdmNo || '',
        s.class || '',
        s.boardReg || '',
        s.name || '',
        s.father || '',
        s.mother || '',
        s.dobFigures || '',
        s.dobWords || '',
        s.gender || '',
        s.village || '',
        s.block || '',
        s.tehsil || '',
        s.district || '',
        s.mobile || '',
        s.parentMobile || '',
        s.stream || '',
        s.subs || '',
        s.aadhar || '',
        s.category || '',
        s.socioEcon || '',
        s.blood || '',
        s.account || '',
        s.ifsc || '',
        s.pen || '',
        s.prevSchool || '',
        s.prevRoll || '',
        s.prevResult || '',
        s.prevCC || '',
        s.withdrawal || '',
        s.remarks || ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Admission_Register');
      const filename = `HSS_Shangus_Official_Admission_Register_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
      XLSX.writeFile(wb, filename);
    } else {
      const headers = [
        'S.No.', 'Adm. No.', 'Class Roll No.', 'Status', 'Admission Type', 'Board Reg. No.', "Student's Name", "Father's Name", "Mother's Name",
        'Date of Birth', 'Class', 'Session', 'Stream', 'Subjects', 'Board Roll No.', 'Result'
      ];

      const rows = filteredStudents.map(s => [
        s.sno,
        s.admNo || '',
        s.rollNo || '',
        s.status || '',
        s.isReadmission ? 'Re-admission' : 'Fresh',
        s.boardReg || '',
        s.name || '',
        s.father || '',
        s.mother || '',
        s.dobFigures || '',
        s.class || '',
        s.session || '',
        s.stream || '',
        s.subs || '',
        s.raw?.exam_r_no_current || '',
        s.raw?.result_current || ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'JKBOSE_Sentup');
      const filename = `HSS_Shangus_JKBOSE_Sentup_${selectedSession}_${selectedClass}_${selectedStatus}.xlsx`;
      XLSX.writeFile(wb, filename);
    }
  };

  return (
    <div className="admission-suite-root min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* ─── DYNAMIC PRINT CSS STYLESHEET (STRICT CLEAN LEGAL LANDSCAPE) ─── */}
      <style>{`
        @page {
          size: 355.6mm 215.9mm landscape !important;
          margin: 4mm 6mm !important;
        }
        @media print {
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif !important;
          }
          
          /* Suppress ALL injected header/footer watermarks and accessibility skip buttons */
          body::before, body::after, html::before, html::after, .ui-skip-link {
            display: none !important;
            content: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Strict Print Isolation: Hide all outer headers, portals, toolbars, buttons, ribbons */
          header, nav, footer, aside, .navbar, .portal-header, .admin-header, [role="navigation"], .no-print, button, select, input, .fixed, .sticky, .global-hud {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ensure parent themes don't apply backgrounds or borders during print */
          .admin-dashboard-theme, .workspace-card, .admin-dashboard-theme > div {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .admission-suite-root, #root, main {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            transform: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .space-y-6, .space-y-4, .space-y-3 {
            display: block !important;
            gap: 0 !important;
            margin: 0 !important;
            transform: none !important;
          }

          .spread-container {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          .page-container {
            display: block !important;
            position: relative !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 4mm 6mm !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            outline: none !important;
            page-break-before: always !important;
            page-break-after: always !important;
            break-before: page !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .page-container:first-of-type, .cover-page {
            page-break-before: auto !important;
            break-before: auto !important;
          }

          .cover-page {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 185mm !important;
            max-height: 200mm !important;
            padding: 10mm 12mm !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          /* Clean single 1px black borders without thick or duplicate outlines */
          table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
            table-layout: auto !important;
          }

          th, td {
            border: 1px solid #000000 !important;
            padding: 1px 2.5px !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          img {
            object-fit: cover !important;
          }

          .h-yellow, th.h-yellow, td.bg-yellow-50, td.bg-yellow-100, th.bg-yellow-200 { 
            background-color: #fef08a !important; 
          }
          .h-grey, th.h-grey, tr.bg-slate-200, tr.bg-slate-100, th.bg-slate-200, th.bg-slate-100 { 
            background-color: #e2e8f0 !important; 
          }
          .h-green, th.h-green, td.bg-emerald-50, th.bg-emerald-100 { 
            background-color: #dcfce7 !important; 
            color: #14532d !important; 
          }
          .h-red, th.h-red, td.bg-rose-50, th.bg-rose-100 { 
            background-color: #fee2e2 !important; 
            color: #991b1b !important; 
          }
        }

        /* ─── PREMIUM TYPOGRAPHY SYSTEM ─── */
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Merriweather:wght@400;700;900&display=swap');

        .school-header-font {
          font-family: 'Cinzel', 'Merriweather', serif !important;
          letter-spacing: 0.04em;
        }

        .ledger-data-font {
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif !important;
        }

        .ledger-mono-font {
          font-family: 'JetBrains Mono', monospace !important;
        }
      `}</style>

      {/* ─── ULTRA-COMPACT CONSOLIDATED 1-ROW TOOLBAR ─── */}
      <header className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs px-2.5 py-1">
        <div className="w-full max-w-[2000px] mx-auto flex items-center justify-between gap-1 xl:gap-2 flex-nowrap overflow-visible">
          {/* Left Cluster: Module Selector, Direct Class Scope, + Re-Adm, and Filters Popover */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
            {/* 1. Main Suite Module Dropdown */}
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="py-0.5 px-2 text-[11.5px] rounded-lg border-2 border-amber-600/50 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-black cursor-pointer shadow-2xs focus:ring-1 focus:ring-amber-500 shrink-0"
            >
              <option value="adm_register">📖 Admission Register</option>
              <option value="sentup">📋 Sentup Export</option>
              <option value="assign_ids">🔢 Assign IDs</option>
              <option value="assign_dates">📅 Assign Dates</option>
            </select>

            {(activeTab === 'adm_register' || activeTab === 'sentup') && (
              <>
                {/* 2. Direct Class Scope Selector (Defaults to 11th) */}
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="py-0.5 px-2 text-[11px] rounded-lg border-2 border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-black shadow-2xs cursor-pointer shrink-0"
                  title="Select Register Class Scope"
                >
                  <option value="11th">Class 11th</option>
                  {availableClasses.filter(c => c !== '11th').map(c => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                  <option value="ALL">All Classes</option>
                </select>

                {/* 3. Universal Add / Tag Re-admission Button (Kept prominent) */}
                <button
                  type="button"
                  onClick={handleOpenUniversalReadmissionModal}
                  className="py-0.5 px-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Tag / Map any student (from 10th, 12th, or past sessions) as a Re-admission into 9th or 11th register"
                >
                  <UserPlus size={11} className="text-purple-700 dark:text-purple-300" />
                  <span>+ Re-Adm</span>
                </button>

                {/* 4. Grouped Filters Dropdown Popover (Session, Status, Admission Type, Stream) */}
                <div className="relative shrink-0" ref={filtersPopoverRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFiltersPopover(prev => !prev);
                      setShowViewPopover(false);
                    }}
                    className={`py-0.5 px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                      activeFiltersCount > 0
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                    title="Configure Database Filters (Session, Status, Admission Type, Stream)"
                  >
                    <Filter size={11} className={activeFiltersCount > 0 ? 'text-amber-700' : 'text-slate-500'} />
                    <span>Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                    <ChevronDown size={10} className="text-slate-400" />
                  </button>

                  {/* Filter Popover Dropdown Panel */}
                  {showFiltersPopover && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] space-y-2.5 whitespace-normal animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Filter size={12} className="text-amber-600" /> Filter Register
                        </span>
                        {activeFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSession('2025-26');
                              setSelectedStatus('Approved');
                              setSelectedAdmissionType('ALL');
                              setSelectedStream('ALL');
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Session */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Academic Session:</label>
                        <select
                          value={selectedSession}
                          onChange={(e) => setSelectedSession(e.target.value)}
                          className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                        >
                          {availableSessions.map(sess => (
                            <option key={sess} value={sess}>{sess} {sess === '2025-26' ? '(Live)' : ''}</option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Admission Status:</label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 cursor-pointer"
                        >
                          <option value="Approved">Approved ({statusCounts.approved})</option>
                          <option value="Submitted">Submitted ({statusCounts.submitted})</option>
                          <option value="Provisional">Provisional ({statusCounts.provisional})</option>
                          <option value="ALL">All ({statusCounts.total})</option>
                        </select>
                      </div>

                      {/* Admission Type */}
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Admission Type:</label>
                        <select
                          value={selectedAdmissionType}
                          onChange={(e) => setSelectedAdmissionType(e.target.value)}
                          className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 cursor-pointer"
                        >
                          <option value="ALL">All Types</option>
                          <option value="fresh">Fresh Only ({statusCounts.fresh})</option>
                          <option value="readmission">Re-admission Only ({statusCounts.readmissions})</option>
                        </select>
                      </div>

                      {/* Stream */}
                      {availableStreams.length > 0 && (
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Stream Scope:</label>
                          <select
                            value={selectedStream}
                            onChange={(e) => setSelectedStream(e.target.value)}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 cursor-pointer"
                          >
                            <option value="ALL">All Streams</option>
                            {availableStreams.map(str => (
                              <option key={str} value={str}>{str}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Quick Search */}
                <div className="relative shrink-0">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-5 pr-1.5 py-0.5 text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-24 xl:w-28 shadow-2xs"
                  />
                </div>
              </>
            )}
          </div>

          {/* Right Cluster: Consolidated View & Layout Popover, Count Badge, Excel & Print */}
          <div className="flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
            {(activeTab === 'adm_register' || activeTab === 'sentup') && (
              <>
                {/* 1. Grouped View & Layout Popover (Section, Book View, Margins, Row Height, Zoom, Firebase Presets) */}
                <div className="relative shrink-0" ref={viewPopoverRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowViewPopover(prev => !prev);
                      setShowFiltersPopover(false);
                    }}
                    className="py-0.5 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer hover:bg-slate-50 shadow-2xs"
                    title="View Section, Book Layout, Margins, Row Height & Zoom Settings"
                  >
                    <Eye size={11} className="text-indigo-600" />
                    <span>View & Layout</span>
                    <ChevronDown size={10} className="text-slate-400" />
                  </button>

                  {/* View Popover Dropdown Panel */}
                  {showViewPopover && (
                    <div className="absolute right-0 top-full mt-1.5 w-72 p-3.5 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] space-y-3 whitespace-normal animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Eye size={12} className="text-indigo-600" /> Display & Table Layout
                        </span>
                      </div>

                      {/* Sub-view Section Selector */}
                      {activeTab === 'adm_register' && (
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">Section to Display:</label>
                          <select
                            value={registerViewSection}
                            onChange={(e) => setRegisterViewSection(e.target.value)}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 cursor-pointer"
                          >
                            <option value="all">📑 All Spreads (Full Register)</option>
                            <option value="cover">📜 Cover Page Only</option>
                            <option value="spreads">📖 Ledger Table Only</option>
                            <option value="summary">📊 Summary Statement Only</option>
                            <option value="notes">📝 Notes & Annexure Only</option>
                          </select>
                        </div>
                      )}

                      {/* Screen Layout Mode (Side-by-Side Book View vs Stacked) */}
                      {activeTab === 'adm_register' && (
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 mb-1">Book Layout:</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSpreadLayoutMode('side_by_side')}
                              className={`py-1 px-2 rounded-lg border text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                spreadLayoutMode === 'side_by_side'
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                              }`}
                            >
                              <Columns size={11} />
                              <span>Side-by-Side</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpreadLayoutMode('stacked')}
                              className={`py-1 px-2 rounded-lg border text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                spreadLayoutMode === 'stacked'
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200'
                              }`}
                            >
                              <LayoutGrid size={11} />
                              <span>Stacked Pages</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Dynamic Row Height Manager */}
                      <div>
                        <div className="flex items-center justify-between text-[10.5px] font-bold mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400">Row Height:</span>
                          <span className="font-mono text-indigo-600 font-black">{rowHeight} px</span>
                        </div>
                        <input
                          type="range"
                          min="28"
                          max="70"
                          step="2"
                          value={rowHeight}
                          onChange={(e) => handleRowHeightChange(parseInt(e.target.value, 10))}
                          className="w-full cursor-pointer accent-indigo-600"
                        />
                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          {[34, 44, 54].map(h => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => handleRowHeightChange(h)}
                              className={`py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                rowHeight === h ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {h === 34 ? 'Compact' : h === 44 ? 'Default' : 'Spacious'} ({h}px)
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Margins */}
                      <div>
                        <div className="flex items-center justify-between text-[10.5px] font-bold mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400">Print Margins:</span>
                          <span className="font-mono text-indigo-600 font-black">{printMargin} in</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.8"
                          step="0.05"
                          value={printMargin}
                          onChange={(e) => setPrintMargin(parseFloat(e.target.value))}
                          className="w-full cursor-pointer accent-indigo-600"
                        />
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          {[0.2, 0.3, 0.4, 0.5].map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPrintMargin(m)}
                              className={`py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                printMargin === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                              }`}
                            >
                              {m}" {m === 0.3 ? '★' : ''}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Zoom Controls */}
                      <div>
                        <div className="flex items-center justify-between text-[10.5px] font-bold mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400">Screen Zoom:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">{Math.round(zoomLevel * 100)}%</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setZoomLevel(prev => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10))}
                            className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(1.0)}
                            className="text-[10.5px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            Reset 100%
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10))}
                            className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Save to Firebase & Reset to Original Buttons */}
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-1.5">
                        <button
                          type="button"
                          onClick={handleSaveLayoutToFirebase}
                          disabled={savingLayout}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-50"
                          title="Save custom column widths, row height and margins to Firebase default"
                        >
                          {savingLayout ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          <span>Set this to Default (Firebase)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetLayoutToOriginal}
                          className="w-full py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          title="Reset columns and row heights to original factory format"
                        >
                          <RotateCcw size={12} />
                          <span>Reset to Original Form</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Record count badge */}
                <div className="py-0.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-black shrink-0 shadow-2xs">
                  {filteredStudents.length} Students
                  {statusCounts.readmissions > 0 && (
                    <span className="ml-1 text-purple-700 dark:text-purple-300 font-extrabold">
                      ({statusCounts.readmissions} Re-Adm)
                    </span>
                  )}
                </div>

                {/* 3. Excel Export */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="py-0.5 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11.5px] shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Export Official Ledger to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={11} />
                  <span>Excel</span>
                </button>

                {/* 4. Print */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-0.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11.5px] shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <Printer size={11} />
                  <span>Print</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div className="no-print fixed top-14 right-4 z-50 animate-bounce">
          <div className={`px-3.5 py-2 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
          }`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-80 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        </div>
      )}

      {/* ─── UNIVERSAL READMISSION MANAGER MODAL ─── */}
      {(readmissionModalStudent || isUniversalModalOpen) && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shadow-xs">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {readmissionModalStudent ? 'Assign Re-admission / Register Mapping' : 'Universal Re-admission Student Finder'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {readmissionModalStudent
                      ? `Configuring ${readmissionModalStudent.name} for Admission Register`
                      : 'Search any student across all classes (10th/12th/9th/11th) and past sessions'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReadmissionModalStudent(null);
                  setIsUniversalModalOpen(false);
                  setSearchCandidateQuery('');
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* View 1: Search & Select Student if no student is selected */}
            {!readmissionModalStudent ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search candidate by name, father, roll no, board reg, class (10th/12th)..."
                    value={searchCandidateQuery}
                    onChange={(e) => setSearchCandidateQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 font-medium focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Select a student to map as Re-admission ({candidateSearchResults.length} found):
                  </p>
                  {candidateSearchResults.map((candidate) => (
                    <div
                      key={candidate.id}
                      onClick={() => handleSelectCandidateForReadmission(candidate)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-950/40 cursor-pointer transition-all flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0 border">
                          {candidate.name ? candidate.name[0].toUpperCase() : 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                            {candidate.name}
                          </p>
                          <p className="text-[10.5px] text-slate-500 truncate">
                            S/o {candidate.father || '—'} • Class: <span className="font-bold text-indigo-600 dark:text-indigo-400">{candidate.class}</span> ({candidate.session})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {candidate.admNo && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                            Adm: {candidate.admNo}
                          </span>
                        )}
                        <span className="p-1 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}
                  {candidateSearchResults.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                      No matching student found for "{searchCandidateQuery}".
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* View 2: Configure Re-admission & Target Class Mapping */
              <div className="space-y-3.5 text-xs">
                {/* Selected Student Information Banner */}
                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Candidate Selected</span>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">{readmissionModalStudent.name}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      S/o {readmissionModalStudent.father || '—'} • Original Record: Class {readmissionModalStudent.class} ({readmissionModalStudent.session || 'Past'})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReadmissionModalStudent(null)}
                    className="px-2 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 dark:text-purple-300 bg-white dark:bg-slate-900 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer shadow-2xs"
                  >
                    Change
                  </button>
                </div>

                {/* Admission Category Selector */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Admission Category:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReAdmFormState(prev => ({ ...prev, isReAdm: false }))}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        !reAdmFormState.isReAdm
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <UserCheck size={13} />
                      <span>Fresh Admission</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReAdmFormState(prev => ({ ...prev, isReAdm: true }))}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        reAdmFormState.isReAdm
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <RefreshCw size={13} />
                      <span>Re-admission (Gap)</span>
                    </button>
                  </div>
                </div>

                {/* Target Session & Class Mapping Fields */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Academic Session:</label>
                    <select
                      value={reAdmFormState.targetSession}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, targetSession: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300"
                    >
                      {availableSessions.map(sess => (
                        <option key={sess} value={sess}>{sess} {sess === '2025-26' ? '(Live)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Admission Register Class:</label>
                    <select
                      value={reAdmFormState.targetClass}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, targetClass: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100"
                    >
                      <option value="11th">Class 11th Register</option>
                      <option value="9th">Class 9th Register</option>
                      <option value="12th">Class 12th</option>
                      <option value="10th">Class 10th</option>
                    </select>
                  </div>
                </div>

                {/* Stream and Reason */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Academic Stream:</label>
                    <select
                      value={reAdmFormState.targetStream}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, targetStream: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    >
                      <option value="Science (Medical)">Science (Medical)</option>
                      <option value="Science (Non-Medical)">Science (Non-Medical)</option>
                      <option value="Arts">Arts</option>
                      <option value="Commerce">Commerce</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Re-admission Reason:</label>
                    <select
                      value={reAdmFormState.reason}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, reason: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="Gap in Studies / Re-enrolled">Gap in Studies</option>
                      <option value="Failed in Previous Examination">Failed / Repeat</option>
                      <option value="Non-Appearance in Board Exam">Board Exam Non-Appearance</option>
                      <option value="Medical / Domestic Leave">Medical / Personal Gap</option>
                    </select>
                  </div>
                </div>

                {/* Admission Numbers (New & Historical Audit) */}
                <div className="grid grid-cols-2 gap-2.5 p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-950 dark:text-purple-200 mb-1">
                      Assigned Admission No:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5480"
                      value={reAdmFormState.assignedAdmNo}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, assignedAdmNo: e.target.value }))}
                      className="w-full p-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 font-mono font-bold bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-950 dark:text-purple-200 mb-1">
                      Previous Admission No (Audit):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4312"
                      value={reAdmFormState.oldAdmNo}
                      onChange={(e) => setReAdmFormState(prev => ({ ...prev, oldAdmNo: e.target.value }))}
                      className="w-full p-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 font-mono font-bold bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div className="col-span-2 text-[10.5px] text-purple-800 dark:text-purple-300 flex items-start gap-1.5 pt-1">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-purple-600" />
                    <span>
                      Will print in the <strong>Class {reAdmFormState.targetClass} ({reAdmFormState.targetSession})</strong> ledger at the end of the section as:{' '}
                      <strong className="font-mono bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded">
                        {reAdmFormState.assignedAdmNo || '5480'} ({reAdmFormState.oldAdmNo || '4312'})
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setReadmissionModalStudent(null);
                  setIsUniversalModalOpen(false);
                  setSearchCandidateQuery('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              {readmissionModalStudent && (
                <button
                  type="button"
                  onClick={handleSaveReadmission}
                  disabled={savingReAdm}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingReAdm ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Save Re-admission Mapping</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN PREVIEW CONTAINER ─── */}
      <main className="flex-1 p-2 sm:p-5 overflow-x-auto">
        <div className="max-w-full mx-auto">
          {/* ============================================================== */}
          {/* TAB 1: ADMISSION REGISTER (PRINT-READY DUAL SPREAD)            */}
          {/* ============================================================== */}
          {activeTab === 'adm_register' && (
            <div className="space-y-6" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              {/* 1. COVER PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'cover') && (
                <div
                  className="page-container cover-page bg-white rounded-xl border border-slate-300 shadow-sm text-center flex flex-col items-center justify-center max-w-[355.6mm] mx-auto page-break-after"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="flex flex-col items-center justify-center w-full my-auto py-6 sm:py-8">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-red-700 uppercase tracking-tight font-sans mb-2">
                      ADMISSION REGISTER
                    </h1>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-red-700 uppercase tracking-tight font-sans mb-3">
                      {selectedClass === 'ALL' ? 'OF CLASSES 11th AND 12th' : `OF CLASS ${selectedClass.toUpperCase()}`}
                    </h2>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-emerald-700 font-sans mb-4 sm:mb-6">
                      Session {selectedSession}
                    </h3>

                    <div className="w-4/5 max-w-3xl border-b-2 border-slate-900 my-3 sm:my-4"></div>

                    <h4 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 font-sans mt-2">
                      {SCHOOL_NAME}
                    </h4>
                  </div>
                </div>
              )}

              {/* 2. DUAL-SPREAD REGISTER PAGES */}
              {(registerViewSection === 'all' || registerViewSection === 'spreads') && (
                pageChunks.map((chunk, chunkIdx) => {
                  const pageNum = chunkIdx + 1;
                  return (
                    <div
                      key={pageNum}
                      className={`spread-container ${
                        spreadLayoutMode === 'side_by_side'
                          ? 'flex flex-col 2xl:flex-row gap-3 max-w-full mx-auto items-stretch'
                          : 'flex flex-col gap-4 max-w-[355.6mm] mx-auto'
                      }`}
                    >
                      {/* LEFT PAGE: PART 1 (Personal & Contact Details) */}
                      <div
                        className={`page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none ${
                          spreadLayoutMode === 'side_by_side' ? 'flex-1 min-w-[50%]' : 'w-full'
                        }`}
                        style={{ padding: `${printMargin}in` }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1.5">
                          <div className="text-xs font-black text-slate-900">{pageNum} (part1)</div>
                          <div className="text-center">
                            <h2 className="text-base font-black text-red-700 uppercase leading-none font-sans">{SCHOOL_NAME}</h2>
                            <div className="text-[10.5px] font-bold text-emerald-700 mt-0.5">
                              Admission Register of classes 11th and 12th, session {selectedSession}
                            </div>
                          </div>
                          {/* Blank circle for manual hand-stamping of serial number */}
                          <div
                            className="w-6 h-6 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none"
                            title="Manual Serial / Page Number Stamp Area"
                          >
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[8.5px] border-collapse border border-slate-900 ledger-data-font">
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <ResizableTh colKey="sno" width={columnWidths.sno} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">S.NO.</ResizableTh>
                                <ResizableTh colKey="photo" width={columnWidths.photo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">PHOTO</ResizableTh>
                                <ResizableTh colKey="rollNo" width={columnWidths.rollNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">CLASS R.NO.</ResizableTh>
                                <ResizableTh colKey="formNo" width={columnWidths.formNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">FORM NO.</ResizableTh>
                                <ResizableTh colKey="onlineStatus" width={columnWidths.onlineStatus} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">ONLINE SUBM.</ResizableTh>
                                <ResizableTh colKey="admDate" width={columnWidths.admDate} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">ADM. DATE</ResizableTh>
                                <ResizableTh colKey="admNo" width={columnWidths.admNo} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">ADM. NO.</ResizableTh>
                                <ResizableTh colKey="class" width={columnWidths.class} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">CLASS ADM. TO</ResizableTh>
                                <ResizableTh colKey="boardReg" width={columnWidths.boardReg} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">BOARD REG. NO.</ResizableTh>
                                <ResizableTh colKey="name" width={columnWidths.name} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-left pl-2 h-grey">STUDENT'S NAME</ResizableTh>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">PARENTAGE</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center h-grey">DATE OF BIRTH</th>
                                <ResizableTh colKey="gender" width={columnWidths.gender} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">GENDER</ResizableTh>
                                <th colSpan="4" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">RESIDENCE</th>
                                <th colSpan="2" className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-200 text-slate-900 h-yellow">CONTACT</th>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <ResizableTh colKey="father" width={columnWidths.father} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">FATHER'S NAME</ResizableTh>
                                <ResizableTh colKey="mother" width={columnWidths.mother} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">MOTHER'S NAME</ResizableTh>
                                <ResizableTh colKey="dobFigures" width={columnWidths.dobFigures} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">FIGURES</ResizableTh>
                                <ResizableTh colKey="dobWords" width={columnWidths.dobWords} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">WORDS</ResizableTh>
                                <ResizableTh colKey="village" width={columnWidths.village} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">VILLAGE/ TOWN</ResizableTh>
                                <ResizableTh colKey="block" width={columnWidths.block} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">BLOCK</ResizableTh>
                                <ResizableTh colKey="tehsil" width={columnWidths.tehsil} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">TEHSIL</ResizableTh>
                                <ResizableTh colKey="district" width={columnWidths.district} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">DISTRICT</ResizableTh>
                                <ResizableTh colKey="mobile" width={columnWidths.mobile} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">STUDENT'S MOBILE</ResizableTh>
                                <ResizableTh colKey="parentMobile" width={columnWidths.parentMobile} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 bg-yellow-100 h-yellow">PARENT'S MOBILE</ResizableTh>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s) => {
                                const photoSrc = getResolvedStudentPhoto(s);
                                return (
                                  <tr key={s.id} style={{ height: `${rowHeight}px` }} className="hover:bg-slate-50 group">
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold ledger-mono-font">{s.sno}</td>
                                    <td className="border border-slate-900 p-0 text-center overflow-hidden bg-slate-50 print:bg-transparent" style={{ width: columnWidths.photo ? `${columnWidths.photo}px` : undefined }}>
                                      {photoSrc ? (
                                        <img
                                          src={photoSrc}
                                          alt={s.name}
                                          className="w-full h-full object-cover"
                                          loading="eager"
                                          crossOrigin="anonymous"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.nextElementSibling) {
                                              e.currentTarget.nextElementSibling.style.display = 'flex';
                                            }
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-full h-full items-center justify-center text-[7px] text-slate-400 font-bold ${photoSrc ? 'hidden' : 'flex'}`}>
                                        Photo
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-indigo-700 ledger-mono-font">{s.rollNo}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold ledger-mono-font">{s.formNo}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center text-[7.5px] leading-tight">{s.onlineStatus}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-semibold ledger-mono-font">{s.admDate}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-emerald-800 text-[9px] leading-tight">
                                      <div className="ledger-mono-font font-black">{s.admNo || '—'}</div>
                                      {s.isReadmission && s.oldAdmNo && s.oldAdmNo !== s.admNo && (
                                        <div className="text-[7.5px] font-mono text-purple-700 font-bold">({s.oldAdmNo})</div>
                                      )}
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.class}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center ledger-mono-font">{formatBoardRegSplit(s.boardReg)}</td>
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-left">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-black uppercase tracking-tight">{s.name}</span>
                                        {/* Clickable Re-admission indicator badge */}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenReadmissionModal(s)}
                                          className={`no-print px-1 py-0.2 rounded text-[7px] font-black cursor-pointer transition-all ${
                                            s.isReadmission
                                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300'
                                              : 'opacity-0 group-hover:opacity-100 bg-slate-100 text-slate-500 hover:bg-purple-50 hover:text-purple-700'
                                          }`}
                                          title="Click to toggle Re-admission / Fresh admission status"
                                        >
                                          {s.isReadmission ? 'Re-Adm' : 'Set Re-Adm'}
                                        </button>
                                      </div>
                                    </td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[8px]">{s.father}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left uppercase text-[8px]">{s.mother}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-mono ledger-mono-font">{s.dobFigures}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight font-serif">{s.dobWords}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center font-semibold">{s.gender}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.village}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.block}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.tehsil}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-left bg-yellow-50">{s.district}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono ledger-mono-font">{s.mobile}</td>
                                    <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-mono ledger-mono-font">{s.parentMobile}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="flex justify-between items-center mt-3 pt-1 text-xs font-black text-red-700">
                          <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Incharge Admissions</div>
                          <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Checked By</div>
                          <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Principal</div>
                        </div>
                      </div>

                      {/* RIGHT PAGE: PART 2 (Academic, Category & Receipt Ledger) */}
                      <div
                        className={`page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none ${
                          spreadLayoutMode === 'side_by_side' ? 'flex-1 min-w-[50%]' : 'w-full'
                        }`}
                        style={{ padding: `${printMargin}in` }}
                      >
                        <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1.5">
                          <div className="text-xs font-black text-slate-900">{pageNum} (part2)</div>
                          <div className="text-center">
                            <h2 className="text-base font-black text-red-700 uppercase leading-none font-sans">{SCHOOL_NAME}</h2>
                            <div className="text-[10.5px] font-bold text-emerald-700 mt-0.5">
                              Admission Register of classes 11th and 12th, session {selectedSession}
                            </div>
                          </div>
                          {/* Blank circle for manual hand-stamping of serial number */}
                          <div
                            className="w-6 h-6 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-mono text-transparent select-none"
                            title="Manual Serial / Page Number Stamp Area"
                          >
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[8.5px] border-collapse border border-slate-900 ledger-data-font">
                            <thead>
                              <tr className="bg-slate-200 text-slate-900 uppercase font-black text-center">
                                <ResizableTh colKey="p2_stream" width={columnWidths.p2_stream} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">STREAM</ResizableTh>
                                <ResizableTh colKey="p2_subs" width={columnWidths.p2_subs} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">SUBS</ResizableTh>
                                <ResizableTh colKey="p2_aadhar" width={columnWidths.p2_aadhar} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">AADHAR NO.</ResizableTh>
                                <ResizableTh colKey="p2_cat" width={columnWidths.p2_cat} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">SOC. CAT.</ResizableTh>
                                <ResizableTh colKey="p2_socio" width={columnWidths.p2_socio} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">SOCIO-ECON CAT.</ResizableTh>
                                <ResizableTh colKey="p2_blood" width={columnWidths.p2_blood} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">BLOOD GRP</ResizableTh>
                                <ResizableTh colKey="p2_account" width={columnWidths.p2_account} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">A/C NO.</ResizableTh>
                                <ResizableTh colKey="p2_ifsc" width={columnWidths.p2_ifsc} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 bg-yellow-200 text-slate-900 h-yellow">IFSC CODE</ResizableTh>
                                <th colSpan="3" className="border border-slate-900 px-1 py-0.5 text-center h-grey">PREVIOUS ACADEMIC DETAILS</th>
                                <ResizableTh colKey="p2_pen" width={columnWidths.p2_pen} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">PEN (UDISE)</ResizableTh>
                                <ResizableTh colKey="p2_prevCC" width={columnWidths.p2_prevCC} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-emerald-900 bg-emerald-100 h-green">ADMTD. VIDE DC/CC</ResizableTh>
                                <ResizableTh colKey="p2_withdrawal" width={columnWidths.p2_withdrawal} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-100 h-red">WITHDRAWAL DATE</ResizableTh>
                                <ResizableTh colKey="p2_issuedCC" width={columnWidths.p2_issuedCC} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-50 h-red">ISSUED DC/CC</ResizableTh>
                                <ResizableTh colKey="p2_receipt" width={columnWidths.p2_receipt} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 text-rose-900 bg-rose-50 h-red">RECEIPT</ResizableTh>
                                <ResizableTh colKey="p2_remarks" width={columnWidths.p2_remarks} onResize={handleColumnResize} rowSpan="2" className="border border-slate-900 px-1 py-1 h-grey">REMARKS</ResizableTh>
                              </tr>
                              <tr className="bg-slate-100 text-slate-900 uppercase font-bold text-[7.5px]">
                                <ResizableTh colKey="p2_prevSchool" width={columnWidths.p2_prevSchool} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREVIOUS SCHOOL</ResizableTh>
                                <ResizableTh colKey="p2_prevRoll" width={columnWidths.p2_prevRoll} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREV R.NO.</ResizableTh>
                                <ResizableTh colKey="p2_prevResult" width={columnWidths.p2_prevResult} onResize={handleColumnResize} className="border border-slate-900 px-1 py-0.5 h-grey">PREV RESULT</ResizableTh>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-900">
                              {chunk.map((s) => (
                                <tr key={s.id} style={{ height: `${rowHeight}px` }} className="hover:bg-slate-50">
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.stream}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px] leading-tight font-medium">{s.subs}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono bg-yellow-50 ledger-mono-font">{s.aadhar}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-black">{s.category}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50">{s.socioEcon}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center bg-yellow-50 font-bold">{s.blood}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7.5px] bg-yellow-50 ledger-mono-font">{s.account}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7.5px] bg-yellow-50 ledger-mono-font">{s.ifsc}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7.5px] leading-tight">{s.prevSchool}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono ledger-mono-font">{s.prevRoll}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-bold">{s.prevResult}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[7.5px] ledger-mono-font">{s.pen}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-emerald-900 font-bold text-[7px] bg-emerald-50">
                                    {s.prevCC}
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-center text-rose-900 text-[7.5px] bg-rose-50">{s.withdrawal}</td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[6.5px] bg-rose-50/50 leading-tight">
                                    <div>C.No. _______</div>
                                    <div>Dt. _______</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[6.5px] leading-tight bg-rose-50/50">
                                    <div>received DC/CC vide C. No. ___</div>
                                    <div>on _______ Sig. _______</div>
                                  </td>
                                  <td className="border border-slate-900 px-1 py-0.5 text-left text-[7px]">{s.remarks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Signatures */}
                        <div className="flex justify-between items-center mt-3 pt-1 text-xs font-black text-red-700">
                          <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Incharge Admissions</div>
                          <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Checked By</div>
                          <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Principal</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* 3. CONSOLIDATED SUMMARY PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'summary') && (
                <div
                  className="page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none max-w-[355.6mm] mx-auto page-break-after"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="text-center border-b-2 border-red-700 pb-2 mb-3">
                    <h1 className="text-2xl font-black text-red-700 uppercase tracking-wide font-sans">
                      CONSOLIDATED ADMISSION STATEMENT
                    </h1>
                    <h2 className="text-xs font-bold text-emerald-700 font-sans mt-0.5">
                      Roll statement for Session {selectedSession}
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse border-2 border-red-700 text-xs ledger-data-font">
                      <thead>
                        <tr className="bg-red-50 text-slate-900 font-black">
                          <th className="border-2 border-red-700 p-2">CLASS</th>
                          <th className="border-2 border-red-700 p-2 text-left pl-4">STREAM</th>
                          <th className="border-2 border-red-700 p-2 w-24">MALE</th>
                          <th className="border-2 border-red-700 p-2 w-24">FEMALE</th>
                          <th className="border-2 border-red-700 p-2 w-24">TOTAL</th>
                          <th className="border-2 border-red-700 p-2 w-32">GRAND TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-red-700 font-bold text-slate-900">
                        {Object.keys(summaryStats).sort().map(cls => {
                          const streams = Object.keys(summaryStats[cls]).sort();
                          const clsTotal = Object.values(summaryStats[cls]).reduce((acc, curr) => acc + curr.total, 0);
                          return streams.map((st, idx) => {
                            const item = summaryStats[cls][st];
                            return (
                              <tr key={`${cls}_${st}`} className="hover:bg-red-50/40">
                                {idx === 0 && (
                                  <td rowSpan={streams.length} className="border-2 border-red-700 p-2 font-black text-base bg-white">
                                    {cls}
                                  </td>
                                )}
                                <td className="border-2 border-red-700 p-2 text-left pl-4 font-semibold">{st}</td>
                                <td className="border-2 border-red-700 p-2 ledger-mono-font">{item.male}</td>
                                <td className="border-2 border-red-700 p-2 ledger-mono-font">{item.female}</td>
                                <td className="border-2 border-red-700 p-2 font-bold ledger-mono-font">{item.total}</td>
                                {idx === 0 && (
                                  <td rowSpan={streams.length} className="border-2 border-red-700 p-2 font-black text-lg italic text-red-700 bg-white ledger-mono-font">
                                    {clsTotal}
                                  </td>
                                )}
                              </tr>
                            );
                          });
                        })}
                        <tr className="bg-white text-slate-900 font-black text-sm">
                          <td colSpan="2" className="border-2 border-red-700 p-2 text-right pr-4 font-black">Overall Grand Total</td>
                          <td className="border-2 border-red-700 p-2 ledger-mono-font font-black">{overallSummaryTotals.male}</td>
                          <td className="border-2 border-red-700 p-2 ledger-mono-font font-black">{overallSummaryTotals.female}</td>
                          <td className="border-2 border-red-700 p-2 font-black text-base ledger-mono-font bg-white"></td>
                          <td className="border-2 border-red-700 p-2 font-black text-lg ledger-mono-font text-slate-900">{overallSummaryTotals.grandTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Institutional Certification Paragraph */}
                  <div className="mt-4 p-2.5 text-xs font-serif leading-relaxed text-slate-800">
                    <p className="font-bold mb-1">Certification:</p>
                    <p>
                      Certified that the above mentioned <strong>{overallSummaryTotals.grandTotal}</strong> students have been admitted to <strong>{SCHOOL_NAME}</strong> for the academic session <strong>{selectedSession}</strong>. Their particulars as entered in this register have been verified from the original documents and found correct.
                    </p>
                  </div>

                  {/* Footer Signatures */}
                  <div className="flex justify-between items-center mt-6 pt-1 text-xs font-black text-red-700">
                    <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Incharge Admissions</div>
                    <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Checked By</div>
                    <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Principal</div>
                  </div>
                </div>
              )}

              {/* 4. EDITABLE OFFICIAL NOTES PAGE */}
              {(registerViewSection === 'all' || registerViewSection === 'notes') && (
                <div
                  className="page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none max-w-[355.6mm] mx-auto"
                  style={{ padding: `${printMargin}in` }}
                >
                  <div className="flex items-center justify-between pb-1 mb-2">
                    <h1 className="text-base font-black text-red-700 uppercase font-sans">
                      Please, Note:
                    </h1>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className="no-print px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Note</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-800 text-[11px] ledger-data-font">
                      <tbody className="divide-y divide-slate-800 text-slate-900">
                        {registerNotes.map((note, idx) => (
                          <tr key={note.id}>
                            <td className="border border-slate-800 p-2 w-10 text-center font-black bg-white ledger-mono-font align-top">{idx + 1}</td>
                            <td className="border border-slate-800 p-2 font-medium leading-relaxed">
                              <textarea
                                value={note.text}
                                onChange={(e) => handleUpdateNote(note.id, e.target.value)}
                                rows={note.text.length > 200 ? 3 : 2}
                                className="w-full p-1 border border-transparent hover:border-slate-300 focus:border-amber-500 rounded bg-transparent text-[11px] font-medium resize-y focus:bg-white leading-relaxed"
                              />
                            </td>
                            <td className="no-print border border-slate-800 p-1.5 w-10 text-center align-top">
                              <button
                                type="button"
                                onClick={() => handleRemoveNote(note.id)}
                                className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Signatures */}
                  <div className="flex justify-between items-center mt-8 pt-1 text-xs font-black text-red-700">
                    <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Incharge Admissions</div>
                    <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Checked By</div>
                    <div className="text-center w-36 border-t-2 border-red-700 pt-0.5">Principal</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: SENTUP EXPORT (JKBOSE THEMED CANDIDATE ROLL SHEET)       */}
          {/* ============================================================== */}
          {activeTab === 'sentup' && (
            <div className="space-y-6" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              {pageChunks.map((chunk, idx) => {
                const pageNum = idx + 1;
                const is12th = selectedClass.includes('12');
                const themeHeaderBg = is12th ? 'bg-rose-900 text-white' : 'bg-sky-800 text-white';

                return (
                  <div
                    key={pageNum}
                    className="page-container bg-white rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none max-w-[355.6mm] mx-auto page-break-after"
                    style={{ padding: `${printMargin}in` }}
                  >
                    {/* Header */}
                    <div className="text-center border-b border-slate-900 pb-1 mb-2 relative">
                      <div className="absolute left-0 top-0 text-[10px] font-bold text-slate-500">Candidate Roll Sheet</div>
                      <h1 className="text-base font-black text-red-800 uppercase tracking-tight school-header-font">{SCHOOL_NAME}</h1>
                      <div className="text-[9.5px] font-bold text-slate-800 mt-0.5">
                        JKBOSE Sentup Roll Sheet • Class {selectedClass} • Session {selectedSession} • {selectedStatus} Candidates
                      </div>
                      <div className="absolute right-0 top-0 w-5 h-5 rounded-full border border-slate-900 text-center text-[9px] font-black leading-4 text-transparent select-none">
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[9px] border-collapse border border-slate-900 ledger-data-font">
                        <thead>
                          <tr className={`${themeHeaderBg} uppercase font-black text-center text-[8.5px]`}>
                            <ResizableTh colKey="st_sno" width={columnWidths.st_sno} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">S.No.<br /><span className="text-[7px] opacity-80">[Adm No.]</span></ResizableTh>
                            <ResizableTh colKey="st_rollNo" width={columnWidths.st_rollNo} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Class<br />Roll No.</ResizableTh>
                            <ResizableTh colKey="st_photo" width={columnWidths.st_photo} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Photo</ResizableTh>
                            <ResizableTh colKey="st_boardReg" width={columnWidths.st_boardReg} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Board<br />Reg. No.</ResizableTh>
                            <ResizableTh colKey="st_name" width={columnWidths.st_name} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-left pl-2">Student's Name</ResizableTh>
                            <ResizableTh colKey="st_parentage" width={columnWidths.st_parentage} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1 text-left pl-2">Parentage<br /><span className="text-[6.5px] opacity-80">(Father / Mother)</span></ResizableTh>
                            <ResizableTh colKey="st_dob" width={columnWidths.st_dob} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Date of Birth</ResizableTh>
                            <ResizableTh colKey="st_subs" width={columnWidths.st_subs} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Subjects</ResizableTh>
                            <ResizableTh colKey="st_boardRoll" width={columnWidths.st_boardRoll} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Board<br />Roll No.</ResizableTh>
                            <ResizableTh colKey="st_result" width={columnWidths.st_result} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Result</ResizableTh>
                            <ResizableTh colKey="st_admitReceipt" width={columnWidths.st_admitReceipt} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Admit Card<br />Receipt</ResizableTh>
                            <ResizableTh colKey="st_marksReceipt" width={columnWidths.st_marksReceipt} onResize={handleColumnResize} className="border border-slate-900 px-1 py-1">Marks Card / Certificate Receipt</ResizableTh>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 text-slate-900">
                          {chunk.map((s) => {
                            const photoSrc = getResolvedStudentPhoto(s);
                            return (
                              <tr key={s.id} style={{ height: `${rowHeight}px` }} className="hover:bg-slate-50">
                                <td className="border border-slate-900 px-1 py-0.5 text-center">
                                  <div className="font-black text-xs ledger-mono-font">{s.sno}</div>
                                  <div className="text-[7.5px] font-mono text-slate-500 ledger-mono-font">[{s.admNo || '—'}]</div>
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-black text-sm text-sky-800 ledger-mono-font">{s.rollNo}</td>
                                <td className="border border-slate-900 p-0 text-center overflow-hidden bg-slate-50 print:bg-transparent" style={{ width: columnWidths.st_photo ? `${columnWidths.st_photo}px` : undefined }}>
                                  {photoSrc ? (
                                    <img
                                      src={photoSrc}
                                      alt={s.name}
                                      className="w-full h-full object-cover"
                                      loading="eager"
                                      crossOrigin="anonymous"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        if (e.currentTarget.nextElementSibling) {
                                          e.currentTarget.nextElementSibling.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full items-center justify-center text-[7px] text-slate-400 font-bold ${photoSrc ? 'hidden' : 'flex'}`}>
                                    Photo
                                  </div>
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center ledger-mono-font">{formatBoardRegSplit(s.boardReg)}</td>
                                <td className="border border-slate-900 px-2 py-0.5 text-left font-black uppercase text-[10px]">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="tracking-tight">{s.name}</span>
                                    {s.isReadmission && (
                                      <span className="text-[7px] font-black px-1 py-0.2 rounded bg-purple-100 text-purple-800">
                                        Re-Adm
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="border border-slate-900 px-2 py-0.5 text-left uppercase text-[8.5px] leading-tight">
                                  <div className="font-bold border-b border-slate-200 pb-0.5">{s.father}</div>
                                  <div className="text-slate-500 text-[7.5px] pt-0.5">{s.mother}</div>
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-mono text-[8.5px] ledger-mono-font">{s.dobFigures}</td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center text-[7.5px] leading-tight font-medium">
                                  {s.subs ? s.subs.split(',').map((sub, i) => <div key={i}>{sub.trim()}</div>) : '—'}
                                </td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-mono font-bold text-xs ledger-mono-font">{s.raw?.exam_r_no_current || '—'}</td>
                                <td className="border border-slate-900 px-1 py-0.5 text-center font-bold text-[8.5px]">{s.raw?.result_current || '—'}</td>
                                <td className="border border-slate-900 p-1 text-center align-bottom text-[7.5px]">
                                  <div className="border-t border-slate-900 pt-0.5">Signature</div>
                                </td>
                                <td className="border border-slate-900 p-1 text-[7.5px] leading-tight">
                                  <div className="flex justify-between gap-1 h-full">
                                    <div className="flex-1 border-r border-dashed border-slate-300 pr-1">
                                      <div className="font-bold text-[7px]">Marks Card Received</div>
                                      <div className="mt-1.5 text-[7px]">Sig. __________</div>
                                    </div>
                                    <div className="flex-1 pl-1">
                                      <div className="font-bold text-[7px]">Qual. Certificate</div>
                                      <div className="mt-1.5 text-[7px]">Sig. __________</div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Signatures */}
                    <div className="flex justify-between items-center mt-1 pt-0.5 text-[11px] font-black text-red-800">
                      <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Incharge</div>
                      <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Checked By</div>
                      <div className="text-center w-32 border-t-2 border-red-800 pt-0.5">Principal</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ASSIGN IDs (BULK SEQUENTIAL + INHERITANCE ENGINE)        */}
          {/* ============================================================== */}
          {activeTab === 'assign_ids' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
              {/* Compact Control Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <CreditCard size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Bulk Assign Admission Numbers
                    </h2>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Auto-numbering & Board Reg No inheritance with direct Firestore sync.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAssignStartId(calculatedNextAdmNo)}
                    className="py-1 px-2 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                    title="Auto-calculate next available Admission Number from database"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Next ({calculatedNextAdmNo})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAssignIds}
                    disabled={assigningIds || candidateIdPreviewList.length === 0}
                    className="py-1 px-3 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs active:scale-95"
                  >
                    {assigningIds ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Assign IDs ({candidateIdPreviewList.length})</span>
                  </button>
                </div>
              </div>

              {/* Compact Filter Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                {/* Session */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Session:</span>
                  <select
                    value={assignSessionFilter}
                    onChange={(e) => setAssignSessionFilter(e.target.value)}
                    className="py-0.5 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                {/* Target Classes Toggle Pills */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Classes:</span>
                  <div className="flex items-center gap-0.5">
                    {availableClasses.map(cls => {
                      const checked = assignClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => {
                            if (checked) setAssignClasses(prev => prev.filter(c => c !== cls));
                            else setAssignClasses(prev => [...prev, cls]);
                          }}
                          className={`py-0.5 px-2 rounded text-[10.5px] font-extrabold cursor-pointer border transition-all ${
                            checked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start From ID */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-semibold text-[10.5px]">Start ID:</span>
                  <input
                    type="number"
                    value={assignStartId}
                    onChange={(e) => setAssignStartId(e.target.value)}
                    className="w-20 py-0.5 px-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-center"
                  />
                </div>

                {/* Only Missing Checkbox */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white dark:bg-slate-900 py-0.5 px-2 rounded-md border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={onlyMissingAdmNo}
                    onChange={(e) => setOnlyMissingAdmNo(e.target.checked)}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <span className="text-[10.5px]">Only Missing Adm No</span>
                  <span className="ml-1 px-1 py-0.2 rounded font-mono font-black text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950">
                    {candidateIdPreviewList.length}
                  </span>
                </label>
              </div>

              {/* High Density Candidate Preview Table */}
              {candidateIdPreviewList.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-1.5 px-2 w-10 text-center">#</th>
                          <th className="py-1.5 px-2 min-w-44">Student & Father's Name</th>
                          <th className="py-1.5 px-2">Class (Session)</th>
                          <th className="py-1.5 px-2">Board Reg. No.</th>
                          <th className="py-1.5 px-2">Previous Adm. No.</th>
                          <th className="py-1.5 px-2 text-center">Current Adm No</th>
                          <th className="py-1.5 px-2 text-center">Strategy</th>
                          <th className="py-1.5 px-2 text-right">Proposed ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {candidateIdPreviewList.map((item, idx) => {
                          const { student, currentAdm, prevInfo, strat, proposed } = item;
                          return (
                            <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                              <td className="py-1 px-2 text-center font-bold text-slate-400 ledger-mono-font">{idx + 1}</td>
                              <td className="py-1 px-2">
                                <div className="font-extrabold text-slate-900 dark:text-white leading-tight">{student.name}</div>
                                <div className="text-[10px] text-slate-500">S/O: {student.father || '—'}</div>
                              </td>
                              <td className="py-1 px-2 font-bold text-indigo-600 dark:text-indigo-400">
                                {student.class} <span className="text-[10px] text-slate-400">({student.session})</span>
                              </td>
                              <td className="py-1 px-2 font-mono text-[10.5px] ledger-mono-font">{student.boardReg || '—'}</td>
                              <td className="py-1 px-2 font-mono text-[10.5px]">
                                {prevInfo ? (
                                  <span className="px-1.5 py-0.5 rounded font-black text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                                    {prevInfo.admNo} ({prevInfo.class})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-1 px-2 text-center font-mono ledger-mono-font text-slate-600 dark:text-slate-400">{currentAdm || '—'}</td>
                              <td className="py-1 px-2 text-center">
                                <div className="inline-flex rounded-md p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'assign_new' }))}
                                    className={`px-1.5 py-0.5 text-[9.5px] font-black rounded cursor-pointer transition-all ${
                                      strat === 'assign_new' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Sequential
                                  </button>
                                  {prevInfo && (
                                    <button
                                      type="button"
                                      onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'inherit_prev' }))}
                                      className={`px-1.5 py-0.5 text-[9.5px] font-black rounded cursor-pointer transition-all ${
                                        strat === 'inherit_prev' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      Inherit
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setAssignStrategies(prev => ({ ...prev, [student.id]: 'skip' }))}
                                    className={`px-1.5 py-0.5 text-[9.5px] font-black rounded cursor-pointer transition-all ${
                                      strat === 'skip' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>
                              </td>
                              <td className="py-1 px-2 text-right font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs">
                                {proposed}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 font-semibold border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                  No students match the selected class scope and missing admission number filter.
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: ASSIGN DATES (BULK ADM & SUBMISSION DATE ASSIGNER)       */}
          {/* ============================================================== */}
          {activeTab === 'assign_dates' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
              {/* Compact Control Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <Calendar size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      Bulk Assign Admission & Submission Dates
                    </h2>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      Apply uniform Admission Date or Online Submission Date across target classes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRunAssignDates}
                  disabled={assigningDates || dateTargetStudents.length === 0}
                  className="py-1 px-3 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all text-xs active:scale-95"
                >
                  {assigningDates ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  <span>Apply Date ({dateTargetStudents.length} Students)</span>
                </button>
              </div>

              {/* Compact Form Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Target Field:</label>
                  <select
                    value={assignDateField}
                    onChange={(e) => setAssignDateField(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                  >
                    <option value="admDate">Admission Date (Adm. Date)</option>
                    <option value="onlineSubmDate">Online Submission Date</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10.5px] font-bold text-slate-500">Select Date:</label>
                    <button
                      type="button"
                      onClick={() => setAssignDateValue(new Date().toISOString().split('T')[0])}
                      className="text-[9.5px] text-indigo-600 hover:underline cursor-pointer font-bold"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    value={assignDateValue}
                    onChange={(e) => setAssignDateValue(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Session Scope:</label>
                  <select
                    value={assignDateSession}
                    onChange={(e) => setAssignDateSession(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer text-indigo-700 dark:text-indigo-300"
                  >
                    {availableSessions.map(sess => (
                      <option key={sess} value={sess}>{sess}</option>
                    ))}
                    <option value="ALL">All Sessions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 mb-0.5">Class Scope:</label>
                  <select
                    value={assignDateClass}
                    onChange={(e) => setAssignDateClass(e.target.value)}
                    className="w-full py-1 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                  >
                    <option value="ALL">All Classes</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Records Table Preview */}
              {dateTargetStudents.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-black text-slate-700 dark:text-slate-300 text-[11px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-1 px-2 w-10 text-center">#</th>
                          <th className="py-1 px-2">Student Name</th>
                          <th className="py-1 px-2">Father's Name</th>
                          <th className="py-1 px-2">Class</th>
                          <th className="py-1 px-2">Roll No.</th>
                          <th className="py-1 px-2">Current Date</th>
                          <th className="py-1 px-2 text-right text-indigo-600">New Date to Apply</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {dateTargetStudents.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="py-1 px-2 text-center font-bold text-slate-400 ledger-mono-font">{idx + 1}</td>
                            <td className="py-1 px-2 font-bold">{st.name}</td>
                            <td className="py-1 px-2 text-slate-500">{st.father}</td>
                            <td className="py-1 px-2 font-bold text-indigo-600">{st.class}</td>
                            <td className="py-1 px-2 font-mono ledger-mono-font">{st.rollNo || '—'}</td>
                            <td className="py-1 px-2 font-mono text-slate-500 ledger-mono-font">
                              {assignDateField === 'admDate' ? (st.admDate || '—') : (st.onlineStatus || '—')}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 ledger-mono-font">
                              {assignDateValue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-slate-500 font-semibold border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                  No students match the selected session and class scope.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Floating Notification & Action Bar when Custom Layout is Modified */}
      {isLayoutModified && (
        <div className="no-print fixed bottom-5 right-5 z-[120] bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-amber-500/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
            <SlidersHorizontal size={14} className="text-amber-400" />
            <span>Table Layout Modified</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveLayoutToFirebase}
              disabled={savingLayout}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-50"
              title="Save custom column widths and row height to Firebase default"
            >
              {savingLayout ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Set to Default (Firebase)</span>
            </button>
            <button
              type="button"
              onClick={handleResetLayoutToOriginal}
              className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Reset columns and row heights to original factory format"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
