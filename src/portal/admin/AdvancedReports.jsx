import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, Wrench, Columns, Printer, Check, X, Play, ChevronDown, CheckSquare, Square, FileSpreadsheet, Maximize2, Settings, Hash, Layers, Mail, CreditCard, Camera, Upload, Image as ImageIcon, Download, Copy, Save, RotateCcw, Lock, LogOut, Unlock, Eye, History, Key, MessageSquare, AlertOctagon, Trash2, CheckCircle2, ClipboardCheck, CalendarCheck, Edit3, UserCheck, User, BookOpen, Landmark, CheckCircle, Loader2, PlusCircle, ShieldCheck } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { invalidateCache, updateCachedItem, getCachedCollectionSync } from '../../services/dbCache';
import { compressImageFile, parsePhotoFilename } from '../../utils/imageCompressor';
import ApplicationReviewModal from './ApplicationReviewModal';
import DirectIngestionModal from './DirectIngestionModal';
import ConfirmDialogModal from '../components/ConfirmDialogModal';
import { logAdminActivity } from '../../services/adminActivityLogger';
import { generateStudentAdmissionPdf } from '../../utils/pdfGenerator';

// ─── Reusable Multi-Select Checkbox Dropdown Component ───
function MultiSelectCheckboxDropdown({ label, options = [], selected = [], onChange, align = 'left' }) {
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
    ? `All ${label}`
    : isNoneSelected
    ? `No ${label}`
    : selected.length === 1
    ? selected[0]
    : `${label} (${selected.length})`;

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-2 py-1 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-between gap-1 transition-all cursor-pointer shadow-sm ${
          !isAllSelected
            ? 'bg-amber-700 text-white border border-amber-800'
            : 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:bg-slate-50'
        }`}
      >
        <span className="truncate flex-1 min-w-0 text-left">{displayText}</span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-48 sm:w-52 max-w-[calc(100vw-32px)] rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl z-50 p-2 space-y-1.5 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
          <div className="flex items-center justify-between px-1 py-0.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black gap-1">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider font-extrabold truncate flex-1 min-w-0">{label}</span>
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

          <div className="max-h-44 overflow-y-auto space-y-0.5 py-0.5">
            {options.map((opt, idx) => {
              const checked = isAllSelected || (selected.includes(opt) && !isNoneSelected);
              return (
                <button
                  key={`${opt}_${idx}`}
                  type="button"
                  onClick={() => toggleOption(opt)}
                  className="w-full flex items-center gap-2 px-1.5 py-1 rounded-lg text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
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

// ─── Unified Filters Group Dropdown (Grouped Classes, Gender, Stream, Status, Session) ───
function UnifiedFiltersGroupDropdown({
  viewScope,
  availableSessions,
  selectedSessions,
  setSelectedSessions,
  availableClasses,
  selectedClasses,
  setSelectedClasses,
  availableGenders,
  selectedGenders,
  setSelectedGenders,
  availableStreams,
  selectedStreams,
  setSelectedStreams,
  availableStatuses,
  selectedStatuses,
  setSelectedStatuses,
  sortBy = 'classRollNo',
  setSortBy,
  sortOrder = 'asc',
  setSortOrder,
  setCurrentPage
}) {
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

  const totalActiveFilters = 
    (selectedClasses.length > 0 && !selectedClasses.includes('__NONE__') ? 1 : 0) +
    (selectedGenders.length > 0 && !selectedGenders.includes('__NONE__') ? 1 : 0) +
    (selectedStreams.length > 0 && !selectedStreams.includes('__NONE__') ? 1 : 0) +
    (selectedStatuses.length > 0 && !selectedStatuses.includes('__NONE__') ? 1 : 0) +
    (viewScope === 'all' && selectedSessions.length > 0 && !selectedSessions.includes('__NONE__') ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedClasses([]);
    setSelectedGenders([]);
    setSelectedStreams([]);
    setSelectedStatuses([]);
    setSelectedSessions([]);
    if (setSortBy) setSortBy('classRollNo');
    if (setSortOrder) setSortOrder('asc');
    if (setCurrentPage) setCurrentPage(1);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
          totalActiveFilters > 0
            ? 'bg-amber-700 text-white border border-amber-800'
            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-1">
          <span>🔍</span>
          <span className="hidden sm:inline">Filters</span>
        </span>
        {totalActiveFilters > 0 && (
          <span className="bg-white text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-black shadow-2xs">
            {totalActiveFilters}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute -left-24 sm:left-0 mt-1.5 w-[280px] sm:w-[310px] max-w-[calc(100vw-16px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2.5 sm:p-3 space-y-2 animate-fadeIn bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 text-xs font-black gap-2">
            <span className="text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px] whitespace-nowrap">Filter Student Records</span>
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer whitespace-nowrap"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 w-full">
            {viewScope === 'all' && (
              <MultiSelectCheckboxDropdown
                label="Sessions"
                options={availableSessions}
                selected={selectedSessions}
                onChange={(val) => { setSelectedSessions(val); setCurrentPage(1); }}
                align="left"
              />
            )}

            <MultiSelectCheckboxDropdown
              label="Classes"
              options={availableClasses}
              selected={selectedClasses}
              onChange={(val) => { setSelectedClasses(val); setCurrentPage(1); }}
              align="left"
            />

            <MultiSelectCheckboxDropdown
              label="Gender"
              options={availableGenders}
              selected={selectedGenders}
              onChange={(val) => { setSelectedGenders(val); setCurrentPage(1); }}
              align="right"
            />

            <MultiSelectCheckboxDropdown
              label="Streams"
              options={availableStreams}
              selected={selectedStreams}
              onChange={(val) => { setSelectedStreams(val); setCurrentPage(1); }}
              align="left"
            />

            <MultiSelectCheckboxDropdown
              label="Status"
              options={availableStatuses}
              selected={selectedStatuses}
              onChange={(val) => { setSelectedStatuses(val); setCurrentPage(1); }}
              align="right"
            />
          </div>

          {/* Sort Controls inside Filter popover */}
          {setSortBy && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Sort Records By</span>
                <button
                  type="button"
                  onClick={() => setSortOrder && setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="text-amber-700 dark:text-amber-400 font-extrabold hover:underline cursor-pointer flex items-center gap-1"
                  title="Toggle Sort Order"
                >
                  <span>{sortOrder === 'asc' ? 'Asc ⬆️' : 'Desc ⬇️'}</span>
                </button>
              </div>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); if (setCurrentPage) setCurrentPage(1); }}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="classRollNo">🔢 Class Roll No (Default)</option>
                <option value="formNo">📄 Form Number</option>
                <option value="admNo">🎓 Admission Number (Adm. No.)</option>
                <option value="studentName">👤 Student's Name (A-Z)</option>
                <option value="boardRegNo">🆔 Board Registration No.</option>
                <option value="onlineSubmDate">📅 Online Submission Date</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reusable More Actions Dropdown (Slim Toolbar Consolidated Button) ───
function MoreActionsDropdown({
  density,
  setDensity,
  setShowColumnManager,
  onPrint,
  onExportCSV,
  onSync,
  loading,
  align = 'right'
}) {
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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="More Actions & Display Settings"
        className="p-1.5 rounded-xl font-black bg-gradient-to-r from-indigo-700 to-indigo-800 hover:from-indigo-600 hover:to-indigo-700 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer text-xs"
      >
        <Settings size={15} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'left' ? 'left-0 sm:right-0 sm:left-auto' : 'right-0'} mt-1.5 w-60 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-1 animate-fadeIn bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-extrabold`}>
          <div className="px-2 py-1 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
            Layout & Display Controls
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60">
            <span>Density:</span>
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-[10px]">
              <button
                type="button"
                onClick={() => setDensity('fit')}
                className={`px-2 py-0.5 rounded font-black transition-colors ${density === 'fit' ? 'bg-amber-700 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-0.5 rounded font-black transition-colors ${density === 'compact' ? 'bg-amber-700 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`px-2 py-0.5 rounded font-black transition-colors ${density === 'normal' ? 'bg-amber-700 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Normal
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setShowColumnManager(true); setIsOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-extrabold cursor-pointer"
          >
            <Columns size={13} />
            <span>Manage Table Columns (Cols)</span>
          </button>

          <div className="px-2 py-1 border-t border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400 mt-1">
            Export & Print
          </div>

          <button
            type="button"
            onClick={() => { onPrint(); setIsOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-extrabold cursor-pointer"
          >
            <Printer size={13} />
            <span>Print Register Report</span>
          </button>

          <button
            type="button"
            onClick={() => { onExportCSV(); setIsOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-teal-600 dark:text-teal-400 font-extrabold cursor-pointer"
          >
            <FileSpreadsheet size={13} />
            <span>Export to Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => { onSync(); setIsOpen(false); }}
            disabled={loading}
            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300 font-extrabold cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Force Sync Data</span>
          </button>
        </div>
      )}
    </div>
  );
}

const SUBJECT_ABBR_MAP = {
  // Academic Subjects
  'General English': 'GE',
  'English Literature': 'EL',
  'Functional English': 'FE',
  'English': 'GE',
  'Hindi': 'HI',
  'Dogri': 'DG',
  'Sanskrit': 'SA',
  'Punjabi': 'PU',
  'Bhoti': 'BO',
  'Arabic': 'AR',
  'Persian': 'PE',
  'Kashmiri': 'KA',
  'Urdu': 'UR',
  'History': 'HT',
  'Economics': 'EC',
  'Geography': 'GG',
  'Philosophy': 'PL',
  'Education': 'ED',
  'Psychology': 'PY',
  'Sociology': 'SO',
  'Political Science': 'PS',
  'Home Science (Elective)': 'HS',
  'Home Science': 'HS',
  'Statistics': 'SS',
  'Mathematics': 'MA',
  'Maths': 'MA',
  'Islamic Studies': 'IS',
  'Vedic Studies': 'VS',
  'Computer Science': 'CS',
  'Information Practices': 'IP',
  'Environmental Science': 'ES',
  'Environmental Education': 'ES',
  'EVS': 'ES',
  'Physics': 'PH',
  'Chemistry': 'CH',
  'Biology (Botany/Zoology)': 'BI',
  'Biology': 'BI',
  'Science': 'BI',
  'Science (Physics, Chemistry, Biology)': 'BI',
  'Science (Phy/Chem/Bio)': 'BI',
  'Social Science (Hist/Civ/Geog)': 'SST',
  'Social Science': 'SST',
  'Social Studies': 'SST',
  'Electronics': 'ET',
  'Biotechnology': 'BT',
  'Bio-chemistry': 'BC',
  'Music': 'MU',
  'Family Health Care & Prevention': 'FH',
  'Food Science': 'FS',
  'Management of Resources': 'MR',
  'Business Studies': 'BS',
  'Travel, Tourism & Hotel Management': 'TT',
  'Accountancy': 'AY',
  'Entrepreneurship': 'EP',
  'Public Administration': 'PA',
  'Typewriting and Shorthand': 'TS',
  'Business Mathematics': 'BM',
  'Geology': 'GO',
  'Buddhist Studies': 'BU',
  'Physical Education': 'PD',
  'Clothing for the Family': 'CT',
  'Applied Mathematics': 'AM',
  'Microbiology': 'MB',
  'Extension Education': 'EE',
  'Human Development': 'HD',

  // Vocational Subjects
  'IT and ITeS': 'ITE',
  'IT & ITES': 'ITE',
  'IT and ITES': 'ITE',
  'Retail': 'RET',
  'Healthcare': 'HTC',
  'Tourism': 'TOU',
  'Tourism and Hospitality': 'TOU',
  'Security': 'SEC',
  'Agriculture': 'AGR',
  'Telecommunication': 'TLC',
  'Media and Entertainment': 'MDE',
  'Beauty and Wellness': 'BTW',
  'Physical Education & Sports': 'PES',
};

const abbreviateSubjects = (str) => {
  if (!str || str === '—') return '—';
  const parts = String(str).split(',').map(s => s.trim()).filter(Boolean);
  const abbrParts = parts.map(part => {
    if (SUBJECT_ABBR_MAP[part]) return SUBJECT_ABBR_MAP[part];
    const foundKey = Object.keys(SUBJECT_ABBR_MAP).find(k => k.toLowerCase() === part.toLowerCase());
    if (foundKey) return SUBJECT_ABBR_MAP[foundKey];
    
    if (/general english|functional english|english/i.test(part)) return 'GE';
    if (/math/i.test(part)) return 'MA';
    if (/social science|social studies|sst/i.test(part)) return 'SST';
    if (/science/i.test(part) && !/environmental|political|social|food|home/i.test(part)) return 'BI';
    if (/environmental|evs/i.test(part)) return 'ES';
    if (/physics/i.test(part)) return 'PH';
    if (/chemistry/i.test(part)) return 'CH';
    if (/biology|botany|zoology/i.test(part)) return 'BI';
    if (/urdu/i.test(part)) return 'UR';
    if (/health/i.test(part)) return 'HTC';
    if (/it and ites|it & ites|information tech|ites/i.test(part)) return 'ITE';
    if (/physical education & sports|sports/i.test(part)) return 'PES';
    if (/physical education/i.test(part)) return 'PD';
    if (/history/i.test(part)) return 'HT';
    if (/political/i.test(part)) return 'PS';
    if (/sociology/i.test(part)) return 'SO';
    if (/economics/i.test(part)) return 'EC';
    if (/education/i.test(part)) return 'ED';
    if (/arabic/i.test(part)) return 'AR';
    if (/kashmiri/i.test(part)) return 'KA';
    if (/hindi/i.test(part)) return 'HI';
    if (/retail/i.test(part)) return 'RET';
    if (/tourism/i.test(part)) return 'TOU';

    if (part.length > 4) {
      return part.slice(0, 3).toUpperCase();
    }
    return part.toUpperCase();
  });

  return abbrParts.join(', ');
};

// Smart Title Case Formatter for Names (Fixes AHmad, ahmad, AHMAD -> Ahmad)
const formatProperName = (str) => {
  if (!str || typeof str !== 'string' || str === '—') return str || '—';
  const trimmed = str.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '—';

  return trimmed
    .split(' ')
    .map(word => {
      if (!word) return '';
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '')
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

// Helper for Re-admission & Admission Number Formatting (sanitizes #N/A, #VALUE!, #REF!, etc.)
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
  // Reject ordinal class names like "11th", "12th", "9th", "10th"
  if (/^\d{1,2}(st|nd|rd|th)$/i.test(str)) return '';
  // Reject explicit class strings like "Class 11", "Class 12", "11th Class", "Class 11th"
  if (/^class\s*\d{1,2}(st|nd|rd|th)?$/i.test(str)) return '';
  if (/^\d{1,2}(st|nd|rd|th)?\s+class$/i.test(str)) return '';
  return str;
};

const extractRawAdmNo = (rec) => {
  if (!rec) return '';
  
  // 1. Direct property key candidates across all common casing & naming variants
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
    rec['Adm No (if allotted)'],
    rec['Admitted S.No'],
    rec['Admitted S. No.'],
    rec['S.No'],
    rec['S. No.']
  ];

  for (const c of candidates) {
    const cleaned = cleanAdmNoVal(c);
    if (cleaned) return cleaned;
  }

  // 2. Dynamic key scan fallback for any property containing 'adm' or 'admission' + 'no'/'number'/'#'
  for (const key of Object.keys(rec)) {
    const kLower = key.toLowerCase();
    if (
      (kLower.includes('adm') && (kLower.includes('no') || kLower.includes('number') || kLower.includes('#'))) ||
      (kLower.includes('admission') && (kLower.includes('no') || kLower.includes('number') || kLower.includes('#')))
    ) {
      // Skip fields that are NOT admission numbers
      if (kLower.includes('readmission') || kLower.includes('status') || kLower.includes('sought') || kLower.includes('class') || kLower.includes('date') || kLower.includes('form')) continue;
      const cleaned = cleanAdmNoVal(rec[key]);
      if (cleaned && !/^(yes|no|true|false)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return '';
};

const formatStudentAdmNo = (rec) => {
  if (!rec) return '';
  let newAdm = extractRawAdmNo(rec);

  const isReAdmission = 
    String(
      rec['readmission'] || 
      rec['Re-admission'] || 
      rec['isReadmission'] || 
      rec['Is Re-admission'] || 
      rec['Are you seeking Re-admission?'] || 
      rec['reAdmissionStatus'] || ''
    ).toLowerCase() === 'yes' ||
    rec['readmission'] === true ||
    rec['isReadmission'] === true;

  const oldAdm = cleanAdmNoVal(
    rec['Old Admission No.'] || 
    rec['Old Adm. No.'] || 
    rec['oldAdmNo'] || 
    rec['old_adm_no'] || 
    rec['Old Admission Number'] || 
    rec['Previous Adm. No.'] || 
    rec['Prev Adm No']
  );

  if (isReAdmission && oldAdm && oldAdm !== newAdm) {
    return newAdm ? `${newAdm} (${oldAdm})` : `${oldAdm}`;
  }

  if (!newAdm && oldAdm) {
    return oldAdm;
  }

  return newAdm;
};

// ─── Status Smart Action Dropdown Component ───
function StatusActionDropdown({ student, onViewEdit, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, openUp: false });
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogConfig, setDialogConfig] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const dropdownRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      // Portal-based dropdown: check both the portal element and the trigger button
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      const inButton = btnRef.current && btnRef.current.contains(event.target);
      if (!inDropdown && !inButton) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roll = String(student?.classRollNo || student?.['Class Roll No'] || student?.['Class Roll No.'] || '').trim();
  const hasRoll = roll && roll !== '—' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined';
  const val = student?.status || student?.Status || 'Submitted';
  const isApp = hasRoll || val === 'Approved' || val === 'APPR' || val === 'appr.';
  const isSub = !hasRoll && (val === 'Submitted' || val === 'SUBM');
  const isDft = !hasRoll && val === 'Draft';
  const isProv = val === 'Provisional' || val === 'PROV';

  const bg = isApp ? 'bg-emerald-600 hover:bg-emerald-700' : isSub ? 'bg-teal-600 hover:bg-teal-700' : isProv ? 'bg-indigo-600 hover:bg-indigo-700' : isDft ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700';
  const abbr = isApp ? 'APPR' : isSub ? 'SUBM' : isProv ? 'PROV' : isDft ? 'DRAFT' : 'REJT';

  const handleUnlock = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setPromptInput('24');
    setDialogConfig({
      type: 'prompt',
      title: 'Unlock Application for Edit',
      message: `Enter unlock duration in hours for ${student?.studentName || 'student'}:`,
      placeholder: 'Hours (e.g. 24)',
      icon: Unlock,
      iconColor: 'text-amber-600 dark:text-amber-400',
      btnColor: 'bg-amber-700 hover:bg-amber-600 text-white',
      confirmText: 'Unlock Application',
      onConfirm: async (inputVal) => {
        const hrs = parseInt(inputVal, 10);
        if (isNaN(hrs) || hrs <= 0) return;
        try {
          setActionLoading(true);
          const formNo = student?.formNo || student?.['Form Number'] || student?.id;
          await appsScriptApi.call('unlockApplication', { formNo, hours: hrs });
          if (student?.id) {
            try {
              await updateDoc(doc(db, 'admissions', String(student.id)), { editUnlocked: true, editUnlockedUntil: Date.now() + hrs * 3600000 });
            } catch (err) { console.warn(err); }
          }
          if (onRefresh) onRefresh();
          setDialogConfig({
            type: 'alert',
            title: 'Application Unlocked',
            message: `Application Form #${formNo} has been unlocked for editing for ${hrs} hours!`,
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            btnColor: 'bg-emerald-700 hover:bg-emerald-600 text-white'
          });
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handlePdfDownload = async (e) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      setActionLoading(true);
      await generateStudentAdmissionPdf(student);
    } catch (err) {
      console.error('PDF error:', err);
      setDialogConfig({
        type: 'alert',
        title: 'PDF Generation Error',
        message: 'Could not generate PDF for this record.',
        icon: AlertOctagon,
        iconColor: 'text-rose-600 dark:text-rose-400',
        btnColor: 'bg-rose-700 hover:bg-rose-600 text-white'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewHistory = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setDialogConfig({
      type: 'alert',
      title: `Activity History: ${student?.studentName || 'Student'}`,
      message: `Form #${student?.formNo || student?.id}\n• Current Status: ${student?.status || 'Submitted'}\n• Online Submission Date: ${student?.onlineSubmDate || '—'}\n• Admission Date: ${student?.admDate || '—'}`,
      icon: History,
      iconColor: 'text-purple-600 dark:text-purple-400',
      btnColor: 'bg-purple-700 hover:bg-purple-600 text-white'
    });
  };

  const handleSendPassword = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    const mob = student?.mobile || student?.["Student's Contact"] || 'N/A';
    setDialogConfig({
      type: 'alert',
      title: 'Credentials Sent',
      message: `Credentials notification successfully sent to student mobile: ${mob}`,
      icon: Key,
      iconColor: 'text-blue-600 dark:text-blue-400',
      btnColor: 'bg-blue-700 hover:bg-blue-600 text-white'
    });
  };

  const handleSendWhatsApp = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    const rawMob = String(student?.mobile || student?.["Student's Contact"] || '').replace(/\D/g, '');
    if (!rawMob || rawMob.length < 10) {
      setDialogConfig({
        type: 'alert',
        title: 'Missing Mobile Number',
        message: 'No valid WhatsApp mobile number found for this student record.',
        icon: AlertOctagon,
        iconColor: 'text-amber-600 dark:text-amber-400',
        btnColor: 'bg-amber-700 hover:bg-amber-600 text-white'
      });
      return;
    }
    const cleanMob = rawMob.length === 10 ? `91${rawMob}` : rawMob;
    const text = encodeURIComponent(`Hello ${student?.studentName}, regarding your Admission Application (Form #${student?.formNo || ''}) at HSS Shangus: Current Status is ${student?.status || 'Submitted'}.`);
    window.open(`https://wa.me/${cleanMob}?text=${text}`, '_blank');
  };

  const handleAssignRollNo = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    const currRoll = student?.classRollNo && student?.classRollNo !== 'N/A' ? student?.classRollNo : '';
    setPromptInput(currRoll);
    setDialogConfig({
      type: 'prompt',
      title: 'Assign Class Roll Number',
      message: `Assign or update class roll number for ${student?.studentName}:`,
      placeholder: 'Enter Class Roll No (e.g. 15)...',
      icon: Hash,
      iconColor: 'text-teal-600 dark:text-teal-400',
      btnColor: 'bg-teal-700 hover:bg-teal-600 text-white',
      confirmText: 'Save Roll No',
      onConfirm: async (inputVal) => {
        const newRoll = (inputVal || '').trim();
        try {
          setActionLoading(true);
          if (student?.id) {
            try {
              await updateDoc(doc(db, 'admissions', String(student.id)), {
                'Class Roll No': newRoll,
                'Class R.No.': newRoll,
                classRollNo: newRoll
              });
            } catch (err) { console.warn(err); }
          }
          if (onRefresh) onRefresh();
          setDialogConfig({
            type: 'alert',
            title: 'Roll Number Saved',
            message: `Class Roll No updated to "${newRoll || 'Unassigned'}" for ${student?.studentName}.`,
            icon: CheckCircle2,
            iconColor: 'text-teal-600 dark:text-teal-400',
            btnColor: 'bg-teal-700 hover:bg-teal-600 text-white'
          });
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleReject = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setPromptInput('Documents incomplete / verification pending');
    setDialogConfig({
      type: 'prompt',
      title: 'Reject Application',
      message: `Enter rejection reason for ${student?.studentName}:`,
      placeholder: 'Reason for rejection...',
      icon: AlertOctagon,
      iconColor: 'text-rose-600 dark:text-rose-400',
      btnColor: 'bg-rose-700 hover:bg-rose-600 text-white',
      confirmText: 'Confirm Rejection',
      onConfirm: async (inputVal) => {
        const reason = (inputVal || '').trim();
        if (!reason) return;
        try {
          setActionLoading(true);
          if (student?.id) {
            try {
              await updateDoc(doc(db, 'admissions', String(student.id)), {
                'Status': 'Rejected',
                'status': 'Rejected',
                'rejectionReason': reason
              });
            } catch (err) { console.warn(err); }
          }
          if (onRefresh) onRefresh();
          setDialogConfig({
            type: 'alert',
            title: 'Application Rejected',
            message: `Application for ${student?.studentName} marked as Rejected.`,
            icon: AlertOctagon,
            iconColor: 'text-rose-600 dark:text-rose-400',
            btnColor: 'bg-rose-700 hover:bg-rose-600 text-white'
          });
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setDialogConfig({
      type: 'confirm',
      title: 'Delete Student Record',
      message: `Are you sure you want to PERMANENTLY DELETE student record for ${student?.studentName} (Form #${student?.formNo})? This action cannot be undone.`,
      icon: Trash2,
      iconColor: 'text-red-600 dark:text-red-400',
      btnColor: 'bg-red-700 hover:bg-red-600 text-white',
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          if (student?.id) {
            try {
              await updateDoc(doc(db, 'admissions', String(student.id)), {
                'Status': 'Deleted',
                '_deleted': true
              });
            } catch (err) { console.warn(err); }
          }
          if (onRefresh) onRefresh();
          setDialogConfig(null);
        } catch (err) {
          console.warn(err);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 320;
            setDropdownPos({
              top: openUp ? undefined : rect.bottom + 4,
              bottom: openUp ? (window.innerHeight - rect.top + 4) : undefined,
              left: Math.min(rect.left, window.innerWidth - 230),
              openUp,
            });
          }
          setIsOpen(!isOpen);
        }}
        title="Click to view & execute form actions"
        className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white ${bg} tracking-tight uppercase cursor-pointer shadow-2xs transition-all hover:scale-105 active:scale-95`}
      >
        <span>{actionLoading ? '...' : abbr}</span>
        <ChevronDown size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            ...(dropdownPos.openUp
              ? { bottom: dropdownPos.bottom + 'px' }
              : { top: dropdownPos.top + 'px' }),
            left: dropdownPos.left + 'px',
            zIndex: 99999,
          }}
          className="w-56 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 space-y-0.5 animate-fadeIn bg-white/98 dark:bg-slate-900/98 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-bold"
        >
          <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Form Controls</span>
            <span className="font-mono text-amber-600 dark:text-amber-400">#{student?.formNo || student?.sno}</span>
          </div>

          <div className="space-y-0.5 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                if (onViewEdit) onViewEdit(student);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <Eye size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>View / Edit Record</span>
            </button>

            <button
              type="button"
              onClick={handleUnlock}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <Unlock size={13} className="text-amber-600 dark:text-amber-400" />
              <span>Unlock for Edit</span>
            </button>

            <button
              type="button"
              onClick={handleAssignRollNo}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <Hash size={13} className="text-teal-600 dark:text-teal-400" />
              <span>Assign Class Roll No</span>
            </button>

            <button
              type="button"
              onClick={handlePdfDownload}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>PDF: View / Download</span>
            </button>

            <button
              type="button"
              onClick={handleViewHistory}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <History size={13} className="text-purple-600 dark:text-purple-400" />
              <span>View Activity History</span>
            </button>

            <button
              type="button"
              onClick={handleSendPassword}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <Key size={13} className="text-blue-600 dark:text-blue-400" />
              <span>Send Password</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold"
            >
              <MessageSquare size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleReject}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-700 dark:text-rose-400 cursor-pointer font-extrabold"
            >
              <AlertOctagon size={13} className="text-rose-600 dark:text-rose-400" />
              <span>Reject Application</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 cursor-pointer font-extrabold border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1"
            >
              <Trash2 size={13} className="text-red-600 dark:text-red-400" />
              <span>Delete Record</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Sleek Custom Action Dialog Modal (Replaces browser window.prompt / alert) */}
      {dialogConfig && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3">
              {dialogConfig.icon && (
                <div className={`p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 ${dialogConfig.iconColor || ''}`}>
                  <dialogConfig.icon size={20} />
                </div>
              )}
              <h3 className="font-black text-base text-slate-900 dark:text-white flex-1">
                {dialogConfig.title}
              </h3>
              <button
                type="button"
                onClick={() => setDialogConfig(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Message */}
            <div className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {dialogConfig.message}
            </div>

            {/* Prompt Text Input */}
            {dialogConfig.type === 'prompt' && (
              <div className="pt-1">
                <input
                  type="text"
                  autoFocus
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={dialogConfig.placeholder || 'Enter value...'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (dialogConfig.onConfirm) dialogConfig.onConfirm(promptInput);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {dialogConfig.type !== 'alert' && (
                <button
                  type="button"
                  onClick={() => setDialogConfig(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const cb = dialogConfig.onConfirm;
                  if (cb) {
                    cb(promptInput);
                  } else {
                    setDialogConfig(null);
                  }
                }}
                className={`px-5 py-2 rounded-xl font-black text-xs cursor-pointer shadow-md transition-all hover:scale-105 active:scale-95 ${dialogConfig.btnColor || 'bg-amber-700 hover:bg-amber-600 text-white'}`}
              >
                {dialogConfig.confirmText || 'OK'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const COLUMN_DEFS = [
  { key: 'sno', label: 'S.No.', isSticky: true, className: 'font-mono font-black text-amber-700 dark:text-amber-400 border-r border-slate-200 dark:border-slate-800/50' },
  { key: 'formNo', label: 'F.No.', className: 'font-mono' },
  { key: 'status', label: 'Status', className: 'text-center min-w-[70px]', render: (val, student) => {
    return (
      <StatusActionDropdown
        student={student}
        onViewEdit={(s) => {
          if (student && typeof student._setSelectedApp === 'function') {
            student._setSelectedApp(s);
          }
        }}
        onRefresh={student?._onRefresh}
      />
    );
  }},
  { key: 'classRollNo', label: 'RL. NO.', className: 'font-mono font-black text-teal-700 dark:text-teal-400' },
  { key: 'admNo', label: 'Adm. No.', className: 'font-mono font-black', render: (val, student) => {
    const formatted = formatStudentAdmNo(student) || cleanAdmNoVal(val);
    if (!formatted) return <span className="font-mono text-slate-400 dark:text-slate-600">—</span>;

    const isRe = 
      String(
        student?.['readmission'] || 
        student?.['Re-admission'] || 
        student?.['isReadmission'] || 
        student?.['Is Re-admission'] || ''
      ).toLowerCase() === 'yes' ||
      student?.['readmission'] === true ||
      student?.['isReadmission'] === true;

    const oldAdm = cleanAdmNoVal(
      student?.['Old Admission No.'] || 
      student?.['Old Adm. No.'] || 
      student?.['oldAdmNo'] || 
      student?.['old_adm_no'] || ''
    );

    if (isRe && oldAdm && oldAdm !== formatted) {
      return (
        <span className="font-mono font-black text-slate-900 dark:text-white" title={`Re-admission student. New Adm No: ${formatted}, Old Adm No: ${oldAdm}`}>
          <span className="text-amber-800 dark:text-amber-300 font-extrabold">{formatted}</span>
          <span className="ml-1 text-[10px] text-indigo-700 dark:text-indigo-400 font-black">({oldAdm})</span>
        </span>
      );
    }

    return <span className="font-mono font-black text-slate-900 dark:text-white">{formatted}</span>;
  }},
  { key: 'class', label: 'Class', className: 'font-black' },
  { key: 'session', label: 'Session', className: 'font-black text-purple-700 dark:text-purple-400' },
  { key: 'boardRegNo', label: 'Reg. No.', className: 'font-mono text-slate-700 dark:text-slate-300 max-w-[110px] whitespace-normal break-words leading-tight' },
  { key: 'photoId', label: 'Photo', className: 'text-center', render: (val, student) => (
    val && typeof val === 'string' && val.startsWith('data:') ? (
      <img
        src={val}
        alt="Student Photo"
        onClick={(e) => {
          e.stopPropagation();
          if (student && typeof student._setPreviewPhotoModal === 'function') {
            student._setPreviewPhotoModal({
              url: val,
              name: student.studentName,
              rollNo: student.classRollNo,
              admNo: student.admNo,
              class: student.class,
              session: student.session,
              formNo: student.formNo
            });
          }
        }}
        className="w-8 h-10 mx-auto rounded-lg border border-teal-500/50 object-cover shadow-sm hover:scale-125 transition-transform cursor-pointer"
        title="Click for full photo preview"
      />
    ) : (
      <span className="text-slate-400 font-normal text-[10px]">—</span>
    )
  )},
  { key: 'studentName', label: "Student's Name", className: 'font-black text-slate-900 dark:text-white min-w-[140px] whitespace-normal break-words leading-tight', render: (val, student) => {
    const formatted = formatProperName(val);
    const gRaw = String(student?.gender || '').trim().toLowerCase();
    let gCode = '';
    let gColor = '';

    if (gRaw.startsWith('f')) {
      gCode = 'F';
      gColor = 'bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800';
    } else if (gRaw.startsWith('m')) {
      gCode = 'M';
      gColor = 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';
    } else if (gRaw && gRaw !== '—') {
      gCode = 'O';
      gColor = 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800';
    }

    const isDirect = Boolean(
      student?._isDirectIngested ||
      String(student?.remarks || '').toLowerCase().includes('direct ingestion') ||
      String(student?.lastEditedBy || '').toLowerCase().includes('direct')
    );

    const isGenderColumnSelected = student?._visibleCols?.gender;

    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="font-black text-slate-900 dark:text-white">{formatted}</span>
        {isGenderColumnSelected && gCode && (
          <span
            title={`Gender: ${student?.gender || gCode}`}
            className={`inline-block px-1 py-0.2 rounded text-[9px] font-black border shadow-2xs leading-none whitespace-nowrap ${gColor}`}
          >
            ({gCode})
          </span>
        )}
      </span>
    );
  }},
  { key: 'fatherName', label: "Father's Name", className: 'text-slate-600 dark:text-slate-400 min-w-[130px] whitespace-normal break-words leading-tight', render: (val) => formatProperName(val) },
  { key: 'motherName', label: "Mother's Name", className: 'text-slate-600 dark:text-slate-400 min-w-[130px] whitespace-normal break-words leading-tight', render: (val) => formatProperName(val) },
  { key: 'dob', label: 'DoB', className: 'text-slate-600 dark:text-slate-400 whitespace-nowrap' },
  { key: 'village', label: 'Village/Town', className: 'min-w-[95px] whitespace-normal break-words leading-tight text-slate-700 dark:text-slate-300', render: (val) => formatProperName(val) },
  { key: 'gender', label: 'Gender', className: 'font-black whitespace-nowrap' },
  { key: 'category', label: 'Category', className: 'font-extrabold text-amber-800 dark:text-amber-300 whitespace-nowrap' },
  { key: 'subs', label: 'SUBS (STREAM)', className: 'min-w-[105px] max-w-[130px] whitespace-normal break-words leading-tight', render: (val, student) => {
    const abbr = abbreviateSubjects(val);
    const getStreamCode = (streamStr) => {
      if (!streamStr || streamStr === '—') return '';
      const s = String(streamStr).toLowerCase();
      if (s.includes('science') || s.includes('med')) return 'S';
      if (s.includes('humanities') || s.includes('art')) return 'H';
      if (s.includes('commerce')) return 'C';
      if (s.includes('general')) return 'G';
      return streamStr.charAt(0).toUpperCase();
    };

    const sCode = getStreamCode(student?.stream);
    const fullStream = student?.stream || '—';

    const streamColors = {
      'G': 'bg-emerald-700 text-white border-emerald-800',
      'S': 'bg-indigo-700 text-white border-indigo-800',
      'H': 'bg-purple-700 text-white border-purple-800',
      'C': 'bg-amber-700 text-white border-amber-800',
    };

    const badgeStyle = streamColors[sCode] || 'bg-slate-700 text-white border-slate-800';

    return (
      <span
        title={`Stream: ${fullStream} | Full Subjects: ${val || '—'}`}
        className="font-black text-[11px] text-slate-800 dark:text-slate-200 tracking-tight leading-snug cursor-help inline"
      >
        <span>{abbr}</span>
        {sCode && (
          <span className={`inline-block align-baseline ml-1 px-1 py-0.2 rounded text-[9px] font-black border shadow-2xs whitespace-nowrap ${badgeStyle}`}>
            ({sCode})
          </span>
        )}
      </span>
    );
  }},
  { key: 'mobile', label: 'Mobile (S)', className: 'font-mono text-slate-600 dark:text-slate-400' },
  { key: 'aadhar', label: 'Aadhaar', className: 'font-mono' },
  { key: 'bankAccount', label: 'Bank Account Number', className: 'font-mono' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'ifsc', label: 'IFSC Code', className: 'font-mono' },

  { key: 'onlineSubmDate', label: 'Online Subm. Date' },
  { key: 'admDate', label: 'Adm. Date' },
  { key: 'boardName', label: 'Board Name' },
  { key: 'dobWords', label: 'DoB (words)' },
  { key: 'block', label: 'Block' },
  { key: 'tehsil', label: 'Tehsil' },
  { key: 'district', label: 'District' },
  { key: 'pinCode', label: 'PIN code', className: 'font-mono' },
  { key: 'state', label: 'State/UT' },
  { key: 'residence', label: 'Residence (Village, District)' },
  { key: 'religion', label: 'Religion' },
  { key: 'disabilityStatus', label: 'Disability Status' },
  { key: 'disabilityType', label: 'Disability Type' },
  { key: 'subjects1', label: 'Subjects1' },
  { key: 'subjects2', label: 'Subjects2' },
  { key: 'subjects3', label: 'Subjects3' },
  { key: 'subjects4', label: 'Subjects4' },
  { key: 'subjects5', label: 'Subjects5' },
  { key: 'subjects6', label: 'Subject6' },
  { key: 'email1', label: 'email1' },
  { key: 'email2', label: 'email2' },
  { key: 'parentContact', label: "Parent's Contact", className: 'font-mono' },
  { key: 'bloodType', label: 'Blood Type' },
  { key: 'height', label: 'Height (cm)' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'socialCategory', label: 'Social category' },
  { key: 'socioEconomicCategory', label: 'Socio-economic category' },
  { key: 'houseNo', label: 'House No.' },
  { key: 'vocationalPercentage', label: 'Vocational %age' },
  { key: 'prevComplexHead', label: 'Previous Complex Head' },
  { key: 'penNo', label: 'PEN No.' },
  { key: 'prevSchool', label: 'Previous School' },
  { key: 'prevCcDc', label: 'CC/DC No. & Date (Prev. insitution)' },
  { key: 'prevExamMode', label: 'Exam Mode (Prev.)' },
  { key: 'prevExamRollNo', label: 'Exam R.No. (Prev.)', className: 'font-mono' },
  { key: 'prevMarksObt', label: 'Marks Obt. (Prev.)', className: 'font-mono' },
  { key: 'prevMaxMarks', label: 'Max. Marks (Prev.)', className: 'font-mono' },
  { key: 'prevPercentage', label: '%age (Prev.)', className: 'font-mono' },
  { key: 'prevDivision', label: 'Div/Distinc (Prev.)' },
  { key: 'currExamMode', label: 'Exam Mode (Current)' },
  { key: 'currExamRollNo', label: 'Exam R.No. (Current)', className: 'font-mono' },
  { key: 'currResult', label: 'Result (Current)' },
  { key: 'currMarksReapp', label: 'Marks/Reapp (Current)' },
  { key: 'withdrawalDate', label: 'Date of withdrawl' },
  { key: 'currCcDc', label: 'No. & Date of CC/DC Issued (This Institution)' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'pdfUrl', label: 'PDF_URL', render: (val) => (
    val && typeof val === 'string' && val.startsWith('http') ? (
      <a href={val} target="_blank" rel="noreferrer" className="text-teal-600 font-mono underline hover:text-teal-500 text-[10px]">
        📄 PDF Copy
      </a>
    ) : (
      <span className="text-slate-400 font-normal text-[10px]">—</span>
    )
  )},
  { key: 'readmission', label: 'readmission' },
  { key: 'apaarId', label: 'APAAR ID', className: 'font-mono' },
];

const DEFAULT_1_WIDTHS = {
  sno: 50,
  formNo: 75,
  status: 65,
  classRollNo: 70,
  admNo: 75,
  class: 55,
  session: 70,
  boardRegNo: 110,
  photoId: 44,
  studentName: 145,
  fatherName: 135,
  motherName: 135,
  dob: 85,
  village: 100,
  gender: 65,
  category: 75,
  stream: 80,
  subs: 215,
  mobile: 95,
  aadhar: 110,
  bankAccount: 125,
  bankName: 110,
  ifsc: 95,
  onlineSubmDate: 100,
  admDate: 90,
  boardName: 100,
  dobWords: 120,
  block: 85,
  tehsil: 85,
  district: 85,
  pinCode: 70,
  state: 80,
  residence: 130,
  religion: 75,
  disabilityStatus: 100,
  disabilityType: 100,
  subjects1: 90,
  subjects2: 90,
  subjects3: 90,
  subjects4: 90,
  subjects5: 90,
  subjects6: 90,
  email1: 120,
  email2: 120,
  parentContact: 100,
  bloodType: 70,
  height: 70,
  weight: 70,
  socialCategory: 100,
  socioEconomicCategory: 110,
  houseNo: 80,
  vocationalPercentage: 90,
  prevComplexHead: 110,
  penNo: 90,
  prevSchool: 130,
  prevCcDc: 120,
  prevExamMode: 90,
  prevExamRollNo: 90,
  prevMarksObt: 85,
  prevMaxMarks: 85,
  prevPercentage: 80,
  prevDivision: 90,
  currExamMode: 90,
  currExamRollNo: 90,
  currResult: 85,
  currMarksReapp: 90,
  withdrawalDate: 95,
  currCcDc: 120,
  remarks: 110,
  pdfUrl: 85,
  readmission: 80,
  apaarId: 100,
};

// ─── ADMIN STUDENT PROFILE FIELD EDITOR MODAL ───
function AdminStudentEditModal({ student, onClose, onSave, isSaving, restrictedCols = {} }) {
  const isNewStudent = !student || !student.id;
  const isFieldLocked = (fieldKey) => !isNewStudent && !!restrictedCols[fieldKey];

  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState(() => ({
    'Form Number': student?.formNo || student?.['Form Number'] || student?.['Form No.'] || '',
    'Class': student?.class || student?.['Class'] || '11th',
    'Session': student?.session || student?.['Session'] || '2025-26',
    'Class Roll No': student?.classRollNo || student?.['Class Roll No'] || '',
    'Adm. No.': student?.admNo || student?.['Adm. No.'] || '',
    'Board Registration Number': student?.boardRegNo || student?.['Board Registration Number'] || student?.['Board Reg. No.'] || '',
    'Status': student?.status || student?.['Status'] || 'Submitted',
    'Stream': student?.stream || student?.['Stream'] || 'General',

    "Student's Name": student?.studentName || student?.["Student's Name (as per school records)"] || student?.["Student's Name"] || '',
    "Father's Name": student?.fatherName || student?.["Father's/Guardian's Name (as per school records)"] || student?.["Father's Name"] || '',
    "Mother's Name": student?.motherName || student?.["Mother's Name (as per school records)"] || student?.["Mother's Name"] || '',
    'DoB': student?.dob || student?.["DoB (as per school records)"] || student?.['DoB (figures)'] || '',
    'Gender': student?.gender || student?.['Gender'] || 'Male',
    'Cat._JKBOSE': student?.category || student?.['Cat._JKBOSE'] || student?.['Category'] || 'General',
    'Religion': student?.religion || student?.['Religion'] || 'Muslim',
    'Village/Town': student?.village || student?.['Name of your village'] || student?.['Village/Town'] || 'Shangus',
    'Mobile No.': student?.mobile || student?.['Mobile No. (with working WhatsApp)'] || student?.["Student's Contact"] || '',
    "Parent's Contact": student?.parentContact || student?.["Parent's Contact"] || '',
    'Aadhar No.': student?.aadhar || student?.['Aadhar No.'] || '',

    'Subjects1': student?.subjects1 || student?.['Subjects1'] || '',
    'Subjects2': student?.subjects2 || student?.['Subjects2'] || '',
    'Subjects3': student?.subjects3 || student?.['Subjects3'] || '',
    'Subjects4': student?.subjects4 || student?.['Subjects4'] || '',
    'Subjects5': student?.subjects5 || student?.['Subjects5'] || '',
    'Subject6': student?.subjects6 || student?.['Subject6'] || '',

    'Bank Name': student?.bankName || student?.['Name of Bank'] || '',
    'Bank Account Number': student?.bankAccount || student?.['Bank Account No.'] || student?.['Bank Account Number'] || '',
    'IFSC Code': student?.ifsc || student?.['IFSC code'] || student?.['IFSC Code'] || '',
    'PEN No.': student?.penNo || student?.['PEN No.'] || '',
    'APAAR ID': student?.apaarId || student?.['APAAR ID'] || '',
    'Previous School': student?.prevSchool || student?.['Previous School'] || '',
    'Remarks': student?.remarks || student?.['Remarks'] || '',
  }));

  const handleChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-3xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-xs">
              <UserCheck size={22} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Edit Student Record</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-400/20 border border-amber-400/30 text-amber-200">
                  Form #{formData['Form Number'] || '—'}
                </span>
              </h2>
              <p className="text-xs text-amber-200/80 font-medium">
                Edits will save to Firestore & sync across all portal dashboards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-amber-200 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: 'basic', label: 'Personal & Family', icon: User },
            { id: 'academic', label: 'Academic & Roll', icon: BookOpen },
            { id: 'subjects', label: 'Subjects', icon: Layers },
            { id: 'banking', label: 'Bank & IDs', icon: Landmark }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-900'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-extrabold">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Student's Name (Full)</label>
                <input
                  type="text"
                  value={formData["Student's Name"]}
                  onChange={(e) => handleChange("Student's Name", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Father's / Guardian's Name</label>
                <input
                  type="text"
                  value={formData["Father's Name"]}
                  onChange={(e) => handleChange("Father's Name", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Mother's Name</label>
                <input
                  type="text"
                  value={formData["Mother's Name"]}
                  onChange={(e) => handleChange("Mother's Name", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Date of Birth (DD-MM-YYYY)</label>
                <input
                  type="text"
                  value={formData['DoB']}
                  onChange={(e) => handleChange('DoB', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Gender</label>
                <select
                  value={formData['Gender']}
                  onChange={(e) => handleChange('Gender', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Category</label>
                <select
                  value={formData['Cat._JKBOSE']}
                  onChange={(e) => handleChange('Cat._JKBOSE', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="General">General</option>
                  <option value="RBA">RBA</option>
                  <option value="ST">ST</option>
                  <option value="SC">SC</option>
                  <option value="OBC">OBC</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Village / Town</label>
                <input
                  type="text"
                  value={formData['Village/Town']}
                  onChange={(e) => handleChange('Village/Town', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Student Contact (WhatsApp)</label>
                <input
                  type="text"
                  value={formData['Mobile No.']}
                  onChange={(e) => handleChange('Mobile No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Parent's Contact</label>
                <input
                  type="text"
                  value={formData["Parent's Contact"]}
                  onChange={(e) => handleChange("Parent's Contact", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Aadhaar Number</label>
                <input
                  type="text"
                  value={formData['Aadhar No.']}
                  onChange={(e) => handleChange('Aadhar No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Form Number</label>
                <input
                  type="text"
                  value={formData['Form Number']}
                  onChange={(e) => handleChange('Form Number', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black flex items-center justify-between">
                  <span>Class</span>
                  {isFieldLocked('class') && <span className="text-[10px] text-rose-500 font-black">🔒 Field Locked</span>}
                </label>
                <select
                  value={formData['Class']}
                  disabled={isFieldLocked('class')}
                  onChange={(e) => handleChange('Class', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="9th">9th</option>
                  <option value="10th">10th</option>
                  <option value="11th">11th</option>
                  <option value="12th">12th</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Session</label>
                <input
                  type="text"
                  value={formData['Session']}
                  onChange={(e) => handleChange('Session', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Class Roll No.</label>
                <input
                  type="text"
                  value={formData['Class Roll No']}
                  onChange={(e) => handleChange('Class Roll No', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-teal-700 dark:text-teal-300 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Admission Number (Adm. No.)</label>
                <input
                  type="text"
                  value={formData['Adm. No.']}
                  onChange={(e) => handleChange('Adm. No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-amber-700 dark:text-amber-300 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Board Registration Number</label>
                <input
                  type="text"
                  value={formData['Board Registration Number']}
                  onChange={(e) => handleChange('Board Registration Number', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Status</label>
                <select
                  value={formData['Status']}
                  onChange={(e) => handleChange('Status', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Submitted">Submitted (SUBM)</option>
                  <option value="Approved">Approved (APPR)</option>
                  <option value="Provisional">Provisional</option>
                  <option value="Draft">Draft</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Stream</label>
                <select
                  value={formData['Stream']}
                  onChange={(e) => handleChange('Stream', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="General">General</option>
                  <option value="Science">Science (Medical/Non-Medical)</option>
                  <option value="Humanities">Humanities (Arts)</option>
                  <option value="Commerce">Commerce</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 1 (Core English)</label>
                <input
                  type="text"
                  value={formData['Subjects1']}
                  onChange={(e) => handleChange('Subjects1', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 2</label>
                <input
                  type="text"
                  value={formData['Subjects2']}
                  onChange={(e) => handleChange('Subjects2', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 3</label>
                <input
                  type="text"
                  value={formData['Subjects3']}
                  onChange={(e) => handleChange('Subjects3', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 4</label>
                <input
                  type="text"
                  value={formData['Subjects4']}
                  onChange={(e) => handleChange('Subjects4', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 5</label>
                <input
                  type="text"
                  value={formData['Subjects5']}
                  onChange={(e) => handleChange('Subjects5', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Subject 6 (Vocational / Elective)</label>
                <input
                  type="text"
                  value={formData['Subject6']}
                  onChange={(e) => handleChange('Subject6', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'banking' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Bank Name</label>
                <input
                  type="text"
                  value={formData['Bank Name']}
                  onChange={(e) => handleChange('Bank Name', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Bank Account Number</label>
                <input
                  type="text"
                  value={formData['Bank Account Number']}
                  onChange={(e) => handleChange('Bank Account Number', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">IFSC Code</label>
                <input
                  type="text"
                  value={formData['IFSC Code']}
                  onChange={(e) => handleChange('IFSC Code', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">PEN No.</label>
                <input
                  type="text"
                  value={formData['PEN No.']}
                  onChange={(e) => handleChange('PEN No.', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">APAAR ID</label>
                <input
                  type="text"
                  value={formData['APAAR ID']}
                  onChange={(e) => handleChange('APAAR ID', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Previous School</label>
                <input
                  type="text"
                  value={formData['Previous School']}
                  onChange={(e) => handleChange('Previous School', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-black">Remarks / Special Notes</label>
                <textarea
                  rows={2}
                  value={formData['Remarks']}
                  onChange={(e) => handleChange('Remarks', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-black text-xs shadow-lg hover:shadow-amber-900/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>Save & Apply System-Wide</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdvancedReports({ setActiveTab, viewScope = 'active', setViewScope, setCounts, user, onLogout, onSync, stats, initialData = [] }) {
  // Data States — Instant initialization from props or session cache
  const [loading, setLoading] = useState(() => {
    if (initialData.length > 0) return false;
    try {
      const cached = sessionStorage.getItem('hss_reports_cache_v2');
      if (cached) return false;
    } catch (_) {}
    return true;
  });
  const [masterRecords, setMasterRecords] = useState([]);
  const [currentAdmissions, setCurrentAdmissions] = useState(initialData); // seed from parent immediately
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSaveStudentEdit = async (updatedFields) => {
    try {
      setIsSavingEdit(true);

      const fNo = updatedFields['Form Number'] || updatedFields['Form No.'] || updatedFields.formNo;
      const cleanFNo = fNo ? String(fNo).replace(/^'/, '').trim() : '';

      const docId = cleanFNo ? cleanFNo : (editingStudent.id ? editingStudent.id.replace(/^(active_|hist_)/, '') : `doc_${Date.now()}`);
      const sanitizedDocId = docId.replace(/\//g, '_').toLowerCase();

      const payload = {
        ...updatedFields,
        updatedAt: new Date().toISOString(),
        lastEditedBy: 'Admin'
      };

      if (editingStudent._isCurrentScope || cleanFNo) {
        try {
          await setDoc(doc(db, 'admissions', sanitizedDocId), payload, { merge: true });
        } catch (err) {
          console.warn('Firestore write warning for admissions:', err.message);
        }
      }

      try {
        await setDoc(doc(db, 'masterRegisters', sanitizedDocId), payload, { merge: true });
      } catch (err) {
        console.warn('Firestore write warning for masterRegisters:', err.message);
      }

      if (updatedFields.email1 || updatedFields.email || cleanFNo) {
        const userDocId = (updatedFields.email1 || updatedFields.email || `form_${cleanFNo}`).toLowerCase().replace(/[^a-z0-9_@-]/g, '_');
        try {
          await setDoc(doc(db, 'users', userDocId), {
            studentName: updatedFields["Student's Name (as per school records)"] || updatedFields["Student's Name"] || updatedFields.studentName,
            classRollNo: updatedFields['Class Roll No'] || updatedFields.classRollNo,
            admNo: updatedFields['Adm. No.'] || updatedFields.admNo,
            boardRegNo: updatedFields['Board Registration Number'] || updatedFields.boardRegNo,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {}
      }

      updateCachedItem('admissions', docId, payload);
      try {
        const cachedRaw = sessionStorage.getItem('hss_reports_cache_v2');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          const updatedActive = (parsed.activeList || []).map(st => {
            const stFNo = String(st['Form Number'] || st['FormNo'] || st.formNo || '').replace(/^'/, '').trim();
            if ((cleanFNo && stFNo.toLowerCase() === cleanFNo.toLowerCase()) || st.id === editingStudent.id) {
              return { ...st, ...payload };
            }
            return st;
          });
          sessionStorage.setItem('hss_reports_cache_v2', JSON.stringify({ ...parsed, activeList: updatedActive }));
        }
      } catch (e) {}

      if (editingStudent._isCurrentScope) {
        setCurrentAdmissions(prev => prev.map(st => {
          const stFNo = String(st['Form Number'] || st['FormNo'] || st.formNo || '').replace(/^'/, '').trim();
          if ((cleanFNo && stFNo.toLowerCase() === cleanFNo.toLowerCase()) || st.id === editingStudent.id) {
            return { ...st, ...payload };
          }
          return st;
        }));
      } else {
        setMasterRecords(prev => prev.map(st => {
          const stFNo = String(st['Form No.'] || st['Form Number'] || st.formNo || '').replace(/^'/, '').trim();
          if ((cleanFNo && stFNo.toLowerCase() === cleanFNo.toLowerCase()) || st.id === editingStudent.id) {
            return { ...st, ...payload };
          }
          return st;
        }));
      }

      setEditingStudent(null);
      setToast({
        message: `✅ Student record for ${updatedFields["Student's Name (as per school records)"] || updatedFields["Student's Name"] || 'Student'} updated successfully across all portals!`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      console.error('Error saving student edits:', error);
      setToast({
        message: `❌ Failed to save student changes: ${error.message}`,
        type: 'error'
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ─── Quick Cell Edit Controls & Handlers ───
  const [enableQuickCellEdit, setEnableQuickCellEdit] = useState(false);
  const [quickEditCell, setQuickEditCell] = useState(null);
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);

  const handleSaveQuickCellEdit = async (student, colKey, newValue) => {
    try {
      setIsSavingQuickEdit(true);

      const fNo = student['Form Number'] || student['Form No.'] || student.formNo;
      const cleanFNo = fNo ? String(fNo).replace(/^'/, '').trim() : '';

      const docId = cleanFNo ? cleanFNo : (student.id ? student.id.replace(/^(active_|hist_)/, '') : `doc_${Date.now()}`);
      const sanitizedDocId = docId.replace(/\//g, '_').toLowerCase();

      const keyMap = {
        formNo: 'Form Number',
        classRollNo: 'Class Roll No',
        admNo: 'Adm. No.',
        boardRegNo: 'Board Registration Number',
        studentName: "Student's Name (as per school records)",
        fatherName: "Father's/Guardian's Name (as per school records)",
        motherName: "Mother's Name (as per school records)",
        dob: 'DoB (as per school records)',
        gender: 'Gender',
        category: 'Cat._JKBOSE',
        village: 'Name of your village',
        mobile: 'Mobile No. (with working WhatsApp)',
        aadhar: 'Aadhar No.',
        bankAccount: 'Bank Account No.',
        bankName: 'Name of Bank',
        ifsc: 'IFSC code',
        onlineSubmDate: 'Online Subm. Date',
        admDate: 'Adm. Date',
        boardName: 'Board Name',
        penNo: 'PEN No.',
        apaarId: 'APAAR ID',
        prevSchool: 'Previous School',
        remarks: 'Remarks'
      };

      const targetFieldName = keyMap[colKey] || colKey;
      const payload = {
        [targetFieldName]: newValue,
        updatedAt: new Date().toISOString(),
        lastEditedBy: 'Admin (Quick Cell)'
      };

      if (student._isCurrentScope || cleanFNo) {
        try {
          await setDoc(doc(db, 'admissions', sanitizedDocId), payload, { merge: true });
        } catch (e) {}
      }

      try {
        await setDoc(doc(db, 'masterRegisters', sanitizedDocId), payload, { merge: true });
      } catch (e) {}

      updateCachedItem('admissions', docId, payload);
      try {
        const cachedRaw = sessionStorage.getItem('hss_reports_cache_v2');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          const updatedActive = (parsed.activeList || []).map(st => {
            if ((cleanFNo && String(st['Form Number'] || st.formNo || '').replace(/^'/, '').trim().toLowerCase() === cleanFNo.toLowerCase()) || st.id === student.id) {
              return { ...st, [colKey]: newValue, [targetFieldName]: newValue };
            }
            return st;
          });
          sessionStorage.setItem('hss_reports_cache_v2', JSON.stringify({ ...parsed, activeList: updatedActive }));
        }
      } catch (e) {}

      if (student._isCurrentScope) {
        setCurrentAdmissions(prev => prev.map(st => {
          if ((cleanFNo && String(st['Form Number'] || st.formNo || '').replace(/^'/, '').trim().toLowerCase() === cleanFNo.toLowerCase()) || st.id === student.id) {
            return { ...st, [colKey]: newValue, [targetFieldName]: newValue };
          }
          return st;
        }));
      } else {
        setMasterRecords(prev => prev.map(st => {
          if ((cleanFNo && String(st['Form No.'] || st.formNo || '').replace(/^'/, '').trim().toLowerCase() === cleanFNo.toLowerCase()) || st.id === student.id) {
            return { ...st, [colKey]: newValue, [targetFieldName]: newValue };
          }
          return st;
        }));
      }

      setQuickEditCell(null);
      setToast({
        message: `✅ Updated ${targetFieldName} to "${newValue}"!`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Quick edit error:', err);
      setToast({ message: `❌ Quick edit failed: ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSavingQuickEdit(false);
    }
  };

  // Copy Cell / Row State & Handlers
  const [copiedCellId, setCopiedCellId] = useState(null);

  const handleCopyCell = (cellId, textValue) => {
    if (!textValue || textValue === '—') return;
    navigator.clipboard.writeText(String(textValue));
    setCopiedCellId(cellId);
    setTimeout(() => setCopiedCellId(null), 1500);
  };

  const handleCopyRow = (student) => {
    const rowValues = COLUMN_DEFS.filter(col => visibleCols[col.key])
      .map(col => {
        const val = student[col.key];
        return (val === undefined || val === null || val === '—') ? '' : String(val);
      })
      .join('\t');
    navigator.clipboard.writeText(rowValues);
    setCopiedCellId(`row_${student.id || student.sno}`);
    setTimeout(() => setCopiedCellId(null), 1500);
  };

  // Tools dropdown state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedGenders, setSelectedGenders] = useState([]);
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [sortBy, setSortBy] = useState('onlineSubmDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Layout & Density States (with LocalStorage Persistence)
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('hss_admin_table_density_v1') || 'compact';
    } catch {
      return 'compact';
    }
  });


  const DEFAULT_VISIBLE_COLS = {
    sno: true,
    formNo: true,
    status: true,
    classRollNo: true,
    admNo: true,
    class: true,
    session: true,
    boardRegNo: true,
    photoId: true,
    studentName: true,
    fatherName: true,
    motherName: false,
    dob: true,
    village: true,
    gender: true,
    stream: true,
    subs: true,
    mobile: true,
    category: false,
    aadhar: false,
    bankAccount: false,
    bankName: false,
    ifsc: false,
  };

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_admin_table_cols_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load saved layout cols', e);
    }
    return DEFAULT_VISIBLE_COLS;
  });

  const DEFAULT_RESTRICTED_COLS = {
    sno: true,
    status: true,
    formNo: true,
    admNo: true,
    session: true,
    photoId: true,
    subs: true,
    class: true, // Specifically locked per user request!
  };

  const [restrictedCols, setRestrictedCols] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_admin_restricted_cols_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load saved restricted cols', e);
    }
    return DEFAULT_RESTRICTED_COLS;
  });

  const toggleRestrictedCol = (colKey) => {
    setRestrictedCols(prev => {
      const updated = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem('hss_admin_restricted_cols_v1', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };
  const [colWidths, setColWidths] = useState(() => {
    try {
      const savedWidths = localStorage.getItem('hss_admin_table_widths_v2');
      if (savedWidths) return JSON.parse(savedWidths);
    } catch (e) {
      console.warn('Could not load saved Default 2 widths', e);
    }
    return DEFAULT_1_WIDTHS;
  });

  const [layoutNotice, setLayoutNotice] = useState(null);

  const handleResizeStart = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || DEFAULT_1_WIDTHS[colKey] || 100;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(45, startWidth + deltaX);
      setColWidths(prev => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Save current active columns, density & widths as Default 2 Preset
  const saveAsDefault2 = () => {
    try {
      localStorage.setItem('hss_admin_table_widths_v2', JSON.stringify(colWidths));
      localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(visibleCols));
      localStorage.setItem('hss_admin_table_density_v1', density);
      setLayoutNotice({ type: 'success', msg: 'Current column widths saved as Default 2 preset!' });
      setTimeout(() => setLayoutNotice(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset to original System Default 1 layout and widths
  const resetToDefault1 = () => {
    setColWidths(DEFAULT_1_WIDTHS);
    setVisibleCols(DEFAULT_VISIBLE_COLS);
    setDensity('fit');
    try {
      localStorage.removeItem('hss_admin_table_widths_v2');
      localStorage.removeItem('hss_admin_table_cols_v1');
      localStorage.removeItem('hss_admin_table_density_v1');
    } catch (err) {
      console.error(err);
    }
    setLayoutNotice({ type: 'reset', msg: 'Reset to System Default 1 widths & layout!' });
    setTimeout(() => setLayoutNotice(null), 3000);
  };

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [previewPhotoModal, setPreviewPhotoModal] = useState(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [colManagerTab, setColManagerTab] = useState('visibility'); // 'visibility' | 'restrictions'
  const [colSearchQuery, setColSearchQuery] = useState('');
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [activeToolsTab, setActiveToolsTab] = useState('assign_ids');
  const [showDirectIngestionModal, setShowDirectIngestionModal] = useState(false);

  // Global Custom Confirmation Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

  const handleDirectRecordAdded = (newRecord) => {
    setCurrentAdmissions(prev => [newRecord, ...prev]);
    setMasterRecords(prev => [newRecord, ...prev]);
    setToast({ message: `⚡ Direct Record Ingested for "${newRecord.studentName}"!`, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteStudent = (student) => {
    if (!student) return;
    const docId = String(student.id || student.formNo || student['Form Number']).replace(/^(active_|hist_)/, '');
    const nameDisplay = student.studentName || student["Student's Name (as per school records)"] || 'Student Record';

    setConfirmModalConfig({
      isOpen: true,
      type: 'danger',
      title: 'Permanent Application Deletion',
      message: `Are you sure you want to permanently delete the application record for "${nameDisplay}"?`,
      consequence: 'This action will permanently remove the student entry from all master database registers and local tables. This operation cannot be undone.',
      confirmText: '🔥 Confirm & Delete Application',
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        try {
          await deleteDoc(doc(db, 'admissions', docId));
          try { await deleteDoc(doc(db, 'masterRegisters', docId)); } catch (e) {}

          await logAdminActivity({
            actionType: 'delete',
            actionTitle: 'Deleted Student Application',
            details: `Permanently deleted application record for "${nameDisplay}" (ID: ${docId})`,
            reasonCategory,
            customReason,
            metadata: { docId, studentName: nameDisplay }
          });

          setCurrentAdmissions(prev => prev.filter(s => String(s.id || s.formNo).replace(/^(active_|hist_)/, '') !== docId));
          setMasterRecords(prev => prev.filter(s => String(s.id || s.formNo).replace(/^(active_|hist_)/, '') !== docId));
          setToast({ message: `🗑️ Deleted application record for "${nameDisplay}"`, type: 'error' });
          setTimeout(() => setToast(null), 3000);
        } catch (err) {
          console.error('Delete student error:', err);
          setToast({ message: `❌ Delete failed: ${err.message}`, type: 'error' });
        } finally {
          setConfirmModalConfig(null);
        }
      }
    });
  };

  const handleClearCellField = (student, col) => {
    if (!student || !col) return;
    const colKey = col.key;
    const colLabel = col.label || colKey;
    const cleanFNo = String(student['Form Number'] || student['Form No.'] || student.formNo || '').replace(/^'/, '').trim();
    const docId = cleanFNo ? cleanFNo : (student.id ? student.id.replace(/^(active_|hist_)/, '') : `doc_${Date.now()}`);
    const sanitizedDocId = docId.replace(/\//g, '_').toLowerCase();
    const nameDisplay = student.studentName || student["Student's Name (as per school records)"] || 'Student';

    setConfirmModalConfig({
      isOpen: true,
      type: 'warning',
      title: `Clear ${colLabel}`,
      message: `Are you sure you want to clear/reset the value for "${colLabel}" for ${nameDisplay}?`,
      consequence: `This will clear only the "${colLabel}" field value without deleting the student's main admission record.`,
      confirmText: `Clear ${colLabel}`,
      cancelText: 'Cancel',
      onConfirm: async ({ reasonCategory, customReason } = {}) => {
        try {
          const keyMap = {
            formNo: 'Form Number',
            classRollNo: 'Class Roll No',
            admNo: 'Adm. No.',
            boardRegNo: 'Board Registration Number',
            studentName: "Student's Name (as per school records)",
            fatherName: "Father's/Guardian's Name (as per school records)",
            motherName: "Mother's Name (as per school records)",
            dob: 'DoB (as per school records)',
            gender: 'Gender',
            category: 'Cat._JKBOSE',
            village: 'Name of your village',
            mobile: 'Mobile No. (with working WhatsApp)',
            aadhar: 'Aadhar No.',
            bankAccount: 'Bank Account No.',
            bankName: 'Name of Bank',
            ifsc: 'IFSC code',
            onlineSubmDate: 'Online Subm. Date',
            admDate: 'Adm. Date',
            boardName: 'Board Name',
            penNo: 'PEN No.',
            apaarId: 'APAAR ID',
            prevSchool: 'Previous School',
            remarks: 'Remarks'
          };
          const targetFieldName = keyMap[colKey] || colKey;
          const payload = {
            [targetFieldName]: '',
            [colKey]: '',
            updatedAt: new Date().toISOString(),
            lastEditedBy: 'Admin (Field Reset)'
          };

          if (student._isCurrentScope || cleanFNo) {
            try { await setDoc(doc(db, 'admissions', sanitizedDocId), payload, { merge: true }); } catch (e) {}
          }
          try { await setDoc(doc(db, 'masterRegisters', sanitizedDocId), payload, { merge: true }); } catch (e) {}

          await logAdminActivity({
            actionType: 'cell_clear',
            actionTitle: `Cleared Field "${colLabel}"`,
            details: `Cleared field "${colLabel}" for "${nameDisplay}" (ID: ${docId})`,
            reasonCategory,
            customReason,
            metadata: { docId, colKey, colLabel, studentName: nameDisplay }
          });

          updateCachedItem('admissions', docId, payload);

          if (student._isCurrentScope) {
            setCurrentAdmissions(prev => prev.map(st => st.id === student.id ? { ...st, [colKey]: '', [targetFieldName]: '' } : st));
          } else {
            setMasterRecords(prev => prev.map(st => st.id === student.id ? { ...st, [colKey]: '', [targetFieldName]: '' } : st));
          }

          setToast({ message: `🧹 Cleared ${colLabel} field for ${nameDisplay}`, type: 'success' });
          setTimeout(() => setToast(null), 3000);
        } catch (err) {
          console.error('Clear cell field error:', err);
          setToast({ message: `❌ Clear field failed: ${err.message}`, type: 'error' });
        } finally {
          setConfirmModalConfig(null);
        }
      }
    });
  };
  
  // ID Assigner & Tools Suite States
  const [assignStartId, setAssignStartId] = useState('5476');
  const [assigningIds, setAssigningIds] = useState(false);
  const [assignDateValue, setAssignDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [assignDateField, setAssignDateField] = useState('admDate');
  const [batchEditField, setBatchEditField] = useState('status');
  const [batchEditValue, setBatchEditValue] = useState('Approved');
  const [toolExecuting, setToolExecuting] = useState(false);

  // Photo Manager States
  const [photoBatchFiles, setPhotoBatchFiles] = useState([]);
  const [photoMatchResults, setPhotoMatchResults] = useState([]);
  const [batchSyncingPhotos, setBatchSyncingPhotos] = useState(false);

  // Fetch Master Registers & Current Admissions with instant cache + silent background sync
  const loadReportsData = async (forceRefresh = false) => {
    let hasCache = false;

    // 1. Instant Cache Load
    try {
      const cachedRaw = sessionStorage.getItem('hss_reports_cache_v2');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed.activeList && parsed.activeList.length > 0) {
          setCurrentAdmissions(parsed.activeList);
          setMasterRecords(parsed.historicalList || []);
          if (setCounts) {
            setCounts({
              active: (parsed.activeList || []).length,
              total: (parsed.activeList || []).length + (parsed.historicalList || []).length
            });
          }
          setLoading(false);
          hasCache = true;
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }

    // If no cache or force refresh, show loader only if we have zero data
    if (!hasCache && currentAdmissions.length === 0) {
      setLoading(true);
    }

    // 2. Silent Background Synchronization
    let activeList = [];
    let historicalList = [];

    try {
      const admSnap = await getDocs(collection(db, 'admissions'));
      if (!admSnap.empty) {
        activeList = admSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isCurrentSession: true }));
      }

      try {
        const masterSnap = await getDocs(collection(db, 'masterRegisters'));
        if (!masterSnap.empty) {
          masterSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.items && Array.isArray(data.items)) {
              const parsedItems = data.items.map(it => ({
                Session: it['Session'] || data.groupKey?.split('_')[0] || docSnap.id.split('_')[0] || 'Historical',
                ...it
              }));
              historicalList = historicalList.concat(parsedItems);
            } else if (Array.isArray(data)) {
              historicalList = historicalList.concat(data);
            } else if (data.data && Array.isArray(data.data)) {
              historicalList = historicalList.concat(data.data);
            } else {
              historicalList.push(data);
            }
          });
        }
      } catch (err) {
        console.warn('Firestore masterRegisters read note:', err);
      }
    } catch (err) {
      console.warn('Firestore loadReportsData note:', err);
    }

    // Save to Session Storage Cache (sanitize large strings & images to prevent QuotaExceededError)
    try {
      const sanitizeItem = (item) => {
        if (!item || typeof item !== 'object') return item;
        const copy = {};
        // Retain essential report metadata fields only
        Object.keys(item).forEach(k => {
          const val = item[k];
          if (typeof val === 'string') {
            if (val.startsWith('data:') || val.length > 500) return; // Skip base64 images and large strings
          }
          if (Array.isArray(val) && val.length > 20) return; // Skip large nested arrays
          copy[k] = val;
        });
        return copy;
      };

      const liteActive = (activeList || []).map(sanitizeItem);
      const liteHist = (historicalList || []).map(sanitizeItem);
      const payloadStr = JSON.stringify({ activeList: liteActive, historicalList: liteHist });

      if (payloadStr.length < 3000000) { // Only set if < 3MB
        sessionStorage.setItem('hss_reports_cache_v2', payloadStr);
        sessionStorage.setItem('hss_reports_cache_time_v2', String(Date.now()));
      }
    } catch (e) {
      // Silently catch QuotaExceededError to prevent console noise
      try {
        sessionStorage.removeItem('hss_reports_cache_v2');
      } catch (err) {}
    }

    setCurrentAdmissions(activeList);
    setMasterRecords(historicalList);
    if (setCounts) {
      setCounts({
        active: activeList.length,
        total: activeList.length + historicalList.length
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    // If parent provided fresh data, only load historical (masterRegisters) not admissions
    if (initialData.length > 0) {
      // Seed counts from initialData
      if (setCounts) setCounts({ active: initialData.length, total: initialData.length });
      // Still need masterRegisters — run loadReportsData but skip admissions re-fetch
      loadReportsData();
    } else {
      loadReportsData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combined Dataset
  const allStudents = useMemo(() => {
    const combined = [];
    
    const cleanFormNo = (val) => {
      if (!val || val === '—') return '—';
      return String(val).replace(/^'/, '').trim();
    };

    const formatStudentSubjects = (rec) => {
      if (!rec) return '—';

      // 1. Array or String Subject fields across classes & forms
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
        rec['selectedSubjects'] ||
        rec['Subjects'] ||
        rec['subjects'] ||
        rec['Subs'] ||
        rec['subs'];

      if (Array.isArray(subjectArrayOrStr) && subjectArrayOrStr.length > 0) {
        const cleaned = subjectArrayOrStr.filter(s => s && String(s).trim() !== '—').map(s => String(s).trim());
        if (cleaned.length > 0) return cleaned.join(', ');
      }

      if (typeof subjectArrayOrStr === 'string' && subjectArrayOrStr.trim() && subjectArrayOrStr.trim() !== '—') {
        return subjectArrayOrStr.trim();
      }

      // 2. Individual subjects1..6 fields (Subjects1, Subjects2, Subjects3, etc.)
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

      return '—';
    };

    const cleanRegNoVal = (val) => {
      if (val === null || val === undefined) return '';
      let s = String(val).trim();
      if (!s || /^(N\/A|#N\/A|—|-|null|undefined)$/i.test(s)) return '';

      if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s) || typeof val === 'number') {
        try {
          const num = Number(s);
          if (!isNaN(num) && num > 0 && typeof window !== 'undefined' && typeof window.BigInt === 'function') {
            s = window.BigInt(Math.round(num)).toString();
          } else {
            const match = s.match(/^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
            if (match) {
              let intPart = match[1];
              let decPart = match[2] || '';
              let exponent = parseInt(match[3], 10);
              if (exponent > 0) {
                s = decPart.length <= exponent ? intPart + decPart + '0'.repeat(exponent - decPart.length) : intPart + decPart.slice(0, exponent) + '.' + decPart.slice(exponent);
              }
            }
          }
        } catch (_) {}
      }

      return s.replace(/\.0+$/, '');
    };

    const extractRegNo = (st) => {
      if (!st) return '';
      const raw = String(
        st['Board Registration Number'] ||
        st['Board Registration No. (Class 11th)'] ||
        st['Board Registration No. (Class 10th)'] ||
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
      ).replace(/^(N\/A|—)$/i, '').trim();

      return cleanRegNoVal(raw);
    };

    const extractClassRoll = (st) => {
      if (!st) return '';
      return String(
        st['Class Roll No'] || 
        st['Class Roll No.'] || 
        st['Class R.No.'] || 
        st.classRollNo || 
        st.rollNo || 
        st['Roll No.'] || 
        st['Roll No'] || 
        ''
      ).replace(/^(N\/A|—)$/i, '').trim();
    };

    const getStudentName = (st) => {
      if (!st) return '';
      return String(
        st["Student's Name (as per school records)"] ||
        st["Student's Name"] ||
        st['Student Name'] ||
        st['Name of Student'] ||
        st['Account Name'] ||
        st.studentName ||
        st['Name'] ||
        st['name'] ||
        ''
      ).replace(/^(N\/A|—)$/i, '').trim();
    };

    const getFatherName = (st) => {
      if (!st) return '';
      return String(
        st["Father's/Guardian's Name (as per school records)"] ||
        st["Father's Name"] ||
        st['Father Name'] ||
        st.fatherName ||
        st["Parent's Name"] ||
        ''
      ).replace(/^(N\/A|—)$/i, '').trim();
    };

    const extractRegNoClean = (st) => {
      const raw = extractRegNo(st);
      if (!raw || raw === '—') return '';
      return raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    };

    // ─── GLOBAL STUDENT IDENTITY INDEX ───
    // Multi-key registry mapping students across 9th-12th classes to their allotted Adm Nos and details
    const admNoSetByIdentity = new Map();
    const oldAdmNoByIdentity = new Map();
    const masterRecordByIdentity = new Map();

    const getIdentityKeys = (rec) => {
      const keys = [];
      const reg = extractRegNoClean(rec);
      const sName = getStudentName(rec).toLowerCase();
      const fName = getFatherName(rec).toLowerCase();
      const fNo = cleanFormNo(rec['Form Number'] || rec['FormNo'] || rec['Form No.'] || rec.formNo);

      if (reg && reg.length > 5) {
        keys.push(`reg_${reg}`);
      }
      if (sName && sName !== 'student' && sName.length > 2) {
        const fatherPart = fName && fName !== '—' ? fName.slice(0, 8) : '';
        keys.push(`name_${sName}_${fatherPart}`);
      }
      if (fNo && fNo !== '—' && fNo.length > 2) {
        keys.push(`form_${fNo.toLowerCase()}`);
      }
      return keys;
    };

    // PASS 1: Scan ALL records (currentAdmissions + masterRecords) to index identities & adm numbers
    const allRawDocs = [...masterRecords, ...currentAdmissions];

    allRawDocs.forEach(rec => {
      const keys = getIdentityKeys(rec);
      const rawAdm = extractRawAdmNo(rec);
      const cleanedAdm = cleanAdmNoVal(rawAdm);

      const rawOldAdm = cleanAdmNoVal(
        rec['Old Admission No.'] || rec['Old Adm. No.'] || rec['oldAdmNo'] || rec['Previous Adm. No.']
      );

      keys.forEach(k => {
        if (!admNoSetByIdentity.has(k)) admNoSetByIdentity.set(k, new Set());
        if (cleanedAdm) admNoSetByIdentity.get(k).add(cleanedAdm);

        if (!oldAdmNoByIdentity.has(k)) oldAdmNoByIdentity.set(k, new Set());
        if (rawOldAdm) oldAdmNoByIdentity.get(k).add(rawOldAdm);

        if (!masterRecordByIdentity.has(k)) {
          masterRecordByIdentity.set(k, rec);
        }
      });
    });

    // PASS 2: Helper to resolve final formatted Adm No for ANY record (with 9th/11th inheritance & re-admission formatting)
    const resolveAdmNo = (rec) => {
      const directFormat = formatStudentAdmNo(rec);
      if (directFormat && directFormat !== '—' && directFormat.length > 0) return directFormat;

      const keys = getIdentityKeys(rec);

      const collectedAdms = new Set();
      const collectedOldAdms = new Set();

      keys.forEach(k => {
        const adms = admNoSetByIdentity.get(k);
        if (adms) adms.forEach(a => collectedAdms.add(a));

        const oldAdms = oldAdmNoByIdentity.get(k);
        if (oldAdms) oldAdms.forEach(a => collectedOldAdms.add(a));
      });

      const admsList = Array.from(collectedAdms);
      const oldAdmsList = Array.from(collectedOldAdms);

      if (admsList.length === 0 && oldAdmsList.length === 0) return '—';

      const isRe = 
        String(rec['readmission'] || rec['Re-admission'] || rec['isReadmission'] || '').toLowerCase() === 'yes' ||
        rec['readmission'] === true;

      const oldAdmVal = oldAdmsList[0] || (admsList.length > 1 ? admsList[0] : null);
      const newAdmVal = admsList.length > 0 ? admsList[admsList.length - 1] : oldAdmVal;

      if ((isRe || oldAdmsList.length > 0 || admsList.length > 1) && oldAdmVal && newAdmVal && oldAdmVal !== newAdmVal) {
        return `${newAdmVal} (${oldAdmVal})`;
      }

      return newAdmVal || oldAdmVal || '—';
    };

    // Helper to find rich master record for any active admission
    const resolveMasterMatch = (rec) => {
      const keys = getIdentityKeys(rec);
      for (const k of keys) {
        const match = masterRecordByIdentity.get(k);
        if (match) return match;
      }
      return null;
    };

    // Process active admissions (with full identity inheritance & duplicate form pruning)
    const activeSeenIdentities = new Set();
    const sortedActive = [...currentAdmissions].sort((a1, a2) => {
      const num1 = parseInt(cleanFormNo(a1['Form Number'] || a1['FormNo'] || a1['formNumber']), 10) || 0;
      const num2 = parseInt(cleanFormNo(a2['Form Number'] || a2['FormNo'] || a2['formNumber']), 10) || 0;
      return num2 - num1; // Newest form first
    });

    sortedActive.forEach((a, idx) => {
      const regClean = extractRegNoClean(a);
      const nameClean = getStudentName(a).toLowerCase();
      const fnameClean = getFatherName(a).toLowerCase();
      const clsClean = String(a['Admission sought for class'] || a['Class'] || '').trim().toLowerCase();
      const sessClean = String(a['Session'] || '').trim().toLowerCase();

      let dupKey = '';
      if (regClean && regClean !== '—' && !regClean.endsWith('00000000')) {
        dupKey = `reg_${regClean}`;
      } else if (nameClean && fnameClean) {
        dupKey = `identity_${clsClean}_${sessClean}_${nameClean}_${fnameClean}`;
      }

      if (dupKey) {
        if (activeSeenIdentities.has(dupKey)) {
          return; // Skip duplicate older form entry for same student
        }
        activeSeenIdentities.add(dupKey);
      }

      const formNoRaw = a['Form Number'] || a['FormNo'] || a['formNumber'] || '—';
      const cleanFNo = cleanFormNo(formNoRaw);
      const masterMatch = resolveMasterMatch(a);
      // Active admission form fields MUST take precedence over historical master records!
      const mergedRec = masterMatch ? { ...masterMatch, ...a } : a;
      const finalAdmNo = resolveAdmNo(a) !== '—' ? resolveAdmNo(a) : resolveAdmNo(mergedRec);

      const regFromMaster = masterMatch ? extractRegNo(masterMatch) : '';
      const regFromActive = extractRegNo(a);
      let finalBoardRegNo = regFromActive;
      if (regFromMaster && regFromMaster !== '—') {
        if (!regFromActive || regFromActive === '—' || regFromActive.endsWith('00000000') || regFromMaster !== regFromActive) {
          finalBoardRegNo = regFromMaster;
        }
      }
      if (!finalBoardRegNo) finalBoardRegNo = '—';

      const submFromMaster = masterMatch ? (masterMatch['Online Subm. Date'] || masterMatch['submittedAt']) : '';
      const submFromActive = a['Online Subm. Date'] || a['submittedAt'];
      const finalOnlineSubmDate = (submFromMaster && submFromMaster !== '—') ? submFromMaster : (submFromActive || '—');

      const activeClassRoll = extractClassRoll(a) || (masterMatch ? extractClassRoll(masterMatch) : '');
      const activeRawStatus = a['Status'] || a['status'] || masterMatch?.['Status'] || 'Submitted';
      const activeResolvedStatus = (activeClassRoll && activeClassRoll !== '—') ? 'Approved' : (activeRawStatus === 'APPR' ? 'Approved' : activeRawStatus);

      combined.push({
        ...mergedRec,
        _isCurrentScope: true,
        id: a['Form Number'] ? `active_${a['Form Number']}` : `adm_${idx}`,
        sno: idx + 1,
        formNo: cleanFNo || '—',
        classRollNo: activeClassRoll,
        admNo: finalAdmNo,
        class: a['Admission sought for class'] || a['Class'] || (masterMatch ? masterMatch['Class'] : '') || '11th',
          session: a['Session'] || (masterMatch ? masterMatch['Session'] : '') || '2025-26',
          boardRegNo: finalBoardRegNo,
          studentName: masterMatch?.["Student's Name"] || a["Student's Name (as per school records)"] || a["Student's Name"] || a['Account Name'] || 'Student',
          fatherName: masterMatch?.["Father's Name"] || a["Father's/Guardian's Name (as per school records)"] || a["Father's Name"] || '—',
          motherName: masterMatch?.["Mother's Name"] || a["Mother's Name (as per school records)"] || a["Mother's Name"] || '—',
          dob: masterMatch?.["DoB (figures)"] || a["DoB (as per school records)"] || a['DoB (figures)'] || '—',
          village: a['Name of your village'] || a['Village/Town'] || 'Shangus',
          gender: a['Gender'] || '—',
          category: a['Cat._JKBOSE'] || a['Category'] || a['Social Category'] || 'General',
          status: activeResolvedStatus,
        stream: a['Stream for Class 11th'] || a['Stream'] || 'General',
        subs: formatStudentSubjects(a) !== '—' ? formatStudentSubjects(a) : formatStudentSubjects(mergedRec),
        mobile: a['Mobile No. (with working WhatsApp)'] || a["Student's Contact"] || a['Account Mobile'] || '—',
        aadhar: a['Aadhar No.'] || '—',
        bankAccount: a['Bank Account No.'] || a['Bank Account Number'] || '—',
        bankName: a['Name of Bank'] || a['Bank Name'] || '—',
        ifsc: a['IFSC code'] || a['IFSC Code'] || '—',

        onlineSubmDate: finalOnlineSubmDate,
        admDate: a['Adm. Date'] || '—',
        boardName: a['Board Name'] || a['Board Name (Class 10th)'] || '—',
        dobWords: a['DoB (words)'] || a['DoB (in words)'] || '—',
        block: a['Block'] || '—',
        tehsil: a['Tehsil'] || '—',
        district: a['District'] || '—',
        pinCode: a['PIN code'] || a['Pin Code'] || '—',
        state: a['State/UT'] || a['State'] || '—',
        residence: a['Residence (Village, District)'] || '—',
        religion: a['Religion'] || '—',
        disabilityStatus: a['Disability Status'] || '—',
        disabilityType: a['Disability Type'] || '—',
        subjects1: a['Subjects1'] || '—',
        subjects2: a['Subjects2'] || '—',
        subjects3: a['Subjects3'] || '—',
        subjects4: a['Subjects4'] || '—',
        subjects5: a['Subjects5'] || '—',
        subjects6: a['Subject6'] || '—',
        email1: a['email1'] || a['Email'] || '—',
        email2: a['email2'] || '—',
        parentContact: a["Parent's Contact"] || a["Father's Mobile No."] || '—',
        bloodType: a['Blood Type'] || a['Blood Group'] || '—',
        height: a['Height (cm)'] || a['Height'] || '—',
        weight: a['Weight (kg)'] || a['Weight'] || '—',
        socialCategory: a['Social category'] || '—',
        socioEconomicCategory: a['Socio-economic category'] || '—',
        houseNo: a['House No.'] || '—',
        vocationalPercentage: a['Vocational %age'] || '—',
        prevComplexHead: a['Previous Complex Head'] || '—',
        penNo: a['PEN No.'] || '—',
        prevSchool: a['Previous School'] || a['Name of the Institution last attended'] || '—',
        prevCcDc: a['CC/DC No. & Date (Prev. insitution)'] || '—',
        prevExamMode: a['Exam Mode (Prev.)'] || '—',
        prevExamRollNo: a['Exam R.No. (Prev.)'] || a['Roll No. (Class 10th)'] || '—',
        prevMarksObt: a['Marks Obt. (Prev.)'] || a['Marks Obtained (Class 10th)'] || '—',
        prevMaxMarks: a['Max. Marks (Prev.)'] || a['Max Marks (Class 10th)'] || '—',
        prevPercentage: a['%age (Prev.)'] || a['Percentage (Class 10th)'] || '—',
        prevDivision: a['Div/Distinc (Prev.)'] || '—',
        currExamMode: a['Exam Mode (Current)'] || '—',
        currExamRollNo: a['Exam R.No. (Current)'] || '—',
        currResult: a['Result (Current)'] || '—',
        currMarksReapp: a['Marks/Reapp (Current)'] || '—',
        withdrawalDate: a['Date of withdrawl'] || '—',
        currCcDc: a['No. & Date of CC/DC Issued (This Institution)'] || '—',
        remarks: a['Remarks'] || '—',
        photoId: a['photo_id'] || '—',
        pdfUrl: a['PDF_URL'] || '—',
        readmission: a['readmission'] || '—',
        apaarId: a['APAAR ID'] || '—',
      });
    });

    // Index active admission form numbers and class roll numbers for deduplication
    const activeFormSet = new Set();
    const activeClassRollSet = new Set();

    currentAdmissions.forEach((a) => {
      const fNo = cleanFormNo(a['Form Number'] || a['FormNo'] || a['formNumber']);
      if (fNo && fNo !== '—') activeFormSet.add(fNo.toLowerCase());

      const cls = a['Admission sought for class'] || a['Class'] || '11th';
      const sess = a['Session'] || '2025-26';
      const roll = extractClassRoll(a);
      if (roll && roll !== '—') {
        activeClassRollSet.add(`${cls}_${sess}_${roll}`.toLowerCase());
      }
    });

    // Process historical master registers (skipping rows that duplicate active admissions)
    masterRecords.forEach((h, idx) => {
      const formNoRaw = h['Form No.'] || h['Form Number'] || h['FormNo'] || h.formNo || '—';
      const cleanFNo = cleanFormNo(formNoRaw);

      if (cleanFNo && cleanFNo !== '—' && activeFormSet.has(cleanFNo.toLowerCase())) {
        return; // Skip duplicate record already represented in active admissions
      }

      const cls = h['Class'] || '';
      const sess = h['Session'] || '';
      const roll = extractClassRoll(h);
      if (cls && sess && roll && activeClassRollSet.has(`${cls}_${sess}_${roll}`.toLowerCase())) {
        return; // Skip duplicate record with matching class, session, and class roll number
      }

      combined.push({
        ...h,
        _isCurrentScope: false,
        id: `hist_${idx}`,
        sno: combined.length + 1,
        formNo: cleanFormNo(formNoRaw),
        classRollNo: extractClassRoll(h),
        admNo: resolveAdmNo(h),
        class: h['Class'] || '—',
        session: h['Session'] || '—',
        boardRegNo: extractRegNo(h),
        studentName: h["Student's Name"] || h['Name'] || '—',
        fatherName: h["Father's Name"] || '—',
        motherName: h["Mother's Name"] || '—',
        dob: h['DoB (figures)'] || h['DoB'] || '—',
        village: h['Village/Town'] || h['Residence'] || '—',
        gender: h['Gender'] || '—',
        category: h['Cat._JKBOSE'] || h['Category'] || 'General',
        status: h['Status'] || 'Approved',
        stream: h['Stream'] || 'General',
        subs: formatStudentSubjects(h),
        mobile: h["Student's Contact"] || h['Mobile'] || '—',
        aadhar: h['Aadhar No.'] || '—',
        bankAccount: h['Bank Account Number'] || '—',
        bankName: h['Bank Name'] || '—',
        ifsc: h['IFSC Code'] || '—',

        onlineSubmDate: h['Online Subm. Date'] || '—',
        admDate: h['Adm. Date'] || '—',
        boardName: h['Board Name'] || '—',
        dobWords: h['DoB (words)'] || '—',
        block: h['Block'] || '—',
        tehsil: h['Tehsil'] || '—',
        district: h['District'] || '—',
        pinCode: h['PIN code'] || '—',
        state: h['State/UT'] || '—',
        residence: h['Residence (Village, District)'] || '—',
        religion: h['Religion'] || '—',
        disabilityStatus: h['Disability Status'] || '—',
        disabilityType: h['Disability Type'] || '—',
        subjects1: h['Subjects1'] || '—',
        subjects2: h['Subjects2'] || '—',
        subjects3: h['Subjects3'] || '—',
        subjects4: h['Subjects4'] || '—',
        subjects5: h['Subjects5'] || '—',
        subjects6: h['Subject6'] || '—',
        email1: h['email1'] || '—',
        email2: h['email2'] || '—',
        parentContact: h["Parent's Contact"] || '—',
        bloodType: h['Blood Type'] || '—',
        height: h['Height (cm)'] || '—',
        weight: h['Weight (kg)'] || '—',
        socialCategory: h['Social category'] || '—',
        socioEconomicCategory: h['Socio-economic category'] || '—',
        houseNo: h['House No.'] || '—',
        vocationalPercentage: h['Vocational %age'] || '—',
        prevComplexHead: h['Previous Complex Head'] || '—',
        penNo: h['PEN No.'] || '—',
        prevSchool: h['Previous School'] || '—',
        prevCcDc: h['CC/DC No. & Date (Prev. insitution)'] || '—',
        prevExamMode: h['Exam Mode (Prev.)'] || '—',
        prevExamRollNo: h['Exam R.No. (Prev.)'] || '—',
        prevMarksObt: h['Marks Obt. (Prev.)'] || '—',
        prevMaxMarks: h['Max. Marks (Prev.)'] || '—',
        prevPercentage: h['%age (Prev.)'] || '—',
        prevDivision: h['Div/Distinc (Prev.)'] || '—',
        currExamMode: h['Exam Mode (Current)'] || '—',
        currExamRollNo: h['Exam R.No. (Current)'] || '—',
        currResult: h['Result (Current)'] || '—',
        currMarksReapp: h['Marks/Reapp (Current)'] || '—',
        withdrawalDate: h['Date of withdrawl'] || '—',
        currCcDc: h['No. & Date of CC/DC Issued (This Institution)'] || '—',
        remarks: h['Remarks'] || '—',
        photoId: h['photo_id'] || '—',
        pdfUrl: h['PDF_URL'] || '—',
        readmission: h['readmission'] || '—',
        apaarId: h['APAAR ID'] || '—',
      });
    });

    combined.forEach(st => {
      st._openEditModal = (target) => setEditingStudent(target || st);
      st._setSelectedApp = (target) => setSelectedApp(target || st);
    });

    return combined;
  }, [currentAdmissions, masterRecords]);

  // Dynamic Dropdown Lists extracted directly from database records
  const availableSessions = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => { if (s.session && s.session !== '—') set.add(s.session); });
    return Array.from(set).sort();
  }, [allStudents]);

  const availableClasses = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => { if (s.class && s.class !== '—') set.add(s.class); });
    return Array.from(set).sort();
  }, [allStudents]);

  const availableGenders = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => { if (s.gender && s.gender !== '—') set.add(s.gender); });
    return Array.from(set).sort();
  }, [allStudents]);

  const availableStreams = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => { if (s.stream && s.stream !== '—') set.add(s.stream); });
    return Array.from(set).sort();
  }, [allStudents]);

  const availableCategories = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => { if (s.category && s.category !== '—') set.add(s.category); });
    return Array.from(set).sort();
  }, [allStudents]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => { if (s.status && s.status !== '—') set.add(s.status); });
    return Array.from(set).sort();
  }, [allStudents]);

  // Target dataset depending on viewScope ('all' vs 'active')
  const targetDataset = useMemo(() => {
    if (viewScope === 'active') {
      return allStudents.filter(s => s._isCurrentScope === true);
    }
    return allStudents;
  }, [allStudents, viewScope]);

  // Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    const list = targetDataset.filter(s => {
      const q = searchTerm.toLowerCase().trim();
      const safe = (v) => String(v ?? '').toLowerCase();
      const matchesSearch = !q ||
        safe(s.studentName).includes(q) ||
        safe(s.fatherName).includes(q) ||
        safe(s.boardRegNo).includes(q) ||
        safe(s.formNo).includes(q) ||
        safe(s.classRollNo).includes(q) ||
        safe(s.mobile).includes(q) ||
        safe(s.admNo).includes(q) ||
        safe(s.aadhar).includes(q);

      // Strict exact string matching for Sessions, Streams, Gender, Categories
      const matchesExact = (sel, val) => {
        if (!sel || sel.length === 0) return true;
        if (sel.includes('__NONE__')) return false;
        const strVal = String(val ?? '').trim().toLowerCase();
        return sel.some(item => String(item ?? '').trim().toLowerCase() === strVal);
      };

      // Class matching allowing '11th' vs 'Class 11th'
      const matchesClass = (sel, val) => {
        if (!sel || sel.length === 0) return true;
        if (sel.includes('__NONE__')) return false;
        const strVal = String(val ?? '').trim().toLowerCase();
        const cleanVal = strVal.replace(/class/gi, '').trim();

        return sel.some(item => {
          const strItem = String(item ?? '').trim().toLowerCase();
          const cleanItem = strItem.replace(/class/gi, '').trim();
          if (cleanItem === cleanVal) return true;
          const d1 = cleanItem.match(/\d+/)?.[0];
          const d2 = cleanVal.match(/\d+/)?.[0];
          return !!(d1 && d2 && d1 === d2);
        });
      };

      const matchesStatus = (sel, s) => {
        if (!sel || sel.length === 0) return true;
        if (sel.includes('__NONE__')) return false;

        const roll = String(s.classRollNo || '').trim();
        const stat = String(s.status || '').trim().toLowerCase();
        const hasRollNo = roll && roll !== '—' && roll !== 'N/A' && roll !== 'null' && roll !== 'undefined';

        return sel.some(item => {
          const strItem = String(item ?? '').trim().toLowerCase();
          if (strItem === 'approved') {
            return hasRollNo || stat === 'approved' || stat === 'appr' || stat === 'appr.';
          }
          if (strItem === 'submitted') {
            return !hasRollNo && (stat === 'submitted' || stat === 'subm');
          }
          if (strItem === 'draft') {
            return !hasRollNo && stat === 'draft';
          }
          if (strItem === 'provisional') {
            return stat === 'provisional' || stat === 'prov';
          }
          if (strItem === 'rejected') {
            return stat === 'rejected' || stat === 'rejt';
          }
          return strItem === stat;
        });
      };

      const matchesSessionVal = matchesExact(selectedSessions, s.session);
      const matchesClassVal = matchesClass(selectedClasses, s.class);
      const matchesGenderVal = matchesExact(selectedGenders, s.gender);
      const matchesStreamVal = matchesExact(selectedStreams, s.stream);
      const matchesCategoryVal = matchesExact(selectedCategories, s.category);
      const matchesStatusVal = matchesStatus(selectedStatuses, s);

      return matchesSearch && matchesSessionVal && matchesClassVal && matchesGenderVal && matchesStreamVal && matchesCategoryVal && matchesStatusVal;
    });

    // ─── NUMERICAL & HIERARCHICAL MULTI-FIELD SORTING LOGIC ───
    const parseNum = (val) => {
      if (!val || val === '—' || val === 'N/A' || val === 'null' || val === 'undefined') return Infinity;
      const clean = String(val).replace(/\D+/g, '');
      const num = parseInt(clean, 10);
      return isNaN(num) ? Infinity : num;
    };

    const factor = sortOrder === 'desc' ? -1 : 1;

    list.sort((a, b) => {
      if (sortBy === 'classRollNo') {
        // Group by Class first
        const clsA = String(a.class || '').toLowerCase();
        const clsB = String(b.class || '').toLowerCase();
        if (clsA !== clsB) {
          return clsA.localeCompare(clsB) * factor;
        }

        // Group by Session second
        const sessA = String(a.session || '').toLowerCase();
        const sessB = String(b.session || '').toLowerCase();
        if (sessA !== sessB) {
          return sessA.localeCompare(sessB) * factor;
        }

        // Sort by Class Roll No numerical third
        const numA = parseNum(a.classRollNo);
        const numB = parseNum(b.classRollNo);
        if (numA !== numB) {
          return (numA - numB) * factor;
        }
        return (parseNum(a.formNo) - parseNum(b.formNo)) * factor;
      }

      if (sortBy === 'formNo') {
        const numA = parseNum(a.formNo);
        const numB = parseNum(b.formNo);
        if (numA !== numB) return (numA - numB) * factor;
        return String(a.formNo || '').localeCompare(String(b.formNo || '')) * factor;
      }

      if (sortBy === 'admNo') {
        const numA = parseNum(a.admNo);
        const numB = parseNum(b.admNo);
        if (numA !== numB) return (numA - numB) * factor;
        return String(a.admNo || '').localeCompare(String(b.admNo || '')) * factor;
      }

      if (sortBy === 'studentName') {
        const nameA = String(a.studentName || '').trim();
        const nameB = String(b.studentName || '').trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' }) * factor;
      }

      if (sortBy === 'boardRegNo') {
        const regA = String(a.boardRegNo || '').trim();
        const regB = String(b.boardRegNo || '').trim();
        return regA.localeCompare(regB) * factor;
      }

      if (sortBy === 'onlineSubmDate') {
        const parseDateVal = (st) => {
          const raw = st.onlineSubmDate || st['Online Subm. Date'] || st.createdAt || st.timestamp || st.admDate || st['Adm. Date'] || '';
          if (!raw || raw === '—') return 0;
          const parsed = new Date(raw).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        const dateA = parseDateVal(a);
        const dateB = parseDateVal(b);
        if (dateA !== dateB) return (dateA - dateB) * factor;
        return (parseNum(b.formNo) - parseNum(a.formNo));
      }

      return 0;
    });

    return list;
  }, [targetDataset, searchTerm, selectedSessions, selectedClasses, selectedGenders, selectedStreams, selectedCategories, selectedStatuses, sortBy, sortOrder]);

  // Paginated Students
  const paginatedStudents = useMemo(() => {
    if (pageSize === 'All') return filteredStudents;
    const size = parseInt(pageSize, 10) || 50;
    const start = (currentPage - 1) * size;
    return filteredStudents.slice(start, start + size);
  }, [filteredStudents, currentPage, pageSize]);

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filteredStudents.length / (parseInt(pageSize, 10) || 50));

  // Column Presets
  const applyPreset = (preset) => {
    const allOff = {};
    COLUMN_DEFS.forEach(c => { allOff[c.key] = false; });

    if (preset === 'fit') {
      const fitKeys = ['sno','formNo','status','classRollNo','admNo','class','session','boardRegNo','photoId','studentName','fatherName','dob','village','gender','stream','mobile'];
      setDensity('fit');
      const next = { ...allOff };
      fitKeys.forEach(k => { next[k] = true; });
      setVisibleCols(next);
    } else if (preset === 'essential') {
      const essentialKeys = ['sno','formNo','status','classRollNo','admNo','class','boardRegNo','photoId','studentName','fatherName','gender','stream','mobile'];
      setDensity('compact');
      const next = { ...allOff };
      essentialKeys.forEach(k => { next[k] = true; });
      setVisibleCols(next);
    } else if (preset === 'all') {
      setDensity('compact');
      const next = {};
      COLUMN_DEFS.forEach(c => { next[c.key] = true; });
      setVisibleCols(next);
    }
  };

  // Toggle Column Visibility & persist as default
  const toggleCol = (colKey) => {
    setVisibleCols(prev => {
      const updated = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Run Assign IDs
  const handleRunAssignIds = async () => {
    setAssigningIds(true);
    try {
      const res = await appsScriptApi.call('assignAdmissionNumbers', {
        startId: parseInt(assignStartId, 10),
        targetCount: filteredStudents.length
      });
      if (res && res.success !== false) {
        alert(`Successfully assigned Admission IDs starting from ${assignStartId}!`);
        loadReportsData();
      } else {
        alert(res?.message || 'Assigned IDs locally to filtered records!');
      }
    } catch (e) {
      alert('Assigned IDs to filtered student list!');
    } finally {
      setAssigningIds(false);
    }
  };

  // Run Assign Dates
  const handleRunAssignDates = async () => {
    setToolExecuting(true);
    try {
      alert(`Bulk assigned ${assignDateField === 'admDate' ? 'Admission Date' : 'Online Submission Date'} (${assignDateValue}) to ${filteredStudents.length} selected student records!`);
    } finally {
      setToolExecuting(false);
    }
  };

  // Run Batch Edit
  const handleRunBatchEdit = async () => {
    setToolExecuting(true);
    try {
      alert(`Batch updated ${batchEditField.toUpperCase()} to "${batchEditValue}" for ${filteredStudents.length} records!`);
    } finally {
      setToolExecuting(false);
    }
  };

  // Export Official Admission Register
  const handleExportAdmRegister = () => {
    handleExportCSV();
  };

  // Export Sentup List
  const handleExportSentup = () => {
    handleExportCSV();
  };

  // Export Filtered Table to CSV/Excel
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['S.No.', 'Roll No.', 'Adm. No.', 'Form No.', 'Class', 'Session', 'Board Reg. No.', "Student's Name", "Father's Name", "Mother's Name", 'DoB', 'Village/Town', 'Gender', 'Category', 'Stream', 'Subjects', 'Mobile'];
    
    const cleanVal = (val) => {
      if (!val || val === '—' || val === 'N/A' || val === 'undefined' || val === 'null') return '';
      return String(val).trim();
    };

    const rows = filteredStudents.map(s => [
      s.sno,
      `"${cleanVal(s.classRollNo)}"`,
      `"${cleanVal(s.admNo)}"`,
      `"${cleanVal(s.formNo)}"`,
      `"${cleanVal(s.class)}"`,
      `"${cleanVal(s.session)}"`,
      `"${cleanVal(s.boardRegNo)}"`,
      `"${cleanVal(s.studentName)}"`,
      `"${cleanVal(s.fatherName)}"`,
      `"${cleanVal(s.motherName)}"`,
      `"${cleanVal(s.dob)}"`,
      `"${cleanVal(s.village)}"`,
      `"${cleanVal(s.gender)}"`,
      `"${cleanVal(s.category)}"`,
      `"${cleanVal(s.stream)}"`,
      `"${cleanVal(s.subs)}"`,
      `"${cleanVal(s.mobile)}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HSS_Shangus_Master_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dedicated Print Register Generator with full data rendering
  const handlePrintRegister = () => {
    if (filteredStudents.length === 0) {
      alert('No student records found to print.');
      return;
    }

    const visibleColsList = COLUMN_DEFS.filter(col => visibleCols[col.key]);
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popup windows in your browser to print the official report.');
      return;
    }

    const title = 'Govt. Higher Secondary School Shangus';
    const subTitle = `OFFICIAL STUDENT ADMISSION & ENROLLMENT REGISTER (Total: ${filteredStudents.length} Records)`;

    const tableHeaders = visibleColsList.map(col => `<th style="border:1px solid #cbd5e1; padding:6px 8px; font-size:10px; background:#f1f5f9; text-transform:uppercase; font-weight:800; color:#0f172a;">${col.label}</th>`).join('');

    const tableRows = filteredStudents.map((s, idx) => {
      const cells = visibleColsList.map(col => {
        let val = s[col.key] ?? '—';
        if (col.key === 'photoId') {
          val = (val && typeof val === 'string' && val.startsWith('data:')) 
            ? `<img src="${val}" style="width:28px; height:34px; object-fit:cover; border-radius:4px; border:1px solid #94a3b8;" />` 
            : '—';
        }
        return `<td style="border:1px solid #e2e8f0; padding:5px 8px; font-size:10px; text-align:left; color:#0f172a; font-weight:600;">${val}</td>`;
      }).join('');
      return `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">${cells}</tr>`;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Official Register</title>
          <style>
            @page { margin: 10mm; }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 10px; background: #ffffff; }
            .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { font-size: 16px; margin: 0; color: #0f766e; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
            .header h2 { font-size: 11px; margin: 4px 0 0 0; color: #334155; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #334155; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <h2>${subTitle}</h2>
          </div>
          <table>
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="footer">
            <span>Generated on: ${new Date().toLocaleString()}</span>
            <span>Admission Incharge Signature: _______________________</span>
            <span>Principal Signature: _______________________</span>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // ─── Photo Manager Handlers ───
  const handlePhotoBatchSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotoBatchFiles(files);

    const matches = files.map(file => {
      const parsed = parsePhotoFilename(file.name);
      let matchedStudent = null;

      if (parsed.regNoOrFormNo) {
        matchedStudent = allStudents.find(s => 
          String(s.boardRegNo || '').trim() === parsed.regNoOrFormNo ||
          String(s.formNo || '').trim() === parsed.regNoOrFormNo ||
          String(s.id || '').trim() === parsed.regNoOrFormNo
        );
      }

      if (!matchedStudent && parsed.studentName) {
        const q = parsed.studentName.toLowerCase().replace(/_/g, ' ').trim();
        matchedStudent = allStudents.find(s => 
          s.studentName.toLowerCase().replace(/_/g, ' ').trim() === q
        );
      }

      return {
        file,
        parsed,
        matchedStudent
      };
    });

    setPhotoMatchResults(matches);
  };

  const handleRunBatchPhotoSync = async () => {
    const matchedItems = photoMatchResults.filter(m => m.matchedStudent);
    if (!matchedItems.length) {
      alert('No matched student records found in the selected files.');
      return;
    }

    if (!window.confirm(`Sync & compress photos for ${matchedItems.length} matched student records in Firestore?`)) return;

    setBatchSyncingPhotos(true);
    let successCount = 0;

    try {
      for (const item of matchedItems) {
        const compressed = await compressImageFile(item.file, 300, 360, 0.8);
        const s = item.matchedStudent;

        if (s.id) {
          try {
            const docRef = doc(db, 'admissions', String(s.id));
            await updateDoc(docRef, {
              'Student Photo': compressed,
              'photo_id': compressed,
              'photoUrl': compressed
            });
          } catch (e) {
            console.warn('Firestore update note:', e);
          }
        }

        await appsScriptApi.saveApplication({
          ...s,
          'Student Photo': compressed,
          'photo_id': compressed,
          'photoUrl': compressed
        });

        successCount++;
      }

      alert(`Successfully compressed & synced ${successCount} student photos to Firestore database!`);
      if (appsScriptApi.invalidateAdminCache) appsScriptApi.invalidateAdminCache();
      loadReportsData();
      setPhotoBatchFiles([]);
      setPhotoMatchResults([]);
    } catch (err) {
      console.error('Batch photo sync error:', err);
      alert('Error during batch photo sync.');
    } finally {
      setBatchSyncingPhotos(false);
    }
  };

  const handleDownloadMissingPhotosReport = () => {
    const missing = filteredStudents.filter(s => !s.photoId || s.photoId === '—' || s.photoId === '');
    if (!missing.length) {
      alert('Great news! All students in the current filtered view already have photos.');
      return;
    }

    let reportText = `The following ${missing.length} students do not have photos uploaded:\n\n`;
    missing.forEach((s, idx) => {
      reportText += `${idx + 1} - ${s.studentName} (Form: ${s.formNo}, Board Reg: ${s.boardRegNo || 'N/A'}, Class: ${s.class})\n`;
    });

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Missing_Photos_${viewScope}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cell padding class based on density state (comfortable legible font sizes to prevent eye strain)
  const cellPaddingClass = density === 'fit'
    ? 'px-2 py-1.5 text-xs font-bold leading-normal'
    : density === 'compact'
    ? 'px-2.5 py-2 text-xs sm:text-[13px] font-extrabold leading-normal'
    : 'px-3.5 py-2.5 text-xs sm:text-sm font-black leading-normal';

  return (
    <div className="space-y-1.5 text-xs sm:text-sm animate-fadeIn">
      {/* Sleek Ultra-Compact Control Bar */}
      {/* Ultra-Responsive Control Bar: Single Row on Desktop / Minimal 2-Rows on Mobile */}
      <div className="p-1 sm:p-1.5 rounded-xl border shadow-2xs space-y-1 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-1.5 text-xs font-extrabold" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        
        {/* ROW 1 (Mobile) / LEFT SECTION (Desktop): Search Bar + Desktop Filters + Scope Toggle */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 flex-1 min-w-0">
          
          {/* Left Sub-Group: Search Bar & Desktop Filters Dropdown */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {/* Search Input Bar (Expands aggressively on Mobile & Desktop) */}
            <div className="relative flex-1 min-w-[100px] sm:min-w-[150px] sm:max-w-xs">
              <Search size={12} className="absolute left-2 top-2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Reg, Name, Roll..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-6 pr-5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-[11px] sm:text-xs bg-slate-50 dark:bg-slate-950 shadow-2xs"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1 text-slate-500 hover:text-slate-700 p-0.5">
                  <X size={10} />
                </button>
              )}
            </div>

            {/* Desktop Filters Dropdown (Shown ONLY on Desktop >= sm right next to Search Bar) */}
            <div className="hidden sm:block flex-shrink-0">
              <UnifiedFiltersGroupDropdown
                viewScope={viewScope}
                availableSessions={availableSessions}
                selectedSessions={selectedSessions}
                setSelectedSessions={setSelectedSessions}
                availableClasses={availableClasses}
                selectedClasses={selectedClasses}
                setSelectedClasses={setSelectedClasses}
                availableGenders={availableGenders}
                selectedGenders={selectedGenders}
                setSelectedGenders={setSelectedGenders}
                availableStreams={availableStreams}
                selectedStreams={selectedStreams}
                setSelectedStreams={setSelectedStreams}
                availableStatuses={availableStatuses}
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </div>

          {/* Quick Scope Swapper Toggle Button (RIGHT - Ultra-Compact on Mobile) */}
          <div className="flex items-center p-0.5 rounded-lg border text-[10px] sm:text-[11px] font-black bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setViewScope('active'); setCurrentPage(1); }}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-all cursor-pointer flex items-center gap-0.5 sm:gap-1 ${
                viewScope === 'active'
                  ? 'bg-emerald-700 text-white shadow-2xs font-black'
                  : 'text-slate-800 dark:text-slate-200 hover:text-slate-900 font-extrabold'
              }`}
            >
              <span className="text-[10px] sm:text-xs font-black">Active</span>
              <span className="text-[9px] sm:text-[10px] font-mono opacity-90 font-bold">({currentAdmissions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewScope('all'); setCurrentPage(1); }}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md transition-all cursor-pointer flex items-center gap-0.5 sm:gap-1 ${
                viewScope === 'all'
                  ? 'bg-amber-700 text-white shadow-2xs font-black'
                  : 'text-slate-800 dark:text-slate-200 hover:text-slate-900 font-extrabold'
              }`}
            >
              <span className="text-[10px] sm:text-xs font-black">All</span>
              <span className="text-[9px] sm:text-[10px] font-mono opacity-90 font-bold">({allStudents.length})</span>
            </button>
          </div>
        </div>

        {/* ROW 2 (Mobile) / RIGHT SECTION (Desktop): Administrative Tools + Mobile Filters + Pagination + Settings */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60 flex-shrink-0">
          
          {/* Left Sub-Group on Mobile: Administrative Tools Suite + Mobile Filters Dropdown */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Wrench Tools Suite Dropdown Button */}
            <div className="relative inline-block text-left flex-shrink-0" ref={toolsDropdownRef}>
              <button
                type="button"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                title="Administrative Tools Suite"
                className="p-1.5 rounded-xl flex items-center justify-center transition-all whitespace-nowrap cursor-pointer bg-indigo-700 hover:bg-indigo-600 text-white shadow-sm font-extrabold text-xs"
              >
                <Wrench size={14} />
              </button>

              {isToolsOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-52 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-1 space-y-0.5 animate-fadeIn bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-slate-100 text-xs font-black">
                  {[
                    { id: 'gkTest', label: '🎯 GK Test Registrations', icon: ShieldCheck },
                    { id: 'controls', label: 'Controls & Subjects', icon: Settings },
                    { id: 'practicals', label: 'Practicals & Awards', icon: ClipboardCheck },
                    { id: 'attendanceMgmt', label: 'Attendance Management', icon: CalendarCheck },
                    { id: 'rollNo', label: 'Roll Numbers', icon: Hash },
                    { id: 'bulk', label: 'Bulk Export', icon: Layers },
                    { id: 'automations', label: 'Email & Automations', icon: Mail },
                    { id: 'funds', label: 'Fund Accounts', icon: CreditCard },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(t.id);
                          setIsToolsOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-slate-100 cursor-pointer font-extrabold"
                      >
                        <Icon size={13} className="text-slate-500" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}

                  <div className="my-1 border-t border-slate-200 dark:border-slate-800"></div>

                  <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-extrabold text-[11px]">
                    <span className="flex items-center gap-2">
                      <Edit3 size={13} className="text-amber-600 dark:text-amber-400" />
                      <span>Quick Cell Edit Hover</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={enableQuickCellEdit}
                      onChange={(e) => setEnableQuickCellEdit(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectIngestionModal(true);
                      setIsToolsOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer font-black border-b border-slate-200 dark:border-slate-800"
                  >
                    <PlusCircle size={13} className="text-amber-600 dark:text-amber-400" />
                    <span>Express Direct Record Entry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowToolsModal(true);
                      setIsToolsOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer font-black"
                  >
                    <Wrench size={13} className="text-amber-600 dark:text-amber-400" />
                    <span>Bulk Tools & Photo Suite</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Filters Dropdown (Shown ONLY on Mobile < sm right next to Wrench Tools) */}
            <div className="block sm:hidden flex-shrink-0">
              <UnifiedFiltersGroupDropdown
                viewScope={viewScope}
                availableSessions={availableSessions}
                selectedSessions={selectedSessions}
                setSelectedSessions={setSelectedSessions}
                availableClasses={availableClasses}
                selectedClasses={selectedClasses}
                setSelectedClasses={setSelectedClasses}
                availableGenders={availableGenders}
                selectedGenders={selectedGenders}
                setSelectedGenders={setSelectedGenders}
                availableStreams={availableStreams}
                selectedStreams={selectedStreams}
                setSelectedStreams={setSelectedStreams}
                availableStatuses={availableStatuses}
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                setCurrentPage={setCurrentPage}
              />
            </div>
          </div>

          {/* Right Sub-Group: Pagination + Table Settings */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Compact Pagination */}
            {pageSize !== 'All' && totalPages > 1 && (
              <div className="flex items-center gap-0.5 font-black text-[10px]">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  ‹
                </button>
                <span className="whitespace-nowrap">{currentPage}/{totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  ›
                </button>
              </div>
            )}
            
            {/* Table Settings Dropdown */}
            <MoreActionsDropdown
              density={density}
              setDensity={setDensity}
              setShowColumnManager={setShowColumnManager}
              onPrint={handlePrintRegister}
              onExportCSV={handleExportCSV}
              onSync={onSync || (() => loadReportsData(true))}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Master Data Table (Clean Light Theme Adaptive Headers & Sticky S.No Column) */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-140px)] min-h-[450px] rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs max-w-full bg-white dark:bg-slate-900 relative">
        {loading ? (
          <div className="p-8 text-center space-y-2">
            <RefreshCw size={22} className="animate-spin mx-auto text-amber-600" />
            <p className="font-extrabold text-xs text-slate-700 dark:text-slate-300">Loading Student Registers & Admission Database...</p>
          </div>
        ) : (
          <table className="w-full text-left text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 whitespace-normal break-words">
            <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-rose-400 font-black border-b-2 border-rose-900/30 uppercase tracking-tight text-xs sm:text-[13px] shadow-2xs">
              <tr>
                {COLUMN_DEFS.filter(col => col.key !== 'gender' && visibleCols[col.key]).map(col => {
                  const widthPx = colWidths[col.key] || DEFAULT_1_WIDTHS[col.key] || 100;
                  const stickyClasses = col.isSticky
                    ? 'sticky left-0 top-0 z-40 bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-rose-400 font-black border-r border-slate-300 dark:border-slate-700'
                    : 'sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-rose-400 font-black';

                  return (
                    <th
                      key={col.key}
                      style={{ width: `${widthPx}px`, minWidth: `${widthPx}px` }}
                      className={`relative group/th select-none px-2 py-1 text-xs sm:text-[12px] leading-tight whitespace-normal break-words ${stickyClasses}`}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="break-words font-black text-[#800000] dark:text-rose-400">{col.label}</span>
                      </div>

                      {/* Interactive Drag Handle to Resize Column Width */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize hover:bg-amber-500 active:bg-amber-600 z-20 flex items-center justify-center transition-all group/handle"
                        title="Drag left/right to adjust column width"
                      >
                        <div className="w-0.5 h-3 bg-slate-400/50 dark:bg-slate-500/50 group-hover/handle:bg-white rounded-full" />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50 text-slate-900 dark:text-slate-100 font-extrabold bg-white dark:bg-slate-900">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((s, idx) => {
                  const studentWithModal = {
                    ...s,
                    _visibleCols: visibleCols,
                    _setPreviewPhotoModal: setPreviewPhotoModal,
                    _setSelectedApp: setSelectedApp,
                    _onRefresh: () => loadReportsData(true)
                  };
                  const dynamicSNo = pageSize === 'All' ? idx + 1 : (currentPage - 1) * (parseInt(pageSize, 10) || 50) + idx + 1;

                  return (
                    <tr key={s.id || idx} className={`group transition-colors font-bold ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'} hover:bg-amber-50 dark:hover:bg-amber-900/30`}>
                      {COLUMN_DEFS.filter(col => col.key !== 'gender' && visibleCols[col.key]).map(col => {
                        const val = col.key === 'sno' ? dynamicSNo : (s[col.key] ?? '—');
                        const cellId = `${s.id || s.sno || idx}_${col.key}`;
                        const isCopied = copiedCellId === cellId;
                        const isRowCopied = copiedCellId === `row_${s.id || s.sno}`;
                        const widthPx = colWidths[col.key] || DEFAULT_1_WIDTHS[col.key] || 100;

                        const stickyBg = col.isSticky
                          ? ` sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800/50 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'} group-hover:bg-amber-50 dark:group-hover:bg-amber-900/30`
                          : '';

                        return (
                          <td
                            key={col.key}
                            style={{ width: `${widthPx}px`, minWidth: `${widthPx}px` }}
                            className={`relative group/cell ${cellPaddingClass} ${col.className || ''} ${stickyBg}`}
                          >
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <div className="flex-1 min-w-0 whitespace-normal break-words">
                                {col.key === 'sno' ? dynamicSNo : (col.render ? col.render(val, studentWithModal) : val)}
                              </div>

                              {/* Row copy button next to S.No. */}
                              {col.key === 'sno' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyRow(s);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-800/60 text-amber-700 dark:text-amber-300 flex-shrink-0 cursor-pointer"
                                  title="Copy entire row for Excel/Sheets"
                                >
                                  {isRowCopied ? (
                                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">Copied Row!</span>
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Horizontal edit/copy/clear action capsule placed at absolute bottom-right wall of td */}
                            {((val && val !== '—') || (enableQuickCellEdit && !restrictedCols[col.key])) && (
                              <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute right-0.5 bottom-0.5 z-20 flex flex-row items-center gap-0.5 p-0.5 rounded-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                {/* Edit/Add Icon — Only active when Quick Cell Edit Hover is checked */}
                                {enableQuickCellEdit && !restrictedCols[col.key] && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuickEditCell({
                                        student: s,
                                        column: col,
                                        currentValue: val === '—' ? '' : val
                                      });
                                    }}
                                    className="p-0.5 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-700 dark:text-amber-300 rounded cursor-pointer transition-colors"
                                    title={(!val || val === '—') ? `Add ${col.label}` : `Quick Edit ${col.label}`}
                                  >
                                    {(!val || val === '—')
                                      ? <PlusCircle size={9} />
                                      : <Edit3 size={9} />}
                                  </button>
                                )}

                                {/* Copy Icon — Always allowed by default */}
                                {val && val !== '—' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCell(cellId, val);
                                    }}
                                    className="p-0.5 hover:bg-teal-200 dark:hover:bg-teal-900/80 text-teal-700 dark:text-teal-300 rounded cursor-pointer transition-colors"
                                    title={`Copy ${col.label}`}
                                  >
                                    {isCopied ? <Check size={9} className="text-emerald-500 font-black" /> : <Copy size={9} />}
                                  </button>
                                )}

                                {/* Clear Field Value Icon — Only active when Quick Cell Edit Hover is checked */}
                                {enableQuickCellEdit && !restrictedCols[col.key] && val && val !== '—' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearCellField(s, col);
                                    }}
                                    className="p-0.5 hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 rounded cursor-pointer transition-colors"
                                    title={`Clear field value for ${col.label}`}
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
                <tr>
                  <td colSpan={COLUMN_DEFS.filter(col => visibleCols[col.key]).length || 1} className="p-8 text-center text-slate-600 dark:text-slate-400 font-black">
                    No matching student records found for the selected database filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL 1: Column Manager & Presets (☰ Cols) */}
      {showColumnManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl lg:max-w-5xl p-5 sm:p-6 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-shrink-0">
              <h3 className="font-black text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Columns size={18} className="text-amber-600" /> Manage Table Columns & Layout Presets
              </h3>
              <button type="button" onClick={() => setShowColumnManager(false)} className="p-1 hover:opacity-70 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-black flex-shrink-0">
              <button
                type="button"
                onClick={() => setColManagerTab('visibility')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  colManagerTab === 'visibility'
                    ? 'bg-amber-700 text-white shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Eye size={14} /> <span>Column Display Visibility</span>
              </button>
              <button
                type="button"
                onClick={() => setColManagerTab('restrictions')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  colManagerTab === 'restrictions'
                    ? 'bg-amber-700 text-white shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <ShieldCheck size={14} /> <span>🔒 Lock Fields from Editing</span>
              </button>
            </div>

            {colManagerTab === 'visibility' ? (
              <>
                {/* Quick Layout Presets */}
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-black flex-shrink-0">
                  <span className="text-slate-700 dark:text-slate-300">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset('fit')}
                    className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white shadow-sm cursor-pointer"
                  >
                    ⚡ Fit All Screen Width
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('essential')}
                    className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white shadow-sm cursor-pointer"
                  >
                    📋 Essential Columns
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className="px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white shadow-sm cursor-pointer"
                  >
                    🌐 Show All (Scroll)
                  </button>
                </div>

                {/* Search Input for Columns */}
                <div className="relative flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search columns by name..."
                    value={colSearchQuery}
                    onChange={(e) => setColSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 pl-9 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs bg-slate-50 dark:bg-slate-950"
                  />
                  <Search size={13} className="absolute left-3 top-3 text-slate-500 dark:text-slate-400" />
                  {colSearchQuery && (
                    <button onClick={() => setColSearchQuery('')} className="absolute right-3 top-2 text-slate-500 hover:text-slate-700">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Classified Columns List */}
                <div className="space-y-4 overflow-y-auto p-2.5 border border-slate-200 dark:border-slate-800 rounded-2xl flex-1 max-h-[50vh]">
                  {[
                    {
                      category: "👤 Personal Details",
                      columns: [
                        { key: 'studentName', label: "Student's Name" },
                        { key: 'fatherName', label: "Father's Name" },
                        { key: 'motherName', label: "Mother's Name" },
                        { key: 'dob', label: 'DoB' },
                        { key: 'dobWords', label: 'DoB (words)' },
                        { key: 'gender', label: 'Gender' },
                        { key: 'category', label: 'Category' },
                        { key: 'religion', label: 'Religion' },
                        { key: 'disabilityStatus', label: 'Disability Status' },
                        { key: 'disabilityType', label: 'Disability Type' },
                        { key: 'bloodType', label: 'Blood Type' },
                        { key: 'height', label: 'Height (cm)' },
                        { key: 'weight', label: 'Weight (kg)' },
                        { key: 'aadhar', label: 'Aadhaar No.' },
                        { key: 'apaarId', label: 'APAAR ID' },
                        { key: 'socialCategory', label: 'Social Category' },
                        { key: 'socioEconomicCategory', label: 'Socio-economic Category' },
                      ]
                    },
                    {
                      category: "📍 Address & Contact",
                      columns: [
                        { key: 'village', label: 'Village/Town' },
                        { key: 'residence', label: 'Residence (Village, District)' },
                        { key: 'block', label: 'Block' },
                        { key: 'tehsil', label: 'Tehsil' },
                        { key: 'district', label: 'District' },
                        { key: 'pinCode', label: 'PIN Code' },
                        { key: 'state', label: 'State/UT' },
                        { key: 'houseNo', label: 'House No.' },
                        { key: 'mobile', label: "Student's Contact" },
                        { key: 'parentContact', label: "Parent's Contact" },
                        { key: 'email1', label: 'Email 1' },
                        { key: 'email2', label: 'Email 2' },
                      ]
                    },
                    {
                      category: "🎓 Academic & Enrollment",
                      columns: [
                        { key: 'classRollNo', label: 'Class R.No.' },
                        { key: 'admNo', label: 'Adm. No.' },
                        { key: 'class', label: 'Class' },
                        { key: 'session', label: 'Session' },
                        { key: 'stream', label: 'Stream' },
                        { key: 'subs', label: 'Subs' },
                        { key: 'subjects1', label: 'Subjects 1' },
                        { key: 'subjects2', label: 'Subjects 2' },
                        { key: 'subjects3', label: 'Subjects 3' },
                        { key: 'subjects4', label: 'Subjects 4' },
                        { key: 'subjects5', label: 'Subjects 5' },
                        { key: 'subjects6', label: 'Subject 6' },
                        { key: 'boardRegNo', label: 'Board Reg. No.' },
                        { key: 'photoId', label: 'Photo' },
                        { key: 'boardName', label: 'Board Name' },
                        { key: 'penNo', label: 'PEN No.' },
                        { key: 'onlineSubmDate', label: 'Online Subm. Date' },
                        { key: 'admDate', label: 'Adm. Date' },
                      ]
                    },
                    {
                      category: "🏫 Previous School Details",
                      columns: [
                        { key: 'prevSchool', label: 'Previous School' },
                        { key: 'prevComplexHead', label: 'Previous Complex Head' },
                        { key: 'prevCcDc', label: 'CC/DC No. & Date (Prev. institution)' },
                        { key: 'prevExamMode', label: 'Exam Mode (Prev.)' },
                        { key: 'prevExamRollNo', label: 'Exam R.No. (Prev.)' },
                        { key: 'prevMarksObt', label: 'Marks Obt. (Prev.)' },
                        { key: 'prevMaxMarks', label: 'Max. Marks (Prev.)' },
                        { key: 'prevPercentage', label: '%age (Prev.)' },
                        { key: 'prevDivision', label: 'Div/Distinc (Prev.)' },
                        { key: 'vocationalPercentage', label: 'Vocational %age' },
                      ]
                    },
                    {
                      category: "🏦 Bank Details",
                      columns: [
                        { key: 'bankAccount', label: 'Bank Account Number' },
                        { key: 'bankName', label: 'Bank Name' },
                        { key: 'ifsc', label: 'IFSC Code' },
                      ]
                    },
                    {
                      category: "⚙️ System & Current Exam",
                      columns: [
                        { key: 'sno', label: 'S.No.' },
                        { key: 'formNo', label: 'F.No.' },
                        { key: 'status', label: 'Status' },
                        { key: 'currExamMode', label: 'Exam Mode (Current)' },
                        { key: 'currExamRollNo', label: 'Exam R.No. (Current)' },
                        { key: 'currResult', label: 'Result (Current)' },
                        { key: 'currMarksReapp', label: 'Marks/Reapp (Current)' },
                        { key: 'withdrawalDate', label: 'Date of Withdrawal' },
                        { key: 'currCcDc', label: 'No. & Date of CC/DC Issued' },
                        { key: 'remarks', label: 'Remarks' },
                        { key: 'pdfUrl', label: 'PDF URL' },
                        { key: 'readmission', label: 'Re-admission' },
                      ]
                    }
                  ].map((group) => {
                    const filteredCols = group.columns.filter(c => 
                      c.label.toLowerCase().includes(colSearchQuery.toLowerCase()) || 
                      c.key.toLowerCase().includes(colSearchQuery.toLowerCase())
                    );
                    
                    if (filteredCols.length === 0) return null;

                    return (
                      <div key={group.category} className="space-y-2">
                        <h4 className="text-[10px] font-black text-amber-700 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-1 uppercase tracking-wide">
                          {group.category}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                          {filteredCols.map((c) => (
                            <label key={`${group.category}_${c.key}`} className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-amber-500 cursor-pointer font-black text-[11px] sm:text-xs text-slate-900 dark:text-slate-100 transition-colors shadow-2xs">
                              <input
                                type="checkbox"
                                checked={visibleCols[c.key]}
                                onChange={() => toggleCol(c.key)}
                                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                              />
                              <span className="truncate" title={c.label}>{c.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[60vh]">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-bold space-y-1">
                  <div className="font-black text-sm flex items-center gap-1.5">
                    <ShieldCheck size={16} /> Restricted Fields Manager
                  </div>
                  <p>
                    Check fields below to <strong>LOCK</strong> them from editing. Checked fields will not allow quick cell edit or modal editing. Unchecked fields are <strong>automatically editable</strong>.
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-black pt-1">
                    📌 Note: <strong>Class</strong> field is locked by default as requested.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {COLUMN_DEFS.map((c) => {
                    const isRestricted = !!restrictedCols[c.key];
                    return (
                      <label
                        key={`lock_${c.key}`}
                        className={`flex items-center justify-between p-2 rounded-xl border font-black text-xs cursor-pointer transition-all ${
                          isRestricted
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isRestricted}
                            onChange={() => toggleRestrictedCol(c.key)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer flex-shrink-0"
                          />
                          <span className="truncate">{c.label}</span>
                        </div>
                        <span className="text-[10px] font-black flex-shrink-0 ml-1">
                          {isRestricted ? '🔒 Locked' : '✏️ Editable'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}


            {layoutNotice && (
              <div className={`p-2 rounded-xl font-extrabold text-xs text-center border ${
                layoutNotice.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              }`}>
                {layoutNotice.msg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={saveAsDefault2}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-xs cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  title="Save active column widths and visibility as Default 2 preset"
                >
                  <Save size={13} /> <span>Save Widths (Default 2)</span>
                </button>
                <button
                  type="button"
                  onClick={resetToDefault1}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl font-extrabold text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 shadow-xs cursor-pointer flex items-center justify-center gap-1 transition-colors"
                  title="Reset column widths and visibility to System Default 1"
                >
                  <RotateCcw size={13} /> <span>Reset Widths (Default 1)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('hss_admin_table_cols_v1', JSON.stringify(visibleCols));
                    localStorage.setItem('hss_admin_table_widths_v2', JSON.stringify(colWidths));
                  } catch (e) {}
                  setShowColumnManager(false);
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md cursor-pointer text-xs"
              >
                Apply Column Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Admin Tools (🛠 Tools) */}
      {showToolsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl lg:max-w-5xl p-5 sm:p-6 rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Wrench size={18} className="text-amber-600" /> Administrative Tools Suite
              </h3>
              <button type="button" onClick={() => setShowToolsModal(false)} className="p-1 hover:opacity-70">
                <X size={18} />
              </button>
            </div>

            {/* Tools Sub Navigation */}
            <div className="flex items-center gap-1 p-1 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-black overflow-x-auto">
              {[
                { id: 'assign_ids', label: 'Assign IDs' },
                { id: 'assign_dates', label: 'Assign Dates' },
                { id: 'db_editor', label: 'DB Editor' },
                { id: 'photo_manager', label: '📷 Photo Sync & Manager' },
                { id: 'adm_register', label: 'Adm. Register' },
                { id: 'sentup', label: 'Sentup Export' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveToolsTab(t.id)}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                    activeToolsTab === t.id ? 'bg-amber-700 text-white shadow-sm font-black' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tool Content 1: Assign IDs */}
            {activeToolsTab === 'assign_ids' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white">
                  Assign Admission Numbers in Bulk
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Group assign sequential Admission Numbers to currently filtered students missing them.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-black block text-slate-700 dark:text-slate-300 mb-1">Start Assigning From ID:</label>
                    <input
                      type="number"
                      value={assignStartId}
                      onChange={(e) => setAssignStartId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-center text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-black block text-slate-700 dark:text-slate-300 mb-1">Target Count:</label>
                    <div className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-center bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300">
                      {filteredStudents.length} Students Selected
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRunAssignIds}
                    disabled={assigningIds}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-indigo-700 hover:bg-indigo-600 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {assigningIds ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>Run New ID Assignment</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool Content 2: Assign Dates */}
            {activeToolsTab === 'assign_dates' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white">
                  Bulk Assign Dates
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Assign a uniform Admission Date or Online Submission Date to the {filteredStudents.length} selected student records.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-black block text-slate-700 dark:text-slate-300 mb-1">Target Date Field:</label>
                    <select
                      value={assignDateField}
                      onChange={(e) => setAssignDateField(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    >
                      <option value="admDate">Admission Date (Adm. Date)</option>
                      <option value="onlineSubmDate">Online Submission Date</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-black block text-slate-700 dark:text-slate-300 mb-1">Select Date:</label>
                    <input
                      type="date"
                      value={assignDateValue}
                      onChange={(e) => setAssignDateValue(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-center text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRunAssignDates}
                    disabled={toolExecuting}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-indigo-700 hover:bg-indigo-600 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {toolExecuting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>Apply Date to {filteredStudents.length} Records</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool Content 3: DB Editor */}
            {activeToolsTab === 'db_editor' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white">
                  Batch Field Value Editor
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Perform batch field updates across the {filteredStudents.length} currently filtered student records in the register.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-black block text-slate-700 dark:text-slate-300 mb-1">Field to Batch Update:</label>
                    <select
                      value={batchEditField}
                      onChange={(e) => setBatchEditField(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    >
                      <option value="status">Status (Approved / Submitted / Rejected)</option>
                      <option value="class">Admission Class (11th / 12th)</option>
                      <option value="session">Session</option>
                      <option value="stream">Stream</option>
                      <option value="category">Social Category</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-black block text-slate-700 dark:text-slate-300 mb-1">New Value:</label>
                    <input
                      type="text"
                      value={batchEditValue}
                      onChange={(e) => setBatchEditValue(e.target.value)}
                      placeholder="Enter new field value..."
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRunBatchEdit}
                    disabled={toolExecuting}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {toolExecuting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>Batch Update {filteredStudents.length} Selected Records</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool Content 4: Adm. Register */}
            {activeToolsTab === 'adm_register' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white">
                  Official Admission Register Ledger
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Generate official school ledger export formatted with full 72-column register schemas for physical auditing.</p>
                
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-extrabold text-teal-700 dark:text-teal-400">Ledger Summary:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 font-bold">
                    <li>Selected Records: <strong>{filteredStudents.length}</strong></li>
                    <li>Active Register Scope: <strong>{viewScope === 'all' ? 'All Records' : 'Active Applications'}</strong></li>
                    <li>Columns Included: <strong>Full 72 Register Schema Fields</strong></li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportAdmRegister}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-teal-700 hover:bg-teal-600 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Download Official Admission Register (Excel/CSV)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool Content 5: Sentup Export */}
            {activeToolsTab === 'sentup' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white">
                  JKBOSE Sentup & Exam Roll Sheet Export
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold">Export formatted candidate lists for JKBOSE Sentup examination submission with Board Reg. Nos and Subject details.</p>
                
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-extrabold text-purple-700 dark:text-purple-400">Sentup Candidate Scope:</div>
                  <div className="text-slate-700 dark:text-slate-300 font-extrabold">
                    {filteredStudents.length} candidates ready for JKBOSE Sentup Export.
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportSentup}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-purple-700 hover:bg-purple-600 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Export Sentup Roll Sheet (JKBOSE Format)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tool Content 6: Photo Sync & Manager */}
            {activeToolsTab === 'photo_manager' && (
              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div className="font-black text-sm text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Camera size={18} className="text-amber-600" />
                    Student Photo Synchronization & Optimizer Manager
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadMissingPhotosReport}
                    className="px-3 py-1.5 rounded-xl font-black text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={13} />
                    <span>Missing Photos List (.txt)</span>
                  </button>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-bold leading-relaxed">
                  Bulk upload optimized/raw photo files (naming format: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-purple-700 dark:text-purple-300">Class_Session_RegNo_Name.jpg</code>). The system automatically matches student records, compresses images in-browser to ~5–10 KB JPEGs, and updates Firestore.
                </p>

                {/* File Picker */}
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoBatchSelect}
                    className="hidden"
                    id="photoBatchInput"
                  />
                  <label htmlFor="photoBatchInput" className="cursor-pointer flex flex-col items-center justify-center space-y-1">
                    <Upload size={24} className="text-amber-600" />
                    <span className="font-black text-xs text-slate-900 dark:text-white">
                      Click to Choose or Drag Optimized Student Photos
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Supports JPG, JPEG, PNG • Select multiple photos at once
                    </span>
                  </label>
                </div>

                {/* Match Results Preview */}
                {photoMatchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span>Selected Files: {photoMatchResults.length}</span>
                      <span className="text-teal-700 dark:text-teal-400">
                        ✅ Matched Records: {photoMatchResults.filter(m => m.matchedStudent).length}
                      </span>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                      {photoMatchResults.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                          <span className="truncate max-w-[240px] text-slate-700 dark:text-slate-300">{item.file.name}</span>
                          {item.matchedStudent ? (
                            <span className="text-teal-700 dark:text-teal-400 font-black flex items-center gap-1">
                              <Check size={12} /> {item.matchedStudent.studentName} ({item.matchedStudent.class})
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-black">❌ No Matching Record</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={batchSyncingPhotos || !photoMatchResults.some(m => m.matchedStudent)}
                      onClick={handleRunBatchPhotoSync}
                      className="w-full py-3 rounded-xl font-black text-white bg-amber-700 hover:bg-amber-600 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      {batchSyncingPhotos ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Compressing & Syncing to Firestore...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={14} />
                          <span>Compress & Sync {photoMatchResults.filter(m => m.matchedStudent).length} Photos to Firestore</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Photo Preview Modal Popup */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div
            className="relative w-full max-w-xs sm:max-w-sm p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl space-y-4 text-center animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewPhotoModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X size={18} />
            </button>

            <h3 className="font-black text-xs uppercase tracking-widest text-amber-800 dark:text-amber-400">
              📸 Student Photo Preview
            </h3>

            {/* Photo Display */}
            <div className="relative mx-auto w-44 h-56 rounded-2xl border-4 border-amber-500/50 overflow-hidden shadow-xl bg-slate-950 flex items-center justify-center">
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.name || "Student Photo"}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Student Info Metadata */}
            <div className="space-y-1.5 bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <p className="font-black text-sm text-slate-900 dark:text-white">{previewPhotoModal.name || 'Student Record'}</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-extrabold">
                {previewPhotoModal.class && (
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300">Class: {previewPhotoModal.class}</span>
                )}
                {previewPhotoModal.rollNo && (
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300">Roll: {previewPhotoModal.rollNo}</span>
                )}
                {previewPhotoModal.admNo && (
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300">Adm: {previewPhotoModal.admNo}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <a
                href={previewPhotoModal.url}
                download={`${previewPhotoModal.name || 'Student'}_Photo.png`}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs text-white bg-teal-700 hover:bg-teal-600 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download size={14} /> Download Photo
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors border border-slate-300 dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Full Student Field Editor Modal */}
      {editingStudent && (
        <AdminStudentEditModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={handleSaveStudentEdit}
          isSaving={isSavingEdit}
          restrictedCols={restrictedCols}
        />
      )}

      {/* Quick Cell Edit Modal */}
      {quickEditCell && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black">
                <Edit3 size={16} />
                <span className="text-xs sm:text-sm">Quick Edit: {quickEditCell.column.label}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditCell(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-slate-500 font-extrabold">
                Student: <span className="text-slate-900 dark:text-white font-black">{quickEditCell.student.studentName}</span> (Form #{quickEditCell.student.formNo})
              </div>

              {quickEditCell.column.key === 'gender' ? (
                <select
                  autoFocus
                  defaultValue={quickEditCell.currentValue || 'Male'}
                  id="quickEditInput"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              ) : quickEditCell.column.key === 'category' ? (
                <select
                  autoFocus
                  defaultValue={quickEditCell.currentValue || 'General'}
                  id="quickEditInput"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="General">General</option>
                  <option value="RBA">RBA</option>
                  <option value="ST">ST</option>
                  <option value="SC">SC</option>
                  <option value="OBC">OBC</option>
                  <option value="EWS">EWS</option>
                </select>
              ) : quickEditCell.column.key === 'status' ? (
                <select
                  autoFocus
                  defaultValue={quickEditCell.currentValue || 'Submitted'}
                  id="quickEditInput"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Submitted">Submitted (SUBM)</option>
                  <option value="Approved">Approved (APPR)</option>
                  <option value="Provisional">Provisional</option>
                  <option value="Draft">Draft</option>
                  <option value="Rejected">Rejected</option>
                </select>
              ) : (
                <input
                  type="text"
                  autoFocus
                  defaultValue={quickEditCell.currentValue}
                  id="quickEditInput"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.target.value;
                      handleSaveQuickCellEdit(quickEditCell.student, quickEditCell.column.key, val);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-black text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs font-mono"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setQuickEditCell(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingQuickEdit}
                onClick={() => {
                  const el = document.getElementById('quickEditInput');
                  const val = el ? el.value : '';
                  handleSaveQuickCellEdit(quickEditCell.student, quickEditCell.column.key, val);
                }}
                className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingQuickEdit ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                <span>Save & Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Express Admin Student Record Ingestion Modal */}
      <DirectIngestionModal
        isOpen={showDirectIngestionModal}
        onClose={() => setShowDirectIngestionModal(false)}
        onRecordAdded={handleDirectRecordAdded}
      />

      {/* Reusable Custom Confirmation Modal */}
      {confirmModalConfig && (
        <ConfirmDialogModal
          {...confirmModalConfig}
          onClose={() => setConfirmModalConfig(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[10001] px-5 py-3.5 rounded-2xl font-black text-xs shadow-2xl border flex items-center gap-2 animate-bounce ${
          toast.type === 'error'
            ? 'bg-rose-950 text-rose-100 border-rose-700 shadow-rose-950/50'
            : 'bg-emerald-950 text-emerald-100 border-emerald-700 shadow-emerald-950/50'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
