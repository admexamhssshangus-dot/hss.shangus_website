import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, PieChart, Printer, Download, X, Filter, Users, CheckCircle2, Sparkles, BookOpen, Layers, ShieldCheck, FileSpreadsheet, ChevronDown, CheckSquare, Square } from 'lucide-react';

import { normalizeClassVal, normalizeSessionVal } from './AdvancedReports';

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
    <div className="relative text-left flex-1 sm:flex-none" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-2xs ${
          !isAllSelected
            ? 'bg-amber-700 text-white border border-amber-800'
            : 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:bg-slate-50'
        }`}
      >
        <span className="truncate max-w-[130px] sm:max-w-[150px] font-black text-left">{displayText}</span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-52 max-w-[calc(100vw-32px)] rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl z-50 p-2 space-y-1.5 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
          <div className="flex items-center justify-between px-1 py-0.5 border-b border-slate-200 dark:border-slate-800 text-xs font-black gap-1">
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-black truncate flex-1">{label}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-1.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 text-[10px] font-black cursor-pointer transition-colors shadow-2xs"
              >
                All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-1.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 hover:bg-rose-200 text-[10px] font-black cursor-pointer transition-colors shadow-2xs"
              >
                None
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 py-0.5">
            {options.map((opt, idx) => {
              const checked = isAllSelected || (selected.includes(opt) && !isNoneSelected);
              return (
                <button
                  key={`${opt}_${idx}`}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare size={14} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  ) : (
                    <Square size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
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

export default function AnalyticsSuiteModal({ isOpen, onClose, students = [] }) {
  // Filter States matching the user's reference layout
  const [analysisMode, setAnalysisMode] = useState('enrollment'); // Default: 'enrollment' (Class Enrollment Summary)
  const [selectedSessions, setSelectedSessions] = useState([]); // Default: All sessions
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedGenders, setSelectedGenders] = useState([]);
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]); // Default: All statuses

  // Batch Report Generation States
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [selectedBatchModes, setSelectedBatchModes] = useState(['enrollment', 'roll_stmt', 'stream_gender', 'subject']);

  const REPORT_MODES = [
    { id: 'enrollment', label: 'Class Enrollment Summary' },
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

  // Helper to test if a field value is a valid unique identifier (excluding placeholders like '0', '1', 'n/a', 'none')
  // Helper to extract assigned Class Roll No cell value across all possible database keys
  const getAssignedRollNo = (s) => {
    if (!s) return '';
    const keys = [
      'Class Roll No', 'Class Roll No.', 'RL. NO.', 'RL. NO', 
      'Class R.No.', 'Class R.No', 'Class R. No.', 'Class R. No', 
      'classRollNo', 'rollNo', 'Roll No.', 'Roll No', 'roll'
    ];
    for (const k of keys) {
      if (s[k] !== undefined && s[k] !== null) {
        const val = String(s[k]).trim();
        if (val && !/^(N\/A|—|-|null|undefined)$/i.test(val)) {
          return val;
        }
      }
    }
    return '';
  };

  // Helper to test if a field value is a valid unique identifier (excluding placeholders like '0', '1', 'n/a', 'none')
  const isValidUniqueVal = (val) => {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return (
      str !== '' &&
      str !== '0' &&
      str !== '1' &&
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
    if (!Array.isArray(students) || students.length === 0) return [];
    const map = new Map();

    // Helper: detect bogus/dummy reg numbers (e.g. 2301000000000000 or 230101e15)
    const isValidRegNoA = (reg) => {
      if (!reg || reg.length < 6) return false;
      if (/[eE]/.test(reg)) return false; // reject scientific notation (e.g. 230101e15, 2301e15)
      if (/0{5,}$/.test(reg)) return false; // ends in 5+ zeros
      const zeros = (reg.match(/0/g) || []).length;
      if (zeros / reg.length >= 0.75) return false; // 75%+ zeros = dummy
      return true;
    };

    // Sort: directly-approved (has roll no on document) FIRST, then newest form number
    // This guarantees the admin-approved form wins when a student submitted multiple forms
    const sorted = [...students].sort((x, y) => {
      const hasRollX = isValidUniqueVal(getAssignedRollNo(x));
      const hasRollY = isValidUniqueVal(getAssignedRollNo(y));
      if (hasRollX && !hasRollY) return -1;
      if (!hasRollX && hasRollY) return 1;
      const fA = parseInt(String(x.formNo || x['Form No'] || x['Form Number'] || '0').replace(/\D/g, ''), 10) || 0;
      const fB = parseInt(String(y.formNo || y['Form No'] || y['Form Number'] || '0').replace(/\D/g, ''), 10) || 0;
      return fB - fA;
    });

    // Multi-key seen map: tracks identity signals (key -> { roll, name, formNo })
    const seenMap = new Map();

    sorted.forEach((s, idx) => {
      const formNo = String(s['Form No'] || s['Form Number'] || s['Form No.'] || s.formNo || s['F.NO.'] || '').trim();
      const regNoRaw = String(s['Board Registration Number'] || s['Board Reg. No.'] || s.boardRegNo || s.regNo || s['REG. NO.'] || '').trim();
      const regNo = isValidRegNoA(regNoRaw.replace(/[^a-z0-9]/gi, '').toLowerCase()) ? regNoRaw : '';
      const rollNo = getAssignedRollNo(s);
      const sClass = normalizeClassVal(s.class || s.Class || s['Class'] || s['Admission sought for class']);
      const sSession = normalizeSessionVal(s.Session || s.session || s['Session']);
      const docId = String(s.id || s.docId || '').trim();

      const sName = String(s['Candidate Name'] || s.name || s.studentName || s["Student's Name (as per school records)"] || s['STUDENT\'S NAME'] || s.Name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const fName = String(s['Father Name'] || s.fatherName || s["Father's/Guardian's Name (as per school records)"] || s['FATHER\'S NAME'] || s.FatherName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      const scope = `${sSession}_${sClass}`;
      let isDuplicate = false;

      const primaryKey = `item_${docId || formNo || sName || Math.random()}_${idx}`;
      map.set(primaryKey, s);
    });

    return Array.from(map.values());
  }, [students]);

  // Helper to determine effective status (Approved = Class Roll No assigned in student roll no cell)
  const getEffectiveStatus = (s) => {
    if (s && s.status && String(s.status).trim() !== '—') {
      const st = String(s.status).trim();
      if (st.toLowerCase().includes('appr')) return 'Approved';
      if (st.toLowerCase().includes('subm')) return 'Submitted';
      if (st.toLowerCase().includes('dft') || st.toLowerCase().includes('draft')) return 'Draft';
      if (st.toLowerCase().includes('rejt') || st.toLowerCase().includes('reject')) return 'Rejected';
    }
    // Approved means assigned class roll no present in student roll cell
    const rollVal = getAssignedRollNo(s);
    const hasValidRoll = isValidUniqueVal(rollVal);

    if (hasValidRoll) {
      return 'Approved';
    }

    const rawStatus = String(s.Status || s.status || s['Status'] || '').trim().toLowerCase();

    if (rawStatus === 'draft' || rawStatus.includes('dft')) return 'Draft';
    if (rawStatus.includes('reject') || rawStatus.includes('rejt')) return 'Rejected';

    return 'Submitted';
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

  // Helper to normalize subject codes and abbreviations
  const normalizeSubjectName = (name, studentClass = '') => {
    if (!name) return '';
    const str = String(name).trim();
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
    if (upper === 'EVS' || upper === 'ENV' || upper.includes('ENVIRON')) {
      return 'Environmental Science';
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

    return str;
  };

  // Robust helper to extract & normalize array of subjects from any student record format (string/array, +, &, comma, slash, etc.)
  const extractSubjectList = (s) => {
    const stClass = s.class || s.Class || s['Class'] || s['Admission sought for class'] || '';
    const raw = s.subjects || s['Subjects'] || s.subject_combination || s['Subject Combination'] || s.Subject || s.subs || '';
    let parts = [];

    if (Array.isArray(raw)) {
      parts = raw;
    } else if (typeof raw === 'string' && raw.trim() && raw.trim() !== '—' && raw.trim() !== '-') {
      parts = raw.split(/[,•\n/+&]+/);
    }

    const list = [];
    parts.forEach((p) => {
      const clean = String(p).trim();
      if (clean && clean !== '—' && clean !== '-' && clean.length > 1) {
        const norm = normalizeSubjectName(clean, stClass);
        if (norm && norm !== '—' && norm !== '-' && norm.length > 1) {
          list.push(norm);
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
    const list = Array.from(set);

    // Sort: Regular annual sessions first (e.g. 2025-26, 2024-25), Bi-Annual (BIAN) sessions after
    list.sort((a, b) => {
      const aIsBian = a.toUpperCase().includes('BIAN') || a.toUpperCase().includes('BI-ANNUAL');
      const bIsBian = b.toUpperCase().includes('BIAN') || b.toUpperCase().includes('BI-ANNUAL');

      if (aIsBian && !bIsBian) return 1;
      if (!aIsBian && bIsBian) return -1;

      return b.localeCompare(a, undefined, { numeric: true });
    });

    return list.length > 0 ? list : ['2025-26', '2024-25'];
  }, [deduplicatedStudents]);

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
      if (selectedStatuses.length > 0 && !selectedStatuses.includes('__NONE__')) {
        const matchesStatus = selectedStatuses.some((st) => {
          if (st === 'Approved' || st.includes('Approved')) return effStatus === 'Approved';
          if (st === 'Submitted' || st.includes('Submitted')) return effStatus === 'Submitted';
          if (st === 'Draft' || st.includes('Draft')) return effStatus === 'Draft';
          if (st === 'Rejected' || st.includes('Rejected')) return effStatus === 'Rejected';
          return effStatus.toLowerCase() === st.toLowerCase();
        });
        if (!matchesStatus) return false;
      }

      // 1. Session Filter (Normalized EN-DASH / HYPHEN matching)
      const rawSes = String(s.Session || s.session || s['Session'] || '2025-26').trim();
      const normSes = rawSes.replace(/–/g, '-').replace(/—/g, '-').toLowerCase();
      if (selectedSessions.length > 0 && !selectedSessions.includes('__NONE__')) {
        const matchesSes = selectedSessions.some((sel) => {
          const normSel = String(sel).trim().replace(/–/g, '-').replace(/—/g, '-').toLowerCase();
          return normSes === normSel;
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

      const stClass = String(s.class || s.Class || s['Class'] || s['Admission sought for class'] || 'Class N/A').trim();
      const stStream = resolveStream(s);
      const stStatus = getEffectiveStatus(s);

      if (stStatus === 'Approved') approvedCount++;
      else if (stStatus === 'Submitted') submittedCount++;
      else if (stStatus === 'Draft') draftCount++;

      // Subject Aggregation
      const subList = extractSubjectList(s);
      subList.forEach((subName) => {
        const normSub = String(subName).toLowerCase();
        const isFlexible = (
          normSub.includes('english') ||
          normSub.includes('physical education') ||
          normSub.includes('math') ||
          normSub.includes('it') ||
          normSub.includes('healthcare') ||
          normSub.includes('environmental')
        );
        const resolvedSubjStream = isFlexible ? 'Science / Humanities' : stStream;

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
      const regNo = s['Board Registration Number'] || s.boardRegNo || s.regNo;
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

  // Handle Clean PDF Export (HTML Window Print)
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Please allow popups to generate the PDF print report.');
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
            <td><strong>Class ${c.className}</strong></td>
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

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Handle Clean Excel / CSV Export
  const handleExportExcel = () => {
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
        csvRows.push([idx + 1, `Class ${c.className}`, c.approved, c.submitted, c.draft, c.male, c.female, c.total]);
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

  // Batch PDF Print Generator (Multi-Report Packet)
  const handleBatchPDFPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Please allow popups to generate the batch PDF packet.');
      return;
    }

    const modeTitles = {
      enrollment: 'Class-wise Admission & Enrollment Summary',
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
                <td><strong>${c.className}</strong></td>
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
                    <td><strong>${r.className} (${r.stream})</strong></td>
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
                  <td style="color:#4f46e5;">COMBINED ${grp.className.toUpperCase()} TOTAL (${grp.items.length} ${grp.items.length === 1 ? 'STREAM' : 'STREAMS'})</td>
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

    printWindow.document.write(`
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
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
          csvContent += `"${idx + 1}","${c.className}","${c.approved}","${c.submitted}","${c.draft}","${c.male}","${c.female}","${c.total}"\n`;
        });
        csvContent += `SUMMARY TOTALS,All Classes,"${stats.approvedCount}","${stats.submittedCount}","${stats.draftCount}","${stats.maleCount}","${stats.femaleCount}","${stats.totalStudents}"\n\n`;
      } else if (mode === 'roll_stmt') {
        csvContent += '--- CLASS ROLL STATEMENT & CANDIDATE SUMMARY ---\n';
        csvContent += '#,Class & Stream Bracket,Assigned Roll Range,Male (M),Female (F),Board Reg. Count,Total Candidates\n';
        classGroupedRollStmts.forEach((grp) => {
          grp.items.forEach((r) => {
            csvContent += `"${r.globalIdx}","${r.className} (${r.stream})","${r.rollRange}","${r.male}","${r.female}","${r.regCount}","${r.total}"\n`;
          });
          csvContent += `COMBINED TOTAL,${grp.className} (${grp.items.length} STREAMS),All Streams Combined,"${grp.male}","${grp.female}","${grp.regCount}","${grp.total}"\n`;
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

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-1.5 sm:p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-6xl w-full p-3 sm:p-6 shadow-2xl border border-slate-300 dark:border-slate-800 space-y-3 sm:space-y-4 max-h-[94vh] sm:max-h-[92vh] flex flex-col my-auto">
        {/* Top Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 sm:pb-3 gap-2">
          <div>
            <h2 className="text-sm sm:text-lg font-black flex items-center gap-1.5 sm:gap-2 text-slate-900 dark:text-white tracking-tight">
              <BarChart2 size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>Analytics & Statistical Reports Suite</span>
            </h2>
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Comprehensive enrollment analysis, subject counts, and gender breakdown across all sessions.
            </p>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap flex-shrink-0">
            {/* Batch Auto-Generate Button & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBatchMenu(!showBatchMenu)}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                title="Auto-generate and download multiple report types at once"
              >
                <Sparkles size={14} />
                <span className="text-[11px] sm:text-xs">Batch Auto-Generate</span>
                <ChevronDown size={12} className={`transition-transform ${showBatchMenu ? 'rotate-180' : ''}`} />
              </button>

              {showBatchMenu && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100000] p-3 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Select Reports to Generate</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBatchModes.length === REPORT_MODES.length) setSelectedBatchModes([]);
                        else setSelectedBatchModes(REPORT_MODES.map((m) => m.id));
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {selectedBatchModes.length === REPORT_MODES.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {REPORT_MODES.map((mode) => (
                      <label
                        key={mode.id}
                        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs text-slate-700 dark:text-slate-200 font-bold transition-colors"
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

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleBatchPDFPrint();
                        setShowBatchMenu(false);
                      }}
                      disabled={selectedBatchModes.length === 0}
                      className="w-full py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>Batch PDF Packet ({selectedBatchModes.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleBatchExcelExport();
                        setShowBatchMenu(false);
                      }}
                      disabled={selectedBatchModes.length === 0}
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <FileSpreadsheet size={13} />
                      <span>Batch Excel File ({selectedBatchModes.length})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handlePrintPDF}
              className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs text-white bg-indigo-700 hover:bg-indigo-600 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer size={14} />
              <span className="text-[11px] sm:text-xs">Print PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-black text-xs text-white bg-emerald-700 hover:bg-emerald-600 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <FileSpreadsheet size={14} />
              <span className="text-[11px] sm:text-xs">Export Excel</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 6-Filter Interactive Toolbar (Exact Match to User Reference Screenshot) */}
        <div className="bg-slate-100 dark:bg-slate-950 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 sm:gap-2 flex-wrap shadow-inner">
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 pr-1 border-r border-slate-300 dark:border-slate-700 flex-shrink-0">
            <Filter size={12} className="text-indigo-600" />
            <span>Filters:</span>
          </div>

          {/* 1. Report Mode Selector */}
          <select
            value={analysisMode}
            onChange={(e) => setAnalysisMode(e.target.value)}
            className="w-full sm:w-auto p-1.5 sm:p-2 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs cursor-pointer min-w-[150px]"
          >
            <option value="subject">Subject-wise Analysis</option>
            <option value="stream_gender">Stream & Gender Breakdown</option>
            <option value="roll_stmt">Roll Statement (Roll Stmt)</option>
            <option value="enrollment">Class Enrollment Summary</option>
          </select>

          {/* 1.5 Form Status Multi-Select Checkbox Dropdown */}
          <MultiSelectDropdown
            label="Form Status"
            customAllLabel="All Form Statuses"
            options={['Approved', 'Submitted', 'Draft', 'Rejected']}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />

          {/* 2. Session Multi-Select Checkbox Dropdown */}
          <MultiSelectDropdown
            label="Sessions"
            options={availableSessions}
            selected={selectedSessions}
            onChange={setSelectedSessions}
          />

          {/* 3. Class Multi-Select Checkbox Dropdown */}
          <MultiSelectDropdown
            label="Classes"
            options={availableClasses}
            selected={selectedClasses}
            onChange={setSelectedClasses}
          />

          {/* 4. Gender Multi-Select Checkbox Dropdown */}
          <MultiSelectDropdown
            label="Genders"
            options={availableGenders}
            selected={selectedGenders}
            onChange={setSelectedGenders}
          />

          {/* 5. Stream Multi-Select Checkbox Dropdown */}
          <MultiSelectDropdown
            label="Streams"
            options={availableStreams}
            selected={selectedStreams}
            onChange={setSelectedStreams}
          />

          {/* 6. Subject Multi-Select Checkbox Dropdown */}
          <MultiSelectDropdown
            label="Subjects"
            options={availableSubjects}
            selected={selectedSubjects}
            onChange={setSelectedSubjects}
          />
        </div>

        {/* Executive Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Total Enrolled</span>
            <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users size={16} className="text-indigo-600" />
              <span>{stats.totalStudents}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Male Strength</span>
            <div className="text-xl font-black text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <span>{stats.maleCount}</span>
              <span className="text-xs font-bold text-slate-500">
                ({stats.totalStudents > 0 ? ((stats.maleCount / stats.totalStudents) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Female Strength</span>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span>{stats.femaleCount}</span>
              <span className="text-xs font-bold text-slate-500">
                ({stats.totalStudents > 0 ? ((stats.femaleCount / stats.totalStudents) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1">
            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Top Enrolled Subject</span>
            <div className="text-sm font-black text-amber-600 dark:text-amber-400 truncate" title={stats.topSubject}>
              {stats.topSubject}
            </div>
          </div>
        </div>

        {/* Main Analytics Data Table View */}
        <div className="overflow-y-auto flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm pr-1">
          <table className="w-full text-left text-xs font-bold border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
              {analysisMode === 'subject' && (
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Subject Name</th>
                  <th className="p-3">Dominant Stream</th>
                  {showMaleCol && <th className="p-3 text-center">Male (M)</th>}
                  {showFemaleCol && <th className="p-3 text-center">Female (F)</th>}
                  <th className="p-3 text-center">Total Enrolled</th>
                  <th className="p-3 text-right">% Class Share</th>
                </tr>
              )}

              {analysisMode === 'stream_gender' && (
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Stream Bracket</th>
                  {showMaleCol && <th className="p-3 text-center">Male Candidates</th>}
                  {showFemaleCol && <th className="p-3 text-center">Female Candidates</th>}
                  <th className="p-3 text-center">Total Strength</th>
                  <th className="p-3 text-right">Gender Split (M / F)</th>
                </tr>
              )}

              {analysisMode === 'roll_stmt' && (
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Class & Stream Bracket</th>
                  <th className="p-3">Assigned Roll Range</th>
                  {showMaleCol && <th className="p-3 text-center">Male (M)</th>}
                  {showFemaleCol && <th className="p-3 text-center">Female (F)</th>}
                  <th className="p-3 text-center">Board Reg. Count</th>
                  <th className="p-3 text-right">Total Candidates</th>
                </tr>
              )}

              {analysisMode === 'enrollment' && (
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Class Bracket</th>
                  {showApprovedCol && <th className="p-3 text-center">Approved</th>}
                  {showSubmittedCol && <th className="p-3 text-center">Submitted</th>}
                  {showDraftCol && <th className="p-3 text-center">Draft</th>}
                  {showMaleCol && <th className="p-3 text-center">Male (M)</th>}
                  {showFemaleCol && <th className="p-3 text-center">Female (F)</th>}
                  <th className="p-3 text-right">Total Strength</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {analysisMode === 'subject' &&
                stats.sortedSubjects.map((sub, idx) => {
                  const share = stats.totalStudents > 0 ? ((sub.total / stats.totalStudents) * 100).toFixed(1) : '0';
                  return (
                    <tr key={sub.name} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">{sub.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px]">
                          {sub.stream}
                        </span>
                      </td>
                      {showMaleCol && <td className="p-3 text-center text-sky-600 font-black">{sub.male}</td>}
                      {showFemaleCol && <td className="p-3 text-center text-rose-600 font-black">{sub.female}</td>}
                      <td className="p-3 text-center font-black text-slate-900 dark:text-white">{sub.total}</td>
                      <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">{share}%</td>
                    </tr>
                  );
                })}

              {analysisMode === 'stream_gender' &&
                stats.sortedStreams.map((stm, idx) => {
                  const mPct = stm.total > 0 ? ((stm.male / stm.total) * 100).toFixed(1) : '0';
                  const fPct = stm.total > 0 ? ((stm.female / stm.total) * 100).toFixed(1) : '0';
                  return (
                    <tr key={stm.name} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">{stm.name}</td>
                      {showMaleCol && <td className="p-3 text-center text-sky-600 font-black">{stm.male}</td>}
                      {showFemaleCol && <td className="p-3 text-center text-rose-600 font-black">{stm.female}</td>}
                      <td className="p-3 text-center font-black text-slate-900 dark:text-white">{stm.total}</td>
                      <td className="p-3 text-right font-black">
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
                        <td className="p-3 text-center text-slate-400 font-mono">{r.globalIdx}</td>
                        <td className="p-3 font-black text-slate-900 dark:text-white">{r.key}</td>
                        <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">{r.rollRange}</td>
                        {showMaleCol && <td className="p-3 text-center text-sky-600 font-black">{r.male}</td>}
                        {showFemaleCol && <td className="p-3 text-center text-rose-600 font-black">{r.female}</td>}
                        <td className="p-3 text-center font-bold">{r.regCount}</td>
                        <td className="p-3 text-right font-black text-slate-900 dark:text-white">{r.total}</td>
                      </tr>
                    ))}

                    {/* Combined Class Subtotal Row */}
                    {grp.items.length > 1 && (
                      <tr className="bg-indigo-50/80 dark:bg-indigo-950/40 font-black text-indigo-950 dark:text-indigo-200 border-t border-b border-indigo-200 dark:border-indigo-800">
                        <td className="p-2.5 text-center text-indigo-600 font-mono text-[11px]">∑</td>
                        <td className="p-2.5 font-black uppercase text-[11px] text-indigo-900 dark:text-indigo-300">
                          Combined {grp.className} Class Total ({grp.items.length} Streams)
                        </td>
                        <td className="p-2.5 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">All Streams Combined</td>
                        {showMaleCol && <td className="p-2.5 text-center text-sky-700 dark:text-sky-400 font-black">{grp.male}</td>}
                        {showFemaleCol && <td className="p-2.5 text-center text-rose-700 dark:text-rose-400 font-black">{grp.female}</td>}
                        <td className="p-2.5 text-center font-black">{grp.regCount}</td>
                        <td className="p-2.5 text-right font-black text-indigo-900 dark:text-indigo-200">{grp.total}</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

              {analysisMode === 'enrollment' &&
                stats.sortedClasses.map((c, idx) => (
                  <tr key={c.className} className="hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-black text-slate-900 dark:text-white">Class {c.className}</td>
                    {showApprovedCol && <td className="p-3 text-center text-emerald-600 font-black">{c.approved}</td>}
                    {showSubmittedCol && <td className="p-3 text-center text-amber-600 font-black">{c.submitted}</td>}
                    {showDraftCol && <td className="p-3 text-center text-slate-500 font-black">{c.draft}</td>}
                    {showMaleCol && <td className="p-3 text-center text-sky-600 font-black">{c.male}</td>}
                    {showFemaleCol && <td className="p-3 text-center text-rose-600 font-black">{c.female}</td>}
                    <td className="p-3 text-right font-black text-slate-900 dark:text-white">{c.total}</td>
                  </tr>
                ))}

              {stats.totalStudents === 0 && (
                <tr>
                  <td colSpan={
                    analysisMode === 'enrollment' ? enrollmentColsCount :
                    analysisMode === 'roll_stmt' ? rollStmtColsCount :
                    analysisMode === 'stream_gender' ? streamGenderColsCount : subjectColsCount
                  } className="p-8 text-center text-slate-500 font-bold">
                    No student records match the active filter criteria.
                  </td>
                </tr>
              )}
            </tbody>

            {stats.totalStudents > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 shadow-md">
                {analysisMode === 'enrollment' && (
                  <tr>
                    <td colSpan="2" className="p-3 uppercase">Summary Totals</td>
                    {showApprovedCol && <td className="p-3 text-center text-emerald-600 font-black">{stats.approvedCount}</td>}
                    {showSubmittedCol && <td className="p-3 text-center text-amber-600 font-black">{stats.submittedCount}</td>}
                    {showDraftCol && <td className="p-3 text-center text-slate-500 font-black">{stats.draftCount}</td>}
                    {showMaleCol && <td className="p-3 text-center text-sky-600 font-black">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="p-3 text-center text-rose-600 font-black">{stats.femaleCount}</td>}
                    <td className="p-3 text-right font-black text-slate-900 dark:text-white">{stats.totalStudents}</td>
                  </tr>
                )}

                {analysisMode === 'subject' && (
                  <tr>
                    <td colSpan="3" className="p-3 uppercase">Summary Totals</td>
                    {showMaleCol && <td className="p-3 text-center text-sky-600">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="p-3 text-center text-rose-600">{stats.femaleCount}</td>}
                    <td className="p-3 text-center font-black">{stats.totalStudents}</td>
                    <td className="p-3 text-right font-black">100%</td>
                  </tr>
                )}

                {analysisMode === 'stream_gender' && (
                  <tr>
                    <td colSpan="2" className="p-3 uppercase">Summary Totals</td>
                    {showMaleCol && <td className="p-3 text-center text-sky-600">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="p-3 text-center text-rose-600">{stats.femaleCount}</td>}
                    <td className="p-3 text-center font-black">{stats.totalStudents}</td>
                    <td className="p-3 text-right font-black">100%</td>
                  </tr>
                )}

                {analysisMode === 'roll_stmt' && (
                  <tr>
                    <td colSpan="3" className="p-3 uppercase">Summary Totals</td>
                    {showMaleCol && <td className="p-3 text-center text-sky-600">{stats.maleCount}</td>}
                    {showFemaleCol && <td className="p-3 text-center text-rose-600">{stats.femaleCount}</td>}
                    <td className="p-3 text-center font-black">{stats.regCount}</td>
                    <td className="p-3 text-right font-black text-slate-900 dark:text-white">{stats.totalStudents}</td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}
